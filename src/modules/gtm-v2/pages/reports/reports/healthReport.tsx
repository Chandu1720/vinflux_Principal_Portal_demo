import type { ReportDefinition } from './types';
import { filterPartners, partnerTypeName } from './types';
import { Badge } from '../../../components/ui';
import { complianceOf, creditOf, portalSummary, tradeStatusOf } from '../../../utils/health';
import { formatDate, formatINR } from '../../../utils/format';

interface Row {
  id: string; partner: string; code: string; type: string; trade: string; tradeTone: 'green' | 'amber' | 'red' | 'slate'; reasons: string;
  licence: string; licenceUntil: string; limit: number; outstanding: number; overdue: number; util: number; portal: string;
}

/** Licences + credit + portal in one row per active partner — the "can they trade?" report. */
export const healthReport: ReportDefinition<Row> = {
  id: 'health',
  label: 'Partner Health (licences & credit)',
  description: 'Every active partner with its trade status, nearest licence expiry, credit used and portal users.',
  filters: ['territory', 'zone', 'channel'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'partner', header: 'Partner', value: (r) => r.partner, render: (r) => <div><div className="g2-cell-main">{r.partner}</div><div className="g2-cell-sub">{r.code} · {r.type}</div></div> },
    { key: 'trade', header: 'Trade Status', value: (r) => r.trade, render: (r) => <><Badge tone={r.tradeTone} dot>{r.trade}</Badge><div className="g2-cell-sub">{r.reasons}</div></> },
    { key: 'licence', header: 'Licence', value: (r) => r.licence },
    { key: 'until', header: 'Valid Until', value: (r) => r.licenceUntil },
    { key: 'limit', header: 'Credit Limit', value: (r) => r.limit, render: (r) => formatINR(r.limit), align: 'right' },
    { key: 'out', header: 'Outstanding', value: (r) => r.outstanding, render: (r) => formatINR(r.outstanding), align: 'right' },
    { key: 'od', header: 'Overdue', value: (r) => r.overdue, render: (r) => (r.overdue ? <span style={{ color: '#d97706', fontWeight: 600 }}>{formatINR(r.overdue)}</span> : '—'), align: 'right' },
    { key: 'util', header: 'Used %', value: (r) => r.util, render: (r) => `${r.util}%`, align: 'right' },
    { key: 'portal', header: 'Portal Users', value: (r) => r.portal },
  ],
  build: (ctx) => {
    const data = { channels: ctx.channels, terms: ctx.terms, territories: ctx.territories };
    const rows: Row[] = filterPartners(ctx).filter((p) => p.status === 'Active').map((p) => {
      const t = tradeStatusOf(p, ctx.config, data);
      const c = creditOf(p, ctx.config, data);
      const w = complianceOf(p, ctx.config).worst;
      const ps = portalSummary(p);
      return {
        id: p.id, partner: p.name, code: p.code, type: partnerTypeName(p, ctx),
        trade: t.label, tradeTone: t.tone, reasons: t.tone === 'green' ? '' : t.reasons.map((r) => r.text).join('; '),
        licence: w ? (w.state === 'expired' ? 'Expired' : w.state === 'expiring' ? `Expires in ${w.daysLeft}d` : w.state === 'no-date' ? 'No date' : 'Valid') : 'Not required',
        licenceUntil: w?.doc.validUntil ? formatDate(w.doc.validUntil) : '—',
        limit: c.limit, outstanding: c.outstanding, overdue: c.overdue, util: c.utilPct,
        portal: ps.total ? `${ps.active} active · ${ps.pending} pending${ps.expired ? ` · ${ps.expired} expired` : ''}` : 'None',
      };
    });
    return {
      rows,
      summary: [
        { label: 'Ready to trade', value: rows.filter((r) => r.tradeTone === 'green').length, tone: 'green' },
        { label: 'Needs attention', value: rows.filter((r) => r.tradeTone === 'amber').length, tone: 'amber' },
        { label: 'Blocked', value: rows.filter((r) => r.tradeTone === 'red').length, tone: 'red' },
        { label: 'Receivables', value: formatINR(rows.reduce((a, r) => a + r.outstanding, 0)), tone: 'purple' },
        { label: 'Overdue', value: formatINR(rows.reduce((a, r) => a + r.overdue, 0)), tone: 'amber' },
      ],
    };
  },
};
