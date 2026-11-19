/**
 * Indirect orders (GTM-04): an order from a partner with no direct supply link to the principal (a dealer that buys from
 * a distributor) is routed, not dropped. If the supplying partner runs the VinFlux distributor platform, the order lands
 * in its order inbox there; otherwise the dealer is told whom to order from. Either way the principal records it as
 * downstream demand for its reports.
 * INTEGRATION POINT: delivery to the distributor platform's inbox goes through the partner-platform API.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import type { Partner } from '../gtm-v2/types';
import type { OrderCtx, OrderSource } from './orderStore';
import { setupOf } from '../secondary/secondaryStore';

export type RoutedStatus = 'In supplier’s inbox' | 'Dealer told whom to order from';
export interface RoutedLine { productId: string; name: string; qty: number; value: number }
export interface RoutedOrder {
  id: string; no: string; principalId: string; fromId: string; fromName: string; supplierId: string | null; supplierName: string;
  source: OrderSource | 'Partner Lite' | 'Email'; poNumber: string; lines: RoutedLine[]; value: number; status: RoutedStatus; message: string;
  at: string; by: string;
}
interface Db { routed: RoutedOrder[]; seq: number }
const KEY = () => workspaceKey('vinflux.routedOrders.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) { const x = loadJson<Partial<Db> | null>(KEY(), null); cache = { key: KEY(), d: { routed: Array.isArray(x?.routed) ? x!.routed : [], seq: x?.seq ?? 800 } }; }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeRouting = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const routedOrders = (principalId: string) => db().routed.filter((r) => r.principalId === principalId);

/** The partner that supplies this one (resale link), if any. */
export const supplierOf = (partnerId: string, ctx: Pick<OrderCtx, 'mappings' | 'partners'>): Partner | null => {
  const link = ctx.mappings.filter((m) => m.partnerId === partnerId && m.status === 'Active').flatMap((m) => m.suppliers ?? []).find((s) => s.kind === 'PARTNER');
  return link ? ctx.partners.find((p) => p.id === link.partnerId) ?? null : null;
};

export const routeOrder = (n: { principalId: string; from: Partner; lines: { productId: string; name: string; qty: number; unitValue: number }[]; source: RoutedOrder['source']; poNumber: string; by: string }, ctx: Pick<OrderCtx, 'mappings' | 'partners'>): { ok: boolean; message: string; id?: string } => {
  const lines = n.lines.filter((l) => l.qty > 0);
  if (!lines.length) return { ok: false, message: 'Add at least one product.' };
  const sup = supplierOf(n.from.id, ctx);
  const onPlatform = !!sup && !!setupOf(sup.id).onPlatform;
  const status: RoutedStatus = onPlatform ? 'In supplier’s inbox' : 'Dealer told whom to order from';
  const message = sup
    ? onPlatform
      ? `Order sent to ${sup.name}'s order inbox on the VinFlux distributor platform. ${sup.name} confirms and ships it; you see it as downstream demand.`
      : `Dear ${n.from.contactPerson || n.from.name}, ${n.from.name} is supplied by ${sup.name}. Please place this order with ${sup.name}${sup.phone ? ` (${sup.phone})` : ''}${sup.email ? `, ${sup.email}` : ''} — they hold stock and prices for you. We have shared your requirement with them.`
    : `${n.from.name} has no supplier set up — link it in Go-to-Market. Recorded as demand.`;
  const d = db(); const seq = d.seq + 1;
  const rl = lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, value: Math.round(l.qty * l.unitValue) }));
  const rec: RoutedOrder = { id: newId('rto'), no: `RT-26-${seq}`, principalId: n.principalId, fromId: n.from.id, fromName: n.from.name, supplierId: sup?.id ?? null, supplierName: sup?.name ?? '—',
    source: n.source, poNumber: n.poNumber, lines: rl, value: rl.reduce((a, l) => a + l.value, 0), status, message, at: new Date().toISOString(), by: n.by };
  commit({ seq, routed: [rec, ...d.routed] });
  emit('order.routed', 'Orders', n.by, `${rec.no}: ${n.from.name} → ${rec.supplierName}`, { routedId: rec.id });
  return { ok: true, message: sup ? `${n.from.name} buys from ${sup.name} — ${onPlatform ? `order sent to ${sup.name}’s inbox` : `${n.from.name} told to order from ${sup.name}`} and recorded as demand (${rec.no}).` : message, id: rec.id };
};

/** Demand by month and supplier (for reports). */
export const routedSummary = (principalId: string) => {
  const m = new Date().toISOString().slice(0, 7);
  const rs = routedOrders(principalId); const mo = rs.filter((r) => r.at.slice(0, 7) === m);
  return { count: mo.length, value: mo.reduce((a, r) => a + r.value, 0), suppliers: new Set(mo.map((r) => r.supplierName)).size, all: rs.length };
};
