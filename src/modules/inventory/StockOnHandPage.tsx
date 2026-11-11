import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, Building2, IndianRupee, RefreshCw, Scale, Truck, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, KpiCard, PageHeader, SearchInput, Select, Tabs } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { CONNECTORS, connectorSettings, subscribeConnectors, syncRuns } from '../../platform/integrations/connectors';
import { acceptChanges, fedWarehouses, masterOf, runStockSync, stockDiff } from '../../platform/integrations/stockSync';
import { LOC_LABEL, balances, movements, subscribeStock } from './stockStore';
import type { LocType, StockBalance } from './stockStore';
import { useOrderCtx } from '../orders/useOrderCtx';
import { ensureDemo } from '../orders/seedDemo';
import { claims, inTransit, reservations, subscribeOrders } from '../orders/orderStore';
import { GoodsTab, SourceSettingsTab } from './StockSettings';
import { adjustments, subscribeSource } from './stockSource';
import { usePlatform } from '../../platform/PlatformContext';

const daysLeft = (iso: string | null) => (iso ? Math.round((Date.parse(iso) - Date.now()) / 86400000) : null);
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const LOC_TONE: Record<LocType, 'purple' | 'blue' | 'green' | 'amber' | 'slate'> = { COMPANY: 'purple', CNF: 'blue', PARTNER: 'green', HOSPITAL: 'amber', TRANSIT: 'slate' };
const MOVE_LABEL: Record<string, string> = { OPENING: 'Opening balance', REVERSAL: 'Reversal', ERP_SYNC: 'ERP sync', ISSUE: 'Issued (invoice)', TRANSFER_OUT: 'Out of transit', TRANSFER_IN: 'Transfer in', RECEIPT: 'Receipt', PARTNER_REPORT: 'Partner report', CLAIM: 'Claim', ADJUSTMENT: 'Adjustment (approved)', RETURN: 'Return', SCRAP: 'Scrapped (return)', RTM: 'Returned to manufacturer', BLOCK: 'Blocked (recall)' };

/** What to do with stock that is close to expiry, by where it sits. */
const expiryAction = (b: StockBalance, d: number) => {
  if (d < 0) return 'Expired — block, then return to manufacturer or destroy with a record';
  if (b.locType === 'COMPANY') return d <= 90 ? 'Ship first (oldest expiry first) to channels that accept short shelf life, or offer a scheme' : 'Prioritise in dispatch';
  if (b.locType === 'PARTNER' || b.locType === 'CNF') return d <= 90 ? 'Pull back or move to a faster-selling partner before it expires' : 'Watch — ask the partner to sell first';
  if (b.locType === 'HOSPITAL') return 'Swap the consignment unit with a fresh one';
  return 'In transit — check on receipt';
};

