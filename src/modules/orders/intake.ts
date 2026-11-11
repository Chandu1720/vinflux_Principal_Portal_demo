/**
 * Order intake — the orders mailbox (orders@<principal>) and the helpers every intake route shares.
 *
 * Each email is matched to a partner by the sender address (partner email or portal user email / domain).
 *   • Unknown sender                → "Unmatched": someone links it to a partner, then it is processed again.
 *   • Partner with no DIRECT link   → "Refused": auto-reply naming the partner they should order from.
 *   • Unknown product code          → "Unmatched": someone maps the code to a product (once), then processed again.
 *   • Otherwise                     → an order is created (status Received) and validated straight away.
 * INTEGRATION POINT: IMAP / Microsoft Graph / Gmail push → POST /intake/email; PDF / Excel PO parsing.
 */
import type { Partner } from '../gtm-v2/types';
import type { Warehouse } from '../../types/warehouse';
import { quoteFor } from '../pricing/quoteFor';
import { gstOf } from '../pricing/pricingStore';
import { findProduct } from '../../platform/import/entities';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { balances } from '../inventory/stockStore';
import { createOrder, getOrder, routeOf } from './orderStore';
import type { Order, OrderCtx } from './orderStore';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* ------------------------------ Shared helpers ------------------------------ */

/** Price one order line from the partner's price list / rate contract (stock transfers go at standard cost). */
export const priceLine = (ctx: OrderCtx, partnerId: string, principalId: string, productId: string, variantSku: string | null, qty: number, transfer = false) => {
  const prod = ctx.products.find((p) => p.id === productId);
  const variant = prod?.variants.find((v) => v.sku === variantSku);
  const name = variant ? variant.name : prod?.name ?? productId;
  if (transfer) return { productId, variantSku, name, qty, unitPrice: prod?.pricingReference?.standardCost ?? 0, netUnit: prod?.pricingReference?.standardCost ?? 0, gstPct: 0, freeQty: 0, priceSource: 'Stock transfer at standard cost' };
  const partner = ctx.partners.find((p) => p.id === partnerId)!;
  const q = quoteFor({ config: ctx.config, channels: ctx.channels, terms: ctx.terms, territories: ctx.territories }, partner, principalId, productId, qty, today(), ctx.products);
  return { productId, variantSku, name, qty, unitPrice: q.unitPrice, netUnit: q.netUnit, gstPct: gstOf(prod), freeQty: q.freeQty,
    priceSource: q.list ? `${q.list.type === 'CONTRACT' ? 'Rate contract' : 'Price list'} ${q.list.code}` : 'No price list' };
};

/** Where a partner's order ships from. Company links without a fixed warehouse pick the warehouse holding the first product. */
export const shipFromFor = (partnerId: string, ctx: OrderCtx, warehouses: Warehouse[], productIds?: string | string[], chosenWarehouseId?: string): Order['shipFrom'] | null => {
  const r = routeOf(partnerId, ctx);
  if (!r.ok || !r.shipFrom) return null;
  if (r.shipFrom.locType === 'CNF') return r.shipFrom;
  // No fixed warehouse: the company warehouse holding the most of the ordered products.
  const wanted = new Set(([] as string[]).concat(productIds ?? []).filter(Boolean));
  const best = (() => {
    const score = new Map<string, Set<string>>();
    balances().filter((b) => b.locType === 'COMPANY' && b.status === 'Available' && b.qty > 0 && wanted.has(b.productId))
      .forEach((b) => score.set(b.warehouseId, (score.get(b.warehouseId) ?? new Set()).add(b.productId)));
    return [...score.entries()].sort((a, b) => b[1].size - a[1].size)[0]?.[0];
  })();
  const id = r.shipFrom.id || chosenWarehouseId || best || warehouses.find((w) => w.status === 'Active')?.id || '';
  return { locType: 'COMPANY', id, name: warehouses.find((w) => w.id === id)?.name ?? id };
};

