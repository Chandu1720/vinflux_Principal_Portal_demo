/**
 * Order management (principal side) — one simple flow:
 *
 *   Received ─► Validated ─► Confirmed ─► Shipped ─► Completed
 *      │            │            │            │           └ all shipments delivered (proof of delivery)
 *      │            │            │            └ shipment created: invoice (ERP or C&F) + e-way bill + carrier, stock leaves
 *      │            │            └ quantities reserved automatically, partner notified, ERP sales order created
 *      │            └ partner checks + credit pass (credit problems → On hold → Finance releases this order)
 *      └ only partners with a DIRECT link to the company (company warehouse or C&F depot) — others are refused at intake
 *
 * A receipt problem (shortage / damage) after delivery raises a claim; it never blocks completion.
 * INTEGRATION POINT: POST /orders (email parser, portal, EDI), ERP sales order + invoice webhooks, courier APIs.
 */
import type { Product } from '../../types/product.ts';
import type { GtmConfiguration, Partner, PartnerFlowMapping, SalesChannel, SalesFlow, CommercialTermRecord, Territory } from '../gtm-v2/types';
import { creditOf, tradeStatusOf } from '../gtm-v2/utils/health';
import { partnerChannelId } from '../gtm-v2/utils/eligibility';
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { balances, post } from '../inventory/stockStore';
import type { LocType, StockBalance } from '../inventory/stockStore';
import type { Warehouse } from '../../types/warehouse';
import { masterOf, sourceOf, staleSync } from '../../platform/integrations/stockSync';
import { erpDocNo, erpProfile } from '../../platform/integrations/erpProfiles';
import { callErp, isLive } from '../../platform/integrations/liveClient';
import { connectorSettings } from '../../platform/integrations/connectors';
import type { StockSource } from '../inventory/stockSource';

export type OrderStatus = 'Received' | 'Validated' | 'On hold' | 'Confirmed' | 'Shipped' | 'Completed' | 'Rejected' | 'Cancelled';
export const FLOW: OrderStatus[] = ['Received', 'Validated', 'Confirmed', 'Shipped', 'Completed'];
export type OrderSource = 'Email' | 'Portal' | 'Field app' | 'Phone' | 'EDI';
export interface OrderLine {
  id: string; productId: string; variantSku: string | null; name: string; qty: number;
  confirmedQty: number; shippedQty: number; backorderQty: number; backorderDate: string | null; substituteFor: string | null;
  unitPrice: number | null; netUnit: number | null; gstPct: number; freeQty: number; priceSource: string;
}
export interface Allocation { lineId: string; bin?: string; productId: string; variantSku: string | null; batch: string; serial: string | null; mfgDate: string | null; expiryDate: string | null; qty: number; unitCost: number | null }
export interface Shipment {
  id: string; no: string; allocations: Allocation[];
  invoiceNo: string; invoiceDate: string; irn: string; ewayBill: string | null;
  carrier: string; awb: string; dispatchedAt: string; eta: string;
  deliveredAt: string | null; pod: { receivedBy: string; method: 'Signature' | 'Photo' | 'OTP' } | null;
  problem: { shortQty: number; damagedQty: number; claimNos: string[]; at: string } | null;
  /** Logistics details. */
  tripNo?: string | null; vehicleNo?: string; driver?: string; packages?: number; weightKg?: number; freight?: number;
  /** Who raised the invoice and how stock was handled. */
  invoiceBy?: 'ERP' | 'VinFlux' | 'C&F' | 'Manual'; stockSource?: StockSource;
}
export interface ShipInfo { carrier: string; awb: string; etaDays: number; vehicleNo?: string; driver?: string; packages?: number; weightKg?: number; freight?: number; tripNo?: string | null; invoiceNo?: string; irn?: string | null; ewayBill?: string | null }
export interface Order {
  id: string; code: string; principalId: string;
  partnerId: string; partnerName: string; partnerTypeId: string; channelId: string | null;
  orderType: 'Sale' | 'Consignment' | 'Stock transfer';
  shipFrom: { locType: 'COMPANY' | 'CNF'; id: string; name: string };
  poNumber: string; poDate: string; requiredBy: string; source: OrderSource; notes: string;
  /** Email the order came from (email intake). */
  emailId: string | null;
  lines: OrderLine[];
  status: OrderStatus;
  /** Why the order can't be validated (non-credit checks), or why it is on hold. */
  blockers: string[];
  creditRelease: { by: string; at: string; note: string } | null;
  erpSalesOrder: string | null;
  /** Live ERP: state of the sales order sent through the integration service. */
  erpRef?: { connector: string; status: 'Sending' | 'Sent' | 'Failed'; erpId?: string; error?: string; at: string } | null;
  shipments: Shipment[];
  parentId: string | null;
  rejectReason: string | null;
  createdBy: string; createdAt: string;
  history: { at: string; by: string; action: string; note?: string }[];
}

/* -------------------------------- Context -------------------------------- */

export interface OrderCtx {
  products: Product[];
  config: GtmConfiguration; partners: Partner[]; channels: SalesChannel[]; flows: SalesFlow[]; mappings: PartnerFlowMapping[];
  terms: CommercialTermRecord[]; territories: Territory[];
  warehouses?: Warehouse[];
}
export type CheckState = 'pass' | 'warn' | 'hold' | 'fail';
export interface Check { id: string; label: string; state: CheckState; detail: string }

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const daysTo = (iso: string | null) => (iso ? Math.round((Date.parse(iso) - Date.parse(today())) / 86400000) : Infinity);

