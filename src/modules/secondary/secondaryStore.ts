/**
 * Secondary sales and partner stock (NV1): what each partner holds and sells of the principal's products.
 *
 * A partner sends a REPORT for a period (month) by its route — Partner Lite entry, its own system (Tally / Marg / Busy /
 * Zoho connector), a file, or the field app. Each report has closing stock lines and sales lines.
 *
 * Rules
 *   SEC-01 Partner item codes are mapped once to the principal's products and remembered per partner.
 *   SEC-02 Opening + receipts − sales = expected closing, per product. Receipts come from VinFlux deliveries, not the report.
 *          A difference beyond the tolerance (default 2%) puts the report in review; schemes don't use it until accepted.
 *   SEC-03 Every partner shows its route and the age of its last data; coverage = share of channel stock value that is reported and fresh.
 *   SEC-04 Downstream customer identity is shown full, masked or aggregated per the partner's sharing choice.
 *   SEC-05 Reported serials must trace to a delivery to that partner; unknown serials are flagged (possible parallel stock).
 *   SEC-06 Estimates (partners not connected) are labelled everywhere and never used for claims.
 * Accepting a report replaces the partner's channel stock in the inventory ledger with the reported closing stock.
 * INTEGRATION POINT: POST /secondary/reports (portal, file, connector agents), GET /secondary/coverage.
 */
import type { Product } from '../../types/product.ts';
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { findProduct } from '../../platform/import/entities';
import { balances, movements, post } from '../inventory/stockStore';
import type { LocType } from '../inventory/stockStore';

export type Route = 'portal' | 'connector' | 'file' | 'field' | 'desk' | 'none';
export const ROUTE_LABEL: Record<Route, string> = { portal: 'Partner Lite entry', connector: 'Partner’s system', file: 'File upload', field: 'Field app count', desk: 'Entered by our team', none: 'Not connected (estimate)' };
export type Cadence = 'nightly' | 'weekly' | 'monthly';
export const FRESH_DAYS: Record<Cadence, number> = { nightly: 3, weekly: 10, monthly: 40 };
export type Sharing = 'full' | 'masked' | 'aggregated';
export const SHARING_LABEL: Record<Sharing, string> = { full: 'Full customer names', masked: 'Masked names (type + town)', aggregated: 'Totals only' };
export const CUSTOMER_TYPES = ['Hospital', 'Dealer', 'Retailer', 'Clinic', 'Institution', 'Other'];

export interface PartnerSetup { partnerId: string; route: Route; system: string; cadence: Cadence; sharing: Sharing }
export interface StockLine { productId: string; batch: string; serial: string | null; expiry: string | null; qty: number }
export interface SaleLine { date: string; customer: string; customerType: string; town: string; productId: string; batch: string; serial: string | null; qty: number; value: number; invoiceNo: string }
/** A line whose partner item code is not mapped yet (SEC-01). */
export interface Unmapped { kind: 'stock' | 'sale'; code: string; name: string; line: Omit<StockLine, 'productId'> | Omit<SaleLine, 'productId'> }
export interface ReconRow { productId: string; opening: number; receipts: number; sales: number; expected: number; reported: number; diff: number; diffPct: number; ok: boolean }
export type ReportStatus = 'Accepted' | 'Needs review' | 'Rejected';
export interface SecondaryReport {
  id: string; no: string; principalId: string; partnerId: string; partnerName: string; locType: LocType;
  period: string; route: Route; system: string; submittedAt: string; by: string; status: ReportStatus;
  stock: StockLine[]; sales: SaleLine[]; unmapped: Unmapped[]; recon: ReconRow[]; flags: string[];
  history: { at: string; by: string; action: string; note?: string }[];
}
/** Raw line as it arrives (partner's codes). */
export interface RawLine { kind: 'stock' | 'sale'; code: string; name?: string; batch?: string; serial?: string; expiry?: string; qty: number; customer?: string; customerType?: string; town?: string; date?: string; value?: number; invoiceNo?: string }
export interface SecSettings { tolerancePct: number; estimateSellOutPct: number }

const now = () => new Date().toISOString();
export const periodOf = (iso: string) => iso.slice(0, 7);
export const thisPeriod = () => periodOf(now());
export const prevPeriod = (p: string) => { const [y, m] = p.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); };
export const daysIn = (p: string) => { const [y, m] = p.split('-').map(Number); return p === thisPeriod() ? new Date().getUTCDate() : new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const ageDays = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000));

