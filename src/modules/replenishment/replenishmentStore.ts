/**
 * Replenishment (NV2): turn partner stock and secondary sales into the next order before the partner runs out.
 *
 * REP-01 Suggested qty = (target days of cover × average daily secondary sales) − (partner stock + in transit + open orders),
 *        rounded up to the order pack.
 * REP-02 Target days of cover per channel (partner type), partner or product — the most specific rule wins.
 * REP-03 The principal sends the suggestion; the partner accepts, edits or rejects it (secure link or by phone);
 *        an accepted suggestion becomes a normal sales order and goes through every order check.
 * REP-04 Partners without fresh secondary data (or without consent to share it) get no suggestion.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { issueLink, revokeLinks } from '../../platform/actionLinks';
import type { Product } from '../../types/product.ts';
import { OPEN, createOrder, getOrder, inTransit, orders } from '../orders/orderStore';
import type { Check, Order, OrderCtx } from '../orders/orderStore';
import { optChoice } from '../../platform/moduleOptions';
import { priceLine, shipFromFor } from '../orders/intake';
import { FRESH_DAYS, accept as acceptReport, consentAllows, daysIn, getReport, openingOf, partnerBoard, receiptsOf, reports, setupOf, submitReport, thisPeriod } from '../secondary/secondaryStore';
import type { LocType } from '../inventory/stockStore';

export type RuleScope = 'default' | 'channel' | 'partner' | 'product' | 'partner-product';
export interface CoverRule { id: string; scope: RuleScope; partnerTypeId?: string; partnerId?: string; productId?: string; days: number; note?: string }
export interface Settings { defaultDays: number; minDays: number; expiryHours: number; lookbackPeriods: number }

export interface SuggestRow {
  partnerId: string; productId: string; name: string;
  stock: number; transit: number; open: number; sentQty: number;
  avgDaily: number; coverNow: number | null; targetDays: number; targetSource: string;
  need: number; pack: number; suggested: number;
}
export interface PartnerSuggest {
  partnerId: string; partnerName: string; partnerTypeId: string;
  ok: boolean; reason: string | null; dataAge: number | null; period: string | null;
  rows: SuggestRow[];
}

export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Withdrawn';
export interface ProposalLine { productId: string; name: string; suggested: number; qty: number; stock: number; avgDaily: number; targetDays: number; partnerQty?: number }
export interface Proposal {
  id: string; no: string; principalId: string; partnerId: string; partnerName: string;
  lines: ProposalLine[]; status: ProposalStatus; createdBy: string; createdAt: string;
  sentAt: string | null; expiresAt: string | null; link: string | null;
  respondedBy: string | null; respondedAt: string | null; via: string | null; reason: string | null;
  orderId: string | null; orderCode: string | null; edited: boolean;
  history: { at: string; by: string; action: string; note?: string }[];
}
interface Db { settings: Settings; rules: CoverRule[]; proposals: Proposal[]; seq: number; seeded: string[] }

const now = () => new Date().toISOString();
const KEY = () => workspaceKey('vinflux.replenishment.v1');
const EMPTY: Db = { settings: { defaultDays: 30, minDays: 7, expiryHours: 72, lookbackPeriods: 2 }, rules: [], proposals: [], seq: 400, seeded: [] };
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) {
    const x = loadJson<Partial<Db> | null>(KEY(), null);
    cache = { key: KEY(), d: { ...EMPTY, ...(x ?? {}), settings: { ...EMPTY.settings, ...(x?.settings ?? {}) }, rules: Array.isArray(x?.rules) ? x!.rules : [], proposals: Array.isArray(x?.proposals) ? x!.proposals : [], seeded: Array.isArray(x?.seeded) ? x!.seeded : [] } };
  }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeReplenishment = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const replSettings = () => db().settings;
export const saveReplSettings = (s: Settings) => commit({ ...db(), settings: s });
export const coverRules = () => db().rules;
export const saveRule = (r: CoverRule): { ok: boolean; message: string } => {
  if (!(r.days > 0)) return { ok: false, message: 'Days of cover must be more than 0.' };
  if (r.scope === 'channel' && !r.partnerTypeId) return { ok: false, message: 'Choose the partner type.' };
  if ((r.scope === 'partner' || r.scope === 'partner-product') && !r.partnerId) return { ok: false, message: 'Choose the partner.' };
  if ((r.scope === 'product' || r.scope === 'partner-product') && !r.productId) return { ok: false, message: 'Choose the product.' };
  const d = db(); const same = (x: CoverRule) => x.scope === r.scope && x.partnerTypeId === r.partnerTypeId && x.partnerId === r.partnerId && x.productId === r.productId;
  const clash = d.rules.find((x) => x.id !== r.id && same(x));
  if (clash) return { ok: false, message: 'A rule for exactly this already exists — edit that one.' };
  const rule = { ...r, id: r.id || newId('cov') };
  commit({ ...d, rules: d.rules.some((x) => x.id === rule.id) ? d.rules.map((x) => (x.id === rule.id ? rule : x)) : [...d.rules, rule] });
  return { ok: true, message: 'Rule saved.' };
};
export const deleteRule = (id: string) => commit({ ...db(), rules: db().rules.filter((r) => r.id !== id) });

/** REP-02: the most specific rule wins — partner + product, partner, product, channel, then the default. */
export const targetFor = (partnerId: string, partnerTypeId: string, productId: string): { days: number; source: string } => {
  const rs = db().rules;
  const hit = rs.find((r) => r.scope === 'partner-product' && r.partnerId === partnerId && r.productId === productId)
    ?? rs.find((r) => r.scope === 'partner' && r.partnerId === partnerId)
    ?? rs.find((r) => r.scope === 'product' && r.productId === productId)
    ?? rs.find((r) => r.scope === 'channel' && r.partnerTypeId === partnerTypeId);
  const label: Record<RuleScope, string> = { 'partner-product': 'Partner + product', partner: 'Partner', product: 'Product', channel: 'Channel', default: 'Default' };
  return hit ? { days: hit.days, source: label[hit.scope] } : { days: db().settings.defaultDays, source: 'Default' };
};

