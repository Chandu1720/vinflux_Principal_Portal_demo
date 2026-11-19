/**
 * Production link (SU3) — for principals that make products in their own plant. Production stays in the ERP; VinFlux
 * reads only the finished output, its batches and the quality release.
 * PRL-01 Finished-goods receipts (product, batch / serials, mfg and expiry, quantity, location) are read from the ERP.
 * PRL-02 A batch becomes sellable only after the ERP's quality release — or VinFlux's own QC where the principal chooses
 *        (then a QC approver other than whoever pulled the receipt releases it).
 * PRL-03 Planned production (product, quantity, expected date) is read as expected supply — never available to promise.
 * PRL-04 Recall trace-back stops at the production batch; raw-material lots stay in the ERP.
 * On release, backorders waiting for that product are released as new linked orders (ORD-03).
 * INTEGRATION POINT: list_production_receipts / list_production_plans / get_quality_release on the ERP connector.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import type { Product } from '../../types/product.ts';
import { post } from '../inventory/stockStore';
import { notErp } from '../inventory/stockSource';
import { orders, releaseBackorder } from '../orders/orderStore';
import type { OrderCtx } from '../orders/orderStore';

export type ReleaseBy = 'erp' | 'vinflux';
export type ReceiptStatus = 'In Quarantine' | 'Released' | 'Rejected';
export interface ProdReceipt {
  id: string; no: string; principalId: string; erpRef: string; plant: string; productId: string; productName: string; batch: string; serials: string[];
  mfgDate: string; expiry: string | null; qty: number; warehouseId: string; warehouseName: string; stockPosted: boolean;
  status: ReceiptStatus; erpQc: 'Pending' | 'Released' | 'Rejected'; pulledBy: string; pulledAt: string;
  releasedBy: string | null; releasedAt: string | null; releaseSource: 'ERP QC' | 'VinFlux QC' | null; reason: string | null; backorders: string[];
}
export interface ProdPlan { id: string; principalId: string; erpRef: string; productId: string; productName: string; qty: number; expected: string; warehouseId: string; status: 'Planned' | 'In progress' | 'Done' }
interface Settings { releaseBy: ReleaseBy; erpName: string; plant: string }
interface Db { receipts: ProdReceipt[]; plans: ProdPlan[]; settings: Settings; seq: number; seeded: string[]; pulls: number }

const now = () => new Date().toISOString();
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const KEY = () => workspaceKey('vinflux.production.v1');
const EMPTY: Db = { receipts: [], plans: [], settings: { releaseBy: 'erp', erpName: 'SAP S/4HANA', plant: 'Medchal plant (1000)' }, seq: 900, seeded: [], pulls: 0 };
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) {
    const x = loadJson<Partial<Db> | null>(KEY(), null);
    cache = { key: KEY(), d: { ...EMPTY, ...(x ?? {}), settings: { ...EMPTY.settings, ...(x?.settings ?? {}) }, receipts: Array.isArray(x?.receipts) ? x!.receipts : [], plans: Array.isArray(x?.plans) ? x!.plans : [], seeded: Array.isArray(x?.seeded) ? x!.seeded : [] } };
  }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeProduction = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
type R = { ok: boolean; message: string; errors?: string[] };

export const prodSettings = () => db().settings;
export const saveProdSettings = (s: Settings) => commit({ ...db(), settings: s });
export const receipts = (principalId: string) => db().receipts.filter((r) => r.principalId === principalId);
export const plans = (principalId: string) => db().plans.filter((p) => p.principalId === principalId);
export const getReceipt = (id: string) => db().receipts.find((r) => r.id === id) ?? null;
/** PRL-03: planned and in-progress production, shown as expected supply (never available to promise). */
export const expectedSupply = (principalId: string) => plans(principalId).filter((p) => p.status !== 'Done');

