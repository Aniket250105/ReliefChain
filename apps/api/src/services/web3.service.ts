import { ethers } from 'ethers';

// Configuration interface
export interface Web3Config {
  rpcUrl: string;
  chainId: number;
  indexerPrivateKey?: string;
  donationContractAddress: string;
  resourceProvenanceContractAddress?: string;
  confirmationBlocks: number;
}

export class Web3Service {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  public expectedChainId: number;
  public donationContractAddress: string;
  public resourceProvenanceContractAddress: string;
  public confirmationBlocks: number;

  constructor(config: Web3Config) {
    if (!config.rpcUrl) {
      throw new Error('RPC URL must be provided');
    }
    
    this.expectedChainId = config.chainId;
    this.donationContractAddress = config.donationContractAddress;
    this.resourceProvenanceContractAddress = config.resourceProvenanceContractAddress || '0x0000000000000000000000000000000000000000';
    this.confirmationBlocks = config.confirmationBlocks;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, this.expectedChainId, { staticNetwork: true });

    if (config.indexerPrivateKey) {
      this.signer = new ethers.Wallet(config.indexerPrivateKey, this.provider);
    }
  }

  /**
   * Validates that the provider is connected to the expected chain.
   * Required by SRS to ensure the relayer doesn't anchor to the wrong network.
   */
  async verifyNetwork(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== this.expectedChainId) {
        console.error(`Network chainId mismatch. Expected ${this.expectedChainId}, got ${network.chainId}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to connect to network:', error);
      return false;
    }
  }

  /**
   * Retrieves the configured signer (System Indexer/Relayer)
   */
  getSigner(): ethers.Wallet {
    if (!this.signer) {
      throw new Error('Indexer private key not configured');
    }
    return this.signer;
  }

  /**
   * Retrieves the provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Verifies if a transaction hash is syntactically valid (bytes32)
   */
  isValidTransactionHash(hash: string): boolean {
    return /^0x([A-Fa-f0-9]{64})$/.test(hash);
  }

  /**
   * Submits a recordDistribution transaction to the ResourceProvenance contract.
   * Modifies the blockchain state by acting as the SYSTEM_INDEXER_ROLE.
   *
   * @param batchId - UUID of the ResourceBatch (bytes32)
   * @param quantity - The decimal quantity string
   * @param beneficiaries - Number of beneficiaries
   * @param officer - Address of the officer
   * @param ipfsCid - String ID (bytes32 converted) of the evidence
   * @returns the transaction hash
   */
  async recordDistribution(
    batchId: string, 
    quantity: string, 
    beneficiaries: number, 
    officer: string, 
    ipfsCid: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Indexer private key not configured');
    }

    const abi = [
      "function recordDistribution(bytes32 batchId, uint256 quantity, uint256 beneficiaries, address officer, bytes32 ipfsCid) external"
    ];

    const contract = new ethers.Contract(this.resourceProvenanceContractAddress, abi, this.signer);
    
    const { uuidToBytes32 } = require('../utils/web3-format');
    const bytes32BatchId = uuidToBytes32(batchId);
    
    // Using stringToBytes32 for ipfsCid or hash representation based on ABI
    const bytes32Ipfs = ethers.encodeBytes32String(ipfsCid.substring(0, 31)); // Simplified packing for mock

    // Parse decimal quantity for blockchain representing via precision, assuming 18 decimals like standard tokens, 
    // or just pass as parsed scaled integer. Using parseUnits.
    const qtyWei = ethers.parseUnits(quantity, 18);

    const tx = await contract.recordDistribution(bytes32BatchId, qtyWei, beneficiaries, officer, bytes32Ipfs);
    
    // We only wait for it to be mined (1 block), reconciliation handles full confirmation
    await tx.wait(1);
    
    return tx.hash;
  }
}

// Default export initialized from environment
export const web3Service = new Web3Service({
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 31337,
  indexerPrivateKey: process.env.SYSTEM_INDEXER_PRIVATE_KEY,
  donationContractAddress: process.env.DONATION_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  resourceProvenanceContractAddress: process.env.RESOURCE_PROVENANCE_CONTRACT_ADDRESS,
  confirmationBlocks: process.env.CONFIRMATION_BLOCKS ? parseInt(process.env.CONFIRMATION_BLOCKS, 10) : 2
});
