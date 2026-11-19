/**
 * Sales CRM (CR1) — the principal's own sales team: leads, opportunities, activities, targets.
 *
 *   Lead:        New ─► Contacted ─► Qualified ─► Converted   (or Disqualified, with a reason)
 *   Opportunity: Prospecting ─► Requirement ─► Proposal ─► Negotiation ─► Won   (or Lost, with a reason)
 *
 * Rules
 *   CRM-01 Every lead and opportunity has one owner; reassignment is logged.
 *   CRM-02 Converting a lead links (or starts onboarding of) the partner / hospital; a won opportunity can become an order.
 *   CRM-03 Adding a lead checks for duplicates by phone, email, GSTIN, and name + city.
 *   CRM-04 Lost and disqualified records need a reason from the principal's list.
 *   CRM-05 An open record with no activity for N days (default 14) is flagged to its owner and manager.
 *   CRM-06 Leads come from the web, the field app, file upload, or a website form (open interface).
 *   CRM-07 A salesperson sees their own records; a manager sees the team's.
 * INTEGRATION POINT: /crm/leads, /crm/opportunities, /crm/activities (REST); website form → POST /crm/leads.
 */
import type { IndustryPackId } from '../../types/product.ts';
import { emit } from '../../platform/events';
import { optChoice } from '../../platform/moduleOptions';
import { loadJson, newId, saveJson } from '../../platform/store';
import { currentWorkspace, workspaceKey } from '../../platform/workspace';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Disqualified';
export type OppStage = 'Prospecting' | 'Requirement' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
export type ActivityKind = 'Call' | 'Visit' | 'Email' | 'Meeting' | 'Demo' | 'Task';
export type LeadSource = 'Field visit' | 'Referral' | 'Exhibition' | 'Website' | 'Phone' | 'Partner' | 'File upload';

export const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Disqualified'];
export const OPEN_STAGES: OppStage[] = ['Prospecting', 'Requirement', 'Proposal', 'Negotiation'];
export const STAGES: OppStage[] = [...OPEN_STAGES, 'Won', 'Lost'];
export const STAGE_PROB: Record<OppStage, number> = { Prospecting: 10, Requirement: 30, Proposal: 50, Negotiation: 75, Won: 100, Lost: 0 };
export const SOURCES: LeadSource[] = ['Field visit', 'Referral', 'Exhibition', 'Website', 'Phone', 'Partner', 'File upload'];
export const ACTIVITY_KINDS: ActivityKind[] = ['Call', 'Visit', 'Email', 'Meeting', 'Demo', 'Task'];

/** Lead types differ by industry; the workflow does not. */
export const LEAD_TYPES: Record<IndustryPackId, string[]> = {
  'medical-devices': ['Hospital', 'Surgeon', 'Dealer', 'Prospective distributor'],
  agri: ['Dealer', 'Retailer', 'Farmer group', 'Prospective distributor'],
  automotive: ['Workshop', 'Fleet', 'Retailer', 'Prospective distributor'],
  electronics: ['Builder / project', 'Architect', 'Retailer', 'Prospective distributor'],
  general: ['Customer', 'Dealer', 'Prospective distributor'],
};
export const leadTypes = () => LEAD_TYPES[currentWorkspace()] ?? LEAD_TYPES.general;

type Hist = { at: string; by: string; action: string; note?: string }[];
export interface Lead {
  id: string; no: string; principalId: string;
  name: string; type: string; contactPerson: string; phone: string; email: string; gst: string; city: string;
  source: LeadSource; interest: string; estValue: number;
  ownerId: string; ownerName: string;
  status: LeadStatus; reason: string | null;
  partnerId: string | null; partnerName: string | null; oppId: string | null;
  createdAt: string; createdBy: string; lastActivityAt: string; closedAt: string | null; history: Hist;
}
export interface Opportunity {
  id: string; no: string; principalId: string;
  title: string; account: string; partnerId: string | null; leadId: string | null;
  products: string; value: number; closeDate: string; stage: OppStage; probability: number;
  ownerId: string; ownerName: string; reason: string | null; orderRef: string | null;
  createdAt: string; lastActivityAt: string; closedAt: string | null; history: Hist;
}
export interface Activity {
  id: string; refType: 'lead' | 'opp'; refId: string; kind: ActivityKind; note: string;
  due: string | null; done: boolean; at: string; by: string; ownerId: string;
}
export interface Target { ownerId: string; period: string; leads: number; conversions: number; value: number }
export interface CrmSettings { lostReasons: string[]; disqualifyReasons: string[] }

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const dayIn = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000));

