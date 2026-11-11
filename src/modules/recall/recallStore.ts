/**
 * Complaints & Recall.
 *
 * Complaint:  Open ─► Investigating ─► CAPA ─► Closed      (adverse events carry a regulator-report due date from your SOP)
 * Recall:     Draft ─► Active ─► Closed                     (or Cancelled while Draft)
 *   Draft     trace forward: every location holding the batches / serials (company, C&F, partners, hospital consignment,
 *             in transit) + where they were consumed (hospital sales, implanted patients from the implant register)
 *   Active    approved by someone other than the creator → stock blocked everywhere VinFlux keeps it, partners notified
 *             partners acknowledge and send stock back (recovered → company warehouse, Blocked)
 *   Closed    when every unit is accounted for (recovered, blocked in place, or consumed with a record) — or with a reason
 */
import type { Partner } from '../gtm-v2/types';
import type { Warehouse } from '../../types/warehouse';
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { erpMirror } from '../../platform/integrations/stockSync';
import { balances, post } from '../inventory/stockStore';
import type { LocType, StockBalance } from '../inventory/stockStore';
import { allShipments, destinationOf } from '../orders/orderStore';
import { register } from '../surgical/surgicalStore';
import { returns } from '../returns/returnStore';

/* --------------------------------- Complaints --------------------------------- */

export type ComplaintCategory = 'Quality defect' | 'Malfunction' | 'Sterility / contamination' | 'Packaging / labelling' | 'Adverse event' | 'Other';
export const CATEGORIES: ComplaintCategory[] = ['Quality defect', 'Malfunction', 'Sterility / contamination', 'Packaging / labelling', 'Adverse event', 'Other'];
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type PatientOutcome = 'No patient involved' | 'No injury' | 'Injury' | 'Serious injury' | 'Death';
export type ComplaintStatus = 'Open' | 'Investigating' | 'CAPA' | 'Closed';
export const COMPLAINT_FLOW: ComplaintStatus[] = ['Open', 'Investigating', 'CAPA', 'Closed'];
export interface Complaint {
  id: string; no: string; principalId: string;
  source: 'Partner' | 'Hospital' | 'Doctor / patient' | 'Internal' | 'Return';
  partnerId: string | null; partnerName: string; reporter: string;
  productId: string; variantSku: string | null; name: string; batch: string; serial: string | null; qty: number;
  category: ComplaintCategory; description: string; severity: Severity; patient: PatientOutcome;
  /** Your SOP's deadline for reporting to the regulator (adverse events). */
  report: { dueBy: string; reportedAt: string | null; ref: string } | null;
  status: ComplaintStatus;
  investigation: { rootCause: string; capa: string; by: string; at: string } | null;
  returnId: string | null; recallId: string | null;
  createdBy: string; createdAt: string;
  history: { at: string; by: string; action: string; note?: string }[];
}

/* ----------------------------------- Recall ----------------------------------- */

export type RecallClass = 'Class I' | 'Class II' | 'Class III';
export type RecallType = 'Recall' | 'Field safety notice' | 'Stop sale';
export type PartyKind = LocType | 'CONSUMED' | 'PATIENT';
export interface Party {
  key: string; kind: PartyKind; id: string; name: string;
  /** Units there when the recall started (stock, or consumed / implanted). */
  qty: number;
  notifiedAt: string | null; acknowledgedAt: string | null; ackQty: number | null;
  recovered: number;
  /** Accounted without recovery: blocked in our warehouse, or consumed / implanted with a record. */
  accounted: number; note: string;
}
export interface Recall {
  id: string; no: string; principalId: string;
  productId: string; name: string; batches: string[]; serials: string[];
  cls: RecallClass; type: RecallType; reason: string; complaintIds: string[];
  status: 'Draft' | 'Active' | 'Closed' | 'Cancelled';
  parties: Party[];
  createdBy: string; createdAt: string; approvedBy: string | null; activatedAt: string | null; closedNote: string | null;
  history: { at: string; by: string; action: string; note?: string }[];
}

