/**
 * Quality control (OP9): one inspection step for every way goods arrive — purchase receipts, imports and partner returns —
 * so only accepted goods become sellable.
 *
 *   Goods in Quarantine ─► inspector records checks and results ─► QC approver releases (different person)
 *     ─► accepted → Available · rejected → return to vendor + debit note (purchases) or scrap / return to manufacturer (returns)
 *     · held → stays in Quarantine for a later decision
 *
 * Rules
 *   QC-01 Receipts go to Quarantine when the plan requires inspection (Procurement / Returns options).
 *   QC-02 Each line is accepted, partly accepted, held or rejected, with reason and attachments.
 *   QC-03 Release needs a QC approver who did not record the receipt or the inspection.
 *   QC-04 Rejected quantities create a return-to-vendor document (purchases) or scrap / return-to-manufacturer (returns).
 *   QC-05 A missing certificate of analysis, where the plan requires one, blocks release.
 *   QC-06 Results feed the vendor scorecard (rejection %) and can raise a complaint.
 * INTEGRATION POINT: /qc/plans, /qc/inspections; LIMS / CoA store; ERP quality notification on rejection.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { getGRN, getPO, getVendor, grns, inspect as procInspect } from '../procurement/procurementStore';
import { getReturn, inspectReturn, returns } from '../returns/returnStore';
import type { Outcome } from '../returns/returnStore';
import type { OrderCtx } from '../orders/orderStore';

export type Source = 'Purchase receipt' | 'Import' | 'Return';
export const SOURCES: Source[] = ['Purchase receipt', 'Import', 'Return'];
export interface Plan { id: string; name: string; sources: Source[]; productIds: string[]; checks: string[]; samplePct: number; coaRequired: boolean; active: boolean }
export type CheckResult = 'Pass' | 'Fail' | 'N/A';
export interface ILine { key: string; productId: string; name: string; batch: string; qty: number; accepted: number; held: number; rejected: number; reason: string; returnOutcome?: Outcome }
export type IStatus = 'To inspect' | 'Awaiting release' | 'Released' | 'On hold';
export interface Inspection {
  id: string; no: string; principalId: string; source: Source; refId: string; refNo: string; party: string; receivedBy: string; receivedAt: string;
  planId: string | null; coa: string; lines: ILine[]; checks: Record<string, CheckResult>; sampled: number; attachments: string[];
  status: IStatus; inspectedBy: string | null; inspectedAt: string | null; releasedBy: string | null; releasedAt: string | null; outcome: string | null;
  history: { at: string; by: string; action: string; note?: string }[];
}

const now = () => new Date().toISOString();
interface Db { plans: Plan[]; inspections: Inspection[]; seq: number }
const KEY = () => workspaceKey('vinflux.qc.v1');
const DEFAULT_PLANS: Plan[] = [
  { id: 'qcp-implant', name: 'Implants and serialised devices — every unit', sources: ['Purchase receipt', 'Import'], productIds: [], checks: ['Packaging and sterile barrier intact', 'Label / UDI matches the packing list', 'Serial numbers match the documents', 'Expiry meets the minimum shelf life', 'Certificate of analysis / conformity matches the batch'], samplePct: 100, coaRequired: true, active: true },
  { id: 'qcp-consumable', name: 'Sterile consumables — sample', sources: ['Purchase receipt'], productIds: [], checks: ['Packaging and seal intact', 'Label and batch match the invoice', 'Expiry meets the minimum shelf life', 'Count matches'], samplePct: 10, coaRequired: false, active: true },
  { id: 'qcp-return', name: 'Partner returns', sources: ['Return'], productIds: [], checks: ['Seal / pack unopened', 'Not used or damaged', 'Batch and serial match the original delivery', 'Expiry still sellable', 'Cold chain kept (if required)'], samplePct: 100, coaRequired: false, active: true },
];
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: loadJson<Db>(KEY(), { plans: DEFAULT_PLANS, inspections: [], seq: 100 }) }; return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeQc = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const plans = () => db().plans;
export const savePlan = (p: Plan) => commit({ ...db(), plans: p.id && db().plans.some((x) => x.id === p.id) ? db().plans.map((x) => (x.id === p.id ? p : x)) : [...db().plans, { ...p, id: newId('qcp') }] });
export const inspections = (principalId: string) => db().inspections.filter((i) => i.principalId === principalId);
export const getInspection = (id: string) => db().inspections.find((i) => i.id === id) ?? null;
type Result = { ok: boolean; message: string; errors?: string[] };
const put = (i: Inspection) => commit({ ...db(), inspections: db().inspections.map((x) => (x.id === i.id ? i : x)) });
const log = (i: Inspection, by: string, action: string, note?: string): Inspection => ({ ...i, history: [...i.history, { at: now(), by, action, note }] });

/** The most specific active plan: one naming the product, else one for the source (serialised → every-unit plan). */
export const planFor = (source: Source, productIds: string[], serialised: boolean) => {
  const act = db().plans.filter((p) => p.active && p.sources.includes(source));
  return act.find((p) => p.productIds.length && productIds.some((x) => p.productIds.includes(x)))
    ?? (source === 'Return' ? act.find((p) => !p.productIds.length) : serialised ? act.find((p) => !p.productIds.length && p.samplePct === 100) : act.find((p) => !p.productIds.length && p.samplePct < 100))
    ?? act.find((p) => !p.productIds.length) ?? null;
};

