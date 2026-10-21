'use client';
import { useEffect, useState } from 'react';
import { formatINR, formatDate } from '@reliefchain/shared-types';
import { toast } from 'react-hot-toast';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { getCachedData, setCachedData, invalidateCache } from '../../../lib/api-cache';

export default function AuditorDashboard() {
  const [alerts, setAlerts] = useState<any[]>(() => getCachedData<any[]>('auditor_alerts') || []);
  const [logs, setLogs] = useState<any[]>(() => getCachedData<any[]>('auditor_logs') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('auditor_alerts'));

  useEffect(() => {
    fetchData(alerts.length > 0);
  }, []);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent && !getCachedData('auditor_alerts')) {
        setLoading(true);
      }
      // Fetch AI Alerts
      const alertsRes = await fetch('/api/ai/alerts', { credentials: 'include' });
      if (!alertsRes.ok) throw new Error('Failed to fetch AI alerts');
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);
      setCachedData('auditor_alerts', alertsData);
      
      // Fetch Audit Logs
      const logsRes = await fetch('/api/ai/audit-logs', { credentials: 'include' }).catch(() => null);
      if (logsRes && logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
        setCachedData('auditor_logs', logsData);
      } else {
        setLogs([]);
      }
    } catch (err: any) {
      if (!isSilent) toast.error(err.message || 'Error fetching audit data');
    } finally {
      setLoading(false);
    }
  };

  const reviewAlert = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/ai/alerts/${id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `audit-review-${id}-${newStatus}-${Date.now()}`
        },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to review alert');
      toast.success(`Alert status updated to ${newStatus.replace(/_/g, ' ')}`);
      invalidateCache('auditor_alerts');
      invalidateCache('ai_alerts');
      invalidateCache('kpi_AUDITOR');
      fetchData(true); // refresh
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* AI Alerts */}
      <Card noPadding>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-bold text-forest">AI Anomaly Alerts</h3>
            {alerts.filter(a => a.status === 'NEW').length > 0 && (
              <span className="bg-terracotta text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {alerts.filter(a => a.status === 'NEW').length} New
              </span>
            )}
          </div>
          <span className="text-xs sm:text-sm font-medium text-forest/60">Risk Management</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-forest/10 text-forest/60">
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Entity & Timeline</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Risk Analysis</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Reason</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {loading && alerts.length === 0 ? (
                <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading AI analysis...</td></tr>
              ) : alerts.length === 0 ? (
                <tr><td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-forest/50">No anomalies detected. System operating normally.</td></tr>
              ) : (
                alerts.map(a => (
                  <tr key={a.id} className="hover:bg-sand/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                      <p className="font-bold text-forest uppercase tracking-wider text-xs mb-1">{a.entityType}</p>
                      <p className="text-xs text-forest/50 font-mono mb-2">ID: {a.entityId.substring(0,8)}</p>
                      <p className="text-[10px] text-forest/60">{formatDate(a.createdAt)}</p>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={
                          a.riskLevel === 'CRITICAL' ? 'critical' : 
                          a.riskLevel === 'HIGH' ? 'high' : 
                          a.riskLevel === 'MEDIUM' ? 'medium' : 'low'
                        }>
                          {a.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-forest/70">
                        Score: {a.modelAvailable ? (a.anomalyScore !== null ? a.anomalyScore.toFixed(3) : 'N/A') : 'MODEL-UNAVAILABLE'}
                      </p>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-xs font-medium text-forest max-w-xs leading-relaxed">
                      {a.reasonCodes.join(', ').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                      {a.status === 'NEW' ? (
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" onClick={() => reviewAlert(a.id, 'INVESTIGATING')} className="text-[10px] px-3 py-1 bg-white border-forest/30 text-forest/80">
                            Investigate
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" onClick={() => reviewAlert(a.id, 'RESOLVED_FALSE_POSITIVE')} className="text-[10px] px-2 py-1 bg-white border-forest/10 hover:border-forest/30">
                              Dismiss
                            </Button>
                            <Button variant="outline" onClick={() => reviewAlert(a.id, 'ESCALATED')} className="text-[10px] px-2 py-1 bg-terracotta/5 border-terracotta/20 text-terracotta hover:bg-terracotta/10">
                              Escalate
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Badge variant={
                          a.status === 'ESCALATED' ? 'critical' :
                          a.status === 'INVESTIGATING' ? 'warning' : 'neutral'
                        }>
                          {a.status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Chronological Audit Log */}
      <Card noPadding>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
          <h3 className="text-base sm:text-lg font-bold text-forest">Chronological Audit Log</h3>
          <span className="text-xs sm:text-sm font-medium text-forest/60">System Events</span>
        </div>
        <div className="overflow-x-auto w-full max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm relative">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="border-b border-forest/10 text-forest/60">
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Timestamp</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Actor / Role</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Action Performed</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Target Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {loading && logs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-forest/50">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-forest/50">No events recorded.</td></tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id} className="hover:bg-sand/20 transition-colors text-xs">
                    <td className="px-6 py-3 whitespace-nowrap text-forest/70">{formatDate(l.createdAt)}</td>
                    <td className="px-6 py-3 whitespace-nowrap font-medium text-forest">{l.actor?.role.replace(/_/g, ' ') || 'SYSTEM_PROCESS'}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-forest font-semibold">{l.action.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-forest/60 font-mono">
                      {l.entityId ? `${l.entityType}: ${l.entityId.substring(0,8)}` : '-'}
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