/* ------------------------------------ Store ------------------------------------ */

interface Db { reports: SecondaryReport[]; setups: Record<string, PartnerSetup>; itemMap: Record<string, Record<string, string>>; settings: SecSettings; seq: number }
const KEY = () => workspaceKey('vinflux.secondary.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: loadJson<Db>(KEY(), { reports: [], setups: {}, itemMap: {}, settings: { tolerancePct: 2, estimateSellOutPct: 70 }, seq: 300 }) }; return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeSecondary = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const reports = (principalId: string) => db().reports.filter((r) => r.principalId === principalId);
export const getReport = (id: string) => db().reports.find((r) => r.id === id) ?? null;
export const secSettings = () => db().settings;
export const saveSecSettings = (s: SecSettings) => commit({ ...db(), settings: s });
export const setupOf = (partnerId: string): PartnerSetup => db().setups[partnerId] ?? { partnerId, route: 'none', system: '', cadence: 'monthly', sharing: 'masked' };
export const saveSetup = (s: PartnerSetup) => commit({ ...db(), setups: { ...db().setups, [s.partnerId]: s } });
export const itemMapOf = (partnerId: string) => db().itemMap[partnerId] ?? {};

/* ---------------------------------- Ledger reads ---------------------------------- */

const inPeriod = (iso: string, p: string) => iso.slice(0, 7) === p;
/** SEC-02: receipts from the principal = deliveries recorded in VinFlux (not the partner's figure). */
export const receiptsOf = (partnerId: string, productId: string, period: string) =>
  movements().filter((m) => m.type === 'RECEIPT' && m.warehouseId === partnerId && m.productId === productId && inPeriod(m.at, period)).reduce((a, m) => a + m.qty, 0);
/** Serials delivered to the partner (SEC-05). */
const deliveredSerials = (partnerId: string) => new Set(movements().filter((m) => m.warehouseId === partnerId && m.serial && ['RECEIPT', 'OPENING'].includes(m.type)).map((m) => `${m.productId}|${m.serial}`));
/** Opening = closing of the last accepted report before this period; else ledger stock at the start of the period. */
export const openingOf = (partnerId: string, productId: string, period: string, principalId: string) => {
  const prev = reports(principalId).filter((r) => r.partnerId === partnerId && r.status === 'Accepted' && r.period < period).sort((a, b) => (a.period < b.period ? 1 : -1))[0];
  if (prev) return prev.stock.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0);
  const start = `${period}-01`;
  return movements().filter((m) => m.warehouseId === partnerId && m.productId === productId && (m.locType ?? 'COMPANY') !== 'TRANSIT' && (m.locType ?? 'COMPANY') !== 'COMPANY' && m.at.slice(0, 10) < start).reduce((a, m) => a + m.qty, 0);
};

/* --------------------------------- Report checks --------------------------------- */

const check = (r: SecondaryReport): SecondaryReport => {
  const tol = db().settings.tolerancePct;
  const ids = Array.from(new Set([...r.stock.map((l) => l.productId), ...r.sales.map((l) => l.productId)]));
  const recon: ReconRow[] = ids.map((productId) => {
    const opening = openingOf(r.partnerId, productId, r.period, r.principalId);
    const receipts = receiptsOf(r.partnerId, productId, r.period);
    const sales = r.sales.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0);
    const expected = opening + receipts - sales;
    const reported = r.stock.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0);
    const diff = reported - expected;
    const diffPct = expected ? Math.round((Math.abs(diff) / Math.abs(expected)) * 1000) / 10 : reported ? 100 : 0;
    return { productId, opening, receipts, sales, expected, reported, diff, diffPct, ok: diff === 0 || diffPct <= tol };
  });
  const flags: string[] = [];
  if (r.unmapped.length) flags.push(`${r.unmapped.length} line(s) with partner item codes not mapped yet (SEC-01).`);
  recon.filter((x) => !x.ok).forEach((x) => flags.push(`Does not reconcile for ${x.productId}: expected ${x.expected}, reported ${x.reported} (${x.diff > 0 ? '+' : ''}${x.diff}, ${x.diffPct}%) (SEC-02).`));
  const known = deliveredSerials(r.partnerId);
  const serials = [...r.stock, ...r.sales].filter((l) => l.serial);
  serials.filter((l) => !known.has(`${l.productId}|${l.serial}`)).forEach((l) => flags.push(`Serial ${l.serial} was never delivered to this partner — possible parallel / grey-market stock (SEC-05).`));
  if (r.sales.some((l) => l.qty < 0) || r.stock.some((l) => l.qty < 0)) flags.push('Negative quantities in the report.');
  return { ...r, recon, flags };
};