const StockOnHandPage: React.FC = () => {
  useSubscribe(subscribeStock, subscribeOrders, subscribeConnectors, subscribeSource);
  const { enabled } = usePlatform();
  const navigate = useNavigate();
  const imp = useImportContext();
  const ctx = useOrderCtx();
  const { products, warehouses: allWh, currentUser, activePrincipal, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'stock';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const [where, setWhere] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { if (ctx) ensureDemo(imp, ctx, activePrincipal.id); }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const whScope = currentUser.scope?.warehouseIds ?? [];
  const warehouses = whScope.length ? allWh.filter((w) => whScope.includes(w.id)) : allWh;
  const myProducts = new Set(products.map((p) => p.id));
  const bal = balances().filter((b) => myProducts.has(b.productId) && (b.locType !== 'COMPANY' || !whScope.length || whScope.includes(b.warehouseId)));
  const mv = movements().filter((m) => myProducts.has(m.productId));
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const partners = ctx?.partners ?? [];
  const locName = (b: Pick<StockBalance, 'locType' | 'warehouseId'>) => (b.locType === 'COMPANY' || !b.locType
    ? (allWh.find((w) => w.id === b.warehouseId)?.code ?? b.warehouseId)
    : `${b.locType === 'TRANSIT' ? 'To ' : ''}${partners.find((p) => p.id === b.warehouseId)?.name ?? b.warehouseId}`);
  const rows = useMemo(() => bal.filter((b) => (!loc || b.locType === loc) && (!where || b.warehouseId === where) && (!status || b.status === status)
    && [pName(b.productId), b.variantSku, b.batch, b.serial].some((x) => (x ?? '').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.locType.localeCompare(b.locType) || pName(a.productId).localeCompare(pName(b.productId)) || (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [bal, loc, where, status, q, products, partners]);
  const byType = (t: LocType) => bal.filter((b) => b.locType === t);
  const units = (l: StockBalance[]) => l.reduce((a, b) => a + b.qty, 0);
  const value = (l: StockBalance[]) => l.reduce((a, b) => a + b.value, 0);
  const near = bal.filter((b) => { const d = daysLeft(b.expiryDate); return d !== null && d <= 180 && b.qty > 0; });

  // Available to promise per company / C&F location × product.
  const res = reservations();
  const atpRows = useMemo(() => {
    const m = new Map<string, { locType: LocType; warehouseId: string; productId: string; variantSku: string | null; avail: number; hold: number; blocked: number }>();
    bal.filter((b) => b.locType === 'COMPANY' || b.locType === 'CNF').forEach((b) => {
      const k = `${b.warehouseId}|${b.productId}|${b.variantSku ?? ''}`;
      const r = m.get(k) ?? { locType: b.locType, warehouseId: b.warehouseId, productId: b.productId, variantSku: b.variantSku, avail: 0, hold: 0, blocked: 0 };
      if (b.status === 'Available') r.avail += b.qty; else if (b.status === 'Quarantine') r.hold += b.qty; else r.blocked += b.qty;
      m.set(k, r);
    });
    return [...m.values()].map((r) => ({ ...r, reserved: res.get(`${r.warehouseId}|${r.productId}|${r.variantSku ?? ''}`) ?? 0 }))
      .sort((a, b) => pName(a.productId).localeCompare(pName(b.productId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bal, res]);

  // Channel stock per partner location.
  const channel = useMemo(() => {
    const m = new Map<string, { id: string; locType: LocType; units: number; value: number; near: number; expired: number; last: string }>();
    bal.filter((b) => b.locType === 'CNF' || b.locType === 'PARTNER' || b.locType === 'HOSPITAL').forEach((b) => {
      const r = m.get(b.warehouseId) ?? { id: b.warehouseId, locType: b.locType, units: 0, value: 0, near: 0, expired: 0, last: b.lastSource };
      const d = daysLeft(b.expiryDate);
      r.units += b.qty; r.value += b.value; if (d !== null && d < 0) r.expired += b.qty; else if (d !== null && d <= 90) r.near += b.qty;
      m.set(b.warehouseId, r);
    });
    return [...m.values()];
  }, [bal]);
  const transit = inTransit();
  const openClaims = claims().filter((c) => c.status === 'Open');
  const erpConnectors = CONNECTORS.filter((c) => c.kind === 'ERP' && c.availability === 'sandbox' && (connectorSettings(c.id).enabled || !!connectorSettings(c.id).lastSyncAt));
  const diffs = erpConnectors.map((c) => ({ c, s: connectorSettings(c.id), changes: connectorSettings(c.id).enabled ? stockDiff(c.id, imp) : [], pending: syncRuns().find((r) => r.connectorId === c.id && r.status === 'Waiting review' && !r.applied) }));
  const mismatches = diffs.reduce((a, d) => a + d.changes.length, 0);
  const canSync = !!currentUser.matrix?.data?.includes('edit') || !!currentUser.matrix?.inventory?.includes('edit');

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Inventory" description="One view of stock across the chain. Each company warehouse takes its stock from the ERP, from VinFlux, or isn't tracked (Settings); C&F depots, partner godowns, hospital consignment and goods in transit are kept here."
        actions={<><Button icon={<Upload size={15} />} onClick={() => navigate('/data-import')}>Upload partner stock</Button><Button variant="primary" icon={<RefreshCw size={15} />} onClick={() => navigate('/integrations')}>ERP connections</Button></>} />
      {whScope.length > 0 && <div className="g2-alert g2-alert-info" style={{ marginBottom: 12 }}>Company stock shown for your warehouses only: <strong>{warehouses.map((w) => w.code).join(', ')}</strong>.</div>}
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Company warehouses" value={units(byType('COMPANY')).toLocaleString('en-IN')} icon={<Boxes size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${inr(value(byType('COMPANY')))} · ${byType('COMPANY').filter((b) => b.status !== 'Available').reduce((a, b) => a + b.qty, 0)} on hold`} />
        <KpiCard label="In the channel" value={(units(byType('CNF')) + units(byType('PARTNER')) + units(byType('HOSPITAL'))).toLocaleString('en-IN')} icon={<Building2 size={22} />} color="#059669" bg="#ecfdf5" foot={`C&F ${units(byType('CNF'))} · partners ${units(byType('PARTNER'))} · hospitals ${units(byType('HOSPITAL'))}`} />
        <KpiCard label="In transit" value={units(byType('TRANSIT'))} icon={<Truck size={22} />} color="#2563eb" bg="#eff6ff" foot={<span>{transit.length} shipment(s) · {openClaims.length} open claim(s){enabled('logistics') && <> · <a href="#" onClick={(e) => { e.preventDefault(); navigate('/logistics?tab=transit'); }}>Logistics</a></>}</span>} />
        <KpiCard label="Expiring ≤ 180 days" value={units(near)} icon={<AlertTriangle size={22} />} color="#d97706" bg="#fffbeb" foot={`${near.filter((b) => b.locType !== 'COMPANY').reduce((a, b) => a + b.qty, 0)} unit(s) sitting with partners`} />
      </div>
      {mismatches > 0 && <div style={{ marginBottom: 12 }}><Alert tone="warn">{mismatches} stock line(s) differ between the ERP and VinFlux — see Reconciliation.</Alert></div>}
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'stock', label: 'Stock by location', count: bal.length },
            { id: 'atp', label: 'Available to promise' },
            { id: 'channel', label: 'Channel stock', count: channel.length || undefined },
            { id: 'expiry', label: 'Expiry', count: near.length || undefined },
            { id: 'goods', label: 'Goods receipts & adjustments', count: adjustments().filter((a) => a.status === 'Pending').length || undefined },
            { id: 'recon', label: 'Reconciliation', count: mismatches || undefined },
            { id: 'ledger', label: 'Ledger', count: mv.length },
            { id: 'settings', label: 'Settings' },
          ]} />
          <span className="g2-spacer" />
          {tab === 'stock' && <>
            <SearchInput value={q} onChange={setQ} placeholder="Product, SKU, batch, serial…" />
            <Select value={loc} placeholder="All location types" options={(Object.keys(LOC_LABEL) as LocType[]).map((t) => ({ value: t, label: LOC_LABEL[t] }))} onChange={(v) => { setLoc(v); setWhere(''); }} />
            <Select value={where} placeholder="All locations" options={Array.from(new Set(bal.filter((b) => !loc || b.locType === loc).map((b) => b.warehouseId))).map((id) => ({ value: id, label: locName(bal.find((b) => b.warehouseId === id)!) }))} onChange={setWhere} />
            <Select value={status} placeholder="All statuses" options={['Available', 'Quarantine', 'Blocked'].map((s) => ({ value: s, label: s }))} onChange={setStatus} />
          </>}
        </div>

        {tab === 'stock' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th>Location</th><th>Batch</th><th>Serial</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="g2-muted">No stock yet. Connect the ERP in the Integration Hub, or import opening stock.</td></tr>}
              {rows.map((b) => {
                const d = daysLeft(b.expiryDate);
                return (
                  <tr key={b.key}>
                    <td><div className="g2-cell-main">{pName(b.productId)}</div>{b.variantSku && <div className="g2-cell-sub g2-mono">{b.variantSku}</div>}</td>
                    <td><Badge tone={LOC_TONE[b.locType]}>{LOC_LABEL[b.locType]}</Badge><div className="g2-cell-sub">{locName(b)}{b.locType === 'COMPANY' && masterOf(b.warehouseId, imp) ? ` · ${CONNECTORS.find((c) => c.id === masterOf(b.warehouseId, imp))?.name}` : ''}</div></td>
                    <td className="g2-mono">{b.batch}</td>
                    <td className="g2-mono">{b.serial ?? '—'}</td>
                    <td>{b.expiryDate ?? '—'}{d !== null && d <= 180 && <div><Badge tone={d <= 90 ? 'red' : 'amber'}>{d < 0 ? 'Expired' : `${d} days`}</Badge></div>}</td>
                    <td style={{ textAlign: 'right' }} className="g2-strong">{b.qty}</td>
                    <td style={{ textAlign: 'right' }}>{inr(b.value)}</td>
                    <td><Badge tone={b.status === 'Available' ? 'green' : b.status === 'Quarantine' ? 'amber' : 'red'} dot>{b.status === 'Quarantine' ? 'Quality hold' : b.status}</Badge><div className="g2-cell-sub">{b.lastSource}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}

        {tab === 'atp' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th>Ship-from location</th><th style={{ textAlign: 'right' }}>Released</th><th style={{ textAlign: 'right' }}>Quality hold</th><th style={{ textAlign: 'right' }}>Blocked</th><th style={{ textAlign: 'right' }}>Reserved by orders</th><th style={{ textAlign: 'right' }}>Available to promise</th></tr></thead>
            <tbody>
              {atpRows.length === 0 && <tr><td colSpan={7} className="g2-muted">No company or C&F stock yet.</td></tr>}
              {atpRows.map((r) => (
                <tr key={`${r.warehouseId}|${r.productId}|${r.variantSku}`}>
                  <td>{pName(r.productId)}{r.variantSku && <div className="g2-cell-sub g2-mono">{r.variantSku}</div>}</td>
                  <td><Badge tone={LOC_TONE[r.locType]}>{r.locType === 'CNF' ? 'C&F' : 'Company'}</Badge> <span className="g2-small">{locName(r)}</span></td>
                  <td style={{ textAlign: 'right' }}>{r.avail}</td><td style={{ textAlign: 'right' }}>{r.hold || '—'}</td><td style={{ textAlign: 'right' }}>{r.blocked || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.reserved || '—'}</td>
                  <td style={{ textAlign: 'right' }} className="g2-strong"><span style={{ color: r.avail - r.reserved <= 0 ? '#b91c1c' : undefined }}>{Math.max(0, r.avail - r.reserved)}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {tab === 'channel' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-small g2-muted">Stock held by C&F agents, partners and hospitals. It grows with deliveries (receipt check) and is corrected by the partner’s own stock report (Data Import → “Partner stock report”, later the partner portal).</div>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Holder</th><th>Type</th><th style={{ textAlign: 'right' }}>Units</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ textAlign: 'right' }}>Expiring ≤ 90 d</th><th style={{ textAlign: 'right' }}>Expired</th><th>Last update</th></tr></thead>
              <tbody>
                {channel.length === 0 && <tr><td colSpan={7} className="g2-muted">No channel stock reported yet.</td></tr>}
                {channel.map((c) => (
                  <tr key={c.id} onClick={() => { setTab('stock'); setLoc(c.locType); setWhere(c.id); }} style={{ cursor: 'pointer' }}>
                    <td className="g2-strong">{partners.find((p) => p.id === c.id)?.name ?? c.id}</td><td><Badge tone={LOC_TONE[c.locType]}>{LOC_LABEL[c.locType]}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{c.units}</td><td style={{ textAlign: 'right' }}>{inr(c.value)}</td>
                    <td style={{ textAlign: 'right', color: c.near ? '#b45309' : undefined }}>{c.near || '—'}</td><td style={{ textAlign: 'right', color: c.expired ? '#b91c1c' : undefined }}>{c.expired || '—'}</td>
                    <td className="g2-small">{c.last}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {tab === 'expiry' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product · batch</th><th>Where</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Qty</th><th>Suggested action</th></tr></thead>
            <tbody>
              {near.length === 0 && <tr><td colSpan={5} className="g2-muted">Nothing expires in the next 180 days.</td></tr>}
              {near.sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')).map((b) => {
                const d = daysLeft(b.expiryDate)!;
                return (
                  <tr key={b.key}>
                    <td>{pName(b.productId)}<div className="g2-cell-sub g2-mono">{b.batch}{b.serial ? ` · ${b.serial}` : ''}</div></td>
                    <td><Badge tone={LOC_TONE[b.locType]}>{LOC_LABEL[b.locType]}</Badge><div className="g2-cell-sub">{locName(b)}</div></td>
                    <td>{b.expiryDate} <Badge tone={d < 0 ? 'red' : d <= 90 ? 'red' : 'amber'}>{d < 0 ? 'Expired' : `${d} d`}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{b.qty}</td>
                    <td className="g2-small">{expiryAction(b, d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}

        {tab === 'goods' && <GoodsTab canEdit={canSync} />}
        {tab === 'settings' && <SourceSettingsTab canConfigure={!currentUser.matrix || !!currentUser.matrix.inventory?.includes('configure') || !!currentUser.matrix.platform?.includes('configure')} />}

        {tab === 'recon' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-small g2-muted">The ERP is the master of company warehouses. Each sync compares the ERP’s stock with VinFlux’s mirror; differences are applied automatically or held here for review (Integration Hub → connector → “When the ERP stock changes”).</div>
            {diffs.map(({ c, s, changes, pending }) => (
              <Card key={c.id} title={<span className="g2-row"><Scale size={15} /> {c.name} <Badge tone={!s.enabled ? 'slate' : changes.length ? 'amber' : 'green'} dot>{!s.enabled ? 'Not connected' : changes.length ? `${changes.length} difference(s)` : 'In balance'}</Badge></span>}
                subtitle={s.enabled ? `Feeds ${fedWarehouses(c.id, imp).map((id) => allWh.find((w) => w.id === id)?.code).join(', ') || 'no warehouse'} · last sync ${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString('en-IN') : 'never'} · ${s.applyMode === 'Review' ? 'review mode' : 'auto-apply'}` : 'Switch the connector on in the Integration Hub.'}
                actions={s.enabled && canSync && <>
                  <Button size="sm" icon={<RefreshCw size={13} />} onClick={() => { const r = runStockSync(c.id, imp); showToast(`${c.name}: ${r.status} — ${r.message}`, r.status === 'Failed' ? 'danger' : 'success'); }}>Sync now</Button>
                  {changes.length > 0 && <Button size="sm" variant="primary" onClick={() => { const n = acceptChanges(c.id, imp, pending?.id); showToast(`${n} line(s) set to the ERP figures.`, 'success'); }}>Accept ERP figures</Button>}
                </>}>
                {changes.length === 0 ? <div className="g2-small g2-muted">{s.enabled ? 'VinFlux matches the ERP.' : '—'}</div> : (
                  <div className="g2-table-wrap"><table className="g2-table">
                    <thead><tr><th>Product</th><th>Warehouse</th><th>Batch / serial</th><th style={{ textAlign: 'right' }}>VinFlux</th><th style={{ textAlign: 'right' }}>ERP</th><th style={{ textAlign: 'right' }}>Difference</th></tr></thead>
                    <tbody>{changes.map((x, i) => (
                      <tr key={i}>
                        <td>{pName(x.productId)}{x.variantSku && <div className="g2-cell-sub g2-mono">{x.variantSku}</div>}</td>
                        <td>{allWh.find((w) => w.id === x.warehouseId)?.code}</td>
                        <td className="g2-mono g2-small">{x.batch}{x.serial ? ` · ${x.serial}` : ''}</td>
                        <td style={{ textAlign: 'right' }}>{x.vinflux}</td><td style={{ textAlign: 'right' }}>{x.erp}</td>
                        <td style={{ textAlign: 'right' }} className="g2-strong"><span style={{ color: x.erp - x.vinflux < 0 ? '#b91c1c' : '#047857' }}>{x.erp - x.vinflux > 0 ? '+' : ''}{x.erp - x.vinflux}</span></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </Card>
            ))}
          </div>
        )}

        {tab === 'ledger' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>When</th><th>Type</th><th>Product</th><th>Location</th><th>Batch / serial</th><th style={{ textAlign: 'right' }}>Qty</th><th>Source</th></tr></thead>
            <tbody>{mv.slice().reverse().slice(0, 300).map((m) => (
              <tr key={m.id}>
                <td className="g2-small">{new Date(m.at).toLocaleString('en-IN')}</td>
                <td><Badge tone={m.type === 'OPENING' || m.type === 'ERP_SYNC' ? 'blue' : m.type === 'ISSUE' ? 'purple' : 'slate'}>{MOVE_LABEL[m.type] ?? m.type}</Badge></td>
                <td className="g2-small">{pName(m.productId)}</td>
                <td className="g2-small">{locName({ locType: m.locType ?? 'COMPANY', warehouseId: m.warehouseId })}</td>
                <td className="g2-mono g2-small">{m.batch}{m.serial ? ` / ${m.serial}` : ''}</td>
                <td style={{ textAlign: 'right', color: m.qty < 0 ? 'var(--g2-red)' : undefined }} className="g2-strong">{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                <td className="g2-small">{m.source}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <div className="g2-small g2-muted" style={{ marginTop: 8 }}><IndianRupee size={12} style={{ verticalAlign: -1 }} /> Values at unit cost from the ERP.</div>
    </div>
  );
};
export default StockOnHandPage;
