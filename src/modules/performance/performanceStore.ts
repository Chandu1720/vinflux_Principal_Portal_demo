/**
 * Partner performance and targets (NV3).
 * PRF-01 Targets by month for a partner, territory, product group or salesperson, on primary sales, secondary sales or both.
 * PRF-02 Scorecard per partner: target achievement, fill rate received, days of stock, expiry write-off, payment discipline
 *        (DSO, overdue %), data discipline (on-time reporting %), claim ratio — combined into one score and grade.
 * PRF-03 The principal chooses whether partners see their own scorecard (Partner Lite / portal).
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import type { Product } from '../../types/product.ts';
import { orders, orderValue } from '../orders/orderStore';
import { balances } from '../inventory/stockStore';
import { reports as secReports, setupOf } from '../secondary/secondaryStore';
import { ageing } from '../collections/collectionsStore';
import { claims } from '../claims/claimsStore';
import { suggest } from '../replenishment/replenishmentStore';

export type TargetScope = 'partner' | 'territory' | 'product-group' | 'salesperson';
export type Basis = 'primary' | 'secondary' | 'both';
export interface Target { id: string; principalId: string; period: string; scope: TargetScope; refId: string; basis: Basis; value: number; note?: string; createdBy: string }
export interface Weights { achievement: number; fill: number; stock: number; expiry: number; payment: number; data: number; claims: number; coverage: number; accuracy: number }
export interface PerfSettings { weights: Weights; sharePartner: boolean; stockBandDays: [number, number] }
interface Db { targets: Target[]; settings: PerfSettings; seeded: string[] }

export const SCOPE_LABEL: Record<TargetScope, string> = { partner: 'Partner', territory: 'Territory', 'product-group': 'Product group', salesperson: 'Salesperson' };
export const BASIS_LABEL: Record<Basis, string> = { primary: 'Primary (your sales to them)', secondary: 'Secondary (their sales)', both: 'Both (each must be met)' };
const DEFAULT: PerfSettings = { weights: { achievement: 30, fill: 10, stock: 10, expiry: 5, payment: 15, data: 10, claims: 5, coverage: 10, accuracy: 5 }, sharePartner: false, stockBandDays: [15, 60] };

const KEY = () => workspaceKey('vinflux.performance.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) {
    const x = loadJson<Partial<Db> | null>(KEY(), null);
    cache = { key: KEY(), d: { targets: Array.isArray(x?.targets) ? x!.targets : [], settings: { ...DEFAULT, ...(x?.settings ?? {}), weights: { ...DEFAULT.weights, ...(x?.settings?.weights ?? {}) } }, seeded: Array.isArray(x?.seeded) ? x!.seeded : [] } };
  }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribePerformance = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const perfSettings = () => db().settings;
export const savePerfSettings = (s: PerfSettings) => commit({ ...db(), settings: s });
export const targets = (principalId: string) => db().targets.filter((t) => t.principalId === principalId);
export const saveTarget = (t: Target): { ok: boolean; message: string } => {
  if (!t.refId) return { ok: false, message: `Choose the ${SCOPE_LABEL[t.scope].toLowerCase()}.` };
  if (!(t.value > 0)) return { ok: false, message: 'Target must be more than 0.' };
  if (!/^\d{4}-\d{2}$/.test(t.period)) return { ok: false, message: 'Choose the month.' };
  const d = db(); const clash = d.targets.find((x) => x.id !== t.id && x.principalId === t.principalId && x.period === t.period && x.scope === t.scope && x.refId === t.refId && x.basis === t.basis);
  if (clash) return { ok: false, message: 'A target for this already exists for that month — edit it instead.' };
  const rec = { ...t, id: t.id || newId('tgt') };
  commit({ ...d, targets: d.targets.some((x) => x.id === rec.id) ? d.targets.map((x) => (x.id === rec.id ? rec : x)) : [...d.targets, rec] });
  return { ok: true, message: 'Target saved.' };
};
export const deleteTarget = (id: string) => commit({ ...db(), targets: db().targets.filter((t) => t.id !== id) });
/** Copy every target of one month to the next, scaled by growth %. Existing targets in the next month are kept. */
export const rollTargets = (principalId: string, from: string, to: string, growthPct: number, by: string) => {
  const d = db(); const have = new Set(d.targets.filter((t) => t.principalId === principalId && t.period === to).map((t) => `${t.scope}|${t.refId}|${t.basis}`));
  const add = d.targets.filter((t) => t.principalId === principalId && t.period === from && !have.has(`${t.scope}|${t.refId}|${t.basis}`))
    .map((t) => ({ ...t, id: newId('tgt'), period: to, value: Math.round(t.value * (1 + growthPct / 100)), createdBy: by }));
  commit({ ...d, targets: [...d.targets, ...add] });
  return add.length;
};

