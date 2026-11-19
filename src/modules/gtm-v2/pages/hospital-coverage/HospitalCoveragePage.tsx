import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, Building2, Grid3x3, Link2, Plus } from 'lucide-react';
import { Badge, Button, Card, ErrorState, KpiCard, LoadingState, PageHeader, SearchInput, Tabs } from '../../components/ui';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { scopeMatcher } from '../../utils/territory';
import { ScopeBanner } from '../../components/domain/ScopeBanner';
import { useProductMaster } from '../../hooks/useProductMaster';
import { assignmentState, currentFor, metricsOf, ownerName, scoreOf, scoreStatus, scoreTone } from '../../utils/coverage';
import { formatDate, includesText } from '../../utils/format';
import { shortFormTypeIds } from '../../utils/eligibility';
import type { AssignInput } from '../../services';
import type { CustomerAssignment } from '../../types';
import { AssignDrawer } from './AssignDrawer';
import { TransferDrawer } from './TransferDrawer';
import { CoverageCellDrawer } from './CoverageCellDrawer';
import { hospitalsOf, scopeLabel } from './model';
import type { PortfolioCol } from './model';

/**
 * Hospital Coverage — who serves each hospital for each portfolio (company direct or a partner),
 * how they perform, and approved transfers with handover. Rows are grouped by hospital group.
 */
