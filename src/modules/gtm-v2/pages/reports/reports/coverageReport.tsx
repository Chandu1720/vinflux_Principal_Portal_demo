import type { ReportDefinition } from './types';
import { Badge } from '../../../components/ui';
import { assignmentState, metricsOf, ownerName, scoreOf, scoreStatus } from '../../../utils/coverage';
import { shortFormTypeIds } from '../../../utils/eligibility';
import { formatDate } from '../../../utils/format';

interface Row { id: string; hospital: string; group: string; portfolio: string; servedBy: string; role: string; since: string; until: string; state: string; score: number | null; status: string; reason: string }

export const coverageReport: ReportDefinition<Row> = {
  id: 'coverage',
  label: 'Hospital Coverage',
  description: 'Every hospital assignment: who serves which portfolio, since when, score and transfer history.',
  filters: ['territory', 'zone'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'hospital', header: 'Hospital', value: (r) => r.hospital, render: (r) => <div><div className="g2-cell-main">{r.hospital}</div><div className="g2-cell-sub">{r.group}</div></div> },
    { key: 'portfolio', header: 'Portfolio', value: (r) => r.portfolio },
    { key: 'servedBy', header: 'Served By', value: (r) => r.servedBy },
    { key: 'role', header: 'Role', value: (r) => r.role },
    { key: 'since', header: 'From', value: (r) => r.since },
    { key: 'until', header: 'To', value: (r) => r.until },
    { key: 'state', header: 'Status', value: (r) => r.state, render: (r) => <Badge tone={r.state === 'Current' ? 'green' : r.state === 'Scheduled' ? 'cyan' : 'slate'} dot>{r.state}</Badge> },
    { key: 'score', header: 'Score', value: (r) => r.score ?? '', render: (r) => (r.score === null ? <span className="g2-muted">Direct</span> : <Badge tone={r.status === 'Good' ? 'green' : r.status === 'On watch' ? 'amber' : 'red'}>{r.score} · {r.status}</Badge>), align: 'right' },
    { key: 'reason', header: 'End Reason', value: (r) => r.reason },
  ],
  build: (ctx) => {
    const hospIds = new Set(ctx.partners.filter((p) => shortFormTypeIds(ctx.config).includes(p.partnerTypeId)).map((p) => p.id));
    const scope = ctx.filters.territoryIds.length ? new Set(ctx.partners.filter((p) => p.territoryIds.some((t) => ctx.filters.territoryIds.includes(t))).map((p) => p.id)) : null;
    const rows: Row[] = (ctx.assignments ?? []).filter((a) => hospIds.has(a.customerId) && (!scope || scope.has(a.customerId))).map((a) => {
      const h = ctx.partners.find((p) => p.id === a.customerId);
      const sc = a.servedBy === 'PARTNER' ? scoreOf(metricsOf(a)) : null;
      return {
        id: a.id, hospital: h?.name ?? a.customerId, group: h?.institution?.hospitalGroup ?? '—',
        portfolio: a.portfolioId ? ctx.pm.nameOf(a.portfolioId) : 'All portfolios',
        servedBy: ownerName(a, ctx.partners, ctx.principalName), role: a.role === 'PRIMARY' ? 'Primary' : 'Backup',
        since: formatDate(a.effectiveFrom), until: a.effectiveTo ? formatDate(a.effectiveTo) : '—', state: assignmentState(a),
        score: sc, status: sc === null ? '' : scoreStatus(sc, ctx.config.coverage), reason: a.endReason ?? '',
      };
    });
    return {
      rows,
      summary: [
        { label: 'Hospitals', value: new Set(rows.map((r) => r.hospital)).size, tone: 'purple' },
        { label: 'Current', value: rows.filter((r) => r.state === 'Current').length, tone: 'green' },
        { label: 'Ended', value: rows.filter((r) => r.state === 'Ended').length, tone: 'slate' },
        { label: 'On watch / improve', value: rows.filter((r) => r.state === 'Current' && (r.status === 'On watch' || r.status === 'Improve')).length, tone: 'amber' },
      ],
    };
  },
};
