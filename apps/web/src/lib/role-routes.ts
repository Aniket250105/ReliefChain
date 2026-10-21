export function getRoleDashboardHref(role?: string): string {
  if (!role) return '/public/dashboard';
  
  const normalized = role.toUpperCase();
  switch (normalized) {
    case 'GOVERNMENT_AUTHORITY':
    case 'SYSTEM_ADMIN':
      return '/dashboard/authority';
    case 'NGO_ADMIN':
    case 'NGO_OPERATOR':
      return '/dashboard/ngo';
    case 'DONOR':
      return '/dashboard/donor';
    case 'SUPPLIER':
      return '/dashboard/supplier';
    case 'WAREHOUSE_OPERATOR':
      return '/dashboard/warehouse';
    case 'RELIEF_OFFICER':
      return '/dashboard/officer';
    case 'AUDITOR':
      return '/dashboard/auditor';
    default:
      return '/public/dashboard';
  }
}