const stockRow = (r: ProdReceipt, qty: number, status: 'Quarantine' | 'Available' | 'Blocked', serial: string | null, source: string, by: string, unitCost: number | null) => ({
  type: 'RECEIPT' as const, locType: 'COMPANY' as const, warehouseId: r.warehouseId, bin: status === 'Quarantine' ? 'QC' : 'MAIN', productId: r.productId, variantSku: null, batch: r.batch, serial,
  mfgDate: r.mfgDate, expiryDate: r.expiry, qty, unitCost, status, importId: null, source, by, refId: r.id,
});
/** Move a receipt's stock between statuses (only when VinFlux keeps the warehouse's stock). */
const move = (r: ProdReceipt, from: 'Quarantine', to: 'Available' | 'Blocked', by: string, why: string) => {
  if (!r.stockPosted) return;
  const units = r.serials.length ? r.serials.map((s) => ({ s, q: 1 })) : [{ s: null as string | null, q: r.qty }];
  post(units.flatMap((u) => [{ ...stockRow(r, -u.q, from, u.s, why, by, null), type: 'ADJUSTMENT' as const }, { ...stockRow(r, u.q, to, u.s, why, by, null), type: 'ADJUSTMENT' as const }]));
};

/**
 * PRL-01: read new finished-goods receipts and the latest plan from the ERP (sandbox: generated). Each receipt lands in
 * Quarantine; the ERP's QC status comes with it.
 */
export const pullFromErp = (principalId: string, products: Product[], warehouses: { id: string; name: string }[], by: string): R => {
  const d = db(); const s = d.settings; const wh = warehouses[0];
  const made = products.filter((p) => p.lifecycleStatus === 'Active').slice(0, 3);
  if (!made.length || !wh) return { ok: false, message: 'No active products or warehouse to receive into.' };
  const pull = d.pulls + 1; let seq = d.seq;
  const p = made[pull % made.length];
  const serialised = (p.trackingRules?.mode ?? p.trackingMode ?? '').includes('Serial');
  const qty = serialised ? 6 : 120; const batch = `PB${new Date().toISOString().slice(2, 4)}${String(40 + pull).padStart(3, '0')}`;
  const r: ProdReceipt = {
    id: newId('prd'), no: `PR-26-${++seq}`, principalId, erpRef: `${s.erpName.split(' ')[0]} PRD ${1000230 + pull}`, plant: s.plant, productId: p.id, productName: p.name, batch,
    serials: serialised ? Array.from({ length: qty }, (_, i) => `${batch}-${String(i + 1).padStart(3, '0')}`) : [], mfgDate: day(-1), expiry: day(365 * 3), qty,
    warehouseId: wh.id, warehouseName: wh.name, stockPosted: notErp(wh.id), status: 'In Quarantine', erpQc: 'Pending', pulledBy: by, pulledAt: now(),
    releasedBy: null, releasedAt: null, releaseSource: null, reason: null, backorders: [],
  };
  if (r.stockPosted) post(r.serials.length ? r.serials.map((sn) => stockRow(r, 1, 'Quarantine', sn, `Production ${r.erpRef}`, by, p.pricingReference?.standardCost ?? null)) : [stockRow(r, qty, 'Quarantine', null, `Production ${r.erpRef}`, by, p.pricingReference?.standardCost ?? null)]);
  // Refresh the plan: the receipt fulfils the oldest open plan for this product.
  const planId = d.plans.find((x) => x.principalId === principalId && x.productId === p.id && x.status !== 'Done')?.id;
  commit({ ...d, seq, pulls: pull, receipts: [r, ...d.receipts], plans: d.plans.map((x) => (x.id === planId ? { ...x, status: 'Done' as const } : x)) });
  emit('stock.received', 'Production', by, `${r.no}: ${qty} × ${p.name} from ${s.plant} (in Quarantine)`, { receiptId: r.id });
  return { ok: true, message: `${r.no} read from ${s.erpName}: ${qty} × ${p.name}, batch ${batch} — in Quarantine until ${s.releaseBy === 'erp' ? `${s.erpName} releases it` : 'a QC approver releases it'}.` };
};

const afterRelease = (r: ProdReceipt, by: string, ctx: OrderCtx | null): string[] => {
  // ORD-03: release backorders waiting for this product.
  if (!ctx) return [];
  const waiting = orders().filter((o) => o.principalId === r.principalId && o.lines.some((l) => l.productId === r.productId && l.backorderQty > 0) && !['Cancelled', 'Rejected'].includes(o.status));
  const out: string[] = [];
  waiting.forEach((o) => { const x = releaseBackorder(o.id, ctx, by); if (x.ok) out.push(x.message.replace('Backorder released as ', '').replace('.', '')); });
  return out;
};

