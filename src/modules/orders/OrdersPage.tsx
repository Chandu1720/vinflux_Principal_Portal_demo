import React, { useEffect, useMemo, useState } from 'react';
import { Linkify } from '../../platform/Linkify';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, CirclePause, CircleX, Clock, Inbox, Mail, MailPlus, Paperclip, Pencil, Plus, RefreshCw, Settings2, ShieldCheck, Truck, Upload, UserCheck } from 'lucide-react';
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
  FLOW, OPEN, answerPartFill, applyPartFillTimeouts, approvalOverdue, approveOrder, askPartFill, atp, canApproveLevel, cancelOrder, confirmOrder, createOrder, evaluate, getOrder, minShelfDays, orderValue, orders as listOrders,
  pushSalesOrder, rejectOrder, releaseBackorder, releaseCredit, routeOf, shipFromSource, shortfall, subscribeOrders, validate,
} from './orderStore';
import type { Notice } from './notify';
import { amendBlock, amendOrder } from './amend';
import type { LineChange } from './amend';
import { channelOpen, orderSettings, subscribeOrderSettings } from './orderSettings';
import { OrderSettingsPanel } from './OrderSettingsPanel';
import { UploadOrderModal } from './UploadOrderModal';
import { runLiveSync } from '../../platform/integrations/stockSync';
import { isLive } from '../../platform/integrations/liveClient';
import type { Check, LineDecision, Order, OrderCtx, OrderSource, OrderStatus } from './orderStore';
import { useOrderCtx } from './useOrderCtx';
import { usePlatform } from '../../platform/PlatformContext';
import { ShipForm, ShipmentCard } from '../logistics/ShipmentPanel';
import { useNavigate } from 'react-router-dom';
import { ensureDemo } from './seedDemo';
import { routeOrder, routedOrders, subscribeRouting, supplierOf } from './routing';
import { MAILBOX, discardEmail, emails as listEmails, fixEmail, getEmail, parseEmail, partnerForSender, priceLine, processEmail, processInbox, shipFromFor, simulateEmail, subscribeMailbox } from './intake';
import type { EmailStatus } from './intake';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
type Tone = 'blue' | 'amber' | 'purple' | 'green' | 'slate' | 'red';
const STATUS_TONE: Record<OrderStatus, Tone> = {
  Received: 'red', 'Awaiting approval': 'amber', Validated: 'blue', 'Awaiting partner': 'amber', 'On hold': 'amber', Confirmed: 'purple', Shipped: 'amber', Completed: 'green', Rejected: 'red', Cancelled: 'slate',
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
    const ch = ({ Phone: 'phone', 'Field app': 'field', Email: 'email', Portal: 'portal', Manual: 'manual' } as const)[f.source as 'Phone'];
    if (ch && !channelOpen(ch, p.id)) { setErrs([`${f.source} orders are switched off${channelOpen(ch) ? ` for ${p.name}` : ''} (Orders → Settings → Order intake).`]); return; }
    const shipFrom = shipFromFor(p.id, ctx, warehouses, lines.map((l) => l.productId), f.warehouseId);
    if (!shipFrom) { setErrs([route?.text ?? 'No direct supply link.']); return; }
    const r = createOrder({ principalId: activePrincipal.id, partner: p, channelId: null, orderType: transfer ? 'Stock transfer' : f.orderType, shipFrom, poNumber: f.poNumber, poDate: f.poDate, requiredBy: f.requiredBy, source: f.source, notes: f.notes,
      enteredFor: p.name, lines: lines.filter((l) => l.productId).map((l) => priceLine(ctx, p.id, activePrincipal.id, l.productId, l.variantSku || null, l.qty, transfer)) }, currentUser.name, ctx);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  // GTM-04: a partner that buys through another partner — route the order to its supplier instead of refusing it.
  const sup = p && route && !route.ok ? supplierOf(p.id, ctx) : null;
  const routeIt = () => {
    if (!p) return;
    const r = routeOrder({ principalId: activePrincipal.id, from: p, source: f.source, poNumber: f.poNumber, by: currentUser.name,
      lines: lines.filter((l) => l.productId).map((l) => { const pr = ctx.products.find((x) => x.id === l.productId); return { productId: l.productId, name: pr?.name ?? l.productId, qty: l.qty, unitValue: (pr?.pricingReference?.mrp ?? 0) * 0.7 }; }) }, ctx);
    if (!r.ok) { setErrs([r.message]); return; }
    showToast(r.message, 'success'); onClose();
  };
  return (
    <Modal open size="lg" title="Enter an order" subtitle="For orders taken by phone or on a field visit. Emails arrive in the Orders mailbox; portal and EDI orders arrive on their own." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button>{sup ? <Button variant="primary" onClick={routeIt}>Route to {sup.name}</Button> : <Button variant="primary" onClick={save} disabled={!!route && !route.ok}>Create order</Button>}</>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <FormGrid>
          <Field label="Partner / hospital" required><SearchableSelect value={partnerId} options={ctx.partners.filter((x) => x.status !== 'Draft').map((x) => ({ value: x.id, label: x.name, description: `${ctx.config.partnerTypes.find((t) => t.id === x.partnerTypeId)?.name} · ${routeOf(x.id, ctx).ok ? 'direct' : 'not direct'}` }))} onChange={(v) => setPartnerId(v ?? '')} /></Field>
          <Field label="Received by"><Select value={f.source} options={['Phone', 'Manual', 'Field app', 'Email', 'Portal', 'EDI'].map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, source: v as OrderSource })} /></Field>
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
          <pre className="g2-small" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}><Linkify text={e.body} /></pre>
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

