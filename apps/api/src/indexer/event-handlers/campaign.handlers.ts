import prisma from '../../config/db';
import { EventHandlerContext, UnrecoverableError } from '../types';
import { bytes32ToUuid } from '../../utils/web3-format';

export const handleCampaignCreated = async ({ event, logger }: EventHandlerContext) => {
  const { campaignId } = event.payload;
  const uuid = bytes32ToUuid(campaignId);

  const campaign = await prisma.campaign.findUnique({ where: { id: uuid } });
  
  if (campaign) {
    if (campaign.blockchainTxHash !== event.transactionHash) {
      await prisma.campaign.update({
        where: { id: uuid },
        data: { blockchainTxHash: event.transactionHash }
      });
      logger(`Updated Campaign ${uuid} with txHash`);
    } else {
      logger(`Campaign ${uuid} already has txHash`);
    }
  } else {
    throw new UnrecoverableError(`Campaign ${uuid} not found. Cannot reconcile CampaignCreated.`);
  }
};

export const handleCampaignVerified = async ({ event, logger }: EventHandlerContext) => {
  const { campaignId } = event.payload;
  const uuid = bytes32ToUuid(campaignId);

  const campaign = await prisma.campaign.findUnique({ where: { id: uuid } });
  
  if (!campaign) {
    throw new UnrecoverableError(`Campaign ${uuid} not found. Cannot reconcile CampaignVerified.`);
  }

  if (campaign.status === 'Pending Approval') {
    await prisma.campaign.update({
      where: { id: uuid },
      data: { status: 'Active' }
    });
    logger(`Updated Campaign ${uuid} to Active`);
  } else {
    logger(`Campaign ${uuid} is already ${campaign.status}. No update needed.`);
  }
};
