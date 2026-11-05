# VinFlux Go-to-Market (GTM V2)

The single Go-to-Market and partner module, mounted at `/gtm-v2/*`. The old GTM Configuration (`/gtm`) and Partner Management (`/partners`) screens were removed in Nov 2026; both URLs now redirect here. Their files are left as one-line stubs marked "Safe to delete" (see *Removed legacy files* below).

## Run

```bash
npm install
npm run dev          # http://localhost:5173/gtm-v2/dashboard
npm run build        # tsc -b && vite build
npm run preview
```

Open it from the main VinFlux sidebar: **Go-to-market → GTM Dashboard & Setup** or **Partners**.
Use the reset icon in the GTM V2 top bar to restore the demo data.

## Routes

| Route | Module |
|---|---|
| `/gtm-v2/dashboard` | GTM Dashboard |
| `/gtm-v2/territories` | Territory Management (dynamic hierarchy) |
| `/gtm-v2/zones` | Zone Management |
| `/gtm-v2/sales-channels` | Sales Channel Configuration |
| `/gtm-v2/sales-flow-topology`, `/new`, `/:flowId` | Sales Flow Topology list + visual builder |
| `/gtm-v2/partners`, `/partners/onboard`, `/partners/onboard/:id` | Partner register + 7-step onboarding |
| `/gtm-v2/partner-network` | Partner Network graph |
| `/gtm-v2/hospital-coverage` | Hospital Coverage (who serves each hospital, per portfolio) |
| `/gtm-v2/commercial-terms` | Commercial Terms (inheritance & overrides) |
| `/gtm-v2/approvals` | Approvals |
| `/gtm-v2/reports` | GTM Reports (CSV / Excel / Print) |
| `/gtm-v2/configuration` | Configuration |

## Folder structure

```
src/modules/gtm-v2/
  routes/        GtmV2Routes (lazy-loaded pages)
  layouts/       GtmV2Layout (navy sidebar, white top bar, global search)
  components/ui      Design system: Button, Input, Select, SearchableSelect, MultiSelect,
                     DataTable, Pagination, Badge/StatusBadge, Card/KpiCard, Modal,
                     ConfirmDialog, Tabs, Stepper, Empty/Loading/Error states
  components/domain  TerritoryTreePicker, ProductScopePicker, FlowDiagram, OriginBadge
  pages/<module>/    One folder per module
  services/      Async service layer (mock DB now, REST later)
  hooks/         useQuery, useGtmData, useAction, useGtmAuth, useProductMaster
  utils/         territory tree, flow validation, commercial resolver, eligibility, export
  mocks/seed.ts  Demo data (only the mock service imports it)
  types/         Domain model
  styles/        gtm-v2.css (all rules scoped under .g2)
```

## UI conventions

- **Forms open as right-side drawers.** `Modal` defaults to `variant="drawer"`; only confirmations use `variant="modal"`. The onboarding wizard and the flow builder open as wide drawers over their list pages, and their routes still work as deep links. Clicking outside a drawer doesn't close it, so typed input isn't lost; use Esc or ✕.
- **Sales flow coverage is zone-first.** Pick zones, then for each zone choose either *Entire zone* (stored in `zoneIds`, so territories added to the zone later are covered) or *Selected territories*, picked from that zone's territories only and stored in `territoryIds`. Territories outside every zone can still be added separately.
- **Sales flows define what's allowed, not a route.** A flow picks products, coverage and two sets of channels: *Sells through* (who may resell) and *Sells to* (end customers, one or more). The partner's actual route is built during onboarding.
- **Onboarding order:** Basic (with GST verification) → Territories → Products → **Partner type & route** → KYC → Commercial → Review.
  - Partner types that no applicable flow supports are disabled. "Edit sales flow" opens a small drawer where you tick the missing channel to enable them; this needs config rights and saves a new flow version.
  - In the same screen, choose **Buys from** (company direct, with the supplying warehouse, or an upstream channel and its actual partner) and **Sells to** (customer types and actual customers).
- **One onboarding entry, chosen by partner type.** *Partners → Onboard partner* asks for the partner type first. Each type has an *Onboarding form* (Configuration → Partner Types): **Full** opens the 7-step wizard; **Short** (hospitals, institutions) opens a one-screen form. "Add hospital / institution" inside the route screen uses the same short form. *Configuration → Short Onboarding Form* sets:
  - whether each field is required, optional or hidden (including hospital group)
  - whether GSTIN is verified when entered
  - whether approval is needed (category "Institution Onboarding")
  - the institution and ownership type lists

  End customers don't need principal KYC to be selectable in a route.
- **Route Rules apply to supply links.** Blocked "from → to" channel connections (Configuration → Route Rules) are rejected in sales policies *and* in each partner's buys-from / sells-to links.
- **Edit after onboarding.** Active partners and hospitals can update contacts, address (unless locked to the GST registry) and the institution profile from the partner list.
- **Partner relationships are neighbours-only.** In onboarding a partner records only:
  - **Buys from** (one level up): one or more suppliers, each with *Primary/Backup* and the portfolios it supplies.
  - **Sells to** (one level down): direct customers.

  Everything above its suppliers is derived from those suppliers' own records and shown read-only (greyed), so two records can never contradict each other.
