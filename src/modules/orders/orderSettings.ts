/**
 * Order management settings — one set per principal. Every policy in the order-management spec is a setting here,
 * shipped with the spec's default so a principal can go live without touching anything.
 *
 * Phase 1: data sources, one inventory mode per principal, intake channels, approval rules, reservation point,
 * part-fill choice, amendments, notifications (logged + previewed; real sending is phase 2).
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';

/* ---------------------------------- Types ---------------------------------- */

export type InputId = 'products' | 'partners' | 'policies' | 'prices' | 'schemes' | 'credit' | 'stock' | 'warehouses' | 'invoice' | 'tracking';
/** Where an input comes from: a VinFlux module, the principal's connected system, a file, or not used. */
export type SourceKind = 'vinflux' | 'connected' | 'file' | 'none';
export type IntakeChannel = 'portal' | 'email' | 'manual' | 'excel' | 'pdf' | 'field' | 'phone';
export type ReservationPoint = 'submission' | 'approval' | 'confirmation';
export type RuleKind = 'value' | 'discount' | 'newPartner' | 'partnerType' | 'priceChange';
export interface ApprovalRule {
  id: string; name: string; enabled: boolean; kind: RuleKind;
  /** value: order value above (₹); discount: % off list above; newPartner: first N orders; partnerType: these types. */
  threshold: number; partnerTypeIds: string[];
  /** Approvers in sequence (role names). Two entries = two-level approval. */
  levels: string[];
}
export type NotifyEvent = 'received' | 'hold' | 'approval' | 'confirmed' | 'partfill' | 'amended' | 'rejected' | 'cancelled' | 'shipped' | 'delivered' | 'backorder';
export interface EventSetting { partner: boolean; internal: boolean; whatsapp: boolean; subject: string; body: string }

export interface OrderSettings {
  sources: Record<InputId, SourceKind>;
  /** Mode and connector live in Inventory → stock source (one per principal); this is how ERP stock is read at confirmation. */
  inventory: { read: 'live' | 'sync' | 'live-fallback' };
  channels: Record<IntakeChannel, boolean>;
  /** Partners that may NOT use a channel (e.g. no portal access). */
  partnerBlocks: Record<string, IntakeChannel[]>;
  autoConfirm: boolean;
  approval: { rules: ApprovalRule[]; reminderHours: number; escalateHours: number };
  reservation: ReservationPoint;
  partFill: { mode: 'partner' | 'desk'; replyHours: number; onTimeout: 'ship-available' | 'wait'; backorderDays: number };
  amend: {
    partnerEditUntil: 'none' | 'approved' | 'confirmed';
    deskAmendUntil: 'none' | 'picking' | 'dispatch';
    reduce: 'auto' | 'approval'; increase: 'auto' | 'approval';
    partnerCancelUntil: 'none' | 'confirmed' | 'dispatch';
    notify: 'partner' | 'internal' | 'both';
  };
  notify: { senderName: string; senderEmail: string; replyTo: string; ackWhen: 'receipt' | 'after-checks'; ackSources: string[]; unreadableReply: boolean; events: Record<NotifyEvent, EventSetting> };
}

/* --------------------------------- Defaults --------------------------------- */

export const INPUTS: { id: InputId; label: string; options: SourceKind[]; vinflux: string; connected: string; file: string; none: string; required?: boolean }[] = [
  { id: 'products', label: 'Products', options: ['vinflux', 'connected', 'file'], vinflux: 'Product Master', connected: 'ERP item import', file: 'Excel import', none: '—', required: true },
  { id: 'partners', label: 'Partners & ship-to', options: ['vinflux', 'connected', 'file'], vinflux: 'Go-to-Market partners', connected: 'ERP customers', file: 'Excel import', none: '—', required: true },
  { id: 'policies', label: 'Who supplies whom', options: ['vinflux', 'none'], vinflux: 'Go-to-Market sales policies', connected: '—', file: '—', none: 'Every order goes to the principal' },
  { id: 'prices', label: 'Prices', options: ['vinflux', 'connected', 'file', 'none'], vinflux: 'Price Lists', connected: 'ERP price list', file: 'Excel price list', none: 'Price entered on the order' },
  { id: 'schemes', label: 'Schemes & discounts', options: ['vinflux', 'connected', 'file', 'none'], vinflux: 'Schemes (Price Lists)', connected: 'ERP schemes', file: 'Excel', none: 'No schemes' },
  { id: 'credit', label: 'Credit limit & dues', options: ['vinflux', 'connected', 'file', 'none'], vinflux: 'Go-to-Market credit', connected: 'Accounting outstanding', file: 'Ageing Excel upload', none: 'No credit check' },
  { id: 'stock', label: 'Stock', options: ['vinflux', 'connected', 'none'], vinflux: 'VinFlux Inventory', connected: 'One ERP connector', file: '—', none: 'Manual confirmation' },
  { id: 'warehouses', label: 'Warehouses & C&F', options: ['vinflux', 'connected', 'file'], vinflux: 'Warehouse Master', connected: 'ERP locations', file: 'Excel', none: 'One default location' },
  { id: 'invoice', label: 'Tax invoice', options: ['connected', 'file'], vinflux: '—', connected: 'Accounting / ERP', file: 'Typed in or register upload', none: '—' },
  { id: 'tracking', label: 'Shipment tracking', options: ['vinflux', 'connected', 'file', 'none'], vinflux: 'Logistics', connected: 'Courier API', file: 'Typed in', none: 'Simple “dispatched” status' },
];

