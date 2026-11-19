/**
 * Procurement & vendors (OP8): buying finished goods (and later components) from vendors and contract manufacturers.
 *
 *   Need (backorders, low stock) ─► PO (Draft) ─► approval above the limit (maker-checker) ─► Sent ─► vendor acknowledges (link)
 *     ─► goods receipt(s) into Quarantine ─► QC accepts / rejects (rejects → return to vendor + debit note) ─► Received / Closed
 *     ─► vendor invoice matched to PO and receipt (3-way); differences go to an exception queue ─► payable sent to accounting
 *
 * Rules
 *   PUR-01 A PO needs an Active vendor approved for every item on it.
 *   PUR-02 Receiving more than ordered needs approval (tolerance, default 0%).
 *   PUR-03 Receipts go to Quarantine when inspection is on; otherwise straight to Available.
 *   PUR-04 A PO can be received in many lots; it closes when fully received or short-closed with a reason.
 *   PUR-05 Rejected quantities create a return-to-vendor document and a debit note reference.
 *   PUR-06 Foreign-currency POs keep the currency and the exchange rate used at receipt.
 *   PUR-07 A receipt from a contract manufacturer records the vendor's batch and certificate of analysis.
 * Who owns purchasing (VinFlux, the ERP, or POs in the ERP with receipt and QC in VinFlux) is a module option.
 * INTEGRATION POINT: /purchase-orders, /goods-receipts, /vendor-invoices; ERP connector create_purchase_order, post_goods_receipt, create_payable.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { opt, optChoice } from '../../platform/moduleOptions';
import { issueLink } from '../../platform/actionLinks';
import { balances, post } from '../inventory/stockStore';
import { notErp } from '../inventory/stockSource';
import { orders } from '../orders/orderStore';

export type VendorStatus = 'Draft' | 'Active' | 'Blocked';
export type VendorKind = 'Trading vendor' | 'Contract manufacturer' | 'Overseas supplier' | 'Component vendor';
export interface VendorDoc { name: string; number: string; validTo: string | null }
export interface Vendor {
  id: string; code: string; principalId: string; name: string; kind: VendorKind; gstin: string; country: string; currency: string; city: string;
  contact: string; email: string; phone: string; bank: string; leadDays: number; status: VendorStatus; docs: VendorDoc[]; history: Hist;
}
export interface VendorItem { vendorId: string; productId: string; price: number; validTo: string | null; preferred: boolean }
export type POStatus = 'Draft' | 'Awaiting approval' | 'Sent' | 'Acknowledged' | 'Part received' | 'Received' | 'Closed' | 'Cancelled';
export interface POLine { id: string; productId: string; name: string; qty: number; price: number; gstPct: number; receivedQty: number; acceptedQty: number; rejectedQty: number; forOrders: string[] }
export interface PurchaseOrder {
  id: string; no: string; principalId: string; vendorId: string; vendorName: string; warehouseId: string; currency: string; fxRate: number;
  deliveryDate: string; terms: string; lines: POLine[]; status: POStatus; source: 'VinFlux' | 'ERP';
  ack: { by: string; at: string; via: string; promisedDate: string; note: string } | null; approvedBy: string | null; createdBy: string; createdAt: string; sentAt: string | null;
  shortCloseReason: string | null; history: Hist;
}
export interface GRNLine { lineId: string; productId: string; qty: number; batch: string; vendorBatch: string; expiry: string | null; serials: string[]; accepted: number | null; rejected: number | null; reason: string }
export interface GRN {
  id: string; no: string; poId: string; poNo: string; vendorId: string; vendorName: string; warehouseId: string; receivedAt: string; by: string; lines: GRNLine[];
  coa: string; fxRate: number; status: 'In QC' | 'Accepted' | 'Partly accepted' | 'Rejected'; overReceiptOk: string | null; rtv: string | null; stockPosted: boolean; qcBy: string | null;
}
export interface VendorInvoice {
  id: string; no: string; poId: string; poNo: string; vendorId: string; vendorName: string; date: string; lines: { lineId: string; qty: number; price: number }[]; amount: number;
  status: 'Matched' | 'Exception' | 'Approved' | 'Rejected'; exceptions: string[]; payableRef: string | null; enteredBy: string; decidedBy: string | null;
}
type Hist = { at: string; by: string; action: string; note?: string }[];

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

interface Db { vendors: Vendor[]; items: VendorItem[]; pos: PurchaseOrder[]; grns: GRN[]; invoices: VendorInvoice[]; seq: number; seeded: string[] }
const KEY = () => workspaceKey('vinflux.procurement.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: loadJson<Db>(KEY(), { vendors: [], items: [], pos: [], grns: [], invoices: [], seq: 700, seeded: [] }) }; return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeProcurement = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
type Result = { ok: boolean; message: string; id?: string; errors?: string[] };
const log = <T extends { history: Hist }>(x: T, by: string, action: string, note?: string): T => ({ ...x, history: [...x.history, { at: now(), by, action, note }] });

export const vendors = (principalId: string) => db().vendors.filter((v) => v.principalId === principalId);
export const getVendor = (id: string) => db().vendors.find((v) => v.id === id) ?? null;
export const vendorItems = (vendorId: string) => db().items.filter((i) => i.vendorId === vendorId);
export const itemsFor = (productId: string) => db().items.filter((i) => i.productId === productId);
export const pos = (principalId: string) => db().pos.filter((p) => p.principalId === principalId);
export const getPO = (id: string) => db().pos.find((p) => p.id === id) ?? null;
export const grns = (principalId: string) => db().grns.filter((g) => getPO(g.poId)?.principalId === principalId);
export const getGRN = (id: string) => db().grns.find((g) => g.id === id) ?? null;
export const vendorInvoices = (principalId: string) => db().invoices.filter((i) => getPO(i.poId)?.principalId === principalId);
export const poValue = (p: Pick<PurchaseOrder, 'lines'>) => p.lines.reduce((a, l) => a + l.qty * l.price * (1 + l.gstPct / 100), 0);
const owner = () => optChoice('procurement', 'owner');

/* ------------------------------------- Vendors ------------------------------------- */