/** Where a partner's company orders come from: company warehouse, a C&F depot (agent), or a reseller (not a company order). */
export const routeOf = (partnerId: string, ctx: Pick<OrderCtx, 'mappings' | 'channels' | 'partners'>) => {
  const links = ctx.mappings.filter((m) => m.partnerId === partnerId && m.status === 'Active').flatMap((m) => m.suppliers ?? []);
  const viaCompany = links.find((l) => l.kind === 'COMPANY');
  if (viaCompany) return { ok: true as const, shipFrom: { locType: 'COMPANY' as const, id: viaCompany.warehouseId ?? '', name: '' }, text: 'Buys directly from the company' };
  const viaAgent = links.find((l) => l.kind === 'PARTNER' && ctx.channels.find((c) => c.id === l.channelId)?.tradeModel === 'AGENT');
  if (viaAgent) {
    const p = ctx.partners.find((x) => x.id === viaAgent.partnerId);
    return { ok: true as const, shipFrom: { locType: 'CNF' as const, id: viaAgent.partnerId ?? '', name: `${p?.name ?? 'C&F'} depot` }, text: `Company stock shipped from ${p?.name ?? 'the C&F'} depot` };
  }
  const reseller = links.find((l) => l.kind === 'PARTNER');
  if (reseller) {
    const p = ctx.partners.find((x) => x.id === reseller.partnerId);
    return { ok: false as const, shipFrom: null, text: `Buys from ${p?.name ?? 'another partner'} — the order should go to them, not to the company` };
  }
  return { ok: false as const, shipFrom: null, text: 'No supply link — set up the partner’s supply chain in Go-to-Market first' };
};

/** Who owns the stock at the ship-from location. C&F depots are always kept in VinFlux. */
export const shipFromSource = (o: Pick<Order, 'shipFrom'>, ctx: Pick<OrderCtx, 'warehouses'>): StockSource =>
  o.shipFrom.locType === 'CNF' ? 'VINFLUX' : sourceOf(o.shipFrom.id, { warehouses: ctx.warehouses ?? [] });

/** Minimum days of shelf life the buyer must receive (from the product's tracking rules). */
export const minShelfDays = (p: Product | undefined, institution: boolean) => (institution ? p?.trackingRules?.minShelfLifeInstitutionDays : p?.trackingRules?.minShelfLifeDistributorDays) ?? 0;

/** Reserved by confirmed orders not yet shipped, per location × product × variant. */
export const reservations = (exceptOrderId?: string) => {
  const m = new Map<string, number>();
  orders().filter((o) => o.id !== exceptOrderId && o.status === 'Confirmed').forEach((o) => o.lines.forEach((l) => {
    const k = `${o.shipFrom.id}|${l.productId}|${l.variantSku ?? ''}`;
    m.set(k, (m.get(k) ?? 0) + Math.max(0, l.confirmedQty + l.freeQty - l.shippedQty));
  }));
  return m;
};

/** Sellable stock at a location for a product: available status and enough shelf life, oldest expiry first. */
export const eligibleStock = (locationId: string, productId: string, variantSku: string | null, minDays: number, all: StockBalance[] = balances()) =>
  all.filter((b) => b.warehouseId === locationId && b.productId === productId && (b.variantSku ?? null) === (variantSku ?? null) && b.status === 'Available' && b.qty > 0 && daysTo(b.expiryDate) >= minDays)
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));

/** Available to promise = eligible stock − reserved by other orders. */
export const atp = (locationId: string, productId: string, variantSku: string | null, minDays: number, exceptOrderId?: string) => {
  const on = eligibleStock(locationId, productId, variantSku, minDays).reduce((a, b) => a + b.qty, 0);
  const res = reservations(exceptOrderId).get(`${locationId}|${productId}|${variantSku ?? ''}`) ?? 0;
  return Math.max(0, on - res);
};

export const orderValue = (o: Pick<Order, 'lines'>, confirmed = false) => o.lines.reduce((a, l) => a + (l.netUnit ?? 0) * (confirmed ? l.confirmedQty : l.qty) * (1 + l.gstPct / 100), 0);