/* --------------------------------- Mailbox --------------------------------- */

export type EmailStatus = 'New' | 'Order created' | 'Refused' | 'Unmatched';
export interface OrderEmail {
  id: string; from: string; fromName: string; subject: string; body: string; attachment: string | null; receivedAt: string;
  status: EmailStatus;
  partnerId: string | null; orderId: string | null;
  issues: string[];
  /** Auto-reply sent to the sender (refusals, acknowledgements). */
  reply: string | null;
  /** Fixes a person made: link to a partner, map unknown codes. */
  linkPartnerId: string | null;
  codeMap: Record<string, { productId: string; variantSku: string | null }>;
}
interface Box { emails: OrderEmail[]; aliases: Record<string, { productId: string; variantSku: string | null }> }
let cache: Box | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.orderMailbox.v1');
const box = (): Box => (cache ??= loadJson<Box>(KEY(), { emails: [], aliases: {} }));
const commit = (b: Box) => { cache = b; saveJson(KEY(), b); listeners.forEach((l) => l()); };
export const subscribeMailbox = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const emails = () => box().emails;
export const getEmail = (id: string) => box().emails.find((e) => e.id === id) ?? null;
const putEmail = (e: OrderEmail) => { const b = box(); commit({ ...b, emails: b.emails.map((x) => (x.id === e.id ? e : x)) }); };

export const MAILBOX = 'orders@vinflux-principal.example';

/** Drop an email into the mailbox (from the mail server — or the demo). */
export const receiveEmail = (m: { from: string; fromName: string; subject: string; body: string; attachment?: string | null; receivedAt?: string }) => {
  const e: OrderEmail = { id: newId('eml'), from: m.from.trim().toLowerCase(), fromName: m.fromName, subject: m.subject, body: m.body, attachment: m.attachment ?? null, receivedAt: m.receivedAt ?? new Date().toISOString(),
    status: 'New', partnerId: null, orderId: null, issues: [], reply: null, linkPartnerId: null, codeMap: {} };
  const b = box();
  commit({ ...b, emails: [e, ...b.emails] });
  return e.id;
};

/** Match a sender address to a partner: partner email, portal user email, then the portal users' email domain. */
export const partnerForSender = (from: string, partners: Partner[]): Partner | null => {
  const f = from.toLowerCase();
  const dom = f.split('@')[1] ?? '';
  return partners.find((p) => p.email?.toLowerCase() === f)
    ?? partners.find((p) => (p.portalUsers ?? []).some((u) => u.email.toLowerCase() === f))
    ?? (dom ? partners.find((p) => (p.portalUsers ?? []).some((u) => u.email.toLowerCase().endsWith(`@${dom}`)) || (p.email ?? '').toLowerCase().endsWith(`@${dom}`)) : undefined)
    ?? null;
};

