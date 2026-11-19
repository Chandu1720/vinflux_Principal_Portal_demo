import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ApprovalWorkflow, GtmConfiguration } from '../../../types';
import { Badge, Button, IconButton, Input, Switch } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';

export const ApprovalWorkflowsSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('approvalWorkflows', config);
  const update = (cat: string, patch: Partial<ApprovalWorkflow>) => s.setDraft(s.draft.map((w) => (w.category === cat ? { ...w, ...patch } : w)));
  const move = (w: ApprovalWorkflow, i: number, dir: -1 | 1) => {
    const levels = w.levels.slice();
    [levels[i], levels[i + dir]] = [levels[i + dir], levels[i]];
    update(w.category, { levels });
  };
  const validate = (list: ApprovalWorkflow[]) => list.filter((w) => w.enabled && (!w.levels.length || w.levels.some((l) => !l.trim()))).map((w) => `${w.label}: enabled workflows need at least one named approval level.`);

  return (
    <SectionShell title="Approval Workflows" description="Sequential approval levels per request type. Disabled workflows are auto-approved. In-flight requests keep the levels they were raised with."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <div className="g2-grid g2-grid-2">
        {s.draft.map((w) => (
          <div key={w.category} className="g2-form-section" style={{ margin: 0 }}>
            <div className="g2-row" style={{ marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="g2-form-section-title">{w.label}</div>
                <div className="g2-cell-sub g2-mono">{w.category}</div>
              </div>
              {w.enabled ? <Badge tone="green">{w.levels.length} level(s)</Badge> : <Badge tone="slate">Auto-approve</Badge>}
              <Switch checked={w.enabled} onChange={(v) => update(w.category, { enabled: v })} label={`Enable ${w.label}`} />
            </div>
            {w.enabled && (
              <div className="g2-stack" style={{ gap: 6 }}>
                {w.levels.map((role, i) => (
                  <div key={i} className="g2-row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                    <span className="g2-badge g2-tone-purple" style={{ minWidth: 30, justifyContent: 'center' }}>L{i + 1}</span>
                    <Input value={role} placeholder="Approver role" onChange={(e) => update(w.category, { levels: w.levels.map((l, j) => (j === i ? e.target.value : l)) })} />
                    <IconButton label="Move up" disabled={i === 0 || s.readOnly} onClick={() => move(w, i, -1)}><ArrowUp size={14} /></IconButton>
                    <IconButton label="Move down" disabled={i === w.levels.length - 1 || s.readOnly} onClick={() => move(w, i, 1)}><ArrowDown size={14} /></IconButton>
                    <IconButton label="Remove level" disabled={s.readOnly} onClick={() => update(w.category, { levels: w.levels.filter((_, j) => j !== i) })}><Trash2 size={14} /></IconButton>
                  </div>
                ))}
                {!s.readOnly && <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => update(w.category, { levels: [...w.levels, ''] })} style={{ alignSelf: 'flex-start' }}>Add level</Button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
};
