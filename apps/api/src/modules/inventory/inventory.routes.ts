import { Router } from 'express';
import * as inventoryController from './inventory.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRoles([Web2Role.WAREHOUSE_OPERATOR, Web2Role.RELIEF_OFFICER]),
  inventoryController.list
);

router.patch(
  '/adjust',
  authenticate,
  requireRoles([Web2Role.WAREHOUSE_OPERATOR]),
  inventoryController.adjust
);

export default router;
