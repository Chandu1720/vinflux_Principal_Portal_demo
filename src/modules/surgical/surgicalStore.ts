/**
 * Surgery cases, instrument sets (loaner / consignment) and the implant register (medical devices).
 *
 * Case flow:  Requested → Confirmed (sets reserved) → Kit dispatched → Surgery done (usage recorded,
 *             implants registered against the patient) → Kit returned (checked, missing items charged)
 *             → Closed (bill raised). Sets then go through sterilisation before they are available again.
 * Patient privacy: only the hospital's patient ID (UHID / IP number) is stored — never names.
 * INTEGRATION POINT: GET|POST /surgery-cases, /instrument-sets, /implant-register; usage → invoicing / ERP.
 */
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';

export type SetKind = 'Loaner' | 'Consignment';
export type SetStatus = 'Available' | 'Reserved' | 'At hospital' | 'Incomplete' | 'Sterilising';
export interface SetItem {
  id: string;
  kind: 'Instrument' | 'Implant';
  name: string;
  qty: number;
  /** Replacement cost charged if lost or damaged (instruments). */
  value: number;
  productId?: string;
  variantSku?: string | null;
  udiDi?: string;
  batch?: string;
  serial?: string | null;
  expiry?: string | null;
}
export interface InstrumentSet {
  id: string;
  code: string;
  name: string;
  kind: SetKind;
  serial: string;
  status: SetStatus;
  /** Home warehouse (loaner) or the hospital it is placed at (consignment). */
  homeWarehouseId: string | null;
  hospitalId: string | null;
  caseId: string | null;
  items: SetItem[];
  sterilisationCycles: number;
  lastSterilisedAt: string | null;
  sentAt: string | null;
  history: { at: string; by: string; action: string; note?: string }[];
}
export type CaseStatus = 'Confirmed' | 'Kit dispatched' | 'Surgery done' | 'Kit returned' | 'Closed' | 'Cancelled';
export interface UsageLine {
  id: string;
  itemId: string | null;
  productId: string;
  name: string;
  variantSku: string | null;
  udiDi: string;
  batch: string;
  serial: string | null;
  expiry: string | null;
  qty: number;
  implant: boolean;
  unitPrice: number | null;
  gstPct: number;
  priceSource: string;
}
export interface MissingLine { itemId: string; name: string; qty: number; damaged: boolean; charge: number }
export interface SurgeryCase {
  id: string;
  code: string;
  principalId: string;
  hospitalId: string;
  hospitalName: string;
  surgeon: string;
  procedure: string;
  surgeryDate: string;
  /** Hospital patient ID only (UHID / IP no.). */
  patientRef: string;
  servedBy: 'COMPANY' | 'PARTNER';
  partnerId: string | null;
  partnerName: string | null;
  setIds: string[];
  status: CaseStatus;
  usage: UsageLine[];
  missing: MissingLine[];
  billNo: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  history: { at: string; by: string; action: string; note?: string }[];
}
export interface ImplantRecord {
  id: string;
  caseId: string;
  caseCode: string;
  productId: string;
  name: string;
  variantSku: string | null;
  udiDi: string;
  batch: string;
  serial: string | null;
  expiry: string | null;
  hospitalId: string;
  hospitalName: string;
  surgeon: string;
  surgeryDate: string;
  patientRef: string;
  recordedBy: string;
  recordedAt: string;
  status: 'Implanted' | 'Explanted';
}

/** GS1 UDI string: (01) GTIN (17) expiry YYMMDD (10) batch (21) serial. */
export const udiString = (r: { udiDi: string; expiry?: string | null; batch?: string; serial?: string | null }) =>
  `(01)${r.udiDi.padStart(14, '0')}${r.expiry ? `(17)${r.expiry.slice(2, 4)}${r.expiry.slice(5, 7)}${r.expiry.slice(8, 10)}` : ''}${r.batch ? `(10)${r.batch}` : ''}${r.serial ? `(21)${r.serial}` : ''}`;

