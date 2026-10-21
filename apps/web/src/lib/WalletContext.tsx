'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';

export interface DevAccount {
  name: string;
  role: string;
  address: string;
  privateKey: string;
  description: string;
}

export const LOCAL_RPC_URL = 'http://127.0.0.1:8545';
export const LOCAL_CHAIN_ID = 31337;

export const DEV_ACCOUNTS: DevAccount[] = [
  {
    name: 'Authority (Multisig Signer)',
    role: 'GOVERNMENT_AUTHORITY',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    description: 'Government Authority wallet with SIGNER_ROLE to approve multisig allocations'
  },
  {
    name: 'NGO (Campaign & Allocation Proposer)',
    role: 'NGO_ADMIN',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    description: 'NGO wallet with NGO_ROLE to propose funding allocations'
  },
  {
    name: 'Auditor (Multisig Signer)',
    role: 'AUDITOR',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    description: 'Auditor wallet with SIGNER_ROLE'
  },
  {
    name: 'Supplier (Batch Registrar)',
    role: 'SUPPLIER',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec340f4234563a6133860478f5734125374e707b42322c6c82305049c0',
    description: 'Supplier wallet with SUPPLIER_ROLE for inventory provenance'
  },
  {
    name: 'Donor (Crypto Contributor)',
    role: 'DONOR',
    address: '0x976EA74026E72CD5544245b7366113Ca44094B2F',
    privateKey: '0xb0f332dd3de66ec177098410177cd3631edbce4dca0c1a97f70ac5c5ea087d2b',
    description: 'Funded donor wallet to send Web3 donations'
  },
  {
    name: 'Deployer / System Admin',
    role: 'SYSTEM_ADMIN',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    description: 'Hardhat default deployer & system admin account'
  }
];

export interface WalletConnectionResult {
  signer: ethers.JsonRpcSigner | ethers.Wallet;
  address: string;
  chainId: number;
}

