/**
 * Supply relationships — "neighbours only".
 * Each partner records ONLY its own suppliers (one level up) and direct customers (one level down).
 * The full chain is derived by joining each partner's own links, so records can never contradict.
 */
import type {
  CustomerLink, Partner, PartnerFlowMapping, PartnerType, SalesChannel, SalesFlow, SupplierLink,
} from '../types';
import type { Warehouse } from '../../../types/warehouse.ts';
import { uid } from './format';

export const tradeModelOf = (c?: SalesChannel | null) => c?.tradeModel ?? 'RESELL';

export const channelOfPartner = (p: Partner | undefined, types: PartnerType[]) => types.find((t) => t.id === p?.partnerTypeId)?.channelId ?? null;

/** Channels in the policy that can supply a partner of `selfChannelId` (one level up). */
export const upstreamChannels = (policy: SalesFlow, selfChannelId: string | null, channels: SalesChannel[]): SalesChannel[] => {
  const self = channels.find((c) => c.id === selfChannelId);
  const inPolicy = new Set(policy.stages.map((s) => s.channelId).filter(Boolean) as string[]);
  return channels.filter((c) => inPolicy.has(c.id) && c.id !== selfChannelId && !c.canBeEndpoint
    && (!self || self.canBeEndpoint || c.tierRank < self.tierRank))
    .sort((a, b) => a.tierRank - b.tierRank);
};

/** Channels in the policy the partner can sell to (one level down). */
export const downstreamChannels = (policy: SalesFlow, selfChannelId: string | null, channels: SalesChannel[]): SalesChannel[] => {
  const self = channels.find((c) => c.id === selfChannelId);
  if (!self || self.canBeEndpoint) return [];
  const inPolicy = new Set(policy.stages.map((s) => s.channelId).filter(Boolean) as string[]);
  return channels.filter((c) => inPolicy.has(c.id) && c.id !== selfChannelId && (c.canBeEndpoint || c.tierRank > self.tierRank))
    .sort((a, b) => Number(a.canBeEndpoint) - Number(b.canBeEndpoint) || a.tierRank - b.tierRank);
};

export const newSupplier = (policy: SalesFlow, role: SupplierLink['role'] = 'PRIMARY'): SupplierLink => ({
  id: uid('sup'), kind: 'COMPANY', channelId: null, partnerId: null,
  warehouseId: policy.stages.find((s) => s.kind === 'SOURCE')?.warehouseId ?? null, role, portfolioIds: [],
});

export interface PoTarget {
  /** Who receives the PO. null partner = the company (principal). */
  poToPartnerId: string | null;
  poTo: string;
  shipsFrom: string;
  note: string;
}

/**
 * PO rule: the PO goes to the nearest upstream party that OWNS the stock.
 * - Company direct            → PO to company, ships from the chosen warehouse
 * - Agent channel (e.g. C&F)  → PO to company, ships from the agent's depot
 * - Resell channel (SS, Dist) → PO to that partner, ships from its godown
 */
export const poTarget = (link: SupplierLink, channels: SalesChannel[], partners: Partner[], warehouses: Warehouse[], principalName = 'Company'): PoTarget => {
  if (link.kind === 'COMPANY') {
    const wh = warehouses.find((w) => w.id === link.warehouseId);
    return { poToPartnerId: null, poTo: principalName, shipsFrom: wh?.name ?? 'Any company warehouse', note: 'Direct from company' };
  }
  const p = partners.find((x) => x.id === link.partnerId);
  const ch = channels.find((c) => c.id === link.channelId);
  if (tradeModelOf(ch) === 'AGENT') {
    return { poToPartnerId: null, poTo: principalName, shipsFrom: `${p?.name ?? ch?.name ?? 'Agent'} depot`, note: `${ch?.name ?? 'Agent'} is an agent — invoices come from the company` };
  }
  return { poToPartnerId: p?.id ?? null, poTo: p?.name ?? `(${ch?.name ?? 'partner'} not selected)`, shipsFrom: `${p?.name ?? ch?.name ?? 'Partner'} godown`, note: `${ch?.name ?? 'Partner'} buys and resells` };
};