const HospitalCoveragePage: React.FC = () => {
  const data = useGtmBundle();
  const pm = useProductMaster();
  const { principal, can, territoryScope } = useGtmAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('matrix');
  const [q, setQ] = useState('');
  const [assign, setAssign] = useState<Partial<AssignInput> | null>(null);
  const [transfer, setTransfer] = useState<CustomerAssignment | null>(null);
  const cell = params.get('h') ? { customerId: params.get('h')!, portfolioId: params.get('p') || null } : null;
  const config = data.config;

  /** Portfolios sold to hospitals by active sales policies. */
  const cols: PortfolioCol[] = useMemo(() => {
    if (!config) return [];
    const hospChannels = new Set(config.partnerTypes.filter((t) => shortFormTypeIds(config).includes(t.id)).map((t) => t.channelId));
    const ids = new Set<string>();
    data.flows.filter((f) => f.status === 'Active' && f.stages.some((s) => s.channelId && hospChannels.has(s.channelId)))
      .forEach((f) => {
        f.productScope.portfolioIds.forEach((id) => ids.add(id));
        pm.productsInScope(f.productScope).forEach((p) => ids.add(p.portfolioId));
      });
    data.assignments.forEach((a) => { if (a.portfolioId) ids.add(a.portfolioId); });
    return pm.portfolios.filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
  }, [config, data.flows, data.assignments, pm]);

  if (data.error) return <ErrorState message={data.error} />;
  if (data.loading || !config) return <LoadingState label="Loading hospital coverage…" />;

  const inScope = scopeMatcher(territoryScope, data.territories);
  const allHosp = hospitalsOf(data.partners, config);
  const hospitals = allHosp.filter((h) => inScope(h.territoryIds) && includesText([h.name, h.institution?.hospitalGroup, h.address.city], q));
  const cellOwners = (hid: string, pid: string) => currentFor(data.assignments, hid, pid);
  const cells = hospitals.flatMap((h) => cols.map((c) => cellOwners(h.id, c.id)));
  const covered = cells.filter((c) => c.some((a) => a.role === 'PRIMARY')).length;
  const current = data.assignments.filter((a) => assignmentState(a) === 'Current');
  const watch = current.filter((a) => a.servedBy === 'PARTNER' && scoreStatus(scoreOf(metricsOf(a)), config.coverage) !== 'Good').length;
  const pendingTransfers = data.transfers.filter((t) => t.status === 'Pending').length;
  const groups = Array.from(new Set(hospitals.map((h) => h.institution?.hospitalGroup ?? 'Independent hospitals')));
  const openCell = (h: string, p: string | null) => { params.set('h', h); if (p) params.set('p', p); else params.delete('p'); setParams(params, { replace: true }); };
  const closeCell = () => { params.delete('h'); params.delete('p'); setParams(params, { replace: true }); };
  const pName = (id: string | null) => (id ? cols.find((c) => c.id === id)?.name ?? pm.nameOf(id) : 'All portfolios');

  return (
    <>
      <PageHeader title="Hospital Coverage" description="Who serves each hospital, per portfolio — company direct or a partner. Compare performance and move hospitals with approval and a clean handover."
        actions={can.manageConfig && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAssign({})}>Assign hospital</Button>} />
      <ScopeBanner scope={territoryScope} territories={data.territories} hidden={allHosp.filter((h) => !inScope(h.territoryIds)).length} />
      <div className="g2-grid g2-grid-5" style={{ marginBottom: 16 }}>
        <KpiCard label="Hospitals" value={hospitalsOf(data.partners, config).length} icon={<Building2 size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${groups.length} group(s)`} />
        <KpiCard label="Covered" value={`${covered}/${cells.length}`} icon={<Link2 size={22} />} color="#059669" bg="#ecfdf5" foot="hospital × portfolio" />
        <KpiCard label="White space" value={cells.length - covered} icon={<Grid3x3 size={22} />} color="#d97706" bg="#fffbeb" foot="nobody assigned" />
        <KpiCard label="On watch" value={watch} icon={<AlertTriangle size={22} />} color="#dc2626" bg="#fef2f2" foot="partners below target score" />
        <KpiCard label="Pending transfers" value={pendingTransfers} icon={<ArrowRightLeft size={22} />} color="#2563eb" bg="#eff6ff" foot="waiting for approval" />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'matrix', label: 'Coverage matrix' }, { id: 'list', label: 'All assignments', count: data.assignments.length }]} />
          <span className="g2-spacer" />
          <SearchInput value={q} onChange={setQ} placeholder="Search hospital, group, city…" />
        </div>
        {tab === 'matrix' && (
          <div className="g2-table-wrap">
            <table className="g2-table g2-coverage">
              <thead><tr><th>Hospital</th>{cols.map((c) => <th key={c.id}>{c.name}</th>)}</tr></thead>
              <tbody>
                {groups.map((g) => (
                  <React.Fragment key={g}>
                    <tr className="g2-group-row"><td colSpan={cols.length + 1}>{g}</td></tr>
                    {hospitals.filter((h) => (h.institution?.hospitalGroup ?? 'Independent hospitals') === g).map((h) => (
                      <tr key={h.id}>
                        <td><div className="g2-cell-main">{h.name}</div><div className="g2-cell-sub">{h.address.city}{h.institution?.bedCount ? ` · ${h.institution.bedCount} beds` : ''}</div></td>
                        {cols.map((c) => {
                          const owners = cellOwners(h.id, c.id);
                          const primary = owners.find((a) => a.role === 'PRIMARY');
                          const backup = owners.find((a) => a.role === 'BACKUP');
                          const st = primary && primary.servedBy === 'PARTNER' ? scoreStatus(scoreOf(metricsOf(primary)), config.coverage) : null;
                          return (
                            <td key={c.id}>
                              <button type="button" className={`g2-cov-cell ${primary ? '' : 'empty'}`} onClick={() => openCell(h.id, c.id)}>
                                {primary ? (
                                  <>
                                    <span className="g2-strong">{ownerName(primary, data.partners, principal.name)}</span>
                                    <span className="g2-row" style={{ gap: 4 }}>
                                      {primary.portfolioId === null && <Badge tone="slate">all portfolios</Badge>}
                                      {st && <Badge tone={scoreTone(st)} dot>{scoreOf(metricsOf(primary))} · {st}</Badge>}
                                      {primary.improvement && <Badge tone="amber">Improvement</Badge>}
                                      {primary.pendingTransferId && <Badge tone="blue">Transfer pending</Badge>}
                                    </span>
                                    {backup && <span className="g2-cell-sub">Backup: {ownerName(backup, data.partners, principal.name)}</span>}
                                  </>
                                ) : <span className="g2-muted">— White space · assign</span>}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {hospitals.length === 0 && <tr><td colSpan={cols.length + 1} className="g2-muted">No hospitals match.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'list' && (
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>Hospital</th><th>Portfolio</th><th>Served by</th><th>Role</th><th>Period</th><th>Status</th><th>Score</th></tr></thead>
              <tbody>
                {data.assignments.slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                  .filter((a) => includesText([data.partners.find((p) => p.id === a.customerId)?.name, ownerName(a, data.partners, principal.name)], q))
                  .map((a) => {
                    const stt = assignmentState(a);
                    const sc = scoreOf(metricsOf(a));
                    return (
                      <tr key={a.id} className="clickable" onClick={() => openCell(a.customerId, a.portfolioId)}>
                        <td className="g2-strong">{data.partners.find((p) => p.id === a.customerId)?.name}</td>
                        <td>{scopeLabel(a, cols, pm.nameOf)}</td>
                        <td>{ownerName(a, data.partners, principal.name)}</td>
                        <td><Badge tone={a.role === 'PRIMARY' ? 'purple' : 'slate'}>{a.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge></td>
                        <td>{formatDate(a.effectiveFrom)}{a.effectiveTo ? ` – ${formatDate(a.effectiveTo)}` : ''}{a.endReason && <div className="g2-cell-sub">{a.endReason}</div>}</td>
                        <td><Badge tone={stt === 'Current' ? 'green' : stt === 'Scheduled' ? 'cyan' : 'slate'} dot>{stt}</Badge></td>
                        <td>{a.servedBy === 'PARTNER' ? <Badge tone={scoreTone(scoreStatus(sc, config.coverage))}>{sc}</Badge> : <span className="g2-muted">Direct</span>}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {cell && (
        <CoverageCellDrawer data={data} customerId={cell.customerId} portfolioId={cell.portfolioId} portfolioName={pName(cell.portfolioId)} onClose={closeCell}
          onAssign={(role) => setAssign({ customerId: cell.customerId, portfolioId: cell.portfolioId, role })}
          onTransfer={(a) => setTransfer(a)} />
      )}
      {assign && <AssignDrawer data={data} cols={cols} preset={assign} onClose={() => setAssign(null)} />}
      {transfer && <TransferDrawer data={data} assignment={transfer} portfolioName={pName(transfer.portfolioId)} onClose={() => setTransfer(null)} />}
    </>
  );
};

export default HospitalCoveragePage;