/** Order pack: the sales unit's factor (e.g. box of 10), else 1. */
export const packOf = (p: Product | undefined) => {
  const u = p?.uomHierarchy?.find((x) => x.isSales && !x.isBase && x.factor > 1);
  return u ? Math.round(u.factor) : 1;
};

export const proposals = (principalId: string) => db().proposals.filter((p) => p.principalId === principalId);
export const getProposal = (id: string) => db().proposals.find((p) => p.id === id) ?? null;
const put = (p: Proposal) => { const d = db(); commit({ ...d, proposals: d.proposals.some((x) => x.id === p.id) ? d.proposals.map((x) => (x.id === p.id ? p : x)) : [p, ...d.proposals] }); };
const log = (p: Proposal, by: string, action: string, note?: string): Proposal => ({ ...p, history: [...p.history, { at: now(), by, action, note }] });

/** Mark sent proposals past their link expiry as Expired. */
export const expireProposals = () => {
  const t = now(); const d = db();
  const due = d.proposals.filter((p) => p.status === 'Sent' && p.expiresAt && p.expiresAt < t);
  if (!due.length) return;
  commit({ ...d, proposals: d.proposals.map((p) => (due.includes(p) ? { ...p, status: 'Expired' as const, history: [...p.history, { at: t, by: 'System', action: 'Expired — no answer from the partner' }] } : p)) });
};

