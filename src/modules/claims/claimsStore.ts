/**
 * Schemes & claims (CM4) — schemes paid AFTER the sale, settled by claims checked against verified data.
 * (On-invoice schemes — buy X get Y, extra % — stay in Price Lists and apply when the order is priced: SCH-01.)
 *
 *   Scheme: Draft ─► Pending approval ─► Active ─► Closed            (maker-checker, SCH-06)
 *   Claim:  Submitted ─► Under review ─► Approved / Partly approved ─► Settled   (or Rejected)
 *
 * Rules
 *   SCH-02 Secondary and target schemes use only secondary sales that passed reconciliation; estimates never count.
 *          Claimed above verified is flagged with the difference.
 *   SCH-03 A claim can't exceed the budget left; over-budget needs an explicit approval.
 *   SCH-04 The same sale can't be claimed twice under a scheme, nor under two schemes that don't stack.
 *   SCH-05 Settlement creates a credit note where invoicing lives (VinFlux or the ERP) and records its number.
 *   SCH-06 Scheme approval and claim approval are maker-checker (a different person approves).
 * INTEGRATION POINT: /claims/schemes, /claims (REST); credit note → ERP connector (create_credit_note).
 */
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { optChoice } from '../../platform/moduleOptions';
import { issueLink, revokeLinks } from '../../platform/actionLinks';
import { reports as secReports, setupOf } from '../secondary/secondaryStore';
import type { SecondaryReport } from '../secondary/secondaryStore';

export type SchemeType = 'PER_UNIT' | 'TARGET' | 'DISPLAY' | 'PRICE_SUPPORT';
export const TYPE_LABEL: Record<SchemeType, string> = { PER_UNIT: 'Secondary sales (₹ per unit sold)', TARGET: 'Target incentive', DISPLAY: 'Display / listing', PRICE_SUPPORT: 'Price support (tender)' };
export const TYPE_HINT: Record<SchemeType, string> = {
  PER_UNIT: 'Paid on units the partner sells to its customers, from reconciled secondary sales.',
  TARGET: 'Paid as % of the partner’s secondary sales value when it reaches its target.',
  DISPLAY: 'Paid per outlet with proof (photo / visit report).',
  PRICE_SUPPORT: 'Difference between list and an approved lower price the partner sold at to win a tender.',
};
export type SchemeStatus = 'Draft' | 'Pending approval' | 'Active' | 'Closed' | 'Rejected';
export type Settlement = 'Credit note' | 'Free goods' | 'Payment';
export interface ClaimScheme {
  id: string; code: string; principalId: string; name: string; type: SchemeType;
  from: string; to: string; partnerIds: string[]; productIds: string[]; customerTypes: string[];
  rate: number; targetValue: number; incentivePct: number; budget: number;
  stackable: boolean; claimWindowDays: number; evidence: string; settlement: Settlement;
  status: SchemeStatus; makerBy: string; approvedBy: string | null; history: Hist;
}
export type ClaimStatus = 'Under review' | 'Approved' | 'Partly approved' | 'Settled' | 'Rejected';
export type ClaimSource = 'auto' | 'partner' | 'desk';
export const SOURCE_LABEL: Record<ClaimSource, string> = { auto: 'Computed by VinFlux', partner: 'Submitted by partner', desk: 'Entered by our team' };
/** A sale line used by a claim: report id + line index (SCH-04). */
export type LineRef = string;
export interface Claim {
  id: string; no: string; principalId: string; schemeId: string; partnerId: string; partnerName: string; period: string; source: ClaimSource;
  claimedQty: number; claimedAmount: number; verifiedQty: number; computedAmount: number; lines: LineRef[];
  excluded: { reason: string; qty: number }[]; evidence: string; flags: string[];
  status: ClaimStatus; approvedAmount: number | null; overBudgetOk: boolean; enteredBy: string; decidedBy: string | null;
  settlement: { method: Settlement; ref: string; by: string; at: string } | null; history: Hist;
}
type Hist = { at: string; by: string; action: string; note?: string }[];

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const monthEnd = (p: string) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

/* ------------------------------------ Store ------------------------------------ */

