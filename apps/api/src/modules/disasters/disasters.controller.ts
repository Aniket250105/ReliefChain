import { Request, Response } from 'express';
import {
  createDisaster,
  getDisasters,
  verifyDisaster,
  activateDisaster,
  resolveDisaster,
  archiveDisaster,
  updateDisaster,
  deleteDisaster
} from './disasters.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { createAuditLog } from '../../services/audit.service';

export const create = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, severity, state, district, city, pinCode } = req.body;
    if (!name || !description || !severity || !state || !district || !city || !pinCode) {
      return res.status(400).json({ error: 'Bad Request', message: 'All disaster fields are required' });
    }

    if (!req.user?.organizationId) {
      return res.status(403).json({ error: 'Forbidden', message: 'User does not belong to an organization' });
    }

    const disaster = await createDisaster({ name, description, severity, state, district, city, pinCode }, req.user.id, req.user.organizationId);
    return res.status(201).json(disaster);
  } catch (error: any) {
    if (error.message === 'Invalid or unverified authority organization') {
      return res.status(403).json({ error: 'Forbidden', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const disasters = await getDisasters();
    return res.status(200).json(disasters);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const handleTransition = (transitionFn: (id: string, actorId: string) => Promise<any>, actionName: string) => {
  return async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await transitionFn(id, req.user!.id);
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Disaster not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      if (error.message.startsWith('Invalid state transition')) {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }

      await createAuditLog({
        actorId: req.user!.id,
        action: actionName,
        entityType: 'Disaster',
        entityId: req.params.id,
        status: 'Failure',
        metadata: { error: error.message }
      });

      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

export const verify = handleTransition(verifyDisaster, 'VERIFY_DISASTER');
export const activate = handleTransition(activateDisaster, 'ACTIVATE_DISASTER');
export const resolve = handleTransition(resolveDisaster, 'RESOLVE_DISASTER');
export const archive = handleTransition(archiveDisaster, 'ARCHIVE_DISASTER');

export const update = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, severity, state, district, city, pinCode } = req.body;
    const updated = await updateDisaster(id, { name, description, severity, state, district, city, pinCode }, req.user!.id);
    return res.status(200).json(updated);
  } catch (error: any) {
    if (error.message === 'Disaster not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const remove = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteDisaster(id, req.user!.id);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === 'Disaster not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    if (error.message.startsWith('Cannot delete disaster')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

