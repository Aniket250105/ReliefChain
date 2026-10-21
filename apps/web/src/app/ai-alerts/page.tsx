'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { toast } from 'react-hot-toast';
import { formatDate } from '@reliefchain/shared-types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { getCachedData, setCachedData, invalidateCache } from '../../lib/api-cache';

export default function AIAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>(() => getCachedData<any[]>('ai_alerts') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('ai_alerts'));
  const [error, setError] = useState('');

  const fetchAlerts = async (isSilent = false) => {
    try {
      if (!isSilent && !getCachedData('ai_alerts')) {
        setLoading(true);
      }
      const res = await fetch('/api/ai/alerts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch AI Alerts');
      const d = await res.json();
      setAlerts(d);
      setCachedData('ai_alerts', d);
    } catch (e: any) {
      if (!isSilent) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts(alerts.length > 0);
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/ai/alerts/${id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `ai-alert-review-${id}-${status}-${Date.now()}`
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Alert marked as ${status.replace(/_/g, ' ')}`);
        const updated = alerts.map(a => a.id === id ? { ...a, status } : a);
        setAlerts(updated);
        setCachedData('ai_alerts', updated);
        invalidateCache('auditor_alerts');
        invalidateCache('kpi_AUDITOR');
      } else {
        toast.error('Failed to update review status');
      }
    } catch (e) {
      toast.error('Failed to update review status');
    }
  };

  const criticalCount = alerts.filter(a => a.riskLevel === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.riskLevel === 'HIGH').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-forest/10 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">AI Anomaly Alerts</h1>
            <p className="text-xs sm:text-sm text-forest/70 mt-1">Review operational flags flagged by the AI Subsystem</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-terracotta/10 px-4 py-2 rounded-xl border border-terracotta/20 text-center min-w-[80px]">
              <p className="text-[10px] text-terracotta font-bold uppercase tracking-wider">Critical</p>
              <p className="text-lg font-bold text-terracotta">{criticalCount}</p>
            </div>
            <div className="bg-gold/20 px-4 py-2 rounded-xl border border-gold/40 text-center min-w-[80px]">
              <p className="text-[10px] text-forest/80 font-bold uppercase tracking-wider">High</p>
              <p className="text-lg font-bold text-forest">{highCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 border border-forest/10 rounded-xl p-4 text-xs text-forest/80">
          <strong className="font-bold text-forest">Auditor Notice:</strong> AI Alerts denote statistical or operational anomalies requiring human investigation. An alert is not proof of fraud or wrongdoing, nor does it block underlying transactions.
        </div>

        <Card noPadding>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60 text-xs">
                  <th className="px-4 sm:px-6 py-3.5 font-semibold uppercase tracking-wider whitespace-nowrap">Risk Level</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold uppercase tracking-wider whitespace-nowrap">Entity</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold uppercase tracking-wider whitespace-nowrap">Reason Codes</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold uppercase tracking-wider whitespace-nowrap">Score / Threshold</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right font-semibold uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {alerts.map(a => (
                  <tr key={a.id} className="hover:bg-sand/30 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <Badge variant={
                        a.riskLevel === 'CRITICAL' ? 'critical' : 
                        a.riskLevel === 'HIGH' ? 'high' : 
                        a.riskLevel === 'MEDIUM' ? 'medium' : 'low'
                      }>
                        {a.riskLevel}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-forest text-xs uppercase tracking-wider">{a.entityType}</div>
                      <div className="text-forest/50 text-xs font-mono truncate max-w-[140px]" title={a.entityId}>{a.entityId}</div>
                      <div className="text-[10px] text-forest/40">{formatDate(a.createdAt)}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-xs font-medium text-forest max-w-xs">
                      {Array.isArray(a.reasonCodes) ? a.reasonCodes.join(', ').replace(/_/g, ' ') : a.reasonCodes}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs font-mono text-forest/70">
                      {typeof a.anomalyScore === 'number' ? a.anomalyScore.toFixed(3) : 'N/A'} / {typeof a.configuredThreshold === 'number' ? a.configuredThreshold.toFixed(2) : '1.00'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        a.status === 'NEW' ? 'bg-terracotta/10 text-terracotta' :
                        a.status === 'INVESTIGATING' ? 'bg-gold/20 text-forest' :
                        'bg-forest/10 text-forest'
                      }`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right space-x-2">
                      {a.status === 'NEW' ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => updateStatus(a.id, 'INVESTIGATING')} className="text-[10px] px-2.5 py-1 bg-white">
                            Investigate
                          </Button>
                          <Button variant="outline" onClick={() => updateStatus(a.id, 'RESOLVED_FALSE_POSITIVE')} className="text-[10px] px-2.5 py-1 bg-white">
                            Dismiss
                          </Button>
                          <Button variant="outline" onClick={() => updateStatus(a.id, 'ESCALATED')} className="text-[10px] px-2.5 py-1 text-terracotta bg-terracotta/5 border-terracotta/20">
                            Escalate
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-forest/40 italic">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {loading && alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-forest/50">Loading AI anomaly alerts...</td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-forest/50">{error || 'No AI alerts found.'}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
