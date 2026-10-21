import { Request, Response } from 'express';
import { getDonorImpact } from './impact.service';

export const getImpact = async (req: Request, res: Response) => {
  try {
    const { donId } = req.params;
    if (!donId) {
      return res.status(400).json({ error: 'Donation ID is required' });
    }

    const impact = await getDonorImpact(donId);
    return res.status(200).json(impact);
  } catch (error: any) {
    if (error.message === 'Donation not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching donor impact:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
