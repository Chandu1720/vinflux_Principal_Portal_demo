/**
 * Imports (SU1): goods made abroad — by the principal's own plant or a supplier — from dispatch to customs to receipt.
 *
 *   Booked ─► Departed ─► Arrived at port ─► Cleared (bill of entry filed) ─► Received (GRN into Quarantine at landed cost)
 *
 * Rules
 *   IMS-01 A shipment can't be received until its bill of entry is recorded (customs cleared).
 *   IMS-02 Batches and serials on the packing list are carried to the goods receipt.
 *   IMS-03 Landed cost is calculated at receipt and stored with the batch; the exchange rate used is kept.
 *   IMS-04 An expired import licence (or registration) blocks clearance for every product on the shipment.
 *   IMS-05 Status is visible as expected supply (ETA by product).
 *   IMT-01 A provisional landed cost is used until every cost document is in; finalising records the difference.
 * Landed cost = FOB in INR + freight + insurance + basic customs duty + social welfare surcharge + clearing + local transport,
 * spread over lines by value. IGST paid at import is input tax credit, not cost.
 * INTEGRATION POINT: ICEGATE bill-of-entry status, freight forwarder tracking (status events), ERP landed-cost posting.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { acknowledgePO, approvePO, createPO, getPO, getVendor, pos as procPos, receive, submitPO, vendorItems, vendors as procVendors } from '../procurement/procurementStore';
import type { PurchaseOrder } from '../procurement/procurementStore';

export type ShipStatus = 'Booked' | 'Departed' | 'Arrived at port' | 'Cleared' | 'Received';
export const FLOW: ShipStatus[] = ['Booked', 'Departed', 'Arrived at port', 'Cleared', 'Received'];
export type Mode = 'Sea' | 'Air' | 'Courier';
export const DOC_TYPES = ['Commercial invoice', 'Packing list', 'Bill of lading / airway bill', 'Certificate of origin', 'Manufacturer’s certificate (CoA / CE)', 'Insurance certificate'];
export interface ShipLine { poId: string; lineId: string; productId: string; name: string; qty: number; batch: string; expiry: string | null; serials: string[]; fobUnit: number }
export interface Customs { boeNo: string; boeDate: string; bcdPct: number; swsPct: number; igstPct: number }
export interface Costs { freight: number; insurance: number; clearing: number; localTransport: number; other: number }
export interface Shipment {
  id: string; no: string; principalId: string; vendorId: string; vendorName: string; poIds: string[]; currency: string; fxRate: number;
  mode: Mode; incoterm: string; blAwb: string; container: string; port: string; clearingAgent: string; etd: string; eta: string;
  status: ShipStatus; events: { status: ShipStatus; at: string; by: string }[]; docs: { type: string; ref: string }[];
  lines: ShipLine[]; customs: Customs | null; costs: Costs; costsFinal: boolean; landedAtReceipt: Record<string, number> | null; grnNo: string | null;
  history: { at: string; by: string; action: string; note?: string }[];
}

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

interface Db { shipments: Shipment[]; seq: number; seeded: string[] }
const KEY = () => workspaceKey('vinflux.import-shipments.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: (() => { const x = loadJson<Partial<Db> | null>(KEY(), null); return { shipments: Array.isArray(x?.shipments) ? x!.shipments : [], seq: x?.seq ?? 300, seeded: Array.isArray(x?.seeded) ? x!.seeded : [] }; })() }; return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeImports = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const shipments = (principalId: string) => db().shipments.filter((s) => s.principalId === principalId);
export const getShipment = (id: string) => db().shipments.find((s) => s.id === id) ?? null;
type Result = { ok: boolean; message: string; id?: string; errors?: string[] };
const put = (s: Shipment) => commit({ ...db(), shipments: db().shipments.map((x) => (x.id === s.id ? s : x)) });
const log = (s: Shipment, by: string, action: string, note?: string): Shipment => ({ ...s, history: [...s.history, { at: now(), by, action, note }] });

/* ------------------------------------ Shipments ------------------------------------ */

/** Overseas POs with quantity not yet on a shipment. */
export const importablePOs = (principalId: string) => procPos(principalId).filter((p) => getVendor(p.vendorId)?.kind === 'Overseas supplier' && ['Sent', 'Acknowledged', 'Part received'].includes(p.status)).filter((p) => p.lines.some((l) => openToShip(p, l.id) > 0));
export const openToShip = (p: PurchaseOrder, lineId: string) => {
  const l = p.lines.find((x) => x.id === lineId)!;
  const onShip = db().shipments.filter((s) => s.status !== 'Received').reduce((a, s) => a + s.lines.filter((x) => x.poId === p.id && x.lineId === lineId).reduce((q, x) => q + x.qty, 0), 0);
  return Math.max(0, l.qty - l.receivedQty - onShip);
};