/** Every check an order must pass before it can be confirmed. */
export const evaluate = (o: Order, ctx: OrderCtx): Check[] => {
  const out: Check[] = [];
  const p = ctx.partners.find((x) => x.id === o.partnerId);
  if (!p) return [{ id: 'partner', label: 'Partner', state: 'fail', detail: 'Partner not found.' }];
  const g = { channels: ctx.channels, terms: ctx.terms, territories: ctx.territories };
  const ts = tradeStatusOf(p, ctx.config, g);
  out.push({ id: 'relationship', label: 'Relationship active', state: p.status === 'Active' ? 'pass' : 'fail', detail: p.status === 'Active' ? 'Partner is active' : `Partner is ${p.status}` });
  const lic = ts.reasons.filter((r) => /expired|validity|expires/.test(r.text));
  const licBlocked = lic.some((r) => r.tone === 'red');
  out.push({ id: 'licence', label: 'Partner licences valid', state: licBlocked ? 'fail' : lic.length ? 'warn' : 'pass', detail: lic.length ? lic.map((r) => r.text).join('; ') : 'All tracked licences valid' });
  const route = routeOf(p.id, ctx);
  out.push({ id: 'route', label: 'Sales route', state: route.ok ? 'pass' : 'fail', detail: route.text });
  const flows = ctx.flows.filter((f) => p.flowIds.includes(f.id) && f.status === 'Active');
  const unauthorised = o.lines.filter((l) => {
    const prod = ctx.products.find((x) => x.id === l.productId);
    return !flows.some((f) => f.productScope.allProducts || f.productScope.productIds.includes(l.productId) || (!!prod && (f.productScope.portfolioIds.includes(prod.portfolioId) || f.productScope.categoryIds.includes(prod.categoryId))));
  });
  if (o.orderType === 'Stock transfer') unauthorised.length = 0;
  out.push({ id: 'authorised', label: 'Products authorised', state: unauthorised.length ? 'fail' : 'pass', detail: unauthorised.length ? `Not in the partner’s sales policies: ${unauthorised.map((l) => l.name).join(', ')}` : 'All products are in the partner’s sales policies' });
  const prodIssues = o.lines.flatMap((l) => {
    const prod = ctx.products.find((x) => x.id === l.productId);
    if (!prod) return [`${l.name}: not in Product Master`];
    const e: string[] = [];
    if (prod.lifecycleStatus !== 'Active') e.push(`${prod.name} is ${prod.lifecycleStatus}`);
    const until = prod.regulatory?.licenceValidUntil;
    if (until && until < today()) e.push(`${prod.name}: manufacturing / import licence expired ${until}`);
    return e;
  });
  out.push({ id: 'product', label: 'Products sellable', state: prodIssues.length ? 'fail' : 'pass', detail: prodIssues.length ? prodIssues.join('; ') : 'Active, product licences valid' });
  const unpriced = o.lines.filter((l) => l.netUnit === null);
  out.push({ id: 'price', label: 'Price found', state: unpriced.length ? 'fail' : 'pass', detail: unpriced.length ? `No price list or contract covers: ${unpriced.map((l) => l.name).join(', ')}` : [...new Set(o.lines.map((l) => l.priceSource))].join(' · ') });
  const overCap = o.lines.filter((l) => {
    const ref = ctx.products.find((x) => x.id === l.productId)?.pricingReference;
    return ref?.govPriceCapEnforced && ref.govNpddCeiling && (l.netUnit ?? 0) * (1 + l.gstPct / 100) > ref.govNpddCeiling;
  });
  out.push({ id: 'cap', label: 'Government price cap', state: overCap.length ? 'fail' : 'pass', detail: overCap.length ? `Above the NPPA ceiling: ${overCap.map((l) => l.name).join(', ')}` : 'Within ceiling' });
  const channel = ctx.channels.find((c) => c.id === partnerChannelId(p, ctx.config.partnerTypes));
  const value = orderValue(o);
  if (o.orderType === 'Stock transfer') {
    // Replenishing a C&F depot: company stock moves, nothing is sold — no MOV or credit check.
    const inst0 = false;
    if (shipFromSource(o, ctx) === 'NONE') { out.push({ id: 'credit', label: 'Credit', state: 'pass', detail: 'Stock transfer — no credit needed' }); return out; }
    const short0 = o.lines.filter((l) => atp(o.shipFrom.id, l.productId, l.variantSku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst0), o.id) < l.qty);
    out.push({ id: 'credit', label: 'Credit', state: 'pass', detail: 'Stock transfer to the company’s own agent — no credit needed' });
    out.push({ id: 'stock', label: 'Stock (with shelf life)', state: short0.length ? 'warn' : 'pass', detail: short0.length ? `Short at ${o.shipFrom.name}: ${short0.map((l) => l.name).join(', ')}` : `Available at ${o.shipFrom.name}` });
    return out;
  }
  const mov = channel?.terms.minOrderValue ?? 0;
  out.push({ id: 'mov', label: 'Minimum order value', state: mov && value < mov ? 'warn' : 'pass', detail: mov ? `₹${Math.round(value).toLocaleString('en-IN')} vs minimum ₹${mov.toLocaleString('en-IN')}` : 'No minimum for this channel' });
  const c = creditOf(p, ctx.config, g);
  const cfg = ctx.config.compliance;
  let credit: Check = { id: 'credit', label: 'Credit', state: 'pass', detail: c.state === 'n/a' ? 'No credit account (advance / on account)' : `₹${(c.available / 100000).toFixed(1)} L available of ₹${(c.limit / 100000).toFixed(1)} L` };
  if (c.state === 'hold') credit = { ...credit, state: 'hold', detail: `On credit hold: ${p.credit?.hold?.reason}` };
  else if (c.limit > 0 && c.outstanding + value > c.limit) credit = { ...credit, state: cfg.blockWhenOverLimit ? 'hold' : 'warn', detail: `Over limit by ₹${((c.outstanding + value - c.limit) / 100000).toFixed(2)} L (outstanding ₹${(c.outstanding / 100000).toFixed(1)} L + this order)` };
  else if (c.overdue > 0) credit = { ...credit, state: cfg.blockWhenOverdue ? 'hold' : 'warn', detail: `Overdue ₹${(c.overdue / 100000).toFixed(1)} L` };
  if ((credit.state === 'hold') && o.creditRelease) credit = { ...credit, state: 'warn', detail: `${credit.detail} — released for this order by ${o.creditRelease.by}` };
  out.push(credit);
  const inst = !!p.institution;
  const src = shipFromSource(o, ctx);
  if (src === 'NONE') {
    out.push({ id: 'stock', label: 'Stock', state: 'pass', detail: `Not tracked at ${o.shipFrom.name} (orders only) — batch / serial are entered at shipment` });
    return out;
  }
  const stale = src === 'ERP' ? staleSync(o.shipFrom.id, { warehouses: ctx.warehouses ?? [] }) : null;
  if (stale) out.push({ id: 'fresh', label: 'Stock freshness', state: 'warn', detail: `Stock as of ${Number.isFinite(stale.hours) ? `${stale.hours} h ago` : 'never synced'} (${stale.connector}) — sync before confirming` });
  const short = o.lines.filter((l) => atp(o.shipFrom.id, l.productId, l.variantSku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst), o.id) < l.qty + l.freeQty);
  out.push({ id: 'stock', label: 'Stock (with shelf life)', state: short.length ? 'warn' : 'pass', detail: short.length ? `Short at ${o.shipFrom.name || 'ship-from'}: ${short.map((l) => l.name).join(', ')} — part-confirm, backorder or substitute` : `Available at ${o.shipFrom.name}` });
  const free = o.lines.filter((l) => l.freeQty > 0);
  if (free.length) out.push({ id: 'scheme', label: 'Scheme', state: 'pass', detail: free.map((l) => `${l.name}: ${l.freeQty} free`).join('; ') });
  return out;
};
export const verdict = (checks: Check[]): 'Blocked' | 'Needs approval' | 'Ready' =>
  checks.some((c) => c.state === 'fail') ? 'Blocked' : checks.some((c) => c.state === 'hold') ? 'Needs approval' : 'Ready';

/* ---------------------------------- Store ---------------------------------- */

