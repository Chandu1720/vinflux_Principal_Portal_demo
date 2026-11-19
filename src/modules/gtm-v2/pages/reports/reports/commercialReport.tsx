import type { ReportDefinition } from './types';
import { channelName, filterPartners, partnerChannel } from './types';
import { COMMERCIAL_FIELDS, resolveTerms } from '../../../utils/commercial';
import { formatCommercial } from '../../../utils/format';
import { OriginBadge } from '../../../components/domain/Badges';
import type { ResolvedTerms, CommercialField } from '../../../types';

interface Row { id: string; code: string; name: string; channel: string; status: string; resolved: ResolvedTerms; overrides: number; pending: number }

const fieldCol = (key: CommercialField, header: string) => {
  const kind = COMMERCIAL_FIELDS.find((f) => f.key === key)!.kind;
  return {
    key,
    header,
    value: (r: Row) => `${formatCommercial(kind, r.resolved[key].value)} [${r.resolved[key].label}]`,
    render: (r: Row) => (
      <div>
        <div className="g2-strong">{formatCommercial(kind, r.resolved[key].value)}</div>
        <OriginBadge scope={r.resolved[key].scope} label={r.resolved[key].label} />
      </div>
    ),
  };
};

export const commercialReport: ReportDefinition<Row> = {
  id: 'commercial',
  label: 'Commercial Terms',
  description: 'Effective commercial terms per partner resolved by precedence: relationship → partner → territory → channel default. Each value shows its origin.',
  filters: ['territory', 'zone', 'channel', 'status', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'name', header: 'Partner', value: (r) => r.name, render: (r) => <div><div className="g2-cell-main">{r.name}</div><div className="g2-cell-sub g2-mono">{r.code}</div></div> },
    { key: 'channel', header: 'Channel', value: (r) => r.channel },
    fieldCol('standardDiscountPct', 'Discount'),
    fieldCol('creditPeriodDays', 'Credit Period'),
    fieldCol('creditLimit', 'Credit Limit'),
    fieldCol('depositRequired', 'Deposit Req.'),
    fieldCol('depositAmount', 'Deposit Amount'),
    { key: 'ov', header: 'Approved Overrides', value: (r) => r.overrides, align: 'right' },
    { key: 'pending', header: 'Pending Overrides', value: (r) => r.pending, align: 'right', render: (r) => r.pending ? <span style={{ color: 'var(--g2-amber)', fontWeight: 600 }}>{r.pending}</span> : '0' },
  ],
  build: (ctx) => {
    const rows: Row[] = [];
    filterPartners(ctx).forEach((p) => {
      const chId = partnerChannel(p, ctx);
      const channel = ctx.channels.find((c) => c.id === chId);
      if (!channel) return;
      const mine = ctx.terms.filter((t) => t.partnerId === p.id);
      rows.push({
        id: p.id, code: p.code, name: p.name, channel: channelName(chId, ctx), status: p.status,
        resolved: resolveTerms({ channel, partnerId: p.id, territoryIds: p.territoryIds, records: ctx.terms, territories: ctx.territories }),
        overrides: mine.filter((t) => t.approvalStatus === 'Approved').length,
        pending: mine.filter((t) => t.approvalStatus === 'Pending').length,
      });
    });
    const nonDefault = rows.filter((r) => Object.values(r.resolved).some((v) => v.scope !== 'CHANNEL')).length;
    return {
      rows,
      summary: [
        { label: 'Partners', value: rows.length, tone: 'purple' },
        { label: 'On channel defaults only', value: rows.length - nonDefault, tone: 'slate' },
        { label: 'With inherited / overridden terms', value: nonDefault, tone: 'blue' },
        { label: 'Pending overrides', value: rows.reduce((s, r) => s + r.pending, 0), tone: 'amber' },
      ],
    };
  },
};
