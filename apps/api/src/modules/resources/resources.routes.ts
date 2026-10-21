import { Router } from 'express';
import { createDraft, transit, receiveWarehouse, receiveReliefCenter, getOne, listSupplierBatches, listWarehouseBatches } from './resources.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { Web2Role } from '@reliefchain/shared-types';

const router = Router();

router.get('/supplier', authenticate, requireRoles([Web2Role.SUPPLIER]), listSupplierBatches);
router.get('/warehouse', authenticate, requireRoles([Web2Role.WAREHOUSE_OPERATOR]), listWarehouseBatches);
router.post('/', authenticate, requireRoles([Web2Role.SUPPLIER]), createDraft);
router.patch('/:id/transit', authenticate, requireRoles([Web2Role.SUPPLIER, Web2Role.WAREHOUSE_OPERATOR]), transit);
router.patch('/:id/receive/warehouse', authenticate, requireRoles([Web2Role.WAREHOUSE_OPERATOR]), receiveWarehouse);
router.patch('/:id/receive/relief-center', authenticate, requireRoles([Web2Role.RELIEF_OFFICER]), receiveReliefCenter);
router.get('/:id', getOne);

export default router;