interface Db { orders: Order[]; seq: number; claims: Claim[]; shipSeq: number }
export interface Claim { id: string; no: string; orderId: string; orderCode: string; shipmentNo: string; partnerName: string; kind: 'Shortage' | 'Damage'; qty: number; value: number; status: 'Open' | 'Settled'; raisedAt: string }
let cache: Db | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.orders.v2');
const db = (): Db => (cache ??= loadJson<Db>(KEY(), { orders: [], seq: 1000, claims: [], shipSeq: 0 }));
const commit = (d: Db) => { cache = d; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeOrders = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const orders = () => db().orders;
export const claims = () => db().claims;
export const getOrder = (id: string) => db().orders.find((o) => o.id === id) ?? null;
const put = (o: Order) => { const d = db(); commit({ ...d, orders: d.orders.some((x) => x.id === o.id) ? d.orders.map((x) => (x.id === o.id ? o : x)) : [o, ...d.orders] }); };
const log = (o: Order, by: string, action: string, note?: string): Order => ({ ...o, history: [...o.history, { at: now(), by, action, note }] });
type Result = { ok: boolean; message: string; errors?: string[] };
export const inTransit = () => db().orders.flatMap((o) => o.shipments.filter((s) => !s.deliveredAt).map((s) => ({ order: o, shipment: s })));

/** Run the checks and move the order to Validated, On hold (credit) or keep it Received (blocked). */
export const validate = (id: string, ctx: OrderCtx, by: string): Result => {
  const o = getOrder(id);
  if (!o || !['Received', 'On hold', 'Validated'].includes(o.status)) return { ok: false, message: 'Only open orders are validated.' };
  const checks = evaluate(o, ctx);
  const fails = checks.filter((c) => c.state === 'fail').map((c) => `${c.label}: ${c.detail}`);
  const holds = checks.filter((c) => c.state === 'hold').map((c) => `${c.label}: ${c.detail}`);
  const status: OrderStatus = fails.length ? 'Received' : holds.length ? 'On hold' : 'Validated';
  if (status === o.status && JSON.stringify(o.blockers) === JSON.stringify([...fails, ...holds])) return { ok: status === 'Validated', message: status };
  put(log({ ...o, status, blockers: [...fails, ...holds] }, by, status === 'Validated' ? 'Validated — partner and credit checks passed' : status === 'On hold' ? 'On hold — credit' : 'Checks failed', [...fails, ...holds].join(' · ') || undefined));
  return { ok: status === 'Validated', message: status === 'Validated' ? `${o.code} validated.` : status === 'On hold' ? `${o.code} is on credit hold — Finance can release it.` : `${o.code} fails a check.` };
};

export interface NewOrderInput {
  principalId: string; partner: Partner; channelId: string | null; orderType: Order['orderType'];
  shipFrom: Order['shipFrom']; poNumber: string; poDate: string; requiredBy: string; source: OrderSource; notes: string; emailId?: string | null;
  lines: Omit<OrderLine, 'id' | 'confirmedQty' | 'shippedQty' | 'backorderQty' | 'backorderDate' | 'substituteFor'>[];
}
export const createOrder = (n: NewOrderInput, by: string, ctx: OrderCtx | null, parentId: string | null = null): Result & { id?: string } => {
  const errs: string[] = [];
  if (!n.poNumber.trim()) errs.push('Partner PO number is required.');
  if (!n.lines.length) errs.push('Add at least one product.');
  n.lines.forEach((l, i) => { if (!(l.qty > 0)) errs.push(`Line ${i + 1}: quantity must be more than 0.`); });
  if (!n.shipFrom.id) errs.push('Choose where the order ships from.');
  if (errs.length) return { ok: false, message: 'Can’t create the order.', errors: errs };
  const d = db();
  const seq = d.seq + 1;
  const o: Order = {
    id: newId('ord'), code: `SO-26-${seq}`, principalId: n.principalId, partnerId: n.partner.id, partnerName: n.partner.name, partnerTypeId: n.partner.partnerTypeId, channelId: n.channelId,
    orderType: n.orderType, shipFrom: n.shipFrom, poNumber: n.poNumber, poDate: n.poDate, requiredBy: n.requiredBy, source: n.source, notes: n.notes, emailId: n.emailId ?? null,
    lines: n.lines.map((l) => ({ ...l, id: newId('ol'), confirmedQty: 0, shippedQty: 0, backorderQty: 0, backorderDate: null, substituteFor: null })),
    status: 'Received', blockers: [], creditRelease: null, erpSalesOrder: null, shipments: [], parentId, rejectReason: null, createdBy: by, createdAt: today(),
    history: [{ at: now(), by, action: parentId ? 'Backorder released as a new order' : `Order received (${n.source})` }],
  };
  commit({ ...d, seq, orders: [o, ...d.orders] });
  if (ctx) validate(o.id, ctx, 'System');
  return { ok: true, message: `${o.code} created.`, id: o.id };
};

/** Finance releases ONE order despite the credit position (not the person who entered it). */
export const releaseCredit = (id: string, note: string, ctx: OrderCtx, by: string): Result => {
  const o = getOrder(id);
  if (!o || o.status !== 'On hold') return { ok: false, message: 'Only orders on credit hold can be released.' };
  if (o.createdBy === by) return { ok: false, message: 'Maker-checker: you entered this order, so someone else must release it.' };
  if (!note.trim()) return { ok: false, message: 'Write why the order may go (e.g. payment received, cheque details).' };
  put(log({ ...o, creditRelease: { by, at: now(), note } }, by, 'Credit released for this order', note));
  validate(id, ctx, by);
  return { ok: true, message: `Credit released — ${o.code} is validated.` };
};

export interface LineDecision { confirm: number; backorderDate: string | null; substituteSku: string | null }
/** Confirm: quantities are reserved automatically, the partner is notified and (company warehouse) an ERP sales order is created. */
export const confirmOrder = (id: string, decisions: Record<string, LineDecision>, ctx: OrderCtx, by: string, erpName = 'ERP'): Result => {
  const o = getOrder(id);
  if (!o || o.status !== 'Validated') return { ok: false, message: 'Only validated orders can be confirmed.' };
  const inst = !!ctx.partners.find((p) => p.id === o.partnerId)?.institution;
  const src = shipFromSource(o, ctx);
  const errs: string[] = [];
  const lines = o.lines.map((l) => {
    const dcs = decisions[l.id] ?? { confirm: l.qty, backorderDate: null, substituteSku: null };
    const sku = dcs.substituteSku ?? l.variantSku;
    const avail = atp(o.shipFrom.id, l.productId, sku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst), o.id);
    if (dcs.confirm < 0 || dcs.confirm > l.qty) errs.push(`${l.name}: confirm between 0 and ${l.qty}.`);
    const free = dcs.confirm < l.qty ? Math.floor(l.freeQty * (dcs.confirm / l.qty)) : l.freeQty;
    if (src !== 'NONE' && dcs.confirm + free > avail) errs.push(`${l.name}: only ${avail} available to promise${sku !== l.variantSku ? ` for ${sku}` : ''}.`);
    const back = l.qty - dcs.confirm;
    if (back > 0 && !dcs.backorderDate) errs.push(`${l.name}: give a date for the ${back} on backorder.`);
    return { ...l, variantSku: sku, substituteFor: sku !== l.variantSku ? l.variantSku : l.substituteFor, name: l.name + (sku !== l.variantSku ? ` → substituted ${sku}` : ''), confirmedQty: dcs.confirm, backorderQty: back, backorderDate: back > 0 ? dcs.backorderDate : null, freeQty: free };
  });
  if (!lines.some((l) => l.confirmedQty > 0)) errs.push('Nothing to confirm — reject the order or wait for stock.');
  if (errs.length) return { ok: false, message: 'Can’t confirm.', errors: errs };
  const erpId = src === 'ERP' ? masterOf(o.shipFrom.id, { warehouses: ctx.warehouses ?? [] }) : null;
  if (erpId) erpName = erpProfile(erpId)?.name ?? erpName;
  const live = isLive(erpId);
  const so = live ? null : src === 'ERP' ? erpDocNo(erpId, 'SO', db().seq + o.lines.length * 3 + Number(o.code.replace(/\D/g, '').slice(-3))) : null;
  const back = lines.filter((l) => l.backorderQty > 0);
  let next = log({ ...o, lines, status: 'Confirmed', erpSalesOrder: so, blockers: [] }, by, back.length ? `Confirmed; ${back.reduce((a, l) => a + l.backorderQty, 0)} unit(s) on backorder` : 'Confirmed in full', src === 'NONE' ? 'Stock not tracked at this warehouse — nothing reserved' : 'Quantities reserved');
  next = log(next, 'System', `${o.partnerName} notified (email, WhatsApp, portal)`, `Confirmed quantities${back.length ? ', backorder dates' : ''} and expected dispatch`);
  if (so) next = log(next, 'System', `Sales order ${so} created in ${erpName}`);
  if (live && erpId) next = log({ ...next, erpRef: { connector: erpId, status: 'Sending', at: now() } }, 'System', `Sending the sales order to ${erpName}…`);
  put(next);
  if (live && erpId) void pushSalesOrder(o.id, ctx);
  emit('order.confirmed', 'Orders', by, `${o.code} confirmed for ${o.partnerName}`, { orderId: o.id });
  return { ok: true, message: `${o.code} confirmed — ${src === 'NONE' ? 'no stock tracked' : 'stock reserved'}, ${o.partnerName} notified${so ? `, ${so} created in ${erpName}` : live ? `; sending the sales order to ${erpName}` : ''}.` };
};

