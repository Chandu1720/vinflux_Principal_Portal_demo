/**
 * Invoicing in VinFlux (OP4) — for principals without an accounting system that raises GST invoices.
 * - Tax invoice per shipment, numbered per GSTIN and financial year, never more than 16 characters (ORG-04).
 * - CGST + SGST within the state, IGST across states (place of supply from the buyer's GSTIN, else its address).
 * - E-invoice (IRN, acknowledgement, signed QR) for B2B when switched on; cancel only within 24 h of the IRN.
 * - E-way bill when the consignment value is above the limit (₹50,000 default).
 * - Credit notes against an invoice (return, rate difference, scheme), also numbered per GSTIN and year.
 * INTEGRATION POINT: IRN and e-way bill come from the GST portal through a GSP (POST /einvoice, /ewaybill);
 * here they are generated in sandbox form.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import type { Product } from '../../types/product.ts';
import type { Warehouse } from '../../types/warehouse';
import type { Partner } from '../gtm-v2/types';
import { allShipments } from '../orders/orderStore';
import type { Order } from '../orders/orderStore';
import { returns } from '../returns/returnStore';
import { claims } from '../claims/claimsStore';

export const STATE_CODES: Record<string, string> = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', Punjab: '03', Chandigarh: '04', Uttarakhand: '05', Haryana: '06', Delhi: '07', Rajasthan: '08', 'Uttar Pradesh': '09', Bihar: '10',
  Sikkim: '11', Assam: '18', 'West Bengal': '19', Jharkhand: '20', Odisha: '21', Chhattisgarh: '22', 'Madhya Pradesh': '23', Gujarat: '24', Maharashtra: '27', Karnataka: '29', Goa: '30',
  Kerala: '32', 'Tamil Nadu': '33', Puducherry: '34', Telangana: '36', 'Andhra Pradesh': '37',
};
const stateOfCode = (code: string) => Object.entries(STATE_CODES).find(([, c]) => c === code)?.[0] ?? code;

export interface Registration { state: string; gstin: string; legalName: string; address: string }
export interface InvSettings { registrations: Registration[]; einvoice: boolean; ewayLimit: number; bankDetails: string; terms: string }
export interface InvLine { productId: string; name: string; hsn: string; batch: string; qty: number; rate: number; taxable: number; gstPct: number; cgst: number; sgst: number; igst: number }
export type InvStatus = 'Issued' | 'Cancelled';
export interface Invoice {
  id: string; no: string; date: string; principalId: string; orderId: string; orderCode: string; shipmentId: string; shipmentNo: string;
  seller: Registration; buyer: { partnerId: string; name: string; gstin: string; state: string; address: string }; placeOfSupply: string; inter: boolean;
  lines: InvLine[]; taxable: number; cgst: number; sgst: number; igst: number; total: number; roundOff: number;
  irn: string | null; ackNo: string | null; ackAt: string | null; ewayBill: string | null; ewayValidTo: string | null; vehicleNo: string | null;
  status: InvStatus; cancelReason: string | null; history: { at: string; by: string; action: string; note?: string }[];
}
export type CnReason = 'Sales return' | 'Rate difference' | 'Scheme / discount' | 'Shortage or damage' | 'Other';
export interface CreditNote {
  id: string; no: string; date: string; principalId: string; invoiceId: string | null; invoiceNo: string; partnerId: string; partnerName: string; reason: CnReason;
  source: 'VinFlux' | 'Return' | 'Claim'; sourceRef: string | null; taxable: number; tax: number; total: number; inter: boolean; irn: string | null; by: string;
}
export type DnReason = 'Price revision' | 'Short billed' | 'Freight recovery' | 'Interest on late payment' | 'Other';
export interface DebitNote { id: string; no: string; date: string; principalId: string; invoiceId: string; invoiceNo: string; partnerId: string; partnerName: string; reason: DnReason; taxable: number; tax: number; total: number; inter: boolean; irn: string | null; by: string }
/** Delivery challan (TAX-05): goods moved without a sale — consignment, or a transfer within the same GSTIN. */
export interface Challan {
  id: string; no: string; date: string; principalId: string; kind: 'Consignment' | 'Stock transfer (same GSTIN)'; orderId: string; orderCode: string; shipmentId: string; shipmentNo: string;
  from: Registration; to: { name: string; address: string; gstin: string; state: string }; lines: { productId: string; name: string; hsn: string; batch: string; qty: number; value: number }[];
  value: number; ewayBill: string | null; status: 'Open' | 'Closed'; note: string;
}
interface Db { settings: InvSettings; invoices: Invoice[]; credits: CreditNote[]; debits: DebitNote[]; challans: Challan[]; series: Record<string, number> }

