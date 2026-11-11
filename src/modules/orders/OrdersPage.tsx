import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, CirclePause, CircleX, Inbox, Mail, MailPlus, Plus, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import {
  Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, SearchInput, Select, Stepper, Tabs, Textarea,
} from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { CONNECTORS } from '../../platform/integrations/connectors';
import { masterOf } from '../../platform/integrations/stockSync';
import { subscribeStock } from '../inventory/stockStore';
import { subscribePricing } from '../pricing/pricingStore';
import {
  FLOW, atp, cancelOrder, confirmOrder, createOrder, evaluate, getOrder, minShelfDays, orderValue, orders as listOrders,
  pushSalesOrder, rejectOrder, releaseBackorder, releaseCredit, routeOf, subscribeOrders, validate,
} from './orderStore';
import type { Check, LineDecision, Order, OrderCtx, OrderSource, OrderStatus } from './orderStore';
import { useOrderCtx } from './useOrderCtx';
import { usePlatform } from '../../platform/PlatformContext';
import { ShipForm, ShipmentCard } from '../logistics/ShipmentPanel';
import { useNavigate } from 'react-router-dom';
import { ensureDemo } from './seedDemo';
import { MAILBOX, discardEmail, emails as listEmails, fixEmail, getEmail, parseEmail, partnerForSender, priceLine, processEmail, processInbox, shipFromFor, simulateEmail, subscribeMailbox } from './intake';
import type { EmailStatus } from './intake';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
type Tone = 'blue' | 'amber' | 'purple' | 'green' | 'slate' | 'red';
const STATUS_TONE: Record<OrderStatus, Tone> = {
  Received: 'red', Validated: 'blue', 'On hold': 'amber', Confirmed: 'purple', Shipped: 'amber', Completed: 'green', Rejected: 'red', Cancelled: 'slate',
};
const EMAIL_TONE: Record<EmailStatus, Tone> = { New: 'blue', 'Order created': 'green', Refused: 'slate', Unmatched: 'amber' };
const CHECK_ICON: Record<Check['state'], React.ReactNode> = {
  pass: <CheckCircle2 size={16} color="#059669" />, warn: <CircleAlert size={16} color="#d97706" />, hold: <CirclePause size={16} color="#d97706" />, fail: <CircleX size={16} color="#dc2626" />,
};
const erpName = (warehouseId: string, imp: ReturnType<typeof useImportContext>) => CONNECTORS.find((c) => c.id === masterOf(warehouseId, imp))?.name ?? 'ERP';
type Run = (r: { ok: boolean; message: string; errors?: string[]; id?: string }) => boolean;

/* --------------------------------- New order --------------------------------- */

