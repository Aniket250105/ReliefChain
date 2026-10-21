'use client';
import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { ethers } from 'ethers';
import { formatINR, INDIA_CURRENCY_SYMBOL } from '@reliefchain/shared-types';
import { toast } from 'react-hot-toast';
import WalletConnectButton from '@/components/WalletConnectButton';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache, subscribeToCacheInvalidation } from '@/lib/api-cache';

const MULTISIG_CONTRACT_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const DONATION_CONTRACT_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const EXPECTED_CHAIN_ID = 31337;
const PROPOSE_ABI = [
  "function proposeAllocation(bytes32 allocationId, bytes32 campaignId, address escrowAddress, uint256 amount, address payable payee) external"
];

export default function NgoAllocationsPage() {
  const cachedAllocations = getCachedData<any[]>('ngo_allocations');
  const cachedCampaigns = getCachedData<any[]>('ngo_active_campaigns');
  const [allocations, setAllocations] = useState<any[]>(() => cachedAllocations || []);
  const [campaigns, setCampaigns] = useState<any[]>(() => cachedCampaigns || []);
  const [loading, setLoading] = useState(() => !cachedAllocations || cachedAllocations.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newAlloc, setNewAlloc] = useState({ amount: 5000, campaignId: '', payee: '' });
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<Record<string, string>>({});
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});

  const { isConnected, address, chainId, signer, connectWallet, switchNetwork } = useWallet();

  const fetchAllocations = async () => {
    try {
      const res = await fetch('/api/allocations', { credentials: 'include' });
      if (res.status === 401) { if (!cachedAllocations) setError('Authentication required. Please log in.'); return; }
      if (res.status === 403) { if (!cachedAllocations) setError('Access denied.'); return; }
      if (!res.ok) { if (!cachedAllocations) setError(`Server error (${res.status})`); return; }
      const data = await res.json();
      setCachedData('ngo_allocations', data);
      setAllocations(data);
      setError(null);
    } catch (e: any) {
      if (!cachedAllocations) setError('Network error: unable to reach backend.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((c: any) => c.status === 'ACTIVE');
        setCachedData('ngo_active_campaigns', active);
        setCampaigns(active);
      }
    } catch {}
  };

  useEffect(() => {
    if (!isCacheFresh('ngo_allocations', 3000)) fetchAllocations();
    if (!isCacheFresh('ngo_active_campaigns', 3000)) fetchCampaigns();

    const unsubscribe = subscribeToCacheInvalidation(() => {
      fetchAllocations();
      fetchCampaigns();
    });
    const interval = setInterval(() => {
      fetchAllocations();
      fetchCampaigns();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Clear pending transaction statuses when switching wallets
    setPendingTx({});
  }, [address]);

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: newAlloc.campaignId,
          amount: newAlloc.amount,
          payee: newAlloc.payee || '0x4444444444444444444444444444444444444444'
        })
      });
      if (res.status === 401) { setMutationError('Authentication required.'); return; }
      if (res.status === 403) { setMutationError('Not authorized to create allocations.'); return; }
      if (!res.ok) {
        const err = await res.json();
        setMutationError(err.message || `Error (${res.status})`);
        return;
      }
      setShowForm(false);
      setNewAlloc({ amount: 5000, campaignId: '', payee: '' });
      invalidateCache();
      await fetchAllocations();
    } catch (e: any) {
      setMutationError('Network error: unable to reach backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePropose = async (alloc: any) => {
    let activeSigner = signer;
    let activeChainId = chainId;

    if (!isConnected || !activeSigner) {
      toast('Connecting wallet...', { icon: '🔗' });
      const connection = await connectWallet();
      if (!connection?.signer) {
        toast.error("Please connect your wallet first.");
        return;
      }
      activeSigner = connection.signer;
      activeChainId = connection.chainId;
    }

    if (activeChainId !== EXPECTED_CHAIN_ID) {
      toast.error(`Please switch to chain ID ${EXPECTED_CHAIN_ID}`);
      await switchNetwork(EXPECTED_CHAIN_ID);
      return;
    }

    try {
      setPendingTx(prev => ({ ...prev, [alloc.id]: 'Preparing on-chain proposal...' }));

      const contract = new ethers.Contract(MULTISIG_CONTRACT_ADDRESS, PROPOSE_ABI, activeSigner);
      const amountWei = ethers.parseUnits(alloc.amount.toString(), 18);
      const payeeAddr = '0x4444444444444444444444444444444444444444';

      setPendingTx(prev => ({ ...prev, [alloc.id]: 'Waiting for wallet approval...' }));
      const tx = await contract.proposeAllocation(
        alloc.blockchainId,
        alloc.blockchainCampaignId,
        DONATION_CONTRACT_ADDRESS,
        amountWei,
        payeeAddr
      );

      setPendingTx(prev => ({ ...prev, [alloc.id]: 'Transaction pending on blockchain...' }));
      setTxHashes(prev => ({ ...prev, [alloc.id]: tx.hash }));

      await tx.wait();
      setPendingTx(prev => ({ ...prev, [alloc.id]: 'Proposed! Indexer will update status shortly.' }));
      invalidateCache();

      // Give indexer time to process
      setTimeout(fetchAllocations, 2000);
      setTimeout(fetchAllocations, 5000);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('user rejected')) {
        setPendingTx(prev => ({ ...prev, [alloc.id]: 'Transaction rejected by user.' }));
      } else if (e.message?.includes('Allocation already exists')) {
        setPendingTx(prev => ({ ...prev, [alloc.id]: 'Already proposed on-chain.' }));
        setTimeout(fetchAllocations, 2000);
      } else {
        setPendingTx(prev => ({ ...prev, [alloc.id]: `Error: ${e.reason || e.message || 'Transaction failed'}` }));
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': case 'CONFIRMED': return 'bg-sand text-forest';
      case 'PENDING_MULTISIG': return 'bg-blue-100 text-blue-800';
      case 'EXECUTING': return 'bg-purple-100 text-purple-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-forest">Allocations & Multisig</h2>
        <div className="flex items-center space-x-4">
          <WalletConnectButton preferredRole="NGO_ADMIN" />
          <button 
            onClick={() => { setShowForm(!showForm); setMutationError(null); }}
            className="px-4 py-2 bg-forest text-sand text-sm font-medium rounded-sm"
          >
            {showForm ? 'Cancel' : 'Create Allocation'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-forest/20 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-forest mb-4">Create Fund Allocation</h3>
          {mutationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {mutationError}
            </div>
          )}
          <form onSubmit={handleCreateAllocation} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-forest/70 mb-1">Campaign</label>
              <select
                required
                value={newAlloc.campaignId}
                onChange={e => setNewAlloc({...newAlloc, campaignId: e.target.value})}
                className="w-full bg-sand/30 border border-forest/20 text-forest p-2 outline-none focus:border-forest"
              >
                <option value="">Select a campaign...</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({formatINR(c.raisedAmount)} raised)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-forest/70 mb-1">Amount ({INDIA_CURRENCY_SYMBOL})</label>
              <input 
                type="number" 
                required
                min="1"
                value={newAlloc.amount}
                onChange={e => setNewAlloc({...newAlloc, amount: Number(e.target.value)})}
                className="w-full bg-sand/30 border border-forest/20 text-forest p-2 outline-none focus:border-forest"
              />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-2 bg-forest text-sand text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Allocation (DRAFT)'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white border border-forest/20 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-forest/20 bg-sand/30">
          <h3 className="text-lg font-semibold text-forest">My Allocations</h3>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-forest/60">Loading allocations...</div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-red-600">{error}</div>
        ) : allocations.length === 0 ? (
          <div className="px-6 py-8 text-center text-forest/60">No allocations found.</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-[#064E3B]/10">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-forest/60 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-forest/60 uppercase tracking-wider">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-forest/60 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-forest/60 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-forest/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#064E3B]/10">
                {allocations.map(a => (
                  <tr key={a.id} className="hover:bg-sand/10">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-forest font-mono">{a.id.substring(0,8)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-forest font-mono">{a.campaignId.substring(0,8)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-forest font-medium">{formatINR(a.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-sm w-max ${getStatusColor(a.status)}`}>
                          {a.status}
                        </span>
                        {a.MultisigApprovals && a.MultisigApprovals.length > 0 && (
                          <span className="text-xs text-gray-500">
                            Signatures: {a.MultisigApprovals.length} / 2
                          </span>
                        )}
                        {a.proposalTxHash && (
                          <span className="text-[10px] font-mono text-gray-400">
                            Proposal: {a.proposalTxHash.substring(0,10)}...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex flex-col items-end space-y-2">
                        {a.status === 'DRAFT' && (
                          <button 
                            onClick={() => handlePropose(a)} 
                            disabled={!isConnected || chainId !== EXPECTED_CHAIN_ID}
                            className="text-forest hover:opacity-80 font-semibold border border-forest px-3 py-1 rounded-sm bg-sand disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Propose On-Chain
                          </button>
                        )}
                        {a.status === 'PENDING_MULTISIG' && (
                          <span className="text-xs text-forest/70 bg-sand/70 px-2.5 py-1 rounded border border-forest/15 font-sans font-medium">
                            Awaiting Authority Approval (1/2)
                          </span>
                        )}
                        {(a.status === 'APPROVED' || a.status === 'CONFIRMED' || a.status === 'EXECUTING') && (
                          <span className="text-xs text-forest font-semibold py-1 px-2.5 bg-forest/10 rounded border border-forest/10">
                            Approved ✓ (2/2)
                          </span>
                        )}
                        {pendingTx[a.id] && (
                          <div className="text-xs text-gray-600 w-48 text-right break-words">
                            {pendingTx[a.id]}
                            {txHashes[a.id] && (
                              <div className="mt-1 font-mono text-[10px] bg-gray-100 p-1 rounded">
                                Tx: {txHashes[a.id].substring(0,10)}...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
