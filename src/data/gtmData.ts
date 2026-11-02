import type { 
  SalesChannel, 
  DistributionRoute, 
  Territory, 
  PartnerPerformanceTier, 
  DistributionLevel 
} from '../types/gtm.ts';

export const initialSalesChannels: SalesChannel[] = [
  {
    id: "ct-distributor",
    code: "DIST",
    name: "Authorized Distributor",
    description: "Primary commercial channel partner servicing hospitals, clinics, and tertiary stockists.",
    isReseller: true,
    standardMarginPercent: 12.0,
    marginType: "Price to Distributor (PTD)",
    requiresDeposit: true,
    defaultCreditDays: 45,
    status: "Active"
  },
  {
    id: "ct-super-stockist",
    code: "SS",
    name: "Super Stockist",
    description: "Regional wholesale aggregator supplying authorized distributors across state/zone.",
    isReseller: true,
    standardMarginPercent: 6.0,
    marginType: "Price to Super Stockist (PTS)",
    requiresDeposit: true,
    defaultCreditDays: 30,
    status: "Active"
  },
  {
    id: "ct-cnf",
    code: "CNF",
    name: "C&F Agent (Carrying & Forwarding)",
    description: "Consignment logistics partner. Receives handling fee/commission; does not hold title or resell.",
    isReseller: false,
    standardMarginPercent: 4.5,
    marginType: "Service Fee on Invoiced Value",
    requiresDeposit: true,
    defaultCreditDays: 15,
    status: "Active"
  },
  {
    id: "ct-sub-distributor",
    code: "SUB-DIST",
    name: "Sub-Distributor / Regional Dealer",
    description: "Secondary distributor operating in designated tier-2/tier-3 suburban clusters.",
    isReseller: true,
    standardMarginPercent: 8.0,
    marginType: "Price to Retailer (PTR)",
    requiresDeposit: false,
    defaultCreditDays: 30,
    status: "Active"
  },
  {
    id: "ct-b2b-portal",
    code: "B2B-PORTAL",
    name: "B2B Principal Ordering Portal",
    description: "Self-service digital order desk for authorized buyers with automated margin clearance.",
    isReseller: true,
    standardMarginPercent: 10.0,
    marginType: "Digital Wholesale Net",
    requiresDeposit: false,
    defaultCreditDays: 14,
    status: "Active"
  },
  {
    id: "ct-institution",
    code: "INST",
    name: "Direct Institution / Hospital",
    description: "Direct institutional healthcare provider (corporate chain, government medical college).",
    isReseller: false,
    standardMarginPercent: 0,
    marginType: "Tender / Institutional Rate Contract",
    requiresDeposit: false,
    defaultCreditDays: 60,
    status: "Active"
  },
  {
    id: "ct-ecommerce",
    code: "ECOM",
    name: "E-Commerce & Marketplaces",
    description: "Curated digital storefronts for over-the-counter consumables and clinic supplies.",
    isReseller: true,
    standardMarginPercent: 14.0,
    marginType: "Platform Commission",
    requiresDeposit: false,
    defaultCreditDays: 7,
    status: "Active"
  },
  {
    id: "ct-direct",
    code: "DIRECT",
    name: "Direct Clinician / Direct Sales",
    description: "Direct sale by manufacturer without intermediary distribution.",
    isReseller: false,
    standardMarginPercent: 0,
    marginType: "Direct Net Selling Price",
    requiresDeposit: false,
    defaultCreditDays: 0,
    status: "Active"
  }
];

