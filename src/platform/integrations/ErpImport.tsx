/**
 * Master data from a live ERP: products → Product Master, customers → Go-to-Market partners, locations → Warehouse Master.
 * Everything goes through VinFlux's own checks: products via the product import (history + undo, new ones as Draft),
 * partners as onboarding drafts, warehouses through the Warehouse Master rules.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudDownload } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, ErrorList, Field, FormGrid, Modal, SearchableSelect, Select } from '../ui';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../import/useImportContext';
import { ENTITIES, findProduct } from '../import/entities';
import { runImport } from '../import/history';
import type { RowResult, RowValues } from '../import/types';
import { CONNECTORS, connectorSettings, saveSettings } from './connectors';
import { callErp, isLive } from './liveClient';
import type { LiveError } from './liveClient';
import { gtinError } from '../../utils/gs1';
import { packOf } from '../../utils/productLifecycle';
import { partnerService } from '../../modules/gtm-v2/services';
import { emptyExtras } from '../../modules/gtm-v2/pages/partner-onboarding/wizardModel';
import { usePartners, useConfig } from '../../modules/gtm-v2/hooks/useGtmData';
import type { Partner } from '../../modules/gtm-v2/types';
import type { Warehouse } from '../../types/warehouse';

export interface ErpProductLine { erpId: string; itemCode: string; name: string; description: string; barcode: string | null; hsn: string | null; gstRate: number | null; uom: string | null; salesRate: number | null; cost: number | null; brand: string | null; category: string | null; tracking: string | null; active: boolean }
export interface ErpCustomerLine { erpId: string; code: string; name: string; gstin: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null; active: boolean }
export interface ErpLocationLine { code: string; name: string; address: string | null; city: string | null; state: string | null; pincode: string | null }

/** ERP connectors switched to Live mode. */
export const liveErps = () => CONNECTORS.filter((c) => c.kind === 'ERP' && c.availability === 'sandbox' && isLive(c.id));
const errText = (e: unknown) => `${(e as Error).message}${(e as LiveError).detail ? ` — ${(e as LiveError).detail!.slice(0, 200)}` : ''}`;

const NoLiveErp: React.FC = () => {
  const navigate = useNavigate();
  return <Alert tone="info"><div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}><span>No ERP is connected in <strong>Live</strong> mode yet. Open the ERP in Integration Hub, switch Mode to Live and test the connection.</span><Button size="sm" onClick={() => navigate('/integrations')}>Integration Hub</Button></div></Alert>;
};

/* ------------------------------------ Products ------------------------------------ */

