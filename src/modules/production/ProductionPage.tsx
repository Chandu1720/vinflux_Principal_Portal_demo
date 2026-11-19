/**
 * Production link (SU3): finished batches from the principal's own plant, read from the ERP; quality release; planned
 * production as expected supply.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Factory, PauseCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, KpiCard, Modal, PageHeader, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useOrderCtx } from '../orders/useOrderCtx';
import { orders, subscribeOrders } from '../orders/orderStore';
import { decide, ensureProductionDemo, expectedSupply, getReceipt, plans as allPlans, prodSettings, pullFromErp, receipts as allReceipts, saveProdSettings, subscribeProduction, syncErpRelease } from './productionStore';
import type { ReceiptStatus } from './productionStore';

const TONE: Record<ReceiptStatus, BadgeTone> = { 'In Quarantine': 'amber', Released: 'green', Rejected: 'red' };

const ReceiptModal: React.FC<{ id: string; onClose: () => void; canRelease: boolean }> = ({ id, onClose, canRelease }) => {
  useSubscribe(subscribeProduction);
  const { currentUser, showToast } = useApp();
  const ctx = useOrderCtx();
  const r = getReceipt(id); const s = prodSettings();
  const [why, setWhy] = useState(''); const [err, setErr] = useState('');
  if (!r) return null;
  const tell = (x: { ok: boolean; message: string }) => { if (!x.ok) setErr(x.message); else { showToast(x.message, 'success'); onClose(); } };
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{r.no} · {r.productName.slice(0, 50)} <Badge tone={TONE[r.status]} dot>{r.status}</Badge></span>}
      subtitle={`${r.erpRef} · ${r.plant} · batch ${r.batch} · made ${r.mfgDate}${r.expiry ? ` · expires ${r.expiry}` : ''}`} onClose={onClose}
      footer={r.status === 'In Quarantine' ? (s.releaseBy === 'vinflux' && canRelease ? <>
        <Button variant="danger" icon={<PauseCircle size={15} />} onClick={() => tell(decide(r.id, false, why, currentUser.name, ctx))}>Reject batch</Button>
        <Button variant="success" icon={<ShieldCheck size={15} />} onClick={() => tell(decide(r.id, true, '', currentUser.name, ctx))}>Release to sale</Button>
      </> : s.releaseBy === 'erp' ? <Button onClick={() => tell(syncErpRelease(r.principalId, currentUser.name, ctx, r.batch))}>Demo: {s.erpName} rejected this batch</Button> : undefined) : undefined}>
      <div className="g2-stack">
        {err && <Alert tone="warn">{err}</Alert>}
        {r.status === 'In Quarantine' && <Alert tone="info">{s.releaseBy === 'erp' ? `Waiting for ${s.erpName}'s quality release (PRL-02) — “Read ERP release” on the page picks it up.` : `A QC approver releases it here (not ${r.pulledBy}, who brought it in).`}</Alert>}
        {r.status !== 'In Quarantine' && <Alert tone={r.status === 'Released' ? 'success' : 'warn'}>{r.status} by {r.releasedBy} ({r.releaseSource}) on {r.releasedAt?.slice(0, 16).replace('T', ' ')}{r.reason ? ` — ${r.reason}` : ''}{r.backorders.length ? ` · backorders released as ${r.backorders.join(', ')}` : ''}</Alert>}
        <div className="g2-grid g2-grid-3">
          <Card title="Quantity"><div style={{ fontSize: 22, fontWeight: 700 }}>{r.qty}</div><div className="g2-small g2-muted">into {r.warehouseName}</div></Card>
          <Card title="Stock"><div className="g2-small">{r.stockPosted ? `Kept in VinFlux — ${r.status === 'In Quarantine' ? 'in Quarantine, not available to promise' : r.status === 'Released' ? 'Available' : 'Blocked'}` : `The ERP keeps this warehouse's stock; VinFlux records the batch and its release for traceability.`}</div></Card>
          <Card title="Traceability"><div className="g2-small">Recall trace-back stops at batch <strong>{r.batch}</strong>; raw-material lots are in {s.erpName} (PRL-04).</div></Card>
        </div>
        {r.serials.length > 0 && <Card title={`Serials (${r.serials.length})`}><div className="g2-small g2-mono" style={{ columns: 3 }}>{r.serials.map((x) => <div key={x}>{x}</div>)}</div></Card>}
        {r.status === 'In Quarantine' && s.releaseBy === 'vinflux' && canRelease && <Field label="Reason (to reject)"><Textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>}
      </div>
    </Modal>
  );
};

const ProductionPage: React.FC = () => {
  useSubscribe(subscribeProduction, subscribeOrders);
  const { activePrincipal, currentUser, products, warehouses, showToast } = useApp();
  const ctx = useOrderCtx();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'receipts';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [open, setOpen] = useState<string | null>(null);
  const m = currentUser.matrix; const roles = currentUser.role ?? '';
  const admin = !m || roles.includes('Administrator');
  const canRelease = admin || roles.includes('QC Approver') || !!m?.inventory?.includes('approve');
  const canEdit = admin || !!m?.inventory?.includes('edit');
  useEffect(() => { ensureProductionDemo(activePrincipal.id, products, warehouses); }, [activePrincipal.id, products.length, warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = prodSettings();
  const rs = allReceipts(activePrincipal.id); const ps = allPlans(activePrincipal.id); const exp = expectedSupply(activePrincipal.id);
  const month = new Date().toISOString().slice(0, 7);
  const q = rs.filter((r) => r.status === 'In Quarantine');
  const backOpen = orders().filter((o) => o.principalId === activePrincipal.id && o.lines.some((l) => l.backorderQty > 0 && exp.some((p) => p.productId === l.productId)));
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Production" description={`Finished goods from your own plant, read from ${s.erpName}. Each batch waits in Quarantine until ${s.releaseBy === 'erp' ? `${s.erpName} releases it` : 'QC releases it here'}; planned production shows as expected supply.`}
        actions={canEdit ? <><Button icon={<RefreshCw size={15} />} onClick={() => tell(pullFromErp(activePrincipal.id, products, warehouses, currentUser.name))}>Read new receipts</Button>{s.releaseBy === 'erp' && <Button variant="primary" icon={<ShieldCheck size={15} />} disabled={!q.length} onClick={() => tell(syncErpRelease(activePrincipal.id, currentUser.name, ctx))}>Read ERP release</Button>}</> : undefined} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="In Quarantine" value={q.length} icon={<PauseCircle size={22} />} color="#d97706" bg="#fffbeb" foot={`${q.reduce((a, r) => a + r.qty, 0)} unit(s) not sellable yet`} />
        <KpiCard label="Released this month" value={rs.filter((r) => r.status === 'Released' && r.releasedAt?.slice(0, 7) === month).length} icon={<CheckCircle2 size={22} />} color="#059669" bg="#ecfdf5" foot={`${rs.filter((r) => r.status === 'Rejected').length} rejected in all`} />
        <KpiCard label="Expected supply" value={exp.reduce((a, p) => a + p.qty, 0)} icon={<CalendarClock size={22} />} color="#2563eb" bg="#eff6ff" foot={`${exp.length} planned run(s) · not available to promise`} onClick={() => setTab('plan')} />
        <KpiCard label="Backorders waiting" value={backOpen.length} icon={<Factory size={22} />} color="#6d28d9" bg="#f5f3ff" foot="released automatically when a batch is released" />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'receipts', label: 'Production receipts', count: rs.length || undefined }, { id: 'plan', label: 'Planned production', count: exp.length || undefined }, { id: 'settings', label: 'Settings' }]} /></div>
        {tab === 'receipts' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Receipt</th><th>Product · batch</th><th style={{ textAlign: 'right' }}>Qty</th><th>Into</th><th>{s.erpName} QC</th><th>Status</th></tr></thead>
            <tbody>
              {rs.length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing read yet — “Read new receipts”.</td></tr>}
              {rs.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(r.id)}>
                  <td className="g2-mono">{r.no}<div className="g2-cell-sub">{r.erpRef} · {r.pulledAt.slice(0, 10)}</div></td>
                  <td>{r.productName.slice(0, 50)}<div className="g2-cell-sub g2-mono">{r.batch}{r.serials.length ? ` · ${r.serials.length} serials` : ''}</div></td>
                  <td style={{ textAlign: 'right' }}>{r.qty}</td><td className="g2-small">{r.warehouseName}</td>
                  <td>{r.releaseSource === 'VinFlux QC' ? <span className="g2-small g2-muted">not used (VinFlux QC)</span> : <Badge tone={r.erpQc === 'Released' ? 'green' : r.erpQc === 'Rejected' ? 'red' : 'slate'}>{r.erpQc}</Badge>}</td>
                  <td><Badge tone={TONE[r.status]} dot>{r.status}</Badge>{r.backorders.length > 0 && <div className="g2-cell-sub">backorders → {r.backorders.join(', ')}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {tab === 'plan' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Plan</th><th>Product</th><th style={{ textAlign: 'right' }}>Qty</th><th>Expected</th><th>Status</th></tr></thead>
            <tbody>
              {ps.length === 0 && <tr><td colSpan={5} className="g2-muted">No planned production read from {s.erpName}.</td></tr>}
              {ps.map((p) => <tr key={p.id}><td className="g2-mono">{p.erpRef}</td><td>{p.productName}</td><td style={{ textAlign: 'right' }}>{p.qty}</td><td>{p.expected}</td><td><Badge tone={p.status === 'Done' ? 'green' : p.status === 'In progress' ? 'blue' : 'slate'}>{p.status}</Badge></td></tr>)}
            </tbody>
          </table></div>
        )}
        {tab === 'settings' && (
          <div style={{ padding: 16 }}>
            <FormGrid cols={3}>
              <Field label="Who releases batches to sale (PRL-02)"><Select value={s.releaseBy} disabled={!admin} options={[{ value: 'erp', label: `${s.erpName} quality release` }, { value: 'vinflux', label: 'VinFlux QC approver' }]} onChange={(v) => saveProdSettings({ ...s, releaseBy: v as 'erp' | 'vinflux' })} /></Field>
              <Field label="ERP"><Input value={s.erpName} disabled={!admin} onChange={(e) => saveProdSettings({ ...s, erpName: e.target.value })} /></Field>
              <Field label="Plant"><Input value={s.plant} disabled={!admin} onChange={(e) => saveProdSettings({ ...s, plant: e.target.value })} /></Field>
            </FormGrid>
            <div className="g2-small g2-muted" style={{ marginTop: 8 }}>Production planning, work orders and raw materials stay in {s.erpName}. VinFlux reads only finished output, its batches and release, and planned output.</div>
          </div>
        )}
      </Card>
      {open && <ReceiptModal id={open} canRelease={canRelease} onClose={() => setOpen(null)} />}
    </div>
  );
};
export default ProductionPage;
