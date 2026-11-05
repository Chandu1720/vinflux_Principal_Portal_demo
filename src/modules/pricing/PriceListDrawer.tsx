import React, { useMemo, useState } from 'react';
import { CopyPlus, ListPlus, Percent, Trash2, X } from 'lucide-react';
import { ProductPicker } from './ProductPicker';
import {
  Alert, Badge, Button, ErrorList, Field, FormGrid, FormSection, Input, Modal, MultiSelect, NumberInput, SearchableSelect, Select, Textarea,
} from '../../platform/ui';
import { useApp } from '../../context/AppContext.tsx';
import { useChannels, useConfig, usePartners, useTerritories } from '../gtm-v2/hooks/useGtmData';
import { partnerChannelId } from '../gtm-v2/utils/eligibility';
import {
  TYPE_LABEL, approveList, checkList, deleteDraft, getList, gstOf, headerErrors, rejectList, reviseList, saveDraft, submitList,
} from './pricingStore';
import type { PriceLine, PriceList } from './pricingStore';
import { channelPrice, ladderFor, settings, today } from './pricingStore';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const STATUS_TONE: Record<PriceList['status'], 'slate' | 'amber' | 'green' | 'red' | 'blue'> = { Draft: 'slate', Pending: 'amber', Active: 'green', Superseded: 'slate', Rejected: 'red' };

