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
import { consentAllows, reports as secReports, setupOf } from '../secondary/secondaryStore';
import { balances } from '../inventory/stockStore';
import { allShipments, orders } from '../orders/orderStore';
import { priceLists } from '../pricing/pricingStore';
import type { Product } from '../../types/product';
import type { SecondaryReport } from '../secondary/secondaryStore';

export type SchemeType = 'PER_UNIT' | 'SLAB' | 'FREE_GOODS' | 'TARGET' | 'DISPLAY' | 'PRICE_SUPPORT';
export const TYPE_LABEL: Record<SchemeType, string> = { PER_UNIT: 'Secondary sales (₹ per unit sold)', SLAB: 'Volume slab (% by units sold)', FREE_GOODS: 'Free goods (buy X get Y)', TARGET: 'Target incentive', DISPLAY: 'Display / listing', PRICE_SUPPORT: 'Price support (tender)' };
/** Schemes whose amount is computed from verified secondary sales. */
export const VERIFIED_TYPES: SchemeType[] = ['PER_UNIT', 'SLAB', 'FREE_GOODS', 'TARGET'];
export const TYPE_HINT: Record<SchemeType, string> = {
  PER_UNIT: 'Paid on units the partner sells to its customers, from reconciled secondary sales.',
  SLAB: 'A % of the month’s secondary sales value, by how many units the partner sold (e.g. 20–49 → 3%, 50+ → 5%).',
  FREE_GOODS: 'For every X units the partner sells in the month, Y units free — valued at what the partner sold them for.',
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
  /** SLAB: from units (inclusive) → % of value. */ slabs?: { from: number; pct: number }[];
  /** FREE_GOODS: buy X get Y. */ buy?: number; free?: number;
  /** Partner types (tiers) that may claim; empty = all. */ partnerTypeIds?: string[];
  /** Expected sales uplift % used by the simulation. */ uplift?: number;
  stackable: boolean; claimWindowDays: number; evidence: string; settlement: Settlement;
  status: SchemeStatus; makerBy: string; approvedBy: string | null; history: Hist;
}
export type ClaimStatus = 'Under review' | 'Approved' | 'Partly approved' | 'Settled' | 'Rejected';
export type ClaimSource = 'auto' | 'partner' | 'desk';
export const SOURCE_LABEL: Record<ClaimSource, string> = { auto: 'Computed by VinFlux', partner: 'Submitted by partner', desk: 'Entered by our team' };
/** A sale line used by a claim: report id + line index (SCH-04). */
export type LineRef = string;
/** Claims that are not under a scheme (DMS): checked by rules against stock, deliveries and price lists. */
export type ClaimKind = 'Scheme' | 'Expiry' | 'Damage' | 'Rate difference' | 'Warranty';
export const OTHER_KINDS: Exclude<ClaimKind, 'Scheme'>[] = ['Expiry', 'Damage', 'Rate difference', 'Warranty'];
export const KIND_HINT: Record<Exclude<ClaimKind, 'Scheme'>, string> = {
  Expiry: 'Near-expiry or expired stock the partner holds — checked against its last stock report',
  Damage: 'Goods damaged in transit — within 7 days of delivery, with proof',
  'Rate difference': 'Old stock after your price dropped — difference × units they held',
  Warranty: 'A serialised product that failed in warranty — with a service or surgeon report',
};
export interface ClaimCheck { rule: string; ok: boolean; note?: string }
export const CLAIM_SLA_DAYS = 7;
export interface Claim {
  /** Missing = Scheme. */ kind?: ClaimKind; productId?: string; batch?: string; serial?: string; docRef?: string; checks?: ClaimCheck[];
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
const KIND_CODE: Record<Exclude<ClaimKind, 'Scheme'>, string> = { Expiry: 'EXPIRY', Damage: 'DAMAGE', 'Rate difference': 'RATE-DIFF', Warranty: 'WARRANTY' };
/** Claims without a scheme point at a virtual scheme `kind:<Kind>` (no budget, settled by credit note). */
export const isVirtual = (schemeId: string) => schemeId.startsWith('kind:');
const virtualScheme = (k: Exclude<ClaimKind, 'Scheme'>): ClaimScheme => ({ id: `kind:${k}`, code: KIND_CODE[k], principalId: '', name: `${k} claim`, type: 'PRICE_SUPPORT', from: '2000-01-01', to: '2999-12-31', partnerIds: [], productIds: [], customerTypes: [], rate: 0, targetValue: 0, incentivePct: 0, budget: 0, stackable: true, claimWindowDays: 0, evidence: '', settlement: 'Credit note', status: 'Active', makerBy: '', approvedBy: null, history: [] });
export const getScheme = (id: string) => (isVirtual(id) ? virtualScheme(id.slice(5) as Exclude<ClaimKind, 'Scheme'>) : db().schemes.find((s) => s.id === id) ?? null);
export const kindOf = (c: Claim): ClaimKind => c.kind ?? 'Scheme';
export const claimAge = (c: Claim) => Math.max(0, Math.floor((Date.now() - Date.parse(c.history[0]?.at ?? now())) / 86400000));
export const pastSla = (c: Claim) => c.status === 'Under review' && claimAge(c) > CLAIM_SLA_DAYS;
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
  if (s.type === 'SLAB' && (!s.slabs?.length || s.slabs.some((x) => !(x.from > 0) || !(x.pct > 0)))) errs.push('Every slab needs units from and a % above zero.');
  if (s.type === 'SLAB' && s.slabs && s.slabs.some((x, i) => i > 0 && x.from <= s.slabs![i - 1].from)) errs.push('Slabs must go up in units.');
  if (s.type === 'FREE_GOODS' && (!(Number(s.buy) > 0) || !(Number(s.free) > 0))) errs.push('Enter buy and free units.');
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

export const slabFor = (s: Pick<ClaimScheme, 'slabs'>, units: number) => [...(s.slabs ?? [])].sort((a, b) => b.from - a.from).find((x) => units >= x.from)?.pct ?? 0;
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
  if (scheme.type === 'SLAB') { const sl = slabFor(scheme, qty); amount = (value * sl) / 100; }
  if (scheme.type === 'FREE_GOODS' && qty) { const freeUnits = Math.floor(qty / (scheme.buy || 1)) * (scheme.free || 0); amount = freeUnits * (value / qty); }
  if (scheme.type === 'TARGET') { achievedPct = Math.round((value / scheme.targetValue) * 100); amount = achievedPct >= 100 ? Math.round((value * scheme.incentivePct) / 100) : 0; }
  return { qty, value, amount: Math.round(amount), lines, excluded: [...excluded.entries()].map(([reason, q]) => ({ reason, qty: q })), achievedPct };
};

