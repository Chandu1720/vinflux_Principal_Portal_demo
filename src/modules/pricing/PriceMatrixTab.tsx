import React, { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Settings2, TrendingUp } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, Field, FormGrid, Input, KpiCard, Modal, MultiSelect, NumberInput, SearchInput, Select } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useChannels } from '../gtm-v2/hooks/useGtmData';
import type { Product } from '../../types/product.ts';
import {
  channelPrice, gstOf, ladderFor, priceLists, proposeAcrossChannels, saveSettings, settings, subscribePricing, today,
} from './pricingStore';
import type { CrossChannelPrice, LadderCell, LadderTier } from './pricingStore';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)}%`);
const r2 = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

/** Tiers shown in the ladder: every active channel that buys from the company (C&F agents and direct sales excluded). */
const useTiers = (): LadderTier[] => {
  const channels = useChannels().data ?? [];
  const st = settings();
  return channels.filter((c) => c.status === 'Active' && c.tradeModel !== 'AGENT' && c.id !== 'chn-direct')
    .map((c) => ({ channelId: c.id, name: st.tierNames[c.id] || c.name, rank: c.tierRank, resell: !(c.canBeEndpoint && c.tierRank >= 9) }))
    .sort((a, b) => a.rank - b.rank);
};

/* ------------------------------ Value-chain bar ------------------------------ */

const ValueChain: React.FC<{ product: Product; tiers: LadderTier[]; prices: Record<string, number | null> }> = ({ product, tiers, prices }) => {
  const ref = product.pricingReference;
  const gst = gstOf(product);
  const mrp = ref?.mrp ?? 0;
  if (!mrp) return <div className="g2-small g2-muted">No MRP — value chain not shown.</div>;
  const mrpEx = mrp / (1 + gst / 100);
  const cost = ref?.standardCost ?? 0;
  const seq = tiers.filter((t) => t.resell && prices[t.channelId]).map((t) => ({ name: t.name, price: prices[t.channelId]! }));
  const parts: { label: string; value: number; color: string }[] = [];
  if (cost) parts.push({ label: 'Cost', value: cost, color: '#94a3b8' });
  if (seq.length) parts.push({ label: 'Company margin', value: seq[0].price - cost, color: '#6d28d9' });
  const end = tiers.find((t) => !t.resell && prices[t.channelId]);
  const endPrice = end ? prices[end.channelId]! : mrpEx;
  seq.forEach((s, i) => parts.push({ label: `${s.name} margin`, value: (seq[i + 1]?.price ?? endPrice) - s.price, color: ['#2563eb', '#0891b2', '#059669', '#65a30d'][i % 4] }));
  if (end) parts.push({ label: `Below MRP at ${end.name}`, value: mrpEx - endPrice, color: '#e2e8f0' });
  parts.push({ label: `GST ${gst}%`, value: mrp - mrpEx, color: '#f59e0b' });
  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--g2-border)' }}>
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.label} title={`${p.label}: ${inr(Math.round(p.value))} (${((p.value / mrp) * 100).toFixed(1)}% of MRP)`} style={{ width: `${(p.value / mrp) * 100}%`, background: p.color }} />)}
      </div>
      <div className="g2-row" style={{ gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {parts.map((p) => <span key={p.label} className="g2-small"><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: p.value > 0 ? p.color : '#fecaca', marginRight: 4 }} />{p.label} {((p.value / mrp) * 100).toFixed(1)}%</span>)}
      </div>
    </div>
  );
};

/* ------------------------------ Margin simulator ------------------------------ */

const MarginSimulator: React.FC<{ product: Product; tiers: LadderTier[]; onClose: () => void }> = ({ product, tiers, onClose }) => {
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const on = today();
  const start = Object.fromEntries(tiers.map((t) => {
    const c = channelPrice(activePrincipal.id, t.channelId, product.id, on);
    return [t.channelId, (c.next ?? c.current)?.price ?? null];
  })) as Record<string, number | null>;
  const current = Object.fromEntries(tiers.map((t) => [t.channelId, channelPrice(activePrincipal.id, t.channelId, product.id, on).current?.price ?? null])) as Record<string, number | null>;
  const [prices, setPrices] = useState<Record<string, number | null>>(start);
  const [from, setFrom] = useState(on);
  const [errs, setErrs] = useState<string[]>([]);
  const cells = ladderFor(product, tiers, prices);
  const ref = product.pricingReference;
  const changed = tiers.filter((t) => prices[t.channelId] && prices[t.channelId] !== start[t.channelId]);
  const can = !!currentUser.permissions.canEditPricing;
  const save = (submit: boolean) => {
    const r = proposeAcrossChannels({ principalId: activePrincipal.id, validFrom: from, by: currentUser.name, note: `Margin simulator: ${product.name}`, submit, products,
      prices: changed.map((t) => ({ channelId: t.channelId, productId: product.id, price: prices[t.channelId]! })) });
    if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return; }
    showToast(r.message, 'success'); onClose();
  };
  return (
    <Modal open size="xl" title={product.name} subtitle={`Margin simulator · cost ${ref?.standardCost ? inr(ref.standardCost) : 'not set'} · MRP ${ref?.mrp ? inr(ref.mrp) : '—'} incl. ${gstOf(product)}% GST · company floor ${settings().companyFloorPct}%`} onClose={onClose}
      footer={<><Button onClick={onClose}>Close</Button>{can && <><Button disabled={!changed.length} onClick={() => save(false)}>Save as drafts</Button><Button variant="primary" disabled={!changed.length} onClick={() => save(true)}>Submit {changed.length || ''} change(s) for approval</Button></>}</>}>
      <div className="g2-stack">
        {errs.length > 0 && <Alert tone="error">{errs.join(' ')}</Alert>}
        {!ref?.standardCost && <Alert tone="warn">This product has no standard cost — company margins can’t be shown. Add it in Product Master → Pricing.</Alert>}
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Tier</th><th style={{ textAlign: 'right' }}>Now</th><th style={{ width: 150 }}>New price (ex-GST)</th><th style={{ textAlign: 'right' }}>% of MRP</th><th style={{ textAlign: 'right' }}>Company margin</th><th style={{ textAlign: 'right' }}>Reseller margin</th><th>Checks</th></tr></thead>
          <tbody>{tiers.map((t) => {
            const c = cells.find((x) => x.channelId === t.channelId)!;
            const delta = current[t.channelId] && prices[t.channelId] ? ((prices[t.channelId]! - current[t.channelId]!) / current[t.channelId]!) * 100 : null;
            return (
              <tr key={t.channelId}>
                <td><span className="g2-strong">{t.name}</span><div className="g2-cell-sub">{t.resell ? 'Reseller' : 'End customer'}</div></td>
                <td style={{ textAlign: 'right' }}>{current[t.channelId] ? inr(current[t.channelId]!) : <span className="g2-muted">—</span>}</td>
                <td><NumberInput value={prices[t.channelId]} allowEmpty disabled={!can} aria-label={`${t.name} price`} onChange={(v) => setPrices({ ...prices, [t.channelId]: v })} />
                  {delta !== null && Math.abs(delta) > 0.001 && <div className="g2-cell-sub" style={{ color: delta > 0 ? '#047857' : '#b91c1c' }}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs now</div>}</td>
                <td style={{ textAlign: 'right' }}>{pct(c.pctOfMrp)}</td>
                <td style={{ textAlign: 'right' }}>{pct(c.companyMarginPct)}</td>
                <td style={{ textAlign: 'right' }}>{t.resell ? pct(c.resellerMarginPct) : <span className="g2-muted">—</span>}</td>
                <td style={{ maxWidth: 260 }}>{c.price === null ? <span className="g2-muted">No price</span> : c.issues.length ? c.issues.map((i) => <div key={i} className="g2-small" style={{ color: '#b45309' }}>! {i}</div>) : <Badge tone="green" dot>OK</Badge>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <div className="g2-card" style={{ padding: 14 }}>
          <div className="g2-label" style={{ marginBottom: 8 }}>Where the MRP goes <span className="g2-muted" style={{ fontWeight: 400, textTransform: 'none' }}>(each part as a share of MRP)</span></div>
          <ValueChain product={product} tiers={tiers} prices={prices} />
        </div>
        {can && <FormGrid cols={3}><Field label="New prices apply from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field></FormGrid>}
      </div>
    </Modal>
  );
};

/* -------------------------- Revise across channels -------------------------- */

const CrossChannelRevise: React.FC<{ tiers: LadderTier[]; onClose: () => void }> = ({ tiers, onClose }) => {
  const { products, portfolios, activePrincipal, currentUser, showToast } = useApp();
  const on = today();
  const eligible = products.filter((p) => p.principalId === activePrincipal.id && p.lifecycleStatus !== 'Retired');
  const [pfIds, setPfIds] = useState<string[]>([]);
  const [prodIds, setProdIds] = useState<string[]>([]);
  // A channel with a list already waiting for approval can't take another revision until that one is decided.
  const waiting = new Set(priceLists().filter((l) => l.type === 'CHANNEL' && l.principalId === activePrincipal.id && !l.territoryIds.length && l.status === 'Pending').map((l) => l.channelId ?? ''));
  const [rules, setRules] = useState<Record<string, { on: boolean; mode: 'change' | 'mrp'; value: number | null }>>(() =>
    Object.fromEntries(tiers.map((t) => [t.channelId, { on: !waiting.has(t.channelId) && t.channelId !== 'chn-retail', mode: 'change' as const, value: 5 }])));
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().slice(0, 10); });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  const scope = eligible.filter((p) => (!pfIds.length || pfIds.includes(p.portfolioId)) && (!prodIds.length || prodIds.includes(p.id)));
  const newPrice = (p: Product, t: LadderTier): number | null => {
    const r = rules[t.channelId];
    if (!r?.on || r.value === null) return null;
    if (r.mode === 'mrp') { const mrp = p.pricingReference?.mrp; return mrp ? r2((mrp / (1 + gstOf(p) / 100)) * (r.value / 100)) : null; }
    const cur = channelPrice(activePrincipal.id, t.channelId, p.id, on).current?.price;
    return cur ? r2(cur * (1 + r.value / 100)) : null;
  };
  const preview = useMemo(() => scope.map((p) => {
    const prices = Object.fromEntries(tiers.map((t) => [t.channelId, newPrice(p, t) ?? channelPrice(activePrincipal.id, t.channelId, p.id, on).current?.price ?? null])) as Record<string, number | null>;
    const cells = ladderFor(p, tiers, prices);
    return { p, prices, changed: tiers.filter((t) => newPrice(p, t) !== null), issues: cells.flatMap((c) => c.issues) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scope.map((p) => p.id).join(), rules]);
  const total = preview.reduce((a, r) => a + r.changed.length, 0);
  const flagged = preview.filter((r) => r.issues.length).length;
  const hard = preview.flatMap((r) => r.issues.filter((i) => /Above/.test(i)).map((i) => `${r.p.name}: ${i}`));
  const save = (submit: boolean) => {
    if (hard.length) { setErrs([`${hard.length} price(s) would be above MRP or the government ceiling — lower the rule or untick that channel.`, ...hard.slice(0, 5)]); return; }
    const prices: CrossChannelPrice[] = preview.flatMap((r) => r.changed.map((t) => ({ channelId: t.channelId, productId: r.p.id, price: r.prices[t.channelId]! })));
    const res = proposeAcrossChannels({ principalId: activePrincipal.id, validFrom: from, by: currentUser.name, note, submit, prices, products });
    if (!res.ok) { setErrs([res.message, ...(res.errors ?? [])]); return; }
    showToast(res.message, 'success'); onClose();
  };
  return (
    <Modal open size="xl" title="Revise prices across channels" subtitle="Set every tier in one go. Each channel still gets its own list version, all approved together." onClose={onClose}
      footer={<><span className="g2-small g2-muted" style={{ marginRight: 'auto' }}>{total} price(s) across {new Set(preview.flatMap((r) => r.changed.map((t) => t.channelId))).size} channel(s){flagged ? ` · ${flagged} product(s) flagged` : ''}</span><Button onClick={onClose}>Cancel</Button><Button disabled={!total} onClick={() => save(false)}>Save as drafts</Button><Button variant="primary" disabled={!total} onClick={() => save(true)}>Submit for approval</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <Alert tone="error"><div><strong>{errs[0]}</strong>{errs.slice(1).map((e) => <div key={e}>{e}</div>)}</div></Alert>}
        <FormGrid cols={3}>
          <Field label="Portfolios" hint="Empty = all"><MultiSelect values={pfIds} placeholder="All portfolios" options={portfolios.filter((pf) => eligible.some((p) => p.portfolioId === pf.id)).map((pf) => ({ value: pf.id, label: pf.name }))} onChange={setPfIds} /></Field>
          <Field label="Only these products" hint="Empty = every product in the portfolios"><MultiSelect values={prodIds} placeholder="All products" options={eligible.filter((p) => !pfIds.length || pfIds.includes(p.portfolioId)).map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={setProdIds} /></Field>
          <Field label="New prices apply from" required><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        </FormGrid>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Tier</th><th>Rule</th><th style={{ width: 140 }}>Value</th><th className="g2-small">Example</th></tr></thead>
          <tbody>{tiers.map((t) => {
            const r = rules[t.channelId];
            const ex = scope[0] ? newPrice(scope[0], t) : null;
            return (
              <tr key={t.channelId} style={{ opacity: r.on ? 1 : 0.5 }}>
                <td><Checkbox checked={r.on} disabled={waiting.has(t.channelId)} onChange={(v) => setRules({ ...rules, [t.channelId]: { ...r, on: v } })} label={<strong>{t.name}</strong>} />{waiting.has(t.channelId) && <div className="g2-cell-sub" style={{ color: '#b45309' }}>A list is waiting for approval</div>}</td>
                <td style={{ width: 260 }}><Select value={r.mode} disabled={!r.on} options={[{ value: 'change', label: 'Change current price by ±%' }, { value: 'mrp', label: 'Set to % of MRP (before GST)' }]} onChange={(v) => setRules({ ...rules, [t.channelId]: { ...r, mode: v as 'change' | 'mrp', value: v === 'mrp' ? 70 : 5 } })} /></td>
                <td><NumberInput value={r.value} allowEmpty disabled={!r.on} aria-label={`${t.name} value`} onChange={(v) => setRules({ ...rules, [t.channelId]: { ...r, value: v } })} /></td>
                <td className="g2-small g2-muted">{scope[0] && ex ? `${scope[0].name.slice(0, 26)}… → ${inr(ex)}` : r.on ? 'no current price to change' : 'unchanged'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <Field label="Reason (shown to the approver)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual price revision — titanium cost +6%" /></Field>
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>Preview · {scope.length} product(s)</div>
          <div className="g2-table-wrap" style={{ maxHeight: 260, overflow: 'auto' }}><table className="g2-table">
            <thead><tr><th>Product</th>{tiers.map((t) => <th key={t.channelId} style={{ textAlign: 'right' }}>{t.name}</th>)}<th>Checks</th></tr></thead>
            <tbody>{preview.map((r) => (
              <tr key={r.p.id}>
                <td className="g2-small" style={{ maxWidth: 240 }}>{r.p.name}</td>
                {tiers.map((t) => <td key={t.channelId} style={{ textAlign: 'right' }} className={r.changed.includes(t) ? 'g2-strong' : 'g2-muted'}>{r.prices[t.channelId] ? inr(r.prices[t.channelId]!) : '—'}</td>)}
                <td style={{ maxWidth: 260 }}>{r.issues.length ? <span className="g2-small" style={{ color: '#b45309' }} title={r.issues.join('\n')}>! {r.issues[0]}{r.issues.length > 1 ? ` (+${r.issues.length - 1})` : ''}</span> : <Badge tone="green" dot>OK</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    </Modal>
  );
};

/* ---------------------------------- Matrix ---------------------------------- */

const SettingsModal: React.FC<{ tiers: LadderTier[]; onClose: () => void }> = ({ tiers, onClose }) => {
  const { showToast } = useApp();
  const channels = useChannels().data ?? [];
  const [s, setS] = useState(settings());
  return (
    <Modal open title="Price names & margin floors" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { saveSettings(s); showToast('Pricing settings saved.', 'success'); onClose(); }}>Save</Button></>}>
      <div className="g2-stack">
        <div className="g2-small g2-muted">Short names used in price screens and documents (PTS = price to stockist, PTD = price to distributor, PTR = price to retailer).</div>
        <table className="g2-table">
          <thead><tr><th>Channel</th><th>Price name</th><th>Minimum margin it keeps (%)</th></tr></thead>
          <tbody>{tiers.map((t) => (
            <tr key={t.channelId}>
              <td className="g2-strong">{channels.find((c) => c.id === t.channelId)?.name ?? t.channelId}</td>
              <td><Input value={s.tierNames[t.channelId] ?? ''} aria-label={`Price name ${t.channelId}`} onChange={(e) => setS({ ...s, tierNames: { ...s.tierNames, [t.channelId]: e.target.value } })} /></td>
              <td>{t.resell ? <NumberInput value={s.channelFloors[t.channelId] ?? null} allowEmpty aria-label={`Floor ${t.channelId}`} onChange={(v) => setS({ ...s, channelFloors: { ...s.channelFloors, [t.channelId]: v ?? 0 } })} /> : <span className="g2-muted">End customer</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        <Field label="Company margin floor (%)" hint="Prices that leave the company less than this over standard cost are flagged for the approver."><NumberInput value={s.companyFloorPct} onChange={(v) => setS({ ...s, companyFloorPct: v ?? 0 })} /></Field>
      </div>
    </Modal>
  );
};

/** All channel prices side by side (PTS / PTD / … / Institution) with margins and ladder checks. */
export const PriceMatrixTab: React.FC = () => {
  useSubscribe(subscribePricing);
  const { products, portfolios, activePrincipal, currentUser } = useApp();
  const tiers = useTiers();
  const [on, setOn] = useState(today());
  const [q, setQ] = useState('');
  const [pf, setPf] = useState('');
  const [showNext, setShowNext] = useState(true);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [sim, setSim] = useState<Product | null>(null);
  const [revise, setRevise] = useState(false);
  const [cfg, setCfg] = useState(false);
  const eligible = products.filter((p) => p.principalId === activePrincipal.id && p.lifecycleStatus !== 'Retired');

  const rows = eligible.filter((p) => (!pf || p.portfolioId === pf) && (!q || [p.name, p.code].some((x) => x.toLowerCase().includes(q.toLowerCase()))))
    .map((p) => {
      const cells = Object.fromEntries(tiers.map((t) => [t.channelId, channelPrice(activePrincipal.id, t.channelId, p.id, on)]));
      const prices = Object.fromEntries(tiers.map((t) => [t.channelId, cells[t.channelId].current?.price ?? null])) as Record<string, number | null>;
      const ladder = ladderFor(p, tiers, prices);
      return { p, cells, ladder, issues: ladder.flatMap((c) => c.issues), missing: tiers.filter((t) => !prices[t.channelId]).length };
    })
    .filter((r) => !onlyIssues || r.issues.length)
    .sort((a, b) => (portfolios.find((x) => x.id === a.p.portfolioId)?.name ?? '').localeCompare(portfolios.find((x) => x.id === b.p.portfolioId)?.name ?? '') || a.p.name.localeCompare(b.p.name));
  const shownTiers = tiers.filter((t) => rows.some((r) => r.cells[t.channelId].current || r.cells[t.channelId].next));
  const breaks = rows.filter((r) => r.issues.some((i) => /ladder/.test(i))).length;
  const floors = rows.filter((r) => r.issues.some((i) => /floor|below/.test(i))).length;
  const noCost = rows.filter((r) => !r.p.pricingReference?.standardCost).length;
  const avgCo = (() => { const v = rows.flatMap((r) => r.ladder.filter((c) => c.companyMarginPct !== null && tiers.find((t) => t.channelId === c.channelId)?.resell).map((c) => c.companyMarginPct!)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();

  const cell = (c: LadderCell, cp: ReturnType<typeof channelPrice>, t: LadderTier) => {
    const next = showNext && cp.next && cp.next.price !== cp.current?.price ? cp.next : null;
    const bad = c.issues.length > 0;
    return (
      <td key={t.channelId} style={{ textAlign: 'right', background: bad ? '#fffbeb' : undefined, verticalAlign: 'top' }} title={c.issues.join('\n')}>
        {c.price ? <div className="g2-strong">{inr(c.price)}{bad && <AlertTriangle size={12} color="#d97706" style={{ marginLeft: 4, verticalAlign: -1 }} />}</div> : <div className="g2-muted">—</div>}
        {c.price && <div className="g2-cell-sub">{[c.pctOfMrp !== null ? `${c.pctOfMrp.toFixed(1)}% MRP` : '', c.companyMarginPct !== null ? `Co ${c.companyMarginPct.toFixed(0)}%` : ''].filter(Boolean).join(' · ')}</div>}
        {c.price && t.resell && c.resellerMarginPct !== null && <div className="g2-cell-sub">keeps {c.resellerMarginPct.toFixed(1)}%</div>}
        {next && <div className="g2-small" style={{ color: '#b45309' }} title={`${next.list.name} v${next.list.version} · ${next.list.status}${next.list.status === 'Active' ? ` from ${next.list.validFrom}` : ''}`}>→ {inr(next.price)} <span className="g2-muted">({next.list.status === 'Active' ? `from ${next.list.validFrom.slice(5)}` : next.list.status.toLowerCase()})</span></div>}
      </td>
    );
  };

  return (
    <div style={{ padding: 16 }} className="g2-stack">
      <div className="g2-grid g2-grid-4">
        <KpiCard label="Avg company margin" value={avgCo === null ? '—' : `${avgCo.toFixed(1)}%`} icon={<TrendingUp size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`floor ${settings().companyFloorPct}% over standard cost`} />
        <KpiCard label="Ladder breaks" value={breaks} icon={<Layers size={22} />} color="#dc2626" bg="#fef2f2" foot="a reseller dearer than its customer" />
        <KpiCard label="Margin floor breaches" value={floors} icon={<AlertTriangle size={22} />} color="#d97706" bg="#fffbeb" foot="company or channel below floor" />
        <KpiCard label="Products without cost" value={noCost} icon={<Settings2 size={22} />} color="#64748b" bg="#f1f5f9" foot="add standard cost in Product Master" />
      </div>
      <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Product or code…" />
        <div style={{ width: 240 }}><Select value={pf} placeholder="All portfolios" options={portfolios.filter((x) => eligible.some((p) => p.portfolioId === x.id)).map((x) => ({ value: x.id, label: x.name }))} onChange={setPf} /></div>
        <span className="g2-small g2-muted">Prices on</span><div style={{ width: 160 }}><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></div>
        <Checkbox checked={showNext} onChange={setShowNext} label="Show coming changes" />
        <Checkbox checked={onlyIssues} onChange={setOnlyIssues} label="Only flagged" />
        <span className="g2-spacer" />
        {currentUser.permissions.canConfigurePricing && <Button size="sm" variant="ghost" icon={<Settings2 size={14} />} onClick={() => setCfg(true)}>Price names & margin floors</Button>}
        {currentUser.permissions.canEditPricing && <Button variant="primary" icon={<Layers size={15} />} onClick={() => setRevise(true)}>Revise across channels</Button>}
      </div>
      <div className="g2-table-wrap"><table className="g2-table">
        <thead><tr>
          <th>Product</th><th style={{ textAlign: 'right' }}>Cost</th>
          {shownTiers.map((t) => <th key={t.channelId} style={{ textAlign: 'right' }}>{t.name}</th>)}
          <th style={{ textAlign: 'right' }}>MRP</th><th style={{ textAlign: 'right' }}>Govt cap</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={shownTiers.length + 4} className="g2-muted">No products match.</td></tr>}
          {rows.map((r) => {
            const ref = r.p.pricingReference;
            return (
              <tr key={r.p.id} onClick={() => setSim(r.p)} style={{ cursor: 'pointer' }}>
                <td style={{ maxWidth: 260 }}><div className="g2-strong">{r.p.name}</div><div className="g2-cell-sub">{portfolios.find((x) => x.id === r.p.portfolioId)?.name} · GST {gstOf(r.p)}%</div></td>
                <td style={{ textAlign: 'right' }}>{ref?.standardCost ? inr(ref.standardCost) : <span className="g2-muted">—</span>}</td>
                {shownTiers.map((t) => cell(r.ladder.find((c) => c.channelId === t.channelId)!, r.cells[t.channelId], t))}
                <td style={{ textAlign: 'right' }}>{ref?.mrp ? inr(ref.mrp) : <span className="g2-muted">—</span>}</td>
                <td style={{ textAlign: 'right' }}>{ref?.govPriceCapEnforced && ref.govNpddCeiling ? inr(ref.govNpddCeiling) : <span className="g2-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <div className="g2-small g2-muted">National channel prices (territory and partner lists and rate contracts are not shown here — use Price check). “Co” = company margin over standard cost; “keeps” = what the reseller earns selling to the next tier. Click a product to simulate margins.</div>
      {sim && <MarginSimulator product={sim} tiers={tiers} onClose={() => setSim(null)} />}
      {revise && <CrossChannelRevise tiers={tiers} onClose={() => setRevise(false)} />}
      {cfg && <SettingsModal tiers={tiers} onClose={() => setCfg(false)} />}
    </div>
  );
};
