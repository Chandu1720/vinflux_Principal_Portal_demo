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
import { useConfig, usePartners } from '../gtm-v2/hooks/useGtmData';
import { ensurePlatformDemo, ensureSecondaryDemo, logAccess, setupOf, subscribeSecondary, thisPeriod } from '../secondary/secondaryStore';
import { CUSTOMER_TYPES } from '../secondary/secondaryStore';
import {
  SOURCE_LABEL, TYPE_HINT, TYPE_LABEL, claimSchemes, claims as allClaims, closeScheme, committedOf, computeClaims, decideClaim, decideScheme, ensureClaimsDemo, getClaim, getScheme,
  raiseClaim, saveDraft, settleClaim, spentOf, submitScheme, subscribeClaims, verify,
  CLAIM_SLA_DAYS, KIND_HINT, OTHER_KINDS, VERIFIED_TYPES, checkOtherClaim, claimAge, ensureOtherClaimsDemo, isVirtual, kindOf, raiseOtherClaim, simulate,
} from './claimsStore';
import type { ClaimKind, ClaimScheme, ClaimStatus, SchemeStatus, SchemeType, Settlement } from './claimsStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const SCHEME_TONE: Record<SchemeStatus, BadgeTone> = { Draft: 'slate', 'Pending approval': 'amber', Active: 'green', Closed: 'slate', Rejected: 'red' };
const CLAIM_TONE: Record<ClaimStatus, BadgeTone> = { 'Under review': 'amber', Approved: 'blue', 'Partly approved': 'purple', Settled: 'green', Rejected: 'slate' };
const benefit = (s: ClaimScheme) => (s.type === 'SLAB' ? (s.slabs ?? []).map((x, i, a) => `${x.from}${a[i + 1] ? `–${a[i + 1].from - 1}` : '+'} units → ${x.pct}%`).join(' · ') : s.type === 'FREE_GOODS' ? `Buy ${s.buy ?? 0} get ${s.free ?? 0} free` : s.type === 'PER_UNIT' ? `${inr(s.rate)} per unit${s.customerTypes.length ? ` sold to ${s.customerTypes.join(', ').toLowerCase()}` : ''}` : s.type === 'TARGET' ? `${s.incentivePct}% of sales if ≥ ${inr(s.targetValue)} / month` : s.type === 'DISPLAY' ? `${inr(s.rate)} per outlet` : 'List minus approved tender price');

/* ---------------------------------- Scheme builder ---------------------------------- */

