/**
 * Stock source per company warehouse — who is the master of the stock book.
 *
 *   ERP      the ERP (connector sync or file import) owns stock; VinFlux mirrors it, reserves, and the ERP invoice is final.
 *   VINFLUX  VinFlux owns stock: goods receipts, approved adjustments and invoices are recorded here.
 *   NONE     orders only: stock is not tracked; batch / serial are typed in at shipment.
 *
 * Each warehouse can follow the principal default ('AUTO' = ERP when a connector feeds it, otherwise VinFlux).
 * C&F, partner and hospital stock is always kept in VinFlux.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { balances, post } from './stockStore';

export type StockSource = 'ERP' | 'VINFLUX' | 'NONE';
export type SourceSetting = StockSource | 'AUTO';
export const SOURCE_LABEL: Record<StockSource, string> = { ERP: 'ERP is master', VINFLUX: 'VinFlux is master', NONE: 'Orders only (no stock)' };
export const SOURCE_HINT: Record<StockSource, string> = {
  ERP: 'Stock comes from the ERP (sync or Excel import). VinFlux reserves; the ERP invoice is final.',
  VINFLUX: 'Goods receipts, adjustments and invoices are recorded in VinFlux. Stock never goes negative.',
  NONE: 'Stock is not tracked. Orders are confirmed on partner and credit checks; batch / serial are typed in at shipment.',
};

/* --------------------------------- Settings --------------------------------- */

interface Settings { defaultSource: SourceSetting; perWarehouse: Record<string, SourceSetting>; staleHours: number }
let cache: Settings | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.stockSource.v1');
export const sourceSettings = (): Settings => (cache ??= loadJson<Settings>(KEY(), { defaultSource: 'AUTO', perWarehouse: {}, staleHours: 6 }));
const commit = (s: Settings) => { cache = s; saveJson(KEY(), s); listeners.forEach((l) => l()); };
export const subscribeSource = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const setDefaultSource = (s: SourceSetting) => commit({ ...sourceSettings(), defaultSource: s });
export const setWarehouseSource = (warehouseId: string, s: SourceSetting | null) => {
  const per = { ...sourceSettings().perWarehouse };
  if (s === null) delete per[warehouseId]; else per[warehouseId] = s;
  commit({ ...sourceSettings(), perWarehouse: per });
};
export const setStaleHours = (h: number) => commit({ ...sourceSettings(), staleHours: Math.max(1, h) });

/** The setting that applies to a warehouse (its own, else the default). */
export const settingOf = (warehouseId: string): SourceSetting => sourceSettings().perWarehouse[warehouseId] ?? sourceSettings().defaultSource;
/** Resolve the effective source; `hasConnector` = an ERP connector feeds this warehouse. */
export const resolveSource = (warehouseId: string, hasConnector: boolean): StockSource => {
  const s = settingOf(warehouseId);
  return s === 'AUTO' ? (hasConnector ? 'ERP' : 'VINFLUX') : s;
};
/** Explicitly taken out of ERP control (a connector must not overwrite it). */
export const notErp = (warehouseId: string) => { const s = settingOf(warehouseId); return s === 'VINFLUX' || s === 'NONE'; };

/* ------------------------- Goods receipts (VinFlux master) ------------------------- */

export interface ReceiptInput {
  warehouseId: string; productId: string; variantSku: string | null; batch: string; serials: string[]; mfgDate: string | null; expiryDate: string | null;
  qty: number; unitCost: number | null; from: 'Production' | 'Purchase' | 'Import' | 'Return to stock' | 'Opening'; reference: string;
}
let grnSeq = 0;
export const goodsReceipt = (r: ReceiptInput, serialTracked: boolean, by: string): { ok: boolean; message: string; errors?: string[] } => {
  const errs: string[] = [];
  if (!r.warehouseId) errs.push('Choose the warehouse.');
  if (!r.productId) errs.push('Choose the product.');
  if (!r.batch.trim()) errs.push('Batch / lot is required.');
  if (r.mfgDate && r.expiryDate && r.expiryDate <= r.mfgDate) errs.push('Expiry must be after the manufacturing date.');
  if (r.expiryDate && r.expiryDate <= new Date().toISOString().slice(0, 10)) errs.push('This batch has already expired — it can’t be received as sellable stock.');
  const serials = r.serials.map((s) => s.trim()).filter(Boolean);
  if (serialTracked) {
    if (serials.length !== r.qty) errs.push(`Serial-tracked product: enter ${r.qty} serial number(s), one per unit (you entered ${serials.length}).`);
    if (new Set(serials).size !== serials.length) errs.push('Serial numbers repeat.');
    const inStock = new Set(balances().filter((b) => b.productId === r.productId && b.serial && b.qty > 0).map((b) => b.serial));
    const dup = serials.filter((s) => inStock.has(s));
    if (dup.length) errs.push(`Already in stock somewhere: ${dup.join(', ')}.`);
  }
  if (!(r.qty > 0)) errs.push('Quantity must be more than 0.');
  if (errs.length) return { ok: false, message: 'Can’t record the receipt.', errors: errs };
  const no = `GRN-26-${String(4000 + (++grnSeq) + Math.floor(Date.now() / 1000) % 1000).slice(-4)}`;
  const base = { type: 'RECEIPT' as const, locType: 'COMPANY' as const, warehouseId: r.warehouseId, bin: 'MAIN', productId: r.productId, variantSku: r.variantSku, batch: r.batch.trim(),
    mfgDate: r.mfgDate, expiryDate: r.expiryDate, unitCost: r.unitCost, status: 'Available' as const, importId: null, source: `${no} · ${r.from}${r.reference ? ` · ${r.reference}` : ''}`, by, refId: no };
  post(serialTracked ? serials.map((s) => ({ ...base, serial: s, qty: 1 })) : [{ ...base, serial: null, qty: r.qty }]);
  return { ok: true, message: `${no} recorded — ${r.qty} unit(s) available to sell.` };
};

