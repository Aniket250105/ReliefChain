import prisma from '../../config/db';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { EventHandler } from '../types';

export class RetryService {
  /**
   * Retries FAILED events up to a maximum number of attempts.
   */
  static async retryFailedEvents(
    chainId: number, 
    registry: Record<string, EventHandler>,
    maxRetries: number = 5
  ): Promise<void> {
    const failedEvents = await prisma.blockchainEvent.findMany({
      where: {
        chainId,
        status: 'FAILED',
        retryCount: {
          lt: maxRetries
        },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } }
        ]
      },
      orderBy: { blockNumber: 'asc' }
    });

    for (const dbEvent of failedEvents) {
      const handler = registry[dbEvent.eventName];
      if (!handler) {
        console.warn(`[RetryService] No handler found for ${dbEvent.eventName}`);
        continue;
      }

      console.log(`[RetryService] Retrying event ${dbEvent.transactionHash}:${dbEvent.logIndex}`);
      
      const payload: any = dbEvent.payload;

      try {
        await ReconciliationService.processEvent({
          chainId: dbEvent.chainId,
          contractAddress: dbEvent.contractAddress,
          transactionHash: dbEvent.transactionHash,
          blockNumber: dbEvent.blockNumber,
          blockHash: dbEvent.blockHash,
          logIndex: dbEvent.logIndex,
          eventName: dbEvent.eventName,
          payload: payload,
          rawEvent: dbEvent.rawEvent
        }, handler);

        // If it still fails, the processEvent will have set it to FAILED, but we need to increment retryCount
        // Check current status
        const current = await prisma.blockchainEvent.findUnique({ where: { id: dbEvent.id }});
        if (current && current.status === 'FAILED') {
           await prisma.blockchainEvent.update({
             where: { id: dbEvent.id },
             data: {
               retryCount: { increment: 1 },
               nextRetryAt: new Date(Date.now() + Math.pow(2, current.retryCount + 1) * 1000) // Exponential backoff
             }
           });
        }
      } catch (e) {
        console.error(`[RetryService] Fatal error retrying event`, e);
      }
    }
  }
}
