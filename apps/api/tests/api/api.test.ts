import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/db';
import { Web2Role } from '@reliefchain/shared-types';
import { signToken } from '../../src/utils/jwt';
import { hashPassword } from '../../src/utils/password';

// Mock the prisma client
jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    }
  }
}));

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('Authentication (POST /api/auth/login)', () => {
    it('should return 400 for malformed request', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('should return 401 for unknown user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await request(app).post('/api/auth/login').send({ email: 'unknown@example.com', password: 'pass' });
      expect(res.status).toBe(401);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'LOGIN', status: 'Failure' })
      }));
    });

    it('should return 401 for incorrect password', async () => {
      const hashedPassword = await hashPassword('correctpass');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'u1@example.com', passwordHash: hashedPassword, role: Web2Role.DONOR, createdAt: new Date(), updatedAt: new Date() });
      
      const res = await request(app).post('/api/auth/login').send({ email: 'u1@example.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'LOGIN', status: 'Failure' })
      }));
    });

    it('should return 200 and a token cookie for correct login', async () => {
      const hashedPassword = await hashPassword('correctpass');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'u1@example.com', passwordHash: hashedPassword, role: Web2Role.DONOR, createdAt: new Date(), updatedAt: new Date() });
      
      const res = await request(app).post('/api/auth/login').send({ email: 'u1@example.com', password: 'correctpass' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'LOGIN', status: 'Success' })
      }));
    });
  });

  describe('Organizations (RBAC & Auth)', () => {
    let userToken: string;
    let adminToken: string;

    beforeEach(() => {
      userToken = signToken({ id: 'u1', email: 'donor@test.com', role: Web2Role.DONOR, organizationId: null, createdAt: '', updatedAt: '' });
      adminToken = signToken({ id: 'a1', email: 'admin@gov.com', role: Web2Role.GOVERNMENT_AUTHORITY, organizationId: 'org1', createdAt: '', updatedAt: '' });
    });

    it('should allow authenticated user to list organizations (GET /api/organizations)', async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app).get('/api/organizations').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
    });

    it('should block unauthenticated user', async () => {
      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(401);
    });

    it('should block unauthorized user from verifying an organization', async () => {
      const res = await request(app).patch('/api/organizations/org2/verify').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow authorized admin to verify an organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org2', isVerified: false });
      (prisma.organization.update as jest.Mock).mockResolvedValue({ id: 'org2', isVerified: true });

      const res = await request(app).patch('/api/organizations/org2/verify').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isVerified).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIFY_ORGANIZATION', status: 'Success' })
      }));
    });

    it('should audit failure if verifying an already verified organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org2', isVerified: true });

      const res = await request(app).patch('/api/organizations/org2/verify').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIFY_ORGANIZATION', status: 'Failure' })
      }));
    });
  });
});
