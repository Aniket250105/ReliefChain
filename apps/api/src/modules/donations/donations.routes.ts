import { Router } from 'express';
import { 
  verifyDonation, 
  createRazorpayOrder, 
  verifyRazorpayPayment, 
  getMyDonations, 
  getCampaignDonations 
} from './donations.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/verify/:txHash', verifyDonation);
router.get('/my-donations', authenticate, getMyDonations);
router.get('/campaign/:campaignId', getCampaignDonations);

// Razorpay endpoints
router.post('/order', authenticate, createRazorpayOrder);
router.post('/verify-payment', authenticate, verifyRazorpayPayment);

export default router;