- **Purchase-order rule:** a PO goes to the nearest upstream party that **owns** the stock.
  - Sales Channels has a "How it trades" setting: *Buys & resells* (Super Stockist, Distributor, Dealer) receives POs; *Agent / stock point* (C&F) only dispatches, so its POs go to the company.
  - Onboarding shows "PO goes to … · ships from …" for every supplier.
  - *Reports → Ordering Matrix* lists this for every partner.
- **One switch for commercial overrides.** A single "Override commercial terms" checkbox (`components/domain/CommercialOverrideEditor`) makes every term editable at once. Only values that differ from the inherited ones are saved.

## Hospital coverage

*Hospital Coverage* shows, for every hospital (grouped by hospital group) and every portfolio sold to hospitals, who serves it: the company directly or a partner.

- **Rule:** one primary per hospital × portfolio (configurable); an optional backup supplies only when the primary can't. Two partners can share a hospital by splitting portfolios. Empty cells are white space.
- **Scorecard:** sales, target achieved, fill rate, delivery days, complaints and payment days → a 0–100 score; partners serving the same hospital are compared side by side. Figures are sample data until secondary sales are connected.
- **Performance steps:** *On watch* → *Improvement period* (configurable days, with what must improve) → *Transfer / remove*.
- **Transfer / remove** is one approved step (workflow "Hospital Transfer / Removal"): reason, effective date (today or later), who takes over from the same date (another partner, company direct, or the backup), and a handover checklist (open orders, stock, consignment kits, claims, receivables). The old assignment is kept as history; the partner's "Sells to" links are updated.
- Rules live in *Configuration → Hospital Coverage*; *Reports → Hospital Coverage* lists every assignment.

## Partner health: licences, credit and portal

One signal per partner — **Ready to trade / Needs attention / Blocked** (`utils/health.ts → tradeStatusOf`) — shown on the partner list, the partner drawer, the dashboard "Partner Health" card, the Partner Health report and the Ordering Matrix.

- **Licences.** KYC document types with *Tracks expiry* (Configuration → KYC Documents) capture a licence number and a *Valid until* date in onboarding. Expiring documents warn N days ahead; an expired one blocks trading (Configuration → Compliance & Credit). *Renew* uploads a new copy; it goes to KYC Verification and the partner keeps the old copy's status until Compliance approves it.
- **Credit.** Limit and period come from commercial terms (with origin). Outstanding and overdue come from the ERP ledger — seeded in the demo; integration point `GET /partners/:id/ledger-summary`. A credit hold is placed immediately with a reason; **releasing** it needs the *Credit Hold Release* approval. Over-limit and overdue can block automatically (configurable).
- **Portal access.** Invite partner users (Owner / Ordering / Accounts / Viewer), resend, revoke. Invites expire after the configured days. The contact person is invited automatically when a partner is activated. "Simulate acceptance" stands in for the partner clicking the link.

## GSTIN verification (onboarding step 1)

- "Verify GSTIN" first checks the number offline: format, state code and the GSTN check digit (`utils/gstin.ts`).
- It then calls `gstService.verify`, which fills in the registered legal name, PAN and principal address. Those fields stay locked to the registry until the GSTIN changes. The trade name pre-fills the partner name, which stays editable.
- A cancelled or suspended registration blocks onboarding. Submitting requires a verified GSTIN, and the service checks this too.
- **Integration point:** `GET /gst/taxpayers/:gstin` on your backend, proxying the GSTN Search Taxpayer API through your GSP. Until that exists, a sandbox registry answers for these test GSTINs:

| GSTIN | Taxpayer | Status |
|---|---|---|
| `37AAJFV4821K1ZR` | Vijaya Ortho Dealers | Active |
| `36AAECC5521M1ZK` | Cyberabad Medisupply | Active |
| `29AAGCG7310P1Z4` | Ganga Surgicals | Active |
| `27AAFCB9076Q1ZT` | Bhavani Healthcare | Active |
| `33AAKFM3348D1ZI` | Marina Medical Agencies | Active |
| `36AACCK6402H1ZR` | Kondapur Pharma Traders | Cancelled |

## Architecture rules implemented

- **Dynamic configuration.** Territory level labels, maximum depth, partner types, KYC documents, eligibility rules, flow rules, approval levels, and status labels all come from configuration. Nothing in that list is hard-coded.
- **Master topology vs partner mapping.** These are separate entities:
  - the master flow (`SalesFlow`)
  - partner onboarding (`Partner`)
  - actual relationships (`PartnerFlowMapping`)
  - partner-specific stage bypasses (`PartnerFlowOverride`, which needs approval)

  Onboarding never writes to `SalesFlow`.
