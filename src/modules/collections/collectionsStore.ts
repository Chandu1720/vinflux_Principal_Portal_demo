/**
 * Collections (OP5, CRD-04/05): what partners owe, what they paid, and chasing the rest.
 *
 *   Invoice (from delivered shipments, the ERP or an opening balance) ─► payment allocated ─► paid
 *   Cheque: Received ─► Cleared   (or Bounced → payment reversed, charge added, optional credit hold)
 *   Post-dated cheque: held until its date, never counted as paid before it clears.
 *
 * Rules
 *   CRD-01 Outstanding comes from the source set in Orders → Data sources (VinFlux's own invoices and payments, or the ERP).
 *   CRD-04 Ageing by partner (0–30, 31–60, 61–90, 90+ days past due), reminders on a schedule, follow-ups and promises to pay,
 *          payments recorded by field users with a receipt photo, allocation to invoices, statements of account.
 *   CRD-05 A bounced cheque reverses the payment, adds the bounce charge, and can put the partner on credit hold.
 * The partner's credit position (outstanding, overdue) is written back to the partner so the order credit check uses it.
 * INTEGRATION POINT: GET /receivables (ERP), POST /receipts (ERP connector: create_receipt), reminders → mail / WhatsApp provider.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { orders, orderValue } from '../orders/orderStore';
import type { Order, Shipment } from '../orders/orderStore';

export type Mode = 'NEFT / RTGS' | 'UPI' | 'Cheque' | 'Post-dated cheque' | 'Cash';
export const MODES: Mode[] = ['NEFT / RTGS', 'UPI', 'Cheque', 'Post-dated cheque', 'Cash'];
export type PayStatus = 'Cleared' | 'Awaiting clearance' | 'Held (post-dated)' | 'Bounced';
export interface Invoice { id: string; no: string; principalId: string; partnerId: string; partnerName: string; date: string; dueDate: string; amount: number; source: 'VinFlux' | 'ERP' | 'Opening balance' | 'Bounce charge'; ref: string }
export interface Payment {
  id: string; no: string; principalId: string; partnerId: string; partnerName: string; date: string; amount: number; mode: Mode; ref: string;
  chequeDate: string | null; status: PayStatus; allocations: { invoiceId: string; amount: number }[]; recordedBy: string; receiptPhoto: string | null;
  history: { at: string; by: string; action: string; note?: string }[];
}
export interface PromiseToPay { id: string; partnerId: string; amount: number; date: string; note: string; by: string; at: string; status: 'Open' | 'Kept' | 'Broken' }
export interface FollowUp { id: string; partnerId: string; note: string; due: string; owner: string; done: boolean; at: string }
export interface Reminder { id: string; partnerId: string; invoiceNo: string; stage: string; channel: string; at: string; text: string }
export interface CollSettings { reminders: { offset: number; channel: 'Email' | 'WhatsApp' | 'Email + WhatsApp' }[]; bounceCharge: number; holdOnBounce: boolean; defaultCreditDays: number }

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
export const daysPast = (d: string) => Math.floor((Date.parse(today()) - Date.parse(d)) / 86400000);

interface Db { invoices: Invoice[]; payments: Payment[]; promises: PromiseToPay[]; tasks: FollowUp[]; reminders: Reminder[]; settings: CollSettings; seq: number; seeded: string[] }
const KEY = () => workspaceKey('vinflux.collections.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: loadJson<Db>(KEY(), { invoices: [], payments: [], promises: [], tasks: [], reminders: [], seq: 900, seeded: [], settings: { reminders: [{ offset: -3, channel: 'Email' }, { offset: 0, channel: 'Email + WhatsApp' }, { offset: 7, channel: 'Email + WhatsApp' }, { offset: 15, channel: 'WhatsApp' }], bounceCharge: 590, holdOnBounce: true, defaultCreditDays: 30 } }) }; return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeCollections = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const collSettings = () => db().settings;
export const saveCollSettings = (s: CollSettings) => commit({ ...db(), settings: s });
type Result = { ok: boolean; message: string; id?: string; errors?: string[] };

/* ----------------------------------- Reads ----------------------------------- */

