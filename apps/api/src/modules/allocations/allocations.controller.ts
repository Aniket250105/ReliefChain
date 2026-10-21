import { Request, Response } from 'express';
import * as allocationsService from './allocations.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { web3Service } from '../../services/web3.service';

export const create = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId, amount, purpose, payee } = req.body;
    if (!campaignId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing or invalid fields' });
    }

    if (!req.user?.organizationId) {
      return res.status(403).json({ error: 'Forbidden', message: 'User does not belong to an organization' });
    }

    const allocation = await allocationsService.createAllocation(
      { campaignId, amount, purpose, payee },
      req.user.id,
      req.user.organizationId
    );
    
    // Return trusted payload for Web3 proposal
    return res.status(201).json({
      ...allocation,
      web3Payload: {
        chainId: web3Service.expectedChainId,
        allocationContract: web3Service.donationContractAddress, // Needs to be exact multisig, handled in frontend by config or API
        blockchainAllocationId: allocation.blockchainId,
        blockchainCampaignId: allocation.blockchainCampaignId
      }
    });
  } catch (error: any) {
    if (error.message.startsWith('Not authorized') || error.message.startsWith('Invalid NGO')) {
      return res.status(403).json({ error: 'Forbidden', message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    if (error.message.includes('exceeds available balance') || error.message.includes('status')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const list = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allocations = await allocationsService.getAllocations(req.user?.organizationId, req.user?.role);
    return res.status(200).json(allocations);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const listAuthority = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allocations = await allocationsService.getAuthorityAllocations(req.user?.organizationId);
    return res.status(200).json(allocations);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getOne = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(403).json({ error: 'Forbidden', message: 'User does not belong to an organization' });
    }
    const allocation = await allocationsService.getAllocationById(req.params.id, req.user.organizationId);
    return res.status(200).json(allocation);
  } catch (error: any) {
    if (error.message === 'Allocation not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markExecuting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { executionTxHash } = req.body;
    if (!executionTxHash) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing executionTxHash' });
    }
    const allocation = await allocationsService.markExecuting(req.params.id, executionTxHash, req.user!.id);
    return res.status(200).json(allocation);
  } catch (error: any) {
    if (error.message === 'Allocation not found') {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    if (error.message.startsWith('Invalid')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
