import { Request, Response } from 'express';
import prisma from '../../config/db';
import { verifyTransactionStatus } from './donations.service';

export const verifyDonation = async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    if (!txHash) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing txHash' });
    }

    const verificationResult = await verifyTransactionStatus(txHash);
    return res.status(200).json(verificationResult);
  } catch (error: any) {
    if (error.message.startsWith('Invalid transaction hash')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { processRazorpayDonation } from './donations.service';
import { AuthenticatedRequest } from '../../middleware/auth';

const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret',
  });
};

export const createRazorpayOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, campaignId } = req.body;
    
    if (!amount || !campaignId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing amount or campaignId' });
    }

    const options = {
      amount: Math.round(amount * 100), // convert INR to paise
      currency: "INR",
      receipt: `rcpt_${campaignId.substring(0, 8)}_${Date.now()}`
    };

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_mock') {
      const rzp = getRazorpayInstance();
      const order = await rzp.orders.create(options);
      return res.status(200).json({ orderId: order.id, amount: options.amount, currency: options.currency });
    } else {
      // Mock order for sandbox without real keys
      return res.status(200).json({ 
        orderId: `order_mock_${Date.now()}`, 
        amount: options.amount, 
        currency: options.currency,
        isMock: true
      });
    }
  } catch (error: any) {
    console.error('Razorpay create order error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const verifyRazorpayPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, campaignId, isMock } = req.body;

    if (!amount || !campaignId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing amount or campaignId' });
    }

    if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Amount must be a positive number' });
    }

    // Require explicit payment ID — no silent server-side fallback generation
    if (!razorpay_payment_id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing razorpay_payment_id' });
    }

    if (!isMock) {
      if (!razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Bad Request', message: 'Missing payment signature verification parameters' });
      }

      const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', secret).update(body.toString()).digest('hex');
      
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid payment signature' });
      }
    } else {
      // In demo/mock mode, validate structured payment identity format
      if (!razorpay_payment_id.startsWith('pay_')) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid payment identifier format' });
      }
    }

    // Process the verified donation
    const donation = await processRazorpayDonation(
      campaignId,
      req.user?.id,
      amount,
      razorpay_payment_id
    );

    return res.status(200).json({
      success: true,
      donation: {
        ...donation,
        amount: Number(donation.amount),
        status: 'CONFIRMED'
      }
    });
  } catch (error: any) {
    console.error('Razorpay verify payment error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getMyDonations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const donorId = req.user?.id;
    if (!donorId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const donations = await prisma.donation.findMany({
      where: { 
        donorId,
        status: { in: ['CONFIRMED', 'Confirmed'] }
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            targetAmount: true,
            raisedAmount: true,
            status: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const normalized = donations.map(d => ({
      ...d,
      amount: Number(d.amount),
      status: 'CONFIRMED'
    }));

    return res.status(200).json(normalized);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getCampaignDonations = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const donations = await prisma.donation.findMany({
      where: {
        campaignId,
        status: { in: ['CONFIRMED', 'Confirmed'] }
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const normalized = donations.map(d => ({
      ...d,
      amount: Number(d.amount),
      status: 'CONFIRMED'
    }));

    return res.status(200).json(normalized);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