/* ------------------------------------ Intake ------------------------------------ */

/** QC-01: everything waiting in Quarantine becomes an inspection (idempotent). */
export const syncQueue = (principalId: string, serialised: (pid: string) => boolean, name: (pid: string) => string) => {
  const d = db(); const have = new Set(d.inspections.map((i) => i.refId)); const add: Inspection[] = []; let seq = d.seq;
  grns(principalId).filter((g) => g.status === 'In QC' && !have.has(g.id)).forEach((g) => {
    const po = getPO(g.poId); const v = getVendor(g.vendorId); const imp = v?.kind === 'Overseas supplier';
    const source: Source = imp ? 'Import' : 'Purchase receipt';
    const plan = planFor(source, g.lines.map((l) => l.productId), g.lines.some((l) => serialised(l.productId)));
    add.push({ id: newId('qci'), no: `QC-26-${++seq}`, principalId, source, refId: g.id, refNo: `${g.no} · ${po?.no ?? ''}`, party: g.vendorName, receivedBy: g.by, receivedAt: g.receivedAt,
      planId: plan?.id ?? null, coa: g.coa, lines: g.lines.map((l, i) => ({ key: String(i), productId: l.productId, name: name(l.productId), batch: l.batch, qty: l.qty, accepted: l.qty, held: 0, rejected: 0, reason: '' })),
      checks: {}, sampled: 0, attachments: [], status: 'To inspect', inspectedBy: null, inspectedAt: null, releasedBy: null, releasedAt: null, outcome: null, history: [{ at: now(), by: 'System', action: `In Quarantine from ${g.no}` }] });
  });
  returns().filter((r) => r.principalId === principalId && r.status === 'Received' && !have.has(r.id)).forEach((r) => {
    const plan = planFor('Return', r.lines.map((l) => l.productId), false);
    add.push({ id: newId('qci'), no: `QC-26-${++seq}`, principalId, source: 'Return', refId: r.id, refNo: r.no, party: r.partnerName, receivedBy: 'Warehouse', receivedAt: r.receivedAt ?? now(),
      planId: plan?.id ?? null, coa: '', lines: r.lines.map((l) => ({ key: l.id, productId: l.productId, name: l.name, batch: `${l.batch}${l.serial ? ` · ${l.serial}` : ''}`, qty: l.receivedQty ?? l.qty, accepted: l.receivedQty ?? l.qty, held: 0, rejected: 0, reason: '', returnOutcome: 'Restock' as Outcome })),
      checks: {}, sampled: 0, attachments: [], status: 'To inspect', inspectedBy: null, inspectedAt: null, releasedBy: null, releasedAt: null, outcome: null, history: [{ at: now(), by: 'System', action: `In Quarantine from return ${r.no}` }] });
  });
  if (add.length) commit({ ...d, seq, inspections: [...add, ...d.inspections] });
  // Anything decided outside QC (e.g. in Procurement or Returns) is closed here too.
  const done = db().inspections.filter((i) => i.status !== 'Released' && ((i.source !== 'Return' && getGRN(i.refId) && getGRN(i.refId)!.status !== 'In QC') || (i.source === 'Return' && getReturn(i.refId) && getReturn(i.refId)!.status !== 'Received')));
  if (done.length) commit({ ...db(), inspections: db().inspections.map((i) => (done.includes(i) ? log({ ...i, status: 'Released', outcome: 'Decided outside QC', releasedAt: now() }, 'System', 'Closed — decided in the source module') : i)) });
  return add.length;
};

/* ---------------------------------- Inspection ---------------------------------- */