export const monthOf = (iso: string) => iso.slice(0, 7);
export const thisMonth = () => monthOf(new Date().toISOString());
export const prevMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7); };
export const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7); };

/* ------------------------------- Measures ------------------------------- */

export interface PartnerLite { id: string; name: string; partnerTypeId: string; territoryIds: string[] }
/** Primary sales (orders, not rejected/cancelled) of a partner in a month, optionally only some products. */
export const primaryOf = (principalId: string, partnerId: string, month: string, productIds?: Set<string>) =>
  orders().filter((o) => o.principalId === principalId && o.partnerId === partnerId && o.createdAt.slice(0, 7) === month && !['Rejected', 'Cancelled'].includes(o.status))
    .reduce((a, o) => a + (productIds ? o.lines.filter((l) => productIds.has(l.productId)).reduce((s, l) => s + (l.netUnit ?? 0) * l.qty * (1 + l.gstPct / 100), 0) : orderValue(o)), 0);
/** Secondary sales value reported for a month (latest accepted report wins — live feeds resend month-to-date). */
export const secondaryOf = (principalId: string, partnerId: string, month: string, productIds?: Set<string>) => {
  const r = secReports(principalId).filter((x) => x.partnerId === partnerId && x.period === month && x.status === 'Accepted').sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
  return r ? r.sales.filter((s) => !productIds || productIds.has(s.productId)).reduce((a, s) => a + s.value, 0) : 0;
};

export interface Achievement { target: Target; name: string; primary: number; secondary: number; actual: number; pct: number }
/** PRF-01: achievement of every target in a month. */
export const achievements = (principalId: string, month: string, partners: PartnerLite[], products: Product[], names: (t: Target) => string, userTerritories: (userId: string) => string[], territoryKids: (id: string) => string[]): Achievement[] =>
  targets(principalId).filter((t) => t.period === month).map((t) => {
    let ps: PartnerLite[] = partners; let prods: Set<string> | undefined;
    if (t.scope === 'partner') ps = partners.filter((p) => p.id === t.refId);
    if (t.scope === 'territory') { const set = new Set([t.refId, ...territoryKids(t.refId)]); ps = partners.filter((p) => p.territoryIds.some((x) => set.has(x))); }
    if (t.scope === 'salesperson') { const set = new Set(userTerritories(t.refId).flatMap((x) => [x, ...territoryKids(x)])); ps = partners.filter((p) => p.territoryIds.some((x) => set.has(x))); }
    if (t.scope === 'product-group') prods = new Set(products.filter((p) => p.portfolioId === t.refId || p.categoryId === t.refId || p.subCategoryId === t.refId).map((p) => p.id));
    const primary = ps.reduce((a, p) => a + primaryOf(principalId, p.id, month, prods), 0);
    const secondary = ps.reduce((a, p) => a + secondaryOf(principalId, p.id, month, prods), 0);
    const actual = t.basis === 'primary' ? primary : t.basis === 'secondary' ? secondary : Math.min(primary, secondary);
    return { target: t, name: names(t), primary, secondary, actual, pct: Math.round((actual / t.value) * 100) };
  });

export interface Metric { key: keyof Weights; label: string; value: string; score: number | null; hint: string }
export interface Scorecard { partnerId: string; name: string; score: number | null; grade: 'A' | 'B' | 'C' | 'D' | '—'; metrics: Metric[]; primary: number; secondary: number; targetPct: number | null }

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const inrS = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);

