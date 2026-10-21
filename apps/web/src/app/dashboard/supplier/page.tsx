'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@reliefchain/shared-types';
import { useWallet } from '@/lib/WalletContext';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { getCachedData, setCachedData, invalidateCache, subscribeToCacheInvalidation } from '../../../lib/api-cache';

const RESOURCE_PROVENANCE_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
const EXPECTED_CHAIN_ID = 31337;
const RESOURCE_PROVENANCE_ABI = [
  "function registerBatch(bytes32 batchId, bytes32 campaignId, bytes32 metadataHash, address supplier) external"
];

export default function SupplierDashboard() {
  const [batches, setBatches] = useState<any[]>(() => getCachedData<any[]>('supplier_batches') || []);
  const [allocations, setAllocations] = useState<any[]>(() => getCachedData<any[]>('supplier_allocations') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('supplier_batches'));
  const [newBatch, setNewBatch] = useState({ allocationId: '', name: '', totalQuantity: 100, unit: 'kits' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingTx, setPendingTx] = useState<Record<string, string>>({});
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});

  const { isConnected, address, chainId, signer, connectWallet, switchNetwork } = useWallet();

  const fetchBatches = async (isSilent = false) => {
    try {
      if (!isSilent && !getCachedData('supplier_batches')) {
        setLoading(true);
      }
      const res = await fetch('/api/resources/supplier', { credentials: 'include' });
      if (res.status === 401) throw new Error('Authentication required.');
      if (res.status === 403) throw new Error('Access denied.');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setBatches(data);
      setCachedData('supplier_batches', data);
    } catch (e: any) {
      if (!isSilent) toast.error(e.message || 'Unable to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocations = async () => {
    try {
      const res = await fetch('/api/allocations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const approved = data.filter((a: any) => a.status === 'APPROVED' || a.status === 'EXECUTING');
        setAllocations(approved);
        setCachedData('supplier_allocations', approved);
      }
    } catch (e) {
      console.error('Failed to fetch allocations');
    }
  };

  useEffect(() => {
    fetchBatches(batches.length > 0);
    fetchAllocations();

    const unsubscribe = subscribeToCacheInvalidation(() => {
      fetchBatches(true);
      fetchAllocations();
    });
    const interval = setInterval(() => {
      fetchBatches(true);
      fetchAllocations();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleCreateAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      setSubmitting(false);
      return;
    }
    if (chainId !== EXPECTED_CHAIN_ID) {
      toast.error(`Please switch to chain ID ${EXPECTED_CHAIN_ID}`);
      setSubmitting(false);
      return;
    }
    if (!signer) {
      setSubmitting(false);
      return;
    }

    try {
      // 1. Create draft on backend
      const res = await fetch('/api/resources', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBatch)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create resource batch draft');
      }

      const { batch, blockchainPayload } = await res.json();

      // 2. Propose on-chain
      setPendingTx(prev => ({ ...prev, [batch.id]: 'Waiting for wallet approval...' }));
      
      const contract = new ethers.Contract(RESOURCE_PROVENANCE_ADDRESS, RESOURCE_PROVENANCE_ABI, signer);
      
      const tx = await contract.registerBatch(
        blockchainPayload.batchId,
        blockchainPayload.campaignId,
        blockchainPayload.metadataHash,
        address
      );

      setPendingTx(prev => ({ ...prev, [batch.id]: 'Transaction pending on blockchain...' }));
      setTxHashes(prev => ({ ...prev, [batch.id]: tx.hash }));

      await tx.wait();
      setPendingTx(prev => ({ ...prev, [batch.id]: 'Registered! Indexer will update status shortly.' }));
      toast.success("Batch registered on-chain!");

      // Refresh data
      invalidateCache();
      setTimeout(() => fetchBatches(true), 1500);
      setNewBatch({ allocationId: '', name: '', totalQuantity: 100, unit: 'kits' });
    } catch (e: any) {
      toast.error(e.reason || e.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransit = async (batchId: string) => {
    try {
      const res = await fetch(`/api/resources/${batchId}/transit`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success("Status updated to In Transit");
        invalidateCache();
        fetchBatches(true);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to update status');
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN - Deliveries Table */}
      <div className="lg:col-span-2 space-y-6">
        <Card noPadding>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
            <h3 className="text-base sm:text-lg font-bold text-forest">My Resource Deliveries</h3>
            <span className="text-xs sm:text-sm font-medium text-forest/60">View All</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Resource Details</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Quantity</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">On-Chain Status</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {loading ? (
                  <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading batches...</td></tr>
                ) : batches.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">No resource batches created yet.</td></tr>
                ) : (
                  batches.map(b => (
                    <tr key={b.id} className="hover:bg-sand/30 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-forest">{b.name}</p>
                        <p className="text-xs text-forest/50 font-mono mt-1">BATCH-{b.id.substring(0,6).toUpperCase()}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-forest font-medium whitespace-nowrap">
                        {b.totalQuantity} {b.unit}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <Badge variant={
                            b.status === 'REGISTERED' ? 'neutral' : 
                            b.status === 'IN_TRANSIT' ? 'warning' :
                            b.status === 'DELIVERED_TO_WAREHOUSE' ? 'success' : 'low'
                          }>
                            {b.status.replace(/_/g, ' ')}
                          </Badge>
                          {pendingTx[b.id] && (
                            <p className="text-[10px] text-terracotta animate-pulse">{pendingTx[b.id]}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right whitespace-nowrap">
                        {b.status === 'REGISTERED' ? (
                          <Button variant="primary" onClick={() => handleTransit(b.id)} className="text-xs px-3 py-1">
                            Ship to Warehouse
                          </Button>
                        ) : (
                          <span className="text-xs text-forest/40">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN - Form */}
      <div>
        <Card className="sticky top-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center text-forest text-lg">📦</div>
            <h3 className="text-lg font-bold text-forest">Register New Batch</h3>
          </div>
          
          <form onSubmit={handleCreateAndRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Approved Allocation *</label>
              <select
                required
                value={newBatch.allocationId}
                onChange={e => setNewBatch({...newBatch, allocationId: e.target.value})}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
              >
                <option value="">Select an allocation...</option>
                {allocations.map(a => (
                  <option key={a.id} value={a.id}>{a.campaign.name} - {formatINR(a.approvedAmount)}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Resource Name *</label>
              <input 
                type="text" 
                required
                value={newBatch.name}
                onChange={e => setNewBatch({...newBatch, name: e.target.value})}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                placeholder="e.g. Blankets, First Aid Kits"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Quantity *</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={newBatch.totalQuantity}
                  onChange={e => setNewBatch({...newBatch, totalQuantity: Number(e.target.value)})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Unit *</label>
                <select
                  required
                  value={newBatch.unit}
                  onChange={e => setNewBatch({...newBatch, unit: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                >
                  <option value="kits">Kits</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="liters">Liters</option>
                  <option value="boxes">Boxes</option>
                </select>
              </div>
            </div>
            
            <div className="pt-2">
              {!isConnected ? (
                <Button type="button" variant="outline" fullWidth onClick={connectWallet} className="py-3 bg-white border-gold text-gold">
                  Connect Wallet to Register
                </Button>
              ) : (
                <Button type="submit" variant="primary" fullWidth className="py-3 shadow-sm" disabled={submitting}>
                  Create & Register On-Chain
                </Button>
              )}
            </div>
            
            <div className="p-3 bg-forest/5 rounded-xl text-xs text-forest/70 text-center font-medium">
              Blockchain gas fees are required to register the provenance of these resources.
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