export const invoices = (principalId: string) => db().invoices.filter((i) => i.principalId === principalId);
export const payments = (principalId: string) => db().payments.filter((p) => p.principalId === principalId);
export const promisesOf = (partnerId: string) => db().promises.filter((p) => p.partnerId === partnerId);
export const tasksOf = (partnerId: string) => db().tasks.filter((t) => t.partnerId === partnerId);
export const allTasks = () => db().tasks;
export const remindersOf = (partnerId: string) => db().reminders.filter((r) => r.partnerId === partnerId);
const counts = (p: Payment) => p.status === 'Cleared' || p.status === 'Awaiting clearance';
/** Amount paid against an invoice (bounced and post-dated cheques don't count). */
export const paidOn = (invoiceId: string) => db().payments.filter(counts).reduce((a, p) => a + p.allocations.filter((x) => x.invoiceId === invoiceId).reduce((s, x) => s + x.amount, 0), 0);
export const balanceOf = (i: Invoice) => Math.round((i.amount - paidOn(i.id)) * 100) / 100;
export const unallocated = (p: Payment) => Math.round((p.amount - p.allocations.reduce((a, x) => a + x.amount, 0)) * 100) / 100;

export const BUCKETS = ['Not due', '0–30', '31–60', '61–90', '90+'] as const;
export type Bucket = typeof BUCKETS[number];
export const bucketOf = (i: Invoice): Bucket => { const d = daysPast(i.dueDate); return d <= 0 ? 'Not due' : d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+'; };
export interface PartnerAgeing { partnerId: string; partnerName: string; outstanding: number; overdue: number; buckets: Record<Bucket, number>; oldestDays: number; credits: number; pdc: number; promise: PromiseToPay | null; openTasks: number }
export const ageing = (principalId: string): PartnerAgeing[] => {
  const map = new Map<string, PartnerAgeing>();
  const get = (id: string, name: string) => map.get(id) ?? map.set(id, { partnerId: id, partnerName: name, outstanding: 0, overdue: 0, buckets: { 'Not due': 0, '0–30': 0, '31–60': 0, '61–90': 0, '90+': 0 }, oldestDays: 0, credits: 0, pdc: 0, promise: null, openTasks: 0 }).get(id)!;
  invoices(principalId).forEach((i) => {
    const bal = balanceOf(i); if (bal <= 0) return;
    const a = get(i.partnerId, i.partnerName); const b = bucketOf(i);
    a.outstanding += bal; a.buckets[b] += bal; if (b !== 'Not due') { a.overdue += bal; a.oldestDays = Math.max(a.oldestDays, daysPast(i.dueDate)); }
  });
  payments(principalId).forEach((p) => {
    const a = map.get(p.partnerId); if (!a) return;
    if (counts(p)) a.credits += unallocated(p);
    if (p.status === 'Held (post-dated)') a.pdc += p.amount;
  });
  map.forEach((a) => {
    a.outstanding = Math.round(a.outstanding - a.credits); a.overdue = Math.round(a.overdue);
    a.promise = db().promises.filter((x) => x.partnerId === a.partnerId && x.status === 'Open').sort((x, y) => (x.date < y.date ? -1 : 1))[0] ?? null;
    a.openTasks = db().tasks.filter((t) => t.partnerId === a.partnerId && !t.done).length;
  });
  return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);
};

/* --------------------------------- Invoices in --------------------------------- */

