/**
 * Data Sources (PL3 §6.7): one screen that says where every piece of data comes from — a VinFlux screen, the ERP or
 * another connected system, a file, or not used — with its timing, freshness and last run. Each row opens the place
 * where it is configured. Changing a source is for administrators / integration admins and is recorded.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Database, PlugZap, RefreshCw, Timer } from 'lucide-react';
import { Badge, Card, KpiCard, PageHeader, Select } from '../ui';
import type { BadgeTone } from '../../modules/gtm-v2/types';
import { usePlatform } from '../PlatformContext';
import { useSubscribe } from '../useStore';
import { emit } from '../events';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../../modules/gtm-v2/hooks/useGtmData';
import { INPUTS, orderSettings, patchOrderSettings, subscribeOrderSettings } from '../../modules/orders/orderSettings';
import type { InputId, SourceKind } from '../../modules/orders/orderSettings';
import { sourceSettings, subscribeSource } from '../../modules/inventory/stockSource';
import { CONNECTORS, connectorSettings, subscribeConnectors, syncRuns } from '../integrations/connectors';
import { optChoice } from '../moduleOptions';
import { coverage, partnerBoard, subscribeSecondary } from '../../modules/secondary/secondaryStore';
import { prodSettings, receipts as prodReceipts } from '../../modules/production/productionStore';

const KIND: Record<SourceKind, { label: string; tone: BadgeTone }> = { vinflux: { label: 'VinFlux', tone: 'purple' }, connected: { label: 'Connected system', tone: 'blue' }, file: { label: 'File', tone: 'amber' }, none: { label: 'Not used', tone: 'slate' } };
const ago = (iso: string | null | undefined) => { if (!iso) return 'never'; const h = Math.floor((Date.now() - Date.parse(iso)) / 3600000); return h < 1 ? 'under 1 h' : h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`; };
const WHERE: Partial<Record<InputId, string>> = { products: '/products', partners: '/gtm-v2/partners', policies: '/gtm-v2/sales-flow-topology', prices: '/pricing', schemes: '/pricing', credit: '/collections', stock: '/inventory?tab=settings', warehouses: '/warehouses', invoice: '/invoices?tab=settings', tracking: '/logistics' };

const DataSourcesPage: React.FC = () => {
  useSubscribe(subscribeOrderSettings, subscribeSource, subscribeConnectors, subscribeSecondary);
  const { enabled } = usePlatform();
  const { activePrincipal, currentUser, products } = useApp();
  const navigate = useNavigate();
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const admin = !currentUser.matrix || (currentUser.role ?? '').includes('Administrator');
  const os = orderSettings(); const ss = sourceSettings();
  const stockConn = ss.connectorId ? CONNECTORS.find((c) => c.id === ss.connectorId) : null;
  const stockSync = ss.connectorId ? connectorSettings(ss.connectorId).lastSyncAt : null;
  const vfInvoice = enabled('invoicing') && optChoice('orders', 'invoicing') === 'vinflux';
  const runs = syncRuns();
  const unit = (id: string) => products.find((p) => p.id === id)?.pricingReference?.standardCost ?? 0;
  const board = enabled('secondary') ? partnerBoard(activePrincipal.id, partners.map((p) => p.id), unit) : [];
  const cov = coverage(board);
  const routes = board.reduce((a, r) => { a[r.setup.route] = (a[r.setup.route] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const pr = prodReceipts(activePrincipal.id)[0];
  const set = (id: InputId, v: SourceKind) => { patchOrderSettings({ sources: { ...os.sources, [id]: v } }); emit('module.enabled', 'Data Sources', currentUser.name, `Source of ${INPUTS.find((x) => x.id === id)?.label} set to ${KIND[v].label}`, { principalId: activePrincipal.id }); };

  type Row = { object: string; source: React.ReactNode; detail: string; direction: string; timing: string; fresh: string; where: string };
  const extra: Row[] = [
    { object: 'Sales orders (from partners)', source: <Badge tone="purple">Any channel</Badge>, detail: Object.entries(os.channels).filter(([, on]) => on).map(([k]) => k).join(', '), direction: 'Inbound', timing: 'As received', fresh: '—', where: '/orders?tab=settings' },
    ...(enabled('procurement') ? [{ object: 'Purchase orders & receipts', source: <Badge tone={optChoice('procurement', 'owner') === 'erp' ? 'blue' : 'purple'}>{optChoice('procurement', 'owner') === 'erp' ? 'ERP' : optChoice('procurement', 'owner') === 'hybrid' ? 'Mixed' : 'VinFlux'}</Badge>, detail: optChoice('procurement', 'owner') === 'hybrid' ? 'POs in the ERP; receipt and QC in VinFlux' : optChoice('procurement', 'owner') === 'erp' ? 'Shown as incoming supply' : 'Raised, approved and received here', direction: optChoice('procurement', 'owner') === 'vinflux' ? '—' : 'Inbound', timing: 'On demand', fresh: '—', where: '/procurement' }] : []),
    ...(enabled('imports') ? [{ object: 'Import shipments & duty', source: <Badge tone="purple">VinFlux</Badge>, detail: 'Shipping documents, bill of entry, landed cost', direction: '—', timing: 'As entered', fresh: '—', where: '/imports' }] : []),
    ...(enabled('production') ? [{ object: 'Production receipts & release', source: <Badge tone="blue">{prodSettings().erpName}</Badge>, detail: `Release by ${prodSettings().releaseBy === 'erp' ? 'ERP QC' : 'VinFlux QC'}`, direction: 'Inbound', timing: 'On read', fresh: ago(pr?.pulledAt), where: '/production?tab=settings' }] : []),
    ...(enabled('secondary') ? [{ object: 'Partner stock & secondary sales', source: <Badge tone="purple">Per partner</Badge>, detail: Object.entries(routes).map(([k, n]) => `${n} via ${k}`).join(' · ') || 'No partners set up', direction: 'Inbound', timing: 'Per partner cadence', fresh: `${cov.pct}% of channel stock fresh`, where: '/secondary?tab=routes' }] : []),
    ...(enabled('claims') ? [{ object: 'Scheme claims', source: <Badge tone="purple">VinFlux</Badge>, detail: 'Computed from secondary data, or raised by partner / desk', direction: 'Inbound', timing: 'Per period', fresh: '—', where: '/claims' }] : []),
  ];
  const connRows = CONNECTORS.filter((c) => c.availability !== 'planned').map((c) => ({ c, s: connectorSettings(c.id), last: runs.find((r) => r.connectorId === c.id) })).filter((x) => x.s.enabled || x.c.id === ss.connectorId);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Data Sources" description="Where each piece of data comes from — VinFlux, your ERP or another system, a file, or not used — and how fresh it is. Every source feeds the same records and the same checks." />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Owned in VinFlux" value={Object.values(os.sources).filter((v) => v === 'vinflux').length} icon={<Database size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`of ${INPUTS.length} core objects`} />
        <KpiCard label="From a connected system" value={Object.values(os.sources).filter((v) => v === 'connected').length} icon={<PlugZap size={22} />} color="#2563eb" bg="#eff6ff" foot={stockConn ? `Stock: ${stockConn.name}` : 'No stock connector'} />
        <KpiCard label="Stock data age" value={ago(stockSync)} icon={<Timer size={22} />} color="#d97706" bg="#fffbeb" foot={`flagged after ${ss.staleHours} h`} onClick={() => navigate('/integrations')} />
        <KpiCard label="Partner data coverage" value={enabled('secondary') ? `${cov.pct}%` : '—'} icon={<RefreshCw size={22} />} color="#059669" bg="#ecfdf5" foot="of channel stock reported and fresh" />
      </div>
      <Card title="Core objects" subtitle={admin ? 'Change a source here — it applies at once and is recorded.' : 'Only an administrator can change a source.'} flush>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Data</th><th style={{ width: 210 }}>Source</th><th>Comes from</th><th>Freshness</th><th /></tr></thead>
          <tbody>{INPUTS.map((i) => {
            const v = os.sources[i.id];
            const what = i.id === 'invoice' && vfInvoice ? 'VinFlux Invoicing (GST invoice, e-invoice, e-way bill)' : i.id === 'stock' && v === 'connected' ? (stockConn?.name ?? 'Connector not chosen') : (i as unknown as Record<string, string>)[v];
            return (
              <tr key={i.id}>
                <td><strong>{i.label}</strong>{i.required && <div className="g2-cell-sub">required</div>}</td>
                <td>{admin && !(i.id === 'invoice' && vfInvoice) ? <Select value={v} options={i.options.map((o) => ({ value: o, label: KIND[o].label }))} onChange={(x) => set(i.id, x as SourceKind)} /> : <Badge tone={i.id === 'invoice' && vfInvoice ? 'purple' : KIND[v].tone}>{i.id === 'invoice' && vfInvoice ? 'VinFlux' : KIND[v].label}</Badge>}</td>
                <td className="g2-small">{what}</td>
                <td className="g2-small">{i.id === 'stock' && v === 'connected' ? `${ago(stockSync)} · read ${os.inventory.read === 'live' ? 'live at confirmation' : os.inventory.read === 'sync' ? 'from the last sync' : 'live, falls back to last sync'}` : v === 'vinflux' ? 'Live' : v === 'file' ? 'As uploaded' : '—'}</td>
                <td style={{ textAlign: 'right' }}>{WHERE[i.id] && <a href="#" className="g2-small" onClick={(e) => { e.preventDefault(); navigate(WHERE[i.id]!); }}>Configure <ArrowRight size={11} /></a>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Operational data" flush>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Data</th><th>Source</th><th>Detail</th><th>Direction</th><th>Timing</th><th>Freshness</th><th /></tr></thead>
          <tbody>{extra.map((r) => (
            <tr key={r.object}><td><strong>{r.object}</strong></td><td>{r.source}</td><td className="g2-small">{r.detail}</td><td className="g2-small">{r.direction}</td><td className="g2-small">{r.timing}</td><td className="g2-small">{r.fresh}</td>
              <td style={{ textAlign: 'right' }}><a href="#" className="g2-small" onClick={(e) => { e.preventDefault(); navigate(r.where); }}>Configure <ArrowRight size={11} /></a></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Connections" subtitle="Each connection’s state, schedule and last run (INT-06: working, active and sharing are shown separately per partner in Secondary Sales)" flush>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>System</th><th>Kind</th><th>Schedule</th><th>Apply</th><th>Last run</th><th>Test</th><th /></tr></thead>
          <tbody>
            {connRows.length === 0 && <tr><td colSpan={7} className="g2-muted">No connections switched on — everything is owned in VinFlux or uploaded.</td></tr>}
            {connRows.map(({ c, s, last }) => (
              <tr key={c.id}><td><strong>{c.name}</strong>{c.id === ss.connectorId && <div className="g2-cell-sub">stock master</div>}</td><td className="g2-small">{c.kind} · {c.direction}</td><td className="g2-small">{s.schedule}</td><td className="g2-small">{s.applyMode ?? 'Auto'}</td>
                <td className="g2-small">{ago(s.lastSyncAt)}{last ? ` · ${(last as unknown as { status?: string }).status ?? ''}` : ''}</td>
                <td>{s.lastTest ? <Badge tone={s.lastTest.ok ? 'green' : 'red'}>{s.lastTest.ok ? 'Connected' : 'Failed'}</Badge> : <Badge tone="slate">Not tested</Badge>}</td>
                <td style={{ textAlign: 'right' }}><a href="#" className="g2-small" onClick={(e) => { e.preventDefault(); navigate('/integrations'); }}>Open <ArrowRight size={11} /></a></td></tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
};
export default DataSourcesPage;
