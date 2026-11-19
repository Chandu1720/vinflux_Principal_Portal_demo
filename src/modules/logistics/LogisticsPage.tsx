/**
 * Logistics — everything that physically moves:
 *   dispatch queue (confirmed orders) → shipment or one trip for several orders → in transit → proof of delivery → claims.
 * Carriers with rate cards and a scorecard. Orders only shows the status.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Pencil, Plus, Timer, Truck } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, Input, KpiCard, Modal, MultiSelect, NumberInput, PageHeader, SearchInput, Select, Tabs } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { erpIssue } from '../../platform/integrations/stockSync';
import { subscribeStock } from '../inventory/stockStore';
import { allShipments, claims, createShipment, getOrder, nextTripNo, orderValue, orders, settleClaim, shipFromSource, subscribeOrders, toShip } from '../orders/orderStore';
import type { Order, OrderCtx } from '../orders/orderStore';
import { useOrderCtx } from '../orders/useOrderCtx';
import { ensureDemo } from '../orders/seedDemo';
import { ShipForm, ShipmentCard } from './ShipmentPanel';
import { blankCarrier, carrierByName, carriers, freightFor, saveCarrier, scorecard, serves, subscribeCarriers } from './carrierStore';
import type { Carrier, CarrierMode } from './carrierStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Gujarat', 'Delhi', 'Uttar Pradesh', 'West Bengal', 'Rajasthan', 'Madhya Pradesh', 'Punjab', 'Haryana', 'Odisha', 'Bihar'];
const units = (o: Order) => Object.values(toShip(o)).reduce((a, b) => a + b, 0);

/* ---------------------------------- Drawers ---------------------------------- */

const OrderShipDrawer: React.FC<{ id: string; ctx: OrderCtx; onClose: () => void }> = ({ id, ctx, onClose }) => {
  useSubscribe(subscribeOrders);
  const o = getOrder(id);
  if (!o) return null;
  const p = ctx.partners.find((x) => x.id === o.partnerId);
  return (
    <Modal open size="xl" title={`Ship ${o.code} · ${o.partnerName}`} subtitle={`PO ${o.poNumber} · ships from ${o.shipFrom.name} · deliver to ${p?.address?.city ?? '—'}, ${p?.address?.state ?? '—'} · required by ${o.requiredBy}`} onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}>
      <div className="g2-stack">
        {o.status === 'Confirmed' ? <ShipForm o={o} ctx={ctx} destState={p?.address?.state} onDone={() => { if (getOrder(id)?.status !== 'Confirmed') onClose(); }} /> : <Alert tone="success">Everything on this order has shipped.</Alert>}
        {o.shipments.length > 0 && <div className="g2-label">Already shipped</div>}
        {o.shipments.map((sh) => <ShipmentCard key={sh.id} o={o} sh={sh} ctx={ctx} canEdit={false} run={() => true} />)}
      </div>
    </Modal>
  );
};

