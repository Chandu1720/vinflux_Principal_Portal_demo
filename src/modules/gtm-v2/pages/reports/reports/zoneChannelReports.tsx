import type { ReportDefinition } from './types';
import { countPartners, filterPartners, partnerChannel, pct } from './types';
import { expandWithDescendants } from '../../../utils/territory';
import { Badge, StatusBadge } from '../../../components/ui';

interface ZoneRow { id: string; name: string; code: string; status: string; territories: number; total: number; active: number; onboarding: number; inactive: number; activePct: number }

export const zoneReport: ReportDefinition<ZoneRow> = {
  id: 'zone',
  label: 'Zone-wise Partners',
  description: 'Partners whose territories fall inside each zone (including descendant territories). Zones may overlap, so a partner can appear in several zones.',
  filters: ['zone', 'channel', 'status', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'name', header: 'Zone', value: (r) => r.name, render: (r) => <span className="g2-cell-main">{r.name}</span> },
    { key: 'code', header: 'Code', value: (r) => r.code, render: (r) => <span className="g2-mono">{r.code}</span> },
    { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'terr', header: 'Assigned Territories', value: (r) => r.territories, align: 'right' },
    { key: 'total', header: 'Total Partners', value: (r) => r.total, align: 'right' },
    { key: 'active', header: 'Active', value: (r) => r.active, align: 'right' },
    { key: 'onb', header: 'In Onboarding', value: (r) => r.onboarding, align: 'right' },
    { key: 'inactive', header: 'Suspended / Rejected', value: (r) => r.inactive, align: 'right' },
    { key: 'pct', header: 'Active %', value: (r) => r.activePct, render: (r) => `${r.activePct}%`, align: 'right' },
  ],
  build: (ctx) => {
    const partners = filterPartners({ ...ctx, filters: { ...ctx.filters, zoneId: '' } });
    const zones = ctx.filters.zoneId ? ctx.zones.filter((z) => z.id === ctx.filters.zoneId) : ctx.zones;
    const rows = zones.map((z) => {
      const scope = expandWithDescendants(z.territoryIds, ctx.territories);
      const c = countPartners(partners.filter((p) => p.territoryIds.some((t) => scope.has(t))));
      return { id: z.id, name: z.name, code: z.code, status: z.status, territories: z.territoryIds.length, ...c, activePct: pct(c.active, c.total) };
    });
    return {
      rows,
      summary: [
        { label: 'Zones', value: rows.length, tone: 'purple' },
        { label: 'Active zones', value: rows.filter((r) => r.status === 'Active').length, tone: 'green' },
        { label: 'Partner assignments', value: rows.reduce((s, r) => s + r.total, 0), tone: 'blue' },
      ],
    };
  },
};

interface ChannelRow { id: string; name: string; code: string; tier: number; endpoint: boolean; status: string; flows: number; total: number; active: number; onboarding: number; inactive: number }

export const channelReport: ReportDefinition<ChannelRow> = {
  id: 'channel',
  label: 'Channel-wise Partners',
  description: 'Partner counts per configured sales channel (partner type → channel), with the number of sales policies that use each channel.',
  filters: ['territory', 'zone', 'channel', 'status', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'name', header: 'Sales Channel', value: (r) => r.name, render: (r) => <span className="g2-cell-main">{r.name} {r.endpoint && <Badge tone="green">End customer</Badge>}</span> },
    { key: 'code', header: 'Code', value: (r) => r.code, render: (r) => <span className="g2-mono">{r.code}</span> },
    { key: 'tier', header: 'Tier', value: (r) => r.tier, align: 'right' },
    { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'flows', header: 'Policies Using', value: (r) => r.flows, align: 'right' },
    { key: 'total', header: 'Total Partners', value: (r) => r.total, align: 'right' },
    { key: 'active', header: 'Active', value: (r) => r.active, align: 'right' },
    { key: 'onb', header: 'In Onboarding', value: (r) => r.onboarding, align: 'right' },
    { key: 'inactive', header: 'Suspended / Rejected', value: (r) => r.inactive, align: 'right' },
  ],
  build: (ctx) => {
    const partners = filterPartners(ctx);
    const chans = ctx.filters.channelId ? ctx.channels.filter((c) => c.id === ctx.filters.channelId) : ctx.channels;
    const rows = chans.map((c) => ({
      id: c.id, name: c.name, code: c.code, tier: c.tierRank, endpoint: c.canBeEndpoint, status: c.status,
      flows: ctx.flows.filter((f) => f.stages.some((s) => s.channelId === c.id)).length,
      ...countPartners(partners.filter((p) => partnerChannel(p, ctx) === c.id)),
    })).sort((a, b) => a.tier - b.tier);
    return {
      rows,
      summary: [
        { label: 'Channels', value: rows.length, tone: 'purple' },
        { label: 'Partners in scope', value: partners.length, tone: 'blue' },
        { label: 'Channels without partners', value: rows.filter((r) => r.total === 0).length, tone: 'amber' },
      ],
    };
  },
};
