/**
 * Schemes & Claims: schemes paid after the sale (secondary per-unit, target, display, price support),
 * claims checked against verified secondary data, budget versus spend, maker-checker, settlement register.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgePercent, Calculator, CheckCircle2, ClipboardList, Plus, Receipt, Wallet } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, MultiSelect, NumberInput, PageHeader, Progress, SearchableSelect, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { Linkify } from '../../platform/Linkify';
import { optChoice, subscribeOptions } from '../../platform/moduleOptions';
import { usePlatform } from '../../platform/PlatformContext';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import { ensurePlatformDemo, ensureSecondaryDemo, subscribeSecondary, thisPeriod } from '../secondary/secondaryStore';
import { CUSTOMER_TYPES } from '../secondary/secondaryStore';
import {
  SOURCE_LABEL, TYPE_HINT, TYPE_LABEL, claimSchemes, claims as allClaims, closeScheme, committedOf, computeClaims, decideClaim, decideScheme, ensureClaimsDemo, getClaim, getScheme,
  raiseClaim, saveDraft, settleClaim, spentOf, submitScheme, subscribeClaims, verify,
} from './claimsStore';
import type { ClaimScheme, ClaimStatus, SchemeStatus, SchemeType, Settlement } from './claimsStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const SCHEME_TONE: Record<SchemeStatus, BadgeTone> = { Draft: 'slate', 'Pending approval': 'amber', Active: 'green', Closed: 'slate', Rejected: 'red' };
const CLAIM_TONE: Record<ClaimStatus, BadgeTone> = { 'Under review': 'amber', Approved: 'blue', 'Partly approved': 'purple', Settled: 'green', Rejected: 'slate' };
const benefit = (s: ClaimScheme) => (s.type === 'PER_UNIT' ? `${inr(s.rate)} per unit${s.customerTypes.length ? ` sold to ${s.customerTypes.join(', ').toLowerCase()}` : ''}` : s.type === 'TARGET' ? `${s.incentivePct}% of sales if ≥ ${inr(s.targetValue)} / month` : s.type === 'DISPLAY' ? `${inr(s.rate)} per outlet` : 'List minus approved tender price');

/* ---------------------------------- Scheme builder ---------------------------------- */

