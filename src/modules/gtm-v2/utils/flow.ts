import type { FlowRules, FlowStage, SalesChannel, SalesFlow, Territory, Zone } from '../types';
import { territoriesOverlap } from './territory';

export interface FlowIssue {
  severity: 'error' | 'warning';
  stageIndex: number | null;
  message: string;
}

/**
 * Validate a flow's stage chain against configurable Sales Flow Rules.
 * Connections are sequential: stage[i] → stage[i+1].
 */
export const validateFlowStages = (stages: FlowStage[], channels: SalesChannel[], rules: FlowRules): FlowIssue[] => {
  const issues: FlowIssue[] = [];
  const chMap = new Map(channels.map((c) => [c.id, c]));

  if (stages.length < rules.minStages) {
    issues.push({ severity: 'error', stageIndex: null, message: `A flow needs at least ${rules.minStages} stages.` });
  }
  if (rules.maxStages && stages.length > rules.maxStages) {
    issues.push({ severity: 'error', stageIndex: null, message: `A flow can have at most ${rules.maxStages} stages.` });
  }
  if (rules.requireSourceFirst && stages.length && stages[0].kind !== 'SOURCE') {
    issues.push({ severity: 'error', stageIndex: 0, message: 'The first stage must be a source (company warehouse).' });
  }
  stages.forEach((s, i) => {
    if (s.kind === 'SOURCE' && i > 0) {
      issues.push({ severity: 'error', stageIndex: i, message: 'A source stage can only be the first stage.' });
    }
    if (s.kind === 'CHANNEL') {
      if (!s.channelId) {
        issues.push({ severity: 'error', stageIndex: i, message: `Stage ${i + 1}: select a sales channel.` });
        return;
      }
      const c = chMap.get(s.channelId);
      if (!c) issues.push({ severity: 'error', stageIndex: i, message: `Stage ${i + 1}: channel no longer exists.` });
      else if (c.status !== 'Active') issues.push({ severity: 'error', stageIndex: i, message: `Stage ${i + 1}: channel "${c.name}" is inactive.` });
    }
  });

  if (rules.preventDuplicateChannel) {
    const seen = new Map<string, number>();
    stages.forEach((s, i) => {
      if (s.kind !== 'CHANNEL' || !s.channelId) return;
      if (seen.has(s.channelId)) {
        issues.push({ severity: 'error', stageIndex: i, message: `Circular flow: "${chMap.get(s.channelId)?.name}" already appears at stage ${seen.get(s.channelId)! + 1}.` });
      } else seen.set(s.channelId, i);
    });
  }

  for (let i = 0; i < stages.length - 1; i++) {
    const a = stages[i];
    const b = stages[i + 1];
    if (a.kind !== 'CHANNEL' || b.kind !== 'CHANNEL' || !a.channelId || !b.channelId) continue;
    const ca = chMap.get(a.channelId);
    const cb = chMap.get(b.channelId);
    if (!ca || !cb) continue;
    // End-customer channels are parallel destinations (a flow can sell to several), not a chain.
    if (ca.canBeEndpoint && cb.canBeEndpoint) continue;
    if (rules.enforceTierOrder && cb.tierRank < ca.tierRank) {
      issues.push({ severity: 'error', stageIndex: i + 1, message: `Invalid connection: ${ca.name} → ${cb.name} flows upstream (tier ${ca.tierRank} → ${cb.tierRank}).` });
    }
    if (rules.blockedConnections.some((bc) => bc.fromChannelId === ca.id && bc.toChannelId === cb.id)) {
      issues.push({ severity: 'error', stageIndex: i + 1, message: `Blocked connection: ${ca.name} → ${cb.name} is not permitted by flow rules.` });
    }
    if (ca.canBeEndpoint && !cb.canBeEndpoint) {
      issues.push({ severity: 'warning', stageIndex: i + 1, message: `${ca.name} is an end-customer channel but feeds ${cb.name}.` });
    }
  }

  const last = stages[stages.length - 1];
  if (rules.requireEndpointLast && last && last.kind === 'CHANNEL' && last.channelId) {
    const c = chMap.get(last.channelId);
    if (c && !c.canBeEndpoint) issues.push({ severity: 'error', stageIndex: stages.length - 1, message: `The final stage must be an end-customer channel. "${c.name}" is not.` });
  }
  if (last && last.kind === 'SOURCE' && stages.length > 1) {
    issues.push({ severity: 'error', stageIndex: stages.length - 1, message: 'A flow cannot end at a source.' });
  }
  return issues;
};

/** Territories covered by a flow: direct territories + territories of its zones. */
export const flowCoverage = (flow: Pick<SalesFlow, 'territoryIds' | 'zoneIds'>, zones: Zone[]): string[] => {
  const set = new Set(flow.territoryIds);
  flow.zoneIds.forEach((zid) => zones.find((z) => z.id === zid)?.territoryIds.forEach((t) => set.add(t)));
  return [...set];
};

export const isFlowEffective = (flow: SalesFlow, onDate = new Date().toISOString().slice(0, 10)): boolean =>
  flow.status === 'Active' && flow.effectiveFrom <= onDate && (!flow.effectiveTo || flow.effectiveTo >= onDate);

/** Active flows applicable to a set of territories and (optionally) a channel. */
export const applicableFlows = (
  flows: SalesFlow[], zones: Zone[], territories: Territory[], territoryIds: string[], channelId: string | null, mode: 'exact' | 'hierarchy',
): SalesFlow[] =>
  flows.filter((f) => f.status === 'Active'
    && territoriesOverlap(flowCoverage(f, zones), territoryIds, territories, mode)
    && (!channelId || f.stages.some((s) => s.channelId === channelId)));

export const stageSummary = (stages: FlowStage[], channels: SalesChannel[]): string =>
  stages.map((s) => (s.kind === 'SOURCE' ? 'Warehouse' : channels.find((c) => c.id === s.channelId)?.name ?? s.label)).join(' → ');
