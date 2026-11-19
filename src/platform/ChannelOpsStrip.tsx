/**
 * Channel operations strip for the Go-to-Market dashboard: how the network is running (not just how it is set up),
 * from the operational modules that are switched on. Each tile opens its module.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from './ui';
import { usePlatform } from './PlatformContext';
import { useSubscribe } from './useStore';
import { useApp } from '../context/AppContext.tsx';
import type { Partner } from '../modules/gtm-v2/types';
import { coverage, partnerBoard, subscribeSecondary } from '../modules/secondary/secondaryStore';
import { replStats, suggest, subscribeReplenishment } from '../modules/replenishment/replenishmentStore';
import { scorecards, subscribePerformance, thisMonth } from '../modules/performance/performanceStore';
import { agreements, stateOf, subscribeTenders } from '../modules/tenders/tendersStore';
import { ageing, subscribeCollections } from '../modules/collections/collectionsStore';
import { claims, subscribeClaims } from '../modules/claims/claimsStore';

const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);

export const ChannelOpsStrip: React.FC<{ partners: Partner[] }> = ({ partners }) => {
  useSubscribe(subscribeSecondary, subscribeReplenishment, subscribePerformance, subscribeTenders, subscribeCollections, subscribeClaims);
  const { enabled } = usePlatform();
  const { activePrincipal, products } = useApp();
  const navigate = useNavigate();
  const pid = activePrincipal.id;
  const ch = partners.filter((p) => !p.institution && p.status === 'Active');
  const unit = (id: string) => products.find((x) => x.id === id)?.pricingReference?.standardCost ?? 0;
  const tiles: { label: string; value: string | number; foot: string; path: string; tone?: 'red' | 'amber' }[] = [];
  if (enabled('secondary')) { const cov = coverage(partnerBoard(pid, ch.map((p) => p.id), unit)); tiles.push({ label: 'Partner data coverage', value: `${cov.pct}%`, foot: 'of channel stock reported and fresh', path: '/secondary', tone: cov.pct < 60 ? 'amber' : undefined }); }
  if (enabled('replenishment')) {
    const low = suggest(pid, ch.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId })), products).filter((s) => s.ok && s.rows.some((r) => r.suggested > 0)).length;
    tiles.push({ label: 'Partners to restock', value: low, foot: `${replStats(pid).waiting} suggestion(s) waiting for partner`, path: '/replenishment', tone: low ? 'amber' : undefined });
  }
  if (enabled('performance')) {
    const sc = scorecards(pid, thisMonth(), ch.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId, territoryIds: p.territoryIds })), products, unit).filter((c) => c.score !== null);
    const avg = sc.length ? Math.round(sc.reduce((a, c) => a + (c.score ?? 0), 0) / sc.length) : null;
    tiles.push({ label: 'Average partner score', value: avg ?? '—', foot: `${sc.filter((c) => c.grade === 'D').length} partner(s) at grade D`, path: '/performance', tone: sc.some((c) => c.grade === 'D') ? 'amber' : undefined });
  }
  if (enabled('tenders')) { const ag = agreements(pid); const exp = ag.filter((a) => stateOf(a) === 'Expired').length; const soon = ag.filter((a) => stateOf(a) === 'Expiring').length; tiles.push({ label: 'Agreements', value: `${exp} expired`, foot: `${soon} due for renewal · ${ag.length} on file`, path: '/tenders?tab=agreements', tone: exp ? 'red' : soon ? 'amber' : undefined }); }
  if (enabled('collections')) { const od = ageing(pid).reduce((a, r) => a + r.overdue, 0); tiles.push({ label: 'Overdue from partners', value: inr(od), foot: 'collections', path: '/collections', tone: od ? 'red' : undefined }); }
  if (enabled('claims')) { const q = claims(pid).filter((c) => c.status === 'Under review'); tiles.push({ label: 'Claims to review', value: q.length, foot: inr(q.reduce((a, c) => a + c.claimedAmount, 0)) + ' claimed', path: '/claims' }); }
  if (!tiles.length) return null;
  return (
    <Card title="Channel operations" subtitle="How the network is running right now" actions={<a href="#" className="g2-small" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>Control tower <ArrowRight size={12} style={{ verticalAlign: -2 }} /></a>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ cursor: 'pointer' }} onClick={() => navigate(t.path)}>
            <div className="g2-small g2-muted">{t.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.tone === 'red' ? '#b91c1c' : t.tone === 'amber' ? '#b45309' : undefined }}>{t.value}</div>
            <div className="g2-small g2-muted">{t.foot}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};
