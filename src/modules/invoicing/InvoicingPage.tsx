/**
 * Invoicing in VinFlux (OP4): tax invoices, e-invoice and e-way bill, credit notes, GST registrations and series.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Printer, ReceiptText, Truck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchInput, Select, Switch, Tabs, Textarea } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { optChoice } from '../../platform/moduleOptions';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import { subscribeOrders } from '../orders/orderStore';
import {
  STATE_CODES, cancelInvoice, challans as allChallans, debitNotes as allDebits, raiseDebitNote, creditNotes as allCredits, generateEway, generateIrn, getInvoice, invSettings, invoices as allInvoices, printInvoice, raiseCreditNote, saveInvSettings,
  subscribeInvoicing, syncInvoices,
} from './invoiceStore';
import type { CnReason, DnReason, InvSettings } from './invoiceStore';

const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const r2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const InvoiceModal: React.FC<{ id: string; canEdit: boolean; onClose: () => void }> = ({ id, canEdit, onClose }) => {
  useSubscribe(subscribeInvoicing);
  const { currentUser, showToast } = useApp();
  const i = getInvoice(id);
  const [errs, setErrs] = useState<string[]>([]);
  const [ew, setEw] = useState({ vehicle: i?.vehicleNo ?? '', km: 150 });
  const [cn, setCn] = useState<{ reason: CnReason; amounts: Record<number, number> } | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [dn, setDn] = useState<{ reason: DnReason; amount: number } | null>(null);
  if (!i) return null;
  const s = invSettings();
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok) setErrs(r.errors ?? [r.message]); else { setErrs([]); showToast(r.message, 'success'); } return r.ok; };
  const credited = allCredits(i.principalId).filter((c) => c.invoiceId === i.id);
  return (
    <Modal open size="xl" title={<span className="g2-row" style={{ gap: 8 }}>Tax invoice {i.no} {i.status === 'Cancelled' ? <Badge tone="red">Cancelled</Badge> : <Badge tone="green">Issued</Badge>}</span>}
      subtitle={`${i.date} · ${i.buyer.name} · order ${i.orderCode} · ${i.shipmentNo}`} onClose={onClose}
      footer={<>
        <Button icon={<Printer size={15} />} onClick={() => printInvoice(i)}>Print / PDF</Button>
        {canEdit && i.status === 'Issued' && <Button icon={<XCircle size={15} />} onClick={() => setCancel('')}>Cancel invoice</Button>}
        {canEdit && i.status === 'Issued' && <Button onClick={() => setCn({ reason: 'Sales return', amounts: {} })}>Credit note</Button>}
        {canEdit && i.status === 'Issued' && <Button onClick={() => setDn({ reason: 'Price revision', amount: 0 })}>Debit note</Button>}
        {canEdit && i.status === 'Issued' && s.einvoice && !i.irn && i.buyer.gstin && <Button variant="primary" onClick={() => tell(generateIrn(i.id, currentUser.name))}>Generate e-invoice (IRN)</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Couldn’t do that" />}
        {i.status === 'Cancelled' && <Alert tone="warn">Cancelled: {i.cancelReason}</Alert>}
        <div className="g2-grid g2-grid-2">
          <Card title="Seller"><div className="g2-small"><strong>{i.seller.legalName}</strong><br />{i.seller.address}<br />GSTIN <span className="g2-mono">{i.seller.gstin}</span> · {i.seller.state}</div></Card>
          <Card title="Buyer"><div className="g2-small"><strong>{i.buyer.name}</strong><br />{i.buyer.address || '—'}<br />GSTIN <span className="g2-mono">{i.buyer.gstin || 'Unregistered (B2C)'}</span> · place of supply {i.placeOfSupply}</div></Card>
        </div>
        <Card flush><div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Item</th><th>HSN</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>GST</th>{i.inter ? <th style={{ textAlign: 'right' }}>IGST</th> : <><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th></>}{cn && <th style={{ width: 140 }}>Credit (taxable ₹)</th>}</tr></thead>
          <tbody>{i.lines.map((l, k) => (
            <tr key={k}><td>{l.name}<div className="g2-cell-sub g2-mono">{l.batch}</div></td><td className="g2-mono g2-small">{l.hsn}</td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right' }}>{r2(l.rate)}</td><td style={{ textAlign: 'right' }}>{r2(l.taxable)}</td><td style={{ textAlign: 'right' }}>{l.gstPct}%</td>
              {i.inter ? <td style={{ textAlign: 'right' }}>{r2(l.igst)}</td> : <><td style={{ textAlign: 'right' }}>{r2(l.cgst)}</td><td style={{ textAlign: 'right' }}>{r2(l.sgst)}</td></>}
              {cn && <td><NumberInput value={cn.amounts[k] ?? 0} onChange={(v) => setCn({ ...cn, amounts: { ...cn.amounts, [k]: v ?? 0 } })} /></td>}</tr>
          ))}
            <tr style={{ fontWeight: 700 }}><td colSpan={4}>Total {i.roundOff ? <span className="g2-small g2-muted">(round off {r2(i.roundOff)})</span> : null}</td><td style={{ textAlign: 'right' }}>{r2(i.taxable)}</td><td />{i.inter ? <td style={{ textAlign: 'right' }}>{r2(i.igst)}</td> : <><td style={{ textAlign: 'right' }}>{r2(i.cgst)}</td><td style={{ textAlign: 'right' }}>{r2(i.sgst)}</td></>}{cn && <td />}</tr>
            <tr><td colSpan={i.inter ? 7 : 8} style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>Invoice total ₹{i.total.toLocaleString('en-IN')}</td>{cn && <td />}</tr>
          </tbody>
        </table></div></Card>
        {cn && (
          <Card title="Credit note" subtitle="Tax is reversed at each line’s GST rate; the credit note is numbered in this GSTIN’s CN series">
            <div className="g2-row" style={{ gap: 8 }}>
              <div style={{ width: 220 }}><Select value={cn.reason} options={(['Sales return', 'Rate difference', 'Scheme / discount', 'Shortage or damage', 'Other'] as CnReason[]).map((x) => ({ value: x, label: x }))} onChange={(v) => setCn({ ...cn, reason: v as CnReason })} /></div>
              <Button onClick={() => setCn(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => { if (tell(raiseCreditNote(i.id, cn.reason, cn.amounts, currentUser.name))) setCn(null); }}>Raise credit note</Button>
            </div>
          </Card>
        )}
        <div className="g2-grid g2-grid-2">
          <Card title="E-invoice">
            {!s.einvoice ? <div className="g2-small g2-muted">Switched off in settings (turnover below the e-invoice limit).</div>
              : !i.buyer.gstin ? <div className="g2-small g2-muted">B2C sale — not required.</div>
                : i.irn ? <div className="g2-small">IRN <span className="g2-mono" style={{ wordBreak: 'break-all' }}>{i.irn}</span><br />Ack {i.ackNo} · {i.ackAt?.slice(0, 16).replace('T', ' ')}<br /><span className="g2-muted">Cancel allowed until {new Date(Date.parse(i.ackAt!) + 86400000).toISOString().slice(0, 16).replace('T', ' ')}</span></div>
                  : <div className="g2-small g2-muted">Not generated yet.</div>}
          </Card>
          <Card title="E-way bill">
            {i.total <= s.ewayLimit ? <div className="g2-small g2-muted">Not needed — value within ₹{s.ewayLimit.toLocaleString('en-IN')}.</div>
              : i.ewayBill ? <div className="g2-small">EWB <span className="g2-mono">{i.ewayBill}</span> · {i.vehicleNo}<br />Valid until {i.ewayValidTo}</div>
                : canEdit && i.status === 'Issued' ? <div className="g2-row" style={{ gap: 8, alignItems: 'flex-end' }}>
                  <Field label="Vehicle no."><Input value={ew.vehicle} onChange={(e) => setEw({ ...ew, vehicle: e.target.value })} /></Field>
                  <div style={{ width: 90 }}><Field label="Distance km"><NumberInput value={ew.km} onChange={(v) => setEw({ ...ew, km: v ?? 0 })} /></Field></div>
                  <Button icon={<Truck size={14} />} onClick={() => tell(generateEway(i.id, ew.vehicle, ew.km, currentUser.name))}>Generate</Button></div> : <div className="g2-small g2-muted">Required — not generated.</div>}
          </Card>
        </div>
        {dn && (
          <Card title="Debit note" subtitle={`Charged at ${i.lines[0]?.gstPct ?? 0}% GST; numbered in this GSTIN’s DN series (TAX-04)`}>
            <div className="g2-row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <div style={{ width: 220 }}><Field label="Reason"><Select value={dn.reason} options={(['Price revision', 'Short billed', 'Freight recovery', 'Interest on late payment', 'Other'] as DnReason[]).map((x) => ({ value: x, label: x }))} onChange={(v) => setDn({ ...dn, reason: v as DnReason })} /></Field></div>
              <div style={{ width: 160 }}><Field label="Taxable amount (₹)"><NumberInput value={dn.amount} onChange={(v) => setDn({ ...dn, amount: v ?? 0 })} /></Field></div>
              <Button onClick={() => setDn(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => { if (tell(raiseDebitNote(i.id, dn.reason, dn.amount, i.lines[0]?.gstPct ?? 0, currentUser.name))) setDn(null); }}>Raise debit note</Button>
            </div>
          </Card>
        )}
        {credited.length > 0 && <Card title="Credit notes against this invoice"><div className="g2-small">{credited.map((c) => <div key={c.id}><span className="g2-mono">{c.no}</span> · {c.date} · {c.reason} · ₹{c.total.toLocaleString('en-IN')}</div>)}</div></Card>}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{i.history.map((h, k) => <div key={k} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>
      </div>
      {cancel !== null && (
        <Modal open variant="modal" title={`Cancel ${i.no}`} onClose={() => setCancel(null)} footer={<><Button onClick={() => setCancel(null)}>Keep</Button><Button variant="danger" onClick={() => { if (tell(cancelInvoice(i.id, cancel, currentUser.name))) setCancel(null); }}>Cancel invoice</Button></>}>
          <Field label="Reason" required hint="E-invoices can be cancelled only within 24 hours of the IRN"><Textarea rows={2} value={cancel} onChange={(e) => setCancel(e.target.value)} /></Field>
        </Modal>
      )}
    </Modal>
  );
};

const InvoicingPage: React.FC = () => {
  useSubscribe(subscribeInvoicing, subscribeOrders);
  const { activePrincipal, currentUser, products, warehouses, showToast } = useApp();
  const partners = usePartners().data ?? [];
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'invoices';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const m = currentUser.matrix; const admin = !m || (currentUser.role ?? '').includes('Administrator');
  const canEdit = admin || !!m?.pricing?.includes('edit') || (currentUser.role ?? '').includes('Finance');
  useEffect(() => { if (partners.length) syncInvoices(activePrincipal.id, products, partners, warehouses); });
  const [s, setS] = useState<InvSettings>(invSettings());
  const inv = allInvoices(activePrincipal.id); const cns = allCredits(activePrincipal.id); const dcs = allChallans(activePrincipal.id); const dns = allDebits(activePrincipal.id);
  const shown = inv.filter((i) => [i.no, i.buyer.name, i.orderCode, i.buyer.gstin].some((x) => x.toLowerCase().includes(q.toLowerCase())));
  const month = new Date().toISOString().slice(0, 7);
  const mi = inv.filter((i) => i.status === 'Issued' && i.date.slice(0, 7) === month);
  const pendingIrn = inv.filter((i) => i.status === 'Issued' && invSettings().einvoice && i.buyer.gstin && !i.irn).length;
  const pendingEwb = inv.filter((i) => i.status === 'Issued' && i.total > invSettings().ewayLimit && !i.ewayBill).length;
  const mode = optChoice('orders', 'invoicing');
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Invoicing" description="GST tax invoices for every shipment, e-invoice and e-way bill, credit notes — numbered per GSTIN and financial year." />
      {mode !== 'vinflux' && <Alert tone="info">Your ERP issues the tax invoice (Modules → Orders → “Who issues the tax invoice”). Invoices appear here only for shipments invoiced in VinFlux.</Alert>}
      <div className="g2-grid g2-grid-4" style={{ margin: '12px 0 16px' }}>
        <KpiCard label="Invoiced this month" value={inr(mi.reduce((a, i) => a + i.total, 0))} icon={<FileText size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${mi.length} invoice(s) · GST ${inr(mi.reduce((a, i) => a + i.cgst + i.sgst + i.igst, 0))}`} />
        <KpiCard label="E-invoice pending" value={pendingIrn} icon={<ReceiptText size={22} />} color="#d97706" bg="#fffbeb" foot="B2B invoices without IRN" />
        <KpiCard label="E-way bill pending" value={pendingEwb} icon={<Truck size={22} />} color="#dc2626" bg="#fef2f2" foot={`value above ₹${invSettings().ewayLimit.toLocaleString('en-IN')}`} />
        <KpiCard label="Credit notes this month" value={inr(cns.filter((c) => c.date.slice(0, 7) === month).reduce((a, c) => a + c.total, 0))} icon={<XCircle size={22} />} color="#0891b2" bg="#ecfeff" foot={`${cns.length} in all`} onClick={() => setTab('credit')} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'invoices', label: 'Tax invoices', count: inv.length || undefined }, { id: 'credit', label: 'Credit notes', count: cns.length || undefined }, { id: 'debit', label: 'Debit notes', count: dns.length || undefined }, { id: 'challans', label: 'Delivery challans', count: dcs.length || undefined }, { id: 'settings', label: 'GST registrations & settings' }]} />{tab === 'invoices' && <><span className="g2-spacer" /><div style={{ width: 260 }}><SearchInput value={q} onChange={setQ} placeholder="Invoice, partner, order, GSTIN" /></div></>}</div>
        {tab === 'invoices' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Invoice</th><th>Buyer</th><th>Order</th><th>Supply</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>GST</th><th style={{ textAlign: 'right' }}>Total</th><th>E-invoice / EWB</th></tr></thead>
            <tbody>{shown.length === 0 && <tr><td colSpan={8} className="g2-muted">No invoices yet — they are raised when a shipment is dispatched with VinFlux as the invoicing system.</td></tr>}
              {shown.map((i) => (
                <tr key={i.id} style={{ cursor: 'pointer', opacity: i.status === 'Cancelled' ? 0.55 : 1 }} onClick={() => setOpen(i.id)}>
                  <td className="g2-mono">{i.no}<div className="g2-cell-sub">{i.date}{i.status === 'Cancelled' ? ' · cancelled' : ''}</div></td>
                  <td>{i.buyer.name}<div className="g2-cell-sub g2-mono">{i.buyer.gstin || 'B2C'}</div></td>
                  <td className="g2-small g2-mono">{i.orderCode}</td>
                  <td className="g2-small">{i.inter ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</td>
                  <td style={{ textAlign: 'right' }}>{inr(i.taxable)}</td><td style={{ textAlign: 'right' }}>{inr(i.cgst + i.sgst + i.igst)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(i.total)}</td>
                  <td>{i.irn ? <Badge tone="green">IRN</Badge> : i.buyer.gstin && invSettings().einvoice ? <Badge tone="amber">IRN due</Badge> : null} {i.ewayBill ? <Badge tone="green">EWB</Badge> : i.total > invSettings().ewayLimit ? <Badge tone="red">EWB due</Badge> : null}</td>
                </tr>
              ))}</tbody>
          </table></div>
        )}
        {tab === 'credit' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Credit note</th><th>Partner</th><th>Against</th><th>Reason</th><th>From</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>{cns.length === 0 && <tr><td colSpan={8} className="g2-muted">No credit notes.</td></tr>}
              {cns.map((c) => <tr key={c.id}><td className="g2-mono">{c.no}<div className="g2-cell-sub">{c.date}</div></td><td>{c.partnerName}</td><td className="g2-mono g2-small">{c.invoiceNo}</td><td className="g2-small">{c.reason}</td><td className="g2-small">{c.source}</td><td style={{ textAlign: 'right' }}>{inr(c.taxable)}</td><td style={{ textAlign: 'right' }}>{inr(c.tax)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(c.total)}</td></tr>)}</tbody>
          </table></div>
        )}
        {tab === 'debit' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Debit note</th><th>Partner</th><th>Against</th><th>Reason</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>{dns.length === 0 && <tr><td colSpan={7} className="g2-muted">No debit notes — raise one from an invoice (price revision, short billing, freight or interest recovery).</td></tr>}
              {dns.map((c) => <tr key={c.id}><td className="g2-mono">{c.no}<div className="g2-cell-sub">{c.date}{c.irn ? ' · IRN' : ''}</div></td><td>{c.partnerName}</td><td className="g2-mono g2-small">{c.invoiceNo}</td><td className="g2-small">{c.reason}</td><td style={{ textAlign: 'right' }}>{inr(c.taxable)}</td><td style={{ textAlign: 'right' }}>{inr(c.tax)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(c.total)}</td></tr>)}</tbody>
          </table></div>
        )}
        {tab === 'challans' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Challan</th><th>Kind</th><th>To</th><th>Order</th><th>Products</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th></tr></thead>
            <tbody>{dcs.length === 0 && <tr><td colSpan={7} className="g2-muted">No delivery challans — consignment shipments and transfers within one GSTIN get a challan instead of a tax invoice (TAX-05).</td></tr>}
              {dcs.map((c) => <tr key={c.id}><td className="g2-mono">{c.no}<div className="g2-cell-sub">{c.date}{c.ewayBill ? ` · EWB ${c.ewayBill}` : ''}</div></td><td className="g2-small">{c.kind}</td><td>{c.to.name}<div className="g2-cell-sub">{c.to.state}</div></td><td className="g2-mono g2-small">{c.orderCode}</td><td className="g2-small">{c.lines.map((l) => `${l.name.slice(0, 28)} × ${l.qty}`).join('; ')}</td><td style={{ textAlign: 'right' }}>{inr(c.value)}</td><td><Badge tone={c.status === 'Open' ? 'amber' : 'green'}>{c.status === 'Open' ? 'In transit' : 'Delivered'}</Badge><div className="g2-cell-sub">{c.note}</div></td></tr>)}</tbody>
          </table></div>
        )}
        {tab === 'settings' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <Card title="GST registrations" subtitle="One per state you ship from; each has its own invoice and credit-note series per financial year">
              {s.registrations.map((r, k) => (
                <FormGrid key={k} cols={3}>
                  <Field label="State"><Select value={r.state} disabled={!admin} options={Object.keys(STATE_CODES).map((x) => ({ value: x, label: `${x} (${STATE_CODES[x]})` }))} onChange={(v) => setS({ ...s, registrations: s.registrations.map((y, i) => (i === k ? { ...y, state: v } : y)) })} /></Field>
                  <Field label="GSTIN"><Input value={r.gstin} disabled={!admin} onChange={(e) => setS({ ...s, registrations: s.registrations.map((y, i) => (i === k ? { ...y, gstin: e.target.value.toUpperCase() } : y)) })} /></Field>
                  <Field label="Address on invoice"><Input value={r.address} disabled={!admin} onChange={(e) => setS({ ...s, registrations: s.registrations.map((y, i) => (i === k ? { ...y, address: e.target.value } : y)) })} /></Field>
                </FormGrid>
              ))}
              {admin && <Button size="sm" onClick={() => setS({ ...s, registrations: [...s.registrations, { state: 'Karnataka', gstin: '', legalName: s.registrations[0]?.legalName ?? activePrincipal.name, address: '' }] })}>Add registration</Button>}
            </Card>
            <Card title="E-invoice and e-way bill">
              <FormGrid cols={3}>
                <Field label="E-invoicing"><Switch checked={s.einvoice} disabled={!admin} onChange={(v) => setS({ ...s, einvoice: v })} label="E-invoice" /></Field>
                <Field label="E-way bill above (₹)"><NumberInput value={s.ewayLimit} disabled={!admin} onChange={(v) => setS({ ...s, ewayLimit: v ?? 50000 })} /></Field>
                <Field label="Bank details on invoice"><Input value={s.bankDetails} disabled={!admin} onChange={(e) => setS({ ...s, bankDetails: e.target.value })} /></Field>
              </FormGrid>
              <Field label="Terms printed on invoice"><Textarea rows={2} value={s.terms} disabled={!admin} onChange={(e) => setS({ ...s, terms: e.target.value })} /></Field>
            </Card>
            {admin && <div><Button variant="primary" onClick={() => { const r = saveInvSettings(s); showToast(r.message, r.ok ? 'success' : 'warning'); }}>Save settings</Button></div>}
          </div>
        )}
      </Card>
      {open && <InvoiceModal id={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </div>
  );
};
export default InvoicingPage;