const shipmentValue = (o: Order, s: Shipment) => Math.round(s.allocations.reduce((a, al) => { const l = o.lines.find((x) => x.id === al.lineId); return a + (l ? (l.netUnit ?? 0) * al.qty * (1 + l.gstPct / 100) : 0); }, 0));
/** CRD-01: every shipment invoice becomes a receivable (idempotent). Credit days come from the partner's terms. */
export const syncInvoices = (principalId: string, creditDays: (partnerId: string) => number) => {
  const d = db(); const have = new Set(d.invoices.map((i) => i.ref)); const add: Invoice[] = [];
  orders().filter((o) => o.principalId === principalId && o.orderType !== 'Stock transfer').forEach((o) => o.shipments.forEach((s) => {
    const ref = `${o.code}/${s.no}`; if (have.has(ref)) return;
    const amount = shipmentValue(o, s) || Math.round(orderValue(o, true) / Math.max(1, o.shipments.length));
    add.push({ id: newId('inv'), no: s.invoiceNo, principalId, partnerId: o.partnerId, partnerName: o.partnerName, date: s.invoiceDate, dueDate: addDays(s.invoiceDate, creditDays(o.partnerId) || d.settings.defaultCreditDays), amount, source: s.invoiceBy === 'ERP' ? 'ERP' : 'VinFlux', ref });
  }));
  if (add.length) commit({ ...d, invoices: [...add, ...d.invoices] });
  return add.length;
};

/* ------------------------------------ Payments ------------------------------------ */

