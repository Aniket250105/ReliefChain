import prisma from '../../config/db';
import { Prisma } from '@prisma/client';
import { EventHandlerContext, UnrecoverableError } from '../types';
import { bytes32ToUuid } from '../../utils/web3-format';
import { ethers } from 'ethers';

export const handleDonationReceived = async ({ event, logger }: EventHandlerContext) => {
  const { campaignId, donor, amount } = event.payload;
  const uuid = bytes32ToUuid(campaignId);

  // 1. Verify campaign exists
  const campaign = await prisma.campaign.findUnique({ where: { id: uuid } });
  if (!campaign) {
    throw new UnrecoverableError(`Campaign ${uuid} not found. Cannot reconcile DonationReceived.`);
  }

  // 2. Atomically record donation and isolate currency inside transaction
  await prisma.$transaction(async (tx) => {
    // Event-level deduplication: network identity + txHash + logIndex
    const existing = await tx.donation.findUnique({
      where: { 
        blockchainChainId_blockchainTxHash_blockchainLogIndex: {
          blockchainChainId: event.chainId,
          blockchainTxHash: event.transactionHash,
          blockchainLogIndex: event.logIndex
        }
      }
    });

    if (existing) {
      logger(`Donation from tx ${event.transactionHash} log ${event.logIndex} already exists. Skipping.`);
      return;
    }

    // Row-level lock on Campaign
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${uuid} FOR UPDATE`;

    // Exact Decimal representation
    const formattedUnits = ethers.formatUnits(amount.toString(), 18);
    const decimalAmount = new Prisma.Decimal(formattedUnits);
    const ethCurrency = `ETH:${event.chainId}`;

    await tx.donation.create({
      data: {
        campaignId: uuid,
        amount: decimalAmount,
        currency: ethCurrency,
        blockchainTxHash: event.transactionHash,
        blockchainChainId: event.chainId,
        blockchainLogIndex: event.logIndex,
        status: 'CONFIRMED'
      }
    });

    logger(`Processed on-chain DonationReceived for campaign ${uuid}: ${formattedUnits} ${ethCurrency}`);
  });
};