/** Expired documents block a vendor from new POs (shown with the reason). */
export const vendorIssues = (v: Vendor) => {
  const out: string[] = [];
  if (v.status !== 'Active') out.push(`Vendor is ${v.status}.`);
  v.docs.filter((d) => d.validTo && d.validTo < today()).forEach((d) => out.push(`${d.name} expired on ${d.validTo}.`));
  return out;
};
export const saveVendor = (v: Vendor, by: string): Result => {
  const errs: string[] = [];
  if (!v.name.trim()) errs.push('Name is required.');
  if (v.country === 'India' && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.gstin.trim().toUpperCase())) errs.push('Enter a valid GSTIN for an Indian vendor.');
  if (!v.email.trim() && !v.phone.trim()) errs.push('Give an email or phone for purchase orders.');
  if (errs.length) return { ok: false, message: 'Can’t save the vendor.', errors: errs };
  const d = db();
  if (v.id) { commit({ ...d, vendors: d.vendors.map((x) => (x.id === v.id ? log({ ...v, gstin: v.gstin.toUpperCase() }, by, 'Details updated') : x)) }); return { ok: true, message: 'Vendor saved.', id: v.id }; }
  const seq = d.seq + 1; const n: Vendor = { ...v, id: newId('ven'), code: `VEN-${seq}`, gstin: v.gstin.toUpperCase(), history: [{ at: now(), by, action: 'Vendor added' }] };
  commit({ ...d, seq, vendors: [n, ...d.vendors] }); return { ok: true, message: `${n.code} added.`, id: n.id };
};
export const setVendorStatus = (id: string, status: VendorStatus, by: string, note = '') => { const v = getVendor(id); if (!v) return; commit({ ...db(), vendors: db().vendors.map((x) => (x.id === id ? log({ ...x, status }, by, `Status → ${status}`, note) : x)) }); };
export const saveVendorItem = (it: VendorItem) => {
  const d = db();
  const rest = d.items.filter((x) => !(x.vendorId === it.vendorId && x.productId === it.productId)).map((x) => (it.preferred && x.productId === it.productId ? { ...x, preferred: false } : x));
  commit({ ...d, items: [...rest, it] });
};
export const removeVendorItem = (vendorId: string, productId: string) => commit({ ...db(), items: db().items.filter((x) => !(x.vendorId === vendorId && x.productId === productId)) });

/* ------------------------------------ Suggestions ------------------------------------ */

export interface Suggestion { productId: string; backorders: number; orderRefs: string[]; companyStock: number; onOrder: number; suggest: number; vendorId: string | null }
/** What to buy: open backorders not covered by stock or open POs (PRD step 1: need from backorders and channel demand). */
export const suggestions = (principalId: string): Suggestion[] => {
  const by = new Map<string, Suggestion>();
  orders().filter((o) => o.principalId === principalId && !['Rejected', 'Cancelled', 'Completed'].includes(o.status)).forEach((o) => o.lines.forEach((l) => {
    if (!l.backorderQty) return;
    const s = by.get(l.productId) ?? { productId: l.productId, backorders: 0, orderRefs: [], companyStock: 0, onOrder: 0, suggest: 0, vendorId: null };
    s.backorders += l.backorderQty; s.orderRefs.push(o.code); by.set(l.productId, s);
  }));
  const stock = balances().filter((b) => b.locType === 'COMPANY' && b.status === 'Available');
  by.forEach((s) => {
    s.companyStock = stock.filter((b) => b.productId === s.productId).reduce((a, b) => a + b.qty, 0);
    s.onOrder = pos(principalId).filter((p) => !['Draft', 'Received', 'Closed', 'Cancelled'].includes(p.status)).reduce((a, p) => a + p.lines.filter((l) => l.productId === s.productId).reduce((x, l) => x + l.qty - l.receivedQty, 0), 0);
    s.suggest = Math.max(0, s.backorders - s.onOrder);
    s.vendorId = itemsFor(s.productId).find((i) => i.preferred)?.vendorId ?? itemsFor(s.productId)[0]?.vendorId ?? null;
  });
  return [...by.values()].filter((s) => s.suggest > 0);
};