/** The mapping that holds a partner's OWN supply links (prefers active, same policy). */
export const ownMappingOf = (partnerId: string, mappings: PartnerFlowMapping[], policyId?: string) =>
  mappings.filter((m) => m.partnerId === partnerId)
    .sort((a, b) => Number(b.flowId === policyId) - Number(a.flowId === policyId) || Number(b.status === 'Active') - Number(a.status === 'Active'))[0];

/** Primary supplier link of a mapping (new model), or one derived from a legacy mapping. */
export const primarySupplierOf = (m: PartnerFlowMapping | undefined, flows: SalesFlow[]): SupplierLink | null => {
  if (!m) return null;
  if (m.suppliers?.length) return m.suppliers.find((s) => s.role === 'PRIMARY') ?? m.suppliers[0];
  const flow = flows.find((f) => f.id === m.flowId);
  if (!flow) return null;
  const sup = flow.stages.find((s) => s.id === m.supplierStageId)
    ?? flow.stages[flow.stages.findIndex((s) => s.id === m.ownStageId) - 1];
  if (!sup || sup.kind === 'SOURCE') return { id: 'legacy', kind: 'COMPANY', channelId: null, partnerId: null, warehouseId: m.supplyWarehouseId ?? sup?.warehouseId ?? null, role: 'PRIMARY', portfolioIds: [] };
  const pid = m.stageAssignments.find((a) => a.stageId === sup.id)?.partnerIds[0] ?? null;
  return { id: 'legacy', kind: 'PARTNER', channelId: sup.channelId ?? null, partnerId: pid, warehouseId: null, role: 'PRIMARY', portfolioIds: [] };
};

export interface ChainNode { label: string; sub: string; channelId: string | null; partnerId: string | null; company: boolean }

/**
 * Upstream chain ABOVE a supplier, derived from each partner's own records (read-only).
 * Returns nodes from the top (company) down to — but excluding — `partnerId`.
 */
export const derivedUpstream = (
  partnerId: string | null, mappings: PartnerFlowMapping[], flows: SalesFlow[], partners: Partner[], types: PartnerType[],
  channels: SalesChannel[], warehouses: Warehouse[], policyId?: string, guard = new Set<string>(),
): ChainNode[] => {
  if (!partnerId || guard.has(partnerId)) return [];
  guard.add(partnerId);
  const link = primarySupplierOf(ownMappingOf(partnerId, mappings, policyId), flows);
  if (!link) return [];
  if (link.kind === 'COMPANY') {
    return [{ label: 'Company Warehouse', sub: warehouses.find((w) => w.id === link.warehouseId)?.name ?? 'Any warehouse', channelId: null, partnerId: null, company: true }];
  }
  const p = partners.find((x) => x.id === link.partnerId);
  const ch = channels.find((c) => c.id === (link.channelId ?? channelOfPartner(p, types)));
  const above = derivedUpstream(link.partnerId, mappings, flows, partners, types, channels, warehouses, policyId, guard);
  return [...above, { label: ch?.name ?? 'Supplier', sub: p?.name ?? 'Not mapped', channelId: ch?.id ?? null, partnerId: p?.id ?? null, company: false }];
};

export interface LinkIssue { severity: 'error' | 'warning'; message: string }

