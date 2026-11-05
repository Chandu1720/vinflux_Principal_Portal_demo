/**
 * Partner route helpers. A sales POLICY (SalesFlow record) only says which channels may sell
 * which products where; the partner's actual route is built in onboarding as RouteStage[].
 */
import type { FlowRules, FlowStage, Partner, PartnerFlowMapping, PartnerType, RouteStage, SalesChannel, SalesFlow } from '../types';
import { validateFlowStages } from './flow';
import type { FlowIssue } from './flow';
import { uid } from './format';
import { derivedUpstream } from './supply';
import type { Warehouse } from '../../../types/warehouse.ts';

export const SELF_LABEL = 'This partner';

export const defaultRoute = (policy: SalesFlow): RouteStage[] => {
  const src = policy.stages.find((s) => s.kind === 'SOURCE');
  return [
    { id: uid('rt'), kind: 'SOURCE', warehouseId: src?.warehouseId ?? null, partnerIds: [], allowMultiplePartners: false },
    { id: uid('rt'), kind: 'SELF', partnerIds: [], allowMultiplePartners: false },
  ];
};

/** Convert to FlowStage[] so the shared diagram / validation can be reused. */
export const routeToStages = (route: RouteStage[], partnerChannelId: string | null, channels: SalesChannel[]): FlowStage[] =>
  route.map((r) => (r.kind === 'SOURCE'
    ? { id: r.id, kind: 'SOURCE', warehouseId: r.warehouseId ?? null, channelId: null, label: 'Company Warehouse', allowMultiplePartners: false }
    : r.kind === 'SELF'
      ? { id: r.id, kind: 'CHANNEL', channelId: partnerChannelId, warehouseId: null, label: SELF_LABEL, allowMultiplePartners: false }
      : { id: r.id, kind: 'CHANNEL', channelId: r.channelId ?? null, warehouseId: null, label: channels.find((c) => c.id === r.channelId)?.name ?? '', allowMultiplePartners: r.allowMultiplePartners }));

export const policyChannelIds = (policy: SalesFlow) => new Set(policy.stages.map((s) => s.channelId).filter(Boolean) as string[]);

export const validateRoute = (route: RouteStage[], policy: SalesFlow, channels: SalesChannel[], rules: FlowRules, partnerChannelId: string | null): FlowIssue[] => {
  const stages = routeToStages(route, partnerChannelId, channels);
  const issues = validateFlowStages(stages, channels, { ...rules, minStages: 2 });
  const allowed = policyChannelIds(policy);
  route.forEach((r, i) => {
    if (r.kind === 'CHANNEL' && r.channelId && !allowed.has(r.channelId)) {
      issues.push({ severity: 'error', stageIndex: i, message: `${channels.find((c) => c.id === r.channelId)?.name ?? 'Channel'} is not allowed by the sales policy "${policy.name}".` });
    }
    if (r.kind === 'CHANNEL' && !r.allowMultiplePartners && r.partnerIds.length > 1) {
      issues.push({ severity: 'error', stageIndex: i, message: `Stage ${i + 1}: only one partner can be selected.` });
    }
  });
  if (route.filter((r) => r.kind === 'SELF').length !== 1) issues.push({ severity: 'error', stageIndex: null, message: 'The route must contain this partner exactly once.' });
  return issues;
};

/**
 * Backward-compatible fields for views that read policy-stage based mappings:
 * own stage, supplier stage and stage assignments are matched to policy stages by channel.
 */
export const routeCompat = (route: RouteStage[], policy: SalesFlow, partnerChannelId: string | null) => {
  const byChannel = (ch?: string | null) => policy.stages.find((s) => s.kind === 'CHANNEL' && s.channelId === ch);
  const selfIdx = route.findIndex((r) => r.kind === 'SELF');
  const supplier = route[selfIdx - 1];
  const supplierStageId = !supplier ? null : supplier.kind === 'SOURCE' ? policy.stages.find((s) => s.kind === 'SOURCE')?.id ?? null : byChannel(supplier.channelId)?.id ?? null;
  return {
    ownStageId: byChannel(partnerChannelId)?.id ?? '',
    supplierStageId,
    supplyWarehouseId: supplier?.kind === 'SOURCE' ? supplier.warehouseId ?? null : null,
    stageAssignments: route.filter((r) => r.kind === 'CHANNEL').map((r) => ({ stageId: byChannel(r.channelId)?.id ?? r.id, partnerIds: r.partnerIds })),
  };
};