export const rejectOrder = (id: string, reason: string, by: string): Result => {
  const o = getOrder(id);
  if (!o || !['Received', 'Validated', 'On hold'].includes(o.status)) return { ok: false, message: 'Only open orders can be rejected.' };
  if (!reason.trim()) return { ok: false, message: 'Give the reason — the partner sees it.' };
  put(log({ ...o, status: 'Rejected', rejectReason: reason }, by, 'Rejected — partner notified', reason));
  return { ok: true, message: `${o.code} rejected; ${o.partnerName} notified.` };
};
export const cancelOrder = (id: string, reason: string, by: string): Result => {
  const o = getOrder(id);
  if (!o || o.status !== 'Confirmed' || o.shipments.length) return { ok: false, message: 'Only confirmed orders with nothing shipped can be cancelled.' };
  if (!reason.trim()) return { ok: false, message: 'Give a reason.' };
  put(log({ ...o, status: 'Cancelled' }, by, `Cancelled — reservation released${o.erpSalesOrder ? `; ${o.erpSalesOrder} cancelled in the ERP` : ''}`, reason));
  return { ok: true, message: `${o.code} cancelled.` };
};

/** Pick batches / serials oldest-expiry-first with enough shelf life, for the quantities to ship now. */
const allocate = (o: Order, qty: Record<string, number>, ctx: OrderCtx): { allocations: Allocation[]; errors: string[] } => {
  const inst = !!ctx.partners.find((p) => p.id === o.partnerId)?.institution;
  const allocations: Allocation[] = [];
  const errors: string[] = [];
  const all = balances();
  o.lines.forEach((l) => {
    let need = qty[l.id] ?? 0;
    if (need <= 0) return;
    eligibleStock(o.shipFrom.id, l.productId, l.variantSku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst), all).forEach((b) => {
      if (need <= 0) return;
      const take = Math.min(need, b.qty);
      allocations.push({ lineId: l.id, bin: b.bin, productId: l.productId, variantSku: l.variantSku, batch: b.batch, serial: b.serial, mfgDate: b.mfgDate, expiryDate: b.expiryDate, qty: take, unitCost: b.unitCost });
      need -= take;
    });
    if (need > 0) errors.push(`${l.name}: ${need} unit(s) no longer in stock at ${o.shipFrom.name}.`);
  });
  return { allocations, errors };
};

/** Remaining quantity to ship per line (confirmed + free − shipped). */
export const toShip = (o: Order) => Object.fromEntries(o.lines.map((l) => [l.id, Math.max(0, l.confirmedQty + l.freeQty - l.shippedQty)]));

/**
 * Create a shipment: invoice (ERP for company warehouses, VinFlux at a C&F) and e-way bill are raised with it,
 * batches / serials are picked, stock leaves the ship-from location into transit, the partner gets tracking.
 */
