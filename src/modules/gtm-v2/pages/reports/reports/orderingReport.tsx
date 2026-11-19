import type { ReportDefinition } from './types';
import { channelName, filterPartners, partnerTypeName } from './types';
import { poTarget, primarySupplierOf } from '../../../utils/supply';
import type { SupplierLink } from '../../../types';
import { Badge } from '../../../components/ui';
import { tradeStatusOf } from '../../../utils/health';

interface Row {
  id: string; partner: string; code: string; type: string; policy: string; products: string; role: string;
  buysFrom: string; poTo: string; shipsFrom: string; why: string;
}

/**
 * Ordering matrix — for every partner, whom it raises purchase orders to and where stock ships from.
 * Derived from each partner's own supply links (agents such as C&F route POs to the company).
 */
export const orderingReport: ReportDefinition<Row> = {
  id: 'ordering',
  label: 'Ordering Matrix (PO routing)',
  description: 'Whom each partner raises POs to, for which products, and where the stock ships from. Agents (e.g. C&F) only dispatch — POs go to the company.',
  filters: ['territory', 'zone', 'channel', 'status'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'partner', header: 'Partner', value: (r) => r.partner, render: (r) => <div><div className="g2-cell-main">{r.partner}</div><div className="g2-cell-sub">{r.code} · {r.type}</div></div> },
    { key: 'policy', header: 'Sales Policy', value: (r) => r.policy },
    { key: 'products', header: 'Products', value: (r) => r.products },
    { key: 'role', header: 'Role', value: (r) => r.role, render: (r) => <Badge tone={r.role === 'Primary' ? 'purple' : 'slate'}>{r.role}</Badge> },
    { key: 'buys', header: 'Buys From', value: (r) => r.buysFrom },
    { key: 'po', header: 'PO Goes To', value: (r) => r.poTo, render: (r) => <span className="g2-strong">{r.poTo}</span> },
    { key: 'ships', header: 'Ships From', value: (r) => r.shipsFrom },
    { key: 'why', header: 'Rule', value: (r) => r.why, render: (r) => <span className="g2-small" style={{ color: r.why.startsWith('⚠') ? '#b45309' : undefined }}>{r.why}</span> },
  ],
  build: (ctx) => {
    const partners = filterPartners(ctx);
    const rows: Row[] = [];
    partners.forEach((p) => {
      ctx.mappings.filter((m) => m.partnerId === p.id).forEach((m) => {
        const links: SupplierLink[] = m.suppliers?.length ? m.suppliers : [primarySupplierOf(m, ctx.flows)].filter(Boolean) as SupplierLink[];
        links.forEach((l, i) => {
          const t = poTarget(l, ctx.channels, ctx.partners, ctx.warehouses, ctx.principalName);
          const supP = l.kind === 'PARTNER' ? ctx.partners.find((x) => x.id === l.partnerId) : undefined;
          const supT = supP ? tradeStatusOf(supP, ctx.config, { channels: ctx.channels, terms: ctx.terms, territories: ctx.territories }) : null;
          const hasBackup = links.some((x) => x.role === 'BACKUP' && x.id !== l.id);
          const blocked = supT && !supT.canTrade ? `⚠ Supplier blocked (${supT.label}) — ${l.role === 'PRIMARY' && hasBackup ? 'route orders via the backup link' : 'add a backup supplier'}. ` : '';
          const sup = l.kind === 'COMPANY' ? `${ctx.principalName} (direct)` : `${channelName(l.channelId ?? '', ctx)}: ${ctx.partners.find((x) => x.id === l.partnerId)?.name ?? 'not mapped'}`;
          rows.push({
            id: `${m.id}-${i}`, partner: p.name, code: p.code, type: partnerTypeName(p, ctx),
            policy: ctx.flows.find((f) => f.id === m.flowId)?.name ?? '—',
            products: l.portfolioIds.length ? l.portfolioIds.map((id) => ctx.pm.portfolios.find((x) => x.id === id)?.name ?? id).join(', ') : 'All products',
            role: l.role === 'PRIMARY' ? 'Primary' : 'Backup', buysFrom: sup, poTo: t.poTo, shipsFrom: t.shipsFrom, why: blocked + t.note,
          });
        });
      });
    });
    const toCompany = rows.filter((r) => r.poTo === ctx.principalName).length;
    return {
      rows,
      summary: [
        { label: 'Partners', value: new Set(rows.map((r) => r.code)).size, tone: 'purple' },
        { label: 'Supply links', value: rows.length },
        { label: 'POs to company', value: toCompany, tone: 'blue' },
        { label: 'POs to partners', value: rows.length - toCompany, tone: 'green' },
        { label: 'Backup links', value: rows.filter((r) => r.role === 'Backup').length, tone: 'slate' },
      ],
    };
  },
};

