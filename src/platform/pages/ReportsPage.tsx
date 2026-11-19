/**
 * Reports (AN1 / RPT-01): every main list as a report — filter, save as a view, export to Excel (CSV), schedule by email.
 */
import React, { useMemo, useState } from 'react';
import { CalendarClock, Download, FileBarChart, Save, Send, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, Modal, PageHeader, SearchInput, Select, Switch } from '../ui';
import { usePlatform } from '../PlatformContext';
import type { ModuleId } from '../modules';
import { useSubscribe } from '../useStore';
import { useApp } from '../../context/AppContext.tsx';
import { orders, orderValue, subscribeOrders } from '../../modules/orders/orderStore';
import { balances } from '../../modules/inventory/stockStore';
import { invoices } from '../../modules/invoicing/invoiceStore';
import { reports as secReports } from '../../modules/secondary/secondaryStore';
import { claims } from '../../modules/claims/claimsStore';
import { ageing } from '../../modules/collections/collectionsStore';
import { pos, poValue } from '../../modules/procurement/procurementStore';
import { auditTrail, download, toCsv } from '../audit';
import { addSchedule, deleteSchedule, deleteView, recordSend, saveView, schedules, subscribeReports, toggleSchedule, views } from '../reports';
import type { Frequency, ReportId, View } from '../reports';

type Row = Record<string, string | number>;
interface Def { id: ReportId; name: string; module?: string; dateCol?: string; statusCol?: string; rows: () => Row[]; note?: string }

