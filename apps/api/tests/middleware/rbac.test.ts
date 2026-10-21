import { requireRoles } from '../../src/middleware/rbac';
import { AuthenticatedRequest } from '../../src/middleware/auth';
import { Response, NextFunction } from 'express';
import { Web2Role } from '@reliefchain/shared-types';

describe('RBAC Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  it('should allow access for permitted role', () => {
    mockReq = {
      user: {
        id: 'u1',
        email: 'admin@ngo.org',
        role: Web2Role.NGO_ADMIN,
        organizationId: 'o1',
        createdAt: '',
        updatedAt: ''
      }
    };

    const middleware = requireRoles([Web2Role.NGO_ADMIN, Web2Role.SYSTEM_ADMIN]);
    middleware(mockReq as AuthenticatedRequest, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should block access for forbidden role', () => {
    mockReq = {
      user: {
        id: 'u2',
        email: 'donor@example.com',
        role: Web2Role.DONOR,
        organizationId: null,
        createdAt: '',
        updatedAt: ''
      }
    };

    const middleware = requireRoles([Web2Role.NGO_ADMIN]);
    middleware(mockReq as AuthenticatedRequest, mockRes as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden', message: 'Insufficient permissions' });
  });

  it('should block access if unauthenticated', () => {
    mockReq = {}; // No user

    const middleware = requireRoles([Web2Role.NGO_ADMIN]);
    middleware(mockReq as AuthenticatedRequest, mockRes as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
