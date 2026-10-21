import { Router } from 'express';
import { getReports, getDashboard } from './analytics.controller';

const router = Router();

router.get('/reports', getReports);
router.get('/public/dashboard', getDashboard);
router.get('/analytics/public/dashboard', getDashboard);

export default router;