/* ------------------------------------ Seed ------------------------------------ */

const SEED_NAMES: Record<IndustryPackId, [string, string, string][]> = {
  'medical-devices': [
    ['KIMS Hospitals, Secunderabad', 'Hospital', 'Hyderabad'], ['Dr. P. Srinivas (Ortho)', 'Surgeon', 'Vijayawada'], ['Apollo Spectra, Kondapur', 'Hospital', 'Hyderabad'],
    ['Sai Surgicals', 'Dealer', 'Guntur'], ['Medline Distributors', 'Prospective distributor', 'Visakhapatnam'], ['Care Hospitals, Banjara Hills', 'Hospital', 'Hyderabad'],
    ['Dr. M. Lakshmi (Spine)', 'Surgeon', 'Warangal'], ['Sri Venkateswara Medicals', 'Dealer', 'Tirupati'],
  ],
  agri: [['Raithu Agro Centre', 'Dealer', 'Kurnool'], ['Green Fields FPO', 'Farmer group', 'Nalgonda'], ['Kisan Seva Kendra', 'Retailer', 'Anantapur'], ['Deccan Agri Distributors', 'Prospective distributor', 'Hyderabad']],
  automotive: [['Speed Auto Works', 'Workshop', 'Pune'], ['TransIndia Fleet', 'Fleet', 'Mumbai'], ['Ganesh Auto Spares', 'Retailer', 'Nashik'], ['Western Parts Distributors', 'Prospective distributor', 'Pune']],
  electronics: [['My Home Constructions', 'Builder / project', 'Hyderabad'], ['Studio Arc Architects', 'Architect', 'Bengaluru'], ['Electro World', 'Retailer', 'Chennai'], ['Southern Electricals', 'Prospective distributor', 'Bengaluru']],
  general: [['Acme Traders', 'Customer', 'Delhi'], ['Prime Distributors', 'Prospective distributor', 'Delhi']],
};
const seed = (principalId: string, owners: { id: string; name: string }[]): Db => {
  const ws = currentWorkspace();
  const names = SEED_NAMES[ws] ?? SEED_NAMES.general;
  const o = (i: number) => owners[i % Math.max(owners.length, 1)] ?? { id: 'system', name: 'System' };
  const statuses: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Contacted', 'Qualified', 'Disqualified', 'New'];
  const leads: Lead[] = names.map(([name, type, city], i) => ({
    id: `lead-${i + 1}`, no: `LD-${String(1001 + i)}`, principalId, name, type, city, contactPerson: type === 'Surgeon' ? name : 'Purchase manager', phone: `+91 98${String(4810000 + i * 1371).slice(0, 8)}`, email: '', gst: '',
    source: SOURCES[i % 5], interest: ws === 'medical-devices' ? (i % 2 ? 'Knee implants' : 'Trauma plates & screws') : 'Product range', estValue: [800000, 250000, 1200000, 300000, 2000000, 900000, 150000, 400000][i % 8],
    ownerId: o(i).id, ownerName: o(i).name, status: statuses[i % 8], reason: statuses[i % 8] === 'Disqualified' ? 'No budget' : null,
    partnerId: null, partnerName: null, oppId: null, createdAt: daysAgo(30 - i * 3), createdBy: o(i).name, lastActivityAt: daysAgo([2, 5, 20, 1, 16, 3, 9, 0][i % 8]), closedAt: null,
    history: [{ at: daysAgo(30 - i * 3), by: o(i).name, action: 'Lead added' }],
  }));
  const opps: Opportunity[] = [
    ['Rate contract — knee implants FY27', 0, 'Negotiation', 4200000, 12], ['First case — revision TKR', 1, 'Proposal', 350000, 6], ['Trauma range trial', 2, 'Requirement', 900000, 25],
    ['Dealer appointment', 3, 'Prospecting', 600000, 40], ['Spine implants evaluation', 6, 'Won', 750000, -5], ['Arthroscopy consumables', 5, 'Lost', 300000, -12],
  ].map(([title, li, stage, value, d], i) => {
    const l = leads[(li as number) % leads.length];
    return {
      id: `opp-${i + 1}`, no: `OP-${2001 + i}`, principalId, title: ws === 'medical-devices' ? (title as string) : `${l.interest} — ${l.name}`, account: l.name, partnerId: null, leadId: l.id,
      products: l.interest, value: value as number, closeDate: dayIn(d as number), stage: stage as OppStage, probability: STAGE_PROB[stage as OppStage],
      ownerId: l.ownerId, ownerName: l.ownerName, reason: stage === 'Lost' ? 'Price' : null, orderRef: null,
      createdAt: daysAgo(25 - i * 3), lastActivityAt: daysAgo([1, 4, 18, 22, 6, 12][i]), closedAt: ['Won', 'Lost'].includes(stage as string) ? daysAgo(5) : null,
      history: [{ at: daysAgo(25 - i * 3), by: l.ownerName, action: 'Opportunity created' }],
    };
  });
  const acts: Activity[] = [
    { id: 'act-1', refType: 'opp', refId: 'opp-1', kind: 'Meeting', note: 'Price negotiation with purchase committee', due: dayIn(0), done: false, at: daysAgo(1), by: opps[0].ownerName, ownerId: opps[0].ownerId },
    { id: 'act-2', refType: 'lead', refId: 'lead-1', kind: 'Call', note: 'Follow up on product catalogue', due: dayIn(-2), done: false, at: daysAgo(3), by: leads[0].ownerName, ownerId: leads[0].ownerId },
    { id: 'act-3', refType: 'opp', refId: 'opp-2', kind: 'Demo', note: 'Instrument set demo for the surgeon', due: dayIn(2), done: false, at: daysAgo(2), by: opps[1].ownerName, ownerId: opps[1].ownerId },
    { id: 'act-4', refType: 'lead', refId: 'lead-2', kind: 'Visit', note: 'Met at clinic, interested in trial', due: null, done: true, at: daysAgo(5), by: leads[1].ownerName, ownerId: leads[1].ownerId },
  ];
  const period = today().slice(0, 7);
  const targets: Target[] = owners.slice(0, 4).map((x) => ({ ownerId: x.id, period, leads: 6, conversions: 2, value: 3000000 }));
  return { leads, opps, acts, targets, seq: 100, settings: { lostReasons: ['Price', 'Competitor product', 'No budget', 'Timing', 'Lost to existing supplier', 'Other'], disqualifyReasons: ['No budget', 'Not our segment', 'Duplicate', 'Could not reach', 'Other'] } };
};

