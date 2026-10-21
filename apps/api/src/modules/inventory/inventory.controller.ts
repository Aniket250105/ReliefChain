import { Response } from 'express';
import { InventoryService } from './inventory.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export const adjust = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { batchId, quantity, reason } = req.body;
    const actorId = req.user?.id;
    const orgId = req.user?.organizationId;
    
    if (!actorId || !orgId) {
       return res.status(403).json({ error: 'User must belong to an organization' });
    }
    
    const result = await InventoryService.adjust(batchId, quantity, reason, actorId, orgId);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    if (error.message.includes('Not authorized')) return res.status(403).json({ error: error.message });
    if (error.message.includes('Insufficient stock')) return res.status(409).json({ error: error.message });
    res.status(400).json({ error: error.message });
  }
};

export const list = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(403).json({ error: 'User must belong to an organization' });
    
    const inventory = await InventoryService.list(orgId);
    res.json(inventory);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
