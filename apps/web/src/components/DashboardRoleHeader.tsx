'use client';

import { SafeUserDto } from '@reliefchain/shared-types';

export default function DashboardRoleHeader({ user }: { user: SafeUserDto }) {
  // Format role for display
  const displayRole = user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  let subtitle = "";
  if (user.role === 'GOVERNMENT_AUTHORITY') subtitle = "Verify disasters • Approve campaigns • Oversee allocations";
  else if (user.role === 'SYSTEM_ADMIN') subtitle = "Platform health • Access oversight • Anomaly monitoring";
  else if (user.role === 'NGO_ADMIN' || user.role === 'NGO_OPERATOR') subtitle = "Manage campaigns • Request allocations • Track impact";
  else if (user.role === 'DONOR') subtitle = "Support • Create Impact";
  else if (user.role === 'SUPPLIER') subtitle = "Fulfill allocations • Register resources";
  else if (user.role === 'WAREHOUSE_OPERATOR') subtitle = "Receive shipments • Manage inventory";
  else if (user.role === 'RELIEF_OFFICER') subtitle = "Distribute resources • Upload evidence";
  else if (user.role === 'AUDITOR') subtitle = "Review alerts • Verify cryptography";

  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight break-words">Welcome back, {displayRole}</h1>
      {subtitle && <p className="text-forest/70 mt-1.5 sm:mt-2 text-sm sm:text-base font-medium break-words">{subtitle}</p>}
    </div>
  );
}
