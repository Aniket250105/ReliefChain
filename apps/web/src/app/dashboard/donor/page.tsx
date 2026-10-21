'use client';
import { useState, useEffect } from 'react';
import { formatINR, INDIA_CURRENCY_SYMBOL } from '@reliefchain/shared-types';
import { useWallet } from '@/lib/WalletContext';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache, subscribeToCacheInvalidation } from '../../../lib/api-cache';

const DONATION_CONTRACT_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const EXPECTED_CHAIN_ID = 31337;
const DONATION_ABI = ["function donate(bytes32 campaignId) external payable"];

export default function DonorDashboard() {
  const cachedCampaigns = getCachedData<any[]>('active_campaigns');
  const cachedMyDonations = getCachedData<any[]>('my_donations');
  const [campaigns, setCampaigns] = useState<any[]>(() => cachedCampaigns || []);
  const [loading, setLoading] = useState(() => !cachedCampaigns || cachedCampaigns.length === 0);
  const [sessionDonations, setSessionDonations] = useState<any[]>(() => cachedMyDonations || []);
  const [amount, setAmount] = useState(100);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [pendingTx, setPendingTx] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const { isConnected, address, connectWallet, switchNetwork, chainId, signer } = useWallet();

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((c: any) => c.status === 'ACTIVE' || c.status === 'Active');
        setCachedData('active_campaigns', active);
        setCampaigns(active);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyDonations = async () => {
    try {
      const res = await fetch('/api/donations/my-donations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            amount: d.amount,
            txHash: d.blockchainTxHash,
            status: d.status,
            impact: d.campaign ? `Funding ${d.campaign.name}` : 'Disaster Relief Fund'
          }));
          setCachedData('my_donations', mapped);
          setSessionDonations(mapped);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!isCacheFresh('active_campaigns', 3000)) fetchCampaigns();
    if (!isCacheFresh('my_donations', 3000)) fetchMyDonations();

    const unsubscribe = subscribeToCacheInvalidation(() => {
      fetchCampaigns();
      fetchMyDonations();
    });
    const interval = setInterval(() => {
      fetchCampaigns();
      fetchMyDonations();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!activeSigner || !selectedCampaignId) return;

    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!campaign || !campaign.blockchainId) {
      toast.error("Campaign not ready for donations");
      return;
    }

    try {
      setPendingTx(true);
      setStatusMsg('Waiting for wallet approval...');
      const contract = new ethers.Contract(DONATION_CONTRACT_ADDRESS, DONATION_ABI, signer);
      
      const amountWei = ethers.parseUnits(amount.toString(), 18);
      const tx = await contract.donate(campaign.blockchainId, { value: amountWei });
      
      setStatusMsg(`Transaction pending... (${tx.hash.substring(0,10)}...)`);
      await tx.wait(1);
      
      setStatusMsg('Donation confirmed!');
      toast.success("Donation successful via Web3!");
      
      const newDonation = {
        id: 'don-' + Math.random().toString(36).substr(2, 5),
        amount: amount,
        txHash: tx.hash,
        status: 'CONFIRMED',
        impact: `Funding ${campaign.name}`
      };
      setSessionDonations(prev => [newDonation, ...prev]);

      // Refresh campaigns and donations from backend immediately
      invalidateCache();
      await fetchCampaigns();
      await fetchMyDonations();
      
      setTimeout(() => {
        setPendingTx(false);
        setStatusMsg('');
        setAmount(100);
        setSelectedCampaignId('');
      }, 3000);
    } catch (e: any) {
      toast.error(e.message || 'Transaction failed');
      setPendingTx(false);
      setStatusMsg('');
    }
  };

  const handleWeb2Donate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId) return;

    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!campaign) {
      toast.error("Campaign not ready for donations");
      return;
    }

    try {
      setPendingTx(true);
      setStatusMsg('Initiating secure payment gateway...');
      
      const orderRes = await fetch('/api/donations/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, campaignId: campaign.id })
      });
      
      const order = await orderRes.json();
      
      if (!orderRes.ok) {
        throw new Error(order.message || 'Failed to create order');
      }

      if (order.isMock) {
        setStatusMsg('Payment processed successfully in Sandbox mode. Verifying...');
        const verifyRes = await fetch('/api/donations/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: order.orderId,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: 'mock_signature',
            amount,
            campaignId: campaign.id,
            isMock: order.isMock
          })
        });

        const verification = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verification.message || 'Failed to verify payment');
        }

        setStatusMsg('Donation confirmed!');
        toast.success("Donation successful via UPI/Card!");
        
        const newDonation = {
          id: 'don-' + Math.random().toString(36).substr(2, 5),
          amount: amount,
          txHash: verification.donation?.blockchainTxHash || `pay_mock_${Date.now()}`,
          status: 'CONFIRMED',
          impact: `Funding ${campaign.name} (UPI/Card)`
        };
        setSessionDonations(prev => [newDonation, ...prev]);

        // Refresh campaigns and donations from backend immediately
        invalidateCache();
        await fetchCampaigns();
        await fetchMyDonations();
        
        setTimeout(() => {
          setPendingTx(false);
          setStatusMsg('');
          setAmount(100);
          setSelectedCampaignId('');
        }, 3000);
      } else {
        toast.error("Real Razorpay flow not initialized in this demo");
        setPendingTx(false);
        setStatusMsg('');
      }
    } catch (e: any) {
      toast.error(e.message || 'Payment failed');
      setPendingTx(false);
      setStatusMsg('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN - Campaigns to fund */}
      <div className="lg:col-span-2 space-y-6">
        <Card noPadding>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
            <h3 className="text-base sm:text-lg font-bold text-forest">Active Campaigns</h3>
            <span className="text-xs sm:text-sm font-medium text-forest/60">View All</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Campaign</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Raised / Goal</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Impact Estimate</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {loading ? (
                  <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading campaigns...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">No active campaigns seeking funds.</td></tr>
                ) : (
                  campaigns.map(c => {
                    const fundsRaised = Number(c.fundsRaised ?? c.raisedAmount ?? 0);
                    const target = Number(c.targetAmount ?? 100000);
                    const percent = target > 0 ? Math.min(100, Math.round((fundsRaised / target) * 100)) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-sand/30 transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 max-w-xs min-w-[180px]">
                          <p className="font-medium text-forest leading-snug">{c.name}</p>
                          <p className="text-xs text-forest/60 mt-1">{c.ngo?.name || 'Verified NGO'}</p>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                          <p className="text-forest font-medium">{formatINR(fundsRaised)} <span className="text-forest/50 text-xs font-normal">/ {formatINR(target)}</span></p>
                          <div className="w-32 h-1.5 bg-sand rounded-full mt-2 overflow-hidden border border-forest/10">
                            <div className="h-full bg-gold rounded-full" style={{ width: `${percent}%` }}></div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                          <p className="text-xs text-forest/70">{c.resourcesDistributed || 0} Relief Units Delivered</p>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right whitespace-nowrap">
                          {selectedCampaignId === c.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-forest text-sand shadow-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Selected
                              </span>
                              <Button 
                                variant="outline" 
                                className="px-2.5 py-1.5 text-xs text-terracotta border-terracotta/30 bg-white hover:bg-terracotta hover:text-white hover:border-terracotta transition-colors shadow-xs"
                                onClick={() => setSelectedCampaignId('')}
                                title="Unselect this campaign"
                              >
                                Unselect
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              className="px-3 py-1.5 text-xs bg-white hover:bg-forest hover:text-sand transition-colors"
                              onClick={() => setSelectedCampaignId(c.id)}
                            >
                              Select
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-forest">My Recent Donations</h3>
            <span className="text-sm font-medium text-forest/60">View Receipts</span>
          </div>
          {sessionDonations.length === 0 ? (
            <p className="text-sm text-forest/50 text-center py-4">You haven't made any donations yet in this session.</p>
          ) : (
            <div className="space-y-4">
              {sessionDonations.map(don => (
                <div key={don.id} className="flex justify-between items-center p-4 border border-forest/10 rounded-xl bg-sand/10">
                  <div>
                    <p className="font-semibold text-forest">{formatINR(don.amount)}</p>
                    <p className="text-xs text-forest/60 mt-1">{don.impact}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="success">Confirmed</Badge>
                    <p className="text-[10px] text-forest/40 mt-2 font-mono" title={don.txHash}>
                      TX: {don.txHash ? don.txHash.substring(0, 10) + '...' : 'Processing...'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* RIGHT COLUMN - Form */}
      <div>
        <Card className="sticky top-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-yellow-700 text-lg">₹</div>
            <h3 className="text-lg font-bold text-forest">Make a Donation</h3>
          </div>
          
          <form className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-semibold text-forest">Selected Campaign</label>
                {selectedCampaignId && (
                  <button 
                    type="button" 
                    onClick={() => setSelectedCampaignId('')}
                    className="text-xs text-terracotta hover:underline font-semibold flex items-center gap-1 transition-colors"
                    title="Unselect campaign"
                  >
                    ✕ Unselect
                  </button>
                )}
              </div>
              {selectedCampaignId ? (
                <div className="bg-sand/30 p-3 rounded-xl border border-forest/20 text-forest text-sm font-medium flex justify-between items-center group">
                  <span className="truncate pr-2">{campaigns.find(c => c.id === selectedCampaignId)?.name || 'Unknown'}</span>
                  <button 
                    type="button"
                    onClick={() => setSelectedCampaignId('')}
                    className="text-forest/40 hover:text-terracotta hover:bg-terracotta/10 px-1.5 py-0.5 rounded transition-colors text-xs font-bold shrink-0"
                    title="Unselect campaign"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="bg-sand/30 p-3 rounded-xl border border-forest/20 border-dashed text-forest/50 text-sm italic">
                  Please select a campaign from the table.
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-forest mb-3">Amount ({INDIA_CURRENCY_SYMBOL})</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[500, 1000, 5000].map(val => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`py-2 rounded-lg text-sm font-bold border transition-all ${
                      amount === val 
                        ? 'bg-forest text-sand border-forest'
                        : 'bg-white text-forest/70 border-forest/20 hover:border-forest/50'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <input 
                type="number" 
                required
                min="1"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-3 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all text-lg font-semibold"
                placeholder="Custom amount"
              />
            </div>
            
            <div className="pt-2 space-y-3">
              <Button 
                type="button" 
                variant="primary" 
                fullWidth 
                className="py-3 text-base shadow-sm"
                onClick={handleWeb2Donate}
                disabled={!selectedCampaignId || pendingTx}
              >
                Donate via UPI / Card
              </Button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-forest/10"></div>
                <span className="flex-shrink-0 mx-4 text-forest/40 text-xs font-semibold uppercase">Or pay with Crypto</span>
                <div className="flex-grow border-t border-forest/10"></div>
              </div>

              <div className="space-y-3">
                {isConnected ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-forest/70 bg-sand/40 px-3 py-2 rounded-lg border border-forest/10">
                      <span>Connected Wallet:</span>
                      <span className="font-mono font-bold text-forest truncate max-w-[150px]">
                        {address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Connected'}
                      </span>
                    </div>
                    <Button 
                      type="button" 
                      variant="accent" 
                      fullWidth 
                      onClick={handleDonate}
                      disabled={!selectedCampaignId || pendingTx}
                      className="py-3 shadow-sm font-semibold"
                    >
                      Donate Web3 Funds
                    </Button>
                  </div>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    fullWidth 
                    onClick={connectWallet}
                    className="py-2.5 text-xs font-semibold bg-white hover:bg-sand/30"
                  >
                    Connect Wallet to Pay with Crypto
                  </Button>
                )}
              </div>
            </div>

            {statusMsg && (
              <div className="p-3 bg-forest/5 rounded-lg border border-forest/10 text-xs text-forest font-medium text-center animate-pulse">
                {statusMsg}
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