/** Units of each product on open orders (not shipped yet) and in transit to the partner. */
const pipeline = (principalId: string, partnerId: string) => {
  const open: Record<string, number> = {}; const transit: Record<string, number> = {};
  orders().filter((o) => o.principalId === principalId && o.partnerId === partnerId).forEach((o) => {
    o.lines.forEach((l) => {
      const q = OPEN.includes(o.status) ? l.qty : o.status === 'Confirmed' ? Math.max(0, l.confirmedQty + l.freeQty - l.shippedQty) : 0;
      if (q > 0) open[l.productId] = (open[l.productId] ?? 0) + q;
    });
  });
  inTransit().filter((x) => x.order.principalId === principalId && x.order.partnerId === partnerId)
    .forEach((x) => x.shipment.allocations.forEach((a) => { transit[a.productId] = (transit[a.productId] ?? 0) + a.qty; }));
  return { open, transit };
};

/** REP-01 / REP-04: suggestions per partner from the latest accepted secondary data. */
export const suggest = (principalId: string, partners: { id: string; name: string; partnerTypeId: string }[], products: Product[]): PartnerSuggest[] => {
  expireProposals();
  const s = db().settings;
  const board = partnerBoard(principalId, partners.map((p) => p.id), () => 0);
  const sent = proposals(principalId).filter((p) => p.status === 'Sent');
  return partners.map((p) => {
    const b = board.find((x) => x.partnerId === p.id)!;
    const base = { partnerId: p.id, partnerName: p.name, partnerTypeId: p.partnerTypeId, dataAge: b.age, period: b.last?.period ?? null, rows: [] as SuggestRow[] };
    const setup = setupOf(p.id);
    if (setup.route === 'none') return { ...base, ok: false, reason: 'Not connected — only estimated figures, so no suggestion' };
    if (setup.onPlatform && !(consentAllows(p.id, 'stock') && consentAllows(p.id, 'sales'))) return { ...base, ok: false, reason: 'Distributor has not shared stock and sales with you' };
    if (!b.last) return { ...base, ok: false, reason: 'No accepted stock and sales report yet' };
    if (!b.fresh) return { ...base, ok: false, reason: `Data is ${b.age} day(s) old — older than the ${FRESH_DAYS[setup.cadence]}-day limit for ${setup.cadence} reporting` };
    if (b.last.scopes && !(b.last.scopes.stock && b.last.scopes.sales)) return { ...base, ok: false, reason: 'Latest report has only stock or only sales' };
    // Average daily sales over the last N accepted periods; stock from the latest report.
    const acc = reports(principalId).filter((r) => r.partnerId === p.id && r.status === 'Accepted').sort((a, z) => (a.period < z.period ? 1 : a.period > z.period ? -1 : a.submittedAt < z.submittedAt ? 1 : -1));
    const periods = Array.from(new Set(acc.map((r) => r.period))).slice(0, Math.max(1, s.lookbackPeriods));
    const latest = periods.map((per) => acc.find((r) => r.period === per)!);
    const days = periods.reduce((a, per) => a + daysIn(per), 0) || 1;
    const sold: Record<string, number> = {}; latest.forEach((r) => r.sales.forEach((x) => { sold[x.productId] = (sold[x.productId] ?? 0) + x.qty; }));
    const stock: Record<string, number> = {}; b.last.stock.forEach((x) => { stock[x.productId] = (stock[x.productId] ?? 0) + x.qty; });
    const { open, transit } = pipeline(principalId, p.id);
    const sentQty: Record<string, number> = {}; sent.filter((x) => x.partnerId === p.id).forEach((x) => x.lines.forEach((l) => { sentQty[l.productId] = (sentQty[l.productId] ?? 0) + l.qty; }));
    const ids = Array.from(new Set([...Object.keys(sold), ...Object.keys(stock)]));
    const rows: SuggestRow[] = ids.map((productId) => {
      const prod = products.find((x) => x.id === productId);
      const avgDaily = Math.round(((sold[productId] ?? 0) / days) * 100) / 100;
      const t = targetFor(p.id, p.partnerTypeId, productId);
      const have = (stock[productId] ?? 0) + (transit[productId] ?? 0) + (open[productId] ?? 0) + (sentQty[productId] ?? 0);
      const need = Math.max(0, t.days * avgDaily - have);
      const pack = packOf(prod);
      const suggested = need > 0 ? Math.ceil(need / pack) * pack : 0;
      return { partnerId: p.id, productId, name: prod?.name ?? productId, stock: stock[productId] ?? 0, transit: transit[productId] ?? 0, open: open[productId] ?? 0, sentQty: sentQty[productId] ?? 0,
        avgDaily, coverNow: avgDaily ? Math.round((stock[productId] ?? 0) / avgDaily) : null, targetDays: t.days, targetSource: t.source, need: Math.ceil(need), pack, suggested };
    }).sort((a, z) => z.suggested - a.suggested || (a.coverNow ?? 9999) - (z.coverNow ?? 9999));
    return { ...base, ok: true, reason: null, rows };
  });
};