- **Product Master reuse.** Flows store only portfolio, category, subcategory and product IDs. Names are read live from `AppContext.portfolios` and `products` through `useProductMaster`.
- **Versioning.**
  - Changes to a channel's commercial terms create effective-dated versions; `channelTermsOn` resolves the version in force on a given date.
  - Structural changes to a flow increase its version.
  - Each mapping keeps the `flowVersion` it was created on and is flagged when it falls behind.
- **Commercial inheritance.** Precedence is:
  1. approved relationship terms
  2. approved partner terms
  3. territory terms, where the most specific territory wins and ancestors are inherited
  4. channel default

  Every value carries the source it came from (`utils/commercial.ts`).

## Authorization (reuses the existing VinFlux user)

`useGtmAuth` maps `AppContext.currentUser.permissions` as follows:

- `canManageConfig` controls editing masters, flows and configuration, and commercial overrides.
- `canApproveProducts` controls approving and rejecting requests.

To test the read-only and approval behaviour, use the existing "Admin: Config Enabled" toggle in the main VinFlux sidebar.

## APIs

**Reused from the existing app.** These are in-memory context data; the app has no HTTP layer:

- `AppContext.portfolios` and `products` (Product Master)
- `AppContext.warehouses` (Warehouse Master, used for flow source stages)
- `AppContext.currentUser`, `activePrincipal` and `showToast`, plus the existing `ToastContainer`

**Still required on the backend.** Mock implementations live in `services/*`, and each one is labelled in `services/apiClient.ts → ENDPOINTS`:

| Resource | Endpoints |
|---|---|
| Territories | `GET/POST /territories`, `PUT/DELETE /territories/:id`, `PATCH /territories/:id/status` |
| Zones | `GET/POST /zones`, `PUT /zones/:id`, `PATCH /zones/:id/status` |
| Sales channels | `GET/POST /sales-channels`, `PUT /sales-channels/:id` (versioned) |
| Sales flows | `GET/POST /sales-flows`, `PUT/DELETE /sales-flows/:id`, `POST /sales-flows/:id/duplicate` |
| Partners | `GET/POST /partners`, `PUT /partners/:id`, `POST /partners/:id/submit`, `PATCH /partners/:id/status` |
| KYC | `POST /partners/:id/kyc-documents` (multipart). Only file metadata is captured today. |
| Relationships | `GET /partner-flow-mappings`, `GET /partner-flow-overrides` |
| Commercial terms | `GET/POST /commercial-terms`, `PUT /commercial-terms/:id` |
| Approvals | `GET /approvals`, `POST /approvals/:id/approve`, `POST /approvals/:id/reject` |
| Configuration | `GET /configuration`, `PUT /configuration/:section` |
| GST verification | `GET /gst/taxpayers/:gstin` (backend → GSP → GSTN) |
| Credit | `GET /partners/:id/ledger-summary` (from ERP), `POST /partners/:id/credit-hold`, `POST /partners/:id/credit-hold/release-request` |
| Licence renewal | `POST /partners/:id/kyc-documents/:docTypeId/renew` (multipart) |
| Hospital coverage | `GET/POST /customer-assignments`, `POST /customer-assignments/:id/improvement`, `POST /customer-assignments/:id/transfer` |
| Partner details (day 2) | `PATCH /partners/:id/details` |
| Portal users | `GET/POST /partners/:id/portal-users`, `POST /partners/:id/portal-users/:userId/resend`, `DELETE /partners/:id/portal-users/:userId` |

To switch to the real API, implement `httpCall` in `services/apiClient.ts` and replace each `mockCall(...)` body. Pages and hooks don't change.

## Assumptions

- No ZIP or reference image was received, so the module was built from the connected project folder and the written design spec.
- The mock database is kept in `localStorage` under the key `vinflux.gtmv2.db`.
- The legacy Partner Management records were demo data only and were not migrated.
- Each partner type maps to exactly one sales channel. A partner's position in a flow is the stage whose channel matches its type.
- A flow is a linear chain. Alternative routes are modelled as separate flows, which can have different territories and products.
- "My queue" in Approvals matches approver roles by name, because the user model has no approver-role field.

## Removed legacy files

These now contain only `export {};` and can be deleted:

```
src/components/gtm/*            (7 files)
src/components/partner/*        (6 files)
src/components/routes/*         (3 files)
src/pages/GTMConfigurationPage.tsx
src/pages/PartnerManagementPage.tsx
src/types/gtm.ts, src/types/partner.ts
src/data/gtmData.ts, src/data/partnerData.ts
src/modules/gtm-v2/pages/partner-onboarding/{RouteBuilder,StepFlows,StepMapping}.tsx
src/modules/gtm-v2/pages/sales-flow-topology/FlowCanvas.tsx
src/modules/gtm-v2/pages/configuration/sections/PaymentModesSection.tsx
```

`src/styles/gtm.css` stays: despite its name it holds shared `vf-*` styles used by Product, Branch and Warehouse pages.
