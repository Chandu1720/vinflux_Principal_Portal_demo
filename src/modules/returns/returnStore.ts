/**
 * Returns — goods coming back from partners and hospitals.
 *
 *   Requested ─► Approved ─► Pickup ─► Received ─► Inspected ─► Credited (closed)
 *        └► Rejected            (stock: partner → transit → company warehouse in Quarantine → Restock / Scrap / Return to manufacturer)
 *
 * Every line must trace to a delivered shipment (same batch / serial, not more than was delivered and not
 * already returned). Policy (per reason): return window, credit %, whether it can be restocked.
 * Requests that pass every check and are under the auto-approve value are approved at once; others need a
 * second person. Credit notes are recorded here; posting them to the partner ledger is the Finance phase.
 */
import type { Partner } from '../gtm-v2/types';
import type { Product } from '../../types/product.ts';
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { post } from '../inventory/stockStore';
import type { LocType } from '../inventory/stockStore';
import { allShipments, destinationOf, getOrder, minShelfDays, shipFromSource } from '../orders/orderStore';
import { erpMirror } from '../../platform/integrations/stockSync';
import type { OrderCtx } from '../orders/orderStore';

export type ReturnReason = 'Damaged in transit' | 'Wrong item sent' | 'Quality complaint' | 'Near expiry' | 'Expired' | 'Excess stock';
export const REASONS: ReturnReason[] = ['Damaged in transit', 'Wrong item sent', 'Quality complaint', 'Near expiry', 'Expired', 'Excess stock'];
export type ReturnStatus = 'Requested' | 'Approved' | 'Pickup' | 'Received' | 'Inspected' | 'Credited' | 'Rejected';
export const RETURN_FLOW: ReturnStatus[] = ['Requested', 'Approved', 'Pickup', 'Received', 'Inspected', 'Credited'];
export type Outcome = 'Restock' | 'Scrap' | 'Return to manufacturer';

export interface ReturnLine {
  id: string; orderId: string; orderCode: string; shipmentNo: string; deliveredAt: string;
  productId: string; variantSku: string | null; name: string; batch: string; serial: string | null; expiryDate: string | null;
  qty: number; reason: ReturnReason; unitValue: number; unitCost: number | null;
  /** Filled at inspection. */
  receivedQty: number | null; outcome: Outcome | null; note: string;
}
export interface ReturnRequest {
  id: string; no: string; principalId: string; partnerId: string; partnerName: string;
  /** Where the goods go back to (company warehouse of the original shipment). */
  toWarehouseId: string; toWarehouseName: string;
  lines: ReturnLine[]; status: ReturnStatus; checks: ReturnCheck[];
  requestedBy: string; requestedAt: string; approvedBy: string | null; rejectReason: string | null;
  pickup: { carrier: string; awb: string; at: string; eta: string } | null;
  receivedAt: string | null; inspectedBy: string | null;
  creditNote: { no: string; date: string; value: number; lines: { lineId: string; qty: number; pct: number; value: number }[] } | null;
  history: { at: string; by: string; action: string; note?: string }[];
}
export interface ReturnCheck { label: string; state: 'pass' | 'warn' | 'fail'; detail: string }

/* --------------------------------- Policy --------------------------------- */

export interface ReasonPolicy { windowDays: number; creditPct: number; restockable: boolean }
export interface ReturnPolicy { reasons: Record<ReturnReason, ReasonPolicy>; autoApproveUpTo: number; nearExpiryDays: number }
export const DEFAULT_POLICY: ReturnPolicy = {
  reasons: {
    'Damaged in transit': { windowDays: 7, creditPct: 100, restockable: false },
    'Wrong item sent': { windowDays: 15, creditPct: 100, restockable: true },
    'Quality complaint': { windowDays: 90, creditPct: 100, restockable: false },
    'Near expiry': { windowDays: 365, creditPct: 75, restockable: true },
    Expired: { windowDays: 120, creditPct: 50, restockable: false },
    'Excess stock': { windowDays: 30, creditPct: 90, restockable: true },
  },
  autoApproveUpTo: 25000,
  nearExpiryDays: 90,
};

