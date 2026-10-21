import { Router } from 'express';
import * as qrController from './qr.controller';

const router = Router();

// Public endpoints — no authentication required per SRS FR-QR-001
router.get('/verify/:batchId', qrController.verify);
router.get('/generate/:batchId', qrController.generate);

export default router;
