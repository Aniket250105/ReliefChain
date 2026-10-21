import { CursorService } from '../../src/indexer/cursor/cursor.service';
import { ReconciliationService } from '../../src/indexer/reconciliation/reconciliation.service';
import { handleDisasterVerified } from '../../src/indexer/event-handlers/disaster.handlers';
import prisma from '../../src/config/db';
import { bytes32ToUuid } from '../../src/utils/web3-format';
import { DisasterStatus } from '@reliefchain/shared-types';

jest.mock('../../src/config/db', () => ({
  indexerState: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  blockchainEvent: {
    upsert: jest.fn(),
    update: jest.fn(),
  },
  disaster: {
    findUnique: jest.fn(),
    update: jest.fn(),
  }
}));

describe('Event Indexer Core', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CursorService', () => {
    it('should return default start block if no cursor found', async () => {
      (prisma.indexerState.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const { block } = await CursorService.getCursor(31337, 10);
      expect(block).toBe(10);
    });

    it('should return last processed block', async () => {
      (prisma.indexerState.findUnique as jest.Mock).mockResolvedValueOnce({ lastProcessedBlock: 42 });
      const { block } = await CursorService.getCursor(31337, 10);
      expect(block).toBe(42);
    });

    it('should advance cursor', async () => {
      await CursorService.advanceCursor(31337, 43, '0xhash');
      expect(prisma.indexerState.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ lastProcessedBlock: 43 })
      }));
    });
  });

  describe('ReconciliationService (Idempotency and Failure handling)', () => {
    const mockEvent = {
      chainId: 31337,
      contractAddress: '0x123',
      transactionHash: '0xabc',
      blockNumber: 42,
      blockHash: '0xdef',
      logIndex: 1,
      eventName: 'TestEvent',
      payload: {},
    };

    it('should skip processing if event is already PROCESSED', async () => {
      (prisma.blockchainEvent.upsert as jest.Mock).mockResolvedValueOnce({ status: 'PROCESSED' });
      const handler = jest.fn();
      await ReconciliationService.processEvent(mockEvent, handler);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should execute handler and mark as PROCESSED on success', async () => {
      (prisma.blockchainEvent.upsert as jest.Mock).mockResolvedValueOnce({ id: '1', status: 'PENDING' });
      const handler = jest.fn().mockResolvedValueOnce(undefined);
      
      await ReconciliationService.processEvent(mockEvent, handler);
      
      expect(handler).toHaveBeenCalled();
      expect(prisma.blockchainEvent.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ status: 'PROCESSED', errorDetails: null })
      });
    });

    it('should mark as FAILED on handler error', async () => {
      (prisma.blockchainEvent.upsert as jest.Mock).mockResolvedValueOnce({ id: '1', status: 'PENDING' });
      const handler = jest.fn().mockRejectedValueOnce(new Error('Test failure'));
      
      await ReconciliationService.processEvent(mockEvent, handler);
      
      expect(handler).toHaveBeenCalled();
      expect(prisma.blockchainEvent.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ status: 'FAILED', errorDetails: 'Test failure' })
      });
    });
  });

  describe('Idempotency in Handlers', () => {
    const mockLogger = jest.fn();
    const event = {
      chainId: 31337,
      contractAddress: '0x123',
      transactionHash: '0xabc',
      blockNumber: 42,
      blockHash: '0xdef',
      logIndex: 1,
      eventName: 'DisasterVerified',
      payload: { disasterId: '0x00000000000000000000000000000000123e4567e89b12d3a456426614174000' }
    };
    
    it('should not update disaster if it is already verified', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValueOnce({ 
        id: bytes32ToUuid(event.payload.disasterId),
        status: DisasterStatus.VERIFIED
      });

      await handleDisasterVerified({ event, logger: mockLogger });
      
      expect(prisma.disaster.update).not.toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('already VERIFIED'));
    });
  });
});
