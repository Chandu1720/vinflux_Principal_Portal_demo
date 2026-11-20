/**
 * Audit and activity (PL7): one read-only trail of who did what, when, why and from where, assembled from every
 * record's own history and the platform event log. Nothing here can be edited or deleted (AUD-02).
 * INTEGRATION POINT: in production this is an append-only audit table written in the same transaction as each change.
 */
import { getEventLog } from './events';
import { orders } from '../modules/orders/orderStore';
import { pos } from '../modules/procurement/procurementStore';
import { claims, claimSchemes } from '../modules/claims/claimsStore';
import { returns } from '../modules/returns/returnStore';
import { recalls } from '../modules/recall/recallStore';
import { agreements, tenders } from '../modules/tenders/tendersStore';
import { invoices } from '../modules/invoicing/invoiceStore';
import { proposals } from '../modules/replenishment/replenishmentStore';
import { inspections } from '../modules/qc/qcStore';
import { priceLists } from '../modules/pricing/pricingStore';
import { shipments as impShipments } from '../modules/imports/importsStore';
import { allReports as secReports } from '../modules/secondary/secondaryStore';

export interface AuditRow { id: string; at: string; by: string; module: string; record: string; action: string; note: string; source: string }
type Hist = { at: string; by: string; action: string; note?: string }[];
type Rec = { id: string; no?: string; code?: string; name?: string; principalId?: string; history?: Hist };

const via = (by: string, note?: string) => {
  const t = `${by} ${note ?? ''}`;
  return /email link/i.test(t) ? 'Email action link' : /Partner Lite/i.test(t) ? 'Partner Lite' : /\bERP\b|SAP|Zoho|sync/i.test(t) ? 'Connector / ERP' : by === 'System' ? 'System' : 'Screen';
};
const from = (module: string, items: Rec[]): AuditRow[] => items.flatMap((r) => (r.history ?? []).map((h, i) => ({
  id: `${r.id}-${i}`, at: h.at, by: h.by, module, record: r.no ?? r.code ?? r.name ?? r.id, action: h.action, note: h.note ?? '', source: via(h.by, h.note),
})));

/** The whole trail for a principal, newest first. */
export const auditTrail = (principalId: string): AuditRow[] => {
  const mine = <T extends Rec>(xs: T[]) => xs.filter((x) => !x.principalId || x.principalId === principalId);
  const rows: AuditRow[] = [
    ...from('Orders', mine(orders() as unknown as Rec[])),
    ...from('Procurement', pos(principalId) as unknown as Rec[]),
    ...from('Claims', claims(principalId) as unknown as Rec[]),
    ...from('Schemes', claimSchemes(principalId) as unknown as Rec[]),
    ...from('Returns', mine(returns() as unknown as Rec[])),
    ...from('Recall', mine(recalls() as unknown as Rec[])),
    ...from('Tenders', tenders(principalId) as unknown as Rec[]),
    ...from('Agreements', agreements(principalId) as unknown as Rec[]),
    ...from('Invoicing', invoices(principalId) as unknown as Rec[]),
    ...from('Replenishment', proposals(principalId) as unknown as Rec[]),
    ...from('Quality Control', inspections(principalId) as unknown as Rec[]),
    ...from('Price lists', mine(priceLists() as unknown as Rec[])),
    ...from('Imports', impShipments(principalId) as unknown as Rec[]),
    ...from('Secondary sales', secReports(principalId) as unknown as Rec[]),
    ...getEventLog().filter((e) => !e.data || !('principalId' in e.data) || e.data.principalId === principalId).map((e) => ({ id: e.id, at: e.at, by: e.by, module: e.source, record: e.type, action: e.summary, note: '', source: 'Event' })),
  ];
  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
};

export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
};
export const download = (name: string, text: string, type = 'text/csv') => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
};
