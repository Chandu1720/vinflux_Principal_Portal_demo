import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, IndianRupee, PackageCheck, Upload } from 'lucide-react';
import { Badge, Button, Card, KpiCard, PageHeader, SearchInput, Select, Tabs } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { balances, movements, subscribeStock } from './stockStore';

const daysLeft = (iso: string | null) => (iso ? Math.round((Date.parse(iso) - Date.now()) / 86400000) : null);
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Stock on hand by warehouse × product × batch / serial × expiry. Balances are computed from the ledger. */
const StockOnHandPage: React.FC = () => {
  useSubscribe(subscribeStock);
  const navigate = useNavigate();
  const { products, warehouses: allWh, currentUser } = useApp();
  const whScope = currentUser.scope?.warehouseIds ?? [];
  const warehouses = whScope.length ? allWh.filter((w) => whScope.includes(w.id)) : allWh;
  const [tab, setTab] = useState('stock');
  const [q, setQ] = useState('');
  const [wh, setWh] = useState('');
  const [status, setStatus] = useState('');
  const bal = balances().filter((b) => !whScope.length || whScope.includes(b.warehouseId));
  const mv = movements().filter((m) => !whScope.length || whScope.includes(m.warehouseId));
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const wName = (id: string) => warehouses.find((w) => w.id === id)?.code ?? id;
  const rows = useMemo(() => bal.filter((b) => (!wh || b.warehouseId === wh) && (!status || b.status === status)
    && [pName(b.productId), b.variantSku, b.batch, b.serial].some((x) => (x ?? '').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => pName(a.productId).localeCompare(pName(b.productId)) || (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [bal, wh, status, q, products]);
  const units = bal.reduce((a, b) => a + b.qty, 0);
  const value = bal.reduce((a, b) => a + b.value, 0);
  const near = bal.filter((b) => { const d = daysLeft(b.expiryDate); return d !== null && d <= 180; });

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Stock on Hand" description="Stock by warehouse, bin, batch / serial and expiry. Every figure is the sum of ledger movements — nothing is typed in directly."
        actions={<Button variant="primary" icon={<Upload size={15} />} onClick={() => navigate('/data-import')}>Import opening stock</Button>} />
      {whScope.length > 0 && <div className="g2-alert g2-alert-info" style={{ marginBottom: 12 }}>Showing your warehouses only: <strong>{warehouses.map((w) => w.code).join(', ')}</strong>.</div>}
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Stock lines" value={bal.length} icon={<Boxes size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${new Set(bal.map((b) => b.productId)).size} product(s)`} />
        <KpiCard label="Units" value={units.toLocaleString('en-IN')} icon={<PackageCheck size={22} />} color="#059669" bg="#ecfdf5" foot={`${bal.filter((b) => b.status === 'Quarantine').reduce((a, b) => a + b.qty, 0)} in quarantine`} />
        <KpiCard label="Stock value" value={inr(value)} icon={<IndianRupee size={22} />} color="#2563eb" bg="#eff6ff" foot="at unit cost" />
        <KpiCard label="Expiring ≤ 180 days" value={near.length} icon={<AlertTriangle size={22} />} color="#d97706" bg="#fffbeb" foot={`${near.reduce((a, b) => a + b.qty, 0)} unit(s)`} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'stock', label: 'Balances', count: bal.length }, { id: 'ledger', label: 'Ledger', count: mv.length }]} />
          <span className="g2-spacer" />
          <SearchInput value={q} onChange={setQ} placeholder="Product, SKU, batch, serial…" />
          <Select value={wh} placeholder="All warehouses" options={warehouses.map((w) => ({ value: w.id, label: w.code }))} onChange={setWh} />
          <Select value={status} placeholder="All statuses" options={['Available', 'Quarantine', 'Blocked'].map((s) => ({ value: s, label: s }))} onChange={setStatus} />
        </div>
        {tab === 'stock' && (
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>Product</th><th>Warehouse / bin</th><th>Batch</th><th>Serial</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={8} className="g2-muted">No stock yet. Import opening stock from a file or sync it from SAP in the Integration Hub.</td></tr>}
                {rows.map((b) => {
                  const d = daysLeft(b.expiryDate);
                  return (
                    <tr key={b.key}>
                      <td><div className="g2-cell-main">{pName(b.productId)}</div>{b.variantSku && <div className="g2-cell-sub g2-mono">{b.variantSku}</div>}</td>
                      <td>{wName(b.warehouseId)}{b.bin && <div className="g2-cell-sub">Bin {b.bin}</div>}</td>
                      <td className="g2-mono">{b.batch}</td>
                      <td className="g2-mono">{b.serial ?? '—'}</td>
                      <td>{b.expiryDate ?? '—'}{d !== null && d <= 180 && <div><Badge tone={d <= 90 ? 'red' : 'amber'}>{d} days</Badge></div>}</td>
                      <td style={{ textAlign: 'right' }} className="g2-strong">{b.qty}</td>
                      <td style={{ textAlign: 'right' }}>{inr(b.value)}</td>
                      <td><Badge tone={b.status === 'Available' ? 'green' : b.status === 'Quarantine' ? 'amber' : 'red'} dot>{b.status}</Badge><div className="g2-cell-sub">{b.lastSource}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'ledger' && (
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>When</th><th>Type</th><th>Product</th><th>Warehouse</th><th>Batch / serial</th><th style={{ textAlign: 'right' }}>Qty</th><th>Source</th><th>Import</th></tr></thead>
              <tbody>{mv.slice().reverse().slice(0, 300).map((m) => (
                <tr key={m.id}>
                  <td className="g2-small">{new Date(m.at).toLocaleString('en-IN')}</td>
                  <td><Badge tone={m.type === 'OPENING' ? 'blue' : 'slate'}>{m.type === 'OPENING' ? 'Opening balance' : 'Reversal'}</Badge></td>
                  <td className="g2-small">{pName(m.productId)}</td>
                  <td>{wName(m.warehouseId)}</td>
                  <td className="g2-mono g2-small">{m.batch}{m.serial ? ` / ${m.serial}` : ''}</td>
                  <td style={{ textAlign: 'right', color: m.qty < 0 ? 'var(--g2-red)' : undefined }} className="g2-strong">{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                  <td className="g2-small">{m.source}</td>
                  <td className="g2-mono g2-small">{m.importId ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
export default StockOnHandPage;