export const validateLinks = (
  suppliers: SupplierLink[], customers: CustomerLink[], policy: SalesFlow, selfChannelId: string | null,
  channels: SalesChannel[], partnerPortfolioIds: string[],
  blocked: { fromChannelId: string; toChannelId: string }[] = [],
): LinkIssue[] => {
  const out: LinkIssue[] = [];
  const chName = (id: string | null) => channels.find((c) => c.id === id)?.name ?? 'Channel';
  const isBlocked = (from: string | null, to: string | null) => !!from && !!to && blocked.some((b) => b.fromChannelId === from && b.toChannelId === to);
  // Route Rules (Configuration): blocked "from → to" connections apply to actual supply links too.
  suppliers.forEach((s) => { if (s.kind === 'PARTNER' && isBlocked(s.channelId, selfChannelId)) out.push({ severity: 'error', message: `Route rule: ${chName(s.channelId)} may not supply ${chName(selfChannelId)}.` }); });
  customers.forEach((c) => { if (isBlocked(selfChannelId, c.channelId)) out.push({ severity: 'error', message: `Route rule: ${chName(selfChannelId)} may not sell to ${chName(c.channelId)}.` }); });
  const up = new Set(upstreamChannels(policy, selfChannelId, channels).map((c) => c.id));
  const down = new Set(downstreamChannels(policy, selfChannelId, channels).map((c) => c.id));
  if (!suppliers.length) out.push({ severity: 'error', message: 'Add at least one supplier (whom this partner buys from).' });
  if (suppliers.length && !suppliers.some((s) => s.role === 'PRIMARY')) out.push({ severity: 'error', message: 'Mark one supplier as Primary.' });
  suppliers.forEach((s, i) => {
    if (s.kind === 'PARTNER') {
      if (!s.channelId) out.push({ severity: 'error', message: `Supplier ${i + 1}: choose the supplier channel.` });
      else if (!up.has(s.channelId)) out.push({ severity: 'error', message: `Supplier ${i + 1}: ${channels.find((c) => c.id === s.channelId)?.name} cannot supply this partner under policy "${policy.name}".` });
      if (!s.partnerId) out.push({ severity: 'error', message: `Supplier ${i + 1}: choose the actual supplier partner.` });
    }
  });
  const dup = new Set<string>();
  suppliers.forEach((s) => {
    const key = `${s.kind}|${s.partnerId ?? s.warehouseId ?? ''}|${s.role}`;
    if (dup.has(key)) out.push({ severity: 'warning', message: 'The same supplier is added twice with the same role.' });
    dup.add(key);
  });
  // Every portfolio the partner deals in should have a primary supplier
  const primaries = suppliers.filter((s) => s.role === 'PRIMARY');
  if (primaries.length && !primaries.some((s) => !s.portfolioIds.length)) {
    const covered = new Set(primaries.flatMap((s) => s.portfolioIds));
    const missing = partnerPortfolioIds.filter((p) => !covered.has(p));
    if (missing.length) out.push({ severity: 'warning', message: `${missing.length} of the partner's portfolios have no primary supplier.` });
  }
  customers.forEach((c) => {
    if (!down.has(c.channelId)) out.push({ severity: 'error', message: `${channels.find((x) => x.id === c.channelId)?.name ?? 'Customer type'} is not allowed as a customer under policy "${policy.name}".` });
  });
  return out;
};

/**
 * Compatibility fields for views that read policy-stage based mappings
 * (own stage, supplier stage, stage assignments).
 */
export const linksCompat = (suppliers: SupplierLink[], customers: CustomerLink[], policy: SalesFlow, selfChannelId: string | null) => {
  const stageFor = (ch: string | null) => policy.stages.find((s) => s.kind === 'CHANNEL' && s.channelId === ch);
  const source = policy.stages.find((s) => s.kind === 'SOURCE');
  const primary = suppliers.find((s) => s.role === 'PRIMARY') ?? suppliers[0];
  const assign = new Map<string, Set<string>>();
  const add = (stageId: string | undefined, ids: string[]) => { if (!stageId) return; const set = assign.get(stageId) ?? new Set<string>(); ids.forEach((i) => set.add(i)); assign.set(stageId, set); };
  suppliers.filter((s) => s.kind === 'PARTNER').forEach((s) => add(stageFor(s.channelId)?.id, s.partnerId ? [s.partnerId] : []));
  customers.forEach((c) => add(stageFor(c.channelId)?.id, c.partnerIds));
  return {
    ownStageId: stageFor(selfChannelId)?.id ?? '',
    supplierStageId: !primary ? null : primary.kind === 'COMPANY' ? source?.id ?? null : stageFor(primary.channelId)?.id ?? null,
    supplyWarehouseId: primary?.kind === 'COMPANY' ? primary.warehouseId : null,
    stageAssignments: [...assign.entries()].map(([stageId, ids]) => ({ stageId, partnerIds: [...ids] })),
  };
};