const SchemeModal: React.FC<{ id: string | null; onClose: () => void }> = ({ id, onClose }) => {
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const existing = id ? getScheme(id) : null;
  const q0 = new Date().toISOString().slice(0, 10);
  const [s, setS] = useState<ClaimScheme>(existing ?? { id: '', code: '', principalId: activePrincipal.id, name: '', type: 'PER_UNIT', from: q0, to: q0, partnerIds: [], productIds: [], customerTypes: [], rate: 0, targetValue: 0, incentivePct: 0, budget: 0, stackable: false, claimWindowDays: 45, evidence: '', settlement: 'Credit note', status: 'Draft', makerBy: currentUser.name, approvedBy: null, history: [] });
  const [errs, setErrs] = useState<string[]>([]);
  const ro = !!existing && !['Draft', 'Rejected'].includes(existing.status);
  const save = (submit: boolean) => {
    const r = saveDraft(s, currentUser.name); if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    const r2 = submit && r.id ? submitScheme(r.id, currentUser.name) : r;
    showToast(r2.message, 'success'); onClose();
  };
  return (
    <Modal open size="lg" title={existing ? `${existing.code} · ${existing.name}` : 'New scheme'} subtitle={TYPE_HINT[s.type]} onClose={onClose}
      footer={ro ? undefined : <><Button onClick={onClose}>Cancel</Button><Button onClick={() => save(false)}>Save draft</Button><Button variant="primary" onClick={() => save(true)}>Submit for approval</Button></>}>
      <div className="g2-stack">
        {ro && <Alert tone="info">{existing!.status} — a submitted scheme can’t be edited. Close it and create a new one to change the terms.</Alert>}
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t save yet" />}
        <FormGrid>
          <Field label="Name" required><Input value={s.name} disabled={ro} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Type"><Select value={s.type} disabled={ro} options={(Object.keys(TYPE_LABEL) as SchemeType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} onChange={(v) => setS({ ...s, type: v as SchemeType })} /></Field>
          <Field label="From" required><Input type="date" value={s.from} disabled={ro} onChange={(e) => setS({ ...s, from: e.target.value })} /></Field>
          <Field label="To" required><Input type="date" value={s.to} disabled={ro} onChange={(e) => setS({ ...s, to: e.target.value })} /></Field>
          {s.type === 'PER_UNIT' && <Field label="₹ per unit sold" required><NumberInput value={s.rate} disabled={ro} onChange={(v) => setS({ ...s, rate: v ?? 0 })} /></Field>}
          {s.type === 'PER_UNIT' && <Field label="Only sales to" hint="Empty = any customer"><MultiSelect values={s.customerTypes} disabled={ro} options={CUSTOMER_TYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => setS({ ...s, customerTypes: v })} /></Field>}
          {s.type === 'TARGET' && <Field label="Monthly target (₹ secondary sales)" required><NumberInput value={s.targetValue} disabled={ro} onChange={(v) => setS({ ...s, targetValue: v ?? 0 })} /></Field>}
          {s.type === 'TARGET' && <Field label="Incentive % when reached" required><NumberInput value={s.incentivePct} disabled={ro} onChange={(v) => setS({ ...s, incentivePct: v ?? 0 })} /></Field>}
          {s.type === 'DISPLAY' && <Field label="₹ per outlet" required><NumberInput value={s.rate} disabled={ro} onChange={(v) => setS({ ...s, rate: v ?? 0 })} /></Field>}
          <Field label="Budget (₹)" required><NumberInput value={s.budget} disabled={ro} onChange={(v) => setS({ ...s, budget: v ?? 0 })} /></Field>
          <Field label="Claim window (days after end)"><NumberInput value={s.claimWindowDays} disabled={ro} onChange={(v) => setS({ ...s, claimWindowDays: v ?? 0 })} /></Field>
          <Field label="Settle by"><Select value={s.settlement} disabled={ro} options={['Credit note', 'Free goods', 'Payment'].map((x) => ({ value: x, label: x }))} onChange={(v) => setS({ ...s, settlement: v as Settlement })} /></Field>
          <Field label="Combines with other schemes?" hint="If not, a sale used here can’t be claimed under another scheme (SCH-04)"><Select value={s.stackable ? 'yes' : 'no'} disabled={ro} options={[{ value: 'no', label: 'No — exclusive' }, { value: 'yes', label: 'Yes — can stack' }]} onChange={(v) => setS({ ...s, stackable: v === 'yes' })} /></Field>
        </FormGrid>
        <Field label="Products" required={s.type !== 'DISPLAY'}><MultiSelect values={s.productIds} disabled={ro} options={products.filter((p) => p.lifecycleStatus === 'Active').map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setS({ ...s, productIds: v })} /></Field>
        <Field label="Partners" hint="Empty = every partner"><MultiSelect values={s.partnerIds} disabled={ro} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setS({ ...s, partnerIds: v })} /></Field>
        {['DISPLAY', 'PRICE_SUPPORT'].includes(s.type) && <Field label="Evidence required" required><Input value={s.evidence} disabled={ro} placeholder="e.g. Photo of the stand and the outlet’s stamp" onChange={(e) => setS({ ...s, evidence: e.target.value })} /></Field>}
        {existing && <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{existing.history.map((h, i) => <div key={i} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>}
      </div>
    </Modal>
  );
};

/* ------------------------------------- Claim view ------------------------------------- */

const ClaimModal: React.FC<{ id: string; onClose: () => void; canApprove: boolean }> = ({ id, onClose, canApprove }) => {
  useSubscribe(subscribeClaims);
  const { currentUser, showToast } = useApp();
  const c = getClaim(id);
  const s = c ? getScheme(c.schemeId) : null;
  const [amt, setAmt] = useState<number>(c ? (s && ['PER_UNIT', 'TARGET'].includes(s.type) ? Math.min(c.claimedAmount, c.computedAmount) : c.claimedAmount) : 0);
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const [ref, setRef] = useState('');
  if (!c || !s) return null;
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  const left = s.budget - spentOf(s.id);
  const erp = optChoice('orders', 'invoicing') !== 'vinflux';
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{c.no} · {c.partnerName} <Badge tone={CLAIM_TONE[c.status]} dot>{c.status}</Badge></span>} subtitle={`${s.code} ${s.name} · ${c.period} · ${SOURCE_LABEL[c.source]}`} onClose={onClose}>
      <div className="g2-stack">
        {c.flags.length > 0 && <Alert tone="warn"><div className="g2-stack" style={{ gap: 4 }}>{c.flags.map((f, i) => <div key={i}>{f}</div>)}</div></Alert>}
        <div className="g2-grid g2-grid-3">
          <Card title="Claimed"><div style={{ fontSize: 22, fontWeight: 700 }}>{inr(c.claimedAmount)}</div><div className="g2-small g2-muted">{s.type === 'PER_UNIT' || s.type === 'DISPLAY' ? `${c.claimedQty} ${s.type === 'DISPLAY' ? 'outlet(s)' : 'unit(s)'}` : ''}</div></Card>
          <Card title={s.type === 'PER_UNIT' || s.type === 'TARGET' ? 'Verified from secondary data' : 'Per scheme terms'}><div style={{ fontSize: 22, fontWeight: 700, color: c.computedAmount < c.claimedAmount ? '#b45309' : undefined }}>{inr(c.computedAmount)}</div><div className="g2-small g2-muted">{s.type === 'PER_UNIT' ? `${c.verifiedQty} unit(s) reconciled` : s.type === 'TARGET' ? benefit(s) : 'checked against evidence'}</div></Card>
          <Card title="Budget left"><div style={{ fontSize: 22, fontWeight: 700 }}>{inr(left)}</div><div className="g2-small g2-muted">of {inr(s.budget)}</div></Card>
        </div>
        {c.excluded.length > 0 && (
          <Card title="Not counted" subtitle="Why some sales don’t qualify (SCH-02, SCH-04)">
            <div className="g2-stack" style={{ gap: 4 }}>{c.excluded.map((e, i) => <div key={i} className="g2-small">{e.qty ? <strong>{e.qty} unit(s)</strong> : null} {e.reason}</div>)}</div>
          </Card>
        )}
        {c.evidence && <Card title="Evidence"><div className="g2-small">{c.evidence}</div></Card>}
        {c.status === 'Under review' && canApprove && (
          <Card title="Decision" subtitle={c.source !== 'auto' && c.enteredBy === currentUser.name ? 'You entered this claim — another person must approve it (maker-checker).' : 'Approve all, part, or reject with a reason the partner sees.'}>
            <FormGrid>
              <Field label="Approve amount (₹)"><NumberInput value={amt} onChange={(v) => setAmt(v ?? 0)} /></Field>
              <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required when rejecting" /></Field>
            </FormGrid>
            {amt > left && <label className="g2-row" style={{ gap: 6, marginTop: 8 }}><input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} /> Approve over budget ({inr(amt - left)} above what’s left)</label>}
            <div className="g2-row" style={{ gap: 8, marginTop: 12 }}>
              <Button variant="danger" onClick={() => tell(decideClaim(c.id, false, 0, currentUser.name, note, false))}>Reject</Button>
              <Button variant="primary" icon={<CheckCircle2 size={15} />} onClick={() => tell(decideClaim(c.id, true, amt, currentUser.name, note, over))}>Approve {inr(amt)}</Button>
            </div>
          </Card>
        )}
        {['Approved', 'Partly approved'].includes(c.status) && canApprove && (
          <Card title="Settle" subtitle={s.settlement === 'Credit note' ? (erp ? 'Your ERP issues credit notes — raise it there and record its number (SCH-05).' : 'VinFlux issues the credit note.') : `Settled by ${s.settlement.toLowerCase()}.`}>
            <div className="g2-row" style={{ gap: 8 }}>
              {(erp || s.settlement !== 'Credit note') && <div style={{ width: 260 }}><Input value={ref} placeholder={s.settlement === 'Credit note' ? 'ERP credit note no.' : 'Reference (optional)'} onChange={(e) => setRef(e.target.value)} /></div>}
              <Button variant="primary" icon={<Receipt size={15} />} onClick={() => tell(settleClaim(c.id, currentUser.name, ref))}>Settle {inr(c.approvedAmount ?? 0)}</Button>
            </div>
          </Card>
        )}
        {c.settlement && <Alert tone="success">Settled {c.settlement.at.slice(0, 10)} by {c.settlement.method.toLowerCase()} <strong>{c.settlement.ref}</strong> — {inr(c.approvedAmount ?? 0)}.</Alert>}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{c.history.map((h, i) => <div key={i} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? <> (<Linkify text={h.note} />)</> : ''}</div>)}</div></Card>
      </div>
    </Modal>
  );
};

