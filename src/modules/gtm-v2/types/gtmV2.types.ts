// ============================================================================
// VinFlux GTM V2 - Domain Types & Data Contracts
// Enterprise Go-To-Market Architecture
// ============================================================================

export type ActiveStatus = 'Active' | 'Inactive';

export type OnboardingStatus =
  | 'Draft'
  | 'KYC Under Review'
  | 'Approval Pending'
  | 'Active'
  | 'Rejected'
  | 'Suspended';

export type KycDocStatus = 'Pending' | 'Under Review' | 'Verified' | 'Rejected';

export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export type ApprovalRequestType =
  | 'Partner Onboarding'
  | 'KYC Verification'
  | 'Discount Override'
  | 'Credit Limit Change'
  | 'Credit Period Extension'
  | 'Deposit Waiver'
  | 'Sales Flow Override';

export type CommercialTermProvenance =
  | 'Approved Relationship Terms'
  | 'Approved Partner Terms'
  | 'Territory-Specific Terms'
  | 'Default Sales Channel Terms';

// ----------------------------------------------------------------------------
// 1. Territory Management (Dynamic N-Level Hierarchy)
// ----------------------------------------------------------------------------
export interface TerritoryNode {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId: string | null;
  parentName?: string;
  level: number; // 1 = Root/Country, 2 = State/Region, 3 = Cluster/City, 4 = Area, etc.
  levelLabel?: string; // Optional custom label e.g. "Country", "Region", "Zone", "Metro", "Micro-Market"
  status: ActiveStatus;
  leadPerson?: string;
  pinCodes?: string[];
  createdAt: string;
  updatedAt: string;
  children?: TerritoryNode[];
}