/* ------------------------------ Notifications ------------------------------ */

const NoticeCard: React.FC<{ notices: Notice[] }> = ({ notices }) => {
  const [open, setOpen] = useState<Notice | null>(null);
  if (!notices.length) return null;
  return (
    <Card title={`Messages (${notices.length})`} subtitle="Every email / WhatsApp this order produced, with its exact text. Phase 1: logged, not sent.">
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
        <tbody>{notices.slice().reverse().map((n) => (
          <tr key={n.id} onClick={() => setOpen(n)} style={{ cursor: 'pointer' }}>
            <td className="g2-small">{when(n.at)}</td>
            <td><Badge tone={n.audience === 'Partner' ? 'blue' : 'purple'}>{n.audience}</Badge> <span className="g2-small">{n.channel} · {n.to}</span></td>
            <td className="g2-small">{n.subject}</td>
            <td className="g2-small g2-muted">{n.status}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {open && (
        <Modal open variant="modal" title={open.subject} subtitle={`${open.channel} · ${when(open.at)}`} onClose={() => setOpen(null)} footer={<Button onClick={() => setOpen(null)}>Close</Button>}>
          <dl className="g2-dl" style={{ marginBottom: 12 }}><dt>From</dt><dd>{open.from}</dd><dt>To</dt><dd>{open.to}</dd><dt>Status</dt><dd>{open.status}</dd></dl>
          <pre className="g2-small" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', background: 'var(--g2-surface-2, #f8fafc)', padding: 12, borderRadius: 8 }}><Linkify text={open.body} /></pre>
        </Modal>
      )}
    </Card>
  );
};

/* ------------------------------- Change order ------------------------------- */

const AmendModal: React.FC<{ o: Order; ctx: OrderCtx; onClose: () => void }> = ({ o, ctx, onClose }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(o.lines.map((l) => [l.id, l.qty])));
  const [adds, setAdds] = useState<{ key: string; productId: string; variantSku: string; qty: number }[]>([]);
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  const s = orderSettings().amend;
  const products = ctx.products.filter((x) => x.principalId === activePrincipal.id && x.lifecycleStatus === 'Active');
  const confirmed = o.status === 'Confirmed';
  const save = () => {
    const changes: LineChange[] = [
      ...o.lines.filter((l) => qty[l.id] !== l.qty).map((l) => ({ lineId: l.id, productId: l.productId, variantSku: l.variantSku, qty: qty[l.id] })),
      ...adds.filter((a) => a.productId && a.qty > 0).map((a) => ({ lineId: null, productId: a.productId, variantSku: a.variantSku || null, qty: a.qty })),
    ];
    const r = amendOrder(o.id, changes, reason, ctx, currentUser.name);
    if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return; }
    showToast(r.message, 'success'); onClose();
  };
  return (
    <Modal open size="lg" title={`Change ${o.code}`} subtitle={`Version ${o.version ?? 1} → ${(o.version ?? 1) + 1}. ${confirmed ? `Confirmed order: reductions are ${s.reduce === 'auto' ? 'applied at once' : 'sent for approval'}; increases ${s.increase === 'auto' ? 'need stock' : 'go back for approval'}.` : 'The checks and approval rules run again.'}`}
      onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save change</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Now</th><th style={{ textAlign: 'right' }}>Shipped</th><th>New quantity</th></tr></thead>
          <tbody>{o.lines.map((l) => (
            <tr key={l.id}><td>{l.name}</td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right' }}>{l.shippedQty}</td>
              <td style={{ width: 120 }}><NumberInput value={qty[l.id]} aria-label={`New quantity ${l.name}`} onChange={(v) => setQty({ ...qty, [l.id]: Math.max(0, v ?? 0) })} /></td></tr>
          ))}</tbody>
        </table></div>
        {adds.map((a, i) => (
          <div key={a.key} className="g2-row" style={{ gap: 6 }}>
            <div style={{ flex: 2 }}><SearchableSelect value={a.productId} options={products.map((x) => ({ value: x.id, label: x.name, description: x.code }))} onChange={(v) => setAdds(adds.map((x, j) => (j === i ? { ...x, productId: v ?? '', variantSku: '' } : x)))} /></div>
            {products.find((x) => x.id === a.productId)?.variants.length ? <div style={{ flex: 1 }}><Select value={a.variantSku} placeholder="Variant…" options={products.find((x) => x.id === a.productId)!.variants.map((v) => ({ value: v.sku, label: v.name }))} onChange={(v) => setAdds(adds.map((x, j) => (j === i ? { ...x, variantSku: v } : x)))} /></div> : <div style={{ flex: 1 }} />}
            <div style={{ width: 90 }}><NumberInput value={a.qty} onChange={(v) => setAdds(adds.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))} /></div>
          </div>
        ))}
        <div><Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setAdds([...adds, { key: String(Date.now()), productId: '', variantSku: '', qty: 1 }])}>Add a product</Button></div>
        <Field label="Reason" required hint="Goes in the order history and the change email."><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
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
  const [amending, setAmending] = useState(false);
  const [busy, setBusy] = useState(false);
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
  const open = OPEN.includes(o.status);
  const src = shipFromSource(o, ctx);
  const avail = (l: Order['lines'][number], sku = l.variantSku) => atp(o.shipFrom.id, l.productId, sku, minShelfDays(ctx.products.find((x) => x.id === l.productId), inst), o.id);
  const decision = (l: Order['lines'][number]): LineDecision => dec[l.id] ?? { confirm: src === 'NONE' ? l.qty : Math.min(l.qty, avail(l)), backorderDate: inDays(orderSettings().partFill.backorderDays), substituteSku: null };
  const stepIdx = ['On hold', 'Awaiting approval', 'Awaiting partner'].includes(o.status) ? 1 : Math.max(0, FLOW.indexOf(o.status));
  const steps = FLOW.map((s, i) => (i === 1 && o.status === 'On hold' ? 'On hold (credit)' : i === 1 && o.status === 'Awaiting approval' ? 'Awaiting approval' : i === 1 && o.status === 'Awaiting partner' ? 'Waiting for partner' : s));
  const approver = canApproveLevel(o, currentUser);
  const short = o.status === 'Validated' ? shortfall(o, ctx) : {};
  const block = amendBlock(o);
  /** Confirm with the stock figure read the way the principal chose (live from the ERP, with fallback). */
  const confirmNow = async () => {
    const connector = src === 'ERP' ? masterOf(o.shipFrom.id, imp) : null;
    const read = orderSettings().inventory.read;
    if (connector && isLive(connector) && read !== 'sync') {
      setBusy(true);
      const r = await runLiveSync(connector, { ...imp, actor: currentUser.name }).catch((e: Error) => ({ failed: 1, failures: [{ message: e.message }] }));
      setBusy(false);
      if ((r as { failed: number }).failed && read === 'live') { setErrs([`${erp} didn’t answer — can’t confirm on a live stock figure (Settings → Inventory).`]); return; }
      if ((r as { failed: number }).failed) showToast(`${erp} didn’t answer — confirming on the last sync.`, 'warning');
    }
    run(confirmOrder(o.id, Object.fromEntries(o.lines.map((l) => [l.id, decision(l)])), ctx, currentUser.name, erp));
  };
  const backorders = o.lines.some((l) => l.backorderQty > 0) && ['Confirmed', 'Shipped', 'Completed'].includes(o.status);

  const footer = (
    <>
      <Button onClick={onClose}>Close</Button>
      {(canEdit || (o.status === 'Awaiting approval' && approver.ok)) && open && <Button variant="danger" onClick={() => run(rejectOrder(o.id, reason, currentUser.name))}>Reject</Button>}
      {canEdit && o.status === 'Confirmed' && !o.shipments.length && <Button variant="ghost" onClick={() => run(cancelOrder(o.id, reason, currentUser.name))}>Cancel order</Button>}
      {canEdit && o.status === 'Received' && <Button icon={<RefreshCw size={14} />} onClick={() => run(validate(o.id, ctx, currentUser.name))}>Check again</Button>}
      {canApprove && o.status === 'On hold' && <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={() => run(releaseCredit(o.id, reason, ctx, currentUser.name))}>Release credit for this order</Button>}
      {canEdit && !block && !['Rejected', 'Cancelled'].includes(o.status) && <Button icon={<Pencil size={14} />} onClick={() => setAmending(true)}>Change order</Button>}
      {o.status === 'Awaiting approval' && approver.ok && <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={() => run(approveOrder(o.id, reason, ctx, currentUser))}>Approve ({o.approval?.levels[o.approval.step]})</Button>}
      {canEdit && o.status === 'Validated' && Object.keys(short).length > 0 && <Button icon={<UserCheck size={14} />} onClick={() => run(askPartFill(o.id, ctx, currentUser.name))}>Ask partner to choose</Button>}
      {canEdit && o.status === 'Validated' && <Button variant="primary" loading={busy} icon={<CheckCircle2 size={14} />} onClick={() => { void confirmNow(); }}>{src === 'NONE' ? 'Confirm as entered' : 'Confirm — reserve & notify'}</Button>}
      {o.status === 'Confirmed' && logistics && <Button variant="primary" icon={<Truck size={14} />} onClick={() => navigate(`/logistics?tab=queue&o=${o.id}`)}>Open in Logistics</Button>}
      {canEdit && backorders && <Button onClick={() => { const r = releaseBackorder(o.id, ctx, currentUser.name); if (run(r) && r.id) onOpen(r.id); }}>Release backorder</Button>}
    </>
  );

  return (
    <>
    {amending && <AmendModal o={o} ctx={ctx} onClose={() => setAmending(false)} />}
    <Modal open size="xl" title={`${o.code} · ${o.partnerName}${(o.version ?? 1) > 1 ? ` · v${o.version}` : ''}`} onClose={onClose} footer={footer}
      subtitle={<span className="g2-row">{o.orderType} · PO {o.poNumber} · via {o.source} · ships from {o.shipFrom.name} {cnf ? '(C&F, invoiced in VinFlux)' : `(${erp})`} <Badge tone={STATUS_TONE[o.status]} dot>{o.status}</Badge></span>}>
      <div className="g2-stack">
        {!['Rejected', 'Cancelled'].includes(o.status) && <Stepper steps={steps} current={o.status === 'Completed' ? FLOW.length : stepIdx} maxReached={stepIdx} onSelect={() => undefined} />}
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t continue" />}
        {o.status === 'Rejected' && <Alert tone="error">Rejected: {o.rejectReason}</Alert>}
        {o.status === 'Received' && o.blockers.length > 0 && <Alert tone="error">Can’t be validated yet — fix the item(s) below in Go-to-Market / Product Master / Pricing, then “Check again”, or reject the order.</Alert>}
        {o.status === 'On hold' && <Alert tone="warn">On credit hold. Finance can release this one order (not the person who entered it) — write why in the note below.</Alert>}
        {o.status === 'Validated' && <Alert tone="info">{o.partFill?.answer === 'wait' ? `${o.partnerName} chose to wait for the complete order — confirm when it is in stock. ` : 'Checks passed. '}{src === 'NONE' ? 'Stock isn’t tracked: confirm the quantities you can supply.' : `Confirming reserves the quantities, notifies ${o.partnerName}${cnf ? '' : ` and creates the sales order in ${erp}`}.`}</Alert>}
        {o.attachment && <div className="g2-small"><Paperclip size={13} style={{ verticalAlign: -2 }} /> Uploaded {o.attachment.kind}: <span className="g2-mono">{o.attachment.name}</span>{o.enteredFor ? ` — entered by ${o.createdBy} for ${o.enteredFor}` : ''}</div>}
        {o.approval && (o.status === 'Awaiting approval' || o.approval.decisions.length > 0) && (
          <Card title="Approval" subtitle={o.approval.reasons.join(' · ')}>
            <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {o.approval.levels.map((lv, i) => {
                const d = o.approval!.decisions.find((x) => x.level === lv);
                const cur = !o.approval!.done && i === o.approval!.step && o.status === 'Awaiting approval';
                return <Badge key={lv + i} tone={d?.decision === 'Approved' ? 'green' : d?.decision === 'Rejected' ? 'red' : cur ? 'amber' : 'slate'} dot>{i + 1}. {lv}{d ? ` — ${d.decision.toLowerCase()} by ${d.by}` : cur ? ' — waiting' : ''}</Badge>;
              })}
              {approvalOverdue(o) && <Badge tone="red"><Clock size={11} /> Overdue — escalated</Badge>}
            </div>
            {o.status === 'Awaiting approval' && !approver.ok && <div className="g2-small g2-muted" style={{ marginTop: 8 }}>{approver.why}</div>}
          </Card>
        )}
        {o.status === 'Awaiting partner' && o.partFill && (
          <Card title="Waiting for the partner’s choice" subtitle={`Asked ${when(o.partFill.askedAt)} — no answer within ${orderSettings().partFill.replyHours} h → ${orderSettings().partFill.onTimeout === 'ship-available' ? 'ship what is available, backorder the rest' : 'wait for the complete order'}.`}>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Ordered</th><th style={{ textAlign: 'right' }}>Available now</th></tr></thead>
              <tbody>{o.lines.map((l) => <tr key={l.id}><td>{l.name}</td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right', color: (o.partFill!.proposal[l.id] ?? l.qty) < l.qty ? '#b45309' : undefined }}>{o.partFill!.proposal[l.id] ?? l.qty}</td></tr>)}</tbody>
            </table></div>
            {canEdit && <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <span className="g2-small g2-muted">Partner answered by phone / email:</span>
              <Button size="sm" onClick={() => run(answerPartFill(o.id, 'ship-available', 'Order desk', ctx, currentUser.name))}>Ship available now</Button>
              <Button size="sm" onClick={() => run(answerPartFill(o.id, 'wait', 'Order desk', ctx, currentUser.name))}>Wait for complete</Button>
              <Button size="sm" onClick={() => run(answerPartFill(o.id, 'accept-proposed', 'Order desk', ctx, currentUser.name))}>Accept proposed quantity</Button>
              <Button size="sm" variant="ghost" onClick={() => run(answerPartFill(o.id, orderSettings().partFill.onTimeout, 'No reply (default)', ctx, 'System'))}>Apply no-reply default (demo)</Button>
            </div>}
          </Card>
        )}
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
        <NoticeCard notices={o.notifications ?? []} />

        {((canEdit && (open || (o.status === 'Confirmed' && !o.shipments.length))) || (canApprove && o.status === 'On hold') || (o.status === 'Awaiting approval' && approver.ok)) && (
          <Field label={o.status === 'Awaiting approval' ? 'Approval note — or reason to reject (the partner sees a rejection)' : o.status === 'On hold' ? 'Release note (e.g. payment received, cheque details) — or reason to reject' : 'Reason (needed to reject or cancel — the partner sees it)'}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        )}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>Timeline</div>
          {o.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {when(x.at)}{x.note ? ` — ${x.note}` : ''}</span></div>)}
        </div>
      </div>
    </Modal>
    </>
  );
};

/* ----------------------------------- Page ----------------------------------- */

const TABS: { id: string; label: string; match: (o: Order) => boolean }[] = [
  { id: 'received', label: 'Needs attention', match: (o) => o.status === 'Received' },
  { id: 'approval', label: 'Approvals', match: (o) => o.status === 'Awaiting approval' },
  { id: 'hold', label: 'Credit hold', match: (o) => o.status === 'On hold' },
  { id: 'partner', label: 'Waiting for partner', match: (o) => o.status === 'Awaiting partner' },
  { id: 'validated', label: 'To confirm', match: (o) => o.status === 'Validated' },
  { id: 'confirmed', label: 'To ship', match: (o) => o.status === 'Confirmed' },
  { id: 'shipped', label: 'In transit', match: (o) => o.shipments.some((s) => !s.deliveredAt) },
  { id: 'completed', label: 'Completed', match: (o) => o.status === 'Completed' },
  { id: 'backorder', label: 'Backorders', match: (o) => o.lines.some((l) => l.backorderQty > 0) },
  { id: 'closed', label: 'Rejected / cancelled', match: (o) => ['Rejected', 'Cancelled'].includes(o.status) },
];

const OrdersPage: React.FC = () => {
  useSubscribe(subscribeOrders, subscribeStock, subscribePricing, subscribeMailbox, subscribeOrderSettings, subscribeRouting);
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
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (ctx) { ensureDemo(imp, ctx, activePrincipal.id); applyPartFillTimeouts(ctx); } }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = listOrders().filter((o) => o.principalId === activePrincipal.id);
  const mail = listEmails();
  const fresh = mail.filter((e) => e.status === 'New' || e.status === 'Unmatched');
  const inFlight = useMemo(() => all.filter((o) => ['Confirmed', 'Shipped'].includes(o.status)), [all]);
  if (!ctx) return <div className="g2 g2-embed" style={{ padding: 24 }}>Loading orders…</div>;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.gtm?.includes('edit') || !!m.inventory?.includes('edit');
  const canConfigure = !m || !!m.gtm?.includes('configure') || !!m.inventory?.includes('configure');
  const cur = TABS.find((t) => t.id === tab);
  const rows = cur ? all.filter((o) => cur.match(o) && [o.code, o.partnerName, o.poNumber].some((x) => x.toLowerCase().includes(q.toLowerCase()))) : [];
  const mailRows = mail.filter((e) => [e.subject, e.from, e.fromName].some((x) => x.toLowerCase().includes(q.toLowerCase())));
  const runInbox = () => {
    const r = processInbox(ctx, activePrincipal.id, warehouses, currentUser.name);
    showToast(r.processed ? `${r.processed} email(s): ${r.created} order(s) created, ${r.refused} refused (not direct), ${r.unmatched} need a look.` : 'No new emails.', 'success');
  };

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Orders" description="Received → checks → approval (only when a rule hits) → confirmed automatically when in stock, or the partner chooses on a shortfall → shipped → completed on proof of delivery. Every policy is set under Settings."
        actions={<>{canEdit && <><Button icon={<MailPlus size={15} />} onClick={() => { simulateEmail(ctx, activePrincipal.id); showToast('A new order email arrived (demo).', 'success'); setTab('inbox'); }}>Simulate email</Button>
          <Button icon={<Upload size={15} />} disabled={!channelOpen('excel') && !channelOpen('pdf')} onClick={() => setUploading(true)}>Upload order</Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>Enter order</Button></>}
          <Button variant="ghost" icon={<Settings2 size={15} />} onClick={() => setTab('settings')}>Settings</Button></>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Mailbox to process" value={fresh.length} icon={<Inbox size={22} />} color="#2563eb" bg="#eff6ff" foot={`${mail.filter((e) => e.status === 'Unmatched').length} need a look · ${MAILBOX}`} />
        <KpiCard label="To confirm" value={all.filter((o) => o.status === 'Validated').length} icon={<CheckCircle2 size={22} />} color="#059669" bg="#ecfdf5" foot={`${all.filter((o) => o.status === 'Awaiting approval').length} for approval · ${all.filter((o) => o.status === 'Awaiting partner').length} with partner · ${all.filter((o) => o.status === 'On hold').length} credit hold`} />
        <KpiCard label="Confirmed / in transit" value={inFlight.length} icon={<Truck size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${inr(inFlight.reduce((a, o) => a + orderValue(o, true), 0))} value`} />
        <KpiCard label="Units on backorder" value={all.reduce((a, o) => a + o.lines.reduce((b, l) => b + l.backorderQty, 0), 0)} icon={<CirclePause size={22} />} color="#dc2626" bg="#fef2f2" foot="release when stock arrives" />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'inbox', label: 'Mailbox', count: fresh.length || undefined }, ...TABS.map((t) => ({ id: t.id, label: t.label, count: all.filter(t.match).length || undefined })), { id: 'routed', label: 'Routed to partners', count: routedOrders(activePrincipal.id).length || undefined }, { id: 'settings', label: 'Settings' }]} />
          <span className="g2-spacer" />
          {tab !== 'settings' && <SearchInput value={q} onChange={setQ} placeholder={tab === 'inbox' ? 'Sender, subject…' : 'Order, partner, PO…'} />}
        </div>
        {tab === 'settings' ? <OrderSettingsPanel ctx={ctx} canConfigure={canConfigure} /> : tab === 'routed' ? (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Routed</th><th>From</th><th>Routed to</th><th>Products</th><th style={{ textAlign: 'right' }}>Est. value</th><th>Outcome</th></tr></thead>
            <tbody>
              {routedOrders(activePrincipal.id).length === 0 && <tr><td colSpan={6} className="g2-muted">Orders from partners who buy through another partner (dealers, sub-distributors) are routed to their supplier and recorded here as downstream demand.</td></tr>}
              {routedOrders(activePrincipal.id).filter((r) => !q || `${r.no} ${r.fromName} ${r.supplierName} ${r.poNumber}`.toLowerCase().includes(q.toLowerCase())).map((r) => (
                <tr key={r.id}>
                  <td className="g2-mono">{r.no}<div className="g2-cell-sub">{r.at.slice(0, 10)} · {r.source}{r.poNumber ? ` · PO ${r.poNumber}` : ''}</div></td>
                  <td>{r.fromName}</td><td>{r.supplierName}</td>
                  <td className="g2-small">{r.lines.map((l) => `${l.name.slice(0, 32)} × ${l.qty}`).join('; ')}</td>
                  <td style={{ textAlign: 'right' }}>₹{r.value.toLocaleString('en-IN')}</td>
                  <td><Badge tone={r.status === 'In supplier’s inbox' ? 'green' : 'amber'}>{r.status}</Badge><div className="g2-cell-sub" style={{ maxWidth: 320 }}>{r.message}</div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : tab === 'inbox' ? (
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
                  <td style={{ textAlign: 'right' }}>{inr(orderValue(o, !OPEN.includes(o.status)))}</td>
                  <td>{o.requiredBy}</td>
                  <td><Badge tone={STATUS_TONE[o.status]} dot>{o.status}</Badge>
                    <div className="g2-cell-sub">{['Received', 'On hold', 'Awaiting approval'].includes(o.status) ? o.blockers[0]?.slice(0, 70) : o.status === 'Awaiting partner' ? 'Part-fill choice sent' : o.shipments.length ? `${o.shipments.filter((s) => s.deliveredAt).length}/${o.shipments.length} shipment(s) delivered` : ''}</div>
                    {o.lines.some((l) => l.backorderQty > 0) && <div className="g2-cell-sub">{o.lines.reduce((a, l) => a + l.backorderQty, 0)} on backorder</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {uploading && <UploadOrderModal ctx={ctx} onClose={() => setUploading(false)} onOpen={setOpenId} />}
      {creating && <NewOrderDrawer ctx={ctx} onClose={() => setCreating(false)} onOpen={setOpenId} />}
      {emailId && <EmailDrawer key={emailId} id={emailId} ctx={ctx} onClose={() => setEmailId(null)} onOpenOrder={setOpenId} />}
      {openId && <OrderDrawer key={openId} id={openId} ctx={ctx} onClose={() => setOpenId(null)} onOpen={setOpenId} onOpenEmail={(eid) => { setOpenId(null); setEmailId(eid); }} />}
    </div>
  );
};
export default OrdersPage;
