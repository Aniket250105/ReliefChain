import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * ReliefChain Local Deployment Script
 * 
 * Deploys all contracts to local Hardhat network and:
 *  1. Grants SIGNER_ROLE to designated Authority + Auditor wallets
 *  2. Grants NGO_ROLE to NGO wallet
 *  3. Grants SUPPLIER_ROLE to Supplier wallet
 *  4. Grants SYSTEM_INDEXER_ROLE to the relayer
 *  5. Writes deployed addresses to a JSON file consumed by the API
 * 
 * Usage: npx hardhat run scripts/deploy-local.ts --network localhost
 */
async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  console.log("Deploying ReliefChain contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // 1. Deploy AccessControl
  const AccessControl = await ethers.getContractFactory("ReliefChainAccessControl");
  const accessControl = await AccessControl.deploy();
  await accessControl.waitForDeployment();
  const accessControlAddr = await accessControl.getAddress();
  console.log("ReliefChainAccessControl deployed to:", accessControlAddr);

  // 2. Deploy DisasterRegistry
  const DisasterRegistry = await ethers.getContractFactory("DisasterRegistry");
  const disasterRegistry = await DisasterRegistry.deploy(accessControlAddr);
  await disasterRegistry.waitForDeployment();
  const disasterRegistryAddr = await disasterRegistry.getAddress();
  console.log("DisasterRegistry deployed to:", disasterRegistryAddr);

  // 3. Deploy CampaignRegistry
  const CampaignRegistry = await ethers.getContractFactory("CampaignRegistry");
  const campaignRegistry = await CampaignRegistry.deploy(accessControlAddr, disasterRegistryAddr);
  await campaignRegistry.waitForDeployment();
  const campaignRegistryAddr = await campaignRegistry.getAddress();
  console.log("CampaignRegistry deployed to:", campaignRegistryAddr);



  // 5. Deploy DonationContract
  const DonationContract = await ethers.getContractFactory("DonationContract");
  const donationContract = await DonationContract.deploy(campaignRegistryAddr);
  await donationContract.waitForDeployment();
  const donationContractAddr = await donationContract.getAddress();
  console.log("DonationContract deployed to:", donationContractAddr);

  // 6. Deploy AllocationMultisig
  const AllocationMultisig = await ethers.getContractFactory("AllocationMultisig");
  const allocationMultisig = await AllocationMultisig.deploy(accessControlAddr);
  await allocationMultisig.waitForDeployment();
  const allocationMultisigAddr = await allocationMultisig.getAddress();
  console.log("AllocationMultisig deployed to:", allocationMultisigAddr);

  // 7. Deploy ResourceProvenance
  const ResourceProvenance = await ethers.getContractFactory("ResourceProvenance");
  const resourceProvenance = await ResourceProvenance.deploy(accessControlAddr);
  await resourceProvenance.waitForDeployment();
  const resourceProvenanceAddr = await resourceProvenance.getAddress();
  console.log("ResourceProvenance deployed to:", resourceProvenanceAddr);

  // ===== ROLE GRANTS =====
  // Hardhat default accounts:
  // [0] deployer (DEFAULT_ADMIN_ROLE)
  // [1] Government Authority
  // [2] NGO
  // [3] Auditor
  // [4] Supplier
  // [5] Relayer/Indexer

  const AUTHORITY_ROLE = await accessControl.AUTHORITY_ROLE();
  const NGO_ROLE = await accessControl.NGO_ROLE();
  const SIGNER_ROLE = await accessControl.SIGNER_ROLE();
  const SUPPLIER_ROLE = await accessControl.SUPPLIER_ROLE();
  const SYSTEM_INDEXER_ROLE = await accessControl.SYSTEM_INDEXER_ROLE();

  // Grant roles
  if (signers.length > 1) {
    await accessControl.grantRole(AUTHORITY_ROLE, signers[1].address);
    await accessControl.grantRole(SIGNER_ROLE, signers[1].address);
    console.log(`Granted AUTHORITY_ROLE + SIGNER_ROLE to ${signers[1].address}`);
  }
  if (signers.length > 2) {
    await accessControl.grantRole(NGO_ROLE, signers[2].address);
    console.log(`Granted NGO_ROLE to ${signers[2].address}`);
  }
  if (signers.length > 3) {
    await accessControl.grantRole(SIGNER_ROLE, signers[3].address);
    // Note: Auditor is a Web2 role; on-chain they are granted the generic SIGNER_ROLE if required.
    console.log(`Granted SIGNER_ROLE to Web2 Auditor account ${signers[3].address}`);
  }
  if (signers.length > 4) {
    await accessControl.grantRole(SUPPLIER_ROLE, signers[4].address);
    console.log(`Granted SUPPLIER_ROLE to ${signers[4].address}`);
  }
  if (signers.length > 5) {
    await accessControl.grantRole(SYSTEM_INDEXER_ROLE, signers[5].address);
    console.log(`Granted SYSTEM_INDEXER_ROLE to ${signers[5].address}`);
  }

  // ===== OUTPUT =====
  const deployment = {
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    contracts: {
      ReliefChainAccessControl: accessControlAddr,
      DisasterRegistry: disasterRegistryAddr,
      CampaignRegistry: campaignRegistryAddr,
      DonationContract: donationContractAddr,
      AllocationMultisig: allocationMultisigAddr,
      ResourceProvenance: resourceProvenanceAddr
    },
    roles: {
      authority: signers.length > 1 ? signers[1].address : "N/A",
      ngo: signers.length > 2 ? signers[2].address : "N/A",
      auditor: signers.length > 3 ? signers[3].address : "N/A",
      supplier: signers.length > 4 ? signers[4].address : "N/A",
      relayer: signers.length > 5 ? signers[5].address : "N/A"
    },
    timestamp: new Date().toISOString()
  };

  // Write deployment manifest
  const outputPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment manifest written to ${outputPath}`);

  // Also write a .env fragment for the API
  const envFragment = `
# Generated by deploy-local.ts at ${deployment.timestamp}
DISASTER_REGISTRY_ADDRESS="${disasterRegistryAddr}"
CAMPAIGN_REGISTRY_ADDRESS="${campaignRegistryAddr}"
DONATION_CONTRACT_ADDRESS="${donationContractAddr}"
ALLOCATION_MULTISIG_ADDRESS="${allocationMultisigAddr}"
RESOURCE_PROVENANCE_ADDRESS="${resourceProvenanceAddr}"
`;
  const envPath = path.join(__dirname, "..", "deployment.env");
  fs.writeFileSync(envPath, envFragment.trim());
  console.log(`Env fragment written to ${envPath}`);

  console.log("\n=== Deployment Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
