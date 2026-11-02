import type {
  Product,
  Portfolio,
  ProductType,
  ProductTemplate,
  AttributeDefinition,
  TrackingRuleTemplate,
  ValidationRule,
  UomPackagingDefault,
  InventoryPolicyDefaults,
  Principal,
  CurrentUser
} from '../types/product.ts';

export const initialCurrentUser: CurrentUser = {
  id: "usr-001",
  name: "Dr. Arvind Rao",
  role: "Lead Regulatory Admin",
  organization: "Biorad Medisys Private Limited",
  permissions: {
    canManageConfig: true,
    canApproveProducts: true,
    canPublishProducts: true,
    canRetireProducts: true
  }
};

export const initialPrincipals: Principal[] = [
  { id: "princ-biorad", name: "Biorad Medisys Private Limited", code: "BIORAD-MED", country: "India", role: "Manufacturer & Principal" },
  { id: "princ-zimmer", name: "Apex Surgical Ortho GmbH", code: "APEX-ORTHO", country: "Germany", role: "Technology Principal" },
  { id: "princ-robotics", name: "OmniNav Surgical Robotics Corp", code: "OMNI-NAV", country: "USA", role: "Original Equipment Manufacturer" }
];

export const initialPortfolios: Portfolio[] = [
  {
    id: "port-arthro",
    name: "Arthroplasty — Joint Replacement",
    code: "PORT-ARTH",
    description: "Joint reconstructive implants, revision systems, and instrumentation",
    categories: [
      {
        id: "cat-tkr",
        name: "Genius Evocon Revision TKR",
        code: "CAT-TKR-REV",
        description: "Revision total knee replacement systems and modular augments",
        subCategories: [
          { id: "sub-knee-prim", name: "Primary Knee Replacement", code: "SUB-KNEE-PRI", description: "Standard primary bicondylar knee arthroplasty" },
          { id: "sub-knee-rev", name: "Knee Replacement (Revision)", code: "SUB-KNEE-REV", description: "Modular tibial trays, augments, and stem extensions" },
          { id: "sub-knee-uni", name: "Unicondylar Knee System", code: "SUB-KNEE-UNI", description: "Partial unicompartmental knee replacement" }
        ]
      },
      {
        id: "cat-thr",
        name: "Genius Hip Reconstruction",
        code: "CAT-THR-HIP",
        description: "Primary and revision total hip replacement systems",
        subCategories: [
          { id: "sub-hip-stem", name: "Femoral Stems", code: "SUB-HIP-STEM", description: "Cemented and press-fit femoral stems" },
          { id: "sub-hip-cup", name: "Acetabular Cups", code: "SUB-HIP-CUP", description: "Porous coated hemispherical cups and liners" }
        ]
      }
    ]
  },
  {
    id: "port-trauma",
    name: "Trauma & Extremities",
    code: "PORT-TRM",
    description: "Bone fixation plates, intramedullary nails, external fixators",
    categories: [
      {
        id: "cat-plates",
        name: "Anatomical Locking Plates",
        code: "CAT-PLT",
        description: "Low-profile titanium anatomical osteosynthesis plates",
        subCategories: [
          { id: "sub-distal-femur", name: "Distal Femur Fixation", code: "SUB-DFEM", description: "Retrograde and lateral distal femur locking plates" },
          { id: "sub-prox-tibia", name: "Proximal Tibia Plating", code: "SUB-PTIB", description: "Medial and lateral proximal tibial buttress plates" }
        ]
      }
    ]
  },
  {
    id: "port-robotics",
    name: "Surgical Robotics & Instrumentation",
    code: "PORT-ROBO",
    description: "Capital equipment, power tools, navigational trackers",
    categories: [
      {
        id: "cat-power-tools",
        name: "Smart Power Systems",
        code: "CAT-PWR",
        description: "Autoclavable electric and battery orthopedic surgical handpieces",
        subCategories: [
          { id: "sub-driver", name: "Precision Surgical Drivers", code: "SUB-DRV", description: "Modular rotary drivers with brushless torque feedback" },
          { id: "sub-saw", name: "Oscillating Bone Saws", code: "SUB-SAW", description: "High-speed sagittal and oscillating resection saws" }
        ]
      }
    ]
  },
  {
    id: "port-consumables",
    name: "Hospital Consumables & Bio-Materials",
    code: "PORT-CSM",
    description: "Sterile packaging, surgical hemostats, drapes and bioceramics",
    categories: [
      {
        id: "cat-hemostats",
        name: "Hemostatic Agents",
        code: "CAT-HEMO",
        description: "Topical and matrix hemostatic matrices for bleeding control",
        subCategories: [
          { id: "sub-gauze", name: "Bio-Resorbable Gauze", code: "SUB-GAUZE", description: "Oxidized regenerated cellulose hemostatic pads" },
          { id: "sub-gel", name: "Flowable Gel Matrices", code: "SUB-GEL", description: "Thrombin and gelatin flowable matrix kits" }
        ]
      }
    ]
  },
  {
    id: "port-digital",
    name: "Digital Health & Software",
    code: "PORT-DGT",
    description: "Pre-operative planning software, AI surgical licenses",
    categories: [
      {
        id: "cat-planning-sw",
        name: "3D Surgical Simulation Suite",
        code: "CAT-SW-SIM",
        description: "Cloud-based pre-operative CT segmentation and 3D resection planning",
        subCategories: [
          { id: "sub-cloud-license", name: "Cloud Planning Subscription", code: "SUB-LIC-CLD", description: "Annual named surgeon recurring cloud token" },
          { id: "sub-onprem", name: "Workstation Node License", code: "SUB-LIC-WRK", description: "Perpetual hospital DICOM station license" }
        ]
      }
    ]
  }
];

