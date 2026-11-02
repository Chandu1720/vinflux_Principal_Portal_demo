# VinFlux Principal Portal — Backend API Specification & Contract

This document outlines the required RESTful API endpoints, request payloads, response schemas, and validation business rules for the VinFlux Principal Portal.

---

## 1. Branch Master API

### 1.1 List Branches
- **Endpoint**: `GET /api/v1/branches`
- **Query Parameters**:
  - `search?: string` (matches Name, Code, City, Manager)
  - `state?: string`
  - `status?: 'Active' | 'Inactive'`
  - `page?: number` (default: 1)
  - `limit?: number` (default: 20)
- **Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "br-mum-01",
      "name": "West Zone HQ — Mumbai Central Branch",
      "code": "BR-MUM-01",
      "address": "Unit 401-404, Solitaire Corporate Park, Chakala",
      "state": "Maharashtra",
      "city": "Mumbai",
      "pinCode": "400093",
      "manager": "Vikramaditya Kulkarni",
      "contactNumber": "+91 22 6128 4400",
      "email": "mumbai.branch@bioradmedisys.com",
      "status": "Active",
      "activeWarehousesCount": 2,
      "createdAt": "2025-01-15T09:00:00Z",
      "updatedAt": "2026-02-10T14:30:00Z"
    }
  ],
  "meta": { "total": 6, "page": 1, "limit": 20 }
}
```

### 1.2 Create Branch
- **Endpoint**: `POST /api/v1/branches`
- **Payload**:
```json
{
  "name": "East Zone Hub — Kolkata Branch",
  "code": "BR-KOL-06",
  "address": "Sector V, Salt Lake City",
  "state": "West Bengal",
  "city": "Kolkata",
  "pinCode": "700091",
  "manager": "Anirban Mukherjee",
  "contactNumber": "+91 33 2357 1100",
  "email": "kolkata.hub@bioradmedisys.com",
  "status": "Active"
}
```
- **Validation Rules**:
  - `code` must be unique across all branches (case-insensitive).
  - `name`, `code`, `state`, `city`, `pinCode` are required.

### 1.3 Update Branch & Status
- **Endpoint**: `PUT /api/v1/branches/:id`
- **Endpoint**: `PATCH /api/v1/branches/:id/status` (Payload: `{ "status": "Inactive" }`)
- **Business Rule**: Setting a branch to `Inactive` does NOT delete existing warehouses or partner distribution assignments, but prevents selecting this branch for new warehouses or new supply assignments.

---

## 2. Warehouse Master API

### 2.1 List Warehouses
- **Endpoint**: `GET /api/v1/warehouses`
- **Query Parameters**:
  - `branchId?: string`
  - `state?: string`
  - `status?: 'Active' | 'Inactive'`
  - `search?: string`
- **Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "wh-bhiw-01",
      "name": "Bhiwandi Central Mother Warehouse & Distribution Hub",
      "code": "WH-BHIW-01",
      "branchId": "br-mum-01",
      "branchName": "West Zone HQ — Mumbai Central Branch",
      "address": "Warehouse Block D, Renaissance Industrial Smart City, Vashere",
      "state": "Maharashtra",
      "city": "Bhiwandi / Thane",
      "pinCode": "421302",
      "manager": "Gajanan Patil",
      "contactNumber": "+91 98230 44910",
      "email": "wh.bhiwandi@bioradmedisys.com",
      "status": "Active",
      "storageCapacity": "45,000 sq ft · Class 100K Clean Logistics",
      "temperatureControlled": true,
      "createdAt": "2025-01-20T10:00:00Z",
      "updatedAt": "2026-02-12T16:00:00Z"
    }
  ]
}
```

### 2.2 Create Warehouse
- **Endpoint**: `POST /api/v1/warehouses`
- **Validation Rules**:
  - `branchId` must correspond to an **Active** branch.
  - `code` must be unique across all warehouses.

---

