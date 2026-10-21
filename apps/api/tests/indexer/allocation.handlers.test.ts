import { handleAllocationProposed, handleAllocationApproved, handleAllocationExecuted } from '../../src/indexer/event-handlers/allocation.handlers';
import prisma from '../../src/config/db';
import { EventHandlerContext, UnrecoverableError } from '../../src/indexer/types';
import { uuidToBytes32 } from '../../src/utils/web3-format';
import { ethers } from 'ethers';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: {
    allocation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    multisigApproval: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    }
  }
}));

describe('Allocation Event Handlers', () => {
  let mockLogger: jest.Mock;
  const validCampaignId = '12345678-1234-1234-1234-123456789012';
  const validAllocationId = '87654321-4321-4321-4321-210987654321';
  const bytes32AllocationId = uuidToBytes32(validAllocationId);
  const bytes32CampaignId = uuidToBytes32(validCampaignId);
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = jest.fn();
  });

  describe('handleAllocationProposed', () => {
    const validAmount = 500;
    const validAmountWei = ethers.parseUnits(validAmount.toString(), 18);
    const validPayee = '0x1234567890123456789012345678901234567890';

    const getBaseEvent = (payload: any = {}) => ({
      payload: {
        allocationId: bytes32AllocationId,
        campaignId: bytes32CampaignId,
        amount: validAmountWei,
        payee: validPayee,
        ...payload
      },
      transactionHash: '0xabc123',
      chainId: 31337,
      logIndex: 0
    });

    it('should transition DRAFT to PENDING_MULTISIG and store txHash', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        amount: new Decimal(validAmount),
        status: 'DRAFT',
      });

      await handleAllocationProposed({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.allocation.update).toHaveBeenCalledWith({
        where: { id: validAllocationId },
        data: { status: 'PENDING_MULTISIG', proposalTxHash: '0xabc123' }
      });
    });

    it('should reject if allocation not found', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(handleAllocationProposed({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext))
        .rejects.toThrow(UnrecoverableError);
    });

    it('should reject mismatched campaign ID', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: '99999999-9999-9999-9999-999999999999', // Mismatched DB state
        amount: new Decimal(validAmount),
        status: 'DRAFT',
      });

      await expect(handleAllocationProposed({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext))
        .rejects.toThrow(/campaign mismatch/);
    });

    it('should reject mismatched amount', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        amount: new Decimal(400), // DB has 400, event has 500
        status: 'DRAFT',
      });

      await expect(handleAllocationProposed({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext))
        .rejects.toThrow(/amount mismatch/);
    });

    it('should be idempotent for duplicate event', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        amount: new Decimal(validAmount),
        status: 'PENDING_MULTISIG',
        proposalTxHash: '0xabc123'
      });

      await handleAllocationProposed({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.allocation.update).not.toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('already PENDING_MULTISIG'));
    });
  });

  describe('handleAllocationApproved', () => {
    const getBaseEvent = (payload: any = {}) => ({
      payload: {
        allocationId: bytes32AllocationId,
        signer: '0xSigner1',
        ...payload
      },
      transactionHash: '0xdef456',
      chainId: 31337,
      logIndex: 0
    });

    it('should reject if allocation not found', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(handleAllocationApproved({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext))
        .rejects.toThrow(UnrecoverableError);
    });

    it('should create approval but not transition to APPROVED on first signer', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        status: 'PENDING_MULTISIG',
      });

      (prisma.multisigApproval.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.multisigApproval.count as jest.Mock).mockResolvedValueOnce(1); // Only 1 approval

      await handleAllocationApproved({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.multisigApproval.create).toHaveBeenCalledWith({
        data: {
          allocationId: validAllocationId,
          signerWallet: '0xSigner1',
          status: 'Signed',
          approvalTxHash: '0xdef456'
        }
      });
      expect(prisma.allocation.update).not.toHaveBeenCalled(); // No state change
    });

    it('should transition to APPROVED on second distinct valid approval', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        status: 'PENDING_MULTISIG',
      });

      (prisma.multisigApproval.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.multisigApproval.count as jest.Mock).mockResolvedValueOnce(2); // Met threshold

      await handleAllocationApproved({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.allocation.update).toHaveBeenCalledWith({
        where: { id: validAllocationId },
        data: { status: 'APPROVED' }
      });
    });

    it('should not duplicate approval or alter state for duplicate event', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        status: 'PENDING_MULTISIG',
      });

      // Existing approval found
      (prisma.multisigApproval.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing_approval' });
      (prisma.multisigApproval.count as jest.Mock).mockResolvedValueOnce(1);

      await handleAllocationApproved({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.multisigApproval.create).not.toHaveBeenCalled();
      expect(prisma.allocation.update).not.toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });
  });

  describe('handleAllocationExecuted', () => {
    const validAmount = 500;
    const validAmountWei = ethers.parseUnits(validAmount.toString(), 18);
    const validPayee = '0x1234567890123456789012345678901234567890';

    const getBaseEvent = (payload: any = {}) => ({
      payload: {
        allocationId: bytes32AllocationId,
        campaignId: bytes32CampaignId,
        amount: validAmountWei,
        payee: validPayee,
        ...payload
      },
      transactionHash: '0xghi789',
      chainId: 31337,
      logIndex: 0
    });

    it('should transition EXECUTING to CONFIRMED and store txHash', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        amount: new Decimal(validAmount),
        status: 'EXECUTING',
      });

      await handleAllocationExecuted({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.allocation.update).toHaveBeenCalledWith({
        where: { id: validAllocationId },
        data: { status: 'CONFIRMED', executionTxHash: '0xghi789' }
      });
    });

    it('should reject mismatched amount', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        amount: new Decimal(100),
        status: 'EXECUTING',
      });

      await expect(handleAllocationExecuted({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext))
        .rejects.toThrow(/amount mismatch/);
    });

    it('should be idempotent and not alter state if already CONFIRMED', async () => {
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        amount: new Decimal(validAmount),
        status: 'CONFIRMED',
      });

      await handleAllocationExecuted({ event: getBaseEvent(), logger: mockLogger } as unknown as EventHandlerContext);

      expect(prisma.allocation.update).not.toHaveBeenCalled();
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('already CONFIRMED'));
    });
  });
});
