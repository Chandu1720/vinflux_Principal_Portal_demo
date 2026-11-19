/**
 * Imports: shipments from overseas suppliers — documents, status, bill of entry with duty, landed cost, receipt at landed cost.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Anchor, FileCheck2, Plane, Plus, Receipt, Ship } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, Select, Stepper, Tabs } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { ensureProcurementDemo, getPO, subscribeProcurement } from '../procurement/procurementStore';
import { gstOf } from '../pricing/pricingStore';
import {
  DOC_TYPES, FLOW, advance, createShipment, duty, ensureImportsDemo, fileBoe, finaliseCosts, getShipment, importablePOs, incoming, landed, licenceIssue, missingDocs, openToShip,
  receiveShipment, setCosts, setDoc, shipments as allShipments, subscribeImports,
} from './importsStore';
import type { Costs, Mode, ShipStatus } from './importsStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const plus = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const TONE: Record<ShipStatus, BadgeTone> = { Booked: 'slate', Departed: 'blue', 'Arrived at port': 'amber', Cleared: 'purple', Received: 'green' };

/* ----------------------------------------- Book ----------------------------------------- */

const BookModal: React.FC<{ onClose: () => void; onOpen: (id: string) => void }> = ({ onClose, onOpen }) => {
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const pos = importablePOs(activePrincipal.id);
  const [poId, setPoId] = useState(pos[0]?.id ?? '');
  const po = getPO(poId);
  const [f, setF] = useState({ mode: 'Sea' as Mode, incoterm: 'CIF', blAwb: '', container: '', port: 'Chennai (INMAA1)', clearingAgent: '', etd: today(), eta: plus(21), fxRate: po?.fxRate ?? 90 });
  const [ls, setLs] = useState<Record<string, { qty: number; batch: string; expiry: string; serials?: string }>>(() => Object.fromEntries((po?.lines ?? []).map((l) => [l.id, { qty: openToShip(po!, l.id), batch: '', expiry: '' }])));
  const isSerial = (pid: string) => (products.find((x) => x.id === pid)?.trackingRules?.mode ?? '').includes('Serial');
  const [errs, setErrs] = useState<string[]>([]);
  const pick = (id: string) => { const p = getPO(id); setPoId(id); setF({ ...f, fxRate: p?.fxRate ?? f.fxRate }); setLs(Object.fromEntries((p?.lines ?? []).map((l) => [l.id, { qty: openToShip(p!, l.id), batch: '', expiry: '' }]))); };
  const save = () => {
    const r = createShipment({ principalId: activePrincipal.id, poIds: [poId], ...f, lines: (po?.lines ?? []).map((l) => ({ poId, lineId: l.id, productId: l.productId, qty: ls[l.id]?.qty ?? 0, batch: ls[l.id]?.batch ?? '', expiry: ls[l.id]?.expiry || null, serials: (ls[l.id]?.serials ?? '').split(/[\s,]+/).filter(Boolean) })) }, currentUser.name);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; } showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="xl" title="Book an import shipment" subtitle="From the supplier’s shipping advice: transport document, dates and the packing list" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Book shipment</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t book yet" />}
        {pos.length === 0 && <Alert tone="info">No open purchase orders from overseas suppliers. Raise one in Procurement first.</Alert>}
        <FormGrid cols={3}>
          <Field label="Purchase order" required><SearchableSelect value={poId} options={pos.map((p) => ({ value: p.id, label: `${p.no} · ${p.vendorName}`, description: `${p.currency} · ${p.lines.length} line(s)` }))} onChange={(x) => pick(x ?? '')} /></Field>
          <Field label="Mode"><Select value={f.mode} options={['Sea', 'Air', 'Courier'].map((m) => ({ value: m, label: m }))} onChange={(x) => setF({ ...f, mode: x as Mode })} /></Field>
          <Field label={f.mode === 'Air' ? 'Airway bill' : f.mode === 'Sea' ? 'Bill of lading' : 'Tracking no.'} required><Input value={f.blAwb} onChange={(e) => setF({ ...f, blAwb: e.target.value })} /></Field>
          {f.mode === 'Sea' && <Field label="Container"><Input value={f.container} onChange={(e) => setF({ ...f, container: e.target.value })} /></Field>}
          <Field label="Port of entry"><Input value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} /></Field>
          <Field label="Clearing agent"><Input value={f.clearingAgent} onChange={(e) => setF({ ...f, clearingAgent: e.target.value })} /></Field>
          <Field label="Departed"><Input type="date" value={f.etd} onChange={(e) => setF({ ...f, etd: e.target.value })} /></Field>
          <Field label="Expected arrival" required><Input type="date" value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} /></Field>
          <Field label={`${po?.currency ?? ''} → INR rate`} required><NumberInput value={f.fxRate} onChange={(x) => setF({ ...f, fxRate: x ?? 0 })} /></Field>
        </FormGrid>
        {po && <Card title="Packing list" subtitle="Batches are carried to the goods receipt (IMS-02)" flush>
          <div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Open</th><th style={{ width: 120 }}>Qty shipped</th><th style={{ width: 160 }}>Batch</th><th style={{ width: 170 }}>Expiry</th><th>Serials (serial-tracked)</th></tr></thead>
            <tbody>{po.lines.map((l) => <tr key={l.id}><td>{products.find((x) => x.id === l.productId)?.name ?? l.name}</td><td style={{ textAlign: 'right' }}>{openToShip(po, l.id)}</td><td><NumberInput value={ls[l.id]?.qty ?? 0} onChange={(x) => setLs({ ...ls, [l.id]: { ...ls[l.id], qty: x ?? 0 } })} /></td><td><Input value={ls[l.id]?.batch ?? ''} onChange={(e) => setLs({ ...ls, [l.id]: { ...ls[l.id], batch: e.target.value } })} /></td><td><Input type="date" value={ls[l.id]?.expiry ?? ''} onChange={(e) => setLs({ ...ls, [l.id]: { ...ls[l.id], expiry: e.target.value } })} /></td><td>{isSerial(l.productId) ? <Input value={ls[l.id]?.serials ?? ''} placeholder={`${ls[l.id]?.qty ?? 0} serials, comma or space separated`} onChange={(e) => setLs({ ...ls, [l.id]: { ...ls[l.id], serials: e.target.value } })} /> : <span className="g2-muted g2-small">—</span>}</td></tr>)}</tbody>
          </table></div>
        </Card>}
      </div>
    </Modal>
  );
};

