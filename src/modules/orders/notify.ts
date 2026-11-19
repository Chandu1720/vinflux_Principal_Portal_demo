/**
 * Order notifications — composed from the principal's templates and logged on the order.
 * Phase 1: every message is logged with its exact text (previewable); real sending (own SMTP / Office 365 /
 * Google / VinFlux fallback) is phase 2. INTEGRATION POINT: POST /notify → mail / WhatsApp provider.
 */
import { EVENTS, fill, orderSettings } from './orderSettings';
import type { NotifyEvent } from './orderSettings';

export interface Notice {
  id: string; at: string; event: NotifyEvent; audience: 'Partner' | 'Internal'; channel: 'Email' | 'WhatsApp';
  from: string; to: string; subject: string; body: string; status: 'Logged (demo — not sent)' | 'Sent' | 'Failed';
}
interface OrderLike {
  code: string; poNumber: string; partnerName: string; partnerEmail?: string | null; requiredBy: string;
  lines: { name: string; qty: number; confirmedQty: number; backorderQty: number; backorderDate: string | null }[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
let seq = 0;
const id = () => `ntc-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Lines as a short plain-text list for the email body. */
export const lineText = (o: OrderLike, confirmed = false) => o.lines.map((l) => `• ${l.name} — ${confirmed ? `${l.confirmedQty} of ${l.qty}${l.backorderQty ? ` (${l.backorderQty} on backorder${l.backorderDate ? ` by ${l.backorderDate}` : ''})` : ''}` : l.qty}`).join('\n');

/** The sender shown on every message (own domain when configured, else the VinFlux fallback address). */
export const senderOf = () => {
  const n = orderSettings().notify;
  return `${n.senderName || 'Order Desk'} <${n.senderEmail || 'principal@orders.vinflux.in'}>`;
};

/** Compose the messages one event produces for this order (empty when the event is switched off). */
export const compose = (o: OrderLike, event: NotifyEvent, vars: Record<string, string | number | undefined> = {}, value?: number): Notice[] => {
  const s = orderSettings();
  const e = s.notify.events[event];
  if (!e) return [];
  const v: Record<string, string> = {
    orderNo: o.code, poNumber: o.poNumber, partnerName: o.partnerName, lines: lineText(o, ['confirmed', 'partfill'].includes(event)),
    eta: o.requiredBy, senderName: s.notify.senderName || 'Order Desk', value: value !== undefined ? inr(value) : '',
    replyHours: String(s.partFill.replyHours), timeoutAction: s.partFill.onTimeout === 'ship-available' ? 'ship what is available and keep the rest on backorder' : 'wait for the complete order',
    actionLink: `https://portal.vinflux.in/o/${o.code.toLowerCase()}`, reason: '', changes: '',
    ...Object.fromEntries(Object.entries(vars).filter(([, x]) => x !== undefined).map(([k, x]) => [k, String(x)])),
  };
  const from = senderOf();
  const at = new Date().toISOString();
  const base = { at, event, from, subject: fill(e.subject, v), body: fill(e.body, v), status: 'Logged (demo — not sent)' as const };
  const out: Notice[] = [];
  if (e.partner) out.push({ ...base, id: id(), audience: 'Partner', channel: 'Email', to: o.partnerEmail || `${o.partnerName} (no email on file — portal)` });
  if (e.partner && e.whatsapp) out.push({ ...base, id: id(), audience: 'Partner', channel: 'WhatsApp', to: o.partnerName });
  if (e.internal) out.push({ ...base, id: id(), audience: 'Internal', channel: 'Email', to: vars.internalTo ? String(vars.internalTo) : EVENTS.find((x) => x.id === event)?.internalTo ?? 'Order desk' });
  return out;
};