export interface ShipOpts {
  /** ERP master: tell the ERP to issue the stock (demo sandbox). */
  onErpIssue?: (warehouseId: string, a: Allocation[]) => void;
  /** Orders-only warehouses: batches / serials typed in by the shipper. */
  manual?: Omit<Allocation, 'productId' | 'variantSku' | 'mfgDate' | 'unitCost' | 'bin'>[];
}
export const createShipment = (id: string, qty: Record<string, number>, info: ShipInfo, ctx: OrderCtx, by: string, opts: ShipOpts = {}): Result => {
  const o = getOrder(id);
  if (!o || o.status !== 'Confirmed') return { ok: false, message: 'Confirm the order first.' };
  if (!info.carrier.trim() || !info.awb.trim()) return { ok: false, message: 'Carrier and AWB / LR number are required.' };
  const remaining = toShip(o);
  const errs = o.lines.filter((l) => (qty[l.id] ?? 0) > remaining[l.id]).map((l) => `${l.name}: only ${remaining[l.id]} left to ship.`);
  if (!Object.values(qty).some((x) => x > 0)) errs.push('Nothing selected to ship.');
  if (errs.length) return { ok: false, message: 'Can’t create the shipment.', errors: errs };
  const src = shipFromSource(o, ctx);
  let allocations: Allocation[];
  if (src === 'NONE') {
    // Stock isn't tracked here: the shipper types the batches / serials (traceability still needed).
    const manual = opts.manual ?? [];
    const merr: string[] = [];
    o.lines.forEach((l) => {
      const need = qty[l.id] ?? 0;
      if (need <= 0) return;
      const rows = manual.filter((m) => m.lineId === l.id && m.qty > 0);
      const got = rows.reduce((a, m) => a + m.qty, 0);
      if (got !== need) merr.push(`${l.name}: enter batch details for ${need} unit(s) (entered ${got}).`);
      if (rows.some((m) => !m.batch.trim())) merr.push(`${l.name}: batch / lot is required.`);
      const serialised = (ctx.products.find((p) => p.id === l.productId)?.trackingMode ?? '').includes('Serial');
      if (serialised && rows.some((m) => !m.serial?.trim() || m.qty !== 1)) merr.push(`${l.name}: serial-tracked — one serial number per unit.`);
    });
    if (merr.length) return { ok: false, message: 'Batch / serial details needed.', errors: merr };
    allocations = manual.filter((m) => m.qty > 0 && (qty[m.lineId] ?? 0) > 0).map((m) => { const l = o.lines.find((x) => x.id === m.lineId)!; return { ...m, bin: '', productId: l.productId, variantSku: l.variantSku, mfgDate: null, unitCost: null, serial: m.serial?.trim() || null, batch: m.batch.trim() }; });
  } else {
    const r = allocate(o, qty, ctx);
    if (r.errors.length) return { ok: false, message: 'Stock changed since confirmation.', errors: r.errors };
    allocations = r.allocations;
  }
  const cnf = o.shipFrom.locType === 'CNF';
  if (src === 'ERP' && !cnf && o.erpRef && !info.invoiceNo?.trim()) return { ok: false, message: `Bill the sales order in ${erpProfile(o.erpRef.connector)?.name ?? 'the ERP'} first, then fetch the invoice here.`, errors: o.erpRef.status !== 'Sent' ? ['The sales order has not reached the ERP yet — retry sending it from the order.'] : [] };
  const invoiceBy: Shipment['invoiceBy'] = cnf ? 'C&F' : src === 'ERP' ? 'ERP' : src === 'VINFLUX' ? 'VinFlux' : info.invoiceNo?.trim() ? 'Manual' : 'VinFlux';
  const d = db();
  const n = d.shipSeq + 1;
  const value = allocations.reduce((a, x) => { const l = o.lines.find((y) => y.id === x.lineId)!; return a + (l.netUnit ?? 0) * x.qty * (1 + l.gstPct / 100); }, 0);
  const prefix = invoiceBy === 'C&F' ? 'CNF' : invoiceBy === 'ERP' ? 'INV' : 'VF-INV';
  const sh: Shipment = {
    id: newId('shp'), no: `SHP-26-${String(n).padStart(4, '0')}`, allocations,
    invoiceNo: info.invoiceNo?.trim() || (invoiceBy === 'ERP' ? erpDocNo(masterOf(o.shipFrom.id, { warehouses: ctx.warehouses ?? [] }), 'INV', n) : `${prefix}-26-${String(7000 + n)}`), invoiceDate: today(),
    irn: o.erpRef ? (info.irn ?? '') : Array.from({ length: 4 }, (_, i) => ((Date.now() / (i + 7)) % 1e8).toString(16).replace('.', '').slice(0, 8)).join(''),
    ewayBill: o.erpRef ? (info.ewayBill ?? null) : value > 50000 ? `EWB-${String(Math.floor(Date.now() / 1000) + n).slice(-10)}` : null,
    carrier: info.carrier, awb: info.awb, dispatchedAt: now(), eta: new Date(Date.now() + info.etaDays * 86400000).toISOString().slice(0, 10), deliveredAt: null, pod: null, problem: null,
    tripNo: info.tripNo ?? null, vehicleNo: info.vehicleNo, driver: info.driver, packages: info.packages, weightKg: info.weightKg, freight: info.freight, invoiceBy, stockSource: src,
  };
  const transit = allocations.map((a) => ({ type: 'TRANSFER_IN' as const, locType: 'TRANSIT' as const, warehouseId: o.partnerId, bin: sh.no, productId: a.productId, variantSku: a.variantSku, batch: a.batch, serial: a.serial, mfgDate: a.mfgDate, expiryDate: a.expiryDate, qty: a.qty, unitCost: a.unitCost, status: 'Available' as const, importId: null, source: `Shipment ${sh.no}`, by, refId: o.id }));
  const issue = src === 'NONE' ? [] : allocations.map((a) => ({ type: 'ISSUE' as const, locType: o.shipFrom.locType as LocType, warehouseId: o.shipFrom.id, bin: a.bin ?? '', productId: a.productId, variantSku: a.variantSku, batch: a.batch, serial: a.serial, mfgDate: a.mfgDate, expiryDate: a.expiryDate, qty: -a.qty, unitCost: a.unitCost, status: 'Available' as const, importId: null, source: `Invoice ${sh.invoiceNo}`, by, refId: o.id }));
  post([...issue, ...transit]);
  if (src === 'ERP' && !cnf) opts.onErpIssue?.(o.shipFrom.id, allocations);
  const lines = o.lines.map((l) => ({ ...l, shippedQty: l.shippedQty + (qty[l.id] ?? 0) }));
  const allShipped = lines.every((l) => l.shippedQty >= l.confirmedQty + l.freeQty);
  const invText = invoiceBy === 'ERP' ? 'ERP invoice' : invoiceBy === 'C&F' ? 'C&F invoice' : invoiceBy === 'Manual' ? 'Invoice' : 'VinFlux invoice';
  let next = log({ ...o, lines, shipments: [...o.shipments, sh], status: allShipped ? 'Shipped' : 'Confirmed' }, by,
    `Shipment ${sh.no} created${allShipped ? '' : ' (part of the order)'} — ${info.carrier} ${info.awb}${sh.tripNo ? ` · trip ${sh.tripNo}` : ''}`, `${invText} ${sh.invoiceNo}, e-invoice IRN${sh.ewayBill ? `, e-way bill ${sh.ewayBill}` : ''}${src === 'NONE' ? ' · stock not tracked at the warehouse' : ''}`);
  next = log(next, 'System', `Tracking sent to ${o.partnerName}`, `ETA ${sh.eta}`);
  commit({ ...d, shipSeq: n, orders: d.orders.map((x) => (x.id === o.id ? next : x)) });
  emit('order.dispatched', 'Orders', by, `${o.code}: shipment ${sh.no} (${info.carrier} ${info.awb})`, { orderId: o.id });
  return { ok: true, message: `${sh.no} created — invoice ${sh.invoiceNo}${sh.ewayBill ? `, e-way bill ${sh.ewayBill}` : ''}, tracking sent.` };
};

