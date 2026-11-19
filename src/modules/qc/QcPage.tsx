/**
 * Quality control: one queue for goods in Quarantine from purchases, imports and returns; inspection plans;
 * inspector records, a different QC approver releases.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, PauseCircle, ShieldCheck, Undo2 } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, MultiSelect, NumberInput, PageHeader, Segmented, Select, Switch, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { opt } from '../../platform/moduleOptions';
import { useApp } from '../../context/AppContext.tsx';
import { useOrderCtx } from '../orders/useOrderCtx';
import { ensureProcurementDemo, subscribeProcurement } from '../procurement/procurementStore';
import { gstOf } from '../pricing/pricingStore';
import { subscribeReturns } from '../returns/returnStore';
import type { Outcome } from '../returns/returnStore';
import { SOURCES, attachCoa, getInspection, hold, inspections as allInspections, plans as allPlans, record, release, savePlan, subscribeQc, syncQueue } from './qcStore';
import type { CheckResult, Plan, Source } from './qcStore';

const TONE: Record<string, BadgeTone> = { 'To inspect': 'amber', 'Awaiting release': 'blue', Released: 'green', 'On hold': 'red' };
const SRC_TONE: Record<Source, BadgeTone> = { 'Purchase receipt': 'slate', Import: 'purple', Return: 'cyan' };

const InspectionModal: React.FC<{ id: string; onClose: () => void; canInspect: boolean; canRelease: boolean }> = ({ id, onClose, canInspect, canRelease }) => {
  useSubscribe(subscribeQc);
  const { currentUser, showToast } = useApp();
  const ctx = useOrderCtx();
  const i = getInspection(id);
  const plan = allPlans().find((p) => p.id === i?.planId);
  const [checks, setChecks] = useState<Record<string, CheckResult>>(i?.checks ?? {});
  const [sampled, setSampled] = useState(i?.sampled || (plan ? Math.ceil(((i?.lines.reduce((a, l) => a + l.qty, 0) ?? 0) * plan.samplePct) / 100) : 0));
  const [lines, setLines] = useState<Record<string, { accepted: number; held: number; reason: string; returnOutcome?: Outcome }>>(() => Object.fromEntries((i?.lines ?? []).map((l) => [l.key, { accepted: l.accepted, held: 0, reason: l.reason, returnOutcome: l.returnOutcome && l.returnOutcome !== 'Restock' ? l.returnOutcome : 'Scrap' }])));
  const [coa, setCoa] = useState(i?.coa ?? '');
  const [files, setFiles] = useState<string[]>(i?.attachments ?? []);
  const [holdWhy, setHoldWhy] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  if (!i) return null;
  const editing = ['To inspect', 'On hold'].includes(i.status) && canInspect;
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok) setErrs(r.errors ?? [r.message]); else { setErrs([]); showToast(r.message, 'success'); } return r.ok; };
  return (
    <Modal open size="xl" title={<span className="g2-row" style={{ gap: 8 }}>{i.no} · {i.party} <Badge tone={SRC_TONE[i.source]}>{i.source}</Badge><Badge tone={TONE[i.status]} dot>{i.status}</Badge></span>}
      subtitle={`${i.refNo} · received ${i.receivedAt.slice(0, 16).replace('T', ' ')} by ${i.receivedBy} · plan: ${plan?.name ?? 'none'}`} onClose={onClose}
      footer={<>
        {i.status !== 'Released' && canInspect && <Button icon={<PauseCircle size={15} />} onClick={() => setHoldWhy('')}>Hold lot</Button>}
        {editing && <Button variant="primary" icon={<ClipboardCheck size={15} />} onClick={() => tell(record(i.id, { checks, sampled, lines, attachments: files, coa }, currentUser.name))}>Record inspection</Button>}
        {i.status === 'Awaiting release' && canRelease && <Button variant="success" icon={<ShieldCheck size={15} />} onClick={() => { if (tell(release(i.id, currentUser.name, ctx))) onClose(); }}>Release</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t do that yet" />}
        {i.status === 'Awaiting release' && !canRelease && <Alert tone="info">Recorded by {i.inspectedBy}. A QC approver (not the receiver or inspector) releases it.</Alert>}
        {plan?.coaRequired && !i.coa && !coa && <Alert tone="warn">This plan needs a certificate of analysis / conformity — release is blocked until it is attached (QC-05).</Alert>}
        <div className="g2-grid g2-grid-2">
          <Card title="Checks" subtitle={plan ? `${plan.samplePct}% sample` : 'No plan matched — record the result'}>
            <div className="g2-stack" style={{ gap: 8 }}>
              {(plan?.checks ?? []).map((c) => (
                <div key={c} className="g2-row" style={{ gap: 8, justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>{c}</span>
                  {editing ? <Segmented options={[{ id: 'Pass', label: 'Pass' }, { id: 'Fail', label: 'Fail' }, { id: 'N/A', label: 'N/A' }]} value={checks[c] ?? ''} onChange={(v) => setChecks({ ...checks, [c]: v as CheckResult })} /> : <Badge tone={i.checks[c] === 'Fail' ? 'red' : i.checks[c] === 'Pass' ? 'green' : 'slate'}>{i.checks[c] ?? '—'}</Badge>}
                </div>
              ))}
              <Field label="Units inspected"><NumberInput value={sampled} disabled={!editing} onChange={(v) => setSampled(v ?? 0)} /></Field>
            </div>
          </Card>
          <Card title="Evidence">
            <FormGrid cols={2}>
              <Field label={`Certificate of analysis / conformity${plan?.coaRequired ? ' (required)' : ''}`}><Input value={coa} disabled={i.status === 'Released'} placeholder="Certificate number / file" onChange={(e) => setCoa(e.target.value)} onBlur={() => { if (!editing && coa !== i.coa) attachCoa(i.id, coa, currentUser.name); }} /></Field>
              <Field label="Photos / reports"><input type="file" multiple disabled={!editing} onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)])} /></Field>
            </FormGrid>
            {files.length > 0 && <div className="g2-small" style={{ marginTop: 6 }}>📎 {files.join(', ')}</div>}
          </Card>
        </div>
        <Card title="Decision per line" subtitle={i.source === 'Return' ? 'A returned line is restocked or rejected as a whole; rejected lines are scrapped or returned to the manufacturer' : 'Accepted → Available; rejected → return to vendor and debit note (QC-04)'} flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product · batch</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ width: 130 }}>Accept</th>{i.source === 'Return' && <th style={{ width: 200 }}>If rejected</th>}<th>Reason (reject)</th></tr></thead>
            <tbody>{i.lines.map((l) => { const x = lines[l.key]; return (
              <tr key={l.key}>
                <td>{l.name}<div className="g2-cell-sub g2-mono">{l.batch}</div></td><td style={{ textAlign: 'right' }}>{l.qty}</td>
                <td>{editing ? (i.source === 'Return' ? <Select value={x.accepted === l.qty ? 'all' : 'none'} options={[{ value: 'all', label: 'Restock all' }, { value: 'none', label: 'Reject' }]} onChange={(v) => setLines({ ...lines, [l.key]: { ...x, accepted: v === 'all' ? l.qty : 0 } })} /> : <NumberInput value={x.accepted} onChange={(v) => setLines({ ...lines, [l.key]: { ...x, accepted: v ?? 0 } })} />) : <span>{l.accepted}{l.rejected ? <span style={{ color: '#b91c1c' }}> · {l.rejected} rejected</span> : ''}</span>}</td>
                {i.source === 'Return' && <td>{editing ? <Select value={x.returnOutcome ?? 'Scrap'} disabled={x.accepted === l.qty} options={[{ value: 'Scrap', label: 'Scrap' }, { value: 'Return to manufacturer', label: 'Return to manufacturer' }]} onChange={(v) => setLines({ ...lines, [l.key]: { ...x, returnOutcome: v as Outcome } })} /> : l.accepted === l.qty ? '—' : l.returnOutcome}</td>}
                <td>{editing ? <Input value={x.reason} placeholder={x.accepted < l.qty ? 'Required' : ''} onChange={(e) => setLines({ ...lines, [l.key]: { ...x, reason: e.target.value } })} /> : <span className="g2-small">{l.reason || '—'}</span>}</td>
              </tr>
            ); })}</tbody>
          </table></div>
        </Card>
        {i.outcome && <Alert tone="success">{i.outcome}</Alert>}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{i.history.map((h, k) => <div key={k} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>
      </div>
      {holdWhy !== null && (
        <Modal open variant="modal" title="Hold the lot" onClose={() => setHoldWhy(null)} footer={<><Button onClick={() => setHoldWhy(null)}>Cancel</Button><Button variant="danger" onClick={() => { if (tell(hold(i.id, holdWhy, currentUser.name))) setHoldWhy(null); }}>Hold</Button></>}>
          <Field label="Why" required hint="e.g. waiting for the supplier’s certificate; stays in Quarantine"><Textarea rows={2} value={holdWhy} onChange={(e) => setHoldWhy(e.target.value)} /></Field>
        </Modal>
      )}
    </Modal>
  );
};

const PlanModal: React.FC<{ plan: Plan | null; onClose: () => void; canEdit: boolean }> = ({ plan, onClose, canEdit }) => {
  const { products, showToast } = useApp();
  const [p, setP] = useState<Plan>(plan ?? { id: '', name: '', sources: ['Purchase receipt'], productIds: [], checks: ['Packaging intact'], samplePct: 10, coaRequired: false, active: true });
  return (
    <Modal open size="lg" title={plan ? plan.name : 'New inspection plan'} subtitle="Which goods it covers, what to check, how much to sample" onClose={onClose}
      footer={canEdit ? <Button variant="primary" onClick={() => { if (!p.name.trim() || !p.checks.length) { showToast('Give a name and at least one check.', 'warning'); return; } savePlan(p); showToast('Plan saved.', 'success'); onClose(); }}>Save plan</Button> : undefined}>
      <div className="g2-stack">
        <FormGrid>
          <Field label="Name" required><Input value={p.name} disabled={!canEdit} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <Field label="Sample %"><NumberInput value={p.samplePct} disabled={!canEdit} onChange={(v) => setP({ ...p, samplePct: Math.max(1, Math.min(100, v ?? 10)) })} /></Field>
          <Field label="Applies to"><MultiSelect values={p.sources} disabled={!canEdit} options={SOURCES.map((s) => ({ value: s, label: s }))} onChange={(v) => setP({ ...p, sources: v as Source[] })} /></Field>
          <Field label="Only these products" hint="Empty = every product from those sources"><MultiSelect values={p.productIds} disabled={!canEdit} options={products.map((x) => ({ value: x.id, label: x.name, description: x.code }))} onChange={(v) => setP({ ...p, productIds: v })} /></Field>
        </FormGrid>
        <div className="g2-row" style={{ gap: 16 }}><span className="g2-row" style={{ gap: 6 }}><Switch checked={p.coaRequired} disabled={!canEdit} onChange={(v) => setP({ ...p, coaRequired: v })} label="CoA" /> Certificate of analysis required (QC-05)</span><span className="g2-row" style={{ gap: 6 }}><Switch checked={p.active} disabled={!canEdit} onChange={(v) => setP({ ...p, active: v })} label="Active" /> Active</span></div>
        <Field label="Checks (one per line)"><Textarea rows={6} disabled={!canEdit} value={p.checks.join('\n')} onChange={(e) => setP({ ...p, checks: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></Field>
      </div>
    </Modal>
  );
};

const QcPage: React.FC = () => {
  useSubscribe(subscribeQc, subscribeProcurement, subscribeReturns);
  const { activePrincipal, currentUser, products, warehouses } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'queue';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [open, setOpen] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null | 'new'>(null);
  const m = currentUser.matrix; const roles = currentUser.role ?? '';
  const admin = !m || roles.includes('Administrator');
  const canInspect = admin || roles.includes('QC Inspector') || roles.includes('QC Approver') || !!m?.inventory?.includes('edit');
  const canRelease = admin || roles.includes('QC Approver') || !!m?.inventory?.includes('approve');
  useEffect(() => { ensureProcurementDemo(activePrincipal.id, products.filter((p) => p.lifecycleStatus === 'Active').slice(0, 3).map((p) => ({ id: p.id, name: p.name, price: p.pricingReference?.mrp ?? 20000, gstPct: gstOf(p) })), warehouses[0]?.id ?? ''); }, [activePrincipal.id, products.length, warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { syncQueue(activePrincipal.id, (pid) => (products.find((x) => x.id === pid)?.trackingRules?.mode ?? '').includes('Serial'), (pid) => products.find((x) => x.id === pid)?.name ?? pid); });
  const all = allInspections(activePrincipal.id);
  const queue = all.filter((i) => i.status !== 'Released');
  const done = all.filter((i) => i.status === 'Released');
  const units = (st: string) => all.filter((i) => i.status === st).reduce((a, i) => a + i.lines.reduce((s, l) => s + l.qty, 0), 0);
  const insp = done.flatMap((i) => i.lines); const rejPct = insp.length ? Math.round((insp.reduce((a, l) => a + l.rejected, 0) / Math.max(1, insp.reduce((a, l) => a + l.qty, 0))) * 1000) / 10 : null;
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Quality Control" description="Everything in Quarantine — purchase receipts, imports and partner returns — inspected against a plan and released by a second person. Only accepted goods become sellable." />
      {(!opt('inventory', 'quarantine') || !opt('procurement', 'inspection')) && <Alert tone="warn">Receipts are not held for inspection — {!opt('inventory', 'quarantine') ? 'Inventory → “Quarantine until QC accepts receipts”' : 'Procurement → “Inspect receipts before stock is sellable”'} is off in Modules, so purchased goods become sellable on receipt. Returns still come here.</Alert>}
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="To inspect" value={all.filter((i) => i.status === 'To inspect').length} icon={<ClipboardCheck size={22} />} color="#d97706" bg="#fffbeb" foot={`${units('To inspect')} unit(s) in Quarantine`} />
        <KpiCard label="Awaiting release" value={all.filter((i) => i.status === 'Awaiting release').length} icon={<ShieldCheck size={22} />} color="#2563eb" bg="#eff6ff" foot={canRelease ? 'you can release' : 'QC approver needed'} />
        <KpiCard label="On hold" value={all.filter((i) => i.status === 'On hold').length} icon={<PauseCircle size={22} />} color="#dc2626" bg="#fef2f2" foot={`${units('On hold')} unit(s)`} />
        <KpiCard label="Rejection rate" value={rejPct === null ? '—' : `${rejPct}%`} icon={<Undo2 size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${done.length} lot(s) released`} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'queue', label: 'Queue', count: queue.length || undefined }, { id: 'done', label: 'Released', count: done.length || undefined }, { id: 'plans', label: 'Inspection plans', count: allPlans().length }]} /></div>
        {(tab === 'queue' || tab === 'done') && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Inspection</th><th>From</th><th>Source document</th><th>Products</th><th style={{ textAlign: 'right' }}>Units</th><th>Status</th></tr></thead>
            <tbody>
              {(tab === 'queue' ? queue : done).length === 0 && <tr><td colSpan={6} className="g2-muted">{tab === 'queue' ? 'Nothing waiting in Quarantine.' : 'Nothing released yet.'}</td></tr>}
              {(tab === 'queue' ? queue : done).map((i) => (
                <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(i.id)}>
                  <td className="g2-mono">{i.no}<div className="g2-cell-sub">{i.receivedAt.slice(0, 10)}</div></td>
                  <td>{i.party}<div className="g2-cell-sub"><Badge tone={SRC_TONE[i.source]}>{i.source}</Badge></div></td>
                  <td className="g2-small g2-mono">{i.refNo}</td>
                  <td className="g2-small">{i.lines.map((l) => l.name).join('; ').slice(0, 90)}</td>
                  <td style={{ textAlign: 'right' }}>{i.lines.reduce((a, l) => a + l.qty, 0)}{i.status === 'Released' && <div className="g2-cell-sub">{i.lines.reduce((a, l) => a + l.accepted, 0)} accepted</div>}</td>
                  <td><Badge tone={TONE[i.status]} dot>{i.status}</Badge>{i.inspectedBy && i.status === 'Awaiting release' && <div className="g2-cell-sub">by {i.inspectedBy}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {tab === 'plans' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-row"><span className="g2-small g2-muted">The most specific active plan is used: one naming the product, else serialised goods get the every-unit plan and the rest the sample plan.</span><span className="g2-spacer" />{admin && <Button onClick={() => setPlan('new')}>New plan</Button>}</div>
            {allPlans().map((p) => (
              <Card key={p.id} title={<span className="g2-row" style={{ gap: 8 }}>{p.name}{!p.active && <Badge tone="slate">inactive</Badge>}{p.coaRequired && <Badge tone="purple">CoA required</Badge>}</span>} subtitle={`${p.sources.join(', ')} · ${p.samplePct}% sample${p.productIds.length ? ` · ${p.productIds.length} product(s)` : ''}`} actions={<Button size="sm" onClick={() => setPlan(p)}>Open</Button>}>
                <div className="g2-small">{p.checks.map((c) => <div key={c}><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> {c}</div>)}</div>
              </Card>
            ))}
          </div>
        )}
      </Card>
      {open && <InspectionModal id={open} canInspect={canInspect} canRelease={canRelease} onClose={() => setOpen(null)} />}
      {plan && <PlanModal plan={plan === 'new' ? null : plan} canEdit={admin} onClose={() => setPlan(null)} />}
    </div>
  );
};
export default QcPage;
