import type {
  TerritoryNode,
  Zone,
  SalesChannel,
  SalesFlowTopology,
  PartnerOnboardingRecord,
  ApprovalRequest,
  GtmConfiguration
} from '../types/gtmV2.types';

// ============================================================================
// 1. DYNAMIC N-LEVEL TERRITORIES
// Demonstrates unlimited hierarchy levels without hardcoded State/District/City
// ============================================================================
export const initialTerritoriesV2: TerritoryNode[] = [
  // Root Level 1: Country
  {
    id: 'terr-ind',
    code: 'IND',
    name: 'India',
    description: 'National domestic sales territory',
    parentId: null,
    level: 1,
    levelLabel: 'Country',
    status: 'Active',
    leadPerson: 'Dr. Arvind Rao (National Commercial Director)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },

  // Level 2: Regions / States under India
  {
    id: 'terr-ap',
    code: 'REG-AP',
    name: 'Andhra Pradesh',
    description: 'Coastal and Rayalaseema healthcare corridors',
    parentId: 'terr-ind',
    parentName: 'India',
    level: 2,
    levelLabel: 'State / Province',
    status: 'Active',
    leadPerson: 'K. Sudhakar Rao (Regional Manager)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'terr-tel',
    code: 'REG-TS',
    name: 'Telangana',
    description: 'Hyderabad capital cluster and medical tech zones',
    parentId: 'terr-ind',
    parentName: 'India',
    level: 2,
    levelLabel: 'State / Province',
    status: 'Active',
    leadPerson: 'S. Narsing Rao (Regional Manager)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'terr-kar',
    code: 'REG-KA',
    name: 'Karnataka',
    description: 'Bengaluru Tech corridor & coastal districts',
    parentId: 'terr-ind',
    parentName: 'India',
    level: 2,
    levelLabel: 'State / Province',
    status: 'Active',
    leadPerson: 'S. Swaminathan (Zonal Director)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'terr-tn',
    code: 'REG-TN',
    name: 'Tamil Nadu',
    description: 'Chennai metro & Coimbatore healthcare corridor',
    parentId: 'terr-ind',
    parentName: 'India',
    level: 2,
    levelLabel: 'State / Province',
    status: 'Active',
    leadPerson: 'R. Sundaram (Zonal Manager)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'terr-mh',
    code: 'REG-MH',
    name: 'Maharashtra',
    description: 'Western financial & hospital network hub',
    parentId: 'terr-ind',
    parentName: 'India',
    level: 2,
    levelLabel: 'State / Province',
    status: 'Active',
    leadPerson: 'Vikram Mehta (Commercial VP)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },

  // Level 3: Sub-Regions / Operational Divisions
  {
    id: 'terr-coastal-ap',
    code: 'DIV-CAP',
    name: 'Coastal Andhra Division',
    description: 'Amaravati capital corridor and northern coastal ports',
    parentId: 'terr-ap',
    parentName: 'Andhra Pradesh',
    level: 3,
    levelLabel: 'Operational Division',
    status: 'Active',
    leadPerson: 'M. Venkat (Area Manager)',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02'
  },
  {
    id: 'terr-hyd-metro',
    code: 'DIV-HYD',
    name: 'Greater Hyderabad Metro',
    description: 'Corporate tertiary hospital belt & HITEC city clinics',
    parentId: 'terr-tel',
    parentName: 'Telangana',
    level: 3,
    levelLabel: 'Metro Cluster',
    status: 'Active',
    leadPerson: 'P. Rajesh (Metro Sales Head)',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02'
  },
  {
    id: 'terr-blr-urban',
    code: 'DIV-BLR',
    name: 'Bengaluru Urban Corridor',
    description: 'High-density multi-specialty surgical centers',
    parentId: 'terr-kar',
    parentName: 'Karnataka',
    level: 3,
    levelLabel: 'Metro Cluster',
    status: 'Active',
    leadPerson: 'Anand Kumar (Area Head)',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02'
  },

  // Level 4: City / District Node
  {
    id: 'terr-vja',
    code: 'CITY-VJA',
    name: 'Vijayawada Commercial Hub',
    description: 'NTR District commercial center and regional stock hub',
    parentId: 'terr-coastal-ap',
    parentName: 'Coastal Andhra Division',
    level: 4,
    levelLabel: 'City Hub',
    status: 'Active',
    pinCodes: ['520001', '520002', '520010'],
    leadPerson: 'T. Rama Rao (District Lead)',
    createdAt: '2026-01-03',
    updatedAt: '2026-01-03'
  },
  {
    id: 'terr-vizag',
    code: 'CITY-VZG',
    name: 'Visakhapatnam MedTech Hub',
    description: 'AMTZ manufacturing zone and North Coastal healthcare',
    parentId: 'terr-coastal-ap',
    parentName: 'Coastal Andhra Division',
    level: 4,
    levelLabel: 'City Hub',
    status: 'Active',
    pinCodes: ['530001', '530013', '530017'],
    leadPerson: 'C. Srinivas (District Lead)',
    createdAt: '2026-01-03',
    updatedAt: '2026-01-03'
  },

  // Level 5: Local Micro-Market / Area (Demonstrating N-Level depth)
  {
    id: 'terr-benz-circle',
    code: 'LOC-BENZ',
    name: 'Benz Circle Medical Hub',
    description: 'High-density orthopedic & trauma surgical hospitals',
    parentId: 'terr-vja',
    parentName: 'Vijayawada Commercial Hub',
    level: 5,
    levelLabel: 'Micro-Market Area',
    status: 'Active',
    pinCodes: ['520010'],
    leadPerson: 'B. Krishna (Field Rep)',
    createdAt: '2026-01-04',
    updatedAt: '2026-01-04'
  },
  {
    id: 'terr-banjara-hills',
    code: 'LOC-BANJ',
    name: 'Banjara Hills & Jubilee Hills Cluster',
    description: 'Tier-1 quaternary surgical hospital network',
    parentId: 'terr-hyd-metro',
    parentName: 'Greater Hyderabad Metro',
    level: 5,
    levelLabel: 'Micro-Market Area',
    status: 'Active',
    pinCodes: ['500034', '500082'],
    leadPerson: 'V. Naidu (Senior Executive)',
    createdAt: '2026-01-04',
    updatedAt: '2026-01-04'
  }
];

// ============================================================================
// 2. CONFIGURABLE ZONES (Supports Overlapping / Multi-Territory Memberships)
// ============================================================================
export const initialZonesV2: Zone[] = [
  {
    id: 'zone-south',
    code: 'ZONE-SOUTH',
    name: 'South Strategic Zone',
    description: 'Peninsular operations covering AP, Telangana, Karnataka & Tamil Nadu medical corridors.',
    status: 'Active',
    territoryIds: ['terr-ap', 'terr-tel', 'terr-kar', 'terr-tn', 'terr-coastal-ap', 'terr-hyd-metro', 'terr-blr-urban', 'terr-vja', 'terr-vizag', 'terr-benz-circle', 'terr-banjara-hills'],
    leadManager: 'K. Sudhakar Rao',
    annualBudget: 285000000,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'zone-west',
    code: 'ZONE-WEST',
    name: 'West Commercial Zone',
    description: 'Western industrial medtech corridor across Maharashtra and coastal trade points.',
    status: 'Active',
    territoryIds: ['terr-mh'],
    leadManager: 'Vikram Mehta',
    annualBudget: 190000000,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'zone-coastal-special',
    code: 'ZONE-COASTAL',
    name: 'Eastern Seaboard Fast-Track Zone',
    description: 'Special strategic zone overlapping coastal port cities across multiple states for cold-chain implants.',
    status: 'Active',
    territoryIds: ['terr-coastal-ap', 'terr-vja', 'terr-vizag', 'terr-tn'], // Overlapping with South Zone
    leadManager: 'S. Swaminathan',
    annualBudget: 95000000,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10'
  }
];

// ============================================================================
// 3. DYNAMIC SALES CHANNELS (Fully Configurable, Not Hardcoded)
// ============================================================================
export const initialSalesChannelsV2: SalesChannel[] = [
  {
    id: 'chn-cnf',
    code: 'CNF',
    name: 'Carrying & Forwarding Agent (C&F)',
    description: 'State mother depot partner handling consignment inventory, cold-chain storage, and primary dispatches.',
    status: 'Active',
    standardDiscountPercent: 4.5,
    creditPeriodDays: 14,
    creditLimit: 5000000,
    requiresDeposit: true,
    depositAmount: 2000000,
    minOrderValue: 500000,
    maxOrderValue: 25000000,
    allowedPaymentModes: ['NEFT / RTGS', 'Direct Debit Letter of Credit', 'Bank Guarantee'],
    effectiveFrom: '2026-01-01',
    configHistory: [
      {
        id: 'cfg-cnf-1',
        timestamp: '2026-01-01 10:00',
        modifiedBy: 'Commercial Finance',
        changeSummary: 'Initial policy baseline for C&F handling margin',
        discountPercent: 4.5,
        creditPeriodDays: 14,
        creditLimit: 5000000
      }
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'chn-distributor',
    code: 'DISTRIBUTOR',
    name: 'Authorized Surgical Distributor',
    description: 'Core commercial tier purchasing at PTD and servicing hospitals, clinics, and orthopedic surgical theaters.',
    status: 'Active',
    standardDiscountPercent: 12.0,
    creditPeriodDays: 45,
    creditLimit: 3500000,
    requiresDeposit: true,
    depositAmount: 1000000,
    minOrderValue: 100000,
    maxOrderValue: 10000000,
    allowedPaymentModes: ['NEFT / RTGS', 'Cheque / PDC', 'Letter of Credit'],
    effectiveFrom: '2026-01-01',
    configHistory: [
      {
        id: 'cfg-dist-1',
        timestamp: '2026-01-01 10:00',
        modifiedBy: 'Commercial Director',
        changeSummary: 'Established 12% standard margin with 45-day DSO threshold',
        discountPercent: 12.0,
        creditPeriodDays: 45,
        creditLimit: 3500000
      }
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'chn-super-stockist',
    code: 'SUPER_STOCKIST',
    name: 'Zonal Super Stockist',
    description: 'Regional wholesale aggregator purchasing bulk consumable lots and distributing to local sub-dealers.',
    status: 'Active',
    standardDiscountPercent: 16.5,
    creditPeriodDays: 30,
    creditLimit: 8000000,
    requiresDeposit: true,
    depositAmount: 3000000,
    minOrderValue: 1000000,
    maxOrderValue: 50000000,
    allowedPaymentModes: ['NEFT / RTGS', 'Letter of Credit'],
    effectiveFrom: '2026-01-01',
    configHistory: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'chn-dealer',
    code: 'DEALER',
    name: 'Retail Surgical Dealer',
    description: 'Local surgical dealer and implant dispensary servicing private nursing homes and outpatient surgical centers.',
    status: 'Active',
    standardDiscountPercent: 8.0,
    creditPeriodDays: 21,
    creditLimit: 1500000,
    requiresDeposit: false,
    depositAmount: 0,
    minOrderValue: 25000,
    maxOrderValue: 2500000,
    allowedPaymentModes: ['UPI / QR', 'NEFT / RTGS', 'Cheque / PDC'],
    effectiveFrom: '2026-01-01',
    configHistory: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'chn-direct-hosp',
    code: 'INST_DIRECT',
    name: 'Hospital Direct Tender Channel',
    description: 'Direct institutional rate contract invoicing for corporate hospital chains and central medical colleges.',
    status: 'Active',
    standardDiscountPercent: 0.0, // Invoiced at institutional net selling price
    creditPeriodDays: 60,
    creditLimit: 15000000,
    requiresDeposit: false,
    depositAmount: 0,
    minOrderValue: 50000,
    maxOrderValue: 100000000,
    allowedPaymentModes: ['Treasury Direct Transfer', 'Corporate NEFT'],
    effectiveFrom: '2026-01-01',
    configHistory: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

// ============================================================================
// 4. SALES FLOW TOPOLOGIES (Configurable Multi-Stage Visual Distribution)
// ============================================================================
export const initialSalesFlowsV2: SalesFlowTopology[] = [
  {
    id: 'flow-hub-spoke',
    code: 'FLOW-CNF-DIST-HOSP',
    name: 'Consignment Hub & Spoke Flow',
    description: 'Company factory delivers to State C&F Depot, supplied to Authorized Distributor for last-mile delivery to Hospital.',
    flowType: 'Multi-Stage',
    stages: [
      {
        id: 'stg-1',
        stageNumber: 1,
        channelId: 'chn-cnf',
        channelName: 'Company Warehouse',
        stageRole: 'Source',
        pricingBasis: 'Ex-Factory Manufacturing Cost',
        inventoryOwnership: 'Company Owned',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-2',
        stageNumber: 2,
        channelId: 'chn-cnf',
        channelName: 'C&F Agent Depot',
        stageRole: 'Intermediary',
        pricingBasis: '4.5% Consignment Fee',
        inventoryOwnership: 'Consignment',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-3',
        stageNumber: 3,
        channelId: 'chn-distributor',
        channelName: 'Authorized Distributor',
        stageRole: 'Intermediary',
        pricingBasis: 'Price to Distributor (PTD)',
        inventoryOwnership: 'Title Transfer',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-4',
        stageNumber: 4,
        channelId: 'chn-dealer',
        channelName: 'Local Surgical Dealer',
        stageRole: 'Intermediary',
        pricingBasis: 'Price to Retailer (PTR)',
        inventoryOwnership: 'Title Transfer',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-5',
        stageNumber: 5,
        channelId: 'chn-direct-hosp',
        channelName: 'Hospital / Healthcare Provider',
        stageRole: 'Destination',
        pricingBasis: 'Institutional / MRP',
        inventoryOwnership: 'Customer Owned',
        requiresLogisticsDispatch: false
      }
    ],
    applicableTerritoryIds: ['terr-ap', 'terr-tel', 'terr-kar', 'terr-vja', 'terr-vizag', 'terr-hyd-metro'],
    applicableZoneIds: ['zone-south', 'zone-coastal-special'],
    productScope: {
      scopeType: 'All'
    },
    status: 'Active',
    effectiveFrom: '2026-01-01',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'flow-direct-dist',
    code: 'FLOW-STD-DIST',
    name: 'Standard Direct Distributor Route',
    description: 'Company Warehouse dispatches directly to Regional Distributor who stocks and delivers to surgical hospital theaters.',
    flowType: 'Multi-Stage',
    stages: [
      {
        id: 'stg-d1',
        stageNumber: 1,
        channelId: 'chn-cnf',
        channelName: 'Company Warehouse',
        stageRole: 'Source',
        pricingBasis: 'Factory Cost Basis',
        inventoryOwnership: 'Company Owned',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-d2',
        stageNumber: 2,
        channelId: 'chn-distributor',
        channelName: 'Authorized Distributor',
        stageRole: 'Intermediary',
        pricingBasis: 'Price to Distributor (PTD)',
        inventoryOwnership: 'Title Transfer',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-d3',
        stageNumber: 3,
        channelId: 'chn-direct-hosp',
        channelName: 'Hospital / Consignee',
        stageRole: 'Destination',
        pricingBasis: 'Hospital Rate Contract',
        inventoryOwnership: 'Customer Owned',
        requiresLogisticsDispatch: false
      }
    ],
    applicableTerritoryIds: ['terr-kar', 'terr-mh', 'terr-tn'],
    applicableZoneIds: ['zone-south', 'zone-west'],
    productScope: {
      scopeType: 'Portfolio',
      portfolioNames: ['Genius Ortho - Knee & Hip Implants']
    },
    status: 'Active',
    effectiveFrom: '2026-01-01',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'flow-direct-tender',
    code: 'FLOW-INST-DIRECT',
    name: 'Direct Institutional Tender Supply',
    description: 'Direct manufacturer invoicing and refrigerated container dispatch for government medical colleges and corporate hospital chains.',
    flowType: 'Direct',
    stages: [
      {
        id: 'stg-dir-1',
        stageNumber: 1,
        channelId: 'chn-cnf',
        channelName: 'Company Central Warehouse',
        stageRole: 'Source',
        pricingBasis: 'Central Factory Gate',
        inventoryOwnership: 'Company Owned',
        requiresLogisticsDispatch: true
      },
      {
        id: 'stg-dir-2',
        stageNumber: 2,
        channelId: 'chn-direct-hosp',
        channelName: 'Government Medical College / Tertiary Trust',
        stageRole: 'Destination',
        pricingBasis: 'Direct Government Tender Rate',
        inventoryOwnership: 'Customer Owned',
        requiresLogisticsDispatch: false
      }
    ],
    applicableTerritoryIds: ['terr-ind'],
    applicableZoneIds: ['zone-south', 'zone-west', 'zone-coastal-special'],
    productScope: {
      scopeType: 'All'
    },
    status: 'Active',
    effectiveFrom: '2026-01-01',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

// ============================================================================
// 5. INITIAL PARTNER ONBOARDING RECORDS
// Demonstrates all lifecycle statuses (Active, Approval Pending, KYC Under Review, Draft, Rejected)
// ============================================================================
export const initialPartnersV2: PartnerOnboardingRecord[] = [
  {
    id: 'part-001',
    code: 'DIST-AP-01',
    name: 'Sri Krishna Surgical Solutions LLP',
    businessName: 'Sri Krishna Surgical Solutions LLP',
    partnerType: 'Authorized Surgical Distributor',
    contactPerson: 'K. Balasubrahmanyam',
    email: 'contact@srikrishnasurgicals.com',
    phone: '+91 98480 23456',
    address: {
      street: 'Door No. 40-1-12, Benz Circle Main Road',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pinCode: '520010',
      country: 'India'
    },
    gstin: '37AABCS1429B1Z2',
    pan: 'AABCS1429B',
    drugLicenseNo: 'AP/VJA/20B/2023-881',
    drugLicenseExpiry: '2028-12-31',
    status: 'Active',
    kycDocuments: [
      {
        id: 'doc-1',
        documentType: 'GST Registration Certificate',
        documentNumber: '37AABCS1429B1Z2',
        fileName: 'gst_certificate_srikrishna.pdf',
        uploadedAt: '2026-01-10',
        status: 'Verified',
        verifiedBy: 'Compliance Officer',
        verifiedAt: '2026-01-11'
      },
      {
        id: 'doc-2',
        documentType: 'State Drug Wholesale License Form 20B/21B',
        documentNumber: 'AP/VJA/20B/2023-881',
        fileName: 'drug_license_20b.pdf',
        uploadedAt: '2026-01-10',
        status: 'Verified',
        verifiedBy: 'Compliance Officer',
        verifiedAt: '2026-01-11'
      }
    ],
    assignedTerritoryIds: ['terr-ap', 'terr-coastal-ap', 'terr-vja', 'terr-benz-circle'],
    assignedTerritoryNames: ['Andhra Pradesh', 'Coastal Andhra Division', 'Vijayawada Commercial Hub', 'Benz Circle Medical Hub'],
    selectedSalesFlowIds: ['flow-hub-spoke'],
    selectedSalesFlowNames: ['Consignment Hub & Spoke Flow'],
    partnerMappings: [
      {
        flowId: 'flow-hub-spoke',
        stageNumber: 3,
        stageChannelName: 'Authorized Distributor',
        mappedPartnerId: 'part-001',
        mappedPartnerName: 'Sri Krishna Surgical Solutions LLP',
        mappedPartnerCode: 'DIST-AP-01'
      }
    ],
    commercialTerms: {
      standardDiscount: 12.0,
      effectiveDiscount: 12.0,
      isDiscountOverridden: false,
      standardCreditDays: 45,
      effectiveCreditDays: 45,
      isCreditDaysOverridden: false,
      standardCreditLimit: 3500000,
      effectiveCreditLimit: 3500000,
      isCreditLimitOverridden: false,
      requiresDeposit: true,
      depositAmount: 1000000,
      approvalStatus: 'Standard'
    },
    onboardedAt: '2026-01-12',
    updatedAt: '2026-01-12'
  },
  {
    id: 'part-002',
    code: 'DIST-TEL-01',
    name: 'Apex Ortho Implants India Pvt Ltd',
    businessName: 'Apex Ortho Implants India Pvt Ltd',
    partnerType: 'Authorized Surgical Distributor',
    contactPerson: 'S. Naresh Reddy',
    email: 'naresh@apexortho.in',
    phone: '+91 99890 55432',
    address: {
      street: 'Plot 44, Road No 10, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500034',
      country: 'India'
    },
    gstin: '36AAACP9812C1ZX',
    pan: 'AAACP9812C',
    drugLicenseNo: 'TS/HYD/20B/2024-411',
    status: 'Approval Pending',
    kycDocuments: [
      {
        id: 'doc-3',
        documentType: 'GST Registration Certificate',
        documentNumber: '36AAACP9812C1ZX',
        uploadedAt: '2026-02-01',
        status: 'Verified',
        verifiedBy: 'Compliance Lead',
        verifiedAt: '2026-02-02'
      }
    ],
    assignedTerritoryIds: ['terr-tel', 'terr-hyd-metro', 'terr-banjara-hills'],
    assignedTerritoryNames: ['Telangana', 'Greater Hyderabad Metro', 'Banjara Hills & Jubilee Hills Cluster'],
    selectedSalesFlowIds: ['flow-hub-spoke'],
    selectedSalesFlowNames: ['Consignment Hub & Spoke Flow'],
    partnerMappings: [
      {
        flowId: 'flow-hub-spoke',
        stageNumber: 3,
        stageChannelName: 'Authorized Distributor',
        mappedPartnerId: 'part-002',
        mappedPartnerName: 'Apex Ortho Implants India Pvt Ltd',
        mappedPartnerCode: 'DIST-TEL-01'
      }
    ],
    commercialTerms: {
      standardDiscount: 12.0,
      effectiveDiscount: 14.5, // Override requested: +2.5% discount
      isDiscountOverridden: true,
      standardCreditDays: 45,
      effectiveCreditDays: 60, // Override requested: 60 days
      isCreditDaysOverridden: true,
      standardCreditLimit: 3500000,
      effectiveCreditLimit: 5000000,
      isCreditLimitOverridden: true,
      requiresDeposit: true,
      depositAmount: 1000000,
      overrideReason: 'Volume commitment for corporate hospital networks across Banjara Hills (NIMS, Care, Apollo)',
      approvalStatus: 'Pending Approval'
    },
    onboardedAt: '2026-02-01',
    updatedAt: '2026-02-03'
  },
  {
    id: 'part-003',
    code: 'CNF-AP-01',
    name: 'Coastal MedLogistics C&F Depots',
    businessName: 'Coastal MedLogistics C&F Depots',
    partnerType: 'Carrying & Forwarding Agent (C&F)',
    contactPerson: 'C. Venkateswara Rao',
    email: 'ops@coastalmedlogistics.com',
    phone: '+91 866 244 9081',
    address: {
      street: 'Industrial Estate, Near Autonagar',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pinCode: '520007',
      country: 'India'
    },
    gstin: '37AACCC7712M1ZW',
    pan: 'AACCC7712M',
    status: 'Active',
    kycDocuments: [
      {
        id: 'doc-4',
        documentType: 'Warehouse Cold-Chain Certification',
        documentNumber: 'WH-AP-2024-CC-01',
        uploadedAt: '2026-01-05',
        status: 'Verified',
        verifiedBy: 'Quality Assurance Head',
        verifiedAt: '2026-01-06'
      }
    ],
    assignedTerritoryIds: ['terr-ap', 'terr-coastal-ap', 'terr-vja'],
    assignedTerritoryNames: ['Andhra Pradesh', 'Coastal Andhra Division', 'Vijayawada Commercial Hub'],
    selectedSalesFlowIds: ['flow-hub-spoke'],
    selectedSalesFlowNames: ['Consignment Hub & Spoke Flow'],
    partnerMappings: [
      {
        flowId: 'flow-hub-spoke',
        stageNumber: 2,
        stageChannelName: 'C&F Agent Depot',
        mappedPartnerId: 'part-003',
        mappedPartnerName: 'Coastal MedLogistics C&F Depots',
        mappedPartnerCode: 'CNF-AP-01'
      }
    ],
    commercialTerms: {
      standardDiscount: 4.5,
      effectiveDiscount: 4.5,
      isDiscountOverridden: false,
      standardCreditDays: 14,
      effectiveCreditDays: 14,
      isCreditDaysOverridden: false,
      standardCreditLimit: 5000000,
      effectiveCreditLimit: 5000000,
      isCreditLimitOverridden: false,
      requiresDeposit: true,
      depositAmount: 2000000,
      approvalStatus: 'Standard'
    },
    onboardedAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'part-004',
    code: 'DIST-KAR-01',
    name: 'Bangalore Surgical Devices Corp',
    businessName: 'Bangalore Surgical Devices Corp',
    partnerType: 'Authorized Surgical Distributor',
    contactPerson: 'Harish Gowda',
    email: 'sales@bangaloresurgical.com',
    phone: '+91 98801 12345',
    address: {
      street: '14th Cross, Peenya Industrial Area 2nd Stage',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '560058',
      country: 'India'
    },
    gstin: '29AABCB8819P1ZU',
    pan: 'AABCB8819P',
    status: 'KYC Under Review',
    kycDocuments: [
      {
        id: 'doc-5',
        documentType: 'Drug License 20B/21B',
        documentNumber: 'KA/BNG/20B/2026-09',
        uploadedAt: '2026-02-15',
        status: 'Under Review',
        verificationNotes: 'Verifying drug controller portal endorsement'
      }
    ],
    assignedTerritoryIds: ['terr-kar', 'terr-blr-urban'],
    assignedTerritoryNames: ['Karnataka', 'Bengaluru Urban Corridor'],
    selectedSalesFlowIds: ['flow-direct-dist'],
    selectedSalesFlowNames: ['Standard Direct Distributor Route'],
    partnerMappings: [],
    commercialTerms: {
      standardDiscount: 12.0,
      effectiveDiscount: 12.0,
      isDiscountOverridden: false,
      standardCreditDays: 45,
      effectiveCreditDays: 45,
      isCreditDaysOverridden: false,
      standardCreditLimit: 3500000,
      effectiveCreditLimit: 3500000,
      isCreditLimitOverridden: false,
      requiresDeposit: true,
      depositAmount: 1000000,
      approvalStatus: 'Standard'
    },
    onboardedAt: '2026-02-15',
    updatedAt: '2026-02-15'
  },
  {
    id: 'part-005',
    code: 'DEAL-AP-09',
    name: 'Eluru Trauma Care Dispensary',
    businessName: 'Eluru Trauma Care Dispensary',
    partnerType: 'Retail Surgical Dealer',
    contactPerson: 'M. Sitarama Raju',
    email: 'elurutrauma@gmail.com',
    phone: '+91 94401 77890',
    address: {
      street: 'Main Road, Powerpet',
      city: 'Eluru',
      state: 'Andhra Pradesh',
      pinCode: '534002',
      country: 'India'
    },
    gstin: '37AABCE9912K1Z9',
    pan: 'AABCE9912K',
    status: 'Draft',
    kycDocuments: [],
    assignedTerritoryIds: ['terr-coastal-ap'],
    selectedSalesFlowIds: [],
    partnerMappings: [],
    commercialTerms: {
      standardDiscount: 8.0,
      effectiveDiscount: 8.0,
      isDiscountOverridden: false,
      standardCreditDays: 21,
      effectiveCreditDays: 21,
      isCreditDaysOverridden: false,
      standardCreditLimit: 1500000,
      effectiveCreditLimit: 1500000,
      isCreditLimitOverridden: false,
      requiresDeposit: false,
      depositAmount: 0,
      approvalStatus: 'Standard'
    },
    onboardedAt: '2026-02-18',
    updatedAt: '2026-02-18'
  },
  {
    id: 'part-006',
    code: 'DIST-TN-03',
    name: 'Chennai Ortho Suppliers LLP',
    businessName: 'Chennai Ortho Suppliers LLP',
    partnerType: 'Authorized Surgical Distributor',
    contactPerson: 'V. Subramanian',
    email: 'subramanian@chennaiortho.com',
    phone: '+91 94440 33211',
    address: {
      street: 'Poonamallee High Road, Kilpauk',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pinCode: '600010',
      country: 'India'
    },
    gstin: '33AABCC1123P1ZA',
    pan: 'AABCC1123P',
    status: 'Rejected',
    kycDocuments: [
      {
        id: 'doc-6',
        documentType: 'Drug License 20B/21B',
        documentNumber: 'TN/CHN/20B/2021-002',
        uploadedAt: '2026-01-20',
        status: 'Rejected',
        verificationNotes: 'License expired on 2025-12-31. Renewal receipt invalid.'
      }
    ],
    assignedTerritoryIds: ['terr-tn'],
    selectedSalesFlowIds: [],
    partnerMappings: [],
    commercialTerms: {
      standardDiscount: 12.0,
      effectiveDiscount: 12.0,
      isDiscountOverridden: false,
      standardCreditDays: 45,
      effectiveCreditDays: 45,
      isCreditDaysOverridden: false,
      standardCreditLimit: 3500000,
      effectiveCreditLimit: 3500000,
      isCreditLimitOverridden: false,
      requiresDeposit: true,
      depositAmount: 1000000,
      approvalStatus: 'Rejected'
    },
    onboardedAt: '2026-01-20',
    updatedAt: '2026-01-22'
  }
];

// ============================================================================
// 6. INITIAL APPROVAL REQUESTS
// ============================================================================
export const initialApprovalsV2: ApprovalRequest[] = [
  {
    id: 'appr-001',
    requestType: 'Discount Override',
    partnerId: 'part-002',
    partnerName: 'Apex Ortho Implants India Pvt Ltd',
    partnerCode: 'DIST-TEL-01',
    requestedBy: 'S. Narsing Rao (Zonal Manager)',
    requestedAt: '2026-02-03 11:30',
    status: 'Pending',
    description: 'Requested margin increase from 12.0% to 14.5% with credit extension to 60 days.',
    proposedValues: {
      discountPercent: 14.5,
      creditPeriodDays: 60,
      creditLimit: 5000000
    },
    previousValues: {
      discountPercent: 12.0,
      creditPeriodDays: 45,
      creditLimit: 3500000
    },
    justification: 'Partner has guaranteed exclusive tender coverage for 8 private hospital chains across Hyderabad with ₹4.5 Crore annual minimum take-off.'
  },
  {
    id: 'appr-002',
    requestType: 'Deposit Waiver',
    partnerId: 'part-004',
    partnerName: 'Bangalore Surgical Devices Corp',
    partnerCode: 'DIST-KAR-01',
    requestedBy: 'Anand Kumar (Area Head)',
    requestedAt: '2026-02-16 14:00',
    status: 'Pending',
    description: 'Requesting partial security deposit waiver from ₹10.00 Lakh to ₹5.00 Lakh against rolling bank guarantee.',
    proposedValues: {
      depositAmount: 500000,
      waiveDeposit: false
    },
    previousValues: {
      depositAmount: 1000000
    },
    justification: 'Partner provided ₹15 Lakh Letter of Credit from State Bank of India in lieu of cash deposit.'
  },
  {
    id: 'appr-003',
    requestType: 'Partner Onboarding',
    partnerId: 'part-002',
    partnerName: 'Apex Ortho Implants India Pvt Ltd',
    partnerCode: 'DIST-TEL-01',
    requestedBy: 'S. Narsing Rao (Zonal Manager)',
    requestedAt: '2026-02-01 10:15',
    status: 'Pending',
    description: 'Comprehensive onboarding approval following completed KYC and territory verification.',
    proposedValues: {
      flowStages: ['Company Warehouse -> C&F Agent Depot -> Apex Ortho -> Hospitals']
    },
    justification: 'Fills vital surgical implants coverage in Banjara Hills and HITEC City cluster.'
  },
  {
    id: 'appr-004',
    requestType: 'KYC Verification',
    partnerId: 'part-001',
    partnerName: 'Sri Krishna Surgical Solutions LLP',
    partnerCode: 'DIST-AP-01',
    requestedBy: 'Compliance Assistant',
    requestedAt: '2026-01-11 16:45',
    status: 'Approved',
    description: 'Statutory verification of Form 20B/21B and GSTIN portal validation.',
    proposedValues: {
      kycDocumentType: 'All Documents'
    },
    justification: 'Passed electronic verification against MCA and CBIC databases.',
    decisionBy: 'Compliance Officer',
    decisionAt: '2026-01-11 17:30',
    decisionNotes: 'All licenses verified active on AP Drug Control Administration portal.'
  }
];

// ============================================================================
// 7. GTM CONFIGURATION RULES
// ============================================================================
export const initialGtmConfigV2: GtmConfiguration = {
  partnerTypes: [
    'Carrying & Forwarding Agent (C&F)',
    'Zonal Super Stockist',
    'Authorized Surgical Distributor',
    'Retail Surgical Dealer',
    'Hospital Direct Reseller',
    'Direct Clinician Partner'
  ],
  requiredKycDocuments: [
    {
      id: 'kyc-gst',
      name: 'GST Registration Certificate (Form REG-06)',
      mandatoryFor: [
        'Carrying & Forwarding Agent (C&F)',
        'Zonal Super Stockist',
        'Authorized Surgical Distributor',
        'Retail Surgical Dealer'
      ],
      requiresExpiryDate: false
    },
    {
      id: 'kyc-pan',
      name: 'PAN Card Copy (Entity / Authorized Signatory)',
      mandatoryFor: [
        'Carrying & Forwarding Agent (C&F)',
        'Zonal Super Stockist',
        'Authorized Surgical Distributor',
        'Retail Surgical Dealer',
        'Direct Clinician Partner'
      ],
      requiresExpiryDate: false
    },
    {
      id: 'kyc-drug',
      name: 'State Wholesale Drug License (Form 20B / 21B)',
      mandatoryFor: [
        'Carrying & Forwarding Agent (C&F)',
        'Zonal Super Stockist',
        'Authorized Surgical Distributor'
      ],
      requiresExpiryDate: true
    },
    {
      id: 'kyc-coldchain',
      name: 'Cold-Chain & Temperature Logged Storage Audit',
      mandatoryFor: ['Carrying & Forwarding Agent (C&F)'],
      requiresExpiryDate: true
    }
  ],
  territoryLevelsMax: 10,
  allowOverlappingZones: true,
  maxDiscountDeviationPercent: 5.0, // Maximum deviation before requiring VP sign-off
  autoApproveKycWithValidGst: false,
  requireDirectorApprovalForDepositWaiver: true
};