/* ------------------------------- Proposals (REP-03) ------------------------------- */

export const createProposal = (principalId: string, partner: { id: string; name: string }, lines: ProposalLine[], by: string): { ok: boolean; message: string; id?: string } => {
  const ls = lines.filter((l) => l.qty > 0);
  if (!ls.length) return { ok: false, message: 'Pick at least one product with a quantity.' };
  const d = db(); const seq = d.seq + 1;
  const p: Proposal = { id: newId('rep'), no: `RS-26-${seq}`, principalId, partnerId: partner.id, partnerName: partner.name, lines: ls, status: 'Draft', createdBy: by, createdAt: now(),
    sentAt: null, expiresAt: null, link: null, respondedBy: null, respondedAt: null, via: null, reason: null, orderId: null, orderCode: null, edited: ls.some((l) => l.qty !== l.suggested),
    history: [{ at: now(), by, action: 'Suggested order prepared', note: ls.map((l) => `${l.name} ${l.qty}`).join(', ') }] };
  commit({ ...d, seq, proposals: [p, ...d.proposals] });
  return { ok: true, message: `${p.no} prepared.`, id: p.id };
};

export const sendProposal = (id: string, by: string): { ok: boolean; message: string; link?: string } => {
  const p = getProposal(id); if (!p || p.status !== 'Draft') return { ok: false, message: 'Only a prepared suggestion can be sent.' };
  const hours = db().settings.expiryHours;
  const link = issueLink('repl-respond', p.id, p.principalId, p.partnerName, hours);
  put(log({ ...p, status: 'Sent', sentAt: now(), expiresAt: new Date(Date.now() + hours * 3600000).toISOString(), link }, by, 'Sent to the partner', `Link valid ${hours} h`));
  return { ok: true, message: `${p.no} sent to ${p.partnerName}.`, link };
};

export const withdrawProposal = (id: string, by: string, why: string) => {
  const p = getProposal(id); if (!p || !['Draft', 'Sent'].includes(p.status)) return { ok: false, message: 'Nothing to withdraw.' };
  revokeLinks(p.id, 'The suggestion was withdrawn');
  put(log({ ...p, status: 'Withdrawn' }, by, 'Withdrawn', why || undefined));
  return { ok: true, message: `${p.no} withdrawn.` };
};

/**
 * The partner answers. Accept (with the partner's quantities, which may differ) creates a normal sales order
 * that runs every order check; reject records the reason.
 */
