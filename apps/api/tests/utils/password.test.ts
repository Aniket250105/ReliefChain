import { hashPassword, verifyPassword } from '../../src/utils/password';

describe('Password Utility', () => {
  it('should hash and verify a correct password', async () => {
    const raw = 'mySecurePassword';
    const hash = await hashPassword(raw);
    
    expect(hash).not.toEqual(raw);
    
    const isValid = await verifyPassword(raw, hash);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const raw = 'mySecurePassword';
    const hash = await hashPassword(raw);
    
    const isValid = await verifyPassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });
});