const TripDrawer: React.FC<{ ids: string[]; ctx: OrderCtx; onClose: () => void }> = ({ ids, ctx, onClose }) => {
  useSubscribe(subscribeCarriers);
  const imp = useImportContext();
  const { currentUser, showToast } = useApp();
  const list = ids.map(getOrder).filter((o): o is Order => !!o);
  const states = [...new Set(list.map((o) => ctx.partners.find((p) => p.id === o.partnerId)?.address?.state).filter(Boolean))] as string[];
  const fit = carriers().filter((c) => c.active && states.every((s) => serves(c, s)));
  const [f, setF] = useState({ carrier: fit.find((c) => c.mode.startsWith('Road') || c.mode === 'Own vehicle')?.name ?? fit[0]?.name ?? '', lr: '', vehicleNo: '', driver: '', etaDays: 2, weightKg: Math.max(1, list.reduce((a, o) => a + units(o), 0) * 0.5) });
  const [errs, setErrs] = useState<string[]>([]);
  const car = carrierByName(f.carrier);
  const freight = freightFor(car, f.weightKg);
  const go = () => {
    const e: string[] = [];
    if (!f.lr.trim()) e.push('LR / trip document number is required.');
    if (car && (car.mode.startsWith('Road') || car.mode === 'Own vehicle') && !f.vehicleNo.trim()) e.push('Vehicle number is required for a road trip.');
    if (e.length) { setErrs(e); return; }
    const trip = nextTripNo();
    const totalUnits = list.reduce((a, o) => a + units(o), 0) || 1;
    const out = list.map((o) => createShipment(o.id, toShip(o), { carrier: f.carrier, awb: f.lr, etaDays: f.etaDays, vehicleNo: f.vehicleNo, driver: f.driver, packages: 1, weightKg: Math.round((f.weightKg * units(o)) / totalUnits * 10) / 10, freight: Math.round((freight * units(o)) / totalUnits), tripNo: trip }, ctx, currentUser.name, { onErpIssue: (w, a) => erpIssue(w, a, imp) }));
    const bad = out.map((r, i) => (r.ok ? null : `${list[i].code}: ${[r.message, ...(r.errors ?? [])].join(' ')}`)).filter((x): x is string => !!x);
    if (bad.length) { setErrs(bad); if (bad.length === list.length) return; }
    showToast(`Trip ${trip}: ${out.filter((r) => r.ok).length} shipment(s) created on one ${car?.mode === 'Own vehicle' ? 'vehicle' : 'LR'}.`, 'success');
    if (!bad.length) onClose();
  };
  return (
    <Modal open size="lg" title={`One trip for ${list.length} orders`} subtitle="Each order gets its own shipment, invoice and e-way bill; they travel together on one vehicle / LR and freight is split by quantity." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Truck size={14} />} onClick={go}>Create trip</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Order</th><th>Deliver to</th><th style={{ textAlign: 'right' }}>Units</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
          <tbody>{list.map((o) => { const p = ctx.partners.find((x) => x.id === o.partnerId); return <tr key={o.id}><td className="g2-strong">{o.code}</td><td>{o.partnerName}<div className="g2-cell-sub">{p?.address?.city}, {p?.address?.state}</div></td><td style={{ textAlign: 'right' }}>{units(o)}</td><td style={{ textAlign: 'right' }}>{inr(orderValue(o, true))}</td></tr>; })}</tbody>
        </table></div>
        <FormGrid cols={3}>
          <Field label="Carrier" hint={fit.length < carriers().filter((c) => c.active).length ? 'Only carriers serving every destination state are listed.' : undefined}><Select value={f.carrier} options={fit.map((c) => ({ value: c.name, label: `${c.name} · ${c.mode}` }))} onChange={(x) => setF({ ...f, carrier: x, etaDays: carrierByName(x)?.tatDays ?? f.etaDays })} /></Field>
          <Field label="LR / trip document no." required><Input value={f.lr} onChange={(e) => setF({ ...f, lr: e.target.value })} /></Field>
          <Field label="Days to deliver"><NumberInput value={f.etaDays} onChange={(x) => setF({ ...f, etaDays: x ?? 1 })} /></Field>
          <Field label="Vehicle no."><Input value={f.vehicleNo} onChange={(e) => setF({ ...f, vehicleNo: e.target.value.toUpperCase() })} placeholder="TS09 AB 1234" /></Field>
          <Field label="Driver / phone"><Input value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} /></Field>
          <Field label="Total weight (kg)"><NumberInput value={f.weightKg} onChange={(x) => setF({ ...f, weightKg: Math.max(0.1, x ?? 1) })} /></Field>
        </FormGrid>
        <Alert tone="info">Freight from the rate card: <strong>{inr(freight)}</strong>{car ? ` (${car.ratePerKg ? `₹${car.ratePerKg}/kg, ` : ''}minimum ${inr(car.minCharge)})` : ''} — split across the orders by quantity.</Alert>
      </div>
    </Modal>
  );
};

