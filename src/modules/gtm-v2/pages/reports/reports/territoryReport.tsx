import type { ReportDefinition } from './types';
import { countPartners, filterPartners, partnersInTerritory, pct } from './types';
import { getDepth, levelLabelFor, territoryPath } from '../../../utils/territory';
import { Progress, StatusBadge } from '../../../components/ui';

interface Row { id: string; name: string; code: string; path: string; level: string; status: string; total: number; active: number; onboarding: number; inactive: number; activePct: number }

export const territoryReport: ReportDefinition<Row> = {
  id: 'territory',
  label: 'Territory-wise Partners',
  description: 'Partners rolled up to the selected hierarchy level. A partner assigned to a child territory counts towards every ancestor.',
  filters: ['level', 'territory', 'zone', 'channel', 'status', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'name', header: 'Territory', value: (r) => r.name, render: (r) => <div><div className="g2-cell-main">{r.name}</div><div className="g2-cell-sub">{r.path}</div></div> },
    { key: 'code', header: 'Code', value: (r) => r.code, render: (r) => <span className="g2-mono">{r.code}</span> },
    { key: 'level', header: 'Level', value: (r) => r.level },
    { key: 'status', header: 'Territory Status', value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'total', header: 'Total Partners', value: (r) => r.total, align: 'right' },
    { key: 'active', header: 'Active', value: (r) => r.active, align: 'right' },
    { key: 'onboarding', header: 'In Onboarding', value: (r) => r.onboarding, align: 'right' },
    { key: 'inactive', header: 'Suspended / Rejected', value: (r) => r.inactive, align: 'right' },
    { key: 'pct', header: 'Active %', value: (r) => r.activePct, render: (r) => <div style={{ minWidth: 90 }}><div className="g2-small">{r.activePct}%</div><Progress value={r.activePct} /></div> },
  ],
  build: (ctx) => {
    const partners = filterPartners(ctx);
    const labels = ctx.config.territoryRules.levelLabels;
    const depth = ctx.filters.level;
    let terrs = ctx.territories.filter((t) => getDepth(t.id, ctx.territories) === depth);
    if (ctx.filters.territoryIds.length) {
      const sel = new Set(ctx.filters.territoryIds);
      terrs = terrs.filter((t) => sel.has(t.id));
    }
    const rows = terrs.map((t) => {
      const c = countPartners(partnersInTerritory(t.id, partners, ctx.territories));
      return { id: t.id, name: t.name, code: t.code, path: territoryPath(t.id, ctx.territories), level: levelLabelFor(depth, labels), status: t.status, ...c, activePct: pct(c.active, c.total) };
    }).sort((a, b) => b.total - a.total);
    const covered = rows.filter((r) => r.total > 0).length;
    return {
      rows,
      summary: [
        { label: `${levelLabelFor(depth, labels)} territories`, value: rows.length, tone: 'purple' },
        { label: 'With partners', value: covered, tone: 'green' },
        { label: 'Without partners', value: rows.length - covered, tone: rows.length - covered ? 'amber' : 'slate' },
        { label: 'Partners in scope', value: partners.length, tone: 'blue' },
      ],
    };
  },
};