/* --------------------------------------- POs --------------------------------------- */

export interface NewPO { principalId: string; vendorId: string; warehouseId: string; deliveryDate: string; terms: string; fxRate: number; lines: { productId: string; name: string; qty: number; price: number; gstPct: number; forOrders?: string[] }[] }
/** PUR-01: active vendor approved for every item. */
export const checkPO = (n: NewPO) => {
  const errs: string[] = []; const v = getVendor(n.vendorId);
  if (!v) errs.push('Choose the vendor.'); else vendorIssues(v).forEach((x) => errs.push(`${v.name}: ${x}`));
  if (!n.warehouseId) errs.push('Choose where the goods are delivered.');
  if (!n.deliveryDate || n.deliveryDate < today()) errs.push('Delivery date must be today or later.');
  if (!n.lines.length) errs.push('Add at least one line.');
  n.lines.forEach((l) => { if (!(l.qty > 0)) errs.push(`${l.name}: quantity must be more than zero.`); if (!(l.price > 0)) errs.push(`${l.name}: price must be more than zero.`); if (v && !db().items.some((i) => i.vendorId === v.id && i.productId === l.productId)) errs.push(`${l.name} is not on ${v.name}’s approved list (PUR-01).`); });
  if (v && v.currency !== 'INR' && !(n.fxRate > 0)) errs.push(`Enter the ${v.currency} → INR exchange rate.`);
  return errs;
};
export const createPO = (n: NewPO, by: string): Result => {
  if (owner() !== 'vinflux') return { ok: false, message: 'Purchase orders are raised in your ERP (Modules → Procurement & Vendors). Use “Pull from ERP”.' };
  const errs = checkPO(n); if (errs.length) return { ok: false, message: 'Can’t create the purchase order.', errors: errs };
  const v = getVendor(n.vendorId)!; const d = db(); const seq = d.seq + 1;
  const po: PurchaseOrder = { id: newId('po'), no: `PO-26-${seq}`, principalId: n.principalId, vendorId: v.id, vendorName: v.name, warehouseId: n.warehouseId, currency: v.currency, fxRate: v.currency === 'INR' ? 1 : n.fxRate,
    deliveryDate: n.deliveryDate, terms: n.terms, lines: n.lines.map((l) => ({ ...l, id: newId('pol'), receivedQty: 0, acceptedQty: 0, rejectedQty: 0, forOrders: l.forOrders ?? [] })), status: 'Draft', source: 'VinFlux',
    ack: null, approvedBy: null, createdBy: by, createdAt: now(), sentAt: null, shortCloseReason: null, history: [{ at: now(), by, action: 'Purchase order created' }] };
  commit({ ...d, seq, pos: [po, ...d.pos] }); return { ok: true, message: `${po.no} created as draft.`, id: po.id };
};
const putPO = (p: PurchaseOrder) => commit({ ...db(), pos: db().pos.map((x) => (x.id === p.id ? p : x)) });
const limit = () => Number(optChoice('procurement', 'approvalLimit')) || 500000;
/** Submit: above the approval limit it waits for a second person; otherwise it is sent with a vendor acknowledgement link. */
export const submitPO = (id: string, by: string): Result => {
  const p = getPO(id); if (!p || p.status !== 'Draft') return { ok: false, message: 'Only a draft can be submitted.' };
  const errs = checkPO({ ...p, lines: p.lines }); if (errs.length) return { ok: false, message: 'Fix the order first.', errors: errs };
  const valueInr = poValue(p) * p.fxRate;
  if (valueInr > limit()) { putPO(log({ ...p, status: 'Awaiting approval' }, by, `Sent for approval (₹${Math.round(valueInr).toLocaleString('en-IN')} above ₹${limit().toLocaleString('en-IN')})`)); return { ok: true, message: `${p.no} needs approval — value above ₹${limit().toLocaleString('en-IN')}.` }; }
  return send(p, by);
};
const send = (p: PurchaseOrder, by: string): Result => {
  const link = issueLink('po-ack', p.id, p.principalId, p.vendorName, 7 * 24);
  putPO(log({ ...p, status: 'Sent', sentAt: now() }, by, `Sent to ${p.vendorName}`, `Acknowledgement link: ${link}`));
  return { ok: true, message: `${p.no} sent to ${p.vendorName} with an acknowledgement link.` };
};
export const approvePO = (id: string, by: string, approve: boolean, note = ''): Result => {
  const p = getPO(id); if (!p || p.status !== 'Awaiting approval') return { ok: false, message: 'Nothing to approve.' };
  if (p.createdBy === by) return { ok: false, message: 'You raised this PO; another person approves it (maker-checker).' };
  if (!approve) { if (!note.trim()) return { ok: false, message: 'Give a reason.' }; putPO(log({ ...p, status: 'Draft' }, by, 'Returned to draft', note)); return { ok: true, message: `${p.no} returned to the buyer.` }; }
  return send(log({ ...p, approvedBy: by }, by, 'Approved', note || undefined), by);
};
/** The vendor's acknowledgement (from its link, or entered by the buyer). */
export const acknowledgePO = (id: string, promisedDate: string, note: string, by: string, via: string): Result => {
  const p = getPO(id); if (!p || p.status !== 'Sent') return { ok: false, message: 'This order is not waiting for acknowledgement.' };
  if (!promisedDate) return { ok: false, message: 'Give the delivery date you can make.' };
  putPO(log({ ...p, status: 'Acknowledged', ack: { by, at: now(), via, promisedDate, note } }, by, `Acknowledged — delivery ${promisedDate}`, `${via}${note ? `; ${note}` : ''}`));
  return { ok: true, message: `Thank you — ${p.no} acknowledged for ${promisedDate}.` };
};
export const cancelPO = (id: string, reason: string, by: string): Result => {
  const p = getPO(id); if (!p || p.lines.some((l) => l.receivedQty > 0) || ['Received', 'Closed', 'Cancelled'].includes(p.status)) return { ok: false, message: 'Only a PO with nothing received can be cancelled.' };
  if (!reason.trim()) return { ok: false, message: 'Give a reason.' };
  putPO(log({ ...p, status: 'Cancelled' }, by, 'Cancelled', reason)); return { ok: true, message: `${p.no} cancelled.` };
};
/** PUR-04: close with the rest not coming. */
export const shortClose = (id: string, reason: string, by: string): Result => {
  const p = getPO(id); if (!p || p.status !== 'Part received') return { ok: false, message: 'Only a part-received PO can be short-closed.' };
  if (!reason.trim()) return { ok: false, message: 'Give the reason the rest is not coming.' };
  putPO(log({ ...p, status: 'Closed', shortCloseReason: reason }, by, 'Short-closed', reason)); return { ok: true, message: `${p.no} closed short.` };
};

