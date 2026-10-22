'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { INDIAN_STATES_UTS } from '@reliefchain/shared-types';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import toast from 'react-hot-toast';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache, subscribeToCacheInvalidation } from '../../../lib/api-cache';

export default function AuthorityDashboard() {
  const cachedDisasters = getCachedData<any[]>('authority_disasters');
  const [disasters, setDisasters] = useState<any[]>(() => cachedDisasters || []);
  const [loading, setLoading] = useState(() => !cachedDisasters || cachedDisasters.length === 0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [newDisaster, setNewDisaster] = useState({ 
    name: '', 
    description: '', 
    severity: 'HIGH',
    state: (INDIAN_STATES_UTS[0] || 'Karnataka') as string,
    district: '',
    city: '',
    pinCode: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Administrative / Edit State
  const [editingDisaster, setEditingDisaster] = useState<any | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Administrative / Delete State
  const [disasterToDelete, setDisasterToDelete] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchDisasters = async () => {
    try {
      const res = await fetch('/api/disasters', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCachedData('authority_disasters', data);
        setDisasters(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthChecked(true);
    }

    if (!isCacheFresh('authority_disasters', 3000)) {
      fetchDisasters();
    }

    const unsubscribe = subscribeToCacheInvalidation(() => {
      fetchDisasters();
    });
    const interval = setInterval(fetchDisasters, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const isSystemAdmin = currentUser?.role === 'SYSTEM_ADMIN';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/disasters', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newDisaster.name, 
          description: newDisaster.description || newDisaster.name,
          severity: newDisaster.severity,
          state: newDisaster.state,
          district: newDisaster.district,
          city: newDisaster.city,
          pinCode: newDisaster.pinCode
        })
      });
      if (res.ok) {
        invalidateCache();
        await fetchDisasters();
        setNewDisaster({ 
          name: '', 
          description: '', 
          severity: 'HIGH',
          state: (INDIAN_STATES_UTS[0] || 'Karnataka') as string,
          district: '',
          city: '',
          pinCode: ''
        });
        toast.success("Disaster declared successfully.");
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.message || errData?.error || 'Failed to create disaster');
      }
    } catch (e) {
      toast.error('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(`/api/disasters/${id}/verify`, { 
        method: 'PATCH',
        credentials: 'include'
      });
      if (res.ok) {
        invalidateCache();
        await fetchDisasters();
        toast.success("Disaster verified and activated.");
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.message || errData?.error || 'Failed to verify disaster.');
      }
    } catch (e) {
      toast.error('Failed to verify disaster.');
    }
  };

  const handleStartEdit = (disaster: any) => {
    setEditingDisaster({
      id: disaster.id,
      name: disaster.name || '',
      description: disaster.description || '',
      severity: disaster.severity || 'HIGH',
      state: disaster.state || (INDIAN_STATES_UTS[0] || 'Karnataka'),
      district: disaster.district || '',
      city: disaster.city || '',
      pinCode: disaster.pinCode || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDisaster) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/disasters/${editingDisaster.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingDisaster.name,
          description: editingDisaster.description || editingDisaster.name,
          severity: editingDisaster.severity,
          state: editingDisaster.state,
          district: editingDisaster.district,
          city: editingDisaster.city,
          pinCode: editingDisaster.pinCode
        })
      });
      if (res.ok) {
        invalidateCache('authority_disasters');
        invalidateCache('kpi_');
        toast.success("Disaster details corrected successfully.");
        setEditingDisaster(null);
        await fetchDisasters();
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.message || errData?.error || 'Failed to update disaster');
      }
    } catch (e) {
      toast.error('Network error occurred while saving.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!disasterToDelete) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/disasters/${disasterToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        invalidateCache('authority_disasters');
        invalidateCache('kpi_');
        toast.success(`Disaster "${disasterToDelete.name}" deleted.`);
        setDisasterToDelete(null);
        await fetchDisasters();
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.message || errData?.error || 'Failed to delete disaster');
      }
    } catch (e) {
      toast.error('Network error occurred while deleting.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN - Disasters Table & Audit Log */}
      <div className="lg:col-span-2 space-y-6">
        <Card noPadding>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-forest">
                {isSystemAdmin ? 'Declared Disasters (System View)' : 'Declared Disasters'}
              </h3>
              <p className="text-xs text-forest/60 mt-0.5">
                {isSystemAdmin 
                  ? 'Real-time ledger of nationwide disaster records • Administrative delete enabled' 
                  : 'Manage and verify disaster zones within jurisdiction • Edit mistake correction enabled'}
              </p>
            </div>
            <span className="text-xs sm:text-sm font-medium text-forest/60">
              {disasters.length} {disasters.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap">ID</th>
                  <th className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap">Disaster Name</th>
                  <th className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap">Location</th>
                  <th className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap">Severity</th>
                  <th className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-3 sm:px-4 py-2.5 font-semibold text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {loading ? (
                  <tr><td colSpan={6} className="px-3 sm:px-4 py-6 text-center text-forest/50">Loading disasters...</td></tr>
                ) : disasters.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 sm:px-4 py-6 text-center text-forest/50">No declared disasters found.</td></tr>
                ) : (
                  disasters.map(d => (
                    <tr key={d.id} className="hover:bg-sand/30 transition-colors">
                      <td className="px-3 sm:px-4 py-2.5 font-mono text-xs text-forest/70 uppercase whitespace-nowrap">DIS-{d.id.substring(0,3)}</td>
                      <td className="px-3 sm:px-4 py-2.5 font-medium text-forest whitespace-nowrap">{d.name}</td>
                      <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-forest font-medium">{d.state}</span>
                          <span className="text-xs text-forest/60">{d.city || d.district || 'All Districts'}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                        <Badge variant={d.severity.toLowerCase() as any}>{d.severity}</Badge>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                        <Badge variant={d.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {d.status === 'ACTIVE' ? 'Ongoing' : d.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Verification status / action */}
                          {d.status === 'PENDING_VERIFICATION' ? (
                            isSystemAdmin ? (
                              <Badge variant="warning">Pending</Badge>
                            ) : (
                              <Button variant="accent" onClick={() => handleVerify(d.id)} className="px-2.5 py-1 text-xs">
                                Verify
                              </Button>
                            )
                          ) : (
                            <Badge variant="success">Verified</Badge>
                          )}

                          {/* Edit Feature: Available for Government Authority and System Admin to fix mistaken declarations */}
                          <button
                            onClick={() => handleStartEdit(d)}
                            className="p-1.5 text-xs font-semibold rounded-lg text-forest bg-forest/5 hover:bg-forest/15 border border-forest/20 transition-all flex items-center justify-center cursor-pointer"
                            title="Edit disaster details"
                            aria-label="Edit disaster details"
                          >
                            <span>✏️</span>
                          </button>

                          {/* Delete Feature: Administrative feature for System Admin to remove mistaken declarations */}
                          {isSystemAdmin && (
                            <button
                              onClick={() => setDisasterToDelete(d)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-terracotta bg-terracotta/10 hover:bg-terracotta hover:text-white border border-terracotta/20 transition-all flex items-center gap-1 cursor-pointer"
                              title="Permanently remove disaster declaration done by mistake"
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-forest">Recent Activity / Audit Log</h3>
              <p className="text-xs text-forest/60 mt-0.5">Immutable audit trail entries recorded on-chain</p>
            </div>
            <Link href="/public/dashboard" className="text-xs sm:text-sm font-medium text-forest/60 hover:text-forest transition-colors">
              Public Ledger →
            </Link>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="py-3 font-semibold whitespace-nowrap">Event</th>
                  <th className="py-3 font-semibold whitespace-nowrap">Actor</th>
                  <th className="py-3 font-semibold whitespace-nowrap">Details</th>
                  <th className="py-3 font-semibold text-right whitespace-nowrap">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                <tr className="text-forest">
                  <td className="py-3 font-medium whitespace-nowrap flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Disaster Verified
                  </td>
                  <td className="py-3 text-forest/70 whitespace-nowrap">authority@gov.local</td>
                  <td className="py-3 whitespace-nowrap">Karnataka Flood Relief — Demo</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <span className="font-mono text-xs text-forest/60 bg-forest/5 px-2 py-0.5 rounded">SHA256</span>
                  </td>
                </tr>
                <tr className="text-forest">
                  <td className="py-3 font-medium whitespace-nowrap flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gold"></span>
                    Disaster Declared
                  </td>
                  <td className="py-3 text-forest/70 whitespace-nowrap">authority@gov.local</td>
                  <td className="py-3 whitespace-nowrap">Odisha / Tsunami Monitor</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <span className="font-mono text-xs text-forest/60 bg-forest/5 px-2 py-0.5 rounded">SHA256</span>
                  </td>
                </tr>
                <tr className="text-forest">
                  <td className="py-3 font-medium whitespace-nowrap flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-forest"></span>
                    Campaign Created
                  </td>
                  <td className="py-3 text-forest/70 whitespace-nowrap">ngo@ngo.local</td>
                  <td className="py-3 whitespace-nowrap">Emergency Medical Supplies</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <span className="font-mono text-xs text-forest/60 bg-forest/5 px-2 py-0.5 rounded">SHA256</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN - Conditional Form / Admin Panel */}
      <div>
        {!authChecked ? (
          <div className="animate-pulse bg-white/40 h-96 rounded-2xl"></div>
        ) : isSystemAdmin ? (
          /* SYSTEM ADMIN VIEW - Platform Oversight & Administrative Controls (NO Declare Disaster Form) */
          <Card className="sticky top-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-forest text-sand flex items-center justify-center font-bold text-lg shadow-sm">
                🛡️
              </div>
              <div>
                <h3 className="text-lg font-bold text-forest">System Administration</h3>
                <p className="text-xs text-forest/60 font-medium">Platform Governance & Security</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Administrative Deletion Feature Note */}
              <div className="p-3.5 bg-terracotta/10 border border-terracotta/20 rounded-xl">
                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5">🗑️</span>
                  <div>
                    <h4 className="text-xs font-bold text-terracotta uppercase tracking-wider">Administrative Purge</h4>
                    <p className="text-xs text-forest/75 mt-1 leading-relaxed">
                      System Admins can delete mistaken disaster declarations directly via the <strong>Delete</strong> button in the table. Deletion will cascade clean un-funded records and log an immutable audit entry.
                    </p>
                  </div>
                </div>
              </div>

              {/* RBAC Notice Card */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5">ℹ️</span>
                  <div>
                    <h4 className="text-xs font-bold text-forest uppercase tracking-wider">Disaster Declarations</h4>
                    <p className="text-xs text-forest/75 mt-1 leading-relaxed">
                      Disaster declarations and emergency lifecycle activations are legally restricted to designated <strong>Government Authorities</strong> (NDMA / SDMA).
                    </p>
                  </div>
                </div>
              </div>

              {/* Microservices Health */}
              <div className="border border-forest/10 rounded-xl p-4 bg-white/50 space-y-3">
                <h4 className="text-xs font-bold text-forest/60 uppercase tracking-wider">Subsystems Status</h4>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-forest font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    REST API & Database
                  </span>
                  <Badge variant="success">Operational</Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-forest font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    EVM Chain (31337)
                  </span>
                  <Badge variant="success">Synced</Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-forest font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    AI Sentinel Engine
                  </span>
                  <Badge variant="success">Active</Badge>
                </div>
              </div>

              {/* Quick Administrative Shortcuts */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-forest/60 uppercase tracking-wider mb-2">Administrative Navigation</h4>
                
                <Link 
                  href="/ai-alerts" 
                  className="flex items-center justify-between p-3 rounded-xl bg-forest/5 hover:bg-forest/10 text-forest text-xs font-semibold transition-all border border-forest/10 group"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🔍</span> AI Sentinel & Fraud Alerts
                  </span>
                  <span className="text-forest/40 group-hover:text-forest transition-colors font-bold">→</span>
                </Link>

                <Link 
                  href="/public/dashboard" 
                  className="flex items-center justify-between p-3 rounded-xl bg-forest/5 hover:bg-forest/10 text-forest text-xs font-semibold transition-all border border-forest/10 group"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">📊</span> Public Transparency Ledger
                  </span>
                  <span className="text-forest/40 group-hover:text-forest transition-colors font-bold">→</span>
                </Link>

                <Link 
                  href="/verify" 
                  className="flex items-center justify-between p-3 rounded-xl bg-forest/5 hover:bg-forest/10 text-forest text-xs font-semibold transition-all border border-forest/10 group"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">📱</span> QR Physical Audit Gateway
                  </span>
                  <span className="text-forest/40 group-hover:text-forest transition-colors font-bold">→</span>
                </Link>
              </div>

              <Button 
                variant="outline" 
                fullWidth 
                onClick={fetchDisasters} 
                className="mt-2 py-2.5 text-xs font-semibold bg-white hover:bg-sand/40"
              >
                🔄 Refresh Disasters Data
              </Button>
            </div>
          </Card>
        ) : (
          /* GOVERNMENT AUTHORITY VIEW - Declare New Disaster Form */
          <Card className="sticky top-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center text-forest text-lg">📝</div>
              <div>
                <h3 className="text-lg font-bold text-forest">Declare New Disaster</h3>
                <p className="text-xs text-forest/60 font-medium">State/National Authority</p>
              </div>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Disaster Name *</label>
                <input 
                  type="text" 
                  required
                  value={newDisaster.name}
                  onChange={e => setNewDisaster({...newDisaster, name: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  placeholder="e.g. Cyclone Relief"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">State / Union Territory *</label>
                <select
                  required
                  value={newDisaster.state}
                  onChange={e => setNewDisaster({...newDisaster, state: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                >
                  {INDIAN_STATES_UTS.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">District *</label>
                <input 
                  type="text" 
                  required
                  value={newDisaster.district}
                  onChange={e => setNewDisaster({...newDisaster, district: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  placeholder="Select District"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-forest mb-1.5">City / Place *</label>
                  <input 
                    type="text" 
                    required
                    value={newDisaster.city}
                    onChange={e => setNewDisaster({...newDisaster, city: e.target.value})}
                    className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                    placeholder="e.g. Bengaluru"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-forest mb-1.5">PIN Code *</label>
                  <input 
                    type="text" 
                    required
                    pattern="[0-9]{6}"
                    title="6-digit Indian PIN Code"
                    value={newDisaster.pinCode}
                    onChange={e => setNewDisaster({...newDisaster, pinCode: e.target.value})}
                    className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                    placeholder="e.g. 560001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-forest mb-2">Severity *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(sev => (
                    <button
                      type="button"
                      key={sev}
                      onClick={() => setNewDisaster({...newDisaster, severity: sev})}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all ${
                        newDisaster.severity === sev 
                          ? sev === 'CRITICAL' || sev === 'HIGH' ? 'bg-terracotta text-white border-terracotta' : 'bg-gold text-forest border-gold'
                          : 'bg-white text-forest/60 border-forest/20 hover:border-forest/50'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
              
              <Button type="submit" variant="primary" fullWidth className="mt-4 py-3 text-base shadow-sm" disabled={submitting}>
                {submitting ? 'Declaring...' : '+ Declare Disaster'}
              </Button>

              <p className="text-xs text-forest/50 text-center mt-2">
                Mistake in declaration? Click <strong>Edit</strong> on any record in the table.
              </p>
            </form>
          </Card>
        )}
      </div>

      {/* MODAL 1: EDIT DISASTER MODAL (For correcting mistakes in declaration) */}
      {editingDisaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-forest/15 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-forest/10">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✏️</span>
                <div>
                  <h3 className="text-lg font-bold text-forest">Edit Disaster Declaration</h3>
                  <p className="text-xs text-forest/60">Correct mistakes made during declaration</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingDisaster(null)}
                className="w-8 h-8 rounded-full bg-forest/5 hover:bg-forest/10 text-forest/70 hover:text-forest flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1">
                  Disaster Name *
                </label>
                <input 
                  type="text" 
                  required
                  value={editingDisaster.name}
                  onChange={e => setEditingDisaster({...editingDisaster, name: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  placeholder="e.g. Karnataka Flood Relief"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1">
                  State / Union Territory *
                </label>
                <select
                  required
                  value={editingDisaster.state}
                  onChange={e => setEditingDisaster({...editingDisaster, state: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                >
                  {INDIAN_STATES_UTS.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1">
                  District *
                </label>
                <input 
                  type="text" 
                  required
                  value={editingDisaster.district}
                  onChange={e => setEditingDisaster({...editingDisaster, district: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  placeholder="e.g. Bangalore Urban"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1">
                    City / Place *
                  </label>
                  <input 
                    type="text" 
                    required
                    value={editingDisaster.city}
                    onChange={e => setEditingDisaster({...editingDisaster, city: e.target.value})}
                    className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                    placeholder="e.g. Bengaluru"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1">
                    PIN Code *
                  </label>
                  <input 
                    type="text" 
                    required
                    pattern="[0-9]{6}"
                    title="6-digit Indian PIN Code"
                    value={editingDisaster.pinCode}
                    onChange={e => setEditingDisaster({...editingDisaster, pinCode: e.target.value})}
                    className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                    placeholder="e.g. 560001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1.5">
                  Severity Level *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(sev => (
                    <button
                      type="button"
                      key={sev}
                      onClick={() => setEditingDisaster({...editingDisaster, severity: sev})}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all ${
                        editingDisaster.severity === sev 
                          ? sev === 'CRITICAL' || sev === 'HIGH' ? 'bg-terracotta text-white border-terracotta' : 'bg-gold text-forest border-gold'
                          : 'bg-white text-forest/60 border-forest/20 hover:border-forest/50'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest uppercase tracking-wider mb-1">
                  Description / Situation Details
                </label>
                <textarea 
                  rows={2}
                  value={editingDisaster.description}
                  onChange={e => setEditingDisaster({...editingDisaster, description: e.target.value})}
                  className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2 text-forest text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  placeholder="Details of the affected zone and relief requirements..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingDisaster(null)}
                  className="flex-1 py-2.5 text-sm bg-white"
                  disabled={editSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 py-2.5 text-sm shadow-sm"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : '✓ Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE DISASTER CONFIRMATION MODAL (Administrative purge for mistaken declarations) */}
      {disasterToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-forest/15 max-w-md w-full p-6 space-y-5 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-terracotta">
              <div className="w-12 h-12 rounded-full bg-terracotta/15 flex items-center justify-center text-2xl font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-forest">Delete Mistaken Disaster?</h3>
                <p className="text-xs text-forest/60">Administrative Purge Action</p>
              </div>
            </div>

            <div className="p-4 bg-terracotta/5 border border-terracotta/20 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-forest">
                Are you sure you want to permanently delete:
              </p>
              <div className="p-3 bg-white rounded-lg border border-forest/10 space-y-1">
                <div className="text-sm font-bold text-forest">{disasterToDelete.name}</div>
                <div className="text-xs text-forest/60">
                  {disasterToDelete.state} • {disasterToDelete.city || disasterToDelete.district || 'All Districts'}
                </div>
                <div className="text-xs font-mono text-forest/50">ID: DIS-{disasterToDelete.id.substring(0,8)}</div>
              </div>
              <p className="text-xs text-terracotta/90 leading-relaxed font-medium">
                • Use this only if the declaration was made by mistake.<br />
                • This administrative deletion is recorded in the immutable audit log.
              </p>
            </div>

            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDisasterToDelete(null)}
                className="flex-1 py-2.5 text-sm bg-white"
                disabled={deleteSubmitting}
              >
                Cancel
              </Button>
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-terracotta hover:bg-terracotta/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {deleteSubmitting ? 'Deleting...' : '🗑️ Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
