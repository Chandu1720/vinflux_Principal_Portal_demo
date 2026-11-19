/**
 * Procurement & Vendors: buy suggestions, purchase orders, receipts with QC, vendor invoices (3-way match), vendors with scorecards.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Download, FileWarning, PackagePlus, Plus, ShoppingCart, Star, Truck } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, SearchInput, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { optChoice, subscribeOptions } from '../../platform/moduleOptions';
import { Linkify } from '../../platform/Linkify';
import { useApp } from '../../context/AppContext.tsx';
import { gstOf } from '../pricing/pricingStore';
import { subscribeOrders } from '../orders/orderStore';
import {
  acknowledgePO, approvePO, cancelPO, createPO, decideInvoice, enterInvoice, ensureProcurementDemo, getGRN, getPO, getVendor, grns as allGrns, inspect, itemsFor, poValue, pos as allPos, pullFromErp,
  receive, removeVendorItem, saveVendor, saveVendorItem, scorecard, setVendorStatus, shortClose, submitPO, subscribeProcurement, suggestions, vendorInvoices, vendorIssues, vendorItems, vendors as allVendors,
} from './procurementStore';
import type { NewPO, POStatus, ReceiveLine, Vendor, VendorKind } from './procurementStore';

const money = (n: number, cur = 'INR') => (cur === 'INR' ? `₹${Math.round(n).toLocaleString('en-IN')}` : `${cur} ${Math.round(n).toLocaleString('en-IN')}`);
const today = () => new Date().toISOString().slice(0, 10);
const plus = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const PO_TONE: Record<POStatus, BadgeTone> = { Draft: 'slate', 'Awaiting approval': 'amber', Sent: 'blue', Acknowledged: 'cyan', 'Part received': 'purple', Received: 'green', Closed: 'slate', Cancelled: 'slate' };

/* ----------------------------------------- PO form ----------------------------------------- */

const POModal: React.FC<{ preset?: { productId: string; qty: number; vendorId: string | null; orders: string[] }; onClose: () => void; onOpen: (id: string) => void }> = ({ preset, onClose, onOpen }) => {
  const { activePrincipal, currentUser, products, warehouses, showToast } = useApp();
  const vs = allVendors(activePrincipal.id);
  const [vendorId, setVendorId] = useState(preset?.vendorId ?? vs[0]?.id ?? '');
  const v = getVendor(vendorId);
  const [f, setF] = useState({ warehouseId: warehouses[0]?.id ?? '', deliveryDate: plus(v?.leadDays ?? 14), terms: '30 days credit', fxRate: 92 });
  const approved = vendorItems(vendorId);
  const [lines, setLines] = useState<{ productId: string; qty: number; price: number }[]>(preset ? [{ productId: preset.productId, qty: preset.qty, price: itemsFor(preset.productId).find((i) => i.vendorId === vendorId)?.price ?? 0 }] : []);
  const [errs, setErrs] = useState<string[]>([]);
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const save = (submit: boolean) => {
    const n: NewPO = { principalId: activePrincipal.id, vendorId, warehouseId: f.warehouseId, deliveryDate: f.deliveryDate, terms: f.terms, fxRate: f.fxRate, lines: lines.map((l) => ({ ...l, name: pName(l.productId), gstPct: gstOf(products.find((p) => p.id === l.productId)), forOrders: preset?.productId === l.productId ? preset.orders : [] })) };
    const r = createPO(n, currentUser.name); if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    const r2 = submit && r.id ? submitPO(r.id, currentUser.name) : r;
    showToast(r2.message, r2.ok ? 'success' : 'warning'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="xl" title="New purchase order" subtitle="Only approved items of an active vendor can be ordered (PUR-01)" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button onClick={() => save(false)}>Save draft</Button><Button variant="primary" onClick={() => save(true)}>Submit</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t create yet" />}
        {v && vendorIssues(v).length > 0 && <Alert tone="error">{v.name}: {vendorIssues(v).join(' ')}</Alert>}
        <FormGrid cols={3}>
          <Field label="Vendor" required><SearchableSelect value={vendorId} options={vs.map((x) => ({ value: x.id, label: x.name, description: `${x.kind} · ${x.currency}${vendorIssues(x).length ? ' · blocked' : ''}` }))} onChange={(x) => { setVendorId(x ?? ''); setLines([]); }} /></Field>
          <Field label="Deliver to" required><Select value={f.warehouseId} options={warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} onChange={(x) => setF({ ...f, warehouseId: x })} /></Field>
          <Field label="Delivery by" required><Input type="date" value={f.deliveryDate} min={today()} onChange={(e) => setF({ ...f, deliveryDate: e.target.value })} /></Field>
          <Field label="Terms"><Input value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></Field>
          {v && v.currency !== 'INR' && <Field label={`${v.currency} → INR rate`} required hint="Kept on the PO; the rate at receipt is recorded too (PUR-06)"><NumberInput value={f.fxRate} onChange={(x) => setF({ ...f, fxRate: x ?? 0 })} /></Field>}
        </FormGrid>
        <Card title="Lines" subtitle={approved.length ? `${approved.length} approved item(s) for this vendor` : 'This vendor has no approved items yet — add them on the vendor'} flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ width: 140 }}>Qty</th><th style={{ width: 160 }}>Price ({v?.currency ?? 'INR'})</th><th style={{ textAlign: 'right' }}>Value</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => <tr key={i}><td>{pName(l.productId)}</td><td><NumberInput value={l.qty} onChange={(x) => setLines(lines.map((y, j) => (j === i ? { ...y, qty: x ?? 0 } : y)))} /></td><td><NumberInput value={l.price} onChange={(x) => setLines(lines.map((y, j) => (j === i ? { ...y, price: x ?? 0 } : y)))} /></td><td style={{ textAlign: 'right' }}>{money(l.qty * l.price, v?.currency)}</td><td><Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_y, j) => j !== i))}>Remove</Button></td></tr>)}
              <tr><td colSpan={5}><div style={{ width: 360 }}><SearchableSelect value={null} placeholder="Add an approved item…" options={approved.filter((a) => !lines.some((l) => l.productId === a.productId)).map((a) => ({ value: a.productId, label: pName(a.productId), description: `${money(a.price, v?.currency)}${a.preferred ? ' · preferred' : ''}` }))} onChange={(x) => { const a = approved.find((y) => y.productId === x); if (a) setLines([...lines, { productId: a.productId, qty: 1, price: a.price }]); }} /></div></td></tr>
            </tbody>
          </table></div>
        </Card>
        <div className="g2-small">Total {money(lines.reduce((a, l) => a + l.qty * l.price, 0), v?.currency)} + GST{v && v.currency !== 'INR' ? ` ≈ ${money(lines.reduce((a, l) => a + l.qty * l.price, 0) * f.fxRate)}` : ''}. Above ₹{Number(optChoice('procurement', 'approvalLimit')).toLocaleString('en-IN')} it needs approval by someone else.</div>
      </div>
    </Modal>
  );
};

