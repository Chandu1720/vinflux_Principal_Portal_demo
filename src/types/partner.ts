import type { PartnerClassification, PartnerChannelAssignment } from './gtm.ts';

export interface KycDocument {
  id: string;
  title: string;
  type: 'GSTIN Certificate' | 'PAN Card' | 'Drug License Form 20B/21B' | 'MDR Medical Device License' | 'Bank Guarantee / Collateral Lien' | 'Signed Agreement';
  fileName: string;
  uploadDate: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  fileSize: string;
}

export interface PartnerPortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Invited' | 'Suspended';
  lastLogin?: string;
}

export interface PartnerTerritoryCommercial {
  territoryId: string;
  territoryName: string;
  inheritedDefaultDiscount: number;
  partnerOverrideDiscount?: number | null;
  effectiveDiscount: number;
  overrideOrigin: 'Territory Default' | 'Partner Override' | 'Partner-Product Override';
  productOverrides?: Record<string, number>; // productId/sku -> override discount %
  creditLimitOverride?: number | null;
  creditPeriodOverride?: number | null;
  notes?: string;
}

export interface CommercialOverrideHistoryEntry {
  timestamp: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
  updatedBy: string;
}

export interface PartnerCommercialOverride {
  id: string;
  partnerId: string;
  territoryId: string; // Specific territoryId or 'GLOBAL'
  territoryName?: string;
  
  // Explicit overrides (null indicates inheriting master default)
  overrideDiscountPercent: number | null;
  overrideCreditPeriodDays: number | null;
  overrideCreditLimit: number | null;
  overrideSecurityDeposit: number | null;
  
  // Tracking & governance
  effectiveFrom: string;
  overrideReason: string;
  updatedBy: string;
  history: CommercialOverrideHistoryEntry[];
}

export interface PartnerDistributionAssignment {
  id: string;
  partnerId: string;
  territoryId: string;
  territoryName?: string;
  branchId: string;
  branchName?: string;
  warehouseId: string;
  warehouseName?: string;
  assignmentType: 'Primary Invoicing & Dispatch' | 'Secondary Stocking' | 'Emergency Hospital Supply' | 'Transit & Cross-Dock Hub' | 'Returns Processing';
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Active' | 'Inactive';
  notes?: string;
}

export interface Partner {
  id: string;
  name: string;
  code: string;
  typeId: string;
  typeName: string;
  status: 'Active' | 'Suspended' | 'Inactive';
  lifecycleStatus?: 'Draft' | 'KYC Pending' | 'Under Review' | 'Approved' | 'Active' | 'Inactive';
  
  // Classification & Hierarchy (Explicitly decoupled per enterprise rules)
  classification?: PartnerClassification;
  
  // Multiple Sales Channel Assignments (with independent commercial terms)
  channelAssignments?: PartnerChannelAssignment[];
  
  // KYC & Statutory
  gstin: string;
  gstinStatus: 'Verified on GST Portal' | 'Pending Verification' | 'Rejected';
  pan: string;
  drugLicenseNo: string;
  drugLicenseExpiry: string;
  mdrLicenseNo: string;
  authorizedContactPerson: string;
  contactDesignation: string;
  officialEmail: string;
  mobilePhone: string;
  warehouseAddress: string;
  kycStatus: 'Draft' | 'Pending Verification' | 'Verified' | 'Rejected';
  kycDocuments: KycDocument[];
  
  // Credit & Financial
  creditLimit: number;
  creditDays: string;
  gracePeriodDays: number;
  outstandingAmount: number;
  overdueAmount: number;
  openOrdersAmount: number;
  creditHold: boolean;
  securityDepositHeld: number;
  depositInstrument: string;
  depositExpiry: string;
  
  // Territory, Channel & Route Assignments
  assignedTerritoryIds: string[];
  assignedChannelIds: string[];
  assignedRouteId: string;
  tierPriceLevel: string;
  territoryCommercials: Record<string, PartnerTerritoryCommercial>;
  
  // Supply Chain & Warehouse Distribution Assignments
  distributionAssignments: PartnerDistributionAssignment[];
  
  // Partner-Specific Commercial Overrides
  commercialOverrides?: Record<string, PartnerCommercialOverride>;
  
  // Distribution Portal Invitation & Access
  invitationStatus: 'Not Invited' | 'Invite Sent' | 'Accepted' | 'Expired' | 'Cancelled';
  invitationSentDate?: string;
  invitationExpiryDate?: string;
  invitationAcceptedDate?: string;
  invitedEmail?: string;
  portalAccessStatus: 'Disabled' | 'Active' | 'Suspended';
  lastActiveDate?: string;
  portalUsers: PartnerPortalUser[];
  
  activeContractsCount: number;
  createdAt: string;
  updatedAt: string;
}
