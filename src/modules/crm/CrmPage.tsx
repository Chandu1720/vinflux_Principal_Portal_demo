/**
 * Sales CRM page: My day · Leads (list / board) · Pipeline board · Team dashboard · Settings.
 * Data scope (CRM-07): a salesperson sees their own records; managers see the team's.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlarmClock, Briefcase, CalendarCheck, Check, Flame, Plus, Target as TargetIcon, TrendingUp, UserPlus, Users } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, SearchInput, Segmented, Select, Tabs, Textarea,
} from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { opt, subscribeOptions } from '../../platform/moduleOptions';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import type { Partner } from '../gtm-v2/types';
import { roles, users } from '../users/userStore';
import {
  ACTIVITY_KINDS, LEAD_STATUSES, OPEN_STAGES, SOURCES, STAGES, STAGE_PROB,
  activities, addActivity, addLead, addOpp, autoLinkPartners, completeActivity, convertLead, crmSettings, daysSince, duplicatesOf, ensureCrm, getLead, getOpp,
  isStale, leadOpen, leadTypes, leads as allLeads, moveStage, oppOpen, opps as allOpps, reassign, reopen, saveCrmSettings, saveTarget, setLeadStatus, staleDays, statsFor,
  subscribeCrm, targets, updateOpp,
} from './crmStore';
import type { ActivityKind, Lead, LeadSource, LeadStatus, OppStage, Opportunity } from './crmStore';

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 1 : 2)} L` : `₹${n.toLocaleString('en-IN')}`);
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const LEAD_TONE: Record<LeadStatus, BadgeTone> = { New: 'blue', Contacted: 'cyan', Qualified: 'purple', Converted: 'green', Disqualified: 'slate' };
const STAGE_TONE: Record<OppStage, BadgeTone> = { Prospecting: 'slate', Requirement: 'blue', Proposal: 'purple', Negotiation: 'amber', Won: 'green', Lost: 'red' };

type Owner = { id: string; name: string };
/** Staff users of this workspace who sell (can edit or approve in Go-to-Market) can own CRM records. */
const useOwners = (): Owner[] => {
  const { workspace } = useApp();
  const staffRoles = new Set(roles().filter((r) => r.kind === 'Staff' && (r.matrix.gtm?.includes('edit'))).map((r) => r.id));
  return users().filter((u) => u.workspace === workspace && u.status === 'Active' && u.roleIds.some((r) => staffRoles.has(r))).map((u) => ({ id: u.id, name: u.name }));
};
const useScope = () => {
  const { currentUser } = useApp();
  const m = currentUser.matrix;
  const manager = !m || !!m.gtm?.includes('approve') || !!m.platform?.includes('configure');
  const canEdit = !m || !!m.gtm?.includes('edit') || manager;
  return { manager, canEdit, me: currentUser.id, myName: currentUser.name, canConfigure: !m || !!m.platform?.includes('configure') };
};

/* ------------------------------- Activity panel ------------------------------- */

const ActivityPanel: React.FC<{ refType: 'lead' | 'opp'; refId: string; ownerId: string; canEdit: boolean }> = ({ refType, refId, ownerId, canEdit }) => {
  const { currentUser, showToast } = useApp();
  const [f, setF] = useState({ kind: 'Call' as ActivityKind, note: '', due: '', done: true });
  const list = activities().filter((a) => a.refType === refType && a.refId === refId);
  const add = () => {
    const r = addActivity({ refType, refId, kind: f.kind, note: f.note, due: f.done ? null : f.due || plusDays(1), done: f.done, by: currentUser.name, ownerId });
    showToast(r.message, r.ok ? 'success' : 'warning'); if (r.ok) setF({ ...f, note: '' });
  };
  return (
    <Card title="Activities" subtitle="Log what happened, or schedule the next step">
      {canEdit && (
        <div className="g2-stack" style={{ marginBottom: 12 }}>
          <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div style={{ width: 130 }}><Select value={f.kind} options={ACTIVITY_KINDS.map((k) => ({ value: k, label: k }))} onChange={(v) => setF({ ...f, kind: v as ActivityKind })} /></div>
            <Segmented options={[{ id: 'done', label: 'Done' }, { id: 'todo', label: 'To do' }]} value={f.done ? 'done' : 'todo'} onChange={(v) => setF({ ...f, done: v === 'done' })} />
            {!f.done && <div style={{ width: 160 }}><Input type="date" value={f.due} min={today()} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>}
          </div>
          <div className="g2-row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><Input value={f.note} placeholder={f.done ? 'What happened? e.g. Met the purchase head, shared price list' : 'Next step, e.g. Send quotation'} onChange={(e) => setF({ ...f, note: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /></div>
            <Button variant="primary" onClick={add}>{f.done ? 'Log' : 'Schedule'}</Button>
          </div>
        </div>
      )}
      {list.length === 0 && <div className="g2-small g2-muted">No activities yet.</div>}
      <div className="g2-stack" style={{ gap: 6 }}>
        {list.map((a) => (
          <div key={a.id} className="g2-row" style={{ alignItems: 'flex-start', gap: 8 }}>
            <Badge tone={a.done ? 'green' : a.due && a.due < today() ? 'red' : 'amber'}>{a.kind}</Badge>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13 }}>{a.note}</div><div className="g2-small g2-muted">{a.done ? `Done · ${a.by} · ${a.at.slice(0, 10)}` : `Due ${a.due}${a.due && a.due < today() ? ' — overdue' : ''}`}</div></div>
            {!a.done && canEdit && <Button size="sm" icon={<Check size={13} />} onClick={() => { const r = completeActivity(a.id, currentUser.name); showToast(r.message, 'success'); }}>Done</Button>}
          </div>
        ))}
      </div>
    </Card>
  );
};