export interface NewShipment { principalId: string; poIds: string[]; mode: Mode; incoterm: string; blAwb: string; container: string; port: string; clearingAgent: string; etd: string; eta: string; fxRate: number; lines: Omit<ShipLine, 'name' | 'fobUnit'>[] }
export const createShipment = (n: NewShipment, by: string): Result => {
  const errs: string[] = []; const ps = n.poIds.map(getPO).filter(Boolean) as PurchaseOrder[];
  if (!ps.length) errs.push('Choose the purchase order(s) on this shipment.');
  if (new Set(ps.map((p) => p.vendorId)).size > 1) errs.push('One shipment comes from one supplier.');
  if (!n.blAwb.trim()) errs.push(`${n.mode === 'Air' ? 'Airway bill' : n.mode === 'Sea' ? 'Bill of lading' : 'Tracking'} number is required.`);
  if (!n.etd || !n.eta || n.eta < n.etd) errs.push('Give departure and expected arrival dates (arrival after departure).');
  if (!(n.fxRate > 0)) errs.push('Enter the exchange rate.');
  const ls = n.lines.filter((l) => l.qty > 0);
  if (!ls.length) errs.push('Add the quantities on the packing list.');
  ls.forEach((l) => { const p = getPO(l.poId); if (p && l.qty > openToShip(p, l.lineId)) errs.push(`${p.lines.find((x) => x.id === l.lineId)?.name}: ${l.qty} is more than the ${openToShip(p, l.lineId)} still to ship.`); if (!l.batch.trim()) errs.push('Every packing-list line needs its batch (IMS-02).'); if (l.serials.length && l.serials.length !== l.qty) errs.push(`${p?.lines.find((x) => x.id === l.lineId)?.name}: ${l.serials.length} serial(s) for ${l.qty} unit(s).`); });
  if (errs.length) return { ok: false, message: 'Can’t book the shipment.', errors: errs };
  const v = getVendor(ps[0].vendorId)!; const d = db(); const seq = d.seq + 1;
  const s: Shipment = { id: newId('shp'), no: `IMP-26-${seq}`, principalId: n.principalId, vendorId: v.id, vendorName: v.name, poIds: ps.map((p) => p.id), currency: ps[0].currency, fxRate: n.fxRate,
    mode: n.mode, incoterm: n.incoterm, blAwb: n.blAwb.trim(), container: n.container.trim(), port: n.port, clearingAgent: n.clearingAgent, etd: n.etd, eta: n.eta,
    status: 'Booked', events: [{ status: 'Booked', at: now(), by }], docs: [], customs: null, costs: { freight: 0, insurance: 0, clearing: 0, localTransport: 0, other: 0 }, costsFinal: false, landedAtReceipt: null, grnNo: null,
    lines: ls.map((l) => { const p = getPO(l.poId)!; const pl = p.lines.find((x) => x.id === l.lineId)!; return { ...l, name: pl.name, fobUnit: pl.price }; }),
    history: [{ at: now(), by, action: `Shipment booked — ${n.mode} ${n.blAwb}` }] };
  commit({ ...d, seq, shipments: [s, ...d.shipments] });
  return { ok: true, message: `${s.no} booked, ETA ${s.eta}.`, id: s.id };
};

export const setDoc = (id: string, type: string, ref: string, by: string) => { const s = getShipment(id); if (!s) return; put(log({ ...s, docs: [...s.docs.filter((x) => x.type !== type), ...(ref.trim() ? [{ type, ref: ref.trim() }] : [])] }, by, ref.trim() ? `${type} received` : `${type} removed`, ref.trim() || undefined)); };
export const missingDocs = (s: Shipment) => DOC_TYPES.slice(0, 4).filter((t) => !s.docs.some((x) => x.type === t));
export const setCosts = (id: string, c: Costs, by: string) => { const s = getShipment(id); if (!s) return; put(log({ ...s, costs: c }, by, 'Costs updated')); };

/** IMS-04: the import licence / registration on the supplier must be valid. */
export const licenceIssue = (s: Shipment) => {
  const v = getVendor(s.vendorId); const lic = v?.docs.find((d) => /import|registration/i.test(d.name));
  if (!lic) return 'No import licence or registration recorded for this supplier.';
  if (lic.validTo && lic.validTo < today()) return `${lic.name} expired on ${lic.validTo}.`;
  return null;
};

export const advance = (id: string, by: string): Result => {
  const s = getShipment(id); if (!s) return { ok: false, message: 'Not found.' };
  const next = FLOW[FLOW.indexOf(s.status) + 1];
  if (!next || next === 'Cleared' || next === 'Received') return { ok: false, message: next === 'Cleared' ? 'File the bill of entry to clear customs.' : 'Nothing to move.' };
  put(log({ ...s, status: next, events: [...s.events, { status: next, at: now(), by }] }, by, next));
  return { ok: true, message: `${s.no}: ${next.toLowerCase()}.` };
};