export const initialProductTypes: ProductType[] = [
  {
    id: "type-implant",
    name: "Implantable Medical Device",
    code: "IMPLANT",
    nature: "Physical Goods",
    defaultTracking: "Batch + Serial",
    isStockable: true,
    requiresPackaging: true,
    requiresRegulatoryDossier: true,
    variantAllowed: true,
    attributeTemplate: "tpl-implant",
    defaultMinStockThreshold: 50
  },
  {
    id: "type-equipment",
    name: "Capital Equipment & Power Tool",
    code: "EQUIPMENT",
    nature: "Physical Asset",
    defaultTracking: "Serial",
    isStockable: true,
    requiresPackaging: true,
    requiresRegulatoryDossier: true,
    variantAllowed: false,
    attributeTemplate: "tpl-equipment",
    defaultMinStockThreshold: 5
  },
  {
    id: "type-consumable",
    name: "Single-Use Consumable",
    code: "CONSUMABLE",
    nature: "Physical Goods",
    defaultTracking: "Batch / Lot",
    isStockable: true,
    requiresPackaging: true,
    requiresRegulatoryDossier: true,
    variantAllowed: true,
    attributeTemplate: "tpl-consumable",
    defaultMinStockThreshold: 200
  },
  {
    id: "type-digital",
    name: "Digital Product / Software License",
    code: "DIGITAL",
    nature: "Digital Asset",
    defaultTracking: "None",
    isStockable: false,
    requiresPackaging: false,
    requiresRegulatoryDossier: false,
    variantAllowed: false,
    attributeTemplate: "tpl-digital",
    defaultMinStockThreshold: 0
  },
  {
    id: "type-service",
    name: "Professional Service / SLA",
    code: "SERVICE",
    nature: "Service",
    defaultTracking: "None",
    isStockable: false,
    requiresPackaging: false,
    requiresRegulatoryDossier: false,
    variantAllowed: false,
    attributeTemplate: "tpl-service",
    defaultMinStockThreshold: 0
  }
];

export const initialProductTemplates: ProductTemplate[] = [
  {
    id: "tpl-implant",
    name: "Orthopaedic Joint Implant Structure",
    code: "TPL-ORTH-IMP",
    applicableTypes: ["type-implant"],
    attributeCount: 6,
    description: "Standard structural parameters for femoral, tibial, and acetabular components."
  },
  {
    id: "tpl-equipment",
    name: "Electro-Mechanical Power Tool Template",
    code: "TPL-PWR-TOOL",
    applicableTypes: ["type-equipment"],
    attributeCount: 3,
    description: "Electrical specifications, peak torque ratings, and enclosure IP sealing levels."
  },
  {
    id: "tpl-consumable",
    name: "Sterile Bio-Absorbable Consumable Template",
    code: "TPL-BIO-CSM",
    applicableTypes: ["type-consumable"],
    attributeCount: 2,
    description: "Pad dimensions, hemostatic absorption rate, and sterile barrier parameters."
  },
  {
    id: "tpl-digital",
    name: "SaaS & Digital Software License Template",
    code: "TPL-SAAS-LIC",
    applicableTypes: ["type-digital"],
    attributeCount: 2,
    description: "Concurrency seat types, cloud host region, and activation token parameters."
  }
];

export const initialAttributeTemplates: Record<string, AttributeDefinition[]> = {
  "tpl-implant": [
    { id: "attr-material", name: "Biomaterial", type: "select", options: ["Titanium Alloy (Ti-6Al-4V)", "Cobalt Chromium (CoCrMo)", "Ultra-High Molecular Weight Polyethylene (UHMWPE)", "Oxinium"], required: true, isVariant: false, group: "Technical Specifications" },
    { id: "attr-size", name: "Implant Size", type: "select", options: ["Size 1", "Size 2", "Size 3", "Size 4", "Size 5", "Size 6"], required: true, isVariant: true, group: "Dimensional Parameters" },
    { id: "attr-thickness", name: "Augment Thickness", type: "select", options: ["5 mm", "10 mm", "15 mm", "20 mm"], unit: "mm", required: true, isVariant: true, group: "Dimensional Parameters" },
    { id: "attr-side", name: "Laterality / Side", type: "select", options: ["Universal", "Left", "Right"], required: true, isVariant: true, group: "Anatomical Fit" },
    { id: "attr-sterility", name: "Sterilization Mode", type: "select", options: ["Gamma Radiation (25 kGy)", "Ethylene Oxide (EtO)", "Autoclave / Steam"], required: true, isVariant: false, group: "Compliance & Sterility" },
    { id: "attr-fixation", name: "Fixation Modality", type: "select", options: ["Cemented", "Porous Coated / Press-Fit", "HA Hydroxyapatite Coated"], required: true, isVariant: false, group: "Technical Specifications" }
  ],
  "tpl-equipment": [
    { id: "attr-volt", name: "Operating Voltage", type: "select", options: ["14.4V Li-Ion", "18.0V High-Draw", "100-240V AC Mains"], required: true, isVariant: false, group: "Electrical Characteristics" },
    { id: "attr-torque", name: "Peak Torque Rating", type: "text", defaultValue: "13.5 Nm", unit: "Nm", required: true, isVariant: false, group: "Mechanical Performance" },
    { id: "attr-ip-rating", name: "Enclosure Ingress Protection", type: "select", options: ["IPX6 Washable", "IPX8 Submersible Autoclavable", "IP54"], required: true, isVariant: false, group: "Compliance & Sterility" }
  ],
  "tpl-consumable": [
    { id: "attr-dim", name: "Pad Dimensions", type: "select", options: ["5 x 5 cm", "10 x 10 cm", "10 x 20 cm"], required: true, isVariant: true, group: "Dimensional Parameters" },
    { id: "attr-absorb", name: "Hemostatic Absorption Speed", type: "select", options: ["Under 2 minutes", "3 - 5 minutes", "Immediate matrix bind"], required: true, isVariant: false, group: "Clinical Efficacy" }
  ],
  "tpl-digital": [
    { id: "attr-seat-type", name: "License Concurrency", type: "select", options: ["Single Named Surgeon", "Floating Hospital Seat", "Site Enterprise Unlimited"], required: true, isVariant: false, group: "Licensing Parameters" },
    { id: "attr-cloud-region", name: "HIPAA Cloud Region", type: "select", options: ["Asia-South (Mumbai)", "US-East (N. Virginia)", "EU-Central (Frankfurt)"], required: true, isVariant: false, group: "Deployment" }
  ]
};