/* ------------------------------------ Store ------------------------------------ */

interface Db { leads: Lead[]; opps: Opportunity[]; acts: Activity[]; targets: Target[]; seq: number; settings: CrmSettings }
const KEY = () => workspaceKey('vinflux.crm.v1');
let cache: { key: string; d: Record<string, Db> } | null = null;
const listeners = new Set<() => void>();
const all = () => { if (!cache || cache.key !== KEY()) cache = { key: KEY(), d: loadJson<Record<string, Db>>(KEY(), {}) }; return cache.d; };
let principal = '';
/** Select the principal (seeding demo data once per principal). */
export const ensureCrm = (principalId: string, owners: { id: string; name: string }[]) => {
  principal = principalId;
  if (!all()[principalId]) { cache!.d = { ...all(), [principalId]: seed(principalId, owners) }; saveJson(KEY(), cache!.d); }
};
const db = (): Db => all()[principal] ?? { leads: [], opps: [], acts: [], targets: [], seq: 100, settings: { lostReasons: ['Other'], disqualifyReasons: ['Other'] } };
const commit = (d: Db) => { cache = { key: KEY(), d: { ...all(), [principal]: d } }; saveJson(KEY(), cache.d); listeners.forEach((l) => l()); };
export const subscribeCrm = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const leads = () => db().leads;
export const opps = () => db().opps;
export const activities = () => db().acts;
export const targets = () => db().targets;
export const crmSettings = () => db().settings;
export const getLead = (id: string) => db().leads.find((x) => x.id === id) ?? null;
export const getOpp = (id: string) => db().opps.find((x) => x.id === id) ?? null;
export const saveCrmSettings = (s: CrmSettings) => commit({ ...db(), settings: s });
export const saveTarget = (t: Target) => commit({ ...db(), targets: [...db().targets.filter((x) => !(x.ownerId === t.ownerId && x.period === t.period)), t] });