## 3. Partner Distribution & Supply Assignments API

### 3.1 Get Partner Supply Assignments
- **Endpoint**: `GET /api/v1/partners/:partnerId/distribution-assignments`
- **Response**: `200 OK`
```json
{
  "partnerId": "part-dist-d",
  "assignments": [
    {
      "id": "asgn-d1",
      "territoryId": "terr-karnataka",
      "territoryName": "Karnataka State",
      "branchId": "br-blr-03",
      "branchName": "South Zone Regional — Bengaluru Branch",
      "warehouseId": "wh-peen-04",
      "warehouseName": "Peenya Industrial Depot — South Mother Warehouse",
      "assignmentType": "Primary Invoicing & Dispatch",
      "isPrimary": true,
      "effectiveFrom": "2026-03-01",
      "status": "Active"
    },
    {
      "id": "asgn-d2",
      "territoryId": "terr-karnataka",
      "territoryName": "Karnataka State",
      "branchId": "br-blr-03",
      "branchName": "South Zone Regional — Bengaluru Branch",
      "warehouseId": "wh-bomm-05",
      "warehouseName": "Bommasandra Medical Device & Surgical Depot",
      "assignmentType": "Emergency Hospital Supply",
      "isPrimary": false,
      "effectiveFrom": "2026-03-01",
      "status": "Active"
    }
  ]
}
```

### 3.2 Add Supply Assignment
- **Endpoint**: `POST /api/v1/partners/:partnerId/distribution-assignments`
- **Payload**:
```json
{
  "territoryId": "terr-karnataka",
  "branchId": "br-blr-03",
  "warehouseId": "wh-peen-04",
  "assignmentType": "Primary Invoicing & Dispatch",
  "isPrimary": true,
  "effectiveFrom": "2026-03-01"
}
```
- **Validation Rules**:
  - `branchId` and `warehouseId` must both be in `Active` status.
  - `warehouseId` must belong to `branchId`.
  - If `isPrimary: true`, other assignments for the same territory are automatically set to `isPrimary: false`.

---

## 4. Commercial Terms Master & Partner Overrides API

### 4.1 Get Territory Default Terms (Master)
- **Endpoint**: `GET /api/v1/gtm/territories/:territoryId/commercial-terms`
- **Response**: `200 OK`
```json
{
  "territoryId": "terr-telangana",
  "territoryName": "Telangana State",
  "defaultDiscountPercent": 5.0,
  "creditLimit": 3500000,
  "creditPeriodDays": 45,
  "minimumSecurityDeposit": 1000000,
  "version": "v1.2",
  "status": "Active"
}
```

### 4.2 Save Partner-Specific Commercial Overrides
- **Endpoint**: `PUT /api/v1/partners/:partnerId/territories/:territoryId/commercial-overrides`
- **Payload**:
```json
{
  "overrideDiscountPercent": 8.0,
  "overrideCreditLimit": null,
  "overrideCreditPeriodDays": null,
  "overrideSecurityDeposit": null,
  "overrideReason": "Strategic metro hospitals key account pricing tier agreement"
}
```
- **Business Rule**:
  - `null` fields inherit Master Defaults.
  - Explicit overrides are stored in `PartnerCommercialOverride`.
  - When Master Default changes in GTM, explicit partner overrides are NEVER overwritten.

---

## 5. Distribution Portal Invitation API

### 5.1 Send Invitation
- **Endpoint**: `POST /api/v1/partners/:partnerId/portal/invite`
- **Response**: `200 OK`
```json
{
  "invitationId": "inv-2026-9812",
  "partnerId": "part-dist-a",
  "email": "orders@distributora-health.com",
  "status": "Invite Sent",
  "sentDate": "2026-10-30T16:30:00Z",
  "expiryDate": "2026-11-29T23:59:59Z"
}
```
- **Validation Rule**:
  - Cannot invite if Partner `kycStatus` is `Draft` or `Rejected`.
  - Creating a partner NEVER automatically grants portal access.
  - `portalAccessStatus` remains `Disabled` until partner accepts.


