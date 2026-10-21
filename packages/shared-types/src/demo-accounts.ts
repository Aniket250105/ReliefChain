/**
 * ReliefChain — Canonical Demo Account Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all development/demo/test accounts.
 * Used by: seed scripts, frontend demo selector, browser automation, integration tests.
 * 
 * DO NOT create alternate emails. DO NOT guess addresses. Use this mapping exactly.
 */

export const DEMO_PASSWORD = 'devpassword123';

export interface DemoAccount {
  role: string;
  label: string;
  email: string;
  organization: string;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'SYSTEM_ADMIN',
    label: 'System Admin',
    email: 'sysadmin@reliefchain.local',
    organization: 'ReliefChain',
    description: 'System administration'
  },
  {
    role: 'GOVERNMENT_AUTHORITY',
    label: 'Government Authority',
    email: 'authority@gov.local',
    organization: 'Global Disaster Response Agency',
    description: 'Government disaster-relief authority'
  },
  {
    role: 'NGO_ADMIN',
    label: 'NGO Admin',
    email: 'ngoadmin@hoperelief.local',
    organization: 'Hope Relief International',
    description: 'NGO administrator'
  },
  {
    role: 'NGO_OPERATOR',
    label: 'NGO Operator',
    email: 'ngooperator@hoperelief.local',
    organization: 'Hope Relief International',
    description: 'NGO operator'
  },
  {
    role: 'AUDITOR',
    label: 'Auditor',
    email: 'auditor@trustaudit.local',
    organization: 'Trust Audit Partners',
    description: 'Independent auditor'
  },
  {
    role: 'SUPPLIER',
    label: 'Supplier / Vendor',
    email: 'supplier@medlogistics.local',
    organization: 'Global Med Logistics',
    description: 'Medical logistics supplier'
  },
  {
    role: 'WAREHOUSE_OPERATOR',
    label: 'Warehouse Operator',
    email: 'warehouse@central.local',
    organization: 'Central Distribution Warehouse',
    description: 'Central relief warehouse'
  },
  {
    role: 'RELIEF_OFFICER',
    label: 'Relief Officer',
    email: 'reliefofficer@hoperelief.local',
    organization: 'Hope Relief International',
    description: 'NGO relief/distribution officer'
  },
  {
    role: 'DONOR',
    label: 'Donor',
    email: 'donor@example.local',
    organization: '',
    description: 'Donor account'
  }
];

/** Resolve canonical email by role name (case-insensitive partial match) */
export function resolveEmailByRole(roleName: string): string | undefined {
  const normalized = roleName.toUpperCase().replace(/[\s\/]+/g, '_');
  const account = DEMO_ACCOUNTS.find(a => a.role === normalized);
  return account?.email;
}

/**
 * Indian States and Union Territories
 * Used for registration, profile, and location fields.
 */
export const INDIAN_STATES_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
] as const;

/**
 * Roles that can self-register publicly.
 */
export const SELF_REGISTER_ROLES = ['DONOR'] as const;

/**
 * Roles that require application + approval workflow.
 */
export const APPLICATION_ROLES = ['NGO_ADMIN', 'SUPPLIER', 'WAREHOUSE_OPERATOR'] as const;

/**
 * Roles that are provisioned/restricted (cannot be obtained through public registration).
 */
export const PROVISIONED_ROLES = [
  'SYSTEM_ADMIN', 'GOVERNMENT_AUTHORITY', 'AUDITOR',
  'NGO_OPERATOR', 'RELIEF_OFFICER'
] as const;