// ----------------------------------------------------------------------------
// 2. Zone Management
// ----------------------------------------------------------------------------
export interface Zone {
  id: string;
  code: string;
  name: string;
  description: string;
  status: ActiveStatus;
  territoryIds: string[]; // Allows overlapping / multi-zone territory memberships
  leadManager?: string;
  annualBudget?: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// 3. Sales Channel Configuration
// ----------------------------------------------------------------------------
export interface ChannelConfigHistory {
  id: string;
  timestamp: string;
  modifiedBy: string;
  changeSummary: string;
  discountPercent: number;
  creditPeriodDays: number;
  creditLimit: number;
}

export interface SalesChannel {
  id: string;
  code: string;
  name: string;
  description: string;
  status: ActiveStatus;
  standardDiscountPercent: number;
  creditPeriodDays: number;
  creditLimit: number;
  requiresDeposit: boolean;
  depositAmount: number;
  minOrderValue: number;
  maxOrderValue: number;
  allowedPaymentModes: string[];
  effectiveFrom: string;
  effectiveTo?: string;
  applicablePartnerTypes?: string[];
  configHistory: ChannelConfigHistory[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// 4. Sales Flow Topology
// ----------------------------------------------------------------------------
export interface SalesFlowStage {
  id: string;
  stageNumber: number;
  channelId: string;
  channelName: string;
  stageRole: 'Source' | 'Intermediary' | 'Consignee' | 'Destination';
  pricingBasis: string; // e.g. "Ex-Factory Cost", "Price to Distributor (PTD)", "Price to Retailer (PTR)", "MRP"
  inventoryOwnership: 'Company Owned' | 'Consignment' | 'Title Transfer' | 'Customer Owned';
  requiresLogisticsDispatch: boolean;
}

export interface ProductScopeConfig {
  scopeType: 'All' | 'Portfolio' | 'Category' | 'Subcategory' | 'Product';
  portfolioIds?: string[];
  portfolioNames?: string[];
  categoryIds?: string[];
  categoryNames?: string[];
  subcategoryIds?: string[];
  subcategoryNames?: string[];
  productIds?: string[];
  productNames?: string[];
}

export interface SalesFlowTopology {
  id: string;
  code: string;
  name: string;
  description: string;
  flowType: 'Direct' | 'Multi-Stage';
  stages: SalesFlowStage[];
  applicableTerritoryIds: string[];
  applicableZoneIds: string[];
  productScope: ProductScopeConfig;
  status: ActiveStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// 5. Partner Onboarding & Entity Master
// ----------------------------------------------------------------------------
export interface KycDocument {
  id: string;
  documentType: string;
  documentNumber: string;
  fileName?: string;
  uploadedAt: string;
  status: KycDocStatus;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface FlowStagePartnerMapping {
  flowId: string;
  stageNumber: number;
  stageChannelName: string;
  mappedPartnerId?: string;
  mappedPartnerName?: string;
  mappedPartnerCode?: string;
}

export interface PartnerCommercialOverride {
  standardDiscount: number;
  effectiveDiscount: number;
  isDiscountOverridden: boolean;
  standardCreditDays: number;
  effectiveCreditDays: number;
  isCreditDaysOverridden: boolean;
  standardCreditLimit: number;
  effectiveCreditLimit: number;
  isCreditLimitOverridden: boolean;
  requiresDeposit: boolean;
  depositAmount: number;
  overrideReason?: string;
  approvalStatus: 'Standard' | 'Pending Approval' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
}

export interface PartnerOnboardingRecord {
  id: string;
  code: string;
  name: string;
  businessName: string;
  partnerType: string; // e.g. "Distributor", "C&F Agent", "Super Stockist", "Dealer", "Hospital"
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
  };
  gstin: string;
  pan: string;
  drugLicenseNo?: string;
  drugLicenseExpiry?: string;
  mdrRegistrationNo?: string;
  status: OnboardingStatus;
  kycDocuments: KycDocument[];
  assignedTerritoryIds: string[];
  assignedTerritoryNames?: string[];
  selectedSalesFlowIds: string[];
  selectedSalesFlowNames?: string[];
  partnerMappings: FlowStagePartnerMapping[];
  commercialTerms: PartnerCommercialOverride;
  upstreamPartnerIds?: string[];
  downstreamPartnerIds?: string[];
  onboardedAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// 6. Commercial Terms Resolution
// ----------------------------------------------------------------------------
export interface CommercialTermEntry {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  channelId: string;
  channelName: string;
  territoryId: string;
  territoryName: string;
  standardDiscount: number;
  approvedDiscount: number;
  creditPeriodDays: number;
  creditLimit: number;
  requiresDeposit: boolean;
  depositAmount: number;
  provenance: CommercialTermProvenance;
  approvalStatus: 'Standard' | 'Approved' | 'Pending Approval' | 'Rejected';
  effectiveFrom: string;
  effectiveTo?: string;
}

// ----------------------------------------------------------------------------
// 7. Approvals
// ----------------------------------------------------------------------------
export interface ApprovalRequest {
  id: string;
  requestType: ApprovalRequestType;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalRequestStatus;
  description: string;
  proposedValues: {
    discountPercent?: number;
    creditPeriodDays?: number;
    creditLimit?: number;
    depositAmount?: number;
    waiveDeposit?: boolean;
    flowStages?: string[];
    kycDocumentType?: string;
  };
  previousValues?: {
    discountPercent?: number;
    creditPeriodDays?: number;
    creditLimit?: number;
    depositAmount?: number;
  };
  justification: string;
  decisionBy?: string;
  decisionAt?: string;
  decisionNotes?: string;
}

// ----------------------------------------------------------------------------
// 8. Configuration Rules
// ----------------------------------------------------------------------------
export interface GtmConfiguration {
  partnerTypes: string[];
  requiredKycDocuments: {
    id: string;
    name: string;
    mandatoryFor: string[]; // Partner types
    requiresExpiryDate: boolean;
  }[];
  territoryLevelsMax: number;
  allowOverlappingZones: boolean;
  maxDiscountDeviationPercent: number;
  autoApproveKycWithValidGst: boolean;
  requireDirectorApprovalForDepositWaiver: boolean;
  pricingBasisOptions?: string[];
}
