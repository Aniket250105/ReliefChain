import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ResourceProvenance', function () {
  let accessControl: any;
  let resourceProvenance: any;
  let owner: any;
  let supplier: any;
  let unauthorized: any;

  beforeEach(async function () {
    [owner, supplier, unauthorized] = await ethers.getSigners();

    const AccessControl = await ethers.getContractFactory('ReliefChainAccessControl');
    accessControl = await AccessControl.deploy();

    const ResourceProvenance = await ethers.getContractFactory('ResourceProvenance');
    resourceProvenance = await ResourceProvenance.deploy(await accessControl.getAddress());

    // Grant SUPPLIER_ROLE to supplier
    const supplierRole = await accessControl.SUPPLIER_ROLE();
    await accessControl.grantRole(supplierRole, supplier.address);
  });

  it('should allow SUPPLIER_ROLE to register a batch', async function () {
    const batchId = ethers.id('batch-1');
    const campaignId = ethers.id('campaign-1');
    const metadataHash = ethers.id('metadata-1');

    await expect(resourceProvenance.connect(supplier).registerBatch(batchId, campaignId, metadataHash, supplier.address))
      .to.emit(resourceProvenance, 'ResourceRegistered')
      .withArgs(batchId, campaignId, metadataHash, supplier.address);
  });

  it('should reject unauthorized callers from registering a batch', async function () {
    const batchId = ethers.id('batch-2');
    const campaignId = ethers.id('campaign-2');
    const metadataHash = ethers.id('metadata-2');

    await expect(
      resourceProvenance.connect(unauthorized).registerBatch(batchId, campaignId, metadataHash, unauthorized.address)
    ).to.be.revertedWith('Caller is not authorized');
  });

  it('should allow SYSTEM_INDEXER_ROLE to record distribution', async function () {
    const systemRole = await accessControl.SYSTEM_INDEXER_ROLE();
    await accessControl.grantRole(systemRole, owner.address);

    const batchId = ethers.id('batch-3');
    await resourceProvenance.connect(supplier).registerBatch(batchId, ethers.id('campaign'), ethers.id('meta'), supplier.address);

    const quantity = 100n;
    const beneficiaries = 50n;
    const officer = owner.address;
    const ipfsCid = ethers.id('ipfs-hash');

    await expect(resourceProvenance.connect(owner).recordDistribution(batchId, quantity, beneficiaries, officer, ipfsCid))
      .to.emit(resourceProvenance, 'DistributionRecorded')
      .withArgs(batchId, quantity, beneficiaries, officer, ipfsCid, owner.address);
      
    expect(await resourceProvenance.distributedQuantity(batchId)).to.equal(100n);
  });

  it('should allow multiple distribution records for partial distribution', async function () {
    const systemRole = await accessControl.SYSTEM_INDEXER_ROLE();
    await accessControl.grantRole(systemRole, owner.address);

    const batchId = ethers.id('batch-4');
    await resourceProvenance.connect(supplier).registerBatch(batchId, ethers.id('campaign'), ethers.id('meta'), supplier.address);

    const officer = owner.address;
    const ipfsCid = ethers.id('ipfs-hash');

    // First distribution
    await expect(resourceProvenance.connect(owner).recordDistribution(batchId, 20n, 10n, officer, ipfsCid))
      .to.emit(resourceProvenance, 'DistributionRecorded');

    // Second distribution (partial distribution behavior)
    await expect(resourceProvenance.connect(owner).recordDistribution(batchId, 30n, 15n, officer, ipfsCid))
      .to.emit(resourceProvenance, 'DistributionRecorded');
      
    expect(await resourceProvenance.distributedQuantity(batchId)).to.equal(50n);
  });
});
