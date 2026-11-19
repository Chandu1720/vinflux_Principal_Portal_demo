/**
 * Tenders and channel agreements (IN2).
 * Tenders: register → price approved → bid submitted → won / lost / cancelled → award (contract quantities, validity,
 * supplying partner, performance guarantee) → rate contract. TND-01 a won tender becomes a rate contract only after a
 * second person approves its prices. TND-02 deposit and guarantee expiry reminders 30 days ahead.
 * Agreements: distributor / dealer, C&F, consignment, contract manufacturing — with territories, products, targets, credit
 * terms, exclusivity, validity and signed copy. TND-03 renewal reminders (default 60 days). TND-04 an expired agreement
 * warns or blocks new orders per setting. TND-05 amendments create a new version with effective dates.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import type { Product } from '../../types/product.ts';
import { approveList, blankList, getList, saveDraft, submitList } from '../pricing/pricingStore';
import type { Check, Order } from '../orders/orderStore';

export type Portal = 'GeM' | 'State medical corporation' | 'Hospital tender' | 'PSU / Railways' | 'Other';
export type TenderStatus = 'Registered' | 'Bid submitted' | 'Won' | 'Lost' | 'Cancelled' | 'Awarded';
export interface TenderLine { productId: string; name: string; qty: number; offeredPrice: number }
export interface Tender {
  id: string; no: string; principalId: string; buyer: string; buyerPartnerId: string | null; tenderNo: string; portal: Portal;
  lines: TenderLine[]; dueDate: string; prebidDate: string | null; docs: string[];
  emd: { amount: number; mode: 'DD' | 'BG' | 'Online' | 'Exempt (MSE)'; expiry: string | null; refund: 'Not due' | 'Pending' | 'Refunded' | 'Forfeited' };
  priceApprovedBy: string | null; status: TenderStatus;
  outcome: { winningPrice: number | null; winner: string; reason: string } | null;
  award: { validFrom: string; validTo: string; supplyingPartnerId: string | null; pbg: { amount: number; expiry: string | null } | null; contractQty: Record<string, number>; markedBy: string; approvedBy: string | null; rateContractId: string | null } | null;
  createdBy: string; createdAt: string; history: { at: string; by: string; action: string; note?: string }[];
}
export type AgreementType = 'Distributor' | 'Dealer' | 'C&F' | 'Consignment' | 'Contract manufacturing';
export interface AgreementVersion { v: number; from: string; to: string; terms: string; by: string; at: string }
export interface Agreement {
  id: string; no: string; principalId: string; type: AgreementType; partyId: string; partyName: string;
  territories: string[]; products: string; targets: string; creditTerms: string; exclusivity: boolean; extra: string;
  from: string; to: string; signedCopy: string | null; version: number; versions: AgreementVersion[];
  createdBy: string; history: { at: string; by: string; action: string; note?: string }[];
}
export interface TenderSettings { renewalDays: number; expiredAgreement: 'warn' | 'block' | 'off'; reminderDays: number }
interface Db { tenders: Tender[]; agreements: Agreement[]; settings: TenderSettings; seq: number; seeded: string[] }

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
const KEY = () => workspaceKey('vinflux.tenders.v1');
const EMPTY: Db = { tenders: [], agreements: [], settings: { renewalDays: 60, expiredAgreement: 'warn', reminderDays: 30 }, seq: 500, seeded: [] };
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) {
    const x = loadJson<Partial<Db> | null>(KEY(), null);
    cache = { key: KEY(), d: { ...EMPTY, ...(x ?? {}), tenders: Array.isArray(x?.tenders) ? x!.tenders : [], agreements: Array.isArray(x?.agreements) ? x!.agreements : [], settings: { ...EMPTY.settings, ...(x?.settings ?? {}) }, seeded: Array.isArray(x?.seeded) ? x!.seeded : [] } };
  }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeTenders = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
type R = { ok: boolean; message: string; errors?: string[] };

export const tenderSettings = () => db().settings;
export const saveTenderSettings = (s: TenderSettings) => commit({ ...db(), settings: s });
export const tenders = (principalId: string) => db().tenders.filter((t) => t.principalId === principalId);
export const getTender = (id: string) => db().tenders.find((t) => t.id === id) ?? null;
const putT = (t: Tender) => { const d = db(); commit({ ...d, tenders: d.tenders.some((x) => x.id === t.id) ? d.tenders.map((x) => (x.id === t.id ? t : x)) : [t, ...d.tenders] }); };
const logT = (t: Tender, by: string, action: string, note?: string): Tender => ({ ...t, history: [...t.history, { at: now(), by, action, note }] });

export const blankTender = (principalId: string, by: string): Tender => ({
  id: '', no: '', principalId, buyer: '', buyerPartnerId: null, tenderNo: '', portal: 'GeM', lines: [], dueDate: addDays(today(), 14), prebidDate: null, docs: [],
  emd: { amount: 0, mode: 'Online', expiry: null, refund: 'Not due' }, priceApprovedBy: null, status: 'Registered', outcome: null, award: null, createdBy: by, createdAt: now(), history: [],
});
export const saveTender = (t: Tender, by: string): R & { id?: string } => {
  const errs: string[] = [];
  if (!t.buyer.trim()) errs.push('Who is the buyer?');
  if (!t.tenderNo.trim()) errs.push('Tender number is required.');
  if (!t.lines.length) errs.push('Add at least one product.');
  t.lines.forEach((l, i) => { if (!(l.qty > 0)) errs.push(`Line ${i + 1}: quantity must be more than 0.`); });
  if (errs.length) return { ok: false, message: 'Can’t save the tender.', errors: errs };
  if (!t.id) {
    const d = db(); const seq = d.seq + 1;
    const rec = logT({ ...t, id: newId('tnd'), no: `TN-26-${seq}` }, by, 'Tender registered', `${t.portal} ${t.tenderNo}`);
    commit({ ...d, seq, tenders: [rec, ...d.tenders] });
    return { ok: true, message: `${rec.no} registered.`, id: rec.id };
  }
  const old = getTender(t.id)!;
  const priceChanged = old.lines.some((l, i) => l.offeredPrice !== t.lines[i]?.offeredPrice) || old.lines.length !== t.lines.length;
  putT(logT({ ...t, priceApprovedBy: priceChanged && old.status === 'Registered' ? null : t.priceApprovedBy }, by, 'Edited', priceChanged && old.priceApprovedBy ? 'Prices changed — approval needed again' : undefined));
  return { ok: true, message: 'Tender saved.', id: t.id };
};
/** Internal approval of the bid price — by someone other than who registered or last priced it. */
export const approveBidPrice = (id: string, by: string): R => {
  const t = getTender(id); if (!t || t.status !== 'Registered') return { ok: false, message: 'Only a registered tender’s prices can be approved.' };
  const pricer = [...t.history].reverse().find((h) => h.action === 'Edited' || h.action === 'Tender registered')?.by;
  if (pricer === by) return { ok: false, message: 'Maker-checker: you priced this bid, so someone else must approve it.' };
  if (t.lines.some((l) => !(l.offeredPrice > 0))) return { ok: false, message: 'Every line needs an offered price.' };
  putT(logT({ ...t, priceApprovedBy: by }, by, 'Bid prices approved'));
  return { ok: true, message: 'Bid prices approved — the bid can be submitted.' };
};
export const submitBid = (id: string, by: string): R => {
  const t = getTender(id); if (!t || t.status !== 'Registered') return { ok: false, message: 'Not a registered tender.' };
  if (!t.priceApprovedBy) return { ok: false, message: 'Get the bid prices approved first.' };
  putT(logT({ ...t, status: 'Bid submitted', emd: { ...t.emd, refund: t.emd.amount ? 'Pending' : 'Not due' } }, by, 'Bid submitted', t.emd.amount ? `EMD ₹${t.emd.amount.toLocaleString('en-IN')} (${t.emd.mode})` : undefined));
  return { ok: true, message: `${t.no} bid submitted.` };
};
export const recordOutcome = (id: string, result: 'Won' | 'Lost' | 'Cancelled', o: { winningPrice: number | null; winner: string; reason: string }, by: string): R => {
  const t = getTender(id); if (!t || t.status !== 'Bid submitted') return { ok: false, message: 'Record the outcome after the bid is submitted.' };
  if (result === 'Lost' && !o.winner.trim()) return { ok: false, message: 'Who won? (helps price the next bid)' };
  putT(logT({ ...t, status: result, outcome: o, emd: result === 'Won' ? t.emd : { ...t.emd, refund: t.emd.amount ? 'Pending' : 'Not due' } }, by, result, [o.winner && `winner ${o.winner}`, o.winningPrice ? `₹${o.winningPrice.toLocaleString('en-IN')}` : '', o.reason].filter(Boolean).join(' · ') || undefined));
  return { ok: true, message: `${t.no} marked ${result.toLowerCase()}.` };
};
/** Award details for a won tender (contract quantities, validity, supplying partner, performance guarantee). */
export const setAward = (id: string, a: NonNullable<Tender['award']>, by: string): R => {
  const t = getTender(id); if (!t || !['Won', 'Awarded'].includes(t.status)) return { ok: false, message: 'Only a won tender can be awarded.' };
  if (t.award?.rateContractId) return { ok: false, message: 'Already converted to a rate contract — revise the contract in Price Lists.' };
  if (!a.validFrom || !a.validTo || a.validTo < a.validFrom) return { ok: false, message: 'Give a valid contract period.' };
  putT(logT({ ...t, award: { ...a, markedBy: by, approvedBy: null, rateContractId: null } }, by, 'Award details recorded', `${a.validFrom} → ${a.validTo}`));
  return { ok: true, message: 'Award recorded — a second person approves the prices to create the rate contract.' };
};
/** TND-01: second person approves the awarded prices → active rate contract for the buyer, with contracted quantities. */
export const approveAward = (id: string, by: string, products: Product[]): R => {
  const t = getTender(id); if (!t || !t.award) return { ok: false, message: 'Record the award first.' };
  if (t.award.rateContractId) return { ok: false, message: 'Already converted.' };
  if (t.award.markedBy === by || t.createdBy === by) return { ok: false, message: 'Maker-checker: someone other than who registered the tender or recorded the award must approve the prices.' };
  if (!t.buyerPartnerId) return { ok: false, message: 'Link the buyer to a hospital / institution partner first — the rate contract is for that buyer.' };
  const l = blankList('CONTRACT', t.principalId, t.award.markedBy);
  const list = { ...l, name: `${t.buyer} — ${t.portal} ${t.tenderNo}`, code: `RC-${t.no}`, partnerIds: [t.buyerPartnerId], validFrom: t.award.validFrom, validTo: t.award.validTo, contractRef: `${t.portal} ${t.tenderNo}`,
    committedValue: t.lines.reduce((a, x) => a + (t.award!.contractQty[x.productId] ?? x.qty) * x.offeredPrice, 0), notes: `Awarded tender ${t.no}. Contract quantities: ${t.lines.map((x) => `${x.name} ${t.award!.contractQty[x.productId] ?? x.qty}`).join(', ')}.`,
    lines: t.lines.map((x) => ({ id: newId('pll'), productId: x.productId, price: x.offeredPrice, slabs: [], contractQty: t.award!.contractQty[x.productId] ?? x.qty })) };
  saveDraft(list, t.award.markedBy);
  const sub = submitList(getList(list.id)!, t.award.markedBy, products, `From tender ${t.no}`);
  if (!sub.ok) return { ok: false, message: 'The rate contract couldn’t be created.', errors: sub.errors ?? [sub.message] };
  const ap = approveList(list.id, by, products, `Tender ${t.no} prices approved`);
  if (!ap.ok) return { ok: false, message: ap.message, errors: ap.errors };
  putT(logT({ ...t, status: 'Awarded', award: { ...t.award, approvedBy: by, rateContractId: list.id } }, by, 'Prices approved → rate contract created', list.code));
  emit('tender.awarded', 'Tenders', by, `${t.no} → rate contract ${list.code}`, { tenderId: t.id, listId: list.id });
  return { ok: true, message: `Rate contract ${list.code} is active from ${t.award.validFrom}. Orders from ${t.buyer} now get the tender price.` };
};
export const setEmdRefund = (id: string, refund: Tender['emd']['refund'], by: string) => { const t = getTender(id); if (t) putT(logT({ ...t, emd: { ...t.emd, refund } }, by, `EMD ${refund.toLowerCase()}`)); };