interface Db { schemes: ClaimScheme[]; claims: Claim[]; seq: number; seeded: string[] }
const KEY = () => workspaceKey('vinflux.claims.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: loadJson<Db>(KEY(), { schemes: [], claims: [], seq: 500, seeded: [] }) }; return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeClaims = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const claimSchemes = (principalId: string) => db().schemes.filter((s) => s.principalId === principalId);
export const claims = (principalId: string) => db().claims.filter((c) => c.principalId === principalId);
export const getScheme = (id: string) => db().schemes.find((s) => s.id === id) ?? null;
export const getClaim = (id: string) => db().claims.find((c) => c.id === id) ?? null;
type Result = { ok: boolean; message: string; id?: string; errors?: string[] };
const log = <T extends { history: Hist }>(x: T, by: string, action: string, note?: string): T => ({ ...x, history: [...x.history, { at: now(), by, action, note }] });

/* ------------------------------------ Schemes ------------------------------------ */

export const spentOf = (schemeId: string) => db().claims.filter((c) => c.schemeId === schemeId && ['Approved', 'Partly approved', 'Settled'].includes(c.status)).reduce((a, c) => a + (c.approvedAmount ?? 0), 0);
export const committedOf = (schemeId: string) => db().claims.filter((c) => c.schemeId === schemeId && c.status === 'Under review').reduce((a, c) => a + c.computedAmount, 0);

export const saveDraft = (s: ClaimScheme, by: string): Result => {
  const errs: string[] = [];
  if (!s.name.trim()) errs.push('Name is required.');
  if (!s.from || !s.to || s.to < s.from) errs.push('Choose a valid period.');
  if (!s.productIds.length && s.type !== 'DISPLAY') errs.push('Choose at least one product.');
  if (s.type === 'PER_UNIT' && !(s.rate > 0)) errs.push('Rate per unit must be more than zero.');
  if (s.type === 'TARGET' && (!(s.targetValue > 0) || !(s.incentivePct > 0))) errs.push('Target value and incentive % are required.');
  if (s.type === 'DISPLAY' && !(s.rate > 0)) errs.push('Amount per outlet must be more than zero.');
  if (!(s.budget > 0)) errs.push('Budget must be more than zero.');
  if (errs.length) return { ok: false, message: 'Can’t save the scheme.', errors: errs };
  const d = db();
  if (s.id) { const old = getScheme(s.id); if (old && !['Draft', 'Rejected'].includes(old.status)) return { ok: false, message: 'Only a draft can be edited — the scheme is already submitted.' }; commit({ ...d, schemes: d.schemes.map((x) => (x.id === s.id ? log({ ...s, status: 'Draft' }, by, 'Edited') : x)) }); return { ok: true, message: 'Draft saved.', id: s.id }; }
  const seq = d.seq + 1; const n: ClaimScheme = { ...s, id: newId('csch'), code: `SCH-${seq}`, status: 'Draft', makerBy: by, approvedBy: null, history: [{ at: now(), by, action: 'Created' }] };
  commit({ ...d, seq, schemes: [n, ...d.schemes] }); return { ok: true, message: `${n.code} saved as draft.`, id: n.id };
};
export const submitScheme = (id: string, by: string): Result => {
  const s = getScheme(id); if (!s || !['Draft', 'Rejected'].includes(s.status)) return { ok: false, message: 'Nothing to submit.' };
  commit({ ...db(), schemes: db().schemes.map((x) => (x.id === id ? log({ ...x, status: 'Pending approval' }, by, 'Submitted for approval') : x)) });
  return { ok: true, message: `${s.code} sent for approval.` };
};
/** SCH-06: someone other than the maker approves. */
export const decideScheme = (id: string, approve: boolean, by: string, note = ''): Result => {
  const s = getScheme(id); if (!s || s.status !== 'Pending approval') return { ok: false, message: 'Nothing to approve.' };
  if (s.makerBy === by) return { ok: false, message: `You created ${s.code}; another person must approve it (maker-checker).` };
  if (!approve && !note.trim()) return { ok: false, message: 'Give a reason for rejecting.' };
  commit({ ...db(), schemes: db().schemes.map((x) => (x.id === id ? log({ ...x, status: approve ? 'Active' : 'Rejected', approvedBy: approve ? by : null }, by, approve ? 'Approved — scheme is live' : 'Rejected', note) : x)) });
  return { ok: true, message: approve ? `${s.code} approved and live.` : `${s.code} rejected.` };
};
export const closeScheme = (id: string, by: string): Result => {
  const s = getScheme(id); if (!s || s.status !== 'Active') return { ok: false, message: 'Only a live scheme can be closed.' };
  commit({ ...db(), schemes: db().schemes.map((x) => (x.id === id ? log({ ...x, status: 'Closed' }, by, 'Closed') : x)) });
  return { ok: true, message: `${s.code} closed — no new claims.` };
};

/* --------------------------------- Verification --------------------------------- */

/** Lines already used by claims that block this scheme (SCH-04). */
const usedLines = (scheme: ClaimScheme, exceptClaimId?: string) => {
  const set = new Set<string>();
  db().claims.filter((c) => c.status !== 'Rejected' && c.id !== exceptClaimId).forEach((c) => {
    const other = getScheme(c.schemeId);
    if (c.schemeId === scheme.id || (other && (!other.stackable || !scheme.stackable))) c.lines.forEach((l) => set.add(l));
  });
  return set;
};

export interface Verification { qty: number; value: number; amount: number; lines: LineRef[]; excluded: { reason: string; qty: number }[]; achievedPct: number | null }
/**
 * SCH-02: what the partner earned in a month under a scheme, from secondary data that is accepted, reconciled and not estimated.
 * Lines that don't qualify are counted by reason so the partner can see why.
 */
export const verify = (scheme: ClaimScheme, partnerId: string, period: string, principalId: string, exceptClaimId?: string): Verification => {
  const used = usedLines(scheme, exceptClaimId);
  const excluded = new Map<string, number>();
  const ex = (reason: string, qty: number) => excluded.set(reason, (excluded.get(reason) ?? 0) + qty);
  let qty = 0; let value = 0; const lines: LineRef[] = [];
  const reps = secReports(principalId).filter((r) => r.partnerId === partnerId && r.period === period);
  const accepted = reps.filter((r) => r.status === 'Accepted');
  reps.filter((r) => r.status === 'Needs review').forEach((r) => r.sales.filter((s) => scheme.productIds.includes(s.productId)).forEach((s) => ex('Report still under review', s.qty)));
  if (setupOf(partnerId).route === 'none') ex('Partner not connected — estimates never count', 0);
  accepted.forEach((r: SecondaryReport) => {
    r.sales.forEach((s, i) => {
      if (!scheme.productIds.includes(s.productId)) return;
      if (s.date < scheme.from || s.date > scheme.to) { ex('Sold outside the scheme period', s.qty); return; }
      if (scheme.customerTypes.length && !scheme.customerTypes.includes(s.customerType)) { ex(`Sold to ${s.customerType} (scheme is for ${scheme.customerTypes.join(', ')})`, s.qty); return; }
      if (r.scopes && (!r.scopes.stock || !r.scopes.sales)) { ex('Partner shares sales only — can’t be reconciled', s.qty); return; }
      const rec = r.recon.find((x) => x.productId === s.productId);
      if (rec && !rec.ok) { ex('Product did not reconcile for the month', s.qty); return; }
      const ref = `${r.id}#${i}`;
      if (used.has(ref)) { ex('Already claimed (this or a non-stacking scheme)', s.qty); return; }
      qty += s.qty; value += s.value; lines.push(ref);
    });
  });
  let amount = 0; let achievedPct: number | null = null;
  if (scheme.type === 'PER_UNIT') amount = qty * scheme.rate;
  if (scheme.type === 'TARGET') { achievedPct = Math.round((value / scheme.targetValue) * 100); amount = achievedPct >= 100 ? Math.round((value * scheme.incentivePct) / 100) : 0; }
  return { qty, value, amount: Math.round(amount), lines, excluded: [...excluded.entries()].map(([reason, q]) => ({ reason, qty: q })), achievedPct };
};

/* ------------------------------------- Claims ------------------------------------- */

const flagsFor = (c: Pick<Claim, 'claimedAmount' | 'computedAmount' | 'claimedQty' | 'verifiedQty'>, s: ClaimScheme) => {
  const f: string[] = [];
  if (['PER_UNIT', 'TARGET'].includes(s.type) && c.claimedAmount > c.computedAmount) f.push(`Claimed ₹${c.claimedAmount.toLocaleString('en-IN')} but verified data supports ₹${c.computedAmount.toLocaleString('en-IN')} — difference ₹${(c.claimedAmount - c.computedAmount).toLocaleString('en-IN')} (SCH-02).`);
  if (s.type === 'PER_UNIT' && c.claimedQty > c.verifiedQty) f.push(`Claimed ${c.claimedQty} units, ${c.verifiedQty} verified.`);
  const left = s.budget - spentOf(s.id);
  if (Math.min(c.claimedAmount, c.computedAmount || c.claimedAmount) > left) f.push(`Over budget: ₹${left.toLocaleString('en-IN')} left of ₹${s.budget.toLocaleString('en-IN')} (SCH-03).`);
  return f;
};

export interface ClaimInput { principalId: string; schemeId: string; partnerId: string; partnerName: string; period: string; source: ClaimSource; claimedQty: number; claimedAmount: number; evidence: string; by: string }
export const raiseClaim = (n: ClaimInput): Result => {
  const s = getScheme(n.schemeId); const errs: string[] = [];
  if (!s) return { ok: false, message: 'Scheme not found.' };
  if (s.status !== 'Active' && s.status !== 'Closed') errs.push(`${s.code} is ${s.status} — no claims yet.`);
  if (s.partnerIds.length && !s.partnerIds.includes(n.partnerId)) errs.push(`${n.partnerName} is not eligible for ${s.code}.`);
  if (`${n.period}-01` > s.to || monthEnd(n.period) < s.from) errs.push('The month is outside the scheme period.');
  const windowEnd = new Date(Date.parse(s.to) + s.claimWindowDays * 86400000).toISOString().slice(0, 10);
  if (today() > windowEnd) errs.push(`The claim window closed on ${windowEnd}.`);
  if (['DISPLAY', 'PRICE_SUPPORT'].includes(s.type) && !n.evidence.trim()) errs.push(`Evidence is required: ${s.evidence || 'proof of activity'}.`);
  if (!(n.claimedAmount > 0) && n.source !== 'auto') errs.push('Claimed amount must be more than zero.');
  const dup = db().claims.find((c) => c.schemeId === s.id && c.partnerId === n.partnerId && c.period === n.period && c.status !== 'Rejected');
  if (dup && n.source !== 'partner') errs.push(`${dup.no} already covers ${n.partnerName} for ${n.period}.`);
  if (errs.length) return { ok: false, message: 'Can’t raise the claim.', errors: errs };
  const v = verify(s, n.partnerId, n.period, n.principalId, dup?.id);
  const computed = s.type === 'DISPLAY' ? n.claimedQty * s.rate : s.type === 'PRICE_SUPPORT' ? n.claimedAmount : v.amount;
  const base = { claimedQty: n.source === 'auto' ? v.qty : n.claimedQty, claimedAmount: n.source === 'auto' ? computed : n.claimedAmount, verifiedQty: s.type === 'DISPLAY' ? n.claimedQty : v.qty, computedAmount: computed };
  const d = db();
  // A partner's own claim replaces VinFlux's computed one for the same month (keeps one claim per month).
  const claimsKept = dup && n.source === 'partner' && dup.source === 'auto' && dup.status === 'Under review' ? d.claims.filter((c) => c.id !== dup.id) : d.claims;
  if (dup && !(n.source === 'partner' && dup.source === 'auto' && dup.status === 'Under review')) return { ok: false, message: `${dup.no} already covers this month.` };
  const seq = d.seq + 1;
  const c: Claim = { id: newId('clm'), no: `CLM-${seq}`, principalId: n.principalId, schemeId: s.id, partnerId: n.partnerId, partnerName: n.partnerName, period: n.period, source: n.source, ...base, lines: v.lines, excluded: v.excluded, evidence: n.evidence,
    flags: flagsFor(base, s), status: 'Under review', approvedAmount: null, overBudgetOk: false, enteredBy: n.by, decidedBy: null, settlement: null,
    history: [{ at: now(), by: n.by, action: `${SOURCE_LABEL[n.source]}`, note: v.achievedPct !== null ? `Target achieved ${v.achievedPct}%` : undefined }] };
  if (base.computedAmount === 0 && n.source === 'auto') return { ok: false, message: `Nothing earned under ${s.code} for ${n.partnerName} in ${n.period}${v.achievedPct !== null ? ` (target ${v.achievedPct}% achieved)` : ''}.` };
  if (claimsKept !== d.claims && dup) revokeLinks(dup.id, `Claim ${dup.no} was replaced by the partner’s own claim`);
  const link = issueLink('claim-decide', c.id, n.principalId, 'Finance Controller', 72);
  c.history.push({ at: now(), by: 'System', action: 'Approval link sent to Finance Controller', note: link });
  commit({ ...d, seq, claims: [c, ...claimsKept] });
  return { ok: true, message: `${c.no} raised for ${n.partnerName}${c.flags.length ? ` — ${c.flags.length} flag(s)` : ''}.`, id: c.id };
};

/** Period end: compute claims for every eligible partner from verified secondary data. */
export const computeClaims = (principalId: string, schemeId: string, period: string, partners: { id: string; name: string }[], by: string) => {
  const s = getScheme(schemeId); if (!s || !['PER_UNIT', 'TARGET'].includes(s.type)) return { ok: false, message: 'Only secondary-sales and target schemes are computed.' };
  const out: string[] = []; let made = 0;
  partners.filter((p) => !s.partnerIds.length || s.partnerIds.includes(p.id)).forEach((p) => {
    if (db().claims.some((c) => c.schemeId === s.id && c.partnerId === p.id && c.period === period && c.status !== 'Rejected')) return;
    const r = raiseClaim({ principalId, schemeId, partnerId: p.id, partnerName: p.name, period, source: 'auto', claimedQty: 0, claimedAmount: 0, evidence: '', by });
    if (r.ok) made++; else out.push(r.message);
  });
  return { ok: true, message: made ? `${made} claim(s) computed for ${period}.` : `No new claims for ${period}.`, notes: out };
};

/** SCH-06 + SCH-03: approve (fully or partly) by someone other than who entered it; over budget needs an explicit tick. */
export const decideClaim = (id: string, approve: boolean, amount: number, by: string, note: string, overBudget: boolean): Result => {
  const c = getClaim(id); if (!c || c.status !== 'Under review') return { ok: false, message: 'Nothing to decide.' };
  const s = getScheme(c.schemeId)!;
  if (c.source !== 'auto' && c.enteredBy === by) return { ok: false, message: 'You entered this claim; another person must approve it (maker-checker).' };
  if (!approve) { if (!note.trim()) return { ok: false, message: 'Give a reason — the partner sees it.' }; commit({ ...db(), claims: db().claims.map((x) => (x.id === id ? log({ ...x, status: 'Rejected', decidedBy: by }, by, 'Rejected', note) : x)) }); return { ok: true, message: `${c.no} rejected.` }; }
  const cap = ['PER_UNIT', 'TARGET'].includes(s.type) ? c.computedAmount : c.claimedAmount;
  if (!(amount > 0)) return { ok: false, message: 'Approved amount must be more than zero.' };
  if (amount > cap) return { ok: false, message: `Can’t approve more than the verified ₹${cap.toLocaleString('en-IN')}.` };
  const left = s.budget - spentOf(s.id);
  if (amount > left && !overBudget) return { ok: false, message: `Only ₹${left.toLocaleString('en-IN')} budget left — tick “approve over budget” to go ahead (SCH-03).` };
  const status: ClaimStatus = amount < c.claimedAmount ? 'Partly approved' : 'Approved';
  commit({ ...db(), claims: db().claims.map((x) => (x.id === id ? log({ ...x, status, approvedAmount: amount, overBudgetOk: amount > left, decidedBy: by }, by, `${status} ₹${amount.toLocaleString('en-IN')}`, note || (amount > left ? 'Approved over budget' : undefined)) : x)) });
  return { ok: true, message: `${c.no} ${status.toLowerCase()} — ₹${amount.toLocaleString('en-IN')}.` };
};

/** SCH-05: credit note where invoicing lives. VinFlux numbers it; with an ERP the ERP's number is recorded. */
export const settleClaim = (id: string, by: string, erpRef?: string): Result => {
  const c = getClaim(id); if (!c || !['Approved', 'Partly approved'].includes(c.status)) return { ok: false, message: 'Approve the claim first.' };
  const s = getScheme(c.schemeId)!;
  const inVinflux = optChoice('orders', 'invoicing') === 'vinflux';
  if (s.settlement === 'Credit note' && !inVinflux && !erpRef?.trim()) return { ok: false, message: 'Enter the credit note number from your ERP.' };
  const ref = s.settlement !== 'Credit note' ? (erpRef?.trim() || `${s.settlement === 'Payment' ? 'PAY' : 'FG'}-${c.no.slice(4)}`) : inVinflux ? `CN-${new Date().getUTCFullYear()}-${c.no.slice(4)}` : erpRef!.trim();
  commit({ ...db(), claims: db().claims.map((x) => (x.id === id ? log({ ...x, status: 'Settled', settlement: { method: s.settlement, ref, by, at: now() } }, by, `Settled by ${s.settlement.toLowerCase()} ${ref}`) : x)) });
  emit('claim.settled', 'Schemes & Claims', by, `${c.no} settled ${ref}`, { claimId: id, amount: c.approvedAmount });
  return { ok: true, message: `${c.no} settled — ${s.settlement.toLowerCase()} ${ref}.` };
};

/* -------------------------------------- Demo -------------------------------------- */

export const ensureClaimsDemo = (principalId: string, productIds: string[], partners: { id: string; name: string }[]) => {
  const d = db(); if (d.seeded.includes(principalId) || productIds.length < 2 || !partners.length) return;
  const y = new Date().getUTCFullYear(); const q = Math.floor(new Date().getUTCMonth() / 3);
  const qFrom = new Date(Date.UTC(y, q * 3, 1)).toISOString().slice(0, 10); const qTo = new Date(Date.UTC(y, q * 3 + 3, 0)).toISOString().slice(0, 10);
  const mk = (i: number, p: Partial<ClaimScheme>, status: SchemeStatus): ClaimScheme => ({
    id: `csch-${principalId}-${i}`, code: `SCH-${401 + i}`, principalId, name: '', type: 'PER_UNIT', from: qFrom, to: qTo, partnerIds: [], productIds: productIds.slice(0, 2), customerTypes: [],
    rate: 0, targetValue: 0, incentivePct: 0, budget: 500000, stackable: false, claimWindowDays: 45, evidence: '', settlement: 'Credit note',
    status, makerBy: 'Priya Menon', approvedBy: status === 'Active' ? 'Meera Iyer' : null, history: [{ at: now(), by: 'Priya Menon', action: 'Created' }, ...(status === 'Active' ? [{ at: now(), by: 'Meera Iyer', action: 'Approved — scheme is live' }] : [])], ...p,
  });
  const schemes: ClaimScheme[] = [
    mk(0, { name: 'Hospital push — ₹500 per unit sold to hospitals', type: 'PER_UNIT', rate: 500, customerTypes: ['Hospital'], budget: 250000 }, 'Active'),
    mk(1, { name: 'Monthly target — 2% on secondary sales above ₹3 L', type: 'TARGET', targetValue: 300000, incentivePct: 2, productIds: productIds.slice(0, 3), stackable: true, budget: 400000 }, 'Active'),
    mk(2, { name: 'Clinic display stand — ₹5,000 per outlet', type: 'DISPLAY', rate: 5000, productIds: productIds.slice(0, 1), evidence: 'Photo of the stand and the outlet’s stamp', settlement: 'Payment', stackable: true, budget: 100000 }, 'Active'),
    mk(3, { name: 'Tender price support — Govt. hospitals', type: 'PRICE_SUPPORT', evidence: 'Tender award letter and the partner’s invoice to the hospital', budget: 300000 }, 'Pending approval'),
  ];
  cache = { key: KEY(), d: { ...d, schemes: [...schemes, ...d.schemes], seeded: [...d.seeded, principalId] } }; saveJson(KEY(), cache.d);
  const period = today().slice(0, 7);
  partners.forEach((p) => raiseClaim({ principalId, schemeId: schemes[0].id, partnerId: p.id, partnerName: p.name, period, source: 'auto', claimedQty: 0, claimedAmount: 0, evidence: '', by: 'VinFlux (period end)' }));
  // A partner claims more than its verified hospital sales.
  const mine = db().claims.find((c) => c.schemeId === schemes[0].id && c.computedAmount > 0);
  if (mine) raiseClaim({ principalId, schemeId: schemes[0].id, partnerId: mine.partnerId, partnerName: mine.partnerName, period, source: 'partner', claimedQty: mine.verifiedQty + 4, claimedAmount: (mine.verifiedQty + 4) * 500, evidence: 'Hospital invoices attached (4 PDFs)', by: `${mine.partnerName} (portal)` });
  raiseClaim({ principalId, schemeId: schemes[2].id, partnerId: partners[0].id, partnerName: partners[0].name, period, source: 'desk', claimedQty: 3, claimedAmount: 15000, evidence: '3 photos from the field visit on ' + today(), by: 'Kiran Varma' });
};
