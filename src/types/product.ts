export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  size: string;
  thickness: string;
  side: string;
  status: string;
  gtin: string;
}

export interface ProductIdentifier {
  type: string;
  value: string;
  isPrimary: boolean;
  uom: string;
  source: string;
  status: string;
}

export interface UomHierarchyItem {
  level: string;
  uom: string;
  factor: number;
  isBase: boolean;
  isSales: boolean;
  isPurchase: boolean;
  dimensions: string;
  weight: string;
  barcode: string;
}

export interface ProductTrackingRules {
  mode: string;
  mfgDateRequired: boolean;
  expiryDateRequired: boolean;
  minShelfLifeDistributorDays: number;
  minShelfLifeInstitutionDays: number;
  udiDiRequired: boolean;
  qcInspectionRequired: boolean;
  sterilizationValidationDocRequired?: boolean;
  tempControl?: string;
  hazardous?: boolean;
}

export interface ProductDocument {
  name: string;
  type: string;
  version: string;
  effective: string;
  expiry: string;
  status: string;
  size: string;
}

export interface ProductPricingReference {
  isEngineConnected: boolean;
  engineSource: string;
  lastSync: string;
  mrp: number;
  currency: string;
  dealerTransferCap: number;
  institutionalTenderCap: number;
  govPriceCapEnforced: boolean;
  govNpddCeiling?: number;
  marginFloorPercent: number;
  priceListsLinked: string[];
}

export interface ProductIntegrationMapping {
  system: string;
  entityType: string;
  externalId: string;
  status: string;
  lastSync: string;
  mappingDirection: string;
}