/* -------------------------------- Agreements -------------------------------- */

export const agreements = (principalId: string) => db().agreements.filter((a) => a.principalId === principalId);
export const getAgreement = (id: string) => db().agreements.find((a) => a.id === id) ?? null;
export type AgreementState = 'Active' | 'Expiring' | 'Expired' | 'Not started';
export const stateOf = (a: Agreement): AgreementState => {
  const t = today(); if (a.from > t) return 'Not started'; if (a.to < t) return 'Expired';
  return a.to <= addDays(t, db().settings.renewalDays) ? 'Expiring' : 'Active';
};
const termsText = (a: Agreement) => [a.territories.length ? `Territories: ${a.territories.join(', ')}` : '', a.products && `Products: ${a.products}`, a.targets && `Targets: ${a.targets}`, a.creditTerms && `Credit: ${a.creditTerms}`, a.exclusivity ? 'Exclusive' : 'Non-exclusive', a.extra].filter(Boolean).join(' · ');
export const blankAgreement = (principalId: string, by: string): Agreement => ({
  id: '', no: '', principalId, type: 'Distributor', partyId: '', partyName: '', territories: [], products: 'All', targets: '', creditTerms: '', exclusivity: false, extra: '',
  from: today(), to: addDays(today(), 365), signedCopy: null, version: 1, versions: [], createdBy: by, history: [],
});
export const saveAgreement = (a: Agreement, by: string): R => {
  const errs: string[] = [];
  if (!a.partyId) errs.push('Choose the partner or vendor.');
  if (!a.from || !a.to || a.to < a.from) errs.push('Give a valid period (to on or after from).');
  if (errs.length) return { ok: false, message: 'Can’t save the agreement.', errors: errs };
  const d = db();
  if (!a.id) {
    const seq = d.seq + 1;
    const rec: Agreement = { ...a, id: newId('agr'), no: `AG-26-${seq}`, versions: [{ v: 1, from: a.from, to: a.to, terms: termsText(a), by, at: now() }], history: [{ at: now(), by, action: 'Agreement created', note: `${a.from} → ${a.to}` }] };
    commit({ ...d, seq, agreements: [rec, ...d.agreements] });
    return { ok: true, message: `${rec.no} saved.` };
  }
  commit({ ...d, agreements: d.agreements.map((x) => (x.id === a.id ? { ...a, history: [...a.history, { at: now(), by, action: 'Edited' }] } : x)) });
  return { ok: true, message: 'Agreement saved.' };
};
/** TND-05: an amendment or renewal is a new version from its effective date; earlier versions stay for past orders. */
export const amendAgreement = (id: string, changes: Partial<Agreement>, effectiveFrom: string, by: string, note: string): R => {
  const a = getAgreement(id); if (!a) return { ok: false, message: 'Agreement not found.' };
  if (!effectiveFrom) return { ok: false, message: 'When does the change take effect?' };
  const next: Agreement = { ...a, ...changes, version: a.version + 1, from: effectiveFrom };
  if (next.to < next.from) return { ok: false, message: 'The new end date is before the effective date.' };
  const versions = [...a.versions.map((v) => (v.v === a.version && v.to >= effectiveFrom ? { ...v, to: addDays(effectiveFrom, -1) } : v)), { v: next.version, from: next.from, to: next.to, terms: termsText(next), by, at: now() }];
  const d = db();
  commit({ ...d, agreements: d.agreements.map((x) => (x.id === id ? { ...next, versions, history: [...a.history, { at: now(), by, action: `Version ${next.version} from ${effectiveFrom}`, note: note || undefined }] } : x)) });
  return { ok: true, message: `${a.no} version ${next.version} takes effect ${effectiveFrom}.` };
};
/** The agreement in force for a partner today (latest version), if any. */
export const agreementFor = (principalId: string, partyId: string) => agreements(principalId).filter((a) => a.partyId === partyId && a.type !== 'Contract manufacturing').sort((x, y) => (x.to < y.to ? 1 : -1))[0] ?? null;