const now = () => new Date().toISOString();
const KEY = () => workspaceKey('vinflux.invoicing.v1');
const EMPTY: Db = {
  settings: {
    registrations: [
      { state: 'Telangana', gstin: '36AABCB4521K1Z8', legalName: 'Biorad Medisys Private Limited', address: 'Plot 22, Medchal Industrial Area, Hyderabad 501401' },
      { state: 'Maharashtra', gstin: '27AABCB4521K1ZA', legalName: 'Biorad Medisys Private Limited', address: 'Gala 14, Bhiwandi Logistics Park, Thane 421302' },
    ],
    einvoice: true, ewayLimit: 50000, bankDetails: 'HDFC Bank · A/c 50200012345678 · IFSC HDFC0001234', terms: 'Goods once sold are subject to the return policy. Interest @18% p.a. on overdue amounts.',
  },
  invoices: [], credits: [], debits: [], challans: [], series: {},
};
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) {
    const x = loadJson<Partial<Db> | null>(KEY(), null);
    cache = { key: KEY(), d: { ...EMPTY, ...(x ?? {}), settings: { ...EMPTY.settings, ...(x?.settings ?? {}) }, invoices: Array.isArray(x?.invoices) ? x!.invoices : [], credits: Array.isArray(x?.credits) ? x!.credits : [], debits: Array.isArray(x?.debits) ? x!.debits : [], challans: Array.isArray(x?.challans) ? x!.challans : [], series: x?.series ?? {} } };
  }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeInvoicing = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
type R = { ok: boolean; message: string; errors?: string[] };

export const invSettings = () => db().settings;
export const saveInvSettings = (s: InvSettings): R => {
  const bad = s.registrations.filter((r) => !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(r.gstin));
  if (bad.length) return { ok: false, message: `GSTIN format looks wrong: ${bad.map((b) => b.gstin || '(empty)').join(', ')}` };
  const wrong = s.registrations.filter((r) => STATE_CODES[r.state] && r.gstin.slice(0, 2) !== STATE_CODES[r.state]);
  if (wrong.length) return { ok: false, message: `GSTIN doesn’t match its state: ${wrong.map((w) => `${w.state} → ${w.gstin.slice(0, 2)}`).join(', ')}` };
  commit({ ...db(), settings: s });
  return { ok: true, message: 'Invoicing settings saved.' };
};
export const fyOf = (iso: string) => { const y = Number(iso.slice(0, 4)); const m = Number(iso.slice(5, 7)); const s = m >= 4 ? y : y - 1; return `${String(s).slice(2)}${String(s + 1).slice(2)}`; };
/** Registration of the warehouse's state, else the first one. */
export const registrationFor = (warehouseState: string | undefined) => db().settings.registrations.find((r) => r.state === warehouseState) ?? db().settings.registrations[0];
/** Next number in the series for a GSTIN, document type and financial year: e.g. 36/2627/00012 (13 chars). */
const nextNo = (gstin: string, kind: 'INV' | 'CN' | 'DN' | 'DC', date: string) => {
  const d = db(); const key = `${gstin}|${kind}|${fyOf(date)}`; const seq = (d.series[key] ?? 0) + 1;
  cache = { key: KEY(), d: { ...d, series: { ...d.series, [key]: seq } } }; saveJson(KEY(), cache.d);
  const no = `${kind === 'INV' ? '' : kind}${gstin.slice(0, 2)}/${fyOf(date)}/${String(seq).padStart(5, '0')}`;
  return no.slice(0, 16);
};
/** Numberer plugged into shipments (orderStore) when VinFlux issues the invoice. */
/** State the goods leave from: the company warehouse, or the C&F depot (the principal's additional place of business). */
const fromState = (o: Order, warehouses: Warehouse[], partners: Partner[]) => (o.shipFrom.locType === 'CNF' ? partners.find((p) => p.id === o.shipFrom.id)?.address?.state : warehouses.find((x) => x.id === o.shipFrom.id)?.state);
/**
 * TAX-05: consignment and transfers inside one GSTIN move on a delivery challan; a transfer to a depot under another
 * GSTIN of the same company is a supply and is invoiced.
 */
