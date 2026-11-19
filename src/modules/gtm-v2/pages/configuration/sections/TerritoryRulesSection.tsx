import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { GtmConfiguration, Territory, TerritoryRules } from '../../../types';
import { Button, Checkbox, IconButton, Input, NumberInput } from '../../../components/ui';
import { buildTerritoryTree, flattenTree, getDepth } from '../../../utils/territory';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';

export const TerritoryRulesSection: React.FC<{ config: GtmConfiguration; territories: Territory[] }> = ({ config, territories }) => {
  const s = useConfigSection('territoryRules', config);
  const d = s.draft;
  const set = (patch: Partial<TerritoryRules>) => s.setDraft({ ...d, ...patch });
  const labels = d.levelLabels.slice().sort((a, b) => a.depth - b.depth);
  const deepest = useMemo(() => territories.reduce((m, t) => Math.max(m, getDepth(t.id, territories)), 0), [territories]);
  const preview = useMemo(() => flattenTree(buildTerritoryTree(territories.filter((t) => t.status === 'Active'), labels)).slice(0, 14), [territories, labels]);

  const validate = (v: TerritoryRules) => {
    const e: string[] = [];
    if (v.levelLabels.some((l) => !l.label.trim())) e.push('Level labels cannot be empty.');
    if (v.maxDepth !== null && v.maxDepth < 1) e.push('Maximum depth must be at least 1.');
    if (v.maxDepth !== null && v.maxDepth < deepest + 1) e.push(`Existing hierarchy already has ${deepest + 1} levels; maximum depth cannot be lower.`);
    return e;
  };

  return (
    <SectionShell title="Territory Rules" description="Hierarchy labels are configuration — no level names are hard-coded. Depths without a label show as “Level N”."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <div className="g2-grid g2-grid-2">
        <div>
          <div className="g2-form-section-title" style={{ marginBottom: 8 }}>Level labels</div>
          <div className="g2-stack" style={{ gap: 6 }}>
            {labels.map((l) => (
              <div key={l.depth} className="g2-row" style={{ flexWrap: 'nowrap' }}>
                <span className="g2-tree-level" style={{ minWidth: 64, textAlign: 'center' }}>Depth {l.depth}</span>
                <Input value={l.label} onChange={(e) => set({ levelLabels: d.levelLabels.map((x) => (x.depth === l.depth ? { ...x, label: e.target.value } : x)) })} />
                <IconButton label={l.depth === labels.length - 1 ? 'Remove deepest label' : 'Only the deepest label can be removed'} disabled={s.readOnly || l.depth !== labels.length - 1}
                  onClick={() => set({ levelLabels: d.levelLabels.filter((x) => x.depth !== l.depth) })}><Trash2 size={14} /></IconButton>
              </div>
            ))}
            {!s.readOnly && <Button variant="ghost" size="sm" icon={<Plus size={14} />} style={{ alignSelf: 'flex-start' }}
              onClick={() => set({ levelLabels: [...d.levelLabels, { depth: labels.length, label: `Level ${labels.length + 1}` }] })}>Add level label</Button>}
          </div>
          <div className="g2-divider" />
          <RuleRow title="Maximum depth" description="Limit how many levels the hierarchy may have.">
            <div className="g2-row" style={{ flexWrap: 'nowrap' }}>
              <Checkbox checked={d.maxDepth === null} onChange={(c) => set({ maxDepth: c ? null : Math.max(deepest + 1, labels.length) })} label="Unlimited" />
              {d.maxDepth !== null && <div style={{ width: 90 }}><NumberInput value={d.maxDepth} min={1} onChange={(v) => set({ maxDepth: v ?? 1 })} /></div>}
            </div>
          </RuleRow>
          <SwitchRule title="Unique names within parent" description="Two siblings cannot share the same name." checked={d.uniqueNameWithinParent} onChange={(v) => set({ uniqueNameWithinParent: v })} />
          <SwitchRule title="Uppercase territory codes" description="Codes are normalised to uppercase on save." checked={d.codeUppercase} onChange={(v) => set({ codeUppercase: v })} />
        </div>
        <div>
          <div className="g2-form-section-title" style={{ marginBottom: 8 }}>Preview (with unsaved labels)</div>
          <div className="g2-tree" style={{ border: '1px solid var(--g2-border)', borderRadius: 10, padding: 6, maxHeight: 420, overflowY: 'auto' }}>
            {preview.map((n) => (
              <div key={n.id} className="g2-tree-row" style={{ paddingLeft: 6 + n.depth * 18, cursor: 'default' }}>
                <span className="g2-tree-name">{n.name}</span>
                <span className="g2-tree-level" style={{ marginLeft: 'auto' }}>{n.levelLabel}</span>
              </div>
            ))}
            {preview.length === 0 && <div className="g2-muted g2-small" style={{ padding: 10 }}>No active territories yet.</div>}
          </div>
        </div>
      </div>
    </SectionShell>
  );
};