/** Oldest-due first, unless the user picked invoices. */
const autoAllocate = (principalId: string, partnerId: string, amount: number, exceptPaymentId?: string) => {
  const out: { invoiceId: string; amount: number }[] = []; let left = amount;
  invoices(principalId).filter((i) => i.partnerId === partnerId).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).forEach((i) => {
    if (left <= 0) return;
    const others = db().payments.filter((p) => counts(p) && p.id !== exceptPaymentId).reduce((a, p) => a + p.allocations.filter((x) => x.invoiceId === i.id).reduce((s, x) => s + x.amount, 0), 0);
    const bal = i.amount - others; if (bal <= 0) return;
    const take = Math.min(bal, left); out.push({ invoiceId: i.id, amount: Math.round(take * 100) / 100 }); left -= take;
  });
  return out;
};
export interface PaymentInput { principalId: string; partnerId: string; partnerName: string; date: string; amount: number; mode: Mode; ref: string; chequeDate: string | null; receiptPhoto: string | null; picks: Record<string, number> | null; by: string }
export const recordPayment = (n: PaymentInput): Result => {
  const errs: string[] = [];
  if (!n.partnerId) errs.push('Choose the partner.');
  if (!(n.amount > 0)) errs.push('Amount must be more than zero.');
  if (n.date > today()) errs.push('Payment date is in the future — use a post-dated cheque instead.');
  if (n.mode !== 'Cash' && !n.ref.trim()) errs.push(n.mode.includes('heque') ? 'Cheque number is required.' : 'Transaction reference (UTR / UPI ref) is required.');
  if (n.mode === 'Post-dated cheque' && (!n.chequeDate || n.chequeDate <= today())) errs.push('A post-dated cheque needs a future cheque date.');
  const dupRef = n.ref.trim() && db().payments.find((p) => p.partnerId === n.partnerId && p.ref.trim().toLowerCase() === n.ref.trim().toLowerCase() && p.status !== 'Bounced');
  if (dupRef) errs.push(`Reference ${n.ref} is already recorded as ${dupRef.no}.`);
  if (n.picks) { const sum = Object.values(n.picks).reduce((a, x) => a + x, 0); if (sum > n.amount + 0.01) errs.push('Allocated more than the payment amount.'); Object.entries(n.picks).forEach(([id, amt]) => { const i = db().invoices.find((x) => x.id === id); if (i && amt > balanceOf(i) + 0.01) errs.push(`${i.no}: only ₹${balanceOf(i).toLocaleString('en-IN')} is due.`); }); }
  if (errs.length) return { ok: false, message: 'Can’t record the payment.', errors: errs };
  const d = db(); const seq = d.seq + 1;
  const status: PayStatus = n.mode === 'Post-dated cheque' ? 'Held (post-dated)' : n.mode === 'Cheque' ? 'Awaiting clearance' : 'Cleared';
  const allocations = n.picks ? Object.entries(n.picks).filter(([, a]) => a > 0).map(([invoiceId, amount]) => ({ invoiceId, amount })) : status === 'Held (post-dated)' ? [] : autoAllocate(n.principalId, n.partnerId, n.amount);
  const p: Payment = { id: newId('pay'), no: `RCT-${seq}`, principalId: n.principalId, partnerId: n.partnerId, partnerName: n.partnerName, date: n.date, amount: n.amount, mode: n.mode, ref: n.ref.trim(), chequeDate: n.chequeDate, status, allocations, recordedBy: n.by, receiptPhoto: n.receiptPhoto,
    history: [{ at: now(), by: n.by, action: `${n.mode} of ₹${n.amount.toLocaleString('en-IN')} recorded`, note: n.receiptPhoto ? `Receipt photo: ${n.receiptPhoto}` : undefined }] };
  // A promise to pay is kept when payments since it was made cover it.
  const promises = d.promises.map((x) => (x.partnerId === n.partnerId && x.status === 'Open' && status !== 'Held (post-dated)' && n.amount >= x.amount * 0.95 ? { ...x, status: 'Kept' as const } : x));
  commit({ ...d, seq, payments: [p, ...d.payments], promises });
  emit('payment.recorded', 'Collections', n.by, `${p.no} ${n.partnerName} ₹${n.amount}`, { paymentId: p.id });
  return { ok: true, message: `${p.no} recorded${status === 'Held (post-dated)' ? ` — held until ${n.chequeDate}` : status === 'Awaiting clearance' ? ' — counts once cleared or on deposit' : ''}${allocations.length ? `, allocated to ${allocations.length} invoice(s)` : ''}.`, id: p.id };
};
const putPay = (p: Payment) => commit({ ...db(), payments: db().payments.map((x) => (x.id === p.id ? p : x)) });
const logP = (p: Payment, by: string, action: string, note?: string): Payment => ({ ...p, history: [...p.history, { at: now(), by, action, note }] });
export const clearCheque = (id: string, by: string): Result => {
  const p = db().payments.find((x) => x.id === id); if (!p || !['Awaiting clearance', 'Held (post-dated)'].includes(p.status)) return { ok: false, message: 'Nothing to clear.' };
  if (p.status === 'Held (post-dated)' && p.chequeDate && p.chequeDate > today()) return { ok: false, message: `The cheque is dated ${p.chequeDate}; it can be deposited from then.` };
  const allocations = p.allocations.length ? p.allocations : autoAllocate(p.principalId, p.partnerId, p.amount, p.id);
  putPay(logP({ ...p, status: 'Cleared', allocations }, by, 'Cheque cleared')); return { ok: true, message: `${p.no} cleared.` };
};
/** CRD-05: reverse, add the bounce charge, optionally put the partner on credit hold (done by the caller through GTM). */
export const bounceCheque = (id: string, reason: string, by: string): Result & { hold?: boolean } => {
  const p = db().payments.find((x) => x.id === id); if (!p || !p.mode.includes('heque') || p.status === 'Bounced') return { ok: false, message: 'Only an un-bounced cheque can bounce.' };
  if (!reason.trim()) return { ok: false, message: 'Give the bank’s reason (e.g. insufficient funds).' };
  const s = db().settings; const d = db(); const seq = d.seq + 1;
  const charge: Invoice = { id: newId('inv'), no: `DN-${seq}`, principalId: p.principalId, partnerId: p.partnerId, partnerName: p.partnerName, date: today(), dueDate: today(), amount: s.bounceCharge, source: 'Bounce charge', ref: p.no };
  cache = { key: KEY(), d: { ...d, seq, invoices: s.bounceCharge > 0 ? [charge, ...d.invoices] : d.invoices } };
  putPay(logP({ ...p, status: 'Bounced', allocations: [] }, by, 'Cheque bounced — payment reversed', `${reason}${s.bounceCharge ? `; charge ₹${s.bounceCharge} as ${charge.no}` : ''}`));
  return { ok: true, message: `${p.no} bounced — invoices are open again${s.bounceCharge ? `, ₹${s.bounceCharge} charge added` : ''}${s.holdOnBounce ? `; ${p.partnerName} put on credit hold` : ''}.`, hold: s.holdOnBounce };
};
export const reallocate = (id: string, picks: Record<string, number>, by: string): Result => {
  const p = db().payments.find((x) => x.id === id); if (!p || p.status === 'Bounced') return { ok: false, message: 'Nothing to allocate.' };
  const sum = Object.values(picks).reduce((a, x) => a + x, 0);
  if (sum > p.amount + 0.01) return { ok: false, message: 'Allocated more than the payment.' };
  putPay(logP({ ...p, allocations: Object.entries(picks).filter(([, a]) => a > 0).map(([invoiceId, amount]) => ({ invoiceId, amount })) }, by, 'Allocation changed')); return { ok: true, message: 'Allocation saved.' };
};

