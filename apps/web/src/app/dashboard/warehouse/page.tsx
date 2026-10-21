'use client';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { getCachedData, setCachedData, invalidateCache } from '../../../lib/api-cache';

export default function WarehouseDashboard() {
  const [inventory, setInventory] = useState<any[]>(() => getCachedData<any[]>('warehouse_inventory') || []);
  const [batches, setBatches] = useState<any[]>(() => getCachedData<any[]>('warehouse_batches') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('warehouse_inventory') && !getCachedData('warehouse_batches'));

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch inventory');
      const data = await res.json();
      setInventory(data);
      setCachedData('warehouse_inventory', data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/resources/warehouse', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch batches');
      const data = await res.json();
      setBatches(data);
      setCachedData('warehouse_batches', data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadAll = async (isInitial = false) => {
    if (isInitial && !getCachedData('warehouse_inventory') && !getCachedData('warehouse_batches')) {
      setLoading(true);
    }
    await Promise.all([fetchInventory(), fetchBatches()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll(true);
    const interval = setInterval(() => loadAll(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleReceive = async (batchId: string) => {
    try {
      const res = await fetch(`/api/resources/${batchId}/receive/warehouse`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to receive batch');
      }
      toast.success("Batch successfully received into inventory.");
      invalidateCache('warehouse_inventory');
      invalidateCache('warehouse_batches');
      invalidateCache('kpi_WAREHOUSE_OPERATOR');
      loadAll(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stock Levels */}
      <Card noPadding>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
          <h3 className="text-base sm:text-lg font-bold text-forest">Warehouse Stock Levels</h3>
          <span className="text-xs sm:text-sm font-medium text-forest/60">Inventory</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-forest/10 text-forest/60">
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Item Name</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Quantity Available</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Unit</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {loading && inventory.length === 0 ? (
                <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading inventory...</td></tr>
              ) : inventory.length === 0 ? (
                <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">No inventory records found.</td></tr>
              ) : (
                inventory.map(i => (
                  <tr key={i.id} className="hover:bg-sand/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3.5 text-forest font-bold whitespace-nowrap">{i.batch?.name || 'Unknown Item'}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-forest font-medium whitespace-nowrap">{i.currentQuantity}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-forest/70 whitespace-nowrap">{i.batch?.unit}</td>
                    <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                      <Badge variant={Number(i.currentQuantity) < 100 ? 'high' : 'success'}>
                        {Number(i.currentQuantity) < 100 ? 'Low Stock' : 'In Stock'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Incoming & Historical Batches */}
      <Card noPadding>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
          <h3 className="text-base sm:text-lg font-bold text-forest">Incoming & Historical Deliveries</h3>
          <span className="text-xs sm:text-sm font-medium text-forest/60">Shipments</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-forest/10 text-forest/60">
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Batch / Resource</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Supplier</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Quantity</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Status</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {loading && batches.length === 0 ? (
                <tr><td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading shipments...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-forest/50">No batch records found.</td></tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id} className="hover:bg-sand/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                      <p className="font-bold text-forest">{b.name}</p>
                      <p className="text-xs text-forest/50 font-mono mt-1">BATCH-{b.id.substring(0,6).toUpperCase()}</p>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-forest/80 font-medium whitespace-nowrap">{b.supplier?.name}</td>
                    <td className="px-4 sm:px-6 py-3.5 text-forest whitespace-nowrap">{b.totalQuantity} {b.unit}</td>
                    <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                      <Badge variant={
                        b.status === 'IN_TRANSIT' ? 'warning' :
                        b.status === 'RECEIVED_WAREHOUSE' ? 'success' : 'neutral'
                      }>
                        {b.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-right whitespace-nowrap">
                      {b.status === 'IN_TRANSIT' ? (
                        <Button variant="primary" onClick={() => handleReceive(b.id)} className="text-xs px-3 sm:px-4 py-1.5">
                          Receive Goods
                        </Button>
                      ) : (
                        <span className="text-xs text-forest/40">Processed</span>
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
  );
}
