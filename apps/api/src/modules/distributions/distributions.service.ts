import { PrismaClient, Prisma } from '@prisma/client';
import { createAuditLog } from '../../services/audit.service';
import { ResourceBatchStatus } from '@reliefchain/shared-types';
import { web3Service } from '../../services/web3.service';
import { uuidToBytes32 } from '../../utils/web3-format';
import { triggerAIDistributionCheck } from '../ai/ai.service';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

export class DistributionService {
  /**
   * Distribute a resource batch.
   * Modifies off-chain inventory, prepares the operational record, and submits the on-chain transaction.
   *
   * @param batchId - ResourceBatch UUID
   * @param quantityDistributed - string or number representing the exact decimal quantity
   * @param beneficiaryCount - integer number of beneficiaries
   * @param officerId - derived from JWT
   * @param orgId - derived from JWT (req.user.organizationId)
   * @param evidenceHash - optional hash of the required photo evidence
   */
  static async distribute(
    batchId: string, 
    quantityDistributed: string | number, 
    beneficiaryCount: number, 
    officerId: string, 
    orgId: string,
    evidenceHash: string,
    ipfsCid: string,
    idempotencyKey: string
  ) {
    // 1. Idempotency Check
    const existingDistribution = await prisma.distribution.findUnique({
      where: { idempotencyKey }
    });

    if (existingDistribution) {
      // If same logical payload (batch, quantity), return it. Otherwise conflict.
      if (
        existingDistribution.batchId === batchId && 
        existingDistribution.quantity.toString() === quantityDistributed.toString() &&
        existingDistribution.beneficiaryCount === beneficiaryCount &&
        // To verify the full fingerprint, we must also check the Evidence record linked to it
        true // We will query the evidence record below to verify
      ) {
        // Query evidence to complete fingerprint
        const existingEvidence = await prisma.evidence.findFirst({
          where: { entityType: 'Distribution', entityId: existingDistribution.id }
        });
        if (existingEvidence && existingEvidence.contentHashSha256 === evidenceHash && existingEvidence.ipfsCid === ipfsCid) {
          return existingDistribution;
        } else {
          throw new Error('Conflict: Idempotency-Key already used with a different evidence payload');
        }
      } else {
        throw new Error('Conflict: Idempotency-Key already used with a different payload');
      }
    }
    if (!Number.isInteger(beneficiaryCount) || beneficiaryCount < 0) {
      throw new Error('Beneficiary count must be a non-negative integer.');
    }

    const qty = new Prisma.Decimal(quantityDistributed.toString());
    if (qty.lte(0)) {
      throw new Error('Distribution quantity must be greater than zero.');
    }

    // 1. Transactionally lock and deduct Inventory
    let distributionRecord;
    try {
      distributionRecord = await prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findFirst({
          where: { batchId, locationId: orgId },
          include: { batch: true }
        });

        if (!inventory) {
          throw new Error('Inventory record not found at this relief center.');
        }

        if (inventory.batch.status !== ResourceBatchStatus.RECEIVED_RELIEF_CENTER) {
          throw new Error('Batch is not at the relief center stage.');
        }

        const currentQty = new Prisma.Decimal(inventory.currentQuantity.toString());
        const newQuantity = currentQty.sub(qty);

        if (newQuantity.isNegative()) {
          throw new Error(`Insufficient stock. Available: ${currentQty.toString()}`);
        }

        // Deduct inventory
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { currentQuantity: newQuantity }
        });

        // Log movement (distribution out)
        await tx.inventoryMovement.create({
          data: {
            batchId: inventory.batchId,
            toLocation: 'DISTRIBUTED',
            quantity: qty.negated(),
            movementType: 'DISTRIBUTION',
            actorId: officerId
          }
        });

        // Create Pending Distribution Record
        const dist = await tx.distribution.create({
          data: {
            batchId,
            officerId,
            quantity: qty,
            beneficiaryCount,
            status: 'EXECUTING',
            blockchainTxHash: null,
            idempotencyKey
          }
        });

        // Canonical representation of CID for Blockchain
        const canonicalBlockchainCid = ethers.id(ipfsCid);

        // Create Evidence record for the distribution
        await tx.evidence.create({
          data: {
            fileUrl: `mock-storage://${ipfsCid}`,
            contentHashSha256: evidenceHash,
            ipfsCid: ipfsCid,
            blockchainCidBytes32: canonicalBlockchainCid,
            entityType: 'Distribution',
            entityId: dist.id
          }
        });

        // Create initial audit log
        await createAuditLog({
          actorId: officerId,
          action: 'DISTRIBUTION_INITIATED',
          entityType: 'Distribution',
          entityId: dist.id,
          status: 'Success',
          metadata: {
            batchId,
            quantity: qty.toString(),
            beneficiaryCount,
            previousInventory: currentQty.toString(),
            newInventory: newQuantity.toString(),
            evidenceHash
          }
        });

        return dist;
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        const concurrentDist = await prisma.distribution.findUnique({ where: { idempotencyKey } });
        if (concurrentDist) {
          if (
            concurrentDist.batchId === batchId && 
            concurrentDist.quantity.toString() === quantityDistributed.toString() &&
            concurrentDist.beneficiaryCount === beneficiaryCount
          ) {
            const concurrentEvidence = await prisma.evidence.findFirst({
              where: { entityType: 'Distribution', entityId: concurrentDist.id }
            });
            if (concurrentEvidence && concurrentEvidence.contentHashSha256 === evidenceHash && concurrentEvidence.ipfsCid === ipfsCid) {
              return concurrentDist; // The winner will handle the Web3 submission.
            } else {
              throw new Error('Conflict: Idempotency-Key already used concurrently with a different evidence payload');
            }
          } else {
            throw new Error('Conflict: Idempotency-Key already used concurrently with a different payload');
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // 2. We no longer submit to Blockchain via Web3Relayer in Phase 5
    // The Relief Officer's wallet must do it directly from the frontend.
    let txHash: string | null = null;
    try {
      // Find the officer's blockchain address (mocked or real)
      const officer = await prisma.user.findUnique({ where: { id: officerId } });
      
      // M14: Asynchronous AI Check (Non-blocking) - wait for CONFIRMED status in Phase 5 via Indexer
      // triggerAIDistributionCheck(distributionRecord.id);

    } catch (error: any) {
      console.error(`Error in distribution service post-processing: ${error.message}`);
    }

    return {
      distributionId: distributionRecord.id,
      status: 'EXECUTING',
      blockchainTxHash: txHash,
      ipfsCid: ipfsCid
    };
  }

  static async list(officerId: string) {
    const dists = await prisma.distribution.findMany({
      where: { officerId },
      include: { batch: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // Fetch evidence for each to get cid/hash
    const enriched = await Promise.all(dists.map(async d => {
      const evidence = await prisma.evidence.findFirst({
        where: { entityType: 'Distribution', entityId: d.id }
      });
      return {
        ...d,
        cid: evidence?.ipfsCid || '',
        hash: evidence?.contentHashSha256 || ''
      };
    }));

    return enriched;
  }
}