const SchemeModal: React.FC<{ id: string | null; onClose: () => void }> = ({ id, onClose }) => {
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const types = useConfig().data?.partnerTypes ?? [];
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
          {s.type === 'FREE_GOODS' && <Field label="Buy (units sold)" required><NumberInput value={s.buy ?? 0} disabled={ro} onChange={(v) => setS({ ...s, buy: v ?? 0 })} /></Field>}
          {s.type === 'FREE_GOODS' && <Field label="Get free (units)" required><NumberInput value={s.free ?? 0} disabled={ro} onChange={(v) => setS({ ...s, free: v ?? 0 })} /></Field>}
          {s.type === 'DISPLAY' && <Field label="₹ per outlet" required><NumberInput value={s.rate} disabled={ro} onChange={(v) => setS({ ...s, rate: v ?? 0 })} /></Field>}
          <Field label="Budget (₹)" required><NumberInput value={s.budget} disabled={ro} onChange={(v) => setS({ ...s, budget: v ?? 0 })} /></Field>
          <Field label="Claim window (days after end)"><NumberInput value={s.claimWindowDays} disabled={ro} onChange={(v) => setS({ ...s, claimWindowDays: v ?? 0 })} /></Field>
          <Field label="Settle by"><Select value={s.settlement} disabled={ro} options={['Credit note', 'Free goods', 'Payment'].map((x) => ({ value: x, label: x }))} onChange={(v) => setS({ ...s, settlement: v as Settlement })} /></Field>
          <Field label="Combines with other schemes?" hint="If not, a sale used here can’t be claimed under another scheme (SCH-04)"><Select value={s.stackable ? 'yes' : 'no'} disabled={ro} options={[{ value: 'no', label: 'No — exclusive' }, { value: 'yes', label: 'Yes — can stack' }]} onChange={(v) => setS({ ...s, stackable: v === 'yes' })} /></Field>
        </FormGrid>
        <Field label="Products" required={s.type !== 'DISPLAY'}><MultiSelect values={s.productIds} disabled={ro} options={products.filter((p) => p.lifecycleStatus === 'Active').map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setS({ ...s, productIds: v })} /></Field>
        {s.type === 'SLAB' && (
          <Card title="Slabs" subtitle="Units the partner sells in the month → % of that month’s secondary sales value" actions={ro ? undefined : <Button size="sm" icon={<Plus size={13} />} onClick={() => setS({ ...s, slabs: [...(s.slabs ?? []), { from: ((s.slabs ?? []).slice(-1)[0]?.from ?? 0) + 20, pct: ((s.slabs ?? []).slice(-1)[0]?.pct ?? 0) + 2 }] })}>Add slab</Button>}>
            <div className="g2-stack" style={{ gap: 6 }}>{(s.slabs ?? []).map((x, i, a) => (
              <div key={i} className="g2-row" style={{ gap: 8 }}><span className="g2-small" style={{ width: 70 }}>From units</span><div style={{ width: 110 }}><NumberInput value={x.from} disabled={ro} onChange={(v) => setS({ ...s, slabs: a.map((y, j) => (j === i ? { ...y, from: v ?? 0 } : y)) })} /></div>
                <span className="g2-small">→</span><div style={{ width: 90 }}><NumberInput value={x.pct} disabled={ro} onChange={(v) => setS({ ...s, slabs: a.map((y, j) => (j === i ? { ...y, pct: v ?? 0 } : y)) })} /></div><span className="g2-small">%</span>
                {!ro && <Button size="sm" onClick={() => setS({ ...s, slabs: a.filter((_, j) => j !== i) })}>Remove</Button>}</div>
            ))}</div>
          </Card>
        )}
        <Field label="Partner types (tiers)" hint="Empty = every type"><MultiSelect values={s.partnerTypeIds ?? []} disabled={ro} options={types.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => setS({ ...s, partnerTypeIds: v })} /></Field>
        <Field label="Partners" hint="Empty = every partner"><MultiSelect values={s.partnerIds} disabled={ro} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setS({ ...s, partnerIds: v })} /></Field>
        {['DISPLAY', 'PRICE_SUPPORT'].includes(s.type) && <Field label="Evidence required" required><Input value={s.evidence} disabled={ro} placeholder="e.g. Photo of the stand and the outlet’s stamp" onChange={(e) => setS({ ...s, evidence: e.target.value })} /></Field>}
        {(() => { const sim = simulate(s, activePrincipal.id, partners.map((p) => ({ id: p.id, partnerTypeId: p.partnerTypeId }))); return (
          <Card title={<span className="g2-row" style={{ gap: 6 }}><Calculator size={15} /> Simulate cost and return</span>} subtitle={`From the last 3 months of verified secondary sales at ${sim.partners} eligible partner(s), over ${sim.months} month(s)`}>
            <div className="g2-row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ width: 160 }}><Field label="Expected sales uplift %"><NumberInput value={s.uplift ?? 10} disabled={ro} onChange={(v) => setS({ ...s, uplift: v ?? 0 })} /></Field></div>
              <div><div className="g2-small g2-muted">Sales now (per month)</div><div style={{ fontWeight: 700 }}>{inr(sim.baseValue)}</div></div>
              <div><div className="g2-small g2-muted">Extra sales (period)</div><div style={{ fontWeight: 700 }}>{inr(sim.incremental)}</div></div>
              <div><div className="g2-small g2-muted">Estimated scheme cost</div><div style={{ fontWeight: 700 }}>{inr(sim.cost)}</div></div>
              <div><div className="g2-small g2-muted">Return</div><div style={{ fontWeight: 700, color: sim.roi === null ? undefined : sim.roi >= 2 ? '#15803d' : '#b45309' }}>{sim.roi === null ? '—' : `${sim.roi}×`}</div></div>
            </div>
            <div style={{ marginTop: 10 }}>{sim.note ? <Alert tone="info">{sim.note}</Alert> : s.budget > 0 && sim.cost > s.budget ? <Alert tone="error">Estimated cost {inr(sim.cost)} is above the budget {inr(s.budget)} — raise the budget or tighten the rules.</Alert> : s.budget > 0 ? <Alert tone="success">Estimated cost fits the budget ({Math.round((sim.cost / s.budget) * 100)}% of {inr(s.budget)}).</Alert> : null}</div>
          </Card>
        ); })()}
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
  const { products } = useApp();
  const virt = !!c && isVirtual(c.schemeId);
  const [amt, setAmt] = useState<number>(c ? (s && (VERIFIED_TYPES.includes(s.type) || virt) ? Math.min(c.claimedAmount, c.computedAmount) : c.claimedAmount) : 0);
  useEffect(() => { if (c && setupOf(c.partnerId).onPlatform) logAccess(c.partnerId, `Viewed claim ${c.no}`, currentUser.name); }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const [ref, setRef] = useState('');
  if (!c || !s) return null;
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  const left = virt ? Infinity : s.budget - spentOf(s.id);
  const pName = products.find((x) => x.id === c.productId)?.name;
  const erp = optChoice('orders', 'invoicing') !== 'vinflux';
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{c.no} · {c.partnerName} <Badge tone={CLAIM_TONE[c.status]} dot>{c.status}</Badge></span>} subtitle={virt ? `${kindOf(c)} claim · ${pName ?? ''}${c.batch ? ` · batch ${c.batch}` : ''}${c.serial ? ` · serial ${c.serial}` : ''}${c.docRef ? ` · ${c.docRef}` : ''} · ${SOURCE_LABEL[c.source]} · ${claimAge(c)} d old (SLA ${CLAIM_SLA_DAYS} d)` : `${s.code} ${s.name} · ${c.period} · ${SOURCE_LABEL[c.source]} · ${claimAge(c)} d old (SLA ${CLAIM_SLA_DAYS} d)`} onClose={onClose}>
      <div className="g2-stack">
        {c.flags.length > 0 && <Alert tone="warn"><div className="g2-stack" style={{ gap: 4 }}>{c.flags.map((f, i) => <div key={i}>{f}</div>)}</div></Alert>}
        <div className="g2-grid g2-grid-3">
          <Card title="Claimed"><div style={{ fontSize: 22, fontWeight: 700 }}>{inr(c.claimedAmount)}</div><div className="g2-small g2-muted">{s.type === 'PER_UNIT' || s.type === 'DISPLAY' ? `${c.claimedQty} ${s.type === 'DISPLAY' ? 'outlet(s)' : 'unit(s)'}` : ''}</div></Card>
          <Card title={virt ? 'Supported by records' : VERIFIED_TYPES.includes(s.type) ? 'Verified from secondary data' : 'Per scheme terms'}><div style={{ fontSize: 22, fontWeight: 700, color: c.computedAmount < c.claimedAmount ? '#b45309' : undefined }}>{inr(c.computedAmount)}</div><div className="g2-small g2-muted">{virt ? `${c.claimedQty} unit(s) claimed` : s.type === 'PER_UNIT' ? `${c.verifiedQty} unit(s) reconciled` : VERIFIED_TYPES.includes(s.type) ? benefit(s) : 'checked against evidence'}</div></Card>
          {virt ? <Card title="Checks passed"><div style={{ fontSize: 22, fontWeight: 700, color: (c.checks ?? []).every((x) => x.ok) ? '#15803d' : '#b45309' }}>{(c.checks ?? []).filter((x) => x.ok).length}/{(c.checks ?? []).length}</div><div className="g2-small g2-muted">against VinFlux records</div></Card>
            : <Card title="Budget left"><div style={{ fontSize: 22, fontWeight: 700 }}>{inr(left)}</div><div className="g2-small g2-muted">of {inr(s.budget)}</div></Card>}
        </div>
        {virt && (c.checks ?? []).length > 0 && (
          <Card title="Automatic checks" subtitle={KIND_HINT[kindOf(c) as Exclude<ClaimKind, 'Scheme'>]}>
            <div className="g2-stack" style={{ gap: 6 }}>{(c.checks ?? []).map((x, i) => <div key={i} className="g2-row g2-small" style={{ gap: 8, alignItems: 'flex-start' }}><span style={{ color: x.ok ? '#15803d' : '#b91c1c', fontWeight: 700, width: 14 }}>{x.ok ? '✓' : '✗'}</span><div>{x.rule}{x.note && <div className="g2-muted">{x.note}</div>}</div></div>)}</div>
          </Card>
        )}
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
  const { activePrincipal, currentUser, showToast, products } = useApp();
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const live = claimSchemes(activePrincipal.id).filter((s) => ['Active', 'Closed'].includes(s.status));
  const [kind, setKind] = useState<ClaimKind>('Scheme');
  const [o, setO] = useState({ productId: '', batch: '', serial: '', docRef: '' });
  const [f, setF] = useState({ schemeId: live[0]?.id ?? '', partnerId: '', period: thisPeriod(), qty: 0, amount: 0, evidence: '', source: 'desk' as 'desk' | 'partner' });
  const [errs, setErrs] = useState<string[]>([]);
  const s = getScheme(f.schemeId);
  const v = s && f.partnerId && VERIFIED_TYPES.includes(s.type) ? verify(s, f.partnerId, f.period, activePrincipal.id) : null;
  const other = kind !== 'Scheme' ? { principalId: activePrincipal.id, kind: kind as Exclude<ClaimKind, 'Scheme'>, partnerId: f.partnerId, partnerName: partners.find((x) => x.id === f.partnerId)?.name ?? '', ...o, qty: kind === 'Warranty' ? 1 : f.qty, amount: f.amount, evidence: f.evidence, source: f.source, by: currentUser.name } : null;
  const pre = other && f.partnerId && o.productId ? checkOtherClaim(other, products) : null;
  const save = () => {
    const p = partners.find((x) => x.id === f.partnerId);
    if (other) { const r0 = raiseOtherClaim({ ...other, by: f.source === 'partner' ? `${p?.name ?? 'Partner'} (portal)` : currentUser.name }, products); if (!r0.ok) { setErrs(r0.errors ?? [r0.message]); return; } showToast(r0.message, 'success'); onClose(); if (r0.id) onOpen(r0.id); return; }
    const amount = s?.type === 'DISPLAY' ? f.qty * s.rate : f.amount;
    const r = raiseClaim({ principalId: activePrincipal.id, schemeId: f.schemeId, partnerTypeId: p?.partnerTypeId, partnerId: f.partnerId, partnerName: p?.name ?? '', period: f.period, source: f.source, claimedQty: f.qty, claimedAmount: amount, evidence: f.evidence, by: f.source === 'partner' ? `${p?.name ?? 'Partner'} (portal)` : currentUser.name });
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="lg" title="Raise a claim" subtitle="On a partner’s behalf, or as the partner would on Partner Lite" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Raise claim</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t raise yet" />}
        <Field label="Claim type"><div className="g2-row" style={{ gap: 6, flexWrap: 'wrap' }}>{(['Scheme', ...OTHER_KINDS] as ClaimKind[]).map((k) => <Button key={k} size="sm" variant={kind === k ? 'primary' : 'secondary'} onClick={() => setKind(k)}>{k}</Button>)}</div></Field>
        {kind !== 'Scheme' && <Alert tone="info">{KIND_HINT[kind as Exclude<ClaimKind, 'Scheme'>]}</Alert>}
        {kind !== 'Scheme' ? (
          <FormGrid>
            <Field label="Partner" required><SearchableSelect value={f.partnerId} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v2) => setF({ ...f, partnerId: v2 ?? '' })} /></Field>
            <Field label="Product" required><SearchableSelect value={o.productId || null} options={products.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v2) => setO({ ...o, productId: v2 ?? '' })} /></Field>
            {kind === 'Warranty' ? <Field label="Serial number" required><Input value={o.serial} onChange={(e) => setO({ ...o, serial: e.target.value })} /></Field> : <Field label="Batch"><Input value={o.batch} onChange={(e) => setO({ ...o, batch: e.target.value })} /></Field>}
            {kind === 'Damage' && <Field label="Shipment or invoice no." required><Input value={o.docRef} onChange={(e) => setO({ ...o, docRef: e.target.value })} placeholder="e.g. SHP-26-0003" /></Field>}
            {kind !== 'Warranty' && <Field label="Quantity" required><NumberInput value={f.qty} onChange={(x) => setF({ ...f, qty: x ?? 0 })} /></Field>}
            <Field label="Amount claimed (₹)" required><NumberInput value={f.amount} onChange={(x) => setF({ ...f, amount: x ?? 0 })} /></Field>
            <Field label="Raised by"><Select value={f.source} options={[{ value: 'desk', label: 'Our team (on behalf)' }, { value: 'partner', label: 'The partner (demo of Partner Lite)' }]} onChange={(v2) => setF({ ...f, source: v2 as 'desk' | 'partner' })} /></Field>
          </FormGrid>
        ) : (
        <FormGrid>
          <Field label="Scheme" required><Select value={f.schemeId} options={live.map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))} onChange={(v2) => setF({ ...f, schemeId: v2 })} /></Field>
          <Field label="Partner" required><SearchableSelect value={f.partnerId} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v2) => setF({ ...f, partnerId: v2 ?? '' })} /></Field>
          <Field label="Month" required><Input type="month" value={f.period} max={thisPeriod()} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
          <Field label="Raised by"><Select value={f.source} options={[{ value: 'desk', label: 'Our team (on behalf)' }, { value: 'partner', label: 'The partner (demo of Partner Lite)' }]} onChange={(v2) => setF({ ...f, source: v2 as 'desk' | 'partner' })} /></Field>
          {s && s.type !== 'TARGET' && s.type !== 'PRICE_SUPPORT' && <Field label={s.type === 'DISPLAY' ? 'Outlets' : 'Units claimed'}><NumberInput value={f.qty} onChange={(x) => setF({ ...f, qty: x ?? 0, amount: s.type === 'PER_UNIT' ? (x ?? 0) * s.rate : f.amount })} /></Field>}
          {s && s.type !== 'DISPLAY' && <Field label="Amount claimed (₹)"><NumberInput value={f.amount} onChange={(x) => setF({ ...f, amount: x ?? 0 })} /></Field>}
        </FormGrid>
        )}
        {kind !== 'Scheme' && <Field label="Proof / remarks" hint={kind === 'Damage' ? 'Photos, transporter remark' : kind === 'Warranty' ? 'Service or surgeon report' : 'Optional'}><Textarea rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Field>}
        {pre && <Card title="Checks before you raise it" subtitle={`Records support ${inr(pre.supported)}`}><div className="g2-stack" style={{ gap: 4 }}>{pre.checks.map((x, i) => <div key={i} className="g2-small"><span style={{ color: x.ok ? '#15803d' : '#b91c1c', fontWeight: 700 }}>{x.ok ? '✓' : '✗'}</span> {x.rule}{x.note ? <span className="g2-muted"> — {x.note}</span> : null}</div>)}</div></Card>}
        {kind === 'Scheme' && s && ['DISPLAY', 'PRICE_SUPPORT'].includes(s.type) && <Field label="Evidence" required hint={s.evidence}><Textarea rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Field>}
        {kind === 'Scheme' && v && <Alert tone="info">Verified secondary data supports <strong>{inr(v.amount)}</strong>{s?.type === 'PER_UNIT' ? ` (${v.qty} unit(s))` : v.achievedPct !== null ? ` (target ${v.achievedPct}% achieved)` : ''}.{v.excluded.length ? ` Not counted: ${v.excluded.map((e) => `${e.qty ? `${e.qty} — ` : ''}${e.reason}`).join('; ')}.` : ''}</Alert>}
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
  useEffect(() => { if (partners.length && products.length) ensureOtherClaimsDemo(activePrincipal.id, products, partners.map((p) => ({ id: p.id, name: p.name }))); }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (partners.length && products.length) ensureClaimsDemo(activePrincipal.id, products.filter((p) => p.lifecycleStatus === 'Active').map((p) => p.id), partners.slice(0, 3).map((p) => ({ id: p.id, name: p.name }))); }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const schemes = claimSchemes(activePrincipal.id);
  const cl = allClaims(activePrincipal.id);
  const queue = cl.filter((c) => c.status === 'Under review');
  const toSettle = cl.filter((c) => ['Approved', 'Partly approved'].includes(c.status));
  const settled = cl.filter((c) => c.status === 'Settled');
  const leakage = cl.filter((c) => c.status !== 'Rejected').reduce((a, c) => a + Math.max(0, c.claimedAmount - c.computedAmount), 0);
  const pending = schemes.filter((s) => s.status === 'Pending approval');
  const sName = (id: string) => (isVirtual(id) ? `${id.slice(5)} claim` : getScheme(id)?.code ?? id);

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
            <thead><tr><th>Claim</th><th>Partner · month</th><th>Type / scheme</th><th style={{ textAlign: 'right' }}>Claimed</th><th style={{ textAlign: 'right' }}>Verified</th><th style={{ textAlign: 'right' }}>Difference</th><th>SLA</th><th>Status</th></tr></thead>
            <tbody>
              {cl.length === 0 && <tr><td colSpan={8} className="g2-muted">No claims yet.</td></tr>}
              {[...cl].sort((a, b) => (a.status === 'Under review' ? -1 : 1) - (b.status === 'Under review' ? -1 : 1)).map((c) => {
                const diff = c.claimedAmount - c.computedAmount;
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpenClaim(c.id)}>
                    <td className="g2-mono">{c.no}<div className="g2-cell-sub">{SOURCE_LABEL[c.source]}</div></td>
                    <td>{c.partnerName}<div className="g2-cell-sub">{c.period}</div></td>
                    <td className="g2-small">{isVirtual(c.schemeId) ? <><Badge tone="purple">{kindOf(c)}</Badge><div className="g2-cell-sub">{products.find((x) => x.id === c.productId)?.name.slice(0, 36) ?? ''}</div></> : <>{sName(c.schemeId)}<div className="g2-cell-sub">{getScheme(c.schemeId)?.name}</div></>}</td>
                    <td style={{ textAlign: 'right' }}>{inr(c.claimedAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(c.computedAmount)}</td>
                    <td style={{ textAlign: 'right', color: diff > 0 ? '#b91c1c' : undefined }}>{diff > 0 ? `+${inr(diff)}` : '—'}</td>
                    <td className="g2-small" style={{ whiteSpace: 'nowrap', color: c.status === 'Under review' && claimAge(c) > CLAIM_SLA_DAYS ? '#b91c1c' : undefined, fontWeight: c.status === 'Under review' && claimAge(c) > CLAIM_SLA_DAYS ? 700 : undefined }}>{c.status === 'Under review' ? `${claimAge(c)}d / ${CLAIM_SLA_DAYS}d` : '—'}</td>
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
                    {s.status === 'Active' && VERIFIED_TYPES.includes(s.type) && canEdit && <><Button size="sm" icon={<Calculator size={13} />} onClick={() => { const r = computeClaims(activePrincipal.id, s.id, period, partners.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId })), 'VinFlux (period end)'); showToast(r.message, 'success'); }}>Compute {period}</Button> </>}
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
