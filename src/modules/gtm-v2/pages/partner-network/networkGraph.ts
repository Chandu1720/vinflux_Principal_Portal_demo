import type { PartnerFlowMapping, SalesChannel, SalesFlow } from '../../types';

export const SOURCE_NODE = '__source__';

export interface NetEdge {
  from: string;
  to: string;
  flowIds: string[];
  active: boolean;
}

/**
 * Derive ACTUAL partner-to-partner edges from partner flow mappings.
 * For each mapping, stages with assigned partners are chained in master stage order;
 * empty stages are bridged so the physical flow stays connected.
 */
export const buildEdges = (mappings: PartnerFlowMapping[], flows: SalesFlow[], channels: SalesChannel[] = []): NetEdge[] => {
  const isEnd = (channelId?: string | null) => !!channels.find((c) => c.id === channelId)?.canBeEndpoint;
  const byKey = new Map<string, NetEdge>();
  mappings.forEach((m) => {
    const flow = flows.find((f) => f.id === m.flowId);
    if (!flow) return;
    const layers: string[][] = [];
    if (m.suppliers) {
      // Neighbours-only: supplier → partner → customers (the rest comes from other partners' own links)
      const addEdge = (from: string, to: string) => {
        if (from === to) return;
        const key = `${from}>${to}`;
        const e = byKey.get(key) ?? { from, to, flowIds: [], active: false };
        if (!e.flowIds.includes(m.flowId)) e.flowIds.push(m.flowId);
        e.active = e.active || m.status === 'Active';
        byKey.set(key, e);
      };
      m.suppliers.forEach((s) => {
        if (s.kind === 'COMPANY') addEdge(SOURCE_NODE, m.partnerId);
        else if (s.partnerId) addEdge(s.partnerId, m.partnerId);
      });
      (m.customers ?? []).forEach((c) => c.partnerIds.forEach((id) => addEdge(m.partnerId, id)));
      return;
    }
    if (m.route?.length) {
      // Route builder mappings: the partner's own route is the truth.
      let endLayer2: string[] | null = null;
      m.route.forEach((r) => {
        if (r.kind === 'SOURCE') { layers.push([SOURCE_NODE]); return; }
        const ids = r.kind === 'SELF' ? [m.partnerId] : r.partnerIds;
        if (!ids.length) return;
        if (r.kind === 'CHANNEL' && isEnd(r.channelId)) {
          if (endLayer2) { endLayer2.push(...ids); return; }
          endLayer2 = [...ids];
          layers.push(endLayer2);
          return;
        }
        layers.push([...ids]);
      });
      for (let i = 0; i < layers.length - 1; i++) {
        layers[i].forEach((from) => layers[i + 1].forEach((to) => {
          if (from === to) return;
          const key = `${from}>${to}`;
          const e = byKey.get(key) ?? { from, to, flowIds: [], active: false };
          if (!e.flowIds.includes(m.flowId)) e.flowIds.push(m.flowId);
          e.active = e.active || m.status === 'Active';
          byKey.set(key, e);
        }));
      }
      return;
    }
    const supplierIdx = m.supplierStageId ? flow.stages.findIndex((s) => s.id === m.supplierStageId) : -1;
    let endLayer: string[] | null = null;
    flow.stages.forEach((s, idx) => {
      // Route-based mappings: stages between the chosen supplier and the partner are not part of its route.
      const ownIdx = flow.stages.findIndex((x) => x.id === m.ownStageId);
      if (supplierIdx >= 0 && idx < supplierIdx) return;
      if (supplierIdx >= 0 && idx > supplierIdx && idx < ownIdx) return;
      if (s.kind === 'SOURCE') { layers.push([SOURCE_NODE]); return; }
      const ids = new Set<string>();
      if (s.id === m.ownStageId) ids.add(m.partnerId);
      m.stageAssignments.filter((a) => a.stageId === s.id).forEach((a) => a.partnerIds.forEach((p) => ids.add(p)));
      if (!ids.size) return;
      if (isEnd(s.channelId)) {
        // end customers are parallel: merge into one layer
        if (endLayer) { ids.forEach((x) => endLayer!.push(x)); return; }
        endLayer = [...ids];
        layers.push(endLayer);
        return;
      }
      layers.push([...ids]);
    });
    for (let i = 0; i < layers.length - 1; i++) {
      layers[i].forEach((from) => layers[i + 1].forEach((to) => {
        if (from === to) return;
        const key = `${from}>${to}`;
        const e = byKey.get(key) ?? { from, to, flowIds: [], active: false };
        if (!e.flowIds.includes(m.flowId)) e.flowIds.push(m.flowId);
        e.active = e.active || m.status === 'Active';
        byKey.set(key, e);
      }));
    }
  });
  return [...byKey.values()];
};

/** All nodes reachable upstream and downstream of `id`. */
export const connectedSet = (id: string, edges: NetEdge[]) => {
  const up = new Set<string>();
  const down = new Set<string>();
  const walk = (start: string, dir: 'up' | 'down', acc: Set<string>) => {
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      edges.forEach((e) => {
        const next = dir === 'down' ? (e.from === cur ? e.to : null) : (e.to === cur ? e.from : null);
        if (next && !acc.has(next) && next !== id) { acc.add(next); stack.push(next); }
      });
    }
  };
  walk(id, 'up', up);
  walk(id, 'down', down);
  return { up, down, all: new Set([id, ...up, ...down]) };
};
