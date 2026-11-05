import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert, Badge, Button, Field, FormGrid, Input, Modal, MultiSelect, NumberInput, Select } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useChannels } from '../gtm-v2/hooks/useGtmData';
import { saveScheme, schemes, subscribePricing, today } from './pricingStore';
import type { Scheme } from './pricingStore';

/** Trade schemes: buy X get Y free, or an extra % for a period. Applied in the price lookup (not on rate contracts). */
export const SchemesTab: React.FC = () => {
  useSubscribe(subscribePricing);
  const { products, activePrincipal, currentUser, showToast } = useApp();
  const channels = useChannels().data ?? [];
  const [edit, setEdit] = useState<Scheme | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const can = !!currentUser.permissions.canConfigurePricing;
  const list = schemes().filter((s) => s.principalId === activePrincipal.id);
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const on = today();
  const save = () => { if (!edit) return; const e = saveScheme(edit); if (e) setErr(e); else { showToast(`Scheme "${edit.name}" saved.`, 'success'); setEdit(null); } };
  const blank = (): Scheme => ({ id: '', name: '', kind: 'FREE_QTY', principalId: activePrincipal.id, channelIds: [], productIds: [], buyQty: 10, freeQty: 1, discountPct: 0, validFrom: on, validTo: on, status: 'Active' });
  return (
    <div style={{ padding: 16 }} className="g2-stack">
      <div className="g2-row"><span className="g2-small g2-muted">Schemes need pricing configuration rights. They apply automatically in Price check and (later) Orders.</span><span className="g2-spacer" />{can && <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setErr(null); setEdit(blank()); }}>New scheme</Button>}</div>
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th>Scheme</th><th>Offer</th><th>Products</th><th>Channels</th><th>Period</th><th>Status</th></tr></thead>
        <tbody>{list.map((s) => {
          const live = s.status === 'Active' && s.validFrom <= on && s.validTo >= on;
          return (
            <tr key={s.id} style={{ cursor: can ? 'pointer' : undefined }} onClick={() => { if (can) { setErr(null); setEdit(s); } }}>
              <td className="g2-strong">{s.name}</td>
              <td>{s.kind === 'FREE_QTY' ? `Buy ${s.buyQty} get ${s.freeQty} free` : `${s.discountPct}% extra off`}</td>
              <td className="g2-small">{s.productIds.map(name).join(', ')}</td>
              <td className="g2-small">{s.channelIds.map((c) => channels.find((x) => x.id === c)?.name ?? c).join(', ')}</td>
              <td className="g2-small">{s.validFrom} → {s.validTo}</td>
              <td><Badge tone={live ? 'green' : s.validTo < on ? 'slate' : 'amber'} dot>{live ? 'Running' : s.status === 'Paused' ? 'Paused' : s.validTo < on ? 'Ended' : 'Scheduled'}</Badge></td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {edit && (
        <Modal open title={edit.id ? edit.name : 'New scheme'} onClose={() => setEdit(null)} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save scheme</Button></>}>
          <div className="g2-stack">
            {err && <Alert tone="error">{err}</Alert>}
            <Field label="Name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Offer"><Select value={edit.kind} options={[{ value: 'FREE_QTY', label: 'Buy X get Y free' }, { value: 'EXTRA_DISCOUNT', label: 'Extra discount %' }]} onChange={(v) => setEdit({ ...edit, kind: v as Scheme['kind'] })} /></Field>
            {edit.kind === 'FREE_QTY' ? <FormGrid>
              <Field label="Buy"><NumberInput value={edit.buyQty} onChange={(v) => setEdit({ ...edit, buyQty: v ?? 0 })} /></Field>
              <Field label="Get free"><NumberInput value={edit.freeQty} onChange={(v) => setEdit({ ...edit, freeQty: v ?? 0 })} /></Field>
            </FormGrid> : <Field label="Extra discount %"><NumberInput value={edit.discountPct} onChange={(v) => setEdit({ ...edit, discountPct: v ?? 0 })} /></Field>}
            <Field label="Products" required><MultiSelect values={edit.productIds} options={products.filter((p) => p.principalId === activePrincipal.id).map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setEdit({ ...edit, productIds: v })} /></Field>
            <Field label="Channels" required><MultiSelect values={edit.channelIds} options={channels.filter((c) => c.status === 'Active').map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => setEdit({ ...edit, channelIds: v })} /></Field>
            <FormGrid>
              <Field label="From"><Input type="date" value={edit.validFrom} onChange={(e) => setEdit({ ...edit, validFrom: e.target.value })} /></Field>
              <Field label="To"><Input type="date" value={edit.validTo} onChange={(e) => setEdit({ ...edit, validTo: e.target.value })} /></Field>
            </FormGrid>
            <Field label="Status"><Select value={edit.status} options={[{ value: 'Active', label: 'Active' }, { value: 'Paused', label: 'Paused' }]} onChange={(v) => setEdit({ ...edit, status: v as Scheme['status'] })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
};
