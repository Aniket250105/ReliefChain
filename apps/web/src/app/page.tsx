import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="max-w-5xl w-full bg-white border border-forest shadow-sm overflow-hidden rounded-2xl">
        <div className="bg-forest p-6 sm:p-10 text-center text-white flex flex-col items-center">
          <img src="/logo.jpg" alt="ReliefChain Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-md mb-4 sm:mb-6" />
          <h1 className="text-3xl sm:text-4xl font-semibold mb-3 sm:mb-4 tracking-tight">ReliefChain</h1>
          <p className="text-base sm:text-lg opacity-90 max-w-2xl mx-auto font-light">
            Decentralized Disaster Relief Platform ensuring transparency, accountability, and traceability of resources.
          </p>
        </div>
        
        <div className="p-5 sm:p-10">
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <Link href="/login" className="px-8 py-3 bg-forest hover:bg-opacity-90 text-white font-medium border border-forest text-center transition-colors">
              System Login
            </Link>
            <Link href="/public/dashboard" className="px-8 py-3 bg-white hover:bg-sand text-forest font-medium border border-forest text-center transition-colors">
              Public Dashboard
            </Link>
            <Link href="/verify" className="px-8 py-3 bg-white hover:bg-sand text-forest font-medium border border-forest text-center transition-colors">
              Verify Resource
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard title="Disaster Management" desc="Coordinate emergency response with authority verification." />
            <FeatureCard title="Campaigns & Donations" desc="Transparent fundraising with smart contract escrow." />
            <FeatureCard title="Fund Allocation" desc="Secure multisig approval for releasing relief funds." />
            <FeatureCard title="Resource Provenance" desc="End-to-end tracking of physical relief goods." />
            <FeatureCard title="AI Monitoring" desc="Automated anomaly detection in distribution patterns." />
            <FeatureCard title="Proof-of-Impact" desc="Verifiable evidence of relief delivery linked to donations." />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="border-t-2 border-forest bg-sand p-6 hover:bg-opacity-80 transition-colors">
      <h3 className="text-lg font-semibold text-forest mb-2">{title}</h3>
      <p className="text-forest text-sm opacity-90">{desc}</p>
    </div>
  );
}