/* ------------------------------------- New claim ------------------------------------- */

const NewClaimModal: React.FC<{ onClose: () => void; onOpen: (id: string) => void }> = ({ onClose, onOpen }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const live = claimSchemes(activePrincipal.id).filter((s) => ['Active', 'Closed'].includes(s.status));
  const [f, setF] = useState({ schemeId: live[0]?.id ?? '', partnerId: '', period: thisPeriod(), qty: 0, amount: 0, evidence: '', source: 'desk' as 'desk' | 'partner' });
  const [errs, setErrs] = useState<string[]>([]);
  const s = getScheme(f.schemeId);
  const v = s && f.partnerId && ['PER_UNIT', 'TARGET'].includes(s.type) ? verify(s, f.partnerId, f.period, activePrincipal.id) : null;
  const save = () => {
    const p = partners.find((x) => x.id === f.partnerId);
    const amount = s?.type === 'DISPLAY' ? f.qty * s.rate : f.amount;
    const r = raiseClaim({ principalId: activePrincipal.id, schemeId: f.schemeId, partnerId: f.partnerId, partnerName: p?.name ?? '', period: f.period, source: f.source, claimedQty: f.qty, claimedAmount: amount, evidence: f.evidence, by: f.source === 'partner' ? `${p?.name ?? 'Partner'} (portal)` : currentUser.name });
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="lg" title="Raise a claim" subtitle="On a partner’s behalf, or as the partner would on Partner Lite" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Raise claim</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t raise yet" />}
        <FormGrid>
          <Field label="Scheme" required><Select value={f.schemeId} options={live.map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))} onChange={(v2) => setF({ ...f, schemeId: v2 })} /></Field>
          <Field label="Partner" required><SearchableSelect value={f.partnerId} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v2) => setF({ ...f, partnerId: v2 ?? '' })} /></Field>
          <Field label="Month" required><Input type="month" value={f.period} max={thisPeriod()} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
          <Field label="Raised by"><Select value={f.source} options={[{ value: 'desk', label: 'Our team (on behalf)' }, { value: 'partner', label: 'The partner (demo of Partner Lite)' }]} onChange={(v2) => setF({ ...f, source: v2 as 'desk' | 'partner' })} /></Field>
          {s && s.type !== 'TARGET' && s.type !== 'PRICE_SUPPORT' && <Field label={s.type === 'DISPLAY' ? 'Outlets' : 'Units claimed'}><NumberInput value={f.qty} onChange={(x) => setF({ ...f, qty: x ?? 0, amount: s.type === 'PER_UNIT' ? (x ?? 0) * s.rate : f.amount })} /></Field>}
          {s && s.type !== 'DISPLAY' && <Field label="Amount claimed (₹)"><NumberInput value={f.amount} onChange={(x) => setF({ ...f, amount: x ?? 0 })} /></Field>}
        </FormGrid>
        {s && ['DISPLAY', 'PRICE_SUPPORT'].includes(s.type) && <Field label="Evidence" required hint={s.evidence}><Textarea rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Field>}
        {v && <Alert tone="info">Verified secondary data supports <strong>{inr(v.amount)}</strong>{s?.type === 'PER_UNIT' ? ` (${v.qty} unit(s))` : v.achievedPct !== null ? ` (target ${v.achievedPct}% achieved)` : ''}.{v.excluded.length ? ` Not counted: ${v.excluded.map((e) => `${e.qty ? `${e.qty} — ` : ''}${e.reason}`).join('; ')}.` : ''}</Alert>}
      </div>
    </Modal>
  );
};