const History: React.FC<{ h: { at: string; by: string; action: string; note?: string }[] }> = ({ h }) => (
  <Card title="History">
    <div className="g2-stack" style={{ gap: 4 }}>
      {[...h].reverse().map((x, i) => <div key={i} className="g2-small"><span className="g2-muted">{x.at.slice(0, 16).replace('T', ' ')} · {x.by}</span> — {x.action}{x.note ? ` (${x.note})` : ''}</div>)}
    </div>
  </Card>
);

/* ---------------------------------- Lead drawer ---------------------------------- */

const LeadDrawer: React.FC<{ id: string; onClose: () => void; onOpenOpp: (id: string) => void; partners: Partner[] }> = ({ id, onClose, onOpenOpp, partners }) => {
  useSubscribe(subscribeCrm);
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const owners = useOwners();
  const { manager, canEdit } = useScope();
  const l = getLead(id);
  const [disq, setDisq] = useState<string | null>(null);
  const [conv, setConv] = useState<{ partnerId: string; opp: boolean; title: string; value: number; closeDate: string } | null>(null);
  if (!l) return null;
  const edit = canEdit && (manager || l.ownerId === currentUser.id);
  const open = leadOpen(l);
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  const suggested = partners.find((p) => duplicatesOf(l, [p], 'partners-only').length > 0);
  const startOnboarding = () => {
    const q = new URLSearchParams({ name: l.name, contact: l.contactPerson, phone: l.phone, email: l.email, city: l.city, gst: l.gst, fromLead: l.no });
    const r = convertLead(l.id, { partnerId: null, partnerName: null, onboarding: true }, conv?.opp && opt('crm', 'opportunities') ? { title: conv.title, value: conv.value, closeDate: conv.closeDate } : null, currentUser.name);
    tell(r); if (r.ok) navigate(`/gtm-v2/partners/onboard?${q.toString()}`);
  };
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{l.name} <Badge tone={LEAD_TONE[l.status]} dot>{l.status}</Badge>{isStale(l, open) && <Badge tone="red">No activity {daysSince(l.lastActivityAt)}d</Badge>}</span>}
      subtitle={`${l.no} · ${l.type} · ${l.city} · owner ${l.ownerName}`} onClose={onClose}
      footer={edit && open ? <>
        {l.status === 'New' && <Button onClick={() => tell(setLeadStatus(l.id, 'Contacted', currentUser.name))}>Mark contacted</Button>}
        {l.status !== 'Qualified' && <Button onClick={() => tell(setLeadStatus(l.id, 'Qualified', currentUser.name))}>Qualify</Button>}
        <Button variant="danger" onClick={() => setDisq(crmSettings().disqualifyReasons[0])}>Disqualify</Button>
        <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setConv({ partnerId: suggested?.id ?? '', opp: opt('crm', 'opportunities'), title: l.interest ? `${l.interest} — ${l.name}` : `First order — ${l.name}`, value: l.estValue, closeDate: plusDays(30) })}>Convert</Button>
      </> : undefined}>
      <div className="g2-stack">
        <Card title="Details">
          <dl className="g2-dl" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 12px', margin: 0 }}>
            <dt>Contact</dt><dd>{l.contactPerson || '—'} · {l.phone || '—'}{l.email ? ` · ${l.email}` : ''}</dd>
            <dt>GSTIN</dt><dd>{l.gst || '—'}</dd>
            <dt>Source</dt><dd>{l.source}</dd>
            <dt>Interested in</dt><dd>{l.interest || '—'} · est. {inr(l.estValue)}</dd>
            <dt>Owner</dt><dd>{manager && open ? <div style={{ maxWidth: 260 }}><Select value={l.ownerId} options={owners.map((o) => ({ value: o.id, label: o.name }))} onChange={(v) => tell(reassign('lead', l.id, owners.find((o) => o.id === v)!, currentUser.name))} /></div> : l.ownerName}</dd>
            {l.status === 'Converted' && <><dt>Partner</dt><dd>{l.partnerName ?? 'Onboarding started — links automatically once the partner is onboarded'}</dd></>}
            {l.oppId && <><dt>Opportunity</dt><dd><a href="#" onClick={(e) => { e.preventDefault(); onOpenOpp(l.oppId!); }}>{getOpp(l.oppId)?.no} {getOpp(l.oppId)?.title}</a></dd></>}
            {l.reason && <><dt>Reason</dt><dd>{l.reason}</dd></>}
          </dl>
        </Card>
        <ActivityPanel refType="lead" refId={l.id} ownerId={l.ownerId} canEdit={edit} />
        <History h={l.history} />
      </div>
      {disq !== null && (
        <Modal open variant="modal" title="Disqualify lead" onClose={() => setDisq(null)} footer={<><Button onClick={() => setDisq(null)}>Cancel</Button><Button variant="danger" onClick={() => { tell(setLeadStatus(l.id, 'Disqualified', currentUser.name, disq)); setDisq(null); }}>Disqualify</Button></>}>
          <Field label="Reason" required hint="From the list in CRM settings (CRM-04)"><Select value={disq} options={crmSettings().disqualifyReasons.map((r) => ({ value: r, label: r }))} onChange={setDisq} /></Field>
        </Modal>
      )}
      {conv && (
        <Modal open variant="modal" size="lg" title={`Convert ${l.name}`} subtitle="Link the partner or hospital it became, or start its onboarding — no re-typing." onClose={() => setConv(null)}
          footer={<><Button onClick={() => setConv(null)}>Cancel</Button><Button onClick={startOnboarding}>Start onboarding instead</Button>
            <Button variant="primary" disabled={!conv.partnerId} onClick={() => { const p = partners.find((x) => x.id === conv.partnerId); const r = convertLead(l.id, { partnerId: conv.partnerId, partnerName: p?.name ?? null, onboarding: false }, conv.opp ? { title: conv.title, value: conv.value, closeDate: conv.closeDate } : null, currentUser.name); tell(r); if (r.ok) { setConv(null); if (r.id) onOpenOpp(r.id); } }}>Convert and link</Button></>}>
          <div className="g2-stack">
            {suggested && <Alert tone="info">Looks like <strong>{suggested.name}</strong> is already onboarded — selected below.</Alert>}
            <Field label="Existing partner / hospital" hint="Not onboarded yet? Use “Start onboarding instead” — the form opens with this lead’s details."><SearchableSelect value={conv.partnerId} clearable placeholder="Choose partner or hospital…" options={partners.map((p) => ({ value: p.id, label: p.name, description: `${p.code} · ${p.address.city}` }))} onChange={(v) => setConv({ ...conv, partnerId: v ?? '' })} /></Field>
            {opt('crm', 'opportunities') && <>
              <Checkbox checked={conv.opp} onChange={(v) => setConv({ ...conv, opp: v })} label="Open an opportunity for the first deal" />
              {conv.opp && <FormGrid cols={3}>
                <Field label="Title"><Input value={conv.title} onChange={(e) => setConv({ ...conv, title: e.target.value })} /></Field>
                <Field label="Estimated value (₹)"><NumberInput value={conv.value} onChange={(v) => setConv({ ...conv, value: v ?? 0 })} /></Field>
                <Field label="Expected close"><Input type="date" value={conv.closeDate} onChange={(e) => setConv({ ...conv, closeDate: e.target.value })} /></Field>
              </FormGrid>}
            </>}
          </div>
        </Modal>
      )}
    </Modal>
  );
};