/* ---------------------------------- Store ---------------------------------- */

interface Db { returns: ReturnRequest[]; seq: number; cnSeq: number; policy: ReturnPolicy }
let cache: Db | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.returns.v1');
const db = (): Db => (cache ??= loadJson<Db>(KEY(), { returns: [], seq: 100, cnSeq: 0, policy: DEFAULT_POLICY }));
const commit = (d: Db) => { cache = d; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeReturns = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const returns = () => db().returns;
export const getReturn = (id: string) => db().returns.find((r) => r.id === id) ?? null;
export const returnPolicy = () => db().policy;
export const savePolicy = (p: ReturnPolicy) => commit({ ...db(), policy: p });
const put = (r: ReturnRequest) => { const d = db(); commit({ ...d, returns: d.returns.some((x) => x.id === r.id) ? d.returns.map((x) => (x.id === r.id ? r : x)) : [r, ...d.returns] }); };
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const days = (from: string, to = now()) => Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);
const log = (r: ReturnRequest, by: string, action: string, note?: string): ReturnRequest => ({ ...r, history: [...r.history, { at: now(), by, action, note }] });
type Result = { ok: boolean; message: string; errors?: string[]; id?: string };

/* ------------------------- What a partner can return ------------------------- */

/** Delivered shipment lines to this partner, with what is still returnable. */
export const returnableFor = (partnerId: string, products: Product[]) => {
  const already = new Map<string, number>();
  returns().filter((r) => r.partnerId === partnerId && r.status !== 'Rejected').forEach((r) => r.lines.forEach((l) => {
    const k = `${l.shipmentNo}|${l.productId}|${l.batch}|${l.serial ?? ''}`;
    already.set(k, (already.get(k) ?? 0) + l.qty);
  }));
  return allShipments().filter((x) => x.order.partnerId === partnerId && x.shipment.deliveredAt).flatMap(({ order: o, shipment: sh }) => sh.allocations.map((a) => {
    const line = o.lines.find((l) => l.id === a.lineId);
    const k = `${sh.no}|${a.productId}|${a.batch}|${a.serial ?? ''}`;
    const p = products.find((x) => x.id === a.productId);
    return {
      key: k, orderId: o.id, orderCode: o.code, shipmentNo: sh.no, deliveredAt: sh.deliveredAt!, productId: a.productId, variantSku: a.variantSku,
      name: line?.name ?? p?.name ?? a.productId, batch: a.batch, serial: a.serial, expiryDate: a.expiryDate, delivered: a.qty, returnable: Math.max(0, a.qty - (already.get(k) ?? 0)),
      unitValue: Math.round((line?.netUnit ?? 0) * (1 + (line?.gstPct ?? 0) / 100)), unitCost: a.unitCost, shipFromId: o.shipFrom.id, shipFromName: o.shipFrom.name, shipFromType: o.shipFrom.locType,
    };
  })).filter((x) => x.returnable > 0);
};
export type Returnable = ReturnType<typeof returnableFor>[number];