export interface ProductChangeHistory {
  field: string;
  prevValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export interface ProductInventoryPolicy {
  inheritDefaults: boolean;
  minSafetyThreshold: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  safetyStockDays: number;
  engineFeed?: {
    connected: boolean;
    totalOnHand: number;
    availableToPromise: number;
    allocatedStock: number;
    inTransit: number;
    stockHealth: 'Normal' | 'Low Stock' | 'Critical';
    lastSync: string;
  };
}

/**
 * Industry packs: a product type belongs to one pack, and the pack decides which regulatory
 * section, defaults and validation rules apply. Packs are switched on/off in configuration.
 */
export type IndustryPackId = 'medical-devices' | 'fmcg' | 'general';

export interface IndustryPack {
  id: IndustryPackId;
  name: string;
  description: string;
  enabled: boolean;
  /** Regulatory section shown in the product form. */
  regulatory: 'cdsco' | 'legal-metrology' | null;
  defaultTracking: 'Batch + Serial' | 'Batch / Lot' | 'Serial' | 'None';
  defaultHsn: string;
  defaultTax: string;
}

/** FMCG declarations (Legal Metrology (Packaged Commodities) Rules 2011, FSSAI for food). */
export interface FmcgDetails {
  netQuantity: number | null;
  netQuantityUnit: 'g' | 'kg' | 'ml' | 'L' | 'pcs';
  shelfLifeMonths: number | null;
  countryOfOrigin: string;
  consumerCare: string;
  unitsPerCase: number | null;
  isFood: boolean;
  fssaiLicenceNo: string;
  fssaiValidUntil: string;
  foodMark: 'Veg' | 'Non-veg' | '';
}

/** CDSCO (Medical Devices Rules 2017) registration of the product. */
export type RiskClass = 'A' | 'B' | 'C' | 'D';
export type LicenceType = 'Manufacturing (MD-5)' | 'Manufacturing (MD-9)' | 'Import (MD-15)' | 'Not required';

export interface ProductRegulatory {
  riskClass: RiskClass;
  licenceType: LicenceType;
  licenceNo: string;
  /** YYYY-MM-DD */
  licenceValidUntil: string;
  implantable: boolean;
  sterile: boolean;
  /** Shelf life from manufacture; null = no expiry (e.g. reusable instruments). */
  shelfLifeMonths: number | null;
}

/** One line of an instrument set / kit. */
export interface KitComponent {
  productId: string;
  variantSku: string | null;
  qty: number;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  portfolioId: string;
  categoryId: string;
  subCategoryId: string;
  principalId: string;
  brand: string;
  productTypeId: string;
  baseUom: string;
  lifecycleStatus: 'Active' | 'Draft' | 'Pending Approval' | 'Retired';
  approvalStatus: 'Approved' | 'Pending Approval' | 'Draft' | 'Rejected';
  trackingMode: 'Batch + Serial' | 'Batch / Lot' | 'Serial' | 'None';
  hsnCode: string;
  taxRate: string;
  sourceSystem: string;
  externalRef: string;
  hasVariants: boolean;
  variantCount: number;
  updatedAt: string;
  updatedBy: string;
  attributes: Record<string, string>;
  inventoryPolicy: ProductInventoryPolicy;
  variants: ProductVariant[];
  identifiers: ProductIdentifier[];
  uomHierarchy: UomHierarchyItem[];
  trackingRules: ProductTrackingRules;
  documents: ProductDocument[];
  pricingReference: ProductPricingReference;
  integrationMapping: ProductIntegrationMapping[];
  changeHistory: ProductChangeHistory[];
  regulatory?: ProductRegulatory;
  /** Instrument set / kit made of other products. */
  isKit?: boolean;
  kitComponents?: KitComponent[];
  /** Maker-checker trail. */
  submittedBy?: string | null;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  retireReason?: string | null;
  /** FMCG pack declarations. */
  fmcg?: FmcgDetails;
  /** Names of the variant axes (e.g. ["Pack Size", "Flavour"]); size/thickness/side hold the values in order. */
  variantAxes?: string[];
}

export interface SubCategory {
  id: string;
  name: string;
  code: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  subCategories: SubCategory[];
}

export interface Portfolio {
  id: string;
  name: string;
  code: string;
  description: string;
  categories: Category[];
}

export interface ProductType {
  id: string;
  name: string;
  code: string;
  nature: string;
  defaultTracking: string;
  isStockable: boolean;
  requiresPackaging: boolean;
  requiresRegulatoryDossier: boolean;
  variantAllowed: boolean;
  attributeTemplate: string;
  defaultMinStockThreshold: number;
  /** Industry pack this type belongs to (defaults to medical devices for older records). */
  industryPackId?: IndustryPackId;
}

export interface ProductTemplate {
  id: string;
  name: string;
  code: string;
  applicableTypes: string[];
  attributeCount: number;
  description: string;
}

export interface AttributeDefinition {
  id: string;
  name: string;
  type: 'select' | 'text' | 'number';
  options?: string[];
  defaultValue?: string;
  unit?: string;
  required: boolean;
  isVariant: boolean;
  group: string;
}

export interface TrackingRuleTemplate {
  id: string;
  name: string;
  mode: string;
  mfgDateRequired: boolean;
  expiryDateRequired: boolean;
  udiDiRequired: boolean;
  qcRequired: boolean;
  minDistDays: number;
  minInstDays: number;
}

export interface ValidationRule {
  id: string;
  name: string;
  rule: string;
  enforced: boolean;
  severity: 'Blocking Error' | 'Warning';
}

export interface UomPackagingDefault {
  uom: string;
  type: string;
  abbreviation: string;
  description: string;
  factor: number;
}

export interface InventoryPolicyDefaults {
  defaultSafetyStockDays: number;
  defaultMinSafetyThreshold: number;
  defaultReorderPoint: number;
  defaultReorderQty: number;
  defaultLeadTimeDays: number;
  lowStockAlertMarginPercent: number;
  policiesByProductType: Record<string, {
    minThreshold: number;
    reorderPoint: number;
    reorderQty: number;
    safetyDays: number;
    leadTime: number;
  }>;
}

export interface Principal {
  id: string;
  name: string;
  code: string;
  country: string;
  role: string;
}

export type PermResource = 'products' | 'gtm' | 'pricing' | 'inventory' | 'data' | 'platform';
export type PermAction = 'view' | 'edit' | 'approve' | 'configure';

export interface CurrentUser {
  id: string;
  name: string;
  role: string;
  organization: string;
  email?: string;
  /** Booleans derived from the user's roles (kept for existing screens). */
  permissions: {
    canManageConfig: boolean;
    canApproveProducts: boolean;
    canPublishProducts: boolean;
    canRetireProducts: boolean;
    canApproveGtm?: boolean;
    canEditPricing?: boolean;
    canApprovePricing?: boolean;
    canConfigurePricing?: boolean;
    canEditInventory?: boolean;
    canImport?: boolean;
    canConfigurePlatform?: boolean;
    canManageUsers?: boolean;
  };
  /** Full permission matrix from roles (resource → allowed actions). */
  matrix?: Partial<Record<PermResource, PermAction[]>>;
  /** Data scope; empty list = all. */
  scope?: { principalIds: string[]; territoryIds: string[]; warehouseIds: string[] };
}
