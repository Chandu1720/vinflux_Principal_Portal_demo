/**
 * Distributor invitations (DMS onboarding): invite by GSTIN → the distributor signs up on VinFlux and uploads KYC →
 * you verify each document → agreement (territory, brands, credit, margin) sent for e-sign → signed → linked.
 *
 * The distributor becomes a partner in Go-to-Market as soon as it signs up (a draft with its KYC documents), so
 * territories, sales policy and approvals stay where they already are. "Linked" = agreement signed + partner Active.
 * INTEGRATION POINT: invite e-mail and sign-up link from the distributor platform; e-sign by an eSign provider (Aadhaar / DSC).
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { readDb, mutateDb } from '../gtm-v2/services/mockDb';
import { gstService } from '../gtm-v2/services/gstService';
import type { GstVerification, KycDocument, Partner } from '../gtm-v2/types';
import { agreementFor, saveAgreement, blankAgreement, getAgreement } from '../tenders/tendersStore';
import { ALL_SCOPES, requestConsent, respondConsent, setOnPlatform } from '../secondary/secondaryStore';

export type InviteStage = 'Invited' | 'Signed up' | 'Agreement sent' | 'Signed' | 'Cancelled';
export interface Terms { territory: string; brands: string; creditLimit: number; marginPct: number; paymentDays: number; from: string; to: string }
export interface Invite {
  id: string; no: string; principalId: string; gstin: string; gst: GstVerification; name: string; contact: string; email: string; phone: string; partnerTypeId: string;
  stage: InviteStage; partnerId: string | null; terms: Terms | null; agreementId: string | null; signedBy: string | null; signedAt: string | null; link: string;
  history: { at: string; by: string; action: string; note?: string }[];
}
interface Db { invites: Invite[]; seq: number; seeded: string[] }
const KEY = () => workspaceKey('vinflux.invites.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => { if (!cache || cache.key !== KEY()) { const x = loadJson<Partial<Db>>(KEY(), {}); cache = { key: KEY(), d: { invites: Array.isArray(x.invites) ? x.invites : [], seq: x.seq ?? 100, seeded: x.seeded ?? [] } }; } return cache.d; };
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeInvites = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
type R = { ok: boolean; message: string; errors?: string[]; id?: string };
const put = (i: Invite, by: string, action: string, note?: string) => commit({ ...db(), invites: db().invites.map((x) => (x.id === i.id ? { ...i, history: [...i.history, { at: now(), by, action, note }] } : x)) });

export const invites = (principalId: string) => db().invites.filter((i) => i.principalId === principalId);
export const getInvite = (id: string) => db().invites.find((i) => i.id === id) ?? null;
export const partnerOf = (i: Invite): Partner | null => (i.partnerId ? readDb().partners.find((p) => p.id === i.partnerId) ?? null : null);
/** KYC documents the partner type must provide (from Go-to-Market configuration). */
export const requiredDocs = (partnerTypeId: string) => readDb().config.kycDocuments.filter((k) => k.status === 'Active' && k.mandatoryForPartnerTypeIds.includes(partnerTypeId));

export type Step = 'Invited' | 'KYC' | 'Setup' | 'Agreement' | 'Linked';
/** Where the invitation stands, derived from the invite, the partner's KYC and status, and the agreement. */
export const stepOf = (i: Invite): { step: Step; n: number; label: string; tone: 'slate' | 'amber' | 'blue' | 'green' | 'red' } => {
  if (i.stage === 'Cancelled') return { step: 'Invited', n: 0, label: 'Cancelled', tone: 'red' };
  if (i.stage === 'Invited') return { step: 'Invited', n: 1, label: 'Waiting for sign-up', tone: 'slate' };
  const p = partnerOf(i);
  const docs = p?.kycDocuments ?? [];
  if (docs.some((d) => d.status !== 'Verified')) return { step: 'KYC', n: 2, label: docs.some((d) => d.status === 'Rejected') ? 'KYC — document rejected' : 'KYC to verify', tone: 'amber' };
  if (i.stage === 'Signed up') return { step: 'Agreement', n: 3, label: 'Send agreement', tone: 'blue' };
  if (i.stage === 'Agreement sent') return { step: 'Agreement', n: 3, label: 'Agreement out for e-sign', tone: 'amber' };
  if (p?.status !== 'Active') return { step: 'Setup', n: 3, label: 'Signed — finish setup in Partners', tone: 'blue' };
  return { step: 'Linked', n: 4, label: 'Linked & sharing data', tone: 'green' };
};

