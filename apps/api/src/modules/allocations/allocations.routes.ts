import { Router } from 'express';
import { create, list, listAuthority, getOne, markExecuting } from './allocations.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

router.post('/', authenticate, requireRoles([Web2Role.NGO_ADMIN, Web2Role.NGO_OPERATOR]), create);
router.get('/', authenticate, list);
router.get('/authority', authenticate, listAuthority);
router.get('/:id', authenticate, getOne);

// Optional endpoint if we want the backend to record execution txHash explicitly
router.post('/:id/execute', authenticate, requireRoles([Web2Role.NGO_ADMIN, Web2Role.NGO_OPERATOR]), markExecuting);

export default router;