export const initialPartnerPerformanceTiers: PartnerPerformanceTier[] = [
  {
    id: "tier-plat",
    name: "Platinum Strategic Partner",
    code: "PLATINUM",
    rank: 1,
    description: "Highest-volume tier reserved for flagship distributors with exclusive territorial commitment and state-level healthcare infrastructure.",
    eligibilityCriteria: [
      "Annual procurement > ₹5.00 Crore across primary surgical portfolios",
      "Zero commercial default or 60+ days payment overdue in past 12 months",
      "Dedicated orthopedic clinical field support and specialized surgical instrumentation tray cache",
      "Standard operating cold-chain warehouse with 24/7 emergency trauma dispatch"
    ],
    benefits: [
      "Priority manufacturing batch reservation and dispatch within 12 hours",
      "Quarterly executive QBR with Principal Commercial Director",
      "10-day payment grace period extension on unexpected hospital billing holds",
      "Co-marketing and CME medical symposium subsidy (up to 2% of annual volume)"
    ],
    reviewFrequency: "Quarterly",
    status: "Active",
    effectiveFrom: "2026-01-01"
  },
  {
    id: "tier-gold",
    name: "Gold Premier Partner",
    code: "GOLD",
    rank: 2,
    description: "Established core commercial partners with consistent regional hospital servicing and proven surgical portfolio growth.",
    eligibilityCriteria: [
      "Annual procurement > ₹2.00 Crore in designated territory",
      "Average Days Sales Outstanding (DSO) < 45 days",
      "Valid state wholesale Drug License Form 20B/21B and MDR registration",
      "Active servicing of at least 15 tertiary or corporate hospitals"
    ],
    benefits: [
      "Priority dispatch within 24 hours from regional mother warehouse",
      "Dedicated Principal regional customer service representative",
      "Access to promotional demo sets and hospital trial implants",
      "Standard 7-day payment grace window"
    ],
    reviewFrequency: "Quarterly",
    status: "Active",
    effectiveFrom: "2026-01-01"
  },
  {
    id: "tier-silver",
    name: "Silver Growth Partner",
    code: "SILVER",
    rank: 3,
    description: "Developing regional distributors and specialized surgical suppliers expanding into district hospitals and nursing homes.",
    eligibilityCriteria: [
      "Annual procurement > ₹50.00 Lakh",
      "Verified GSTIN registration and compliant statutory tax filings",
      "Adherence to Principal standard ethical compliance & code of conduct"
    ],
    benefits: [
      "Standard 48-hour order dispatch from assigned mother warehouse",
      "Full access to VinFlux B2B Principal Distribution Portal",
      "Standard product technical support and documentation packs"
    ],
    reviewFrequency: "Biannual",
    status: "Active",
    effectiveFrom: "2026-01-01"
  },
  {
    id: "tier-bronze",
    name: "Bronze Onboarding Partner",
    code: "BRONZE",
    rank: 4,
    description: "Entry-level tier for recently onboarded partners, specialized single-account suppliers, and trial distribution contracts.",
    eligibilityCriteria: [
      "Verified statutory KYC documents (GSTIN, PAN, Drug License)",
      "Standard security deposit or bank guarantee on file",
      "Completed VinFlux Distribution Agreement signing"
    ],
    benefits: [
      "Standard catalogue supply under default channel credit and discount terms",
      "Online order desk and dispatch tracking via Distribution Portal"
    ],
    reviewFrequency: "Annual",
    status: "Active",
    effectiveFrom: "2026-01-01"
  }
];

export const initialDistributionLevels: DistributionLevel[] = [
  {
    id: "dl-tier1",
    code: "DL-1",
    name: "Tier 1 — Wholesale Aggregator / Mother Depot Stockist",
    description: "Primary distribution tier receiving direct bulk dispatches from Principal factory or mother distribution centers. Authorized to supply Tier 2 distributors and corporate hospital chains.",
    allowedPartnerTypes: ["Distributor", "C&F Agent", "Super Stockist", "Regional Distributor"],
    successorLevels: ["DL-2", "DL-3", "DL-NA"],
    status: "Active"
  },
  {
    id: "dl-tier2",
    code: "DL-2",
    name: "Tier 2 — Regional / Zonal Channel Stockist",
    description: "Intermediate regional channel partner servicing city-level hospitals, specialist clinics, and local surgical retail dealers.",
    allowedPartnerTypes: ["Distributor", "Sub-Distributor", "Regional Distributor"],
    predecessorLevels: ["DL-1"],
    successorLevels: ["DL-3", "DL-NA"],
    status: "Active"
  },
  {
    id: "dl-tier3",
    code: "DL-3",
    name: "Tier 3 — Area Retail Stockist / Surgical Dealer",
    description: "Last-mile surgical dispensary supplying private nursing homes, day-care surgical centers, and outpatient clinical facilities.",
    allowedPartnerTypes: ["Sub-Distributor", "Retailer"],
    predecessorLevels: ["DL-1", "DL-2"],
    successorLevels: ["DL-NA"],
    status: "Active"
  },
  {
    id: "dl-na",
    code: "DL-NA",
    name: "Not Applicable (Institutional Direct / Healthcare Provider)",
    description: "Healthcare delivery institutions, government medical colleges, or direct clinicians receiving supplies without intermediary resale distribution.",
    allowedPartnerTypes: ["Hospital", "Clinic", "Other Customer"],
    predecessorLevels: ["DL-1", "DL-2", "DL-3"],
    status: "Active"
  }
];

