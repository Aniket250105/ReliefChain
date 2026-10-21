import { Router } from 'express';
import { listAlerts, getAlertDetail, reviewAlert, getAuditLogs } from './ai.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/alerts', authenticate, listAlerts);
router.get('/alerts/:id', authenticate, getAlertDetail);
router.patch('/alerts/:id/review', authenticate, reviewAlert);
router.get('/audit-logs', authenticate, getAuditLogs);

export default router;