const CarrierDrawer: React.FC<{ value: Carrier; onClose: () => void }> = ({ value, onClose }) => {
  const { showToast } = useApp();
  const [c, setC] = useState(value);
  const [errs, setErrs] = useState<string[]>([]);
  const save = () => { const r = saveCarrier(c); if (!r.ok) { setErrs(r.errors ?? [r.message]); return; } showToast(r.message, 'success'); onClose(); };
  return (
    <Modal open size="md" title={value.id ? `Edit ${value.name}` : 'Add carrier'} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <FormGrid>
          <Field label="Name" required><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Type"><Select value={c.mode} options={(['Courier (air)', 'Courier (surface)', 'Road transport (LTL / FTL)', 'Own vehicle'] as CarrierMode[]).map((x) => ({ value: x, label: x }))} onChange={(x) => setC({ ...c, mode: x as CarrierMode })} /></Field>
          <Field label="Rate per kg (₹)"><NumberInput value={c.ratePerKg} onChange={(x) => setC({ ...c, ratePerKg: x ?? 0 })} /></Field>
          <Field label="Minimum charge (₹)"><NumberInput value={c.minCharge} onChange={(x) => setC({ ...c, minCharge: x ?? 0 })} /></Field>
          <Field label="Usual delivery (days)"><NumberInput value={c.tatDays} onChange={(x) => setC({ ...c, tatDays: x ?? 1 })} /></Field>
          <Field label="Booking"><Select value={c.booking} options={['Manual (enter AWB / LR)', 'API (demo)'].map((x) => ({ value: x, label: x }))} onChange={(x) => setC({ ...c, booking: x as Carrier['booking'] })} /></Field>
        </FormGrid>
        <Field label="States served" hint="Leave empty for all of India."><MultiSelect values={c.states} options={STATES.map((s) => ({ value: s, label: s }))} onChange={(v) => setC({ ...c, states: v })} /></Field>
        <Checkbox checked={c.coldChain} onChange={(v) => setC({ ...c, coldChain: v })} label="Cold chain (2–8 °C) available" />
        <Checkbox checked={c.active} onChange={(v) => setC({ ...c, active: v })} label="Active" />
      </div>
    </Modal>
  );
};

/* ------------------------------------ Page ------------------------------------ */