export const challanKind = (o: Order, warehouses: Warehouse[], partners: Partner[]): Challan['kind'] | null => {
  if (o.orderType === 'Consignment') return 'Consignment';
  if (o.orderType !== 'Stock transfer') return null;
  const fromReg = registrationFor(fromState(o, warehouses, partners));
  const toState = partners.find((p) => p.id === o.partnerId)?.address?.state;
  const toReg = db().settings.registrations.find((r) => r.state === toState);
  return !toReg || toReg.gstin === fromReg.gstin ? 'Stock transfer (same GSTIN)' : null;
};
export const numberForShipment = (o: Order, warehouses: Warehouse[], partners: Partner[]) => nextNo(registrationFor(fromState(o, warehouses, partners)).gstin, challanKind(o, warehouses, partners) ? 'DC' : 'INV', now().slice(0, 10));

const hash = (s: string, len: number) => { let h1 = 0x811c9dc5; let out = ''; for (let k = 0; out.length < len; k++) { for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i) + k; h1 = Math.imul(h1, 16777619); } out += (h1 >>> 0).toString(16).padStart(8, '0'); } return out.slice(0, len); };

export const invoices = (principalId: string) => db().invoices.filter((i) => i.principalId === principalId);
export const getInvoice = (id: string) => db().invoices.find((i) => i.id === id) ?? null;
export const creditNotes = (principalId: string) => db().credits.filter((c) => c.principalId === principalId);
const putI = (i: Invoice) => { const d = db(); commit({ ...d, invoices: d.invoices.map((x) => (x.id === i.id ? i : x)) }); };