/** PRF-02: scorecards for the month. Metrics without data are shown as "—" and left out of the score. */
export const scorecards = (principalId: string, month: string, partners: PartnerLite[], products: Product[], unitValue: (pid: string) => number): Scorecard[] => {
  const s = db().settings; const w = s.weights;
  const age = ageing(principalId);
  const cover = new Map<string, number | null>();
  suggest(principalId, partners.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId })), products).filter((x) => x.ok).forEach((x) => {
    const rows = x.rows.filter((r) => r.avgDaily > 0);
    const units = rows.reduce((a, r) => a + r.stock, 0); const daily = rows.reduce((a, r) => a + r.avgDaily, 0);
    cover.set(x.partnerId, daily ? Math.round(units / daily) : null);
  });
  const tg = targets(principalId).filter((t) => t.period === month && t.scope === 'partner');
  const months6 = Array.from({ length: 6 }, (_, i) => { let m = month; for (let k = 0; k < i; k++) m = prevMonth(m); return m; });
  const today = new Date().toISOString().slice(0, 10);
  const bal = balances();
  const cl = claims(principalId);
  return partners.map((p) => {
    const primary = primaryOf(principalId, p.id, month); const secondary = secondaryOf(principalId, p.id, month);
    const metrics: Metric[] = [];
    // Achievement
    const mine = tg.filter((t) => t.refId === p.id);
    const pct = mine.length ? Math.round(Math.min(...mine.map((t) => ((t.basis === 'primary' ? primary : t.basis === 'secondary' ? secondary : Math.min(primary, secondary)) / t.value) * 100))) : null;
    metrics.push({ key: 'achievement', label: 'Target achievement', value: pct === null ? '—' : `${pct}%`, score: pct === null ? null : clamp(pct), hint: mine.length ? mine.map((t) => `${t.basis} ${inrS(t.value)}`).join(' · ') : 'No target this month' });
    // Fill rate received: shipped ÷ ordered for orders of the last 90 days that are shipped or completed.
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const os = orders().filter((o) => o.principalId === principalId && o.partnerId === p.id && o.createdAt >= since && ['Shipped', 'Completed'].includes(o.status));
    const ordered = os.reduce((a, o) => a + o.lines.reduce((x, l) => x + l.qty, 0), 0); const shipped = os.reduce((a, o) => a + o.lines.reduce((x, l) => x + Math.min(l.qty, l.shippedQty), 0), 0);
    const fill = ordered ? Math.round((shipped / ordered) * 100) : null;
    metrics.push({ key: 'fill', label: 'Fill rate received', value: fill === null ? '—' : `${fill}%`, score: fill, hint: ordered ? `${shipped} of ${ordered} units, last 90 days` : 'No shipped orders in 90 days' });
    // Days of stock against the healthy band.
    const c = cover.get(p.id) ?? null; const [lo, hi] = s.stockBandDays;
    metrics.push({ key: 'stock', label: 'Days of stock', value: c === null ? '—' : `${c} d`, score: c === null ? null : c < lo ? clamp((c / lo) * 100) : c > hi ? clamp(100 - ((c - hi) / hi) * 100) : 100, hint: `Healthy ${lo}–${hi} days` });
    // Expiry write-off: stock at the partner already past expiry, as % of what it holds.
    const held = bal.filter((b) => b.warehouseId === p.id && b.qty > 0 && (b.locType === 'PARTNER' || b.locType === 'CNF'));
    const heldVal = held.reduce((a, b) => a + b.qty * unitValue(b.productId), 0); const expVal = held.filter((b) => b.expiryDate && b.expiryDate < today).reduce((a, b) => a + b.qty * unitValue(b.productId), 0);
    const expPct = heldVal ? Math.round((expVal / heldVal) * 1000) / 10 : null;
    metrics.push({ key: 'expiry', label: 'Expired stock', value: expPct === null ? '—' : `${expPct}%`, score: expPct === null ? null : clamp(100 - expPct * 10), hint: expVal ? `${inrS(expVal)} past expiry` : 'Nothing expired' });
    // Payment discipline: overdue % of outstanding and days sales outstanding.
    const a = age.find((r) => r.partnerId === p.id);
    const sales90 = orders().filter((o) => o.principalId === principalId && o.partnerId === p.id && o.createdAt >= since && !['Rejected', 'Cancelled'].includes(o.status)).reduce((x, o) => x + orderValue(o), 0);
    const dso = a && sales90 ? Math.round(a.outstanding / (sales90 / 90)) : null;
    const odPct = a && a.outstanding ? Math.round((a.overdue / a.outstanding) * 100) : a ? 0 : null;
    metrics.push({ key: 'payment', label: 'Payment discipline', value: odPct === null ? '—' : `${odPct}% overdue${dso !== null ? ` · DSO ${dso > 365 ? '365+' : dso} d` : ''}`, score: odPct === null ? null : clamp(100 - odPct), hint: a ? `${inrS(a.overdue)} overdue of ${inrS(a.outstanding)}` : 'No invoices tracked' });
    // Data discipline: months with an accepted report out of the last 6 (live feeds count once a month).
    const setup = setupOf(p.id);
    const reported = months6.filter((m) => secReports(principalId).some((r) => r.partnerId === p.id && r.period === m && r.status === 'Accepted'));
    // Months expected: since the partner's first report (at most 6) — a partner connected last month isn't marked down for before.
    const first = secReports(principalId).filter((r) => r.partnerId === p.id).map((r) => r.period).sort()[0];
    const expected = first ? Math.max(1, months6.filter((m) => m >= first).length) : 6;
    const got = reported.length;
    const dataPct = setup.route === 'none' ? null : Math.round((got / expected) * 100);
    metrics.push({ key: 'data', label: 'Reporting on time', value: dataPct === null ? 'Not connected' : `${got}/${expected} month${expected === 1 ? '' : 's'}`, score: dataPct, hint: setup.route === 'none' ? 'No stock and sales feed' : `${setup.cadence} via ${setup.route}` });
    // Claim ratio: claimed ÷ secondary sales (6 months).
    const sec6 = months6.reduce((x, m) => x + secondaryOf(principalId, p.id, m), 0);
    const claimed = cl.filter((x) => x.partnerId === p.id && months6.includes(x.period)).reduce((x, c2) => x + c2.claimedAmount, 0);
    const ratio = sec6 ? Math.round((claimed / sec6) * 1000) / 10 : null;
    metrics.push({ key: 'claims', label: 'Claim ratio', value: ratio === null ? '—' : `${ratio}%`, score: ratio === null ? null : clamp(100 - ratio * 5), hint: claimed ? `${inrS(claimed)} claimed on ${inrS(sec6)} sold` : 'No claims' });
    // Outlet coverage: customers billed in the last 30 days ÷ customers the partner sold to in the last 6 months.
    const from30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const rs6 = secReports(principalId).filter((r) => r.partnerId === p.id && r.status === 'Accepted' && months6.includes(r.period)).flatMap((r) => r.sales);
    const known = new Set(rs6.map((x) => `${x.customer}|${x.town}`)); const billed = new Set(rs6.filter((x) => x.date >= from30).map((x) => `${x.customer}|${x.town}`));
    const covPct = known.size ? Math.round((billed.size / known.size) * 100) : null;
    metrics.push({ key: 'coverage', label: 'Outlet coverage', value: covPct === null ? '—' : `${billed.size}/${known.size} outlets`, score: covPct, hint: known.size ? 'Customers billed in the last 30 days ÷ customers in 6 months' : 'No secondary sales' });
    // Claim accuracy: approved ÷ claimed, on decided claims of the last 6 months.
    const decided = cl.filter((x) => x.partnerId === p.id && months6.includes(x.period) && ['Approved', 'Partly approved', 'Settled', 'Rejected'].includes(x.status));
    const dClaimed = decided.reduce((x, c2) => x + c2.claimedAmount, 0); const dOk = decided.reduce((x, c2) => x + (c2.status === 'Rejected' ? 0 : c2.approvedAmount ?? 0), 0);
    const acc = dClaimed ? Math.round((dOk / dClaimed) * 100) : null;
    metrics.push({ key: 'accuracy', label: 'Claim accuracy', value: acc === null ? '—' : `${acc}%`, score: acc, hint: decided.length ? `${inrS(dOk)} approved of ${inrS(dClaimed)} claimed` : 'No decided claims' });
    const scored = metrics.filter((m) => m.score !== null && w[m.key] > 0);
    const wsum = scored.reduce((x, m) => x + w[m.key], 0);
    const score = wsum ? Math.round(scored.reduce((x, m) => x + (m.score as number) * w[m.key], 0) / wsum) : null;
    const grade: Scorecard['grade'] = score === null ? '—' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
    return { partnerId: p.id, name: p.name, score, grade, metrics, primary, secondary, targetPct: pct };
  }).sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
};

