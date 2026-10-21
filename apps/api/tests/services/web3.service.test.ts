import { Web3Service } from '../../src/services/web3.service';

describe('Web3 Service', () => {
  it('should throw if RPC URL is not provided', () => {
    expect(() => new Web3Service({ rpcUrl: '', chainId: 1, donationContractAddress: '', confirmationBlocks: 2 })).toThrow('RPC URL must be provided');
  });

  it('should initialize with valid config', () => {
    const service = new Web3Service({ rpcUrl: 'http://localhost:8545', chainId: 31337, donationContractAddress: '0x0', confirmationBlocks: 2 });
    expect(service.getProvider()).toBeDefined();
    expect(() => service.getSigner()).toThrow('Indexer private key not configured');
  });

  it('should initialize signer if private key is provided', () => {
    const service = new Web3Service({ 
      rpcUrl: 'http://localhost:8545', 
      chainId: 31337, 
      indexerPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      donationContractAddress: '0x1234567890123456789012345678901234567890',
      confirmationBlocks: 2
    });
    const signer = service.getSigner();
    expect(signer).toBeDefined();
    expect(signer.address).toBeDefined();
  });

  it('should validate transaction hash syntax', () => {
    const service = new Web3Service({ 
      rpcUrl: 'http://localhost:8545', 
      chainId: 31337,
      donationContractAddress: '0x1234567890123456789012345678901234567890',
      confirmationBlocks: 2
    });
    expect(service.isValidTransactionHash('0x6f69188d3f1becc6603a113bc949dcc8c3686869403d159114adfc69e229eab0')).toBe(true);
    expect(service.isValidTransactionHash('6f69188d3f1becc6603a113bc949dcc8c3686869403d159114adfc69e229eab0')).toBe(false); // Missing 0x
    expect(service.isValidTransactionHash('0xinvalid')).toBe(false);
  });
});
