import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Lock } from 'lucide-react';
import type { FlowStage, SalesChannel } from '../../types';
import type { Warehouse } from '../../../../types/warehouse.ts';
import type { FlowIssue } from '../../utils/flow';
import { Alert, Badge, Checkbox } from '../../components/ui';
import { stageVisual } from '../../components/domain/FlowDiagram';
import { uid } from '../../utils/format';

const newSource = (): FlowStage => ({ id: uid('stg'), kind: 'SOURCE', warehouseId: null, channelId: null, label: 'Company Warehouse', allowMultiplePartners: false });

/** Orders channel stages by configured channel level; end-customer channels always come last. */
const orderStages = (stages: FlowStage[], channels: SalesChannel[]): FlowStage[] => {
  const ch = (s: FlowStage) => channels.find((c) => c.id === s.channelId);
  const source = stages.find((s) => s.kind === 'SOURCE') ?? newSource();
  const rest = stages.filter((s) => s.kind === 'CHANNEL').sort((a, b) => {
    const ca = ch(a); const cb = ch(b);
    return Number(!!ca?.canBeEndpoint) - Number(!!cb?.canBeEndpoint) || (ca?.tierRank ?? 99) - (cb?.tierRank ?? 99) || (ca?.name ?? '').localeCompare(cb?.name ?? '');
  });
  return [source, ...rest];
};

/**
 * "How it sells" — tick the sales channels the product moves through.
 * No route building here — the partner's actual route is built during onboarding.
 */
export const ChannelPathSelector: React.FC<{
  stages: FlowStage[];
  channels: SalesChannel[];
  warehouses: Warehouse[];
  issues: FlowIssue[];
  /** Stage ids occupied by active partner relationships — cannot be unticked. */
  occupiedStageIds: Set<string>;
  readOnly?: boolean;
  onChange: (stages: FlowStage[]) => void;
}> = ({ stages, channels, issues, occupiedStageIds, readOnly, onChange }) => {
  const stageFor = (channelId: string) => stages.find((s) => s.kind === 'CHANNEL' && s.channelId === channelId);
  const visible = channels.filter((c) => c.status === 'Active' || stageFor(c.id));
  const intermediaries = visible.filter((c) => !c.canBeEndpoint).sort((a, b) => a.tierRank - b.tierRank || a.name.localeCompare(b.name));
  const endpoints = visible.filter((c) => c.canBeEndpoint).sort((a, b) => a.name.localeCompare(b.name));
  const throughSel = intermediaries.filter((c) => stageFor(c.id));
  const toSel = endpoints.filter((c) => stageFor(c.id));
  const errCount = issues.filter((i) => i.severity === 'error').length;

  const toggle = (c: SalesChannel, on: boolean) => {
    if (on) {
      const st: FlowStage = { id: uid('stg'), kind: 'CHANNEL', channelId: c.id, warehouseId: null, label: c.name, allowMultiplePartners: true };
      onChange(orderStages([...stages, st], channels));
    } else {
      onChange(orderStages(stages.filter((s) => s.channelId !== c.id), channels));
    }
  };
  const setMulti = (channelId: string, v: boolean) => onChange(stages.map((s) => (s.channelId === channelId ? { ...s, allowMultiplePartners: v } : s)));

  const card = (c: SalesChannel, endpoint: boolean) => {
    const st = stageFor(c.id);
    const locked = !!st && occupiedStageIds.has(st.id);
    const v = stageVisual({ id: c.id, kind: 'CHANNEL', channelId: c.id, label: c.name, allowMultiplePartners: true }, c);
    return (
      <div key={c.id} className={`g2-channel-pick ${st ? 'on' : ''}`}>
        <div className="g2-row" style={{ gap: 10, flexWrap: 'nowrap' }}>
          <Checkbox checked={!!st} disabled={readOnly || locked} onChange={(on) => toggle(c, on)} label={null} />
          <span className="g2-channel-pick-icon" style={{ background: v.bg, color: v.c }}><v.Icon size={16} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="g2-strong g2-ellipsis">{c.name}</div>
            <div className="g2-cell-sub">{c.code} · {endpoint ? 'End customer' : `Level ${c.tierRank}`} · {c.terms.standardDiscountPct}% default discount</div>
          </div>
          {locked && <Badge tone="amber" title="Active partners are mapped to this stage"><Lock size={10} /> In use</Badge>}
          {c.status === 'Inactive' && <Badge tone="slate">Inactive</Badge>}
        </div>
        {st && !readOnly && (
          <div style={{ marginTop: 8, paddingLeft: 26 }}>
            <Checkbox checked={st.allowMultiplePartners} onChange={(val) => setMulti(c.id, val)} label={<span className="g2-small">Allow multiple partners at this stage</span>} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="g2-stack" style={{ gap: 14 }}>

      <div>
        <div className="g2-label" style={{ marginBottom: 6 }}>Sells through <span className="g2-muted" style={{ fontWeight: 400 }}>— channels allowed to resell these products (none = direct supply only)</span></div>
        <div className="g2-channel-grid">{intermediaries.map((c) => card(c, false))}</div>
      </div>

      <div>
        <div className="g2-label" style={{ marginBottom: 6 }}>Sells to <span className="g2-muted" style={{ fontWeight: 400 }}>— end customers these products can be sold to (select one or more)</span></div>
        <div className="g2-channel-grid">{endpoints.map((c) => card(c, true))}</div>
      </div>

      <div className="g2-route-summary">
        <div><span className="g2-muted g2-small">Sells through</span><div className="g2-strong">{throughSel.length ? throughSel.map((c) => c.name).join(', ') : 'Direct from company'}</div></div>
        <div><span className="g2-muted g2-small">Sells to</span><div className="g2-strong">{toSel.length ? toSel.map((c) => c.name).join(', ') : '—'}</div></div>
        <div className="g2-small g2-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Info size={13} /> The actual route (who buys from whom) is built per partner during onboarding.
        </div>
        {errCount ? <Badge tone="red" dot>{errCount} issue{errCount > 1 ? 's' : ''}</Badge> : <Badge tone="green" dot>Valid</Badge>}
      </div>

      <div className="g2-stack" style={{ gap: 8 }}>
        {issues.length === 0 && <Alert tone="success" icon={<CheckCircle2 size={15} />}>Flow passes all configured flow rules.</Alert>}
        {issues.map((i, k) => <Alert key={k} tone={i.severity === 'error' ? 'error' : 'warn'} icon={<AlertTriangle size={15} />}>{i.message}</Alert>)}
      </div>
    </div>
  );
};
