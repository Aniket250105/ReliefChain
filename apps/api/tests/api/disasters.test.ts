import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/db';
import { Web2Role, DisasterStatus, OrganizationType } from '@reliefchain/shared-types';
import { signToken } from '../../src/utils/jwt';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: {
    disaster: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    }
  }
}));

describe('Disasters API Endpoints', () => {
  let govToken: string;
  let ngoToken: string;
  let adminToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';

    govToken = signToken({ id: 'gov1', email: 'auth@gov.com', role: Web2Role.GOVERNMENT_AUTHORITY, organizationId: 'orgGov', createdAt: '', updatedAt: '' });
    ngoToken = signToken({ id: 'ngo1', email: 'ngo@org.com', role: Web2Role.NGO_ADMIN, organizationId: 'orgNgo', createdAt: '', updatedAt: '' });
    adminToken = signToken({ id: 'adm1', email: 'sys@admin.com', role: Web2Role.SYSTEM_ADMIN, organizationId: null, createdAt: '', updatedAt: '' });
  });

  describe('Creation (POST /api/disasters)', () => {
    it('should allow Government Authority to create a disaster and enter PENDING_VERIFICATION', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgGov', type: OrganizationType.GOVERNMENT, isVerified: true });
      (prisma.disaster.create as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.PENDING_VERIFICATION });

      const res = await request(app).post('/api/disasters').set('Authorization', `Bearer ${govToken}`).send({ name: 'Earthquake', description: 'Severe' });
      
      expect(res.status).toBe(201);
      expect(prisma.disaster.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: DisasterStatus.PENDING_VERIFICATION }) // Ignores client status, defaults to pending
      }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATE_DISASTER', status: 'Success' })
      }));
    });

    it('should reject creation from NGO Admin', async () => {
      const res = await request(app).post('/api/disasters').set('Authorization', `Bearer ${ngoToken}`).send({ name: 'Earthquake', description: 'Severe' });
      expect(res.status).toBe(403);
    });

    it('should reject creation from System Admin', async () => {
      const res = await request(app).post('/api/disasters').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Earthquake', description: 'Severe' });
      expect(res.status).toBe(403);
    });

    it('should reject if Government Authority organization is unverified', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'orgGov', type: OrganizationType.GOVERNMENT, isVerified: false });
      const res = await request(app).post('/api/disasters').set('Authorization', `Bearer ${govToken}`).send({ name: 'Earthquake', description: 'Severe' });
      expect(res.status).toBe(403);
    });

    it('should return 400 for malformed request', async () => {
      const res = await request(app).post('/api/disasters').set('Authorization', `Bearer ${govToken}`).send({ name: 'Earthquake' });
      expect(res.status).toBe(400);
    });
  });

  describe('Verification (PATCH /api/disasters/:id/verify)', () => {
    it('should successfully verify (PENDING_VERIFICATION -> VERIFIED)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.PENDING_VERIFICATION });
      (prisma.disaster.update as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.VERIFIED });

      const res = await request(app).patch('/api/disasters/dis1/verify').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(200);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIFY_DISASTER', status: 'Success' })
      }));
    });

    it('should reject unauthorized verification (NGO Admin)', async () => {
      const res = await request(app).patch('/api/disasters/dis1/verify').set('Authorization', `Bearer ${ngoToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject nonexistent disaster with 404', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await request(app).patch('/api/disasters/dis1/verify').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(404);
    });

    it('should reject repeated verification (VERIFIED -> VERIFIED) with 409', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.VERIFIED });
      const res = await request(app).patch('/api/disasters/dis1/verify').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(409);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIFY_DISASTER', status: 'Failure' })
      }));
    });
  });

  describe('Activation (PATCH /api/disasters/:id/activate)', () => {
    it('should activate Verified disaster (VERIFIED -> ACTIVE)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.VERIFIED });
      (prisma.disaster.update as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ACTIVE });
      const res = await request(app).patch('/api/disasters/dis1/activate').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(200);
    });

    it('should fail to activate Pending Verification disaster (PENDING_VERIFICATION -> ACTIVE)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.PENDING_VERIFICATION });
      const res = await request(app).patch('/api/disasters/dis1/activate').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(409);
    });
  });

  describe('Resolution (PATCH /api/disasters/:id/resolve)', () => {
    it('should resolve Active disaster (ACTIVE -> RESOLVED)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ACTIVE });
      (prisma.disaster.update as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.RESOLVED });
      const res = await request(app).patch('/api/disasters/dis1/resolve').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(200);
    });

    it('should fail to resolve Verified disaster (VERIFIED -> RESOLVED)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.VERIFIED });
      const res = await request(app).patch('/api/disasters/dis1/resolve').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(409);
    });
  });

  describe('Archiving & Terminal State (PATCH /api/disasters/:id/archive)', () => {
    it('should archive Resolved disaster (RESOLVED -> ARCHIVED)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.RESOLVED });
      (prisma.disaster.update as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ARCHIVED });
      const res = await request(app).patch('/api/disasters/dis1/archive').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(200);
    });

    it('should enforce terminal state, blocking (ARCHIVED -> ACTIVE)', async () => {
      (prisma.disaster.findUnique as jest.Mock).mockResolvedValue({ id: 'dis1', status: DisasterStatus.ARCHIVED });
      const res = await request(app).patch('/api/disasters/dis1/activate').set('Authorization', `Bearer ${govToken}`);
      expect(res.status).toBe(409);
    });
  });
});
