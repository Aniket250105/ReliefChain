'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatINR } from '@reliefchain/shared-types';

export default function DonorImpactPage() {
  const params = useParams();
  const donId = params.donId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!donId) return;
    fetch(`/api/impact/${donId}`)
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'Failed to fetch impact data');
        }
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [donId]);

  if (loading) return <div className="p-10 text-center">Loading your impact timeline...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center">No impact data found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-sand min-h-screen">
      <Link href="/dashboard/donor" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        ← Back to Donor Dashboard
      </Link>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-forest/10 text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Your Impact Journey</h1>
        <p className="text-gray-600">
          Tracking your contribution to <span className="font-semibold">{data.campaignTitle}</span>
        </p>
        
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <div className="bg-white text-forest px-4 py-2 rounded-lg border border-emerald-100">
            <span className="text-sm block">Your Donation</span>
            <span className="font-bold text-xl">{formatINR(data.donorContribution)}</span>
          </div>
          <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg border border-blue-100">
            <span className="text-sm block">Attributed Share</span>
            <span className="font-bold text-xl">{data.donorPercentage.toFixed(4)}%</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4 max-w-lg mx-auto">
          Calculations are based on the Proportional Pooled Attribution Model. Your percentage share of the campaign's total funds is used to attribute downstream impact proportionally.
        </p>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        
        {/* Allocations */}
        {data.allocations.map((a: any) => (
          <div key={a.allocationId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 text-slate-500 group-[.is-active]:bg-blue-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900">Fund Allocation</h3>
              <p className="text-sm text-gray-600 mb-2">{a.purpose}</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500">Total Allocated</p>
                  <p className="font-semibold">${a.amount.toLocaleString()}</p>
                </div>
                <div className="text-right bg-blue-50 px-2 py-1 rounded">
                  <p className="text-xs text-blue-600 font-medium">Your Impact</p>
                  <p className="font-bold text-blue-700">${a.attributedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              {a.blockchainTxHash && (
                <a href={`https://sepolia.etherscan.io/tx/${a.blockchainTxHash}`} target="_blank" className="text-xs text-blue-500 hover:underline mt-3 inline-block">Verify on Blockchain ↗</a>
              )}
            </div>
          </div>
        ))}

        {/* Resource Batches */}
        {data.resourceBatches.map((rb: any) => (
          <div key={rb.batchId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 text-slate-500 group-[.is-active]:bg-amber-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900">Resource Batch Registered</h3>
              <p className="text-sm text-gray-600 mb-2">{rb.resourceType}</p>
              <p className="font-semibold text-gray-900">{rb.quantity.toLocaleString()} {rb.unit}</p>
              {rb.blockchainTxHash && (
                <a href={`https://sepolia.etherscan.io/tx/${rb.blockchainTxHash}`} target="_blank" className="text-xs text-amber-600 hover:underline mt-3 inline-block">Verify on Blockchain ↗</a>
              )}
            </div>
          </div>
        ))}

        {/* Distributions */}
        {data.distributions.map((d: any) => (
          <div key={d.distributionId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 text-slate-500 group-[.is-active]:bg-white0 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900">Final Distribution</h3>
              <p className="text-sm text-gray-600 mb-2">Distributed to Beneficiaries</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500">Total Beneficiaries</p>
                  <p className="font-semibold">{d.beneficiariesServed.toLocaleString()}</p>
                </div>
                <div className="text-right bg-white px-2 py-1 rounded">
                  <p className="text-xs text-emerald-700 font-medium">Your Impact</p>
                  <p className="font-bold text-forest">{d.attributedBeneficiaries.toLocaleString(undefined, { maximumFractionDigits: 1 })} lives</p>
                </div>
              </div>
              {d.blockchainTxHash && (
                <a href={`https://sepolia.etherscan.io/tx/${d.blockchainTxHash}`} target="_blank" className="text-xs text-forest hover:underline mt-3 inline-block">Verify Proof of Impact ↗</a>
              )}
            </div>
          </div>
        ))}
        
        {data.distributions.length === 0 && data.allocations.length > 0 && (
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-center">
              <p className="text-gray-500">Awaiting final distributions...</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
