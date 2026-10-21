import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/db';
import { signToken } from '../../src/utils/jwt';
import { Web2Role, CampaignStatus, DisasterStatus, OrganizationType, DonationVerificationStatus } from '@reliefchain/shared-types';
import { processRazorpayDonation } from '../../src/modules/donations/donations.service';
import { reconcileCampaign } from '../../src/modules/campaigns/campaigns.service';
import { handleDonationReceived } from '../../src/indexer/event-handlers/donation.handlers';
import { uuidToBytes32 } from '../../src/utils/web3-format';

describe('ReliefChain Donation Synchronization Integration Tests (Tests A-J)', () => {
  let donorToken: string;
  let ngoToken: string;
  let govToken: string;
  let sysadminToken: string;

  let donorUserId: string;
  let ngoOrgId: string;
  let govOrgId: string;
  let disasterId: string;
  let testCampaign1Id: string;
  let testCampaign2Id: string;

  beforeAll(async () => {
    const randomHex = () => Math.random().toString(16).substring(2, 10).padEnd(40, 'a');

    // 1. Create Government Org
    const govOrg = await prisma.organization.create({
      data: {
        name: 'Sync Test Gov Authority',
        type: OrganizationType.GOVERNMENT,
        isVerified: true,
        walletAddress: '0x' + randomHex(),
      }
    });
    govOrgId = govOrg.id;

    // 2. Create NGO Org
    const ngoOrg = await prisma.organization.create({
      data: {
        name: 'Sync Test NGO',
        type: OrganizationType.NGO,
        isVerified: true,
        walletAddress: '0x' + randomHex(),
      }
    });
    ngoOrgId = ngoOrg.id;

    // 3. Create Users
    const donorUser = await prisma.user.create({
      data: {
        email: `donor_${Date.now()}@test.local`,
        passwordHash: 'hash',
        role: Web2Role.DONOR,
      }
    });
    donorUserId = donorUser.id;
    donorToken = signToken({ id: donorUser.id, email: donorUser.email, role: donorUser.role } as any);

    const ngoUser = await prisma.user.create({
      data: {
        email: `ngo_${Date.now()}@test.local`,
        passwordHash: 'hash',
        role: Web2Role.NGO_ADMIN,
        organizationId: ngoOrgId,
      }
    });
    ngoToken = signToken({ id: ngoUser.id, email: ngoUser.email, role: ngoUser.role, organizationId: ngoOrgId } as any);

    const govUser = await prisma.user.create({
      data: {
        email: `gov_${Date.now()}@test.local`,
        passwordHash: 'hash',
        role: Web2Role.GOVERNMENT_AUTHORITY,
        organizationId: govOrgId,
      }
    });
    govToken = signToken({ id: govUser.id, email: govUser.email, role: govUser.role, organizationId: govOrgId } as any);

    const sysadminUser = await prisma.user.create({
      data: {
        email: `admin_${Date.now()}@test.local`,
        passwordHash: 'hash',
        role: Web2Role.SYSTEM_ADMIN,
      }
    });
    sysadminToken = signToken({ id: sysadminUser.id, email: sysadminUser.email, role: sysadminUser.role } as any);

    // 4. Create Disaster
    const disaster = await prisma.disaster.create({
      data: {
        name: 'Sync Test Disaster — Karnataka Monsoon',
        description: 'Test flood scenario',
        status: DisasterStatus.ACTIVE,
        authorityId: govOrgId,
      }
    });
    disasterId = disaster.id;

    // 5. Create Test Campaigns
    const campaign1 = await prisma.campaign.create({
      data: {
        name: 'Emergency Medical Supplies — Karnataka Flood Relief Sync Test',
        targetAmount: 100000,
        raisedAmount: 0,
        status: CampaignStatus.ACTIVE,
        disasterId: disaster.id,
        ngoId: ngoOrgId,
      }
    });
    testCampaign1Id = campaign1.id;

    const campaign2 = await prisma.campaign.create({
      data: {
        name: 'Clean Water Purification — Karnataka Flood Relief Sync Test',
        targetAmount: 50000,
        raisedAmount: 0,
        status: CampaignStatus.ACTIVE,
        disasterId: disaster.id,
        ngoId: ngoOrgId,
      }
    });
    testCampaign2Id = campaign2.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testCampaign1Id && testCampaign2Id) {
      await prisma.impactAttribution.deleteMany({
        where: {
          donation: { campaignId: { in: [testCampaign1Id, testCampaign2Id] } }
        }
      });
      await prisma.donation.deleteMany({
        where: { campaignId: { in: [testCampaign1Id, testCampaign2Id] } }
      });
      await prisma.campaign.deleteMany({
        where: { id: { in: [testCampaign1Id, testCampaign2Id] } }
      });
    }
    if (disasterId) await prisma.disaster.deleteMany({ where: { id: disasterId } });
    if (donorUserId) await prisma.user.deleteMany({ where: { id: { in: [donorUserId] } } });
    const orgs = [ngoOrgId, govOrgId].filter(Boolean);
    if (orgs.length > 0) await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  });

  describe('Test A: Reproduce the Current Bug & Verify the Fix', () => {
    it('should reflect a confirmed ₹5,000 donation as ₹5,000 raised, 5% progress, across campaign queries and recent donations', async () => {
      // 1. Initial state check
      const initialRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(initialRes.status).toBe(200);
      expect(initialRes.body.fundsRaised).toBe(0);
      expect(initialRes.body.raisedAmount).toBe(0);
      expect(initialRes.body.progressPercentage).toBe(0);

      // 2. Make ₹5,000 donation via payment verification endpoint
      const donateRes = await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 5000,
          campaignId: testCampaign1Id,
          isMock: true,
          razorpay_order_id: `order_${Date.now()}`,
          razorpay_payment_id: `pay_test_5k_${Date.now()}`
        });

      expect(donateRes.status).toBe(200);
      expect(donateRes.body.success).toBe(true);
      expect(donateRes.body.donation.status).toBe('CONFIRMED');
      expect(donateRes.body.donation.amount).toBe(5000);

      // 3. Campaign raised amount & progress bar verification
      const campaignRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(campaignRes.status).toBe(200);
      expect(campaignRes.body.fundsRaised).toBe(5000);
      expect(campaignRes.body.raisedAmount).toBe(5000);
      expect(campaignRes.body.targetAmount).toBe(100000);
      expect(campaignRes.body.progressPercentage).toBe(5);

      // 4. Verify in campaigns list endpoint
      const listRes = await request(app).get('/api/campaigns');
      expect(listRes.status).toBe(200);
      const campInList = listRes.body.find((c: any) => c.id === testCampaign1Id);
      expect(campInList).toBeDefined();
      expect(campInList.fundsRaised).toBe(5000);
      expect(campInList.raisedAmount).toBe(5000);
      expect(campInList.progressPercentage).toBe(5);

      // 5. Verify donor recent donations reflects confirmed status
      const myDonationsRes = await request(app)
        .get('/api/donations/my-donations')
        .set('Authorization', `Bearer ${donorToken}`);
      expect(myDonationsRes.status).toBe(200);
      const userDonation = myDonationsRes.body.find((d: any) => d.campaignId === testCampaign1Id);
      expect(userDonation).toBeDefined();
      expect(userDonation.amount).toBe(5000);
      expect(userDonation.status).toBe('CONFIRMED');
    });
  });

  describe('Test B: Multiple Donations Aggregation', () => {
    it('should aggregate donations of ₹5,000, ₹1,000, and ₹500 to ₹6,500 (6.5%) without omissions or double-counting', async () => {
      // Add ₹1,000
      await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 1000,
          campaignId: testCampaign1Id,
          isMock: true,
          razorpay_order_id: `order_${Date.now()}_1k`,
          razorpay_payment_id: `pay_test_1k_${Date.now()}`
        });

      // Add ₹500
      await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 500,
          campaignId: testCampaign1Id,
          isMock: true,
          razorpay_order_id: `order_${Date.now()}_500`,
          razorpay_payment_id: `pay_test_500_${Date.now()}`
        });

      const campaignRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(campaignRes.status).toBe(200);
      expect(campaignRes.body.fundsRaised).toBe(6500);
      expect(campaignRes.body.raisedAmount).toBe(6500);
      expect(campaignRes.body.targetAmount).toBe(100000);
      expect(campaignRes.body.progressPercentage).toBe(6.5);
    });
  });

  describe('Test C: Failed or Pending Donations Exclusion', () => {
    it('should NOT contribute pending, failed, or cancelled donations toward confirmed funds raised', async () => {
      // Create a pending donation
      await prisma.donation.create({
        data: {
          campaignId: testCampaign1Id,
          donorId: donorUserId,
          amount: 2000,
          status: 'PENDING',
          blockchainTxHash: `pending_tx_${Date.now()}`
        }
      });

      // Create a failed donation
      await prisma.donation.create({
        data: {
          campaignId: testCampaign1Id,
          donorId: donorUserId,
          amount: 4000,
          status: 'FAILED',
          blockchainTxHash: `failed_tx_${Date.now()}`
        }
      });

      // Total confirmed should still strictly be ₹6,500
      const campaignRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(campaignRes.status).toBe(200);
      expect(campaignRes.body.fundsRaised).toBe(6500);
      expect(campaignRes.body.raisedAmount).toBe(6500);
      expect(campaignRes.body.progressPercentage).toBe(6.5);
    });
  });

  describe('Test D: Duplicate Confirmation Idempotency', () => {
    it('should process duplicate payment confirmations idempotently without double-counting', async () => {
      const fixedPaymentId = `pay_idempotent_${Date.now()}`;

      // First confirmation
      const res1 = await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 1500,
          campaignId: testCampaign1Id,
          isMock: true,
          razorpay_order_id: 'order_dup_1',
          razorpay_payment_id: fixedPaymentId
        });
      expect(res1.status).toBe(200);

      // Second confirmation with same payment ID
      const res2 = await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 1500,
          campaignId: testCampaign1Id,
          isMock: true,
          razorpay_order_id: 'order_dup_2',
          razorpay_payment_id: fixedPaymentId
        });
      expect(res2.status).toBe(200);
      expect(res2.body.donation.id).toBe(res1.body.donation.id);

      // Total raised must include ₹1,500 exactly once (6500 + 1500 = 8000)
      const campaignRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(campaignRes.body.fundsRaised).toBe(8000);
      expect(campaignRes.body.raisedAmount).toBe(8000);
    });
  });

  describe('Test E: Campaign Isolation', () => {
    it('should strictly isolate donations to their respective campaigns without cross-contamination', async () => {
      // Donate ₹3,000 to Campaign 2
      await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 3000,
          campaignId: testCampaign2Id,
          isMock: true,
          razorpay_order_id: `order_c2_${Date.now()}`,
          razorpay_payment_id: `pay_c2_${Date.now()}`
        });

      const c1Res = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      const c2Res = await request(app).get(`/api/campaigns/${testCampaign2Id}`);

      expect(c1Res.body.fundsRaised).toBe(8000);
      expect(c2Res.body.fundsRaised).toBe(3000);
      expect(c2Res.body.targetAmount).toBe(50000);
      expect(c2Res.body.progressPercentage).toBe(6); // 3000 / 50000 = 6%
    });
  });

  describe('Test F: Multiple User Roles Consistency', () => {
    it('should return identical confirmed fundraising totals across all authorized and public dashboard roles', async () => {
      // 1. Public dashboard view
      const publicRes = await request(app).get('/api/public/dashboard');
      expect(publicRes.status).toBe(200);
      const publicCamp1 = publicRes.body.campaigns.find((c: any) => c.campaignId === testCampaign1Id);
      expect(publicCamp1).toBeDefined();
      expect(publicCamp1.fundsRaised).toBe(8000);
      expect(publicCamp1.raisedAmount).toBe(8000);

      // 2. Donor list view
      const donorRes = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${donorToken}`);
      const donorCamp1 = donorRes.body.find((c: any) => c.id === testCampaign1Id);
      expect(donorCamp1.fundsRaised).toBe(8000);

      // 3. NGO view
      const ngoRes = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${ngoToken}`);
      const ngoCamp1 = ngoRes.body.find((c: any) => c.id === testCampaign1Id);
      expect(ngoCamp1.fundsRaised).toBe(8000);

      // 4. Government Authority view
      const govRes = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${govToken}`);
      const govCamp1 = govRes.body.find((c: any) => c.id === testCampaign1Id);
      expect(govCamp1.fundsRaised).toBe(8000);

      // 5. System Administrator view
      const adminRes = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${sysadminToken}`);
      const adminCamp1 = adminRes.body.find((c: any) => c.id === testCampaign1Id);
      expect(adminCamp1.fundsRaised).toBe(8000);
    });
  });

  describe('Test G: Refresh and Re-login Data Persistence', () => {
    it('should consistently return persistent backend amounts on subsequent fresh requests without frontend state loss', async () => {
      // Simulate separate client re-fetching on login/refresh
      const freshToken = signToken({ id: donorUserId, email: 'refreshed@test.local', role: Web2Role.DONOR } as any);
      const refreshRes = await request(app)
        .get('/api/donations/my-donations')
        .set('Authorization', `Bearer ${freshToken}`);

      expect(refreshRes.status).toBe(200);
      const userDonations = refreshRes.body.filter((d: any) => d.campaignId === testCampaign1Id);
      // All confirmed user donations are present
      expect(userDonations.length).toBeGreaterThanOrEqual(3);
      userDonations.forEach((d: any) => {
        expect(d.status).toBe('CONFIRMED');
      });
    });
  });

  describe('Test H: Concurrent Donations Handling', () => {
    it('should process concurrent successful donations without race conditions or lost updates', async () => {
      const p1 = processRazorpayDonation(testCampaign1Id, donorUserId, 250, `pay_concurrent_1_${Date.now()}`);
      const p2 = processRazorpayDonation(testCampaign1Id, donorUserId, 350, `pay_concurrent_2_${Date.now()}`);

      await Promise.all([p1, p2]);

      // Previous 8000 + 250 + 350 = 8600
      const campaignRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(campaignRes.body.fundsRaised).toBe(8600);
      expect(campaignRes.body.raisedAmount).toBe(8600);
    });
  });

  describe('Test I: Blockchain Reconciliation & Currency Isolation', () => {
    it('should correctly isolate on-chain cryptocurrency from fiat INR totals and require authenticated reconciliation', async () => {
      const mockEventPayload = {
        campaignId: uuidToBytes32(testCampaign1Id),
        donor: '0x3333333333333333333333333333333333333333',
        amount: BigInt('400000000000000000000') // 400 ETH
      };

      const mockContext: any = {
        event: {
          chainId: 31337,
          transactionHash: `0x${'e'.repeat(64)}`,
          logIndex: 1,
          payload: mockEventPayload
        },
        logger: jest.fn()
      };

      // 1. Process on-chain donation
      await handleDonationReceived(mockContext);

      // 2. Verify currency isolation: INR fundsRaised remains 8600; ETH is tracked in currencyTotals
      const campaignRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      expect(campaignRes.status).toBe(200);
      expect(campaignRes.body.fundsRaised).toBe(8600);
      expect(campaignRes.body.raisedAmount).toBe(8600);
      expect(campaignRes.body.currencyTotals).toBeDefined();
      expect(campaignRes.body.currencyTotals['INR']).toBe(8600);
      expect(campaignRes.body.currencyTotals['ETH:31337']).toBe(400);

      // 3. Security: Unauthenticated reconciliation attempt is rejected (401)
      const unauthRes = await request(app).post(`/api/campaigns/${testCampaign1Id}/reconcile`);
      expect(unauthRes.status).toBe(401);

      // 4. Security: Unauthorized role (DONOR) is rejected (403)
      const unauthRoleRes = await request(app)
        .post(`/api/campaigns/${testCampaign1Id}/reconcile`)
        .set('Authorization', `Bearer ${donorToken}`);
      expect(unauthRoleRes.status).toBe(403);

      // 5. Authorized reconciliation via SYSTEM_ADMIN succeeds (200)
      const reconRes = await request(app)
        .post(`/api/campaigns/${testCampaign1Id}/reconcile`)
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(reconRes.status).toBe(200);
      expect(reconRes.body.raisedAmount).toBe(8600);

      // 6. Audit trail verification
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'RECONCILE_CAMPAIGN',
          entityId: testCampaign1Id
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.status).toBe('Success');
    });
  });

  describe('Test J: UI & Endpoint Consistency', () => {
    it('should return matching fundraising totals and progress across all campaign detail and listing endpoints', async () => {
      const singleRes = await request(app).get(`/api/campaigns/${testCampaign1Id}`);
      const listRes = await request(app).get('/api/campaigns');
      const publicRes = await request(app).get('/api/public/dashboard');

      const singleCamp = singleRes.body;
      const listCamp = listRes.body.find((c: any) => c.id === testCampaign1Id);
      const publicCamp = publicRes.body.campaigns.find((c: any) => c.campaignId === testCampaign1Id);

      expect(singleCamp.fundsRaised).toBe(8600);
      expect(listCamp.fundsRaised).toBe(8600);
      expect(publicCamp.fundsRaised).toBe(8600);

      expect(singleCamp.raisedAmount).toBe(8600);
      expect(listCamp.raisedAmount).toBe(8600);
      expect(publicCamp.raisedAmount).toBe(8600);

      expect(singleCamp.progressPercentage).toBe(listCamp.progressPercentage);
      expect(singleCamp.progressPercentage).toBe(publicCamp.progressPercentage);
    });
  });

  describe('Test K: Concurrency & Duplicate Payment Submissions', () => {
    it('should credit duplicate concurrent payment submissions only once', async () => {
      const concurrentPaymentId = `pay_race_dup_${Date.now()}`;
      const payload = {
        amount: 750,
        campaignId: testCampaign2Id,
        isMock: true,
        razorpay_order_id: 'order_race_dup',
        razorpay_payment_id: concurrentPaymentId
      };

      // Fire 3 simultaneous requests with the identical payment ID
      const results = await Promise.all([
        request(app).post('/api/donations/verify-payment').set('Authorization', `Bearer ${donorToken}`).send(payload),
        request(app).post('/api/donations/verify-payment').set('Authorization', `Bearer ${donorToken}`).send(payload),
        request(app).post('/api/donations/verify-payment').set('Authorization', `Bearer ${donorToken}`).send(payload),
      ]);

      // All requests should succeed idempotently
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      // Campaign 2 previously had 3000; adding 750 once results in exactly 3750 (never 4500 or 5250)
      const campaign2Res = await request(app).get(`/api/campaigns/${testCampaign2Id}`);
      expect(campaign2Res.body.fundsRaised).toBe(3750);
      expect(campaign2Res.body.raisedAmount).toBe(3750);
    });

    it('should process repeated blockchain events idempotently without double-crediting', async () => {
      const duplicateTxHash = `0x${'f'.repeat(64)}`;
      const mockEventPayload = {
        campaignId: uuidToBytes32(testCampaign2Id),
        donor: '0x4444444444444444444444444444444444444444',
        amount: BigInt('50000000000000000000') // 50 ETH
      };

      const mockContext: any = {
        event: {
          chainId: 31337,
          transactionHash: duplicateTxHash,
          logIndex: 0,
          payload: mockEventPayload
        },
        logger: jest.fn()
      };

      // Process event first time
      await handleDonationReceived(mockContext);
      // Process event second time (e.g. indexer replay/restart)
      await handleDonationReceived(mockContext);

      // Verify only 1 donation row was created for this txHash & logIndex
      const count = await prisma.donation.count({
        where: {
          blockchainTxHash: duplicateTxHash,
          blockchainLogIndex: 0
        }
      });
      expect(count).toBe(1);
    });
  });

  describe('Test L: System-Wide Reconciliation Protection and Audit Records', () => {
    it('should reject unauthenticated and non-admin requests to /reconcile-all', async () => {
      // Unauthenticated
      const unauthRes = await request(app).post('/api/campaigns/reconcile-all');
      expect(unauthRes.status).toBe(401);

      // NGO_ADMIN (not authorized for system-wide reconcile)
      const ngoRes = await request(app)
        .post('/api/campaigns/reconcile-all')
        .set('Authorization', `Bearer ${ngoToken}`);
      expect(ngoRes.status).toBe(403);

      // SYSTEM_ADMIN succeeds
      const adminRes = await request(app)
        .post('/api/campaigns/reconcile-all')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body)).toBe(true);

      // Audit log exists
      const systemAudit = await prisma.auditLog.findFirst({
        where: { action: 'RECONCILE_ALL_CAMPAIGNS' },
        orderBy: { createdAt: 'desc' }
      });
      expect(systemAudit).toBeDefined();
      expect(systemAudit?.status).toBe('Success');
    });

    it('should not alter an already-correct total upon repeated reconciliation', async () => {
      // First reconcile
      const res1 = await request(app)
        .post(`/api/campaigns/${testCampaign1Id}/reconcile`)
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res1.body.raisedAmount).toBe(8600);

      // Second reconcile immediately after
      const res2 = await request(app)
        .post(`/api/campaigns/${testCampaign1Id}/reconcile`)
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res2.body.raisedAmount).toBe(8600);

      // Verify DB total unchanged
      const c = await prisma.campaign.findUnique({ where: { id: testCampaign1Id } });
      expect(Number(c?.raisedAmount)).toBe(8600);
    });
  });

  describe('Test M: Decimal Precision & Strict Payment Validation', () => {
    it('should handle fractional decimal amounts without floating point drift', async () => {
      const fracPaymentId = `pay_frac_${Date.now()}`;
      const res = await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 123.45,
          campaignId: testCampaign2Id,
          isMock: true,
          razorpay_order_id: 'order_frac',
          razorpay_payment_id: fracPaymentId
        });

      expect(res.status).toBe(200);
      expect(res.body.donation.amount).toBe(123.45);

      // 3750 + 123.45 = 3873.45
      const campaign2Res = await request(app).get(`/api/campaigns/${testCampaign2Id}`);
      expect(campaign2Res.body.fundsRaised).toBe(3873.45);
    });

    it('should reject payment verification if razorpay_payment_id is omitted', async () => {
      const res = await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 500,
          campaignId: testCampaign2Id,
          isMock: true,
          razorpay_order_id: 'order_no_payment_id'
          // omitted razorpay_payment_id
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Missing razorpay_payment_id');
    });

    it('should reject non-positive amounts', async () => {
      const res = await request(app)
        .post('/api/donations/verify-payment')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: -100,
          campaignId: testCampaign2Id,
          isMock: true,
          razorpay_order_id: 'order_neg',
          razorpay_payment_id: `pay_neg_${Date.now()}`
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Amount must be a positive number');
    });
  });
});
