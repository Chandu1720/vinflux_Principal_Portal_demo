/**
 * Inventory → Settings (stock source per warehouse) and Goods receipts & adjustments (VinFlux-mastered warehouses).
 */
import React, { useState } from 'react';
import { Check, PackagePlus, SlidersHorizontal, X } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, Modal, NumberInput, SearchableSelect, Select, Textarea } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { CONNECTORS, connectorSettings } from '../../platform/integrations/connectors';
import { masterOf, sourceOf } from '../../platform/integrations/stockSync';
import { balances, movements, subscribeStock } from './stockStore';
import {
  SOURCE_HINT, SOURCE_LABEL, adjustments, decideAdjustment, goodsReceipt, requestAdjustment, setDefaultSource, setStaleHours, setWarehouseSource, settingOf, sourceSettings, subscribeSource,
} from './stockSource';
import type { Adjustment, ReceiptInput, SourceSetting, StockSource } from './stockSource';

const SOURCE_TONE: Record<StockSource, 'purple' | 'green' | 'slate'> = { ERP: 'purple', VINFLUX: 'green', NONE: 'slate' };
const SETTING_OPTS: { value: SourceSetting; label: string }[] = [
  { value: 'AUTO', label: 'Automatic — ERP if a connector feeds it, else VinFlux' },
  { value: 'ERP', label: SOURCE_LABEL.ERP }, { value: 'VINFLUX', label: SOURCE_LABEL.VINFLUX }, { value: 'NONE', label: SOURCE_LABEL.NONE },
];
export const SourceBadge: React.FC<{ s: StockSource }> = ({ s }) => <Badge tone={SOURCE_TONE[s]} dot>{SOURCE_LABEL[s]}</Badge>;

/* --------------------------------- Settings --------------------------------- */