/** Every shipment with its order (for Logistics). */
export const allShipments = () => db().orders.flatMap((o) => o.shipments.map((s) => ({ order: o, shipment: s })));
let tripSeq = 0;
export const nextTripNo = () => `TRP-26-${String((Date.now() / 1000 | 0) % 100000 + (++tripSeq)).padStart(5, '0')}`;

/** Where the goods end up after delivery (null = consumed by a hospital, no stock kept). */
export const destinationOf = (o: Order, partners: Partner[]): LocType | null => {
  const p = partners.find((x) => x.id === o.partnerId);
  if (!p) return null;
  if (p.partnerTypeId === 'pt-cnf') return 'CNF';
  if (p.institution) return o.orderType === 'Consignment' ? 'HOSPITAL' : null;
  return 'PARTNER';
};

/** Proof of delivery. When every shipment is delivered the order is Completed. */
export const deliverShipment = (id: string, shipmentId: string, receivedBy: string, method: 'Signature' | 'Photo' | 'OTP', partners: Partner[], by: string): Result => {
  const o = getOrder(id);
  const sh = o?.shipments.find((s) => s.id === shipmentId);
  if (!o || !sh || sh.deliveredAt) return { ok: false, message: 'Shipment not found or already delivered.' };
  if (!receivedBy.trim()) return { ok: false, message: 'Who received the goods? (name on the proof of delivery)' };
  const dest = destinationOf(o, partners);
  post(sh.allocations.flatMap((a) => {
    const base = { bin: '', productId: a.productId, variantSku: a.variantSku, batch: a.batch, serial: a.serial, mfgDate: a.mfgDate, expiryDate: a.expiryDate, unitCost: a.unitCost, importId: null, by, refId: o.id, status: 'Available' as const };
    return [
      { ...base, type: 'TRANSFER_OUT' as const, locType: 'TRANSIT' as const, warehouseId: o.partnerId, bin: sh.no, qty: -a.qty, source: `Delivered ${sh.no}` },
      ...(dest ? [{ ...base, type: 'RECEIPT' as const, locType: dest, warehouseId: o.partnerId, qty: a.qty, source: `Received ${sh.no}` }] : []),
    ];
  }));
  const shipments = o.shipments.map((s) => (s.id === shipmentId ? { ...s, deliveredAt: now(), pod: { receivedBy, method } } : s));
  const done = o.status === 'Shipped' && shipments.every((s) => s.deliveredAt);
  put(log({ ...o, shipments, status: done ? 'Completed' : o.status }, by, `${sh.no} delivered — ${method} by ${receivedBy}`, done ? 'All shipments delivered — order completed' : undefined));
  emit('order.delivered', 'Orders', by, `${o.code}: ${sh.no} delivered`, { orderId: o.id });
  return { ok: true, message: done ? `${o.code} completed.` : `${sh.no} delivered${dest ? ` — stock added to ${o.partnerName}` : ''}.` };
};

/** Optional after delivery: the receiver reports a shortage or damage — a claim is raised, the order stays completed. */
export const reportProblem = (id: string, shipmentId: string, counts: Record<number, { short: number; damaged: number }>, partners: Partner[], by: string): Result => {
  const o = getOrder(id);
  const sh = o?.shipments.find((s) => s.id === shipmentId);
  if (!o || !sh || !sh.deliveredAt) return { ok: false, message: 'Record delivery first.' };
  if (sh.problem) return { ok: false, message: 'A problem was already reported for this shipment.' };
  const dest = destinationOf(o, partners);
  let short = 0; let damaged = 0; let sv = 0; let dv = 0;
  const movs: Parameters<typeof post>[0] = [];
  sh.allocations.forEach((a, i) => {
    const c = counts[i] ?? { short: 0, damaged: 0 };
    const s = Math.max(0, Math.min(a.qty, c.short));
    const dmg = Math.max(0, Math.min(a.qty - s, c.damaged));
    const unit = o.lines.find((l) => l.id === a.lineId)?.netUnit ?? 0;
    short += s; damaged += dmg; sv += s * unit; dv += dmg * unit;
    if (!dest) return;
    const base = { bin: '', productId: a.productId, variantSku: a.variantSku, batch: a.batch, serial: a.serial, mfgDate: a.mfgDate, expiryDate: a.expiryDate, unitCost: a.unitCost, importId: null, by, refId: o.id, locType: dest, warehouseId: o.partnerId };
    if (s) movs.push({ ...base, type: 'CLAIM', qty: -s, status: 'Available', source: `Short on receipt ${sh.no}` });
    if (dmg) movs.push({ ...base, type: 'CLAIM', qty: -dmg, status: 'Available', source: `Damaged on receipt ${sh.no}` }, { ...base, type: 'CLAIM', qty: dmg, status: 'Blocked', source: `Damaged on receipt ${sh.no}` });
  });
  if (!short && !damaged) return { ok: false, message: 'Enter the short or damaged quantities.' };
  post(movs);
  const d = db();
  const newClaims: Claim[] = [];
  const mk = (kind: Claim['kind'], qty: number, value: number) => newClaims.push({ id: newId('clm'), no: `CLM-26-${d.claims.length + 101 + newClaims.length}`, orderId: o.id, orderCode: o.code, shipmentNo: sh.no, partnerName: o.partnerName, kind, qty, value: Math.round(value), status: 'Open', raisedAt: today() });
  if (short) mk('Shortage', short, sv);
  if (damaged) mk('Damage', damaged, dv);
  const updated = log({ ...o, shipments: o.shipments.map((s) => (s.id === shipmentId ? { ...s, problem: { shortQty: short, damagedQty: damaged, claimNos: newClaims.map((c) => c.no), at: now() } } : s)) },
    by, `Receipt problem on ${sh.no}: ${short} short, ${damaged} damaged`, `Claim ${newClaims.map((c) => c.no).join(', ')} raised with ${sh.carrier}`);
  commit({ ...d, claims: [...newClaims, ...d.claims], orders: d.orders.map((x) => (x.id === o.id ? updated : x)) });
  return { ok: true, message: `Claim ${newClaims.map((c) => c.no).join(', ')} raised.` };
};