/** Invite by GSTIN: the registry gives the legal name, state and PAN; the distributor gets a sign-up link. */
export const invite = async (principalId: string, gstin: string, f: { contact: string; email: string; phone: string; partnerTypeId: string }, by: string): Promise<R> => {
  const errs: string[] = [];
  if (!f.contact.trim()) errs.push('Who is the contact person?');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.push('Enter a valid e-mail — the invitation goes there.');
  if (!f.partnerTypeId) errs.push('Choose the partner type.');
  const g = gstin.trim().toUpperCase();
  if (readDb().partners.some((p) => p.gst.toUpperCase() === g)) errs.push(`A partner with GSTIN ${g} already exists.`);
  if (invites(principalId).some((i) => i.gstin === g && i.stage !== 'Cancelled')) errs.push(`${g} is already invited.`);
  if (errs.length) return { ok: false, message: 'Can’t invite yet.', errors: errs };
  let gst: GstVerification;
  try { gst = await gstService.verify(g, by); } catch (e) { return { ok: false, message: (e as Error).message, errors: [(e as Error).message] }; }
  if (gst.status !== 'Active') return { ok: false, message: `GST registration is ${gst.status} — can’t invite.`, errors: [`GST registration is ${gst.status}.`] };
  const d = db(); const seq = d.seq + 1; const id = newId('inv');
  const link = `https://app.vinflux.in/join/${id.slice(-10)}`;
  const i: Invite = { id, no: `INV-NW-${seq}`, principalId, gstin: g, gst, name: gst.tradeName || gst.legalName, contact: f.contact.trim(), email: f.email.trim(), phone: f.phone.trim(), partnerTypeId: f.partnerTypeId,
    stage: 'Invited', partnerId: null, terms: null, agreementId: null, signedBy: null, signedAt: null, link, history: [{ at: now(), by, action: `Invited ${gst.tradeName || gst.legalName}`, note: `GSTIN ${g} verified (${gst.state}) · sign-up link sent to ${f.email.trim()}` }] };
  commit({ ...d, seq, invites: [i, ...d.invites] });
  emit('partner.invited', 'Network', by, `${i.name} invited`, { inviteId: id });
  return { ok: true, message: `${i.name} invited — sign-up link sent to ${i.email}.`, id };
};

/**
 * The distributor signs up (simulated here): it becomes a draft partner in Go-to-Market with its KYC documents, and
 * shares its data with you from its VinFlux account (it can change that any time in Consent & Data Sharing).
 */