/* --------------------------------------- Shipment --------------------------------------- */

const ShipmentDrawer: React.FC<{ id: string; onClose: () => void; canEdit: boolean }> = ({ id, onClose, canEdit }) => {
  useSubscribe(subscribeImports);
  const { currentUser, products, showToast } = useApp();
  const s = getShipment(id);
  const [boe, setBoe] = useState({ boeNo: '', boeDate: today(), bcdPct: 7.5, swsPct: 10, igstPct: 12 });
  const [costs, setC] = useState<Costs>(s?.costs ?? { freight: 0, insurance: 0, clearing: 0, localTransport: 0, other: 0 });
  const [docRef, setDocRef] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<string[]>([]);
  if (!s) return null;
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok && r.errors) setErrs(r.errors); else { setErrs([]); showToast(r.message, r.ok ? 'success' : 'warning'); } };
  const pName = (pid: string) => products.find((p) => p.id === pid)?.name ?? pid;
  const serial = (pid: string) => (products.find((x) => x.id === pid)?.trackingRules?.mode ?? '').includes('Serial');
  const lic = licenceIssue(s); const miss = missingDocs(s);
  const preview = { ...s, customs: s.customs ?? boe, costs };
  const dt = duty(preview); const lc = landed(preview);
  const step = FLOW.indexOf(s.status);
  return (
    <Modal open size="xl" title={<span className="g2-row" style={{ gap: 8 }}>{s.mode === 'Air' ? <Plane size={18} /> : <Ship size={18} />} {s.no} · {s.vendorName} <Badge tone={TONE[s.status]} dot>{s.status}</Badge></span>}
      subtitle={`${s.blAwb}${s.container ? ` · ${s.container}` : ''} · ${s.port} · ETA ${s.eta} · ${s.incoterm} · ${s.currency} @ ${s.fxRate}`} onClose={onClose}
      footer={canEdit ? <>
        {['Booked', 'Departed'].includes(s.status) && <Button onClick={() => tell(advance(s.id, currentUser.name))}>{s.status === 'Booked' ? 'Mark departed' : 'Mark arrived at port'}</Button>}
        {s.status === 'Cleared' && <Button variant="primary" icon={<Receipt size={15} />} onClick={() => tell(receiveShipment(s.id, currentUser.name, serial))}>Receive at warehouse</Button>}
        {s.customs && !s.costsFinal && <Button onClick={() => tell(finaliseCosts(s.id, currentUser.name))}>Landed cost is final</Button>}
      </> : undefined}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t do that yet" />}
        <Stepper steps={FLOW} current={step} maxReached={step} onSelect={() => undefined} />
        {lic && s.status !== 'Received' && <Alert tone="error">Clearance will be blocked (IMS-04): {lic}</Alert>}
        <div className="g2-grid g2-grid-2">
          <Card title="Documents" subtitle={miss.length ? `${miss.length} needed before clearance` : 'Complete for clearance'}>
            <div className="g2-stack" style={{ gap: 6 }}>{DOC_TYPES.map((t) => { const d = s.docs.find((x) => x.type === t); const needed = DOC_TYPES.slice(0, 4).includes(t); return (
              <div key={t} className="g2-row" style={{ gap: 6 }}>
                <Badge tone={d ? 'green' : needed ? 'red' : 'slate'}>{d ? 'In' : needed ? 'Missing' : 'Optional'}</Badge><span style={{ flex: 1, fontSize: 13 }}>{t}{d && <span className="g2-muted g2-mono"> · {d.ref}</span>}</span>
                {!d && canEdit && s.status !== 'Received' && <><div style={{ width: 150 }}><Input value={docRef[t] ?? ''} placeholder="Ref / file" onChange={(e) => setDocRef({ ...docRef, [t]: e.target.value })} /></div><Button size="sm" onClick={() => { if ((docRef[t] ?? '').trim()) setDoc(s.id, t, docRef[t], currentUser.name); }}>Add</Button></>}
              </div>
            ); })}</div>
          </Card>
          <Card title="Costs (INR)" subtitle={s.costsFinal ? 'Final' : 'Provisional until every cost document is in (IMT-01)'}>
            <FormGrid>
              {(['freight', 'insurance', 'clearing', 'localTransport', 'other'] as (keyof Costs)[]).map((k) => <Field key={k} label={k === 'localTransport' ? 'Local transport' : k[0].toUpperCase() + k.slice(1)}><NumberInput value={costs[k]} disabled={!canEdit || s.costsFinal} onChange={(x) => setC({ ...costs, [k]: x ?? 0 })} /></Field>)}
            </FormGrid>
            {canEdit && !s.costsFinal && <div style={{ marginTop: 8 }}><Button size="sm" onClick={() => { setCosts(s.id, costs, currentUser.name); showToast('Costs saved.', 'success'); }}>Save costs</Button></div>}
          </Card>
        </div>
        <Card title="Customs — bill of entry" subtitle={s.customs ? `BoE ${s.customs.boeNo} dated ${s.customs.boeDate}` : 'Filed when the shipment is at port; clears it for receipt (IMS-01)'}>
          {!s.customs && canEdit && (
            <FormGrid cols={3}>
              <Field label="Bill of entry no." required><Input value={boe.boeNo} onChange={(e) => setBoe({ ...boe, boeNo: e.target.value })} /></Field>
              <Field label="Date" required><Input type="date" value={boe.boeDate} onChange={(e) => setBoe({ ...boe, boeDate: e.target.value })} /></Field>
              <Field label="Basic customs duty %"><NumberInput value={boe.bcdPct} onChange={(x) => setBoe({ ...boe, bcdPct: x ?? 0 })} /></Field>
              <Field label="Social welfare surcharge % (on BCD)"><NumberInput value={boe.swsPct} onChange={(x) => setBoe({ ...boe, swsPct: x ?? 0 })} /></Field>
              <Field label="IGST %"><NumberInput value={boe.igstPct} onChange={(x) => setBoe({ ...boe, igstPct: x ?? 0 })} /></Field>
            </FormGrid>
          )}
          <div className="g2-grid g2-grid-4" style={{ marginTop: 8 }}>
            <div><div className="g2-small g2-muted">Assessable value (CIF)</div><strong>{inr(dt.assessable)}</strong></div>
            <div><div className="g2-small g2-muted">Basic duty + SWS</div><strong>{inr(dt.bcd + dt.sws)}</strong></div>
            <div><div className="g2-small g2-muted">IGST (input credit)</div><strong>{inr(dt.igst)}</strong></div>
            <div><div className="g2-small g2-muted">Paid at customs</div><strong>{inr(dt.total)}</strong></div>
          </div>
          {!s.customs && canEdit && <div style={{ marginTop: 10 }}><Button variant="primary" icon={<FileCheck2 size={15} />} disabled={s.status !== 'Arrived at port'} onClick={() => tell(fileBoe(s.id, boe, currentUser.name))}>File bill of entry and clear</Button>{s.status !== 'Arrived at port' && <span className="g2-small g2-muted" style={{ marginLeft: 8 }}>Available once the shipment is at port.</span>}</div>}
        </Card>
        <Card title={`Landed cost ${s.costsFinal ? '(final)' : '(provisional)'}`} subtitle="FOB + freight + insurance + basic duty + SWS + clearing + local transport, spread by value; IGST is recoverable, so it isn’t cost" flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product · batch</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>FOB ({s.currency})</th><th style={{ textAlign: 'right' }}>FOB in INR</th><th style={{ textAlign: 'right' }}>Landed</th><th style={{ textAlign: 'right' }}>Per unit</th>{s.landedAtReceipt && <th style={{ textAlign: 'right' }}>At receipt</th>}</tr></thead>
            <tbody>{lc.lines.map((l) => { const sl = s.lines.find((x) => x.lineId === l.lineId)!; return <tr key={l.lineId}><td>{pName(sl.productId)}<div className="g2-cell-sub g2-mono">{sl.batch}{sl.expiry ? ` · exp ${sl.expiry}` : ''}</div></td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right' }}>{(sl.fobUnit * l.qty).toLocaleString('en-IN')}</td><td style={{ textAlign: 'right' }}>{inr(l.fobInr)}</td><td style={{ textAlign: 'right' }}>{inr(l.landed)}</td><td style={{ textAlign: 'right' }} className="g2-strong">{inr(l.perUnit)}</td>{s.landedAtReceipt && <td style={{ textAlign: 'right' }}>{inr(s.landedAtReceipt[l.lineId] ?? 0)}</td>}</tr>; })}</tbody>
          </table></div>
          <div className="g2-row g2-small" style={{ gap: 14, padding: '8px 16px', flexWrap: 'wrap' }}>{Object.entries(lc.parts).filter(([, v]) => v).map(([k, v]) => <span key={k}><span className="g2-muted">{k}</span> {inr(v)}</span>)}<span className="g2-strong">Total {inr(lc.total)}</span></div>
        </Card>
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{s.history.map((h, i) => <div key={i} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>
      </div>
    </Modal>
  );
};

/* ----------------------------------------- Page ----------------------------------------- */

const ImportsPage: React.FC = () => {
  useSubscribe(subscribeImports, subscribeProcurement);
  const { activePrincipal, currentUser, products, warehouses } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'shipments';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [book, setBook] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const m = currentUser.matrix;
  const canEdit = !m || !!m.inventory?.includes('edit') || !!m.pricing?.includes('edit');
  useEffect(() => {
    ensureProcurementDemo(activePrincipal.id, products.filter((p) => p.lifecycleStatus === 'Active').slice(0, 3).map((p) => ({ id: p.id, name: p.name, price: p.pricingReference?.mrp ?? 20000, gstPct: gstOf(p) })), warehouses[0]?.id ?? '');
    ensureImportsDemo(activePrincipal.id, (pid) => { const p = products.find((x) => x.id === pid); return { name: p?.name ?? pid, serial: (p?.trackingRules?.mode ?? '').includes('Serial') }; });
  }, [activePrincipal.id, products.length, warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ss = allShipments(activePrincipal.id);
  const transit = ss.filter((s) => ['Booked', 'Departed'].includes(s.status));
  const port = ss.filter((s) => s.status === 'Arrived at port');
  const docsMissing = ss.filter((s) => s.status !== 'Received' && missingDocs(s).length);
  const prov = ss.filter((s) => s.customs && !s.costsFinal);
  const inc = incoming(activePrincipal.id);
  const pName = (pid: string) => products.find((p) => p.id === pid)?.name ?? pid;
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Imports" description="Goods made abroad — from the supplier’s dispatch through customs to your warehouse, with documents, duty and landed cost per unit."
        actions={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setBook(true)}>Book shipment</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="On the way" value={transit.length} icon={<Ship size={22} />} color="#2563eb" bg="#eff6ff" foot={`${inc.reduce((a, x) => a + x.qty, 0)} unit(s) expected`} onClick={() => setTab('incoming')} />
        <KpiCard label="At port — to clear" value={port.length} icon={<Anchor size={22} />} color="#d97706" bg="#fffbeb" foot={port.map((s) => s.no).join(', ') || 'none'} />
        <KpiCard label="Documents missing" value={docsMissing.length} icon={<FileCheck2 size={22} />} color="#dc2626" bg="#fef2f2" foot="needed before clearance" />
        <KpiCard label="Landed cost provisional" value={prov.length} icon={<Receipt size={22} />} color="#6d28d9" bg="#f5f3ff" foot="waiting for final cost documents" />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'shipments', label: 'Shipments', count: ss.length }, { id: 'incoming', label: 'Expected supply', count: inc.length || undefined }]} /></div>
        {tab === 'shipments' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Shipment</th><th>Supplier · PO</th><th>Mode · document</th><th>ETA</th><th>Docs</th><th style={{ textAlign: 'right' }}>Landed cost</th><th>Status</th></tr></thead>
            <tbody>
              {ss.length === 0 && <tr><td colSpan={7} className="g2-muted">No import shipments yet.</td></tr>}
              {ss.map((s) => { const md = missingDocs(s); return (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(s.id)}>
                  <td className="g2-mono">{s.no}</td><td>{s.vendorName}<div className="g2-cell-sub">{s.poIds.map((id) => getPO(id)?.no).join(', ')}</div></td>
                  <td className="g2-small">{s.mode}<div className="g2-cell-sub g2-mono">{s.blAwb}</div></td>
                  <td className="g2-small">{s.eta}{s.status !== 'Received' && s.eta < today() && !['Arrived at port', 'Cleared'].includes(s.status) && <> <Badge tone="red">late</Badge></>}</td>
                  <td>{s.status === 'Received' ? '—' : md.length ? <Badge tone="red">{md.length} missing</Badge> : <Badge tone="green">Complete</Badge>}{licenceIssue(s) && s.status !== 'Received' && <div className="g2-cell-sub" style={{ color: '#b91c1c' }}>licence issue</div>}</td>
                  <td style={{ textAlign: 'right' }}>{inr(landed(s).total)}<div className="g2-cell-sub">{s.costsFinal ? 'final' : 'provisional'}</div></td>
                  <td><Badge tone={TONE[s.status]} dot>{s.status}</Badge>{s.grnNo && <div className="g2-cell-sub">{s.grnNo}</div>}</td>
                </tr>
              ); })}
            </tbody>
          </table></div>
        )}
        {tab === 'incoming' && (<>
          <div className="g2-small g2-muted" style={{ padding: '10px 16px 0' }}>Expected supply by product — never available to promise until received and accepted by QC (IMS-05).</div>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Qty</th><th>ETA</th><th>Shipment</th><th>Status</th></tr></thead>
            <tbody>{inc.length === 0 ? <tr><td colSpan={5} className="g2-muted">Nothing on the way.</td></tr> : inc.map((x, i) => <tr key={i}><td>{pName(x.productId)}</td><td style={{ textAlign: 'right' }}>{x.qty}</td><td>{x.eta}</td><td className="g2-mono">{x.shipment}</td><td><Badge tone={TONE[x.status]}>{x.status}</Badge></td></tr>)}</tbody>
          </table></div>
        </>)}
      </Card>
      {book && <BookModal onClose={() => setBook(false)} onOpen={setOpen} />}
      {open && <ShipmentDrawer id={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </div>
  );
};
export default ImportsPage;