const ReportsPage: React.FC = () => {
  useSubscribe(subscribeReports, subscribeOrders);
  const { enabled } = usePlatform();
  const { activePrincipal, currentUser, products, warehouses, showToast } = useApp();
  const pid = activePrincipal.id;
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const wName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;
  const DEFS: Def[] = [
    { id: 'orders', name: 'Orders', module: 'orders', dateCol: 'Date', statusCol: 'Status', rows: () => orders().filter((o) => o.principalId === pid).map((o) => ({ Order: o.code, Date: o.createdAt, Partner: o.partnerName, Source: o.source, Type: o.orderType, Status: o.status, Lines: o.lines.length, 'Value (₹)': Math.round(orderValue(o)) })) },
    { id: 'invoices', name: 'Tax invoices', module: 'invoicing', dateCol: 'Date', statusCol: 'Status', rows: () => invoices(pid).map((i) => ({ Invoice: i.no, Date: i.date, Buyer: i.buyer.name, GSTIN: i.buyer.gstin, Supply: i.inter ? 'IGST' : 'CGST+SGST', 'Taxable (₹)': i.taxable, 'GST (₹)': i.cgst + i.sgst + i.igst, 'Total (₹)': i.total, IRN: i.irn ? 'Yes' : 'No', 'E-way bill': i.ewayBill ?? '', Status: i.status })) },
    { id: 'stock', name: 'Stock on hand', module: 'inventory', statusCol: 'Status', rows: () => balances().filter((b) => b.qty > 0).map((b) => ({ Location: b.locType === 'COMPANY' ? wName(b.warehouseId) : b.warehouseId, Type: b.locType, Product: pName(b.productId), Batch: b.batch, Serial: b.serial ?? '', Expiry: b.expiryDate ?? '', Status: b.status, Qty: b.qty })), note: 'Stock read from the ERP shows its last sync time on the Inventory page.' },
    { id: 'secondary', name: 'Secondary sales', module: 'secondary', dateCol: 'Period', statusCol: 'Report status', rows: () => secReports(pid).flatMap((r) => r.sales.map((s) => ({ Period: r.period, Partner: r.partnerName, Route: r.route, Product: pName(s.productId), Customer: s.customer, 'Customer type': s.customerType, Town: s.town, Qty: s.qty, 'Value (₹)': s.value, 'Report status': r.status, Estimated: r.route === 'none' ? 'ESTIMATED' : '' }))), note: 'Estimated figures are marked ESTIMATED (RPT-03).' },
    { id: 'claims', name: 'Scheme claims', module: 'claims', dateCol: 'Period', statusCol: 'Status', rows: () => claims(pid).map((c) => ({ Claim: c.no, Period: c.period, Partner: c.partnerName, 'Claimed (₹)': c.claimedAmount, 'Verified (₹)': c.computedAmount, 'Approved (₹)': c.approvedAmount ?? '', Status: c.status, Settlement: c.settlement ? `${c.settlement.method} ${c.settlement.ref}` : '' })) },
    { id: 'ageing', name: 'Receivables ageing', module: 'collections', rows: () => ageing(pid).map((a) => ({ Partner: a.partnerName, 'Outstanding (₹)': Math.round(a.outstanding), 'Overdue (₹)': Math.round(a.overdue), 'Not due': Math.round(a.buckets['Not due']), '0–30': Math.round(a.buckets['0–30']), '31–60': Math.round(a.buckets['31–60']), '61–90': Math.round(a.buckets['61–90']), '90+': Math.round(a.buckets['90+']), 'Oldest (days)': a.oldestDays })) },
    { id: 'pos', name: 'Purchase orders', module: 'procurement', dateCol: 'Date', statusCol: 'Status', rows: () => pos(pid).map((p) => ({ PO: p.no, Date: p.history[0]?.at.slice(0, 10) ?? '', Vendor: p.vendorName, Currency: p.currency, 'Value': Math.round(poValue(p)), 'Delivery by': p.deliveryDate, Status: p.status })) },
    { id: 'audit', name: 'Audit trail', dateCol: 'When', statusCol: 'Module', rows: () => auditTrail(pid).map((r) => ({ When: r.at, Who: r.by, Module: r.module, Record: r.record, Action: r.action, Note: r.note, Source: r.source })) },
  ].filter((d) => !d.module || enabled(d.module as ModuleId)) as Def[];

  const [rid, setRid] = useState<ReportId>(DEFS[0]?.id ?? 'orders');
  const [f, setF] = useState({ q: '', status: '', from: '', to: '' });
  const [viewName, setViewName] = useState<string | null>(null); const [shared, setShared] = useState(false);
  const [sch, setSch] = useState<View | null>(null); const [sf, setSf] = useState({ frequency: 'Weekly (Monday)' as Frequency, time: '08:30', recipients: currentUser.email ?? '' });
  const def = DEFS.find((d) => d.id === rid) ?? DEFS[0];
  const all = useMemo(() => (def ? def.rows() : []), [def]); // eslint-disable-line react-hooks/exhaustive-deps
  const statuses = def?.statusCol ? Array.from(new Set(all.map((r) => String(r[def.statusCol!])))).sort() : [];
  const filt = (rows: Row[], v: { q: string; status: string; from: string; to: string }) => rows.filter((r) => (!v.q || Object.values(r).join(' ').toLowerCase().includes(v.q.toLowerCase()))
    && (!v.status || !def?.statusCol || String(r[def.statusCol]) === v.status)
    && (!def?.dateCol || ((!v.from || String(r[def.dateCol]).slice(0, 10) >= v.from.slice(0, v.from.length)) && (!v.to || String(r[def.dateCol]).slice(0, 10) <= v.to))));
  const rows = filt(all, f);
  const cols = rows[0] ? Object.keys(rows[0]) : all[0] ? Object.keys(all[0]) : [];
  const canExport = !currentUser.matrix || (currentUser.role ?? '').includes('Administrator') || !!Object.values(currentUser.matrix).some((a) => (a as string[]).includes('approve'));
  const myViews = views(currentUser.name);
  const exportNow = (name: string, data: Row[]) => download(`${name.replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
  const applyView = (v: View) => { setRid(v.report); setF({ q: v.q, status: v.status, from: v.from, to: v.to }); };
  const viewRows = (v: View) => { const d = DEFS.find((x) => x.id === v.report); return d ? filt(d.rows(), v) : []; };

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Reports" description="Every main list as a report: filter it, save it as a view, export to Excel, or have it emailed on a schedule." />
      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div className="g2-stack" style={{ gap: 12 }}>
          <Card title="Reports"><div className="g2-stack" style={{ gap: 4 }}>{DEFS.map((d) => <button key={d.id} type="button" className="g2-card" style={{ padding: '8px 10px', textAlign: 'left', cursor: 'pointer', borderColor: rid === d.id ? 'var(--g2-primary)' : undefined }} onClick={() => { setRid(d.id); setF({ q: '', status: '', from: '', to: '' }); }}><FileBarChart size={13} style={{ verticalAlign: -2 }} /> {d.name}</button>)}</div></Card>
          <Card title="Saved views" subtitle={myViews.length ? undefined : 'None yet'}>
            <div className="g2-stack" style={{ gap: 6 }}>{myViews.map((v) => (
              <div key={v.id} className="g2-row" style={{ gap: 4 }}>
                <a href="#" style={{ flex: 1, fontSize: 13 }} onClick={(e) => { e.preventDefault(); applyView(v); }}>{v.name}</a>
                {v.shared && <Badge tone="blue">shared</Badge>}
                <Button size="sm" variant="ghost" icon={<CalendarClock size={13} />} onClick={() => setSch(v)} />
                {v.owner === currentUser.name && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => deleteView(v.id)} />}
              </div>
            ))}</div>
          </Card>
        </div>
        <div className="g2-stack" style={{ gap: 12 }}>
          <Card flush>
            <div className="g2-filterbar" style={{ flexWrap: 'wrap', gap: 8 }}>
              <strong>{def?.name}</strong><span className="g2-small g2-muted">{rows.length} row(s)</span><span className="g2-spacer" />
              <div style={{ width: 220 }}><SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Search…" /></div>
              {statuses.length > 0 && <div style={{ width: 170 }}><Select value={f.status} options={[{ value: '', label: `Any ${def?.statusCol?.toLowerCase()}` }, ...statuses.map((s) => ({ value: s, label: s }))]} onChange={(v) => setF({ ...f, status: v })} /></div>}
              {def?.dateCol && <><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} style={{ width: 150 }} /><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} style={{ width: 150 }} /></>}
              <Button size="sm" icon={<Save size={13} />} onClick={() => setViewName('')}>Save view</Button>
              {canExport && <Button size="sm" variant="primary" icon={<Download size={13} />} onClick={() => exportNow(def?.name ?? 'report', rows)}>Export</Button>}
            </div>
            {def?.note && <div style={{ padding: '0 16px' }}><Alert tone="info">{def.note}</Alert></div>}
            <div className="g2-table-wrap" style={{ maxHeight: 520 }}><table className="g2-table">
              <thead><tr>{cols.map((c) => <th key={c} style={{ textAlign: typeof rows[0]?.[c] === 'number' ? 'right' : undefined }}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={Math.max(1, cols.length)} className="g2-muted">No rows for these filters.</td></tr>}
                {rows.slice(0, 300).map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="g2-small" style={{ textAlign: typeof r[c] === 'number' ? 'right' : undefined, color: r[c] === 'ESTIMATED' ? '#b45309' : undefined, fontWeight: r[c] === 'ESTIMATED' ? 600 : undefined }}>{typeof r[c] === 'number' ? (r[c] as number).toLocaleString('en-IN') : String(r[c]).length > 19 && /^\d{4}-\d\d-\d\dT/.test(String(r[c])) ? String(r[c]).slice(0, 16).replace('T', ' ') : r[c]}</td>)}</tr>)}
              </tbody>
            </table></div>
            {rows.length > 300 && <div className="g2-small g2-muted" style={{ padding: 10 }}>Showing 300 of {rows.length} — export for all rows.</div>}
          </Card>
          <Card title="Scheduled emails" subtitle="Saved views sent as Excel (CSV) on a schedule" flush>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>View</th><th>When</th><th>To</th><th>Next</th><th>Last sent</th><th /></tr></thead>
              <tbody>
                {schedules().length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing scheduled — click the calendar next to a saved view.</td></tr>}
                {schedules().map((s) => { const v = myViews.find((x) => x.id === s.viewId); if (!v) return null; return (
                  <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                    <td>{v.name}</td><td className="g2-small">{s.frequency} · {s.time}</td><td className="g2-small">{s.recipients.join(', ')}</td>
                    <td className="g2-small">{s.active ? s.nextRun.slice(0, 16).replace('T', ' ') : 'paused'}</td><td className="g2-small">{s.sends[0] ? `${s.sends[0].at.slice(0, 16).replace('T', ' ')} · ${s.sends[0].rows} rows` : '—'}</td>
                    <td style={{ textAlign: 'right' }}><div className="g2-row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Button size="sm" icon={<Send size={13} />} onClick={() => { const data = viewRows(v); recordSend(s.id, data.length); exportNow(v.name, data); showToast(`“${v.name}” sent to ${s.recipients.join(', ')} (${data.length} rows) — demo: downloaded here.`, 'success'); }}>Send now</Button>
                      <Switch checked={s.active} onChange={() => toggleSchedule(s.id)} label="Active" />
                      <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => deleteSchedule(s.id)} />
                    </div></td>
                  </tr>
                ); })}
              </tbody>
            </table></div>
          </Card>
        </div>
      </div>
      {viewName !== null && (
        <Modal open variant="modal" title="Save view" subtitle={`${def?.name} with the current filters`} onClose={() => setViewName(null)}
          footer={<><Button onClick={() => setViewName(null)}>Cancel</Button><Button variant="primary" onClick={() => { const r = saveView({ name: viewName, report: rid, ...f, owner: currentUser.name, shared }); showToast(r.message, r.ok ? 'success' : 'warning'); if (r.ok) setViewName(null); }}>Save</Button></>}>
          <Field label="Name" required><Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. Credit holds this month" /></Field>
          <div className="g2-row" style={{ gap: 8, marginTop: 10 }}><Switch checked={shared} onChange={setShared} label="Shared" /><span className="g2-small">Share with everyone in the company (they see only what their scope allows)</span></div>
        </Modal>
      )}
      {sch && (
        <Modal open variant="modal" title={`Email “${sch.name}”`} subtitle="Sent as an Excel (CSV) attachment" onClose={() => setSch(null)}
          footer={<><Button onClick={() => setSch(null)}>Cancel</Button><Button variant="primary" onClick={() => { const r = addSchedule({ viewId: sch.id, ...sf, owner: currentUser.name }); showToast(r.message, r.ok ? 'success' : 'warning'); if (r.ok) setSch(null); }}>Schedule</Button></>}>
          <FormGrid cols={2}>
            <Field label="How often"><Select value={sf.frequency} options={(['Daily', 'Weekly (Monday)', 'Monthly (1st)'] as Frequency[]).map((x) => ({ value: x, label: x }))} onChange={(v) => setSf({ ...sf, frequency: v as Frequency })} /></Field>
            <Field label="Time"><Input type="time" value={sf.time} onChange={(e) => setSf({ ...sf, time: e.target.value })} /></Field>
          </FormGrid>
          <Field label="To (emails, comma separated)"><Input value={sf.recipients} onChange={(e) => setSf({ ...sf, recipients: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
};
export default ReportsPage;