/** Map partner codes to products: remembered per partner, else matched by code / SKU / GTIN. */
const resolve = (partnerId: string, code: string, products: Product[]) => {
  const m = itemMapOf(partnerId)[code.trim().toLowerCase()];
  if (m) return m;
  return findProduct(code, products)?.product.id ?? null;
};

export interface SubmitInput { principalId: string; partnerId: string; partnerName: string; locType: LocType; period: string; route: Route; system: string; lines: RawLine[] }
export const submitReport = (n: SubmitInput, products: Product[], by: string): { ok: boolean; message: string; id?: string; errors?: string[] } => {
  const errs: string[] = [];
  if (!n.partnerId) errs.push('Choose the partner.');
  if (!/^\d{4}-\d{2}$/.test(n.period)) errs.push('Choose the period.');
  if (n.period > thisPeriod()) errs.push('The period is in the future.');
  if (!n.lines.length) errs.push('The report has no lines.');
  n.lines.forEach((l, i) => { if (!(l.qty >= 0)) errs.push(`Line ${i + 1}: quantity must be zero or more.`); if (l.kind === 'sale' && !l.customer?.trim()) errs.push(`Line ${i + 1}: sale needs a customer.`); });
  if (errs.length) return { ok: false, message: 'Can’t take this report.', errors: errs };
  const d = db();
  const stock: StockLine[] = []; const sales: SaleLine[] = []; const unmapped: Unmapped[] = [];
  n.lines.forEach((l) => {
    const pid = resolve(n.partnerId, l.code, products);
    const base = { batch: l.batch?.trim() || '—', serial: l.serial?.trim() || null, qty: l.qty };
    const st = { ...base, expiry: l.expiry || null };
    const sa = { ...base, date: l.date || `${n.period}-15`, customer: l.customer?.trim() ?? '', customerType: l.customerType || 'Other', town: l.town?.trim() ?? '', value: l.value ?? 0, invoiceNo: l.invoiceNo ?? '' };
    if (!pid) unmapped.push({ kind: l.kind, code: l.code, name: l.name ?? '', line: l.kind === 'stock' ? st : sa });
    else if (l.kind === 'stock') stock.push({ ...st, productId: pid });
    else sales.push({ ...sa, productId: pid });
  });
  const seq = d.seq + 1;
  // A newer report for the same partner and period replaces the old one.
  const replaced = d.reports.filter((r) => r.partnerId === n.partnerId && r.period === n.period && r.status !== 'Rejected');
  let r: SecondaryReport = { id: newId('sec'), no: `SR-${seq}`, principalId: n.principalId, partnerId: n.partnerId, partnerName: n.partnerName, locType: n.locType, period: n.period, route: n.route, system: n.system, submittedAt: now(), by, status: 'Needs review', stock, sales, unmapped, recon: [], flags: [], history: [{ at: now(), by, action: `Received by ${ROUTE_LABEL[n.route]}${n.system ? ` (${n.system})` : ''}`, note: replaced.length ? `Replaces ${replaced.map((x) => x.no).join(', ')}` : undefined }] };
  r = check(r);
  commit({ ...d, seq, reports: [r, ...d.reports.map((x) => (replaced.includes(x) ? { ...x, status: 'Rejected' as ReportStatus, history: [...x.history, { at: now(), by, action: `Replaced by ${r.no}` }] } : x))] });
  if (!r.flags.length) { accept(r.id, by, 'All checks passed — accepted automatically'); return { ok: true, message: `${r.no} accepted — channel stock updated.`, id: r.id }; }
  return { ok: true, message: `${r.no} needs review: ${r.flags.length} issue(s).`, id: r.id };
};

