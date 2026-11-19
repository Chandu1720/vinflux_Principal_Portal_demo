import React from 'react';
import type { BadgeTone, GtmConfiguration, StatusDefinition } from '../../../types';
import { Badge, Input, Select } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';

const TONES: BadgeTone[] = ['green', 'amber', 'red', 'blue', 'purple', 'cyan', 'slate'];

export const StatusSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('partnerStatuses', config);
  const update = (key: string, patch: Partial<StatusDefinition>) => s.setDraft(s.draft.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const validate = (list: StatusDefinition[]) => list.filter((d) => !d.label.trim()).map((d) => `${d.key}: display label is required.`);
  return (
    <SectionShell title="Status Configuration" description="Display labels, colours and descriptions for partner lifecycle statuses. Status keys drive workflow logic and are system-fixed."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <div className="g2-table-wrap">
        <table className="g2-table">
          <thead><tr><th>System key</th><th>Display label</th><th style={{ width: 140 }}>Colour</th><th>Description</th><th>Preview</th></tr></thead>
          <tbody>
            {s.draft.map((d) => (
              <tr key={d.key}>
                <td className="g2-mono">{d.key}</td>
                <td><Input value={d.label} onChange={(e) => update(d.key, { label: e.target.value })} /></td>
                <td><Select value={d.tone} onChange={(v) => update(d.key, { tone: v as BadgeTone })} options={TONES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} /></td>
                <td><Input value={d.description} onChange={(e) => update(d.key, { description: e.target.value })} /></td>
                <td><Badge tone={d.tone} dot>{d.label || d.key}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
};
