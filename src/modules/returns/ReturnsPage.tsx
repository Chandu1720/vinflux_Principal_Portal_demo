import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, CircleX, ClipboardCheck, FileText, PackageCheck, Plus, Truck, Undo2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, SearchInput, Select, Stepper, Tabs, Textarea } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { subscribeStock } from '../inventory/stockStore';
import { subscribeOrders } from '../orders/orderStore';
import { useOrderCtx } from '../orders/useOrderCtx';
import { ensureDemo } from '../orders/seedDemo';
import { carriers } from '../logistics/carrierStore';
import {
  REASONS, RETURN_FLOW, approveReturn, checkReturn, createReturn, creditPreview, getReturn, inspectReturn, issueCreditNote, receiveReturn, returnPolicy, returnableFor, returns as listReturns,
  ensureReturnsDemo, savePolicy, schedulePickup, subscribeReturns,
} from './returnStore';
import type { Outcome, ReturnCheck, ReturnPolicy, ReturnReason, ReturnRequest, ReturnStatus, Returnable } from './returnStore';
import type { OrderCtx } from '../orders/orderStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const daysLeft = (iso: string | null) => (iso ? Math.floor((Date.parse(iso) - Date.now()) / 86400000) : null);
const TONE: Record<ReturnStatus, 'blue' | 'amber' | 'purple' | 'green' | 'slate' | 'red'> = { Requested: 'amber', Approved: 'blue', Pickup: 'purple', Received: 'amber', Inspected: 'blue', Credited: 'green', Rejected: 'red' };
const CHECK_ICON: Record<ReturnCheck['state'], React.ReactNode> = { pass: <CheckCircle2 size={16} color="#059669" />, warn: <CircleAlert size={16} color="#d97706" />, fail: <CircleX size={16} color="#dc2626" /> };
const Checks: React.FC<{ checks: ReturnCheck[] }> = ({ checks }) => (
  <div className="g2-grid g2-grid-2" style={{ gap: 6 }}>
    {checks.map((c) => (
      <div key={c.label} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 8, background: c.state === 'fail' ? '#fef2f2' : c.state === 'warn' ? '#fffbeb' : undefined }}>
        <span style={{ flex: 'none', marginTop: 1 }}>{CHECK_ICON[c.state]}</span>
        <div><div className="g2-strong" style={{ fontSize: 13 }}>{c.label}</div><div className="g2-small g2-muted">{c.detail}</div></div>
      </div>
    ))}
  </div>
);

/* ----------------------------------- New return ----------------------------------- */

