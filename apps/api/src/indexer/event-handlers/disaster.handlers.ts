import prisma from '../../config/db';
import { EventHandlerContext, UnrecoverableError } from '../types';
import { bytes32ToUuid } from '../../utils/web3-format';
import { DisasterStatus } from '@reliefchain/shared-types';

export const handleDisasterCreated = async ({ event, logger }: EventHandlerContext) => {
  const { disasterId } = event.payload;
  const uuid = bytes32ToUuid(disasterId);

  const disaster = await prisma.disaster.findUnique({ where: { id: uuid } });
  
  if (disaster) {
    if (disaster.blockchainTxHash !== event.transactionHash) {
      await prisma.disaster.update({
        where: { id: uuid },
        data: { blockchainTxHash: event.transactionHash }
      });
      logger(`Updated Disaster ${uuid} with txHash`);
    } else {
      logger(`Disaster ${uuid} already has txHash`);
    }
  } else {
    logger(`Disaster ${uuid} not found in DB. Event ignored.`);
    throw new UnrecoverableError(`Disaster ${uuid} not found. Cannot reconcile DisasterCreated.`);
  }
};

export const handleDisasterVerified = async ({ event, logger }: EventHandlerContext) => {
  const { disasterId } = event.payload;
  const uuid = bytes32ToUuid(disasterId);

  const disaster = await prisma.disaster.findUnique({ where: { id: uuid } });
  
  if (!disaster) {
    throw new UnrecoverableError(`Disaster ${uuid} not found. Cannot reconcile DisasterVerified.`);
  }

  if (disaster.status !== DisasterStatus.VERIFIED && disaster.status !== DisasterStatus.ACTIVE && disaster.status !== DisasterStatus.RESOLVED && disaster.status !== DisasterStatus.ARCHIVED) {
    await prisma.disaster.update({
      where: { id: uuid },
      data: { status: DisasterStatus.VERIFIED }
    });
    logger(`Updated Disaster ${uuid} to VERIFIED`);
  } else {
    logger(`Disaster ${uuid} is already ${disaster.status}. No update needed.`);
  }
};