/** File the bill of entry: duty calculated, licence checked (IMS-04), customs cleared. */
export const fileBoe = (id: string, c: Customs, by: string): Result => {
  const s = getShipment(id); if (!s) return { ok: false, message: 'Not found.' };
  const errs: string[] = [];
  if (s.status !== 'Arrived at port') errs.push('The shipment must have arrived at port.');
  if (!c.boeNo.trim() || !c.boeDate) errs.push('Bill of entry number and date are required.');
  const lic = licenceIssue(s); if (lic) errs.push(`Clearance blocked (IMS-04): ${lic}`);
  const miss = missingDocs(s); if (miss.length) errs.push(`Documents missing: ${miss.join(', ')}.`);
  if (errs.length) return { ok: false, message: 'Can’t clear yet.', errors: errs };
  put(log({ ...s, customs: c, status: 'Cleared', events: [...s.events, { status: 'Cleared', at: now(), by }] }, by, `Bill of entry ${c.boeNo} filed — cleared`, `Duty ₹${Math.round(duty(s, c).total).toLocaleString('en-IN')}`));
  return { ok: true, message: `${s.no} cleared — bill of entry ${c.boeNo}.` };
};

/* ----------------------------------- Landed cost ----------------------------------- */

export const fobInr = (s: Shipment) => s.lines.reduce((a, l) => a + l.qty * l.fobUnit * s.fxRate, 0);
/** Duty on the assessable value (CIF in INR): BCD, SWS on BCD, IGST on (assessable + BCD + SWS). */
export const duty = (s: Shipment, c: Customs | null = s.customs) => {
  const assessable = fobInr(s) + s.costs.freight + s.costs.insurance;
  if (!c) return { assessable, bcd: 0, sws: 0, igst: 0, total: 0 };
  const bcd = (assessable * c.bcdPct) / 100; const sws = (bcd * c.swsPct) / 100; const igst = ((assessable + bcd + sws) * c.igstPct) / 100;
  return { assessable, bcd, sws, igst, total: bcd + sws + igst };
};
export interface LandedLine { lineId: string; poId: string; name: string; qty: number; fobInr: number; share: number; landed: number; perUnit: number }
/** IGST is recoverable input tax, so landed cost carries BCD + SWS but not IGST. */
export const landed = (s: Shipment): { lines: LandedLine[]; total: number; parts: Record<string, number> } => {
  const fob = fobInr(s); const dt = duty(s);
  const add = s.costs.freight + s.costs.insurance + dt.bcd + dt.sws + s.costs.clearing + s.costs.localTransport + s.costs.other;
  const lines = s.lines.map((l) => { const v = l.qty * l.fobUnit * s.fxRate; const share = fob ? v / fob : 0; const ld = v + add * share; return { lineId: l.lineId, poId: l.poId, name: l.name, qty: l.qty, fobInr: v, share, landed: ld, perUnit: l.qty ? ld / l.qty : 0 }; });
  return { lines, total: fob + add, parts: { 'FOB (in INR)': fob, Freight: s.costs.freight, Insurance: s.costs.insurance, 'Basic customs duty': dt.bcd, 'Social welfare surcharge': dt.sws, Clearing: s.costs.clearing, 'Local transport': s.costs.localTransport, Other: s.costs.other } };
};

/** Receive at the warehouse through Procurement: one GRN per PO, batches from the packing list, unit cost = landed cost (IMS-01/02/03). */
export const receiveShipment = (id: string, by: string, serialTracked: (pid: string) => boolean): Result => {
  const s = getShipment(id); if (!s) return { ok: false, message: 'Not found.' };
  if (s.status !== 'Cleared' || !s.customs) return { ok: false, message: 'Customs must clear the shipment first (IMS-01).' };
  const lc = landed(s); const unit = Object.fromEntries(lc.lines.map((l) => [l.lineId, Math.round(l.perUnit * 100) / 100]));
  const out: string[] = []; const errs: string[] = [];
  s.poIds.forEach((poId) => {
    const ls = s.lines.filter((l) => l.poId === poId);
    const r = receive(poId, ls.map((l) => ({ lineId: l.lineId, qty: l.qty, batch: l.batch, vendorBatch: l.batch, expiry: l.expiry, serials: l.serials })), '', s.fxRate, '', by, serialTracked, { shipmentNo: s.no, landedUnit: unit });
    if (r.ok) out.push(r.message.split(' ')[0]); else errs.push(...(r.errors ?? [r.message]));
  });
  if (errs.length) return { ok: false, message: 'Couldn’t receive.', errors: errs };
  put(log({ ...s, status: 'Received', grnNo: out.join(', '), landedAtReceipt: unit, events: [...s.events, { status: 'Received', at: now(), by }] }, by, `Received — ${out.join(', ')}`, `Landed cost ${s.costsFinal ? 'final' : 'provisional'} ₹${Math.round(lc.total).toLocaleString('en-IN')}`));
  emit('stock.received', 'Imports', by, `${s.no} received`, { shipmentId: id });
  return { ok: true, message: `${s.no} received as ${out.join(', ')} at landed cost${s.costsFinal ? '' : ' (provisional)'} — goods are in Quarantine for QC.` };
};

