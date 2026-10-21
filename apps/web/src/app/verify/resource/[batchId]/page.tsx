'use client';
import { useState } from 'react';
import { formatDate } from '@reliefchain/shared-types';

interface TimelineEvent {
  timestamp: string;
  event: string;
  location?: string;
  blockchainTxHash?: string;
  blockNumber?: number;
  chainId?: number;
}

interface VerificationResult {
  verification: 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND';
  batch: {
    id: string;
    name: string;
    unit: string;
    totalQuantity: number;
    status: string;
    currentLocation: string;
    registeredAt: string;
    updatedAt: string;
  };
  blockchain: {
    registrationTxHash: string | null;
    chainId: number | null;
    blockNumber: number | null;
    explorerUrl: string | null;
  };
  timeline: TimelineEvent[];
}

const statusColors: Record<string, string> = {
  DRAFT: '#f59e0b',
  REGISTERED: '#3b82f6',
  IN_TRANSIT: '#8b5cf6',
  RECEIVED_WAREHOUSE: '#10b981',
  RECEIVED_RELIEF_CENTER: '#06b6d4'
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VerifyResourcePage({ params }: { params: { batchId: string } }) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/qr/verify/${params.batchId}`);
      if (res.status === 404) {
        setError('Resource batch not found.');
        setResult(null);
      } else if (res.status === 400) {
        setError('Invalid batch identifier.');
        setResult(null);
      } else if (!res.ok) {
        setError('Verification service unavailable.');
        setResult(null);
      } else {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      setError('Unable to connect to verification service.');
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  // Auto-fetch on mount
  if (!fetched && !loading) {
    fetchVerification();
  }

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '14px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '8px' }}>
            ReliefChain Verification
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Resource Provenance
          </h1>
        </div>

        {loading && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>Verifying...</div>
          </div>
        )}

        {error && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <div style={{ fontSize: '18px', color: '#ef4444' }}>{error}</div>
          </div>
        )}

        {result && (
          <>
            {/* Verification Badge */}
            <div className="glass-panel" style={{ textAlign: 'center', marginBottom: '20px', padding: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                {result.verification === 'VERIFIED' ? '✅' : '⚠️'}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: result.verification === 'VERIFIED' ? '#10b981' : '#f59e0b',
                marginBottom: '8px'
              }}>
                {result.verification === 'VERIFIED'
                  ? 'Blockchain Registration Verified'
                  : 'Blockchain Evidence Unavailable'}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                Batch ID: {result.batch.id}
              </div>
            </div>

            {/* Resource Info */}
            <div className="glass-panel" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resource Details
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Name</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{result.batch.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Quantity</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{result.batch.totalQuantity} {result.batch.unit}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Status</div>
                  <span className="badge" style={{ background: `${statusColors[result.batch.status] || '#666'}33`, color: statusColors[result.batch.status] || '#999' }}>
                    {result.batch.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Current Location</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{result.batch.currentLocation}</div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-panel" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginTop: 0, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Provenance Timeline
              </h2>
              <div style={{ position: 'relative', paddingLeft: '28px' }}>
                {/* Vertical line */}
                <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #3b82f6, #8b5cf6, #10b981)' }} />

                {result.timeline.map((event, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: i < result.timeline.length - 1 ? '24px' : '0' }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute', left: '-24px', top: '4px',
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: event.blockchainTxHash ? '#3b82f6' : '#8b5cf6',
                      border: '2px solid rgba(255,255,255,0.2)'
                    }} />
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                      {formatDate(event.timestamp)}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>{event.event}</div>
                    {event.location && (
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>📍 {event.location}</div>
                    )}
                    {event.blockchainTxHash && (
                      <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px', wordBreak: 'break-all' }}>
                        🔗 Tx: {event.blockchainTxHash.slice(0, 10)}...{event.blockchainTxHash.slice(-8)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Blockchain Evidence */}
            <div className="glass-panel">
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Blockchain Evidence
              </h2>
              {result.blockchain.registrationTxHash ? (
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Transaction Hash</div>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all', color: '#3b82f6' }}>
                      {result.blockchain.registrationTxHash}
                    </div>
                  </div>
                  {result.blockchain.blockNumber && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Block Number</div>
                      <div style={{ fontSize: '14px' }}>{result.blockchain.blockNumber}</div>
                    </div>
                  )}
                  {result.blockchain.chainId && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Network</div>
                      <div style={{ fontSize: '14px' }}>
                        {result.blockchain.chainId === 1 ? 'Ethereum Mainnet' :
                         result.blockchain.chainId === 11155111 ? 'Sepolia Testnet' :
                         result.blockchain.chainId === 31337 ? 'Local Development' :
                         `Chain ${result.blockchain.chainId}`}
                      </div>
                    </div>
                  )}
                  {result.blockchain.explorerUrl && (
                    <a href={result.blockchain.explorerUrl} target="_blank" rel="noopener noreferrer"
                       className="btn btn-primary" style={{ marginTop: '8px', fontSize: '14px', textDecoration: 'none' }}>
                      View on Block Explorer ↗
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                  No blockchain registration evidence available for this batch.
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          ReliefChain — Transparent Disaster Relief
        </div>
      </div>
    </div>
  );
}
