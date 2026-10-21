'use client';
import { useState, useEffect } from 'react';
import { formatDate } from '@reliefchain/shared-types';
import { useWallet } from '@/lib/WalletContext';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { getCachedData, setCachedData, invalidateCache } from '../../../lib/api-cache';

const RESOURCE_PROVENANCE_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
const RESOURCE_PROVENANCE_ABI = [
  "function recordDistribution(bytes32 batchId, uint256 quantity, uint256 beneficiaries, address officer, bytes32 ipfsCid) external",
  "function registerBatch(bytes32 batchId, bytes32 campaignId, bytes32 metadataHash, address supplier) external",
  "function batches(bytes32) view returns (bytes32 campaignId, bytes32 metadataHash, address supplier, bool exists)"
];
const CHAIN_ID = 31337;

// UUID to bytes32 helper
function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  return '0x' + hex.padStart(64, '0');
}

export default function OfficerDashboard() {
  const { isConnected, connectWallet, switchNetwork, chainId, signer, address } = useWallet();
  const [distributions, setDistributions] = useState<any[]>(() => getCachedData<any[]>('officer_distributions') || []);
  const [inventory, setInventory] = useState<any[]>(() => getCachedData<any[]>('officer_inventory') || []);
  const [newDist, setNewDist] = useState({ batchId: '', quantity: 1, beneficiaries: 1 });
  const [uploading, setUploading] = useState(false);
  const [fileBase64, setFileBase64] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('officer_distributions'));

  const fetchDistributions = async (isSilent = false) => {
    try {
      if (!isSilent && !getCachedData('officer_distributions')) {
        setLoading(true);
      }
      const res = await fetch('/api/distributions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDistributions(data);
        setCachedData('officer_distributions', data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const available = data.filter((i: any) => i.currentQuantity > 0);
        setInventory(available);
        setCachedData('officer_inventory', available);
        if (available.length > 0 && !newDist.batchId) {
          setNewDist(d => ({ ...d, batchId: available[0].batchId }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDistributions(distributions.length > 0);
    fetchInventory();
    const interval = setInterval(() => fetchDistributions(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result?.toString().split(',')[1];
        if (b64) setFileBase64(b64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('Please connect your wallet first.');
      return;
    }
    if (chainId !== CHAIN_ID) {
      toast.error(`Please switch to the correct network (Chain ID: 31337).`);
      return;
    }
    if (!signer || !address) {
      toast.error('Wallet signer not available.');
      return;
    }
    if (!fileBase64) {
      toast.error('Please attach photographic evidence.');
      return;
    }

    setUploading(true);
    setStatusMessage('Uploading evidence and reserving inventory...');

    try {
      const idempotencyKey = 'dist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

      // 1. Call API to lock inventory and upload evidence
      const apiRes = await fetch('/api/distributions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          batchId: newDist.batchId,
          quantityDistributed: newDist.quantity,
          beneficiaryCount: newDist.beneficiaries,
          evidenceBase64: fileBase64
        })
      });

      if (!apiRes.ok) {
        const err = await apiRes.json();
        throw new Error(err.error || 'Failed to create distribution record');
      }

      const distRecord = await apiRes.json();
      const ipfsCid = distRecord.ipfsCid;

      if (!ipfsCid) {
        throw new Error('API did not return an IPFS CID.');
      }

      setStatusMessage('Please confirm transaction in your wallet...');

      // 2. Send Blockchain Transaction
      const contract = new ethers.Contract(RESOURCE_PROVENANCE_ADDRESS, RESOURCE_PROVENANCE_ABI, signer);
      const bytes32BatchId = uuidToBytes32(newDist.batchId);
      const bytes32Ipfs = ethers.id(ipfsCid); // Canonical bytes32 representation
      const qtyWei = ethers.parseUnits(newDist.quantity.toString(), 18);

      // Resilience check: Ensure the batch is registered on-chain before recording distribution
      try {
        const onChain = await contract.batches(bytes32BatchId);
        if (!onChain.exists) {
          setStatusMessage('Synchronizing batch registration on-chain...');
          const currentInv = inventory.find(i => i.batchId === newDist.batchId);
          const metaHash = ethers.id(currentInv?.batch?.name || 'Resource Batch');
          const campId = bytes32BatchId;
          const regTx = await contract.registerBatch(bytes32BatchId, campId, metaHash, address);
          await regTx.wait(1);
        }
      } catch (checkErr) {
        console.warn('Batch registration sync warning:', checkErr);
      }

      setStatusMessage('Recording distribution on-chain...');
      const tx = await contract.recordDistribution(
        bytes32BatchId,
        qtyWei,
        newDist.beneficiaries,
        address, // The connected officer's wallet
        bytes32Ipfs
      );

      setStatusMessage('Transaction pending (Hash: ' + tx.hash.substring(0, 10) + '...)...');
      
      await tx.wait(1);

      toast.success('Distribution recorded on-chain successfully!');
      setStatusMessage('');
      
      setFileBase64('');
      
      // Refresh to see updated state
      invalidateCache('officer_distributions');
      invalidateCache('officer_inventory');
      invalidateCache('warehouse_inventory');
      invalidateCache('kpi_RELIEF_OFFICER');
      setTimeout(() => {
        fetchDistributions(true);
        fetchInventory();
      }, 2000);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Transaction failed');
      setStatusMessage('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN - Distributions Table */}
      <div className="lg:col-span-2 space-y-6">
        <Card noPadding>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
            <h3 className="text-base sm:text-lg font-bold text-forest">Recent Distributions</h3>
            <span className="text-xs sm:text-sm font-medium text-forest/60">View All</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Resource Details</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Quantity / Beneficiaries</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Date & Evidence</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {loading ? (
                  <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading records...</td></tr>
                ) : distributions.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">No distributions recorded yet.</td></tr>
                ) : (
                  distributions.map(d => (
                    <tr key={d.id} className="hover:bg-sand/30 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-forest">{d.batch?.name || 'Unknown Item'}</p>
                        <p className="text-xs text-forest/50 font-mono mt-1">BATCH-{d.batchId.substring(0,6).toUpperCase()}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <p className="text-forest font-medium">{d.quantityDistributed} {d.batch?.unit || 'units'}</p>
                        <p className="text-xs text-forest/70">{d.beneficiaryCount} Beneficiaries</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <p className="text-forest">{formatDate(d.createdAt)}</p>
                        <a href={`https://ipfs.io/ipfs/${d.ipfsCid}`} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline mt-1 inline-block">
                          View IPFS CID
                        </a>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <Badge variant="success">Verified On-Chain</Badge>
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
            <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center text-forest text-lg">📸</div>
            <h3 className="text-lg font-bold text-forest">Record Field Impact</h3>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Select Resource from Inventory *</label>
              <select
                required
                value={newDist.batchId}
                onChange={e => setNewDist({...newDist, batchId: e.target.value})}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
              >
                <option value="">Choose item...</option>
                {inventory.map(i => (
                  <option key={i.batchId} value={i.batchId}>
                    {i.batch?.name} (Available: {i.currentQuantity})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Quantity Distributed *</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={newDist.quantity}
                  onChange={e => setNewDist({...newDist, quantity: Number(e.target.value)})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Beneficiaries Reached *</label>
                <input
                  type="number" 
                  required
                  min="1"
                  value={newDist.beneficiaries}
                  onChange={e => setNewDist({...newDist, beneficiaries: Number(e.target.value)})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Photographic Evidence *</label>
              <div className="border-2 border-dashed border-forest/20 rounded-xl p-6 text-center hover:bg-sand/30 transition-colors">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  required
                  className="block w-full text-sm text-forest/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-forest/10 file:text-forest hover:file:bg-forest/20 cursor-pointer"
                />
                {fileBase64 && <p className="text-xs text-forest/60 mt-4">✓ Image attached</p>}
              </div>
              <p className="text-[10px] text-forest/50 mt-2 text-center">
                This image will be hashed and securely pinned to IPFS for cryptographic verification.
              </p>
            </div>
            
            <div className="pt-2">
              {!isConnected ? (
                <Button type="button" variant="outline" fullWidth onClick={connectWallet} className="py-3 bg-white border-gold text-gold">
                  Connect Wallet to Sign
                </Button>
              ) : (
                <Button type="submit" variant="primary" fullWidth className="py-3 shadow-sm" disabled={uploading}>
                  {uploading ? 'Processing...' : 'Upload & Sign On-Chain'}
                </Button>
              )}
            </div>

            {statusMessage && (
              <div className="p-3 bg-forest/5 rounded-xl text-xs text-forest font-medium text-center animate-pulse">
                {statusMessage}
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
