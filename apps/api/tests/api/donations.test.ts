import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/db';
import { web3Service } from '../../src/services/web3.service';
import { DonationVerificationStatus } from '@reliefchain/shared-types';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: {
    donation: {
      findUnique: jest.fn(),
    }
  }
}));

// We mock ethers locally in the test to control the parseLog behavior
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    ethers: {
      ...original.ethers,
      Interface: jest.fn().mockImplementation(() => ({
        parseLog: jest.fn().mockImplementation((log: any) => {
          if (log.data === 'VALID_DONATION') {
            return { name: 'DonationReceived', args: [] };
          }
          if (log.data === 'OTHER_EVENT') {
            return { name: 'SomeOtherEvent', args: [] };
          }
          throw new Error('no matching event');
        })
      }))
    }
  };
});

describe('Donations API Endpoints - Hardening & Adversarial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Verification (GET /api/donations/verify/:txHash)', () => {
    it('should reject malformed txHash', async () => {
      const res = await request(app).get('/api/donations/verify/0xinvalid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('should return UNKNOWN for transaction not found', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce(null);
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.UNKNOWN);
    });

    it('should return FAILED for transaction on wrong network', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ chainId: 1n } as any);
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.FAILED);
    });

    it('should return FAILED for transaction to wrong destination contract', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: '0xWrongContract0000000000000000000000000000'
      } as any);
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.FAILED);
    });

    it('should return PENDING_CONFIRMATION if transaction exists in mempool but no receipt yet', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce(null);
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.PENDING_CONFIRMATION);
    });

    it('should return FAILED for reverted transaction', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce({ status: 0 } as any); // Reverted
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.FAILED);
    });

    it('should return PENDING_CONFIRMATION if transaction is mined but insufficient confirmations', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce({ status: 1, blockNumber: 100 } as any);
      jest.spyOn(web3Service.getProvider(), 'getBlockNumber').mockResolvedValueOnce(100); // 0 confirmations
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.PENDING_CONFIRMATION);
    });

    it('should return FAILED if receipt succeeded but expected DonationReceived event is missing', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getBlockNumber').mockResolvedValueOnce(110);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce({ 
        status: 1, 
        blockNumber: 100,
        logs: [
          { address: web3Service.donationContractAddress, index: 0, data: 'OTHER_EVENT' }
        ]
      } as any);
      
      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.FAILED);
    });

    it('should return PENDING_CONFIRMATION if valid event exists but indexer has not reconciled yet', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getBlockNumber').mockResolvedValueOnce(110);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce({ 
        status: 1, 
        blockNumber: 100,
        logs: [
          { address: web3Service.donationContractAddress, index: 1, data: 'VALID_DONATION' }
        ]
      } as any);
      (prisma.donation.findUnique as jest.Mock).mockResolvedValueOnce(null); // Not reconciled

      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.PENDING_CONFIRMATION);
      expect(prisma.donation.findUnique).toHaveBeenCalledWith({
        where: {
          blockchainChainId_blockchainTxHash_blockchainLogIndex: {
            blockchainChainId: web3Service.expectedChainId,
            blockchainTxHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
            blockchainLogIndex: 1
          }
        }
      });
    });

    it('should return CONFIRMED if transaction is mined, sufficiently confirmed, valid event found, and exactly reconciled', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getBlockNumber').mockResolvedValueOnce(110);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce({ 
        status: 1, 
        blockNumber: 100,
        logs: [
          { address: web3Service.donationContractAddress, index: 2, data: 'VALID_DONATION' }
        ]
      } as any);
      (prisma.donation.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'don1' }); // Reconciled!

      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.CONFIRMED);
    });

    it('should correctly handle multiple events (e.g. multicall) and return CONFIRMED only when all are reconciled', async () => {
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({ 
        chainId: BigInt(web3Service.expectedChainId),
        to: web3Service.donationContractAddress
      } as any);
      jest.spyOn(web3Service.getProvider(), 'getBlockNumber').mockResolvedValueOnce(110);
      jest.spyOn(web3Service.getProvider(), 'getTransactionReceipt').mockResolvedValueOnce({ 
        status: 1, 
        blockNumber: 100,
        logs: [
          { address: web3Service.donationContractAddress, index: 3, data: 'VALID_DONATION' },
          { address: web3Service.donationContractAddress, index: 4, data: 'VALID_DONATION' }
        ]
      } as any);
      // First is reconciled, second is NOT
      (prisma.donation.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'don1' }).mockResolvedValueOnce(null);

      const res = await request(app).get('/api/donations/verify/0x0000000000000000000000000000000000000000000000000000000000000001');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(DonationVerificationStatus.PENDING_CONFIRMATION);
    });
  });
});