/** Register a tax invoice for every shipment invoiced by VinFlux that isn't in the register yet. */
export const syncInvoices = (principalId: string, products: Product[], partners: Partner[], warehouses: Warehouse[]) => {
  const d = db(); const have = new Set([...d.invoices.map((i) => i.shipmentId), ...d.challans.map((c) => c.shipmentId)]); const add: Invoice[] = []; const dcs: Challan[] = [];
  allShipments().filter((x) => x.order.principalId === principalId && (x.shipment.invoiceBy === 'VinFlux' || x.shipment.invoiceBy === 'C&F') && !have.has(x.shipment.id)).forEach(({ order: o, shipment: sh }) => {
    const ck = challanKind(o, warehouses, partners);
    if (ck) {
      const from = registrationFor(fromState(o, warehouses, partners)); const to = partners.find((x) => x.id === o.partnerId);
      const lines = sh.allocations.map((a) => { const prod = products.find((x) => x.id === a.productId); return { productId: a.productId, name: prod?.name ?? a.productId, hsn: prod?.hsnCode ?? '', batch: `${a.batch}${a.serial ? ` / ${a.serial}` : ''}`, qty: a.qty, value: Math.round((a.unitCost ?? prod?.pricingReference?.standardCost ?? 0) * a.qty) }; });
      dcs.push({ id: newId('dc'), no: sh.invoiceNo, date: sh.invoiceDate, principalId, kind: ck, orderId: o.id, orderCode: o.code, shipmentId: sh.id, shipmentNo: sh.no, from,
        to: { name: o.partnerName, address: to?.address ? `${to.address.line1}, ${to.address.city}` : '', gstin: ck === 'Consignment' ? (to?.gst ?? '') : from.gstin, state: to?.address?.state ?? from.state },
        lines, value: lines.reduce((s, l) => s + l.value, 0), ewayBill: sh.ewayBill ?? null, status: sh.deliveredAt ? 'Closed' : 'Open', note: ck === 'Consignment' ? 'Stock stays the principal’s until used; billed on use' : 'Transfer within the same GSTIN — not a supply' });
      return;
    }
    const seller = registrationFor(fromState(o, warehouses, partners));
    const p = partners.find((x) => x.id === o.partnerId);
    const bState = p?.gst ? stateOfCode(p.gst.slice(0, 2)) : p?.address?.state ?? seller.state;
    const inter = bState !== seller.state;
    const lines: InvLine[] = sh.allocations.map((a) => {
      const ol = o.lines.find((l) => l.productId === a.productId) ?? o.lines[0];
      const prod = products.find((x) => x.id === a.productId);
      const rate = ol?.netUnit ?? 0; const taxable = Math.round(rate * a.qty * 100) / 100; const gst = ol?.gstPct ?? 0; const tax = Math.round(taxable * gst) / 100;
      return { productId: a.productId, name: prod?.name ?? ol?.name ?? a.productId, hsn: prod?.hsnCode ?? '', batch: `${a.batch}${a.serial ? ` / ${a.serial}` : ''}`, qty: a.qty, rate, taxable, gstPct: gst,
        cgst: inter ? 0 : Math.round((tax / 2) * 100) / 100, sgst: inter ? 0 : Math.round((tax / 2) * 100) / 100, igst: inter ? tax : 0 };
    });
    const taxable = lines.reduce((s, l) => s + l.taxable, 0); const cgst = lines.reduce((s, l) => s + l.cgst, 0); const sgst = lines.reduce((s, l) => s + l.sgst, 0); const igst = lines.reduce((s, l) => s + l.igst, 0);
    const exact = taxable + cgst + sgst + igst; const total = Math.round(exact);
    add.push({ id: newId('inv'), no: sh.invoiceNo, date: sh.invoiceDate, principalId, orderId: o.id, orderCode: o.code, shipmentId: sh.id, shipmentNo: sh.no, seller,
      buyer: { partnerId: o.partnerId, name: o.partnerName, gstin: p?.gst ?? '', state: bState, address: p?.address ? `${p.address.line1}, ${p.address.city} ${p.address.pincode}` : '' },
      placeOfSupply: `${bState} (${STATE_CODES[bState] ?? '—'})`, inter, lines, taxable, cgst, sgst, igst, total, roundOff: Math.round((total - exact) * 100) / 100,
      irn: null, ackNo: null, ackAt: null, ewayBill: null, ewayValidTo: null, vehicleNo: sh.vehicleNo ?? null, status: 'Issued', cancelReason: null,
      history: [{ at: now(), by: 'System', action: `Tax invoice ${sh.invoiceNo} raised for shipment ${sh.no}` }] });
  });
  if (dcs.length) { commit({ ...db(), challans: [...dcs, ...db().challans] }); }
  if (add.length) { commit({ ...db(), invoices: [...add, ...db().invoices] }); add.forEach((i) => emit('invoice.issued', 'Invoicing', 'System', `Invoice ${i.no} — ${i.buyer.name}`, { invoiceId: i.id })); }
  // Credit notes recorded elsewhere (returns credited, claims settled by credit note) appear in the register too.
  const d2 = db(); const known = new Set(d2.credits.map((c) => c.sourceRef));
  const ext: CreditNote[] = [];
  returns().filter((r) => r.principalId === principalId && r.creditNote && !known.has(r.creditNote.no)).forEach((r) => ext.push({ id: newId('cn'), no: r.creditNote!.no, date: r.creditNote!.date, principalId, invoiceId: null, invoiceNo: '—', partnerId: r.partnerId, partnerName: r.partnerName, reason: 'Sales return', source: 'Return', sourceRef: r.creditNote!.no, taxable: r.creditNote!.value, tax: 0, total: r.creditNote!.value, inter: false, irn: null, by: 'Returns' }));
  claims(principalId).filter((c) => c.settlement?.method === 'Credit note' && !known.has(c.settlement.ref)).forEach((c) => ext.push({ id: newId('cn'), no: c.settlement!.ref, date: c.settlement!.at.slice(0, 10), principalId, invoiceId: null, invoiceNo: '—', partnerId: c.partnerId, partnerName: c.partnerName, reason: 'Scheme / discount', source: 'Claim', sourceRef: c.settlement!.ref, taxable: c.approvedAmount ?? 0, tax: 0, total: c.approvedAmount ?? 0, inter: false, irn: null, by: c.settlement!.by }));
  if (ext.length) commit({ ...d2, credits: [...ext, ...d2.credits] });
};