type Result = { ok: boolean; message: string; errors?: string[]; id?: string };
const log = <T extends { history: Hist }>(x: T, by: string, action: string, note?: string): T => ({ ...x, history: [...x.history, { at: now(), by, action, note }] });

/** CRM-05: open and no activity for `staleDays`. */
export const staleDays = () => Number(optChoice('crm', 'staleDays')) || 14;
export const isStale = (x: { lastActivityAt: string }, open: boolean) => open && daysSince(x.lastActivityAt) >= staleDays();
export const leadOpen = (l: Lead) => !['Converted', 'Disqualified'].includes(l.status);
export const oppOpen = (o: Opportunity) => OPEN_STAGES.includes(o.stage);

/* ------------------------------------ Leads ------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const digits = (s: string) => s.replace(/\D/g, '').slice(-10);
/** CRM-03: possible duplicates of a new lead (also against partners already onboarded). */
export const duplicatesOf = (l: Pick<Lead, 'name' | 'city' | 'phone' | 'email' | 'gst'>, partners: { id: string; name: string; phone: string; email: string; gst: string; address: { city: string } }[] = [], exceptId?: string) => {
  const hits: string[] = [];
  const same = (a: { name: string; city: string; phone: string; email: string; gst: string }) => {
    if (l.phone && digits(a.phone) && digits(a.phone) === digits(l.phone)) return 'same phone';
    if (l.email && a.email && a.email.toLowerCase() === l.email.toLowerCase()) return 'same email';
    if (l.gst && a.gst && a.gst.toUpperCase() === l.gst.toUpperCase()) return 'same GSTIN';
    if (norm(a.name) === norm(l.name) && norm(a.city) === norm(l.city)) return 'same name and city';
    return null;
  };
  if (exceptId !== 'partners-only') db().leads.filter((x) => x.id !== exceptId).forEach((x) => { const w = same(x); if (w) hits.push(`Lead ${x.no} ${x.name} (${w}, owner ${x.ownerName})`); });
  partners.forEach((p) => { const w = same({ ...p, city: p.address.city }); if (w) hits.push(`Partner ${p.name} is already onboarded (${w})`); });
  return hits;
};