interface Settings { reportDaysSerious: number; reportDaysOther: number }
interface Db { complaints: Complaint[]; recalls: Recall[]; cSeq: number; rSeq: number; settings: Settings }
let cache: Db | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.recall.v1');
const db = (): Db => (cache ??= loadJson<Db>(KEY(), { complaints: [], recalls: [], cSeq: 200, rSeq: 0, settings: { reportDaysSerious: 15, reportDaysOther: 30 } }));
const commit = (d: Db) => { cache = d; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeRecall = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const complaints = () => db().complaints;
export const recalls = () => db().recalls;
export const getComplaint = (id: string) => db().complaints.find((c) => c.id === id) ?? null;
export const getRecall = (id: string) => db().recalls.find((r) => r.id === id) ?? null;
export const recallSettings = () => db().settings;
export const saveRecallSettings = (s: Settings) => commit({ ...db(), settings: s });
const now = () => new Date().toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
type Result = { ok: boolean; message: string; errors?: string[]; id?: string };
const putC = (c: Complaint) => { const d = db(); commit({ ...d, complaints: d.complaints.some((x) => x.id === c.id) ? d.complaints.map((x) => (x.id === c.id ? c : x)) : [c, ...d.complaints] }); };
const putR = (r: Recall) => { const d = db(); commit({ ...d, recalls: d.recalls.some((x) => x.id === r.id) ? d.recalls.map((x) => (x.id === r.id ? r : x)) : [r, ...d.recalls] }); };
const logC = (c: Complaint, by: string, action: string, note?: string): Complaint => ({ ...c, history: [...c.history, { at: now(), by, action, note }] });
const logR = (r: Recall, by: string, action: string, note?: string): Recall => ({ ...r, history: [...r.history, { at: now(), by, action, note }] });

/** Severity follows the patient outcome and category — the reporter can raise it, never lower it below this. */
export const minSeverity = (category: ComplaintCategory, patient: PatientOutcome): Severity =>
  patient === 'Death' || patient === 'Serious injury' ? 'Critical' : patient === 'Injury' || category === 'Sterility / contamination' ? 'High' : category === 'Malfunction' || category === 'Adverse event' ? 'Medium' : 'Low';
const RANK: Record<Severity, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

export type NewComplaint = Omit<Complaint, 'id' | 'no' | 'principalId' | 'report' | 'status' | 'investigation' | 'recallId' | 'createdAt' | 'history'>;
export const createComplaint = (principalId: string, n: NewComplaint): Result => {
  const errs: string[] = [];
  if (!n.productId) errs.push('Choose the product.');
  if (!n.batch.trim() && !n.serial?.trim()) errs.push('Batch or serial is required — it is what a recall would trace.');
  if (n.description.trim().length < 10) errs.push('Describe what happened (at least a sentence).');
  if (!n.reporter.trim()) errs.push('Who reported it?');
  if (errs.length) return { ok: false, message: 'Can’t log the complaint.', errors: errs };
  const sev = RANK[n.severity] < RANK[minSeverity(n.category, n.patient)] ? minSeverity(n.category, n.patient) : n.severity;
  const adverse = n.patient !== 'No patient involved' || n.category === 'Adverse event';
  const s = recallSettings();
  const d = db();
  const seq = d.cSeq + 1;
  const c: Complaint = {
    ...n, id: newId('cmp'), no: `CMP-26-${seq}`, principalId, severity: sev, batch: n.batch.trim(), serial: n.serial?.trim() || null,
    report: adverse ? { dueBy: inDays(sev === 'Critical' ? s.reportDaysSerious : s.reportDaysOther), reportedAt: null, ref: '' } : null,
    status: 'Open', investigation: null, recallId: null, createdAt: now(),
    history: [{ at: now(), by: n.createdBy, action: `Complaint logged (${n.source})`, note: sev !== n.severity ? `Severity raised to ${sev} because of the patient outcome / category` : undefined }],
  };
  commit({ ...d, cSeq: seq, complaints: [c, ...d.complaints] });
  emit('complaint.logged', 'Recall', n.createdBy, `${c.no}: ${c.name} ${c.batch} — ${c.category} (${c.severity})`, { complaintId: c.id });
  return { ok: true, message: `${c.no} logged${c.report ? ` — regulator report due by ${c.report.dueBy}` : ''}.`, id: c.id };
};
export const startInvestigation = (id: string, by: string): Result => {
  const c = getComplaint(id);
  if (!c || c.status !== 'Open') return { ok: false, message: 'Only open complaints.' };
  putC(logC({ ...c, status: 'Investigating' }, by, 'Investigation started'));
  return { ok: true, message: `${c.no}: investigating.` };
};
export const recordFindings = (id: string, rootCause: string, capa: string, by: string): Result => {
  const c = getComplaint(id);
  if (!c || c.status !== 'Investigating') return { ok: false, message: 'Start the investigation first.' };
  if (rootCause.trim().length < 5 || capa.trim().length < 5) return { ok: false, message: 'Write the root cause and the corrective / preventive action.' };
  putC(logC({ ...c, status: 'CAPA', investigation: { rootCause, capa, by, at: now() } }, by, 'Root cause and CAPA recorded'));
  return { ok: true, message: `${c.no}: CAPA in progress.` };
};
export const markReported = (id: string, ref: string, by: string): Result => {
  const c = getComplaint(id);
  if (!c?.report) return { ok: false, message: 'This complaint doesn’t need a regulator report.' };
  if (!ref.trim()) return { ok: false, message: 'Enter the report / acknowledgement number.' };
  putC(logC({ ...c, report: { ...c.report, reportedAt: now(), ref } }, by, `Reported to the regulator — ${ref}`));
  return { ok: true, message: 'Regulator report recorded.' };
};
export const closeComplaint = (id: string, note: string, by: string): Result => {
  const c = getComplaint(id);
  if (!c || c.status !== 'CAPA') return { ok: false, message: 'Record the root cause and CAPA first.' };
  if (c.report && !c.report.reportedAt) return { ok: false, message: 'Report the adverse event to the regulator before closing.' };
  if (c.recallId && getRecall(c.recallId)?.status === 'Active') return { ok: false, message: 'The linked recall is still active.' };
  putC(logC({ ...c, status: 'Closed' }, by, 'Closed', note || undefined));
  return { ok: true, message: `${c.no} closed.` };
};

/** Returns raised as "Quality complaint" become complaints automatically (once). */
export const syncComplaintsFromReturns = (principalId: string) => {
  const have = new Set(complaints().map((c) => c.returnId).filter(Boolean));
  returns().filter((r) => r.principalId === principalId && r.status !== 'Rejected' && !have.has(r.id)).forEach((r) => {
    r.lines.filter((l) => l.reason === 'Quality complaint').slice(0, 1).forEach((l) => {
      createComplaint(principalId, { source: 'Return', partnerId: r.partnerId, partnerName: r.partnerName, reporter: r.requestedBy, productId: l.productId, variantSku: l.variantSku, name: l.name, batch: l.batch, serial: l.serial, qty: l.qty,
        category: 'Quality defect', description: `Raised from return ${r.no} (quality complaint).`, severity: 'Medium', patient: 'No patient involved', returnId: r.id, createdBy: 'System' });
    });
  });
};

/* -------------------------------- Trace forward -------------------------------- */

const matches = (b: Pick<StockBalance, 'productId' | 'batch' | 'serial'>, productId: string, batches: string[], serials: string[]) =>
  b.productId === productId && ((batches.length && batches.includes(b.batch)) || (serials.length && !!b.serial && serials.includes(b.serial)));

/** Everywhere the affected units are (or went). */
export const traceForward = (productId: string, batches: string[], serials: string[], partners: Partner[], warehouses: Warehouse[]): Party[] => {
  const out = new Map<string, Party>();
  const add = (kind: PartyKind, id: string, name: string, qty: number, accounted = 0) => {
    const k = `${kind}|${id}`;
    const p = out.get(k) ?? { key: k, kind, id, name, qty: 0, notifiedAt: null, acknowledgedAt: null, ackQty: null, recovered: 0, accounted: 0, note: '' };
    p.qty += qty; p.accounted += accounted; out.set(k, p);
  };
  const pname = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  balances().filter((b) => b.qty > 0 && matches(b, productId, batches, serials)).forEach((b) => {
    if (b.locType === 'COMPANY') add('COMPANY', b.warehouseId, warehouses.find((w) => w.id === b.warehouseId)?.name ?? b.warehouseId, b.qty);
    else add(b.locType, b.warehouseId, `${b.locType === 'TRANSIT' ? 'In transit to ' : ''}${pname(b.warehouseId)}`, b.qty);
  });
  // Consumed: hospital sales (no stock kept) — delivered quantity.
  allShipments().filter((x) => x.shipment.deliveredAt && destinationOf(x.order, partners) === null).forEach(({ order, shipment }) => {
    const q = shipment.allocations.filter((a) => matches(a, productId, batches, serials)).reduce((s, a) => s + a.qty, 0);
    if (q) add('CONSUMED', order.partnerId, `${order.partnerName} (sold, used at the hospital)`, q);
  });
  // Implanted in patients (implant register).
  register().filter((r) => r.status === 'Implanted' && matches({ productId: r.productId, batch: r.batch, serial: r.serial }, productId, batches, serials)).forEach((r) => add('PATIENT', r.hospitalId, `Patients at ${r.hospitalName}`, 1));
  return [...out.values()].sort((a, b) => ['COMPANY', 'TRANSIT', 'CNF', 'PARTNER', 'HOSPITAL', 'CONSUMED', 'PATIENT'].indexOf(a.kind) - ['COMPANY', 'TRANSIT', 'CNF', 'PARTNER', 'HOSPITAL', 'CONSUMED', 'PATIENT'].indexOf(b.kind));
};

export const createRecall = (principalId: string, n: { productId: string; name: string; batches: string[]; serials: string[]; cls: RecallClass; type: RecallType; reason: string; complaintIds: string[] }, partners: Partner[], warehouses: Warehouse[], by: string): Result => {
  const errs: string[] = [];
  if (!n.productId) errs.push('Choose the product.');
  if (!n.batches.length && !n.serials.length) errs.push('Choose at least one batch or serial.');
  if (n.reason.trim().length < 10) errs.push('Explain the reason (it goes on the partner notice).');
  if (errs.length) return { ok: false, message: 'Can’t create the recall.', errors: errs };
  const d = db();
  const seq = d.rSeq + 1;
  const r: Recall = { ...n, id: newId('rcl'), no: `RCL-26-${String(seq).padStart(3, '0')}`, principalId, status: 'Draft', parties: traceForward(n.productId, n.batches, n.serials, partners, warehouses),
    createdBy: by, createdAt: now(), approvedBy: null, activatedAt: null, closedNote: null, history: [{ at: now(), by, action: 'Recall drafted — trace forward done' }] };
  commit({ ...d, rSeq: seq, recalls: [r, ...d.recalls], complaints: d.complaints.map((c) => (n.complaintIds.includes(c.id) ? { ...c, recallId: r.id } : c)) });
  return { ok: true, message: `${r.no} drafted — ${r.parties.length} location(s) found. Another person approves it to start.`, id: r.id };
};
export const retrace = (id: string, partners: Partner[], warehouses: Warehouse[], by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Draft') return { ok: false, message: 'Only drafts can be traced again.' };
  putR(logR({ ...r, parties: traceForward(r.productId, r.batches, r.serials, partners, warehouses) }, by, 'Traced again'));
  return { ok: true, message: 'Trace refreshed.' };
};
export const cancelRecall = (id: string, note: string, by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Draft') return { ok: false, message: 'Only drafts can be cancelled.' };
  if (!note.trim()) return { ok: false, message: 'Give a reason.' };
  putR(logR({ ...r, status: 'Cancelled', closedNote: note }, by, 'Cancelled', note));
  return { ok: true, message: `${r.no} cancelled.` };
};

/** Approve: block every affected unit VinFlux holds, notify every partner / hospital. */
export const activateRecall = (id: string, partners: Partner[], warehouses: Warehouse[], by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Draft') return { ok: false, message: 'Only drafts can be started.' };
  if (r.createdBy === by) return { ok: false, message: 'Maker-checker: someone other than the creator approves a recall.' };
  const parties = traceForward(r.productId, r.batches, r.serials, partners, warehouses);
  const avail = balances().filter((b) => b.qty > 0 && b.status === 'Available' && b.locType !== 'TRANSIT' && matches(b, r.productId, r.batches, r.serials));
  const block = r.type === 'Field safety notice' ? [] : avail;
  post(block.flatMap((b) => {
    const base = { type: 'BLOCK' as const, locType: b.locType, warehouseId: b.warehouseId, bin: b.bin, productId: b.productId, variantSku: b.variantSku, batch: b.batch, serial: b.serial, mfgDate: b.mfgDate, expiryDate: b.expiryDate, unitCost: b.unitCost, importId: null, source: `Recall ${r.no}`, by, refId: r.id };
    return [{ ...base, qty: -b.qty, status: 'Available' as const }, { ...base, qty: b.qty, status: 'Blocked' as const }];
  }));
  const byWh = new Map<string, StockBalance[]>();
  block.filter((b) => b.locType === 'COMPANY').forEach((b) => byWh.set(b.warehouseId, [...(byWh.get(b.warehouseId) ?? []), b]));
  byWh.forEach((list, wh) => erpMirror(wh, list.flatMap((b) => [{ ...b, qty: -b.qty, status: 'Available' as const }, { ...b, qty: b.qty, status: 'Blocked' as const }]), { warehouses }));
  const t = now();
  const ps = parties.map((p) => ({ ...p, notifiedAt: ['COMPANY', 'TRANSIT'].includes(p.kind) ? null : t, accounted: p.kind === 'COMPANY' && r.type !== 'Field safety notice' ? p.qty : p.accounted }));
  let next = logR({ ...r, status: 'Active', approvedBy: by, activatedAt: t, parties: ps }, by, `${r.type} started — ${block.reduce((a, b) => a + b.qty, 0)} unit(s) blocked`, r.cls);
  const notified = ps.filter((p) => p.notifiedAt);
  if (notified.length) next = logR(next, 'System', `Notice sent to ${notified.length} partner(s) / hospital(s) (email, WhatsApp, portal)`, notified.map((p) => p.name).join(', '));
  putR(next);
  emit('recall.started', 'Recall', by, `${r.no}: ${r.name} ${[...r.batches, ...r.serials].join(', ')} — ${r.type}`, { recallId: r.id });
  return { ok: true, message: `${r.no} is active — stock blocked, ${notified.length} notified.` };
};

export const acknowledge = (id: string, key: string, qtyHeld: number, by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Active') return { ok: false, message: 'Recall not active.' };
  const p = r.parties.find((x) => x.key === key);
  if (!p) return { ok: false, message: 'Not found.' };
  putR(logR({ ...r, parties: r.parties.map((x) => (x.key === key ? { ...x, acknowledgedAt: now(), ackQty: qtyHeld } : x)) }, by, `${p.name} acknowledged — holds ${qtyHeld}`));
  return { ok: true, message: `${p.name}: acknowledgement recorded.` };
};

/** Goods back from a partner / hospital / C&F into a company warehouse (stay Blocked). */
export const recoverStock = (id: string, key: string, qty: number, toWarehouseId: string, warehouses: Warehouse[], by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Active') return { ok: false, message: 'Recall not active.' };
  const p = r.parties.find((x) => x.key === key);
  if (!p || !['CNF', 'PARTNER', 'HOSPITAL'].includes(p.kind)) return { ok: false, message: 'Only stock held by partners, C&F or hospitals is recovered.' };
  const open = p.qty - p.recovered - p.accounted;
  if (!(qty > 0) || qty > open) return { ok: false, message: `Enter 1–${open}.` };
  if (!toWarehouseId) return { ok: false, message: 'Choose the warehouse receiving the goods.' };
  let need = qty;
  const held = balances().filter((b) => b.locType === p.kind && b.warehouseId === p.id && b.qty > 0 && matches(b, r.productId, r.batches, r.serials));
  const movs: Parameters<typeof post>[0] = [];
  held.forEach((b) => {
    if (need <= 0) return;
    const take = Math.min(need, b.qty); need -= take;
    const base = { productId: b.productId, variantSku: b.variantSku, batch: b.batch, serial: b.serial, mfgDate: b.mfgDate, expiryDate: b.expiryDate, unitCost: b.unitCost, importId: null, by, refId: r.id };
    movs.push({ ...base, type: 'RETURN', locType: p.kind as LocType, warehouseId: p.id, bin: b.bin, qty: -take, status: b.status, source: `Recall ${r.no} — sent back` });
    movs.push({ ...base, type: 'RETURN', locType: 'COMPANY', warehouseId: toWarehouseId, bin: 'RECALL', qty: take, status: 'Blocked', source: `Recall ${r.no} — recovered from ${p.name}` });
  });
  if (need > 0) return { ok: false, message: `${p.name} holds only ${qty - need} unit(s) of these batches in VinFlux.` };
  post(movs);
  erpMirror(toWarehouseId, movs.filter((m) => m.locType === 'COMPANY').map((m) => ({ ...m, qty: m.qty, status: 'Blocked' as const })), { warehouses });
  putR(logR({ ...r, parties: r.parties.map((x) => (x.key === key ? { ...x, recovered: x.recovered + qty } : x)) }, by, `${qty} unit(s) recovered from ${p.name}`, `to ${warehouses.find((w) => w.id === toWarehouseId)?.name ?? toWarehouseId}`));
  return { ok: true, message: `${qty} recovered from ${p.name}.` };
};

/** Consumed / implanted units: accounted with a record (patient follow-up, used before the recall, …). */
export const accountFor = (id: string, key: string, qty: number, note: string, by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Active') return { ok: false, message: 'Recall not active.' };
  const p = r.parties.find((x) => x.key === key);
  if (!p) return { ok: false, message: 'Not found.' };
  const open = p.qty - p.recovered - p.accounted;
  if (!(qty > 0) || qty > open) return { ok: false, message: `Enter 1–${open}.` };
  if (note.trim().length < 5) return { ok: false, message: 'Say how these units are accounted for.' };
  putR(logR({ ...r, parties: r.parties.map((x) => (x.key === key ? { ...x, accounted: x.accounted + qty, note: [x.note, note].filter(Boolean).join('; ') } : x)) }, by, `${qty} unit(s) at ${p.name} accounted for`, note));
  return { ok: true, message: 'Recorded.' };
};

export const effectiveness = (r: Recall) => {
  const total = r.parties.reduce((a, p) => a + p.qty, 0);
  const done = r.parties.reduce((a, p) => a + Math.min(p.qty, p.recovered + p.accounted), 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 100, notified: r.parties.filter((p) => p.notifiedAt).length, acked: r.parties.filter((p) => p.acknowledgedAt).length };
};
export const closeRecall = (id: string, note: string, by: string): Result => {
  const r = getRecall(id);
  if (!r || r.status !== 'Active') return { ok: false, message: 'Recall not active.' };
  const e = effectiveness(r);
  if (e.pct < 100 && note.trim().length < 10) return { ok: false, message: `Only ${e.pct}% accounted for — explain why it can close (at least a sentence).` };
  if (r.createdBy === by && r.approvedBy !== by && e.pct < 100) return { ok: false, message: 'Closing below 100% needs someone other than the creator.' };
  putR(logR({ ...r, status: 'Closed', closedNote: note || null }, by, `Closed at ${e.pct}% effectiveness`, note || undefined));
  return { ok: true, message: `${r.no} closed (${e.pct}%).` };
};

/** Demo (once per workspace): a complaint and a draft recall on the batch the C&F holds. */
export const ensureRecallDemo = (principalId: string, products: { id: string; name: string; principalId: string }[], partners: Partner[], warehouses: Warehouse[]) => {
  const k = workspaceKey('vinflux.recallSeeded.v1');
  if (loadJson<boolean>(k, false)) return;
  const cnf = balances().find((b) => b.locType === 'CNF' && b.qty > 1 && !b.serial && products.some((p) => p.id === b.productId && p.principalId === principalId));
  if (!cnf) return;
  saveJson(k, true);
  const prod = products.find((p) => p.id === cnf.productId)!;
  const hosp = partners.find((p) => p.id === 'ptr-hosp-hyd');
  const a = createComplaint(principalId, { source: 'Hospital', partnerId: hosp?.id ?? null, partnerName: hosp?.name ?? 'Hospital', reporter: 'OT nurse in charge', productId: prod.id, variantSku: cnf.variantSku, name: prod.name, batch: cnf.batch, serial: null, qty: 3,
    category: 'Sterility / contamination', description: 'Pouch seal found open on 3 units from the same carton before use in OT 2. Units not used.', severity: 'Medium', patient: 'No patient involved', returnId: null, createdBy: 'Ravi Kumar' });
  if (a.id) startInvestigation(a.id, 'Ravi Kumar');
  createRecall(principalId, { productId: prod.id, name: prod.name, batches: [cnf.batch], serials: [], cls: 'Class II', type: 'Recall', reason: `Possible sterile barrier failure in batch ${cnf.batch} (pouch seals) — see ${complaints()[0]?.no ?? 'complaint'}.`, complaintIds: a.id ? [a.id] : [] }, partners, warehouses, 'Ravi Kumar');
};