/** E-invoice (B2B only): IRN, acknowledgement number and date. */
export const generateIrn = (id: string, by: string): R => {
  const i = getInvoice(id); if (!i || i.status !== 'Issued') return { ok: false, message: 'Invoice not found or cancelled.' };
  if (!db().settings.einvoice) return { ok: false, message: 'E-invoicing is switched off in settings.' };
  if (i.irn) return { ok: false, message: 'IRN already generated.' };
  if (!i.buyer.gstin) return { ok: false, message: 'B2C sale (buyer has no GSTIN) — e-invoice not required.' };
  const irn = hash(`${i.seller.gstin}${fyOf(i.date)}INV${i.no}`, 64); const ackNo = String(1120000000000 + parseInt(hash(i.no, 7), 16)).slice(0, 15);
  putI({ ...i, irn, ackNo, ackAt: now(), history: [...i.history, { at: now(), by, action: 'E-invoice generated', note: `IRN ${irn.slice(0, 12)}… ack ${ackNo}` }] });
  return { ok: true, message: `IRN generated for ${i.no}.` };
};
/** E-way bill when the value is above the limit. Validity: 1 day per 200 km (default 1 day). */
export const generateEway = (id: string, vehicleNo: string, km: number, by: string): R => {
  const i = getInvoice(id); if (!i || i.status !== 'Issued') return { ok: false, message: 'Invoice not found or cancelled.' };
  if (i.total <= db().settings.ewayLimit) return { ok: false, message: `Not needed — value ₹${i.total.toLocaleString('en-IN')} is within ₹${db().settings.ewayLimit.toLocaleString('en-IN')}.` };
  if (!vehicleNo.trim()) return { ok: false, message: 'Vehicle number is required for Part B.' };
  const ewb = String(100000000000 + (parseInt(hash(`${i.no}${vehicleNo}`, 8), 16) % 899999999999)).slice(0, 12);
  const valid = new Date(Date.now() + Math.max(1, Math.ceil(km / 200)) * 86400000).toISOString().slice(0, 10);
  putI({ ...i, ewayBill: ewb, ewayValidTo: valid, vehicleNo: vehicleNo.toUpperCase(), history: [...i.history, { at: now(), by, action: 'E-way bill generated', note: `${ewb} · ${vehicleNo.toUpperCase()} · valid to ${valid}` }] });
  return { ok: true, message: `E-way bill ${ewb} valid until ${valid}.` };
};
/** Cancel: e-invoices only within 24 h of the IRN; after that, raise a credit note instead. */
export const cancelInvoice = (id: string, reason: string, by: string): R => {
  const i = getInvoice(id); if (!i || i.status !== 'Issued') return { ok: false, message: 'Nothing to cancel.' };
  if (!reason.trim()) return { ok: false, message: 'Give the reason for cancelling.' };
  if (i.irn && i.ackAt && Date.now() - Date.parse(i.ackAt) > 24 * 3600000) return { ok: false, message: 'The IRN is older than 24 hours — it can’t be cancelled. Raise a credit note instead.' };
  putI({ ...i, status: 'Cancelled', cancelReason: reason, history: [...i.history, { at: now(), by, action: 'Cancelled', note: reason }] });
  return { ok: true, message: `${i.no} cancelled.` };
};
export const raiseCreditNote = (invoiceId: string, reason: CnReason, amounts: Record<string, number>, by: string): R => {
  const i = getInvoice(invoiceId); if (!i || i.status !== 'Issued') return { ok: false, message: 'Credit notes are raised against an issued invoice.' };
  const lines = i.lines.map((l, k) => ({ l, amt: Math.min(l.taxable, Math.max(0, amounts[k] ?? 0)) })).filter((x) => x.amt > 0);
  if (!lines.length) return { ok: false, message: 'Enter the taxable amount to credit on at least one line.' };
  const already = db().credits.filter((c) => c.invoiceId === i.id).reduce((a, c) => a + c.taxable, 0);
  const taxable = lines.reduce((a, x) => a + x.amt, 0);
  if (already + taxable > i.taxable + 0.01) return { ok: false, message: `Credits would exceed the invoice (₹${i.taxable.toLocaleString('en-IN')} taxable, ₹${already.toLocaleString('en-IN')} already credited).` };
  const tax = Math.round(lines.reduce((a, x) => a + (x.amt * x.l.gstPct) / 100, 0) * 100) / 100;
  const date = now().slice(0, 10); const no = nextNo(i.seller.gstin, 'CN', date);
  const cn: CreditNote = { id: newId('cn'), no, date, principalId: i.principalId, invoiceId: i.id, invoiceNo: i.no, partnerId: i.buyer.partnerId, partnerName: i.buyer.name, reason, source: 'VinFlux', sourceRef: null,
    taxable, tax, total: Math.round(taxable + tax), inter: i.inter, irn: i.irn ? hash(`${i.seller.gstin}${fyOf(date)}CRN${no}`, 64) : null, by };
  const d = db(); commit({ ...d, credits: [cn, ...d.credits], invoices: d.invoices.map((x) => (x.id === i.id ? { ...x, history: [...x.history, { at: now(), by, action: `Credit note ${no}`, note: `${reason} · ₹${cn.total.toLocaleString('en-IN')}` }] } : x)) });
  return { ok: true, message: `Credit note ${no} for ₹${cn.total.toLocaleString('en-IN')}.` };
};