/* ------------------------------- Opportunity drawer ------------------------------- */

const OppDrawer: React.FC<{ id: string; onClose: () => void; onOpenLead: (id: string) => void }> = ({ id, onClose, onOpenLead }) => {
  useSubscribe(subscribeCrm);
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const owners = useOwners();
  const { manager, canEdit } = useScope();
  const o = getOpp(id);
  const [lost, setLost] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState('');
  if (!o) return null;
  const edit = canEdit && (manager || o.ownerId === currentUser.id);
  const open = oppOpen(o);
  const tell = (r: { ok: boolean; message: string }) => { if (r.message) showToast(r.message, r.ok ? 'success' : 'warning'); };
  const go = (s: OppStage) => (s === 'Lost' ? setLost(crmSettings().lostReasons[0]) : tell(moveStage(o.id, s, currentUser.name)));
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{o.title} <Badge tone={STAGE_TONE[o.stage]} dot>{o.stage}</Badge>{isStale(o, open) && <Badge tone="red">No activity {daysSince(o.lastActivityAt)}d</Badge>}</span>}
      subtitle={`${o.no} · ${o.account} · owner ${o.ownerName}`} onClose={onClose}
      footer={edit ? (open ? <>
        <Button variant="danger" onClick={() => go('Lost')}>Mark lost</Button>
        <Button variant="success" onClick={() => go('Won')}>Mark won</Button>
      </> : <Button onClick={() => tell(reopen(o.id, currentUser.name))}>Reopen</Button>) : undefined}>
      <div className="g2-stack">
        {open && edit && (
          <Card title="Stage">
            <Segmented options={OPEN_STAGES.map((s) => ({ id: s, label: `${s} · ${STAGE_PROB[s]}%` }))} value={o.stage} onChange={(v) => go(v as OppStage)} />
          </Card>
        )}
        {o.stage === 'Won' && (
          <Alert tone="success">
            Won {o.closedAt?.slice(0, 10)}. {o.orderRef ? <>Order <strong>{o.orderRef}</strong> recorded.</> : <span className="g2-row" style={{ gap: 8, display: 'inline-flex' }}>
              <Button size="sm" onClick={() => navigate('/orders')}>Create the order</Button>
              <Input value={orderRef} placeholder="Order / quotation no." style={{ width: 200 }} onChange={(e) => setOrderRef(e.target.value)} />
              <Button size="sm" disabled={!orderRef.trim()} onClick={() => tell(updateOpp(o.id, { orderRef: orderRef.trim() }, currentUser.name))}>Record</Button>
            </span>}
          </Alert>
        )}
        <Card title="Deal">
          <FormGrid cols={3}>
            <Field label="Estimated value (₹)"><NumberInput value={o.value} disabled={!edit || !open} onChange={(v) => tell(updateOpp(o.id, { value: v ?? 0 }, currentUser.name))} /></Field>
            <Field label="Expected close"><Input type="date" value={o.closeDate} disabled={!edit || !open} onChange={(e) => tell(updateOpp(o.id, { closeDate: e.target.value }, currentUser.name))} /></Field>
            <Field label="Probability %"><NumberInput value={o.probability} disabled={!edit || !open} onChange={(v) => tell(updateOpp(o.id, { probability: Math.max(0, Math.min(100, v ?? 0)) }, currentUser.name))} /></Field>
          </FormGrid>
          <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 12px', margin: '12px 0 0' }}>
            <dt>Products</dt><dd>{o.products || '—'}</dd>
            <dt>Weighted value</dt><dd>{inr(Math.round((o.value * o.probability) / 100))}</dd>
            <dt>Owner</dt><dd>{manager && open ? <div style={{ maxWidth: 260 }}><Select value={o.ownerId} options={owners.map((x) => ({ value: x.id, label: x.name }))} onChange={(v) => tell(reassign('opp', o.id, owners.find((x) => x.id === v)!, currentUser.name))} /></div> : o.ownerName}</dd>
            {o.leadId && <><dt>From lead</dt><dd><a href="#" onClick={(e) => { e.preventDefault(); onOpenLead(o.leadId!); }}>{getLead(o.leadId)?.no}</a></dd></>}
            {o.reason && <><dt>Lost because</dt><dd>{o.reason}</dd></>}
          </dl>
        </Card>
        <ActivityPanel refType="opp" refId={o.id} ownerId={o.ownerId} canEdit={edit} />
        <History h={o.history} />
      </div>
      {lost !== null && (
        <Modal open variant="modal" title="Why was it lost?" onClose={() => setLost(null)} footer={<><Button onClick={() => setLost(null)}>Cancel</Button><Button variant="danger" onClick={() => { tell(moveStage(o.id, 'Lost', currentUser.name, lost)); setLost(null); }}>Mark lost</Button></>}>
          <Field label="Reason" required hint="From the list in CRM settings (CRM-04)"><Select value={lost} options={crmSettings().lostReasons.map((r) => ({ value: r, label: r }))} onChange={setLost} /></Field>
        </Modal>
      )}
    </Modal>
  );
};