/**
 * Display view of an ACTUAL partner route (route builder or legacy policy-stage mapping):
 * stages for the diagram plus the partner names at each stage.
 */
export const mappingRouteView = (
  m: PartnerFlowMapping, flow: SalesFlow | undefined, partners: Partner[], partnerTypes: PartnerType[], channels: SalesChannel[],
  ctx?: { mappings: PartnerFlowMapping[]; flows: SalesFlow[]; warehouses: Warehouse[] },
): { stages: FlowStage[]; names: Record<string, string[]> } => {
  const name = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const self = partners.find((p) => p.id === m.partnerId);
  const selfChannel = partnerTypes.find((t) => t.id === self?.partnerTypeId)?.channelId ?? null;
  const names: Record<string, string[]> = {};
  if (m.suppliers && ctx) {
    // Neighbours-only: derived chain above the primary supplier + supplier + this partner + customers
    const primary = m.suppliers.find((s) => s.role === 'PRIMARY') ?? m.suppliers[0];
    const stages: FlowStage[] = [];
    const push = (id: string, kind: 'SOURCE' | 'CHANNEL', channelId: string | null, label: string, who: string[], warehouseId: string | null = null) => {
      stages.push({ id, kind, channelId, warehouseId, label, allowMultiplePartners: true });
      names[id] = who;
    };
    if (primary?.kind === 'PARTNER') {
      derivedUpstream(primary.partnerId, ctx.mappings, ctx.flows, partners, partnerTypes, channels, ctx.warehouses, m.flowId).forEach((n, i) => {
        if (n.company) push(`up-${i}`, 'SOURCE', null, 'Company Warehouse', [], ctx.warehouses.find((w) => w.name === n.sub)?.id ?? null);
        else push(`up-${i}`, 'CHANNEL', n.channelId, n.label, n.partnerId ? [n.sub] : []);
      });
      const ch = channels.find((c) => c.id === primary.channelId);
      push('sup', 'CHANNEL', primary.channelId, ch?.name ?? 'Supplier', primary.partnerId ? [name(primary.partnerId)] : []);
    } else if (primary) {
      push('sup', 'SOURCE', null, 'Company Warehouse', [], primary.warehouseId);
    }
    push('self', 'CHANNEL', selfChannel, channels.find((c) => c.id === selfChannel)?.name ?? 'Partner', [name(m.partnerId)]);
    (m.customers ?? []).forEach((c, i) => push(`cust-${i}`, 'CHANNEL', c.channelId, channels.find((x) => x.id === c.channelId)?.name ?? 'Customer', c.partnerIds.map(name)));
    return { stages, names };
  }
  if (m.route?.length) {
    const stages = routeToStages(m.route, selfChannel, channels).map((s, i) => (m.route![i].kind === 'SELF' ? { ...s, label: channels.find((c) => c.id === selfChannel)?.name ?? s.label } : s));
    m.route.forEach((r) => { names[r.id] = r.kind === 'SELF' ? [name(m.partnerId)] : r.partnerIds.map(name); });
    return { stages, names };
  }
  if (!flow) return { stages: [], names };
  const ownIdx = flow.stages.findIndex((s) => s.id === m.ownStageId);
  const supIdx = m.supplierStageId ? flow.stages.findIndex((s) => s.id === m.supplierStageId) : -1;
  const stages = flow.stages.filter((s, idx) => {
    if (s.kind === 'SOURCE') return supIdx <= 0;
    if (s.id === m.ownStageId) return true;
    if (supIdx >= 0 && idx < ownIdx && idx !== supIdx) return false;
    return m.stageAssignments.some((a) => a.stageId === s.id);
  });
  stages.forEach((s) => { names[s.id] = s.id === m.ownStageId ? [name(m.partnerId)] : (m.stageAssignments.find((a) => a.stageId === s.id)?.partnerIds ?? []).map(name); });
  return { stages, names };
};
