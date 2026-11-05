import React, { useMemo, useState } from 'react';
import { Badge, Button, DataTable, SearchInput, SearchableSelect, Select, StatusBadge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { OriginBadge } from '../../components/domain/Badges';
import { SCOPE_LABEL, SCOPE_PRECEDENCE } from '../../utils/commercial';
import { collapseSelection, expandWithDescendants, territoryPath } from '../../utils/territory';
import { formatDate, formatINR, includesText } from '../../utils/format';
import type { PartnerFlowMapping, ResolvedValue, TermScope } from '../../types';
import { buildEffectiveRows } from './effectiveRows';
import type { EffectiveRow } from './effectiveRows';
import type { GtmBundle } from '../partner-onboarding/stepProps';

const V: React.FC<{ r: ResolvedValue<unknown>; text: string }> = ({ r, text }) => (
  <div><div className="g2-strong">{text}</div><OriginBadge scope={r.scope} label={r.label} /></div>
);

export const EffectiveTermsTab: React.FC<{ data: GtmBundle }> = ({ data }) => {
  const [q, setQ] = useState('');
  const [channelId, setChannelId] = useState('');
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const rows = useMemo(() => buildEffectiveRows(data), [data]);

  const filtered = useMemo(() => {
    const scope = territoryId ? expandWithDescendants([territoryId], data.territories) : null;
    return rows.filter((r) => includesText([r.partner.name, r.partner.code], q)
      && (!channelId || r.channel.id === channelId)
      && (!scope || r.partner.territoryIds.some((t) => scope.has(t)))
      && (!origin || Object.values(r.resolved).some((v: ResolvedValue<unknown>) => v.scope === origin)));
  }, [rows, q, channelId, territoryId, origin, data.territories]);

  const flowName = (m: PartnerFlowMapping) => data.flows.find((f) => f.id === m.flowId)?.name ?? m.flowId;

  const columns: Column<EffectiveRow>[] = [
    { key: 'partner', header: 'Partner', sortValue: (r) => r.partner.name, render: (r) => <><div className="g2-cell-main">{r.partner.name}</div><div className="g2-cell-sub">{r.mapping ? `Relationship · ${flowName(r.mapping)}` : r.partner.code}</div></> },
    { key: 'channel', header: 'Sales channel', sortValue: (r) => r.channel.name, render: (r) => r.channel.name },
    { key: 'territory', header: 'Territory', render: (r) => (r.primaryTerritoryId ? <span title={territoryPath(r.primaryTerritoryId, data.territories)}>{data.territories.find((t) => t.id === r.primaryTerritoryId)?.name}{r.partner.territoryIds.length > 1 ? <span className="g2-muted"> +{collapseSelection(r.partner.territoryIds, data.territories).length - 1}</span> : null}</span> : '—') },
    { key: 'std', header: 'Std disc.', align: 'right', sortValue: (r) => r.defaultDiscount, render: (r) => `${r.defaultDiscount}%` },
    { key: 'disc', header: 'Approved disc.', sortValue: (r) => r.resolved.standardDiscountPct.value, render: (r) => <V r={r.resolved.standardDiscountPct} text={`${r.resolved.standardDiscountPct.value}%`} /> },
    { key: 'cp', header: 'Credit period', sortValue: (r) => r.resolved.creditPeriodDays.value, render: (r) => <V r={r.resolved.creditPeriodDays} text={`${r.resolved.creditPeriodDays.value} days`} /> },
    { key: 'cl', header: 'Credit limit', sortValue: (r) => r.resolved.creditLimit.value, render: (r) => <V r={r.resolved.creditLimit} text={formatINR(r.resolved.creditLimit.value)} /> },
    { key: 'dr', header: 'Deposit req.', render: (r) => <V r={r.resolved.depositRequired} text={r.resolved.depositRequired.value ? 'Yes' : 'No'} /> },
    { key: 'da', header: 'Deposit amt.', sortValue: (r) => r.resolved.depositAmount.value, render: (r) => <V r={r.resolved.depositAmount} text={r.resolved.depositRequired.value ? formatINR(r.resolved.depositAmount.value) : '—'} /> },
    { key: 'eff', header: 'Effective', sortValue: (r) => r.from, render: (r) => <span className="g2-small">{formatDate(r.from)}<br /><span className="g2-muted">{r.to ? `to ${formatDate(r.to)}` : 'open-ended'}</span></span> },
    { key: 'appr', header: 'Approval', render: (r) => (r.pending ? <Badge tone="amber" title="Pending overrides are not yet effective">{r.pending} pending</Badge> : <StatusBadge status="Approved" />) },
  ];

  return (
    <>
      <div className="g2-filterbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search partner…" />
        <Select value={channelId} placeholder="All channels" options={data.channels.map((c) => ({ value: c.id, label: c.name }))} onChange={setChannelId} />
        <div style={{ width: 230 }}>
          <SearchableSelect value={territoryId} clearable placeholder="Territory (incl. children)" onChange={setTerritoryId}
            options={data.territories.map((t) => ({ value: t.id, label: t.name, description: territoryPath(t.id, data.territories) }))} />
        </div>
        <Select value={origin} placeholder="Any origin" options={SCOPE_PRECEDENCE.map((s: TermScope) => ({ value: s, label: `Uses ${SCOPE_LABEL[s].toLowerCase()}` }))} onChange={setOrigin} />
        {(q || channelId || territoryId || origin) && <Button size="sm" variant="ghost" onClick={() => { setQ(''); setChannelId(''); setTerritoryId(null); setOrigin(''); }}>Reset</Button>}
        <span className="g2-spacer" /><span className="g2-small g2-muted">{filtered.length} rows</span>
      </div>
      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.key} emptyTitle="No effective terms" emptyDescription="Only active or suspended partners have effective commercial terms." />
    </>
  );
};