/** IMT-01: once every cost document is in, the landed cost is final; a difference from receipt is recorded. */
export const finaliseCosts = (id: string, by: string): Result => {
  const s = getShipment(id); if (!s) return { ok: false, message: 'Not found.' };
  if (s.costsFinal) return { ok: false, message: 'Already final.' };
  if (!s.customs) return { ok: false, message: 'File the bill of entry first.' };
  const lc = landed(s);
  const diff = s.landedAtReceipt ? lc.lines.reduce((a, l) => a + (l.perUnit - (s.landedAtReceipt![l.lineId] ?? l.perUnit)) * l.qty, 0) : 0;
  put(log({ ...s, costsFinal: true }, by, 'Landed cost final', s.landedAtReceipt ? `Adjustment to received batches ₹${Math.round(diff).toLocaleString('en-IN')} (posted to inventory value)` : undefined));
  return { ok: true, message: `Landed cost final${s.landedAtReceipt && Math.abs(diff) >= 1 ? ` — ₹${Math.round(diff).toLocaleString('en-IN')} adjustment on the received batches` : ''}.` };
};

/** IMS-05: expected supply by product (not available to promise until received and accepted). */
export const incoming = (principalId: string) => shipments(principalId).filter((s) => s.status !== 'Received').flatMap((s) => s.lines.map((l) => ({ productId: l.productId, qty: l.qty, eta: s.eta, shipment: s.no, status: s.status })));

/* --------------------------------------- Demo --------------------------------------- */

/** The OrthoTec EUR order: one air shipment at port with documents, ready for the bill of entry. */
export const ensureImportsDemo = (principalId: string, info: (productId: string) => { name: string; serial: boolean }, by = 'Priya Menon') => {
  const d = db(); if (d.seeded.includes(principalId)) return;
  // A separate, approved order from the overseas supplier (the procurement demo keeps its own waiting for approval).
  const v = procVendors(principalId).find((x) => x.kind === 'Overseas supplier');
  const its = v ? vendorItems(v.id) : [];
  const wh = v ? procPos(principalId).find((p) => p.vendorId === v.id)?.warehouseId : undefined;
  if (!v || !its.length || !wh) return;
  cache = { key: KEY(), d: { ...d, seeded: [...d.seeded, principalId] } }; saveJson(KEY(), cache.d);
  const c = createPO({ principalId, vendorId: v.id, warehouseId: wh, deliveryDate: addDays(today(), 5), terms: 'CIF Chennai, 50% advance', fxRate: 92.4, lines: its.map((it) => ({ productId: it.productId, name: info(it.productId).name, qty: 40, price: it.price, gstPct: 12 })) }, by);
  if (!c.id) return;
  submitPO(c.id, by); if (getPO(c.id)?.status === 'Awaiting approval') approvePO(c.id, 'Meera Iyer', true);
  acknowledgePO(c.id, addDays(today(), 4), 'Air freight', `${v.name} (export desk)`, 'Vendor link');
  const po = getPO(c.id)!;
  const r = createShipment({ principalId, poIds: [po.id], mode: 'Air', incoterm: 'CIF Chennai', blAwb: 'AWB 020-55871234', container: '', port: 'Chennai Air Cargo (INMAA4)', clearingAgent: 'Seahorse Clearing & Forwarding', etd: addDays(today(), -6), eta: addDays(today(), -1), fxRate: 92.4,
    lines: po.lines.map((l, i) => { const batch = `OT26-${i === 0 ? 'K' : 'S'}${3110 + i}`; return { poId: po.id, lineId: l.id, productId: l.productId, qty: l.qty, batch, expiry: `${new Date().getUTCFullYear() + 5}-06-30`, serials: info(l.productId).serial ? Array.from({ length: l.qty }, (_x, k) => `${batch}-${String(k + 1).padStart(4, '0')}`) : [] }; }) }, by);
  if (!r.id) return;
  advance(r.id, 'Seahorse (tracking)'); advance(r.id, 'Seahorse (tracking)');
  ['Commercial invoice', 'Packing list', 'Bill of lading / airway bill'].forEach((t, i) => setDoc(r.id!, t, ['OT-INV-26-0412', 'OT-PL-26-0412', 'AWB 020-55871234'][i], by));
  setCosts(r.id, { freight: 185000, insurance: 22000, clearing: 38000, localTransport: 9500, other: 0 }, by);
};