export const SourceSettingsTab: React.FC<{ canConfigure: boolean }> = ({ canConfigure }) => {
  useSubscribe(subscribeSource, subscribeStock);
  const imp = useImportContext();
  const { warehouses, showToast } = useApp();
  const st = sourceSettings();
  const change = (whId: string, v: string) => {
    const before = sourceOf(whId, imp);
    setWarehouseSource(whId, v === 'DEFAULT' ? null : (v as SourceSetting));
    const after = sourceOf(whId, imp);
    if (before !== after) showToast(before === 'ERP' && after === 'VINFLUX' ? 'Switched to VinFlux: the last ERP figures are now the opening stock; record receipts and adjustments here from now on.'
      : after === 'ERP' ? 'Switched to ERP: the next sync loads the ERP’s figures; differences go to Reconciliation.'
        : after === 'NONE' ? 'Stock is no longer checked for this warehouse; orders confirm on partner and credit checks.' : 'Stock source changed.', 'success');
  };
  return (
    <div style={{ padding: 16 }} className="g2-stack">
      <div className="g2-grid g2-grid-3" style={{ gap: 10 }}>
        {(['ERP', 'VINFLUX', 'NONE'] as StockSource[]).map((s) => <Card key={s} title={<SourceBadge s={s} />}><div className="g2-small">{SOURCE_HINT[s]}</div></Card>)}
      </div>
      <FormGrid>
        <Field label="Default for all warehouses" hint="Warehouses without their own setting follow this."><Select value={st.defaultSource} disabled={!canConfigure} options={SETTING_OPTS} onChange={(v) => { setDefaultSource(v as SourceSetting); showToast('Default stock source saved.', 'success'); }} /></Field>
        <Field label="Warn when ERP stock is older than (hours)" hint="Orders show a freshness warning before confirming."><NumberInput value={st.staleHours} disabled={!canConfigure} onChange={(v) => setStaleHours(v ?? 6)} /></Field>
      </FormGrid>
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>Warehouse</th><th>Setting</th><th>In effect</th><th>Connector</th><th style={{ textAlign: 'right' }}>Units on hand</th></tr></thead>
        <tbody>{warehouses.filter((w) => w.status === 'Active').map((w) => {
          const own = st.perWarehouse[w.id];
          const m = masterOf(w.id, imp);
          const fedBy = CONNECTORS.find((c) => c.kind === 'ERP' && Object.values(connectorSettings(c.id).plantMap).includes(w.code));
          return (
            <tr key={w.id}>
              <td><div className="g2-strong">{w.code}</div><div className="g2-cell-sub">{w.name} · {w.state}</div></td>
              <td style={{ minWidth: 300 }}><Select value={own ?? 'DEFAULT'} disabled={!canConfigure} options={[{ value: 'DEFAULT', label: `Follow default (${SETTING_OPTS.find((o) => o.value === st.defaultSource)?.label.split(' —')[0]})` }, ...SETTING_OPTS]} onChange={(v) => change(w.id, v)} /></td>
              <td><SourceBadge s={sourceOf(w.id, imp)} /></td>
              <td className="g2-small">{m ? CONNECTORS.find((c) => c.id === m)?.name : fedBy ? <span className="g2-muted">{fedBy.name} mapped, not used ({settingOf(w.id) === 'VINFLUX' || settingOf(w.id) === 'NONE' ? 'taken out of ERP control' : 'connector off'})</span> : <span className="g2-muted">None — Excel import or VinFlux</span>}</td>
              <td style={{ textAlign: 'right' }}>{balances().filter((b) => b.locType === 'COMPANY' && b.warehouseId === w.id).reduce((a, b) => a + b.qty, 0)}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <Alert tone="info">C&F depots, partner godowns, hospital consignment and goods in transit are always kept in VinFlux, whatever the warehouse setting.</Alert>
    </div>
  );
};

/* ------------------------- Goods receipts & adjustments ------------------------- */

const ReceiptDrawer: React.FC<{ onClose: () => void; whs: { id: string; label: string }[] }> = ({ onClose, whs }) => {
  const { products, currentUser, showToast } = useApp();
  const [f, setF] = useState<ReceiptInput & { serialText: string; pv: string }>({ warehouseId: whs[0]?.id ?? '', productId: '', variantSku: null, batch: '', serials: [], mfgDate: null, expiryDate: null, qty: 1, unitCost: null, from: 'Production', reference: '', serialText: '', pv: '' });
  const [errs, setErrs] = useState<string[]>([]);
  const opts = products.filter((p) => p.lifecycleStatus === 'Active').flatMap((p) => (p.variants.length ? p.variants.map((v) => ({ value: `${p.id}|${v.sku}`, label: v.name, description: v.sku })) : [{ value: `${p.id}|`, label: p.name, description: p.code }]));
  const prod = products.find((p) => p.id === f.productId);
  const serialised = (prod?.trackingMode ?? '').includes('Serial');
  const save = () => {
    const r = goodsReceipt({ ...f, serials: f.serialText.split(/[\s,]+/).filter(Boolean) }, serialised, currentUser.name);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose();
  };
  return (
    <Modal open size="lg" title="Goods receipt" subtitle="Finished goods arriving in a VinFlux-managed warehouse (from production, a purchase or an import)." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Record receipt</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <FormGrid>
          <Field label="Warehouse" required><Select value={f.warehouseId} options={whs.map((w) => ({ value: w.id, label: w.label }))} onChange={(v) => setF({ ...f, warehouseId: v })} /></Field>
          <Field label="Received from"><Select value={f.from} options={['Production', 'Purchase', 'Import', 'Return to stock', 'Opening'].map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, from: v as ReceiptInput['from'] })} /></Field>
          <Field label="Product" required><SearchableSelect value={f.pv} options={opts} onChange={(v) => { const [pid, sku] = (v ?? '|').split('|'); setF({ ...f, pv: v ?? '', productId: pid, variantSku: sku || null }); }} /></Field>
          <Field label="Reference" hint="Production order / supplier invoice / bill of entry"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <Field label="Batch / lot" required><Input value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} /></Field>
          <Field label="Quantity" required><NumberInput value={f.qty} onChange={(v) => setF({ ...f, qty: v ?? 0 })} /></Field>
          <Field label="Mfg date"><Input type="date" value={f.mfgDate ?? ''} onChange={(e) => setF({ ...f, mfgDate: e.target.value || null })} /></Field>
          <Field label="Expiry date"><Input type="date" value={f.expiryDate ?? ''} onChange={(e) => setF({ ...f, expiryDate: e.target.value || null })} /></Field>
          <Field label="Unit cost (₹)"><NumberInput value={f.unitCost ?? prod?.pricingReference?.standardCost ?? null} onChange={(v) => setF({ ...f, unitCost: v ?? null })} /></Field>
        </FormGrid>
        {serialised && <Field label={`Serial numbers (${f.qty})`} required hint="One per unit — separated by commas, spaces or new lines, or scanned."><Textarea rows={3} value={f.serialText} onChange={(e) => setF({ ...f, serialText: e.target.value })} /></Field>}
      </div>
    </Modal>
  );
};

const AdjustDrawer: React.FC<{ onClose: () => void; whIds: string[] }> = ({ onClose, whIds }) => {
  const { products, warehouses, currentUser, showToast } = useApp();
  const lines = balances().filter((b) => b.locType === 'COMPANY' && whIds.includes(b.warehouseId) && b.status === 'Available' && b.qty > 0);
  const [key, setKey] = useState('');
  const [delta, setDelta] = useState(-1);
  const [reason, setReason] = useState<Adjustment['reason']>('Count difference');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const b = lines.find((x) => x.key === key);
  const save = () => {
    if (!b) { setErr('Choose the stock line.'); return; }
    const r = requestAdjustment({ warehouseId: b.warehouseId, productId: b.productId, variantSku: b.variantSku, batch: b.batch, serial: b.serial, bin: b.bin, expiryDate: b.expiryDate, mfgDate: b.mfgDate, unitCost: b.unitCost, delta, reason, note, requestedBy: currentUser.name });
    if (!r.ok) { setErr(r.message); return; }
    showToast(r.message, 'success'); onClose();
  };
  return (
    <Modal open size="md" title="Stock adjustment" subtitle="Needs approval by someone other than you before stock changes." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Send for approval</Button></>}>
      <div className="g2-stack">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Stock line" required><SearchableSelect value={key} options={lines.map((x) => ({ value: x.key, label: `${products.find((p) => p.id === x.productId)?.name ?? x.productId} · ${x.batch}${x.serial ? ` · ${x.serial}` : ''}`, description: `${warehouses.find((w) => w.id === x.warehouseId)?.code} · ${x.qty} on hand` }))} onChange={(v) => setKey(v ?? '')} /></Field>
        <FormGrid>
          <Field label="Change (+ found / − missing)" hint={b ? `${b.qty} on hand now` : undefined}><NumberInput value={delta} onChange={(v) => setDelta(v ?? 0)} /></Field>
          <Field label="Reason"><Select value={reason} options={['Count difference', 'Damaged in warehouse', 'Expired — written off', 'Found', 'Other'].map((x) => ({ value: x, label: x }))} onChange={(v) => setReason(v as Adjustment['reason'])} /></Field>
        </FormGrid>
        <Field label="Note"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
};

export const GoodsTab: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  useSubscribe(subscribeSource, subscribeStock);
  const imp = useImportContext();
  const { warehouses, products, currentUser, showToast } = useApp();
  const [mode, setMode] = useState<'receipt' | 'adjust' | null>(null);
  const vf = warehouses.filter((w) => w.status === 'Active' && sourceOf(w.id, imp) === 'VINFLUX');
  const list = adjustments();
  const grns = [...movements().filter((m) => m.type === 'RECEIPT' && m.locType === 'COMPANY' && (m.refId ?? '').startsWith('GRN'))
    .reduce((acc, m) => { const r = acc.get(m.refId!) ?? { no: m.refId!, at: m.at, by: m.by, wh: m.warehouseId, productId: m.productId, batch: m.batch, units: 0, source: m.source }; r.units += m.qty; acc.set(m.refId!, r); return acc; }, new Map<string, { no: string; at: string; by: string; wh: string; productId: string; batch: string; units: number; source: string }>()).values()]
    .sort((x, y) => y.at.localeCompare(x.at));
  return (
    <div style={{ padding: 16 }} className="g2-stack">
      {vf.length === 0
        ? <Alert tone="info">No warehouse is managed by VinFlux yet — company stock comes from the ERP. Change a warehouse to “VinFlux is master” under Settings to record goods receipts and adjustments here.</Alert>
        : <div className="g2-row" style={{ gap: 8 }}>
          <span className="g2-small g2-muted">VinFlux-managed: <strong>{vf.map((w) => w.code).join(', ')}</strong></span>
          <span className="g2-spacer" />
          {canEdit && <Button icon={<SlidersHorizontal size={14} />} onClick={() => setMode('adjust')}>Stock adjustment</Button>}
          {canEdit && <Button variant="primary" icon={<PackagePlus size={14} />} onClick={() => setMode('receipt')}>Goods receipt</Button>}
        </div>}
      <div className="g2-label">Goods receipts</div>
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>GRN</th><th>Warehouse</th><th>Product · batch</th><th style={{ textAlign: 'right' }}>Units</th><th>From</th><th>By</th></tr></thead>
        <tbody>
          {grns.length === 0 && <tr><td colSpan={6} className="g2-muted">No goods receipts yet.</td></tr>}
          {grns.map((g) => (
            <tr key={g.no}><td className="g2-mono">{g.no}<div className="g2-cell-sub">{g.at.slice(0, 10)}</div></td><td>{warehouses.find((w) => w.id === g.wh)?.code}</td>
              <td className="g2-small">{products.find((p) => p.id === g.productId)?.name ?? g.productId}<div className="g2-cell-sub">{g.batch}</div></td><td style={{ textAlign: 'right' }}>{g.units}</td>
              <td className="g2-small">{g.source.split(' · ').slice(1).join(' · ')}</td><td className="g2-small">{g.by}</td></tr>
          ))}
        </tbody>
      </table></div>
      <div className="g2-label">Adjustments</div>
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>No.</th><th>Stock line</th><th style={{ textAlign: 'right' }}>Change</th><th>Reason</th><th>Requested</th><th>Status</th><th /></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={7} className="g2-muted">No adjustments.</td></tr>}
          {list.map((a) => (
            <tr key={a.id}>
              <td className="g2-mono">{a.no}</td>
              <td className="g2-small">{products.find((p) => p.id === a.productId)?.name ?? a.productId}<div className="g2-cell-sub">{warehouses.find((w) => w.id === a.warehouseId)?.code} · {a.batch}{a.serial ? ` · ${a.serial}` : ''}</div></td>
              <td style={{ textAlign: 'right', color: a.delta < 0 ? '#b91c1c' : '#047857' }}>{a.delta > 0 ? `+${a.delta}` : a.delta}</td>
              <td className="g2-small">{a.reason}{a.note ? <div className="g2-cell-sub">{a.note}</div> : null}</td>
              <td className="g2-small">{a.requestedBy}<div className="g2-cell-sub">{a.requestedAt.slice(0, 10)}</div></td>
              <td><Badge tone={a.status === 'Pending' ? 'amber' : a.status === 'Approved' ? 'green' : 'red'} dot>{a.status}</Badge>{a.decidedBy && <div className="g2-cell-sub">{a.decidedBy}</div>}</td>
              <td>{a.status === 'Pending' && canEdit && a.requestedBy !== currentUser.name && (!(currentUser.scope?.warehouseIds ?? []).length || currentUser.scope!.warehouseIds!.includes(a.warehouseId)) && <div className="g2-row" style={{ gap: 4 }}>
                <Button size="sm" variant="primary" icon={<Check size={13} />} onClick={() => { const r = decideAdjustment(a.id, true, currentUser.name); showToast(r.message, r.ok ? 'success' : 'danger'); }}>Approve</Button>
                <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={() => { const r = decideAdjustment(a.id, false, currentUser.name); showToast(r.message, r.ok ? 'success' : 'danger'); }}>Reject</Button></div>}
                {a.status === 'Pending' && a.requestedBy === currentUser.name && <span className="g2-cell-sub">Waiting for another approver</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {mode === 'receipt' && <ReceiptDrawer onClose={() => setMode(null)} whs={vf.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))} />}
      {mode === 'adjust' && <AdjustDrawer onClose={() => setMode(null)} whIds={vf.map((w) => w.id)} />}
    </div>
  );
};