/* ----------------------------------- Add forms ----------------------------------- */

const AddLeadModal: React.FC<{ onClose: () => void; onOpen: (id: string) => void; partners: Partner[] }> = ({ onClose, onOpen, partners }) => {
  const { currentUser, showToast } = useApp();
  const owners = useOwners();
  const { manager } = useScope();
  const types = leadTypes();
  const [f, setF] = useState({ name: '', type: types[0], contactPerson: '', phone: '', email: '', gst: '', city: '', source: 'Field visit' as LeadSource, interest: '', estValue: 0, ownerId: currentUser.id });
  const [errs, setErrs] = useState<string[]>([]);
  const [dup, setDup] = useState(false);
  const save = (allowDuplicate: boolean) => {
    const owner = owners.find((o) => o.id === f.ownerId) ?? { id: currentUser.id, name: currentUser.name };
    const r = addLead({ ...f, ownerId: owner.id, ownerName: owner.name }, currentUser.name, { allowDuplicate, partners });
    if (!r.ok) { setErrs(r.errors ?? [r.message]); setDup(r.message === 'Possible duplicate.'); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setDup(false); };
  return (
    <Modal open size="lg" title="Add lead" subtitle="Checked for duplicates by phone, email, GSTIN and name + city" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button>{dup && <Button onClick={() => save(true)}>Add anyway</Button>}<Button variant="primary" onClick={() => save(false)}>Add lead</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title={dup ? 'This may already exist' : 'Can’t add yet'} />}
        <FormGrid>
          <Field label="Name" required><Input value={f.name} placeholder="Hospital, surgeon, dealer…" onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.type} options={types.map((t) => ({ value: t, label: t }))} onChange={(v) => set({ type: v })} /></Field>
          <Field label="Contact person"><Input value={f.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="GSTIN"><Input value={f.gst} onChange={(e) => set({ gst: e.target.value.toUpperCase() })} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="Source"><Select value={f.source} options={SOURCES.map((s) => ({ value: s, label: s }))} onChange={(v) => set({ source: v as LeadSource })} /></Field>
          <Field label="Interested in"><Input value={f.interest} placeholder="Products or range" onChange={(e) => set({ interest: e.target.value })} /></Field>
          <Field label="Estimated value (₹)"><NumberInput value={f.estValue} onChange={(v) => set({ estValue: v ?? 0 })} /></Field>
          <Field label="Owner" hint={manager ? undefined : 'You own leads you add'}><Select value={f.ownerId} disabled={!manager} options={owners.map((o) => ({ value: o.id, label: o.name }))} onChange={(v) => set({ ownerId: v })} /></Field>
        </FormGrid>
      </div>
    </Modal>
  );
};

const AddOppModal: React.FC<{ onClose: () => void; onOpen: (id: string) => void; partners: Partner[] }> = ({ onClose, onOpen, partners }) => {
  const { currentUser, showToast } = useApp();
  const owners = useOwners();
  const { manager } = useScope();
  const [f, setF] = useState({ title: '', partnerId: '', account: '', products: '', value: 0, closeDate: plusDays(30), ownerId: currentUser.id });
  const [errs, setErrs] = useState<string[]>([]);
  const save = () => {
    const owner = owners.find((o) => o.id === f.ownerId) ?? { id: currentUser.id, name: currentUser.name };
    const p = partners.find((x) => x.id === f.partnerId);
    const r = addOpp({ title: f.title, account: p?.name ?? f.account, partnerId: p?.id ?? null, products: f.products, value: f.value, closeDate: f.closeDate, ownerId: owner.id, ownerName: owner.name }, currentUser.name);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="lg" title="Add opportunity" subtitle="A specific deal with an existing partner, hospital or account" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add opportunity</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t add yet" />}
        <FormGrid>
          <Field label="Title" required><Input value={f.title} placeholder="e.g. Rate contract — knee implants" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Partner / hospital" hint="Or type an account name below"><SearchableSelect value={f.partnerId} clearable placeholder="Choose…" options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setF({ ...f, partnerId: v ?? '' })} /></Field>
          {!f.partnerId && <Field label="Account name" required><Input value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} /></Field>}
          <Field label="Products"><Input value={f.products} onChange={(e) => setF({ ...f, products: e.target.value })} /></Field>
          <Field label="Estimated value (₹)" required><NumberInput value={f.value} onChange={(v) => setF({ ...f, value: v ?? 0 })} /></Field>
          <Field label="Expected close" required><Input type="date" value={f.closeDate} onChange={(e) => setF({ ...f, closeDate: e.target.value })} /></Field>
          <Field label="Owner"><Select value={f.ownerId} disabled={!manager} options={owners.map((o) => ({ value: o.id, label: o.name }))} onChange={(v) => setF({ ...f, ownerId: v })} /></Field>
        </FormGrid>
      </div>
    </Modal>
  );
};

