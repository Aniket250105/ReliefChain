import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { DistributionService } from './distributions.service';
import { StorageService } from '../../services/storage.service';

export const distribute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { batchId, quantityDistributed, beneficiaryCount, evidenceBase64 } = req.body;
    const actorId = req.user?.id;
    const orgId = req.user?.organizationId;

    if (!actorId || !orgId) {
       return res.status(403).json({ error: 'User must belong to an organization' });
    }

    const idempotencyKey = req.header('Idempotency-Key');
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Idempotency-Key header is required' });
    }

    if (!evidenceBase64) {
      return res.status(400).json({ error: 'Evidence is required for distribution' });
    }

    // Server computes SHA-256 natively via StorageService abstraction
    // File size limits are enforced here or by multer (assumed <5MB per SRS)
    const fileBuffer = Buffer.from(evidenceBase64, 'base64');
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Evidence file exceeds 5MB limit' });
    }

    const { sha256, ipfsCid } = await StorageService.uploadEvidence(fileBuffer);
    
    const result = await DistributionService.distribute(
      batchId, 
      quantityDistributed, 
      beneficiaryCount, 
      actorId, 
      orgId, 
      sha256,
      ipfsCid,
      idempotencyKey
    );

    res.json(result);
  } catch (error: any) {
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    if (error.message.includes('Not authorized') || error.message.includes('mismatch')) return res.status(403).json({ error: error.message });
    if (error.message.includes('Insufficient stock') || error.message.includes('greater than zero')) return res.status(409).json({ error: error.message });
    res.status(400).json({ error: error.message });
  }
};

export const list = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.id;
    if (!actorId) {
       return res.status(403).json({ error: 'Not authorized' });
    }
    const result = await DistributionService.list(actorId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
