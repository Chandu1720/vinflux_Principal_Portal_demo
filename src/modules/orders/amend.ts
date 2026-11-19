/**
 * Changing an order after it was placed — versioned (v1, v2…), checked against the principal's amendment settings.
 *   open orders       → change freely, then the checks and approval rules run again
 *   confirmed orders  → allowed until picking / dispatch (setting); a reduction releases stock at once;
 *                       an increase or a new line is re-checked for stock, or goes back for approval (setting)
 */
import { orderSettings } from './orderSettings';
import { OPEN, approvalHits, atp, getOrder, log, minShelfDays, put, shipFromSource, validate, withNotice } from './orderStore';
import type { Order, OrderCtx, OrderLine } from './orderStore';
import { priceLine } from './intake';
import { newId } from '../../platform/store';

export interface LineChange { lineId: string | null; productId: string; variantSku: string | null; qty: number }
type Result = { ok: boolean; message: string; errors?: string[] };

/** Why this order can't be changed right now (null = it can). */
export const amendBlock = (o: Order): string | null => {
  const s = orderSettings().amend;
  if (OPEN.includes(o.status)) return null;
  if (o.status !== 'Confirmed') return `A ${o.status.toLowerCase()} order can’t be changed.`;
  if (s.deskAmendUntil === 'none') return 'Your settings don’t allow changes after confirmation (Orders → Settings → Changes).';
  if (s.deskAmendUntil === 'picking' && o.shipments.length) return 'Changes are allowed only until picking starts, and this order has started shipping.';
  return null;
};

export const amendOrder = (id: string, changes: LineChange[], reason: string, ctx: OrderCtx, by: string): Result => {
  const o = getOrder(id);
  if (!o) return { ok: false, message: 'Order not found.' };
  const block = amendBlock(o);
  if (block) return { ok: false, message: block };
  if (!reason.trim()) return { ok: false, message: 'Give the reason for the change — it goes in the order history and the email.' };
  const s = orderSettings().amend;
  const confirmed = o.status === 'Confirmed';
  const inst = !!ctx.partners.find((p) => p.id === o.partnerId)?.institution;
  const errs: string[] = [];
  const text: string[] = [];
  let increased = false;
  let reduced = false;
  const lines: OrderLine[] = [];
  o.lines.forEach((l) => {
    const c = changes.find((x) => x.lineId === l.id);
    const qty = c ? c.qty : l.qty;
    if (qty === l.qty) { lines.push(l); return; }
    if (qty < l.shippedQty) { errs.push(`${l.name}: ${l.shippedQty} already shipped — can’t go below that.`); lines.push(l); return; }
    text.push(qty === 0 ? `${l.name}: removed (was ${l.qty})` : `${l.name}: ${l.qty} → ${qty}`);
    if (qty > l.qty) increased = true; else reduced = true;
    if (qty === 0 && l.shippedQty === 0) return;
    if (!confirmed) { lines.push({ ...l, qty }); return; }
    if (qty < l.qty) { lines.push({ ...l, qty, confirmedQty: Math.min(l.confirmedQty, qty), backorderQty: Math.max(0, Math.min(l.backorderQty, qty - Math.min(l.confirmedQty, qty))) }); return; }
    const extra = qty - l.qty;
    const free = atp(o.shipFrom.id, l.productId, l.variantSku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst), o.id) - (l.confirmedQty + l.freeQty - l.shippedQty);
    if (s.increase === 'auto' && shipFromSource(o, ctx) !== 'NONE' && extra > free) errs.push(`${l.name}: only ${Math.max(0, free)} more available to promise.`);
    lines.push({ ...l, qty, confirmedQty: s.increase === 'auto' ? l.confirmedQty + extra : l.confirmedQty });
  });
  changes.filter((c) => !c.lineId && c.productId && c.qty > 0).forEach((c) => {
    const priced = priceLine(ctx, o.partnerId, o.principalId, c.productId, c.variantSku, c.qty, o.orderType === 'Stock transfer');
    text.push(`${priced.name}: added × ${c.qty}`);
    increased = true;
    lines.push({ ...priced, id: newId('ol'), confirmedQty: confirmed && s.increase === 'auto' ? c.qty : 0, shippedQty: 0, backorderQty: 0, backorderDate: null, substituteFor: null });
  });
  if (!text.length) return { ok: false, message: 'Nothing changed.' };
  if (!lines.some((l) => l.qty > 0)) errs.push('An order needs at least one line — reject or cancel it instead.');
  if (errs.length) return { ok: false, message: 'Can’t change the order.', errors: errs };

  const v = (o.version ?? 1) + 1;
  const needsApproval = confirmed && ((increased && s.increase === 'approval') || (reduced && s.reduce === 'approval'));
  let next: Order = {
    ...o, lines, version: v, versions: [...(o.versions ?? []), { v, at: new Date().toISOString(), by, reason, changes: text }],
  };
  if (needsApproval) {
    // Back for approval: the reservation drops until the change is approved and the order is confirmed again.
    next = { ...next, status: 'Awaiting approval', lines: lines.map((l) => ({ ...l, confirmedQty: 0, backorderQty: 0, backorderDate: null })), blockers: [`Approval: change v${v} — ${text.join('; ')}`],
      approval: { ruleIds: ['amendment', ...approvalHits(next).map((h) => h.rule.id)], reasons: [`Change v${v}: ${text.join('; ')}`], levels: [orderSettings().approval.rules.find((r) => r.enabled)?.levels[0] ?? 'Regional Sales Head'], step: 0, stepSince: new Date().toISOString(), done: false, decisions: [] } };
  }
  next = log(next, by, `Changed — version ${v}${needsApproval ? ' (waiting for approval)' : ''}`, `${text.join('; ')} — ${reason}`);
  const had = next.notifications?.length ?? 0;
  const noticed = withNotice(next, 'amended', { changes: text.map((t) => `• ${t}`).join('\n'), reason });
  const added = (noticed.notifications ?? []).slice(had).filter((n) => s.notify === 'both' || (s.notify === 'partner' ? n.audience === 'Partner' : n.audience === 'Internal'));
  next = { ...next, notifications: [...(next.notifications ?? []), ...added] };
  put(next);
  if (!confirmed) validate(id, ctx, by);
  return { ok: true, message: `${o.code} changed (v${v})${needsApproval ? ' — waiting for approval' : ''}.` };
};