export const CHANNELS: { id: IntakeChannel; label: string; who: string }[] = [
  { id: 'portal', label: 'Partner portal', who: 'Distributor / dealer orders themselves' },
  { id: 'email', label: 'Email sync', who: 'Orders mailbox read automatically, incl. PDF / Excel attachments' },
  { id: 'manual', label: 'Manual entry', who: 'Order desk types the order' },
  { id: 'excel', label: 'Excel upload', who: 'Order desk uploads the partner’s Excel / CSV' },
  { id: 'pdf', label: 'PDF upload', who: 'Order desk uploads the partner’s PO (PDF)' },
  { id: 'field', label: 'Field app', who: 'Sales rep orders on behalf of the partner' },
  { id: 'phone', label: 'Phone / WhatsApp', who: 'Order desk types it in, with the call reference' },
];

export const EVENTS: { id: NotifyEvent; label: string; internalTo: string }[] = [
  { id: 'received', label: 'Order received', internalTo: 'Order desk' },
  { id: 'hold', label: 'On hold', internalTo: 'Approver' },
  { id: 'approval', label: 'Approval needed', internalTo: 'Approver' },
  { id: 'confirmed', label: 'Confirmed', internalTo: 'Warehouse / C&F' },
  { id: 'partfill', label: 'Part-fill choice', internalTo: 'Order desk' },
  { id: 'amended', label: 'Amended', internalTo: 'Sales owner' },
  { id: 'rejected', label: 'Rejected', internalTo: 'Sales owner' },
  { id: 'cancelled', label: 'Cancelled', internalTo: 'Sales owner' },
  { id: 'shipped', label: 'Shipped', internalTo: 'Order desk' },
  { id: 'delivered', label: 'Delivered', internalTo: 'Order desk' },
  { id: 'backorder', label: 'Backorder released', internalTo: 'Warehouse / C&F' },
];

const ev = (partner: boolean, internal: boolean, subject: string, body: string): EventSetting => ({ partner, internal, whatsapp: false, subject, body });
export const DEFAULT_EVENTS: Record<NotifyEvent, EventSetting> = {
  received: ev(true, true, 'We received your order {poNumber} — ref {orderNo}', 'Dear {partnerName},\n\nThank you. We received your order {poNumber} (our reference {orderNo}).\n\n{lines}\n\nWe will confirm quantities and dispatch date shortly.\n\n{senderName}'),
  hold: ev(true, true, 'Order {orderNo} is on hold', 'Dear {partnerName},\n\nYour order {poNumber} ({orderNo}) is on hold: {reason}\n\nPlease contact us or clear the item above so we can process it.\n\n{senderName}'),
  approval: ev(false, true, 'Approval needed: {orderNo} for {partnerName}', 'Order {orderNo} for {partnerName} ({value}) needs your approval.\n\nReason: {reason}\n\nApprove or reject: {actionLink}'),
  confirmed: ev(true, true, 'Order {orderNo} confirmed', 'Dear {partnerName},\n\nYour order {poNumber} is confirmed.\n\n{lines}\n\nExpected dispatch: {eta}\n\n{senderName}'),
  partfill: ev(true, true, 'Order {orderNo}: part of your order is available now', 'Dear {partnerName},\n\nWe can supply part of order {poNumber} now.\n\n{lines}\n\nPlease choose: ship what is available now, wait for the complete order, or accept the proposed quantity: {actionLink}\n\nIf we don’t hear from you within {replyHours} hours we will {timeoutAction}.\n\n{senderName}'),
  amended: ev(true, true, 'Order {orderNo} changed', 'Dear {partnerName},\n\nOrder {poNumber} ({orderNo}) was changed:\n\n{changes}\n\nReason: {reason}\n\n{senderName}'),
  rejected: ev(true, true, 'Order {orderNo} could not be accepted', 'Dear {partnerName},\n\nWe could not accept order {poNumber}: {reason}\n\n{senderName}'),
  cancelled: ev(true, true, 'Order {orderNo} cancelled', 'Dear {partnerName},\n\nOrder {poNumber} ({orderNo}) was cancelled: {reason}\n\n{senderName}'),
  shipped: ev(true, false, 'Order {orderNo} shipped — {carrier} {awb}', 'Dear {partnerName},\n\nShipment {shipmentNo} of order {poNumber} left today.\n\nInvoice {invoiceNo} · {carrier} {awb} · ETA {eta}\n\n{senderName}'),
  delivered: ev(true, false, 'Order {orderNo} delivered', 'Dear {partnerName},\n\nShipment {shipmentNo} was delivered. If anything is short or damaged, raise a claim here: {actionLink}\n\n{senderName}'),
  backorder: ev(true, true, 'Backorder for {orderNo} is on its way', 'Dear {partnerName},\n\nThe remaining quantity of order {poNumber} is now being dispatched as {orderNo}.\n\n{senderName}'),
};

