import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * ReliefChain M16 Demo Seed
 * 
 * Produces a complete realistic scenario with ALL actor types and a full
 * Disaster → Campaign → Donation → Allocation → Resource → Distribution chain.
 *
 * All data is synthetic. No real personal information.
 * Deterministic: same seed always produces the same logical structure.
 */
async function main() {
  console.log('🌱 Seeding ReliefChain M16 demo database...\n');

  const passwordHash = await bcrypt.hash('devpassword123', 12);

  // ===== ORGANIZATIONS =====
  const govOrg = await prisma.organization.upsert({
    where: { walletAddress: '0x1111111111111111111111111111111111111111' },
    update: {},
    create: {
      name: 'Global Disaster Response Agency',
      type: 'GOVERNMENT',
      isVerified: true,
      walletAddress: '0x1111111111111111111111111111111111111111'
    }
  });
  console.log('✓ Organization: Government Authority -', govOrg.id);

  const ngoOrg = await prisma.organization.upsert({
    where: { walletAddress: '0x2222222222222222222222222222222222222222' },
    update: {},
    create: {
      name: 'Hope Relief International',
      type: 'NGO',
      isVerified: true,
      walletAddress: '0x2222222222222222222222222222222222222222'
    }
  });
  console.log('✓ Organization: NGO -', ngoOrg.id);

  const auditorOrg = await prisma.organization.upsert({
    where: { walletAddress: '0x3333333333333333333333333333333333333333' },
    update: {},
    create: {
      name: 'Trust Audit Partners',
      type: 'AUDITOR',
      isVerified: true,
      walletAddress: '0x3333333333333333333333333333333333333333'
    }
  });
  console.log('✓ Organization: Auditor -', auditorOrg.id);

  const supplierOrg = await prisma.organization.upsert({
    where: { walletAddress: '0x4444444444444444444444444444444444444444' },
    update: {},
    create: {
      name: 'Global Med Logistics',
      type: 'SUPPLIER',
      isVerified: true,
      walletAddress: '0x4444444444444444444444444444444444444444'
    }
  });
  console.log('✓ Organization: Supplier -', supplierOrg.id);

  const warehouseOrg = await prisma.organization.upsert({
    where: { walletAddress: '0x5555555555555555555555555555555555555555' },
    update: {},
    create: {
      name: 'Central Distribution Warehouse',
      type: 'NGO', // Warehouse is an NGO location
      isVerified: true,
      walletAddress: '0x5555555555555555555555555555555555555555'
    }
  });
  console.log('✓ Organization: Warehouse -', warehouseOrg.id);

  // ===== USERS =====
  const createUser = async (email: string, role: string, orgId?: string) => {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, role, organizationId: orgId }
    });
  };

  const sysAdmin = await createUser('sysadmin@reliefchain.local', 'SYSTEM_ADMIN');
  const authority = await createUser('authority@gov.local', 'GOVERNMENT_AUTHORITY', govOrg.id);
  const ngoAdmin = await createUser('ngoadmin@hoperelief.local', 'NGO_ADMIN', ngoOrg.id);
  const ngoOperator = await createUser('ngooperator@hoperelief.local', 'NGO_OPERATOR', ngoOrg.id);
  const auditor = await createUser('auditor@trustaudit.local', 'AUDITOR', auditorOrg.id);
  const supplier = await createUser('supplier@medlogistics.local', 'SUPPLIER', supplierOrg.id);
  const warehouseOp = await createUser('warehouse@central.local', 'WAREHOUSE_OPERATOR', warehouseOrg.id);
  const reliefOfficer = await createUser('reliefofficer@hoperelief.local', 'RELIEF_OFFICER', ngoOrg.id);
  const donor = await createUser('donor@example.local', 'DONOR');

  console.log('✓ Users: 9 actors created');

  // ===== DISASTER =====
  const disaster = await prisma.disaster.create({
    data: {
      name: 'Karnataka Flood Relief — Demo',
      description: 'Severe flooding in Karnataka. Estimated 500,000 displaced.',
      status: 'ACTIVE',
      authorityId: govOrg.id,
      blockchainTxHash: '0x' + 'a'.repeat(64)
    }
  });
  console.log('✓ Disaster: Active -', disaster.id);

  // ===== CAMPAIGN =====
  const campaign = await prisma.campaign.create({
    data: {
      disasterId: disaster.id,
      ngoId: ngoOrg.id,
      name: 'Emergency Medical Supplies — Karnataka Flood Relief Demo',
      targetAmount: 100000,
      raisedAmount: 25000,
      status: 'ACTIVE',
      blockchainTxHash: '0x' + 'b'.repeat(64)
    }
  });
  console.log('✓ Campaign: Active -', campaign.id);

  // ===== DONATIONS =====
  const donation1 = await prisma.donation.create({
    data: {
      campaignId: campaign.id,
      donorId: donor.id,
      amount: 15000,
      blockchainTxHash: '0x' + 'c'.repeat(64),
      blockchainLogIndex: 0,
      blockchainChainId: 31337,
      status: 'CONFIRMED'
    }
  });
  const donation2 = await prisma.donation.create({
    data: {
      campaignId: campaign.id,
      donorId: donor.id,
      amount: 10000,
      blockchainTxHash: '0x' + 'd'.repeat(64),
      blockchainLogIndex: 0,
      blockchainChainId: 31337,
      status: 'CONFIRMED'
    }
  });
  console.log('✓ Donations: 2 confirmed donations -', donation1.id, donation2.id);

  // ===== ALLOCATION (in multisig workflow) =====
  // We explicitly classify this seeded allocation as a database-only DRAFT fixture.
  // The on-chain proposal step must be performed (e.g. via an E2E script) before it becomes PENDING_MULTISIG.
  const allocation = await prisma.allocation.create({
    data: {
      campaignId: campaign.id,
      requesterId: ngoOrg.id,
      amount: 20000,
      status: 'DRAFT'
    }
  });

  console.log('✓ Allocation: DRAFT (database-only fixture) -', allocation.id);

  // ===== RESOURCE BATCH =====
  const batch = await prisma.resourceBatch.create({
    data: {
      allocationId: allocation.id,
      supplierId: supplierOrg.id,
      name: 'Emergency Medical Kit Batch A',
      totalQuantity: 500,
      unit: 'kits',
      status: 'RECEIVED_RELIEF_CENTER',
      blockchainTxHash: '0x' + 'ab'.repeat(32)
    }
  });
  console.log('✓ Resource Batch: RECEIVED_RELIEF_CENTER -', batch.id);

  // ===== INVENTORY =====
  const inventory = await prisma.inventory.create({
    data: {
      batchId: batch.id,
      locationId: ngoOrg.id, // Relief center
      currentQuantity: 350 // 150 already distributed
    }
  });

  // Inventory movement: initial receipt
  await prisma.inventoryMovement.create({
    data: {
      batchId: batch.id,
      toLocation: ngoOrg.id,
      quantity: 500,
      movementType: 'RECEIPT',
      actorId: warehouseOp.id
    }
  });
  console.log('✓ Inventory: 350 remaining at relief center -', inventory.id);

  // ===== DISTRIBUTION =====
  const evidenceBuffer = Buffer.from('synthetic-evidence-photo-bytes-for-demo');
  const evidenceHash = crypto.createHash('sha256').update(evidenceBuffer).digest('hex');
  const ipfsCid = `mock-ipfs-cid-${evidenceHash.substring(0, 32)}`;

  const distribution = await prisma.distribution.create({
    data: {
      batchId: batch.id,
      officerId: reliefOfficer.id,
      quantity: 150,
      beneficiaryCount: 75,
      blockchainTxHash: '0x' + 'dd'.repeat(32),
      logIndex: 0,
      idempotencyKey: 'demo-distribution-001',
      status: 'CONFIRMED'
    }
  });

  // Distribution inventory movement
  await prisma.inventoryMovement.create({
    data: {
      batchId: batch.id,
      toLocation: 'DISTRIBUTED',
      quantity: -150,
      movementType: 'DISTRIBUTION',
      actorId: reliefOfficer.id
    }
  });

  console.log('✓ Distribution: 150 kits to 75 beneficiaries -', distribution.id);

  // ===== EVIDENCE =====
  const evidence = await prisma.evidence.create({
    data: {
      fileUrl: `mock-storage://${ipfsCid}`,
      contentHashSha256: evidenceHash,
      ipfsCid,
      entityType: 'Distribution',
      entityId: distribution.id
    }
  });
  console.log('✓ Evidence: SHA-256 linked -', evidence.id);

  // ===== IMPACT ATTRIBUTION =====
  // Proportional pooled: donation1 contributed 60%, donation2 40%
  await prisma.impactAttribution.create({
    data: {
      donationId: donation1.id,
      distributionId: distribution.id,
      attributedUnits: 90 // 60% of 150
    }
  });
  await prisma.impactAttribution.create({
    data: {
      donationId: donation2.id,
      distributionId: distribution.id,
      attributedUnits: 60 // 40% of 150
    }
  });
  console.log('✓ Impact Attribution: proportional pooled model applied');

  // ===== AI ALERT (sample) =====
  await prisma.aIAlert.create({
    data: {
      entityType: 'Distribution',
      entityId: distribution.id,
      triggerEventId: `31337:${'0x' + 'dd'.repeat(32)}:0`,
      anomalyScore: -0.12,
      riskLevel: 'LOW',
      reasonCodes: [],
      status: 'NEW'
    }
  });
  console.log('✓ AI Alert: LOW risk (normal operation)');

  // ===== NOTIFICATION (demo) =====
  const notifKey = `${authority.id}:MULTISIG_APPROVAL_REQUIRED:Allocation:${allocation.id}`;
  await prisma.notification.create({
    data: {
      recipientId: authority.id,
      type: 'MULTISIG_APPROVAL_REQUIRED',
      title: `Approval Required: Allocation ${allocation.id.slice(0, 8)}`,
      message: `An allocation for 20000 unit(s) has been requested and requires your multisig approval.`,
      entityType: 'Allocation',
      entityId: allocation.id,
      idempotencyKey: notifKey,
      status: 'READ',
      deliveryStatus: 'SENT',
      readAt: new Date()
    }
  });
  console.log('✓ Notification: approval notification (read + sent)');

  // ===== BLOCKCHAIN EVENT (demo) =====
  await prisma.blockchainEvent.create({
    data: {
      chainId: 31337,
      eventName: 'DistributionRecorded',
      contractAddress: '0x0000000000000000000000000000000000000000',
      transactionHash: '0x' + 'dd'.repeat(32),
      blockNumber: 100,
      blockHash: '0x' + 'ee'.repeat(32),
      logIndex: 0,
      payload: {
        batchId: batch.id,
        quantity: '150',
        beneficiaries: 75,
        officer: reliefOfficer.id,
        ipfsCid
      },
      status: 'PROCESSED'
    }
  });
  console.log('✓ BlockchainEvent: DistributionRecorded indexed\n');

  // ===== AUDIT LOGS =====
  await prisma.auditLog.create({
    data: {
      actorId: authority.id,
      action: 'VERIFY_DISASTER',
      entityType: 'Disaster',
      entityId: disaster.id,
      status: 'Success',
      metadata: { verifiedAt: new Date().toISOString() }
    }
  });
  await prisma.auditLog.create({
    data: {
      actorId: ngoAdmin.id,
      action: 'CREATE_ALLOCATION',
      entityType: 'Allocation',
      entityId: allocation.id,
      status: 'Success',
      metadata: { amount: 20000 }
    }
  });
  await prisma.auditLog.create({
    data: {
      actorId: reliefOfficer.id,
      action: 'DISTRIBUTION_INITIATED',
      entityType: 'Distribution',
      entityId: distribution.id,
      status: 'Success',
      metadata: { quantity: 150, beneficiaryCount: 75 }
    }
  });
  console.log('✓ Audit Logs: 3 representative entries\n');

  console.log('=====================================');
  console.log('  ReliefChain M16 Seed Complete!');
  console.log('=====================================');
  console.log('\nDemo credentials (all accounts):');
  console.log('  Password: devpassword123\n');
  console.log('Actors:');
  console.log(`  System Admin:     sysadmin@reliefchain.local`);
  console.log(`  Authority:        authority@gov.local`);
  console.log(`  NGO Admin:        ngoadmin@hoperelief.local`);
  console.log(`  NGO Operator:     ngooperator@hoperelief.local`);
  console.log(`  Auditor:          auditor@trustaudit.local`);
  console.log(`  Supplier:         supplier@medlogistics.local`);
  console.log(`  Warehouse Op:     warehouse@central.local`);
  console.log(`  Relief Officer:   reliefofficer@hoperelief.local`);
  console.log(`  Donor:            donor@example.local`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
