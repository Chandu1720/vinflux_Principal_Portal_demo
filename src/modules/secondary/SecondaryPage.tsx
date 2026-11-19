/**
 * Secondary sales & partner stock (NV1): coverage and freshness board, review queue (mapping, reconciliation,
 * serial checks), sell-through and days of cover, expiry risk in the channel, downstream customers.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, FileUp, Gauge, Network, Plus, Radar } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, Segmented, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import type { Partner } from '../gtm-v2/types';
import { balances, subscribeStock } from '../inventory/stockStore';
import type { LocType } from '../inventory/stockStore';
import {
  CUSTOMER_TYPES, FRESH_DAYS, ROUTE_LABEL, SCOPE_LABEL, SHARING_LABEL, accept, consentOf, ensurePlatformDemo, requestConsent, respondConsent, setOnPlatform, syncFromPlatform, withdrawConsent, coverage, downstream, ensureSecondaryDemo, getReport, itemMapOf, mapCode, partnerBoard, prevPeriod,
  reject, reports as allReports, saveSecSettings, saveSetup, secSettings, sellThrough, setupOf, submitReport, subscribeSecondary, thisPeriod,
} from './secondaryStore';
import type { Cadence, ConsentScopes, ConsentStatus, RawLine, ReportStatus, Route, Sharing } from './secondaryStore';

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const STATUS_TONE: Record<ReportStatus, BadgeTone> = { Accepted: 'green', 'Needs review': 'amber', Rejected: 'slate' };
const ROUTES = (Object.keys(ROUTE_LABEL) as Route[]).filter((r) => r !== 'vinflux');
const CONSENT_TONE: Record<ConsentStatus, BadgeTone> = { 'Not requested': 'slate', Requested: 'amber', Granted: 'green', Declined: 'red', Withdrawn: 'red', Expired: 'red' };
const scopeText = (x: ConsentScopes) => (Object.keys(x) as (keyof ConsentScopes)[]).filter((k) => x[k]).map((k) => SCOPE_LABEL[k]).join(', ') || 'nothing';
const locOf = (p: Partner): LocType => (p.partnerTypeId === 'pt-cnf' ? 'CNF' : p.institution ? 'HOSPITAL' : 'PARTNER');
const TEMPLATE = 'type,item_code,item_name,batch,serial,expiry,qty,customer,customer_type,town,invoice_no,date,value\nstock,EVO-TRAY-SZ3-10L,Tray size 3,B2611A,,2029-12-31,25,,,,,,\nsale,EVO-TRAY-SZ3-10L,Tray size 3,B2611A,,,4,Yashoda Hospitals,Hospital,Hyderabad,INV/101,2026-11-05,72000\n';

/** CSV → raw report lines (header names as in the template; order free). */
const parseCsv = (text: string): { lines: RawLine[]; errors: string[] } => {
  const rows = text.trim().split(/\r?\n/).map((r) => r.split(',').map((c) => c.trim()));
  if (rows.length < 2) return { lines: [], errors: ['Paste the header row and at least one line.'] };
  const h = rows[0].map((x) => x.toLowerCase().replace(/[^a-z_]/g, ''));
  const col = (r: string[], k: string) => { const i = h.indexOf(k); return i >= 0 ? r[i] ?? '' : ''; };
  const errors: string[] = []; const lines: RawLine[] = [];
  if (!h.includes('item_code') || !h.includes('qty')) errors.push('The header needs at least item_code and qty.');
  rows.slice(1).filter((r) => r.some(Boolean)).forEach((r, i) => {
    const kind = (col(r, 'type') || 'stock').toLowerCase().startsWith('s') && (col(r, 'type') || 'stock').toLowerCase() !== 'stock' ? 'sale' : 'stock';
    const qty = Number(col(r, 'qty'));
    if (!col(r, 'item_code')) errors.push(`Row ${i + 2}: item_code is empty.`);
    if (!(qty >= 0)) errors.push(`Row ${i + 2}: qty “${col(r, 'qty')}” is not a number.`);
    lines.push({ kind, code: col(r, 'item_code'), name: col(r, 'item_name'), batch: col(r, 'batch'), serial: col(r, 'serial'), expiry: col(r, 'expiry'), qty, customer: col(r, 'customer'), customerType: col(r, 'customer_type'), town: col(r, 'town'), invoiceNo: col(r, 'invoice_no'), date: col(r, 'date'), value: Number(col(r, 'value')) || 0 });
  });
  return { lines, errors };
};

/* --------------------------------- Record report --------------------------------- */

const BLANK = { qty: 0, customerType: 'Hospital', town: '' };