export const respondProposal = (id: string, accept: boolean, qty: Record<string, number>, reason: string, by: string, via: 'Partner link' | 'Phone / on behalf', ctx: OrderCtx | null): { ok: boolean; message: string; errors?: string[] } => {
  const p = getProposal(id);
  if (!p || !['Sent', 'Draft'].includes(p.status)) return { ok: false, message: 'This suggestion is no longer open.' };
  if (!accept) {
    if (!reason.trim()) return { ok: false, message: 'Say why the suggestion is rejected.', errors: ['Give a reason so the sales team can follow up.'] };
    revokeLinks(p.id, 'Already answered');
    put(log({ ...p, status: 'Rejected', respondedBy: by, respondedAt: now(), via, reason }, by, `Rejected (${via})`, reason));
    emit('replenishment.answered', 'Replenishment', by, `${p.no} rejected by ${p.partnerName}`, { proposalId: p.id, accepted: false });
    return { ok: true, message: `${p.no} rejected — the sales team is told.` };
  }
  if (!ctx) return { ok: false, message: 'Order data is still loading — try again.' };
  const partner = ctx.partners.find((x) => x.id === p.partnerId);
  if (!partner) return { ok: false, message: 'The partner no longer exists.' };
  const lines = p.lines.map((l) => ({ ...l, partnerQty: Math.max(0, Math.round(qty[l.productId] ?? l.qty)) }));
  const keep = lines.filter((l) => (l.partnerQty ?? 0) > 0);
  if (!keep.length) return { ok: false, message: 'All quantities are 0 — reject the suggestion instead.' };
  const transfer = partner.partnerTypeId === 'pt-cnf';
  const shipFrom = shipFromFor(partner.id, ctx, ctx.warehouses ?? [], keep.map((l) => l.productId));
  if (!shipFrom) return { ok: false, message: `${partner.name} has no sales route to ship from — fix the route in Go-to-Market first.` };
  const edited = lines.some((l) => l.partnerQty !== l.qty);
  const today = now().slice(0, 10);
  const r = createOrder({
    principalId: p.principalId, partner, channelId: null, orderType: transfer ? 'Stock transfer' : 'Sale', shipFrom, poNumber: `${p.no}`, poDate: today,
    requiredBy: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), source: via === 'Partner link' ? 'Portal' : 'Phone',
    notes: `From suggested order ${p.no}${edited ? ' (quantities changed by the partner)' : ''}`,
    enteredFor: via === 'Partner link' ? null : partner.name,
    lines: keep.map((l) => priceLine(ctx, partner.id, p.principalId, l.productId, null, l.partnerQty!, transfer)),
  }, by, ctx);
  if (!r.ok || !r.id) return { ok: false, message: r.message, errors: r.errors };
  const o = getOrder(r.id);
  revokeLinks(p.id, 'Already answered');
  put(log({ ...p, lines, status: 'Accepted', respondedBy: by, respondedAt: now(), via, edited: p.edited || edited, orderId: r.id, orderCode: o?.code ?? null }, by, `Accepted${edited ? ' with changes' : ''} (${via})`, `Order ${o?.code}`));
  emit('replenishment.answered', 'Replenishment', by, `${p.no} accepted by ${p.partnerName} → ${o?.code}`, { proposalId: p.id, accepted: true, orderId: r.id });
  return { ok: true, message: `Thank you — order ${o?.code} is placed (${o?.status ?? 'Received'}).` };
};

/** Stats for the dashboard. */
export const replStats = (principalId: string) => {
  expireProposals();
  const ps = proposals(principalId); const m = now().slice(0, 7);
  const answered = ps.filter((p) => ['Accepted', 'Rejected', 'Expired'].includes(p.status) && (p.respondedAt ?? p.expiresAt ?? '').slice(0, 7) === m);
  return {
    waiting: ps.filter((p) => p.status === 'Sent').length,
    drafts: ps.filter((p) => p.status === 'Draft').length,
    acceptedMonth: answered.filter((p) => p.status === 'Accepted').length,
    acceptRate: answered.length ? Math.round((answered.filter((p) => p.status === 'Accepted').length / answered.length) * 100) : null,
  };
};

/**
 * Demo: a channel rule and a product rule so the precedence is visible, and one busy month-to-date update from a
 * connected partner (live feeds resend month-to-date figures) so there is a real reorder case.
 */
