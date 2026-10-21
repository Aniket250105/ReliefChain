import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * StorageService
 * 
 * Implements the off-chain storage abstraction required for Evidence upload.
 * Currently configured for local filesystem as a mock for IPFS/S3.
 * 
 * Limitation Documented: Local environment does not natively support an IPFS node or S3 bucket.
 * This service implements the abstraction locally. In production, this would upload directly
 * to S3 and/or pin to IPFS.
 */
export class StorageService {
  private static storageDir = path.join(process.cwd(), 'uploads', 'evidence');

  static {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Stores a file and computes its SHA-256 hash.
   * @param fileBuffer The raw bytes of the file.
   * @returns The computed sha256 hash and the IPFS CID (mocked URL/CID).
   */
  static async uploadEvidence(fileBuffer: Buffer): Promise<{ sha256: string; ipfsCid: string }> {
    // Server computes SHA-256 natively
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    // In a real environment, this would be an IPFS CID like Qm...
    // We mock it using the hash as the identifier.
    const ipfsCid = `mock-ipfs-cid-${hash.substring(0, 32)}`;
    
    const filePath = path.join(this.storageDir, ipfsCid);
    
    // Store file in local abstraction
    await fs.promises.writeFile(filePath, fileBuffer);

    return {
      sha256: hash,
      ipfsCid
    };
  }
}
