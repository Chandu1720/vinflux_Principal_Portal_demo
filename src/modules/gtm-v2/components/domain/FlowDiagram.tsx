import React from 'react';
import { Building2, ChevronRight, Network, Package, Store, Truck, Warehouse, Boxes } from 'lucide-react';
import type { FlowStage, SalesChannel } from '../../types';
import type { Warehouse as WarehouseRec } from '../../../../types/warehouse.ts';

const PALETTE = [
  { c: '#6d28d9', bg: '#f5f3ff' }, { c: '#2563eb', bg: '#eff6ff' }, { c: '#0891b2', bg: '#ecfeff' },
  { c: '#059669', bg: '#ecfdf5' }, { c: '#d97706', bg: '#fffbeb' }, { c: '#db2777', bg: '#fdf2f8' },
];

/** Visual identity for a stage — derived from configuration (tier rank / endpoint), never from names. */
export const stageVisual = (stage: FlowStage, channel?: SalesChannel) => {
  if (stage.kind === 'SOURCE') return { Icon: Warehouse, ...PALETTE[0] };
  if (!channel) return { Icon: Package, c: '#64748b', bg: '#f1f5f9' };
  if (channel.canBeEndpoint) return { Icon: Building2, ...PALETTE[3] };
  const icons = [Truck, Boxes, Network, Store];
  return { Icon: icons[(channel.tierRank - 1) % icons.length] ?? Truck, ...PALETTE[(channel.tierRank % (PALETTE.length - 1)) + 1] };
};

export const stageTitle = (stage: FlowStage, channels: SalesChannel[]) =>
  stage.kind === 'SOURCE' ? 'Company Warehouse' : channels.find((c) => c.id === stage.channelId)?.name ?? 'Unassigned';

/**
 * Groups stages into columns. A sales policy lists the channels it sells THROUGH (in level order)
 * and the end customers it sells TO; all end-customer stages share the last column (parallel).
 */
export const stageColumns = (stages: FlowStage[], channels: SalesChannel[]): FlowStage[][] => {
  const cols: FlowStage[][] = [];
  stages.forEach((s) => {
    const isEnd = s.kind === 'CHANNEL' && !!channels.find((c) => c.id === s.channelId)?.canBeEndpoint;
    const last = cols[cols.length - 1];
    const lastIsEnd = !!last && last[0].kind === 'CHANNEL' && !!channels.find((c) => c.id === last[0].channelId)?.canBeEndpoint;
    if (isEnd && lastIsEnd) last.push(s); else cols.push([s]);
  });
  return cols;
};

export const FlowDiagram: React.FC<{
  stages: FlowStage[];
  channels: SalesChannel[];
  warehouses?: WarehouseRec[];
  selectedStageId?: string | null;
  /** Additional highlighted stages (e.g. a partner's chosen route). */
  highlightStageIds?: string[];
  onSelectStage?: (id: string) => void;
  skippedStageIds?: string[];
  errorStageIdx?: Set<number>;
  stageFooter?: (stage: FlowStage, index: number) => React.ReactNode;
  compact?: boolean;
}> = ({ stages, channels, warehouses = [], selectedStageId, highlightStageIds = [], onSelectStage, skippedStageIds = [], errorStageIdx, stageFooter, compact }) => {
  const cols = stageColumns(stages, channels);
  const node = (s: FlowStage) => {
    const i = stages.indexOf(s);
    const ch = channels.find((c) => c.id === s.channelId);
    const v = stageVisual(s, ch);
    const wh = s.kind === 'SOURCE' && s.warehouseId ? warehouses.find((w) => w.id === s.warehouseId) : undefined;
    const dim = highlightStageIds.length > 0 && !highlightStageIds.includes(s.id) && selectedStageId !== s.id;
    return (
      <div
        key={s.id}
        className={`g2-flow-node ${onSelectStage ? 'selectable' : ''} ${selectedStageId === s.id ? 'selected' : ''} ${skippedStageIds.includes(s.id) || dim ? 'skipped' : ''} ${errorStageIdx?.has(i) ? 'error' : ''}`}
        onClick={onSelectStage ? () => onSelectStage(s.id) : undefined}
        style={compact ? { minWidth: 112, padding: 10 } : undefined}
      >
        <div className="g2-flow-node-icon" style={{ background: v.bg, color: v.c }}><v.Icon size={compact ? 18 : 20} /></div>
        <div className="g2-flow-node-title">{s.kind === 'SOURCE' ? 'Company Warehouse' : s.label || stageTitle(s, channels)}</div>
        {!compact && (
          <div className="g2-flow-node-sub">
            {s.kind === 'SOURCE' ? (wh ? wh.name : 'Any active warehouse') : (s.label && ch && s.label !== ch.name ? ch.name : ch?.canBeEndpoint ? 'End customer' : `Level ${ch?.tierRank ?? '—'}`)}
          </div>
        )}
        {stageFooter?.(s, i)}
      </div>
    );
  };
  return (
    <div className="g2-flow">
      {cols.map((col, ci) => (
        <React.Fragment key={col[0].id}>
          {ci > 0 && <div className={`g2-flow-arrow ${col.some((s) => errorStageIdx?.has(stages.indexOf(s))) ? 'error' : ''}`}><ChevronRight size={16} /></div>}
          {col.length === 1 ? node(col[0]) : <div className="g2-flow-stack">{col.map(node)}</div>}
        </React.Fragment>
      ))}
    </div>
  );
};

/** One-line textual chain, e.g. "Warehouse → C&F → Distributor → Hospital / Retailer". */
export const FlowChain: React.FC<{ stages: FlowStage[]; channels: SalesChannel[] }> = ({ stages, channels }) => (
  <span className="g2-flow-mini">
    {stageColumns(stages, channels).map((col, i) => (
      <React.Fragment key={col[0].id}>
        {i > 0 && <span className="sep">→</span>}
        <span>{col.map((s) => (s.kind === 'SOURCE' ? 'Warehouse' : stageTitle(s, channels))).join(' / ')}</span>
      </React.Fragment>
    ))}
  </span>
);
