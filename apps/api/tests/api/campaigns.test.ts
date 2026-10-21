import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/db';
import { Web2Role, CampaignStatus, DisasterStatus, OrganizationType } from '@reliefchain/shared-types';
import { signToken } from '../../src/utils/jwt';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: {
    campaign: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    disaster: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    }
  }
}));

describe('Campaigns API Endpoints', () => {
  let ngoToken: string;
  let govToken: string;
  let adminToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';

    ngoToken = signToken({ id: 'ngo1', email: 'ngo@org.com', role: Web2Role.NGO_ADMIN, organizationId: 'orgNgo', createdAt: '', updatedAt: '' });
    govToken = signToken({ id: 'gov1', email: 'auth@gov.com', role: Web2Role.GOVERNMENT_AUTHORITY, organizationId: 'orgGov', createdAt: '', updatedAt: '' });
    adminToken = signToken({ id: 'adm1', email: 'sys@admin.com', role: Web2Role.SYSTEM_ADMIN, organizationId: null, createdAt: '', updatedAt: '' });
  });

  describe('Creation (POST /api/campaigns)', () => {
    it('should allow Verified NGO to create a campaign against an ACTIVE disaster', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgNgo', type: OrganizationType.NGO, isVerified: true });
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ACTIVE });
      (prisma.campaign.create as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.PENDING_AUTHORITY_APPROVAL });

      const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${ngoToken}`)
        .send({ name: 'Help Fund', targetAmount: 10000, disasterId: 'dis1' });
      
      expect(res.status).toBe(201);
      expect(prisma.campaign.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: CampaignStatus.PENDING_AUTHORITY_APPROVAL, ngoId: 'orgNgo' })
      }));
    });

    it('should reject creation if disaster is PENDING_VERIFICATION', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgNgo', type: OrganizationType.NGO, isVerified: true });
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.PENDING_VERIFICATION });

      const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${ngoToken}`)
        .send({ name: 'Help Fund', targetAmount: 10000, disasterId: 'dis1' });
      
      expect(res.status).toBe(409);
    });

    it('should reject creation if NGO is unverified', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgNgo', type: OrganizationType.NGO, isVerified: false });
      const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${ngoToken}`)
        .send({ name: 'Help Fund', targetAmount: 10000, disasterId: 'dis1' });
      expect(res.status).toBe(403);
    });

    it('should reject creation from Government Authority', async () => {
      const res = await request(app).post('/api/campaigns').set('Authorization', `Bearer ${govToken}`)
        .send({ name: 'Help Fund', targetAmount: 10000, disasterId: 'dis1' });
      expect(res.status).toBe(403);
    });
  });

  describe('Approval (PATCH /api/campaigns/:id/approve)', () => {
    it('should allow Government Authority to approve pending campaign for an ACTIVE disaster', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgGov', type: OrganizationType.GOVERNMENT, isVerified: true });
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.PENDING_AUTHORITY_APPROVAL, disasterId: 'dis1' });
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ACTIVE });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.ACTIVE });

      const res = await request(app).patch('/api/campaigns/camp1/approve').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(200);
      expect(prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: CampaignStatus.ACTIVE } }));
    });

    it('should reject approval if disaster is no longer active', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgGov', type: OrganizationType.GOVERNMENT, isVerified: true });
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.PENDING_AUTHORITY_APPROVAL, disasterId: 'dis1' });
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.RESOLVED }); // No longer active

      const res = await request(app).patch('/api/campaigns/camp1/approve').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(409);
    });

    it('should reject approval from NGO', async () => {
      const res = await request(app).patch('/api/campaigns/camp1/approve').set('Authorization', `Bearer ${ngoToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('NGO State Transitions (Pause, Resume, Close)', () => {
    it('should allow owning NGO to pause ACTIVE campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.ACTIVE, ngoId: 'orgNgo' });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.PAUSED });

      const res = await request(app).patch('/api/campaigns/camp1/pause').set('Authorization', `Bearer ${ngoToken}`);
      expect(res.status).toBe(200);
    });

    it('should reject pause from non-owning NGO', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.ACTIVE, ngoId: 'otherOrg' });
      const res = await request(app).patch('/api/campaigns/camp1/pause').set('Authorization', `Bearer ${ngoToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow owning NGO to close PAUSED campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.PAUSED, ngoId: 'orgNgo' });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.CLOSED });

      const res = await request(app).patch('/api/campaigns/camp1/close').set('Authorization', `Bearer ${ngoToken}`);
      expect(res.status).toBe(200);
    });

    it('should reject invalid transition from CLOSED', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ id: 'camp1', status: CampaignStatus.CLOSED, ngoId: 'orgNgo' });
      const res = await request(app).patch('/api/campaigns/camp1/resume').set('Authorization', `Bearer ${ngoToken}`);
      expect(res.status).toBe(409);
    });
  });

  describe('Donation Info (GET /api/campaigns/:id/donation-info)', () => {
    it('should return donation info for active campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ 
        id: '123e4567-e89b-12d3-a456-426614174000', 
        status: CampaignStatus.ACTIVE, 
        disasterId: 'dis1',
        targetAmount: 1000,
        raisedAmount: 100
      });
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ACTIVE });

      const res = await request(app).get('/api/campaigns/123e4567-e89b-12d3-a456-426614174000/donation-info');
      expect(res.status).toBe(200);
      expect(res.body.blockchainCampaignId).toBe('0x00000000000000000000000000000000123e4567e89b12d3a456426614174000'); // M5 deterministic bytes32 mapping
      expect(res.body.targetAmount).toBe('1000');
      expect(res.body.raisedAmount).toBe('100');
    });

    it('should reject if campaign is inactive', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'camp1', 
        status: CampaignStatus.PAUSED, 
        disasterId: 'dis1' 
      });

      const res = await request(app).get('/api/campaigns/camp1/donation-info');
      expect(res.status).toBe(409);
    });
  });
});