/* ---------------------------------- Seed ---------------------------------- */

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const ins = (id: string, name: string, qty: number, value: number): SetItem => ({ id, kind: 'Instrument', name, qty, value });
const imp = (id: string, name: string, productId: string, sku: string, gtin: string, batch: string, serial: string, expiry: string): SetItem =>
  ({ id, kind: 'Implant', name, qty: 1, value: 0, productId, variantSku: sku, udiDi: gtin, batch, serial, expiry });
const INSTRUMENTS = (p: string) => [
  ins(`${p}-i1`, 'Tibial reamer 10 mm', 1, 18500), ins(`${p}-i2`, 'Trial augment Sz 3 (L/R)', 2, 9200), ins(`${p}-i3`, 'Stem trial 150 mm', 2, 7400),
  ins(`${p}-i4`, 'Tibial impactor', 1, 12600), ins(`${p}-i5`, 'Alignment guide', 1, 21800), ins(`${p}-i6`, 'Sterilisation tray with lid', 1, 15500),
];
const IMPLANTS = (p: string, n: number) => [
  imp(`${p}-m1`, 'Tray augment Sz 3 / 10 mm / Left', 'PRD-EVOCON-001', 'EVO-TRAY-SZ3-10L', '08903209039241', 'B2611A', `SN-TA3L-${n}01`, '2030-12-31'),
  imp(`${p}-m2`, 'Tray augment Sz 3 / 10 mm / Right', 'PRD-EVOCON-001', 'EVO-TRAY-SZ3-10R', '08903209039258', 'B2611A', `SN-TA3R-${n}02`, '2030-12-31'),
  imp(`${p}-m3`, 'Stem extension 150 mm / Ø12', 'PRD-EVOCON-006', 'EVO-STEM-150-12', '8903209045594', 'S2608C', `SN-ST12-${n}03`, '2031-06-30'),
  imp(`${p}-m4`, 'Stem extension 150 mm / Ø14', 'PRD-EVOCON-006', 'EVO-STEM-150-14', '8903209045587', 'S2608C', `SN-ST14-${n}04`, '2031-06-30'),
];
const h = (action: string, at = '2026-10-01T09:00:00Z', by = 'Suresh Reddy', note?: string) => ({ at, by, action, note });

const SEED_SETS: InstrumentSet[] = [
  { id: 'set-01', code: 'LS-REV-01', name: 'Revision knee set — loaner 1', kind: 'Loaner', serial: 'EVO-SET-0001', status: 'Reserved', homeWarehouseId: 'wh-medc-06', hospitalId: null, caseId: 'case-141',
    items: [...INSTRUMENTS('s1'), ...IMPLANTS('s1', 1)], sterilisationCycles: 42, lastSterilisedAt: '2026-10-29', sentAt: null, history: [h('Sterilisation done (cycle 42)', '2026-10-29T15:00:00Z'), h('Reserved for CASE-2026-0141', '2026-11-03T10:00:00Z', 'Ravi Kumar')] },
  { id: 'set-02', code: 'LS-REV-02', name: 'Revision knee set — loaner 2', kind: 'Loaner', serial: 'EVO-SET-0002', status: 'At hospital', homeWarehouseId: 'wh-medc-06', hospitalId: 'ptr-hosp-vja', caseId: 'case-138',
    items: [...INSTRUMENTS('s2'), ...IMPLANTS('s2', 2)], sterilisationCycles: 37, lastSterilisedAt: '2026-10-25', sentAt: '2026-11-01T08:00:00Z', history: [h('Dispatched for CASE-2026-0138', '2026-11-01T08:00:00Z')] },
  { id: 'set-03', code: 'CS-YSD-01', name: 'Revision knee set — consignment at Yashoda Somajiguda', kind: 'Consignment', serial: 'EVO-SET-0003', status: 'At hospital', homeWarehouseId: 'wh-medc-06', hospitalId: 'ptr-hosp-hyd', caseId: null,
    items: [...INSTRUMENTS('s3'), ...IMPLANTS('s3', 3)], sterilisationCycles: 18, lastSterilisedAt: '2026-10-30', sentAt: '2026-07-01T08:00:00Z', history: [h('Placed on consignment', '2026-07-01T08:00:00Z')] },
  { id: 'set-04', code: 'LS-REV-03', name: 'Revision knee set — loaner 3', kind: 'Loaner', serial: 'EVO-SET-0004', status: 'Available', homeWarehouseId: 'wh-medc-06', hospitalId: null, caseId: null,
    items: [...INSTRUMENTS('s4'), ...IMPLANTS('s4', 4)], sterilisationCycles: 51, lastSterilisedAt: '2026-11-02', sentAt: null, history: [h('Sterilisation done (cycle 51)', '2026-11-02T15:00:00Z')] },
];