/* --------------------- Stock adjustments (maker-checker) --------------------- */

export interface Adjustment {
  id: string; no: string; warehouseId: string; productId: string; variantSku: string | null; batch: string; serial: string | null; bin: string;
  expiryDate: string | null; mfgDate: string | null; unitCost: number | null;
  delta: number; reason: 'Count difference' | 'Damaged in warehouse' | 'Expired — written off' | 'Found' | 'Other'; note: string;
  requestedBy: string; requestedAt: string; status: 'Pending' | 'Approved' | 'Rejected'; decidedBy: string | null; decidedAt: string | null;
}
const AKEY = () => workspaceKey('vinflux.stockAdjust.v1');
let aCache: Adjustment[] | null = null;
export const adjustments = (): Adjustment[] => (aCache ??= loadJson<Adjustment[]>(AKEY(), []));
const aCommit = (a: Adjustment[]) => { aCache = a; saveJson(AKEY(), a); listeners.forEach((l) => l()); };

export const requestAdjustment = (a: Omit<Adjustment, 'id' | 'no' | 'requestedAt' | 'status' | 'decidedBy' | 'decidedAt'>): { ok: boolean; message: string } => {
  if (!a.delta) return { ok: false, message: 'Enter the change (+ found, − missing).' };
  if (a.reason === 'Other' && !a.note.trim()) return { ok: false, message: 'Explain the adjustment.' };
  const onHand = balances().filter((b) => b.warehouseId === a.warehouseId && b.productId === a.productId && b.batch === a.batch && (b.serial ?? null) === (a.serial ?? null) && b.status === 'Available').reduce((s, b) => s + b.qty, 0);
  if (a.delta < 0 && -a.delta > onHand) return { ok: false, message: `Only ${onHand} on hand — stock can’t go negative.` };
  const no = `ADJ-26-${String(adjustments().length + 101)}`;
  aCommit([{ ...a, id: newId('adj'), no, requestedAt: new Date().toISOString(), status: 'Pending', decidedBy: null, decidedAt: null }, ...adjustments()]);
  return { ok: true, message: `${no} sent for approval.` };
};
export const decideAdjustment = (id: string, approve: boolean, by: string): { ok: boolean; message: string } => {
  const a = adjustments().find((x) => x.id === id);
  if (!a || a.status !== 'Pending') return { ok: false, message: 'Already decided.' };
  if (a.requestedBy === by) return { ok: false, message: 'Maker-checker: someone other than the requester must approve.' };
  if (approve) {
    const onHand = balances().filter((b) => b.warehouseId === a.warehouseId && b.productId === a.productId && b.batch === a.batch && (b.serial ?? null) === (a.serial ?? null) && b.status === 'Available').reduce((s, b) => s + b.qty, 0);
    if (a.delta < 0 && -a.delta > onHand) return { ok: false, message: `Only ${onHand} on hand now — reject and raise a new adjustment.` };
    post([{ type: 'ADJUSTMENT', locType: 'COMPANY', warehouseId: a.warehouseId, bin: a.bin, productId: a.productId, variantSku: a.variantSku, batch: a.batch, serial: a.serial, mfgDate: a.mfgDate, expiryDate: a.expiryDate,
      qty: a.delta, unitCost: a.unitCost, status: 'Available', importId: null, source: `${a.no} · ${a.reason}${a.note ? ` · ${a.note}` : ''}`, by, refId: a.no }]);
  }
  aCommit(adjustments().map((x) => (x.id === id ? { ...x, status: approve ? 'Approved' : 'Rejected', decidedBy: by, decidedAt: new Date().toISOString() } : x)));
  return { ok: true, message: `${a.no} ${approve ? 'approved — stock updated' : 'rejected'}.` };
};
