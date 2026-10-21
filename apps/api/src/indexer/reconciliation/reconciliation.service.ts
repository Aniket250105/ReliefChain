import prisma from '../../config/db';
import { EventHandler, BlockchainEventPayload } from '../types';

export class ReconciliationService {
  /**
   * Safely executes an event handler.
   * Ensures idempotency and records failures in the BlockchainEvent table.
   */
  static async processEvent(event: BlockchainEventPayload, handler: EventHandler): Promise<boolean> {
    const logger = (msg: string, meta?: any) => {
      console.log(`[Reconciliation] ${msg}`, meta ? meta : '');
    };

    // Upsert the event as PENDING
    const dbEvent = await prisma.blockchainEvent.upsert({
      where: {
        chainId_transactionHash_logIndex: {
          chainId: event.chainId,
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
        }
      },
      create: {
        chainId: event.chainId,
        eventName: event.eventName,
        contractAddress: event.contractAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
        payload: event.payload,
        rawEvent: event.rawEvent,
        status: 'PENDING',
      },
      update: {}
    });

    if (dbEvent.status === 'PROCESSED') {
      logger(`Event already PROCESSED, skipping`, { tx: event.transactionHash, logIndex: event.logIndex });
      return true;
    }

    if (dbEvent.status === 'FAILED') {
      logger(`Event is currently FAILED, waiting for RetryService`, { tx: event.transactionHash, logIndex: event.logIndex });
      return false;
    }

    try {
      // Execute Domain Handler
      await handler({ event, logger });

      // Mark as PROCESSED
      await prisma.blockchainEvent.update({
        where: { id: dbEvent.id },
        data: {
          status: 'PROCESSED',
          errorDetails: null,
          updatedAt: new Date()
        }
      });
      logger(`Event processed successfully`);
      return true;

    } catch (error: any) {
      logger(`Event processing failed`, { error: error.message });
      
      const isUnrecoverable = error.name === 'UnrecoverableError';
      
      // Mark as FAILED for retry mechanism
      await prisma.blockchainEvent.update({
        where: { id: dbEvent.id },
        data: {
          status: 'FAILED',
          errorDetails: error.message || String(error),
          // If unrecoverable, set retryCount high so it's not retried
          retryCount: isUnrecoverable ? 999 : undefined,
          nextRetryAt: isUnrecoverable ? null : undefined,
          updatedAt: new Date()
        }
      });
      return false;
    }
  }
}