/** MOCK: POs owned by the ERP arrive through the connector (read_purchase_orders); here one open PO is pulled per approved item not on order. */
export const pullFromErp = (principalId: string, warehouseId: string, by: string): Result => {
  const d = db(); const open = new Set(pos(principalId).filter((p) => !['Received', 'Closed', 'Cancelled'].includes(p.status)).flatMap((p) => p.lines.map((l) => l.productId)));
  const it = d.items.find((i) => !open.has(i.productId) && getVendor(i.vendorId)?.principalId === principalId && vendorIssues(getVendor(i.vendorId)!).length === 0);
  if (!it) return { ok: true, message: 'No new purchase orders in the ERP.' };
  const v = getVendor(it.vendorId)!; const seq = d.seq + 1;
  const po: PurchaseOrder = { id: newId('po'), no: `ERP-PO-${4500000 + seq}`, principalId, vendorId: v.id, vendorName: v.name, warehouseId, currency: v.currency, fxRate: v.currency === 'INR' ? 1 : 92, deliveryDate: addDays(today(), v.leadDays), terms: 'As per ERP',
    lines: [{ id: newId('pol'), productId: it.productId, name: it.productId, qty: 100, price: it.price, gstPct: 12, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, forOrders: [] }], status: 'Sent', source: 'ERP', ack: null, approvedBy: 'ERP', createdBy: 'ERP', createdAt: now(), sentAt: now(), shortCloseReason: null, history: [{ at: now(), by, action: 'Pulled from the ERP' }] };
  commit({ ...d, seq, pos: [po, ...d.pos] }); return { ok: true, message: `${po.no} pulled from the ERP.`, id: po.id };
};

/* ------------------------------------- Receipts ------------------------------------- */