const RecordModal: React.FC<{ partners: Partner[]; onClose: () => void; onOpen: (id: string) => void; preset?: string }> = ({ partners, onClose, onOpen, preset }) => {
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const [pid, setPid] = useState(preset ?? '');
  const setup = pid ? setupOf(pid) : null;
  const [period, setPeriod] = useState(thisPeriod());
  const [mode, setMode] = useState('count');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sales, setSales] = useState<Record<string, { qty: number; customerType: string; town: string }>>({});
  const [csv, setCsv] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  const prods = products.filter((p) => p.lifecycleStatus === 'Active').slice(0, 12);
  const save = () => {
    const p = partners.find((x) => x.id === pid);
    let lines: RawLine[];
    if (mode === 'file') { const r = parseCsv(csv); if (r.errors.length) { setErrs(r.errors); return; } lines = r.lines; }
    else lines = [
      ...prods.filter((x) => counts[x.id] !== undefined).map((x) => ({ kind: 'stock' as const, code: x.code, qty: counts[x.id] })),
      ...prods.filter((x) => (sales[x.id]?.qty ?? 0) > 0).map((x) => ({ kind: 'sale' as const, code: x.code, qty: sales[x.id].qty, customer: `${sales[x.id].customerType} customers`, customerType: sales[x.id].customerType, town: sales[x.id].town })),
    ];
    const r = submitReport({ principalId: activePrincipal.id, partnerId: pid, partnerName: p?.name ?? '', locType: p ? locOf(p) : 'PARTNER', period, route: mode === 'file' ? 'file' : setup?.route === 'none' ? 'desk' : setup?.route ?? 'desk', system: mode === 'file' ? 'CSV' : '', lines }, products, currentUser.name);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, r.message.includes('needs review') ? 'warning' : 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="xl" title="Record a partner report" subtitle="Closing stock and sales for a month — typed in (as on Partner Lite) or from the partner’s file" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!pid} onClick={save}>Submit report</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t take this report" />}
        <FormGrid cols={3}>
          <Field label="Partner" required><SearchableSelect value={pid} options={partners.map((p) => ({ value: p.id, label: p.name, description: `${p.code} · ${ROUTE_LABEL[setupOf(p.id).route]}` }))} onChange={(v) => setPid(v ?? '')} /></Field>
          <Field label="Month" required><Input type="month" value={period} max={thisPeriod()} onChange={(e) => setPeriod(e.target.value)} /></Field>
          <Field label="How"><Segmented options={[{ id: 'count', label: 'Type counts' }, { id: 'file', label: 'File / paste' }]} value={mode} onChange={setMode} /></Field>
        </FormGrid>
        {mode === 'count' ? (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ width: 140 }}>Closing stock</th><th style={{ width: 120 }}>Sold</th><th style={{ width: 160 }}>Sold to (type)</th><th style={{ width: 160 }}>Town</th></tr></thead>
            <tbody>{prods.map((x) => (
              <tr key={x.id}>
                <td>{x.name}<div className="g2-cell-sub g2-mono">{x.code}</div></td>
                <td><NumberInput value={counts[x.id] ?? null} onChange={(v) => setCounts((c) => { const n = { ...c }; if (v === null) delete n[x.id]; else n[x.id] = v; return n; })} /></td>
                <td><NumberInput value={sales[x.id]?.qty ?? null} onChange={(v) => setSales((s) => ({ ...s, [x.id]: { ...(s[x.id] ?? BLANK), qty: v ?? 0 } }))} /></td>
                <td><Select value={sales[x.id]?.customerType ?? 'Hospital'} options={CUSTOMER_TYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => setSales((s) => ({ ...s, [x.id]: { ...(s[x.id] ?? BLANK), customerType: v } }))} /></td>
                <td><Input value={sales[x.id]?.town ?? ''} onChange={(e) => setSales((s) => ({ ...s, [x.id]: { ...(s[x.id] ?? BLANK), town: e.target.value } }))} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : (
          <div className="g2-stack">
            <div className="g2-row" style={{ gap: 8 }}>
              <a className="g2-btn g2-btn-secondary g2-btn-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="partner-report-template.csv"><Download size={13} /> Template</a>
              <label className="g2-btn g2-btn-secondary g2-btn-sm" style={{ cursor: 'pointer' }}><FileUp size={13} /> Choose CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setCsv); }} /></label>
              <span className="g2-small g2-muted">The partner’s own item codes are fine — unknown codes are mapped once and remembered.</span>
            </div>
            <Textarea rows={9} value={csv} placeholder={TEMPLATE} onChange={(e) => setCsv(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ---------------------------------- Report view ---------------------------------- */

const ReportModal: React.FC<{ id: string; onClose: () => void; pName: (id: string) => string; canEdit: boolean }> = ({ id, onClose, pName, canEdit }) => {
  useSubscribe(subscribeSecondary);
  const { products, currentUser, showToast } = useApp();
  const r = getReport(id);
  const [why, setWhy] = useState<string | null>(null);
  if (!r) return null;
  const tell = (x: { ok: boolean; message: string }) => showToast(x.message, x.ok ? 'success' : 'warning');
  const prod = (pid: string) => products.find((p) => p.id === pid);
  const review = r.status === 'Needs review';
  return (
    <Modal open size="xl" title={<span className="g2-row" style={{ gap: 8 }}>{r.no} · {r.partnerName} · {r.period} <Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge></span>}
      subtitle={`${ROUTE_LABEL[r.route]}${r.system ? ` (${r.system})` : ''} · received ${r.submittedAt.slice(0, 16).replace('T', ' ')} · ${r.stock.length} stock line(s), ${r.sales.length} sale line(s)`} onClose={onClose}
      footer={review && canEdit ? <><Button variant="danger" onClick={() => setWhy('')}>Reject — ask to resend</Button><Button variant="primary" icon={<CheckCircle2 size={15} />} disabled={r.unmapped.length > 0} onClick={() => tell(accept(r.id, currentUser.name))}>{r.flags.length ? 'Accept anyway' : 'Accept'}</Button></> : undefined}>
      <div className="g2-stack">
        {r.flags.length > 0 && <Alert tone={review ? 'warn' : 'info'}><div className="g2-stack" style={{ gap: 4 }}>{r.flags.map((f, i) => <div key={i}>{f.replace(/for (\S+):/, (_m, pid: string) => `for ${prod(pid)?.name ?? pid}:`)}</div>)}</div></Alert>}
        {r.unmapped.length > 0 && (
          <Card title="Map partner item codes (once)" subtitle="Remembered for this partner; future reports map automatically (SEC-01)">
            <div className="g2-stack" style={{ gap: 8 }}>
              {Array.from(new Set(r.unmapped.map((u) => u.code))).map((code) => {
                const u = r.unmapped.find((x) => x.code === code)!;
                return (
                  <div key={code} className="g2-row" style={{ gap: 8 }}>
                    <span className="g2-mono" style={{ width: 140 }}>{code}</span><span className="g2-small g2-muted" style={{ width: 200 }}>{u.name || '—'}</span>
                    {(() => { const sug = products.find((p) => u.name && p.name.toLowerCase() === u.name.toLowerCase()); return sug && canEdit ? <Button size="sm" variant="soft" onClick={() => { mapCode(r.partnerId, code, sug.id, currentUser.name); showToast(`${code} mapped to ${sug.name}.`, 'success'); }}>Map to {sug.code}</Button> : null; })()}
                    <div style={{ flex: 1 }}><SearchableSelect value={null} placeholder="This is our product…" disabled={!canEdit} options={products.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => { if (v) { mapCode(r.partnerId, code, v, currentUser.name); showToast(`${code} mapped to ${prod(v)?.name}.`, 'success'); } }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        {r.scopes && (!r.scopes.stock || !r.scopes.sales) && <Alert tone="info">The distributor shares only {r.scopes.stock ? 'stock' : 'sales'} (consent), so this feed can’t be reconciled.</Alert>}
        <Card title="Reconciliation" subtitle="Opening + received from us (VinFlux deliveries) − sold = expected closing (SEC-02)" flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Opening</th><th style={{ textAlign: 'right' }}>Received</th><th style={{ textAlign: 'right' }}>Sold</th><th style={{ textAlign: 'right' }}>Expected</th><th style={{ textAlign: 'right' }}>Reported</th><th>Result</th></tr></thead>
            <tbody>{r.recon.map((x) => (
              <tr key={x.productId}>
                <td>{prod(x.productId)?.name ?? x.productId}</td>
                <td style={{ textAlign: 'right' }}>{x.opening}</td><td style={{ textAlign: 'right' }}>{x.receipts}</td><td style={{ textAlign: 'right' }}>{x.sales}</td><td style={{ textAlign: 'right' }}>{x.expected}</td><td style={{ textAlign: 'right' }}>{x.reported}</td>
                <td>{x.ok ? <Badge tone="green">Reconciles</Badge> : <Badge tone="red">{x.diff > 0 ? '+' : ''}{x.diff} ({x.diffPct}%)</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
        {r.sales.length > 0 && (
          <Card title="Sales lines" flush>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Date</th><th>Customer</th><th>Product · batch</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Invoice</th></tr></thead>
              <tbody>{r.sales.map((s, i) => (
                <tr key={i}><td className="g2-small">{s.date}</td><td>{setupOf(r.partnerId).sharing === 'full' ? s.customer : `${s.customerType} in ${s.town || '—'}`}<div className="g2-cell-sub">{s.customerType} · {s.town}</div></td><td className="g2-small">{prod(s.productId)?.name}<div className="g2-cell-sub g2-mono">{s.batch}{s.serial ? ` · ${s.serial}` : ''}</div></td><td style={{ textAlign: 'right' }}>{s.qty}</td><td style={{ textAlign: 'right' }}>{inr(s.value)}</td><td className="g2-small g2-mono">{s.invoiceNo}</td></tr>
              ))}</tbody>
            </table></div>
          </Card>
        )}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{r.history.map((h, i) => <div key={i} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? ` (${h.note})` : ''}</div>)}</div></Card>
        <div className="g2-small g2-muted">Partner: {pName(r.partnerId)} · sharing: {SHARING_LABEL[setupOf(r.partnerId).sharing]}</div>
      </div>
      {why !== null && (
        <Modal open variant="modal" title="Reject and ask to resend" onClose={() => setWhy(null)} footer={<><Button onClick={() => setWhy(null)}>Cancel</Button><Button variant="danger" onClick={() => { const x = reject(r.id, why, currentUser.name); tell(x); if (x.ok) setWhy(null); }}>Reject</Button></>}>
          <Field label="Reason (the partner sees this)" required><Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
        </Modal>
      )}
    </Modal>
  );
};

/* ----------------------------------- Partner setup ----------------------------------- */

const SetupModal: React.FC<{ partner: Partner; onClose: () => void; onRecord: () => void; onOpen: (id: string) => void; canEdit: boolean }> = ({ partner, onClose, onRecord, onOpen, canEdit }) => {
  useSubscribe(subscribeSecondary);
  const { activePrincipal, showToast } = useApp();
  const { products, currentUser } = useApp();
  const s = setupOf(partner.id);
  const set = (p: Partial<typeof s>) => { saveSetup({ ...s, ...p }); showToast('Saved.', 'success'); };
  const c = consentOf(partner.id);
  const [ask, setAsk] = useState<ConsentScopes>({ stock: true, sales: true, cases: false });
  const [demo, setDemo] = useState<{ scopes: ConsentScopes; identity: Sharing; until: string } | null>(null);
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  const me = { id: partner.id, name: partner.name, locType: locOf(partner) };
  const rs = allReports(activePrincipal.id).filter((r) => r.partnerId === partner.id).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const mapped = Object.entries(itemMapOf(partner.id));
  return (
    <Modal open size="lg" title={partner.name} subtitle={`${partner.code} · how this partner’s stock and sales reach you`} onClose={onClose} footer={canEdit && !s.onPlatform ? <Button variant="primary" icon={<Plus size={15} />} onClick={onRecord}>Record report</Button> : undefined}>
      <div className="g2-stack">
        <Card title="VinFlux distributor platform" subtitle="If this distributor runs its business on VinFlux, its stock and sales can flow live — only with its consent">
          <div className="g2-row" style={{ gap: 8 }}><input type="checkbox" checked={!!s.onPlatform} disabled={!canEdit} onChange={(e) => { setOnPlatform(partner.id, e.target.checked); showToast(e.target.checked ? `${partner.name} marked as on the VinFlux platform.` : 'Back to reports.', 'success'); }} /> <span>{partner.name} uses the VinFlux distributor platform</span></div>
          {s.onPlatform && (
            <div className="g2-stack" style={{ marginTop: 12 }}>
              <div className="g2-row" style={{ gap: 8 }}><strong>Consent</strong><Badge tone={CONSENT_TONE[c.status]} dot>{c.status}</Badge>{c.lastSyncAt && <span className="g2-small g2-muted">last pulled {c.lastSyncAt.slice(0, 16).replace('T', ' ')}</span>}</div>
              {c.status === 'Granted' && <div className="g2-small">Shares: <strong>{scopeText(c.granted)}</strong> · customers: {SHARING_LABEL[c.identity]}{c.validUntil ? ` · until ${c.validUntil}` : ''}</div>}
              {c.status === 'Requested' && <div className="g2-small">Asked for: {scopeText(c.requested)} — waiting for the distributor to approve in their VinFlux account.</div>}
              {['Declined', 'Withdrawn', 'Expired'].includes(c.status) && <Alert tone="warn">No data flows from {partner.name}. {c.status === 'Withdrawn' ? 'Data received before withdrawal stays for audit.' : 'You can ask again.'}</Alert>}
              {c.status !== 'Requested' && c.status !== 'Granted' && canEdit && (
                <div className="g2-row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  {(Object.keys(SCOPE_LABEL) as (keyof ConsentScopes)[]).map((k) => <label key={k} className="g2-row" style={{ gap: 4 }}><input type="checkbox" checked={ask[k]} onChange={(e) => setAsk({ ...ask, [k]: e.target.checked })} /> {SCOPE_LABEL[k]}</label>)}
                  <Button size="sm" variant="primary" onClick={() => tell(requestConsent(partner.id, ask, currentUser.name))}>Request consent</Button>
                </div>
              )}
              {c.status === 'Granted' && canEdit && <div><Button size="sm" onClick={() => tell(syncFromPlatform(activePrincipal.id, me, products, currentUser.name))}>Pull now</Button></div>}
              <div className="g2-card" style={{ padding: 10, background: '#fafaf9', boxShadow: 'none' }}>
                <div className="g2-small g2-muted" style={{ marginBottom: 6 }}>Demo only — what the distributor does in its own VinFlux account:</div>
                <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {c.status === 'Requested' && <><Button size="sm" variant="success" onClick={() => setDemo({ scopes: c.requested, identity: 'masked', until: '' })}>Grant…</Button><Button size="sm" variant="danger" onClick={() => tell(respondConsent(partner.id, false, `${partner.name} (owner)`))}>Decline</Button></>}
                  {c.status === 'Granted' && <Button size="sm" variant="danger" onClick={() => tell(withdrawConsent(partner.id, `${partner.name} (owner)`))}>Withdraw consent</Button>}
                  {!['Requested', 'Granted'].includes(c.status) && <span className="g2-small g2-muted">Nothing to answer.</span>}
                </div>
              </div>
            </div>
          )}
        </Card>
        {demo && (
          <Modal open variant="modal" title={`${partner.name} grants access`} subtitle="The distributor can share less than you asked" onClose={() => setDemo(null)}
            footer={<><Button onClick={() => setDemo(null)}>Cancel</Button><Button variant="success" onClick={() => { tell(respondConsent(partner.id, true, `${partner.name} (owner)`, demo.scopes, demo.identity, demo.until || null)); setDemo(null); if (demo.scopes.stock || demo.scopes.sales) tell(syncFromPlatform(activePrincipal.id, me, products, 'VinFlux platform')); }}>Grant</Button></>}>
            <div className="g2-stack">
              {(Object.keys(SCOPE_LABEL) as (keyof ConsentScopes)[]).filter((k) => c.requested[k]).map((k) => <label key={k} className="g2-row" style={{ gap: 6 }}><input type="checkbox" checked={demo.scopes[k]} onChange={(e) => setDemo({ ...demo, scopes: { ...demo.scopes, [k]: e.target.checked } })} /> {SCOPE_LABEL[k]}</label>)}
              <Field label="Customer identity"><Select value={demo.identity} options={(Object.keys(SHARING_LABEL) as Sharing[]).map((x) => ({ value: x, label: SHARING_LABEL[x] }))} onChange={(v) => setDemo({ ...demo, identity: v as Sharing })} /></Field>
              <Field label="Valid until (optional)"><Input type="date" value={demo.until} onChange={(e) => setDemo({ ...demo, until: e.target.value })} /></Field>
            </div>
          </Modal>
        )}
        {!s.onPlatform && <Card title="Route and sharing">
          <FormGrid>
            <Field label="Route"><Select value={s.route} disabled={!canEdit} options={ROUTES.map((r) => ({ value: r, label: ROUTE_LABEL[r] }))} onChange={(v) => set({ route: v as Route })} /></Field>
            {s.route === 'connector' && <Field label="Partner’s system"><Select value={s.system} disabled={!canEdit} options={['Tally (agent)', 'Marg', 'Busy', 'Zoho Books', 'SAP Business One', 'Other'].map((x) => ({ value: x, label: x }))} onChange={(v) => set({ system: v })} /></Field>}
            <Field label="Expected every" hint={`Data older than ${FRESH_DAYS[s.cadence]} days counts as stale (SEC-03)`}><Select value={s.cadence} disabled={!canEdit} options={[{ value: 'nightly', label: 'Night (connector)' }, { value: 'weekly', label: 'Week' }, { value: 'monthly', label: 'Month' }]} onChange={(v) => set({ cadence: v as Cadence })} /></Field>
            <Field label="Customer identity shared" hint="Set by the partner’s sharing agreement (SEC-04)"><Select value={s.sharing} disabled={!canEdit} options={(Object.keys(SHARING_LABEL) as Sharing[]).map((x) => ({ value: x, label: SHARING_LABEL[x] }))} onChange={(v) => set({ sharing: v as Sharing })} /></Field>
          </FormGrid>
          {s.route === 'none' && <div style={{ marginTop: 8 }}><Alert tone="info">Not connected: figures are estimated from our deliveries and a {secSettings().estimateSellOutPct}% monthly sell-out, labelled “Estimated” and never used for claims (SEC-06).</Alert></div>}
        </Card>}
        <Card title="Reports" flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Report</th><th>Month</th><th>Route</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>
              {rs.length === 0 && <tr><td colSpan={5} className="g2-muted">No reports yet.</td></tr>}
              {rs.map((r) => <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(r.id)}><td className="g2-mono">{r.no}</td><td>{r.period}</td><td className="g2-small">{ROUTE_LABEL[r.route]}</td><td className="g2-small">{r.submittedAt.slice(0, 10)}</td><td><Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge></td></tr>)}
            </tbody>
          </table></div>
        </Card>
        {mapped.length > 0 && <Card title="Item code mapping"><div className="g2-small">{mapped.map(([k, v]) => <div key={k}><span className="g2-mono">{k.toUpperCase()}</span> → {v}</div>)}</div></Card>}
      </div>
    </Modal>
  );
};

/* -------------------------------------- Page -------------------------------------- */

const SecondaryPage: React.FC = () => {
  useSubscribe(subscribeSecondary, subscribeStock);
  const { activePrincipal, currentUser, products } = useApp();
  const partnersAll = usePartners().data ?? [];
  const partners = useMemo(() => partnersAll.filter((p) => !p.institution && p.status === 'Active'), [partnersAll]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'board';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [period, setPeriod] = useState(thisPeriod());
  const [openRep, setOpenRep] = useState<string | null>(null);
  const [openP, setOpenP] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ preset?: string } | null>(null);
  const [days, setDays] = useState('90');
  const m = currentUser.matrix;
  const canEdit = !m || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  useEffect(() => {
    if (!partners.length || !products.length) return;
    const ps = partners.map((p) => ({ id: p.id, name: p.name, locType: locOf(p) }));
    const act = products.filter((p) => p.lifecycleStatus === 'Active');
    ensureSecondaryDemo(activePrincipal.id, ps, act, 'System');
    ensurePlatformDemo(activePrincipal.id, ps, act);
    // Live feed: pull from every distributor on the platform that has granted consent (a server job in production).
    ps.filter((p) => setupOf(p.id).onPlatform && consentOf(p.id).status === 'Granted').forEach((p) => syncFromPlatform(activePrincipal.id, p, act, 'VinFlux platform'));
  }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unitValue = (pid: string) => { const p = products.find((x) => x.id === pid); return p?.pricingReference?.standardCost ?? (p?.pricingReference?.mrp ?? 0) * 0.6; };
  const pName = (id: string) => partnersAll.find((p) => p.id === id)?.name ?? id;
  const prName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const board = partnerBoard(activePrincipal.id, partners.map((p) => p.id), unitValue);
  const cov = coverage(board);
  const reps = allReports(activePrincipal.id);
  const queue = reps.filter((r) => r.status === 'Needs review');
  const through = sellThrough(activePrincipal.id, partners.map((p) => p.id), period);
  const lim = new Date(Date.now() + Number(days) * 86400000).toISOString().slice(0, 10);
  const expiring = balances().filter((b) => b.locType !== 'COMPANY' && b.locType !== 'TRANSIT' && b.qty > 0 && b.expiryDate && b.expiryDate <= lim && partners.some((p) => p.id === b.warehouseId)).sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1));
  const cust = downstream(activePrincipal.id, pName);
  const stale = board.filter((r) => !r.fresh && !r.estimated);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Secondary Sales & Partner Stock" description="What every partner holds and sells of your products — by whatever route each partner can send it, checked against what you delivered."
        actions={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setRecording({})}>Record report</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Coverage" value={`${cov.pct}%`} icon={<Radar size={22} />} color="#059669" bg="#ecfdf5" foot={`${inr(cov.fresh)} of ${inr(cov.total)} channel stock reported and fresh`} onClick={() => setTab('board')} />
        <KpiCard label="Stale or missing" value={stale.length} icon={<AlertTriangle size={22} />} color="#d97706" bg="#fffbeb" foot={`${board.filter((r) => r.estimated).length} not connected (estimated)`} onClick={() => setTab('board')} />
        <KpiCard label="Reports to review" value={queue.length} icon={<Gauge size={22} />} color="#dc2626" bg="#fef2f2" foot="mapping, reconciliation or serial issues" onClick={() => setTab('review')} />
        <KpiCard label="Downstream customers" value={cust.length} icon={<Network size={22} />} color="#6d28d9" bg="#f5f3ff" foot={inr(cust.reduce((a, c) => a + c.value, 0)) + ' secondary sales'} onClick={() => setTab('customers')} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'board', label: 'Coverage & freshness', count: partners.length },
            { id: 'review', label: 'Review queue', count: queue.length || undefined },
            { id: 'through', label: 'Sell-through & cover' },
            { id: 'expiry', label: 'Expiry in the channel', count: expiring.length || undefined },
            { id: 'customers', label: 'Downstream customers', count: cust.length || undefined },
            { id: 'reports', label: 'All reports', count: reps.length },
            { id: 'settings', label: 'Settings' },
          ]} />
          <span className="g2-spacer" />
          {tab === 'through' && <div style={{ width: 170 }}><Input type="month" value={period} max={thisPeriod()} onChange={(e) => setPeriod(e.target.value)} /></div>}
          {tab === 'through' && <Button size="sm" onClick={() => setPeriod(prevPeriod(period))}>Previous month</Button>}
          {tab === 'expiry' && <Segmented options={[{ id: '90', label: '≤ 90 days' }, { id: '180', label: '≤ 180 days' }]} value={days} onChange={setDays} />}
        </div>

        {tab === 'board' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Partner</th><th>Route</th><th>Last data</th><th style={{ textAlign: 'right' }}>Stock held</th><th>Last report</th><th /></tr></thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.partnerId} style={{ cursor: 'pointer' }} onClick={() => setOpenP(r.partnerId)}>
                  <td className="g2-strong">{pName(r.partnerId)}<div className="g2-cell-sub">{SHARING_LABEL[r.setup.sharing]}</div></td>
                  <td className="g2-small">{r.setup.onPlatform ? <>{ROUTE_LABEL.vinflux}<div className="g2-cell-sub"><Badge tone={CONSENT_TONE[consentOf(r.partnerId).status]}>Consent: {consentOf(r.partnerId).status}</Badge></div></> : <>{ROUTE_LABEL[r.setup.route]}{r.setup.system ? ` · ${r.setup.system}` : ''}<div className="g2-cell-sub">every {r.setup.cadence === 'nightly' ? 'night' : r.setup.cadence === 'weekly' ? 'week' : 'month'}</div></>}</td>
                  <td>{r.setup.onPlatform && consentOf(r.partnerId).status !== 'Granted' ? <Badge tone="slate">No data without consent</Badge> : r.setup.onPlatform && r.last ? <><Badge tone={r.fresh ? 'green' : 'red'} dot>{r.fresh ? 'Live' : 'Stale'}</Badge> <span className="g2-small">synced {r.age === 0 ? 'today' : `${r.age}d ago`}</span></> : r.estimated ? <Badge tone="slate">Estimated</Badge> : r.last ? <><Badge tone={r.fresh ? 'green' : 'red'} dot>{r.fresh ? 'Fresh' : 'Stale'}</Badge> <span className="g2-small">{r.last.period} · {r.age}d ago</span></> : <Badge tone="red">No data</Badge>}</td>
                  <td style={{ textAlign: 'right' }}>{r.stockUnits} units<div className="g2-cell-sub">{inr(r.stockValue)}{r.estimated ? ' (est.)' : ''}</div></td>
                  <td>{r.reconOk === null ? '—' : r.reconOk ? <Badge tone="green">Reconciles</Badge> : <Badge tone="red">Mismatch</Badge>}{r.pending > 0 && <> <Badge tone="amber">{r.pending} to review</Badge></>}</td>
                  <td className="g2-small">{r.setup.onPlatform ? <span className="g2-muted">automatic</span> : <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRecording({ preset: r.partnerId }); }}>Record</a>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {tab === 'review' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Report</th><th>Partner · month</th><th>Route</th><th>Issues</th></tr></thead>
            <tbody>
              {queue.length === 0 && <tr><td colSpan={4} className="g2-muted">Nothing to review — every report reconciled.</td></tr>}
              {queue.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenRep(r.id)}>
                  <td className="g2-mono">{r.no}</td><td>{r.partnerName}<div className="g2-cell-sub">{r.period}</div></td><td className="g2-small">{ROUTE_LABEL[r.route]}{r.system ? ` · ${r.system}` : ''}</td>
                  <td className="g2-small">{r.flags.map((f, i) => <div key={i}>{f.replace(/for (\S+):/, (_m, pid: string) => `for ${prName(pid)}:`)}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {tab === 'through' && (<>
          <div className="g2-small g2-muted" style={{ padding: '10px 16px 0' }}>From accepted reports. Days of cover = closing stock ÷ average daily sales this month. Estimated rows (not-connected partners) are never used for claims.</div>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Partner</th><th>Product</th><th style={{ textAlign: 'right' }}>Opening</th><th style={{ textAlign: 'right' }}>Received</th><th style={{ textAlign: 'right' }}>Sold</th><th style={{ textAlign: 'right' }}>Closing</th><th style={{ textAlign: 'right' }}>Sell-through</th><th style={{ textAlign: 'right' }}>Days of cover</th><th /></tr></thead>
            <tbody>
              {through.length === 0 && <tr><td colSpan={9} className="g2-muted">No accepted reports for {period}.</td></tr>}
              {through.map((x) => (
                <tr key={`${x.partnerId}|${x.productId}`}>
                  <td>{pName(x.partnerId)}{x.estimated && <> <Badge tone="slate">Estimated</Badge></>}</td><td className="g2-small">{prName(x.productId)}</td>
                  <td style={{ textAlign: 'right' }}>{x.opening}</td><td style={{ textAlign: 'right' }}>{x.received}</td><td style={{ textAlign: 'right' }}>{x.sold}</td><td style={{ textAlign: 'right' }}>{x.closing}</td>
                  <td style={{ textAlign: 'right' }}>{x.sellThrough === null ? '—' : `${x.sellThrough}%`}</td><td style={{ textAlign: 'right' }}>{x.cover === null ? (x.sold === 0 && !x.estimated ? '∞' : '—') : x.cover}</td>
                  <td>{x.flag && <Badge tone={x.flag.startsWith('Buying') ? 'red' : 'amber'}>{x.flag}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>)}

        {tab === 'expiry' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Partner</th><th>Product · batch</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Suggested action</th></tr></thead>
            <tbody>
              {expiring.length === 0 && <tr><td colSpan={6} className="g2-muted">No partner stock expires within {days} days.</td></tr>}
              {expiring.map((b) => {
                const d = Math.round((Date.parse(b.expiryDate!) - Date.now()) / 86400000);
                return <tr key={b.key}><td>{pName(b.warehouseId)}</td><td className="g2-small">{prName(b.productId)}<div className="g2-cell-sub g2-mono">{b.batch}</div></td><td>{b.expiryDate} <Badge tone={d < 0 ? 'red' : d <= 60 ? 'amber' : 'slate'}>{d < 0 ? 'expired' : `${d}d`}</Badge></td><td style={{ textAlign: 'right' }}>{b.qty}</td><td style={{ textAlign: 'right' }}>{inr(b.qty * unitValue(b.productId))}</td><td className="g2-small">{d < 0 ? 'Return and write off' : d <= 60 ? 'Move to a faster-selling partner or run a liquidation scheme' : 'Push with the partner’s sales team'}</td></tr>;
              })}
            </tbody>
          </table></div>
        )}

        {tab === 'customers' && (<>
          <div className="g2-small g2-muted" style={{ padding: '10px 16px 0' }}>Who buys your products from your partners. Names follow each partner’s sharing choice: full, masked (type + town) or totals only (SEC-04).</div>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Customer</th><th>Type</th><th>Town</th><th>Buys through</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Last bought</th></tr></thead>
            <tbody>
              {cust.length === 0 && <tr><td colSpan={7} className="g2-muted">No secondary sales reported yet.</td></tr>}
              {cust.map((c) => <tr key={c.key}><td className="g2-strong">{c.name}{c.masked && <> <Badge tone="slate">masked</Badge></>}</td><td>{c.type}</td><td>{c.town || '—'}</td><td className="g2-small">{c.partners.join(', ')}</td><td style={{ textAlign: 'right' }}>{c.qty}</td><td style={{ textAlign: 'right' }}>{inr(c.value)}</td><td className="g2-small">{c.lastDate}</td></tr>)}
            </tbody>
          </table></div>
        </>)}

        {tab === 'reports' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Report</th><th>Partner</th><th>Month</th><th>Route</th><th>Received</th><th style={{ textAlign: 'right' }}>Lines</th><th>Status</th></tr></thead>
            <tbody>{reps.map((r) => <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenRep(r.id)}><td className="g2-mono">{r.no}</td><td>{r.partnerName}</td><td>{r.period}</td><td className="g2-small">{ROUTE_LABEL[r.route]}{r.system ? ` · ${r.system}` : ''}</td><td className="g2-small">{r.submittedAt.slice(0, 16).replace('T', ' ')}</td><td style={{ textAlign: 'right' }}>{r.stock.length + r.sales.length + r.unmapped.length}</td><td><Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge></td></tr>)}</tbody>
          </table></div>
        )}

        {tab === 'settings' && (
          <div style={{ padding: 16 }}>
            <FormGrid>
              <Field label="Reconciliation tolerance (%)" hint="Differences up to this are accepted automatically (SEC-02)"><NumberInput value={secSettings().tolerancePct} disabled={!canEdit} onChange={(v) => saveSecSettings({ ...secSettings(), tolerancePct: Math.max(0, v ?? 0) })} /></Field>
              <Field label="Assumed monthly sell-out for estimates (%)" hint="Used only for partners not connected; always labelled Estimated (SEC-06)"><NumberInput value={secSettings().estimateSellOutPct} disabled={!canEdit} onChange={(v) => saveSecSettings({ ...secSettings(), estimateSellOutPct: Math.max(0, Math.min(100, v ?? 0)) })} /></Field>
            </FormGrid>
          </div>
        )}
      </Card>
      {recording && <RecordModal partners={partners} preset={recording.preset} onClose={() => setRecording(null)} onOpen={setOpenRep} />}
      {openRep && <ReportModal id={openRep} pName={pName} canEdit={canEdit} onClose={() => setOpenRep(null)} />}
      {openP && <SetupModal partner={partners.find((p) => p.id === openP)!} canEdit={canEdit} onClose={() => setOpenP(null)} onRecord={() => { setRecording({ preset: openP }); setOpenP(null); }} onOpen={(id) => { setOpenP(null); setOpenRep(id); }} />}
    </div>
  );
};
export default SecondaryPage;