/** Read "CODE x QTY" style lines and the PO number from the email (a real parser also reads PDF / Excel attachments). */
export const parseEmail = (e: Pick<OrderEmail, 'subject' | 'body'>) => {
  const text = `${e.subject}\n${e.body}`;
  const po = text.match(/\b(PO\/[A-Z0-9][A-Z0-9/-]+)/i)?.[1] ?? text.match(/\bPO\s*(?:no\.?|number|#|:)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,})/i)?.[1] ?? null;
  const lines = e.body.split(/\r?\n/).map((l) => l.match(/^\s*(?:\d+[.)]\s*)?([A-Za-z0-9][A-Za-z0-9._/-]{2,})\s*(?:[x×*:=-]|qty|–)\s*(\d+)\s*(?:nos|units|pcs|ea)?\s*$/i))
    .filter((x): x is RegExpMatchArray => !!x).map((x) => ({ code: x[1], qty: Number(x[2]) }));
  return { po, lines };
};

/**
 * Process one email: match partner → check direct link → match products → create the order (which validates itself).
 * Returns the order id when one was created.
 */
export const processEmail = (id: string, ctx: OrderCtx, principalId: string, warehouses: Warehouse[], by: string): { ok: boolean; message: string; orderId?: string } => {
  const e = getEmail(id);
  if (!e || e.status === 'Order created' || e.status === 'Refused') return { ok: false, message: 'Already processed.' };
  const p = e.linkPartnerId ? ctx.partners.find((x) => x.id === e.linkPartnerId) ?? null : partnerForSender(e.from, ctx.partners);
  if (!p) {
    putEmail({ ...e, status: 'Unmatched', issues: [`Sender ${e.from} is not a known partner or portal user — link it to a partner.`] });
    return { ok: false, message: 'Sender not recognised — link the email to a partner.' };
  }
  const route = routeOf(p.id, ctx);
  if (!route.ok) {
    const sup = ctx.mappings.filter((m) => m.partnerId === p.id && m.status === 'Active').flatMap((m) => m.suppliers ?? []).find((s) => s.kind === 'PARTNER');
    const supName = sup ? ctx.partners.find((x) => x.id === sup.partnerId)?.name : null;
    const reply = `Dear ${p.contactPerson || p.name},\n\nThank you for your order. ${p.name} is supplied by ${supName ?? 'your appointed distributor'}, so we can't take this order directly. Please place it with ${supName ?? 'them'} — they hold stock for your area.\n\nRegards,\nOrder desk`;
    putEmail({ ...e, status: 'Refused', partnerId: p.id, issues: [route.text], reply });
    return { ok: true, message: `Not a direct partner — auto-reply sent to ${e.from}${supName ? ` asking them to order from ${supName}` : ''}.` };
  }
  const parsed = parseEmail(e);
  const aliases = box().aliases;
  const owned = ctx.products.filter((x) => x.principalId === principalId);
  const matched = parsed.lines.map((l) => ({ ...l, hit: e.codeMap[l.code] ?? aliases[l.code.toLowerCase()] ?? (() => { const f = findProduct(l.code, owned); return f ? { productId: f.product.id, variantSku: f.variantSku } : null; })() }));
  const issues: string[] = [];
  if (!parsed.lines.length) issues.push('No product lines found (expected lines like “CODE x 10”) — open the email and enter the order by hand.');
  matched.filter((l) => !l.hit).forEach((l) => issues.push(`Product code “${l.code}” not recognised — map it to a product.`));
  if (issues.length) {
    putEmail({ ...e, status: 'Unmatched', partnerId: p.id, issues });
    return { ok: false, message: issues[0] };
  }
  const transfer = p.partnerTypeId === 'pt-cnf';
  const shipFrom = shipFromFor(p.id, ctx, warehouses, matched.map((l) => l.hit!.productId))!;
  const r = createOrder({
    principalId, partner: p, channelId: null, orderType: transfer ? 'Stock transfer' : 'Sale', shipFrom,
    poNumber: parsed.po ?? `EMAIL-${e.id.slice(-5).toUpperCase()}`, poDate: e.receivedAt.slice(0, 10), requiredBy: inDays(4), source: 'Email', notes: e.subject, emailId: e.id,
    lines: matched.map((l) => priceLine(ctx, p.id, principalId, l.hit!.productId, l.hit!.variantSku, l.qty, transfer)),
  }, by, ctx);
  if (!r.ok || !r.id) {
    putEmail({ ...e, status: 'Unmatched', partnerId: p.id, issues: r.errors ?? [r.message] });
    return { ok: false, message: r.message };
  }
  const o = getOrder(r.id)!;
  // Remember the code mappings people made so the next email from anyone matches automatically.
  if (Object.keys(e.codeMap).length) commit({ ...box(), aliases: { ...box().aliases, ...Object.fromEntries(Object.entries(e.codeMap).map(([k, v]) => [k.toLowerCase(), v])) } });
  putEmail({ ...getEmail(id)!, status: 'Order created', partnerId: p.id, orderId: r.id, issues: [], reply: `Order received as ${o.code} (your PO ${o.poNumber}). We'll confirm quantities and dispatch date shortly.` });
  return { ok: true, message: `${o.code} created from the email — ${o.status === 'Validated' ? 'validated' : o.status === 'On hold' ? 'on credit hold' : 'needs attention'}.`, orderId: r.id };
};

/** Process every new email in the mailbox. */
export const processInbox = (ctx: OrderCtx, principalId: string, warehouses: Warehouse[], by: string) => {
  const ids = emails().filter((e) => e.status === 'New').map((e) => e.id);
  const res = ids.map((id) => processEmail(id, ctx, principalId, warehouses, by));
  return { processed: ids.length, created: res.filter((r) => r.orderId).length, refused: ids.filter((id) => getEmail(id)?.status === 'Refused').length, unmatched: ids.filter((id) => getEmail(id)?.status === 'Unmatched').length };
};

/** Fix an unmatched email: link a partner and/or map unknown codes — then it is processed again. */
export const fixEmail = (id: string, fix: { partnerId?: string | null; codeMap?: OrderEmail['codeMap'] }) => {
  const e = getEmail(id);
  if (!e) return;
  putEmail({ ...e, status: 'New', linkPartnerId: fix.partnerId !== undefined ? fix.partnerId : e.linkPartnerId, codeMap: { ...e.codeMap, ...(fix.codeMap ?? {}) } });
};

export const discardEmail = (id: string, note: string) => {
  const e = getEmail(id);
  if (e) putEmail({ ...e, status: 'Refused', issues: [note || 'Not an order — discarded'], reply: null });
};

/** Demo: a partner emails a new order using real product codes. */
export const simulateEmail = (ctx: OrderCtx, principalId: string) => {
  const owned = ctx.products.filter((p) => p.principalId === principalId && p.lifecycleStatus === 'Active');
  const stocked = new Set(balances().filter((b) => b.qty > 0 && b.status === 'Available').map((b) => b.productId));
  const pick = owned.filter((p) => stocked.has(p.id));
  const authorised = (partner: Partner, prodId: string) => {
    const pr = owned.find((x) => x.id === prodId);
    return ctx.flows.some((f) => partner.flowIds.includes(f.id) && f.status === 'Active' && (f.productScope.allProducts || f.productScope.productIds.includes(prodId) || (!!pr && (f.productScope.portfolioIds.includes(pr.portfolioId) || f.productScope.categoryIds.includes(pr.categoryId)))));
  };
  const direct = ctx.partners.filter((p) => p.status === 'Active' && routeOf(p.id, ctx).ok && p.partnerTypeId !== 'pt-cnf' && (pick.length ? pick : owned).some((x) => authorised(p, x.id)));
  const p = direct[Math.floor(Math.random() * direct.length)] ?? ctx.partners[0];
  if (!p) return null;
  const prods = (pick.length ? pick : owned).filter((x) => authorised(p, x.id)).slice(0, 3);
  if (!prods.length) return null;
  const from = p.portalUsers?.[0]?.email ?? p.email;
  const n = Math.floor(Math.random() * 900 + 100);
  const codes = prods.slice(0, 1 + Math.floor(Math.random() * Math.min(2, prods.length))).map((x) => `${x.variants[0]?.sku ?? x.code} x ${1 + Math.floor(Math.random() * 4)}`);
  return receiveEmail({ from, fromName: p.portalUsers?.[0]?.name ?? p.contactPerson ?? p.name, subject: `Purchase order PO/${p.code}/${n}`, body: `Dear team,\n\nPlease supply the following against PO/${p.code}/${n}:\n\n${codes.join('\n')}\n\nDeliver at the earliest.\n\nThanks,\n${p.contactPerson ?? p.name}` });
};
