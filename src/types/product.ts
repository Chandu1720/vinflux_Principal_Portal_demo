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

export interface CurrentUser {
  id: string;
  name: string;
  role: string;
  organization: string;
  permissions: {
    canManageConfig: boolean;
    canApproveProducts: boolean;
    canPublishProducts: boolean;
    canRetireProducts: boolean;
  };
}
