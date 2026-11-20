/**
 * What is still pending, module by module — shown in the app on the "What's pending" page so a demo can say
 * plainly what is built, what is demo-only and what is needed before go-live.
 *   Demo gap     — built, but the demo data does not show it yet
 *   To build     — functionality not built yet
 *   Go-live      — needs the backend or a real integration (today simulated in the browser)
 *   Decision     — parked until a business decision is made
 */
import type { ModuleId } from './modules';

export type PendingKind = 'Demo gap' | 'To build' | 'Go-live' | 'Decision';
export interface PendingItem { id: string; kind: PendingKind; text: string }
export interface PendingGroup { key: string; module: ModuleId | null; title: string; path: string | null; items: PendingItem[] }

const g = (key: string, module: ModuleId | null, title: string, path: string | null, items: [PendingKind, string][]): PendingGroup =>
  ({ key, module, title, path, items: items.map(([kind, text], i) => ({ id: `${key}-${i + 1}`, kind, text })) });

export const ROADMAP: PendingGroup[] = [
  g('project', null, 'Project', null, [
    ['To build', 'Connect the distributor apps (DMS Replica / VinFlux Platform Redesign) to this principal app so consent, orders, stock, sales and claims really flow — today the distributor side is simulated'],
    ['To build', 'PRD v1.2: update the PRD with everything built since v1.1 (control tower, approvals, audit, reports, assembly, DMS consent, invitations, claim types)'],
    ['Go-live', 'Backend and database — every module keeps its data in the browser today; the tenant comes from the auth service'],
  ]),
  g('field', null, 'Field app (mobile)', null, [
    ['To build', 'Update the sales, delivery and OT roles for the new modules: order routing, partner stock reports, QC, recall, assembly serials and claims with automatic checks'],
  ]),
  g('platform', null, 'Control tower, approvals, audit & reports', '/dashboard', [
    ['Go-live', 'Sign-in through the auth service / SSO (Azure AD, Google Workspace) instead of the demo login'],
    ['Go-live', 'Scheduled report e-mails sent by the server — “Send now” only downloads the file in the demo'],
    ['Go-live', 'E-mail approval links issued and redeemed on the server'],
    ['Go-live', 'Audit log as an append-only table written with each change; module events through a message queue'],
    ['To build', 'Escalation e-mails for overdue approvals — the inbox marks them escalated but sends nothing'],
    ['Demo gap', 'Sell-out by brand shows by month: demo partner sales fall on a few days, so the daily 30-day view switches off'],
  ]),
  g('integrations', 'integration-hub', 'Integration Hub & Data Import', '/integrations', [
    ['Go-live', 'Live ERP connectors: only Zoho Inventory is live; SAP (first), Oracle, Odoo, Microsoft Dynamics and Tally are simulated'],
    ['To build', 'Tally / Busy distributor feed: daily stock and sales from the distributor’s accounting software (Tally agent over port 9000)'],
  ]),
  g('products', 'product-master', 'Product Master', '/products', [
    ['Go-live', 'Product Master API (only the data hook changes)'],
    ['Decision', 'Pharma is out of scope for now'],
  ]),
  g('gtm', 'go-to-market', 'Go-to-Market & invitations', '/network', [
    ['To build', 'Credit limit typed in an invitation’s agreement does not reach Go-to-Market commercial terms yet'],
    ['Go-live', 'GST registry check through a GSP on the server — the demo uses a sandbox of a few GSTINs'],
    ['Go-live', 'KYC files uploaded to the server; invitation e-mail and the distributor’s real sign-up'],
    ['Go-live', 'Agreement e-sign through an eSign provider (Aadhaar / DSC) — simulated in the demo'],
  ]),
  g('users', 'users', 'Users & Roles', '/users', [['Go-live', 'Users and roles API; SSO accounts mapped to these users']]),
  g('inventory', 'inventory', 'Inventory', '/inventory', [['Go-live', 'Stock balances and movements API, or the ERP stock sync']]),
  g('pricing', 'price-lists', 'Price Lists & Rate Contracts', '/pricing', [['Go-live', 'Price list API (submit, approve, quote)']]),
  g('crm', 'crm', 'Sales CRM', '/crm', [['Go-live', 'Website enquiry form posting leads into the CRM']]),
  g('secondary', 'secondary', 'Secondary Sales & Consent', '/consent', [
    ['To build', 'Consent screens on the distributor side (in the distributor app) — here the switches are a demo of the distributor’s choice'],
    ['Go-live', 'Live feed from the distributor platform — “Pull now” simulates it today'],
  ]),
  g('replenishment', 'replenishment', 'Replenishment & stock norm', '/replenishment', [
    ['Demo gap', 'Stock-norm check shows “no sales history” on the demo orders — none is for a product the partner has sold'],
  ]),
  g('claims', 'claims', 'Schemes & Claims', '/claims', [
    ['Demo gap', 'No Damage or Warranty claim in the demo data (the demo has no delivered shipment to a channel partner when claims are seeded)'],
    ['Go-live', 'Credit notes for settled claims created in the ERP through the connector'],
  ]),
  g('collections', 'collections', 'Collections', '/collections', [['Go-live', 'Receivables from the ERP, receipts posted to the ERP, reminders by e-mail / WhatsApp']]),
  g('procurement', 'procurement', 'Procurement & Vendors', '/procurement', [['Go-live', 'Purchase orders, goods receipts and payables posted to the ERP']]),
  g('imports', 'imports', 'Imports', '/imports', [['Go-live', 'ICEGATE bill-of-entry status, forwarder tracking, landed cost posted to the ERP']]),
  g('production', 'production', 'Production link', '/production', [['Go-live', 'Production receipts, plans and quality release read from the ERP connector']]),
  g('assembly', 'assembly', 'Assembly & Kitting', '/assembly', [
    ['Decision', 'Full manufacturing (MRP) for small manufacturers is future scope — today: assembly and kitting only'],
    ['Demo gap', 'Demo warehouses keep stock in the ERP, so builds there must also be posted in the ERP (the screen warns)'],
  ]),
  g('qc', 'qc', 'Quality Control', '/qc', [['Go-live', 'Certificate of analysis store / LIMS; quality notification to the ERP on rejection']]),
  g('surgical', 'surgical', 'Surgery Cases & Implants', '/surgical', [
    ['Decision', 'Who runs surgery cases: the principal’s OT team for direct hospitals, distributors for their own — parked'],
    ['Go-live', 'Implant usage passed on to invoicing / the ERP'],
  ]),
  g('orders', 'orders', 'Order Management', '/orders', [
    ['Go-live', 'E-mail intake from the real mailbox (IMAP / Microsoft Graph / Gmail) and PDF / Excel parsing on the server'],
    ['Go-live', 'Order e-mails and WhatsApp actually sent from the principal’s own domain — logged and previewed only today'],
    ['Go-live', 'ERP sales order and invoice webhooks'],
    ['Demo gap', 'Goods receipt posted at a platform distributor on delivery — no demo shipment goes to one yet'],
  ]),
  g('logistics', 'logistics', 'Logistics & Shipments', '/logistics', [['Go-live', 'Courier APIs (Blue Dart, Delhivery, Shiprocket) for AWB booking, pickup and tracking']]),
  g('invoicing', 'invoicing', 'Invoicing', '/invoices', [
    ['Go-live', 'IRN (e-invoice) and e-way bill from the GST portal through a GSP — generated locally in the demo'],
    ['Demo gap', 'Delivery challans: the demo has no consignment shipment, so the Delivery challans tab is empty'],
  ]),
  g('partnerlite', 'partner-lite', 'Partner Lite portal', '/p', [['Go-live', 'Partner edition web app talking to the principal’s tenant through the API; routed orders delivered to the distributor’s inbox']]),
];

/** Modules with nothing pending beyond the shared backend (shown as "No open items"). */
export const NOTHING_PENDING: ModuleId[] = ['returns', 'recall', 'performance', 'tenders'];

/* Per-viewer ticks ("done in this demo"): a convenience kept in this browser only. */
const KEY = 'vinflux.pending.done.v1';
export const doneSet = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>; } catch { return {}; } };
export const setDone = (id: string, on: boolean, by: string) => {
  try { const d = doneSet(); if (on) d[id] = `${by} · ${new Date().toISOString().slice(0, 10)}`; else delete d[id]; localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
};