/** SEC-01: map a partner code once; open reports with that code are re-checked. */
export const mapCode = (partnerId: string, code: string, productId: string, by: string) => {
  const d = db();
  const itemMap = { ...d.itemMap, [partnerId]: { ...(d.itemMap[partnerId] ?? {}), [code.trim().toLowerCase()]: productId } };
  const reportsN = d.reports.map((r) => {
    if (r.partnerId !== partnerId || r.status !== 'Needs review' || !r.unmapped.some((u) => u.code === code)) return r;
    const hit = r.unmapped.filter((u) => u.code === code);
    const stock = [...r.stock, ...hit.filter((u) => u.kind === 'stock').map((u) => ({ ...(u.line as Omit<StockLine, 'productId'>), productId }))];
    const sales = [...r.sales, ...hit.filter((u) => u.kind === 'sale').map((u) => ({ ...(u.line as Omit<SaleLine, 'productId'>), productId }))];
    return { ...r, stock, sales, unmapped: r.unmapped.filter((u) => u.code !== code), history: [...r.history, { at: now(), by, action: `Code ${code} mapped` }] };
  });
  cache = { key: KEY(), d: { ...d, itemMap, reports: reportsN } };
  commit({ ...cache.d, reports: cache.d.reports.map((r) => (r.partnerId === partnerId && r.status === 'Needs review' ? check(r) : r)) });
};

/** Accept: the reported closing stock replaces the partner's channel stock in the ledger. */
export const accept = (id: string, by: string, note?: string): { ok: boolean; message: string } => {
  const d = db(); const r = d.reports.find((x) => x.id === id);
  if (!r || r.status !== 'Needs review') return { ok: false, message: 'Nothing to accept.' };
  if (r.unmapped.length) return { ok: false, message: 'Map the remaining partner item codes first.' };
  const newer = d.reports.some((x) => x.partnerId === r.partnerId && x.status === 'Accepted' && x.period > r.period);
  if (!newer) {
    const old = balances().filter((b) => b.warehouseId === r.partnerId && b.locType !== 'TRANSIT' && b.locType !== 'COMPANY');
    const base = { bin: '', mfgDate: null, unitCost: null, status: 'Available' as const, importId: null, source: `Partner report ${r.no} (${ROUTE_LABEL[r.route]})`, by, refId: r.id };
    post([
      ...old.map((b) => ({ ...base, type: 'PARTNER_REPORT' as const, locType: b.locType, warehouseId: b.warehouseId, productId: b.productId, variantSku: b.variantSku, batch: b.batch, serial: b.serial, expiryDate: b.expiryDate, unitCost: b.unitCost, status: b.status, qty: -b.qty })),
      ...r.stock.filter((l) => l.qty > 0).map((l) => ({ ...base, type: 'PARTNER_REPORT' as const, locType: r.locType, warehouseId: r.partnerId, productId: l.productId, variantSku: null, batch: l.batch, serial: l.serial, expiryDate: l.expiry, qty: l.qty })),
    ]);
  }
  const fresh = db();
  commit({ ...fresh, reports: fresh.reports.map((x) => (x.id === id ? { ...x, status: 'Accepted' as ReportStatus, history: [...x.history, { at: now(), by, action: 'Accepted', note: note ?? (x.flags.length ? `Accepted with ${x.flags.length} open flag(s)` : undefined) }] } : x)) });
  emit('secondary.accepted', 'Secondary sales', by, `${r.no} ${r.partnerName} ${r.period} accepted`, { reportId: id, partnerId: r.partnerId });
  return { ok: true, message: `${r.no} accepted${newer ? ' (a newer period is already in stock, so stock was not changed)' : ' — channel stock updated'}.` };
};
export const reject = (id: string, reason: string, by: string) => {
  const d = db(); const r = d.reports.find((x) => x.id === id);
  if (!r || r.status !== 'Needs review') return { ok: false, message: 'Nothing to reject.' };
  if (!reason.trim()) return { ok: false, message: 'Give a reason — the partner sees it.' };
  commit({ ...d, reports: d.reports.map((x) => (x.id === id ? { ...x, status: 'Rejected' as ReportStatus, history: [...x.history, { at: now(), by, action: 'Rejected — partner asked to resend', note: reason }] } : x)) });
  return { ok: true, message: `${r.no} rejected; ${r.partnerName} is asked to resend.` };
};

/* ----------------------------------- Analysis ----------------------------------- */