export const PriceListDrawer: React.FC<{ list: PriceList; onClose: () => void; onOpen: (l: PriceList) => void }> = ({ list, onClose, onOpen }) => {
  const { products, currentUser, showToast } = useApp();
  const channels = useChannels().data ?? [];
  const partners = usePartners().data ?? [];
  const territories = useTerritories().data ?? [];
  const config = useConfig().data;
  const [l, setL] = useState<PriceList>(list);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
  const [bulkPct, setBulkPct] = useState<number | null>(null);
  const [lineQ, setLineQ] = useState('');
  const perms = currentUser.permissions;
  const editable = ['Draft', 'Rejected'].includes(l.status) && !!perms.canEditPricing;
  const canApprove = l.status === 'Pending' && !!perms.canApprovePricing;
  /** Price checks + (for national channel lists) the ladder against the other channels' current prices. */
  const issues = useMemo(() => {
    const base = checkList(l, products);
    if (l.type !== 'CHANNEL' || l.territoryIds.length || !l.channelId) return base;
    const st = settings();
    const tiers = channels.filter((c) => c.status === 'Active' && c.tradeModel !== 'AGENT' && c.id !== 'chn-direct')
      .map((c) => ({ channelId: c.id, name: st.tierNames[c.id] || c.name, rank: c.tierRank, resell: !(c.canBeEndpoint && c.tierRank >= 9) }));
    const on = l.validFrom > today() ? l.validFrom : today();
    l.lines.forEach((ln) => {
      const p = products.find((x) => x.id === ln.productId);
      if (!p || !(ln.price > 0)) return;
      const prices = Object.fromEntries(tiers.map((t) => [t.channelId, t.channelId === l.channelId ? ln.price : channelPrice(l.principalId, t.channelId, p.id, on).current?.price ?? null]));
      ladderFor(p, tiers, prices).flatMap((c) => c.issues.filter((i) => /ladder|keeps/.test(i)))
        .forEach((text) => base.push({ lineId: ln.id, productId: ln.productId, level: 'warning', text }));
    });
    return base;
  }, [l, products, channels]);
  const set = <K extends keyof PriceList>(k: K, v: PriceList[K]) => setL((x) => ({ ...x, [k]: v }));
  const setLine = (id: string, patch: Partial<PriceLine>) => set('lines', l.lines.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const { portfolios } = useApp();
  const pfName = (id?: string) => portfolios.find((x) => x.id === id)?.name ?? 'Other';
  /** Lines grouped by portfolio (then name) so long lists stay readable. */
  const groups = useMemo(() => {
    const rows = l.lines.map((ln) => ({ ln, p: products.find((x) => x.id === ln.productId) }))
      .filter(({ p }) => !lineQ || [p?.name ?? '', p?.code ?? ''].some((x) => x.toLowerCase().includes(lineQ.toLowerCase())));
    const by = new Map<string, typeof rows>();
    rows.forEach((r) => { const k = r.p?.portfolioId ?? ''; by.set(k, [...(by.get(k) ?? []), r]); });
    return [...by.entries()].map(([k, rs]) => ({ id: k, name: pfName(k), rows: rs.sort((a, b) => (a.p?.name ?? '').localeCompare(b.p?.name ?? '')) })).sort((a, b) => a.name.localeCompare(b.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.lines, products, lineQ, portfolios]);
  const r2 = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);
  const applyBulk = () => {
    if (!bulkPct) return;
    const f = 1 + bulkPct / 100;
    set('lines', l.lines.map((x) => ({ ...x, price: r2(x.price * f), slabs: x.slabs.map((sl) => ({ ...sl, price: r2(sl.price * f) })) })));
    showToast(`All ${l.lines.length} price(s) ${bulkPct > 0 ? 'raised' : 'lowered'} by ${Math.abs(bulkPct)}% (slabs too). Check the lines, then save.`, 'info');
    setBulkPct(null);
  };
  const partnerOpts = partners.filter((p) => p.status === 'Active' && (l.type !== 'CONTRACT' || p.institution))
    .map((p) => ({ value: p.id, label: p.name, description: p.institution?.hospitalGroup || p.code }));
  const done = (r: { ok: boolean; message: string; errors?: string[] }, tone: 'success' | 'warning' = 'success') => {
    if (!r.ok) { setErrors([r.message, ...(r.errors ?? [])]); return; }
    showToast(r.message, tone); onClose();
  };
  const revise = () => {
    const n = reviseList(l.id, currentUser.name);
    if (!n) { setErrors(['A newer draft or pending version already exists for this list.']); return; }
    showToast(`Draft v${n.version} created — change prices and submit.`, 'success'); onOpen(n);
  };

  const footer = (
    <>
      <Button onClick={onClose}>Close</Button>
      {editable && !!getList(l.id) && <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => done(deleteDraft(l.id), 'warning')}>Delete draft</Button>}
      {editable && <Button onClick={() => { const r = saveDraft(l, currentUser.name); if (r.ok) { showToast(r.message, 'success'); setL(getList(l.id) ?? l); setErrors([]); } else setErrors([r.message]); }}>Save draft</Button>}
      {editable && <Button variant="primary" onClick={() => done(submitList(l, currentUser.name, products, note))}>Submit for approval</Button>}
      {canApprove && <Button variant="danger" onClick={() => done(rejectList(l.id, currentUser.name, note), 'warning')}>Reject</Button>}
      {canApprove && <Button variant="primary" onClick={() => done(approveList(l.id, currentUser.name, products, note))}>Approve</Button>}
      {l.status === 'Active' && perms.canEditPricing && <Button variant="primary" icon={<CopyPlus size={14} />} onClick={revise}>Revise prices (new version)</Button>}
    </>
  );

  const warnCount = issues.filter((i) => i.level === 'warning').length;
  return (
    <Modal open size="xl" title={l.name || `New ${TYPE_LABEL[l.type].toLowerCase()}`}
      subtitle={<span className="g2-row">{TYPE_LABEL[l.type]} · v{l.version} <Badge tone={STATUS_TONE[l.status]} dot>{l.status === 'Pending' ? 'Pending approval' : l.status}</Badge>{l.code && <span className="g2-mono g2-small">{l.code}</span>}</span>}
      onClose={onClose} footer={footer}>
      <div className="g2-stack">
        {errors.length > 0 && <ErrorList errors={errors} title="Can’t continue" />}
        {l.status === 'Rejected' && l.rejectionReason && <Alert tone="error">Rejected: {l.rejectionReason}</Alert>}
        {l.status === 'Pending' && <Alert tone="warn">Submitted by <strong>{l.submittedBy}</strong> on {l.submittedAt}. {canApprove ? (l.submittedBy === currentUser.name ? 'You submitted it, so another approver must approve.' : 'Check the prices below, then approve or reject.') : 'Waiting for a pricing approver.'}</Alert>}
        {l.status === 'Pending' && warnCount > 0 && <Alert tone="warn">{warnCount} warning(s) on the lines below (floor price, margins or price ladder) — approving accepts them.</Alert>}

        <FormSection title="Applies to">
          <FormGrid cols={3}>
            <Field label="Name" required><Input value={l.name} disabled={!editable} onChange={(e) => set('name', e.target.value)} placeholder={l.type === 'CONTRACT' ? 'e.g. Apollo Group rate contract 2026' : 'e.g. Distributor price list FY26-27'} /></Field>
            {l.type !== 'CONTRACT' && <Field label="Sales channel" required={l.type === 'CHANNEL'}>
              <Select value={l.channelId ?? ''} disabled={!editable || l.type === 'PARTNER'} placeholder="Choose…" options={channels.filter((c) => c.status === 'Active').map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => set('channelId', v || null)} />
            </Field>}
            {l.type === 'CHANNEL' && <Field label="Territories" hint="Empty = everywhere. A territory list wins over the national one.">
              <MultiSelect values={l.territoryIds} disabled={!editable} placeholder="Everywhere" options={territories.filter((t) => t.status === 'Active').map((t) => ({ value: t.id, label: t.name, description: t.code }))} onChange={(v) => set('territoryIds', v)} />
            </Field>}
            {l.type === 'PARTNER' && <Field label="Partner" required>
              <SearchableSelect value={l.partnerIds[0] ?? ''} disabled={!editable} options={partnerOpts} placeholder="Choose partner…"
                onChange={(v) => { const p = partners.find((x) => x.id === v); setL((x) => ({ ...x, partnerIds: v ? [v] : [], channelId: p && config ? partnerChannelId(p, config.partnerTypes) : x.channelId })); }} />
            </Field>}
            {l.type === 'CONTRACT' && <Field label="Hospitals" required hint="All units of a group can share one contract">
              <MultiSelect values={l.partnerIds} disabled={!editable} placeholder="Choose hospitals…" options={partnerOpts} onChange={(v) => set('partnerIds', v)} />
            </Field>}
            {l.type === 'CONTRACT' && <Field label="Tender / contract number"><Input value={l.contractRef ?? ''} disabled={!editable} onChange={(e) => set('contractRef', e.target.value)} /></Field>}
            {l.type === 'CONTRACT' && <Field label="Committed value (₹)"><NumberInput value={l.committedValue ?? null} disabled={!editable} allowEmpty onChange={(v) => set('committedValue', v)} /></Field>}
            <Field label="Valid from" required><Input type="date" value={l.validFrom} disabled={!editable} onChange={(e) => set('validFrom', e.target.value)} /></Field>
            <Field label="Valid to" required={l.type === 'CONTRACT'} hint={l.type === 'CONTRACT' ? undefined : 'Empty = until replaced'}><Input type="date" value={l.validTo ?? ''} disabled={!editable} onChange={(e) => set('validTo', e.target.value || null)} /></Field>
          </FormGrid>
          <Field label="Notes"><Textarea rows={2} value={l.notes} disabled={!editable} onChange={(e) => set('notes', e.target.value)} /></Field>
        </FormSection>

        <FormSection title={`Prices (${l.lines.length})`} description="Prices are before GST. Each line is checked against MRP, the government ceiling and the floor price."
          actions={editable && <Button variant="primary" icon={<ListPlus size={15} />} onClick={() => setPicker(true)}>Add products</Button>}>
          {(l.lines.length > 0) && (
            <div className="g2-row" style={{ marginBottom: 10, gap: 8 }}>
              <input className="g2-input" style={{ width: 240 }} placeholder="Find a product in this list…" value={lineQ} onChange={(e) => setLineQ(e.target.value)} aria-label="Find product in list" />
              <span className="g2-spacer" />
              {editable && <>
                <span className="g2-small g2-muted">Change all prices by</span>
                <div style={{ width: 90 }}><NumberInput value={bulkPct} allowEmpty placeholder="±%" onChange={setBulkPct} aria-label="Change all prices by percent" /></div>
                <Button size="sm" icon={<Percent size={13} />} disabled={!bulkPct} onClick={applyBulk}>Apply</Button>
                <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => set('lines', [])}>Remove all</Button>
              </>}
            </div>
          )}
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Product</th><th style={{ width: 140 }}>Price (ex-GST)</th><th>Quantity slabs</th><th style={{ textAlign: 'right' }}>Incl. GST</th><th style={{ textAlign: 'right' }}>MRP</th><th>Checks</th>{editable && <th />}</tr></thead>
            <tbody>
              {l.lines.length === 0 && <tr><td colSpan={7} className="g2-muted">No products yet.{editable ? ' Click “Add products” to pick all products or drill down by portfolio — or import a price file in Data Import.' : ''}</td></tr>}
              {groups.map((g) => (<React.Fragment key={g.id}>
              <tr><td colSpan={7} style={{ background: 'var(--g2-slate-bg)', fontWeight: 600, fontSize: 12.5 }}>{g.name} <span className="g2-muted" style={{ fontWeight: 400 }}>· {g.rows.length} product(s)</span></td></tr>
              {g.rows.map(({ ln, p }) => {
                const gst = gstOf(p);
                const mrp = p?.pricingReference?.mrp ?? 0;
                const li = issues.filter((i) => i.lineId === ln.id);
                return (
                  <tr key={ln.id}>
                    <td><div className="g2-strong" style={{ maxWidth: 280 }}>{p?.name ?? ln.productId}</div><div className="g2-cell-sub">{p?.code} · GST {gst}%</div></td>
                    <td>{editable ? <NumberInput value={ln.price || null} onChange={(v) => setLine(ln.id, { price: v ?? 0 })} aria-label={`Price ${p?.code}`} /> : <span className="g2-strong">{inr(ln.price)}</span>}</td>
                    <td>
                      <div className="g2-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {ln.slabs.map((s, i) => (
                          <span key={i} className="g2-chip" style={{ gap: 4 }}>
                            {editable ? <>
                              <input className="g2-input" style={{ width: 54, height: 24, padding: '0 4px' }} type="number" value={s.minQty} aria-label="Slab quantity" onChange={(e) => setLine(ln.id, { slabs: ln.slabs.map((x, j) => (j === i ? { ...x, minQty: Number(e.target.value) } : x)) })} />+ @
                              <input className="g2-input" style={{ width: 80, height: 24, padding: '0 4px' }} type="number" value={s.price} aria-label="Slab price" onChange={(e) => setLine(ln.id, { slabs: ln.slabs.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })} />
                              <button type="button" className="g2-icon-btn" style={{ width: 18, height: 18 }} aria-label="Remove slab" onClick={() => setLine(ln.id, { slabs: ln.slabs.filter((_, j) => j !== i) })}><X size={11} /></button>
                            </> : <>{s.minQty}+ @ {inr(s.price)}</>}
                          </span>
                        ))}
                        {editable && <Button size="sm" variant="ghost" onClick={() => setLine(ln.id, { slabs: [...ln.slabs, { minQty: (ln.slabs[ln.slabs.length - 1]?.minQty ?? 0) + 10, price: Math.round((ln.slabs[ln.slabs.length - 1]?.price ?? ln.price) * 0.98) }] })}>+ slab</Button>}
                        {!editable && !ln.slabs.length && <span className="g2-muted">—</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{ln.price ? inr(Math.round(ln.price * (1 + gst / 100))) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{mrp ? inr(mrp) : <span className="g2-muted">—</span>}</td>
                    <td style={{ maxWidth: 280 }}>
                      {li.length === 0 ? <Badge tone="green" dot>OK</Badge> : li.map((i) => <div key={i.text} className="g2-small" style={{ color: i.level === 'error' ? '#b91c1c' : '#b45309' }}>{i.level === 'error' ? '✕' : '!'} {i.text}</div>)}
                    </td>
                    {editable && <td><button type="button" className="g2-icon-btn" aria-label="Remove line" onClick={() => set('lines', l.lines.filter((x) => x.id !== ln.id))}><Trash2 size={14} /></button></td>}
                  </tr>
                );
              })}
              </React.Fragment>))}
            </tbody>
          </table></div>
        </FormSection>

        {(editable || canApprove) && (
          <Field label={canApprove ? 'Approver comment (required to reject)' : 'Note for the approver'}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        )}
        {headerErrors(l).length > 0 && editable && <div className="g2-small g2-muted">Still needed: {headerErrors(l).join(' ')}</div>}

        {l.history.filter((h) => h.at).length > 0 && (
          <FormSection title="History">
            {l.history.filter((h) => h.at).slice().reverse().map((h, i) => (
              <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{h.action}</span><span className="g2-muted">{h.by} · {new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{h.note ? ` — ${h.note}` : ''}</span></div>
            ))}
          </FormSection>
        )}
      </div>
      {picker && <ProductPicker list={l} onClose={() => setPicker(false)} onAdd={(ls) => { set('lines', [...l.lines, ...ls]); showToast(`${ls.length} product(s) added.`, 'success'); }} />}
    </Modal>
  );
};
