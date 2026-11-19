/**
 * Replenishment (NV2): suggested orders per partner from stock cover; send to the partner or order on its behalf.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, PackagePlus, Phone, Send, Target, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { Linkify } from '../../platform/Linkify';
import { useApp } from '../../context/AppContext.tsx';
import { useConfig, usePartners } from '../gtm-v2/hooks/useGtmData';
import { useOrderCtx } from '../orders/useOrderCtx';
import { subscribeOrders } from '../orders/orderStore';
import { ensurePlatformDemo, ensureSecondaryDemo, subscribeSecondary } from '../secondary/secondaryStore';
import {
  coverRules, createProposal, deleteRule, ensureReplenishmentDemo, getProposal, proposals as allProposals, replSettings, replStats, respondProposal, saveReplSettings, saveRule, sendProposal,
  subscribeReplenishment, suggest, withdrawProposal,
} from './replenishmentStore';
import type { CoverRule, PartnerSuggest, ProposalStatus, RuleScope } from './replenishmentStore';

const TONE: Record<ProposalStatus, BadgeTone> = { Draft: 'slate', Sent: 'blue', Accepted: 'green', Rejected: 'red', Expired: 'amber', Withdrawn: 'slate' };
const SCOPES: { value: RuleScope; label: string }[] = [{ value: 'channel', label: 'Channel (partner type)' }, { value: 'partner', label: 'Partner' }, { value: 'product', label: 'Product' }, { value: 'partner-product', label: 'Partner + product' }];

/** One partner's suggestion card. */
const PartnerCard: React.FC<{ s: PartnerSuggest; canEdit: boolean }> = ({ s, canEdit }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const ctx = useOrderCtx();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(s.rows.map((r) => [r.productId, r.suggested])));
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(s.rows.map((r) => [r.productId, r.suggested > 0])));
  const [sent, setSent] = useState<string | null>(null);
  const sig = s.rows.map((r) => `${r.productId}:${r.suggested}`).join('|');
  useEffect(() => { setQty(Object.fromEntries(s.rows.map((r) => [r.productId, r.suggested]))); setOn(Object.fromEntries(s.rows.map((r) => [r.productId, r.suggested > 0]))); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const [errs, setErrs] = useState<string[]>([]);
  const lines = s.rows.filter((r) => on[r.productId] && (qty[r.productId] ?? 0) > 0).map((r) => ({ productId: r.productId, name: r.name, suggested: r.suggested, qty: qty[r.productId], stock: r.stock, avgDaily: r.avgDaily, targetDays: r.targetDays }));
  const go = (phone: boolean) => {
    setErrs([]);
    const c = createProposal(activePrincipal.id, { id: s.partnerId, name: s.partnerName }, lines, currentUser.name);
    if (!c.ok || !c.id) { setErrs([c.message]); return; }
    if (phone) {
      const r = respondProposal(c.id, true, Object.fromEntries(lines.map((l) => [l.productId, l.qty])), '', currentUser.name, 'Phone / on behalf', ctx);
      if (!r.ok) { setErrs(r.errors ?? [r.message]); withdrawProposal(c.id, 'System', 'Order could not be created'); return; }
      showToast(`${getProposal(c.id)?.orderCode} created from the suggestion.`, 'success');
    } else {
      const r = sendProposal(c.id, currentUser.name);
      if (!r.ok) { setErrs([r.message]); return; }
      setSent(r.link ?? null); showToast(r.message, 'success');
    }
  };
  const total = s.rows.filter((r) => r.suggested > 0).length;
  return (
    <Card title={<span className="g2-row" style={{ gap: 8 }}>{s.partnerName}{total ? <Badge tone="amber">{total} to reorder</Badge> : <Badge tone="green">Covered</Badge>}</span>}
      subtitle={`Data for ${s.period} · ${s.dataAge === 0 ? 'today' : `${s.dataAge} day(s) old`}`}
      actions={canEdit && lines.length > 0 ? <div className="g2-row" style={{ gap: 6 }}>
        <Button size="sm" icon={<Phone size={14} />} disabled={!ctx} onClick={() => go(true)}>Order now (agreed by phone)</Button>
        <Button size="sm" variant="primary" icon={<Send size={14} />} onClick={() => go(false)}>Send to partner</Button>
      </div> : undefined} flush>
      {errs.length > 0 && <div style={{ padding: '0 16px' }}><ErrorList errors={errs} title="Couldn’t do that" /></div>}
      {sent && <div style={{ padding: '0 16px 12px' }}><Alert tone="success">Sent. The partner gets this link to accept, change or reject: <Linkify text={sent} /></Alert></div>}
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr><th style={{ width: 32 }} /><th>Product</th><th style={{ textAlign: 'right' }}>Partner stock</th><th style={{ textAlign: 'right' }}>In transit</th><th style={{ textAlign: 'right' }}>On order</th><th style={{ textAlign: 'right' }}>Sold / day</th><th style={{ textAlign: 'right' }}>Cover now</th><th>Target</th><th style={{ textAlign: 'right' }}>Suggested</th><th style={{ width: 110 }}>Order qty</th></tr></thead>
        <tbody>{s.rows.map((r) => (
          <tr key={r.productId} style={{ opacity: r.suggested || on[r.productId] ? 1 : 0.6 }}>
            <td><Checkbox checked={!!on[r.productId]} disabled={!canEdit} onChange={(v) => setOn({ ...on, [r.productId]: v })} /></td>
            <td>{r.name}{r.pack > 1 && <div className="g2-cell-sub">pack of {r.pack}</div>}</td>
            <td style={{ textAlign: 'right' }}>{r.stock}</td>
            <td style={{ textAlign: 'right' }}>{r.transit || '—'}</td>
            <td style={{ textAlign: 'right' }}>{r.open || '—'}{r.sentQty > 0 && <div className="g2-cell-sub">+{r.sentQty} suggested</div>}</td>
            <td style={{ textAlign: 'right' }}>{r.avgDaily}</td>
            <td style={{ textAlign: 'right' }}>{r.coverNow === null ? '—' : <span style={{ color: r.coverNow < r.targetDays / 3 ? '#b91c1c' : undefined, fontWeight: r.coverNow < r.targetDays / 3 ? 600 : undefined }}>{r.coverNow} d</span>}</td>
            <td className="g2-small">{r.targetDays} d <span className="g2-muted">· {r.targetSource}</span></td>
            <td style={{ textAlign: 'right' }}><strong>{r.suggested || '—'}</strong></td>
            <td><NumberInput value={qty[r.productId] ?? 0} disabled={!canEdit || !on[r.productId]} onChange={(v) => setQty({ ...qty, [r.productId]: Math.max(0, v ?? 0) })} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="g2-small g2-muted" style={{ padding: '8px 16px 12px' }}>Suggested = target days × sold per day − (stock + in transit + on order), rounded up to the pack.</div>
    </Card>
  );
};

const ProposalModal: React.FC<{ id: string; canEdit: boolean; onClose: () => void }> = ({ id, canEdit, onClose }) => {
  useSubscribe(subscribeReplenishment);
  const { currentUser, showToast } = useApp();
  const ctx = useOrderCtx();
  const p = getProposal(id);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries((p?.lines ?? []).map((l) => [l.productId, l.qty])));
  const [why, setWhy] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  if (!p) return null;
  const open = ['Draft', 'Sent'].includes(p.status);
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok) setErrs(r.errors ?? [r.message]); else { showToast(r.message, 'success'); onClose(); } };
  return (
    <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{p.no} · {p.partnerName} <Badge tone={TONE[p.status]} dot>{p.status}</Badge></span>}
      subtitle={`Prepared ${p.createdAt.slice(0, 16).replace('T', ' ')} by ${p.createdBy}${p.sentAt ? ` · sent ${p.sentAt.slice(0, 16).replace('T', ' ')}` : ''}${p.expiresAt && p.status === 'Sent' ? ` · link valid until ${p.expiresAt.slice(0, 16).replace('T', ' ')}` : ''}`} onClose={onClose}
      footer={open && canEdit ? <>
        <Button onClick={() => tell(withdrawProposal(p.id, currentUser.name, why))}>Withdraw</Button>
        <Button variant="danger" onClick={() => tell(respondProposal(p.id, false, {}, why, currentUser.name, 'Phone / on behalf', ctx))}>Partner rejected (by phone)</Button>
        <Button variant="primary" icon={<Phone size={15} />} disabled={!ctx} onClick={() => tell(respondProposal(p.id, true, qty, '', currentUser.name, 'Phone / on behalf', ctx))}>Partner accepted — create order</Button>
      </> : undefined}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Couldn’t do that" />}
        {p.status === 'Accepted' && p.orderId && <Alert tone="success">Accepted{p.edited ? ' with changes' : ''} by {p.respondedBy} ({p.via}) → order <Link to={`/orders?open=${p.orderId}`}>{p.orderCode}</Link>.</Alert>}
        {p.status === 'Rejected' && <Alert tone="warn">Rejected by {p.respondedBy} ({p.via}): {p.reason}</Alert>}
        {p.status === 'Sent' && p.link && <Alert tone="info">Waiting for the partner. Link: <Linkify text={p.link} /></Alert>}
        <Card flush><div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Suggested</th><th style={{ textAlign: 'right' }}>Sent</th><th style={{ width: 130, textAlign: 'right' }}>{open ? 'Partner wants' : 'Ordered'}</th></tr></thead>
          <tbody>{p.lines.map((l) => (
            <tr key={l.productId}><td>{l.name}<div className="g2-cell-sub">stock {l.stock} · {l.avgDaily}/day · target {l.targetDays} d</div></td><td style={{ textAlign: 'right' }}>{l.suggested}</td><td style={{ textAlign: 'right' }}>{l.qty}</td>
              <td style={{ textAlign: 'right' }}>{open && canEdit ? <NumberInput value={qty[l.productId] ?? 0} onChange={(v) => setQty({ ...qty, [l.productId]: Math.max(0, v ?? 0) })} /> : <span style={{ fontWeight: l.partnerQty !== undefined && l.partnerQty !== l.qty ? 700 : undefined }}>{l.partnerQty ?? '—'}</span>}</td></tr>
          ))}</tbody>
        </table></div></Card>
        {open && canEdit && <Field label="Reason (needed to reject or withdraw)"><Textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>}
        <Card title="History"><div className="g2-stack" style={{ gap: 4 }}>{p.history.map((h, k) => <div key={k} className="g2-small"><span className="g2-muted">{h.at.slice(0, 16).replace('T', ' ')} · {h.by}</span> — {h.action}{h.note ? <> (<Linkify text={h.note} />)</> : ''}</div>)}</div></Card>
      </div>
    </Modal>
  );
};

