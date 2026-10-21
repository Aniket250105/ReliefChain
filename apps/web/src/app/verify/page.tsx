'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function VerifyPage() {
  const [batchId, setBatchId] = useState('');
  const router = useRouter();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = batchId.trim();
    if (!trimmed) return;
    router.push(`/verify/resource/${trimmed}`);
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto space-y-8 mt-10 stagger-children-fade-up">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest/10 text-forest text-2xl mb-4">
          🔍
        </div>
        <h1 className="text-3xl font-bold text-forest mb-3">
          Verify Provenance
        </h1>
        <p className="text-forest/80 text-base font-medium">
          Enter a Resource Batch ID or scan a QR code to trace cryptographic history.
        </p>
      </div>

      <div className="w-full space-y-6">
        {/* Manual Entry */}
        <Card noPadding>
          <div className="px-6 py-4 border-b border-forest/10 bg-white/50 rounded-t-2xl">
            <h2 className="text-lg font-bold text-forest">Manual Lookup</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Batch ID (UUID)</label>
                <input
                  type="text"
                  placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full bg-sand/30 border border-forest/20 text-forest px-4 py-3 rounded-xl outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all placeholder:text-forest/30 font-mono text-sm"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={!batchId.trim()}
                className="py-3 text-base shadow-sm"
              >
                Trace on Blockchain
              </Button>
            </form>
          </div>
        </Card>

        {/* QR Scanner */}
        <Card noPadding>
          <div className="px-6 py-4 border-b border-forest/10 bg-white/50 rounded-t-2xl">
            <h2 className="text-lg font-bold text-forest text-center">QR Scanner</h2>
          </div>
          <div className="p-8">
            <div className="aspect-square max-w-[200px] mx-auto border-2 border-dashed border-forest/20 rounded-2xl flex flex-col items-center justify-center text-forest/40 mb-4 bg-sand/30">
              <div className="text-3xl mb-2">📷</div>
              <div className="text-xs font-bold uppercase tracking-wider">Camera Ready</div>
              <div className="text-[10px] mt-1 font-medium">Coming Soon</div>
            </div>
            <p className="text-center text-sm font-medium text-forest/60">
              Point your camera at a physical ReliefChain package to verify.
            </p>
          </div>
        </Card>
      </div>

      <div className="text-center text-xs font-semibold text-forest/40 uppercase tracking-widest pt-8 border-t border-forest/10 w-full">
        Cryptographically Secured
      </div>
    </div>
  );
}
