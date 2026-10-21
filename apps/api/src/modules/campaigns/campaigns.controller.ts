import { Request, Response } from 'express';
import prisma from '../../config/db';
import { Web2Role } from '@reliefchain/shared-types';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  approveCampaign,
  pauseCampaign,
  resumeCampaign,
  closeCampaign,
  getDonationInfo,
  getAvailableBalance,
  reconcileCampaign,
  reconcileAllCampaigns
} from './campaigns.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { createAuditLog } from '../../services/audit.service';

export const create = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, targetAmount, disasterId } = req.body;
    if (!name || targetAmount === undefined || !disasterId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    if (!req.user?.organizationId) {
      return res.status(403).json({ error: 'Forbidden', message: 'User does not belong to an organization' });
    }

    const campaign = await createCampaign({ name, targetAmount, disasterId }, req.user.id, req.user.organizationId);
    return res.status(201).json(campaign);
  } catch (error: any) {
    if (error.message === 'Invalid or unverified NGO organization') {
      return res.status(403).json({ error: 'Forbidden', message: error.message });
    }
    if (error.message === 'Disaster not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    if (error.message.startsWith('Cannot create campaign for disaster in status')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const campaigns = await getCampaigns();
    return res.status(200).json(campaigns);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    return res.status(200).json(campaign);
  } catch (error: any) {
    if (error.message === 'Campaign not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const handleTransition = (transitionFn: (id: string, actorId: string, orgId: string) => Promise<any>, actionName: string) => {
  return async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.organizationId) {
        return res.status(403).json({ error: 'Forbidden', message: 'User does not belong to an organization' });
      }
      
      const { id } = req.params;
      const result = await transitionFn(id, req.user.id, req.user.organizationId);
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Campaign not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      if (error.message === 'Not authorized to modify this campaign' || error.message.startsWith('Invalid or unverified')) {
        return res.status(403).json({ error: 'Forbidden', message: error.message });
      }
      if (error.message.startsWith('Invalid state transition') || error.message.startsWith('Associated disaster is no longer ACTIVE')) {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }

      // If it failed unexpectedly, we should still audit log it. 
      // Handled failures inside the service are already logged.
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

export const approve = handleTransition(approveCampaign, 'APPROVE_CAMPAIGN');
export const pause = handleTransition(pauseCampaign, 'PAUSE_CAMPAIGN');
export const resume = handleTransition(resumeCampaign, 'RESUME_CAMPAIGN');
export const close = handleTransition(closeCampaign, 'CLOSE_CAMPAIGN');

export const getDonationInformation = async (req: Request, res: Response) => {
  try {
    const info = await getDonationInfo(req.params.id);
    return res.status(200).json(info);
  } catch (error: any) {
    if (error.message === 'Campaign not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    if (error.message.startsWith('Cannot donate to campaign') || error.message.startsWith('Associated disaster is no longer ACTIVE')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAvailableBalanceInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const balanceInfo = await getAvailableBalance(id);
    return res.status(200).json(balanceInfo);
  } catch (error: any) {
    if (error.message === 'Campaign not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const reconcile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid campaign ID format' });
    }

    // Role-scoped authorization: If NGO_ADMIN, verify ownership
    if (req.user?.role === Web2Role.NGO_ADMIN) {
      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign) {
        return res.status(404).json({ error: 'Not Found', message: 'Campaign not found' });
      }
      if (campaign.ngoId !== req.user.organizationId) {
        await createAuditLog({
          actorId: req.user.id,
          action: 'RECONCILE_CAMPAIGN',
          entityType: 'Campaign',
          entityId: id,
          status: 'Failure',
          metadata: { error: 'Not authorized to modify this campaign' }
        });
        return res.status(403).json({ error: 'Forbidden', message: 'Not authorized to modify this campaign' });
      }
    }

    const result = await reconcileCampaign(id, req.user?.id);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === 'Campaign not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const reconcileAll = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const results = await reconcileAllCampaigns(req.user?.id);
    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