export interface PartnerRow { partnerId: string; setup: PartnerSetup; last: SecondaryReport | null; fresh: boolean; age: number | null; stockUnits: number; stockValue: number; estimated: boolean; reconOk: boolean | null; pending: number }
/** SEC-03 board: route, last accepted report, age, channel stock held. */
export const partnerBoard = (principalId: string, partnerIds: string[], unitValue: (pid: string) => number): PartnerRow[] => {
  const bal = balances().filter((b) => b.locType !== 'TRANSIT' && b.locType !== 'COMPANY');
  return partnerIds.map((pid) => {
    const setup = setupOf(pid);
    const rs = reports(principalId).filter((r) => r.partnerId === pid);
    const last = rs.filter((r) => r.status === 'Accepted').sort((a, b) => (a.period === b.period ? (a.submittedAt < b.submittedAt ? 1 : -1) : a.period < b.period ? 1 : -1))[0] ?? null;
    const held = bal.filter((b) => b.warehouseId === pid);
    const age = last ? ageDays(last.submittedAt) : null;
    return {
      partnerId: pid, setup, last, age, fresh: age !== null && age <= FRESH_DAYS[setup.cadence], estimated: setup.route === 'none',
      stockUnits: held.reduce((a, b) => a + b.qty, 0), stockValue: held.reduce((a, b) => a + b.qty * unitValue(b.productId), 0),
      reconOk: last ? last.recon.every((x) => x.ok) : null, pending: rs.filter((r) => r.status === 'Needs review').length,
    };
  });
};
export const coverage = (rows: PartnerRow[]) => {
  const total = rows.reduce((a, r) => a + r.stockValue, 0);
  const fresh = rows.filter((r) => r.fresh && !r.estimated).reduce((a, r) => a + r.stockValue, 0);
  return { total, fresh, pct: total ? Math.round((fresh / total) * 100) : 0 };
};

export interface ThroughRow { partnerId: string; productId: string; opening: number; received: number; sold: number; closing: number; sellThrough: number | null; cover: number | null; estimated: boolean; flag: string | null }
/** Sell-through and days of cover per partner × product for a period. Not-connected partners get labelled estimates (SEC-06). */
export const sellThrough = (principalId: string, partnerIds: string[], period: string): ThroughRow[] => {
  const out: ThroughRow[] = [];
  const sellOut = db().settings.estimateSellOutPct / 100;
  partnerIds.forEach((pid) => {
    const rep = reports(principalId).find((r) => r.partnerId === pid && r.period === period && r.status === 'Accepted');
    if (rep) {
      rep.recon.forEach((x) => {
        const sellThroughPct = x.opening + x.receipts ? Math.round((x.sales / (x.opening + x.receipts)) * 100) : null;
        const perDay = x.sales / daysIn(period);
        const cover = perDay ? Math.round(x.reported / perDay) : null;
        out.push({ partnerId: pid, productId: x.productId, opening: x.opening, received: x.receipts, sold: x.sales, closing: x.reported, sellThrough: sellThroughPct, cover, estimated: false,
          flag: x.receipts > 0 && x.sales === 0 ? 'Buying, not selling' : cover !== null && cover > 90 ? 'Over 90 days of stock' : null });
      });
    } else if (setupOf(pid).route === 'none') {
      const prods = Array.from(new Set(movements().filter((m) => m.warehouseId === pid && m.type === 'RECEIPT').map((m) => m.productId)));
      prods.forEach((productId) => {
        const opening = openingOf(pid, productId, period, principalId); const received = receiptsOf(pid, productId, period);
        const sold = Math.round((opening + received) * sellOut * (daysIn(period) / 30));
        out.push({ partnerId: pid, productId, opening, received, sold, closing: Math.max(0, opening + received - sold), sellThrough: null, cover: null, estimated: true, flag: null });
      });
    }
  });
  return out;
};