/** PRL-02 (ERP mode): read the ERP's quality decision for receipts still in Quarantine. */
export const syncErpRelease = (principalId: string, by: string, ctx: OrderCtx | null, rejectBatch?: string): R => {
  const d = db(); if (d.settings.releaseBy !== 'erp') return { ok: false, message: 'Release is done in VinFlux QC (Settings).' };
  const open = d.receipts.filter((r) => r.principalId === principalId && r.status === 'In Quarantine');
  if (!open.length) return { ok: true, message: `Nothing waiting for ${d.settings.erpName}'s release.` };
  const done: string[] = [];
  open.forEach((r0) => {
    const reject = r0.batch === rejectBatch;
    const r = { ...r0, erpQc: reject ? 'Rejected' as const : 'Released' as const, status: reject ? 'Rejected' as const : 'Released' as const, releasedBy: `${d.settings.erpName} QC`, releasedAt: now(), releaseSource: 'ERP QC' as const, reason: reject ? 'Rejected in ERP QC' : null };
    move(r, 'Quarantine', reject ? 'Blocked' : 'Available', by, `${d.settings.erpName} quality ${reject ? 'rejection' : 'release'} — ${r.erpRef}`);
    cache = { key: KEY(), d: { ...db(), receipts: db().receipts.map((x) => (x.id === r.id ? r : x)) } }; saveJson(KEY(), cache.d);
    const bo = reject ? [] : afterRelease(r, by, ctx);
    cache = { key: KEY(), d: { ...db(), receipts: db().receipts.map((x) => (x.id === r.id ? { ...r, backorders: bo } : x)) } }; saveJson(KEY(), cache.d);
    done.push(`${r.no} ${reject ? 'rejected' : 'released'}${bo.length ? ` (backorders → ${bo.join(', ')})` : ''}`);
  });
  listeners.forEach((l) => l());
  return { ok: true, message: `${d.settings.erpName}: ${done.join('; ')}.` };
};

/** PRL-02 (VinFlux mode): a QC approver releases or rejects; never the person who pulled the receipt. */
export const decide = (id: string, accept: boolean, reason: string, by: string, ctx: OrderCtx | null): R => {
  const r = getReceipt(id); if (!r || r.status !== 'In Quarantine') return { ok: false, message: 'Not in Quarantine.' };
  if (db().settings.releaseBy !== 'vinflux') return { ok: false, message: `Release comes from ${db().settings.erpName} — use “Read ERP release”.` };
  if (r.pulledBy === by) return { ok: false, message: 'Maker-checker: you brought this receipt in, so another QC approver must release it.' };
  if (!accept && !reason.trim()) return { ok: false, message: 'Give the rejection reason.' };
  const next: ProdReceipt = { ...r, status: accept ? 'Released' : 'Rejected', releasedBy: by, releasedAt: now(), releaseSource: 'VinFlux QC', reason: accept ? null : reason };
  move(next, 'Quarantine', accept ? 'Available' : 'Blocked', by, `QC ${accept ? 'release' : 'rejection'} — ${r.no}`);
  commit({ ...db(), receipts: db().receipts.map((x) => (x.id === id ? next : x)) });
  const bo = accept ? afterRelease(next, by, ctx) : [];
  if (bo.length) commit({ ...db(), receipts: db().receipts.map((x) => (x.id === id ? { ...next, backorders: bo } : x)) });
  emit('qc.released', 'Production', by, `${r.no} ${accept ? 'released' : 'rejected'}`, { receiptId: r.id });
  return { ok: true, message: `${r.no} ${accept ? 'released — now sellable' : 'rejected — blocked'}${bo.length ? `; backorders released as ${bo.join(', ')}` : ''}.` };
};

export const ensureProductionDemo = (principalId: string, products: Product[], warehouses: { id: string; name: string }[]) => {
  const d = db(); if (d.seeded.includes(principalId) || !products.length || !warehouses.length) return;
  const made = products.filter((p) => p.lifecycleStatus === 'Active').slice(0, 3);
  const plansNew: ProdPlan[] = made.map((p, i) => ({ id: newId('ppl'), principalId, erpRef: `${d.settings.erpName.split(' ')[0]} PLN ${5500 + i}`, productId: p.id, productName: p.name, qty: [80, 12, 400][i] ?? 50, expected: day(4 + i * 6), warehouseId: warehouses[0].id, status: i === 0 ? 'In progress' : 'Planned' }));
  commit({ ...d, plans: [...d.plans, ...plansNew], seeded: [...d.seeded, principalId] });
  pullFromErp(principalId, products, warehouses, 'ERP sync');
};
