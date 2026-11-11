/**
 * One-time demo data for Inventory & Orders (per workspace): first ERP stock load, C&F / partner / hospital
 * stock, the orders mailbox, and sample orders taken through the real flow so every screen has something to show.
 */
import type { ImportContext } from '../../platform/import/types';
import { loadJson, saveJson } from '../../platform/store';
import { erpIssue, runStockSync } from '../../platform/integrations/stockSync';
import { balances, movements, post } from '../inventory/stockStore';
import type { LocType, StockBalance } from '../inventory/stockStore';
import {
  SEEDED_KEY, atp, minShelfDays, confirmOrder, createOrder, createShipment, deliverShipment, getOrder, orders, routeOf, toShip,
} from './orderStore';
import type { Allocation, NewOrderInput, OrderCtx } from './orderStore';
import { priceLine, processInbox, receiveEmail, shipFromFor } from './intake';

export { priceLine };
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

export const ensureDemo = (imp: ImportContext, ctx: OrderCtx, principalId: string) => {
  if (loadJson<boolean>(SEEDED_KEY(), false)) return false;
  saveJson(SEEDED_KEY(), true);
  if (!movements().length) runStockSync('sap', { ...imp, actor: 'System' });
  if (!ctx.partners.length) return true;
  const has = (id: string) => ctx.partners.some((p) => p.id === id);
  const company = () => balances().filter((b) => b.locType === 'COMPANY' && b.status === 'Available' && b.qty > 0);
  const batchStock = company().filter((b) => !b.serial).sort((a, b) => b.qty - a.qty);
  const serialStock = company().filter((b) => b.serial);
  const at = (b: StockBalance, locType: LocType, partnerId: string, qty: number, batch = b.batch, serial = b.serial, expiry = b.expiryDate) => ({
    type: 'TRANSFER_IN' as const, locType, warehouseId: partnerId, bin: '', productId: b.productId, variantSku: b.variantSku, batch, serial, mfgDate: b.mfgDate, expiryDate: expiry, qty, unitCost: b.unitCost,
    status: 'Available' as const, importId: null, source: locType === 'CNF' ? 'C&F stock count' : locType === 'HOSPITAL' ? 'Consignment placed' : 'Partner stock report', by: 'System', refId: null,
  });
  const g = batchStock[0];
  const ser = serialStock[0];
  // Channel stock — only once (a re-seed after clearing orders must not double it).
  if (!balances().some((b) => b.locType !== 'COMPANY' && b.locType !== 'TRANSIT')) {
    const movs = [];
    if (g && has('ptr-cnf-hyd')) movs.push(at(g, 'CNF', 'ptr-cnf-hyd', 150));
    if (ser && has('ptr-cnf-hyd')) [1, 2, 3, 4].forEach((n) => movs.push(at(ser, 'CNF', 'ptr-cnf-hyd', 1, ser.batch, `${ser.serial}-CF${n}`)));
    if (g && has('ptr-dist-vja')) movs.push(at(g, 'PARTNER', 'ptr-dist-vja', 35, `${g.batch}-OLD`, null, inDays(70)));
    if (g && has('ptr-dist-hyd')) movs.push(at(g, 'PARTNER', 'ptr-dist-hyd', 48));
    if (ser && has('ptr-hosp-hyd')) movs.push(at(ser, 'HOSPITAL', 'ptr-hosp-hyd', 1, ser.batch, `${ser.serial}-C1`), at(ser, 'HOSPITAL', 'ptr-hosp-hyd', 1, ser.batch, `${ser.serial}-C2`));
    post(movs);
  }

  const mk = (partnerId: string, lines: { productId: string; variantSku: string | null; qty: number }[], extra: Partial<NewOrderInput> = {}) => {
    const p = ctx.partners.find((x) => x.id === partnerId);
    if (!p) return null;
    const transfer = p.partnerTypeId === 'pt-cnf';
    const shipFrom = shipFromFor(p.id, ctx, imp.warehouses, lines.map((l) => l.productId));
    if (!shipFrom) return null;
    const res = createOrder({
      principalId, partner: p, channelId: null, orderType: transfer ? 'Stock transfer' : 'Sale', shipFrom, poNumber: `PO/${p.code}/${Math.floor(Math.random() * 900 + 100)}`, poDate: inDays(-1), requiredBy: inDays(4), source: 'Portal', notes: '',
      lines: lines.map((l) => priceLine(ctx, p.id, principalId, l.productId, l.variantSku, l.qty, transfer)), ...extra,
    }, 'Ravi Kumar', ctx);
    return res.id ?? null;
  };
  const gs = g ? { productId: g.productId, variantSku: g.variantSku } : null;
  const ss = ser ? { productId: ser.productId, variantSku: ser.variantSku } : null;
  const full = (id: string | null) => { const o = id ? getOrder(id) : null; return o ? Object.fromEntries(o.lines.map((l) => [l.id, { confirm: l.qty, backorderDate: null, substituteSku: null }])) : {}; };
  const issue = (w: string, a: Allocation[]) => erpIssue(w, a, imp);
  const shipAll = (id: string, carrier: string, awb: string, eta: number, by: string) => { const o = getOrder(id); if (o) createShipment(id, toShip(o), { carrier, awb, etaDays: eta, packages: 1, weightKg: 4 }, ctx, by, { onErpIssue: issue }); };

  // Completed (history): Yashoda direct — confirmed, shipped, delivered.
  if (gs) {
    const id = mk('ptr-hosp-hyd', [{ ...gs, qty: 10 }], { source: 'Email' });
    if (id && getOrder(id)?.status === 'Validated') {
      confirmOrder(id, full(id), ctx, 'Ravi Kumar', 'SAP S/4HANA');
      shipAll(id, 'Blue Dart', 'BD-77812340', 1, 'Suresh Reddy');
      const sh = getOrder(id)?.shipments[0];
      if (sh) deliverShipment(id, sh.id, 'Stores — Yashoda Somajiguda', 'Signature', ctx.partners, 'Suresh Reddy');
    }
  }
  // Shipped: C&F replenishment from the warehouse that feeds the C&F, using whatever that warehouse holds most of.
  const cnfWh = routeOf('ptr-cnf-hyd', ctx).shipFrom?.id;
  const cnfPick = (() => {
    const m = new Map<string, { productId: string; variantSku: string | null; qty: number }>();
    company().filter((b) => b.warehouseId === cnfWh).forEach((b) => { const k = `${b.productId}|${b.variantSku}`; const r = m.get(k) ?? { productId: b.productId, variantSku: b.variantSku, qty: 0 }; r.qty += b.qty; m.set(k, r); });
    return [...m.values()].map((r) => ({ ...r, qty: atp(cnfWh ?? '', r.productId, r.variantSku, minShelfDays(ctx.products.find((x) => x.id === r.productId), false)) })).sort((a, b) => b.qty - a.qty)[0];
  })();
  if (cnfPick && cnfPick.qty > 1) {
    const id = mk('ptr-cnf-hyd', [{ productId: cnfPick.productId, variantSku: cnfPick.variantSku, qty: Math.min(cnfPick.qty - 1, 10) }], { source: 'EDI', notes: 'Weekly replenishment proposal accepted' });
    if (id && getOrder(id)?.status === 'Validated') { confirmOrder(id, full(id), ctx, 'Suresh Reddy', 'SAP S/4HANA'); shipAll(id, 'VRL Logistics', 'LR-552190', 2, 'Suresh Reddy'); }
  }
  // Confirmed (reserved, waiting for shipment): Charminar via the C&F.
  if (ss) {
    const id = mk('ptr-dist-hyd', [{ ...ss, qty: 2 }], { source: 'Portal' });
    if (id && getOrder(id)?.status === 'Validated') confirmOrder(id, full(id), ctx, 'Ravi Kumar');
  }
  // On hold: Garden City over its credit limit.
  if (ss) mk('ptr-dist-blr', [{ ...ss, qty: 12 }], { source: 'Phone', notes: 'Tender supply for Narayana Health' });

  // Orders mailbox — processed on arrival: a Yashoda PO (direct), Benz (not direct → refused with a reply),
  // an unknown sender, and a PO with a code nobody recognises. One more stays unread for the demo.
  const prodOf = (id?: string | null) => ctx.products.find((p) => p.id === id);
  const codeOf = (x: { productId: string; variantSku: string | null } | null) => (x ? x.variantSku ?? prodOf(x.productId)?.code ?? '' : '');
  const yashoda = ctx.partners.find((p) => p.id === 'ptr-hosp-hyd');
  if (ss && gs && yashoda) receiveEmail({ from: yashoda.email, fromName: 'Yashoda — Central Procurement', subject: 'PO YH-SMJ-2611 — OT requirement', body: `Dear Sir,\n\nKindly supply against PO YH-SMJ-2611 for OT on Monday:\n\n${codeOf(ss)} x 2\n${codeOf(gs)} x 20\n\nRegards,\nCentral Procurement`, attachment: 'YH-SMJ-2611.pdf', receivedAt: ago(5) });
  if (ss && has('ptr-dlr-benz')) receiveEmail({ from: 'lakshmi@benzortho.example', fromName: 'Lakshmi Prasad', subject: 'Order for 1 set', body: `Hi,\n\nPO BCO-118\n${codeOf(ss)} x 1\n\nThanks`, receivedAt: ago(4) });
  if (gs) receiveEmail({ from: 'purchase@sunrise-ortho.example', fromName: 'Sunrise Ortho Clinic', subject: 'Requirement', body: `Please send ${codeOf(gs)} x 5 and quote best rate.`, receivedAt: ago(3) });
  if (ss && has('ptr-dist-hyd')) receiveEmail({ from: 'imran@charminar.example', fromName: 'Imran Khan', subject: 'PO CS/4471', body: `Dear team,\n\nPO CS/4471\n${codeOf(ss)} x 1\nOLD-CAT-7781 x 1\n\nRegards,\nImran`, receivedAt: ago(2) });
  processInbox(ctx, principalId, imp.warehouses, 'System');
  if (ss && has('ptr-dist-hyd')) receiveEmail({ from: 'imran@charminar.example', fromName: 'Imran Khan', subject: 'PO CS/4480 — urgent', body: `Hi,\n\nPO CS/4480\n${codeOf(ss)} x 1\n\nPlease dispatch today.\nImran`, receivedAt: ago(0.2) });
  return orders().length > 0;
};
