import type React from 'react';
import type {
  CommercialTermRecord, CustomerAssignment, GtmConfiguration, Partner, PartnerFlowMapping, SalesChannel, SalesFlow, Territory, Zone,
} from '../../../types';
import type { useProductMaster } from '../../../hooks/useProductMaster';
import type { Warehouse } from '../../../../../types/warehouse.ts';
import { expandWithDescendants, territoriesOverlap } from '../../../utils/territory';
import { flowCoverage } from '../../../utils/flow';

export type FilterKey = 'territory' | 'zone' | 'channel' | 'status' | 'date' | 'level';

export interface ReportFilters {
  territoryIds: string[];
  zoneId: string;
  channelId: string;
  status: string;
  from: string;
  to: string;
  level: number;
}

export const EMPTY_FILTERS: ReportFilters = { territoryIds: [], zoneId: '', channelId: '', status: '', from: '', to: '', level: 1 };

export interface ReportContext {
  filters: ReportFilters;
  config: GtmConfiguration;
  territories: Territory[];
  zones: Zone[];
  channels: SalesChannel[];
  flows: SalesFlow[];
  partners: Partner[];
  mappings: PartnerFlowMapping[];
  terms: CommercialTermRecord[];
  pm: ReturnType<typeof useProductMaster>;
  warehouses: Warehouse[];
  principalName: string;
  assignments?: CustomerAssignment[];
}

export interface ReportColumn<R> {
  key: string;
  header: string;
  /** Plain value for sorting + export. */
  value: (r: R) => string | number;
  render?: (r: R) => React.ReactNode;
  align?: 'left' | 'right';
}

export interface ReportResult<R> {
  rows: R[];
  summary: { label: string; value: string | number; tone?: 'green' | 'amber' | 'red' | 'purple' | 'slate' | 'blue' }[];
}

export interface ReportDefinition<R = unknown> {
  id: string;
  label: string;
  description: string;
  filters: FilterKey[];
  columns: ReportColumn<R>[];
  rowKey: (r: R) => string;
  build: (ctx: ReportContext) => ReportResult<R>;
}

/* ------------------------------ helpers ------------------------------ */

export const ONBOARDING_STATUSES = ['Draft', 'KYC Pending', 'KYC Under Review', 'Approval Pending'];
export const INACTIVE_STATUSES = ['Suspended', 'Rejected'];

export const partnerChannel = (p: Partner, ctx: ReportContext) => ctx.config.partnerTypes.find((t) => t.id === p.partnerTypeId)?.channelId ?? '';
export const partnerTypeName = (p: Partner, ctx: ReportContext) => ctx.config.partnerTypes.find((t) => t.id === p.partnerTypeId)?.name ?? '—';
export const channelName = (id: string, ctx: ReportContext) => ctx.channels.find((c) => c.id === id)?.name ?? '—';
export const territoryNames = (ids: string[], ctx: ReportContext) => ids.map((id) => ctx.territories.find((t) => t.id === id)?.name ?? id).join(', ');

const zoneTerritories = (ctx: ReportContext) => ctx.zones.find((z) => z.id === ctx.filters.zoneId)?.territoryIds ?? [];

/** Applies the common filters to partners. */
export const filterPartners = (ctx: ReportContext, opts: { ignoreStatus?: boolean } = {}): Partner[] => {
  const f = ctx.filters;
  return ctx.partners.filter((p) => {
    if (f.territoryIds.length && !territoriesOverlap(p.territoryIds, f.territoryIds, ctx.territories, 'hierarchy')) return false;
    if (f.zoneId && !territoriesOverlap(p.territoryIds, zoneTerritories(ctx), ctx.territories, 'hierarchy')) return false;
    if (f.channelId && partnerChannel(p, ctx) !== f.channelId) return false;
    if (!opts.ignoreStatus && f.status && p.status !== f.status) return false;
    const d = (p.submittedAt ?? p.createdAt).slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    return true;
  });
};

/** Applies territory/zone/channel filters to flows. */
export const filterFlows = (ctx: ReportContext): SalesFlow[] => {
  const f = ctx.filters;
  return ctx.flows.filter((fl) => {
    const cov = flowCoverage(fl, ctx.zones);
    if (f.territoryIds.length && !territoriesOverlap(cov, f.territoryIds, ctx.territories, 'hierarchy')) return false;
    if (f.zoneId && !fl.zoneIds.includes(f.zoneId) && !territoriesOverlap(cov, zoneTerritories(ctx), ctx.territories, 'hierarchy')) return false;
    if (f.channelId && !fl.stages.some((s) => s.channelId === f.channelId)) return false;
    const d = fl.effectiveFrom;
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    return true;
  });
};

export interface PartnerCounts { total: number; active: number; onboarding: number; inactive: number }

export const countPartners = (list: Partner[]): PartnerCounts => ({
  total: list.length,
  active: list.filter((p) => p.status === 'Active').length,
  onboarding: list.filter((p) => ONBOARDING_STATUSES.includes(p.status)).length,
  inactive: list.filter((p) => INACTIVE_STATUSES.includes(p.status)).length,
});

/** Partners assigned to the territory or any of its descendants. */
export const partnersInTerritory = (tid: string, partners: Partner[], territories: Territory[]) => {
  const scope = expandWithDescendants([tid], territories);
  return partners.filter((p) => p.territoryIds.some((t) => scope.has(t)));
};

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