/* ------------------------------------ Boards ------------------------------------ */

const Board = <T extends { id: string },>({ columns, items, colOf, render, onDrop, footer }: {
  columns: { id: string; label: string; tone: BadgeTone }[]; items: T[]; colOf: (x: T) => string; render: (x: T) => React.ReactNode; onDrop?: (id: string, col: string) => void; footer?: (col: string, xs: T[]) => React.ReactNode;
}) => {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`, gap: 10, padding: 12, overflowX: 'auto' }}>
      {columns.map((c) => {
        const xs = items.filter((x) => colOf(x) === c.id);
        return (
          <div key={c.id} onDragOver={(e) => { if (onDrop) { e.preventDefault(); setOver(c.id); } }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id && onDrop) onDrop(id, c.id); }}
            style={{ background: over === c.id ? 'var(--g2-primary-50, #f5f3ff)' : 'var(--g2-bg, #f8fafc)', borderRadius: 10, padding: 8, minHeight: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="g2-row" style={{ justifyContent: 'space-between', padding: '2px 4px' }}><Badge tone={c.tone} dot>{c.label}</Badge><span className="g2-small g2-muted">{xs.length}</span></div>
            {footer && <div className="g2-small g2-muted" style={{ padding: '0 4px' }}>{footer(c.id, xs)}</div>}
            {xs.map((x) => (
              <div key={x.id} draggable={!!onDrop} onDragStart={(e) => e.dataTransfer.setData('text/plain', x.id)} className="g2-card" style={{ padding: 10, cursor: 'pointer', boxShadow: 'none' }}>{render(x)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------- Page ------------------------------------- */

const CrmPage: React.FC = () => {
  useSubscribe(subscribeCrm, subscribeOptions);
  const { activePrincipal, currentUser, showToast } = useApp();
  const owners = useOwners();
  const { manager, canEdit, canConfigure } = useScope();
  const partners = (usePartners().data ?? []).filter((p) => p.status !== 'Rejected');
  const [params, setParams] = useSearchParams();
  const oppsOn = opt('crm', 'opportunities');
  const teamOn = opt('crm', 'teamDashboard') && manager;
  const tab = params.get('tab') ?? 'day';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [ownerF, setOwnerF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [leadView, setLeadView] = useState('list');
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [openOpp, setOpenOpp] = useState<string | null>(null);
  const [adding, setAdding] = useState<'lead' | 'opp' | null>(null);
  const [lostDrop, setLostDrop] = useState<{ id: string; reason: string } | null>(null);
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [drill, setDrill] = useState<{ title: string; leads?: Lead[]; opps?: Opportunity[] } | null>(null);

  ensureCrm(activePrincipal.id, owners); // selects the principal; seeds demo data once (no re-render)
  useEffect(() => { if (partners.length) autoLinkPartners(partners); }, [partners.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRM-07: own records, or the team's for managers.
  const mine = <T extends { ownerId: string },>(xs: T[]) => xs.filter((x) => (manager ? !ownerF || x.ownerId === ownerF : x.ownerId === currentUser.id));
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const ls = mine(allLeads()).filter((l) => match(`${l.no} ${l.name} ${l.city} ${l.interest} ${l.phone}`) && (!statusF || l.status === statusF));
  const os = mine(allOpps()).filter((o) => match(`${o.no} ${o.title} ${o.account} ${o.products}`));
  const acts = mine(activities());
  const due = acts.filter((a) => !a.done && a.due && a.due <= today()).sort((a, b) => (a.due! < b.due! ? -1 : 1));
  const upcoming = acts.filter((a) => !a.done && a.due && a.due > today());
  const staleLeads = ls.filter((l) => isStale(l, leadOpen(l)));
  const staleOpps = oppsOn ? os.filter((o) => isStale(o, oppOpen(o))) : [];
  const openOpps = os.filter(oppOpen);
  const refName = (t: 'lead' | 'opp', id: string) => (t === 'lead' ? getLead(id)?.name : getOpp(id)?.title) ?? '—';
  const openRef = (t: 'lead' | 'opp', id: string) => (t === 'lead' ? setOpenLead(id) : setOpenOpp(id));
  const dropStage = (id: string, col: string) => {
    const s = col as OppStage;
    if (s === 'Lost') { setLostDrop({ id, reason: crmSettings().lostReasons[0] }); return; }
    const r = moveStage(id, s, currentUser.name); if (r.message) showToast(r.message, r.ok ? 'success' : 'warning');
  };
  const closedThisMonth = (o: Opportunity) => !o.closedAt || o.closedAt.slice(0, 7) === today().slice(0, 7);

  const tabs = [
    { id: 'day', label: 'My day', count: due.length || undefined, icon: <CalendarCheck size={14} /> },
    { id: 'leads', label: 'Leads', count: ls.filter(leadOpen).length },
    ...(oppsOn ? [{ id: 'pipeline', label: 'Pipeline', count: openOpps.length }] : []),
    ...(teamOn ? [{ id: 'team', label: 'Team', icon: <Users size={14} /> }] : []),
    ...(canConfigure ? [{ id: 'settings', label: 'Settings' }] : []),
  ];
  const teamOwners = owners.filter((o) => allLeads().some((l) => l.ownerId === o.id) || allOpps().some((x) => x.ownerId === o.id) || targets().some((t) => t.ownerId === o.id));

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Sales CRM" description={manager ? 'Your team’s leads, deals and follow-ups. Convert a lead to start partner onboarding without re-typing.' : 'Your leads, deals and follow-ups.'}
        actions={canEdit && <>
          {oppsOn && <Button icon={<Briefcase size={15} />} onClick={() => setAdding('opp')}>Add opportunity</Button>}
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdding('lead')}>Add lead</Button>
        </>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Open leads" value={ls.filter(leadOpen).length} icon={<UserPlus size={22} />} color="#2563eb" bg="#eff6ff" foot={`${ls.filter((l) => l.createdAt.slice(0, 7) === today().slice(0, 7)).length} added this month`} onClick={() => setTab('leads')} />
        {oppsOn
          ? <KpiCard label="Pipeline" value={inr(openOpps.reduce((a, o) => a + o.value, 0))} icon={<TrendingUp size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${inr(Math.round(openOpps.reduce((a, o) => a + (o.value * o.probability) / 100, 0)))} weighted · ${openOpps.length} deals`} onClick={() => setTab('pipeline')} />
          : <KpiCard label="Converted this month" value={ls.filter((l) => l.status === 'Converted' && l.closedAt?.slice(0, 7) === today().slice(0, 7)).length} icon={<TrendingUp size={22} />} color="#6d28d9" bg="#f5f3ff" />}
        <KpiCard label="Follow-ups due" value={due.length} icon={<AlarmClock size={22} />} color="#d97706" bg="#fffbeb" foot={`${due.filter((a) => a.due! < today()).length} overdue · ${upcoming.length} upcoming`} onClick={() => setTab('day')} />
        <KpiCard label={`No activity ≥ ${staleDays()} days`} value={staleLeads.length + staleOpps.length} icon={<Flame size={22} />} color="#dc2626" bg="#fef2f2" foot="flagged to owner and manager" onClick={() => setTab('day')} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={tabs} />
          <span className="g2-spacer" />
          {['leads', 'pipeline'].includes(tab) && <SearchInput value={q} onChange={setQ} placeholder="Name, city, product…" />}
          {tab === 'leads' && <Select value={statusF} placeholder="All statuses" options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} onChange={setStatusF} />}
          {manager && ['leads', 'pipeline', 'day'].includes(tab) && <Select value={ownerF} placeholder="Whole team" options={owners.map((o) => ({ value: o.id, label: o.name }))} onChange={setOwnerF} />}
          {tab === 'leads' && <Segmented options={[{ id: 'list', label: 'List' }, { id: 'board', label: 'Board' }]} value={leadView} onChange={setLeadView} />}
        </div>

        {tab === 'day' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
            <Card title="Due today and overdue" subtitle={`${due.length} follow-up(s)`}>
              {due.length === 0 && <div className="g2-small g2-muted">Nothing due. Nice.</div>}
              <div className="g2-stack" style={{ gap: 8 }}>
                {due.map((a) => (
                  <div key={a.id} className="g2-row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <Badge tone={a.due! < today() ? 'red' : 'amber'}>{a.kind}</Badge>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openRef(a.refType, a.refId)}>
                      <div style={{ fontSize: 13 }}>{a.note}</div>
                      <div className="g2-small g2-muted">{refName(a.refType, a.refId)} · due {a.due}{manager ? ` · ${owners.find((o) => o.id === a.ownerId)?.name ?? ''}` : ''}</div>
                    </div>
                    <Button size="sm" icon={<Check size={13} />} onClick={() => { const r = completeActivity(a.id, currentUser.name); showToast(r.message, 'success'); }}>Done</Button>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Going cold" subtitle={`Open records with no activity for ${staleDays()}+ days (CRM-05)`}>
              {staleLeads.length + staleOpps.length === 0 && <div className="g2-small g2-muted">Everything has recent activity.</div>}
              <div className="g2-stack" style={{ gap: 8 }}>
                {staleOpps.map((o) => <div key={o.id} className="g2-row" style={{ cursor: 'pointer', gap: 8 }} onClick={() => setOpenOpp(o.id)}><Badge tone={STAGE_TONE[o.stage]}>{o.stage}</Badge><span style={{ flex: 1 }}>{o.title}<div className="g2-small g2-muted">{o.account} · {inr(o.value)} · {o.ownerName}</div></span><Badge tone="red">{daysSince(o.lastActivityAt)}d</Badge></div>)}
                {staleLeads.map((l) => <div key={l.id} className="g2-row" style={{ cursor: 'pointer', gap: 8 }} onClick={() => setOpenLead(l.id)}><Badge tone={LEAD_TONE[l.status]}>Lead</Badge><span style={{ flex: 1 }}>{l.name}<div className="g2-small g2-muted">{l.type} · {l.city} · {l.ownerName}</div></span><Badge tone="red">{daysSince(l.lastActivityAt)}d</Badge></div>)}
              </div>
            </Card>
          </div>
        )}

        {tab === 'leads' && leadView === 'list' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Lead</th><th>Type</th><th>Interest</th><th style={{ textAlign: 'right' }}>Est. value</th><th>Owner</th><th>Last activity</th><th>Status</th></tr></thead>
            <tbody>
              {ls.length === 0 && <tr><td colSpan={7} className="g2-muted">No leads.</td></tr>}
              {ls.map((l) => (
                <tr key={l.id} onClick={() => setOpenLead(l.id)} style={{ cursor: 'pointer' }}>
                  <td><div className="g2-strong">{l.name}</div><div className="g2-cell-sub">{l.no} · {l.city} · {l.source}</div></td>
                  <td>{l.type}</td>
                  <td className="g2-small">{l.interest}</td>
                  <td style={{ textAlign: 'right' }}>{inr(l.estValue)}</td>
                  <td className="g2-small">{l.ownerName}</td>
                  <td className="g2-small">{daysSince(l.lastActivityAt)}d ago {isStale(l, leadOpen(l)) && <Badge tone="red">cold</Badge>}</td>
                  <td><Badge tone={LEAD_TONE[l.status]} dot>{l.status}</Badge>{l.partnerName && <div className="g2-cell-sub">→ {l.partnerName}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {tab === 'leads' && leadView === 'board' && (
          <Board columns={LEAD_STATUSES.map((s) => ({ id: s, label: s, tone: LEAD_TONE[s] }))} items={ls} colOf={(l) => l.status}
            render={(l) => <div onClick={() => setOpenLead(l.id)}><div className="g2-strong" style={{ fontSize: 13 }}>{l.name}</div><div className="g2-small g2-muted">{l.type} · {l.city}</div><div className="g2-row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="g2-small">{inr(l.estValue)}</span>{isStale(l, leadOpen(l)) && <Badge tone="red">{daysSince(l.lastActivityAt)}d</Badge>}</div></div>} />
        )}

        {tab === 'pipeline' && oppsOn && (<>
          <div className="g2-small g2-muted" style={{ padding: '10px 16px 0' }}>Drag a card to move its stage. Dropping on Lost asks for the reason. Won and Lost show this month.</div>
          <Board columns={STAGES.map((s) => ({ id: s, label: s, tone: STAGE_TONE[s] }))} items={os.filter(closedThisMonth)} colOf={(o) => o.stage} onDrop={canEdit ? dropStage : undefined}
            footer={(_c, xs) => inr(xs.reduce((a, o) => a + o.value, 0))}
            render={(o) => <div onClick={() => setOpenOpp(o.id)}><div className="g2-strong" style={{ fontSize: 13 }}>{o.title}</div><div className="g2-small g2-muted">{o.account}</div><div className="g2-row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="g2-small">{inr(o.value)} · {o.closeDate}</span>{isStale(o, oppOpen(o)) && <Badge tone="red">{daysSince(o.lastActivityAt)}d</Badge>}</div>{manager && <div className="g2-small g2-muted">{o.ownerName}</div>}</div>} />
        </>)}

        {tab === 'team' && teamOn && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-row" style={{ gap: 8 }}><span className="g2-small">Period</span><div style={{ width: 170 }}><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div><span className="g2-small g2-muted">Click a number to see the records behind it.</span></div>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Salesperson</th><th style={{ textAlign: 'right' }}>Leads added</th><th style={{ textAlign: 'right' }}>Conversion %</th>{oppsOn && <><th style={{ textAlign: 'right' }}>Pipeline</th><th style={{ textAlign: 'right' }}>Weighted</th><th style={{ textAlign: 'right' }}>Won</th><th style={{ textAlign: 'right' }}>Win rate</th><th style={{ textAlign: 'right' }}>Days to win</th></>}<th style={{ textAlign: 'right' }}>Overdue follow-ups</th><th style={{ textAlign: 'right' }}>Going cold</th></tr></thead>
              <tbody>
                {teamOwners.map((o) => {
                  const s = statsFor(o.id, period);
                  const t = targets().find((x) => x.ownerId === o.id && x.period === period);
                  const inP = (iso: string | null) => !!iso && iso.slice(0, 7) === period;
                  const num = (v: React.ReactNode, title: string, list: { leads?: Lead[]; opps?: Opportunity[] }) => <a href="#" onClick={(e) => { e.preventDefault(); setDrill({ title: `${o.name} — ${title}`, ...list }); }}>{v}</a>;
                  const tgt = (_actual: number, goal: number | undefined) => (opt('crm', 'targets') && goal ? <div className="g2-cell-sub">of {goal.toLocaleString('en-IN')} target</div> : null);
                  return (
                    <tr key={o.id}>
                      <td className="g2-strong">{o.name}</td>
                      <td style={{ textAlign: 'right' }}>{num(s.leadsAdded, 'leads added', { leads: allLeads().filter((l) => l.ownerId === o.id && inP(l.createdAt)) })}{tgt(s.leadsAdded, t?.leads)}</td>
                      <td style={{ textAlign: 'right' }}>{num(s.conversion === null ? '—' : `${s.conversion}%`, 'converted and disqualified', { leads: allLeads().filter((l) => l.ownerId === o.id && ['Converted', 'Disqualified'].includes(l.status) && inP(l.closedAt)) })}{tgt(s.converted, t?.conversions)}</td>
                      {oppsOn && <>
                        <td style={{ textAlign: 'right' }}>{num(inr(s.pipeline), 'open pipeline', { opps: allOpps().filter((x) => x.ownerId === o.id && oppOpen(x)) })}</td>
                        <td style={{ textAlign: 'right' }}>{inr(s.weighted)}</td>
                        <td style={{ textAlign: 'right' }}>{num(`${s.won} · ${inr(s.wonValue)}`, 'won', { opps: allOpps().filter((x) => x.ownerId === o.id && x.stage === 'Won' && inP(x.closedAt)) })}{opt('crm', 'targets') && t?.value ? <div className="g2-cell-sub">{Math.round((s.wonValue / t.value) * 100)}% of {inr(t.value)}</div> : null}</td>
                        <td style={{ textAlign: 'right' }}>{s.winRate === null ? '—' : `${s.winRate}%`}</td>
                        <td style={{ textAlign: 'right' }}>{s.daysToWin ?? '—'}</td>
                      </>}
                      <td style={{ textAlign: 'right', color: s.overdue ? '#dc2626' : undefined }}>{s.overdue}</td>
                      <td style={{ textAlign: 'right', color: s.stale ? '#dc2626' : undefined }}>{num(s.stale, 'going cold', { leads: allLeads().filter((l) => l.ownerId === o.id && isStale(l, leadOpen(l))), opps: allOpps().filter((x) => x.ownerId === o.id && isStale(x, oppOpen(x))) })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            {opt('crm', 'targets') && (
              <Card title={<span className="g2-row"><TargetIcon size={16} /> Targets for {period}</span>} subtitle="Per salesperson: leads to add, conversions, value to win (shared with partner targets later)">
                <div className="g2-stack" style={{ gap: 8 }}>
                  {teamOwners.map((o) => {
                    const t = targets().find((x) => x.ownerId === o.id && x.period === period) ?? { ownerId: o.id, period, leads: 0, conversions: 0, value: 0 };
                    return (
                      <div key={o.id} className="g2-row" style={{ gap: 8 }}>
                        <span style={{ width: 200 }}>{o.name}</span>
                        <div style={{ width: 120 }}><NumberInput value={t.leads} onChange={(v) => saveTarget({ ...t, leads: v ?? 0 })} /></div><span className="g2-small g2-muted">leads</span>
                        <div style={{ width: 120 }}><NumberInput value={t.conversions} onChange={(v) => saveTarget({ ...t, conversions: v ?? 0 })} /></div><span className="g2-small g2-muted">conversions</span>
                        <div style={{ width: 160 }}><NumberInput value={t.value} onChange={(v) => saveTarget({ ...t, value: v ?? 0 })} /></div><span className="g2-small g2-muted">₹ won</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'settings' && canConfigure && (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Lost reasons" subtitle="One per line (CRM-04)">
              <Textarea rows={7} defaultValue={crmSettings().lostReasons.join('\n')} onBlur={(e) => { saveCrmSettings({ ...crmSettings(), lostReasons: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }); showToast('Saved.', 'success'); }} />
            </Card>
            <Card title="Disqualify reasons" subtitle="One per line (CRM-04)">
              <Textarea rows={7} defaultValue={crmSettings().disqualifyReasons.join('\n')} onBlur={(e) => { saveCrmSettings({ ...crmSettings(), disqualifyReasons: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }); showToast('Saved.', 'success'); }} />
            </Card>
            <div className="g2-small g2-muted">Stale-days, opportunities, team dashboard and targets are switched in Modules → Sales CRM. Lead types follow your industry: {leadTypes().join(', ')}.</div>
          </div>
        )}
      </Card>

      {adding === 'lead' && <AddLeadModal partners={partners} onClose={() => setAdding(null)} onOpen={setOpenLead} />}
      {adding === 'opp' && <AddOppModal partners={partners} onClose={() => setAdding(null)} onOpen={setOpenOpp} />}
      {openLead && <LeadDrawer id={openLead} partners={partners} onClose={() => setOpenLead(null)} onOpenOpp={(id) => { setOpenLead(null); setOpenOpp(id); }} />}
      {openOpp && <OppDrawer id={openOpp} onClose={() => setOpenOpp(null)} onOpenLead={(id) => { setOpenOpp(null); setOpenLead(id); }} />}
      {lostDrop && (
        <Modal open variant="modal" title="Why was it lost?" onClose={() => setLostDrop(null)} footer={<><Button onClick={() => setLostDrop(null)}>Cancel</Button><Button variant="danger" onClick={() => { const r = moveStage(lostDrop.id, 'Lost', currentUser.name, lostDrop.reason); showToast(r.message, r.ok ? 'success' : 'warning'); setLostDrop(null); }}>Mark lost</Button></>}>
          <Field label="Reason" required><Select value={lostDrop.reason} options={crmSettings().lostReasons.map((r) => ({ value: r, label: r }))} onChange={(v) => setLostDrop({ ...lostDrop, reason: v })} /></Field>
        </Modal>
      )}
      {drill && (
        <Modal open title={drill.title} onClose={() => setDrill(null)}>
          <div className="g2-stack" style={{ gap: 6 }}>
            {(drill.leads ?? []).map((l) => <div key={l.id} className="g2-row" style={{ cursor: 'pointer', gap: 8 }} onClick={() => { setDrill(null); setOpenLead(l.id); }}><Badge tone={LEAD_TONE[l.status]}>{l.status}</Badge>{l.name}<span className="g2-small g2-muted">{l.no}</span></div>)}
            {(drill.opps ?? []).map((o) => <div key={o.id} className="g2-row" style={{ cursor: 'pointer', gap: 8 }} onClick={() => { setDrill(null); setOpenOpp(o.id); }}><Badge tone={STAGE_TONE[o.stage]}>{o.stage}</Badge>{o.title}<span className="g2-small g2-muted">{inr(o.value)}</span></div>)}
            {!(drill.leads?.length || drill.opps?.length) && <div className="g2-muted">Nothing here.</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};
export default CrmPage;