export const settleClaim = (claimId: string): Result => {
  const d = db();
  commit({ ...d, claims: d.claims.map((c) => (c.id === claimId ? { ...c, status: 'Settled' as const } : c)) });
  return { ok: true, message: 'Claim settled.' };
};

/** Backordered quantities become a new order once stock arrives. */
export const releaseBackorder = (id: string, ctx: OrderCtx, by: string): Result & { id?: string } => {
  const o = getOrder(id);
  const lines = o?.lines.filter((l) => l.backorderQty > 0) ?? [];
  if (!o || !lines.length) return { ok: false, message: 'No backorder on this order.' };
  const r = createOrder({ principalId: o.principalId, partner: { id: o.partnerId, name: o.partnerName, partnerTypeId: o.partnerTypeId } as Partner, channelId: o.channelId, orderType: o.orderType, shipFrom: o.shipFrom,
    poNumber: `${o.poNumber}-BO`, poDate: o.poDate, requiredBy: lines[0].backorderDate ?? o.requiredBy, source: o.source, notes: `Backorder of ${o.code}`,
    lines: lines.map((l) => ({ productId: l.productId, variantSku: l.substituteFor ?? l.variantSku, name: l.name.split(' → ')[0], qty: l.backorderQty, unitPrice: l.unitPrice, netUnit: l.netUnit, gstPct: l.gstPct, freeQty: 0, priceSource: l.priceSource })) }, by, ctx, o.id);
  if (!r.ok) return r;
  put(log({ ...getOrder(id)!, lines: o.lines.map((l) => ({ ...l, backorderQty: 0, backorderDate: null })) }, by, `Backorder released as ${getOrder(r.id!)?.code}`));
  return { ok: true, message: `Backorder released as ${getOrder(r.id!)?.code}.`, id: r.id };
};

export const SEEDED_KEY = () => workspaceKey('vinflux.ordersSeeded.v2');

/* ------------------------------ Live ERP calls ------------------------------ */

/** ERP item code for a line: the product's mapping for this ERP, else variant SKU / ERP code / product code. */
const erpItemCode = (ctx: OrderCtx, connector: string, productId: string, variantSku: string | null) => {
  const p = ctx.products.find((x) => x.id === productId);
  const name = erpProfile(connector)?.name.toLowerCase() ?? connector;
  const m = p?.integrationMapping?.find((x) => x.system.toLowerCase().includes(connector.split('-')[0]) || name.includes(x.system.toLowerCase()));
  return m?.externalId || variantSku || p?.externalRef || p?.code || productId;
};

/** Send a confirmed order's sales order to the live ERP (and retry). */
export const pushSalesOrder = async (id: string, ctx: OrderCtx): Promise<Result> => {
  const o = getOrder(id);
  const connector = o?.erpRef?.connector;
  if (!o || !connector) return { ok: false, message: 'Nothing to send.' };
  const name = erpProfile(connector)?.name ?? connector;
  const partner = ctx.partners.find((p) => p.id === o.partnerId);
  const customerCode = connectorSettings(connector).customerMap?.[o.partnerId] || partner?.code || o.partnerName;
  const location = Object.entries(connectorSettings(connector).plantMap).find(([, code]) => code && ctx.warehouses?.find((w) => w.id === o.shipFrom.id)?.code === code)?.[0] ?? null;
  try {
    const r = await callErp<{ erpId: string; erpNumber: string }>(connector, 'salesOrder', { order: {
      vinfluxRef: o.code, poNumber: o.poNumber, poDate: o.poDate, requiredBy: o.requiredBy, customerCode, location, notes: o.notes,
      lines: o.lines.filter((l) => l.confirmedQty > 0).map((l) => ({ itemCode: erpItemCode(ctx, connector, l.productId, l.variantSku), qty: l.confirmedQty + l.freeQty, unitPrice: l.netUnit })),
    } });
    const cur = getOrder(id)!;
    put(log({ ...cur, erpSalesOrder: r.erpNumber, erpRef: { connector, status: 'Sent', erpId: r.erpId, at: now() } }, 'System', `Sales order ${r.erpNumber} created in ${name}`));
    return { ok: true, message: `${name} sales order ${r.erpNumber} created.` };
  } catch (e) {
    const cur = getOrder(id)!;
    put(log({ ...cur, erpRef: { connector, status: 'Failed', error: (e as Error).message, at: now() } }, 'System', `${name} refused the sales order`, (e as Error).message));
    return { ok: false, message: `${name}: ${(e as Error).message}` };
  }
};

export interface ErpInvoice { number: string; date: string | null; status: string; amount: number | null; irn: string | null; ewayBill: string | null }
/** Invoices the live ERP has raised for this order's sales order. */
export const fetchErpInvoices = async (id: string): Promise<ErpInvoice[]> => {
  const o = getOrder(id);
  if (!o?.erpRef || o.erpRef.status !== 'Sent') throw new Error('The sales order is not in the ERP yet.');
  const r = await callErp<{ invoices: ErpInvoice[] }>(o.erpRef.connector, 'invoices', { ref: { erpId: o.erpRef.erpId ?? o.erpSalesOrder, erpNumber: o.erpSalesOrder, poNumber: o.poNumber } });
  return r.invoices;
};
