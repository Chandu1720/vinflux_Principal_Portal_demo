import type { Partner } from '../types/partner.ts';

export const initialPartners: Partner[] = [
  {
    id: "part-dist-a",
    name: "Distributor A Healthcare LLP",
    code: "DIST-TEL-01",
    typeId: "ct-distributor",
    typeName: "Authorized Distributor",
    status: "Active",
    lifecycleStatus: "Active",
    classification: {
      partnerType: "Distributor",
      performanceTierId: "tier-plat",
      performanceTierName: "Platinum Strategic Partner",
      distributionLevelId: "dl-tier1",
      distributionLevelName: "Tier 1 — Wholesale Aggregator / Mother Depot Stockist",
      effectiveDate: "2026-01-15",
      approvalStatus: "Approved",
      reason: "Flagship strategic distribution partner for South Zone with state-wide network",
      history: [
        {
          id: "pch-a1",
          timestamp: "2026-01-15 10:00",
          changedBy: "Dr. Arvind Rao",
          fromTier: "Gold Premier Partner",
          toTier: "Platinum Strategic Partner",
          fromLevel: "Tier 2 — Regional Channel Stockist",
          toLevel: "Tier 1 — Wholesale Aggregator",
          reason: "Annual volume commitment exceeded ₹5.00 Cr threshold."
        }
      ]
    },
    channelAssignments: [
      {
        id: "pca-a1",
        partnerId: "part-dist-a",
        partnerName: "Distributor A Healthcare LLP",
        partnerCode: "DIST-TEL-01",
        salesChannelId: "ct-distributor",
        salesChannelName: "Authorized Distributor",
        salesChannelCode: "DIST",
        territoryScope: ["terr-telangana"],
        effectiveFrom: "2026-01-15",
        status: "Active",
        commercialTermStatus: "Deviated — Approved",
        commercialOverride: {
          overrideDiscountPercent: 14.0,
          channelDefaultDiscount: 12.0,
          requestedDiscount: 14.0,
          overrideCreditPeriodDays: 60,
          overrideCreditLimit: 4000000,
          overrideSecurityDeposit: 1000000,
          requestReason: "Metro corporate hospital network growth agreement",
          requestedBy: "K. Sudhakar Rao",
          requestedAt: "2026-01-15 10:15",
          approvedBy: "Commercial Director",
          approvedAt: "2026-01-15 14:30",
          approvalHistory: [
            {
              id: "cah-a1",
              timestamp: "2026-01-15 14:30",
              action: "Approved",
              actor: "Commercial Director",
              oldDiscountPercent: 12.0,
              newDiscountPercent: 14.0,
              comments: "Approved based on executive QBR volume target commitment."
            }
          ]
        },
        notes: "Primary authorized distributor channel contract"
      },
      {
        id: "pca-a2",
        partnerId: "part-dist-a",
        partnerName: "Distributor A Healthcare LLP",
        partnerCode: "DIST-TEL-01",
        salesChannelId: "ct-institution",
        salesChannelName: "Direct Institution / Hospital",
        salesChannelCode: "INST",
        territoryScope: ["terr-telangana"],
        effectiveFrom: "2026-02-01",
        status: "Active",
        commercialTermStatus: "Standard",
        commercialOverride: {
          channelDefaultDiscount: 0.0,
          requestReason: "Standard government medical college tender participation",
          approvalHistory: []
        },
        notes: "Secondary channel for institutional rate contracts"
      }
    ],
    gstin: "36AABCP1122K1Z5",
    gstinStatus: "Verified on GST Portal",
    pan: "AABCP1122K",
    drugLicenseNo: "TS-HYD-20B-99120 / 21B-99121",
    drugLicenseExpiry: "2028-06-30",
    mdrLicenseNo: "MDR-36-TS-2024-00142",
    authorizedContactPerson: "Anand Rathi",
    contactDesignation: "Managing Partner",
    officialEmail: "orders@distributora-health.com",
    mobilePhone: "+91 98490 22110",
    warehouseAddress: "Plot 12, Industrial Park, Nacharam, Hyderabad 500076",
    kycStatus: "Verified",
    kycDocuments: [
      { id: "doc-a1", title: "GSTIN Certificate", type: "GSTIN Certificate", fileName: "GSTIN_36AABCP1122K1Z5.pdf", uploadDate: "2026-01-15", verificationStatus: "Verified", fileSize: "1.2 MB" },
      { id: "doc-a2", title: "PAN Card Copy", type: "PAN Card", fileName: "PAN_AABCP1122K.pdf", uploadDate: "2026-01-15", verificationStatus: "Verified", fileSize: "640 KB" },
      { id: "doc-a3", title: "Drug License 20B/21B", type: "Drug License Form 20B/21B", fileName: "DL_TS_HYD_99120.pdf", uploadDate: "2026-01-16", verificationStatus: "Verified", fileSize: "2.1 MB" },
      { id: "doc-a4", title: "MDR Medical Device License", type: "MDR Medical Device License", fileName: "MDR_TS_2024.pdf", uploadDate: "2026-01-16", verificationStatus: "Verified", fileSize: "1.8 MB" }
    ],
    creditLimit: 3500000,
    creditDays: "45 days (Tier Default)",
    gracePeriodDays: 7,
    outstandingAmount: 1850000,
    overdueAmount: 0,
    openOrdersAmount: 320000,
    creditHold: false,
    securityDepositHeld: 1000000,
    depositInstrument: "Bank Guarantee (HDFC Bank)",
    depositExpiry: "2027-12-31",
    assignedTerritoryIds: ["terr-telangana"],
    assignedChannelIds: ["ct-distributor"],
    assignedRouteId: "path-02",
    tierPriceLevel: "PTD (Tier 1)",
    
    // Repeatable Distribution & Supply Assignments
    distributionAssignments: [
      {
        id: "asgn-a1",
        partnerId: "part-dist-a",
        territoryId: "terr-telangana",
        territoryName: "Telangana State",
        branchId: "br-hyd-04",
        branchName: "Telangana & AP Regional — Hyderabad Branch",
        warehouseId: "wh-medc-06",
        warehouseName: "Medchal MedTech Logistics Hub",
        assignmentType: "Primary Invoicing & Dispatch",
        isPrimary: true,
        effectiveFrom: "2026-01-15",
        status: "Active",
        notes: "Main regional supply point for Greater Hyderabad territory"
      }
    ],

    // CRITICAL BUSINESS LOGIC: Telangana default 5% + Distributor A override 8% = 8% effective
    territoryCommercials: {
      "terr-telangana": {
        territoryId: "terr-telangana",
        territoryName: "Telangana State",
        inheritedDefaultDiscount: 5.0,
        partnerOverrideDiscount: 8.0,
        effectiveDiscount: 8.0,
        overrideOrigin: "Partner Override",
        creditLimitOverride: null,
        creditPeriodOverride: null,
        notes: "Strategic Metro growth agreement with agreed 8% commercial terms."
      }
    },
    commercialOverrides: {
      "terr-telangana": {
        id: "ovr-a1",
        partnerId: "part-dist-a",
        territoryId: "terr-telangana",
        territoryName: "Telangana State",
        overrideDiscountPercent: 8.0,
        overrideCreditPeriodDays: null,
        overrideCreditLimit: null,
        overrideSecurityDeposit: null,
        effectiveFrom: "2026-01-15",
        overrideReason: "Strategic Key Account growth target agreement",
        updatedBy: "Commercial Director",
        history: [
          {
            timestamp: "2026-01-15 10:30",
            field: "discountPercent",
            oldValue: 5.0,
            newValue: 8.0,
            reason: "Initial negotiated incentive tier",
            updatedBy: "Commercial Director"
          }
        ]
      }
    },
    invitationStatus: "Invite Sent",
    invitationSentDate: "2026-10-15 14:30",
    invitationExpiryDate: "2026-11-14 23:59",
    invitedEmail: "orders@distributora-health.com",
    portalAccessStatus: "Disabled", // Must remain Disabled until accepted!
    lastActiveDate: "--",
    portalUsers: [
      { id: "usr-a1", name: "Anand Rathi", email: "orders@distributora-health.com", role: "Distributor Administrator", status: "Invited" }
    ],
    activeContractsCount: 1,
    createdAt: "2026-01-15",
    updatedAt: "2026-10-15"
  },
  {
    id: "part-dist-b",
    name: "Distributor B Surgicals",
    code: "DIST-TEL-02",
    typeId: "ct-distributor",
    typeName: "Authorized Distributor",
    status: "Active",
    lifecycleStatus: "Active",
    classification: {
      partnerType: "Distributor",
      performanceTierId: "tier-gold",
      performanceTierName: "Gold Premier Partner",
      distributionLevelId: "dl-tier2",
      distributionLevelName: "Tier 2 — Regional / Zonal Channel Stockist",
      effectiveDate: "2026-02-01",
      approvalStatus: "Approved",
      reason: "Core regional distributor servicing North Telangana hospital cluster",
      reviewDue: true,
      proposedTierId: "tier-plat",
      proposedTierName: "Platinum Strategic Partner",
      history: [
        {
          id: "pch-b1",
          timestamp: "2026-02-01 11:00",
          changedBy: "Dr. Arvind Rao",
          fromTier: "Silver Growth Partner",
          toTier: "Gold Premier Partner",
          fromLevel: "Tier 2 — Regional Channel Stockist",
          toLevel: "Tier 2 — Regional Channel Stockist",
          reason: "Upgraded upon completing 12 consecutive months of prompt payment settlement."
        }
      ]
    },
    channelAssignments: [
      {
        id: "pca-b1",
        partnerId: "part-dist-b",
        partnerName: "Distributor B Surgicals",
        partnerCode: "DIST-TEL-02",
        salesChannelId: "ct-distributor",
        salesChannelName: "Authorized Distributor",
        salesChannelCode: "DIST",
        territoryScope: ["terr-telangana"],
        effectiveFrom: "2026-02-01",
        status: "Active",
        commercialTermStatus: "Standard",
        commercialOverride: {
          channelDefaultDiscount: 12.0,
          requestReason: "Standard commercial distributor terms",
          approvalHistory: []
        },
        notes: "Standard inherited authorized distributor terms"
      }
    ],
    gstin: "36AABCQ9876M1Z2",
    gstinStatus: "Verified on GST Portal",
    pan: "AABCQ9876M",
    drugLicenseNo: "TS-WAR-20B-44129 / 21B-44130",
    drugLicenseExpiry: "2028-11-30",
    mdrLicenseNo: "MDR-36-TS-2024-00218",
    authorizedContactPerson: "Sunita Reddy",
    contactDesignation: "Director of Operations",
    officialEmail: "contact@distributorb-surg.in",
    mobilePhone: "+91 98495 88771",
    warehouseAddress: "H.No 4-22, Hunter Road, Warangal, Telangana 506002",
    kycStatus: "Verified",
    kycDocuments: [
      { id: "doc-b1", title: "GSTIN Certificate", type: "GSTIN Certificate", fileName: "GSTIN_36AABCQ9876M1Z2.pdf", uploadDate: "2026-02-01", verificationStatus: "Verified", fileSize: "1.1 MB" },
      { id: "doc-b2", title: "Drug License", type: "Drug License Form 20B/21B", fileName: "DL_Warangal_44129.pdf", uploadDate: "2026-02-01", verificationStatus: "Verified", fileSize: "1.9 MB" }
    ],
    creditLimit: 3000000,
    creditDays: "45 days (Tier Default)",
    gracePeriodDays: 7,
    outstandingAmount: 1100000,
    overdueAmount: 0,
    openOrdersAmount: 210000,
    creditHold: false,
    securityDepositHeld: 1000000,
    depositInstrument: "Fixed Deposit Lien",
    depositExpiry: "2028-03-31",
    assignedTerritoryIds: ["terr-telangana"],
    assignedChannelIds: ["ct-distributor"],
    assignedRouteId: "path-02",
    tierPriceLevel: "PTD (Tier 1)",
    
    // Shared warehouse with Distributor A (validating business rule!)
    distributionAssignments: [
      {
        id: "asgn-b1",
        partnerId: "part-dist-b",
        territoryId: "terr-telangana",
        territoryName: "Telangana State",
        branchId: "br-hyd-04",
        branchName: "Telangana & AP Regional — Hyderabad Branch",
        warehouseId: "wh-medc-06",
        warehouseName: "Medchal MedTech Logistics Hub",
        assignmentType: "Primary Invoicing & Dispatch",
        isPrimary: true,
        effectiveFrom: "2026-02-01",
        status: "Active",
        notes: "Shared warehouse supply for North Telangana hospitals"
      }
    ],

    // CRITICAL BUSINESS LOGIC: Telangana default 5% + Distributor B without override = 5% effective
    territoryCommercials: {
      "terr-telangana": {
        territoryId: "terr-telangana",
        territoryName: "Telangana State",
        inheritedDefaultDiscount: 5.0,
        partnerOverrideDiscount: null,
        effectiveDiscount: 5.0,
        overrideOrigin: "Territory Default",
        notes: "Standard inherited territory commercial terms."
      }
    },
    commercialOverrides: {},
    invitationStatus: "Accepted",
    invitationSentDate: "2026-02-10 10:00",
    invitationAcceptedDate: "2026-02-11 16:20",
    invitedEmail: "contact@distributorb-surg.in",
    portalAccessStatus: "Active",
    lastActiveDate: "Today, 11:45 AM",
    portalUsers: [
      { id: "usr-b1", name: "Sunita Reddy", email: "contact@distributorb-surg.in", role: "Distributor Administrator", status: "Active", lastLogin: "Today, 11:45 AM" }
    ],
    activeContractsCount: 1,
    createdAt: "2026-02-01",
    updatedAt: "2026-10-20"
  },
  {
    id: "part-dist-c",
    name: "Distributor C Medical Devices",
    code: "DIST-AP-01",
    typeId: "ct-distributor",
    typeName: "Authorized Distributor",
    status: "Active",
    lifecycleStatus: "KYC Pending",
    classification: {
      partnerType: "Distributor",
      performanceTierId: "tier-silver",
      performanceTierName: "Silver Growth Partner",
      distributionLevelId: "dl-tier2",
      distributionLevelName: "Tier 2 — Regional / Zonal Channel Stockist",
      effectiveDate: "2026-10-20",
      approvalStatus: "Pending Review",
      reason: "New Coastal Andhra regional distributor onboarded",
      history: []
    },
    channelAssignments: [
      {
        id: "pca-c1",
        partnerId: "part-dist-c",
        partnerName: "Distributor C Medical Devices",
        partnerCode: "DIST-AP-01",
        salesChannelId: "ct-distributor",
        salesChannelName: "Authorized Distributor",
        salesChannelCode: "DIST",
        territoryScope: ["terr-andhra"],
        effectiveFrom: "2026-10-20",
        status: "Active",
        commercialTermStatus: "Deviated — Pending Approval",
        commercialOverride: {
          channelDefaultDiscount: 12.0,
          requestedDiscount: 15.0,
          overrideCreditPeriodDays: 60,
          overrideCreditLimit: 3000000,
          overrideSecurityDeposit: 800000,
          requestReason: "Coastal Andhra initial volume launch discount incentive",
          requestedBy: "M. Venkat Reddy (Zonal Director)",
          requestedAt: "2026-10-20 14:00",
          approvalHistory: [
            {
              id: "cah-c1",
              timestamp: "2026-10-20 14:00",
              action: "Requested",
              actor: "M. Venkat Reddy (Zonal Director)",
              oldDiscountPercent: 12.0,
              newDiscountPercent: 15.0,
              comments: "Requested 15% discount for 6 months to penetrate Visakhapatnam private hospitals."
            }
          ]
        },
        notes: "Deviated commercial terms pending approval from Commercial Director"
      }
    ],
    gstin: "37AABCR5543D1Z8",
    gstinStatus: "Pending Verification",
    pan: "AABCR5543D",
    drugLicenseNo: "AP-VIZ-20B-11820 / 21B-11821",
    drugLicenseExpiry: "2027-09-30",
    mdrLicenseNo: "MDR-37-AP-2023-00994",
    authorizedContactPerson: "G. Rama Rao",
    contactDesignation: "Proprietor",
    officialEmail: "orders@distributorc-devices.com",
    mobilePhone: "+91 98480 33445",
    warehouseAddress: "D.No 50-12-14, Seethammadhara, Visakhapatnam 530013",
    kycStatus: "Pending Verification",
    kycDocuments: [
      { id: "doc-c1", title: "GSTIN Certificate", type: "GSTIN Certificate", fileName: "GSTIN_AP_37AABCR.pdf", uploadDate: "2026-10-20", verificationStatus: "Pending", fileSize: "1.3 MB" },
      { id: "doc-c2", title: "Drug License Copy", type: "Drug License Form 20B/21B", fileName: "DL_AP_VIZ.pdf", uploadDate: "2026-10-20", verificationStatus: "Pending", fileSize: "2.4 MB" }
    ],
    creditLimit: 3000000,
    creditDays: "45 days (Tier Default)",
    gracePeriodDays: 7,
    outstandingAmount: 0,
    overdueAmount: 0,
    openOrdersAmount: 0,
    creditHold: false,
    securityDepositHeld: 800000,
    depositInstrument: "Bank Guarantee (SBI)",
    depositExpiry: "2027-10-31",
    assignedTerritoryIds: ["terr-andhra"],
    assignedChannelIds: ["ct-distributor"],
    assignedRouteId: "path-02",
    tierPriceLevel: "PTD (Tier 1)",
    distributionAssignments: [
      {
        id: "asgn-c1",
        partnerId: "part-dist-c",
        territoryId: "terr-andhra",
        territoryName: "Andhra Pradesh State",
        branchId: "br-hyd-04",
        branchName: "Telangana & AP Regional — Hyderabad Branch",
        warehouseId: "wh-medc-06",
        warehouseName: "Medchal MedTech Logistics Hub",
        assignmentType: "Primary Invoicing & Dispatch",
        isPrimary: true,
        effectiveFrom: "2026-10-20",
        status: "Active",
        notes: "Transit dispatch hub for Coastal Andhra territory"
      }
    ],

    // CRITICAL BUSINESS LOGIC: Andhra Pradesh default 6% + Distributor C without override = 6% effective
    territoryCommercials: {
      "terr-andhra": {
        territoryId: "terr-andhra",
        territoryName: "Andhra Pradesh State",
        inheritedDefaultDiscount: 6.0,
        partnerOverrideDiscount: null,
        effectiveDiscount: 6.0,
        overrideOrigin: "Territory Default",
        notes: "Standard inherited Andhra Pradesh default terms."
      }
    },
    commercialOverrides: {},
    invitationStatus: "Not Invited",
    portalAccessStatus: "Disabled",
    portalUsers: [],
    activeContractsCount: 0,
    createdAt: "2026-10-20",
    updatedAt: "2026-10-20"
  },
  {
    id: "part-dist-d",
    name: "Distributor D Ortho Care",
    code: "DIST-KA-01",
    typeId: "ct-distributor",
    typeName: "Authorized Distributor",
    status: "Active",
    lifecycleStatus: "Active",
    classification: {
      partnerType: "Distributor",
      performanceTierId: "tier-gold",
      performanceTierName: "Gold Premier Partner",
      distributionLevelId: "dl-tier1",
      distributionLevelName: "Tier 1 — Wholesale Aggregator / Mother Depot Stockist",
      effectiveDate: "2026-03-01",
      approvalStatus: "Approved",
      reason: "Major orthopedic surgical implants partner for Greater Bengaluru metro",
      history: []
    },
    channelAssignments: [
      {
        id: "pca-d1",
        partnerId: "part-dist-d",
        partnerName: "Distributor D Ortho Care",
        partnerCode: "DIST-KA-01",
        salesChannelId: "ct-distributor",
        salesChannelName: "Authorized Distributor",
        salesChannelCode: "DIST",
        territoryScope: ["terr-karnataka"],
        effectiveFrom: "2026-03-01",
        status: "Active",
        commercialTermStatus: "Deviated — Approved",
        commercialOverride: {
          overrideDiscountPercent: 13.5,
          channelDefaultDiscount: 12.0,
          requestedDiscount: 13.5,
          overrideCreditPeriodDays: 45,
          overrideCreditLimit: 4000000,
          overrideSecurityDeposit: 1500000,
          requestReason: "Bengaluru corporate trauma hospitals volume contract",
          requestedBy: "S. Swaminathan",
          requestedAt: "2026-03-01 10:00",
          approvedBy: "Commercial Director",
          approvedAt: "2026-03-02 11:30",
          approvalHistory: [
            {
              id: "cah-d1",
              timestamp: "2026-03-02 11:30",
              action: "Approved",
              actor: "Commercial Director",
              oldDiscountPercent: 12.0,
              newDiscountPercent: 13.5,
              comments: "Approved under South Zone Metro Key Accounts policy."
            }
          ]
        },
        notes: "Authorized distributor channel contract"
      }
    ],
    gstin: "29AABCS8891J1Z6",
    gstinStatus: "Verified on GST Portal",
    pan: "AABCS8891J",
    drugLicenseNo: "KA-BLR-20B-77210 / 21B-77211",
    drugLicenseExpiry: "2029-01-31",
    mdrLicenseNo: "MDR-29-KA-2024-00812",
    authorizedContactPerson: "C. Ramesh",
    contactDesignation: "Managing Director",
    officialEmail: "c.ramesh@distributord-ortho.in",
    mobilePhone: "+91 98450 77112",
    warehouseAddress: "Sy No. 34, Peenya Industrial Area 2nd Stage, Bangalore 560058",
    kycStatus: "Verified",
    kycDocuments: [
      { id: "doc-d1", title: "GSTIN Certificate", type: "GSTIN Certificate", fileName: "GSTIN_29AABCS8891J.pdf", uploadDate: "2026-03-01", verificationStatus: "Verified", fileSize: "1.0 MB" },
      { id: "doc-d2", title: "Drug License 20B/21B", type: "Drug License Form 20B/21B", fileName: "DL_KA_BLR_77210.pdf", uploadDate: "2026-03-01", verificationStatus: "Verified", fileSize: "2.0 MB" }
    ],
    creditLimit: 4000000,
    creditDays: "45 days (Tier Default)",
    gracePeriodDays: 7,
    outstandingAmount: 2200000,
    overdueAmount: 0,
    openOrdersAmount: 450000,
    creditHold: false,
    securityDepositHeld: 1500000,
    depositInstrument: "Bank Guarantee (Canara Bank)",
    depositExpiry: "2028-05-31",
    assignedTerritoryIds: ["terr-karnataka"],
    assignedChannelIds: ["ct-distributor"],
    assignedRouteId: "path-02",
    tierPriceLevel: "PTD (Tier 1)",
    
    // Multiple warehouses in same territory (validating business rule!)
    distributionAssignments: [
      {
        id: "asgn-d1",
        partnerId: "part-dist-d",
        territoryId: "terr-karnataka",
        territoryName: "Karnataka State",
        branchId: "br-blr-03",
        branchName: "South Zone Regional — Bengaluru Branch",
        warehouseId: "wh-peen-04",
        warehouseName: "Peenya Industrial Depot — South Mother Warehouse",
        assignmentType: "Primary Invoicing & Dispatch",
        isPrimary: true,
        effectiveFrom: "2026-03-01",
        status: "Active",
        notes: "Primary bulk pallet supply center"
      },
      {
        id: "asgn-d2",
        partnerId: "part-dist-d",
        territoryId: "terr-karnataka",
        territoryName: "Karnataka State",
        branchId: "br-blr-03",
        branchName: "South Zone Regional — Bengaluru Branch",
        warehouseId: "wh-bomm-05",
        warehouseName: "Bommasandra Medical Device & Surgical Depot",
        assignmentType: "Emergency Hospital Supply",
        isPrimary: false,
        effectiveFrom: "2026-03-01",
        status: "Active",
        notes: "Emergency 2-hour trauma delivery cache for Electronic City corridor"
      }
    ],

    // CRITICAL BUSINESS LOGIC: Karnataka default 4% + Distributor D override 7% = 7% effective
    territoryCommercials: {
      "terr-karnataka": {
        territoryId: "terr-karnataka",
        territoryName: "Karnataka State",
        inheritedDefaultDiscount: 4.0,
        partnerOverrideDiscount: 7.0,
        effectiveDiscount: 7.0,
        overrideOrigin: "Partner Override",
        notes: "High-volume orthopedic hospital key accounts incentive override."
      }
    },
    commercialOverrides: {
      "terr-karnataka": {
        id: "ovr-d1",
        partnerId: "part-dist-d",
        territoryId: "terr-karnataka",
        territoryName: "Karnataka State",
        overrideDiscountPercent: 7.0,
        overrideCreditPeriodDays: null,
        overrideCreditLimit: null,
        overrideSecurityDeposit: null,
        effectiveFrom: "2026-03-01",
        overrideReason: "Institutional volume commitment contract",
        updatedBy: "Commercial Director",
        history: []
      }
    },
    invitationStatus: "Accepted",
    invitationSentDate: "2026-03-10 11:00",
    invitationAcceptedDate: "2026-03-12 15:30",
    invitedEmail: "c.ramesh@distributord-ortho.in",
    portalAccessStatus: "Active",
    lastActiveDate: "Yesterday, 04:20 PM",
    portalUsers: [
      { id: "usr-d1", name: "C. Ramesh", email: "c.ramesh@distributord-ortho.in", role: "Distributor Administrator", status: "Active", lastLogin: "Yesterday, 04:20 PM" }
    ],
    activeContractsCount: 1,
    createdAt: "2026-03-01",
    updatedAt: "2026-10-18"
  },
  {
    id: "part-sterling",
    name: "Sterling Healthcare Distributors",
    code: "DIST-MUM-01",
    typeId: "ct-distributor",
    typeName: "Authorized Distributor",
    status: "Active",
    lifecycleStatus: "Active",
    classification: {
      partnerType: "Distributor",
      performanceTierId: "tier-plat",
      performanceTierName: "Platinum Strategic Partner",
      distributionLevelId: "dl-tier1",
      distributionLevelName: "Tier 1 — Wholesale Aggregator / Mother Depot Stockist",
      effectiveDate: "2025-12-10",
      approvalStatus: "Approved",
      reason: "Western Zone premier multi-territory distributor and mother logistics hub",
      history: []
    },
    channelAssignments: [
      {
        id: "pca-s1",
        partnerId: "part-sterling",
        partnerName: "Sterling Healthcare Distributors",
        partnerCode: "DIST-MUM-01",
        salesChannelId: "ct-distributor",
        salesChannelName: "Authorized Distributor",
        salesChannelCode: "DIST",
        territoryScope: ["terr-west", "terr-karnataka"],
        effectiveFrom: "2025-12-10",
        status: "Active",
        commercialTermStatus: "Deviated — Approved",
        commercialOverride: {
          overrideDiscountPercent: 14.0,
          channelDefaultDiscount: 12.0,
          requestedDiscount: 14.0,
          overrideCreditPeriodDays: 45,
          overrideCreditLimit: 4500000,
          overrideSecurityDeposit: 1500000,
          requestReason: "Western metro multi-territory volume commitment",
          requestedBy: "Vikram Mehta",
          requestedAt: "2025-12-10 10:00",
          approvedBy: "VP Commercial",
          approvedAt: "2025-12-11 15:00",
          approvalHistory: [
            {
              id: "cah-s1",
              timestamp: "2025-12-11 15:00",
              action: "Approved",
              actor: "VP Commercial",
              oldDiscountPercent: 12.0,
              newDiscountPercent: 14.0,
              comments: "Approved under Western Region Hub Policy."
            }
          ]
        },
        notes: "Primary cross-dock channel supply agreement"
      },
      {
        id: "pca-s2",
        partnerId: "part-sterling",
        partnerName: "Sterling Healthcare Distributors",
        partnerCode: "DIST-MUM-01",
        salesChannelId: "ct-b2b-portal",
        salesChannelName: "B2B Principal Ordering Portal",
        salesChannelCode: "B2B-PORTAL",
        territoryScope: ["terr-west"],
        effectiveFrom: "2026-01-01",
        status: "Active",
        commercialTermStatus: "Standard",
        commercialOverride: {
          channelDefaultDiscount: 10.0,
          requestReason: "Standard self-service ordering terms",
          approvalHistory: []
        },
        notes: "Digital self-service wholesale portal access"
      }
    ],
    gstin: "27AABCS9912E1Z4",
    gstinStatus: "Verified on GST Portal",
    pan: "AABCS9912E",
    drugLicenseNo: "MH-MZ2-20B-184920 / 21B-184921",
    drugLicenseExpiry: "2028-12-31",
    mdrLicenseNo: "MD-42-MH-2023-00918",
    authorizedContactPerson: "Mahesh Chawla",
    contactDesignation: "Managing Director",
    officialEmail: "orders@sterlinghealthcare.in",
    mobilePhone: "+91 98201 44521",
    warehouseAddress: "Unit 14, Commercial Park, Andheri East, Mumbai 400069",
    kycStatus: "Verified",
    kycDocuments: [
      { id: "doc-s1", title: "GSTIN Identification", type: "GSTIN Certificate", fileName: "GSTIN_27AABCS9912E.pdf", uploadDate: "2025-12-10", verificationStatus: "Verified", fileSize: "1.4 MB" },
      { id: "doc-s2", title: "PAN Card", type: "PAN Card", fileName: "PAN_AABCS9912E.pdf", uploadDate: "2025-12-10", verificationStatus: "Verified", fileSize: "580 KB" },
      { id: "doc-s3", title: "Drug License MH 20B/21B", type: "Drug License Form 20B/21B", fileName: "DL_MH_MZ2_184920.pdf", uploadDate: "2025-12-11", verificationStatus: "Verified", fileSize: "2.3 MB" },
      { id: "doc-s4", title: "Bank Guarantee Collateral", type: "Bank Guarantee / Collateral Lien", fileName: "BG_HDFC_15LAKH.pdf", uploadDate: "2026-01-05", verificationStatus: "Verified", fileSize: "3.1 MB" }
    ],
    creditLimit: 4500000,
    creditDays: "45 days (Tier Default)",
    gracePeriodDays: 7,
    outstandingAmount: 4120000,
    overdueAmount: 850000,
    openOrdersAmount: 620000,
    creditHold: true,
    securityDepositHeld: 1500000,
    depositInstrument: "Bank Guarantee (HDFC Bank)",
    depositExpiry: "2027-03-31",
    // MULTI-TERRITORY DEMONSTRATION: West Zone AND Karnataka
    assignedTerritoryIds: ["terr-west", "terr-karnataka"],
    assignedChannelIds: ["ct-distributor"],
    assignedRouteId: "path-02",
    tierPriceLevel: "PTD (Tier 1)",
    
    // Multi-territory supply assignments (validating business rule!)
    distributionAssignments: [
      {
        id: "asgn-s1",
        partnerId: "part-sterling",
        territoryId: "terr-west",
        territoryName: "West Zone (Maharashtra & Goa)",
        branchId: "br-mum-01",
        branchName: "West Zone HQ — Mumbai Central Branch",
        warehouseId: "wh-bhiw-01",
        warehouseName: "Bhiwandi Central Mother Warehouse & Distribution Hub",
        assignmentType: "Primary Invoicing & Dispatch",
        isPrimary: true,
        effectiveFrom: "2025-12-10",
        status: "Active",
        notes: "Primary cross-dock for MMR hospital supply"
      },
      {
        id: "asgn-s2",
        partnerId: "part-sterling",
        territoryId: "terr-west",
        territoryName: "West Zone (Maharashtra & Goa)",
        branchId: "br-mum-01",
        branchName: "West Zone HQ — Mumbai Central Branch",
        warehouseId: "wh-andh-02",
        warehouseName: "Andheri Cold Storage & Air Freight Depot",
        assignmentType: "Emergency Hospital Supply",
        isPrimary: false,
        effectiveFrom: "2026-01-15",
        status: "Active",
        notes: "Emergency air-shipment cold chain vault"
      },
      {
        id: "asgn-s3",
        partnerId: "part-sterling",
        territoryId: "terr-karnataka",
        territoryName: "Karnataka State",
        branchId: "br-blr-03",
        branchName: "South Zone Regional — Bengaluru Branch",
        warehouseId: "wh-peen-04",
        warehouseName: "Peenya Industrial Depot — South Mother Warehouse",
        assignmentType: "Primary Invoicing & Dispatch",
        isPrimary: true,
        effectiveFrom: "2026-02-01",
        status: "Active",
        notes: "Dedicated interstate depot for Sterling Karnataka division"
      }
    ],

    // Different commercial terms in each territory!
    territoryCommercials: {
      "terr-west": {
        territoryId: "terr-west",
        territoryName: "West Zone (Maharashtra & Goa)",
        inheritedDefaultDiscount: 5.5,
        partnerOverrideDiscount: 7.0, // Overridden in West Zone
        effectiveDiscount: 7.0,
        overrideOrigin: "Partner Override",
        notes: "Western metro volume commitment contract."
      },
      "terr-karnataka": {
        territoryId: "terr-karnataka",
        territoryName: "Karnataka State",
        inheritedDefaultDiscount: 4.0,
        partnerOverrideDiscount: null, // Inherits default in Karnataka
        effectiveDiscount: 4.0,
        overrideOrigin: "Territory Default",
        notes: "Inherits standard Karnataka default terms."
      }
    },
    commercialOverrides: {
      "terr-west": {
        id: "ovr-s1",
        partnerId: "part-sterling",
        territoryId: "terr-west",
        territoryName: "West Zone (Maharashtra & Goa)",
        overrideDiscountPercent: 7.0,
        overrideCreditPeriodDays: null,
        overrideCreditLimit: 4500000,
        overrideSecurityDeposit: null,
        effectiveFrom: "2025-12-10",
        overrideReason: "Metro flagship distributor terms",
        updatedBy: "VP Commercial",
        history: []
      }
    },
    invitationStatus: "Accepted",
    invitationSentDate: "2026-01-10 10:00",
    invitationAcceptedDate: "2026-01-11 14:00",
    invitedEmail: "orders@sterlinghealthcare.in",
    portalAccessStatus: "Active",
    lastActiveDate: "Today, 11:20 AM",
    portalUsers: [
      { id: "usr-s1", name: "Mahesh Chawla", email: "m.chawla@sterlinghealthcare.in", role: "Distributor Administrator", status: "Active", lastLogin: "Today, 11:20 AM" },
      { id: "usr-s2", name: "Pooja Deshmukh", email: "dispatch@sterlinghealthcare.in", role: "Operations / GRN Receiver", status: "Active", lastLogin: "Yesterday, 03:40 PM" }
    ],
    activeContractsCount: 2,
    createdAt: "2025-12-10",
    updatedAt: "2026-10-29"
  },
  {
    id: "part-apex-draft",
    name: "Apex Surgico Enterprises",
    code: "DIST-AP-02",
    typeId: "ct-distributor",
    typeName: "Authorized Distributor",
    status: "Inactive",
    lifecycleStatus: "Draft",
    classification: {
      partnerType: "Distributor",
      performanceTierId: "tier-bronze",
      performanceTierName: "Bronze Onboarding Partner",
      distributionLevelId: "dl-tier3",
      distributionLevelName: "Tier 3 — Area Retail Stockist / Surgical Dealer",
      effectiveDate: "2026-10-28",
      approvalStatus: "Draft",
      reason: "Initial onboarding application under KYC review",
      history: []
    },
    channelAssignments: [
      {
        id: "pca-apex-1",
        partnerId: "part-apex-draft",
        partnerName: "Apex Surgico Enterprises",
        partnerCode: "DIST-AP-02",
        salesChannelId: "ct-sub-distributor",
        salesChannelName: "Sub-Distributor / Regional Dealer",
        salesChannelCode: "SUB-DIST",
        territoryScope: ["terr-andhra"],
        effectiveFrom: "2026-10-28",
        status: "Inactive",
        commercialTermStatus: "Standard",
        commercialOverride: {
          channelDefaultDiscount: 8.0,
          requestReason: "Standard probationary terms",
          approvalHistory: []
        },
        notes: "Trial dealer channel terms pending KYC completion"
      }
    ],
    gstin: "37AABCU1190N1Z1",
    gstinStatus: "Pending Verification",
    pan: "AABCU1190N",
    drugLicenseNo: "AP-GUN-20B-99812",
    drugLicenseExpiry: "2027-04-30",
    mdrLicenseNo: "Under Application",
    authorizedContactPerson: "N. Prasad",
    contactDesignation: "Partner",
    officialEmail: "info@apexsurgico-ap.com",
    mobilePhone: "+91 98481 99001",
    warehouseAddress: "Station Road, Guntur 522001",
    kycStatus: "Draft", // Draft KYC!
    kycDocuments: [],
    creditLimit: 1500000,
    creditDays: "30 days",
    gracePeriodDays: 7,
    outstandingAmount: 0,
    overdueAmount: 0,
    openOrdersAmount: 0,
    creditHold: false,
    securityDepositHeld: 500000,
    depositInstrument: "Unsecured (Director Indemnity)",
    depositExpiry: "--",
    assignedTerritoryIds: ["terr-andhra"],
    assignedChannelIds: ["ct-distributor"],
    assignedRouteId: "path-02",
    tierPriceLevel: "PTD (Tier 1)",
    distributionAssignments: [],
    territoryCommercials: {
      "terr-andhra": {
        territoryId: "terr-andhra",
        territoryName: "Andhra Pradesh State",
        inheritedDefaultDiscount: 6.0,
        partnerOverrideDiscount: null,
        effectiveDiscount: 6.0,
        overrideOrigin: "Territory Default"
      }
    },
    commercialOverrides: {},
    invitationStatus: "Not Invited",
    portalAccessStatus: "Disabled",
    portalUsers: [],
    activeContractsCount: 0,
    createdAt: "2026-10-28",
    updatedAt: "2026-10-28"
  }
];