export interface ReceiveLine { lineId: string; qty: number; batch: string; vendorBatch: string; expiry: string | null; serials: string[] }
export const receive = (poId: string, lines: ReceiveLine[], coa: string, fxRate: number | null, overReason: string, by: string, serialTracked: (productId: string) => boolean): Result => {
  const p = getPO(poId); if (!p || !['Sent', 'Acknowledged', 'Part received'].includes(p.status)) return { ok: false, message: 'This order can’t be received now.' };
  if (owner() === 'erp') return { ok: false, message: 'Receipts are posted in your ERP; VinFlux shows them after the next sync.' };
  const tol = Number(optChoice('procurement', 'overTolerance')) || 0;
  const errs: string[] = []; const over: string[] = [];
  const rl = lines.filter((l) => l.qty > 0);
  if (!rl.length) errs.push('Enter a received quantity.');
  rl.forEach((l) => {
    const pl = p.lines.find((x) => x.id === l.lineId)!; const open = pl.qty - pl.receivedQty;
    if (!l.batch.trim()) errs.push(`${pl.name}: batch is required.`);
    if (l.expiry && l.expiry <= today()) errs.push(`${pl.name}: batch ${l.batch} has expired.`);
    if (serialTracked(pl.productId) && l.serials.filter(Boolean).length !== l.qty) errs.push(`${pl.name}: enter ${l.qty} serial number(s).`);
    if (l.qty > open * (1 + tol / 100)) over.push(`${pl.name}: ${l.qty} received, ${open} open`);
  });
  if (over.length && !overReason.trim()) errs.push(`More than ordered (PUR-02): ${over.join('; ')}. Give the approval reason to accept it.`);
  const v = getVendor(p.vendorId);
  if (v?.kind === 'Contract manufacturer' && !coa.trim()) errs.push('A contract manufacturer’s receipt needs its certificate of analysis (PUR-07).');
  if (p.currency !== 'INR' && !(fxRate && fxRate > 0)) errs.push(`Enter the ${p.currency} rate used at receipt (PUR-06).`);
  if (errs.length) return { ok: false, message: 'Can’t record the receipt.', errors: errs };
  const quarantine = opt('procurement', 'inspection') && opt('inventory', 'quarantine');
  const toStock = notErp(p.warehouseId) && owner() !== 'erp';
  const d = db(); const seq = d.seq + 1; const no = `GRN-26-${seq}`;
  const g: GRN = { id: newId('grn'), no, poId: p.id, poNo: p.no, vendorId: p.vendorId, vendorName: p.vendorName, warehouseId: p.warehouseId, receivedAt: now(), by, coa: coa.trim(), fxRate: fxRate ?? 1,
    lines: rl.map((l) => ({ ...l, productId: p.lines.find((x) => x.id === l.lineId)!.productId, accepted: quarantine ? null : l.qty, rejected: quarantine ? null : 0, reason: '' })),
    status: quarantine ? 'In QC' : 'Accepted', overReceiptOk: over.length ? `${overReason} (${by})` : null, rtv: null, stockPosted: toStock, qcBy: quarantine ? null : 'No inspection' };
  if (toStock) post(g.lines.flatMap((l) => {
    const unit = (p.lines.find((x) => x.id === l.lineId)!.price) * (fxRate ?? 1);
    const base = { type: 'RECEIPT' as const, locType: 'COMPANY' as const, warehouseId: p.warehouseId, bin: quarantine ? 'QC' : 'MAIN', productId: l.productId, variantSku: null, batch: l.batch.trim(), mfgDate: null, expiryDate: l.expiry, unitCost: Math.round(unit * 100) / 100, status: (quarantine ? 'Quarantine' : 'Available') as 'Quarantine' | 'Available', importId: null, source: `${no} · ${p.no} · ${p.vendorName}`, by, refId: g.id };
    return l.serials.filter(Boolean).length ? l.serials.filter(Boolean).map((s) => ({ ...base, serial: s as string | null, qty: 1 })) : [{ ...base, serial: null as string | null, qty: l.qty }];
  }));
  const linesN = p.lines.map((pl) => { const got = rl.filter((l) => l.lineId === pl.id).reduce((a, l) => a + l.qty, 0); return { ...pl, receivedQty: pl.receivedQty + got, acceptedQty: pl.acceptedQty + (quarantine ? 0 : got) }; });
  const full = linesN.every((l) => l.receivedQty >= l.qty);
  cache = { key: KEY(), d: { ...d, seq, grns: [g, ...d.grns] } };
  putPO(log({ ...p, lines: linesN, status: full ? 'Received' : 'Part received' }, by, `${no}: ${rl.reduce((a, l) => a + l.qty, 0)} unit(s) received${quarantine ? ' into Quarantine' : ''}`, toStock ? undefined : 'Stock is posted by the ERP (warehouse is ERP-mastered)'));
  emit('stock.received', 'Procurement', by, `${no} from ${p.vendorName}`, { grnId: g.id });
  return { ok: true, message: `${no} recorded${quarantine ? ' — goods are in Quarantine until QC accepts them' : ' — available to sell'}${toStock ? '' : ' (your ERP posts the stock)'}.`, id: g.id };
};

