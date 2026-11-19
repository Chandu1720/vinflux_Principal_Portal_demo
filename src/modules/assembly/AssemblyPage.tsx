/**
 * Assembly and kitting (SU2): bills of materials, assembly / kit-build orders, final QC, disassembly, serial genealogy.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, CheckCircle2, GitBranch, Layers, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { subscribeStock } from '../inventory/stockStore';
import { notErp } from '../inventory/stockSource';
import { asmOrders, availability, boms as allBoms, completeAsm, createAsm, disassemble, ensureAssemblyDemo, getAsm, releaseAsm, saveBom, subscribeAssembly, trace } from './assemblyStore';
import type { AsmStatus, Bom } from './assemblyStore';

const TONE: Record<AsmStatus, BadgeTone> = { Planned: 'blue', Completed: 'green', Disassembled: 'slate', Cancelled: 'slate' };

const BomModal: React.FC<{ bom: Bom | null; onClose: () => void }> = ({ bom, onClose }) => {
  const { activePrincipal, products, showToast } = useApp();
  const [b, setB] = useState<Bom>(bom ?? { id: '', principalId: activePrincipal.id, productId: '', kind: 'Kit', version: 1, effectiveFrom: new Date().toISOString().slice(0, 10), lines: [{ productId: '', qty: 1 }], active: true, note: '' });
  const [errs, setErrs] = useState<string[]>([]);
  const opts = products.map((p) => ({ value: p.id, label: p.name, description: p.code }));
  return (
    <Modal open size="lg" title={bom ? `Bill of materials v${bom.version}` : 'New bill of materials'} subtitle="Components and quantities per finished unit or kit. Changing a BOM that has been used creates a new version." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { const r = saveBom(b); if (!r.ok) setErrs(r.errors ?? [r.message]); else { showToast(r.message, 'success'); onClose(); } }}>Save</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t save" />}
        <FormGrid cols={3}>
          <Field label="Finished product / kit" required><SearchableSelect value={b.productId || null} options={opts} onChange={(v) => setB({ ...b, productId: v ?? '' })} /></Field>
          <Field label="Type"><Select value={b.kind} options={[{ value: 'Kit', label: 'Kit / instrument set' }, { value: 'Assembly', label: 'Assembled product' }]} onChange={(v) => setB({ ...b, kind: v as Bom['kind'] })} /></Field>
          <Field label="Note"><Input value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Field>
        </FormGrid>
        <Card title="Components" actions={<Button size="sm" icon={<Plus size={13} />} onClick={() => setB({ ...b, lines: [...b.lines, { productId: '', qty: 1 }] })}>Add component</Button>} flush>
          <div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Component</th><th style={{ width: 130 }}>Qty per unit</th><th /></tr></thead>
            <tbody>{b.lines.map((l, i) => (
              <tr key={i}><td><SearchableSelect value={l.productId || null} options={opts} onChange={(v) => setB({ ...b, lines: b.lines.map((x, k) => (k === i ? { ...x, productId: v ?? '' } : x)) })} /></td>
                <td><NumberInput value={l.qty} onChange={(v) => setB({ ...b, lines: b.lines.map((x, k) => (k === i ? { ...x, qty: v ?? 0 } : x)) })} /></td>
                <td><Button size="sm" icon={<Trash2 size={13} />} onClick={() => setB({ ...b, lines: b.lines.filter((_, k) => k !== i) })} /></td></tr>
            ))}</tbody></table></div>
        </Card>
      </div>
    </Modal>
  );
};

const OrderModal: React.FC<{ id: string | null; onClose: () => void }> = ({ id, onClose }) => {
  useSubscribe(subscribeAssembly, subscribeStock);
  const { activePrincipal, currentUser, products, warehouses, showToast } = useApp();
  const bs = allBoms(activePrincipal.id).filter((b) => b.active);
  const o = id ? getAsm(id) : null;
  const [n, setN] = useState({ bomId: bs[0]?.id ?? '', qty: 2, warehouseId: warehouses.find((w) => notErp(w.id))?.id ?? warehouses[0]?.id ?? '', planned: new Date().toISOString().slice(0, 10) });
  const [errs, setErrs] = useState<string[]>([]); const [why, setWhy] = useState('');
  const pn = (pid: string) => products.find((p) => p.id === pid)?.name ?? pid;
  const bom = allBoms(activePrincipal.id).find((b) => b.id === (o?.bomId ?? n.bomId));
  const av = bom && (!o || o.status === 'Planned') ? availability(bom, o?.qty ?? n.qty, o?.warehouseId ?? n.warehouseId) : [];
  const tell = (r: { ok: boolean; message: string; errors?: string[] }, close = false) => { if (!r.ok) setErrs(r.errors ?? [r.message]); else { setErrs([]); showToast(r.message, 'success'); if (close) onClose(); } return r.ok; };
  return (
    <Modal open size="lg" title={o ? <span className="g2-row" style={{ gap: 8 }}>{o.no} · {pn(o.productId).slice(0, 48)} <Badge tone={TONE[o.status]} dot>{o.status}</Badge></span> : 'New assembly / kit-build order'}
      subtitle={o ? `${o.qty} unit(s) · BOM v${o.bomVersion} · ${warehouses.find((w) => w.id === o.warehouseId)?.name ?? o.warehouseId}` : 'Components are checked against Available stock in the chosen warehouse'} onClose={onClose}
      footer={<>
        {!o && <Button variant="primary" onClick={() => { const r = createAsm(activePrincipal.id, n.bomId, n.qty, n.warehouseId, n.planned, currentUser.name); if (tell(r) && r.id) onClose(); }}>Create order</Button>}
        {o?.status === 'Planned' && <Button variant="primary" icon={<Wrench size={15} />} onClick={() => tell(completeAsm(o.id, products, currentUser.name))}>Complete — consume components</Button>}
        {o?.status === 'Completed' && o.outputStatus === 'Quarantine' && <Button variant="success" icon={<CheckCircle2 size={15} />} onClick={() => tell(releaseAsm(o.id, currentUser.name))}>Final QC passed — release</Button>}
        {o?.status === 'Completed' && <Button onClick={() => tell(disassemble(o.id, currentUser.name, why), true)}>Disassemble</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t do that yet" />}
        {!o && (
          <FormGrid cols={2}>
            <Field label="Bill of materials"><Select value={n.bomId} options={bs.map((b) => ({ value: b.id, label: `${pn(b.productId).slice(0, 50)} (v${b.version})` }))} onChange={(v) => setN({ ...n, bomId: v })} /></Field>
            <Field label="Quantity"><NumberInput value={n.qty} onChange={(v) => setN({ ...n, qty: v ?? 0 })} /></Field>
            <Field label="Warehouse"><Select value={n.warehouseId} options={warehouses.map((w) => ({ value: w.id, label: `${w.name}${notErp(w.id) ? '' : ' (ERP stock)'}` }))} onChange={(v) => setN({ ...n, warehouseId: v })} /></Field>
            <Field label="Planned for"><Input type="date" value={n.planned} onChange={(e) => setN({ ...n, planned: e.target.value })} /></Field>
          </FormGrid>
        )}
        {!o && n.warehouseId && !notErp(n.warehouseId) && <Alert tone="warn">This warehouse’s stock is kept in your ERP. VinFlux records the build and genealogy here; post the component issue and finished-goods receipt in the ERP too, or the next stock sync will overwrite it.</Alert>}
        {av.length > 0 && (
          <Card title="Components (ASM-01)" flush><div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Component</th><th style={{ textAlign: 'right' }}>Needed</th><th style={{ textAlign: 'right' }}>Available</th><th>Shortage</th></tr></thead>
            <tbody>{av.map((x) => <tr key={x.productId}><td>{pn(x.productId)}</td><td style={{ textAlign: 'right' }}>{x.need}</td><td style={{ textAlign: 'right' }}>{x.have}</td><td>{x.short ? <span style={{ color: '#b91c1c' }}>{x.short} short{x.cover.length ? ` · covered by ${x.cover.join(', ')}` : ' · no PO covers it'}</span> : <Badge tone="green">OK</Badge>}</td></tr>)}</tbody></table></div></Card>
        )}
        {o && o.status !== 'Planned' && (
          <>
            <Alert tone={o.outputStatus === 'Quarantine' ? 'warn' : 'success'}>Batch <strong>{o.outputBatch}</strong>{o.outputSerials.length ? ` · ${o.outputSerials.length} serials` : ''} — {o.status === 'Disassembled' ? 'taken apart' : o.outputStatus === 'Quarantine' ? 'in Quarantine until final QC (someone other than who assembled it)' : 'available to sell'}.</Alert>
            <Card title="Consumed components (genealogy)" flush><div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Component</th><th>Lot</th><th>Serial</th><th style={{ textAlign: 'right' }}>Qty</th><th>In finished unit</th></tr></thead>
              <tbody>{o.consumed.map((c, i) => <tr key={i}><td className="g2-small">{pn(c.productId).slice(0, 50)}</td><td className="g2-mono g2-small">{c.batch}</td><td className="g2-mono g2-small">{c.serial ?? '—'}</td><td style={{ textAlign: 'right' }}>{c.qty}</td><td className="g2-mono g2-small">{c.forUnit ?? 'batch'}</td></tr>)}</tbody></table></div></Card>
            {o.status === 'Completed' && <Field label="Reason (to disassemble)"><Textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>}
          </>
        )}
        {o && <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{o.history.map((h, k) => <div key={k} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>}
      </div>
    </Modal>
  );
};

const AssemblyPage: React.FC = () => {
  useSubscribe(subscribeAssembly, subscribeStock);
  const { activePrincipal, products, warehouses } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'orders';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [bom, setBom] = useState<Bom | null | 'new'>(null);
  const [open, setOpen] = useState<string | null | 'new'>(null);
  const [code, setCode] = useState('');
  useEffect(() => { const w = warehouses.find((x) => notErp(x.id)) ?? warehouses[0]; if (w) ensureAssemblyDemo(activePrincipal.id, products, w.id); }, [activePrincipal.id, products.length, warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const bs = allBoms(activePrincipal.id); const os = asmOrders(activePrincipal.id);
  const pn = (pid: string) => products.find((p) => p.id === pid)?.name ?? pid;
  const t = trace(activePrincipal.id, code);
  const month = new Date().toISOString().slice(0, 7);
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Assembly & Kitting" description="Build finished products or kits from components: bill of materials, availability check, component consumption with serial genealogy, final QC, and disassembly."
        actions={<><Button icon={<Layers size={15} />} onClick={() => setBom('new')}>New BOM</Button><Button variant="primary" icon={<Plus size={15} />} disabled={!bs.some((b) => b.active)} onClick={() => setOpen('new')}>New assembly order</Button></>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Planned" value={os.filter((o) => o.status === 'Planned').length} icon={<Wrench size={22} />} color="#2563eb" bg="#eff6ff" foot={`${os.filter((o) => o.status === 'Planned').reduce((a, o) => a + o.qty, 0)} unit(s)`} />
        <KpiCard label="Built this month" value={os.filter((o) => o.status === 'Completed' && o.history.some((h) => h.action === 'Completed' && h.at.slice(0, 7) === month)).reduce((a, o) => a + o.qty, 0)} icon={<Boxes size={22} />} color="#059669" bg="#ecfdf5" foot="units / kits" />
        <KpiCard label="Awaiting final QC" value={os.filter((o) => o.outputStatus === 'Quarantine' && o.status === 'Completed').length} icon={<CheckCircle2 size={22} />} color="#d97706" bg="#fffbeb" foot="batches in Quarantine" />
        <KpiCard label="Bills of materials" value={bs.filter((b) => b.active).length} icon={<Layers size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${bs.length - bs.filter((b) => b.active).length} older version(s)`} onClick={() => setTab('boms')} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'orders', label: 'Assembly orders', count: os.length || undefined }, { id: 'boms', label: 'Bills of materials', count: bs.length || undefined }, { id: 'trace', label: 'Genealogy', icon: <GitBranch size={14} /> }]} /></div>
        {tab === 'orders' && (
          <div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Order</th><th>Product / kit</th><th style={{ textAlign: 'right' }}>Qty</th><th>Planned</th><th>Output</th><th>Status</th></tr></thead>
            <tbody>{os.length === 0 && <tr><td colSpan={6} className="g2-muted">No assembly orders yet.</td></tr>}
              {os.map((o) => <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(o.id)}><td className="g2-mono">{o.no}</td><td>{pn(o.productId).slice(0, 60)}<div className="g2-cell-sub">BOM v{o.bomVersion}</div></td><td style={{ textAlign: 'right' }}>{o.qty}</td><td className="g2-small">{o.planned}</td><td className="g2-small g2-mono">{o.outputBatch ?? '—'}{o.outputStatus === 'Quarantine' && <div className="g2-cell-sub" style={{ color: '#b45309' }}>final QC pending</div>}</td><td><Badge tone={TONE[o.status]} dot>{o.status}</Badge></td></tr>)}</tbody></table></div>
        )}
        {tab === 'boms' && (
          <div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Finished product / kit</th><th>Type</th><th>Version</th><th>Components</th><th>State</th></tr></thead>
            <tbody>{bs.length === 0 && <tr><td colSpan={5} className="g2-muted">No bills of materials.</td></tr>}
              {bs.map((b) => <tr key={b.id} style={{ cursor: 'pointer', opacity: b.active ? 1 : 0.6 }} onClick={() => setBom(b)}><td>{pn(b.productId).slice(0, 60)}<div className="g2-cell-sub">{b.note}</div></td><td className="g2-small">{b.kind}</td><td>v{b.version} <span className="g2-muted g2-small">from {b.effectiveFrom}</span></td><td className="g2-small">{b.lines.map((l) => `${l.qty} × ${pn(l.productId).slice(0, 30)}`).join('; ')}</td><td><Badge tone={b.active ? 'green' : 'slate'}>{b.active ? 'In use' : 'Superseded'}</Badge></td></tr>)}</tbody></table></div>
        )}
        {tab === 'trace' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-row" style={{ gap: 8 }}><Search size={16} /><div style={{ width: 340 }}><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Finished serial / batch, or component serial / lot" /></div><span className="g2-small g2-muted">e.g. a component lot like CMPB2611, or a finished batch</span></div>
            {code && !t.down.length && !t.up.length && <Alert tone="info">Nothing found for “{code}”.</Alert>}
            {t.down.map((x, i) => <Card key={`d${i}`} title={`${x.unit ?? x.order.outputBatch} — built by ${x.order.no}`} subtitle={pn(x.order.productId)}><div className="g2-small">{x.parts.map((p, k) => <div key={k}>{p.qty} × {pn(p.productId).slice(0, 50)} · lot <span className="g2-mono">{p.batch}</span>{p.serial ? <> · serial <span className="g2-mono">{p.serial}</span></> : null}</div>)}</div></Card>)}
            {t.up.length > 0 && <Card title={`“${code}” was used in ${new Set(t.up.map((x) => x.order.id)).size} assembly order(s)`} subtitle="A recall of this component lists every finished unit below" flush><div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Order</th><th>Finished product</th><th>Batch</th><th>Unit</th><th style={{ textAlign: 'right' }}>Qty used</th></tr></thead>
              <tbody>{t.up.map((x, i) => <tr key={i}><td className="g2-mono">{x.order.no}</td><td>{pn(x.order.productId).slice(0, 50)}</td><td className="g2-mono">{x.order.outputBatch}</td><td className="g2-mono">{x.unit ?? 'whole batch'}</td><td style={{ textAlign: 'right' }}>{x.part.qty}</td></tr>)}</tbody></table></div></Card>}
          </div>
        )}
      </Card>
      {bom && <BomModal bom={bom === 'new' ? null : bom} onClose={() => setBom(null)} />}
      {open && <OrderModal id={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </div>
  );
};
export default AssemblyPage;