/** Policy checks for a draft request. */
export const checkReturn = (lines: (Returnable & { qty: number; reason: ReturnReason })[], products: Product[]): ReturnCheck[] => {
  const pol = returnPolicy();
  const out: ReturnCheck[] = [];
  if (!lines.length) return [{ label: 'Lines', state: 'fail', detail: 'Choose at least one delivered item.' }];
  const over = lines.filter((l) => l.qty > l.returnable || l.qty <= 0);
  out.push({ label: 'Traced to our delivery', state: over.length ? 'fail' : 'pass', detail: over.length ? `More than delivered / already returned: ${over.map((l) => l.name).join(', ')}` : 'Every line matches a delivered shipment (batch / serial and quantity)' });
  const late = lines.filter((l) => days(l.deliveredAt) > pol.reasons[l.reason].windowDays);
  out.push({ label: 'Return window', state: late.length ? 'fail' : 'pass', detail: late.length ? late.map((l) => `${l.name}: delivered ${days(l.deliveredAt)} days ago, “${l.reason}” allows ${pol.reasons[l.reason].windowDays}`).join('; ') : 'All lines within the window for their reason' });
  const wrongExpiry = lines.filter((l) => {
    const d = l.expiryDate ? days(today(), l.expiryDate) : null;
    if (l.reason === 'Expired') return d === null || d >= 0;
    if (l.reason === 'Near expiry') return d === null || d < 0 || d > pol.nearExpiryDays;
    return false;
  });
  out.push({ label: 'Expiry matches the reason', state: wrongExpiry.length ? 'fail' : 'pass', detail: wrongExpiry.length ? wrongExpiry.map((l) => `${l.name} (${l.batch}) expires ${l.expiryDate ?? 'never'} — doesn’t fit “${l.reason}”`).join('; ') : 'Expiry dates fit the reasons given' });
  const serialised = lines.filter((l) => (products.find((p) => p.id === l.productId)?.trackingMode ?? '').includes('Serial') && !l.serial);
  if (serialised.length) out.push({ label: 'Serial numbers', state: 'fail', detail: `Serial-tracked items need their serial: ${serialised.map((l) => l.name).join(', ')}` });
  const value = lines.reduce((a, l) => a + l.qty * l.unitValue, 0);
  out.push({ label: 'Approval', state: value > pol.autoApproveUpTo ? 'warn' : 'pass', detail: value > pol.autoApproveUpTo ? `₹${value.toLocaleString('en-IN')} is above the auto-approve limit (₹${pol.autoApproveUpTo.toLocaleString('en-IN')}) — a second person approves` : `Auto-approved (up to ₹${pol.autoApproveUpTo.toLocaleString('en-IN')})` });
  if (lines.some((l) => l.reason === 'Quality complaint')) out.push({ label: 'Complaint', state: 'warn', detail: 'Quality complaint — the batch is held in Quarantine on receipt and should be logged for vigilance (Recall & Complaints phase).' });
  return out;
};

/* --------------------------------- Actions --------------------------------- */

export const createReturn = (principalId: string, partner: Pick<Partner, 'id' | 'name'>, picks: (Returnable & { qty: number; reason: ReturnReason })[], products: Product[], by: string): Result => {
  const checks = checkReturn(picks, products);
  const fails = checks.filter((c) => c.state === 'fail');
  if (fails.length) return { ok: false, message: 'The return doesn’t meet the policy.', errors: fails.map((c) => `${c.label}: ${c.detail}`) };
  const wh = new Set(picks.map((p) => p.shipFromId));
  if (wh.size > 1) return { ok: false, message: 'Items shipped from different locations go back as separate returns.', errors: ['Pick items from one ship-from location per return.'] };
  const d = db();
  const seq = d.seq + 1;
  const auto = !checks.some((c) => c.label === 'Approval' && c.state === 'warn');
  let r: ReturnRequest = {
    id: newId('ret'), no: `RET-26-${seq}`, principalId, partnerId: partner.id, partnerName: partner.name, toWarehouseId: picks[0].shipFromId, toWarehouseName: picks[0].shipFromName,
    lines: picks.map((p) => ({ id: newId('rl'), orderId: p.orderId, orderCode: p.orderCode, shipmentNo: p.shipmentNo, deliveredAt: p.deliveredAt, productId: p.productId, variantSku: p.variantSku, name: p.name,
      batch: p.batch, serial: p.serial, expiryDate: p.expiryDate, qty: p.qty, reason: p.reason, unitValue: p.unitValue, unitCost: p.unitCost, receivedQty: null, outcome: null, note: '' })),
    status: auto ? 'Approved' : 'Requested', checks, requestedBy: by, requestedAt: now(), approvedBy: auto ? 'Policy (auto)' : null, rejectReason: null,
    pickup: null, receivedAt: null, inspectedBy: null, creditNote: null, history: [{ at: now(), by, action: 'Return requested' }],
  };
  if (auto) r = log(r, 'System', 'Approved automatically — all checks passed, within the auto-approve limit');
  commit({ ...d, seq, returns: [r, ...d.returns] });
  return { ok: true, message: `${r.no} ${auto ? 'approved — schedule the pickup' : 'sent for approval'}.`, id: r.id };
};