/** QC decision per line (PUR-03/05). Accepted → Available; rejected → return-to-vendor + debit note. */
export const inspect = (grnId: string, decisions: Record<string, { accepted: number; reason: string }>, by: string): Result => {
  const g = getGRN(grnId); if (!g || g.status !== 'In QC') return { ok: false, message: 'Nothing to inspect.' };
  if (g.by === by && opt('procurement', 'inspectorSeparate')) return { ok: false, message: 'You recorded this receipt; another person does QC (maker-checker).' };
  const errs: string[] = [];
  g.lines.forEach((l, i) => { const dd = decisions[i] ?? { accepted: l.qty, reason: '' }; if (dd.accepted < 0 || dd.accepted > l.qty) errs.push(`Line ${i + 1}: accepted must be 0–${l.qty}.`); if (dd.accepted < l.qty && !dd.reason.trim()) errs.push(`Line ${i + 1}: give the rejection reason.`); });
  if (errs.length) return { ok: false, message: 'Check the inspection.', errors: errs };
  const p = getPO(g.poId)!; const d = db();
  const lines = g.lines.map((l, i) => { const dd = decisions[i] ?? { accepted: l.qty, reason: '' }; return { ...l, accepted: dd.accepted, rejected: l.qty - dd.accepted, reason: dd.reason }; });
  const rej = lines.reduce((a, l) => a + (l.rejected ?? 0), 0); const acc = lines.reduce((a, l) => a + (l.accepted ?? 0), 0);
  const rtv = rej ? `RTV-${g.no.slice(4)} / DN-${g.no.slice(4)}` : null;
  if (g.stockPosted) post(lines.flatMap((l) => {
    const base = { locType: 'COMPANY' as const, warehouseId: g.warehouseId, productId: l.productId, variantSku: null, batch: l.batch, mfgDate: null, expiryDate: l.expiry, unitCost: null, importId: null, by, refId: g.id };
    const units = l.serials.filter(Boolean).length ? l.serials.filter(Boolean).map((s, k) => ({ s, ok: k < (l.accepted ?? 0) })) : null;
    const moves: Parameters<typeof post>[0] = [];
    if (units) units.forEach((u) => { moves.push({ ...base, type: 'RECEIPT' as const, bin: 'QC', serial: u.s, qty: -1, status: 'Quarantine' as const, source: `${g.no} QC` }); if (u.ok) moves.push({ ...base, type: 'RECEIPT' as const, bin: 'MAIN', serial: u.s, qty: 1, status: 'Available' as const, source: `${g.no} QC accepted` }); else moves.push({ ...base, type: 'RTM' as const, bin: 'QC', serial: u.s, qty: 0, status: 'Quarantine' as const, source: `${g.no} returned to vendor` }); });
    else { moves.push({ ...base, type: 'RECEIPT' as const, bin: 'QC', serial: null, qty: -l.qty, status: 'Quarantine' as const, source: `${g.no} QC` }); if (l.accepted) moves.push({ ...base, type: 'RECEIPT' as const, bin: 'MAIN', serial: null, qty: l.accepted, status: 'Available' as const, source: `${g.no} QC accepted` }); }
    return moves.filter((m) => m.qty !== 0);
  }));
  const status: GRN['status'] = acc === 0 ? 'Rejected' : rej ? 'Partly accepted' : 'Accepted';
  cache = { key: KEY(), d: { ...d, grns: d.grns.map((x) => (x.id === grnId ? { ...x, lines, status, rtv, qcBy: by } : x)) } };
  const linesN = p.lines.map((pl) => ({ ...pl, acceptedQty: pl.acceptedQty + lines.filter((l) => l.lineId === pl.id).reduce((a, l) => a + (l.accepted ?? 0), 0), rejectedQty: pl.rejectedQty + lines.filter((l) => l.lineId === pl.id).reduce((a, l) => a + (l.rejected ?? 0), 0) }));
  putPO(log({ ...p, lines: linesN }, by, `${g.no} QC: ${acc} accepted, ${rej} rejected`, rtv ? `Return to vendor and debit note ${rtv}` : undefined));
  return { ok: true, message: `${g.no}: ${acc} accepted${rej ? `, ${rej} rejected — ${rtv} raised` : ''}.` };
};

/* ---------------------------------- Vendor invoices ---------------------------------- */

/** 3-way match: invoice qty ≤ accepted qty, price within tolerance of the PO price. */
export const enterInvoice = (poId: string, no: string, date: string, lines: { lineId: string; qty: number; price: number }[], by: string): Result => {
  const p = getPO(poId); if (!p) return { ok: false, message: 'PO not found.' };
  if (!no.trim()) return { ok: false, message: 'Enter the vendor’s invoice number.' };
  if (db().invoices.some((i) => i.vendorId === p.vendorId && i.no.toLowerCase() === no.trim().toLowerCase())) return { ok: false, message: `Invoice ${no} from ${p.vendorName} is already entered.` };
  const priceTol = Number(optChoice('procurement', 'priceTolerance')) || 1;
  const ex: string[] = [];
  const billedBefore = (lineId: string) => db().invoices.filter((i) => i.poId === poId && i.status !== 'Rejected').reduce((a, i) => a + i.lines.filter((x) => x.lineId === lineId).reduce((s, x) => s + x.qty, 0), 0);
  lines.filter((l) => l.qty > 0).forEach((l) => {
    const pl = p.lines.find((x) => x.id === l.lineId)!;
    if (l.qty + billedBefore(l.lineId) > pl.acceptedQty) ex.push(`${pl.name}: billed ${l.qty + billedBefore(l.lineId)}, accepted ${pl.acceptedQty}.`);
    if (l.price > pl.price * (1 + priceTol / 100)) ex.push(`${pl.name}: price ${l.price} vs PO ${pl.price} (+${Math.round(((l.price - pl.price) / pl.price) * 1000) / 10}%).`);
  });
  const amount = lines.reduce((a, l) => { const pl = p.lines.find((x) => x.id === l.lineId)!; return a + l.qty * l.price * (1 + pl.gstPct / 100); }, 0);
  const d = db(); const seq = d.seq + 1;
  const inv: VendorInvoice = { id: newId('vin'), no: no.trim(), poId, poNo: p.no, vendorId: p.vendorId, vendorName: p.vendorName, date, lines: lines.filter((l) => l.qty > 0), amount: Math.round(amount), status: ex.length ? 'Exception' : 'Matched', exceptions: ex, payableRef: ex.length ? null : `AP-${seq}`, enteredBy: by, decidedBy: null };
  commit({ ...d, seq, invoices: [inv, ...d.invoices] });
  return { ok: true, message: ex.length ? `Invoice ${inv.no} doesn’t match — sent to the exception queue.` : `Invoice ${inv.no} matched — payable ${inv.payableRef} sent to accounting.`, id: inv.id };
};
export const decideInvoice = (id: string, approve: boolean, by: string, note: string): Result => {
  const i = db().invoices.find((x) => x.id === id); if (!i || i.status !== 'Exception') return { ok: false, message: 'Nothing to decide.' };
  if (i.enteredBy === by) return { ok: false, message: 'You entered this invoice; another person decides the exception.' };
  if (!note.trim()) return { ok: false, message: 'Give a note for the record.' };
  const d = db(); const seq = d.seq + 1;
  commit({ ...d, seq, invoices: d.invoices.map((x) => (x.id === id ? { ...x, status: approve ? 'Approved' : 'Rejected', payableRef: approve ? `AP-${seq}` : null, decidedBy: by, exceptions: [...x.exceptions, `${approve ? 'Approved' : 'Rejected'} by ${by}: ${note}`] } : x)) });
  return { ok: true, message: approve ? `Invoice approved — payable AP-${seq} sent to accounting.` : 'Invoice rejected — the vendor is asked for a corrected invoice.' };
};