export interface Downstream { key: string; name: string; type: string; town: string; partners: string[]; qty: number; value: number; lastDate: string; masked: boolean }
/** Downstream customers from accepted sales, shown per each partner's sharing choice (SEC-04). */
export const downstream = (principalId: string, partnerName: (id: string) => string): Downstream[] => {
  const map = new Map<string, Downstream>();
  let n = 0;
  reports(principalId).filter((r) => r.status === 'Accepted').forEach((r) => {
    const sharing = setupOf(r.partnerId).sharing;
    r.sales.forEach((s) => {
      const masked = sharing !== 'full';
      const key = sharing === 'aggregated' ? `agg|${s.customerType}|${s.town}` : `${s.customer.toLowerCase()}|${s.town.toLowerCase()}`;
      const cur = map.get(key) ?? { key, name: sharing === 'aggregated' ? `${s.customerType}s in ${s.town || '—'} (total)` : masked ? `${s.customerType} in ${s.town || '—'} #${++n}` : s.customer, type: s.customerType, town: s.town, partners: [], qty: 0, value: 0, lastDate: '', masked };
      if (!cur.partners.includes(partnerName(r.partnerId))) cur.partners.push(partnerName(r.partnerId));
      cur.qty += s.qty; cur.value += s.value; if (s.date > cur.lastDate) cur.lastDate = s.date;
      map.set(key, cur);
    });
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
};

/* ------------------------------------- Demo ------------------------------------- */

/** One principal, partners on different routes: Partner Lite, a Tally connector, a file, and one not connected. */
export const ensureSecondaryDemo = (principalId: string, partners: { id: string; name: string; locType: LocType }[], products: Product[], by: string) => {
  if (reports(principalId).length || partners.length < 2 || !products.length) return;
  const ps = products.slice(0, 3);
  const routes: [Route, string, Sharing][] = [['portal', '', 'full'], ['connector', 'Tally (agent)', 'masked'], ['file', 'Excel', 'aggregated'], ['none', '', 'masked']];
  partners.slice(0, 4).forEach((p, i) => saveSetup({ partnerId: p.id, route: routes[i][0], system: routes[i][1], cadence: i === 1 ? 'nightly' : 'monthly', sharing: routes[i][2] }));
  const cur = thisPeriod(); const prev = prevPeriod(cur);
  const towns = ['Hyderabad', 'Guntur', 'Vijayawada', 'Warangal'];
  const custs = [['Yashoda Hospitals', 'Hospital'], ['Sai Surgicals', 'Dealer'], ['City Ortho Clinic', 'Clinic'], ['Govt. General Hospital', 'Institution']];
  partners.slice(0, 3).forEach((p, i) => {
    const route = routes[i][0]; const system = routes[i][1];
    // Last month: opening stock statement.
    submitReport({ principalId, partnerId: p.id, partnerName: p.name, locType: p.locType, period: prev, route, system, lines: ps.map((x, j) => ({ kind: 'stock' as const, code: x.code, batch: `B26${10 + j}A`, qty: 40 - j * 10, expiry: j === 2 ? new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10) : '2029-12-31' })) }, products, by);
    const prevRep = reports(principalId).find((r) => r.partnerId === p.id && r.period === prev);
    if (prevRep && prevRep.status === 'Needs review') accept(prevRep.id, by, 'Opening statement');
    // This month: sales + closing stock. Partner 2 doesn't reconcile; partner 3 uses its own item code for one product.
    const lines: RawLine[] = [];
    ps.forEach((x, j) => {
      const opening = 40 - j * 10; const rec = receiptsOf(p.id, x.id, cur);
      const sold = j === 2 && i === 0 ? 0 : 6 + i * 2 + j;
      const buyers = custs.slice(0, 2 + (j % 2));
      const split = buyers.map((_c, k) => Math.floor(sold / buyers.length) + (k < sold % buyers.length ? 1 : 0));
      buyers.forEach((c, k) => { if (split[k] > 0) lines.push({ kind: 'sale', code: i === 2 && j === 0 ? `ITM-${100 + j}` : x.code, name: x.name, batch: `B26${10 + j}A`, qty: split[k], customer: c[0], customerType: c[1], town: towns[(k + i) % 4], value: 18000 * split[k], invoiceNo: `INV/${p.name.slice(0, 3).toUpperCase()}/${400 + k + j * 10}`, date: `${cur}-0${2 + k}` }); });
      const closing = opening + rec - sold + (i === 1 && j === 0 ? -5 : 0);
      lines.push({ kind: 'stock', code: i === 2 && j === 0 ? `ITM-${100 + j}` : x.code, name: x.name, batch: `B26${10 + j}A`, qty: Math.max(0, closing), expiry: j === 2 ? new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10) : '2029-12-31' });
    });
    submitReport({ principalId, partnerId: p.id, partnerName: p.name, locType: p.locType, period: cur, route, system, lines }, products, by);
  });
};