export const approveReturn = (id: string, approve: boolean, note: string, by: string): Result => {
  const r = getReturn(id);
  if (!r || r.status !== 'Requested') return { ok: false, message: 'Only requested returns can be decided.' };
  if (r.requestedBy === by) return { ok: false, message: 'Maker-checker: someone other than the requester must decide.' };
  if (!approve && !note.trim()) return { ok: false, message: 'Give the reason — the partner sees it.' };
  put(log({ ...r, status: approve ? 'Approved' : 'Rejected', approvedBy: approve ? by : null, rejectReason: approve ? null : note }, by, approve ? 'Approved' : 'Rejected — partner notified', note || undefined));
  return { ok: true, message: `${r.no} ${approve ? 'approved' : 'rejected'}.` };
};

/** Pickup: the goods leave the partner (their stock goes down) and travel back. */
export const schedulePickup = (id: string, carrier: string, awb: string, etaDays: number, partners: Partner[], by: string): Result => {
  const r = getReturn(id);
  if (!r || r.status !== 'Approved') return { ok: false, message: 'Approve the return first.' };
  if (!carrier.trim() || !awb.trim()) return { ok: false, message: 'Carrier and AWB / LR are required.' };
  const order = getOrder(r.lines[0].orderId);
  const from = order ? destinationOf(order, partners) : null;
  const base = (l: ReturnLine) => ({ productId: l.productId, variantSku: l.variantSku, batch: l.batch, serial: l.serial, mfgDate: null, expiryDate: l.expiryDate, unitCost: l.unitCost, importId: null, by, refId: r.id, status: 'Available' as const });
  post(r.lines.flatMap((l) => [
    ...(from ? [{ ...base(l), type: 'RETURN' as const, locType: from as LocType, warehouseId: r.partnerId, bin: '', qty: -l.qty, source: `Return ${r.no} picked up` }] : []),
    { ...base(l), type: 'TRANSFER_IN' as const, locType: 'TRANSIT' as const, warehouseId: r.partnerId, bin: r.no, qty: l.qty, source: `Return ${r.no} in transit` },
  ]));
  const eta = new Date(Date.now() + etaDays * 86400000).toISOString().slice(0, 10);
  put(log({ ...r, status: 'Pickup', pickup: { carrier, awb, at: now(), eta } }, by, `Pickup booked — ${carrier} ${awb}`, from ? `Stock taken out of ${r.partnerName}` : 'Hospital sale — no partner stock to reduce'));
  return { ok: true, message: `${r.no}: pickup booked, ETA ${eta}.` };
};

