import { ethers } from 'ethers';
import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { web3Service } from '../../services/web3.service';
import { createAuditLog } from '../../services/audit.service';
import { DonationVerificationStatus, DonationVerificationResponse } from '@reliefchain/shared-types';

const DONATION_CONTRACT_ABI = [
  "event DonationReceived(bytes32 indexed campaignId, address indexed donor, uint256 amount)"
];

export const verifyTransactionStatus = async (txHash: string): Promise<DonationVerificationResponse> => {
  if (!web3Service.isValidTransactionHash(txHash)) {
    throw new Error('Invalid transaction hash format');
  }

  const provider = web3Service.getProvider();

  try {
    // 1. Check if transaction exists
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { txHash, status: DonationVerificationStatus.UNKNOWN };
    }

    // 2. Verify configured chain/network
    if (Number(tx.chainId) !== web3Service.expectedChainId) {
      return { txHash, status: DonationVerificationStatus.FAILED }; // Wrong network
    }

    // 3. Verify destination contract address
    if (tx.to && tx.to.toLowerCase() !== web3Service.donationContractAddress.toLowerCase()) {
      return { txHash, status: DonationVerificationStatus.FAILED }; // Wrong destination
    }

    // 4. Check receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      // Transaction exists in mempool but is not yet mined/confirmed
      return { txHash, status: DonationVerificationStatus.PENDING_CONFIRMATION };
    }

    // 5. Check receipt success/revert status
    if (receipt.status === 0) {
      return { txHash, status: DonationVerificationStatus.FAILED };
    }

    // 6. Check confirmation depth against configured authoritative source
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock - receipt.blockNumber < web3Service.confirmationBlocks) {
      return { txHash, status: DonationVerificationStatus.PENDING_CONFIRMATION };
    }

    // 7. Explicitly identify DonationReceived events emitted by the configured contract
    const contractInterface = new ethers.Interface(DONATION_CONTRACT_ABI);
    const donationLogs = receipt.logs.map(log => {
      // Log must originate from the exact configured DonationContract
      if (log.address.toLowerCase() !== web3Service.donationContractAddress.toLowerCase()) {
        return null;
      }
      try {
        const parsed = contractInterface.parseLog(log as any);
        if (parsed && parsed.name === 'DonationReceived') {
          return { logIndex: log.index, parsed };
        }
      } catch {
        // parseLog throws if the log doesn't match the ABI signature
      }
      return null;
    }).filter(l => l !== null);

    // If receipt succeeded but no valid DonationReceived event was emitted, it's not a valid donation
    if (donationLogs.length === 0) {
      return { txHash, status: DonationVerificationStatus.FAILED };
    }

    // 8. Event-Level Database Correlation
    // To prevent collapsing distinct events and to ensure unambiguous reconciliation,
    // we require that EVERY valid DonationReceived event in this transaction has been 
    // reconciled by the M6 indexer.
    for (const dLog of donationLogs) {
      const donation = await prisma.donation.findUnique({
        where: {
          blockchainChainId_blockchainTxHash_blockchainLogIndex: {
            blockchainChainId: web3Service.expectedChainId,
            blockchainTxHash: txHash,
            blockchainLogIndex: dLog!.logIndex
          }
        }
      });

      if (!donation) {
        // Event verified on-chain and confirmed, but M6 indexer has not yet safely authored the operational state
        return { txHash, status: DonationVerificationStatus.PENDING_CONFIRMATION };
      }
    }

    // Fully verified: Mined, confirmed, valid events extracted, and all identically reconciled via M6
    return { txHash, status: DonationVerificationStatus.CONFIRMED };

  } catch (error) {
    console.error(`Error verifying tx ${txHash}:`, error);
    return { txHash, status: DonationVerificationStatus.UNKNOWN };
  }
};

export const processRazorpayDonation = async (
  campaignId: string,
  donorId: string | undefined,
  amount: number,
  paymentId: string
) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  // Bounded retry handling for database concurrency and serialization conflicts
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Check idempotency INSIDE the transaction using compound key values
        const existingDonation = await tx.donation.findFirst({
          where: {
            blockchainChainId: 0,
            blockchainTxHash: paymentId,
            blockchainLogIndex: 0
          }
        });

        if (existingDonation) {
          return existingDonation;
        }

        // 2. Row-level lock on the Campaign row to serialize concurrent donation total updates
        await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE`;

        // 3. Create donation with compound unique sentinel values for Web2 payments and exact Decimal amount
        const decimalAmount = new Prisma.Decimal(amount.toString());
        const donation = await tx.donation.create({
          data: {
            campaignId,
            donorId,
            amount: decimalAmount,
            currency: 'INR',
            blockchainChainId: 0,
            blockchainTxHash: paymentId,
            blockchainLogIndex: 0,
            status: DonationVerificationStatus.CONFIRMED
          }
        });

        // 4. Dynamically calculate the accurate confirmed total for INR donations
        const aggregate = await tx.donation.aggregate({
          where: {
            campaignId,
            status: { in: ['CONFIRMED', 'Confirmed'] },
            currency: 'INR'
          },
          _sum: { amount: true }
        });

        const newRaised = aggregate._sum.amount ? aggregate._sum.amount.toNumber() : Number(amount);

        await tx.campaign.update({
          where: { id: campaignId },
          data: { raisedAmount: newRaised }
        });

        // 5. Audit log the confirmed donation
        await createAuditLog({
          actorId: donorId || 'ANONYMOUS',
          action: 'DONATION_CONFIRMED',
          entityType: 'Donation',
          entityId: donation.id,
          status: 'Success',
          metadata: {
            campaignId,
            amount: Number(amount),
            currency: 'INR',
            paymentId
          }
        });

        return donation;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      });
    } catch (error: any) {
      lastError = error;
      // If error is unique constraint violation (P2002), payment was already processed concurrently
      if (error.code === 'P2002') {
        const deduplicated = await prisma.donation.findFirst({
          where: {
            blockchainChainId: 0,
            blockchainTxHash: paymentId,
            blockchainLogIndex: 0
          }
        });
        if (deduplicated) return deduplicated;
      }

      // If retryable serialization error, back off and retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 50));
      }
    }
  }

  throw lastError;
};
