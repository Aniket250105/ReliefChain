'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '../../../lib/WalletContext';
import { DonationVerificationStatus, DonationInfoResponse, DonationVerificationResponse } from '@reliefchain/shared-types';
import { ethers } from 'ethers';

// Assuming standard DonationContract ABI from M5
const DONATION_CONTRACT_ABI = [
  "function donate(bytes32 campaignId) external payable"
];

export default function CampaignDonationPage({ params }: { params: { id: string } }) {
  const { provider, signer, address, chainId, isConnected, connectWallet, switchNetwork } = useWallet();
  const [campaignInfo, setCampaignInfo] = useState<DonationInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [status, setStatus] = useState<DonationVerificationStatus | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch(`/api/campaigns/${params.id}/donation-info`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load campaign data');
        return res.json();
      })
      .then(data => setCampaignInfo(data))
      .catch(err => setError(err.message));
  }, [params.id]);

  useEffect(() => {
    if (!isPolling || !txHash) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/donations/verify/${txHash}`);
        const data: DonationVerificationResponse = await res.json();
        
        setStatus(data.status);
        
        if (data.status === DonationVerificationStatus.CONFIRMED || data.status === DonationVerificationStatus.FAILED) {
          setIsPolling(false);
          // Refresh campaign info on confirm
          if (data.status === DonationVerificationStatus.CONFIRMED) {
            const infoRes = await fetch(`/api/campaigns/${params.id}/donation-info`);
            setCampaignInfo(await infoRes.json());
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [txHash, isPolling, params.id]);

  const handleDonate = async () => {
    setError(null);
    if (!signer || !campaignInfo) return;

    if (chainId !== campaignInfo.chainId) {
      await switchNetwork(campaignInfo.chainId);
      return; // Will require user to try again after switch
    }

    try {
      const parsedAmount = ethers.parseUnits(amount, 18);
      if (parsedAmount <= BigInt(0)) {
        throw new Error('Amount must be greater than zero');
      }

      const contract = new ethers.Contract(
        campaignInfo.donationContractAddress,
        DONATION_CONTRACT_ABI,
        signer
      );

      setStatus(DonationVerificationStatus.UNKNOWN); // Awaiting wallet sig
      const tx = await contract.donate(campaignInfo.blockchainCampaignId, { value: parsedAmount });
      
      setTxHash(tx.hash);
      setStatus(DonationVerificationStatus.SUBMITTED);
      setIsPolling(true);
      
    } catch (err: any) {
      console.error(err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction was rejected by user.');
      } else {
        setError(err.message || 'Transaction failed');
      }
      setStatus(null);
    }
  };

  if (error && !campaignInfo) {
    return <div style={{ color: 'var(--error)', padding: '24px' }}>Error: {error}</div>;
  }

  if (!campaignInfo) {
    return <div style={{ padding: '24px' }}>Loading campaign...</div>;
  }

  const targetAmount = parseFloat(campaignInfo.targetAmount.toString());
  const raisedAmount = parseFloat(campaignInfo.raisedAmount.toString());
  const progress = Math.min((raisedAmount / targetAmount) * 100, 100) || 0;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
      <Link href="/public/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--forest, #0F3D3A)', marginBottom: '16px', textDecoration: 'none' }}>
        ← Back to Public Dashboard
      </Link>
      <div className="glass-panel">
        <h1 style={{ marginTop: 0 }}>Campaign Donation</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Status: <span className="badge badge-active">{campaignInfo.status}</span></span>
        </div>
        
        <div style={{ margin: '24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
            <span>Raised: {raisedAmount} ETH</span>
            <span>Target: {targetAmount} ETH</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div style={{ marginTop: '32px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          {currentUser && currentUser.role !== 'DONOR' ? (
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'rgba(255,255,255,0.9)' }}>
                You are signed in as <strong>{currentUser.role.replace(/_/g, ' ')}</strong>.
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', opacity: 0.75 }}>
                Direct donations are restricted to Donor accounts. To contribute funds, please switch to a Donor account.
              </p>
              <a href="/dashboard" className="btn btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Return to Workspace
              </a>
            </div>
          ) : !isConnected ? (
            <div style={{ textAlign: 'center' }}>
              <p>Connect your wallet to donate to this campaign.</p>
              <button className="btn btn-primary" onClick={connectWallet}>Connect Wallet</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: '0 0 16px 0' }}>
                Connected: {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
              </p>
              
              {chainId !== campaignInfo.chainId && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--error)' }}>
                    Wrong Network. Please switch to network ID: {campaignInfo.chainId}
                  </p>
                  <button className="btn" style={{ marginTop: '8px', background: 'var(--error)', color: 'white' }} onClick={() => switchNetwork(campaignInfo.chainId)}>
                    Switch Network
                  </button>
                </div>
              )}

              <input 
                type="number" 
                placeholder="Amount in ETH" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={status === DonationVerificationStatus.SUBMITTED || status === DonationVerificationStatus.PENDING_CONFIRMATION}
              />
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={handleDonate}
                disabled={!amount || status === DonationVerificationStatus.SUBMITTED || status === DonationVerificationStatus.PENDING_CONFIRMATION}
              >
                {status === DonationVerificationStatus.SUBMITTED ? 'Transaction Submitted...' : 'Donate Now'}
              </button>

              {error && <p style={{ color: 'var(--error)', fontSize: '14px', marginTop: '16px' }}>{error}</p>}
              
              {status && (
                <div style={{ marginTop: '24px', padding: '16px', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>Donation Status</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${
                      status === DonationVerificationStatus.CONFIRMED ? 'badge-active' :
                      status === DonationVerificationStatus.FAILED ? 'badge-failed' : 'badge-pending'
                    }`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  {txHash && (
                    <p style={{ fontSize: '12px', wordBreak: 'break-all', marginTop: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      Tx: {txHash}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
