/**
 * GTM V2 — Domain model.
 *
 * These types are independent from the legacy GTM module (src/types/gtm.ts).
 * Product Master entities are NOT redefined here — GTM V2 only stores
 * references (IDs) to portfolios / categories / sub-categories / products
 * that live in the existing Product Master (src/types/product.ts).
 */

export type RecordStatus = 'Active' | 'Inactive';

export interface AuditStamp {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/* ------------------------------------------------------------------ */
/* Territory                                                          */
/* ------------------------------------------------------------------ */

export interface Territory extends AuditStamp {
  id: string;
  code: string;
  name: string;
  description: string;
  parentId: string | null;
  status: RecordStatus;
}

/** Configuration-driven label per depth. Depth 0 = root. */
export interface TerritoryLevelLabel {
  depth: number;
  label: string;
}

export interface TerritoryNode extends Territory {
  depth: number;
  levelLabel: string;
  children: TerritoryNode[];
  path: string[]; // ancestor names incl. self
}

/* ------------------------------------------------------------------ */
/* Zone                                                               */
/* ------------------------------------------------------------------ */

export interface Zone extends AuditStamp {
  id: string;
  code: string;
  name: string;
  description: string;
  status: RecordStatus;
  territoryIds: string[];
}

/* ------------------------------------------------------------------ */
/* Sales Channel & Commercial Terms                                   */
/* ------------------------------------------------------------------ */

export interface CommercialValues {
  standardDiscountPct: number;
  creditPeriodDays: number;
  creditLimit: number;
  depositRequired: boolean;
  depositAmount: number;
}

export interface ChannelTerms extends CommercialValues {
  minOrderValue: number;
  maxOrderValue: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ChannelVersion {
  version: number;
  terms: ChannelTerms;
  changedAt: string;
  changedBy: string;
  changeNote: string;
}

/**
 * RESELL = buys, owns and resells stock (Super Stockist, Distributor, Dealer) → receives POs.
 * AGENT  = holds the company's stock and dispatches on its behalf (C&F) → POs go to the company.
 */
export type TradeModel = 'RESELL' | 'AGENT';

export interface SalesChannel extends AuditStamp {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Position in the distribution chain. Lower = closer to the company. Used by flow rules. */
  tierRank: number;
  /** Can this channel act as a final destination (customer) of a flow? */
  canBeEndpoint: boolean;
  /** How the channel trades. Defaults to RESELL when missing. */
  tradeModel?: TradeModel;
  status: RecordStatus;
  version: number;
  terms: ChannelTerms;
  history: ChannelVersion[];
}

/* ------------------------------------------------------------------ */
/* Sales Flow Topology (MASTER)                                       */
/* ------------------------------------------------------------------ */

export type StageKind = 'SOURCE' | 'CHANNEL';

export interface FlowStage {
  id: string;
  kind: StageKind;
  /** SOURCE stages reference the existing Warehouse Master (optional = "any company warehouse"). */
  warehouseId?: string | null;
  /** CHANNEL stages reference a configured sales channel. */
  channelId?: string | null;
  label: string;
  allowMultiplePartners: boolean;
}

export interface ProductScope {
  allProducts: boolean;
  portfolioIds: string[];
  categoryIds: string[];
  subCategoryIds: string[];
  productIds: string[];
}

export type FlowStatus = 'Draft' | 'Active' | 'Inactive';

export interface FlowVersionEntry {
  version: number;
  changedAt: string;
  changedBy: string;
  note: string;
  stageSummary: string;
}

export interface SalesFlow extends AuditStamp {
  id: string;
  code: string;
  name: string;
  description: string;
  status: FlowStatus;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  stages: FlowStage[];
  territoryIds: string[];
  zoneIds: string[];
  productScope: ProductScope;
  history: FlowVersionEntry[];
}

/* ------------------------------------------------------------------ */
/* Partner                                                            */
/* ------------------------------------------------------------------ */

export type PartnerStatus =
  | 'Draft'
  | 'KYC Pending'
  | 'KYC Under Review'
  | 'Approval Pending'
  | 'Active'
  | 'Suspended'
  | 'Rejected';

export type KycStatus = 'Pending' | 'Under Review' | 'Verified' | 'Rejected';

export interface KycDocument {
  id: string;
  docTypeId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: KycStatus;
  remarks: string;
  /** Licence / certificate number (for documents that expire, e.g. drug licence). */
  documentNo?: string;
  /** Last valid date (YYYY-MM-DD). Only for document types that track expiry. */
  validUntil?: string | null;
}

export interface PartnerAddress {
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

/** Result of verifying a GSTIN against the GST registry (GSTN via GSP). */
export interface GstVerification {
  gstin: string;
  legalName: string;
  tradeName: string;
  status: 'Active' | 'Cancelled' | 'Suspended';
  taxpayerType: string;
  constitution: string;
  registrationDate: string;
  stateCode: string;
  state: string;
  pan: string;
  address: PartnerAddress;
  verifiedAt: string;
  verifiedBy: string;
  source: string;
}

export interface Partner extends AuditStamp {
  id: string;
  code: string;
  name: string;
  partnerTypeId: string;
  contactPerson: string;
  email: string;
  phone: string;
  businessName: string;
  address: PartnerAddress;
  gst: string;
  pan: string;
  /** Registry details captured when the GSTIN was verified. */
  gstVerification?: GstVerification | null;
  /** Products the partner deals in (references to the existing Product Master). */
  productScope?: ProductScope;
  /** Set for hospitals / institutions added through the institution process. */
  institution?: InstitutionDetails | null;
  kycStatus: KycStatus;
  kycDocuments: KycDocument[];
  territoryIds: string[];
  flowIds: string[];
  status: PartnerStatus;
  submittedAt: string | null;
  activatedAt: string | null;
  /** Wizard step reached for drafts. */
  draftStep: number;
  /** Wizard payload not yet materialised (kept while Draft). */
  onboarding?: OnboardingExtras;
  /** Receivables snapshot and credit hold (credit limit itself comes from commercial terms). */
  credit?: PartnerCredit;
  /** Users invited to the partner portal. */
  portalUsers?: PortalUser[];
}

/** Credit hold placed on a partner. Placing it is immediate; releasing it needs approval. */
export interface CreditHold {
  reason: string;
  heldBy: string;
  heldAt: string;
  /** Set while a release request is waiting for approval. */
  releaseRequestId?: string | null;
}

/**
 * Receivables position of a partner. INTEGRATION POINT: outstanding / overdue come from the
 * ERP ledger (GET /partners/:id/ledger-summary); the prototype seeds them.
 */
export interface PartnerCredit {
  outstanding: number;
  overdue: number;
  asOf: string;
  hold: CreditHold | null;
}

export type PortalRole = 'Owner' | 'Ordering' | 'Accounts' | 'Viewer';
export type PortalUserStatus = 'Invited' | 'Active' | 'Revoked';

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: PortalRole;
  status: PortalUserStatus;
  invitedAt: string;
  invitedBy: string;
  lastSentAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

/**
 * One supply link of a partner: whom it buys from, for which portfolios, primary or backup.
 * COMPANY = buys directly from the principal (warehouse); PARTNER = an upstream partner.
 */
export interface SupplierLink {
  id: string;
  kind: 'COMPANY' | 'PARTNER';
  channelId: string | null;
  partnerId: string | null;
  warehouseId: string | null;
  role: 'PRIMARY' | 'BACKUP';
  /** Portfolios supplied through this link (empty = all of the partner's products). */
  portfolioIds: string[];
}

/** Direct customers of a partner (one level down). */
export interface CustomerLink {
  channelId: string;
  partnerIds: string[];
}

/**
 * One stage of a partner's ACTUAL route, built during onboarding.
 * SOURCE = company warehouse, SELF = the partner being onboarded, CHANNEL = another partner level.
 */
export interface RouteStage {
  id: string;
  kind: 'SOURCE' | 'SELF' | 'CHANNEL';
  channelId?: string | null;
  warehouseId?: string | null;
  partnerIds: string[];
  allowMultiplePartners: boolean;
}

export interface OnboardingFlowSelection {
  /** Neighbours-only model: the partner's own suppliers and direct customers. */
  suppliers?: SupplierLink[];
  customers?: CustomerLink[];
  /** Partner-specific route (route builder). When present it is the source of truth. */
  route?: RouteStage[];
  flowId: string;
  ownStageId: string;
  /** Stage the partner buys from (flow SOURCE stage = buys directly from the company). */
  supplierStageId?: string | null;
  /** Company warehouse that supplies the partner when buying direct. */
  supplyWarehouseId?: string | null;
  stageAssignments: { stageId: string; partnerIds: string[] }[];
  /** Legacy (pre-route builder) — no longer used for new onboardings. */
  skippedStageIds: string[];
  overrideReason: string;
}

export interface OnboardingCommercialOverride {
  channelId: string;
  values: Partial<CommercialValues>;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface OnboardingExtras {
  flowSelections: OnboardingFlowSelection[];
  commercialOverride: OnboardingCommercialOverride | null;
}

/**
 * ACTUAL partner relationship within a master flow. Never mutates the flow itself.
 * One mapping per (partner, flow). Stores which real partners occupy the other stages.
 */
export interface PartnerFlowMapping extends AuditStamp {
  id: string;
  partnerId: string;
  flowId: string;
  /** Flow version this mapping was created against (versioning safety). */
  flowVersion: number;
  ownStageId: string;
  /** Stage the partner buys from (SOURCE stage id = direct from company). */
  supplierStageId?: string | null;
  supplyWarehouseId?: string | null;
  /** Partner-specific route built in onboarding (preferred over stageAssignments when present). */
  route?: RouteStage[];
  /** Neighbours-only model (current): own suppliers and direct customers. */
  suppliers?: SupplierLink[];
  customers?: CustomerLink[];
  stageAssignments: { stageId: string; partnerIds: string[] }[];
  status: RecordStatus;
  effectiveFrom: string;
}

/** Partner-specific deviation from master topology (e.g. bypass a stage). */
export interface PartnerFlowOverride extends AuditStamp {
  id: string;
  partnerId: string;
  flowId: string;
  skippedStageIds: string[];
  reason: string;
  approvalStatus: ApprovalStatus;
}

/* ------------------------------------------------------------------ */
/* Commercial Terms (inheritance)                                     */
/* ------------------------------------------------------------------ */

export type TermScope = 'RELATIONSHIP' | 'PARTNER' | 'TERRITORY' | 'CHANNEL';
export type ApprovalStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';

export interface CommercialTermRecord extends AuditStamp {
  id: string;
  scope: Exclude<TermScope, 'CHANNEL'>;
  channelId: string;
  territoryId: string | null;
  partnerId: string | null;
  mappingId: string | null;
  values: Partial<CommercialValues>;
  overrideReason: string;
  requestedBy: string;
  approvalStatus: ApprovalStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export type CommercialField = keyof CommercialValues;

export interface ResolvedValue<T> {
  value: T;
  scope: TermScope;
  recordId: string | null;
  label: string;
}

export type ResolvedTerms = { [K in CommercialField]: ResolvedValue<CommercialValues[K]> };

/* ------------------------------------------------------------------ */
/* Approvals                                                          */
/* ------------------------------------------------------------------ */

export type ApprovalCategory =
  | 'PARTNER_ONBOARDING'
  | 'KYC_VERIFICATION'
  | 'DISCOUNT_OVERRIDE'
  | 'CREDIT_LIMIT_CHANGE'
  | 'CREDIT_PERIOD_EXTENSION'
  | 'DEPOSIT_WAIVER'
  | 'PARTNER_FLOW_OVERRIDE'
  | 'INSTITUTION_ONBOARDING'
  | 'CREDIT_HOLD_RELEASE'
  | 'CUSTOMER_TRANSFER';

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ApprovalStep {
  level: number;
  role: string;
  status: RequestStatus | 'Waiting';
  actedBy: string | null;
  actedAt: string | null;
  comments: string;
}

export interface ApprovalRequest {
  id: string;
  requestNo: string;
  category: ApprovalCategory;
  partnerId: string | null;
  entityType: 'PARTNER' | 'TERM' | 'FLOW_OVERRIDE' | 'ASSIGNMENT';
  entityId: string;
  summary: string;
  details: { label: string; from?: string; to: string }[];
  requestedBy: string;
  requestedAt: string;
  status: RequestStatus;
  currentLevel: number;
  steps: ApprovalStep[];
}

/* ------------------------------------------------------------------ */
/* Configuration                                                      */
/* ------------------------------------------------------------------ */

export interface PartnerType {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Sales channel this partner type operates in. */
  channelId: string;
  status: RecordStatus;
  /** 'full' = 7-step partner wizard; 'short' = one-screen form for end customers (hospitals, institutions). */
  onboardingForm?: 'full' | 'short';
}

export interface KycDocumentRequirement {
  id: string;
  name: string;
  description: string;
  /** Partner types for which this document is mandatory. Empty = optional for all. */
  mandatoryForPartnerTypeIds: string[];
  allowedFormats: string[];
  maxSizeMb: number;
  status: RecordStatus;
  /** Document has a validity date (drug licence, trade licence…) — expiry is tracked and alerted. */
  tracksExpiry?: boolean;
}

export interface EligibilityRules {
  requireChannelMatch: boolean;
  requireTerritoryOverlap: boolean;
  /** 'exact' = same territory id; 'hierarchy' = ancestor/descendant also matches */
  territoryMatchMode: 'exact' | 'hierarchy';
  requireActiveStatus: boolean;
  requireKycVerified: boolean;
}

export interface FlowRules {
  requireSourceFirst: boolean;
  minStages: number;
  maxStages: number | null;
  preventDuplicateChannel: boolean;
  enforceTierOrder: boolean;
  requireEndpointLast: boolean;
  blockedConnections: { fromChannelId: string; toChannelId: string }[];
}

export interface TerritoryRules {
  levelLabels: TerritoryLevelLabel[];
  maxDepth: number | null;
  uniqueNameWithinParent: boolean;
  codeUppercase: boolean;
}

export interface ApprovalWorkflow {
  category: ApprovalCategory;
  label: string;
  enabled: boolean;
  levels: string[];
}

export interface StatusDefinition {
  key: string;
  label: string;
  tone: BadgeTone;
  description: string;
}

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'slate' | 'cyan';

/* ------------------------------------------------------------------ */
/* Institution (hospital / end-customer) onboarding                   */
/* ------------------------------------------------------------------ */

export interface InstitutionDetails {
  institutionType: string;
  ownership: string;
  bedCount: number | null;
  registrationNo: string;
  drugLicenseNo: string;
  procurementContact: string;
  /** Hospital group / chain this hospital belongs to (e.g. "Yashoda Hospitals"). */
  hospitalGroup?: string;
}

export type FieldRequirement = 'required' | 'optional' | 'hidden';

export type InstitutionFieldKey =
  | 'gst' | 'pan' | 'contactPerson' | 'email' | 'phone' | 'address' | 'institutionType' | 'ownership'
  | 'bedCount' | 'registrationNo' | 'drugLicenseNo' | 'procurementContact' | 'hospitalGroup';

/** Settings of the SHORT onboarding form. Which partner types use it is set on each partner type. */
export interface InstitutionOnboardingConfig {
  fields: Record<InstitutionFieldKey, FieldRequirement>;
  /** When GSTIN is entered, it must be verified against the GST registry. */
  verifyGstWhenProvided: boolean;
  /** Raise an approval before the institution becomes Active. */
  requireApproval: boolean;
  institutionTypes: string[];
  ownershipTypes: string[];
}

export interface GtmConfiguration {
  partnerTypes: PartnerType[];
  kycDocuments: KycDocumentRequirement[];
  eligibility: EligibilityRules;
  flowRules: FlowRules;
  territoryRules: TerritoryRules;
  approvalWorkflows: ApprovalWorkflow[];
  partnerStatuses: StatusDefinition[];
  institutionOnboarding: InstitutionOnboardingConfig;
  compliance: ComplianceConfig;
  portal: PortalConfig;
  coverage: CoverageConfig;
}

export interface ComplianceConfig {
  /** Warn this many days before a tracked licence expires. */
  expiryAlertDays: number;
  /** An expired tracked licence blocks the partner from trading. */
  blockOnExpiredLicence: boolean;
  /** Warn when credit utilisation reaches this %. */
  creditWarnPct: number;
  /** Block trading automatically when outstanding exceeds the credit limit. */
  blockWhenOverLimit: boolean;
  /** Block trading automatically when any amount is overdue beyond the credit period. */
  blockWhenOverdue: boolean;
}

export interface PortalConfig {
  /** Partner types that get portal access. */
  partnerTypeIds: string[];
  /** Invite the partner's contact person as Owner as soon as the partner is activated. */
  autoInviteOnActivation: boolean;
  inviteValidityDays: number;
}

/* ------------------------------------------------------------------ */
/* Mock DB shape                                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Hospital coverage (customer assignment)                            */
/* ------------------------------------------------------------------ */

/**
 * Who serves an end customer (hospital) for a portfolio: the company directly or a partner.
 * One PRIMARY per hospital × portfolio; BACKUP optional. Ended assignments are kept as history.
 */
export interface CustomerAssignment extends AuditStamp {
  id: string;
  customerId: string;
  /** null = all portfolios. */
  portfolioId: string | null;
  servedBy: 'DIRECT' | 'PARTNER';
  partnerId: string | null;
  role: 'PRIMARY' | 'BACKUP';
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Performance follow-up: watch → improvement period → removal decision. */
  improvement?: { startedAt: string; until: string; note: string; by: string } | null;
  endReason?: string | null;
  endNotes?: string | null;
  endedBy?: string | null;
  /** Assignment that took over (transfer). */
  replacedById?: string | null;
  /** Pending transfer waiting for approval. */
  pendingTransferId?: string | null;
  /** Performance figures (from secondary sales / ERP once connected; sample data in the demo). */
  metrics?: CoverageMetrics;
}

export interface CoverageMetrics {
  /** Sales to this hospital in the last 90 days, ₹ lakh. */
  salesL: number;
  targetPct: number;
  fillRatePct: number;
  deliveryDays: number;
  complaints: number;
  paymentDays: number;
}

export interface HandoverChecklist {
  openOrders: boolean;
  stockAtPartner: boolean;
  consignmentKits: boolean;
  pendingClaims: boolean;
  receivables: boolean;
}

/** Transfer / removal request (approval-gated). Applied on approval. */
export interface CoverageTransfer extends AuditStamp {
  id: string;
  assignmentId: string;
  reason: string;
  notes: string;
  effectiveDate: string;
  /** New owner from the same date: DIRECT, a partner, or NONE (only when a backup takes over). */
  newOwner: 'DIRECT' | 'PARTNER' | 'NONE';
  newPartnerId: string | null;
  handover: HandoverChecklist;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface CoverageConfig {
  /** Only one primary per hospital × portfolio. */
  onePrimaryPerPortfolio: boolean;
  allowBackup: boolean;
  /** Score below this = "On watch". */
  watchBelow: number;
  /** Score below this = improvement period recommended. */
  improveBelow: number;
  improvementDays: number;
  transferReasons: string[];
  requireHandover: boolean;
}

export interface GtmDatabase {
  schemaVersion: number;
  territories: Territory[];
  zones: Zone[];
  channels: SalesChannel[];
  flows: SalesFlow[];
  partners: Partner[];
  mappings: PartnerFlowMapping[];
  flowOverrides: PartnerFlowOverride[];
  terms: CommercialTermRecord[];
  approvals: ApprovalRequest[];
  assignments: CustomerAssignment[];
  transfers: CoverageTransfer[];
  config: GtmConfiguration;
  counters: Record<string, number>;
}

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}
