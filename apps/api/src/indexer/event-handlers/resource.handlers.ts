import prisma from '../../config/db';
import { EventHandlerContext, UnrecoverableError } from '../types';
import { bytes32ToUuid } from '../../utils/web3-format';

export const handleResourceRegistered = async ({ event, logger }: EventHandlerContext) => {
  const { batchId } = event.payload;
  const uuid = bytes32ToUuid(batchId);

  const resourceBatch = await prisma.resourceBatch.findUnique({ where: { id: uuid } });
  
  if (resourceBatch) {
    if (resourceBatch.status === 'DRAFT' || resourceBatch.blockchainTxHash !== event.transactionHash) {
      await prisma.resourceBatch.update({
        where: { id: uuid },
        data: { 
          blockchainTxHash: event.transactionHash,
          status: 'REGISTERED'
        }
      });
      logger(`Updated ResourceBatch ${uuid} to REGISTERED with txHash`);
    } else {
      logger(`ResourceBatch ${uuid} already REGISTERED and has txHash`);
    }
  } else {
    logger(`ResourceBatch ${uuid} not found. Skipping reconciliation.`);
  }
};

export const handleDistributionRecorded = async ({ event, logger }: EventHandlerContext) => {
  const { batchId, quantity, beneficiaries, officer, ipfsCid } = event.payload;
  const uuid = bytes32ToUuid(batchId);

  const resourceBatch = await prisma.resourceBatch.findUnique({ where: { id: uuid } });
  
  if (!resourceBatch) {
    throw new UnrecoverableError(`ResourceBatch ${uuid} not found. Cannot reconcile DistributionRecorded.`);
  }

  // Find an executing distribution for this batch
  const executingDistributions = await prisma.distribution.findMany({
    where: { 
      batchId: uuid, 
      status: 'EXECUTING'
    }
  });

  if (executingDistributions.length === 0) {
    // Maybe already confirmed?
    const confirmed = await prisma.distribution.findMany({
      where: { batchId: uuid, status: 'CONFIRMED', blockchainTxHash: event.transactionHash }
    });
    if (confirmed.length > 0) {
      logger(`Distribution for batch ${uuid} is already CONFIRMED.`);
      return;
    }
    throw new UnrecoverableError(`No EXECUTING Distribution found for batch ${uuid} with tx ${event.transactionHash}. Cannot reconcile DistributionRecorded.`);
  }

  // We must find the correct executing distribution that matches the evidence CID
  const eventBlockchainCid = ipfsCid; // event.payload.ipfsCid is the exact bytes32 emitted by the blockchain
  let dist: any = null;
  let distEvidence: any = null;
  
  for (const d of executingDistributions) {
    const evidence = await prisma.evidence.findFirst({
      where: { entityType: 'Distribution', entityId: d.id }
    });
    console.log(`Checking evidence for dist ${d.id}: DB_CID=${evidence?.blockchainCidBytes32}, Event_CID=${eventBlockchainCid}`);
    if (evidence && evidence.blockchainCidBytes32 === eventBlockchainCid) {
      dist = d;
      distEvidence = evidence;
      break;
    }
  }

  if (!dist) {
    throw new UnrecoverableError(`No EXECUTING Distribution found for batch ${uuid} with exact matching canonical evidence CID ${eventBlockchainCid}.`);
  }
  
  // Validation: Check if the on-chain payload matches our off-chain expectation
  if (dist.beneficiaryCount.toString() !== beneficiaries.toString()) {
    throw new UnrecoverableError(`Beneficiary count mismatch for Distribution ${dist.id}`);
  }

  // Check evidence association (already done in loop above, but keeping structure)
  if (!distEvidence || distEvidence.blockchainCidBytes32 !== eventBlockchainCid) {
    throw new UnrecoverableError(`Evidence reference mismatch for Distribution ${dist.id}. Expected ${distEvidence?.blockchainCidBytes32} to exactly match ${eventBlockchainCid}`);
  }

  // Officer reconciliation
  // Because User schema doesn't store a hard blockchain address yet, we accept the officer address 
  // passed from the frontend via the blockchain event.
  if (officer === '0x0000000000000000000000000000000000000000') {
     throw new UnrecoverableError(`Officer address cannot be zero address for Distribution ${dist.id}.`);
  }

  // Store exact event identity on the record
  await prisma.distribution.update({
    where: { id: dist.id },
    data: {
      status: 'CONFIRMED',
      logIndex: event.logIndex,
      blockchainTxHash: event.transactionHash // Ensure txHash is saved if frontend didn't PATCH it in time
    }
  });

  logger(`Updated Distribution ${dist.id} for batch ${uuid} to CONFIRMED. Event logIndex: ${event.logIndex}`);
  
  // Trigger AI Anomaly Detection with exact canonical blockchain correlation
  const triggerEventId = `${event.chainId}:${event.transactionHash}:${event.logIndex}`;
  try {
    const { triggerAIDistributionCheck } = require('../../modules/ai/ai.service');
    triggerAIDistributionCheck(dist.id, triggerEventId);
  } catch (e: any) {
    logger(`AI Trigger failed statically: ${e.message}`);
  }
};