/* ------------------------------------- Claims ------------------------------------- */

const flagsFor = (c: Pick<Claim, 'claimedAmount' | 'computedAmount' | 'claimedQty' | 'verifiedQty'>, s: ClaimScheme) => {
  const f: string[] = [];
  if (VERIFIED_TYPES.includes(s.type) && c.claimedAmount > c.computedAmount) f.push(`Claimed ₹${c.claimedAmount.toLocaleString('en-IN')} but verified data supports ₹${c.computedAmount.toLocaleString('en-IN')} — difference ₹${(c.claimedAmount - c.computedAmount).toLocaleString('en-IN')} (SCH-02).`);
  if (s.type === 'PER_UNIT' && c.claimedQty > c.verifiedQty) f.push(`Claimed ${c.claimedQty} units, ${c.verifiedQty} verified.`);
  const left = s.budget - spentOf(s.id);
  if (Math.min(c.claimedAmount, c.computedAmount || c.claimedAmount) > left) f.push(`Over budget: ₹${left.toLocaleString('en-IN')} left of ₹${s.budget.toLocaleString('en-IN')} (SCH-03).`);
  return f;
};

export interface ClaimInput { partnerTypeId?: string; principalId: string; schemeId: string; partnerId: string; partnerName: string; period: string; source: ClaimSource; claimedQty: number; claimedAmount: number; evidence: string; by: string }
export const raiseClaim = (n: ClaimInput): Result => {
  const s = getScheme(n.schemeId); const errs: string[] = [];
  if (!s) return { ok: false, message: 'Scheme not found.' };
  if (s.status !== 'Active' && s.status !== 'Closed') errs.push(`${s.code} is ${s.status} — no claims yet.`);
  if (s.partnerIds.length && !s.partnerIds.includes(n.partnerId)) errs.push(`${n.partnerName} is not eligible for ${s.code}.`);
  if (s.partnerTypeIds?.length && n.partnerTypeId && !s.partnerTypeIds.includes(n.partnerTypeId)) errs.push(`${n.partnerName}'s partner type is not eligible for ${s.code}.`);
  if (n.source === 'partner' && setupOf(n.partnerId).onPlatform && !consentAllows(n.partnerId, 'claims')) errs.push(`${n.partnerName} has not shared claims with you (Consent & Data Sharing).`);
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
export const computeClaims = (principalId: string, schemeId: string, period: string, partners: { id: string; name: string; partnerTypeId?: string }[], by: string) => {
  const s = getScheme(schemeId); if (!s || !VERIFIED_TYPES.includes(s.type)) return { ok: false, message: 'Only secondary-sales and target schemes are computed.' };
  const out: string[] = []; let made = 0;
  partners.filter((p) => !s.partnerIds.length || s.partnerIds.includes(p.id)).forEach((p) => {
    if (db().claims.some((c) => c.schemeId === s.id && c.partnerId === p.id && c.period === period && c.status !== 'Rejected')) return;
    if (s.partnerTypeIds?.length && p.partnerTypeId && !s.partnerTypeIds.includes(p.partnerTypeId)) return;
    const r = raiseClaim({ principalId, schemeId, partnerId: p.id, partnerName: p.name, partnerTypeId: p.partnerTypeId, period, source: 'auto', claimedQty: 0, claimedAmount: 0, evidence: '', by });
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
  const cap = VERIFIED_TYPES.includes(s.type) || isVirtual(s.id) ? c.computedAmount : c.claimedAmount;
  if (!(amount > 0)) return { ok: false, message: 'Approved amount must be more than zero.' };
  if (amount > cap) return { ok: false, message: `Can’t approve more than the verified ₹${cap.toLocaleString('en-IN')}.` };
  const left = isVirtual(s.id) ? Infinity : s.budget - spentOf(s.id);
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

/* ------------------------------ Claims without a scheme ------------------------------ */

const addD = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
/** What the partner paid you for a product last (latest order line), else a list-based estimate. */
const partnerPrice = (principalId: string, partnerId: string, productId: string, products: Product[]) => {
  const o = orders().filter((x) => x.principalId === principalId && x.partnerId === partnerId && x.lines.some((l) => l.productId === productId)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const l = o?.lines.find((x) => x.productId === productId);
  if (l?.netUnit) return l.netUnit;
  const p = products.find((x) => x.id === productId); return Math.round((p?.pricingReference?.mrp ?? 0) * 0.6);
};
/** Price drops in the last `days`: an active list version whose previous version had a higher price for the product. */
export const priceDrops = (principalId: string, productId: string, days = 30) => {
  const lists = priceLists().filter((l) => l.principalId === principalId);
  const since = addD(today(), -days);
  return lists.filter((l) => l.status === 'Active' && l.version > 1 && l.validFrom >= since && l.validFrom <= today()).flatMap((l) => {
    const prev = lists.find((x) => x.familyId === l.familyId && x.version === l.version - 1);
    const a = prev?.lines.find((x) => x.productId === productId); const b = l.lines.find((x) => x.productId === productId);
    return a && b && b.price < a.price ? [{ list: l.name, from: l.validFrom, oldPrice: a.price, newPrice: b.price }] : [];
  });
};
export interface OtherClaimInput { principalId: string; kind: Exclude<ClaimKind, 'Scheme'>; partnerId: string; partnerName: string; productId: string; batch: string; serial: string; qty: number; amount: number; docRef: string; evidence: string; source: ClaimSource; by: string }
/** DMS auto-validation: each rule is checked against VinFlux's own records; the supported amount is what the records allow. */
export const checkOtherClaim = (n: OtherClaimInput, products: Product[]): { checks: ClaimCheck[]; supported: number } => {
  const r: ClaimCheck[] = []; const p = products.find((x) => x.id === n.productId);
  const price = n.productId ? partnerPrice(n.principalId, n.partnerId, n.productId, products) : 0;
  const ships = allShipments().filter((x) => x.order.principalId === n.principalId && x.order.partnerId === n.partnerId);
  let supported = 0;
  if (n.kind === 'Expiry') {
    const lim = addD(today(), 90);
    const held = balances().filter((b) => b.warehouseId === n.partnerId && b.productId === n.productId && b.qty > 0 && (b.locType === 'PARTNER' || b.locType === 'CNF') && (!n.batch || b.batch === n.batch));
    const near = held.filter((b) => b.expiryDate && b.expiryDate <= lim).reduce((a, b) => a + b.qty, 0);
    r.push({ rule: 'Product is expiry-tracked', ok: !!p?.trackingRules?.expiryDateRequired || held.some((b) => b.expiryDate), note: p ? undefined : 'Choose the product' });
    r.push({ rule: `Batch was supplied by you`, ok: !n.batch || ships.some((x) => x.shipment.allocations.some((a) => a.batch === n.batch)), note: n.batch ? undefined : 'No batch given — checked on all batches' });
    r.push({ rule: `Quantity ≤ near-expiry stock in their last stock report (${near})`, ok: n.qty > 0 && n.qty <= near, note: near === 0 ? 'No stock expiring within 90 days reported' : undefined });
    r.push({ rule: `Amount ≤ quantity × their price (₹${price.toLocaleString('en-IN')})`, ok: n.amount <= n.qty * price + 1 });
    supported = Math.min(n.qty, near) * price;
  } else if (n.kind === 'Damage') {
    const hit = ships.find((x) => x.shipment.no === n.docRef.trim() || x.shipment.invoiceNo === n.docRef.trim());
    const del = hit?.shipment.deliveredAt?.slice(0, 10) ?? null;
    const sent = hit ? hit.shipment.allocations.filter((a) => a.productId === n.productId).reduce((a, x) => a + x.qty, 0) : 0;
    const rate = hit?.order.lines.find((l) => l.productId === n.productId)?.netUnit ?? price;
    r.push({ rule: 'Delivery reference found (shipment or invoice no.)', ok: !!hit, note: hit ? `${hit.shipment.no} · ${hit.order.code}` : 'No delivery to this partner with that number' });
    r.push({ rule: 'Reported within 7 days of delivery', ok: !!del && addD(del, 7) >= today(), note: del ? `Delivered ${del}` : 'Not delivered yet' });
    r.push({ rule: `Quantity ≤ quantity delivered (${sent})`, ok: n.qty > 0 && n.qty <= sent });
    r.push({ rule: 'Photo or transporter proof attached', ok: !!n.evidence.trim() });
    supported = Math.min(n.qty, sent) * rate;
  } else if (n.kind === 'Rate difference') {
    const d = priceDrops(n.principalId, n.productId)[0];
    const held = balances().filter((b) => b.warehouseId === n.partnerId && b.productId === n.productId && b.qty > 0 && (b.locType === 'PARTNER' || b.locType === 'CNF')).reduce((a, b) => a + b.qty, 0);
    r.push({ rule: 'Your price for this product dropped in the last 30 days', ok: !!d, note: d ? `${d.list}: ₹${d.oldPrice.toLocaleString('en-IN')} → ₹${d.newPrice.toLocaleString('en-IN')} from ${d.from}` : 'No price drop on an approved price list' });
    r.push({ rule: `Quantity ≤ stock they hold (${held})`, ok: n.qty > 0 && n.qty <= held });
    r.push({ rule: 'Amount ≤ quantity × the price difference', ok: !!d && n.amount <= n.qty * (d.oldPrice - d.newPrice) + 1 });
    supported = d ? Math.min(n.qty, held) * (d.oldPrice - d.newPrice) : 0;
  } else {
    const hit = ships.find((x) => x.shipment.allocations.some((a) => a.serial && a.serial === n.serial.trim()));
    const del = hit?.shipment.deliveredAt?.slice(0, 10) ?? null;
    r.push({ rule: 'Serial was supplied to this partner', ok: !!hit, note: hit ? `${hit.shipment.no}` : n.serial ? 'Serial not found on any delivery to them' : 'Enter the serial' });
    r.push({ rule: 'Within warranty (12 months from delivery)', ok: !!del && addD(del, 365) >= today(), note: del ? `Delivered ${del}` : undefined });
    r.push({ rule: 'Service or surgeon report attached', ok: !!n.evidence.trim() });
    supported = hit ? Math.min(n.amount, price) : 0;
  }
  return { checks: r, supported: Math.round(supported) };
};
export const raiseOtherClaim = (n: OtherClaimInput, products: Product[]): Result => {
  const errs: string[] = [];
  if (!n.partnerId) errs.push('Choose the partner.');
  if (!n.productId) errs.push('Choose the product.');
  if (n.kind !== 'Warranty' && !(n.qty > 0)) errs.push('Quantity must be more than zero.');
  if (!(n.amount > 0)) errs.push('Amount claimed must be more than zero.');
  if (n.kind === 'Damage' && !n.docRef.trim()) errs.push('Enter the shipment or invoice number.');
  if (n.kind === 'Warranty' && !n.serial.trim()) errs.push('Enter the serial number.');
  if (n.source === 'partner' && setupOf(n.partnerId).onPlatform && !consentAllows(n.partnerId, 'claims')) errs.push(`${n.partnerName} has not shared claims with you (Consent & Data Sharing).`);
  if (errs.length) return { ok: false, message: 'Can’t raise the claim.', errors: errs };
  const { checks, supported } = checkOtherClaim(n, products);
  const d = db(); const seq = d.seq + 1;
  const c: Claim = {
    kind: n.kind, productId: n.productId, batch: n.batch || undefined, serial: n.serial || undefined, docRef: n.docRef || undefined, checks,
    id: newId('clm'), no: `CLM-${seq}`, principalId: n.principalId, schemeId: `kind:${n.kind}`, partnerId: n.partnerId, partnerName: n.partnerName, period: today().slice(0, 7), source: n.source,
    claimedQty: n.qty, claimedAmount: n.amount, verifiedQty: checks.every((x) => x.ok) ? n.qty : 0, computedAmount: Math.min(n.amount, supported), lines: [], excluded: [], evidence: n.evidence,
    flags: checks.filter((x) => !x.ok).map((x) => `Check failed: ${x.rule}${x.note ? ` — ${x.note}` : ''}`), status: 'Under review', approvedAmount: null, overBudgetOk: false, enteredBy: n.by, decidedBy: null, settlement: null,
    history: [{ at: now(), by: n.by, action: `${n.kind} claim ${SOURCE_LABEL[n.source].toLowerCase()}`, note: `${checks.filter((x) => x.ok).length}/${checks.length} checks passed` }],
  };
  commit({ ...d, seq, claims: [c, ...d.claims] });
  return { ok: true, message: `${c.no} raised — ${checks.filter((x) => x.ok).length}/${checks.length} checks passed.`, id: c.id };
};

/* ------------------------------------ Simulation ------------------------------------ */

export interface Simulation { partners: number; months: number; baseUnits: number; baseValue: number; projValue: number; cost: number; incremental: number; roi: number | null; note: string | null }
/**
 * Before publishing: expected cost and return from the last 3 months of verified secondary sales of the scheme's
 * products at eligible partners, grown by the expected uplift. ROI = extra sales value ÷ scheme cost.
 */
export const simulate = (s: ClaimScheme, principalId: string, partners: { id: string; partnerTypeId: string }[]): Simulation => {
  const eligible = partners.filter((p) => (!s.partnerIds.length || s.partnerIds.includes(p.id)) && (!s.partnerTypeIds?.length || s.partnerTypeIds.includes(p.partnerTypeId)));
  const ids = new Set(eligible.map((p) => p.id));
  const m3: string[] = []; { const x = new Date(); for (let i = 1; i <= 3; i++) { const d = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() - i, 1)); m3.push(d.toISOString().slice(0, 7)); } }
  const per = new Map<string, { units: number; value: number }>();
  secReports(principalId).filter((r) => r.status === 'Accepted' && ids.has(r.partnerId) && (m3.includes(r.period) || r.period === today().slice(0, 7))).forEach((r) => r.sales.forEach((x) => {
    if (!s.productIds.includes(x.productId)) return; if (s.customerTypes.length && !s.customerTypes.includes(x.customerType)) return;
    const k = r.partnerId; const v = per.get(k) ?? { units: 0, value: 0 }; v.units += x.qty; v.value += x.value; per.set(k, v);
  }));
  const months = Math.max(1, Math.round((Date.parse(s.to) - Date.parse(s.from)) / (30.4 * 86400000)));
  const span = 3; const up = 1 + (s.uplift ?? 10) / 100;
  let baseUnits = 0; let baseValue = 0; let cost = 0;
  per.forEach((v) => {
    const u = v.units / span; const val = v.value / span; baseUnits += u; baseValue += val;
    const pu = u * up; const pv = val * up; let c = 0;
    if (s.type === 'PER_UNIT') c = pu * s.rate;
    if (s.type === 'SLAB') c = (pv * slabFor(s, pu)) / 100;
    if (s.type === 'FREE_GOODS') c = Math.floor(pu / (s.buy || 1)) * (s.free || 0) * (pu ? pv / pu : 0);
    if (s.type === 'TARGET') c = pv >= s.targetValue ? (pv * s.incentivePct) / 100 : 0;
    cost += c * months;
  });
  if (s.type === 'DISPLAY') cost = eligible.length * s.rate;
  const projValue = baseValue * up * months; const incremental = baseValue * (up - 1) * months;
  const note = s.type === 'PRICE_SUPPORT' ? 'Price support depends on tender outcomes — no forecast.' : per.size === 0 && s.type !== 'DISPLAY' ? 'No verified secondary sales of these products at eligible partners in the last 3 months.' : null;
  return { partners: eligible.length, months, baseUnits: Math.round(baseUnits), baseValue: Math.round(baseValue), projValue: Math.round(projValue), cost: Math.round(cost), incremental: Math.round(incremental), roi: cost > 0 ? Math.round((incremental / cost) * 10) / 10 : null, note };
};

/** Demo: one claim of each kind, so the checks show both passing and failing rules. */
export const ensureOtherClaimsDemo = (principalId: string, products: Product[], partners: { id: string; name: string }[]) => {
  const d = db(); const tag = `other:${principalId}`; if (d.seeded.includes(tag) || !partners.length || !products.length) return;
  cache = { key: KEY(), d: { ...d, seeded: [...d.seeded, tag] } }; saveJson(KEY(), cache.d);
  const ids = new Set(partners.map((p) => p.id)); const pn = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const near = balances().filter((b) => ids.has(b.warehouseId) && b.qty > 0 && b.expiryDate && b.expiryDate <= addD(today(), 90) && (b.locType === 'PARTNER' || b.locType === 'CNF'))[0];
  if (near) raiseOtherClaim({ principalId, kind: 'Expiry', partnerId: near.warehouseId, partnerName: pn(near.warehouseId), productId: near.productId, batch: near.batch, serial: '', qty: Math.min(near.qty, 4), amount: Math.min(near.qty, 4) * partnerPrice(principalId, near.warehouseId, near.productId, products), docRef: '', evidence: 'Stock list with batch and expiry', source: 'partner', by: `${pn(near.warehouseId)} (portal)` }, products);
  const sh = allShipments().filter((x) => x.order.principalId === principalId && ids.has(x.order.partnerId) && x.shipment.deliveredAt)[0];
  if (sh) { const a = sh.shipment.allocations[0]; raiseOtherClaim({ principalId, kind: 'Damage', partnerId: sh.order.partnerId, partnerName: sh.order.partnerName, productId: a.productId, batch: a.batch, serial: a.serial ?? '', qty: 1, amount: sh.order.lines.find((l) => l.productId === a.productId)?.netUnit ?? 0, docRef: sh.shipment.no, evidence: 'Photos of the crushed carton; LR remark by the transporter', source: 'partner', by: `${sh.order.partnerName} (portal)` }, products); }
  const p0 = partners[0]; const prod = products[0];
  raiseOtherClaim({ principalId, kind: 'Rate difference', partnerId: p0.id, partnerName: p0.name, productId: prod.id, batch: '', serial: '', qty: 10, amount: 12000, docRef: '', evidence: 'Old stock after the October price change', source: 'desk', by: 'Kiran Varma' }, products);
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
