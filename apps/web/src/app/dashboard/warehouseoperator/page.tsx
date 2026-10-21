'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WarehouseOperatorRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/warehouse');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-forest">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Loading Warehouse Dashboard...</p>
      </div>
    </div>
  );
}