/** Received at the warehouse: counted, held in Quarantine until inspected. */
export const receiveReturn = (id: string, counts: Record<string, number>, ctx: OrderCtx, by: string): Result => {
  const r = getReturn(id);
  if (!r || r.status !== 'Pickup') return { ok: false, message: 'Nothing in transit for this return.' };
  const errs = r.lines.filter((l) => (counts[l.id] ?? l.qty) < 0 || (counts[l.id] ?? l.qty) > l.qty).map((l) => `${l.name}: received must be 0–${l.qty}.`);
  if (errs.length) return { ok: false, message: 'Check the counts.', errors: errs };
  const order = getOrder(r.lines[0].orderId);
  const tracked = order ? shipFromSource(order, ctx) !== 'NONE' : true;
  const locType: LocType = order?.shipFrom.locType === 'CNF' ? 'CNF' : 'COMPANY';
  const base = (l: ReturnLine) => ({ productId: l.productId, variantSku: l.variantSku, batch: l.batch, serial: l.serial, mfgDate: null, expiryDate: l.expiryDate, unitCost: l.unitCost, importId: null, by, refId: r.id });
  post(r.lines.flatMap((l) => {
    const got = counts[l.id] ?? l.qty;
    return [
      { ...base(l), type: 'TRANSFER_OUT' as const, locType: 'TRANSIT' as const, warehouseId: r.partnerId, bin: r.no, qty: -l.qty, status: 'Available' as const, source: `Return ${r.no} arrived` },
      ...(tracked && got > 0 ? [{ ...base(l), type: 'RETURN' as const, locType, warehouseId: r.toWarehouseId, bin: 'RETURNS', qty: got, status: 'Quarantine' as const, source: `Return ${r.no} — awaiting inspection` }] : []),
    ];
  }));
  if (tracked && locType === 'COMPANY') erpMirror(r.toWarehouseId, r.lines.map((l) => ({ ...l, qty: counts[l.id] ?? l.qty, status: 'Quarantine' as const })), { warehouses: ctx.warehouses ?? [] });
  const short = r.lines.filter((l) => (counts[l.id] ?? l.qty) < l.qty);
  put(log({ ...r, status: 'Received', receivedAt: now(), lines: r.lines.map((l) => ({ ...l, receivedQty: counts[l.id] ?? l.qty })) }, by, `Received at ${r.toWarehouseName} — held in Quarantine`, short.length ? `Short: ${short.map((l) => `${l.name} ${l.qty - (counts[l.id] ?? l.qty)}`).join(', ')} (claim with the carrier)` : undefined));
  return { ok: true, message: `${r.no} received — inspect it next.` };
};

/** Returns check: each line restocked, scrapped or sent back to the manufacturer. */
export const inspectReturn = (id: string, decisions: Record<string, { outcome: Outcome; note: string }>, ctx: OrderCtx, by: string): Result => {
  const r = getReturn(id);
  if (!r || r.status !== 'Received') return { ok: false, message: 'Receive the return first.' };
  const pol = returnPolicy();
  const errs: string[] = [];
  r.lines.forEach((l) => {
    const d = decisions[l.id];
    if (!d) { errs.push(`${l.name}: choose restock, scrap or return to manufacturer.`); return; }
    if (d.outcome === 'Restock') {
      if (!pol.reasons[l.reason].restockable) errs.push(`${l.name}: “${l.reason}” can’t go back to sellable stock.`);
      const p = ctx.products.find((x) => x.id === l.productId);
      const left = l.expiryDate ? days(today(), l.expiryDate) : Infinity;
      if (left < minShelfDays(p, false)) errs.push(`${l.name}: only ${left} days of shelf life left — below the ${minShelfDays(p, false)} days needed to sell again.`);
    }
    if (d.outcome !== 'Restock' && !d.note.trim()) errs.push(`${l.name}: add a note (what was wrong / RTM reference).`);
  });
  if (errs.length) return { ok: false, message: 'Can’t complete the check.', errors: errs };
  const order = getOrder(r.lines[0].orderId);
  const tracked = order ? shipFromSource(order, ctx) !== 'NONE' : true;
  const locType: LocType = order?.shipFrom.locType === 'CNF' ? 'CNF' : 'COMPANY';
  if (tracked) post(r.lines.filter((l) => (l.receivedQty ?? 0) > 0).flatMap((l) => {
    const d = decisions[l.id];
    const base = { locType, warehouseId: r.toWarehouseId, productId: l.productId, variantSku: l.variantSku, batch: l.batch, serial: l.serial, mfgDate: null, expiryDate: l.expiryDate, unitCost: l.unitCost, importId: null, by, refId: r.id };
    const q = l.receivedQty ?? 0;
    const type = d.outcome === 'Restock' ? 'RETURN' as const : d.outcome === 'Scrap' ? 'SCRAP' as const : 'RTM' as const;
    const out = [{ ...base, type, bin: 'RETURNS', qty: -q, status: 'Quarantine' as 'Quarantine' | 'Available', source: `Return ${r.no} — ${d.outcome.toLowerCase()}` }];
    if (d.outcome === 'Restock') out.push({ ...base, type: 'RETURN', bin: '', qty: q, status: 'Available', source: `Return ${r.no} — restocked` });
    return out;
  }));
  if (tracked && locType === 'COMPANY') erpMirror(r.toWarehouseId, r.lines.filter((l) => (l.receivedQty ?? 0) > 0).flatMap((l) => [
    { ...l, qty: -(l.receivedQty ?? 0), status: 'Quarantine' as const },
    ...(decisions[l.id].outcome === 'Restock' ? [{ ...l, qty: l.receivedQty ?? 0, status: 'Available' as const }] : []),
  ]), { warehouses: ctx.warehouses ?? [] });
  put(log({ ...r, status: 'Inspected', inspectedBy: by, lines: r.lines.map((l) => ({ ...l, outcome: decisions[l.id].outcome, note: decisions[l.id].note })) }, by, 'Returns check done',
    r.lines.map((l) => `${l.name}: ${decisions[l.id].outcome}`).join('; ')));
  emit('stock.received', 'Returns', by, `${r.no} inspected at ${r.toWarehouseName}`, { returnId: r.id });
  return { ok: true, message: `${r.no} inspected — issue the credit note.` };
};

