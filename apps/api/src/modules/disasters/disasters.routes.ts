import { Router } from 'express';
import { create, list, verify, activate, resolve, archive, update, remove } from './disasters.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

// Create new disaster (Strictly Government Authority)
router.post('/', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY]), create);

// List disasters (Any authenticated user can list)
router.get('/', authenticate, list);

// Lifecycle transitions (Strictly Government Authority)
router.patch('/:id/verify', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY]), verify);
router.patch('/:id/activate', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY]), activate);
router.patch('/:id/resolve', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY]), resolve);
router.patch('/:id/archive', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY]), archive);

// Update disaster details (Government Authority or System Admin)
router.patch('/:id', authenticate, requireRoles([Web2Role.GOVERNMENT_AUTHORITY, Web2Role.SYSTEM_ADMIN]), update);

// Delete disaster if declared by mistake (System Admin or Government Authority)
router.delete('/:id', authenticate, requireRoles([Web2Role.SYSTEM_ADMIN, Web2Role.GOVERNMENT_AUTHORITY]), remove);

export default router;