export const DEFAULT_RULES = (): ApprovalRule[] => [
  { id: 'rule-value', name: 'Large order', enabled: true, kind: 'value', threshold: 500000, partnerTypeIds: [], levels: ['Regional Sales Head'] },
  { id: 'rule-discount', name: 'Price below the price list', enabled: true, kind: 'priceChange', threshold: 0, partnerTypeIds: [], levels: ['Finance Controller'] },
  { id: 'rule-new', name: 'New partner (first orders)', enabled: true, kind: 'newPartner', threshold: 3, partnerTypeIds: [], levels: ['Regional Sales Head'] },
  { id: 'rule-big', name: 'Very large order — two levels', enabled: true, kind: 'value', threshold: 2500000, partnerTypeIds: [], levels: ['Regional Sales Head', 'Finance Controller'] },
];

export const defaults = (): OrderSettings => ({
  sources: { products: 'vinflux', partners: 'vinflux', policies: 'vinflux', prices: 'vinflux', schemes: 'vinflux', credit: 'vinflux', stock: 'connected', warehouses: 'vinflux', invoice: 'connected', tracking: 'vinflux' },
  inventory: { read: 'live-fallback' },
  channels: { portal: true, email: true, manual: true, excel: true, pdf: true, field: true, phone: true },
  partnerBlocks: {},
  autoConfirm: true,
  approval: { rules: DEFAULT_RULES(), reminderHours: 4, escalateHours: 24 },
  reservation: 'confirmation',
  partFill: { mode: 'partner', replyHours: 24, onTimeout: 'ship-available', backorderDays: 7 },
  amend: { partnerEditUntil: 'confirmed', deskAmendUntil: 'dispatch', reduce: 'auto', increase: 'approval', partnerCancelUntil: 'confirmed', notify: 'both' },
  notify: { senderName: 'Order Desk', senderEmail: '', replyTo: '', ackWhen: 'receipt', ackSources: ['Email', 'Portal', 'Field app', 'Phone', 'Excel', 'PDF', 'EDI'], unreadableReply: true, events: DEFAULT_EVENTS },
});

/* ---------------------------------- Store ---------------------------------- */

let cache: { key: string; s: OrderSettings } | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.orderSettings.v1');
/** Merge stored settings over defaults so new settings appear for existing principals. */
const merge = (s: Partial<OrderSettings>): OrderSettings => {
  const d = defaults();
  return {
    ...d, ...s,
    sources: { ...d.sources, ...s.sources }, inventory: { ...d.inventory, ...s.inventory }, channels: { ...d.channels, ...s.channels },
    approval: { ...d.approval, ...s.approval }, partFill: { ...d.partFill, ...s.partFill }, amend: { ...d.amend, ...s.amend },
    notify: { ...d.notify, ...s.notify, events: { ...d.notify.events, ...s.notify?.events } },
  };
};
export const orderSettings = (): OrderSettings => {
  const key = KEY();
  if (cache?.key !== key) cache = { key, s: merge(loadJson<Partial<OrderSettings>>(key, {})) };
  return cache.s;
};
export const saveOrderSettings = (s: OrderSettings) => { cache = { key: KEY(), s }; saveJson(KEY(), s); listeners.forEach((l) => l()); };
export const patchOrderSettings = (p: Partial<OrderSettings>) => saveOrderSettings({ ...orderSettings(), ...p });
export const subscribeOrderSettings = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const newRule = (): ApprovalRule => ({ id: newId('rule'), name: 'New rule', enabled: true, kind: 'value', threshold: 100000, partnerTypeIds: [], levels: ['Regional Sales Head'] });

/** Is a channel open for this partner? */
export const channelOpen = (ch: IntakeChannel, partnerId?: string | null) => {
  const s = orderSettings();
  return s.channels[ch] && !(partnerId && s.partnerBlocks[partnerId]?.includes(ch));
};

/** Fill a template: {name} placeholders from vars; unknown placeholders stay visible. */
export const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));

export const RULE_TEXT: Record<RuleKind, string> = {
  value: 'Order value above (₹)',
  discount: 'Discount off the price list above (%)',
  priceChange: 'Any price below the partner’s price list',
  newPartner: 'Partner’s first N orders',
  partnerType: 'Orders from these partner types',
};
