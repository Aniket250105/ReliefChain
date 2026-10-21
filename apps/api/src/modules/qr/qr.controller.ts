import { Request, Response } from 'express';
import { QRVerificationService } from './qr.service';

/**
 * GET /api/qr/verify/:batchId
 * Public endpoint — no authentication required.
 * Returns sanitized provenance timeline for a ResourceBatch.
 */
export const verify = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !QRVerificationService.isValidUUID(batchId)) {
      return res.status(400).json({ error: 'Invalid batch identifier format.' });
    }

    const result = await QRVerificationService.verify(batchId);

    if (!result) {
      return res.status(404).json({ error: 'Resource batch not found.' });
    }

    res.json(result);
  } catch (error: any) {
    // Never expose internal error details to public callers
    res.status(500).json({ error: 'An internal error occurred.' });
  }
};

/**
 * GET /api/qr/generate/:batchId
 * Returns the QR payload (batch ID + verification URL).
 * No authentication required — the payload contains only a public lookup pointer.
 */
export const generate = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !QRVerificationService.isValidUUID(batchId)) {
      return res.status(400).json({ error: 'Invalid batch identifier format.' });
    }

    const payload = QRVerificationService.generateQRPayload(batchId);
    res.json(payload);
  } catch (error: any) {
    res.status(500).json({ error: 'An internal error occurred.' });
  }
};