const NewOrderDrawer: React.FC<{ ctx: OrderCtx; onClose: () => void; onOpen: (id: string) => void }> = ({ ctx, onClose, onOpen }) => {
  const { activePrincipal, currentUser, warehouses, showToast } = useApp();
  const [partnerId, setPartnerId] = useState('');
  const [f, setF] = useState({ poNumber: '', poDate: inDays(0), requiredBy: inDays(3), source: 'Phone' as OrderSource, orderType: 'Sale' as Order['orderType'], notes: '', warehouseId: '' });
  const [lines, setLines] = useState<{ productId: string; variantSku: string; qty: number }[]>([{ productId: '', variantSku: '', qty: 1 }]);
  const [errs, setErrs] = useState<string[]>([]);
  const p = ctx.partners.find((x) => x.id === partnerId);
  const route = p ? routeOf(p.id, ctx) : null;
  const transfer = p?.partnerTypeId === 'pt-cnf';
  const products = ctx.products.filter((x) => x.principalId === activePrincipal.id && x.lifecycleStatus === 'Active');
  const save = () => {
    if (!p) { setErrs(['Choose the partner or hospital.']); return; }
    const shipFrom = shipFromFor(p.id, ctx, warehouses, lines.map((l) => l.productId), f.warehouseId);
    if (!shipFrom) { setErrs([route?.text ?? 'No direct supply link.']); return; }
    const r = createOrder({ principalId: activePrincipal.id, partner: p, channelId: null, orderType: transfer ? 'Stock transfer' : f.orderType, shipFrom, poNumber: f.poNumber, poDate: f.poDate, requiredBy: f.requiredBy, source: f.source, notes: f.notes,
      lines: lines.filter((l) => l.productId).map((l) => priceLine(ctx, p.id, activePrincipal.id, l.productId, l.variantSku || null, l.qty, transfer)) }, currentUser.name, ctx);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="lg" title="Enter an order" subtitle="For orders taken by phone or on a field visit. Emails arrive in the Orders mailbox; portal and EDI orders arrive on their own." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!!route && !route.ok}>Create order</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <FormGrid>
          <Field label="Partner / hospital" required><SearchableSelect value={partnerId} options={ctx.partners.filter((x) => x.status !== 'Draft').map((x) => ({ value: x.id, label: x.name, description: `${ctx.config.partnerTypes.find((t) => t.id === x.partnerTypeId)?.name} · ${routeOf(x.id, ctx).ok ? 'direct' : 'not direct'}` }))} onChange={(v) => setPartnerId(v ?? '')} /></Field>
          <Field label="Received by"><Select value={f.source} options={['Phone', 'Field app', 'Email', 'Portal', 'EDI'].map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, source: v as OrderSource })} /></Field>
          <Field label="Partner PO number" required><Input value={f.poNumber} onChange={(e) => setF({ ...f, poNumber: e.target.value })} /></Field>
          <Field label="Required by"><Input type="date" value={f.requiredBy} onChange={(e) => setF({ ...f, requiredBy: e.target.value })} /></Field>
          {p?.institution && <Field label="Order type"><Select value={f.orderType} options={[{ value: 'Sale', label: 'Sale (billed on delivery)' }, { value: 'Consignment', label: 'Consignment (stays our stock at the hospital)' }]} onChange={(v) => setF({ ...f, orderType: v as Order['orderType'] })} /></Field>}
          {route?.ok && route.shipFrom?.locType === 'COMPANY' && !route.shipFrom.id && <Field label="Ship from" hint="This partner can be served from any company warehouse."><Select value={f.warehouseId} placeholder="Warehouse holding the stock" options={warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} onChange={(v) => setF({ ...f, warehouseId: v })} /></Field>}
        </FormGrid>
        {route && <Alert tone={route.ok ? 'info' : 'error'}>{route.ok ? route.text : `${route.text}. Only partners with a direct link to the company (company warehouse or C&F depot) can order from the company.`}{transfer ? ' — this is a stock transfer to the company’s own C&F agent.' : ''}</Alert>}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>Products</div>
          {lines.map((l, i) => {
            const prod = products.find((x) => x.id === l.productId);
            return (
              <div key={i} className="g2-row" style={{ gap: 6, marginBottom: 6 }}>
                <div style={{ flex: 2 }}><SearchableSelect value={l.productId} options={products.map((x) => ({ value: x.id, label: x.name, description: x.code }))} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: v ?? '', variantSku: '' } : x)))} /></div>
                {prod?.variants.length ? <div style={{ flex: 1 }}><Select value={l.variantSku} placeholder="Variant…" options={prod.variants.map((v) => ({ value: v.sku, label: v.name }))} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, variantSku: v } : x)))} /></div> : <div style={{ flex: 1 }} />}
                <div style={{ width: 90 }}><NumberInput value={l.qty} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))} /></div>
              </div>
            );
          })}
          <Button size="sm" variant="ghost" onClick={() => setLines([...lines, { productId: '', variantSku: '', qty: 1 }])}>+ Add product</Button>
        </div>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
};

/* --------------------------------- Email drawer --------------------------------- */

