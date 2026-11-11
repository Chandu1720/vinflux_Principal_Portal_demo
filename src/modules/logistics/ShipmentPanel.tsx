/**
 * Shipment building blocks shared by Logistics and (when Logistics is off) Orders:
 *   ShipForm      — create a shipment for one confirmed order
 *   ShipmentCard  — documents, picked batches, proof of delivery, receipt problem → claim
 */
import React, { useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import { Badge, Button, Card, ErrorList, Field, FormGrid, Input, NumberInput, Select } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { erpIssue } from '../../platform/integrations/stockSync';
import { createShipment, deliverShipment, destinationOf, fetchErpInvoices, reportProblem, shipFromSource, toShip } from '../orders/orderStore';
import type { ErpInvoice } from '../orders/orderStore';
import { erpProfile } from '../../platform/integrations/erpProfiles';
import type { Order, OrderCtx, Shipment, ShipOpts } from '../orders/orderStore';
import { carrierByName, carriers, freightFor, serves, subscribeCarriers } from './carrierStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
type Run = (r: { ok: boolean; message: string; errors?: string[] }) => boolean;
export const INVOICE_BY: Record<NonNullable<Shipment['invoiceBy']>, string> = { ERP: 'from the ERP', VinFlux: 'raised in VinFlux', 'C&F': 'raised by the C&F in VinFlux', Manual: 'entered by the shipper' };

/* ------------------------------- Create shipment ------------------------------- */

export const ShipForm: React.FC<{ o: Order; ctx: OrderCtx; destState?: string; onDone?: () => void }> = ({ o, ctx, destState, onDone }) => {
  useSubscribe(subscribeCarriers);
  const imp = useImportContext();
  const { currentUser, showToast } = useApp();
  const remaining = toShip(o);
  const src = shipFromSource(o, ctx);
  const list = carriers().filter((c) => c.active);
  const pick = list.find((c) => serves(c, destState)) ?? list[0];
  const [f, setF] = useState({ carrier: pick?.name ?? '', awb: '', vehicleNo: '', driver: '', packages: 1, weightKg: Math.max(1, o.lines.reduce((a, l) => a + remaining[l.id], 0) * 0.5), etaDays: pick?.tatDays ?? 2, invoiceNo: '' });
  const [qty, setQty] = useState<Record<string, number>>(remaining);
  const [manual, setManual] = useState<Record<string, { batch: string; serial: string; expiryDate: string; qty: number }[]>>({});
  const [errs, setErrs] = useState<string[]>([]);
  const [inv, setInv] = useState<{ list: ErpInvoice[]; picked: ErpInvoice | null; busy: boolean }>({ list: [], picked: null, busy: false });
  const liveErp = o.erpRef ? erpProfile(o.erpRef.connector)?.name ?? 'ERP' : null;
  const fetchInv = async () => {
    setInv({ ...inv, busy: true });
    try { const list = await fetchErpInvoices(o.id); setInv({ list, picked: list[0] ?? null, busy: false }); if (list[0]) setF((x) => ({ ...x, invoiceNo: list[0].number })); setErrs(list.length ? [] : [`${liveErp} has no invoice for sales order ${o.erpSalesOrder} yet — bill it in ${liveErp}, then fetch again.`]); }
    catch (e) { setInv({ ...inv, busy: false }); setErrs([(e as Error).message]); }
  };
  const car = carrierByName(f.carrier);
  const freight = freightFor(car, f.weightKg);
  const serialised = (pid: string) => (ctx.products.find((p) => p.id === pid)?.trackingMode ?? '').includes('Serial');
  const rowsFor = (lid: string, pid: string) => manual[lid] ?? Array.from({ length: serialised(pid) ? Math.max(0, qty[lid] ?? 0) : 1 }, () => ({ batch: '', serial: '', expiryDate: '', qty: serialised(pid) ? 1 : qty[lid] ?? 0 }));
  const submit = () => {
    const opts: ShipOpts = { onErpIssue: (w, a) => erpIssue(w, a, imp) };
    if (src === 'NONE') opts.manual = o.lines.flatMap((l) => rowsFor(l.id, l.productId).map((r) => ({ lineId: l.id, batch: r.batch, serial: r.serial || null, expiryDate: r.expiryDate || null, qty: r.qty })));
    const r = createShipment(o.id, qty, { carrier: f.carrier, awb: f.awb, etaDays: f.etaDays, vehicleNo: f.vehicleNo, driver: f.driver, packages: f.packages, weightKg: f.weightKg, freight, invoiceNo: f.invoiceNo, irn: inv.picked?.irn ?? null, ewayBill: inv.picked?.ewayBill ?? null }, ctx, currentUser.name, opts);
    if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return; }
    setErrs([]); showToast(r.message, 'success'); onDone?.();
  };
  return (
    <Card title="Create shipment" subtitle={src === 'NONE'
      ? 'This warehouse doesn’t track stock — enter the batches / serials you are sending (needed for traceability) and the invoice number if your ERP raised it.'
      : `Raises the tax invoice (${o.shipFrom.locType === 'CNF' ? 'at the C&F, in VinFlux' : src === 'ERP' ? 'in the ERP' : 'in VinFlux'}), e-invoice IRN and e-way bill (over ₹50,000), picks batches oldest-expiry-first and sends tracking to ${o.partnerName}.`}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t ship yet" />}
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Left to ship</th><th style={{ width: 110 }}>Ship now</th>{src === 'NONE' && <th>Batch / serial sent</th>}</tr></thead>
          <tbody>{o.lines.filter((l) => remaining[l.id] > 0).map((l) => (
            <tr key={l.id}>
              <td className="g2-strong">{l.name}</td><td style={{ textAlign: 'right' }}>{remaining[l.id]}</td>
              <td><NumberInput value={qty[l.id] ?? 0} aria-label={`Ship ${l.name}`} onChange={(x) => { setQty({ ...qty, [l.id]: Math.max(0, Math.min(remaining[l.id], x ?? 0)) }); setManual({ ...manual, [l.id]: undefined as never }); }} /></td>
              {src === 'NONE' && <td style={{ minWidth: 340 }}>{rowsFor(l.id, l.productId).map((r, i, all) => (
                <div key={i} className="g2-row" style={{ gap: 4, marginBottom: 4 }}>
                  <Input placeholder="Batch / lot" aria-label={`Batch ${l.name} ${i}`} value={r.batch} onChange={(e) => setManual({ ...manual, [l.id]: all.map((x, j) => (j === i ? { ...x, batch: e.target.value } : x)) })} />
                  {serialised(l.productId) && <Input placeholder="Serial" aria-label={`Serial ${l.name} ${i}`} value={r.serial} onChange={(e) => setManual({ ...manual, [l.id]: all.map((x, j) => (j === i ? { ...x, serial: e.target.value } : x)) })} />}
                  <Input type="date" style={{ width: 140 }} aria-label={`Expiry ${l.name} ${i}`} value={r.expiryDate} onChange={(e) => setManual({ ...manual, [l.id]: all.map((x, j) => (j === i ? { ...x, expiryDate: e.target.value } : x)) })} />
                </div>
              ))}</td>}
            </tr>
          ))}</tbody>
        </table></div>
        <FormGrid cols={3}>
          <Field label="Carrier"><Select value={f.carrier} options={list.map((c) => ({ value: c.name, label: `${c.name}${serves(c, destState) ? '' : ' (doesn’t serve this state)'}` }))} onChange={(x) => setF({ ...f, carrier: x, etaDays: carrierByName(x)?.tatDays ?? f.etaDays })} /></Field>
          <Field label="AWB / LR number" required><Input value={f.awb} onChange={(e) => setF({ ...f, awb: e.target.value })} placeholder={car?.booking === 'API (demo)' ? 'or book with the carrier →' : ''} /></Field>
          <Field label="Days to deliver"><NumberInput value={f.etaDays} onChange={(x) => setF({ ...f, etaDays: x ?? 1 })} /></Field>
          <Field label="Packages"><NumberInput value={f.packages} onChange={(x) => setF({ ...f, packages: Math.max(1, x ?? 1) })} /></Field>
          <Field label="Weight (kg)"><NumberInput value={f.weightKg} onChange={(x) => setF({ ...f, weightKg: Math.max(0.1, x ?? 1) })} /></Field>
          <Field label="Freight (rate card)" hint={car ? `${car.ratePerKg ? `₹${car.ratePerKg}/kg, ` : ''}minimum ${inr(car.minCharge)}` : undefined}><Input value={inr(freight)} readOnly /></Field>
          {car?.mode !== 'Courier (air)' && car?.mode !== 'Courier (surface)' && <><Field label="Vehicle no."><Input value={f.vehicleNo} onChange={(e) => setF({ ...f, vehicleNo: e.target.value.toUpperCase() })} placeholder="TS09 AB 1234" /></Field>
            <Field label="Driver / phone"><Input value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} /></Field></>}
          {src === 'NONE' && <Field label="Invoice no. (from your ERP)" hint="Leave empty to raise it in VinFlux."><Input value={f.invoiceNo} onChange={(e) => setF({ ...f, invoiceNo: e.target.value })} /></Field>}
          {liveErp && <Field label={`Invoice from ${liveErp}`} required hint={inv.picked ? `${inv.picked.date ?? ''} · ${inv.picked.status}${inv.picked.amount !== null ? ` · ₹${inv.picked.amount.toLocaleString('en-IN')}` : ''}` : `Sales order ${o.erpSalesOrder ?? '—'}`}>
            {inv.list.length > 1 ? <Select value={f.invoiceNo} options={inv.list.map((x) => ({ value: x.number, label: x.number }))} onChange={(v) => { setF({ ...f, invoiceNo: v }); setInv({ ...inv, picked: inv.list.find((x) => x.number === v) ?? null }); }} />
              : <Input value={f.invoiceNo} readOnly placeholder="Fetch from the ERP →" />}</Field>}
        </FormGrid>
        <div className="g2-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {liveErp && <Button disabled={inv.busy || o.erpRef?.status !== 'Sent'} onClick={() => void fetchInv()}>{inv.busy ? 'Fetching…' : `Fetch invoice from ${liveErp}`}</Button>}
          {car?.booking === 'API (demo)' && <Button onClick={() => setF({ ...f, awb: `${car.name.slice(0, 2).toUpperCase()}-${String(Date.now()).slice(-8)}` })}>Book with {car.name} (demo)</Button>}
          <Button variant="primary" icon={<Truck size={14} />} onClick={submit}>Create shipment</Button>
        </div>
      </div>
    </Card>
  );
};

