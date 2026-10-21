import { canonicalizeQuantity } from '../../src/utils/number-format';
import { ethers } from 'ethers';

describe('Number Format canonicalizeQuantity', () => {
  it('should format simple integers', () => {
    expect(canonicalizeQuantity('1')).toBe('1');
    expect(canonicalizeQuantity(1)).toBe('1');
  });

  it('should format decimals without trailing zeros', () => {
    expect(canonicalizeQuantity('1.5')).toBe('1.5');
    expect(canonicalizeQuantity(1.5)).toBe('1.5');
    expect(canonicalizeQuantity('1.500')).toBe('1.5');
  });

  it('should handle small decimals', () => {
    expect(canonicalizeQuantity('0.1')).toBe('0.1');
    expect(canonicalizeQuantity('0.01')).toBe('0.01');
    expect(canonicalizeQuantity('0.0100')).toBe('0.01');
  });

  it('should reject invalid formats', () => {
    expect(() => canonicalizeQuantity('-1')).toThrow();
    expect(() => canonicalizeQuantity('1e5')).toThrow();
    expect(() => canonicalizeQuantity('abc')).toThrow();
  });

  it('should ensure identical strings hash to the same value', () => {
    const rawInputs = [1, '1', '1.0', '1.000', '01'];
    const canonicals = rawInputs.map(canonicalizeQuantity);
    
    // They should all be exactly '1'
    expect(new Set(canonicals).size).toBe(1);

    const hashes = canonicals.map(val => ethers.id(JSON.stringify({ name: 'Water', totalQuantity: val, unit: 'L' })));
    expect(new Set(hashes).size).toBe(1);
  });

  it('should handle large and high-precision values', () => {
    const raw = '123456789.987654321000';
    const canonical = canonicalizeQuantity(raw);
    expect(canonical).toBe('123456789.987654321');
  });
});
