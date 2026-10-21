import { Request, Response } from 'express';
import { createOrganization, getOrganizations, verifyOrganization } from './organizations.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { createAuditLog } from '../../services/audit.service';

export const create = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, walletAddress } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Bad Request', message: 'Name and type are required' });
    }

    const org = await createOrganization({ name, type, walletAddress, adminUserId: req.user?.id });
    return res.status(201).json(org);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const orgs = await getOrganizations();
    return res.status(200).json(orgs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const verify = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const org = await verifyOrganization(id, req.user!.id);
    return res.status(200).json(org);
  } catch (error: any) {
    await createAuditLog({
      actorId: req.user!.id,
      action: 'VERIFY_ORGANIZATION',
      entityType: 'Organization',
      entityId: req.params.id,
      status: 'Failure',
      metadata: { error: error.message }
    });

    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    if (error.message === 'Organization is already verified') {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