const RuleModal: React.FC<{ rule: CoverRule | null; onClose: () => void; partnerTypes: { id: string; name: string }[]; partners: { id: string; name: string; code: string }[] }> = ({ rule, onClose, partnerTypes, partners }) => {
  const { products, showToast } = useApp();
  const [r, setR] = useState<CoverRule>(rule ?? { id: '', scope: 'channel', days: 30 });
  const [err, setErr] = useState('');
  return (
    <Modal open variant="modal" title={rule ? 'Edit days-of-cover rule' : 'New days-of-cover rule'} subtitle="The most specific rule wins: partner + product, then partner, then product, then channel, then the default." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { const x = saveRule(r); if (!x.ok) setErr(x.message); else { showToast(x.message, 'success'); onClose(); } }}>Save</Button></>}>
      <div className="g2-stack">
        {err && <Alert tone="warn">{err}</Alert>}
        <FormGrid>
          <Field label="Applies to"><Select value={r.scope} options={SCOPES} onChange={(v) => setR({ id: r.id, scope: v as RuleScope, days: r.days, note: r.note })} /></Field>
          <Field label="Target days of cover" required><NumberInput value={r.days} onChange={(v) => setR({ ...r, days: v ?? 0 })} /></Field>
          {r.scope === 'channel' && <Field label="Partner type" required><Select value={r.partnerTypeId ?? ''} placeholder="Choose…" options={partnerTypes.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => setR({ ...r, partnerTypeId: v })} /></Field>}
          {(r.scope === 'partner' || r.scope === 'partner-product') && <Field label="Partner" required><SearchableSelect value={r.partnerId ?? null} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setR({ ...r, partnerId: v ?? undefined })} /></Field>}
          {(r.scope === 'product' || r.scope === 'partner-product') && <Field label="Product" required><SearchableSelect value={r.productId ?? null} options={products.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setR({ ...r, productId: v ?? undefined })} /></Field>}
          <Field label="Note"><Input value={r.note ?? ''} onChange={(e) => setR({ ...r, note: e.target.value })} /></Field>
        </FormGrid>
      </div>
    </Modal>
  );
};

