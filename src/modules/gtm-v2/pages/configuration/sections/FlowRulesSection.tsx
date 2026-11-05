import React, { useState } from 'react';
import { ArrowRight, Ban, Plus, Trash2 } from 'lucide-react';
import type { FlowRules, GtmConfiguration, SalesChannel } from '../../../types';
import { Button, Checkbox, IconButton, NumberInput, Select } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';

export const FlowRulesSection: React.FC<{ config: GtmConfiguration; channels: SalesChannel[] }> = ({ config, channels }) => {
  const s = useConfigSection('flowRules', config);
  const d = s.draft;
  const set = (patch: Partial<FlowRules>) => s.setDraft({ ...d, ...patch });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const name = (id: string) => channels.find((c) => c.id === id)?.name ?? id;
  const opts = channels.map((c) => ({ value: c.id, label: c.name }));
  const dup = d.blockedConnections.some((b) => b.fromChannelId === from && b.toChannelId === to);

  const validate = (v: FlowRules) => {
    const e: string[] = [];
    if (v.minStages < 2) e.push('Minimum stages must be at least 2 (source and destination).');
    if (v.maxStages !== null && v.maxStages < v.minStages) e.push('Maximum stages must be greater than or equal to minimum stages.');
    return e;
  };

  return (
    <SectionShell title="Route Rules" description="Validation applied by the Sales Policies builder. Also checked on every partner’s supply links during onboarding. Existing active policies are not re-validated until edited."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <RuleRow title="Minimum stages" description="Including the source warehouse.">
        <div style={{ width: 110 }}><NumberInput value={d.minStages} min={2} onChange={(v) => set({ minStages: v ?? 2 })} /></div>
      </RuleRow>
      <RuleRow title="Maximum stages" description="Leave unlimited to allow any number of stages.">
        <div className="g2-row" style={{ flexWrap: 'nowrap' }}>
          <Checkbox checked={d.maxStages === null} onChange={(c) => set({ maxStages: c ? null : Math.max(d.minStages, 6) })} label="Unlimited" />
          {d.maxStages !== null && <div style={{ width: 100 }}><NumberInput value={d.maxStages} min={d.minStages} onChange={(v) => set({ maxStages: v ?? d.minStages })} /></div>}
        </div>
      </RuleRow>
      <SwitchRule title="Source must be first" description="Supply always starts at a company warehouse." checked={d.requireSourceFirst} onChange={(v) => set({ requireSourceFirst: v })} />
      <SwitchRule title="Prevent circular supply" description="A sales channel may appear only once per policy." checked={d.preventDuplicateChannel} onChange={(v) => set({ preventDuplicateChannel: v })} />
      <SwitchRule title="Enforce downstream tier order" description="Each stage's channel tier must be equal to or below the previous one (no upstream movement)." checked={d.enforceTierOrder} onChange={(v) => set({ enforceTierOrder: v })} />
      <SwitchRule title="Final stage must be an end customer" description="The last stage must use a channel marked as an end-customer channel." checked={d.requireEndpointLast} onChange={(v) => set({ requireEndpointLast: v })} />

      <div style={{ marginTop: 16 }}>
        <div className="g2-form-section-title" style={{ marginBottom: 4 }}><Ban size={14} style={{ verticalAlign: -2 }} /> Blocked connections</div>
        <div className="g2-cell-sub" style={{ marginBottom: 10 }}>Direct connections between these channels are rejected in sales policies and in partner supply links.</div>
        {d.blockedConnections.length === 0 && <div className="g2-muted g2-small" style={{ marginBottom: 10 }}>No blocked connections.</div>}
        {d.blockedConnections.map((b, i) => (
          <div key={`${b.fromChannelId}-${b.toChannelId}`} className="g2-row" style={{ marginBottom: 6 }}>
            <span className="g2-chip neutral">{name(b.fromChannelId)}</span><ArrowRight size={14} className="g2-muted" /><span className="g2-chip neutral">{name(b.toChannelId)}</span>
            <IconButton label="Remove" disabled={s.readOnly} onClick={() => set({ blockedConnections: d.blockedConnections.filter((_, j) => j !== i) })}><Trash2 size={14} /></IconButton>
          </div>
        ))}
        {!s.readOnly && (
          <div className="g2-row" style={{ marginTop: 8 }}>
            <div style={{ width: 200 }}><Select value={from} onChange={setFrom} placeholder="From channel" options={opts} /></div>
            <ArrowRight size={14} className="g2-muted" />
            <div style={{ width: 200 }}><Select value={to} onChange={setTo} placeholder="To channel" options={opts} /></div>
            <Button variant="soft" icon={<Plus size={14} />} disabled={!from || !to || from === to || dup}
              title={dup ? 'Already blocked' : from && from === to ? 'Choose two different channels' : undefined}
              onClick={() => { set({ blockedConnections: [...d.blockedConnections, { fromChannelId: from, toChannelId: to }] }); setFrom(''); setTo(''); }}>Block</Button>
          </div>
        )}
      </div>
    </SectionShell>
  );
};