export const ensureReplenishmentDemo = (principalId: string, partners: { id: string; name: string; locType: LocType }[], products: Product[]) => {
  const d = db(); if (d.seeded.includes(principalId) || !products.length || !partners.length) return;
  const rules: CoverRule[] = [
    { id: newId('cov'), scope: 'channel', partnerTypeId: 'pt-dist', days: 45, note: 'Distributors hold 6 weeks' },
    { id: newId('cov'), scope: 'product', productId: products[0].id, days: 60, note: 'Fast mover — longer cover' },
  ];
  commit({ ...d, rules: [...d.rules, ...rules.filter((r) => !d.rules.some((x) => x.scope === r.scope && x.partnerTypeId === r.partnerTypeId && x.productId === r.productId))], seeded: [...d.seeded, principalId] });
  const period = thisPeriod();
  const target = partners.find((p) => setupOf(p.id).route !== 'none' && (!setupOf(p.id).onPlatform || consentAllows(p.id, 'sales'))
    && reports(principalId).some((r) => r.partnerId === p.id && r.period === period && r.status === 'Accepted'));
  if (!target) return;
  const last = reports(principalId).filter((r) => r.partnerId === target.id && r.period === period && r.status === 'Accepted').sort((a, z) => (a.submittedAt < z.submittedAt ? 1 : -1))[0];
  const ids = Array.from(new Set(last.stock.map((x) => x.productId))).slice(0, 3);
  const lines = ids.flatMap((productId, j) => {
    const prod = products.find((x) => x.id === productId); if (!prod) return [];
    const avail = openingOf(target.id, productId, period, principalId) + receiptsOf(target.id, productId, period);
    const sold = Math.max(0, Math.round(avail * (j === 0 ? 0.85 : j === 1 ? 0.6 : 0.2)));
    const value = Math.round((prod.pricingReference?.mrp ?? 20000) * 0.8);
    return [
      ...(sold ? [{ kind: 'sale' as const, code: prod.code, qty: sold, customer: 'Hospital in Hyderabad', customerType: 'Hospital', town: 'Hyderabad', value: sold * value, invoiceNo: `MTD/${period.replace('-', '')}/${j + 1}`, date: new Date().toISOString().slice(0, 10) }] : []),
      { kind: 'stock' as const, code: prod.code, qty: Math.max(0, avail - sold), batch: last.stock.find((x) => x.productId === productId)?.batch },
    ];
  });
  const setup = setupOf(target.id);
  const r = submitReport({ principalId, partnerId: target.id, partnerName: target.name, locType: target.locType, period, route: setup.route, system: setup.system, lines }, products, 'System');
  const rep = r.id ? getReport(r.id) : null;
  if (rep && rep.status === 'Needs review') acceptReport(rep.id, 'System', 'Month-to-date update');
};

/**
 * DMS stock-norm check: an order that would take the partner above the norm (days of stock at its current daily sales)
 * is held for approval. Needs the partner's reported stock and sales; without them the check is skipped.
 */
export const stockNormCheck = (o: Order, ctx: OrderCtx): Check | null => {
  const max = optChoice('orders', 'stockNorm'); if (max === 'off' || ['Cancelled', 'Rejected', 'Completed'].includes(o.status)) return null;
  const p = ctx.partners.find((x) => x.id === o.partnerId); if (!p || p.institution) return null;
  const sg = suggest(o.principalId, [{ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId }], ctx.products)[0];
  if (!sg?.ok) return null;
  const lim = Number(max);
  const rows = o.lines.map((l) => {
    const r = sg.rows.find((x) => x.productId === l.productId);
    if (!r || !(r.avgDaily > 0)) return null;
    const before = Math.round((r.stock + r.transit) / r.avgDaily); const after = Math.round((r.stock + r.transit + l.qty) / r.avgDaily);
    return { name: l.name, before, after };
  }).filter((x): x is { name: string; before: number; after: number } => !!x);
  if (!rows.length) return { id: 'stock-norm', label: 'Stock norm', state: 'pass', detail: 'No sales history for these products at the partner yet' };
  const over = rows.filter((x) => x.after > lim);
  return over.length
    ? { id: 'stock-norm', label: 'Stock norm', state: 'hold', detail: over.map((x) => `${x.name.slice(0, 40)}: ${x.before} → ${x.after} days (norm ${lim})`).join('; ') }
    : { id: 'stock-norm', label: 'Stock norm', state: 'pass', detail: `Within ${lim} days of stock after this order (max ${Math.max(...rows.map((x) => x.after))} days)` };
};