export interface Recording { checks: Record<string, CheckResult>; sampled: number; lines: Record<string, { accepted: number; held: number; reason: string; returnOutcome?: Outcome }>; attachments: string[]; coa: string }
/** QC-02: inspector records checks and a decision per line; goes to the approver. */
export const record = (id: string, r: Recording, by: string): Result => {
  const i = getInspection(id); if (!i || !['To inspect', 'On hold'].includes(i.status)) return { ok: false, message: 'Nothing to record.' };
  const plan = db().plans.find((p) => p.id === i.planId);
  const errs: string[] = [];
  plan?.checks.forEach((c) => { if (!r.checks[c]) errs.push(`Record “${c}”.`); });
  const need = plan ? Math.ceil((i.lines.reduce((a, l) => a + l.qty, 0) * plan.samplePct) / 100) : 0;
  if (r.sampled < need) errs.push(`Inspect at least ${need} unit(s) (${plan!.samplePct}% sample).`);
  const lines = i.lines.map((l) => {
    const x = r.lines[l.key] ?? { accepted: l.qty, held: 0, reason: '' };
    if (x.accepted < 0 || x.held < 0 || x.accepted + x.held > l.qty) errs.push(`${l.name}: accepted + held must be 0–${l.qty}.`);
    const rej = l.qty - x.accepted - x.held;
    if ((rej > 0 || x.held > 0) && !x.reason.trim()) errs.push(`${l.name}: give the reason for rejecting or holding.`);
    if (i.source === 'Return' && x.held > 0) errs.push(`${l.name}: a return line is accepted (restock) or rejected as a whole.`);
    return { ...l, accepted: x.accepted, held: x.held, rejected: rej, reason: x.reason, returnOutcome: i.source === 'Return' ? (x.returnOutcome ?? (x.accepted === l.qty ? 'Restock' : 'Scrap')) : undefined };
  });
  if (i.source === 'Return') lines.forEach((l) => { if (l.accepted !== 0 && l.accepted !== l.qty) errs.push(`${l.name}: a return line is accepted or rejected as a whole.`); });
  const failed = Object.entries(r.checks).filter(([, v]) => v === 'Fail').map(([k]) => k);
  if (failed.length && lines.every((l) => l.rejected === 0 && l.held === 0)) errs.push(`Checks failed (${failed.join('; ')}) — reject or hold the affected quantity.`);
  if (errs.length) return { ok: false, message: 'Check the inspection.', errors: errs };
  const anyHeld = lines.some((l) => l.held > 0);
  put(log({ ...i, checks: r.checks, sampled: r.sampled, lines, attachments: r.attachments, coa: r.coa || i.coa, status: 'Awaiting release', inspectedBy: by, inspectedAt: now() }, by, 'Inspection recorded', `${lines.reduce((a, l) => a + l.accepted, 0)} accept, ${lines.reduce((a, l) => a + l.rejected, 0)} reject${anyHeld ? `, ${lines.reduce((a, l) => a + l.held, 0)} hold` : ''}`));
  return { ok: true, message: `${i.no} recorded — waiting for a QC approver to release.` };
};

/** QC-03/04/05: release by a different person; accepted → Available, rejected → RTV / scrap; held stays in Quarantine. */
export const release = (id: string, by: string, ctx: OrderCtx | null): Result => {
  const i = getInspection(id); if (!i || i.status !== 'Awaiting release') return { ok: false, message: 'Nothing to release.' };
  if (i.inspectedBy === by || i.receivedBy === by) return { ok: false, message: 'You received or inspected these goods; another QC approver releases them (QC-03).' };
  const plan = db().plans.find((p) => p.id === i.planId);
  if (plan?.coaRequired && !i.coa.trim()) return { ok: false, message: 'The plan needs a certificate of analysis / conformity — release is blocked until it is attached (QC-05).' };
  const held = i.lines.reduce((a, l) => a + l.held, 0);
  if (held > 0 && i.source !== 'Return') {
    // Release the decided part now: partial accept, keep held units in Quarantine as a new inspection.
    return { ok: false, message: `${held} unit(s) are on hold — decide them first (record again with the held units accepted or rejected).` };
  }
  let res: Result;
  if (i.source === 'Return') {
    if (!ctx) return { ok: false, message: 'Loading…' };
    res = inspectReturn(i.refId, Object.fromEntries(i.lines.map((l) => [l.key, { outcome: (l.accepted === l.qty ? 'Restock' : l.returnOutcome === 'Restock' ? 'Scrap' : l.returnOutcome ?? 'Scrap') as Outcome, note: l.reason || 'QC accepted' }])), ctx, by);
  } else {
    res = procInspect(i.refId, Object.fromEntries(i.lines.map((l) => [Number(l.key), { accepted: l.accepted, reason: l.reason }])), by);
  }
  if (!res.ok) return res;
  const acc = i.lines.reduce((a, l) => a + l.accepted, 0); const rej = i.lines.reduce((a, l) => a + l.rejected, 0);
  put(log({ ...i, status: 'Released', releasedBy: by, releasedAt: now(), outcome: res.message }, by, 'Released', res.message));
  emit('qc.released', 'Quality', by, `${i.no}: ${acc} accepted, ${rej} rejected`, { inspectionId: id });
  return { ok: true, message: `${i.no} released — ${res.message}` };
};
/** Put the whole lot on hold (e.g. waiting for the supplier's certificate). */
export const hold = (id: string, reason: string, by: string): Result => {
  const i = getInspection(id); if (!i || ['Released'].includes(i.status)) return { ok: false, message: 'Nothing to hold.' };
  if (!reason.trim()) return { ok: false, message: 'Give the reason for the hold.' };
  put(log({ ...i, status: 'On hold' }, by, 'On hold', reason)); return { ok: true, message: `${i.no} on hold — stays in Quarantine.` };
};
export const attachCoa = (id: string, coa: string, by: string) => { const i = getInspection(id); if (i) put(log({ ...i, coa }, by, 'Certificate attached', coa)); };