const usage = (item: SetItem, price: number, source: string, gst = 5): UsageLine => ({
  id: newId('use'), itemId: item.id, productId: item.productId!, name: item.name, variantSku: item.variantSku ?? null, udiDi: item.udiDi!, batch: item.batch!, serial: item.serial ?? null,
  expiry: item.expiry ?? null, qty: 1, implant: true, unitPrice: price, gstPct: gst, priceSource: source,
});
const closedItems = IMPLANTS('c27', 9);
const SEED_CASES: SurgeryCase[] = [
  { id: 'case-141', code: 'CASE-2026-0141', principalId: 'princ-biorad', hospitalId: 'ptr-hosp-hyd', hospitalName: 'Yashoda Hospitals Somajiguda', surgeon: 'Dr. S. Venkat Reddy', procedure: 'Revision total knee replacement (left)',
    surgeryDate: '2026-11-08', patientRef: 'YH-UHID-2026-118842', servedBy: 'COMPANY', partnerId: null, partnerName: null, setIds: ['set-01'], status: 'Confirmed', usage: [], missing: [], billNo: null, notes: 'Surgeon prefers Ø12 stems.',
    createdBy: 'Ravi Kumar', createdAt: '2026-11-03', history: [h('Case booked, set LS-REV-01 reserved', '2026-11-03T10:00:00Z', 'Ravi Kumar')] },
  { id: 'case-138', code: 'CASE-2026-0138', principalId: 'princ-biorad', hospitalId: 'ptr-hosp-vja', hospitalName: 'Ramesh Hospitals Vijayawada', surgeon: 'Dr. K. Mohan', procedure: 'Revision TKR (right) — tibial augment',
    surgeryDate: '2026-11-03', patientRef: 'RH-IP-26-55310', servedBy: 'PARTNER', partnerId: 'ptr-dist-vja', partnerName: 'Krishna Medi Distributors', setIds: ['set-02'], status: 'Kit dispatched', usage: [], missing: [], billNo: null, notes: '',
    createdBy: 'Ravi Kumar', createdAt: '2026-10-29', history: [h('Case booked', '2026-10-29T10:00:00Z', 'Ravi Kumar'), h('Kit dispatched with set LS-REV-02', '2026-11-01T08:00:00Z')] },
  { id: 'case-127', code: 'CASE-2026-0127', principalId: 'princ-biorad', hospitalId: 'ptr-hosp-hyd', hospitalName: 'Yashoda Hospitals Somajiguda', surgeon: 'Dr. S. Venkat Reddy', procedure: 'Revision TKR (left)',
    surgeryDate: '2026-10-14', patientRef: 'YH-UHID-2026-104417', servedBy: 'COMPANY', partnerId: null, partnerName: null, setIds: ['set-03'], status: 'Closed',
    usage: [usage(closedItems[0], 38500, 'Rate contract RC-YASHODA-26'), usage(closedItems[2], 24500, 'Rate contract RC-YASHODA-26')], missing: [], billNo: 'INV-SC-2026-0127', notes: '',
    createdBy: 'Ravi Kumar', createdAt: '2026-10-10', history: [h('Case booked', '2026-10-10T10:00:00Z', 'Ravi Kumar'), h('Usage recorded: 2 implant(s)', '2026-10-14T18:00:00Z', 'Ravi Kumar'), h('Closed, bill INV-SC-2026-0127 raised', '2026-10-16T10:00:00Z', 'Meera Iyer')] },
];
const SEED_REGISTER: ImplantRecord[] = SEED_CASES.filter((c) => c.status === 'Closed').flatMap((c) => c.usage.filter((u) => u.implant).map((u) => ({
  id: newId('imp'), caseId: c.id, caseCode: c.code, productId: u.productId, name: u.name, variantSku: u.variantSku, udiDi: u.udiDi, batch: u.batch, serial: u.serial, expiry: u.expiry,
  hospitalId: c.hospitalId, hospitalName: c.hospitalName, surgeon: c.surgeon, surgeryDate: c.surgeryDate, patientRef: c.patientRef, recordedBy: 'Ravi Kumar', recordedAt: `${c.surgeryDate}T18:00:00Z`, status: 'Implanted' as const,
})));

