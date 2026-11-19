/**
 * Home dashboard (AN1): one page across modules — what needs attention now, and the main numbers per module.
 * Only modules switched on for this principal appear; every tile opens its module.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card, PageHeader } from '../ui';
import type { BadgeTone } from '../../modules/gtm-v2/types';
import { usePlatform } from '../PlatformContext';
import type { ModuleId } from '../modules';
import { useSubscribe } from '../useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../../modules/gtm-v2/hooks/useGtmData';
import { allShipments, orders, orderValue, subscribeOrders } from '../../modules/orders/orderStore';
import { balances, subscribeStock } from '../../modules/inventory/stockStore';
import { coverage, partnerBoard, reports as secReports, subscribeSecondary } from '../../modules/secondary/secondaryStore';
import { claimSchemes, claims, subscribeClaims } from '../../modules/claims/claimsStore';
import { crmSummary, subscribeCrm } from '../../modules/crm/crmStore';
import { cases as surgicalCases, sets as surgicalSets, subscribeSurgical } from '../../modules/surgical/surgicalStore';
import { returns, subscribeReturns } from '../../modules/returns/returnStore';
import { complaints, recalls, subscribeRecall } from '../../modules/recall/recallStore';

const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const today = () => new Date().toISOString().slice(0, 10);
const OPEN = ['Received', 'Awaiting approval', 'Validated', 'Awaiting partner', 'On hold', 'Confirmed', 'Shipped'];

interface Tile { label: string; value: React.ReactNode; foot?: string; tone?: BadgeTone }
interface Section { module: ModuleId; title: string; path: string; tiles: Tile[] }
interface Attention { text: string; count: number; path: string; tone: BadgeTone }

const HomeDashboard: React.FC = () => {
  useSubscribe(subscribeOrders, subscribeStock, subscribeSecondary, subscribeClaims, subscribeCrm, subscribeSurgical, subscribeReturns, subscribeRecall);
  const { enabled } = usePlatform();
  const navigate = useNavigate();
  const { activePrincipal, products, currentUser } = useApp();
  const partnersAll = usePartners().data ?? [];
  const pid = activePrincipal.id;
  const unitValue = (id: string) => { const p = products.find((x) => x.id === id); return p?.pricingReference?.standardCost ?? (p?.pricingReference?.mrp ?? 0) * 0.6; };

  const data = useMemo(() => {
    const sections: Section[] = []; const attention: Attention[] = [];
    const t = today(); const month = t.slice(0, 7);
    const need = (cond: boolean, text: string, count: number, path: string, tone: BadgeTone = 'amber') => { if (cond && count > 0) attention.push({ text, count, path, tone }); };

    let weekly: { week: string; value: number }[] = [];
    if (enabled('orders')) {
      const os = orders().filter((o) => o.principalId === pid);
      const open = os.filter((o) => OPEN.includes(o.status));
      const thisMonth = os.filter((o) => o.createdAt.slice(0, 7) === month && !['Rejected', 'Cancelled'].includes(o.status));
      sections.push({ module: 'orders', title: 'Orders', path: '/orders', tiles: [
        { label: 'Open orders', value: open.length, foot: inr(open.reduce((a, o) => a + orderValue(o), 0)) },
        { label: 'This month', value: inr(thisMonth.reduce((a, o) => a + orderValue(o), 0)), foot: `${thisMonth.length} orders` },
        { label: 'Waiting approval', value: os.filter((o) => o.status === 'Awaiting approval').length, tone: 'amber' },
        { label: 'Credit hold', value: os.filter((o) => o.status === 'On hold').length, tone: 'red' },
      ] });
      need(true, 'Orders waiting for approval', os.filter((o) => o.status === 'Awaiting approval').length, '/orders');
      need(true, 'Orders on credit hold', os.filter((o) => o.status === 'On hold').length, '/orders', 'red');
      need(true, 'Partners still to answer a part-fill question', os.filter((o) => o.status === 'Awaiting partner').length, '/orders', 'slate');
      // Last 8 weeks of order value.
      const start = Date.now() - 7 * 7 * 86400000;
      weekly = Array.from({ length: 8 }, (_, i) => { const d = new Date(start + i * 7 * 86400000); return { week: d.toISOString().slice(5, 10), value: 0 }; });
      os.filter((o) => !['Rejected', 'Cancelled'].includes(o.status)).forEach((o) => { const i = Math.floor((Date.parse(o.createdAt) - start) / (7 * 86400000)); if (i >= 0 && i < 8) weekly[i].value += orderValue(o); });
      weekly = weekly.map((w) => ({ ...w, value: Math.round(w.value) }));
    }
    if (enabled('logistics')) {
      const sh = allShipments().filter((x) => x.order.principalId === pid);
      const transit = sh.filter((x) => !x.shipment.deliveredAt);
      const late = transit.filter((x) => x.shipment.eta < t);
      sections.push({ module: 'logistics', title: 'Logistics', path: '/logistics', tiles: [
        { label: 'In transit', value: transit.length }, { label: 'Late', value: late.length, tone: late.length ? 'red' : undefined },
        { label: 'Delivered this month', value: sh.filter((x) => x.shipment.deliveredAt?.slice(0, 7) === month).length },
      ] });
      need(true, 'Shipments past their delivery date', late.length, '/logistics?tab=transit', 'red');
    }
    if (enabled('inventory')) {
      const bal = balances().filter((b) => b.qty > 0 && b.locType !== 'TRANSIT');
      const lim = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const own = bal.filter((b) => b.locType === 'COMPANY'); const ch = bal.filter((b) => b.locType !== 'COMPANY');
      const near = bal.filter((b) => b.expiryDate && b.expiryDate <= lim);
      sections.push({ module: 'inventory', title: 'Inventory', path: '/inventory', tiles: [
        { label: 'Own warehouses', value: own.reduce((a, b) => a + b.qty, 0).toLocaleString('en-IN'), foot: inr(own.reduce((a, b) => a + b.qty * unitValue(b.productId), 0)) },
        { label: 'In the channel', value: ch.reduce((a, b) => a + b.qty, 0).toLocaleString('en-IN'), foot: inr(ch.reduce((a, b) => a + b.qty * unitValue(b.productId), 0)) },
        { label: 'Expiring ≤ 90 days', value: near.reduce((a, b) => a + b.qty, 0), foot: inr(near.reduce((a, b) => a + b.qty * unitValue(b.productId), 0)), tone: near.length ? 'amber' : undefined },
      ] });
      need(true, 'Units expiring within 90 days', near.reduce((a, b) => a + b.qty, 0), '/inventory?tab=expiry');
    }
    if (enabled('secondary')) {
      const partners = partnersAll.filter((p) => !p.institution && p.status === 'Active');
      const board = partnerBoard(pid, partners.map((p) => p.id), unitValue); const cov = coverage(board);
      const review = secReports(pid).filter((r) => r.status === 'Needs review').length;
      const stale = board.filter((r) => !r.fresh && !r.estimated).length;
      sections.push({ module: 'secondary', title: 'Secondary sales', path: '/secondary', tiles: [
        { label: 'Coverage', value: `${cov.pct}%`, foot: `${inr(cov.fresh)} of ${inr(cov.total)} reported and fresh` },
        { label: 'Stale or missing', value: stale, tone: stale ? 'amber' : undefined },
        { label: 'Reports to review', value: review, tone: review ? 'amber' : undefined },
      ] });
      need(true, 'Partner reports to review', review, '/secondary?tab=review');
      need(true, 'Partners with stale or missing data', stale, '/secondary', 'slate');
    }
    if (enabled('claims')) {
      const cl = claims(pid); const q = cl.filter((c) => c.status === 'Under review');
      const leak = cl.filter((c) => c.status !== 'Rejected').reduce((a, c) => a + Math.max(0, c.claimedAmount - c.computedAmount), 0);
      const pend = claimSchemes(pid).filter((s) => s.status === 'Pending approval').length;
      sections.push({ module: 'claims', title: 'Schemes & claims', path: '/claims', tiles: [
        { label: 'Claims to review', value: q.length, foot: inr(q.reduce((a, c) => a + c.claimedAmount, 0)) + ' claimed' },
        { label: 'Claimed above verified', value: inr(leak), tone: leak ? 'red' : undefined },
        { label: 'To settle', value: cl.filter((c) => ['Approved', 'Partly approved'].includes(c.status)).length },
      ] });
      need(true, 'Scheme claims to review', q.length, '/claims');
      need(true, 'Schemes waiting for approval', pend, '/claims?tab=schemes');
    }
    if (enabled('crm')) {
      const c = crmSummary(pid);
      if (c) {
        sections.push({ module: 'crm', title: 'Sales CRM', path: '/crm', tiles: [
          { label: 'Pipeline', value: inr(c.pipeline), foot: `${inr(c.weighted)} weighted` }, { label: 'Open leads', value: c.openLeads },
          { label: 'Follow-ups due', value: c.due, foot: `${c.overdue} overdue`, tone: c.overdue ? 'red' : undefined },
        ] });
        need(true, 'Overdue sales follow-ups', c.overdue, '/crm', 'red');
        need(true, 'Leads and deals going cold', c.cold, '/crm', 'slate');
      }
    }
    if (enabled('surgical')) {
      const cs = surgicalCases().filter((c) => c.principalId === pid);
      const up = cs.filter((c) => c.status === 'Confirmed' && c.surgeryDate >= t);
      const overdue = surgicalSets().filter((s) => s.kind === 'Loaner' && s.hospitalId && s.sentAt && Date.now() - Date.parse(s.sentAt) > 7 * 86400000);
      sections.push({ module: 'surgical', title: 'Surgery cases', path: '/surgical', tiles: [
        { label: 'Upcoming surgeries', value: up.length }, { label: 'In progress', value: cs.filter((c) => ['Kit dispatched', 'Surgery done', 'Kit returned'].includes(c.status)).length },
        { label: 'Loaner sets overdue', value: overdue.length, tone: overdue.length ? 'red' : undefined },
      ] });
      need(true, 'Loaner sets out more than 7 days', overdue.length, '/surgical?tab=sets', 'red');
    }
    if (enabled('returns')) {
      const rs = returns().filter((r) => r.principalId === pid);
      sections.push({ module: 'returns', title: 'Returns', path: '/returns', tiles: [
        { label: 'To approve', value: rs.filter((r) => r.status === 'Requested').length }, { label: 'To inspect', value: rs.filter((r) => r.status === 'Received').length },
        { label: 'To credit', value: rs.filter((r) => r.status === 'Inspected').length },
      ] });
      need(true, 'Returns to approve', rs.filter((r) => r.status === 'Requested').length, '/returns');
    }
    if (enabled('recall')) {
      const rc = recalls().filter((r) => r.principalId === pid); const cp = complaints().filter((c) => c.principalId === pid);
      const active = rc.filter((r) => r.status === 'Active').length;
      sections.push({ module: 'recall', title: 'Complaints & recall', path: '/recall', tiles: [
        { label: 'Active recalls', value: active, tone: active ? 'red' : undefined }, { label: 'Open complaints', value: cp.filter((c) => c.status !== 'Closed').length },
      ] });
      need(true, 'Active recalls', active, '/recall?tab=recalls', 'red');
    }
    const order: BadgeTone[] = ['red', 'amber', 'slate'];
    attention.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));
    return { sections, attention, weekly };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pid, partnersAll, products]);

  return (
    <div className="g2 g2-embed">
      <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${currentUser.name.split(' ').slice(-2)[0]}`} description={<>{activePrincipal.name} — everything that needs you, across the modules switched on.</>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
        <div className="g2-stack" style={{ gap: 16 }}>
          {data.sections.length === 0 && <Card><div className="g2-muted">No operational modules are switched on yet. Start with the <a href="/setup">Setup checklist</a>.</div></Card>}
          {data.sections.map((s) => (
            <Card key={s.module} title={s.title} actions={<a href="#" className="g2-small" onClick={(e) => { e.preventDefault(); navigate(s.path); }}>Open <ArrowRight size={12} style={{ verticalAlign: -2 }} /></a>}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${s.tiles.length}, minmax(0, 1fr))`, gap: 12 }}>
                {s.tiles.map((tl) => (
                  <div key={tl.label} style={{ cursor: 'pointer' }} onClick={() => navigate(s.path)}>
                    <div className="g2-small g2-muted">{tl.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: tl.tone === 'red' ? '#b91c1c' : tl.tone === 'amber' ? '#b45309' : undefined }}>{tl.value}</div>
                    {tl.foot && <div className="g2-small g2-muted">{tl.foot}</div>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {data.weekly.length > 0 && (
            <Card title={<span className="g2-row"><BarChart3 size={16} /> Order value — last 8 weeks</span>}>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weekly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" tickLine={false} fontSize={12} />
                    <YAxis tickFormatter={(v: number) => inr(v)} width={70} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => inr(Number(v))} labelFormatter={(l) => `Week of ${l}`} />
                    <Bar dataKey="value" fill="#6d28d9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
        <Card title={<span className="g2-row"><AlertTriangle size={16} /> Needs attention</span>} subtitle={data.attention.length ? `${data.attention.length} item(s)` : 'All clear'} style={{ position: 'sticky', top: 12 }}>
          {data.attention.length === 0 && <div className="g2-small g2-muted">Nothing waiting on you.</div>}
          <div className="g2-stack" style={{ gap: 8 }}>
            {data.attention.map((a) => (
              <div key={a.text} className="g2-row" style={{ cursor: 'pointer', gap: 8 }} onClick={() => navigate(a.path)}>
                <Badge tone={a.tone}>{a.count}</Badge><span style={{ flex: 1, fontSize: 13 }}>{a.text}</span><ArrowRight size={14} className="g2-muted" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
export default HomeDashboard;
