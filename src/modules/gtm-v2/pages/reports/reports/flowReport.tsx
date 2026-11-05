import type { ReportDefinition } from './types';
import { filterFlows } from './types';
import { flowCoverage, stageSummary } from '../../../utils/flow';
import { formatDate } from '../../../utils/format';
import { StatusBadge } from '../../../components/ui';

interface Row {
  id: string; code: string; name: string; chain: string; stages: number; status: string; version: number; effective: string;
  coverage: number; products: string; productCount: number; relationships: number; partners: number;
}

export const flowReport: ReportDefinition<Row> = {
  id: 'flow',
  label: 'Sales Policy Report',
  description: 'Master sales policies with coverage, applicable Product Master scope and the number of actual partner relationships built on them.',
  filters: ['territory', 'zone', 'channel', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'name', header: 'Flow', value: (r) => r.name, render: (r) => <div><div className="g2-cell-main">{r.name}</div><div className="g2-cell-sub g2-mono">{r.code}</div></div> },
    { key: 'chain', header: 'Topology', value: (r) => r.chain, render: (r) => <span className="g2-small">{r.chain}</span> },
    { key: 'stages', header: 'Stages', value: (r) => r.stages, align: 'right' },
    { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'version', header: 'Version', value: (r) => r.version, render: (r) => `v${r.version}` },
    { key: 'effective', header: 'Effective', value: (r) => r.effective },
    { key: 'coverage', header: 'Territories Covered', value: (r) => r.coverage, align: 'right' },
    { key: 'products', header: 'Products', value: (r) => `${r.products} (${r.productCount})`, render: (r) => <div><div className="g2-small">{r.products}</div><div className="g2-cell-sub">{r.productCount} items</div></div> },
    { key: 'rel', header: 'Relationships', value: (r) => r.relationships, align: 'right' },
    { key: 'partners', header: 'Partners on Flow', value: (r) => r.partners, align: 'right' },
  ],
  build: (ctx) => {
    const flows = filterFlows(ctx);
    const rows = flows.map((f) => {
      const ps = ctx.pm.productsInScope(f.productScope);
      return {
        id: f.id, code: f.code, name: f.name, chain: stageSummary(f.stages, ctx.channels), stages: f.stages.length, status: f.status, version: f.version,
        effective: `${formatDate(f.effectiveFrom)} – ${f.effectiveTo ? formatDate(f.effectiveTo) : 'open'}`,
        coverage: flowCoverage(f, ctx.zones).length, products: ctx.pm.describeScope(f.productScope), productCount: ps.length,
        relationships: ctx.mappings.filter((m) => m.flowId === f.id && m.status === 'Active').length,
        partners: ctx.partners.filter((p) => p.flowIds.includes(f.id)).length,
      };
    });
    return {
      rows,
      summary: [
        { label: 'Flows', value: rows.length, tone: 'purple' },
        { label: 'Active', value: rows.filter((r) => r.status === 'Active').length, tone: 'green' },
        { label: 'Draft', value: rows.filter((r) => r.status === 'Draft').length, tone: 'slate' },
        { label: 'Active relationships', value: rows.reduce((s, r) => s + r.relationships, 0), tone: 'blue' },
      ],
    };
  },
};