export const initialTrackingRuleTemplates: TrackingRuleTemplate[] = [
  { id: "tr-implant", name: "High-Traceability Medical Device (Class III/MDR)", mode: "Batch + Serial", mfgDateRequired: true, expiryDateRequired: true, udiDiRequired: true, qcRequired: true, minDistDays: 365, minInstDays: 180 },
  { id: "tr-sterile-csm", name: "Sterile Single-Use Consumable", mode: "Batch / Lot", mfgDateRequired: true, expiryDateRequired: true, udiDiRequired: true, qcRequired: true, minDistDays: 730, minInstDays: 365 },
  { id: "tr-equipment", name: "Durable Capital Asset / Power Tool", mode: "Serial", mfgDateRequired: true, expiryDateRequired: false, udiDiRequired: true, qcRequired: true, minDistDays: 0, minInstDays: 0 },
  { id: "tr-none", name: "Standard Non-Tracked (Software / SLA)", mode: "None", mfgDateRequired: false, expiryDateRequired: false, udiDiRequired: false, qcRequired: false, minDistDays: 0, minInstDays: 0 }
];

export const initialValidationRules: ValidationRule[] = [
  { id: "val-udi", name: "Mandatory UDI for Implantable Devices", rule: "If Product Type = Implant, UDI-DI is required before approval", enforced: true, severity: "Blocking Error" },
  { id: "val-hsn", name: "HSN / Commodity Code Required", rule: "8-digit HSN code required for all physical stockable goods", enforced: true, severity: "Blocking Error" },
  { id: "val-uom-conv", name: "Packaging UOM Factor Consistency", rule: "Outer pack factor must be exact integer multiple of inner pack factor", enforced: true, severity: "Warning" },
  { id: "val-unique-code", name: "Global Master Code Uniqueness", rule: "Product Code and primary GTIN must be globally unique across principals", enforced: true, severity: "Blocking Error" }
];

export const initialUomPackagingDefaults: UomPackagingDefault[] = [
  { uom: "Each", type: "Base", abbreviation: "EA", description: "Single individual operational unit", factor: 1 },
  { uom: "Set / Tray", type: "Base Kit", abbreviation: "SET", description: "Sterile instrument tray or modular assembly", factor: 1 },
  { uom: "Box (5 Each)", type: "Inner Pack", abbreviation: "BX5", description: "Secondary sterile or display box", factor: 5 },
  { uom: "Box (10 Each)", type: "Inner Pack", abbreviation: "BX10", description: "Standard dispenser box", factor: 10 },
  { uom: "Carton (20 Each)", type: "Shipper Case", abbreviation: "CT20", description: "Outer corrugated freight carton", factor: 20 },
  { uom: "Pack", type: "Base", abbreviation: "PK", description: "Sterile foil or blister pack", factor: 1 },
  { uom: "License", type: "Electronic", abbreviation: "LIC", description: "Electronic named seat / annual token", factor: 1 }
];

export const initialInventoryPolicyDefaults: InventoryPolicyDefaults = {
  defaultSafetyStockDays: 45,
  defaultMinSafetyThreshold: 50,
  defaultReorderPoint: 75,
  defaultReorderQty: 100,
  defaultLeadTimeDays: 30,
  lowStockAlertMarginPercent: 20,
  policiesByProductType: {
    "type-implant": { minThreshold: 50, reorderPoint: 75, reorderQty: 100, safetyDays: 60, leadTime: 45 },
    "type-equipment": { minThreshold: 5, reorderPoint: 8, reorderQty: 10, safetyDays: 90, leadTime: 60 },
    "type-consumable": { minThreshold: 200, reorderPoint: 350, reorderQty: 500, safetyDays: 30, leadTime: 15 },
    "type-digital": { minThreshold: 0, reorderPoint: 0, reorderQty: 0, safetyDays: 0, leadTime: 0 },
    "type-service": { minThreshold: 0, reorderPoint: 0, reorderQty: 0, safetyDays: 0, leadTime: 0 }
  }
};

