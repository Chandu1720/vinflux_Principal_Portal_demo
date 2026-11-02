export interface ProductSpecificDiscount {
  productId: string;
  productName: string;
  sku: string;
  discountPercent: number;
  fixedPrice?: number;
}

export interface CommercialTermsHistoryItem {
  version: string;
  effectiveDate: string;
  discountPercent: number;
  creditLimit: number;
  modifiedBy: string;
  changeReason: string;
}

export interface TerritoryCommercialTerms {
  territoryId: string;
  territoryName: string;
  defaultDiscountPercent: number;
  creditLimit: number;
  creditPeriodDays: number;
  minimumSecurityDeposit: number;
  productDiscounts: ProductSpecificDiscount[];
  applicableRateRules: string[];
  effectiveFrom: string;
  effectiveTo?: string;
  version: string;
  status: 'Active' | 'Pending' | 'Superseded';
  history: CommercialTermsHistoryItem[];
}

export interface GeographicArea {
  id: string;
  country: string;
  zone: string;
  state: string;
  district?: string;
  city?: string;
  locality?: string;
  place?: string; // Level 6: Place / Micro-market Cluster
  pinCodes: string[]; // Level 7: 6-digit Postal / PIN Codes
  notes?: string;
}

export interface TerritoryHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
}

export interface TerritoryAssignmentPredicates {
  facilityTypes?: string[]; // e.g. Corporate Tertiary Hospital, Govt Medical College, Specialist Surgical
  minBedCount?: number; // e.g. 100, 250, 500
  requiredSpecialties?: string[]; // e.g. Orthopedic Surgery, Trauma Level-1, Robotic Suite
  minSpendCapacity?: number; // e.g. 10000000
}

export interface Territory {
  id: string;
  name: string;
  code: string;
  description?: string;
  country: string;
  zone: string;
  state: string;
  district?: string;
  city?: string;
  place?: string;
  pinCode?: string;
  parentTerritoryId?: string | null;
  parentTerritoryName?: string | null;
  assignedChannelId: string;
  assignedChannelName: string;
  assignedRouteId: string;
  assignedRouteName: string;
  lead: string;
  activePartnersCount: number;
  annualTarget: number;
  status: 'Active' | 'Inactive' | 'Draft' | 'Archived';
  lifecycleState?: 'Active' | 'Draft' | 'Archived';
  priorityScore?: number; // Integer score (1-100) for deterministic conflict resolution
  assignmentPredicates?: TerritoryAssignmentPredicates;
  targetAccountsCount?: number;
  coveredAccountsCount?: number;
  coverageRatio?: number; // e.g. 94.5% (Benchmark > 92.0%)
  conflictCount?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  geographicCoverage?: GeographicArea[];
  history?: TerritoryHistoryEntry[];
  defaultCommercialTerms: TerritoryCommercialTerms;
}