/** Demo targets for this month: partner targets at ~120% of what they did, and one territory target. */
export const ensurePerformanceDemo = (principalId: string, partners: PartnerLite[], territoryId: string | null, by: string) => {
  const d = db(); if (d.seeded.includes(principalId) || !partners.length) return;
  const m = thisMonth(); const add: Target[] = [];
  partners.slice(0, 5).forEach((p, i) => {
    const basis: Basis = i % 2 ? 'secondary' : 'primary';
    const done = basis === 'primary' ? primaryOf(principalId, p.id, m) : secondaryOf(principalId, p.id, m);
    // Some partners ahead of target, some behind — so the demo shows both.
    const factor = [0.85, 1.25, 0.95, 1.6, 1.15][i] ?? 1.2;
    add.push({ id: newId('tgt'), principalId, period: m, scope: 'partner', refId: p.id, basis, value: Math.max(10000, Math.round(((done > 0 ? done : 150000) * factor) / 10000) * 10000), createdBy: by });
  });
  if (territoryId) add.push({ id: newId('tgt'), principalId, period: m, scope: 'territory', refId: territoryId, basis: 'both', value: 2500000, createdBy: by, note: 'Quarter push' });
  commit({ ...d, targets: [...d.targets, ...add], seeded: [...d.seeded, principalId] });
};
