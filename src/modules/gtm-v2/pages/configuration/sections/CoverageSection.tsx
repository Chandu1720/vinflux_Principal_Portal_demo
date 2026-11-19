import React from 'react';
import type { CoverageConfig, GtmConfiguration } from '../../../types';
import { NumberInput } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';
import { ListEditor } from './InstitutionSection';

export const CoverageSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('coverage', config);
  const d = s.draft;
  const set = (patch: Partial<CoverageConfig>) => s.setDraft({ ...d, ...patch });
  const validate = (v: CoverageConfig) => {
    const e: string[] = [];
    if (!(v.improveBelow < v.watchBelow)) e.push('“Improvement below” must be lower than “On watch below”.');
    if (!(v.improvementDays > 0)) e.push('Improvement period must be at least 1 day.');
    if (!v.transferReasons.length) e.push('Add at least one transfer reason.');
    return e;
  };
  return (
    <SectionShell title="Hospital Coverage" description="Rules for assigning hospitals to partners, scoring them and moving hospitals between partners."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <SwitchRule title="One primary per hospital and portfolio" description="Prevents two partners selling the same products to the same hospital. Partners can still share a hospital by splitting portfolios." checked={d.onePrimaryPerPortfolio} onChange={(v) => set({ onePrimaryPerPortfolio: v })} />
      <SwitchRule title="Allow a backup partner" description="A backup supplies only when the primary can’t, and can take over on transfer." checked={d.allowBackup} onChange={(v) => set({ allowBackup: v })} />
      <RuleRow title="On watch below score" description="Partners scoring below this are flagged on the coverage matrix."><div style={{ width: 120 }}><NumberInput value={d.watchBelow} min={1} max={100} onChange={(v) => set({ watchBelow: v ?? 0 })} /></div></RuleRow>
      <RuleRow title="Improvement recommended below" description="Below this, start an improvement period before any removal."><div style={{ width: 120 }}><NumberInput value={d.improveBelow} min={0} max={100} onChange={(v) => set({ improveBelow: v ?? 0 })} /></div></RuleRow>
      <RuleRow title="Improvement period" description="Length of the improvement period."><div style={{ width: 120 }}><NumberInput value={d.improvementDays} min={1} onChange={(v) => set({ improvementDays: v ?? 0 })} suffix="days" /></div></RuleRow>
      <SwitchRule title="Require handover checklist" description="Orders, stock, consignment kits, claims and receivables must be confirmed before a transfer is sent." checked={d.requireHandover} onChange={(v) => set({ requireHandover: v })} />
      <div style={{ marginTop: 12 }}><ListEditor title="Transfer / removal reasons" values={d.transferReasons} onChange={(v) => set({ transferReasons: v })} /></div>
      <div className="g2-hint" style={{ marginTop: 8 }}>Transfers are approved through the “Hospital Transfer / Removal” workflow (Approval Workflows).</div>
    </SectionShell>
  );
};