export const initialProducts: Product[] = [
  {
    id: "PRD-EVOCON-001",
    name: "GENIUS EVOCON TIBIAL TRAY FULL AUGMENT SIZE 3 — THICKNESS 10MM",
    code: "8903209039234",
    description: "Revision Total Knee Replacement augment designed for severe tibial proximal bone loss. Titanium alloy with porous structure for osseointegration.",
    portfolioId: "port-arthro",
    categoryId: "cat-tkr",
    subCategoryId: "sub-knee-rev",
    principalId: "princ-biorad",
    brand: "Genius Evocon",
    productTypeId: "type-implant",
    baseUom: "Each",
    lifecycleStatus: "Active",
    approvalStatus: "Approved",
    trackingMode: "Batch + Serial",
    hsnCode: "90213100",
    taxRate: "5%",
    sourceSystem: "SAP S/4HANA (Direct Sync)",
    externalRef: "MAT-SAP-994820",
    hasVariants: true,
    variantCount: 6,
    updatedAt: "2026-10-28 16:40",
    updatedBy: "Dr. Arvind Rao (Lead Regulatory)",
    attributes: {
      "attr-material": "Titanium Alloy (Ti-6Al-4V)",
      "attr-size": "Size 3",
      "attr-thickness": "10 mm",
      "attr-side": "Left",
      "attr-sterility": "Gamma Radiation (25 kGy)",
      "attr-fixation": "Porous Coated / Press-Fit"
    },
    inventoryPolicy: {
      inheritDefaults: true,
      minSafetyThreshold: 50,
      reorderPoint: 75,
      reorderQty: 100,
      leadTimeDays: 45,
      safetyStockDays: 60,
      engineFeed: {
        connected: true,
        totalOnHand: 142,
        availableToPromise: 128,
        allocatedStock: 14,
        inTransit: 50,
        stockHealth: "Normal",
        lastSync: "2026-10-29 10:15"
      }
    },
    variants: [
      { id: "VAR-001-A", sku: "EVO-TRAY-SZ2-10L", name: "Tray Augment Sz 2 / 10mm / Left", size: "Size 2", thickness: "10 mm", side: "Left", status: "Active", gtin: "08903209039201" },
      { id: "VAR-001-B", sku: "EVO-TRAY-SZ2-10R", name: "Tray Augment Sz 2 / 10mm / Right", size: "Size 2", thickness: "10 mm", side: "Right", status: "Active", gtin: "08903209039202" },
      { id: "VAR-001-C", sku: "EVO-TRAY-SZ3-10L", name: "Tray Augment Sz 3 / 10mm / Left", size: "Size 3", thickness: "10 mm", side: "Left", status: "Active", gtin: "08903209039234" },
      { id: "VAR-001-D", sku: "EVO-TRAY-SZ3-10R", name: "Tray Augment Sz 3 / 10mm / Right", size: "Size 3", thickness: "10 mm", side: "Right", status: "Active", gtin: "08903209039235" },
      { id: "VAR-001-E", sku: "EVO-TRAY-SZ3-15L", name: "Tray Augment Sz 3 / 15mm / Left", size: "Size 3", thickness: "15 mm", side: "Left", status: "Active", gtin: "08903209039236" },
      { id: "VAR-001-F", sku: "EVO-TRAY-SZ4-10L", name: "Tray Augment Sz 4 / 10mm / Left", size: "Size 4", thickness: "10 mm", side: "Left", status: "Draft", gtin: "08903209039241" }
    ],
    identifiers: [
      { type: "GS1-128 / GTIN", value: "08903209039234", isPrimary: true, uom: "Each (Unit)", source: "Manufacturer GS1 Registry", status: "Active" },
      { type: "FDA / MDR UDI-DI", value: "D-08903209039234-A1", isPrimary: false, uom: "Each (Unit)", source: "EUDAMED / GUDID", status: "Active" },
      { type: "GS1 DataMatrix", value: "(01)08903209039234(17)311231(10)LOT8891(21)SN772910", isPrimary: false, uom: "Each (Unit)", source: "Direct Laser Etching", status: "Active" },
      { type: "Carton GTIN-14", value: "18903209039231", isPrimary: false, uom: "Shipper Carton (20 Units)", source: "VinFlux Auto-Gen", status: "Active" }
    ],
    uomHierarchy: [
      { level: "Unit / Each", uom: "Each", factor: 1, isBase: true, isSales: true, isPurchase: false, dimensions: "12 x 8 x 3 cm", weight: "180 g", barcode: "08903209039234" },
      { level: "Inner Sterile Box", uom: "Box (5 Each)", factor: 5, isBase: false, isSales: true, isPurchase: false, dimensions: "25 x 18 x 14 cm", weight: "1.1 kg", barcode: "08903209039258" },
      { level: "Shipper Carton", uom: "Carton (20 Each)", factor: 20, isBase: false, isSales: false, isPurchase: true, dimensions: "55 x 40 x 30 cm", weight: "4.8 kg", barcode: "18903209039231" }
    ],
    trackingRules: {
      mode: "Batch + Serial",
      mfgDateRequired: true,
      expiryDateRequired: true,
      minShelfLifeDistributorDays: 365,
      minShelfLifeInstitutionDays: 180,
      udiDiRequired: true,
      qcInspectionRequired: true,
      sterilizationValidationDocRequired: true,
      tempControl: "Ambient (15°C - 30°C)",
      hazardous: false
    },
    documents: [
      { name: "CE_Mark_Conformity_Certificate_MDR2026.pdf", type: "Regulatory Approval", version: "Rev 4.1", effective: "2026-01-15", expiry: "2031-01-14", status: "Active", size: "2.4 MB" },
      { name: "Instructions_For_Use_IFU_Evocon_TKR.pdf", type: "Instructions for Use (IFU)", version: "v3.0", effective: "2026-03-01", expiry: "--", status: "Active", size: "1.8 MB" },
      { name: "CAD_Engineering_Specification_Tray_Rev.pdf", type: "Technical Data Sheet", version: "v2.2", effective: "2025-11-20", expiry: "--", status: "Active", size: "6.1 MB" },
      { name: "Biocompatibility_ISO10993_Testing_Report.pdf", type: "Lab Validation", version: "v1.0", effective: "2025-08-10", expiry: "2030-08-09", status: "Active", size: "4.5 MB" }
    ],
    pricingReference: {
      isEngineConnected: true,
      engineSource: "VinFlux Pricing Engine v3.2",
      lastSync: "2026-10-28 09:15",
      mrp: 48500,
      currency: "INR (₹)",
      dealerTransferCap: 32200,
      institutionalTenderCap: 29800,
      govPriceCapEnforced: true,
      govNpddCeiling: 54000,
      marginFloorPercent: 18.5,
      priceListsLinked: ["Gov Hospital Rate Contract 2026", "Tier-1 Metro Private Hospitals", "Standard Distributor South Zone"]
    },
    integrationMapping: [
      { system: "SAP S/4HANA Enterprise", entityType: "Material Master", externalId: "MAT-SAP-994820", status: "Synchronized", lastSync: "2026-10-28 16:40", mappingDirection: "Bi-directional" },
      { system: "GS1 Global Registry", entityType: "GTIN Barcode Record", externalId: "8903209039234", status: "Synchronized", lastSync: "2026-10-25 11:20", mappingDirection: "Outbound" },
      { system: "EUDAMED Medical DB", entityType: "Basic UDI-DI Dossier", externalId: "D-08903209039234-A1", status: "Synchronized", lastSync: "2026-10-20 14:00", mappingDirection: "Outbound" }
    ],
    changeHistory: [
      { field: "Tax Classification", prevValue: "HSN 90211000 (12%)", newValue: "HSN 90213100 (5%)", changedBy: "Sunil K. (Tax Compliance)", changedAt: "2026-10-26 14:32", reason: "Updated to aligned orthopaedic artificial joints classification" },
      { field: "Packaging Hierarchy", prevValue: "1 Each, 1 Carton (10)", newValue: "1 Each, 1 Box (5), 1 Carton (20)", changedBy: "M. Raman (Supply Chain)", changedAt: "2026-10-20 10:15", reason: "Standardized secondary packaging for sterile transport" },
      { field: "Lifecycle Status", prevValue: "Pending Approval", newValue: "Approved", changedBy: "Dr. Arvind Rao", changedAt: "2026-10-18 17:00", reason: "MDR audit documentation approved" }
    ]
  },
  {
    id: "PRD-ROBO-002",
    name: "Smart Torque Digital Surgical Driver V4 (High-Speed Autoclavable)",
    code: "8904101902811",
    description: "Brushless digital surgical bone driver with live brushless torque feedback and telemetry logging for orthopaedic reconstructive surgeries.",
    portfolioId: "port-robotics",
    categoryId: "cat-power-tools",
    subCategoryId: "sub-driver",
    principalId: "princ-robotics",
    brand: "OmniDrive Precision",
    productTypeId: "type-equipment",
    baseUom: "Set / Tray",
    lifecycleStatus: "Active",
    approvalStatus: "Approved",
    trackingMode: "Serial",
    hsnCode: "90189084",
    taxRate: "12%",
    sourceSystem: "Oracle Fusion ERP",
    externalRef: "EQ-ORCL-77192",
    hasVariants: false,
    variantCount: 1,
    updatedAt: "2026-10-27 11:20",
    updatedBy: "Sarah Jenkins (Equipment Operations)",
    attributes: {
      "attr-volt": "18.0V High-Draw",
      "attr-torque": "13.5 Nm",
      "attr-ip-rating": "IPX8 Submersible Autoclavable"
    },
    inventoryPolicy: {
      inheritDefaults: true,
      minSafetyThreshold: 5,
      reorderPoint: 8,
      reorderQty: 10,
      leadTimeDays: 60,
      safetyStockDays: 90,
      engineFeed: {
        connected: true,
        totalOnHand: 12,
        availableToPromise: 9,
        allocatedStock: 3,
        inTransit: 4,
        stockHealth: "Normal",
        lastSync: "2026-10-29 09:30"
      }
    },
    variants: [
      { id: "VAR-002-A", sku: "OMNI-DRV-V4-KIT", name: "Driver Console + 2 Li-Ion Cells", size: "Standard", thickness: "N/A", side: "Universal", status: "Active", gtin: "8904101902811" }
    ],
    identifiers: [
      { type: "GS1-128 / GTIN", value: "8904101902811", isPrimary: true, uom: "Set / Tray", source: "Manufacturer GS1", status: "Active" },
      { type: "Serial Number RFID", value: "EPC-96-OMNI-2026-00412", isPrimary: false, uom: "Set / Tray", source: "Asset Tag", status: "Active" }
    ],
    uomHierarchy: [
      { level: "Unit / Kit", uom: "Set / Tray", factor: 1, isBase: true, isSales: true, isPurchase: true, dimensions: "40 x 30 x 18 cm", weight: "3.2 kg", barcode: "8904101902811" }
    ],
    trackingRules: {
      mode: "Serial",
      mfgDateRequired: true,
      expiryDateRequired: false,
      minShelfLifeDistributorDays: 0,
      minShelfLifeInstitutionDays: 0,
      udiDiRequired: true,
      qcInspectionRequired: true,
      sterilizationValidationDocRequired: true,
      tempControl: "Standard",
      hazardous: false
    },
    documents: [
      { name: "OmniDrive_V4_Technical_Manual.pdf", type: "Technical Data Sheet", version: "v4.0", effective: "2026-02-01", expiry: "--", status: "Active", size: "8.2 MB" }
    ],
    pricingReference: {
      isEngineConnected: true,
      engineSource: "VinFlux Pricing Engine v3.2",
      lastSync: "2026-10-27 11:20",
      mrp: 345000,
      currency: "INR (₹)",
      dealerTransferCap: 265000,
      institutionalTenderCap: 250000,
      govPriceCapEnforced: false,
      marginFloorPercent: 22.0,
      priceListsLinked: ["Institutional Capital Equipment 2026"]
    },
    integrationMapping: [
      { system: "Oracle Fusion ERP", entityType: "Fixed Asset Master", externalId: "EQ-ORCL-77192", status: "Synchronized", lastSync: "2026-10-27 11:20", mappingDirection: "Bi-directional" }
    ],
    changeHistory: [
      { field: "Firmware Reference", prevValue: "v3.8.1", newValue: "v4.0.2", changedBy: "Sarah Jenkins", changedAt: "2026-10-27 11:20", reason: "Production release update" }
    ]
  },
  {
    id: "PRD-CSM-003",
    name: "Sterile Bio-Resorbable Hemostatic Gauze 10x10cm (Matrix Pad)",
    code: "8906001248092",
    description: "Oxidized regenerated cellulose absorbent hemostat for intraoperative bleeding control during orthopedic and general surgery.",
    portfolioId: "port-consumables",
    categoryId: "cat-hemostats",
    subCategoryId: "sub-gauze",
    principalId: "princ-biorad",
    brand: "BioStop Hemostat",
    productTypeId: "type-consumable",
    baseUom: "Pack",
    lifecycleStatus: "Active",
    approvalStatus: "Approved",
    trackingMode: "Batch / Lot",
    hsnCode: "30061010",
    taxRate: "12%",
    sourceSystem: "Excel Master CSV Import",
    externalRef: "CSV-IMP-2026-440",
    hasVariants: true,
    variantCount: 3,
    updatedAt: "2026-10-25 09:40",
    updatedBy: "VinFlux Import Bridge",
    attributes: {
      "attr-dim": "10 x 10 cm",
      "attr-absorb": "Under 2 minutes"
    },
    inventoryPolicy: {
      inheritDefaults: false,
      minSafetyThreshold: 300,
      reorderPoint: 450,
      reorderQty: 600,
      leadTimeDays: 20,
      safetyStockDays: 30,
      engineFeed: {
        connected: true,
        totalOnHand: 520,
        availableToPromise: 480,
        allocatedStock: 40,
        inTransit: 200,
        stockHealth: "Normal",
        lastSync: "2026-10-29 08:50"
      }
    },
    variants: [
      { id: "VAR-003-A", sku: "BIO-GAUZE-5X5", name: "Pad 5 x 5 cm (Box of 10)", size: "5 x 5 cm", thickness: "N/A", side: "Universal", status: "Active", gtin: "8906001248085" },
      { id: "VAR-003-B", sku: "BIO-GAUZE-10X10", name: "Pad 10 x 10 cm (Box of 10)", size: "10 x 10 cm", thickness: "N/A", side: "Universal", status: "Active", gtin: "8906001248092" },
      { id: "VAR-003-C", sku: "BIO-GAUZE-10X20", name: "Pad 10 x 20 cm (Box of 5)", size: "10 x 20 cm", thickness: "N/A", side: "Universal", status: "Active", gtin: "8906001248108" }
    ],
    identifiers: [
      { type: "GS1-128 / GTIN", value: "8906001248092", isPrimary: true, uom: "Pack (10 Units)", source: "GS1 India", status: "Active" }
    ],
    uomHierarchy: [
      { level: "Unit Foil Pouch", uom: "Pack", factor: 1, isBase: true, isSales: false, isPurchase: false, dimensions: "12 x 12 cm", weight: "12 g", barcode: "8906001248092-F" },
      { level: "Sales Dispenser Box", uom: "Box (10 Each)", factor: 10, isBase: false, isSales: true, isPurchase: false, dimensions: "15 x 15 x 6 cm", weight: "180 g", barcode: "8906001248092" },
      { level: "Shipper Master Case", uom: "Carton (20 Each)", factor: 200, isBase: false, isSales: false, isPurchase: true, dimensions: "40 x 35 x 30 cm", weight: "4.2 kg", barcode: "18906001248099" }
    ],
    trackingRules: {
      mode: "Batch / Lot",
      mfgDateRequired: true,
      expiryDateRequired: true,
      minShelfLifeDistributorDays: 730,
      minShelfLifeInstitutionDays: 365,
      udiDiRequired: true,
      qcInspectionRequired: true,
      sterilizationValidationDocRequired: true,
      tempControl: "Cool & Dry (< 25°C)",
      hazardous: false
    },
    documents: [
      { name: "BioStop_Sterility_Lot_Validation.pdf", type: "Lab Validation", version: "v2.0", effective: "2026-01-10", expiry: "2029-01-09", status: "Active", size: "1.5 MB" }
    ],
    pricingReference: {
      isEngineConnected: true,
      engineSource: "VinFlux Pricing Engine v3.2",
      lastSync: "2026-10-25 09:40",
      mrp: 4200,
      currency: "INR (₹)",
      dealerTransferCap: 2600,
      institutionalTenderCap: 2350,
      govPriceCapEnforced: false,
      marginFloorPercent: 15.0,
      priceListsLinked: ["Standard Hospital Consumables 2026"]
    },
    integrationMapping: [
      { system: "VinFlux Import Bridge", entityType: "CSV Import Batch", externalId: "CSV-IMP-2026-440", status: "Synchronized", lastSync: "2026-10-25 09:40", mappingDirection: "Inbound" }
    ],
    changeHistory: [
      { field: "Initial Record Created", prevValue: "--", newValue: "Created via CSV Import", changedBy: "VinFlux Import Bridge", changedAt: "2026-10-25 09:40", reason: "Batch SKU onboarding" }
    ]
  },
  {
    id: "PRD-DGT-004",
    name: "VinFlux AI 3D Knee Pre-Operative Trajectory Planning Cloud License (Annual)",
    code: "8909988112345",
    description: "Cloud-based AI anatomical segmentation and 3D implant positioning algorithm license for joint reconstruction orthopaedic surgeons.",
    portfolioId: "port-digital",
    categoryId: "cat-planning-sw",
    subCategoryId: "sub-cloud-license",
    principalId: "princ-zimmer",
    brand: "VinFlux AI Plan",
    productTypeId: "type-digital",
    baseUom: "License",
    lifecycleStatus: "Active",
    approvalStatus: "Approved",
    trackingMode: "None",
    hsnCode: "997331",
    taxRate: "18%",
    sourceSystem: "VinFlux Direct",
    externalRef: "SW-LIC-2026-90",
    hasVariants: false,
    variantCount: 1,
    updatedAt: "2026-10-22 15:10",
    updatedBy: "Rohan V. (Software Product Lead)",
    attributes: {
      "attr-seat-type": "Single Named Surgeon",
      "attr-cloud-region": "Asia-South (Mumbai)"
    },
    inventoryPolicy: {
      inheritDefaults: true,
      minSafetyThreshold: 0,
      reorderPoint: 0,
      reorderQty: 0,
      leadTimeDays: 0,
      safetyStockDays: 0,
      engineFeed: {
        connected: false,
        totalOnHand: 0,
        availableToPromise: 0,
        allocatedStock: 0,
        inTransit: 0,
        stockHealth: "Normal",
        lastSync: "--"
      }
    },
    variants: [
      { id: "VAR-004-A", sku: "VFLUX-SW-ANNUAL-1S", name: "1-Year Single Surgeon Cloud License", size: "Standard", thickness: "N/A", side: "Universal", status: "Active", gtin: "8909988112345" }
    ],
    identifiers: [
      { type: "Digital SKU Code", value: "8909988112345", isPrimary: true, uom: "License", source: "Internal Engine", status: "Active" }
    ],
    uomHierarchy: [
      { level: "Electronic Key", uom: "License", factor: 1, isBase: true, isSales: true, isPurchase: true, dimensions: "N/A (Electronic Delivery)", weight: "0 g", barcode: "8909988112345" }
    ],
    trackingRules: {
      mode: "None",
      mfgDateRequired: false,
      expiryDateRequired: false,
      minShelfLifeDistributorDays: 0,
      minShelfLifeInstitutionDays: 0,
      udiDiRequired: false,
      qcInspectionRequired: false,
      sterilizationValidationDocRequired: false,
      tempControl: "N/A",
      hazardous: false
    },
    documents: [
      { name: "End_User_License_Agreement_EULA.pdf", type: "Commercial Terms", version: "v2026.1", effective: "2026-01-01", expiry: "--", status: "Active", size: "420 KB" }
    ],
    pricingReference: {
      isEngineConnected: true,
      engineSource: "VinFlux Pricing Engine v3.2",
      lastSync: "2026-10-22 15:10",
      mrp: 120000,
      currency: "INR (₹)",
      dealerTransferCap: 95000,
      institutionalTenderCap: 88000,
      govPriceCapEnforced: false,
      marginFloorPercent: 35.0,
      priceListsLinked: ["SaaS & Software Enterprise Rate Card"]
    },
    integrationMapping: [
      { system: "VinFlux License Server", entityType: "Token Service", externalId: "SW-LIC-2026-90", status: "Synchronized", lastSync: "2026-10-22 15:10", mappingDirection: "Bi-directional" }
    ],
    changeHistory: [
      { field: "Tax Code", prevValue: "997330", newValue: "997331", changedBy: "Rohan V.", changedAt: "2026-10-22 15:10", reason: "Corrected SAC code for cloud software services" }
    ]
  },
  {
    id: "PRD-EVOCON-005",
    name: "Genius Evocon Modular Revision Instrument Set (Titanium Tray Reamers & Trials)",
    code: "8903209041122",
    description: "Reusable surgical instrument kit containing sizing trials, cutting guides, and augment tampers for revision knee surgery. Autoclave tray included.",
    portfolioId: "port-arthro",
    categoryId: "cat-tkr",
    subCategoryId: "sub-knee-rev",
    principalId: "princ-biorad",
    brand: "Genius Evocon",
    productTypeId: "type-equipment",
    baseUom: "Set / Tray",
    lifecycleStatus: "Pending Approval",
    approvalStatus: "Pending Approval",
    trackingMode: "Serial",
    hsnCode: "90189084",
    taxRate: "12%",
    sourceSystem: "SAP S/4HANA (Direct Sync)",
    externalRef: "MAT-SAP-883011",
    hasVariants: false,
    variantCount: 1,
    updatedAt: "2026-10-29 08:30",
    updatedBy: "K. Mohan (Clinical Engineer)",
    attributes: {
      "attr-sterility": "Autoclave / Steam",
      "attr-material": "Titanium Alloy (Ti-6Al-4V)"
    },
    inventoryPolicy: {
      inheritDefaults: true,
      minSafetyThreshold: 5,
      reorderPoint: 8,
      reorderQty: 10,
      leadTimeDays: 60,
      safetyStockDays: 90,
      engineFeed: {
        connected: true,
        totalOnHand: 6,
        availableToPromise: 4,
        allocatedStock: 2,
        inTransit: 2,
        stockHealth: "Normal",
        lastSync: "2026-10-29 08:30"
      }
    },
    variants: [
      { id: "VAR-005-A", sku: "EVO-INST-REV-SET", name: "Revision Knee Instrument Set Full Case", size: "Standard", thickness: "N/A", side: "Universal", status: "Pending", gtin: "8903209041122" }
    ],
    identifiers: [
      { type: "GS1-128 / GTIN", value: "8903209041122", isPrimary: true, uom: "Set / Tray", source: "GS1 India", status: "Active" }
    ],
    uomHierarchy: [
      { level: "Instrument Case", uom: "Set / Tray", factor: 1, isBase: true, isSales: true, isPurchase: true, dimensions: "60 x 30 x 15 cm", weight: "8.5 kg", barcode: "8903209041122" }
    ],
    trackingRules: {
      mode: "Serial",
      mfgDateRequired: true,
      expiryDateRequired: false,
      minShelfLifeDistributorDays: 0,
      minShelfLifeInstitutionDays: 0,
      udiDiRequired: true,
      qcInspectionRequired: true,
      sterilizationValidationDocRequired: true,
      tempControl: "Standard",
      hazardous: false
    },
    documents: [
      { name: "Instrument_Tray_Autoclave_Instructions.pdf", type: "Instructions for Use (IFU)", version: "v1.2", effective: "2026-10-01", expiry: "--", status: "Active", size: "3.3 MB" }
    ],
    pricingReference: {
      isEngineConnected: true,
      engineSource: "VinFlux Pricing Engine v3.2",
      lastSync: "2026-10-29 08:30",
      mrp: 650000,
      currency: "INR (₹)",
      dealerTransferCap: 520000,
      institutionalTenderCap: 490000,
      govPriceCapEnforced: false,
      marginFloorPercent: 20.0,
      priceListsLinked: ["Orthopaedic Reusable Instrumentation Tray"]
    },
    integrationMapping: [
      { system: "SAP S/4HANA Enterprise", entityType: "Asset Master", externalId: "MAT-SAP-883011", status: "Pending Review", lastSync: "2026-10-29 08:30", mappingDirection: "Bi-directional" }
    ],
    changeHistory: [
      { field: "Approval Status", prevValue: "Draft", newValue: "Pending Approval", changedBy: "K. Mohan", changedAt: "2026-10-29 08:30", reason: "Submitted with autoclave validation documentation" }
    ]
  },
  {
    id: "PRD-EVOCON-006",
    name: "Genius Revision Femoral Stem Extension 150mm x 14mm Fluted",
    code: "8903209045588",
    description: "Straight fluted revision stem extension for stable intramedullary fixation during complex femoral reconstructive surgeries.",
    portfolioId: "port-arthro",
    categoryId: "cat-tkr",
    subCategoryId: "sub-knee-rev",
    principalId: "princ-biorad",
    brand: "Genius Evocon",
    productTypeId: "type-implant",
    baseUom: "Each",
    lifecycleStatus: "Draft",
    approvalStatus: "Draft",
    trackingMode: "Batch + Serial",
    hsnCode: "90213100",
    taxRate: "5%",
    sourceSystem: "Manual Creation",
    externalRef: "--",
    hasVariants: true,
    variantCount: 4,
    updatedAt: "2026-10-29 09:15",
    updatedBy: "Product Master Draft Engine",
    attributes: {
      "attr-material": "Titanium Alloy (Ti-6Al-4V)",
      "attr-size": "Size 4",
      "attr-thickness": "15 mm",
      "attr-side": "Universal",
      "attr-sterility": "Gamma Radiation (25 kGy)",
      "attr-fixation": "Press-Fit"
    },
    inventoryPolicy: {
      inheritDefaults: true,
      minSafetyThreshold: 50,
      reorderPoint: 75,
      reorderQty: 100,
      leadTimeDays: 45,
      safetyStockDays: 60,
      engineFeed: {
        connected: false,
        totalOnHand: 0,
        availableToPromise: 0,
        allocatedStock: 0,
        inTransit: 0,
        stockHealth: "Critical",
        lastSync: "--"
      }
    },
    variants: [
      { id: "VAR-006-A", sku: "EVO-STEM-150-12", name: "Stem 150mm / Dia 12mm", size: "12 mm", thickness: "150 mm", side: "Universal", status: "Draft", gtin: "8903209045581" },
      { id: "VAR-006-B", sku: "EVO-STEM-150-14", name: "Stem 150mm / Dia 14mm", size: "14 mm", thickness: "150 mm", side: "Universal", status: "Draft", gtin: "8903209045588" }
    ],
    identifiers: [
      { type: "GS1-128 / GTIN", value: "8903209045588", isPrimary: true, uom: "Each", source: "VinFlux Identifier Pool", status: "Draft" }
    ],
    uomHierarchy: [
      { level: "Unit Foil Carton", uom: "Each", factor: 1, isBase: true, isSales: true, isPurchase: true, dimensions: "24 x 8 x 5 cm", weight: "240 g", barcode: "8903209045588" }
    ],
    trackingRules: {
      mode: "Batch + Serial",
      mfgDateRequired: true,
      expiryDateRequired: true,
      minShelfLifeDistributorDays: 365,
      minShelfLifeInstitutionDays: 180,
      udiDiRequired: true,
      qcInspectionRequired: true,
      sterilizationValidationDocRequired: true,
      tempControl: "Ambient",
      hazardous: false
    },
    documents: [],
    pricingReference: {
      isEngineConnected: false,
      engineSource: "Not Connected (Standalone Mode)",
      lastSync: "--",
      mrp: 0,
      currency: "INR (₹)",
      dealerTransferCap: 0,
      institutionalTenderCap: 0,
      govPriceCapEnforced: false,
      marginFloorPercent: 0,
      priceListsLinked: []
    },
    integrationMapping: [
      { system: "Local Registry", entityType: "Standalone Record", externalId: "PRD-EVOCON-006", status: "Draft Local", lastSync: "2026-10-29 09:15", mappingDirection: "Local Only" }
    ],
    changeHistory: [
      { field: "Draft Created", prevValue: "--", newValue: "Record initialized", changedBy: "Product Master User", changedAt: "2026-10-29 09:15", reason: "New revision portfolio expansion" }
    ]
  }
];