/** TND-04: order check — expired (or missing) agreement warns or blocks per setting. */
export const agreementCheck = (o: Order): Check | null => {
  const mode = db().settings.expiredAgreement; if (mode === 'off') return null;
  const a = agreementFor(o.principalId, o.partnerId);
  if (!a) return null; // no agreement on file is not a failure
  const st = stateOf(a);
  if (st === 'Expired') return { id: 'agreement', label: 'Channel agreement', state: mode === 'block' ? 'fail' : 'warn', detail: `${a.type} agreement ${a.no} expired on ${a.to} — renew it in Tenders & Agreements` };
  if (st === 'Expiring') return { id: 'agreement', label: 'Channel agreement', state: 'pass', detail: `${a.no} valid until ${a.to} (renewal due)` };
  return { id: 'agreement', label: 'Channel agreement', state: 'pass', detail: `${a.no} valid until ${a.to}` };
};

/** Reminders: TND-02 deposits and guarantees (30 days), TND-03 agreement renewals (60 days). */
export interface Reminder { kind: 'EMD' | 'Performance guarantee' | 'Renewal' | 'Bid due' | 'Pre-bid'; ref: string; refId: string; text: string; date: string; overdue: boolean }
export const reminders = (principalId: string): Reminder[] => {
  const s = db().settings; const t = today(); const out: Reminder[] = [];
  tenders(principalId).forEach((x) => {
    if (x.status === 'Registered' && x.dueDate <= addDays(t, 7)) out.push({ kind: 'Bid due', ref: x.no, refId: x.id, text: `${x.buyer} — bid due`, date: x.dueDate, overdue: x.dueDate < t });
    if (x.status === 'Registered' && x.prebidDate && x.prebidDate >= t && x.prebidDate <= addDays(t, 7)) out.push({ kind: 'Pre-bid', ref: x.no, refId: x.id, text: `${x.buyer} — pre-bid meeting`, date: x.prebidDate, overdue: false });
    if (x.emd.expiry && x.emd.refund !== 'Refunded' && x.emd.refund !== 'Forfeited' && x.emd.expiry <= addDays(t, s.reminderDays)) out.push({ kind: 'EMD', ref: x.no, refId: x.id, text: `EMD ₹${x.emd.amount.toLocaleString('en-IN')} (${x.emd.mode}) — ${x.status === 'Lost' || x.status === 'Cancelled' ? 'claim refund' : 'extend or claim'}`, date: x.emd.expiry, overdue: x.emd.expiry < t });
    if (x.award?.pbg?.expiry && x.award.pbg.expiry <= addDays(t, s.reminderDays)) out.push({ kind: 'Performance guarantee', ref: x.no, refId: x.id, text: `Performance guarantee ₹${x.award.pbg.amount.toLocaleString('en-IN')} — extend before expiry`, date: x.award.pbg.expiry, overdue: x.award.pbg.expiry < t });
  });
  agreements(principalId).forEach((a) => { const st = stateOf(a); if (st === 'Expiring' || st === 'Expired') out.push({ kind: 'Renewal', ref: a.no, refId: a.id, text: `${a.type} agreement — ${a.partyName}`, date: a.to, overdue: st === 'Expired' }); });
  return out.sort((x, y) => (x.date < y.date ? -1 : 1));
};

