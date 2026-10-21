import { Response } from 'express';
import { ResourceService } from './resources.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export const createDraft = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { allocationId, name, totalQuantity, unit } = req.body;
    const actorId = req.user?.id;
    const orgId = req.user?.organizationId;
    
    if (!actorId || !orgId) {
       return res.status(403).json({ error: 'User must belong to an organization' });
    }
    
    const result = await ResourceService.createDraft(allocationId, actorId, orgId, name, totalQuantity, unit);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message.startsWith('Allocation not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const transit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.id;
    const orgId = req.user?.organizationId;
    const role = req.user?.role as string;
    
    if (!actorId || !orgId) {
       return res.status(403).json({ error: 'User must belong to an organization' });
    }
    
    const result = await ResourceService.transit(req.params.id, actorId, orgId, role);
    res.json(result);
  } catch (error: any) {
    if (error.message.startsWith('Batch not found')) return res.status(404).json({ error: error.message });
    if (error.message.startsWith('Not authorized')) return res.status(403).json({ error: error.message });
    if (error.message.startsWith('Invalid state')) return res.status(409).json({ error: error.message });
    res.status(400).json({ error: error.message });
  }
};

export const receiveWarehouse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.id;
    const orgId = req.user?.organizationId;
    
    if (!actorId || !orgId) {
       return res.status(403).json({ error: 'User must belong to an organization' });
    }

    const result = await ResourceService.receiveWarehouse(req.params.id, actorId, orgId);
    res.json(result);
  } catch (error: any) {
    if (error.message.startsWith('Batch not found')) return res.status(404).json({ error: error.message });
    if (error.message.startsWith('Invalid state')) return res.status(409).json({ error: error.message });
    res.status(400).json({ error: error.message });
  }
};

export const receiveReliefCenter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorId = req.user?.id;
    const orgId = req.user?.organizationId;
    
    if (!actorId || !orgId) {
       return res.status(403).json({ error: 'User must belong to an organization' });
    }

    const result = await ResourceService.receiveReliefCenter(req.params.id, actorId, orgId);
    res.json(result);
  } catch (error: any) {
    if (error.message.startsWith('Batch not found')) return res.status(404).json({ error: error.message });
    if (error.message.startsWith('Not authorized')) return res.status(403).json({ error: error.message });
    if (error.message.startsWith('Invalid state')) return res.status(409).json({ error: error.message });
    res.status(400).json({ error: error.message });
  }
};

export const getOne = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batch = await ResourceService.getOne(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'ResourceBatch not found' });
    }
    res.json(batch);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listSupplierBatches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(403).json({ error: 'User must belong to an organization' });
    
    const batches = await ResourceService.getSupplierBatches(orgId);
    res.json(batches);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listWarehouseBatches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(403).json({ error: 'User must belong to an organization' });
    
    const batches = await ResourceService.getWarehouseBatches(orgId);
    res.json(batches);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
