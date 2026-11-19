import React from 'react';
import type { GtmConfiguration } from '../../../types';
import { Segmented } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';

export const EligibilitySection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('eligibility', config);
  const set = (patch: Partial<typeof s.draft>) => s.setDraft({ ...s.draft, ...patch });
  const d = s.draft;
  return (
    <SectionShell title="Partner Eligibility Rules" description="Decide which onboarded partners can be picked as a supplier or customer during onboarding (Partner Type & Route step)."
      {...s} onSave={() => s.save()} onDiscard={s.discard}>
      <SwitchRule title="Partner type must match stage channel" description="Only partners whose type is linked to the stage's sales channel are eligible." checked={d.requireChannelMatch} onChange={(v) => set({ requireChannelMatch: v })} />
      <SwitchRule title="Territory overlap required" description="Upstream / downstream partners must share territory coverage with the partner being onboarded." checked={d.requireTerritoryOverlap} onChange={(v) => set({ requireTerritoryOverlap: v })} />
      <RuleRow title="Territory match mode" description="Exact = same territory only. Hierarchy = ancestor or descendant territories also match.">
        <Segmented value={d.territoryMatchMode} onChange={(v) => set({ territoryMatchMode: v as 'exact' | 'hierarchy' })} options={[{ id: 'exact', label: 'Exact' }, { id: 'hierarchy', label: 'Hierarchy' }]} />
      </RuleRow>
      <SwitchRule title="Partner must be Active" description="Exclude partners that are in onboarding, suspended or rejected." checked={d.requireActiveStatus} onChange={(v) => set({ requireActiveStatus: v })} />
      <SwitchRule title="KYC must be Verified" description="Exclude partners whose KYC has not been verified." checked={d.requireKycVerified} onChange={(v) => set({ requireKycVerified: v })} />
    </SectionShell>
  );
};