/* ------------------------------------ Scorecard ------------------------------------ */

export interface Score { vendorId: string; pos: number; onTime: number | null; fillRate: number | null; rejection: number | null; leadDays: number | null; priceVar: number | null }
export const scorecard = (principalId: string, vendorId: string): Score => {
  const ps = pos(principalId).filter((p) => p.vendorId === vendorId && p.status !== 'Cancelled' && p.status !== 'Draft');
  const gs = grns(principalId).filter((g) => g.vendorId === vendorId);
  const first = (p: PurchaseOrder) => gs.filter((g) => g.poId === p.id).sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1))[0];
  const withRec = ps.filter((p) => first(p));
  const onTime = withRec.length ? Math.round((withRec.filter((p) => first(p)!.receivedAt.slice(0, 10) <= (p.ack?.promisedDate ?? p.deliveryDate)).length / withRec.length) * 100) : null;
  const closed = ps.filter((p) => ['Received', 'Closed'].includes(p.status));
  const ord = closed.reduce((a, p) => a + p.lines.reduce((s, l) => s + l.qty, 0), 0); const rec = closed.reduce((a, p) => a + p.lines.reduce((s, l) => s + Math.min(l.qty, l.receivedQty), 0), 0);
  const insp = gs.filter((g) => g.status !== 'In QC'); const iq = insp.reduce((a, g) => a + g.lines.reduce((s, l) => s + l.qty, 0), 0); const rj = insp.reduce((a, g) => a + g.lines.reduce((s, l) => s + (l.rejected ?? 0), 0), 0);
  const leads = withRec.filter((p) => p.sentAt).map((p) => Math.round((Date.parse(first(p)!.receivedAt) - Date.parse(p.sentAt!)) / 86400000));
  const inv = db().invoices.filter((i) => i.vendorId === vendorId);
  const pv = inv.flatMap((i) => i.lines.map((l) => { const pl = getPO(i.poId)?.lines.find((x) => x.id === l.lineId); return pl ? ((l.price - pl.price) / pl.price) * 100 : 0; }));
  return { vendorId, pos: ps.length, onTime, fillRate: ord ? Math.round((rec / ord) * 100) : null, rejection: iq ? Math.round((rj / iq) * 1000) / 10 : null, leadDays: leads.length ? Math.round(leads.reduce((a, x) => a + x, 0) / leads.length) : null, priceVar: pv.length ? Math.round((pv.reduce((a, x) => a + x, 0) / pv.length) * 10) / 10 : null };
};

/* --------------------------------------- Demo --------------------------------------- */

