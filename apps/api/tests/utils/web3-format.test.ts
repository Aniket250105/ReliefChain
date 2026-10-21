import { uuidToBytes32, bytes32ToUuid } from '../../src/utils/web3-format';

describe('Web3 Format Utils', () => {
  it('should convert UUID to bytes32 correctly (left padded)', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const bytes32 = uuidToBytes32(uuid);
    
    expect(bytes32.startsWith('0x')).toBe(true);
    expect(bytes32.length).toBe(66);
    expect(bytes32).toBe('0x00000000000000000000000000000000123e4567e89b12d3a456426614174000');
  });

  it('should revert bytes32 back to the original UUID', () => {
    const originalUuid = '123e4567-e89b-12d3-a456-426614174000';
    const bytes32 = uuidToBytes32(originalUuid);
    const resultUuid = bytes32ToUuid(bytes32);
    
    expect(resultUuid).toBe(originalUuid);
  });

  it('should throw on invalid UUID length', () => {
    expect(() => uuidToBytes32('123e4567-e89b')).toThrow('Invalid UUID length');
  });

  it('should throw on invalid bytes32 format', () => {
    expect(() => bytes32ToUuid('0x123')).toThrow('Invalid bytes32 length');
  });
});
