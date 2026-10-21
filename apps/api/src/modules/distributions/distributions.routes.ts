import { Router } from 'express';
import * as distributionsController from './distributions.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

router.post(
  '/',
  authenticate,
  requireRoles([Web2Role.RELIEF_OFFICER]),
  distributionsController.distribute
);

router.get(
  '/',
  authenticate,
  requireRoles([Web2Role.RELIEF_OFFICER]),
  distributionsController.list
);

export default router;
