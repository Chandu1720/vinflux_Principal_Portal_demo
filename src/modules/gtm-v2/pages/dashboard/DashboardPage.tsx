import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CheckSquare, GitFork, Layers, Map, Plus, Shapes, Users } from 'lucide-react';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useProductMaster, useWarehouses } from '../../hooks/useProductMaster';
import { Button, Card, DataTable, EmptyState, ErrorState, KpiCard, LoadingState, PageHeader, Progress, Select } from '../../components/ui';
import type { Column } from '../../components/ui';
import { FlowDiagram } from '../../components/domain/FlowDiagram';
import { PartnerStatusBadge } from '../../components/domain/Badges';
import { mappingRouteView } from '../../utils/route';
import { PartnerHealthCard } from './PartnerHealthCard';
import { ROUTES } from '../../constants/navigation';
import { flowCoverage } from '../../utils/flow';
import { expandWithDescendants } from '../../utils/territory';
import { formatDate } from '../../utils/format';
import type { BadgeTone, Partner } from '../../types';

const TONE_COLOR: Record<BadgeTone, string> = {
  green: '#059669', amber: '#d97706', red: '#dc2626', blue: '#2563eb', purple: '#7c3aed', slate: '#94a3b8', cyan: '#0891b2',
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const b = useGtmBundle();
  const pm = useProductMaster();
  const warehouses = useWarehouses();
  const activeFlows = useMemo(() => b.flows.filter((f) => f.status === 'Active'), [b.flows]);
  const [mappingId, setMappingId] = useState<string>('');
  const routeMappings = b.mappings.filter((m) => b.partners.some((p) => p.id === m.partnerId));
  const viewOf = (m: (typeof routeMappings)[number]) => mappingRouteView(m, b.flows.find((f) => f.id === m.flowId), b.partners, b.config?.partnerTypes ?? [], b.channels, { mappings: b.mappings, flows: b.flows, warehouses });
  const exampleMapping = routeMappings.find((m) => m.id === mappingId)
    ?? routeMappings.slice().sort((a, c) => viewOf(c).stages.length - viewOf(a).stages.length)[0];
  const exampleView = exampleMapping ? viewOf(exampleMapping) : null;
  const routeOptions = routeMappings.map((m) => ({ value: m.id, label: `${b.partners.find((p) => p.id === m.partnerId)?.name ?? m.partnerId} — ${b.flows.find((f) => f.id === m.flowId)?.code ?? ''}` }));

  const statusData = useMemo(() => {
    const defs = b.config?.partnerStatuses ?? [];
    return defs.map((d) => ({ key: d.key, name: d.label, value: b.partners.filter((p) => p.status === d.key).length, color: TONE_COLOR[d.tone] }))
      .filter((d) => d.value > 0);
  }, [b.partners, b.config]);

  const byTerritory = useMemo(() => {
    const roots = b.territories.filter((t) => !t.parentId);
    // Use level-1 territories (children of roots) if any, else roots
    const level1 = b.territories.filter((t) => t.parentId && roots.some((r) => r.id === t.parentId) && t.status === 'Active');
    const targets = level1.length ? level1 : roots;
    return targets.map((t) => {
      const scope = expandWithDescendants([t.id], b.territories);
      const count = activeFlows.filter((f) => {
        const cov = flowCoverage(f, b.zones);
        // flow covers territory if any covered id is inside t's subtree, or an ancestor of t is covered
        if (cov.some((c) => scope.has(c))) return true;
        return cov.some((c) => expandWithDescendants([c], b.territories).has(t.id));
      }).length;
      return { name: t.name, flows: count };
    }).sort((a, c) => c.flows - a.flows);
  }, [b.territories, b.zones, activeFlows]);

  const coverage = useMemo(() => {
    const covered = new Set<string>();
    activeFlows.forEach((f) => pm.productsInScope(f.productScope).forEach((p) => covered.add(p.id)));
    const rows = pm.portfolios.map((pf) => {
      const prods = pm.products.filter((p) => p.portfolioId === pf.id);
      const c = prods.filter((p) => covered.has(p.id)).length;
      return { id: pf.id, name: pf.name, total: prods.length, covered: c };
    });
    return { rows, covered: covered.size, total: pm.products.length };
  }, [activeFlows, pm]);

  const recent = useMemo(() => b.partners.slice().sort((a, c) => (c.submittedAt ?? c.createdAt).localeCompare(a.submittedAt ?? a.createdAt)).slice(0, 6), [b.partners]);
  const pendingApprovals = b.approvals.filter((a) => a.status === 'Pending');

  if (b.loading) return <LoadingState label="Loading GTM dashboard…" />;
  if (b.error) return <ErrorState message={b.error} />;

  const typeName = (id: string) => b.config?.partnerTypes.find((t) => t.id === id)?.name ?? '—';
  const terrName = (id: string) => b.territories.find((t) => t.id === id)?.name ?? id;

  const cols: Column<Partner>[] = [
    { key: 'name', header: 'Partner', sortValue: (p) => p.name, render: (p) => <div><div className="g2-cell-main">{p.name}</div><div className="g2-cell-sub">{p.code}</div></div> },
    { key: 'type', header: 'Type', render: (p) => typeName(p.partnerTypeId) },
    { key: 'terr', header: 'Territories', render: (p) => <span className="g2-small">{p.territoryIds.slice(0, 2).map(terrName).join(', ')}{p.territoryIds.length > 2 ? ` +${p.territoryIds.length - 2}` : ''}</span> },
    { key: 'date', header: 'Submitted', sortValue: (p) => p.submittedAt ?? p.createdAt, render: (p) => formatDate(p.submittedAt ?? p.createdAt) },
    { key: 'status', header: 'Status', render: (p) => <PartnerStatusBadge status={p.status} config={b.config} /> },
  ];

  const activePartners = b.partners.filter((p) => p.status === 'Active').length;

  return (
    <div className="g2-stack">
      <PageHeader
        title="GTM Dashboard"
        description="Go-to-market structure, partner health and onboarding at a glance."
        actions={<>
          <Button icon={<GitFork size={15} />} onClick={() => navigate(ROUTES.flowNew)}>New Sales Policy</Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate(`${ROUTES.partners}?new=1`)}>Onboard Partner</Button>
        </>}
      />

      <div className="g2-grid g2-grid-5">
        <KpiCard label="Total Territories" value={b.territories.length} icon={<Map size={22} />} color="#6d28d9" bg="#f5f3ff"
          foot={<><span className="up">{b.territories.filter((t) => t.status === 'Active').length}</span> active</>} onClick={() => navigate(ROUTES.territories)} />
        <KpiCard label="Total Zones" value={b.zones.length} icon={<Shapes size={22} />} color="#2563eb" bg="#eff6ff"
          foot={<><span className="up">{b.zones.filter((z) => z.status === 'Active').length}</span> active</>} onClick={() => navigate(ROUTES.zones)} />
        <KpiCard label="Sales Channels" value={b.channels.length} icon={<Layers size={22} />} color="#0891b2" bg="#ecfeff"
          foot={`${b.channels.filter((c) => c.canBeEndpoint).length} end-customer channels`} onClick={() => navigate(ROUTES.channels)} />
        <KpiCard label="Sales Policies" value={b.flows.length} icon={<GitFork size={22} />} color="#d97706" bg="#fffbeb"
          foot={<><span className="up">{activeFlows.length}</span> active · {b.flows.filter((f) => f.status === 'Draft').length} draft</>} onClick={() => navigate(ROUTES.flows)} />
        <KpiCard label="Active Partners" value={activePartners} icon={<Users size={22} />} color="#059669" bg="#ecfdf5"
          foot={`${b.partners.length - activePartners} in other states`} onClick={() => navigate(ROUTES.partners)} />
      </div>

      <div className="g2-grid g2-grid-main">
        <Card
          title="Distribution Network – Example Route"
          subtitle="An actual partner route built during onboarding"
          actions={routeOptions.length > 0 && (
            <Select style={{ width: 260 }} value={exampleMapping?.id ?? ''} onChange={setMappingId} options={routeOptions} aria-label="Example route" />
          )}
        >
          {exampleMapping && exampleView && exampleView.stages.length > 1 ? (
            <>
              <FlowDiagram stages={exampleView.stages} channels={b.channels} warehouses={warehouses}
                stageFooter={(s) => (exampleView.names[s.id]?.length ? <div className="g2-small g2-strong" style={{ color: 'var(--g2-primary)' }}>{exampleView.names[s.id].join(', ')}</div> : null)} />
              <div className="g2-row g2-small g2-muted" style={{ justifyContent: 'space-between' }}>
                <span>Sales policy: {b.flows.find((f) => f.id === exampleMapping.flowId)?.name ?? '—'} · {exampleMapping.status}</span>
                <Button size="sm" variant="ghost" icon={<ArrowRight size={14} />} onClick={() => navigate(ROUTES.network)}>Open network</Button>
              </div>
            </>
          ) : <EmptyState title="No partner routes yet" description="Onboard a partner and build its route to see it here." action={<Button variant="primary" onClick={() => navigate(`${ROUTES.partners}?new=1`)}>Onboard partner</Button>} />}
        </Card>

        <PartnerHealthCard data={b} />
      </div>

      <div className="g2-grid g2-grid-main">
        <Card title="Sales Policies by Territory" subtitle="Active sales policies covering each territory (incl. zones and parent coverage)">
          {byTerritory.length ? (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byTerritory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#64748b' }} interval={0} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f5f3ff' }} />
                  <Bar dataKey="flows" name="Active policies" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No territories configured" />}
        </Card>

        <Card title="Product Coverage" subtitle={`From Product Master · ${coverage.covered} of ${coverage.total} products in active flows`}>
          {coverage.rows.length ? coverage.rows.map((r) => (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div className="g2-row g2-small" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="g2-ellipsis g2-strong" style={{ maxWidth: '75%' }} title={r.name}>{r.name}</span>
                <span className="g2-muted">{r.covered}/{r.total}</span>
              </div>
              <Progress value={r.total ? (r.covered / r.total) * 100 : 0} color={r.total && r.covered === r.total ? '#059669' : undefined} />
            </div>
          )) : <EmptyState title="Product Master is empty" />}
        </Card>
      </div>

      <div className="g2-grid g2-grid-main">
        <Card title="Partner Onboarding Status" subtitle={`${b.partners.length} partners`}>
          {statusData.length ? (
            <>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="#fff">
                      {statusData.map((d) => <Cell key={d.key} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="g2-legend">
                {statusData.map((d) => <span key={d.key}><i style={{ background: d.color }} />{d.name} <strong>{d.value}</strong></span>)}
              </div>
            </>
          ) : <EmptyState title="No partners yet" />}
        </Card>
        <Card title="Pending Approvals" subtitle={`${pendingApprovals.length} awaiting action`} actions={<Button size="sm" variant="ghost" icon={<ArrowRight size={14} />} onClick={() => navigate(ROUTES.approvals)}>Open</Button>}>
          {pendingApprovals.length === 0 && <EmptyState icon={<CheckSquare size={24} />} title="All caught up" description="No approvals pending." />}
          {pendingApprovals.slice(0, 5).map((a) => (
            <div key={a.id} className="g2-list-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="g2-cell-main g2-ellipsis">{a.summary}</div>
                <div className="g2-cell-sub">{a.requestNo} · {b.config?.approvalWorkflows.find((w) => w.category === a.category)?.label ?? a.category} · Level {a.currentLevel}/{a.steps.length}</div>
              </div>
              <span className="g2-small g2-muted">{formatDate(a.requestedAt)}</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="g2-grid">
        <Card title="Recent Partner Onboardings" actions={<Button size="sm" variant="ghost" icon={<ArrowRight size={14} />} onClick={() => navigate(ROUTES.partners)}>View all</Button>} flush>
          <DataTable columns={cols} rows={recent} rowKey={(p) => p.id} paginate={false} onRowClick={(p) => navigate(`${ROUTES.partners}?focus=${p.id}`)} emptyTitle="No onboardings yet" />
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