/* ----------------------------------------- PO view ----------------------------------------- */

const PODrawer: React.FC<{ id: string; onClose: () => void; canEdit: boolean; canApprove: boolean }> = ({ id, onClose, canEdit, canApprove }) => {
  useSubscribe(subscribeProcurement);
  const { currentUser, products, warehouses, showToast } = useApp();
  const p = getPO(id);
  const [mode, setMode] = useState<'receive' | 'invoice' | 'ack' | 'close' | null>(null);
  const [rl, setRl] = useState<ReceiveLine[]>([]);
  const [coa, setCoa] = useState(''); const [fx, setFx] = useState<number | null>(p?.fxRate ?? null); const [over, setOver] = useState('');
  const [inv, setInv] = useState({ no: '', date: today(), lines: {} as Record<string, { qty: number; price: number }> });
  const [txt, setTxt] = useState(''); const [ackDate, setAckDate] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  if (!p) return null;
  const v = getVendor(p.vendorId);
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok && r.errors) setErrs(r.errors); else { setErrs([]); showToast(r.message, r.ok ? 'success' : 'warning'); } return r.ok; };
  const serial = (pid: string) => (products.find((x) => x.id === pid)?.trackingRules?.mode ?? '').includes('Serial');
  const openRecv = () => { setRl(p.lines.filter((l) => l.qty > l.receivedQty).map((l) => ({ lineId: l.id, qty: l.qty - l.receivedQty, batch: '', vendorBatch: '', expiry: null, serials: [] }))); setMode('receive'); };
  const openInv = () => { setInv({ no: '', date: today(), lines: Object.fromEntries(p.lines.map((l) => [l.id, { qty: l.acceptedQty, price: l.price }])) }); setMode('invoice'); };
  const grs = allGrns(p.principalId).filter((g) => g.poId === p.id);
  const owner = optChoice('procurement', 'owner');
  return (
    <Modal open size="xl" title={<span className="g2-row" style={{ gap: 8 }}>{p.no} · {p.vendorName} <Badge tone={PO_TONE[p.status]} dot>{p.status}</Badge>{p.source === 'ERP' && <Badge tone="purple">from ERP</Badge>}</span>}
      subtitle={`${money(poValue(p), p.currency)}${p.currency !== 'INR' ? ` @ ${p.fxRate}` : ''} · deliver to ${warehouses.find((w) => w.id === p.warehouseId)?.code ?? p.warehouseId} by ${p.ack?.promisedDate ?? p.deliveryDate} · ${p.terms}`} onClose={onClose}
      footer={<>
        {p.status === 'Draft' && canEdit && <><Button onClick={() => tell(cancelPO(p.id, 'Not needed', currentUser.name))}>Cancel PO</Button><Button variant="primary" onClick={() => tell(submitPO(p.id, currentUser.name))}>Submit</Button></>}
        {p.status === 'Awaiting approval' && canApprove && <><Button variant="danger" onClick={() => tell(approvePO(p.id, currentUser.name, false, 'Re-check quantities'))}>Return</Button><Button variant="primary" onClick={() => tell(approvePO(p.id, currentUser.name, true))}>Approve and send</Button></>}
        {p.status === 'Sent' && canEdit && <Button onClick={() => setMode('ack')}>Record acknowledgement</Button>}
        {['Sent', 'Acknowledged', 'Part received'].includes(p.status) && canEdit && owner !== 'erp' && <Button variant="primary" icon={<Truck size={15} />} onClick={openRecv}>Receive goods</Button>}
        {p.status === 'Part received' && canEdit && <Button onClick={() => setMode('close')}>Short-close</Button>}
        {p.lines.some((l) => l.acceptedQty > 0) && canEdit && <Button icon={<FileWarning size={15} />} onClick={openInv}>Enter vendor invoice</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t do that yet" />}
        {v?.kind === 'Contract manufacturer' && <Alert tone="info">Contract manufacturer — each receipt needs the vendor’s batch and certificate of analysis (PUR-07).</Alert>}
        <Card title="Lines" flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Ordered</th><th style={{ textAlign: 'right' }}>Received</th><th style={{ textAlign: 'right' }}>Accepted</th><th style={{ textAlign: 'right' }}>Rejected</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
            <tbody>{p.lines.map((l) => <tr key={l.id}><td>{products.find((x) => x.id === l.productId)?.name ?? l.name}{l.forOrders.length > 0 && <div className="g2-cell-sub">for backorders {l.forOrders.join(', ')}</div>}</td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right' }}>{l.receivedQty}</td><td style={{ textAlign: 'right' }}>{l.acceptedQty}</td><td style={{ textAlign: 'right', color: l.rejectedQty ? '#b91c1c' : undefined }}>{l.rejectedQty || '—'}</td><td style={{ textAlign: 'right' }}>{money(l.price, p.currency)}</td></tr>)}</tbody>
          </table></div>
        </Card>
        {mode === 'ack' && (
          <Card title="Vendor acknowledgement" subtitle="Usually done by the vendor from the link in the PO email">
            <div className="g2-row" style={{ gap: 8 }}><div style={{ width: 170 }}><Input type="date" value={ackDate} min={today()} onChange={(e) => setAckDate(e.target.value)} /></div><Input value={txt} placeholder="Note" onChange={(e) => setTxt(e.target.value)} /><Button variant="primary" onClick={() => { if (tell(acknowledgePO(p.id, ackDate, txt, currentUser.name, 'Entered by buyer'))) setMode(null); }}>Save</Button></div>
          </Card>
        )}
        {mode === 'close' && (
          <Card title="Short-close" subtitle="The rest is not coming (PUR-04)">
            <div className="g2-row" style={{ gap: 8 }}><Input value={txt} placeholder="Reason" onChange={(e) => setTxt(e.target.value)} /><Button variant="danger" onClick={() => { if (tell(shortClose(p.id, txt, currentUser.name))) setMode(null); }}>Close PO</Button></div>
          </Card>
        )}
        {mode === 'receive' && (
          <Card title="Receive goods" subtitle={`Goods go to ${optChoice('procurement', 'inspection') !== 'false' ? 'Quarantine until QC accepts them' : 'stock'}`}>
            <div className="g2-stack" style={{ gap: 10 }}>
              {rl.map((l, i) => { const pl = p.lines.find((x) => x.id === l.lineId)!; const set = (x: Partial<ReceiveLine>) => setRl(rl.map((y, j) => (j === i ? { ...y, ...x } : y))); return (
                <div key={l.lineId} className="g2-stack" style={{ gap: 6, borderBottom: '1px solid var(--g2-border)', paddingBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>{products.find((x) => x.id === pl.productId)?.name ?? pl.name} <span className="g2-muted">· {pl.qty - pl.receivedQty} open</span></strong>
                  <FormGrid cols={3}>
                    <Field label="Qty received"><NumberInput value={l.qty} onChange={(x) => set({ qty: x ?? 0 })} /></Field>
                    <Field label="Our batch" required><Input value={l.batch} onChange={(e) => set({ batch: e.target.value })} /></Field>
                    <Field label="Expiry"><Input type="date" value={l.expiry ?? ''} onChange={(e) => set({ expiry: e.target.value || null })} /></Field>
                    {v?.kind === 'Contract manufacturer' && <Field label="Vendor’s batch"><Input value={l.vendorBatch} onChange={(e) => set({ vendorBatch: e.target.value })} /></Field>}
                    {serial(pl.productId) && <Field label="Serial numbers" hint="One per unit, comma or space separated"><Input value={l.serials.join(' ')} onChange={(e) => set({ serials: e.target.value.split(/[\s,]+/).filter(Boolean) })} /></Field>}
                  </FormGrid>
                </div>
              ); })}
              <FormGrid cols={3}>
                {v?.kind === 'Contract manufacturer' && <Field label="Certificate of analysis" required><Input value={coa} placeholder="CoA number / file" onChange={(e) => setCoa(e.target.value)} /></Field>}
                {p.currency !== 'INR' && <Field label={`${p.currency} rate at receipt`} required><NumberInput value={fx} onChange={setFx} /></Field>}
                <Field label="If more than ordered: approval reason" hint="Needed above the tolerance (PUR-02)"><Input value={over} onChange={(e) => setOver(e.target.value)} /></Field>
              </FormGrid>
              <div><Button variant="primary" onClick={() => { if (tell(receive(p.id, rl, coa, p.currency === 'INR' ? null : fx, over, currentUser.name, serial))) setMode(null); }}>Record receipt</Button></div>
            </div>
          </Card>
        )}
        {mode === 'invoice' && (
          <Card title="Vendor invoice" subtitle="Matched to PO and accepted quantities (3-way); differences go to the exception queue">
            <FormGrid cols={3}><Field label="Invoice no." required><Input value={inv.no} onChange={(e) => setInv({ ...inv, no: e.target.value })} /></Field><Field label="Date"><Input type="date" value={inv.date} onChange={(e) => setInv({ ...inv, date: e.target.value })} /></Field></FormGrid>
            <div className="g2-stack" style={{ gap: 6, marginTop: 8 }}>{p.lines.map((l) => <div key={l.id} className="g2-row" style={{ gap: 8 }}><span style={{ flex: 1 }} className="g2-small">{products.find((x) => x.id === l.productId)?.name ?? l.name} · accepted {l.acceptedQty} @ {money(l.price, p.currency)}</span><div style={{ width: 110 }}><NumberInput value={inv.lines[l.id]?.qty ?? 0} onChange={(x) => setInv({ ...inv, lines: { ...inv.lines, [l.id]: { ...inv.lines[l.id], qty: x ?? 0 } } })} /></div><div style={{ width: 130 }}><NumberInput value={inv.lines[l.id]?.price ?? 0} onChange={(x) => setInv({ ...inv, lines: { ...inv.lines, [l.id]: { ...inv.lines[l.id], price: x ?? 0 } } })} /></div></div>)}</div>
            <div style={{ marginTop: 8 }}><Button variant="primary" onClick={() => { if (tell(enterInvoice(p.id, inv.no, inv.date, Object.entries(inv.lines).map(([lineId, x]) => ({ lineId, ...x })), currentUser.name))) setMode(null); }}>Match invoice</Button></div>
          </Card>
        )}
        {grs.length > 0 && <Card title="Receipts" flush><div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>GRN</th><th>Received</th><th>Batch</th><th style={{ textAlign: 'right' }}>Qty</th><th>QC</th></tr></thead><tbody>{grs.map((g) => <tr key={g.id}><td className="g2-mono">{g.no}{g.coa && <div className="g2-cell-sub">{g.coa}</div>}</td><td className="g2-small">{g.receivedAt.slice(0, 16).replace('T', ' ')} · {g.by}</td><td className="g2-small">{g.lines.map((l) => l.batch).join(', ')}</td><td style={{ textAlign: 'right' }}>{g.lines.reduce((a, l) => a + l.qty, 0)}</td><td><Badge tone={g.status === 'In QC' ? 'amber' : g.status === 'Accepted' ? 'green' : g.status === 'Rejected' ? 'red' : 'purple'}>{g.status}</Badge>{g.rtv && <div className="g2-cell-sub">{g.rtv}</div>}</td></tr>)}</tbody></table></div></Card>}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{p.history.map((h, i) => <div key={i} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? <> (<Linkify text={h.note} />)</> : ''}</div>)}</div></Card>
      </div>
    </Modal>
  );
};

/* ------------------------------------------ QC ------------------------------------------ */

const QCModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { currentUser, products, showToast } = useApp();
  const g = getGRN(id);
  const [dec, setDec] = useState<Record<number, { accepted: number; reason: string }>>(() => Object.fromEntries((g?.lines ?? []).map((l, i) => [i, { accepted: l.qty, reason: '' }])));
  const [errs, setErrs] = useState<string[]>([]);
  if (!g) return null;
  return (
    <Modal open size="lg" title={`QC · ${g.no}`} subtitle={`${g.vendorName} · ${g.poNo}${g.coa ? ` · ${g.coa}` : ''}`} onClose={onClose} footer={<><Button onClick={onClose}>Later</Button><Button variant="primary" onClick={() => { const r = inspect(g.id, dec, currentUser.name); if (!r.ok) setErrs(r.errors ?? [r.message]); else { showToast(r.message, 'success'); onClose(); } }}>Save inspection</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Check the inspection" />}
        {g.lines.map((l, i) => (
          <div key={i} className="g2-row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13 }}>{products.find((x) => x.id === l.productId)?.name}</div><div className="g2-small g2-muted">batch {l.batch}{l.vendorBatch ? ` · vendor ${l.vendorBatch}` : ''} · {l.qty} received</div></div>
            <div style={{ width: 120 }}><Field label="Accept"><NumberInput value={dec[i]?.accepted ?? l.qty} onChange={(x) => setDec({ ...dec, [i]: { ...dec[i], accepted: x ?? 0 } })} /></Field></div>
            <div style={{ width: 260 }}><Field label="Reject reason"><Input value={dec[i]?.reason ?? ''} onChange={(e) => setDec({ ...dec, [i]: { ...dec[i], reason: e.target.value } })} /></Field></div>
          </div>
        ))}
        <div className="g2-small g2-muted">Accepted goods move from Quarantine to Available. Rejected goods get a return-to-vendor note and a debit note (PUR-05).</div>
      </div>
    </Modal>
  );
};

/* ---------------------------------------- Vendor ---------------------------------------- */

const VendorModal: React.FC<{ id: string | null; onClose: () => void; canEdit: boolean }> = ({ id, onClose, canEdit }) => {
  useSubscribe(subscribeProcurement);
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const ex = id ? getVendor(id) : null;
  const [v, setV] = useState<Vendor>(ex ?? { id: '', code: '', principalId: activePrincipal.id, name: '', kind: 'Trading vendor', gstin: '', country: 'India', currency: 'INR', city: '', contact: '', email: '', phone: '', bank: '', leadDays: 10, status: 'Active', docs: [], history: [] });
  const [errs, setErrs] = useState<string[]>([]);
  const [doc, setDoc] = useState({ name: '', number: '', validTo: '' });
  const sc = ex ? scorecard(activePrincipal.id, ex.id) : null;
  const save = () => { const r = saveVendor(v, currentUser.name); if (!r.ok) setErrs(r.errors ?? [r.message]); else { showToast(r.message, 'success'); onClose(); } };
  return (
    <Modal open size="xl" title={ex ? `${ex.code} · ${ex.name}` : 'New vendor'} subtitle={ex ? `${ex.kind} · ${ex.city}, ${ex.country}` : 'Vendors are approved per item before they can be ordered from'} onClose={onClose}
      footer={canEdit ? <>{ex && <Button onClick={() => { setVendorStatus(ex.id, ex.status === 'Blocked' ? 'Active' : 'Blocked', currentUser.name); onClose(); }}>{ex.status === 'Blocked' ? 'Unblock' : 'Block'}</Button>}<Button variant="primary" onClick={save}>Save vendor</Button></> : undefined}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t save yet" />}
        {ex && vendorIssues(ex).length > 0 && <Alert tone="error">Can’t be ordered from: {vendorIssues(ex).join(' ')}</Alert>}
        {sc && sc.pos > 0 && (
          <div className="g2-grid g2-grid-4">
            <KpiCard label="On time" value={sc.onTime === null ? '—' : `${sc.onTime}%`} icon={<Truck size={20} />} color="#2563eb" bg="#eff6ff" />
            <KpiCard label="Fill rate" value={sc.fillRate === null ? '—' : `${sc.fillRate}%`} icon={<PackagePlus size={20} />} color="#059669" bg="#ecfdf5" />
            <KpiCard label="QC rejection" value={sc.rejection === null ? '—' : `${sc.rejection}%`} icon={<ClipboardCheck size={20} />} color="#dc2626" bg="#fef2f2" />
            <KpiCard label="Price variance" value={sc.priceVar === null ? '—' : `${sc.priceVar > 0 ? '+' : ''}${sc.priceVar}%`} icon={<FileWarning size={20} />} color="#d97706" bg="#fffbeb" foot={sc.leadDays !== null ? `avg lead ${sc.leadDays} days` : undefined} />
          </div>
        )}
        <FormGrid cols={3}>
          <Field label="Name" required><Input value={v.name} disabled={!canEdit} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Kind"><Select value={v.kind} disabled={!canEdit} options={(['Trading vendor', 'Contract manufacturer', 'Overseas supplier', 'Component vendor'] as VendorKind[]).map((k) => ({ value: k, label: k }))} onChange={(x) => setV({ ...v, kind: x as VendorKind, country: x === 'Overseas supplier' ? (v.country === 'India' ? '' : v.country) : v.country })} /></Field>
          <Field label="Country"><Input value={v.country} disabled={!canEdit} onChange={(e) => setV({ ...v, country: e.target.value })} /></Field>
          {v.country === 'India' && <Field label="GSTIN" required><Input value={v.gstin} disabled={!canEdit} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} /></Field>}
          <Field label="Currency"><Select value={v.currency} disabled={!canEdit} options={['INR', 'USD', 'EUR', 'CNY', 'JPY'].map((c) => ({ value: c, label: c }))} onChange={(x) => setV({ ...v, currency: x })} /></Field>
          <Field label="City"><Input value={v.city} disabled={!canEdit} onChange={(e) => setV({ ...v, city: e.target.value })} /></Field>
          <Field label="Contact"><Input value={v.contact} disabled={!canEdit} onChange={(e) => setV({ ...v, contact: e.target.value })} /></Field>
          <Field label="Email (POs are sent here)"><Input value={v.email} disabled={!canEdit} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={v.phone} disabled={!canEdit} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Bank"><Input value={v.bank} disabled={!canEdit} onChange={(e) => setV({ ...v, bank: e.target.value })} /></Field>
          <Field label="Lead time (days)"><NumberInput value={v.leadDays} disabled={!canEdit} onChange={(x) => setV({ ...v, leadDays: x ?? 0 })} /></Field>
        </FormGrid>
        <Card title="Licences and documents" subtitle="An expired document blocks new POs">
          {v.docs.map((d, i) => <div key={i} className="g2-row g2-small" style={{ gap: 8 }}><span style={{ flex: 1 }}>{d.name} · <span className="g2-mono">{d.number}</span></span><Badge tone={d.validTo && d.validTo < today() ? 'red' : 'green'}>{d.validTo ? `valid to ${d.validTo}` : 'no expiry'}</Badge>{canEdit && <Button size="sm" variant="ghost" onClick={() => setV({ ...v, docs: v.docs.filter((_x, j) => j !== i) })}>Remove</Button>}</div>)}
          {canEdit && <div className="g2-row" style={{ gap: 6, marginTop: 8 }}><Input value={doc.name} placeholder="e.g. Manufacturing licence (MD-5)" onChange={(e) => setDoc({ ...doc, name: e.target.value })} /><Input value={doc.number} placeholder="Number" onChange={(e) => setDoc({ ...doc, number: e.target.value })} /><div style={{ width: 160 }}><Input type="date" value={doc.validTo} onChange={(e) => setDoc({ ...doc, validTo: e.target.value })} /></div><Button size="sm" onClick={() => { if (doc.name.trim()) { setV({ ...v, docs: [...v.docs, { ...doc, validTo: doc.validTo || null }] }); setDoc({ name: '', number: '', validTo: '' }); } }}>Add</Button></div>}
        </Card>
        {ex && (
          <Card title="Approved items" subtitle="Only these can be ordered from this vendor (PUR-01)">
            {vendorItems(ex.id).map((it) => <div key={it.productId} className="g2-row g2-small" style={{ gap: 8 }}><span style={{ flex: 1 }}>{products.find((p) => p.id === it.productId)?.name}</span><span>{money(it.price, ex.currency)}</span>{it.preferred ? <Badge tone="purple"><Star size={10} /> preferred</Badge> : canEdit && <Button size="sm" variant="ghost" onClick={() => saveVendorItem({ ...it, preferred: true })}>Make preferred</Button>}{canEdit && <Button size="sm" variant="ghost" onClick={() => removeVendorItem(ex.id, it.productId)}>Remove</Button>}</div>)}
            {canEdit && <div style={{ width: 380, marginTop: 8 }}><SearchableSelect value={null} placeholder="Approve another item…" options={products.filter((p) => p.lifecycleStatus === 'Active' && !vendorItems(ex.id).some((i) => i.productId === p.id)).map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(x) => { if (x) saveVendorItem({ vendorId: ex.id, productId: x, price: Math.round((products.find((p) => p.id === x)?.pricingReference?.mrp ?? 1000) * 0.5), validTo: null, preferred: itemsFor(x).length === 0 }); }} /></div>}
          </Card>
        )}
      </div>
    </Modal>
  );
};

/* ------------------------------------------ Page ------------------------------------------ */

const ProcurementPage: React.FC = () => {
  useSubscribe(subscribeProcurement, subscribeOrders, subscribeOptions);
  const { activePrincipal, currentUser, products, warehouses, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'pos';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [newPO, setNewPO] = useState<{ preset?: { productId: string; qty: number; vendorId: string | null; orders: string[] } } | null>(null);
  const [openPO, setOpenPO] = useState<string | null>(null);
  const [qc, setQc] = useState<string | null>(null);
  const [openV, setOpenV] = useState<string | null | 'new'>(null);
  const [decide, setDecide] = useState<{ id: string; note: string } | null>(null);
  const m = currentUser.matrix;
  const canEdit = !m || !!m.inventory?.includes('edit') || !!m.pricing?.includes('edit');
  const canApprove = !m || !!m.pricing?.includes('approve') || !!m.inventory?.includes('configure');
  const owner = optChoice('procurement', 'owner');
  const prodsForDemo = useMemo(() => products.filter((p) => p.lifecycleStatus === 'Active').slice(0, 3).map((p) => ({ id: p.id, name: p.name, price: p.pricingReference?.mrp ?? 20000, gstPct: gstOf(p) })), [products]);
  useEffect(() => { ensureProcurementDemo(activePrincipal.id, prodsForDemo, warehouses[0]?.id ?? ''); }, [activePrincipal.id, prodsForDemo.length, warehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const ps = allPos(activePrincipal.id); const gs = allGrns(activePrincipal.id); const vis = vendorInvoices(activePrincipal.id); const vs = allVendors(activePrincipal.id);
  const sug = suggestions(activePrincipal.id);
  const inQC = gs.filter((g) => g.status === 'In QC');
  const exc = vis.filter((i) => i.status === 'Exception');
  const openVal = ps.filter((p) => !['Draft', 'Received', 'Closed', 'Cancelled'].includes(p.status)).reduce((a, p) => a + poValue(p) * p.fxRate, 0);
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Procurement & Vendors" description={owner === 'vinflux' ? 'Buy from vendors and contract manufacturers: PO, vendor acknowledgement, receipt into Quarantine, QC, and invoice match.' : owner === 'erp' ? 'Purchasing runs in your ERP — POs and receipts are shown here as incoming supply.' : 'POs come from your ERP; receipt and QC happen here.'}
        actions={canEdit && <>{owner !== 'vinflux' && <Button icon={<Download size={15} />} onClick={() => tell(pullFromErp(activePrincipal.id, warehouses[0]?.id ?? '', currentUser.name))}>Pull from ERP</Button>}<Button icon={<Plus size={15} />} onClick={() => setOpenV('new')}>New vendor</Button>{owner === 'vinflux' && <Button variant="primary" icon={<ShoppingCart size={15} />} onClick={() => setNewPO({})}>New PO</Button>}</>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Open purchase orders" value={ps.filter((p) => ['Sent', 'Acknowledged', 'Part received'].includes(p.status)).length} icon={<ShoppingCart size={22} />} color="#2563eb" bg="#eff6ff" foot={`₹${Math.round(openVal).toLocaleString('en-IN')} on order · ${ps.filter((p) => p.status === 'Awaiting approval').length} awaiting approval`} onClick={() => setTab('pos')} />
        <KpiCard label="To buy (backorders)" value={sug.length} icon={<PackagePlus size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${sug.reduce((a, s) => a + s.suggest, 0)} unit(s) not yet on order`} onClick={() => setTab('suggest')} />
        <KpiCard label="Waiting for QC" value={inQC.length} icon={<ClipboardCheck size={22} />} color="#d97706" bg="#fffbeb" foot={`${inQC.reduce((a, g) => a + g.lines.reduce((s, l) => s + l.qty, 0), 0)} unit(s) in Quarantine`} onClick={() => setTab('grn')} />
        <KpiCard label="Invoice exceptions" value={exc.length} icon={<FileWarning size={22} />} color="#dc2626" bg="#fef2f2" foot="price or quantity doesn’t match" onClick={() => setTab('invoices')} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'suggest', label: 'To buy', count: sug.length || undefined },
            { id: 'pos', label: 'Purchase orders', count: ps.length },
            { id: 'grn', label: 'Receipts & QC', count: inQC.length || undefined },
            { id: 'invoices', label: 'Vendor invoices', count: exc.length || undefined },
            { id: 'vendors', label: 'Vendors', count: vs.length },
          ]} />
          <span className="g2-spacer" />
          {tab !== 'suggest' && <SearchInput value={q} onChange={setQ} placeholder="PO, vendor, product…" />}
        </div>

        {tab === 'suggest' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>On backorder</th><th style={{ textAlign: 'right' }}>Our stock</th><th style={{ textAlign: 'right' }}>On order</th><th style={{ textAlign: 'right' }}>Suggest</th><th>Preferred vendor</th><th /></tr></thead>
            <tbody>
              {sug.length === 0 && <tr><td colSpan={7} className="g2-muted">Nothing to buy — every backorder is covered by an open PO.</td></tr>}
              {sug.map((s) => <tr key={s.productId}><td>{pName(s.productId)}<div className="g2-cell-sub">{s.orderRefs.join(', ')}</div></td><td style={{ textAlign: 'right' }}>{s.backorders}</td><td style={{ textAlign: 'right' }}>{s.companyStock}</td><td style={{ textAlign: 'right' }}>{s.onOrder}</td><td style={{ textAlign: 'right' }} className="g2-strong">{s.suggest}</td><td className="g2-small">{s.vendorId ? getVendor(s.vendorId)?.name : <Badge tone="red">No approved vendor</Badge>}</td>
                <td>{owner === 'vinflux' && canEdit && <Button size="sm" variant="primary" disabled={!s.vendorId} onClick={() => setNewPO({ preset: { productId: s.productId, qty: s.suggest, vendorId: s.vendorId, orders: s.orderRefs } })}>Raise PO</Button>}</td></tr>)}
            </tbody>
          </table></div>
        )}

        {tab === 'pos' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>PO</th><th>Vendor</th><th>Delivery</th><th style={{ textAlign: 'right' }}>Value</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>{ps.filter((p) => match(`${p.no} ${p.vendorName} ${p.lines.map((l) => pName(l.productId)).join(' ')}`)).map((p) => {
              const ord = p.lines.reduce((a, l) => a + l.qty, 0); const rec = p.lines.reduce((a, l) => a + l.receivedQty, 0);
              const late = ['Sent', 'Acknowledged', 'Part received'].includes(p.status) && (p.ack?.promisedDate ?? p.deliveryDate) < today();
              return <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setOpenPO(p.id)}><td className="g2-mono">{p.no}{p.source === 'ERP' && <div className="g2-cell-sub">from ERP</div>}</td><td>{p.vendorName}<div className="g2-cell-sub">{p.lines.length} line(s)</div></td><td className="g2-small">{p.ack?.promisedDate ?? p.deliveryDate}{p.ack && <div className="g2-cell-sub">confirmed by vendor</div>}{late && <> <Badge tone="red">late</Badge></>}</td><td style={{ textAlign: 'right' }}>{money(poValue(p), p.currency)}</td><td className="g2-small">{rec} / {ord}</td><td><Badge tone={PO_TONE[p.status]} dot>{p.status}</Badge></td></tr>;
            })}</tbody>
          </table></div>
        )}

        {tab === 'grn' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Receipt</th><th>Vendor · PO</th><th>Products · batch</th><th style={{ textAlign: 'right' }}>Qty</th><th>QC</th><th /></tr></thead>
            <tbody>{gs.filter((g) => match(`${g.no} ${g.poNo} ${g.vendorName}`)).map((g) => <tr key={g.id}><td className="g2-mono">{g.no}<div className="g2-cell-sub">{g.receivedAt.slice(0, 10)} · {g.by}</div></td><td>{g.vendorName}<div className="g2-cell-sub">{g.poNo}{g.coa ? ` · ${g.coa}` : ''}</div></td><td className="g2-small">{g.lines.map((l) => `${pName(l.productId)} · ${l.batch}`).join('; ')}</td><td style={{ textAlign: 'right' }}>{g.lines.reduce((a, l) => a + l.qty, 0)}{g.status !== 'In QC' && <div className="g2-cell-sub">{g.lines.reduce((a, l) => a + (l.accepted ?? 0), 0)} accepted</div>}</td><td><Badge tone={g.status === 'In QC' ? 'amber' : g.status === 'Accepted' ? 'green' : g.status === 'Rejected' ? 'red' : 'purple'} dot>{g.status}</Badge>{g.rtv && <div className="g2-cell-sub">{g.rtv}</div>}{!g.stockPosted && <div className="g2-cell-sub">stock posted by ERP</div>}</td><td>{g.status === 'In QC' && canEdit && <Button size="sm" variant="primary" onClick={() => setQc(g.id)}>Inspect</Button>}</td></tr>)}</tbody>
          </table></div>
        )}

        {tab === 'invoices' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Invoice</th><th>Vendor · PO</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Match</th><th /></tr></thead>
            <tbody>
              {vis.length === 0 && <tr><td colSpan={6} className="g2-muted">No vendor invoices yet.</td></tr>}
              {vis.filter((i) => match(`${i.no} ${i.vendorName} ${i.poNo}`)).map((i) => <tr key={i.id}><td className="g2-mono">{i.no}</td><td>{i.vendorName}<div className="g2-cell-sub">{i.poNo}</div></td><td className="g2-small">{i.date}</td><td style={{ textAlign: 'right' }}>₹{i.amount.toLocaleString('en-IN')}</td><td><Badge tone={i.status === 'Matched' || i.status === 'Approved' ? 'green' : i.status === 'Exception' ? 'red' : 'slate'} dot>{i.status}</Badge>{i.payableRef && <div className="g2-cell-sub">payable {i.payableRef}</div>}{i.exceptions.map((e, k) => <div key={k} className="g2-cell-sub" style={{ color: '#b91c1c' }}>{e}</div>)}</td><td>{i.status === 'Exception' && canApprove && <Button size="sm" onClick={() => setDecide({ id: i.id, note: '' })}>Decide</Button>}</td></tr>)}
            </tbody>
          </table></div>
        )}

        {tab === 'vendors' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Vendor</th><th>Kind</th><th>Approved items</th><th style={{ textAlign: 'right' }}>On time</th><th style={{ textAlign: 'right' }}>QC rejection</th><th>Status</th></tr></thead>
            <tbody>{vs.filter((v) => match(`${v.name} ${v.code} ${v.city}`)).map((v) => { const sc = scorecard(activePrincipal.id, v.id); const iss = vendorIssues(v); return <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setOpenV(v.id)}><td className="g2-strong">{v.name}<div className="g2-cell-sub">{v.code} · {v.city}, {v.country} · {v.currency}</div></td><td className="g2-small">{v.kind}</td><td className="g2-small">{vendorItems(v.id).length}</td><td style={{ textAlign: 'right' }}>{sc.onTime === null ? '—' : `${sc.onTime}%`}</td><td style={{ textAlign: 'right' }}>{sc.rejection === null ? '—' : `${sc.rejection}%`}</td><td>{iss.length ? <Badge tone="red" title={iss.join(' ')}>Blocked</Badge> : <Badge tone="green" dot>Active</Badge>}{iss.length > 0 && <div className="g2-cell-sub" style={{ color: '#b91c1c' }}>{iss[0]}</div>}</td></tr>; })}</tbody>
          </table></div>
        )}
      </Card>
      {newPO && <POModal preset={newPO.preset} onClose={() => setNewPO(null)} onOpen={setOpenPO} />}
      {openPO && <PODrawer id={openPO} canEdit={canEdit} canApprove={canApprove} onClose={() => setOpenPO(null)} />}
      {qc && <QCModal id={qc} onClose={() => setQc(null)} />}
      {openV && <VendorModal id={openV === 'new' ? null : openV} canEdit={canEdit} onClose={() => setOpenV(null)} />}
      {decide && (
        <Modal open variant="modal" title="Invoice exception" onClose={() => setDecide(null)} footer={<><Button onClick={() => setDecide(null)}>Cancel</Button><Button variant="danger" onClick={() => { const r = decideInvoice(decide.id, false, currentUser.name, decide.note); tell(r); if (r.ok) setDecide(null); }}>Reject</Button><Button variant="primary" onClick={() => { const r = decideInvoice(decide.id, true, currentUser.name, decide.note); tell(r); if (r.ok) setDecide(null); }}>Approve anyway</Button></>}>
          <Field label="Note for the record" required><Textarea rows={3} value={decide.note} onChange={(e) => setDecide({ ...decide, note: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
};
export default ProcurementPage;