export type NewLead = Pick<Lead, 'name' | 'type' | 'contactPerson' | 'phone' | 'email' | 'gst' | 'city' | 'source' | 'interest' | 'estValue' | 'ownerId' | 'ownerName'>;
export const addLead = (n: NewLead, by: string, opts: { allowDuplicate?: boolean; partners?: Parameters<typeof duplicatesOf>[1] } = {}): Result => {
  const errs: string[] = [];
  if (!n.name.trim()) errs.push('Name is required.');
  if (!n.phone.trim() && !n.email.trim()) errs.push('Give a phone number or an email.');
  if (!n.ownerId) errs.push('Choose the owner.');
  if (errs.length) return { ok: false, message: 'Can’t add the lead.', errors: errs };
  const dups = duplicatesOf(n, opts.partners);
  if (dups.length && !opts.allowDuplicate) return { ok: false, message: 'Possible duplicate.', errors: dups.map((d) => `Possible duplicate: ${d}`) };
  const d = db(); const seq = d.seq + 1;
  const l: Lead = { ...n, id: newId('lead'), no: `LD-${seq + 1000}`, principalId: principal, status: 'New', reason: null, partnerId: null, partnerName: null, oppId: null, createdAt: now(), createdBy: by, lastActivityAt: now(), closedAt: null, history: [{ at: now(), by, action: 'Lead added', note: dups.length ? `Added despite possible duplicate: ${dups.join('; ')}` : `Source: ${n.source}` }] };
  commit({ ...d, seq, leads: [l, ...d.leads] });
  emit('crm.lead.added', 'Sales CRM', by, `${l.no} ${l.name} added`, { leadId: l.id });
  return { ok: true, message: `${l.no} added for ${l.ownerName}.`, id: l.id };
};
const putLead = (l: Lead) => commit({ ...db(), leads: db().leads.map((x) => (x.id === l.id ? l : x)) });
export const updateLead = (id: string, patch: Partial<NewLead>, by: string): Result => {
  const l = getLead(id); if (!l) return { ok: false, message: 'Lead not found.' };
  putLead(log({ ...l, ...patch }, by, 'Details updated')); return { ok: true, message: 'Saved.' };
};
export const setLeadStatus = (id: string, status: LeadStatus, by: string, reason?: string): Result => {
  const l = getLead(id); if (!l) return { ok: false, message: 'Lead not found.' };
  if (status === 'Disqualified' && !reason) return { ok: false, message: 'Choose a reason (CRM-04).' };
  if (status === 'Converted') return { ok: false, message: 'Use Convert.' };
  putLead(log({ ...l, status, reason: reason ?? null, lastActivityAt: now(), closedAt: status === 'Disqualified' ? now() : null }, by, `Status → ${status}`, reason));
  return { ok: true, message: `${l.no} is ${status}.` };
};
/** CRM-01: reassign with a log entry. */
export const reassign = (kind: 'lead' | 'opp', id: string, owner: { id: string; name: string }, by: string): Result => {
  if (kind === 'lead') { const l = getLead(id); if (!l) return { ok: false, message: 'Not found.' }; putLead(log({ ...l, ownerId: owner.id, ownerName: owner.name }, by, `Reassigned ${l.ownerName} → ${owner.name}`)); }
  else { const o = getOpp(id); if (!o) return { ok: false, message: 'Not found.' }; putOpp(log({ ...o, ownerId: owner.id, ownerName: owner.name }, by, `Reassigned ${o.ownerName} → ${owner.name}`)); }
  return { ok: true, message: `Reassigned to ${owner.name}.` };
};
/**
 * CRM-02: convert a lead. Links an existing partner / hospital (or marks onboarding started) and
 * optionally opens an opportunity, without re-typing.
 */
export const convertLead = (id: string, link: { partnerId: string | null; partnerName: string | null; onboarding: boolean }, opp: { title: string; value: number; closeDate: string } | null, by: string): Result => {
  const l = getLead(id); if (!l) return { ok: false, message: 'Lead not found.' };
  if (!leadOpen(l)) return { ok: false, message: `${l.no} is already ${l.status}.` };
  if (!link.partnerId && !link.onboarding) return { ok: false, message: 'Link the partner / hospital, or start its onboarding.' };
  let d = db(); let oppId: string | null = null;
  if (opp) {
    const seq = d.seq + 1; oppId = newId('opp');
    const o: Opportunity = { id: oppId, no: `OP-${seq + 2000}`, principalId: principal, title: opp.title || (l.interest ? `${l.interest} — ${l.name}` : `First order — ${l.name}`), account: link.partnerName ?? l.name, partnerId: link.partnerId, leadId: l.id, products: l.interest, value: opp.value, closeDate: opp.closeDate, stage: 'Prospecting', probability: STAGE_PROB.Prospecting, ownerId: l.ownerId, ownerName: l.ownerName, reason: null, orderRef: null, createdAt: now(), lastActivityAt: now(), closedAt: null, history: [{ at: now(), by, action: `Opportunity created from lead ${l.no}` }] };
    d = { ...d, seq, opps: [o, ...d.opps] };
  }
  const nl = log({ ...l, status: 'Converted' as LeadStatus, partnerId: link.partnerId, partnerName: link.partnerName, oppId, closedAt: now(), lastActivityAt: now() }, by, 'Converted', link.partnerId ? `Linked to ${link.partnerName}` : 'Partner onboarding started');
  commit({ ...d, leads: d.leads.map((x) => (x.id === id ? nl : x)) });
  emit('crm.lead.converted', 'Sales CRM', by, `${l.no} converted`, { leadId: id, partnerId: link.partnerId, oppId });
  return { ok: true, message: `${l.no} converted${oppId ? ' and an opportunity opened' : ''}.`, id: oppId ?? undefined };
};
/** Converted leads whose onboarding was started get linked when a partner with the same phone, email or GSTIN appears. */
export const autoLinkPartners = (partners: { id: string; name: string; phone: string; email: string; gst: string }[]) => {
  const d = db(); let changed = false;
  const ls = d.leads.map((l) => {
    if (l.status !== 'Converted' || l.partnerId) return l;
    const p = partners.find((x) => (l.phone && digits(x.phone) === digits(l.phone)) || (l.email && x.email.toLowerCase() === l.email.toLowerCase()) || (l.gst && x.gst.toUpperCase() === l.gst.toUpperCase()));
    if (!p) return l;
    changed = true; return log({ ...l, partnerId: p.id, partnerName: p.name }, 'System', `Linked to onboarded partner ${p.name}`);
  });
  if (changed) commit({ ...d, leads: ls });
};