/* --------------------------------- Chasing --------------------------------- */

export const addPromise = (partnerId: string, amount: number, date: string, note: string, by: string): Result => {
  if (!(amount > 0) || !date) return { ok: false, message: 'Give the amount and the date promised.' };
  if (date < today()) return { ok: false, message: 'The promised date is in the past.' };
  commit({ ...db(), promises: [{ id: newId('ptp'), partnerId, amount, date, note, by, at: now(), status: 'Open' }, ...db().promises] });
  return { ok: true, message: 'Promise to pay recorded.' };
};
/** Open promises whose date passed without payment turn Broken. */
export const checkPromises = () => { const d = db(); let ch = false; const ps = d.promises.map((p) => { if (p.status === 'Open' && p.date < today()) { ch = true; return { ...p, status: 'Broken' as const }; } return p; }); if (ch) commit({ ...d, promises: ps }); };
export const addTask = (partnerId: string, note: string, due: string, owner: string): Result => {
  if (!note.trim() || !due) return { ok: false, message: 'Write the follow-up and its date.' };
  commit({ ...db(), tasks: [{ id: newId('fu'), partnerId, note, due, owner, done: false, at: now() }, ...db().tasks] }); return { ok: true, message: `Follow-up for ${owner} on ${due}.` };
};
export const doneTask = (id: string) => commit({ ...db(), tasks: db().tasks.map((t) => (t.id === id ? { ...t, done: true } : t)) });

/** CRD-04: run the reminder schedule (daily job in production). Each invoice gets each stage once. */
export const runReminders = (principalId: string) => {
  const d = db(); const out: Reminder[] = [];
  invoices(principalId).forEach((i) => {
    const bal = balanceOf(i); if (bal <= 0) return;
    const past = daysPast(i.dueDate);
    d.settings.reminders.filter((r) => past >= r.offset).forEach((r) => {
      const stage = r.offset < 0 ? `${-r.offset} days before due` : r.offset === 0 ? 'On the due date' : `${r.offset} days overdue`;
      if (d.reminders.some((x) => x.invoiceNo === i.no && x.stage === stage) || out.some((x) => x.invoiceNo === i.no && x.stage === stage)) return;
      out.push({ id: newId('rem'), partnerId: i.partnerId, invoiceNo: i.no, stage, channel: r.channel, at: now(), text: `Dear ${i.partnerName}, invoice ${i.no} dated ${i.date} for ₹${i.amount.toLocaleString('en-IN')} ${past < 0 ? `is due on ${i.dueDate}` : past === 0 ? 'is due today' : `is ${past} days overdue`}. Balance ₹${bal.toLocaleString('en-IN')}. Please pay or reply with a date.` });
    });
  });
  if (out.length) commit({ ...d, reminders: [...out, ...d.reminders] });
  return out.length;
};