/* --------------------------------- Store --------------------------------- */

interface Db { sets: InstrumentSet[]; cases: SurgeryCase[]; register: ImplantRecord[]; seq: number }
let cache: Db | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.surgical.v1');
const db = (): Db => (cache ??= loadJson<Db>(KEY(), { sets: SEED_SETS, cases: SEED_CASES, register: SEED_REGISTER, seq: 141 }));
const commit = (d: Db) => { cache = d; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeSurgical = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const sets = () => db().sets;
export const cases = () => db().cases;
export const register = () => db().register;
export const getCase = (id: string) => db().cases.find((c) => c.id === id) ?? null;
export const getSet = (id: string) => db().sets.find((s) => s.id === id) ?? null;

type Result = { ok: boolean; message: string; errors?: string[] };
const log = <T extends { history: { at: string; by: string; action: string; note?: string }[] }>(x: T, by: string, action: string, note?: string): T => ({ ...x, history: [...x.history, { at: now(), by, action, note }] });
const putCase = (d: Db, c: SurgeryCase): Db => ({ ...d, cases: d.cases.map((x) => (x.id === c.id ? c : x)) });
const putSets = (d: Db, ids: string[], fn: (s: InstrumentSet) => InstrumentSet): Db => ({ ...d, sets: d.sets.map((s) => (ids.includes(s.id) ? fn(s) : s)) });

export interface NewCase {
  principalId: string; hospitalId: string; hospitalName: string; surgeon: string; procedure: string; surgeryDate: string; patientRef: string;
  servedBy: 'COMPANY' | 'PARTNER'; partnerId: string | null; partnerName: string | null; setIds: string[]; notes: string;
}
/** Book a case and reserve the sets. `blockers` come from the caller's checks (hospital / partner can't trade). */
export const bookCase = (n: NewCase, by: string, blockers: string[] = []): Result & { id?: string } => {
  const d = db();
  const errs = [...blockers];
  if (!n.hospitalId) errs.push('Choose the hospital.');
  if (!n.surgeon.trim()) errs.push('Surgeon is required.');
  if (!n.procedure.trim()) errs.push('Procedure is required.');
  if (!n.surgeryDate) errs.push('Surgery date is required.');
  else if (n.surgeryDate < today()) errs.push('Surgery date is in the past.');
  if (!n.patientRef.trim()) errs.push('Hospital patient ID (UHID / IP no.) is required for implant traceability.');
  if (!n.setIds.length) errs.push('Choose at least one instrument set.');
  n.setIds.forEach((id) => {
    const s = d.sets.find((x) => x.id === id);
    if (!s) return;
    const ok = s.kind === 'Consignment' ? s.hospitalId === n.hospitalId && s.status === 'At hospital' && !s.caseId : s.status === 'Available';
    if (!ok) errs.push(`${s.code} is not free (${s.status}${s.kind === 'Consignment' && s.hospitalId !== n.hospitalId ? ', placed at another hospital' : ''}).`);
  });
  if (errs.length) return { ok: false, message: 'Can’t book this case.', errors: errs };
  const seq = d.seq + 1;
  const id = `case-${seq}`;
  const c: SurgeryCase = { ...n, id, code: `CASE-2026-${String(seq).padStart(4, '0')}`, status: 'Confirmed', usage: [], missing: [], billNo: null, createdBy: by, createdAt: today(), history: [{ at: now(), by, action: `Case booked, set(s) reserved` }] };
  let next: Db = { ...d, seq, cases: [c, ...d.cases] };
  next = putSets(next, n.setIds, (s) => log({ ...s, status: s.kind === 'Consignment' ? s.status : 'Reserved', caseId: id }, by, `Reserved for ${c.code}`));
  commit(next);
  return { ok: true, message: `${c.code} booked for ${n.surgeryDate}.`, id };
};

export const dispatchKit = (caseId: string, by: string): Result => {
  const d = db(); const c = getCase(caseId);
  if (!c || c.status !== 'Confirmed') return { ok: false, message: 'Only confirmed cases can be dispatched.' };
  let next = putCase(d, log({ ...c, status: 'Kit dispatched' }, by, 'Kit dispatched'));
  next = putSets(next, c.setIds, (s) => (s.kind === 'Consignment' ? s : log({ ...s, status: 'At hospital', hospitalId: c.hospitalId, sentAt: now() }, by, `Dispatched to ${c.hospitalName} for ${c.code}`)));
  commit(next);
  return { ok: true, message: `Kit for ${c.code} dispatched to ${c.hospitalName}.` };
};

/** After surgery: what was used. Implants go to the implant register against the patient. */
export const recordUsage = (caseId: string, lines: Omit<UsageLine, 'id'>[], by: string): Result => {
  const d = db(); const c = getCase(caseId);
  if (!c || !['Kit dispatched', 'Confirmed'].includes(c.status)) return { ok: false, message: 'Usage can be recorded once the kit is at the hospital.' };
  const errs: string[] = [];
  if (!lines.length) errs.push('Add what was used (or cancel the case if the surgery did not happen).');
  lines.forEach((l, i) => {
    if (l.implant && !l.serial && !l.batch) errs.push(`Line ${i + 1}: implants need a batch or serial number.`);
    if (!(l.qty > 0)) errs.push(`Line ${i + 1}: quantity must be more than 0.`);
    if (l.expiry && l.expiry < c.surgeryDate) errs.push(`Line ${i + 1}: ${l.name} batch ${l.batch} expired on ${l.expiry} — it should not have been implanted.`);
  });
  const serials = lines.filter((l) => l.serial).map((l) => `${l.productId}|${l.serial}`);
  if (new Set(serials).size !== serials.length) errs.push('The same serial number is used twice.');
  const already = d.register.filter((r) => serials.includes(`${r.productId}|${r.serial}`));
  already.forEach((r) => errs.push(`Serial ${r.serial} is already implanted (${r.caseCode}).`));
  if (errs.length) return { ok: false, message: 'Can’t record usage.', errors: errs };
  const usage: UsageLine[] = lines.map((l) => ({ ...l, id: newId('use') }));
  const regs: ImplantRecord[] = usage.filter((u) => u.implant).map((u) => ({
    id: newId('imp'), caseId: c.id, caseCode: c.code, productId: u.productId, name: u.name, variantSku: u.variantSku, udiDi: u.udiDi, batch: u.batch, serial: u.serial, expiry: u.expiry,
    hospitalId: c.hospitalId, hospitalName: c.hospitalName, surgeon: c.surgeon, surgeryDate: c.surgeryDate, patientRef: c.patientRef, recordedBy: by, recordedAt: now(), status: 'Implanted',
  }));
  const usedItemIds = usage.map((u) => u.itemId).filter(Boolean) as string[];
  let next = putCase({ ...d, register: [...regs, ...d.register] }, log({ ...c, status: 'Surgery done', usage }, by, `Usage recorded: ${regs.length} implant(s), ${usage.length - regs.length} other item(s)`));
  // Used implants leave the set; the set must be refilled before its next case.
  next = putSets(next, c.setIds, (s) => (s.items.some((it) => usedItemIds.includes(it.id)) ? log({ ...s, items: s.items.filter((it) => !usedItemIds.includes(it.id)) }, by, `${s.items.filter((it) => usedItemIds.includes(it.id)).length} implant(s) used in ${c.code}`) : s));
  commit(next);
  regs.forEach((r) => emit('implant.recorded', 'Surgery & Implants', by, `${r.name} SN ${r.serial ?? '—'} implanted at ${r.hospitalName} (${r.caseCode})`, { caseId: c.id, serial: r.serial, batch: r.batch }));
  return { ok: true, message: `Usage saved — ${regs.length} implant(s) added to the implant register.` };
};

/** Kit back from the hospital: count every instrument; missing / damaged items are charged. */
export const returnKit = (caseId: string, counts: Record<string, { returned: number; damaged: boolean }>, by: string): Result => {
  const d = db(); const c = getCase(caseId);
  if (!c || c.status !== 'Surgery done') return { ok: false, message: 'Record the surgery usage before receiving the kit.' };
  const missing: MissingLine[] = [];
  c.setIds.forEach((sid) => {
    const s = d.sets.find((x) => x.id === sid);
    s?.items.filter((it) => it.kind === 'Instrument').forEach((it) => {
      const k = counts[it.id] ?? { returned: it.qty, damaged: false };
      const short = Math.max(0, it.qty - k.returned);
      if (short || k.damaged) missing.push({ itemId: it.id, name: it.name, qty: short || 1, damaged: k.damaged && !short, charge: (short || 1) * it.value });
    });
  });
  let next = putCase(d, log({ ...c, status: 'Kit returned', missing }, by, missing.length ? `Kit returned — ${missing.length} item(s) missing or damaged` : 'Kit returned complete'));
  next = putSets(next, c.setIds, (s) => {
    const own = missing.filter((m) => s.items.some((it) => it.id === m.itemId));
    const base = s.kind === 'Consignment' ? { ...s, caseId: null } : { ...s, caseId: null, hospitalId: null, sentAt: null };
    return log({ ...base, status: own.length ? 'Incomplete' : 'Sterilising' }, by, own.length ? `Returned incomplete: ${own.map((m) => m.name).join(', ')}` : 'Returned complete — sent for sterilisation');
  });
  commit(next);
  return { ok: true, message: missing.length ? `${missing.length} item(s) missing or damaged — they will be charged on the bill.` : 'Kit returned complete and sent for sterilisation.' };
};

export const closeCase = (caseId: string, by: string): Result => {
  const d = db(); const c = getCase(caseId);
  if (!c || c.status !== 'Kit returned') return { ok: false, message: 'Close the case after the kit is back.' };
  if (c.usage.some((u) => u.unitPrice === null)) return { ok: false, message: 'Some used items have no price — add a price list or rate contract for this hospital first.' };
  const billNo = `INV-SC-${c.code.slice(5)}`;
  commit(putCase(d, log({ ...c, status: 'Closed', billNo }, by, `Closed, bill ${billNo} raised`)));
  emit('case.closed', 'Surgery & Implants', by, `${c.code} closed, bill ${billNo}`, { caseId });
  return { ok: true, message: `${c.code} closed — bill ${billNo} raised${c.servedBy === 'PARTNER' ? ` (billed by ${c.partnerName}; usage replenished to the partner)` : ''}.` };
};

export const cancelCase = (caseId: string, reason: string, by: string): Result => {
  const d = db(); const c = getCase(caseId);
  if (!c || !['Confirmed', 'Kit dispatched'].includes(c.status)) return { ok: false, message: 'Only cases not yet operated can be cancelled.' };
  if (!reason.trim()) return { ok: false, message: 'Give a reason.' };
  let next = putCase(d, log({ ...c, status: 'Cancelled' }, by, 'Cancelled', reason));
  next = putSets(next, c.setIds, (s) => log(s.kind === 'Consignment' ? { ...s, caseId: null } : { ...s, caseId: null, hospitalId: null, sentAt: null, status: c.status === 'Kit dispatched' ? 'Sterilising' : 'Available' }, by, `Released — ${c.code} cancelled`));
  commit(next);
  return { ok: true, message: `${c.code} cancelled; set(s) released.` };
};

/** Missing / damaged instruments replaced from spares. */
export const replaceItems = (setId: string, by: string): Result => {
  const s = getSet(setId);
  if (!s || s.status !== 'Incomplete') return { ok: false, message: 'Only incomplete sets need replacements.' };
  commit(putSets(db(), [setId], (x) => log({ ...x, status: 'Sterilising' }, by, 'Missing / damaged instruments replaced')));
  return { ok: true, message: `${s.code}: items replaced — ready for sterilisation.` };
};

/** Implants used in surgery are refilled from stock with new batch / serial numbers. */
export const refillImplants = (setId: string, by: string): Result => {
  const s = getSet(setId);
  if (!s) return { ok: false, message: 'Set not found.' };
  const template = IMPLANTS(s.id, 0);
  const missing = template.filter((t) => !s.items.some((it) => it.variantSku === t.variantSku));
  if (!missing.length) return { ok: false, message: 'All implant slots are filled.' };
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const added = missing.map((t, i) => ({ ...t, id: newId('itm'), serial: `SN-${t.variantSku!.slice(-6)}-${stamp}${i}`, batch: t.batch === 'B2611A' ? 'B2611B' : 'S2610A' }));
  commit(putSets(db(), [setId], (x) => log({ ...x, items: [...x.items, ...added] }, by, `Refilled ${added.length} implant(s) from stock`)));
  return { ok: true, message: `${s.code}: ${added.length} implant(s) refilled.` };
};

export const sterilised = (setId: string, method: string, load: string, by: string): Result => {
  const s = getSet(setId);
  if (!s || s.status !== 'Sterilising') return { ok: false, message: 'The set is not waiting for sterilisation.' };
  if (!load.trim()) return { ok: false, message: 'Enter the sterilisation load / batch number.' };
  commit(putSets(db(), [setId], (x) => log({ ...x, status: x.kind === 'Consignment' ? 'At hospital' : 'Available', sterilisationCycles: x.sterilisationCycles + 1, lastSterilisedAt: today() }, by, `Sterilisation done (cycle ${x.sterilisationCycles + 1})`, `${method} · load ${load}`)));
  return { ok: true, message: `${s.code} sterilised (cycle ${s.sterilisationCycles + 1}) and ${s.kind === 'Consignment' ? 'back on the hospital shelf' : 'available'}.` };
};

export const markExplanted = (recordId: string, reason: string, by: string): Result => {
  const d = db(); const r = d.register.find((x) => x.id === recordId);
  if (!r || r.status !== 'Implanted') return { ok: false, message: 'Record not found.' };
  if (!reason.trim()) return { ok: false, message: 'Give the reason (revision, infection, recall…).' };
  commit({ ...d, register: d.register.map((x) => (x.id === recordId ? { ...x, status: 'Explanted' as const } : x)) });
  emit('implant.recorded', 'Surgery & Implants', by, `${r.name} SN ${r.serial} explanted: ${reason}`, { recordId });
  return { ok: true, message: 'Marked as explanted.' };
};

/** Recall trace: every patient / hospital that received a product, batch or serial. */
export const trace = (q: { productId?: string; batch?: string; serial?: string }) => db().register.filter((r) =>
  (!q.productId || r.productId === q.productId) && (!q.batch || r.batch.toLowerCase() === q.batch.trim().toLowerCase()) && (!q.serial || (r.serial ?? '').toLowerCase().includes(q.serial.trim().toLowerCase())));
