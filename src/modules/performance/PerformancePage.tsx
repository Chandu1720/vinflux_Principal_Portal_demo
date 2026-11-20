/**
 * Partner performance (NV3): scorecards, targets and achievement, scoring weights, sharing with partners.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Copy, Gauge, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, Progress, SearchableSelect, Select, Switch, Tabs } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners, useTerritories } from '../gtm-v2/hooks/useGtmData';
import { getDescendantIds } from '../gtm-v2/utils/territory';
import { users as allUsers } from '../users/userStore';
import { subscribeOrders } from '../orders/orderStore';
import { ensurePlatformDemo, ensureSecondaryDemo, subscribeSecondary } from '../secondary/secondaryStore';
import { subscribeCollections } from '../collections/collectionsStore';
import {
  BASIS_LABEL, SCOPE_LABEL, achievements, deleteTarget, ensurePerformanceDemo, nextMonth, perfSettings, prevMonth, rollTargets, savePerfSettings, saveTarget, scorecards,
  subscribePerformance, targets as allTargets, thisMonth,
} from './performanceStore';
import type { Basis, Scorecard, Target as Tgt, TargetScope, Weights } from './performanceStore';

const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const GRADE: Record<Scorecard['grade'], BadgeTone> = { A: 'green', B: 'blue', C: 'amber', D: 'red', '—': 'slate' };
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const WEIGHT_LABEL: Record<keyof Weights, string> = { achievement: 'Target achievement', fill: 'Fill rate received', stock: 'Days of stock', expiry: 'Expired stock', payment: 'Payment discipline', data: 'Reporting on time', claims: 'Claim ratio', coverage: 'Outlet coverage', accuracy: 'Claim accuracy' };

const ScoreModal: React.FC<{ s: Scorecard; onClose: () => void }> = ({ s, onClose }) => (
  <Modal open size="lg" title={<span className="g2-row" style={{ gap: 8 }}>{s.name} <Badge tone={GRADE[s.grade]}>Grade {s.grade}</Badge></span>} subtitle={`Score ${s.score ?? '—'} / 100 · primary ${inr(s.primary)} · secondary ${inr(s.secondary)} this month`} onClose={onClose}>
    <div className="g2-stack">
      {s.metrics.map((m) => (
        <div key={m.key} className="g2-row" style={{ gap: 12 }}>
          <div style={{ width: 190 }}><strong style={{ fontSize: 13 }}>{m.label}</strong><div className="g2-cell-sub">{m.hint}</div></div>
          <div style={{ width: 150, fontWeight: 600 }}>{m.value}</div>
          <div style={{ flex: 1 }}>{m.score === null ? <span className="g2-small g2-muted">not scored</span> : <Progress value={m.score} color={m.score >= 75 ? '#059669' : m.score >= 50 ? '#d97706' : '#dc2626'} />}</div>
          <div style={{ width: 36, textAlign: 'right' }} className="g2-small">{m.score ?? ''}</div>
        </div>
      ))}
      <div className="g2-small g2-muted">Metrics without data are left out of the score; the weights are set under Settings.</div>
    </div>
  </Modal>
);

const TargetModal: React.FC<{ t: Tgt | null; month: string; onClose: () => void; options: Record<TargetScope, { value: string; label: string; description?: string }[]> }> = ({ t, month, onClose, options }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const [x, setX] = useState<Tgt>(t ?? { id: '', principalId: activePrincipal.id, period: month, scope: 'partner', refId: '', basis: 'primary', value: 0, createdBy: currentUser.name });
  const [err, setErr] = useState('');
  return (
    <Modal open variant="modal" title={t ? 'Edit target' : 'New target'} subtitle="Monthly target in ₹ (incl. GST for primary; reported value for secondary)" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { const r = saveTarget(x); if (!r.ok) setErr(r.message); else { showToast(r.message, 'success'); onClose(); } }}>Save</Button></>}>
      <div className="g2-stack">
        {err && <Alert tone="warn">{err}</Alert>}
        <FormGrid>
          <Field label="Month"><Input type="month" value={x.period} onChange={(e) => setX({ ...x, period: e.target.value })} /></Field>
          <Field label="For"><Select value={x.scope} options={(Object.keys(SCOPE_LABEL) as TargetScope[]).map((k) => ({ value: k, label: SCOPE_LABEL[k] }))} onChange={(v) => setX({ ...x, scope: v as TargetScope, refId: '' })} /></Field>
          <Field label={SCOPE_LABEL[x.scope]} required><SearchableSelect value={x.refId || null} options={options[x.scope]} onChange={(v) => setX({ ...x, refId: v ?? '' })} /></Field>
          <Field label="Measured on"><Select value={x.basis} options={(Object.keys(BASIS_LABEL) as Basis[]).map((k) => ({ value: k, label: BASIS_LABEL[k] }))} onChange={(v) => setX({ ...x, basis: v as Basis })} /></Field>
          <Field label="Target (₹)" required><NumberInput value={x.value} onChange={(v) => setX({ ...x, value: v ?? 0 })} /></Field>
          <Field label="Note"><Input value={x.note ?? ''} onChange={(e) => setX({ ...x, note: e.target.value })} /></Field>
        </FormGrid>
      </div>
    </Modal>
  );
};

const PerformancePage: React.FC = () => {
  useSubscribe(subscribePerformance, subscribeOrders, subscribeSecondary, subscribeCollections);
  const { activePrincipal, currentUser, products, portfolios, showToast } = useApp();
  const partnersAll = usePartners().data ?? [];
  const territories = useTerritories().data ?? [];
  const partners = useMemo(() => partnersAll.filter((p) => !p.institution && p.status === 'Active'), [partnersAll]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'scores';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [month, setMonth] = useState(thisMonth());
  const [open, setOpen] = useState<Scorecard | null>(null);
  const [tgt, setTgt] = useState<Tgt | null | 'new'>(null);
  const [growth, setGrowth] = useState(10);
  const m = currentUser.matrix; const admin = !m || (currentUser.role ?? '').includes('Administrator');
  const canEdit = admin || !!m?.gtm?.includes('edit');
  const lite = partners.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId, territoryIds: p.territoryIds }));
  const unitValue = (id: string) => { const p = products.find((x) => x.id === id); return p?.pricingReference?.standardCost ?? (p?.pricingReference?.mrp ?? 0) * 0.6; };

  useEffect(() => {
    if (!partners.length || !products.length) return;
    const ps = partners.map((p) => ({ id: p.id, name: p.name, locType: (p.partnerTypeId === 'pt-cnf' ? 'CNF' : 'PARTNER') as 'CNF' | 'PARTNER' }));
    const act = products.filter((p) => p.lifecycleStatus === 'Active');
    ensureSecondaryDemo(activePrincipal.id, ps, act, 'System'); ensurePlatformDemo(activePrincipal.id, ps, act);
    ensurePerformanceDemo(activePrincipal.id, lite, partners.flatMap((p) => p.territoryIds)[0] ?? null, 'System');
  }, [partners.length, products.length, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = portfolios.flatMap((pf) => [{ value: pf.id, label: pf.name, description: 'Portfolio' }, ...pf.categories.map((c) => ({ value: c.id, label: c.name, description: `Category · ${pf.name}` }))]);
  const options: Record<TargetScope, { value: string; label: string; description?: string }[]> = {
    partner: partners.map((p) => ({ value: p.id, label: p.name, description: p.code })),
    territory: territories.filter((t) => t.status === 'Active').map((t) => ({ value: t.id, label: t.name, description: t.code })),
    'product-group': cats,
    salesperson: allUsers().filter((u) => u.status === 'Active' && u.territoryIds.length).map((u) => ({ value: u.id, label: u.name, description: u.title })),
  };
  const nameOf = (t: Tgt) => options[t.scope].find((o) => o.value === t.refId)?.label ?? t.refId;
  const cards = scorecards(activePrincipal.id, month, lite, products, unitValue);
  const ach = achievements(activePrincipal.id, month, lite, products, nameOf, (uid) => allUsers().find((u) => u.id === uid)?.territoryIds ?? [], (id) => getDescendantIds(id, territories));
  const scored = cards.filter((c) => c.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, c) => a + (c.score ?? 0), 0) / scored.length) : null;
  const totalT = ach.reduce((a, x) => a + x.target.value, 0); const onTrack = ach.filter((x) => x.pct >= 100).length;
  const s = perfSettings();
  const wsum = Object.values(s.weights).reduce((a, v) => a + v, 0);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Partner performance" description="Targets on primary and secondary sales, and one scorecard per partner — achievement, fill rate, stock, expiry, payments, reporting and claims."
        actions={<div className="g2-row" style={{ gap: 6 }}><Button size="sm" onClick={() => setMonth(prevMonth(month))}>‹</Button><strong style={{ minWidth: 90, textAlign: 'center' }}>{monthLabel(month)}</strong><Button size="sm" disabled={month >= thisMonth()} onClick={() => setMonth(nextMonth(month))}>›</Button></div>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Average partner score" value={avg ?? '—'} icon={<Gauge size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${scored.length} partner(s) scored`} />
        <KpiCard label="Grade A partners" value={cards.filter((c) => c.grade === 'A').length} icon={<Award size={22} />} color="#059669" bg="#ecfdf5" foot={`${cards.filter((c) => c.grade === 'D').length} at grade D`} />
        <KpiCard label="Targets met" value={`${onTrack}/${ach.length}`} icon={<Target size={22} />} color="#2563eb" bg="#eff6ff" foot={`${inr(totalT)} targeted`} onClick={() => setTab('targets')} />
        <KpiCard label="Primary this month" value={inr(cards.reduce((a, c) => a + c.primary, 0))} icon={<TrendingUp size={22} />} color="#d97706" bg="#fffbeb" foot={`${inr(cards.reduce((a, c) => a + c.secondary, 0))} secondary reported`} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'scores', label: 'Scorecards', count: cards.length || undefined }, { id: 'targets', label: 'Targets', count: ach.length || undefined }, { id: 'settings', label: 'Settings' }]} /></div>
        {tab === 'scores' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Partner</th><th>Grade</th><th style={{ textAlign: 'right' }}>Score</th>{cards[0]?.metrics.map((x) => <th key={x.key} style={{ textAlign: 'right' }}>{x.label}</th>)}</tr></thead>
            <tbody>{cards.map((c) => (
              <tr key={c.partnerId} style={{ cursor: 'pointer' }} onClick={() => setOpen(c)}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td><Badge tone={GRADE[c.grade]}>{c.grade}</Badge></td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.score ?? '—'}</td>
                {c.metrics.map((x) => <td key={x.key} style={{ textAlign: 'right', color: x.score === null ? '#9ca3af' : x.score < 50 ? '#b91c1c' : x.score < 75 ? '#b45309' : undefined }} className="g2-small">{x.value}</td>)}
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {tab === 'targets' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {canEdit && <Button variant="primary" icon={<Plus size={14} />} onClick={() => setTgt('new')}>New target</Button>}
              {canEdit && <><span className="g2-spacer" /><span className="g2-small">Copy {monthLabel(month)} to {monthLabel(nextMonth(month))} with growth</span><div style={{ width: 80 }}><NumberInput value={growth} onChange={(v) => setGrowth(v ?? 0)} /></div><span className="g2-small">%</span>
                <Button icon={<Copy size={14} />} onClick={() => { const n = rollTargets(activePrincipal.id, month, nextMonth(month), growth, currentUser.name); showToast(n ? `${n} target(s) copied to ${monthLabel(nextMonth(month))}.` : 'Nothing new to copy.', n ? 'success' : 'info'); }}>Copy</Button></>}
            </div>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>For</th><th>Measured on</th><th style={{ textAlign: 'right' }}>Target</th><th style={{ textAlign: 'right' }}>Primary</th><th style={{ textAlign: 'right' }}>Secondary</th><th style={{ width: 200 }}>Achievement</th><th /></tr></thead>
              <tbody>
                {ach.length === 0 && <tr><td colSpan={7} className="g2-muted">No targets for {monthLabel(month)}.</td></tr>}
                {ach.map((x) => (
                  <tr key={x.target.id}>
                    <td><strong>{x.name}</strong><div className="g2-cell-sub">{SCOPE_LABEL[x.target.scope]}{x.target.note ? ` · ${x.target.note}` : ''}</div></td>
                    <td className="g2-small">{x.target.basis === 'both' ? 'Primary and secondary' : x.target.basis === 'primary' ? 'Primary' : 'Secondary'}</td>
                    <td style={{ textAlign: 'right' }}>{inr(x.target.value)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(x.primary)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(x.secondary)}</td>
                    <td><div className="g2-row" style={{ gap: 8 }}><div style={{ flex: 1 }}><Progress value={Math.min(100, x.pct)} color={x.pct >= 100 ? '#059669' : x.pct >= 70 ? '#d97706' : '#dc2626'} /></div><strong className="g2-small" style={{ width: 40, textAlign: 'right' }}>{x.pct}%</strong></div></td>
                    <td style={{ textAlign: 'right' }}>{canEdit && <><Button size="sm" onClick={() => setTgt(x.target)}>Edit</Button> <Button size="sm" icon={<Trash2 size={13} />} onClick={() => { deleteTarget(x.target.id); showToast('Target removed.', 'success'); }} /></>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {allTargets(activePrincipal.id).length > 0 && ach.length === 0 && <div className="g2-small g2-muted">Targets exist for other months — use ‹ › at the top.</div>}
          </div>
        )}
        {tab === 'settings' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <Card title="Score weights" subtitle={`How much each measure counts (total ${wsum}). Set a weight to 0 to leave a measure out.`}>
              <FormGrid cols={3}>
                {(Object.keys(WEIGHT_LABEL) as (keyof Weights)[]).map((k) => <Field key={k} label={WEIGHT_LABEL[k]}><NumberInput value={s.weights[k]} disabled={!admin} onChange={(v) => savePerfSettings({ ...s, weights: { ...s.weights, [k]: Math.max(0, v ?? 0) } })} /></Field>)}
              </FormGrid>
            </Card>
            <Card title="Days of stock — healthy band">
              <FormGrid cols={3}>
                <Field label="At least (days)"><NumberInput value={s.stockBandDays[0]} disabled={!admin} onChange={(v) => savePerfSettings({ ...s, stockBandDays: [Math.max(1, v ?? 15), s.stockBandDays[1]] })} /></Field>
                <Field label="At most (days)"><NumberInput value={s.stockBandDays[1]} disabled={!admin} onChange={(v) => savePerfSettings({ ...s, stockBandDays: [s.stockBandDays[0], Math.max(s.stockBandDays[0] + 1, v ?? 60)] })} /></Field>
              </FormGrid>
            </Card>
            <Card title="Share with partners (PRF-03)">
              <div className="g2-row" style={{ gap: 8 }}><Switch checked={s.sharePartner} disabled={!admin} onChange={(v) => savePerfSettings({ ...s, sharePartner: v })} label="Share" /><span>Partners see their own scorecard and targets in the partner portal — exactly what you see.</span></div>
            </Card>
          </div>
        )}
      </Card>
      {open && <ScoreModal s={open} onClose={() => setOpen(null)} />}
      {tgt && <TargetModal t={tgt === 'new' ? null : tgt} month={month} options={options} onClose={() => setTgt(null)} />}
    </div>
  );
};
export default PerformancePage;