export const ensureTendersDemo = (principalId: string, hospitals: { id: string; name: string }[], partners: { id: string; name: string; type: AgreementType }[], products: Product[], by: string) => {
  const d = db(); if (d.seeded.includes(principalId) || !products.length) return;
  commit({ ...d, seeded: [...d.seeded, principalId] });
  const ps = products.slice(0, 3); const t = today();
  const mk = (buyer: string, buyerId: string | null, portal: Portal, no: string, due: number, emd: number) => {
    const r = saveTender({ ...blankTender(principalId, 'Ravi Kumar'), buyer, buyerPartnerId: buyerId, tenderNo: no, portal, dueDate: addDays(t, due), prebidDate: due > 5 ? addDays(t, 3) : null,
      lines: ps.map((p, i) => ({ productId: p.id, name: p.name, qty: 50 - i * 15, offeredPrice: Math.round((p.pricingReference?.mrp ?? 20000) * (0.62 - i * 0.03)) })),
      emd: { amount: emd, mode: emd ? 'BG' : 'Exempt (MSE)', expiry: emd ? addDays(t, 25) : null, refund: 'Not due' } }, 'Ravi Kumar');
    return r.id!;
  };
  mk(hospitals[0]?.name ?? 'NIMS Hyderabad', hospitals[0]?.id ?? null, 'Hospital tender', 'NIMS/ORTHO/2026/114', 9, 50000);
  const b = mk('Telangana State Medical Services & Infrastructure Corp.', null, 'State medical corporation', 'TSMSIDC/IMP/26-27/09', 2, 200000);
  approveBidPrice(b, 'Meera Iyer'); submitBid(b, 'Ravi Kumar');
  const c = mk(hospitals[1]?.name ?? 'AIIMS Bibinagar', hospitals[1]?.id ?? hospitals[0]?.id ?? null, 'GeM', 'GEM/2026/B/5583921', -10, 0);
  approveBidPrice(c, 'Meera Iyer'); submitBid(c, 'Ravi Kumar'); recordOutcome(c, 'Won', { winningPrice: null, winner: 'Biorad Medisys', reason: 'L1 on all lines' }, 'Ravi Kumar');
  setAward(c, { validFrom: t, validTo: addDays(t, 365), supplyingPartnerId: partners[0]?.id ?? null, pbg: { amount: 150000, expiry: addDays(t, 20) }, contractQty: {}, markedBy: 'Ravi Kumar', approvedBy: null, rateContractId: null }, 'Ravi Kumar');
  partners.slice(0, 4).forEach((p, i) => saveAgreement({ ...blankAgreement(principalId, by), type: p.type, partyId: p.id, partyName: p.name, territories: [], products: i === 2 ? 'Trauma and spine' : 'All', targets: i < 2 ? '₹1.2 Cr per year' : '', creditTerms: i === 1 ? '45 days, limit ₹25 L' : '30 days',
    exclusivity: i === 0, from: addDays(t, -360 + i * 20), to: i === 0 ? addDays(t, 40) : i === 3 ? addDays(t, -5) : addDays(t, 200 + i * 30), signedCopy: `${p.name.split(' ')[0]}-agreement-signed.pdf` }, by));
};
