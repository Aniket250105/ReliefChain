import { PrismaClient } from '@prisma/client';
import { emailService } from './email.service';
import { createAuditLog } from './audit.service';

const prisma = new PrismaClient();

export const notifyMultisigSigners = async (allocationId: string) => {
  // Use process.nextTick to guarantee non-blocking behavior for the main thread
  process.nextTick(async () => {
    try {
      const allocation = await prisma.allocation.findUnique({
        where: { id: allocationId },
        include: { 
          campaign: { include: { disaster: { include: { authority: true } } } },
          MultisigApprovals: true 
        }
      });

      if (!allocation || allocation.status !== 'PENDING_MULTISIG') return;

      // Identify exact required signers based on M8 semantics.
      // The authoritative signer is the Disaster's Authority organization.
      // We identify users within this exact organization who possess the GOVERNMENT_AUTHORITY role.
      const authorityOrgId = allocation.campaign.disaster.authorityId;
      const authorityWallet = allocation.campaign.disaster.authority.walletAddress;

      // Check if this authority has already signed
      const hasSigned = allocation.MultisigApprovals.some(
        app => app.signerWallet.toLowerCase() === authorityWallet?.toLowerCase() && app.status === 'Signed'
      );

      if (hasSigned) {
        // Required signer has already approved this cycle, no notification needed.
        return;
      }

      // Query users who belong to the Authority org AND have the GOVERNMENT_AUTHORITY role
      // (matching the actual Web2Role enum from shared-types)
      const eligibleSigners = await prisma.user.findMany({
        where: {
          organizationId: authorityOrgId,
          role: 'GOVERNMENT_AUTHORITY'
        }
      });

      for (const signer of eligibleSigners) {
        // Idempotency: recipientId + type + entityId
        const idempotencyKey = `${signer.id}:MULTISIG_APPROVAL_REQUIRED:Allocation:${allocation.id}`;
        
        try {
          const notification = await prisma.notification.upsert({
            where: { idempotencyKey },
            create: {
              recipientId: signer.id,
              type: 'MULTISIG_APPROVAL_REQUIRED',
              title: `Approval Required: Allocation ${allocation.id.slice(0, 8)}`,
              message: `An allocation for ${allocation.amount} unit(s) has been requested and requires your multisig approval.`,
              entityType: 'Allocation',
              entityId: allocation.id,
              idempotencyKey,
              status: 'UNREAD',
              deliveryStatus: 'PENDING'
            },
            update: {}
          });

          // If we just created it (PENDING), attempt to send email
          if (notification.deliveryStatus === 'PENDING') {
            await createAuditLog({
              actorId: signer.id,
              action: 'NOTIFICATION_DELIVERY_ATTEMPT',
              entityType: 'Notification',
              entityId: notification.id,
              status: 'Success',
              metadata: { emailAttempted: true, allocationId }
            });

            const emailSent = await emailService.send({
              to: signer.email,
              subject: notification.title,
              body: notification.message
            });

            await prisma.notification.update({
              where: { id: notification.id },
              data: { deliveryStatus: emailSent ? 'SENT' : 'FAILED' }
            });
          }
        } catch (dbError) {
          // If concurrent insert happens or DB error, fail gracefully per recipient
          console.error(`Failed to process notification for signer ${signer.id}: ${dbError}`);
        }
      }
    } catch (e: any) {
      console.error(`notifyMultisigSigners failed: ${e.message}`);
    }
  });
};