export const ProductErpImportDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ctx = useImportContext();
  const { showToast } = useApp();
  const erps = liveErps();
  const entity = ENTITIES.find((e) => e.id === 'products')!;
  const types = ctx.productTypes.filter((t) => ctx.industryPacks.find((pk) => pk.id === packOf(t.id, ctx.productTypes))?.enabled);
  const [erp, setErp] = useState(erps[0]?.id ?? '');
  const [f, setF] = useState({ typeId: types[0]?.id ?? '', portfolioId: ctx.portfolios[0]?.id ?? '', categoryId: '', onlyActive: true });
  const [items, setItems] = useState<ErpProductLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const pf = ctx.portfolios.find((p) => p.id === f.portfolioId);
  const erpName = CONNECTORS.find((c) => c.id === erp)?.name ?? 'ERP';
  const fetchItems = async () => {
    setBusy(true); setErrs([]);
    try { const r = await callErp<{ products: ErpProductLine[] }>(erp, 'products'); setItems(r.products); setSkip(new Set()); }
    catch (e) { setErrs([errText(e)]); }
    finally { setBusy(false); }
  };
  /** ERP items → product import rows; existing products are matched by code, SKU, barcode or ERP code. */
  const prepared = useMemo(() => {
    if (!items) return null;
    const list = items.filter((i) => !f.onlyActive || i.active);
    const notes: string[][] = [];
    const rows: RowValues[] = list.map((i) => {
      const hit = findProduct(i.itemCode, ctx.products) ?? (i.barcode ? findProduct(i.barcode, ctx.products) : null);
      const n: string[] = [];
      const hsn = i.hsn && /^\d{8}$/.test(i.hsn) ? i.hsn : '';
      if (i.hsn && !hsn) n.push(`HSN “${i.hsn}” isn't 8 digits — not copied`);
      const gtin = i.barcode && !gtinError(i.barcode) ? i.barcode : '';
      if (i.barcode && !gtin) n.push(`Barcode “${i.barcode}” isn't a valid GTIN — not copied`);
      notes.push(n);
      return {
        code: hit ? hit.product.code : i.itemCode, name: i.name, type: types.find((t) => t.id === f.typeId)?.name ?? '', portfolio: pf?.name ?? '', category: pf?.categories.find((c) => c.id === f.categoryId)?.name ?? '',
        brand: i.brand ?? '', hsn, gst: i.gstRate !== null ? `${i.gstRate}%` : '', uom: i.uom ?? '', mrp: '', gtin: hit ? '' : gtin, erp: i.itemCode,
        tracking: i.tracking ?? '', cost: i.cost !== null ? String(i.cost) : '', description: i.description ?? '',
      };
    });
    const results = entity.validate(rows, ctx, {});
    return { list, results, notes };
  }, [items, f, ctx, entity, pf, types]);
  const usable = (r: RowResult) => !r.errors.length && !(r.action === 'update' && r.warnings.some((w) => w.startsWith('No changes')));
  const chosen = prepared ? prepared.results.filter((r, i) => usable(r) && !skip.has(i)) : [];
  const apply = () => {
    if (!chosen.length) return;
    const b = runImport(entity, chosen, ctx, {}, `${erpName} items ${new Date().toISOString().slice(0, 10)}`, `${erpName} (live)`);
    showToast(`${erpName}: ${b.summary}. Undo from Data Import → History if needed.`, 'success');
    onClose();
  };
  return (
    <Modal open size="xl" title="Import products from the ERP" subtitle="Items are matched to Product Master by code, SKU, barcode or ERP code. Matches get their ERP code, HSN, GST, cost and description updated; new items are created as Draft and go through approval." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!chosen.length} onClick={apply}>Import {chosen.length} item(s)</Button></>}>
      <div className="g2-stack">
        {!erps.length ? <NoLiveErp /> : <>
          {errs.length > 0 && <ErrorList errors={errs} title="The ERP didn’t answer" />}
          <FormGrid cols={3}>
            <Field label="ERP"><Select value={erp} options={erps.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => { setErp(v); setItems(null); }} /></Field>
            <Field label="New items: product type" hint="Product type of items not in VinFlux yet"><Select value={f.typeId} options={types.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => setF({ ...f, typeId: v })} /></Field>
            <Field label="New items: portfolio"><Select value={f.portfolioId} options={ctx.portfolios.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => setF({ ...f, portfolioId: v, categoryId: '' })} /></Field>
            <Field label="New items: category"><Select value={f.categoryId} placeholder="First category" options={(pf?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => setF({ ...f, categoryId: v })} /></Field>
            <Field label=" "><Checkbox checked={f.onlyActive} onChange={(v) => setF({ ...f, onlyActive: v })} label="Only active items" /></Field>
            <Field label=" "><Button variant="primary" icon={<CloudDownload size={14} />} disabled={busy || !erp} onClick={() => void fetchItems()}>{busy ? 'Reading…' : `Read items from ${erpName}`}</Button></Field>
          </FormGrid>
          {prepared && (
            <>
              <div className="g2-small g2-muted">{prepared.list.length} item(s) · {prepared.results.filter((r) => r.action === 'update' && usable(r)).length} to update · {prepared.results.filter((r) => r.action === 'create' && usable(r)).length} new · {prepared.results.filter((r) => r.errors.length).length} with problems · {prepared.results.filter((r) => r.warnings.some((w) => w.startsWith('No changes'))).length} already up to date</div>
              <div className="g2-table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}><table className="g2-table">
                <thead><tr><th style={{ width: 36 }} /><th>ERP item</th><th>VinFlux</th><th>HSN · GST · cost</th><th>Tracking</th><th>Notes</th></tr></thead>
                <tbody>{prepared.results.map((r, i) => {
                  const it = prepared.list[i];
                  const ok = usable(r);
                  return (
                    <tr key={it.erpId} style={{ opacity: ok ? 1 : 0.6 }}>
                      <td>{ok && <Checkbox checked={!skip.has(i)} onChange={(v) => { const n = new Set(skip); if (v) n.delete(i); else n.add(i); setSkip(n); }} />}</td>
                      <td><div className="g2-strong">{it.itemCode}</div><div className="g2-cell-sub">{it.name}{it.active ? '' : ' · inactive'}</div></td>
                      <td>{r.errors.length ? <Badge tone="red">Problem</Badge> : r.action === 'update' ? (ok ? <Badge tone="blue">Update {r.values.code}</Badge> : <Badge tone="slate">Up to date</Badge>) : <Badge tone="green">New (Draft)</Badge>}</td>
                      <td className="g2-small">{r.values.hsn || '—'} · {r.values.gst || '—'} · {r.values.cost ? `₹${r.values.cost}` : '—'}</td>
                      <td className="g2-small">{it.tracking ?? '—'}</td>
                      <td className="g2-small" style={{ maxWidth: 320 }}>{[...r.errors, ...r.warnings.filter((w) => !w.startsWith('Created as Draft')), ...prepared.notes[i]].join(' · ') || '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </>
          )}
        </>}
      </div>
    </Modal>
  );
};

/* ------------------------------------ Customers ------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/\b(pvt|private|ltd|limited|llp|the)\b/g, '').replace(/[^a-z0-9]/g, '');
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const PartnerErpImportDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser, showToast } = useApp();
  const partners = usePartners().data ?? [];
  const config = useConfig().data;
  const erps = liveErps();
  const [erp, setErp] = useState(erps[0]?.id ?? '');
  const [typeId, setTypeId] = useState('');
  const [rows, setRows] = useState<ErpCustomerLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const erpName = CONNECTORS.find((c) => c.id === erp)?.name ?? 'ERP';
  const map = erp ? connectorSettings(erp).customerMap ?? {} : {};
  const types = (config?.partnerTypes ?? []).filter((t) => t.status === 'Active');
  const fetchRows = async () => {
    setBusy(true); setErrs([]);
    try { const r = await callErp<{ customers: ErpCustomerLine[] }>(erp, 'customers'); setRows(r.customers.filter((c) => c.active)); setSkip(new Set()); setPick({}); }
    catch (e) { setErrs([errText(e)]); }
    finally { setBusy(false); }
  };
  /** Match: already linked → GSTIN → name; otherwise a new onboarding draft. */
  const matched = useMemo(() => (rows ?? []).map((c) => {
    const linked = partners.find((p) => map[p.id] === c.code);
    const byGst = c.gstin ? partners.find((p) => p.gst && p.gst.toUpperCase() === c.gstin!.toUpperCase()) : undefined;
    const byName = partners.find((p) => norm(p.name) === norm(c.name) || norm(p.businessName ?? '') === norm(c.name));
    const p = pick[c.code] !== undefined ? partners.find((x) => x.id === pick[c.code]) : linked ?? byGst ?? byName;
    const how = pick[c.code] !== undefined ? (p ? 'Chosen' : 'New') : linked ? 'Linked' : byGst ? 'GSTIN' : byName ? 'Name' : 'New';
    return { c, p: p ?? null, how };
  }), [rows, partners, map, pick]);
  const todo = matched.filter((m) => !skip.has(m.c.code) && m.how !== 'Linked');
  const apply = async () => {
    const s = connectorSettings(erp);
    const next = { ...(s.customerMap ?? {}) };
    let linked = 0; let created = 0; const fail: string[] = [];
    for (const m of todo) {
      if (m.p) { next[m.p.id] = m.c.code; linked += 1; continue; }
      if (!typeId) { fail.push(`${m.c.name}: choose the partner type for new partners.`); continue; }
      try {
        const code = await partnerService.suggestCode();
        const gst = m.c.gstin && GSTIN.test(m.c.gstin.toUpperCase()) ? m.c.gstin.toUpperCase() : '';
        const p = await partnerService.saveDraft(null, {
          code, name: m.c.name, partnerTypeId: typeId, contactPerson: '', email: m.c.email ?? '', phone: m.c.phone ?? '', businessName: m.c.name,
          address: { line1: m.c.address ?? '', city: m.c.city ?? '', state: m.c.state ?? '', pincode: m.c.pincode ?? '' }, gst, pan: gst ? gst.slice(2, 12) : '',
          kycDocuments: [], territoryIds: [],
        }, emptyExtras(), 0, currentUser.name) as Partner;
        next[p.id] = m.c.code; created += 1;
      } catch (e) { fail.push(`${m.c.name}: ${(e as Error).message}`); }
    }
    saveSettings(erp, { ...connectorSettings(erp), customerMap: next });
    if (fail.length) setErrs(fail);
    showToast(`${erpName}: ${linked} partner(s) linked, ${created} new partner draft(s) to finish onboarding.`, fail.length ? 'warning' : 'success');
    if (!fail.length) onClose();
  };
  return (
    <Modal open size="xl" title="Import customers from the ERP" subtitle="Each ERP customer is linked to a VinFlux partner (by GSTIN, then name) so sales orders use the right ERP customer. Customers not in VinFlux start onboarding as drafts — KYC, territories and route are finished in the onboarding wizard."
      onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!todo.length} onClick={() => void apply()}>Link / create {todo.length}</Button></>}>
      <div className="g2-stack">
        {!erps.length ? <NoLiveErp /> : <>
          {errs.length > 0 && <ErrorList errors={errs} />}
          <FormGrid cols={3}>
            <Field label="ERP"><Select value={erp} options={erps.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => { setErp(v); setRows(null); }} /></Field>
            <Field label="New partners: type" required hint="Distributor, dealer, hospital…"><Select value={typeId} placeholder="Choose…" options={types.map((t) => ({ value: t.id, label: t.name }))} onChange={setTypeId} /></Field>
            <Field label=" "><Button variant="primary" icon={<CloudDownload size={14} />} disabled={busy || !erp} onClick={() => void fetchRows()}>{busy ? 'Reading…' : `Read customers from ${erpName}`}</Button></Field>
          </FormGrid>
          {rows && (
            <div className="g2-table-wrap" style={{ maxHeight: 440, overflow: 'auto' }}><table className="g2-table">
              <thead><tr><th style={{ width: 36 }} /><th>ERP customer</th><th>GSTIN</th><th>City / state</th><th style={{ minWidth: 260 }}>VinFlux partner</th><th>Match</th></tr></thead>
              <tbody>
                {matched.length === 0 && <tr><td colSpan={6} className="g2-muted">No active customers in the ERP.</td></tr>}
                {matched.map(({ c, p, how }) => (
                  <tr key={c.code} style={{ opacity: how === 'Linked' ? 0.6 : 1 }}>
                    <td>{how !== 'Linked' && <Checkbox checked={!skip.has(c.code)} onChange={(v) => { const n = new Set(skip); if (v) n.delete(c.code); else n.add(c.code); setSkip(n); }} />}</td>
                    <td><div className="g2-strong">{c.name}</div><div className="g2-cell-sub">{c.code}{c.email ? ` · ${c.email}` : ''}</div></td>
                    <td className="g2-mono g2-small">{c.gstin ?? '—'}{c.gstin && !GSTIN.test(c.gstin.toUpperCase()) ? <div className="g2-cell-sub" style={{ color: '#b45309' }}>not a valid GSTIN</div> : null}</td>
                    <td className="g2-small">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{how === 'Linked' ? p?.name : <SearchableSelect value={p?.id ?? ''} placeholder="New partner (draft)" clearable options={partners.map((x) => ({ value: x.id, label: x.name, description: `${x.code}${x.gst ? ` · ${x.gst}` : ''}` }))} onChange={(v) => setPick({ ...pick, [c.code]: v ?? '' })} />}</td>
                    <td>{how === 'Linked' ? <Badge tone="slate">Already linked</Badge> : how === 'New' ? <Badge tone="green">New draft</Badge> : <Badge tone="blue">{how === 'Chosen' ? 'Chosen' : `By ${how}`}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </>}
      </div>
    </Modal>
  );
};

/* ------------------------------------ Locations ------------------------------------ */

/** Integration Hub: ERP locations → map to a warehouse, or create the warehouse from the location. */
export const ErpLocationsPanel: React.FC<{ connectorId: string; plantMap: Record<string, string>; onMap: (loc: string, warehouseCode: string) => void; canEdit: boolean }> = ({ connectorId, plantMap, onMap, canEdit }) => {
  const { warehouses, branches, addWarehouse, showToast } = useApp();
  const [locs, setLocs] = useState<ErpLocationLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [branchId, setBranchId] = useState(branches.find((b) => b.status === 'Active')?.id ?? '');
  const load = async () => {
    setBusy(true); setErr('');
    try { setLocs((await callErp<{ locations: ErpLocationLine[] }>(connectorId, 'locations')).locations); }
    catch (e) { setErr(errText(e)); }
    finally { setBusy(false); }
  };
  const create = (l: ErpLocationLine) => {
    const br = branches.find((b) => b.id === branchId);
    if (!br) { showToast('Choose the branch the new warehouse belongs to.', 'warning'); return; }
    const base = `WH-${l.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X')}`;
    let n = warehouses.length + 1; let code = `${base}-${String(n).padStart(2, '0')}`;
    while (warehouses.some((w) => w.code === code)) code = `${base}-${String(++n).padStart(2, '0')}`;
    const now = new Date().toISOString();
    const w: Warehouse = { id: `wh-${Date.now().toString(36)}`, name: l.name, code, branchId: br.id, branchName: br.name, address: l.address ?? '', state: l.state ?? br.state, city: l.city ?? br.city, pinCode: l.pincode ?? '',
      manager: '', contactNumber: '', email: '', status: 'Active', createdAt: now, updatedAt: now };
    const r = addWarehouse(w);
    showToast(r.success ? `Warehouse ${code} created from “${l.name}” and mapped — save the connector settings.` : r.message, r.success ? 'success' : 'danger');
    if (r.success) onMap(l.code, code);
  };
  return (
    <div className="g2-stack" style={{ marginTop: 10 }}>
      <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" icon={<CloudDownload size={13} />} disabled={busy} onClick={() => void load()}>{busy ? 'Reading…' : 'Read locations from the ERP'}</Button>
        {locs && canEdit && <div style={{ width: 240 }}><Select value={branchId} placeholder="Branch for new warehouses" options={branches.filter((b) => b.status === 'Active').map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))} onChange={setBranchId} /></div>}
      </div>
      {err && <Alert tone="error">{err}</Alert>}
      {locs && (
        <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}><table className="g2-table">
          <thead><tr><th>ERP location</th><th>Address</th><th style={{ minWidth: 260 }}>VinFlux warehouse</th></tr></thead>
          <tbody>
            {locs.length === 0 && <tr><td colSpan={3} className="g2-muted">The ERP returned no locations.</td></tr>}
            {locs.map((l) => (
              <tr key={l.code}>
                <td className="g2-strong">{l.name}{l.code !== l.name ? <div className="g2-cell-sub g2-mono">{l.code}</div> : null}</td>
                <td className="g2-small">{[l.address, l.city, l.state, l.pincode].filter(Boolean).join(', ') || '—'}</td>
                <td><div className="g2-row" style={{ gap: 6 }}>
                  <div style={{ flex: 1 }}><Select value={plantMap[l.code] ?? ''} disabled={!canEdit} placeholder="Not mapped" options={warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` }))} onChange={(v) => onMap(l.code, v)} /></div>
                  {canEdit && !plantMap[l.code] && <Button size="sm" onClick={() => create(l)}>Create warehouse</Button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
};