const ReplenishmentPage: React.FC = () => {
  useSubscribe(subscribeReplenishment, subscribeSecondary, subscribeOrders);
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const config = useConfig().data;
  const partnersAll = usePartners().data ?? [];
  const partners = useMemo(() => partnersAll.filter((p) => !p.institution && p.status === 'Active'), [partnersAll]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'suggest';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [open, setOpen] = useState<string | null>(null);
  const [rule, setRule] = useState<CoverRule | null | 'new'>(null);
  const m = currentUser.matrix;
  const canEdit = !m || !!m.gtm?.includes('edit') || !!m.inventory?.includes('edit');
  const admin = !m || (currentUser.role ?? '').includes('Administrator');

  useEffect(() => {
    if (!partners.length || !products.length) return;
    const ps = partners.map((p) => ({ id: p.id, name: p.name, locType: (p.partnerTypeId === 'pt-cnf' ? 'CNF' : 'PARTNER') as 'CNF' | 'PARTNER' }));
    const act = products.filter((p) => p.lifecycleStatus === 'Active');
    ensureSecondaryDemo(activePrincipal.id, ps, act, 'System'); ensurePlatformDemo(activePrincipal.id, ps, act); ensureReplenishmentDemo(activePrincipal.id, ps, act);
  }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = suggest(activePrincipal.id, partners.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId })), products);
  const ok = all.filter((x) => x.ok && x.rows.length);
  const none = all.filter((x) => !x.ok);
  const toOrder = ok.filter((x) => x.rows.some((r) => r.suggested > 0));
  const units = ok.reduce((a, x) => a + x.rows.reduce((s, r) => s + r.suggested, 0), 0);
  const st = replStats(activePrincipal.id);
  const props = allProposals(activePrincipal.id);
  const s = replSettings();
  const types = (config?.partnerTypes ?? []).map((t) => ({ id: t.id, name: t.name }));
  const nameOf = (r: CoverRule) => r.scope === 'channel' ? types.find((t) => t.id === r.partnerTypeId)?.name ?? r.partnerTypeId
    : r.scope === 'partner' ? partnersAll.find((p) => p.id === r.partnerId)?.name ?? r.partnerId
    : r.scope === 'product' ? products.find((p) => p.id === r.productId)?.name ?? r.productId
    : `${partnersAll.find((p) => p.id === r.partnerId)?.name ?? r.partnerId} · ${products.find((p) => p.id === r.productId)?.name ?? r.productId}`;

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Replenishment" description="Suggested orders for each partner from what it holds and sells — sent before it runs out. Partners accept, change or reject; accepted suggestions become normal orders." />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Partners to reorder" value={toOrder.length} icon={<PackagePlus size={22} />} color="#d97706" bg="#fffbeb" foot={`${units} unit(s) suggested`} onClick={() => setTab('suggest')} />
        <KpiCard label="Waiting for partner" value={st.waiting} icon={<Send size={22} />} color="#2563eb" bg="#eff6ff" foot={st.drafts ? `${st.drafts} prepared, not sent` : 'sent suggestions'} onClick={() => setTab('sent')} />
        <KpiCard label="Accepted this month" value={st.acceptedMonth} icon={<Target size={22} />} color="#059669" bg="#ecfdf5" foot={st.acceptRate === null ? 'no answers yet' : `${st.acceptRate}% acceptance`} />
        <KpiCard label="No suggestion" value={none.length} icon={<AlertTriangle size={22} />} color="#6b7280" bg="#f3f4f6" foot="partners without fresh data" />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'suggest', label: 'Suggestions', count: toOrder.length || undefined }, { id: 'sent', label: 'Sent & answered', count: props.length || undefined }, { id: 'rules', label: 'Days of cover', count: coverRules().length + 1 }]} /></div>
        {tab === 'suggest' && (
          <div style={{ padding: 16 }} className="g2-stack">
            {ok.length === 0 && <Alert tone="info">No partner has fresh stock and sales data yet. Suggestions appear as soon as a partner’s report is accepted in Secondary Sales.</Alert>}
            {[...toOrder, ...ok.filter((x) => !toOrder.includes(x))].map((x) => <PartnerCard key={x.partnerId} s={x} canEdit={canEdit} />)}
            {none.length > 0 && (
              <Card title="No suggestion for these partners" subtitle="Suggestions need fresh, complete stock and sales data (REP-04)" flush>
                <div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Partner</th><th>Why</th><th /></tr></thead>
                  <tbody>{none.map((x) => <tr key={x.partnerId}><td>{x.partnerName}</td><td className="g2-small">{x.reason}</td><td><Link to="/secondary" className="g2-small">Secondary Sales →</Link></td></tr>)}</tbody>
                </table></div>
              </Card>
            )}
          </div>
        )}
        {tab === 'sent' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Suggestion</th><th>Partner</th><th>Products</th><th style={{ textAlign: 'right' }}>Units</th><th>Status</th><th>Order</th></tr></thead>
            <tbody>
              {props.length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing sent yet.</td></tr>}
              {props.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(p.id)}>
                  <td className="g2-mono">{p.no}<div className="g2-cell-sub">{(p.sentAt ?? p.createdAt).slice(0, 10)}</div></td>
                  <td>{p.partnerName}</td>
                  <td className="g2-small">{p.lines.map((l) => l.name).join('; ').slice(0, 80)}</td>
                  <td style={{ textAlign: 'right' }}>{p.lines.reduce((a, l) => a + (l.partnerQty ?? l.qty), 0)}</td>
                  <td><Badge tone={TONE[p.status]} dot>{p.status}</Badge>{p.via && <div className="g2-cell-sub">{p.via}{p.edited ? ' · changed' : ''}</div>}</td>
                  <td className="g2-mono g2-small">{p.orderCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {tab === 'rules' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <Card title="Defaults">
              <FormGrid cols={3}>
                <Field label="Default target days of cover"><NumberInput value={s.defaultDays} disabled={!admin} onChange={(v) => saveReplSettings({ ...s, defaultDays: Math.max(1, v ?? 30) })} /></Field>
                <Field label="Average sales over" hint="accepted report periods"><NumberInput value={s.lookbackPeriods} disabled={!admin} onChange={(v) => saveReplSettings({ ...s, lookbackPeriods: Math.max(1, Math.min(6, v ?? 2)) })} /></Field>
                <Field label="Partner link valid (hours)"><NumberInput value={s.expiryHours} disabled={!admin} onChange={(v) => saveReplSettings({ ...s, expiryHours: Math.max(1, v ?? 72) })} /></Field>
              </FormGrid>
            </Card>
            <Card title="Rules" subtitle="Partner + product beats partner, partner beats product, product beats channel, channel beats the default." actions={admin ? <Button size="sm" onClick={() => setRule('new')}>New rule</Button> : undefined} flush>
              <div className="g2-table-wrap"><table className="g2-table">
                <thead><tr><th>Applies to</th><th>For</th><th style={{ textAlign: 'right' }}>Days</th><th>Note</th><th /></tr></thead>
                <tbody>
                  {coverRules().map((r) => (
                    <tr key={r.id}><td>{SCOPES.find((x) => x.value === r.scope)?.label}</td><td>{nameOf(r)}</td><td style={{ textAlign: 'right' }}>{r.days}</td><td className="g2-small">{r.note}</td>
                      <td style={{ textAlign: 'right' }}>{admin && <><Button size="sm" onClick={() => setRule(r)}>Edit</Button> <Button size="sm" icon={<Trash2 size={13} />} onClick={() => { deleteRule(r.id); showToast('Rule removed.', 'success'); }} /></>}</td></tr>
                  ))}
                  <tr><td>Default</td><td className="g2-muted">everything else</td><td style={{ textAlign: 'right' }}>{s.defaultDays}</td><td /><td /></tr>
                </tbody>
              </table></div>
            </Card>
          </div>
        )}
      </Card>
      {open && <ProposalModal id={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
      {rule && <RuleModal rule={rule === 'new' ? null : rule} partnerTypes={types} partners={partnersAll.map((p) => ({ id: p.id, name: p.name, code: p.code }))} onClose={() => setRule(null)} />}
    </div>
  );
};
export default ReplenishmentPage;
