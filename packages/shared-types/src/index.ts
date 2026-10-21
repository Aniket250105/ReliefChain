export type UUID = string;

export enum Web2Role {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  GOVERNMENT_AUTHORITY = 'GOVERNMENT_AUTHORITY',
  NGO_ADMIN = 'NGO_ADMIN',
  NGO_OPERATOR = 'NGO_OPERATOR',
  DONOR = 'DONOR',
  AUDITOR = 'AUDITOR',
  WAREHOUSE_OPERATOR = 'WAREHOUSE_OPERATOR',
  SUPPLIER = 'SUPPLIER',
  RELIEF_OFFICER = 'RELIEF_OFFICER',
  PUBLIC_VIEWER = 'PUBLIC_VIEWER'
}

export enum OrganizationType {
  NGO = 'NGO',
  GOVERNMENT = 'GOVERNMENT',
  AUDITOR = 'AUDITOR',
  SUPPLIER = 'SUPPLIER'
}

export enum DisasterStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED'
}

export interface SafeUserDto {
  id: UUID;
  email: string;
  role: Web2Role | string;
  organizationId: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDto {
  id: UUID;
  name: string;
  type: OrganizationType | string;
  isVerified: boolean;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: SafeUserDto;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
}

export interface DisasterDto {
  id: UUID;
  name: string;
  description: string;
  status: DisasterStatus | string;
  severity: string;
  state: string;
  district: string;
  city: string;
  pinCode: string;
  authorityId: UUID;
  blockchainTxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisasterDto {
  name: string;
  description: string;
  severity: string;
  state: string;
  district: string;
  city: string;
  pinCode: string;
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  PENDING_AUTHORITY_APPROVAL = 'PENDING_AUTHORITY_APPROVAL',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED'
}

export interface CampaignDto {
  id: UUID;
  disasterId: UUID;
  ngoId: UUID;
  name: string;
  targetAmount: string | number; // Decimal string
  raisedAmount: string | number;
  status: CampaignStatus | string;
  blockchainTxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignDto {
  name: string;
  targetAmount: string | number;
  disasterId: UUID;
}


export enum DonationVerificationStatus {
  SUBMITTED = 'SUBMITTED',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN'
}

export interface DonationInfoResponse {
  chainId: number;
  donationContractAddress: string;
  blockchainCampaignId: string; // bytes32 hex string
  targetAmount: string | number;
  raisedAmount: string | number;
  status: CampaignStatus | string;
}

export interface DonationVerificationResponse {
  txHash: string;
  status: DonationVerificationStatus;
}

export enum ResourceBatchStatus {
  DRAFT = 'DRAFT',
  REGISTERED = 'REGISTERED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED_WAREHOUSE = 'RECEIVED_WAREHOUSE',
  RECEIVED_RELIEF_CENTER = 'RECEIVED_RELIEF_CENTER',
  DISTRIBUTED = 'DISTRIBUTED'
}

export * from './formatting';
export { INDIAN_STATES_UTS } from './demo-accounts';