/* --------------------------------- Opportunities --------------------------------- */

const putOpp = (o: Opportunity) => commit({ ...db(), opps: db().opps.map((x) => (x.id === o.id ? o : x)) });
export type NewOpp = Pick<Opportunity, 'title' | 'account' | 'partnerId' | 'products' | 'value' | 'closeDate' | 'ownerId' | 'ownerName'>;
export const addOpp = (n: NewOpp, by: string): Result => {
  const errs: string[] = [];
  if (!n.title.trim()) errs.push('Title is required.');
  if (!n.account.trim()) errs.push('Account is required.');
  if (!(n.value > 0)) errs.push('Estimated value must be more than zero.');
  if (!n.closeDate) errs.push('Expected close date is required.');
  if (!n.ownerId) errs.push('Choose the owner.');
  if (errs.length) return { ok: false, message: 'Can’t add the opportunity.', errors: errs };
  const d = db(); const seq = d.seq + 1;
  const o: Opportunity = { ...n, id: newId('opp'), no: `OP-${seq + 2000}`, principalId: principal, leadId: null, stage: 'Prospecting', probability: STAGE_PROB.Prospecting, reason: null, orderRef: null, createdAt: now(), lastActivityAt: now(), closedAt: null, history: [{ at: now(), by, action: 'Opportunity created' }] };
  commit({ ...d, seq, opps: [o, ...d.opps] });
  return { ok: true, message: `${o.no} added.`, id: o.id };
};
export const moveStage = (id: string, stage: OppStage, by: string, reason?: string): Result => {
  const o = getOpp(id); if (!o) return { ok: false, message: 'Not found.' };
  if (o.stage === stage) return { ok: true, message: '' };
  if (stage === 'Lost' && !reason) return { ok: false, message: 'Choose why it was lost (CRM-04).' };
  if (!oppOpen(o)) return { ok: false, message: `${o.no} is already ${o.stage}. Reopen it first.` };
  putOpp(log({ ...o, stage, probability: STAGE_PROB[stage], reason: reason ?? null, lastActivityAt: now(), closedAt: ['Won', 'Lost'].includes(stage) ? now() : null }, by, `Stage ${o.stage} → ${stage}`, reason));
  if (stage === 'Won') emit('crm.opp.won', 'Sales CRM', by, `${o.no} won (${o.account})`, { oppId: id, value: o.value });
  return { ok: true, message: `${o.no} moved to ${stage}.` };
};
export const reopen = (id: string, by: string): Result => {
  const o = getOpp(id); if (!o || oppOpen(o)) return { ok: false, message: 'Nothing to reopen.' };
  putOpp(log({ ...o, stage: 'Negotiation', probability: STAGE_PROB.Negotiation, reason: null, closedAt: null, lastActivityAt: now() }, by, 'Reopened')); return { ok: true, message: `${o.no} reopened.` };
};
export const updateOpp = (id: string, patch: Partial<Pick<Opportunity, 'title' | 'value' | 'closeDate' | 'probability' | 'products' | 'orderRef'>>, by: string): Result => {
  const o = getOpp(id); if (!o) return { ok: false, message: 'Not found.' };
  putOpp(log({ ...o, ...patch }, by, 'Details updated')); return { ok: true, message: 'Saved.' };
};