export interface PartnerPerformanceTier {
  id: string;
  name: string;
  code: string; // e.g. PLATINUM, GOLD, SILVER, BRONZE
  rank: number; // 1 = highest rank
  description: string;
  eligibilityCriteria: string[];
  benefits: string[];
  reviewFrequency: 'Monthly' | 'Quarterly' | 'Biannual' | 'Annual';
  status: 'Active' | 'Inactive';
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface DistributionLevel {
  id: string;
  code: string; // DL-1, DL-2, DL-3, DL-NA
  name: string;
  description: string;
  allowedPartnerTypes: string[];
  predecessorLevels?: string[];
  successorLevels?: string[];
  status: 'Active' | 'Inactive';
}

export interface PartnerClassificationHistoryEntry {
  id: string;
  timestamp: string;
  changedBy: string;
  fromTier: string;
  toTier: string;
  fromLevel: string;
  toLevel: string;
  reason: string;
}

export interface PartnerClassification {
  partnerType: string;
  performanceTierId: string;
  performanceTierName: string;
  distributionLevelId: string;
  distributionLevelName: string;
  effectiveDate: string;
  expiryDate?: string;
  reason: string;
  approvalStatus: 'Approved' | 'Pending Review' | 'Draft';
  proposedTierId?: string;
  proposedTierName?: string;
  reviewDue?: boolean;
  history?: PartnerClassificationHistoryEntry[];
}

export interface CommercialApprovalHistoryEntry {
  id: string;
  timestamp: string;
  action: 'Requested' | 'Approved' | 'Rejected' | 'Expired';
  actor: string;
  oldDiscountPercent: number;
  newDiscountPercent: number;
  comments: string;
}

export interface PartnerChannelAssignment {
  id: string;
  partnerId: string;
  partnerName?: string;
  partnerCode?: string;
  salesChannelId: string;
  salesChannelName: string;
  salesChannelCode: string;
  territoryScope?: string[];
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Active' | 'Inactive';
  commercialTermStatus: 'Standard' | 'Deviated — Pending Approval' | 'Deviated — Approved' | 'Deviated — Rejected' | 'Expired';
  commercialOverride?: {
    overrideDiscountPercent?: number | null;
    overrideCreditPeriodDays?: number | null;
    overrideCreditLimit?: number | null;
    overrideSecurityDeposit?: number | null;
    requestedDiscount?: number;
    channelDefaultDiscount: number;
    requestReason?: string;
    requestedBy?: string;
    requestedAt?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    approvalHistory?: CommercialApprovalHistoryEntry[];
  };
  notes?: string;
}

export interface SalesChannel {
  id: string;
  code: string;
  name: string;
  description: string;
  isReseller: boolean;
  standardMarginPercent: number;
  marginType: string;
  requiresDeposit: boolean;
  defaultCreditDays: number;
  status: 'Active' | 'Inactive';
  effectiveFrom?: string;
  effectiveTo?: string;
}

export type RouteParticipantType = 
  | 'Principal'
  | 'C&F Agent'
  | 'Super Stockist'
  | 'Regional Distributor'
  | 'Distributor'
  | 'Sub-Distributor'
  | 'Retailer'
  | 'Hospital'
  | 'Clinic'
  | 'Other Customer';

export interface RouteStepPartnerAssignment {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  territoryId?: string;
  territoryName?: string;
  salesChannelId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Active' | 'Inactive';
}

export interface RouteOperationalRules {
  inventoryOwnership: 'Principal Owned' | 'Title Transfer' | 'Consignment Custody' | 'Customer Owned';
  stockTransferResponsibility: 'Principal Dispatch' | 'C&F Warehouse Transit' | 'Distributor Last-Mile' | 'Direct Courier';
  invoicingParty: 'Principal' | 'Distributor' | 'Regional Distributor' | 'Super Stockist' | 'Retailer' | 'Third-Party Logistics';
  paymentCollection: 'Direct Bank Transfer to Principal' | 'Distributor Collection' | 'Escrow / Letter of Credit';
  creditLimitEnforced: boolean;
  applicablePriceTier: 'SLMC Cost' | 'Price to Super Stockist (PTS)' | 'Price to Distributor (PTD)' | 'Price to Retailer (PTR)' | 'Rate Contract / Institutional Price' | 'Maximum Retail Price (MRP)';
  nppaCeilingEnforced: boolean;
}

export interface DistributionRouteNode {
  id?: string;
  level: number;
  participantType?: RouteParticipantType;
  typeId: string;
  label: string;
  role: string;
  pricingPoint: string;
  isRequired?: boolean;
  assignedPartners?: RouteStepPartnerAssignment[];
  operationalRules?: RouteOperationalRules;
  notes?: string;
}

export interface RouteAuditEntry {
  id: string;
  timestamp: string;
  action: 'Created' | 'Modified' | 'Step Added' | 'Step Removed' | 'Partner Assigned' | 'Status Changed' | 'Duplicated';
  changedBy: string;
  field?: string;
  previousValue?: string;
  newValue?: string;
  description: string;
}

export interface DistributionRoute {
  id: string;
  code: string;
  name: string;
  description: string;
  routeType?: 'Direct' | 'Single-Tier Intermediary' | 'Multi-Tier Wholesale' | 'Consignment Distribution' | 'Institutional Tender';
  status: 'Active' | 'Inactive' | 'Draft' | 'Pending Approval';
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  commercialModel?: 'Title Transfer' | 'Consignment Stock' | 'Direct Hospital Invoicing' | 'Commission Agency';
  stages: string[];
  nodes: DistributionRouteNode[];
  applicableTerritoryIds: string[];
  applicableChannelIds?: string[];
  permittedPortfolios: string[];
  history?: RouteAuditEntry[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}
