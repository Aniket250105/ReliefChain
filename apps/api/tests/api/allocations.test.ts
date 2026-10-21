import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/db';
import { Web2Role } from '@reliefchain/shared-types';
import jwt from 'jsonwebtoken';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: jest.fn(),
    },
    campaign: {
      findUnique: jest.fn(),
    },
    allocation: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  }
}));

const mockToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
};

describe('Allocations API', () => {
  const validCampaignId = '12345678-1234-1234-1234-123456789012';
  const validAllocationId = '87654321-4321-4321-4321-210987654321';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('POST /api/allocations', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app).post('/api/allocations').send({ campaignId: validCampaignId, amount: 100 });
      expect(res.status).toBe(401);
    });

    it('should reject creation from non-NGO users', async () => {
      const token = mockToken({ id: 'u1', role: Web2Role.GOVERNMENT_AUTHORITY, organizationId: 'o1' });
      const res = await request(app)
        .post('/api/allocations')
        .set('Authorization', `Bearer ${token}`)
        .send({ campaignId: validCampaignId, amount: 100 });
      expect(res.status).toBe(403);
    });

    it('should correctly process valid allocation creation through a transaction', async () => {
      const token = mockToken({ id: 'u1', role: Web2Role.NGO_ADMIN, organizationId: 'o1' });
      
      // Mock the service transaction behavior
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'o1', type: 'NGO', isVerified: true });
      
      (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: validCampaignId, ngoId: 'o1', status: 'ACTIVE', raisedAmount: 500 }]),
          allocation: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100 } }),
            create: jest.fn().mockResolvedValue({ id: validAllocationId, campaignId: validCampaignId, requesterId: 'o1', amount: 50, status: 'DRAFT' })
          },
          auditLog: {
            create: jest.fn()
          }
        };
        return await callback(tx);
      });

      const res = await request(app)
        .post('/api/allocations')
        .set('Authorization', `Bearer ${token}`)
        .send({ campaignId: validCampaignId, amount: 50 });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(validAllocationId);
      expect(res.body.status).toBe('DRAFT');
    });

    it('should reject allocation if it exceeds available balance', async () => {
      const token = mockToken({ id: 'u1', role: Web2Role.NGO_ADMIN, organizationId: 'o1' });
      
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'o1', type: 'NGO', isVerified: true });
      
      (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: validCampaignId, ngoId: 'o1', status: 'ACTIVE', raisedAmount: 500 }]),
          allocation: {
            // Previously reserved 400, so only 100 available
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 400 } }), 
          }
        };
        return await callback(tx);
      });

      const res = await request(app)
        .post('/api/allocations')
        .set('Authorization', `Bearer ${token}`)
        .send({ campaignId: validCampaignId, amount: 150 }); // Requests 150, but only 100 available

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Requested amount exceeds available balance');
    });

    it('should reject if NGO does not own campaign', async () => {
      const token = mockToken({ id: 'u1', role: Web2Role.NGO_ADMIN, organizationId: 'o1' });
      
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'o1', type: 'NGO', isVerified: true });
      
      (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: validCampaignId, ngoId: 'o2', status: 'ACTIVE', raisedAmount: 500 }]) // Belongs to o2
        };
        return await callback(tx);
      });

      const res = await request(app)
        .post('/api/allocations')
        .set('Authorization', `Bearer ${token}`)
        .send({ campaignId: validCampaignId, amount: 50 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Not authorized to allocate funds from this campaign');
    });
  });

  describe('POST /api/allocations/:id/execute', () => {
    it('should verify pending transaction before marking EXECUTING', async () => {
      const token = mockToken({ id: 'u1', role: Web2Role.NGO_ADMIN, organizationId: 'o1' });
      
      (prisma.allocation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        campaignId: validCampaignId,
        status: 'APPROVED'
      });
      
      (prisma.allocation.update as jest.Mock).mockResolvedValueOnce({
        id: validAllocationId,
        status: 'EXECUTING',
        executionTxHash: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      // Mock web3Service verification
      const { web3Service } = require('../../src/services/web3.service');
      const { uuidToBytes32 } = require('../../src/utils/web3-format');
      const expectedAllocationIdBytes32 = uuidToBytes32(validAllocationId);
      jest.spyOn(web3Service.getProvider(), 'getTransaction').mockResolvedValueOnce({
        chainId: BigInt(web3Service.expectedChainId),
        to: '0xMultisigAddress',
        data: '0xabcdef' + expectedAllocationIdBytes32.replace('0x', '') + 'moredata'
      } as any);

      const res = await request(app)
        .post(`/api/allocations/${validAllocationId}/execute`)
        .set('Authorization', `Bearer ${token}`)
        .send({ executionTxHash: '0x1234567890123456789012345678901234567890123456789012345678901234' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXECUTING');
    });
  });
});
