import { signToken, verifyToken } from '../../src/utils/jwt';
import { SafeUserDto, Web2Role } from '@reliefchain/shared-types';

describe('JWT Utility', () => {
  const mockUser: SafeUserDto = {
    id: 'user-123',
    email: 'test@example.com',
    role: Web2Role.NGO_ADMIN,
    organizationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should sign and verify a token', () => {
    const token = signToken(mockUser);
    expect(token).toBeDefined();

    const decoded = verifyToken(token);
    expect(decoded.id).toEqual(mockUser.id);
    expect(decoded.email).toEqual(mockUser.email);
  });

  it('should throw on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});
