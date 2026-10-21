import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { ReliefChainAccessControl, DisasterRegistry, CampaignRegistry, DonationContract, CampaignEscrow, AllocationMultisig, ResourceProvenance } from "../typechain-types";

describe("ReliefChain Trust Layer", function () {
  let accessControl: ReliefChainAccessControl;
  let disasterRegistry: DisasterRegistry;
  let campaignRegistry: CampaignRegistry;
  let donationContract: DonationContract;
  let allocationMultisig: AllocationMultisig;
  let resourceProvenance: ResourceProvenance;

  let owner: Signer;
  let authority: Signer;
  let ngo: Signer;
  let signer1: Signer;
  let signer2: Signer;
  let signer3: Signer;
  let donor: Signer;
  let payee: Signer;
  let randomUser: Signer;

  const disasterId = ethers.id("disaster-1");
  const campaignId = ethers.id("campaign-1");
  const metadataHash = ethers.id("metadata");

  before(async function () {
    [owner, authority, ngo, signer1, signer2, signer3, donor, payee, randomUser] = await ethers.getSigners();

    const AccessControl = await ethers.getContractFactory("ReliefChainAccessControl");
    accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();

    const DisasterRegistry = await ethers.getContractFactory("DisasterRegistry");
    disasterRegistry = await DisasterRegistry.deploy(await accessControl.getAddress());
    await disasterRegistry.waitForDeployment();

    const CampaignRegistry = await ethers.getContractFactory("CampaignRegistry");
    campaignRegistry = await CampaignRegistry.deploy(await accessControl.getAddress(), await disasterRegistry.getAddress());
    await campaignRegistry.waitForDeployment();

    const DonationContract = await ethers.getContractFactory("DonationContract");
    donationContract = await DonationContract.deploy(await campaignRegistry.getAddress());
    await donationContract.waitForDeployment();

    const AllocationMultisig = await ethers.getContractFactory("AllocationMultisig");
    allocationMultisig = await AllocationMultisig.deploy(await accessControl.getAddress());
    await allocationMultisig.waitForDeployment();

    const ResourceProvenance = await ethers.getContractFactory("ResourceProvenance");
    resourceProvenance = await ResourceProvenance.deploy(await accessControl.getAddress());
    await resourceProvenance.waitForDeployment();

    // Setup Roles
    const AUTHORITY_ROLE = await accessControl.AUTHORITY_ROLE();
    const NGO_ROLE = await accessControl.NGO_ROLE();
    const SIGNER_ROLE = await accessControl.SIGNER_ROLE();

    await accessControl.grantRole(AUTHORITY_ROLE, await authority.getAddress());
    await accessControl.grantRole(NGO_ROLE, await ngo.getAddress());
    await accessControl.grantRole(SIGNER_ROLE, await signer1.getAddress());
    await accessControl.grantRole(SIGNER_ROLE, await signer2.getAddress());
    await accessControl.grantRole(SIGNER_ROLE, await signer3.getAddress());
  });

  describe("DisasterRegistry", function () {
    it("should allow any user to create a disaster (anchoring)", async function () {
      await expect(disasterRegistry.connect(ngo).createDisaster(disasterId, metadataHash))
        .to.emit(disasterRegistry, "DisasterCreated")
        .withArgs(disasterId, metadataHash, await ngo.getAddress());
    });

    it("should prevent duplicate disaster creation", async function () {
      await expect(disasterRegistry.connect(ngo).createDisaster(disasterId, metadataHash))
        .to.be.revertedWith("Disaster already exists");
    });

    it("should prevent unauthorized verification", async function () {
      await expect(disasterRegistry.connect(ngo).verifyDisaster(disasterId))
        .to.be.revertedWith("Caller is not an authority");
    });

    it("should allow authority to verify a disaster", async function () {
      await expect(disasterRegistry.connect(authority).verifyDisaster(disasterId))
        .to.emit(disasterRegistry, "DisasterVerified")
        .withArgs(disasterId, await authority.getAddress());
    });

    it("should prevent repeat verification", async function () {
      await expect(disasterRegistry.connect(authority).verifyDisaster(disasterId))
        .to.be.revertedWith("Disaster already verified");
    });
  });

  describe("CampaignRegistry", function () {
    it("should allow campaign creation linking to a valid disaster", async function () {
      await expect(campaignRegistry.connect(ngo).createCampaign(campaignId, disasterId))
        .to.emit(campaignRegistry, "CampaignCreated")
        .withArgs(campaignId, disasterId, await ngo.getAddress());
    });

    it("should prevent linking campaign to non-existent disaster", async function () {
      const invalidDisasterId = ethers.id("invalid");
      await expect(campaignRegistry.connect(ngo).createCampaign(ethers.id("camp-x"), invalidDisasterId))
        .to.be.revertedWith("Disaster does not exist on-chain");
    });

    it("should allow authority to verify a campaign", async function () {
      await expect(campaignRegistry.connect(authority).verifyCampaign(campaignId))
        .to.emit(campaignRegistry, "CampaignVerified")
        .withArgs(campaignId, await authority.getAddress());
    });
  });

  describe("Donation & Escrow", function () {
    let escrowAddress: string;

    it("should create escrow for verified campaign", async function () {
      const tx = await donationContract.connect(ngo).createEscrow(campaignId);
      const receipt = await tx.wait();
      // Extract escrow address from event (simplification, can also query mapping)
      escrowAddress = await donationContract.campaignEscrows(campaignId);
      expect(escrowAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should accept donations and route to escrow", async function () {
      const amount = ethers.parseEther("1.0");
      await expect(donationContract.connect(donor).donate(campaignId, { value: amount }))
        .to.emit(donationContract, "DonationReceived")
        .withArgs(campaignId, await donor.getAddress(), amount);

      const balance = await donationContract.campaignBalance(campaignId);
      expect(balance).to.equal(amount);
    });

    it("should allow DonationContract to set AllocationMultisig on escrow", async function () {
      await donationContract.connect(owner).setEscrowMultisig(campaignId, await allocationMultisig.getAddress());
    });
  });

  describe("AllocationMultisig", function () {
    const allocationId = ethers.id("alloc-1");
    let amountToRelease: bigint;

    before(async function () {
      amountToRelease = ethers.parseEther("0.5");
    });

    it("should prevent AUTHORITY_ROLE from proposing allocation", async function () {
      const escrowAddress = await donationContract.campaignEscrows(campaignId);
      await expect(allocationMultisig.connect(authority).proposeAllocation(allocationId, campaignId, escrowAddress, amountToRelease, await payee.getAddress()))
        .to.be.revertedWith("Caller is not authorized to propose");
    });

    it("should allow authorized proposer to propose allocation", async function () {
      const escrowAddress = await donationContract.campaignEscrows(campaignId);
      await expect(allocationMultisig.connect(ngo).proposeAllocation(allocationId, campaignId, escrowAddress, amountToRelease, await payee.getAddress()))
        .to.emit(allocationMultisig, "AllocationProposed");
    });

    it("should allow signer to approve", async function () {
      await expect(allocationMultisig.connect(signer1).approveAllocation(allocationId))
        .to.emit(allocationMultisig, "AllocationApproved")
        .withArgs(allocationId, await signer1.getAddress());
    });

    it("should prevent duplicate approval from same signer", async function () {
      await expect(allocationMultisig.connect(signer1).approveAllocation(allocationId))
        .to.be.revertedWith("Signer already approved");
    });

    it("should fail execution before threshold", async function () {
      await expect(allocationMultisig.connect(signer1).executeAllocation(allocationId))
        .to.be.revertedWith("Threshold not met");
    });

    it("should allow second signer to approve (meets threshold)", async function () {
      await expect(allocationMultisig.connect(signer2).approveAllocation(allocationId))
        .to.emit(allocationMultisig, "AllocationApproved");
    });

    it("should execute allocation successfully and transfer funds", async function () {
      const initialBalance = await ethers.provider.getBalance(await payee.getAddress());
      
      await expect(allocationMultisig.connect(signer2).executeAllocation(allocationId))
        .to.emit(allocationMultisig, "AllocationExecuted")
        .withArgs(allocationId, campaignId, amountToRelease, await payee.getAddress());

      const finalBalance = await ethers.provider.getBalance(await payee.getAddress());
      expect(finalBalance - initialBalance).to.equal(amountToRelease);
    });

    it("should reject repeated execution", async function () {
      await expect(allocationMultisig.connect(signer2).executeAllocation(allocationId))
        .to.be.revertedWith("Allocation already executed");
    });
  });
});