interface WalletContextType {
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  signer: ethers.JsonRpcSigner | ethers.Wallet | null;
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  walletType: 'metamask' | 'dev' | null;
  walletName: string | null;
  isMetaMaskAvailable: boolean;
  availableDevAccounts: DevAccount[];
  connectWallet: () => Promise<WalletConnectionResult | null>;
  connectMetaMask: () => Promise<WalletConnectionResult | null>;
  connectDevWallet: (targetAddressOrRole?: string, silent?: boolean) => Promise<WalletConnectionResult | null>;
  disconnectWallet: () => void;
  switchNetwork: (expectedChainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  walletType: null,
  walletName: null,
  isMetaMaskAvailable: false,
  availableDevAccounts: DEV_ACCOUNTS,
  connectWallet: async () => null,
  connectMetaMask: async () => null,
  connectDevWallet: async () => null,
  disconnectWallet: () => {},
  switchNetwork: async () => {}
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | ethers.Wallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletType, setWalletType] = useState<'metamask' | 'dev' | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMetaMaskAvailable(!!(window as any).ethereum);
    }
  }, []);

  const updateMetaMaskState = useCallback(async (ethProvider: any): Promise<WalletConnectionResult> => {
    const browserProvider = new ethers.BrowserProvider(ethProvider);
    const s = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();
    const cId = Number(network.chainId);

    setProvider(browserProvider);
    setSigner(s);
    setAddress(s.address);
    setChainId(cId);
    setWalletType('metamask');
    setWalletName('MetaMask');

    localStorage.setItem('reliefchain_wallet_type', 'metamask');
    return { signer: s, address: s.address, chainId: cId };
  }, []);

  const switchNetwork = useCallback(async (expectedChainId: number) => {
    if (walletType === 'dev') {
      setChainId(expectedChainId);
      return;
    }
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const hexChainId = '0x' + expectedChainId.toString(16);
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
        await updateMetaMaskState((window as any).ethereum);
      } catch (switchError: any) {
        // 4902: Chain has not been added to MetaMask
        if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: hexChainId,
                  chainName: 'Hardhat Localhost',
                  rpcUrls: [LOCAL_RPC_URL],
                  nativeCurrency: {
                    name: 'Ethereum',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                },
              ],
            });
            await updateMetaMaskState((window as any).ethereum);
          } catch (addError) {
            console.error("Failed to add network to MetaMask:", addError);
            toast.error(`Please add Hardhat network (${expectedChainId}) to MetaMask.`);
          }
        } else {
          toast.error(`Please switch your wallet to chain ID: ${expectedChainId}`);
        }
      }
    }
  }, [walletType, updateMetaMaskState]);

  const connectDevWallet = useCallback(async (targetAddressOrRole?: string, silent = false): Promise<WalletConnectionResult | null> => {
    try {
      const jsonProvider = new ethers.JsonRpcProvider(LOCAL_RPC_URL, LOCAL_CHAIN_ID, { staticNetwork: true });

      // Determine default role based on current user session if not explicitly provided
      let selected = DEV_ACCOUNTS[0]; // Default Authority
      if (targetAddressOrRole) {
        const match = DEV_ACCOUNTS.find(
          a => a.address.toLowerCase() === targetAddressOrRole.toLowerCase() ||
               a.role.toLowerCase() === targetAddressOrRole.toLowerCase() ||
               a.name.toLowerCase().includes(targetAddressOrRole.toLowerCase())
        );
        if (match) selected = match;
      } else if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            const match = DEV_ACCOUNTS.find(a => a.role === user.role);
            if (match) selected = match;
          } catch {}
        }
      }

      const devWallet = new ethers.Wallet(selected.privateKey, jsonProvider);

      setProvider(jsonProvider);
      setSigner(devWallet);
      setAddress(devWallet.address);
      setChainId(LOCAL_CHAIN_ID);
      setWalletType('dev');
      setWalletName(selected.name);

      localStorage.setItem('reliefchain_wallet_type', 'dev');
      localStorage.setItem('reliefchain_dev_account', selected.address);

      if (!silent) {
        toast.success(`Connected Built-in Wallet: ${selected.name}`);
      }
      return { signer: devWallet, address: devWallet.address, chainId: LOCAL_CHAIN_ID };
    } catch (err: any) {
      console.error("Failed to connect dev wallet:", err);
      if (!silent) {
        toast.error("Could not reach local Hardhat node on http://127.0.0.1:8545");
      }
      return null;
    }
  }, []);

  const connectMetaMask = useCallback(async (): Promise<WalletConnectionResult | null> => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        const res = await updateMetaMaskState((window as any).ethereum);
        if (res.chainId !== LOCAL_CHAIN_ID) {
          await switchNetwork(LOCAL_CHAIN_ID);
        }
        toast.success("MetaMask connected!");
        return res;
      } catch (err: any) {
        console.error("User rejected or MetaMask error:", err);
        toast.error(err.message || "MetaMask connection failed");
        return null;
      }
    } else {
      toast.error("MetaMask is not installed. Using Built-in Dev Wallet instead!");
      return await connectDevWallet();
    }
  }, [updateMetaMaskState, switchNetwork, connectDevWallet]);

  // Main connectWallet: tries MetaMask if present, or connects Dev Wallet if not
  const connectWallet = useCallback(async (): Promise<WalletConnectionResult | null> => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return await connectMetaMask();
    } else {
      toast("MetaMask extension not found. Connecting Built-in Dev Wallet...", { icon: '⚡' });
      return await connectDevWallet();
    }
  }, [connectMetaMask, connectDevWallet]);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setWalletType(null);
    setWalletName(null);
    localStorage.removeItem('reliefchain_wallet_type');
    localStorage.removeItem('reliefchain_dev_account');
    toast('Wallet disconnected', { icon: '🔌' });
  }, []);

  const hasRestoredRef = useRef(false);

  // Restore wallet session silently on initial mount
  useEffect(() => {
    if (typeof window === 'undefined' || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const savedType = localStorage.getItem('reliefchain_wallet_type');
    const savedDevAccount = localStorage.getItem('reliefchain_dev_account');

    if (savedType === 'dev') {
      connectDevWallet(savedDevAccount || undefined, true);
    } else if (savedType === 'metamask' && (window as any).ethereum) {
      (window as any).ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            updateMetaMaskState((window as any).ethereum);
          }
        })
        .catch(() => {});
    }
  }, [connectDevWallet, updateMetaMaskState]);

  // Listen for MetaMask events if extension is present
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const eth = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (walletType === 'metamask') {
        updateMetaMaskState(eth);
      }
    };

    const handleChainChanged = () => {
      if (walletType === 'metamask') {
        updateMetaMaskState(eth);
      }
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      if (eth.removeListener) {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [walletType, updateMetaMaskState, disconnectWallet]);

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected: !!address,
        walletType,
        walletName,
        isMetaMaskAvailable,
        availableDevAccounts: DEV_ACCOUNTS,
        connectWallet,
        connectMetaMask,
        connectDevWallet,
        disconnectWallet,
        switchNetwork
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