export const ensureProcurementDemo = (principalId: string, products: { id: string; name: string; price: number; gstPct: number }[], warehouseId: string) => {
  const d = db(); if (d.seeded.includes(principalId) || products.length < 3 || !warehouseId) return;
  const yr = new Date().getUTCFullYear();
  const mk = (i: number, v: Partial<Vendor>): Vendor => ({ id: `ven-${principalId}-${i}`, code: `VEN-${601 + i}`, principalId, name: '', kind: 'Trading vendor', gstin: '', country: 'India', currency: 'INR', city: '', contact: '', email: '', phone: '', bank: '', leadDays: 10, status: 'Active', docs: [], history: [{ at: now(), by: 'System', action: 'Vendor added' }], ...v });
  const vs = [
    mk(0, { name: 'Sterimed Contract Manufacturing Pvt Ltd', kind: 'Contract manufacturer', gstin: '24AABCS1234F1Z5', city: 'Ahmedabad', contact: 'R. Patel', email: 'orders@sterimed.example', phone: '+91 79 4000 1200', bank: 'HDFC ****4471', leadDays: 14, docs: [{ name: 'Manufacturing licence (MD-5)', number: 'MFG/MD/2024/000318', validTo: `${yr + 2}-03-31` }] }),
    mk(1, { name: 'OrthoTec GmbH', kind: 'Overseas supplier', country: 'Germany', currency: 'EUR', city: 'Tuttlingen', contact: 'K. Weber', email: 'export@orthotec.example', phone: '+49 7461 1234', bank: 'IBAN DE89 ****', leadDays: 35, docs: [{ name: 'Import licence (MD-15)', number: 'IMP/MD/2025/00777', validTo: `${yr + 1}-12-31` }] }),
    mk(2, { name: 'Medline Instruments', kind: 'Trading vendor', gstin: '36AAFCM5678K1Z2', city: 'Hyderabad', contact: 'S. Rao', email: 'sales@medline.example', phone: '+91 40 2300 4411', bank: 'SBI ****9012', leadDays: 7, docs: [{ name: 'Wholesale drug licence', number: 'TS/HYD/20B/2021/88', validTo: `${yr - 1}-10-31` }] }),
  ];
  const items: VendorItem[] = [
    { vendorId: vs[0].id, productId: products[2].id, price: Math.round(products[2].price * 0.42), validTo: null, preferred: true },
    { vendorId: vs[1].id, productId: products[0].id, price: Math.round((products[0].price * 0.45) / 92), validTo: null, preferred: true },
    { vendorId: vs[1].id, productId: products[1].id, price: Math.round((products[1].price * 0.45) / 92), validTo: null, preferred: true },
    { vendorId: vs[2].id, productId: products[1].id, price: Math.round(products[1].price * 0.55), validTo: null, preferred: false },
  ];
  cache = { key: KEY(), d: { ...d, vendors: [...vs, ...d.vendors], items: [...d.items, ...items], seeded: [...d.seeded, principalId] } }; saveJson(KEY(), cache.d);
  const line = (k: number, qty: number, vendor: number) => ({ productId: products[k].id, name: products[k].name, qty, price: items.find((i) => i.vendorId === vs[vendor].id && i.productId === products[k].id)!.price, gstPct: products[k].gstPct });
  // 1) Contract manufacturer: sent, acknowledged, received into QC.
  const a = createPO({ principalId, vendorId: vs[0].id, warehouseId, deliveryDate: addDays(today(), 3), terms: '30 days credit', fxRate: 1, lines: [line(2, 500, 0)] }, 'Priya Menon');
  if (a.id) { submitPO(a.id, 'Priya Menon'); if (getPO(a.id)?.status === 'Awaiting approval') approvePO(a.id, 'Meera Iyer', true); acknowledgePO(a.id, addDays(today(), 2), 'Batch under release', 'Sterimed (R. Patel)', 'Vendor link'); receive(a.id, [{ lineId: getPO(a.id)!.lines[0].id, qty: 300, batch: 'SM2611-07', vendorBatch: 'SM/26/1107', expiry: `${yr + 3}-10-31`, serials: [] }], 'CoA SM/26/1107 attached', null, '', 'Suresh Reddy', () => false); }
  // 2) Overseas EUR order above the limit: waiting for approval.
  const b = createPO({ principalId, vendorId: vs[1].id, warehouseId, deliveryDate: addDays(today(), 40), terms: 'CIF Chennai, 50% advance', fxRate: 92.4, lines: [line(0, 120, 1), line(1, 80, 1)] }, 'Priya Menon');
  if (b.id) submitPO(b.id, 'Priya Menon');
  // 3) Sterimed earlier order fully received, accepted, invoiced at a higher price → exception.
  const c = createPO({ principalId, vendorId: vs[0].id, warehouseId, deliveryDate: addDays(today(), 1), terms: '30 days credit', fxRate: 1, lines: [line(2, 200, 0)] }, 'Priya Menon');
  if (c.id) {
    submitPO(c.id, 'Priya Menon'); if (getPO(c.id)?.status === 'Awaiting approval') approvePO(c.id, 'Meera Iyer', true); acknowledgePO(c.id, addDays(today(), 1), '', 'Sterimed (R. Patel)', 'Vendor link');
    const g = receive(c.id, [{ lineId: getPO(c.id)!.lines[0].id, qty: 200, batch: 'SM2610-22', vendorBatch: 'SM/26/1022', expiry: `${yr + 3}-09-30`, serials: [] }], 'CoA SM/26/1022 attached', null, '', 'Suresh Reddy', () => false);
    if (g.id) inspect(g.id, { 0: { accepted: 196, reason: '4 pouches with broken seal' } }, 'Meera Iyer');
    const pl = getPO(c.id)!.lines[0];
    enterInvoice(c.id, 'STM/INV/26-27/1184', today(), [{ lineId: pl.id, qty: 196, price: Math.round(pl.price * 1.04) }], 'Meera Iyer');
  }
};