export const initialDistributionRoutes: DistributionRoute[] = [
  {
    id: "path-01",
    code: "PATH-DIRECT-INST",
    name: "Direct Institutional Supply (Mfr → Hospital)",
    description: "Direct rate contract delivery for corporate hospital chains, tertiary care institutions, and central medical tenders.",
    routeType: "Direct",
    status: "Active",
    effectiveFrom: "2026-01-01",
    commercialModel: "Direct Hospital Invoicing",
    stages: ["Principal", "Hospital"],
    permittedPortfolios: ["All Portfolios"],
    applicableTerritoryIds: ["terr-telangana", "terr-andhra", "terr-karnataka", "terr-west", "terr-north"],
    applicableChannelIds: ["ct-direct", "ct-institution"],
    nodes: [
      {
        id: "node-p1-1",
        level: 1,
        participantType: "Principal",
        typeId: "ct-direct",
        label: "Principal (Biorad Medisys)",
        role: "Origin / Invoicer",
        pricingPoint: "Ex-Factory Cost",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Principal Owned",
          stockTransferResponsibility: "Principal Dispatch",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: false,
          applicablePriceTier: "SLMC Cost",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p1-2",
        level: 2,
        participantType: "Hospital",
        typeId: "ct-institution",
        label: "Direct Institution / Hospital",
        role: "Consignee & Clinical Debtor",
        pricingPoint: "Rate Contract Price",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Customer Owned",
          stockTransferResponsibility: "Direct Courier",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: true,
          applicablePriceTier: "Rate Contract / Institutional Price",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      }
    ],
    history: [
      {
        id: "aud-01",
        timestamp: "2026-01-01 09:30",
        action: "Created",
        changedBy: "Dr. Arvind Rao",
        description: "Initial route architecture approved for Direct Corporate Hospital Supply."
      }
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-10-15",
    createdBy: "Commercial Director"
  },
  {
    id: "path-02",
    code: "PATH-STD-DIST",
    name: "Standard Direct Distribution (Mfr → Distributor → Hospital)",
    description: "Primary commercial distribution route for private healthcare institutions with single intermediary distributor.",
    routeType: "Single-Tier Intermediary",
    status: "Active",
    effectiveFrom: "2026-01-01",
    commercialModel: "Title Transfer",
    stages: ["Principal", "Distributor", "Hospital"],
    permittedPortfolios: ["Arthroplasty — Joint Replacement", "Trauma & Extremities"],
    applicableTerritoryIds: ["terr-telangana", "terr-andhra", "terr-karnataka", "terr-west", "terr-north"],
    applicableChannelIds: ["ct-distributor", "ct-institution"],
    nodes: [
      {
        id: "node-p2-1",
        level: 1,
        participantType: "Principal",
        typeId: "ct-direct",
        label: "Principal (Biorad Medisys)",
        role: "Production Origin / Invoicer",
        pricingPoint: "Base Cost Basis",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Principal Owned",
          stockTransferResponsibility: "Principal Dispatch",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: false,
          applicablePriceTier: "SLMC Cost",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p2-2",
        level: 2,
        participantType: "Distributor",
        typeId: "ct-distributor",
        label: "Authorized Channel Stockist",
        role: "Channel Stockist & Last-Mile Reseller",
        pricingPoint: "Price to Distributor (PTD)",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Title Transfer",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Price to Distributor (PTD)",
          nppaCeilingEnforced: true
        },
        assignedPartners: [
          {
            partnerId: "part-dist-a",
            partnerName: "Distributor A Healthcare LLP",
            partnerCode: "DIST-TEL-01",
            territoryId: "terr-telangana",
            territoryName: "Telangana State",
            salesChannelId: "ct-distributor",
            effectiveFrom: "2026-01-15",
            status: "Active"
          },
          {
            partnerId: "part-dist-b",
            partnerName: "Distributor B Surgicals",
            partnerCode: "DIST-TEL-02",
            territoryId: "terr-telangana",
            territoryName: "Telangana State",
            salesChannelId: "ct-distributor",
            effectiveFrom: "2026-02-01",
            status: "Active"
          },
          {
            partnerId: "part-dist-d",
            partnerName: "Distributor D Ortho India Ltd",
            partnerCode: "DIST-KAR-01",
            territoryId: "terr-karnataka",
            territoryName: "Karnataka State",
            salesChannelId: "ct-distributor",
            effectiveFrom: "2026-01-20",
            status: "Active"
          }
        ]
      },
      {
        id: "node-p2-3",
        level: 3,
        participantType: "Hospital",
        typeId: "ct-institution",
        label: "Hospital / Healthcare Provider",
        role: "Clinical End-User & Consignee",
        pricingPoint: "Institutional / Hospital Price",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Customer Owned",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Rate Contract / Institutional Price",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      }
    ],
    history: [
      {
        id: "aud-02",
        timestamp: "2026-01-15 14:20",
        action: "Partner Assigned",
        changedBy: "Commercial Ops",
        description: "Assigned Distributor A Healthcare LLP and Distributor D Ortho India Ltd."
      }
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-10-28",
    createdBy: "Zonal Director"
  },
  {
    id: "path-03",
    code: "PATH-CNF-DIST",
    name: "Consignment Hub & Spoke (Mfr → C&F → Distributor → Hospital)",
    description: "Regional warehouse model utilizing state carrying & forwarding agents for local stock buffer and rapid hospital dispatch.",
    routeType: "Consignment Distribution",
    status: "Active",
    effectiveFrom: "2026-01-01",
    commercialModel: "Consignment Stock",
    stages: ["Principal", "C&F Agent", "Distributor", "Hospital"],
    permittedPortfolios: ["All Portfolios"],
    applicableTerritoryIds: ["terr-telangana", "terr-andhra", "terr-karnataka", "terr-west"],
    applicableChannelIds: ["ct-cnf", "ct-distributor", "ct-institution"],
    nodes: [
      {
        id: "node-p3-1",
        level: 1,
        participantType: "Principal",
        typeId: "ct-direct",
        label: "Principal (Biorad Medisys)",
        role: "Principal Owner & Consignor",
        pricingPoint: "SLMC Production Cost",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Principal Owned",
          stockTransferResponsibility: "Principal Dispatch",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: false,
          applicablePriceTier: "SLMC Cost",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p3-2",
        level: 2,
        participantType: "C&F Agent",
        typeId: "ct-cnf",
        label: "Carrying & Forwarding Depot",
        role: "State Consignment Custody & Transit Hub",
        pricingPoint: "4.5% Handling Fee",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Consignment Custody",
          stockTransferResponsibility: "C&F Warehouse Transit",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: false,
          applicablePriceTier: "SLMC Cost",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p3-3",
        level: 3,
        participantType: "Distributor",
        typeId: "ct-distributor",
        label: "Authorized Distributor",
        role: "Regional Reseller & Clinical Service",
        pricingPoint: "Price to Distributor (PTD)",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Title Transfer",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Price to Distributor (PTD)",
          nppaCeilingEnforced: true
        },
        assignedPartners: [
          {
            partnerId: "part-dist-c",
            partnerName: "Distributor C MedSupply Co",
            partnerCode: "DIST-AP-01",
            territoryId: "terr-andhra",
            territoryName: "Andhra Pradesh State",
            salesChannelId: "ct-distributor",
            effectiveFrom: "2026-02-10",
            status: "Active"
          }
        ]
      },
      {
        id: "node-p3-4",
        level: 4,
        participantType: "Hospital",
        typeId: "ct-institution",
        label: "Hospital / Healthcare Provider",
        role: "Surgical Theater End-User",
        pricingPoint: "Institutional Price",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Customer Owned",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Rate Contract / Institutional Price",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      }
    ],
    history: [
      {
        id: "aud-03",
        timestamp: "2026-02-10 11:00",
        action: "Partner Assigned",
        changedBy: "Commercial Ops",
        description: "Assigned Distributor C MedSupply Co for AP regional distribution."
      }
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-10-20",
    createdBy: "Supply Chain Head"
  },
  {
    id: "path-04",
    code: "PATH-WHOLESALE-FULL",
    name: "Multi-Tier Wholesale (Mfr → C&F → Super Stockist → Distributor → Dealer → Hospital)",
    description: "Comprehensive consumer, surgical dealer, and pharmacy wholesale channel for surgical consumables and OTC supplies.",
    routeType: "Multi-Tier Wholesale",
    status: "Active",
    effectiveFrom: "2026-01-01",
    commercialModel: "Title Transfer",
    stages: ["Principal", "C&F Agent", "Super Stockist", "Distributor", "Sub-Distributor", "Hospital"],
    permittedPortfolios: ["Hospital Consumables & Bio-Materials"],
    applicableTerritoryIds: ["terr-telangana", "terr-karnataka", "terr-west"],
    applicableChannelIds: ["ct-cnf", "ct-super-stockist", "ct-distributor", "ct-sub-distributor", "ct-retailer"],
    nodes: [
      {
        id: "node-p4-1",
        level: 1,
        participantType: "Principal",
        typeId: "ct-direct",
        label: "Principal (Biorad Medisys)",
        role: "Manufacturing Plant Origin",
        pricingPoint: "Production Cost Basis",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Principal Owned",
          stockTransferResponsibility: "Principal Dispatch",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: false,
          applicablePriceTier: "SLMC Cost",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p4-2",
        level: 2,
        participantType: "C&F Agent",
        typeId: "ct-cnf",
        label: "C&F Depot",
        role: "State Custody Logistics",
        pricingPoint: "Consignment Handling Fee",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Consignment Custody",
          stockTransferResponsibility: "C&F Warehouse Transit",
          invoicingParty: "Principal",
          paymentCollection: "Direct Bank Transfer to Principal",
          creditLimitEnforced: false,
          applicablePriceTier: "SLMC Cost",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p4-3",
        level: 3,
        participantType: "Super Stockist",
        typeId: "ct-super-stockist",
        label: "Super Stockist",
        role: "Zonal Aggregator & Wholesaler",
        pricingPoint: "Price to Super Stockist (PTS)",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Title Transfer",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Super Stockist",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Price to Super Stockist (PTS)",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p4-4",
        level: 4,
        participantType: "Distributor",
        typeId: "ct-distributor",
        label: "Authorized Distributor",
        role: "City Channel Stockist",
        pricingPoint: "Price to Distributor (PTD)",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Title Transfer",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Price to Distributor (PTD)",
          nppaCeilingEnforced: true
        },
        assignedPartners: [
          {
            partnerId: "part-dist-a",
            partnerName: "Distributor A Healthcare LLP",
            partnerCode: "DIST-TEL-01",
            territoryId: "terr-telangana",
            territoryName: "Telangana State",
            salesChannelId: "ct-distributor",
            effectiveFrom: "2026-01-15",
            status: "Active"
          }
        ]
      },
      {
        id: "node-p4-5",
        level: 5,
        participantType: "Sub-Distributor",
        typeId: "ct-sub-distributor",
        label: "Sub-Distributor / Surgical Dealer",
        role: "Area Retail Trader",
        pricingPoint: "Price to Retailer (PTR)",
        isRequired: false,
        operationalRules: {
          inventoryOwnership: "Title Transfer",
          stockTransferResponsibility: "Distributor Last-Mile",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Price to Retailer (PTR)",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      },
      {
        id: "node-p4-6",
        level: 6,
        participantType: "Hospital",
        typeId: "ct-institution",
        label: "Hospital / Healthcare Provider",
        role: "Final Dispensing & Clinic",
        pricingPoint: "Maximum Retail Price (MRP)",
        isRequired: true,
        operationalRules: {
          inventoryOwnership: "Customer Owned",
          stockTransferResponsibility: "Direct Courier",
          invoicingParty: "Distributor",
          paymentCollection: "Distributor Collection",
          creditLimitEnforced: true,
          applicablePriceTier: "Maximum Retail Price (MRP)",
          nppaCeilingEnforced: true
        },
        assignedPartners: []
      }
    ],
    history: [
      {
        id: "aud-04",
        timestamp: "2026-01-01 10:00",
        action: "Created",
        changedBy: "Dr. Arvind Rao",
        description: "Multi-tier retail distribution path configured."
      }
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-10-18",
    createdBy: "Commercial Director"
  }
];

export const initialTerritories: Territory[] = [
  {
    id: "terr-telangana",
    name: "AP & Telangana Territory",
    code: "TERR-APT",
    description: "Core surgical implants territory covering Greater Hyderabad, Secunderabad corporate hospital clusters, NTR District Vijayawada, Visakhapatnam MedTech Zone, and coastal tertiary healthcare centers.",
    country: "India",
    zone: "South Zone",
    state: "Andhra Pradesh & Telangana",
    district: "NTR District, Visakhapatnam, Hyderabad",
    city: "Vijayawada & Hyderabad",
    pinCode: "500001 - 530048",
    parentTerritoryId: "terr-south",
    parentTerritoryName: "South Zone",
    assignedChannelId: "ct-distributor",
    assignedChannelName: "Authorized Distributor",
    assignedRouteId: "path-02",
    assignedRouteName: "PATH-STD-DIST (Direct: Mfr → Distributor → Hospital)",
    lead: "K. Sudhakar Rao (Zonal Commercial Manager)",
    activePartnersCount: 3,
    annualTarget: 157000000,
    status: "Active",
    lifecycleState: "Active",
    priorityScore: 90,
    assignmentPredicates: {
      facilityTypes: ["Corporate Tertiary Hospital", "Government Medical College", "Specialist Surgical Center"],
      minBedCount: 150,
      requiredSpecialties: ["Orthopedic Surgery", "Trauma Care Level-1", "Robotic OT"],
      minSpendCapacity: 15000000
    },
    targetAccountsCount: 52,
    coveredAccountsCount: 50,
    coverageRatio: 96.15,
    conflictCount: 0,
    effectiveFrom: "2026-01-01",
    notes: "Key accounts include NIMS, Apollo Jubilee Hills, Yashoda Secunderabad, King George Hospital, and Ramesh Hospitals.",
    geographicCoverage: [
      {
        id: "geo-apt-01",
        country: "India",
        zone: "South Zone",
        state: "Andhra Pradesh",
        district: "NTR District",
        city: "Vijayawada",
        locality: "Benz Circle",
        pinCodes: ["520001", "520010"],
        notes: "Vijayawada commercial healthcare nexus"
      },
      {
        id: "geo-apt-02",
        country: "India",
        zone: "South Zone",
        state: "Andhra Pradesh",
        district: "Visakhapatnam District",
        city: "Visakhapatnam",
        locality: "",
        pinCodes: ["530001", "530013"],
        notes: "Coastal port and orthopedic centers"
      },
      {
        id: "geo-apt-03",
        country: "India",
        zone: "South Zone",
        state: "Telangana",
        district: "Hyderabad District",
        city: "Hyderabad",
        locality: "Banjara Hills",
        pinCodes: ["500034", "500082"],
        notes: "Corporate hospital cluster"
      }
    ],
    history: [
      {
        id: "th-ts-1",
        timestamp: "2026-01-01 09:30",
        action: "Territory Created & Assigned",
        performedBy: "Dr. Arvind Rao",
        details: "Established AP & Telangana commercial boundary under South Zone HQ."
      }
    ],
    defaultCommercialTerms: {
      territoryId: "terr-telangana",
      territoryName: "AP & Telangana Territory",
      defaultDiscountPercent: 5.0, // Critical benchmark: default 5%
      creditLimit: 3500000,
      creditPeriodDays: 45,
      minimumSecurityDeposit: 1000000,
      productDiscounts: [
        { productId: "PRD-EVOCON-001", productName: "GENIUS EVOCON TIBIAL TRAY FULL AUGMENT SIZE 3", sku: "8903209039234", discountPercent: 6.0 },
        { productId: "PRD-ROBO-002", productName: "Smart Torque Digital Surgical Driver V4", sku: "8904101902811", discountPercent: 4.0 }
      ],
      applicableRateRules: ["South Zone Price List v2", "State Standard Tax 5% Rate"],
      effectiveFrom: "2026-01-01",
      version: "v2.1",
      status: "Active",
      history: [
        { version: "v2.1", effectiveDate: "2026-01-01", discountPercent: 5.0, creditLimit: 3500000, modifiedBy: "Dr. Arvind Rao", changeReason: "Annual GTM alignment" },
        { version: "v2.0", effectiveDate: "2025-04-01", discountPercent: 4.5, creditLimit: 3000000, modifiedBy: "Commercial Finance", changeReason: "Initial FY25 baseline" }
      ]
    }
  },
  {
    id: "terr-cds",
    name: "CDS",
    code: "TERR-018",
    description: "Central Distribution & Supply (CDS) corridor for Coastal Andhra Pradesh, centered at Eluru mother hub with express hospital replenishment routes.",
    country: "India",
    zone: "South Zone",
    state: "Andhra Pradesh",
    district: "West Godavari District",
    city: "Eluru",
    pinCode: "534001 - 534007",
    parentTerritoryId: "terr-south",
    parentTerritoryName: "South Zone",
    assignedChannelId: "ct-cnf",
    assignedChannelName: "C&F Agent (Carrying & Forwarding)",
    assignedRouteId: "path-03",
    assignedRouteName: "PATH-CNF-DIST (Hub & Spoke: Mfr → C&F → Distributor → Hospital)",
    lead: "Zonal Commercial Manager",
    activePartnersCount: 0,
    annualTarget: 60000000,
    status: "Active",
    lifecycleState: "Active",
    priorityScore: 80,
    assignmentPredicates: {
      facilityTypes: ["Corporate Tertiary Hospital", "Specialist Surgical Center"],
      minBedCount: 100,
      requiredSpecialties: ["Orthopedic Surgery", "Trauma Care Level-1"],
      minSpendCapacity: 8000000
    },
    targetAccountsCount: 24,
    coveredAccountsCount: 22,
    coverageRatio: 91.66,
    conflictCount: 0,
    effectiveFrom: "2026-01-01",
    notes: "Strategic surgical implants market with concentrated tertiary hospital networks and cold-chain distribution. Primary Hub: ELURU.",
    geographicCoverage: [
      {
        id: "geo-cds-01",
        country: "India",
        zone: "South Zone",
        state: "Andhra Pradesh",
        district: "West Godavari District",
        city: "Eluru",
        locality: "Powerpet Commercial Hub",
        pinCodes: ["534001", "534002"],
        notes: "Central Consignment warehouse depot"
      },
      {
        id: "geo-cds-02",
        country: "India",
        zone: "South Zone",
        state: "Andhra Pradesh",
        district: "Krishna District",
        city: "Machilipatnam",
        locality: "Main Road Port Cluster",
        pinCodes: ["521001", "521002"],
        notes: "Coastal hospital distribution route"
      }
    ],
    history: [
      {
        id: "th-cds-1",
        timestamp: "2026-01-02 11:15",
        action: "Territory Created & Assigned",
        performedBy: "Dr. Arvind Rao",
        details: "Created CDS Territory under Andhra Pradesh State with Eluru C&F Depot."
      }
    ],
    defaultCommercialTerms: {
      territoryId: "terr-cds",
      territoryName: "CDS",
      defaultDiscountPercent: 4.5,
      creditLimit: 2500000,
      creditPeriodDays: 30,
      minimumSecurityDeposit: 800000,
      productDiscounts: [],
      applicableRateRules: ["Coastal AP C&F Consignment Terms"],
      effectiveFrom: "2026-01-01",
      version: "v1.0",
      status: "Active",
      history: []
    }
  },
  {
    id: "terr-karnataka",
    name: "Karnataka Territory",
    code: "TERR-KA",
    description: "High-density medical corridor covering Greater Bengaluru Metro, Peenya industrial supply chain, Electronic City corridor, Mysore, and Mangalore coastal healthcare institutions.",
    country: "India",
    zone: "South Zone",
    state: "Karnataka",
    district: "Bengaluru Urban",
    city: "Bangalore",
    pinCode: "560001 - 575001",
    parentTerritoryId: "terr-south",
    parentTerritoryName: "South Zone",
    assignedChannelId: "ct-distributor",
    assignedChannelName: "Authorized Distributor",
    assignedRouteId: "path-02",
    assignedRouteName: "PATH-STD-DIST (Direct: Mfr → Distributor → Hospital)",
    lead: "S. Swaminathan (Zonal Director)",
    activePartnersCount: 2,
    annualTarget: 110000000,
    status: "Active",
    lifecycleState: "Active",
    priorityScore: 85,
    assignmentPredicates: {
      facilityTypes: ["Corporate Tertiary Hospital", "Private Multi-Specialty"],
      minBedCount: 100,
      requiredSpecialties: ["Orthopedic Surgery", "Robotic OT"],
      minSpendCapacity: 10000000
    },
    targetAccountsCount: 38,
    coveredAccountsCount: 36,
    coverageRatio: 94.73,
    conflictCount: 0,
    effectiveFrom: "2026-01-01",
    notes: "Key accounts: Manipal Hospital, Narayana Health City, Aster CMI, and Apollo Bannerghatta.",
    geographicCoverage: [
      {
        id: "geo-ka-01",
        country: "India",
        zone: "South Zone",
        state: "Karnataka",
        district: "Bengaluru Urban",
        city: "Bangalore",
        locality: "Peenya Industrial Area",
        pinCodes: ["560058", "560010", "560022"],
        notes: "Mother warehouse & wholesale supply depot"
      }
    ],
    history: [
      {
        id: "th-ka-1",
        timestamp: "2026-01-01 10:30",
        action: "Territory Created & Assigned",
        performedBy: "Dr. Arvind Rao",
        details: "Established Karnataka Territory commercial boundary under South Zone HQ."
      }
    ],
    defaultCommercialTerms: {
      territoryId: "terr-karnataka",
      territoryName: "Karnataka Territory",
      defaultDiscountPercent: 4.0, // Critical benchmark: Karnataka default 4%
      creditLimit: 4000000,
      creditPeriodDays: 45,
      minimumSecurityDeposit: 1200000,
      productDiscounts: [
        { productId: "PRD-EVOCON-001", productName: "GENIUS EVOCON TIBIAL TRAY FULL AUGMENT SIZE 3", sku: "8903209039234", discountPercent: 5.0 },
        { productId: "PRD-CSM-003", productName: "Sterile Bio-Resorbable Hemostatic Gauze 10x10cm", sku: "8906001248092", discountPercent: 6.0 }
      ],
      applicableRateRules: ["Bangalore Metro Rate Contract"],
      effectiveFrom: "2026-01-01",
      version: "v2.3",
      status: "Active",
      history: [
        { version: "v2.3", effectiveDate: "2026-01-01", discountPercent: 4.0, creditLimit: 4000000, modifiedBy: "S. Swaminathan", changeReason: "Tier-1 Metro commercial policy" }
      ]
    }
  },
  {
    id: "terr-tamilnadu",
    name: "Tamil Nadu Territory",
    code: "TERR-TN",
    description: "Southern healthcare cluster covering Chennai Metro, Coimbatore medical devices corridor, and Madurai healthcare centers.",
    country: "India",
    zone: "South Zone",
    state: "Tamil Nadu",
    district: "Chennai",
    city: "Chennai",
    pinCode: "600001 - 600028",
    parentTerritoryId: "terr-south",
    parentTerritoryName: "South Zone",
    assignedChannelId: "ct-distributor",
    assignedChannelName: "Authorized Distributor",
    assignedRouteId: "path-02",
    assignedRouteName: "PATH-STD-DIST (Direct: Mfr → Distributor → Hospital)",
    lead: "R. Sundaram (Zonal Manager)",
    activePartnersCount: 0,
    annualTarget: 90000000,
    status: "Draft",
    lifecycleState: "Draft",
    priorityScore: 60,
    assignmentPredicates: {
      facilityTypes: ["Corporate Tertiary Hospital", "Government Medical College"],
      minBedCount: 100,
      requiredSpecialties: ["Orthopedic Surgery"]
    },
    targetAccountsCount: 32,
    coveredAccountsCount: 0,
    coverageRatio: 0.0,
    conflictCount: 0,
    effectiveFrom: "2026-04-01",
    geographicCoverage: [],
    history: [
      {
        id: "th-tn-1",
        timestamp: "2026-03-01 10:00",
        action: "Draft Proposal Created",
        performedBy: "Dr. Arvind Rao",
        details: "Initiated Tamil Nadu State expansion blueprint under South Zone."
      }
    ],
    defaultCommercialTerms: {
      territoryId: "terr-tamilnadu",
      territoryName: "Tamil Nadu Territory",
      defaultDiscountPercent: 5.0,
      creditLimit: 3000000,
      creditPeriodDays: 45,
      minimumSecurityDeposit: 1000000,
      productDiscounts: [],
      applicableRateRules: ["Draft Southern Terms"],
      effectiveFrom: "2026-04-01",
      version: "v1.0-draft",
      status: "Pending",
      history: []
    }
  },
  {
    id: "terr-west",
    name: "West Zone (Maharashtra & Goa)",
    code: "TERR-WEST",
    description: "Western commercial powerhouse covering Mumbai Metropolitan Region (MMR), Pune auto-medtech corridor, Thane, Nagpur, and Goa coastal surgical centers.",
    country: "India",
    zone: "West Zone",
    state: "Maharashtra",
    district: "Mumbai City, Mumbai Suburban, Thane, Pune, Nagpur",
    city: "Mumbai",
    pinCode: "400001 - 411001",
    parentTerritoryId: null,
    parentTerritoryName: "National Headquarters",
    assignedChannelId: "ct-distributor",
    assignedChannelName: "Authorized Distributor",
    assignedRouteId: "path-03",
    assignedRouteName: "PATH-CNF-DIST (Hub & Spoke: Mfr → C&F → Distributor → Hospital)",
    lead: "Vikram Mehta (Zonal Director)",
    activePartnersCount: 1,
    annualTarget: 145000000,
    status: "Active",
    effectiveFrom: "2026-01-01",
    notes: "Key accounts: Lilavati Hospital, Kokilaben Dhirubhai Ambani, Hinduja Hospital, and Ruby Hall Pune.",
    geographicCoverage: [
      {
        id: "geo-w-01",
        country: "India",
        zone: "West Zone",
        state: "Maharashtra",
        district: "Mumbai Suburban & Thane",
        city: "Mumbai",
        locality: "Andheri East, BKC, Bhiwandi Logistics Depot",
        pinCodes: ["400051", "400069", "421302"],
        notes: "Central mother warehouse and corporate distributor corridor"
      },
      {
        id: "geo-w-02",
        country: "India",
        zone: "West Zone",
        state: "Maharashtra",
        district: "Pune",
        city: "Pune",
        locality: "Hinjewadi, Hadapsar, Shivajinagar",
        pinCodes: ["411001", "411057"],
        notes: "Major orthopedic teaching and research hospital cluster"
      }
    ],
    history: [
      {
        id: "th-w-1",
        timestamp: "2026-01-01 11:00",
        action: "Territory Created & Assigned",
        performedBy: "Dr. Arvind Rao",
        details: "Established West Zone commercial boundary."
      }
    ],
    defaultCommercialTerms: {
      territoryId: "terr-west",
      territoryName: "West Zone (Maharashtra & Goa)",
      defaultDiscountPercent: 5.5,
      creditLimit: 4500000,
      creditPeriodDays: 45,
      minimumSecurityDeposit: 1500000,
      productDiscounts: [
        { productId: "PRD-EVOCON-001", productName: "GENIUS EVOCON TIBIAL TRAY FULL AUGMENT SIZE 3", sku: "8903209039234", discountPercent: 6.5 }
      ],
      applicableRateRules: ["Western Region Hub Terms", "Mumbai Port Handling Rebate"],
      effectiveFrom: "2026-01-01",
      version: "v3.0",
      status: "Active",
      history: [
        { version: "v3.0", effectiveDate: "2026-01-01", discountPercent: 5.5, creditLimit: 4500000, modifiedBy: "Vikram Mehta", changeReason: "Hub & Spoke C&F cost integration" }
      ]
    }
  },
  {
    id: "terr-north",
    name: "North Zone (Delhi NCR, Punjab, Haryana)",
    code: "TERR-NORTH",
    description: "Northern capital territory and regional medical centers encompassing Delhi NCR, Gurgaon cyber corridor, Noida, Chandigarh tri-city, and Ludhiana.",
    country: "India",
    zone: "North Zone",
    state: "Delhi",
    district: "New Delhi, Gurgaon, Gautam Buddha Nagar, Chandigarh",
    city: "New Delhi",
    pinCode: "110001 - 122001",
    parentTerritoryId: null,
    parentTerritoryName: "National Headquarters",
    assignedChannelId: "ct-distributor",
    assignedChannelName: "Authorized Distributor",
    assignedRouteId: "path-01",
    assignedRouteName: "PATH-DIRECT-INST (Institutional Tender Bypass)",
    lead: "Rajesh Sharma (Zonal Director)",
    activePartnersCount: 0,
    annualTarget: 160000000,
    status: "Active",
    effectiveFrom: "2026-01-01",
    notes: "Key accounts: AIIMS New Delhi, Medanta The Medicity Gurgaon, Max Healthcare, and Fortis Memorial Research.",
    geographicCoverage: [
      {
        id: "geo-n-01",
        country: "India",
        zone: "North Zone",
        state: "Delhi",
        district: "New Delhi & South Delhi",
        city: "New Delhi",
        locality: "Ansari Nagar, Connaught Place, Okhla Industrial Area",
        pinCodes: ["110001", "110020", "110029"],
        notes: "National institutional healthcare nexus"
      },
      {
        id: "geo-n-02",
        country: "India",
        zone: "North Zone",
        state: "Haryana",
        district: "Gurgaon",
        city: "Gurgaon",
        locality: "Cyber City, Sector 38 Medicity, Sector 29",
        pinCodes: ["122001", "122002"],
        notes: "Private multi-specialty hospital chains"
      }
    ],
    history: [
      {
        id: "th-n-1",
        timestamp: "2026-01-01 11:30",
        action: "Territory Created & Assigned",
        performedBy: "Dr. Arvind Rao",
        details: "Established North Zone commercial boundary."
      }
    ],
    defaultCommercialTerms: {
      territoryId: "terr-north",
      territoryName: "North Zone (Delhi NCR, Punjab, Haryana)",
      defaultDiscountPercent: 5.0,
      creditLimit: 5000000,
      creditPeriodDays: 45,
      minimumSecurityDeposit: 1500000,
      productDiscounts: [],
      applicableRateRules: ["NCR Central Pricing Standard"],
      effectiveFrom: "2026-01-01",
      version: "v2.0",
      status: "Active",
      history: [
        { version: "v2.0", effectiveDate: "2026-01-01", discountPercent: 5.0, creditLimit: 5000000, modifiedBy: "Rajesh Sharma", changeReason: "Annual review" }
      ]
    }
  }
];