/** Credit note: received quantity × value × credit % for the reason. */
export const creditPreview = (r: ReturnRequest) => {
  const pol = returnPolicy();
  return r.lines.map((l) => { const qty = l.receivedQty ?? l.qty; const pct = pol.reasons[l.reason].creditPct; return { lineId: l.id, qty, pct, value: Math.round(qty * l.unitValue * pct / 100) }; });
};
export const issueCreditNote = (id: string, by: string): Result => {
  const r = getReturn(id);
  if (!r || r.status !== 'Inspected') return { ok: false, message: 'Inspect the return first.' };
  const d = db();
  const n = d.cnSeq + 1;
  const lines = creditPreview(r);
  const value = lines.reduce((a, l) => a + l.value, 0);
  const cn = { no: `CN-26-${String(n).padStart(4, '0')}`, date: today(), value, lines };
  const next = log({ ...r, status: 'Credited', creditNote: cn }, by, `Credit note ${cn.no} — ₹${value.toLocaleString('en-IN')}`, `${r.partnerName} notified`);
  commit({ ...d, cnSeq: n, returns: d.returns.map((x) => (x.id === r.id ? next : x)) });
  return { ok: true, message: `${cn.no} issued for ₹${value.toLocaleString('en-IN')}.` };
};

/** Demo data (once per workspace): returns from the delivered Yashoda order, at different stages. */
export const ensureReturnsDemo = (ctx: OrderCtx, principalId: string) => {
  const k = workspaceKey('vinflux.returnsSeeded.v1');
  if (loadJson<boolean>(k, false)) return;
  const p = ctx.partners.find((x) => x.id === 'ptr-hosp-hyd');
  const rows = p ? returnableFor(p.id, ctx.products).filter((r) => !r.serial && r.returnable >= 4) : [];
  if (!p || !rows.length) return;
  saveJson(k, true);
  const r0 = rows[0];
  const a = createReturn(principalId, p, [{ ...r0, qty: 2, reason: 'Damaged in transit' }], ctx.products, 'Ravi Kumar');
  if (a.id) { schedulePickup(a.id, 'Blue Dart', 'BD-RV-440187', 2, ctx.partners, 'Suresh Reddy'); receiveReturn(a.id, {}, ctx, 'Suresh Reddy'); }
  createReturn(principalId, p, [{ ...r0, qty: Math.min(r0.returnable - 2, 8), returnable: r0.returnable - 2, reason: 'Excess stock' }], ctx.products, 'Ravi Kumar');
};