const NewReturnDrawer: React.FC<{ ctx: OrderCtx; onClose: () => void; onOpen: (id: string) => void }> = ({ ctx, onClose, onOpen }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const [partnerId, setPartnerId] = useState('');
  const [pick, setPick] = useState<Record<string, { qty: number; reason: ReturnReason }>>({});
  const [errs, setErrs] = useState<string[]>([]);
  const candidates = useMemo(() => ctx.partners.filter((p) => returnableFor(p.id, ctx.products).length > 0), [ctx]);
  const rows = partnerId ? returnableFor(partnerId, ctx.products) : [];
  const chosen = rows.filter((r) => pick[r.key]).map((r) => ({ ...r, ...pick[r.key] }));
  const checks = checkReturn(chosen, ctx.products);
  const value = chosen.reduce((a, l) => a + l.qty * l.unitValue, 0);
  const defaultReason = (r: Returnable): ReturnReason => { const d = daysLeft(r.expiryDate); return d !== null && d < 0 ? 'Expired' : d !== null && d <= returnPolicy().nearExpiryDays ? 'Near expiry' : 'Damaged in transit'; };
  const save = () => {
    const p = ctx.partners.find((x) => x.id === partnerId);
    if (!p) { setErrs(['Choose the partner or hospital.']); return; }
    const r = createReturn(activePrincipal.id, p, chosen, ctx.products, currentUser.name);
    if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="xl" title="New return" subtitle="Pick what is coming back from the partner's deliveries. Every line is checked against the delivery and the return policy." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!chosen.length} onClick={save}>Submit return{value ? ` · ${inr(value)}` : ''}</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <Field label="Partner / hospital" required hint={candidates.length ? undefined : 'No partner has delivered goods yet.'}>
          <SearchableSelect value={partnerId} options={candidates.map((p) => ({ value: p.id, label: p.name, description: `${returnableFor(p.id, ctx.products).length} delivered line(s)` }))} onChange={(v) => { setPartnerId(v ?? ''); setPick({}); }} />
        </Field>
        {partnerId && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th style={{ width: 36 }} /><th>Delivered item</th><th>Batch / serial</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Returnable</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 190 }}>Reason</th></tr></thead>
            <tbody>{rows.map((r) => {
              const p = pick[r.key];
              const d = daysLeft(r.expiryDate);
              return (
                <tr key={r.key}>
                  <td><Checkbox checked={!!p} onChange={(v) => { const n = { ...pick }; if (v) n[r.key] = { qty: r.returnable, reason: defaultReason(r) }; else delete n[r.key]; setPick(n); }} /></td>
                  <td><div className="g2-strong">{r.name}</div><div className="g2-cell-sub">{r.orderCode} · {r.shipmentNo} · delivered {r.deliveredAt.slice(0, 10)} · {inr(r.unitValue)} each</div></td>
                  <td className="g2-mono g2-small">{r.batch}{r.serial ? ` · ${r.serial}` : ''}</td>
                  <td>{r.expiryDate ?? '—'}{d !== null && d < 0 ? <> <Badge tone="red">Expired</Badge></> : d !== null && d <= returnPolicy().nearExpiryDays ? <> <Badge tone="amber">{d} d</Badge></> : null}</td>
                  <td style={{ textAlign: 'right' }}>{r.returnable}</td>
                  <td>{p && <NumberInput value={p.qty} aria-label={`Qty ${r.name}`} onChange={(x) => setPick({ ...pick, [r.key]: { ...p, qty: Math.max(0, Math.min(r.returnable, x ?? 0)) } })} />}</td>
                  <td>{p && <Select value={p.reason} options={REASONS.map((x) => ({ value: x, label: x }))} onChange={(x) => setPick({ ...pick, [r.key]: { ...p, reason: x as ReturnReason } })} />}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        {chosen.length > 0 && <Card title="Policy checks"><Checks checks={checks} /></Card>}
      </div>
    </Modal>
  );
};

/* ---------------------------------- Return drawer ---------------------------------- */

const ReturnDrawer: React.FC<{ id: string; ctx: OrderCtx; onClose: () => void }> = ({ id, ctx, onClose }) => {
  useSubscribe(subscribeReturns);
  const { currentUser, showToast } = useApp();
  const r = getReturn(id);
  const [errs, setErrs] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [pk, setPk] = useState({ carrier: carriers().find((c) => c.active)?.name ?? '', awb: '', eta: 3 });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dec, setDec] = useState<Record<string, { outcome: Outcome; note: string }>>({});
  if (!r) return null;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  const canApprove = !m || !!m.gtm?.includes('approve') || !!m.pricing?.includes('approve');
  const pol = returnPolicy();
  const run = (res: { ok: boolean; message: string; errors?: string[] }) => { if (!res.ok) { setErrs([res.message, ...(res.errors ?? [])]); return false; } setErrs([]); showToast(res.message, 'success'); return true; };
  const credit = creditPreview(r);
  const stepIdx = r.status === 'Rejected' ? 0 : RETURN_FLOW.indexOf(r.status);
  const defaultOutcome = (reason: ReturnReason): Outcome => (pol.reasons[reason].restockable ? 'Restock' : reason === 'Quality complaint' || reason === 'Expired' ? 'Return to manufacturer' : 'Scrap');
  const decision = (lid: string, reason: ReturnReason) => dec[lid] ?? { outcome: defaultOutcome(reason), note: '' };

  const footer = (
    <>
      <Button onClick={onClose}>Close</Button>
      {canApprove && r.status === 'Requested' && <><Button variant="danger" onClick={() => run(approveReturn(r.id, false, note, currentUser.name))}>Reject</Button><Button variant="primary" onClick={() => run(approveReturn(r.id, true, note, currentUser.name))}>Approve</Button></>}
      {canEdit && r.status === 'Approved' && <Button variant="primary" icon={<Truck size={14} />} onClick={() => run(schedulePickup(r.id, pk.carrier, pk.awb, pk.eta, ctx.partners, currentUser.name))}>Book pickup</Button>}
      {canEdit && r.status === 'Pickup' && <Button variant="primary" icon={<PackageCheck size={14} />} onClick={() => run(receiveReturn(r.id, counts, ctx, currentUser.name))}>Record receipt</Button>}
      {canEdit && r.status === 'Received' && <Button variant="primary" icon={<ClipboardCheck size={14} />} onClick={() => run(inspectReturn(r.id, Object.fromEntries(r.lines.map((l) => [l.id, decision(l.id, l.reason)])), ctx, currentUser.name))}>Complete returns check</Button>}
      {canApprove && r.status === 'Inspected' && <Button variant="primary" icon={<FileText size={14} />} onClick={() => run(issueCreditNote(r.id, currentUser.name))}>Issue credit note · {inr(credit.reduce((a, c) => a + c.value, 0))}</Button>}
    </>
  );
  return (
    <Modal open size="xl" title={`${r.no} · ${r.partnerName}`} subtitle={<span className="g2-row">Back to {r.toWarehouseName} · requested by {r.requestedBy} {when(r.requestedAt)} <Badge tone={TONE[r.status]} dot>{r.status}</Badge></span>} onClose={onClose} footer={footer}>
      <div className="g2-stack">
        {r.status !== 'Rejected' && <Stepper steps={RETURN_FLOW.map((s) => (s === 'Pickup' ? 'Picked up' : s))} current={r.status === 'Credited' ? RETURN_FLOW.length : stepIdx} maxReached={stepIdx} onSelect={() => undefined} />}
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t continue" />}
        {r.status === 'Rejected' && <Alert tone="error">Rejected: {r.rejectReason}</Alert>}
        {r.status === 'Requested' && <Card title="Policy checks"><Checks checks={r.checks} /></Card>}
        <Card title="Items">
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Item</th><th>Batch / serial</th><th>Reason</th><th style={{ textAlign: 'right' }}>Qty</th>
              {r.status === 'Pickup' && <th style={{ width: 100 }}>Received</th>}{['Received', 'Inspected', 'Credited'].includes(r.status) && <th style={{ textAlign: 'right' }}>Received</th>}
              {r.status === 'Received' && <th style={{ minWidth: 300 }}>Returns check</th>}{['Inspected', 'Credited'].includes(r.status) && <th>Outcome</th>}
              <th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
            <tbody>{r.lines.map((l) => {
              const c = credit.find((x) => x.lineId === l.id)!;
              const d = decision(l.id, l.reason);
              const left = daysLeft(l.expiryDate);
              return (
                <tr key={l.id}>
                  <td><div className="g2-strong">{l.name}</div><div className="g2-cell-sub">{l.orderCode} · {l.shipmentNo}</div></td>
                  <td className="g2-mono g2-small">{l.batch}{l.serial ? ` · ${l.serial}` : ''}<div className="g2-cell-sub">exp {l.expiryDate ?? '—'}{left !== null ? ` (${left} d)` : ''}</div></td>
                  <td className="g2-small">{l.reason}</td>
                  <td style={{ textAlign: 'right' }}>{l.qty}</td>
                  {r.status === 'Pickup' && <td><NumberInput value={counts[l.id] ?? l.qty} aria-label={`Received ${l.name}`} onChange={(x) => setCounts({ ...counts, [l.id]: Math.max(0, Math.min(l.qty, x ?? 0)) })} /></td>}
                  {['Received', 'Inspected', 'Credited'].includes(r.status) && <td style={{ textAlign: 'right' }}>{l.receivedQty}</td>}
                  {r.status === 'Received' && <td><div className="g2-row" style={{ gap: 4 }}>
                    <div style={{ width: 190 }}><Select value={d.outcome} options={(['Restock', 'Scrap', 'Return to manufacturer'] as Outcome[]).map((x) => ({ value: x, label: x === 'Restock' && !pol.reasons[l.reason].restockable ? 'Restock (not allowed)' : x }))} onChange={(x) => setDec({ ...dec, [l.id]: { ...d, outcome: x as Outcome } })} /></div>
                    {d.outcome !== 'Restock' && <Input placeholder="What was wrong / RTM ref." value={d.note} onChange={(e) => setDec({ ...dec, [l.id]: { ...d, note: e.target.value } })} />}
                  </div></td>}
                  {['Inspected', 'Credited'].includes(r.status) && <td className="g2-small">{l.outcome}{l.note ? <div className="g2-cell-sub">{l.note}</div> : null}</td>}
                  <td style={{ textAlign: 'right' }}>{inr(c.value)}<div className="g2-cell-sub">{c.pct}% of {inr(l.unitValue)} × {c.qty}</div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Card>
        {r.pickup && <div className="g2-small">Pickup: {r.pickup.carrier} · <span className="g2-mono">{r.pickup.awb}</span> · booked {when(r.pickup.at)} · ETA {r.pickup.eta}{r.receivedAt ? ` · received ${when(r.receivedAt)}` : ''}</div>}
        {r.creditNote && <Alert tone="success">Credit note <strong>{r.creditNote.no}</strong> dated {r.creditNote.date} for <strong>{inr(r.creditNote.value)}</strong> — goes to the partner ledger in the Finance phase.</Alert>}
        {canEdit && r.status === 'Approved' && (
          <Card title="Reverse pickup" subtitle="The partner hands the goods to the carrier; their stock goes down and the goods are in transit back to us.">
            <FormGrid cols={3}>
              <Field label="Carrier"><Select value={pk.carrier} options={carriers().filter((c) => c.active).map((c) => ({ value: c.name, label: c.name }))} onChange={(x) => setPk({ ...pk, carrier: x })} /></Field>
              <Field label="AWB / LR number" required><Input value={pk.awb} onChange={(e) => setPk({ ...pk, awb: e.target.value })} /></Field>
              <Field label="Days to arrive"><NumberInput value={pk.eta} onChange={(x) => setPk({ ...pk, eta: x ?? 1 })} /></Field>
            </FormGrid>
          </Card>
        )}
        {r.status === 'Received' && <Alert tone="info">Received goods sit in <strong>Quarantine</strong> until checked. Restock puts them back on sale (only reasons that allow it, with enough shelf life left); scrap and return to manufacturer take them out of stock.</Alert>}
        {canApprove && r.status === 'Requested' && <Field label="Note (needed to reject — the partner sees it)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>Timeline</div>
          {r.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {when(x.at)}{x.note ? ` — ${x.note}` : ''}</span></div>)}
        </div>
      </div>
    </Modal>
  );
};

/* ---------------------------------- Policy ---------------------------------- */

const PolicyTab: React.FC<{ canConfigure: boolean }> = ({ canConfigure }) => {
  const { showToast } = useApp();
  const [p, setP] = useState<ReturnPolicy>(returnPolicy());
  const dirty = JSON.stringify(p) !== JSON.stringify(returnPolicy());
  return (
    <div style={{ padding: 16 }} className="g2-stack">
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>Reason</th><th style={{ width: 160 }}>Return window (days after delivery)</th><th style={{ width: 120 }}>Credit %</th><th>Can go back on sale</th></tr></thead>
        <tbody>{REASONS.map((x) => (
          <tr key={x}>
            <td className="g2-strong">{x}</td>
            <td><NumberInput value={p.reasons[x].windowDays} disabled={!canConfigure} onChange={(v) => setP({ ...p, reasons: { ...p.reasons, [x]: { ...p.reasons[x], windowDays: Math.max(1, v ?? 1) } } })} /></td>
            <td><NumberInput value={p.reasons[x].creditPct} disabled={!canConfigure} onChange={(v) => setP({ ...p, reasons: { ...p.reasons, [x]: { ...p.reasons[x], creditPct: Math.max(0, Math.min(100, v ?? 0)) } } })} /></td>
            <td><Checkbox checked={p.reasons[x].restockable} disabled={!canConfigure} onChange={(v) => setP({ ...p, reasons: { ...p.reasons, [x]: { ...p.reasons[x], restockable: v } } })} label={p.reasons[x].restockable ? 'Yes, after the returns check' : 'No — scrap or return to manufacturer'} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <FormGrid>
        <Field label="Approve automatically up to (₹)" hint="Above this, someone other than the requester approves."><NumberInput value={p.autoApproveUpTo} disabled={!canConfigure} onChange={(v) => setP({ ...p, autoApproveUpTo: Math.max(0, v ?? 0) })} /></Field>
        <Field label="“Near expiry” means within (days)"><NumberInput value={p.nearExpiryDays} disabled={!canConfigure} onChange={(v) => setP({ ...p, nearExpiryDays: Math.max(1, v ?? 1) })} /></Field>
      </FormGrid>
      {canConfigure && <div><Button variant="primary" disabled={!dirty} onClick={() => { savePolicy(p); showToast('Return policy saved.', 'success'); }}>Save policy</Button></div>}
    </div>
  );
};

/* ----------------------------------- Page ----------------------------------- */

const TABS: { id: string; label: string; match: (r: ReturnRequest) => boolean }[] = [
  { id: 'requested', label: 'To approve', match: (r) => r.status === 'Requested' },
  { id: 'approved', label: 'To pick up', match: (r) => r.status === 'Approved' },
  { id: 'pickup', label: 'In transit', match: (r) => r.status === 'Pickup' },
  { id: 'received', label: 'To inspect', match: (r) => r.status === 'Received' },
  { id: 'inspected', label: 'To credit', match: (r) => r.status === 'Inspected' },
  { id: 'credited', label: 'Credited', match: (r) => r.status === 'Credited' },
  { id: 'rejected', label: 'Rejected', match: (r) => r.status === 'Rejected' },
];

const ReturnsPage: React.FC = () => {
  useSubscribe(subscribeReturns, subscribeOrders, subscribeStock);
  const ctx = useOrderCtx();
  const imp = useImportContext();
  const { activePrincipal, currentUser } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'requested';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(params.get('r'));
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (ctx) { ensureDemo(imp, ctx, activePrincipal.id); ensureReturnsDemo(ctx, activePrincipal.id); } }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return <div className="g2 g2-embed" style={{ padding: 24 }}>Loading returns…</div>;
  const all = listReturns().filter((r) => r.principalId === activePrincipal.id);
  const m = currentUser.matrix;
  const canEdit = !m || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  const canConfigure = !m || !!m.inventory?.includes('configure') || !!m.platform?.includes('configure');
  const cur = TABS.find((t) => t.id === tab);
  const rows = cur ? all.filter((r) => cur.match(r) && [r.no, r.partnerName, ...r.lines.map((l) => `${l.batch} ${l.serial ?? ''} ${l.orderCode}`)].join(' ').toLowerCase().includes(q.toLowerCase())) : [];
  const credited = all.filter((r) => r.creditNote);
  const value = (r: ReturnRequest) => r.creditNote?.value ?? r.lines.reduce((a, l) => a + l.qty * l.unitValue, 0);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Returns" description="Goods coming back from partners and hospitals: checked against the original delivery and the return policy, picked up, received into Quarantine, inspected (restock, scrap or return to manufacturer) and credited."
        actions={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>New return</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Waiting for approval" value={all.filter((r) => r.status === 'Requested').length} icon={<Undo2 size={22} />} color="#d97706" bg="#fffbeb" foot="above the auto-approve limit" />
        <KpiCard label="Pickup / in transit" value={all.filter((r) => ['Approved', 'Pickup'].includes(r.status)).length} icon={<Truck size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${all.filter((r) => r.status === 'Approved').length} to book`} />
        <KpiCard label="To inspect" value={all.filter((r) => r.status === 'Received').length} icon={<ClipboardCheck size={22} />} color="#2563eb" bg="#eff6ff" foot={`${all.filter((r) => r.status === 'Received').reduce((a, r) => a + r.lines.reduce((b, l) => b + (l.receivedQty ?? 0), 0), 0)} unit(s) in Quarantine`} />
        <KpiCard label="Credit notes" value={inr(credited.reduce((a, r) => a + (r.creditNote?.value ?? 0), 0))} icon={<FileText size={22} />} color="#059669" bg="#ecfdf5" foot={`${credited.length} issued`} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[...TABS.map((t) => ({ id: t.id, label: t.label, count: all.filter(t.match).length || undefined })), { id: 'policy', label: 'Return policy' }]} />
          <span className="g2-spacer" />
          {tab !== 'policy' && <SearchInput value={q} onChange={setQ} placeholder="Return, partner, batch, order…" />}
        </div>
        {tab === 'policy' ? <PolicyTab canConfigure={canConfigure} /> : (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Return</th><th>Partner / hospital</th><th>Items</th><th>Reasons</th><th style={{ textAlign: 'right' }}>{tab === 'credited' ? 'Credited' : 'Value'}</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing here.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} style={{ cursor: 'pointer' }}>
                  <td><div className="g2-strong">{r.no}</div><div className="g2-cell-sub">{r.requestedAt.slice(0, 10)} · to {r.toWarehouseName}</div></td>
                  <td>{r.partnerName}</td>
                  <td className="g2-small">{r.lines.map((l) => `${l.qty} × ${l.name.slice(0, 30)}`).join(', ')}</td>
                  <td className="g2-small">{[...new Set(r.lines.map((l) => l.reason))].join(', ')}</td>
                  <td style={{ textAlign: 'right' }}>{inr(value(r))}</td>
                  <td><Badge tone={TONE[r.status]} dot>{r.status === 'Pickup' ? 'In transit' : r.status}</Badge>{r.creditNote && <div className="g2-cell-sub">{r.creditNote.no}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {creating && <NewReturnDrawer ctx={ctx} onClose={() => setCreating(false)} onOpen={setOpenId} />}
      {openId && <ReturnDrawer key={openId} id={openId} ctx={ctx} onClose={() => setOpenId(null)} />}
    </div>
  );
};
export default ReturnsPage;