/* ---------------------------------------- Page ---------------------------------------- */

const ClaimsPage: React.FC = () => {
  useSubscribe(subscribeClaims, subscribeSecondary, subscribeOptions);
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const { enabled } = usePlatform();
  const partnersAll = usePartners().data ?? [];
  const partners = useMemo(() => partnersAll.filter((p) => !p.institution && p.status === 'Active'), [partnersAll]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'claims';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [openScheme, setOpenScheme] = useState<string | null | 'new'>(null);
  const [openClaim, setOpenClaim] = useState<string | null>(null);
  const [newClaim, setNewClaim] = useState(false);
  const [period, setPeriod] = useState(thisPeriod());
  const m = currentUser.matrix;
  const canEdit = !m || !!m.pricing?.includes('edit');
  const canApprove = !m || !!m.pricing?.includes('approve');
  useEffect(() => {
    if (!partners.length || !products.length) return;
    // Claims are verified against secondary sales, so make sure that demo exists first.
    const ps = partners.map((p) => ({ id: p.id, name: p.name, locType: (p.partnerTypeId === 'pt-cnf' ? 'CNF' : 'PARTNER') as 'CNF' | 'PARTNER' }));
    const act = products.filter((p) => p.lifecycleStatus === 'Active');
    ensureSecondaryDemo(activePrincipal.id, ps, act, 'System'); ensurePlatformDemo(activePrincipal.id, ps, act);
  }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (partners.length && products.length) ensureClaimsDemo(activePrincipal.id, products.filter((p) => p.lifecycleStatus === 'Active').map((p) => p.id), partners.slice(0, 3).map((p) => ({ id: p.id, name: p.name }))); }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const schemes = claimSchemes(activePrincipal.id);
  const cl = allClaims(activePrincipal.id);
  const queue = cl.filter((c) => c.status === 'Under review');
  const toSettle = cl.filter((c) => ['Approved', 'Partly approved'].includes(c.status));
  const settled = cl.filter((c) => c.status === 'Settled');
  const leakage = cl.filter((c) => c.status !== 'Rejected').reduce((a, c) => a + Math.max(0, c.claimedAmount - c.computedAmount), 0);
  const pending = schemes.filter((s) => s.status === 'Pending approval');
  const sName = (id: string) => getScheme(id)?.code ?? id;

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Schemes & Claims" description="Schemes paid after the sale — settled only on verified secondary data. On-invoice schemes (buy X get Y, extra %) stay in Price Lists."
        actions={<>{canEdit && <Button icon={<Plus size={15} />} onClick={() => setOpenScheme('new')}>New scheme</Button>}{canEdit && <Button variant="primary" icon={<ClipboardList size={15} />} onClick={() => setNewClaim(true)}>Raise claim</Button>}</>} />
      {!enabled('secondary') && <div style={{ marginBottom: 12 }}><Alert tone="warn">Secondary Sales is switched off, so per-unit and target schemes can’t be verified. Display and price-support claims still work.</Alert></div>}
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Claims to review" value={queue.length} icon={<ClipboardList size={22} />} color="#d97706" bg="#fffbeb" foot={inr(queue.reduce((a, c) => a + c.claimedAmount, 0)) + ' claimed'} onClick={() => setTab('claims')} />
        <KpiCard label="Claimed above verified" value={inr(leakage)} icon={<BadgePercent size={22} />} color="#dc2626" bg="#fef2f2" foot="leakage stopped by the data check" />
        <KpiCard label="To settle" value={toSettle.length} icon={<Wallet size={22} />} color="#2563eb" bg="#eff6ff" foot={inr(toSettle.reduce((a, c) => a + (c.approvedAmount ?? 0), 0)) + ' approved'} onClick={() => setTab('settle')} />
        <KpiCard label="Schemes waiting approval" value={pending.length} icon={<CheckCircle2 size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${schemes.filter((s) => s.status === 'Active').length} live`} onClick={() => setTab('schemes')} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'claims', label: 'Claims queue', count: queue.length || undefined },
            { id: 'schemes', label: 'Schemes & budgets', count: schemes.length },
            { id: 'settle', label: 'Settlement register', count: toSettle.length + settled.length || undefined },
          ]} />
          <span className="g2-spacer" />
          {tab === 'schemes' && <><div style={{ width: 170 }}><Input type="month" value={period} max={thisPeriod()} onChange={(e) => setPeriod(e.target.value)} /></div></>}
        </div>

        {tab === 'claims' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Claim</th><th>Partner · month</th><th>Scheme</th><th style={{ textAlign: 'right' }}>Claimed</th><th style={{ textAlign: 'right' }}>Verified</th><th style={{ textAlign: 'right' }}>Difference</th><th>Status</th></tr></thead>
            <tbody>
              {cl.length === 0 && <tr><td colSpan={7} className="g2-muted">No claims yet.</td></tr>}
              {[...cl].sort((a, b) => (a.status === 'Under review' ? -1 : 1) - (b.status === 'Under review' ? -1 : 1)).map((c) => {
                const diff = c.claimedAmount - c.computedAmount;
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpenClaim(c.id)}>
                    <td className="g2-mono">{c.no}<div className="g2-cell-sub">{SOURCE_LABEL[c.source]}</div></td>
                    <td>{c.partnerName}<div className="g2-cell-sub">{c.period}</div></td>
                    <td className="g2-small">{sName(c.schemeId)}<div className="g2-cell-sub">{getScheme(c.schemeId)?.name}</div></td>
                    <td style={{ textAlign: 'right' }}>{inr(c.claimedAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(c.computedAmount)}</td>
                    <td style={{ textAlign: 'right', color: diff > 0 ? '#b91c1c' : undefined }}>{diff > 0 ? `+${inr(diff)}` : '—'}</td>
                    <td><Badge tone={CLAIM_TONE[c.status]} dot>{c.status}</Badge>{c.flags.length > 0 && c.status === 'Under review' && <div className="g2-cell-sub" style={{ color: '#b45309' }}>{c.flags.length} flag(s)</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}

        {tab === 'schemes' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Scheme</th><th>Benefit</th><th>Period</th><th style={{ width: 220 }}>Budget vs spend</th><th>Status</th><th /></tr></thead>
            <tbody>{schemes.map((s) => {
              const spent = spentOf(s.id); const pend = committedOf(s.id);
              return (
                <tr key={s.id}>
                  <td style={{ cursor: 'pointer' }} onClick={() => setOpenScheme(s.id)}><div className="g2-strong">{s.code} · {s.name}</div><div className="g2-cell-sub">{TYPE_LABEL[s.type]}{s.stackable ? '' : ' · exclusive'}</div></td>
                  <td className="g2-small">{benefit(s)}<div className="g2-cell-sub">settle by {s.settlement.toLowerCase()}</div></td>
                  <td className="g2-small">{s.from} → {s.to}</td>
                  <td><Progress value={Math.min(100, (spent / s.budget) * 100)} /><div className="g2-cell-sub">{inr(spent)} spent · {inr(pend)} under review · {inr(s.budget)} budget</div></td>
                  <td><Badge tone={SCHEME_TONE[s.status]} dot>{s.status}</Badge>{s.approvedBy && <div className="g2-cell-sub">approved by {s.approvedBy}</div>}</td>
                  <td className="g2-small" style={{ whiteSpace: 'nowrap' }}>
                    {s.status === 'Pending approval' && canApprove && <><Button size="sm" variant="success" onClick={() => { const r = decideScheme(s.id, true, currentUser.name); showToast(r.message, r.ok ? 'success' : 'warning'); }}>Approve</Button> </>}
                    {s.status === 'Active' && ['PER_UNIT', 'TARGET'].includes(s.type) && canEdit && <><Button size="sm" icon={<Calculator size={13} />} onClick={() => { const r = computeClaims(activePrincipal.id, s.id, period, partners.map((p) => ({ id: p.id, name: p.name })), 'VinFlux (period end)'); showToast(r.message, 'success'); }}>Compute {period}</Button> </>}
                    {s.status === 'Active' && canEdit && <Button size="sm" onClick={() => { const r = closeScheme(s.id, currentUser.name); showToast(r.message, r.ok ? 'success' : 'warning'); }}>Close</Button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}

        {tab === 'settle' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Claim</th><th>Partner</th><th>Scheme</th><th style={{ textAlign: 'right' }}>Approved</th><th>Settled by</th><th>Reference</th><th>Date</th></tr></thead>
            <tbody>
              {toSettle.length + settled.length === 0 && <tr><td colSpan={7} className="g2-muted">Nothing approved yet.</td></tr>}
              {[...toSettle, ...settled].map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpenClaim(c.id)}>
                  <td className="g2-mono">{c.no}</td><td>{c.partnerName}</td><td className="g2-small">{sName(c.schemeId)}</td><td style={{ textAlign: 'right' }}>{inr(c.approvedAmount ?? 0)}</td>
                  <td>{c.settlement ? c.settlement.method : <Badge tone="amber">To settle</Badge>}</td><td className="g2-mono g2-small">{c.settlement?.ref ?? '—'}</td><td className="g2-small">{c.settlement?.at.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {openScheme && <SchemeModal id={openScheme === 'new' ? null : openScheme} onClose={() => setOpenScheme(null)} />}
      {openClaim && <ClaimModal id={openClaim} canApprove={canApprove} onClose={() => setOpenClaim(null)} />}
      {newClaim && <NewClaimModal onClose={() => setNewClaim(false)} onOpen={setOpenClaim} />}
    </div>
  );
};
export default ClaimsPage;