/** Statement of account for a partner: invoices and payments in date order with running balance. */
export const statement = (principalId: string, partnerId: string) => {
  const rows: { date: string; doc: string; text: string; debit: number; credit: number }[] = [];
  invoices(principalId).filter((i) => i.partnerId === partnerId).forEach((i) => rows.push({ date: i.date, doc: i.no, text: i.source === 'Bounce charge' ? `Cheque bounce charge (${i.ref})` : i.source === 'Opening balance' ? 'Opening balance' : `Invoice ${i.ref.split('/')[0]}`, debit: i.amount, credit: 0 }));
  payments(principalId).filter((p) => p.partnerId === partnerId && p.status !== 'Held (post-dated)').forEach((p) => {
    rows.push({ date: p.date, doc: p.no, text: `${p.mode} ${p.ref}`, debit: 0, credit: p.amount });
    if (p.status === 'Bounced') rows.push({ date: p.history.find((h) => h.action.startsWith('Cheque bounced'))?.at.slice(0, 10) ?? p.date, doc: p.no, text: 'Cheque bounced — reversed', debit: p.amount, credit: 0 });
  });
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let bal = 0; return rows.map((r) => { bal += r.debit - r.credit; return { ...r, balance: Math.round(bal) }; });
};

/* ------------------------------------- Demo ------------------------------------- */

/** Opening balances across the ageing buckets, a cleared NEFT, a post-dated cheque and a promise to pay. */
export const ensureCollectionsDemo = (principalId: string, partners: { id: string; name: string }[]) => {
  const d = db(); if (d.seeded.includes(principalId) || !partners.length) return;
  const inv = (p: { id: string; name: string }, i: number, ageDays: number, amount: number): Invoice => ({ id: `inv-${principalId}-${p.id}-${i}`, no: `OB-${p.id.slice(-3).toUpperCase()}-${100 + i}`, principalId, partnerId: p.id, partnerName: p.name, date: addDays(today(), -ageDays - 30), dueDate: addDays(today(), -ageDays), amount, source: 'Opening balance', ref: 'Opening balance' });
  const list: Invoice[] = [];
  partners.slice(0, 4).forEach((p, k) => { [[95, 180000], [52, 240000], [18, 310000], [-12, 150000]].slice(k % 2, 4 - (k === 3 ? 2 : 0)).forEach(([age, amt], i) => list.push(inv(p, i, age, amt - k * 20000))); });
  cache = { key: KEY(), d: { ...d, invoices: [...list, ...d.invoices], seeded: [...d.seeded, principalId] } }; saveJson(KEY(), cache.d);
  const a = partners[0]; const b = partners[1] ?? partners[0];
  recordPayment({ principalId, partnerId: a.id, partnerName: a.name, date: addDays(today(), -6), amount: 150000, mode: 'NEFT / RTGS', ref: 'UTR SBIN226110473', chequeDate: null, receiptPhoto: null, picks: null, by: 'Meera Iyer' });
  recordPayment({ principalId, partnerId: b.id, partnerName: b.name, date: addDays(today(), -1), amount: 200000, mode: 'Post-dated cheque', ref: 'CHQ 004512', chequeDate: addDays(today(), 10), receiptPhoto: 'cheque_004512.jpg', picks: null, by: 'Kiran Varma' });
  recordPayment({ principalId, partnerId: b.id, partnerName: b.name, date: addDays(today(), -3), amount: 80000, mode: 'Cheque', ref: 'CHQ 004498', chequeDate: addDays(today(), -3), receiptPhoto: 'cheque_004498.jpg', picks: null, by: 'Kiran Varma' });
  addPromise(partners[2]?.id ?? a.id, 120000, addDays(today(), 5), 'Owner promised on call after month-end collections', 'Meera Iyer');
  addTask(partners[3]?.id ?? a.id, 'Visit with statement; 90+ days overdue', addDays(today(), 1), 'Ravi Kumar');
};
