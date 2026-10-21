import { Router } from 'express';
import { create, list, getOne, approve, pause, resume, close, getDonationInformation, getAvailableBalanceInfo, reconcile, reconcileAll } from './campaigns.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { rateLimit } from '../../middleware/rate-limit';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

// Create new campaign (Strictly NGO Admin)
router.post('/', authenticate, requireRoles([Web2Role.NGO_ADMIN]), create);

// Reconcile campaign funds (Secured)
// System-wide reconciliation: Strictly SYSTEM_ADMIN with rate limiting
router.post('/reconcile-all', authenticate, requireRoles([Web2Role.SYSTEM_ADMIN]), rateLimit(5, 60_000), reconcileAll);

// Single campaign reconciliation: Authorized SYSTEM_ADMIN, GOVERNMENT_AUTHORITY, or owning NGO_ADMIN
router.post('/:id/reconcile', authenticate, requireRoles([Web2Role.SYSTEM_ADMIN, Web2Role.GOVERNMENT_AUTHORITY, Web2Role.NGO_ADMIN]), rateLimit(10, 60_000), reconcile);

// List campaigns (Public read)
router.get('/', list);
router.get('/:id', getOne);
router.get('/:id/donation-info', getDonationInformation);
router.get('/:id/available-balance', getAvailableBalanceInfo);

// Authority approval (Strictly Government Authority)
router.patch('/:id/approve', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY]), approve);

// NGO campaign mutation operations (Strictly NGO Admin)
router.patch('/:id/pause', authenticate, requireRoles([Web2Role.NGO_ADMIN]), pause);
router.patch('/:id/resume', authenticate, requireRoles([Web2Role.NGO_ADMIN]), resume);
router.patch('/:id/close', authenticate, requireRoles([Web2Role.NGO_ADMIN]), close);

export default router;