export const simulateSignUp = (id: string, share = true): R => {
  const i = getInvite(id); if (!i || i.stage !== 'Invited') return { ok: false, message: 'Nothing to sign up.' };
  const reqs = requiredDocs(i.partnerTypeId);
  const by = `${i.contact} (${i.name})`;
  const partnerId = mutateDb(['partners'], (d) => {
    let n = d.partners.length + 1; let code = `PTR-${String(n).padStart(4, '0')}`;
    while (d.partners.some((p) => p.code === code)) code = `PTR-${String(++n).padStart(4, '0')}`;
    const docs: KycDocument[] = reqs.map((r, k) => ({ id: newId('kyc'), docTypeId: r.id, fileName: `${r.name.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, fileSize: 180000 + k * 23000, uploadedAt: now(), status: 'Under Review', remarks: 'Uploaded at sign-up',
      ...(r.tracksExpiry ? { documentNo: `${i.gst.stateCode}-${2000 + k}/20B`, validUntil: `${new Date().getUTCFullYear() + 3}-03-31` } : {}) }));
    const p: Partner = {
      id: newId('ptr'), code, name: i.name, partnerTypeId: i.partnerTypeId, contactPerson: i.contact, email: i.email, phone: i.phone, businessName: i.gst.legalName,
      address: i.gst.address, gst: i.gstin, pan: i.gst.pan, gstVerification: i.gst, kycStatus: 'Under Review', kycDocuments: docs, territoryIds: [], flowIds: [], status: 'KYC Pending',
      submittedAt: null, activatedAt: null, draftStep: 1, onboarding: { flowSelections: [], commercialOverride: null }, createdAt: now(), createdBy: by, updatedAt: now(), updatedBy: by,
    } as Partner;
    d.partners.push(p); return p.id;
  });
  setOnPlatform(partnerId, true);
  if (share) { requestConsent(partnerId, ALL_SCOPES, 'VinFlux (invitation)'); respondConsent(partnerId, true, by, { ...ALL_SCOPES, cases: false }, 'masked', null); }
  put({ ...i, stage: 'Signed up', partnerId }, by, 'Signed up on VinFlux', `${reqs.length} KYC document(s) uploaded${share ? ' · shares catalogue, orders, sales, stock and claims' : ''}`);
  return { ok: true, message: `${i.name} signed up — ${reqs.length} document(s) to verify.` };
};

/** Verify or reject one KYC document (a rejection needs a reason the distributor sees). */
export const verifyDoc = (id: string, docId: string, ok: boolean, by: string, reason = ''): R => {
  const i = getInvite(id); const p = i && partnerOf(i); if (!i || !p) return { ok: false, message: 'Not signed up yet.' };
  if (!ok && !reason.trim()) return { ok: false, message: 'Give a reason — the distributor sees it.' };
  mutateDb(['partners'], (d) => {
    const x = d.partners.find((q) => q.id === p.id)!;
    x.kycDocuments = x.kycDocuments.map((k) => (k.id === docId ? { ...k, status: ok ? 'Verified' : 'Rejected', remarks: ok ? `Verified by ${by}` : reason } : k));
    x.kycStatus = x.kycDocuments.every((k) => k.status === 'Verified') ? 'Verified' : x.kycDocuments.some((k) => k.status === 'Rejected') ? 'Rejected' : 'Under Review';
    x.updatedAt = now(); x.updatedBy = by;
  });
  const name = readDb().config.kycDocuments.find((k) => k.id === p.kycDocuments.find((x) => x.id === docId)?.docTypeId)?.name ?? 'Document';
  put(i, by, `${name} ${ok ? 'verified' : 'rejected'}`, ok ? undefined : reason);
  return { ok: true, message: `${name} ${ok ? 'verified' : 'rejected'}.` };
};
/** Demo: the distributor uploads a fresh copy of a rejected document. */
export const reupload = (id: string, docId: string): R => {
  const i = getInvite(id); const p = i && partnerOf(i); if (!i || !p) return { ok: false, message: 'Not signed up yet.' };
  mutateDb(['partners'], (d) => { const x = d.partners.find((q) => q.id === p.id)!; x.kycDocuments = x.kycDocuments.map((k) => (k.id === docId ? { ...k, status: 'Under Review', uploadedAt: now(), remarks: 'Re-uploaded' } : k)); x.kycStatus = 'Under Review'; });
  put(i, `${i.contact} (${i.name})`, 'Re-uploaded a document');
  return { ok: true, message: 'New copy uploaded — verify it again.' };
};

/** Agreement with territory, brands, credit and margin goes out for e-sign; it is kept in Tenders & Agreements. */
export const sendAgreement = (id: string, t: Terms, by: string): R => {
  const i = getInvite(id); const p = i && partnerOf(i);
  if (!i || !p) return { ok: false, message: 'Not signed up yet.' };
  if (p.kycDocuments.some((k) => k.status !== 'Verified')) return { ok: false, message: 'Verify every KYC document first.' };
  const errs: string[] = [];
  if (!t.territory.trim()) errs.push('Territory is required.');
  if (!(t.creditLimit > 0)) errs.push('Credit limit must be more than zero.');
  if (!(t.marginPct > 0) || t.marginPct > 60) errs.push('Margin must be between 0 and 60%.');
  if (!t.from || !t.to || t.to < t.from) errs.push('Give a valid agreement period.');
  if (errs.length) return { ok: false, message: 'Can’t send the agreement.', errors: errs };
  const a = { ...blankAgreement(i.principalId, by), type: 'Distributor' as const, partyId: p.id, partyName: p.name, territories: [t.territory], products: t.brands || 'All',
    creditTerms: `₹${t.creditLimit.toLocaleString('en-IN')} limit · ${t.paymentDays} days`, extra: `Margin ${t.marginPct}% · sent for e-sign`, from: t.from, to: t.to };
  const r = saveAgreement(a, by); if (!r.ok) return r;
  const ag = agreementFor(i.principalId, p.id);
  put({ ...i, stage: 'Agreement sent', terms: t, agreementId: ag?.id ?? null }, by, `Agreement ${ag?.no ?? ''} sent for e-sign`, `${t.territory} · ${t.brands || 'all brands'} · ₹${t.creditLimit.toLocaleString('en-IN')} credit · ${t.marginPct}% margin · ${t.paymentDays} days`);
  return { ok: true, message: `Agreement ${ag?.no ?? ''} sent to ${i.contact} for e-sign.` };
};

/** The distributor e-signs (simulated): the signed copy is attached to the agreement. */
export const simulateESign = (id: string): R => {
  const i = getInvite(id); if (!i || i.stage !== 'Agreement sent') return { ok: false, message: 'No agreement waiting for signature.' };
  const by = `${i.contact} (${i.name})`; const ref = `ES-${Date.now().toString().slice(-8)}`;
  const a = i.agreementId ? getAgreement(i.agreementId) : null;
  if (a) saveAgreement({ ...a, signedCopy: `E-signed by ${i.contact} on ${today()} (Aadhaar eSign ${ref})`, extra: a.extra.replace(' · sent for e-sign', '') }, by);
  put({ ...i, stage: 'Signed', signedBy: i.contact, signedAt: now() }, by, 'Agreement e-signed', `Aadhaar eSign ${ref}`);
  const p = partnerOf(i);
  if (p?.status === 'Active') emit('partner.linked', 'Network', by, `${i.name} linked`, { partnerId: p.id });
  return { ok: true, message: p?.status === 'Active' ? `${i.name} signed — linked to your network.` : `${i.name} signed. Finish territories and sales policy in Partners to activate it.` };
};
export const cancelInvite = (id: string, by: string, reason: string): R => {
  const i = getInvite(id); if (!i || ['Signed', 'Cancelled'].includes(i.stage)) return { ok: false, message: 'Can’t cancel this one.' };
  if (!reason.trim()) return { ok: false, message: 'Give a reason.' };
  put({ ...i, stage: 'Cancelled' }, by, 'Invitation cancelled', reason);
  return { ok: true, message: 'Invitation cancelled.' };
};

/** Demo: one fresh invitation and one that has signed up with documents to verify. */
export const ensureInviteDemo = async (principalId: string) => {
  const d = db(); if (d.seeded.includes(principalId)) return;
  commit({ ...d, seeded: [...d.seeded, principalId] });
  const types = readDb().config.partnerTypes; const dist = types.find((t) => /distributor/i.test(t.name)) ?? types[0]; if (!dist) return;
  const taken = new Set(readDb().partners.map((p) => p.gst.toUpperCase()));
  const free = ['37AAJFV4821K1ZR', '29AAGCG7310P1Z4', '36AAECC5521M1ZK', '27AAFCB9076Q1ZT'].filter((g) => !taken.has(g));
  if (free[0]) await invite(principalId, free[0], { contact: 'Srinivas Rao', email: 'srinivas@vijayaortho.example', phone: '+91 98480 22110', partnerTypeId: dist.id }, 'Ravi Kumar');
  if (free[1]) { const r = await invite(principalId, free[1], { contact: 'Prakash Hegde', email: 'prakash@gangasurgicals.example', phone: '+91 98450 77889', partnerTypeId: dist.id }, 'Ravi Kumar'); if (r.id) simulateSignUp(r.id); }
};