const words = (n: number): string => {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ` ${a[x % 10]}` : ''}`);
  const three = (x: number) => `${x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' : ''}` : ''}${x % 100 ? two(x % 100) : ''}`;
  if (n === 0) return 'Zero';
  const cr = Math.floor(n / 10000000), lk = Math.floor((n % 10000000) / 100000), th = Math.floor((n % 100000) / 1000), rest = n % 1000;
  return [cr && `${three(cr)} Crore`, lk && `${two(lk)} Lakh`, th && `${two(th)} Thousand`, rest && three(rest)].filter(Boolean).join(' ');
};
/** Printable tax invoice (opens the browser print dialog). */
export const printInvoice = (i: Invoice) => {
  const r2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows = i.lines.map((l, k) => `<tr><td>${k + 1}</td><td>${l.name}<div class="s">Batch ${l.batch}</div></td><td>${l.hsn}</td><td class="r">${l.qty}</td><td class="r">${r2(l.rate)}</td><td class="r">${r2(l.taxable)}</td><td class="r">${l.gstPct}%</td>${i.inter ? `<td class="r">${r2(l.igst)}</td>` : `<td class="r">${r2(l.cgst)}</td><td class="r">${r2(l.sgst)}</td>`}</tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${i.no}</title><style>body{font:12px/1.4 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ccc;padding:5px;vertical-align:top}th{background:#f3f4f6;text-align:left}.r{text-align:right}.s{color:#666;font-size:11px}.g{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.box{border:1px solid #ccc;padding:8px}.tot td{font-weight:700}</style></head><body>
  <div style="display:flex;justify-content:space-between"><div><h1>TAX INVOICE</h1><div class="s">${i.status === 'Cancelled' ? '<b style="color:#b91c1c">CANCELLED</b> · ' : ''}Original for recipient</div></div><div class="r"><b>${i.no}</b><br>Date ${i.date}<br>Order ${i.orderCode} · ${i.shipmentNo}</div></div>
  <div class="g"><div class="box"><b>${i.seller.legalName}</b><br>${i.seller.address}<br>GSTIN ${i.seller.gstin} · ${i.seller.state} (${STATE_CODES[i.seller.state] ?? ''})</div><div class="box"><b>Bill to / Ship to</b><br>${i.buyer.name}<br>${i.buyer.address}<br>GSTIN ${i.buyer.gstin || 'Unregistered'} · Place of supply ${i.placeOfSupply}</div></div>
  ${i.irn ? `<div class="box" style="margin-top:12px"><b>IRN</b> ${i.irn}<br>Ack no ${i.ackNo} · ${i.ackAt?.slice(0, 16).replace('T', ' ')}</div>` : ''}
  <table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">GST</th>${i.inter ? '<th class="r">IGST</th>' : '<th class="r">CGST</th><th class="r">SGST</th>'}</tr></thead><tbody>${rows}
  <tr class="tot"><td colspan="5">Total</td><td class="r">${r2(i.taxable)}</td><td></td>${i.inter ? `<td class="r">${r2(i.igst)}</td>` : `<td class="r">${r2(i.cgst)}</td><td class="r">${r2(i.sgst)}</td>`}</tr></tbody></table>
  <div class="g"><div><b>Amount in words:</b> Rupees ${words(i.total)} only<br><span class="s">Round off ${r2(i.roundOff)}</span>${i.ewayBill ? `<br>E-way bill ${i.ewayBill} · ${i.vehicleNo} · valid to ${i.ewayValidTo}` : ''}<br><br><span class="s">${db().settings.bankDetails}</span><br><span class="s">${db().settings.terms}</span></div><div class="box r"><div style="font-size:16px"><b>Invoice total ₹${i.total.toLocaleString('en-IN')}</b></div><br><br>For ${i.seller.legalName}<br><br><br>Authorised signatory</div></div>
  <script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); }
};

export const challans = (principalId: string) => db().challans.filter((c) => c.principalId === principalId);
export const debitNotes = (principalId: string) => db().debits.filter((c) => c.principalId === principalId);
/** TAX-04: debit note against an invoice — price revised upward, short-billed quantity, freight or interest recovery. */
export const raiseDebitNote = (invoiceId: string, reason: DnReason, amount: number, gstPct: number, by: string): R => {
  const i = getInvoice(invoiceId); if (!i || i.status !== 'Issued') return { ok: false, message: 'Debit notes are raised against an issued invoice.' };
  if (!(amount > 0)) return { ok: false, message: 'Enter the taxable amount to charge.' };
  const tax = Math.round(amount * gstPct) / 100; const date = now().slice(0, 10); const no = nextNo(i.seller.gstin, 'DN', date);
  const dn: DebitNote = { id: newId('dn'), no, date, principalId: i.principalId, invoiceId: i.id, invoiceNo: i.no, partnerId: i.buyer.partnerId, partnerName: i.buyer.name, reason, taxable: amount, tax, total: Math.round(amount + tax), inter: i.inter, irn: i.irn ? hash(`${i.seller.gstin}${fyOf(date)}DBN${no}`, 64) : null, by };
  const d = db(); commit({ ...d, debits: [dn, ...d.debits], invoices: d.invoices.map((x) => (x.id === i.id ? { ...x, history: [...x.history, { at: now(), by, action: `Debit note ${no}`, note: `${reason} · ₹${dn.total.toLocaleString('en-IN')}` }] } : x)) });
  return { ok: true, message: `Debit note ${no} for ₹${dn.total.toLocaleString('en-IN')}.` };
};