const EmailDrawer: React.FC<{ id: string; ctx: OrderCtx; onClose: () => void; onOpenOrder: (id: string) => void }> = ({ id, ctx, onClose, onOpenOrder }) => {
  useSubscribe(subscribeMailbox);
  const { activePrincipal, currentUser, warehouses, showToast } = useApp();
  const e = getEmail(id);
  const [link, setLink] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<string[]>([]);
  if (!e) return null;
  const parsed = parseEmail(e);
  const sender = e.linkPartnerId ? ctx.partners.find((p) => p.id === e.linkPartnerId) : partnerForSender(e.from, ctx.partners);
  const unknown = e.issues.map((x) => x.match(/code “(.+?)” not recognised/)?.[1]).filter((x): x is string => !!x);
  const products = ctx.products.filter((x) => x.principalId === activePrincipal.id);
  const productOpts = products.flatMap((p) => (p.variants.length ? p.variants.map((v) => ({ value: `${p.id}|${v.sku}`, label: v.name, description: v.sku })) : [{ value: `${p.id}|`, label: p.name, description: p.code }]));
  const process = () => {
    if (link !== null || Object.keys(codes).length) fixEmail(id, { partnerId: link ?? undefined, codeMap: Object.fromEntries(Object.entries(codes).map(([k, v]) => { const [productId, sku] = v.split('|'); return [k, { productId, variantSku: sku || null }]; })) });
    const r = processEmail(id, ctx, activePrincipal.id, warehouses, currentUser.name);
    if (r.orderId) { showToast(r.message, 'success'); onClose(); onOpenOrder(r.orderId); return; }
    if (r.ok) { showToast(r.message, 'success'); setErrs([]); return; }
    setErrs([r.message]);
  };
  const open = e.status === 'New' || e.status === 'Unmatched';
  return (
    <Modal open size="lg" title={e.subject} onClose={onClose}
      subtitle={<span className="g2-row">{e.fromName} &lt;{e.from}&gt; · {when(e.receivedAt)} <Badge tone={EMAIL_TONE[e.status]} dot>{e.status}</Badge></span>}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {open && <Button variant="ghost" onClick={() => { discardEmail(id, 'Not an order — discarded by ' + currentUser.name); showToast('Email discarded.', 'success'); }}>Not an order</Button>}
        {open && <Button variant="primary" icon={<RefreshCw size={14} />} onClick={process}>{e.status === 'New' ? 'Process' : 'Process again'}</Button>}
        {e.orderId && <Button variant="primary" onClick={() => { onClose(); onOpenOrder(e.orderId!); }}>Open order</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        {e.issues.length > 0 && <Alert tone={e.status === 'Refused' ? 'info' : 'warn'}>{e.issues.join(' ')}</Alert>}
        <Card title="Email" subtitle={e.attachment ? `Attachment: ${e.attachment}` : undefined}>
          <pre className="g2-small" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{e.body}</pre>
        </Card>
        <Card title="What VinFlux read">
          <dl className="g2-dl">
            <dt>Partner</dt><dd>{sender ? sender.name : <Badge tone="amber">Sender not recognised</Badge>}{sender && <span className="g2-muted"> — {routeOf(sender.id, ctx).text}</span>}</dd>
            <dt>PO number</dt><dd className="g2-mono">{parsed.po ?? '—'}</dd>
            <dt>Lines</dt><dd>{parsed.lines.length ? parsed.lines.map((l) => `${l.code} × ${l.qty}`).join(' · ') : 'None found'}</dd>
          </dl>
        </Card>
        {open && !sender && (
          <Field label="Link this sender to a partner" hint="Once processed, add the address to the partner's contacts so future emails match on their own.">
            <SearchableSelect value={link ?? ''} options={ctx.partners.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => setLink(v)} />
          </Field>
        )}
        {open && unknown.map((c) => (
          <Field key={c} label={`Map product code “${c}”`} hint="Remembered for every future email.">
            <SearchableSelect value={codes[c] ?? ''} options={productOpts} onChange={(v) => setCodes({ ...codes, [c]: v ?? '' })} />
          </Field>
        ))}
        {e.reply && <Card title="Auto-reply sent"><pre className="g2-small" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{e.reply}</pre></Card>}
      </div>
    </Modal>
  );
};

/* -------------------------------- Order drawer -------------------------------- */

const OrderDrawer: React.FC<{ id: string; ctx: OrderCtx; onClose: () => void; onOpen: (id: string) => void; onOpenEmail: (id: string) => void }> = ({ id, ctx, onClose, onOpen, onOpenEmail }) => {
  useSubscribe(subscribeOrders, subscribeStock);
  const imp = useImportContext();
  const { currentUser, showToast } = useApp();
  const o = getOrder(id);
  const [errs, setErrs] = useState<string[]>([]);
  const [dec, setDec] = useState<Record<string, LineDecision>>({});
  const [reason, setReason] = useState('');
  const { enabled } = usePlatform();
  const navigate = useNavigate();
  const logistics = enabled('logistics');
  if (!o) return null;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.gtm?.includes('edit') || !!m.inventory?.includes('edit');
  const canApprove = !m || !!m.pricing?.includes('approve') || !!m.gtm?.includes('approve');
  const checks = evaluate(o, ctx);
  const inst = !!ctx.partners.find((p) => p.id === o.partnerId)?.institution;
  const run: Run = (r) => { if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return false; } setErrs([]); showToast(r.message, 'success'); return true; };
  const erp = erpName(o.shipFrom.id, imp);
  const cnf = o.shipFrom.locType === 'CNF';
  const open = ['Received', 'On hold', 'Validated'].includes(o.status);
  const avail = (l: Order['lines'][number], sku = l.variantSku) => atp(o.shipFrom.id, l.productId, sku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst), o.id);
  const decision = (l: Order['lines'][number]): LineDecision => dec[l.id] ?? { confirm: Math.min(l.qty, avail(l)), backorderDate: inDays(7), substituteSku: null };
  const stepIdx = o.status === 'On hold' ? 1 : Math.max(0, FLOW.indexOf(o.status));
  const steps = FLOW.map((s, i) => (i === 1 && o.status === 'On hold' ? 'On hold (credit)' : s));
  const backorders = o.lines.some((l) => l.backorderQty > 0) && ['Confirmed', 'Shipped', 'Completed'].includes(o.status);

  const footer = (
    <>
      <Button onClick={onClose}>Close</Button>
      {canEdit && open && <Button variant="danger" onClick={() => run(rejectOrder(o.id, reason, currentUser.name))}>Reject</Button>}
      {canEdit && o.status === 'Confirmed' && !o.shipments.length && <Button variant="ghost" onClick={() => run(cancelOrder(o.id, reason, currentUser.name))}>Cancel order</Button>}
      {canEdit && o.status === 'Received' && <Button icon={<RefreshCw size={14} />} onClick={() => run(validate(o.id, ctx, currentUser.name))}>Check again</Button>}
      {canApprove && o.status === 'On hold' && <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={() => run(releaseCredit(o.id, reason, ctx, currentUser.name))}>Release credit for this order</Button>}
      {canEdit && o.status === 'Validated' && <Button variant="primary" icon={<CheckCircle2 size={14} />} onClick={() => run(confirmOrder(o.id, Object.fromEntries(o.lines.map((l) => [l.id, decision(l)])), ctx, currentUser.name, erp))}>Confirm — reserve & notify</Button>}
      {o.status === 'Confirmed' && logistics && <Button variant="primary" icon={<Truck size={14} />} onClick={() => navigate(`/logistics?tab=queue&o=${o.id}`)}>Open in Logistics</Button>}
      {canEdit && backorders && <Button onClick={() => { const r = releaseBackorder(o.id, ctx, currentUser.name); if (run(r) && r.id) onOpen(r.id); }}>Release backorder</Button>}
    </>
  );

  return (
    <Modal open size="xl" title={`${o.code} · ${o.partnerName}`} onClose={onClose} footer={footer}
      subtitle={<span className="g2-row">{o.orderType} · PO {o.poNumber} · via {o.source} · ships from {o.shipFrom.name} {cnf ? '(C&F, invoiced in VinFlux)' : `(${erp})`} <Badge tone={STATUS_TONE[o.status]} dot>{o.status}</Badge></span>}>
      <div className="g2-stack">
        {!['Rejected', 'Cancelled'].includes(o.status) && <Stepper steps={steps} current={o.status === 'Completed' ? FLOW.length : stepIdx} maxReached={stepIdx} onSelect={() => undefined} />}
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t continue" />}
        {o.status === 'Rejected' && <Alert tone="error">Rejected: {o.rejectReason}</Alert>}
        {o.status === 'Received' && o.blockers.length > 0 && <Alert tone="error">Can’t be validated yet — fix the item(s) below in Go-to-Market / Product Master / Pricing, then “Check again”, or reject the order.</Alert>}
        {o.status === 'On hold' && <Alert tone="warn">On credit hold. Finance can release this one order (not the person who entered it) — write why in the note below.</Alert>}
        {o.status === 'Validated' && <Alert tone="info">Partner and credit checks passed. Confirming reserves the quantities, notifies {o.partnerName}{cnf ? '' : ` and creates the sales order in ${erp}`}.</Alert>}
        {o.creditRelease && <Alert tone="success">Credit released by {o.creditRelease.by} — “{o.creditRelease.note}”</Alert>}
        {o.emailId && <div className="g2-small"><Mail size={13} style={{ verticalAlign: -2 }} /> From the orders mailbox — <a href="#" onClick={(e) => { e.preventDefault(); onOpenEmail(o.emailId!); }}>view email</a></div>}

        {open && (
          <Card title="Partner validation & credit" subtitle="Run when the order arrives and again on “Check again”.">
            <div className="g2-grid g2-grid-2" style={{ gap: 6 }}>
              {checks.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 8, background: c.state === 'fail' ? '#fef2f2' : c.state === 'pass' ? undefined : '#fffbeb' }}>
                  <span style={{ flex: 'none', marginTop: 1 }}>{CHECK_ICON[c.state]}</span>
                  <div style={{ minWidth: 0 }}><div className="g2-strong" style={{ fontSize: 13 }}>{c.label}</div><div className="g2-small g2-muted">{c.detail}</div></div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="Lines" subtitle={o.status === 'Validated' ? 'Available to promise = sellable stock at the ship-from location with enough shelf life, minus other orders’ reservations.' : undefined}>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Ordered</th>
              {o.status === 'Validated' && <><th style={{ textAlign: 'right' }}>Available</th><th>Confirm</th><th>Backorder</th></>}
              {!open && <><th style={{ textAlign: 'right' }}>Confirmed</th><th style={{ textAlign: 'right' }}>Shipped</th></>}
              {!open && <th>Backorder</th>}
              <th style={{ textAlign: 'right' }}>Net price</th></tr></thead>
            <tbody>{o.lines.map((l) => {
              const prod = ctx.products.find((x) => x.id === l.productId);
              const d = decision(l);
              const a = avail(l, d.substituteSku ?? l.variantSku);
              const alts = (prod?.variants ?? []).filter((x) => x.sku !== l.variantSku && avail(l, x.sku) > 0);
              const conf = Math.min(d.confirm, l.qty);
              return (
                <tr key={l.id}>
                  <td style={{ maxWidth: 280 }}><div className="g2-strong">{l.name}</div><div className="g2-cell-sub">{l.priceSource}{l.freeQty ? ` · +${l.freeQty} free (scheme)` : ''}</div></td>
                  <td style={{ textAlign: 'right' }}>{l.qty}</td>
                  {o.status === 'Validated' && <>
                    <td style={{ textAlign: 'right', color: a < l.qty ? '#b45309' : undefined }}>{a}</td>
                    <td style={{ minWidth: 220 }}><div className="g2-row" style={{ gap: 6 }}>
                      <div style={{ width: 80 }}><NumberInput value={conf} aria-label={`Confirm ${l.name}`} onChange={(x) => setDec({ ...dec, [l.id]: { ...d, confirm: Math.max(0, Math.min(l.qty, x ?? 0)) } })} /></div>
                      {alts.length > 0 && a < l.qty && <Select value={d.substituteSku ?? ''} placeholder="Substitute…" options={alts.map((x) => ({ value: x.sku, label: `${x.name} (${avail(l, x.sku)})` }))} onChange={(x) => setDec({ ...dec, [l.id]: { ...d, substituteSku: x || null } })} />}
                    </div></td>
                    <td>{l.qty - conf > 0 ? <div className="g2-row" style={{ gap: 4 }}><span className="g2-small">{l.qty - conf} by</span><Input type="date" style={{ width: 150 }} value={d.backorderDate ?? ''} onChange={(e) => setDec({ ...dec, [l.id]: { ...d, confirm: conf, backorderDate: e.target.value } })} /></div> : <span className="g2-muted">—</span>}</td>
                  </>}
                  {!open && <><td style={{ textAlign: 'right' }}>{l.confirmedQty}{l.freeQty ? ` + ${l.freeQty} free` : ''}</td><td style={{ textAlign: 'right' }}>{l.shippedQty}</td></>}
                  {!open && <td>{l.backorderQty > 0 ? <Badge tone="amber">{l.backorderQty} by {l.backorderDate}</Badge> : <span className="g2-muted">—</span>}</td>}
                  <td style={{ textAlign: 'right' }}>{l.netUnit !== null ? inr(l.netUnit) : <Badge tone="red">No price</Badge>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <div className="g2-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><span className="g2-small g2-muted">Value incl. GST</span><strong style={{ marginLeft: 8 }}>{inr(orderValue(o, !open))}</strong></div>
        </Card>

        {o.erpSalesOrder && <div className="g2-small">ERP sales order <span className="g2-mono g2-strong">{o.erpSalesOrder}</span> in {erp}{o.erpRef?.status === 'Sent' && <Badge tone="green">live</Badge>}</div>}
        {o.erpRef?.status === 'Sending' && <Alert tone="info">Sending the sales order to {erp}…</Alert>}
        {o.erpRef?.status === 'Failed' && <Alert tone="error"><div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}><span>{erp} refused the sales order: {o.erpRef.error}</span>{canEdit && <Button size="sm" onClick={() => { void pushSalesOrder(o.id, ctx).then((r) => showToast(r.message, r.ok ? 'success' : 'danger')); }}>Retry</Button>}</div></Alert>}

        {o.status === 'Confirmed' && logistics && <Alert tone="info">Waiting for dispatch — the Logistics team creates the shipment (carrier, vehicle, invoice, e-way bill) from its dispatch queue.</Alert>}
        {canEdit && o.status === 'Confirmed' && !logistics && <ShipForm o={o} ctx={ctx} destState={ctx.partners.find((p) => p.id === o.partnerId)?.address?.state} />}

        {o.shipments.map((sh) => <ShipmentCard key={sh.id} o={o} sh={sh} ctx={ctx} canEdit={canEdit && !logistics} run={run} />)}

        {((canEdit && (open || (o.status === 'Confirmed' && !o.shipments.length))) || (canApprove && o.status === 'On hold')) && (
          <Field label={o.status === 'On hold' ? 'Release note (e.g. payment received, cheque details) — or reason to reject' : 'Reason (needed to reject or cancel — the partner sees it)'}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        )}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>Timeline</div>
          {o.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {when(x.at)}{x.note ? ` — ${x.note}` : ''}</span></div>)}
        </div>
      </div>
    </Modal>
  );
};

/* ----------------------------------- Page ----------------------------------- */

const TABS: { id: string; label: string; match: (o: Order) => boolean }[] = [
  { id: 'received', label: 'Needs attention', match: (o) => o.status === 'Received' },
  { id: 'hold', label: 'Credit hold', match: (o) => o.status === 'On hold' },
  { id: 'validated', label: 'To confirm', match: (o) => o.status === 'Validated' },
  { id: 'confirmed', label: 'To ship', match: (o) => o.status === 'Confirmed' },
  { id: 'shipped', label: 'In transit', match: (o) => o.shipments.some((s) => !s.deliveredAt) },
  { id: 'completed', label: 'Completed', match: (o) => o.status === 'Completed' },
  { id: 'backorder', label: 'Backorders', match: (o) => o.lines.some((l) => l.backorderQty > 0) },
  { id: 'closed', label: 'Rejected / cancelled', match: (o) => ['Rejected', 'Cancelled'].includes(o.status) },
];

const OrdersPage: React.FC = () => {
  useSubscribe(subscribeOrders, subscribeStock, subscribePricing, subscribeMailbox);
  const ctx = useOrderCtx();
  const imp = useImportContext();
  const { activePrincipal, currentUser, warehouses, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'inbox';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(params.get('o'));
  const [emailId, setEmailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (ctx) ensureDemo(imp, ctx, activePrincipal.id); }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = listOrders().filter((o) => o.principalId === activePrincipal.id);
  const mail = listEmails();
  const fresh = mail.filter((e) => e.status === 'New' || e.status === 'Unmatched');
  const inFlight = useMemo(() => all.filter((o) => ['Confirmed', 'Shipped'].includes(o.status)), [all]);
  if (!ctx) return <div className="g2 g2-embed" style={{ padding: 24 }}>Loading orders…</div>;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.gtm?.includes('edit') || !!m.inventory?.includes('edit');
  const cur = TABS.find((t) => t.id === tab);
  const rows = cur ? all.filter((o) => cur.match(o) && [o.code, o.partnerName, o.poNumber].some((x) => x.toLowerCase().includes(q.toLowerCase()))) : [];
  const mailRows = mail.filter((e) => [e.subject, e.from, e.fromName].some((x) => x.toLowerCase().includes(q.toLowerCase())));
  const runInbox = () => {
    const r = processInbox(ctx, activePrincipal.id, warehouses, currentUser.name);
    showToast(r.processed ? `${r.processed} email(s): ${r.created} order(s) created, ${r.refused} refused (not direct), ${r.unmatched} need a look.` : 'No new emails.', 'success');
  };

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Orders" description={`Orders reach the company only from partners with a direct link (company warehouse or C&F depot). Received → Validated (partner & credit) → Confirmed (stock reserved, partner notified) → Shipped → Completed on proof of delivery.`}
        actions={canEdit && <><Button icon={<MailPlus size={15} />} onClick={() => { simulateEmail(ctx, activePrincipal.id); showToast('A new order email arrived (demo).', 'success'); setTab('inbox'); }}>Simulate email</Button><Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>Enter order</Button></>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Mailbox to process" value={fresh.length} icon={<Inbox size={22} />} color="#2563eb" bg="#eff6ff" foot={`${mail.filter((e) => e.status === 'Unmatched').length} need a look · ${MAILBOX}`} />
        <KpiCard label="To confirm" value={all.filter((o) => o.status === 'Validated').length} icon={<CheckCircle2 size={22} />} color="#059669" bg="#ecfdf5" foot={`${all.filter((o) => o.status === 'On hold').length} on credit hold · ${all.filter((o) => o.status === 'Received').length} blocked`} />
        <KpiCard label="Confirmed / in transit" value={inFlight.length} icon={<Truck size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${inr(inFlight.reduce((a, o) => a + orderValue(o, true), 0))} value`} />
        <KpiCard label="Units on backorder" value={all.reduce((a, o) => a + o.lines.reduce((b, l) => b + l.backorderQty, 0), 0)} icon={<CirclePause size={22} />} color="#dc2626" bg="#fef2f2" foot="release when stock arrives" />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'inbox', label: 'Mailbox', count: fresh.length || undefined }, ...TABS.map((t) => ({ id: t.id, label: t.label, count: all.filter(t.match).length || undefined }))]} />
          <span className="g2-spacer" />
          <SearchInput value={q} onChange={setQ} placeholder={tab === 'inbox' ? 'Sender, subject…' : 'Order, partner, PO…'} />
        </div>
        {tab === 'inbox' ? (
          <>
            <div className="g2-row" style={{ padding: '10px 16px', gap: 8, borderBottom: '1px solid var(--g2-border, #e5e7eb)' }}>
              <span className="g2-small g2-muted">Emails to <span className="g2-mono">{MAILBOX}</span> are read automatically: sender → partner, codes → products, then an order is created and validated.</span>
              <span className="g2-spacer" />
              {canEdit && <Button size="sm" icon={<RefreshCw size={13} />} onClick={runInbox} disabled={!mail.some((e) => e.status === 'New')}>Process new ({mail.filter((e) => e.status === 'New').length})</Button>}
            </div>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Result</th></tr></thead>
              <tbody>
                {mailRows.length === 0 && <tr><td colSpan={4} className="g2-muted">No emails.</td></tr>}
                {mailRows.map((e) => {
                  const o = e.orderId ? getOrder(e.orderId) : null;
                  return (
                    <tr key={e.id} onClick={() => setEmailId(e.id)} style={{ cursor: 'pointer', fontWeight: e.status === 'New' ? 600 : undefined }}>
                      <td>{e.fromName}<div className="g2-cell-sub">{e.from}</div></td>
                      <td>{e.subject}{e.attachment && <div className="g2-cell-sub">📎 {e.attachment}</div>}</td>
                      <td className="g2-small">{when(e.receivedAt)}</td>
                      <td><Badge tone={EMAIL_TONE[e.status]} dot>{e.status}</Badge>
                        <div className="g2-cell-sub">{o ? `${o.code} · ${o.status}` : e.issues[0]?.slice(0, 70) ?? ''}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </>
        ) : (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Order</th><th>Partner / hospital</th><th>Ships from</th><th style={{ textAlign: 'right' }}>Value</th><th>Required by</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing here.</td></tr>}
              {rows.map((o) => (
                <tr key={o.id} onClick={() => setOpenId(o.id)} style={{ cursor: 'pointer' }}>
                  <td><div className="g2-strong">{o.code}</div><div className="g2-cell-sub">PO {o.poNumber} · {o.source}{o.orderType !== 'Sale' ? ` · ${o.orderType}` : ''}</div></td>
                  <td>{o.partnerName}<div className="g2-cell-sub">{ctx.config.partnerTypes.find((t) => t.id === o.partnerTypeId)?.name}</div></td>
                  <td className="g2-small">{o.shipFrom.name}<div className="g2-cell-sub">{o.shipFrom.locType === 'CNF' ? 'C&F (VinFlux)' : erpName(o.shipFrom.id, imp)}</div></td>
                  <td style={{ textAlign: 'right' }}>{inr(orderValue(o, !['Received', 'On hold', 'Validated'].includes(o.status)))}</td>
                  <td>{o.requiredBy}</td>
                  <td><Badge tone={STATUS_TONE[o.status]} dot>{o.status}</Badge>
                    <div className="g2-cell-sub">{o.status === 'Received' || o.status === 'On hold' ? o.blockers[0]?.slice(0, 70) : o.shipments.length ? `${o.shipments.filter((s) => s.deliveredAt).length}/${o.shipments.length} shipment(s) delivered` : ''}</div>
                    {o.lines.some((l) => l.backorderQty > 0) && <div className="g2-cell-sub">{o.lines.reduce((a, l) => a + l.backorderQty, 0)} on backorder</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {creating && <NewOrderDrawer ctx={ctx} onClose={() => setCreating(false)} onOpen={setOpenId} />}
      {emailId && <EmailDrawer key={emailId} id={emailId} ctx={ctx} onClose={() => setEmailId(null)} onOpenOrder={setOpenId} />}
      {openId && <OrderDrawer key={openId} id={openId} ctx={ctx} onClose={() => setOpenId(null)} onOpen={setOpenId} onOpenEmail={(eid) => { setOpenId(null); setEmailId(eid); }} />}
    </div>
  );
};
export default OrdersPage;
