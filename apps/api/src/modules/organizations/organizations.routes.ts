import { Router } from 'express';
import { create, list, verify } from './organizations.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

// Create new org
router.post('/', authenticate, create);

// List orgs
router.get('/', authenticate, list);

// Verify org (only authority/system admin)
router.patch('/:id/verify', authenticate, requireRoles([Web2Role.SYSTEM_ADMIN, Web2Role.GOVERNMENT_AUTHORITY]), verify);

export default router;
