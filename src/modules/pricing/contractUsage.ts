/**
 * Rate-contract consumption (PRC-07): orders priced from a rate contract use up its contracted quantity per product.
 * Warn at 80% and at 100% (the contract may be renegotiated or a new tender needed); the order still goes through.
 */
import { orders } from '../orders/orderStore';
import type { Check, Order } from '../orders/orderStore';
import { priceLists, setLines } from './pricingStore';
import type { PriceList } from './pricingStore';

export interface ContractUse { productId: string; contracted: number; used: number; pct: number }
const live = (o: Order) => !['Rejected', 'Cancelled'].includes(o.status);
/** Units of each product ordered at this contract's price (order lines keep the price source, e.g. "Rate contract RC-…"). */
export const contractUsage = (l: PriceList, exceptOrderId?: string): ContractUse[] => {
  const os = orders().filter((o) => o.principalId === l.principalId && l.partnerIds.includes(o.partnerId) && live(o) && o.id !== exceptOrderId);
  return l.lines.filter((x) => (x.contractQty ?? 0) > 0).map((x) => {
    const used = os.reduce((a, o) => a + o.lines.filter((ol) => ol.productId === x.productId && ol.priceSource.includes(l.code)).reduce((s, ol) => s + (o.status === 'Completed' || o.status === 'Shipped' ? Math.max(ol.shippedQty, ol.confirmedQty) : ol.qty), 0), 0);
    return { productId: x.productId, contracted: x.contractQty!, used, pct: Math.round((used / x.contractQty!) * 100) };
  });
};
/** Whole-contract use: the worst line. */
export const contractPct = (l: PriceList) => { const u = contractUsage(l); return u.length ? Math.max(...u.map((x) => x.pct)) : null; };
/** Contracts at or above 80% of a contracted quantity. */
export const contractsNearLimit = (principalId: string) => priceLists().filter((l) => l.principalId === principalId && l.type === 'CONTRACT' && l.status === 'Active')
  .map((l) => ({ l, pct: contractPct(l) })).filter((x) => x.pct !== null && x.pct >= 80) as { l: PriceList; pct: number }[];

/** Order check: this order would take a contract line past 80% or 100% of its contracted quantity. */
export const contractCheck = (o: Order): Check | null => {
  const hits: string[] = []; let over = false;
  const codes = new Set(o.lines.map((ol) => /Rate contract (\S+)/.exec(ol.priceSource)?.[1]).filter(Boolean) as string[]);
  if (!codes.size) return null;
  priceLists().filter((l) => l.type === 'CONTRACT' && codes.has(l.code)).forEach((l) => {
    const use = contractUsage(l, o.id);
    o.lines.filter((ol) => ol.priceSource.includes(l.code)).forEach((ol) => {
      const u = use.find((x) => x.productId === ol.productId); if (!u) return;
      const after = u.used + ol.qty; const pct = Math.round((after / u.contracted) * 100);
      if (pct > 100) { over = true; hits.push(`${ol.name.slice(0, 40)}: ${after} of ${u.contracted} contracted (${pct}%)`); }
      else if (pct >= 80) hits.push(`${ol.name.slice(0, 40)}: ${pct}% of contracted quantity used`);
    });
  });
  if (!hits.length) return { id: 'contract', label: 'Rate-contract quantity', state: 'pass', detail: 'Within the contracted quantity' };
  return { id: 'contract', label: 'Rate-contract quantity', state: 'warn', detail: `${over ? 'Above the contracted quantity — ' : ''}${hits.join('; ')}` };
};

/** Demo: give the first active rate contract (without quantities) contracted quantities so its use shows (~85%). */
export const ensureContractQtyDemo = (principalId: string) => {
  const flag = `vinflux.contractQtyDemo.${principalId}`;
  try { if (localStorage.getItem(flag)) return; } catch { return; }
  const l = priceLists().find((x) => x.principalId === principalId && x.type === 'CONTRACT' && x.status === 'Active' && !x.lines.some((y) => (y.contractQty ?? 0) > 0) && !x.code.startsWith('RC-TN'));
  try { localStorage.setItem(flag, '1'); } catch { /* ignore */ }
  if (!l) return;
  const used = (pid: string) => orders().filter((o) => o.principalId === principalId && l.partnerIds.includes(o.partnerId) && live(o)).reduce((a, o) => a + o.lines.filter((ol) => ol.productId === pid && ol.priceSource.includes(l.code)).reduce((s, ol) => s + ol.qty, 0), 0);
  setLines(l.id, l.lines.map((x, i) => ({ ...x, contractQty: used(x.productId) ? Math.max(1, Math.round(used(x.productId) / (i === 0 ? 0.85 : 0.4))) : (i === 0 ? 12 : 40) })), 'System', 'Contracted quantities recorded');
};