---

## 6. Territory Hierarchy & Geographic Coverage API

### 6.1 List Territories with Hierarchy & Overlap Stats
- **Endpoint**: `GET /api/v1/gtm/territories`
- **Query Parameters**:
  - `zone?: string` ('South Zone' | 'West Zone' | 'North Zone' | 'East Zone' | 'Central Zone')
  - `status?: 'Active' | 'Inactive'`
  - `search?: string`
- **Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "terr-ka-01",
      "code": "TERR-KA-01",
      "name": "Karnataka — Bangalore Urban & Semi-Urban",
      "zone": "South Zone",
      "country": "India",
      "type": "Primary State Territory",
      "status": "Active",
      "parentTerritoryId": null,
      "geographicCoverage": [
        {
          "id": "geo-ka-1",
          "state": "Karnataka",
          "district": "Bangalore Urban",
          "city": "Bengaluru",
          "localities": ["Koramangala", "Indiranagar", "Whitefield", "Jayanagar", "Electronic City", "Peenya"],
          "pinCodes": ["560001", "560034", "560038", "560066", "560041", "560058"]
        }
      ],
      "metrics": {
        "activePartnersCount": 14,
        "assignedWarehousesCount": 2,
        "salesChannelsCount": 3,
        "activeRoutesCount": 4
      },
      "createdAt": "2025-01-10T08:00:00Z",
      "updatedAt": "2026-03-01T11:20:00Z"
    }
  ],
  "meta": { "total": 12, "activeCount": 11 }
}
```

### 6.2 Check PIN Overlap Advisory
- **Endpoint**: `POST /api/v1/gtm/territories/check-pin-overlap`
- **Payload**:
```json
{
  "territoryId": "terr-ka-02",
  "pinCodes": ["560001", "560034", "570001"]
}
```
- **Response**: `200 OK`
```json
{
  "hasOverlap": true,
  "overlappingPins": [
    {
      "pinCode": "560001",
      "conflicts": [
        { "territoryId": "terr-ka-01", "territoryName": "Karnataka — Bangalore Urban & Semi-Urban", "zone": "South Zone" }
      ]
    }
  ],
  "advisoryMessage": "Advisory Notice: 1 PIN code overlaps with an existing active territory. Overlapping territory assignments are permitted under non-exclusive institutional distribution policies."
}
```

---

## 7. Partner Performance Tier & Distribution Level Governance API

### 7.1 List Performance Tiers
- **Endpoint**: `GET /api/v1/gtm/partner-tiers`
- **Response**: `200 OK`
```json
[
  {
    "id": "tier-plat",
    "tierName": "Platinum",
    "tierCode": "PLAT",
    "rank": 1,
    "annualTurnoverMin": 50000000,
    "rebatePercent": 3.5,
    "paymentTermsDays": 60,
    "dedicatedKam": true,
    "quarterlyIncentive": true,
    "priorityDispatch": true,
    "color": "#6366F1",
    "status": "Active"
  }
]
```

### 7.2 List Distribution Levels
- **Endpoint**: `GET /api/v1/gtm/distribution-levels`
- **Response**: `200 OK`
```json
[
  {
    "id": "dl-1",
    "levelCode": "DL-1",
    "levelName": "Tier 1 — Aggregator / Super Stockist",
    "description": "Receives direct bulk dispatches from Principal C&F/Mother Warehouse. Feeds regional secondary partners.",
    "allowedPartnerTypes": ["Super Stockist", "C&F Agent"],
    "maxHierarchyDepth": 1,
    "status": "Active"
  }
]
```

### 7.3 Approve Partner Tier Upgrade
- **Endpoint**: `POST /api/v1/partners/:partnerId/upgrade-tier`
- **Payload**:
```json
{
  "targetTier": "Platinum",
  "approvedBy": "Commercial Governance Board",
  "reason": "Exceeded FY26 Q3 revenue threshold by 142% with 99.4% on-time settlement",
  "effectiveFrom": "2026-04-01"
}
```
- **Business Rule**:
  - Automatically updates `partner.classification.performanceTier`.
  - Appends an audit entry into `partner.classification.history`.
  - Recalculates partner tier analytics and GTM KPI counts.

---

## 8. Multi-Channel Partner Assignment API

### 8.1 List Channel Assignments for a Partner
- **Endpoint**: `GET /api/v1/partners/:partnerId/channel-assignments`
- **Response**: `200 OK`
```json
[
  {
    "id": "pca-a1",
    "partnerId": "part-dist-a",
    "partnerName": "MedTech Solutions India Pvt Ltd",
    "channelId": "chan-auth-dist",
    "channelName": "Authorized Distributor Network",
    "roleInChannel": "Primary Hospital Distributor",
    "isExclusive": false,
    "commercialTermsStatus": "Standard",
    "customMarginPercent": null,
    "customPaymentTermsDays": null,
    "status": "Active",
    "effectiveFrom": "2025-06-01"
  },
  {
    "id": "pca-a2",
    "partnerId": "part-dist-a",
    "partnerName": "MedTech Solutions India Pvt Ltd",
    "channelId": "chan-inst",
    "channelName": "Institutional Tender Sales",
    "roleInChannel": "Rate Contract Consignee",
    "isExclusive": false,
    "commercialTermsStatus": "Deviated",
    "customMarginPercent": 8.0,
    "customPaymentTermsDays": 60,
    "deviationJustification": "Annual tender SLA with ESIC & Defence Hospitals requiring extended credit cycle",
    "approvedBy": "National Sales Director",
    "approvalDate": "2025-07-15",
    "status": "Active",
    "effectiveFrom": "2025-07-15"
  }
]
```

### 8.2 Assign Partner to Channel with Optional Deviation Request
- **Endpoint**: `POST /api/v1/partners/:partnerId/channel-assignments`
- **Payload**:
```json
{
  "channelId": "chan-direct-corp",
  "roleInChannel": "Corporate Hospital Specialist",
  "isExclusive": false,
  "requestDeviation": true,
  "customMarginPercent": 7.5,
  "customPaymentTermsDays": 60,
  "deviationJustification": "Apollo & Fortis pan-India corporate consortium alignment"
}
```
- **Business Rule**:
  - If `requestDeviation: true`, the assignment is initially created with `commercialTermsStatus: 'Pending Approval'`.
  - An entry is automatically added to the Commercial Deviation Approvals Queue.
  - Until approved, default channel commercial terms remain in effect or dispatches are held according to policy.

---

## 9. Commercial Terms & Deviation Approval Workflow API

### 9.1 List Pending Commercial Approvals
- **Endpoint**: `GET /api/v1/commercial/pending-approvals`
- **Response**: `200 OK`
```json
[
  {
    "id": "appr-1",
    "partnerId": "part-dist-c",
    "partnerName": "Apex Healthcare Logistics",
    "partnerCode": "PAR-APEX-03",
    "channelId": "chan-sub-dist",
    "channelName": "Sub-Stockist & Retail Network",
    "assignmentId": "pca-c1",
    "requestedMarginPercent": 14.5,
    "standardMarginPercent": 10.0,
    "marginDelta": 4.5,
    "requestedCreditDays": 60,
    "standardCreditDays": 30,
    "justification": "Rural deep-hinterland coverage across 14 Tier-3 districts requiring extended transit & credit buffer",
    "requestedBy": "Area Sales Manager — AP & Telangana",
    "requestedAt": "2026-03-01T09:15:00Z",
    "status": "Pending"
  }
]
```

### 9.2 Approve Commercial Deviation
- **Endpoint**: `POST /api/v1/commercial/approvals/:id/approve`
- **Payload**:
```json
{
  "approvedMarginPercent": 13.5,
  "approvedCreditDays": 45,
  "approvalNotes": "Approved with margin compromise at 13.5% (standard 10%) and 45 days credit against post-dated collateral",
  "approvedBy": "Chief Commercial Officer"
}
```
- **Business Rule**:
  - Updates partner's `commercialTermsStatus` from `Pending Approval` to `Deviated`.
  - Overwrites the assignment's custom margin and credit terms with the approved values.
  - Appends to the permanent `CommercialApprovalHistoryEntry` audit trail.

### 9.3 Reject Commercial Deviation
- **Endpoint**: `POST /api/v1/commercial/approvals/:id/reject`
- **Payload**:
```json
{
  "rejectionReason": "Requested 14.5% margin exceeds regional profitability threshold without collateralized bank guarantee",
  "rejectedBy": "Chief Financial Officer"
}
```
- **Business Rule**:
  - Reverts assignment to `commercialTermsStatus: 'Standard'`.
  - Resets `customMarginPercent` and `customPaymentTermsDays` to null (falls back to channel defaults).

---

## 10. Visual Sales Route Builder API

### 10.1 List Configured Sales Routes
- **Endpoint**: `GET /api/v1/gtm/sales-routes`
- **Response**: `200 OK`
```json
[
  {
    "id": "route-std-dist",
    "name": "Standard Institutional & Hospital Distribution Route",
    "code": "RTE-STD-01",
    "channelId": "chan-auth-dist",
    "channelName": "Authorized Distributor Network",
    "type": "Multi-tier Managed Distribution",
    "status": "Active",
    "nodes": [
      { "id": "n1", "step": 1, "type": "Principal", "title": "Principal HQ / Mother Plant", "badge": "Source" },
      { "id": "n2", "step": 2, "type": "C&F Agent", "title": "Consignment & Forwarding Depot", "badge": "Tier 1 Buffer" },
      { "id": "n3", "step": 3, "type": "Distributor", "title": "Authorized Metro Hospital Distributor", "badge": "Primary Consignee" },
      { "id": "n4", "step": 4, "type": "Hospital", "title": "Apex Tertiary Care Hospital", "badge": "End Destination" }
    ],
    "operationalRules": {
      "invoicingEntity": "Principal invoices C&F, C&F dispatches to Distributor, Distributor invoices Hospital",
      "paymentTerms": "60 Days rolling bank-backed credit line",
      "custodyModel": "Consignment physical custody with Principal title retention until distributor dispatch",
      "nppaCeilingCompliance": "Pre-validated automated margin checks against DPCO / NPPA drug & device guidelines"
    },
    "associatedPartnersCount": 18
  }
]
```

### 10.2 Create / Update Sales Route
- **Endpoint**: `POST /api/v1/gtm/sales-routes`
- **Payload**:
```json
{
  "name": "Direct Government Tender Supply Model",
  "code": "RTE-GOV-02",
  "channelId": "chan-inst",
  "type": "Direct Tender Consignment",
  "status": "Active",
  "nodes": [
    { "id": "n1", "step": 1, "type": "Principal", "title": "Principal Manufacturing Plant", "badge": "Source" },
    { "id": "n2", "step": 2, "type": "Tender Partner", "title": "Authorized Institutional Consignee", "badge": "Tender Agent" },
    { "id": "n3", "step": 3, "type": "Government Entity", "title": "State Medical Supplies Corporation Depot", "badge": "End Client" }
  ],
  "operationalRules": {
    "invoicingEntity": "Principal directly to State Corporation with Agent commission",
    "paymentTerms": "90 Days against Treasury Proof of Delivery",
    "custodyModel": "Direct factory sealed dispatch to government nodal depot",
    "nppaCeilingCompliance": "Institutional non-commercial capped schedule pricing"
  }
}
```