const LogisticsPage: React.FC = () => {
  useSubscribe(subscribeOrders, subscribeStock, subscribeCarriers);
  const ctx = useOrderCtx();
  const imp = useImportContext();
  const { activePrincipal, currentUser, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'queue';
  const setTab = (t: string) => { params.set('tab', t); params.delete('o'); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [shipId, setShipId] = useState<string | null>(params.get('o'));
  const [trip, setTrip] = useState<string[] | null>(null);
  const [view, setView] = useState<{ orderId: string; shipmentId: string } | null>(null);
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  useEffect(() => { if (ctx) ensureDemo(imp, ctx, activePrincipal.id); }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = orders().filter((o) => o.principalId === activePrincipal.id);
  const queue = useMemo(() => mine.filter((o) => o.status === 'Confirmed' && units(o) > 0), [mine]);
  const ships = allShipments().filter((x) => x.order.principalId === activePrincipal.id);
  const transit = ships.filter((x) => !x.shipment.deliveredAt);
  const delivered = ships.filter((x) => x.shipment.deliveredAt).sort((a, b) => b.shipment.deliveredAt!.localeCompare(a.shipment.deliveredAt!));
  const open = claims().filter((c) => c.status === 'Open');
  if (!ctx) return <div className="g2 g2-embed" style={{ padding: 24 }}>Loading logistics…</div>;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  const late = transit.filter((x) => x.shipment.eta < today());
  const onTime = delivered.filter((x) => x.shipment.deliveredAt!.slice(0, 10) <= x.shipment.eta).length;
  const partnerOf = (o: Order) => ctx.partners.find((p) => p.id === o.partnerId);
  const match = (o: Order) => [o.code, o.partnerName, o.poNumber].some((x) => x.toLowerCase().includes(q.toLowerCase()));
  const qRows = queue.filter((o) => match(o) && (!from || o.shipFrom.id === from));
  const fromOpts = [...new Map(queue.map((o) => [o.shipFrom.id, o.shipFrom.name])).entries()];
  const selOrders = sel.map(getOrder).filter((o): o is Order => !!o);
  const tripBlock = selOrders.length > 1 && (new Set(selOrders.map((o) => o.shipFrom.id)).size > 1 ? 'Orders in one trip must ship from the same location.' : selOrders.some((o) => shipFromSource(o, ctx) === 'NONE') ? 'Orders from a warehouse without stock tracking need batch / serial entry — ship them one by one.' : null);
  const shipRow = (x: (typeof ships)[number]) => {
    const p = partnerOf(x.order);
    const isLate = !x.shipment.deliveredAt && x.shipment.eta < today();
    return (
      <tr key={x.shipment.id} onClick={() => setView({ orderId: x.order.id, shipmentId: x.shipment.id })} style={{ cursor: 'pointer' }}>
        <td><div className="g2-strong">{x.shipment.no}</div><div className="g2-cell-sub">{x.order.code} · {x.shipment.invoiceNo}{x.shipment.tripNo ? ` · ${x.shipment.tripNo}` : ''}</div></td>
        <td>{x.order.partnerName}<div className="g2-cell-sub">{p?.address?.city ?? ''}{p?.address?.state ? `, ${p.address.state}` : ''}</div></td>
        <td className="g2-small">{x.shipment.carrier}<div className="g2-cell-sub g2-mono">{x.shipment.awb}{x.shipment.vehicleNo ? ` · ${x.shipment.vehicleNo}` : ''}</div></td>
        <td style={{ textAlign: 'right' }}>{x.shipment.allocations.reduce((a, b) => a + b.qty, 0)}</td>
        <td>{x.shipment.deliveredAt ? x.shipment.deliveredAt.slice(0, 10) : x.shipment.eta}</td>
        <td>{x.shipment.deliveredAt ? <Badge tone={x.shipment.deliveredAt.slice(0, 10) <= x.shipment.eta ? 'green' : 'amber'} dot>{x.shipment.deliveredAt.slice(0, 10) <= x.shipment.eta ? 'On time' : 'Delivered late'}</Badge> : <Badge tone={isLate ? 'red' : 'amber'} dot>{isLate ? 'Late' : 'In transit'}</Badge>}
          {x.shipment.problem && <div className="g2-cell-sub">Claim {x.shipment.problem.claimNos.join(', ')}</div>}</td>
      </tr>
    );
  };
  const viewing = view ? getOrder(view.orderId) : null;
  const viewSh = viewing?.shipments.find((s) => s.id === view?.shipmentId);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Logistics" description="Confirmed orders come here to be dispatched: one shipment per order, or one trip for several orders on the same vehicle. Track in transit, record proof of delivery and handle shortage / damage claims." />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Ready to dispatch" value={queue.length} icon={<ClipboardList size={22} />} color="#2563eb" bg="#eff6ff" foot={`${queue.reduce((a, o) => a + units(o), 0)} units · ${queue.filter((o) => o.requiredBy <= today()).length} due today or overdue`} />
        <KpiCard label="In transit" value={transit.length} icon={<Truck size={22} />} color="#d97706" bg="#fffbeb" foot={`${late.length} late`} />
        <KpiCard label="Delivered on time" value={delivered.length ? `${Math.round((onTime / delivered.length) * 100)}%` : '—'} icon={<Timer size={22} />} color="#059669" bg="#ecfdf5" foot={`${delivered.length} delivered`} />
        <KpiCard label="Open claims" value={open.length} icon={<AlertTriangle size={22} />} color="#dc2626" bg="#fef2f2" foot={inr(open.reduce((a, c) => a + c.value, 0))} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'queue', label: 'Dispatch queue', count: queue.length || undefined },
            { id: 'transit', label: 'In transit', count: transit.length || undefined },
            { id: 'delivered', label: 'Delivered', count: delivered.length || undefined },
            { id: 'claims', label: 'Claims', count: open.length || undefined },
            { id: 'carriers', label: 'Carriers' },
          ]} />
          <span className="g2-spacer" />
          {tab !== 'carriers' && <SearchInput value={q} onChange={setQ} placeholder="Order, partner, PO…" />}
        </div>

        {tab === 'queue' && (<>
          <div className="g2-row" style={{ padding: '10px 16px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ width: 260 }}><Select value={from} placeholder="All ship-from locations" options={[{ value: '', label: 'All ship-from locations' }, ...fromOpts.map(([id, name]) => ({ value: id, label: name }))]} onChange={setFrom} /></div>
            <span className="g2-spacer" />
            {tripBlock && <span className="g2-small" style={{ color: '#b45309' }}>{tripBlock}</span>}
            {canEdit && sel.length === 1 && <Button variant="primary" icon={<Truck size={14} />} onClick={() => setShipId(sel[0])}>Create shipment</Button>}
            {canEdit && sel.length > 1 && <Button variant="primary" icon={<Truck size={14} />} disabled={!!tripBlock} onClick={() => setTrip(sel)}>One trip for {sel.length} orders</Button>}
          </div>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th style={{ width: 36 }} /><th>Order</th><th>Deliver to</th><th>Ships from</th><th style={{ textAlign: 'right' }}>Units to ship</th><th style={{ textAlign: 'right' }}>Value</th><th>Required by</th></tr></thead>
            <tbody>
              {qRows.length === 0 && <tr><td colSpan={7} className="g2-muted">Nothing waiting — confirmed orders appear here.</td></tr>}
              {qRows.map((o) => {
                const p = partnerOf(o);
                return (
                  <tr key={o.id}>
                    <td onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.includes(o.id)} onChange={(v) => setSel(v ? [...sel, o.id] : sel.filter((x) => x !== o.id))} /></td>
                    <td onClick={() => setShipId(o.id)} style={{ cursor: 'pointer' }}><div className="g2-strong">{o.code}</div><div className="g2-cell-sub">PO {o.poNumber}{o.orderType !== 'Sale' ? ` · ${o.orderType}` : ''}{o.shipments.length ? ` · ${o.shipments.length} shipped already` : ''}</div></td>
                    <td>{o.partnerName}<div className="g2-cell-sub">{p?.address?.city ?? ''}{p?.address?.state ? `, ${p.address.state}` : ''}</div></td>
                    <td className="g2-small">{o.shipFrom.name}<div className="g2-cell-sub">{shipFromSource(o, ctx) === 'NONE' ? 'No stock tracking' : o.shipFrom.locType === 'CNF' ? 'C&F' : shipFromSource(o, ctx) === 'ERP' ? 'ERP stock' : 'VinFlux stock'}</div></td>
                    <td style={{ textAlign: 'right' }}>{units(o)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(orderValue(o, true))}</td>
                    <td>{o.requiredBy}{o.requiredBy < today() && <> <Badge tone="red">Overdue</Badge></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </>)}

        {(tab === 'transit' || tab === 'delivered') && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Shipment</th><th>To</th><th>Carrier · AWB / LR</th><th style={{ textAlign: 'right' }}>Units</th><th>{tab === 'transit' ? 'ETA' : 'Delivered'}</th><th>Status</th></tr></thead>
            <tbody>
              {(tab === 'transit' ? transit : delivered).filter((x) => match(x.order)).length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing here.</td></tr>}
              {(tab === 'transit' ? [...late, ...transit.filter((x) => !late.includes(x))] : delivered).filter((x) => match(x.order)).map(shipRow)}
            </tbody>
          </table></div>
        )}

        {tab === 'claims' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Claim</th><th>Shipment</th><th>Partner</th><th>Type</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th><th /></tr></thead>
            <tbody>
              {claims().length === 0 && <tr><td colSpan={8} className="g2-muted">No claims — raised from a delivered shipment when goods arrive short or damaged.</td></tr>}
              {claims().map((c) => (
                <tr key={c.id}>
                  <td className="g2-strong">{c.no}<div className="g2-cell-sub">{c.raisedAt}</div></td><td className="g2-small">{c.shipmentNo}<div className="g2-cell-sub">{c.orderCode} · {ships.find((x) => x.shipment.no === c.shipmentNo)?.shipment.carrier}</div></td><td>{c.partnerName}</td>
                  <td>{c.kind}</td><td style={{ textAlign: 'right' }}>{c.qty}</td><td style={{ textAlign: 'right' }}>{inr(c.value)}</td>
                  <td><Badge tone={c.status === 'Open' ? 'amber' : 'green'} dot>{c.status}</Badge></td>
                  <td>{canEdit && c.status === 'Open' && <Button size="sm" onClick={() => { settleClaim(c.id); showToast(`${c.no} settled.`, 'success'); }}>Settle</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {tab === 'carriers' && (<>
          <div className="g2-row" style={{ padding: '10px 16px' }}>
            <span className="g2-small g2-muted">Rate cards give the freight estimate; the scorecard comes from real shipments.</span>
            <span className="g2-spacer" />
            {canEdit && <Button size="sm" icon={<Plus size={13} />} onClick={() => setCarrier(blankCarrier())}>Add carrier</Button>}
          </div>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Carrier</th><th>Rate</th><th>Serves</th><th style={{ textAlign: 'right' }}>Shipments</th><th style={{ textAlign: 'right' }}>On time</th><th style={{ textAlign: 'right' }}>Late now</th><th style={{ textAlign: 'right' }}>Claims</th><th style={{ textAlign: 'right' }}>Freight</th><th /></tr></thead>
            <tbody>{carriers().map((c) => {
              const sc = scorecard(c.name);
              return (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                  <td><div className="g2-strong">{c.name}</div><div className="g2-cell-sub">{c.mode}{c.coldChain ? ' · cold chain' : ''} · {c.booking}</div></td>
                  <td className="g2-small">{c.ratePerKg ? `₹${c.ratePerKg}/kg` : '—'} · min {inr(c.minCharge)}<div className="g2-cell-sub">{c.tatDays} day(s)</div></td>
                  <td className="g2-small">{c.states.length ? c.states.join(', ') : 'All India'}</td>
                  <td style={{ textAlign: 'right' }}>{sc.shipments}</td>
                  <td style={{ textAlign: 'right' }}>{sc.onTimePct === null ? '—' : <Badge tone={sc.onTimePct >= 90 ? 'green' : sc.onTimePct >= 75 ? 'amber' : 'red'}>{sc.onTimePct}%</Badge>}</td>
                  <td style={{ textAlign: 'right' }}>{sc.lateOpen || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{sc.claims ? `${sc.claims} · ${inr(sc.claimValue)}` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{sc.freight ? inr(sc.freight) : '—'}</td>
                  <td>{canEdit && <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => setCarrier(c)}>Edit</Button>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </>)}
      </Card>

      {shipId && <OrderShipDrawer key={shipId} id={shipId} ctx={ctx} onClose={() => { setShipId(null); setSel([]); }} />}
      {trip && <TripDrawer ids={trip} ctx={ctx} onClose={() => { setTrip(null); setSel([]); }} />}
      {carrier && <CarrierDrawer value={carrier} onClose={() => setCarrier(null)} />}
      {viewing && viewSh && (
        <Modal open size="xl" title={`${viewSh.no} · ${viewing.partnerName}`} subtitle={`${viewing.code} · PO ${viewing.poNumber} · from ${viewing.shipFrom.name}`} onClose={() => setView(null)} footer={<Button onClick={() => setView(null)}>Close</Button>}>
          <ShipmentCard o={viewing} sh={viewSh} ctx={ctx} canEdit={canEdit} run={(r) => { if (!r.ok) { showToast([r.message, ...(r.errors ?? [])].join(' '), 'danger'); return false; } showToast(r.message, 'success'); return true; }} />
        </Modal>
      )}
    </div>
  );
};
export default LogisticsPage;