/* --------------------------------- Shipment card --------------------------------- */

export const ShipmentCard: React.FC<{ o: Order; sh: Shipment; ctx: OrderCtx; canEdit: boolean; run: Run }> = ({ o, sh, ctx, canEdit, run }) => {
  const { currentUser } = useApp();
  const [pod, setPod] = useState({ receivedBy: '', method: 'Signature' as 'Signature' | 'Photo' | 'OTP' });
  const [problem, setProblem] = useState<Record<number, { short: number; damaged: number }> | null>(null);
  const dest = destinationOf(o, ctx.partners);
  const late = !sh.deliveredAt && sh.eta < new Date().toISOString().slice(0, 10);
  return (
    <Card title={<span className="g2-row">{sh.no} {sh.deliveredAt ? <Badge tone="green" dot>Delivered</Badge> : <Badge tone={late ? 'red' : 'amber'} dot>{late ? 'Late' : 'In transit'}</Badge>}{sh.tripNo && <Badge tone="slate">{sh.tripNo}</Badge>}</span>}
      subtitle={`${sh.carrier} · ${sh.awb} · dispatched ${when(sh.dispatchedAt)} · ETA ${sh.eta}`}>
      <dl className="g2-dl">
        <dt>Tax invoice</dt><dd className="g2-mono">{sh.invoiceNo} · {sh.invoiceDate} <span className="g2-muted">({INVOICE_BY[sh.invoiceBy ?? (o.shipFrom.locType === 'CNF' ? 'C&F' : 'ERP')]})</span></dd>
        <dt>E-invoice IRN</dt><dd className="g2-mono" style={{ wordBreak: 'break-all' }}>{sh.irn || (o.erpRef ? 'Not returned by the ERP' : '—')}</dd>
        <dt>E-way bill</dt><dd className="g2-mono">{sh.ewayBill ?? (o.erpRef ? 'Not returned by the ERP' : 'Not needed (value ≤ ₹50,000)')}</dd>
        {(sh.packages || sh.weightKg || sh.freight) ? <><dt>Consignment</dt><dd>{sh.packages ?? 1} package(s) · {sh.weightKg ?? '—'} kg{sh.freight ? ` · freight ${inr(sh.freight)}` : ''}{sh.vehicleNo ? ` · vehicle ${sh.vehicleNo}` : ''}{sh.driver ? ` · ${sh.driver}` : ''}</dd></> : null}
        {sh.pod && <><dt>Proof of delivery</dt><dd>{sh.pod.method} — {sh.pod.receivedBy} · {when(sh.deliveredAt!)}</dd></>}
        {sh.problem && <><dt>Receipt problem</dt><dd>{sh.problem.shortQty} short, {sh.problem.damagedQty} damaged — claim {sh.problem.claimNos.join(', ')}</dd></>}
      </dl>
      <div className="g2-table-wrap" style={{ marginTop: 8 }}><table className="g2-table">
        <thead><tr><th>Batch / serial {sh.stockSource === 'NONE' ? '(entered by shipper)' : '(oldest expiry first)'}</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Qty</th>{problem && <><th style={{ width: 100 }}>Short</th><th style={{ width: 100 }}>Damaged</th></>}</tr></thead>
        <tbody>{sh.allocations.map((a, i) => {
          const c = problem?.[i] ?? { short: 0, damaged: 0 };
          return (
            <tr key={i}>
              <td className="g2-mono g2-small">{ctx.products.find((x) => x.id === a.productId)?.name.slice(0, 40)} · {a.batch}{a.serial ? ` · ${a.serial}` : ''}</td><td>{a.expiryDate ?? '—'}</td><td style={{ textAlign: 'right' }}>{a.qty}</td>
              {problem && <>
                <td><NumberInput value={c.short} aria-label={`Short ${i}`} onChange={(x) => setProblem({ ...problem, [i]: { ...c, short: Math.max(0, Math.min(a.qty, x ?? 0)) } })} /></td>
                <td><NumberInput value={c.damaged} aria-label={`Damaged ${i}`} onChange={(x) => setProblem({ ...problem, [i]: { ...c, damaged: Math.max(0, Math.min(a.qty - c.short, x ?? 0)) } })} /></td>
              </>}
            </tr>
          );
        })}</tbody>
      </table></div>
      {canEdit && !sh.deliveredAt && (
        <div className="g2-row" style={{ gap: 8, marginTop: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}><Field label="Received by (proof of delivery)" hint={dest ? 'Stock is added to the receiver on delivery.' : 'Hospital sale — goods are consumed, not kept as stock.'}><Input value={pod.receivedBy} onChange={(e) => setPod({ ...pod, receivedBy: e.target.value })} placeholder="Name / stamp" /></Field></div>
          <div style={{ width: 150 }}><Field label="Proof"><Select value={pod.method} options={['Signature', 'Photo', 'OTP'].map((x) => ({ value: x, label: x }))} onChange={(v) => setPod({ ...pod, method: v as typeof pod.method })} /></Field></div>
          <Button variant="primary" icon={<PackageCheck size={14} />} onClick={() => run(deliverShipment(o.id, sh.id, pod.receivedBy, pod.method, ctx.partners, currentUser.name))}>Mark delivered</Button>
        </div>
      )}
      {canEdit && sh.deliveredAt && !sh.problem && (
        <div className="g2-row" style={{ gap: 8, marginTop: 10 }}>
          {!problem ? <Button size="sm" variant="ghost" onClick={() => setProblem({})}>Report shortage / damage</Button>
            : <><Button size="sm" onClick={() => setProblem(null)}>Cancel</Button><Button size="sm" variant="danger" onClick={() => { if (run(reportProblem(o.id, sh.id, problem, ctx.partners, currentUser.name))) setProblem(null); }}>Raise claim</Button>
              <span className="g2-small g2-muted">The order stays completed; the claim goes to the carrier / insurer.</span></>}
        </div>
      )}
    </Card>
  );
};
