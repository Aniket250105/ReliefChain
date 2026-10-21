import { ethers } from 'ethers';

export function uuidToBytes32(uuid: string): string {
  // Remove hyphens
  const hex = uuid.replace(/-/g, '').toLowerCase();
  
  if (hex.length !== 32) {
    throw new Error('Invalid UUID length');
  }

  // The UUID is 128 bits (32 hex characters). 
  // bytes32 is 256 bits (64 hex characters).
  // Left-pad with zeros to make it a valid bytes32
  return '0x' + hex.padStart(64, '0');
}

export function bytes32ToUuid(bytes32: string): string {
  if (!bytes32.startsWith('0x') || bytes32.length !== 66) {
    throw new Error('Invalid bytes32 length');
  }

  // Extract the lower 32 hex characters (16 bytes)
  const hex = bytes32.slice(34);
  
  // Format as UUID: 8-4-4-4-12
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

export function dbAmountToWei(amount: { toString(): string } | string | number): bigint {
  return ethers.parseUnits(amount.toString(), 18);
}

export function weiToDbAmount(wei: bigint | string): string {
  // Strip trailing zeros if necessary, or just return the standard format
  return ethers.formatUnits(wei.toString(), 18);
}