/* ---------------------------------- Activities ---------------------------------- */

export const addActivity = (a: Omit<Activity, 'id' | 'at'>): Result => {
  if (!a.note.trim()) return { ok: false, message: 'Write what happened or what to do.' };
  const d = db(); const act: Activity = { ...a, id: newId('act'), at: now() };
  const touch = <T extends { id: string; lastActivityAt: string }>(x: T) => (x.id === a.refId && a.done ? { ...x, lastActivityAt: now() } : x);
  commit({ ...d, acts: [act, ...d.acts], leads: d.leads.map((l) => { const t = touch(l); return a.refType === 'lead' && t !== l && l.status === 'New' ? { ...t, status: 'Contacted' as LeadStatus } : t; }), opps: d.opps.map(touch) });
  return { ok: true, message: a.done ? `${a.kind} logged.` : `${a.kind} scheduled${a.due ? ` for ${a.due}` : ''}.` };
};
export const completeActivity = (id: string, by: string): Result => {
  const d = db(); const a = d.acts.find((x) => x.id === id); if (!a) return { ok: false, message: 'Not found.' };
  commit({ ...d, acts: d.acts.map((x) => (x.id === id ? { ...x, done: true, by } : x)), leads: d.leads.map((l) => (l.id === a.refId ? { ...l, lastActivityAt: now() } : l)), opps: d.opps.map((o) => (o.id === a.refId ? { ...o, lastActivityAt: now() } : o)) });
  return { ok: true, message: 'Done.' };
};

/* ---------------------------------- Dashboard ---------------------------------- */

export interface OwnerStats { ownerId: string; leadsAdded: number; converted: number; disqualified: number; conversion: number | null; pipeline: number; weighted: number; won: number; lost: number; winRate: number | null; wonValue: number; daysToWin: number | null; overdue: number; stale: number }
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
/** Team performance for a period ('YYYY-MM'): leads added and closed in the period, pipeline as of now. */
export const statsFor = (ownerId: string, period: string): OwnerStats => {
  const d = db(); const inP = (iso: string | null) => !!iso && iso.slice(0, 7) === period;
  const ls = d.leads.filter((l) => l.ownerId === ownerId); const os = d.opps.filter((o) => o.ownerId === ownerId);
  const converted = ls.filter((l) => l.status === 'Converted' && inP(l.closedAt)).length;
  const disq = ls.filter((l) => l.status === 'Disqualified' && inP(l.closedAt)).length;
  const open = os.filter(oppOpen);
  const won = os.filter((o) => o.stage === 'Won' && inP(o.closedAt)); const lost = os.filter((o) => o.stage === 'Lost' && inP(o.closedAt));
  return {
    ownerId, leadsAdded: ls.filter((l) => inP(l.createdAt)).length, converted, disqualified: disq, conversion: converted + disq ? Math.round((converted / (converted + disq)) * 100) : null,
    pipeline: open.reduce((a, o) => a + o.value, 0), weighted: Math.round(open.reduce((a, o) => a + (o.value * o.probability) / 100, 0)),
    won: won.length, lost: lost.length, winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null, wonValue: won.reduce((a, o) => a + o.value, 0),
    daysToWin: median(won.map((o) => Math.round((Date.parse(o.closedAt!) - Date.parse(o.createdAt)) / 86400000))),
    overdue: d.acts.filter((a) => a.ownerId === ownerId && !a.done && a.due && a.due < today()).length,
    stale: ls.filter((l) => isStale(l, leadOpen(l))).length + os.filter((o) => isStale(o, oppOpen(o))).length,
  };
};
