import React from 'react';
import type { GtmConfiguration, PortalConfig } from '../../../types';
import { MultiSelect, NumberInput } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';

export const PortalSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('portal', config);
  const d = s.draft;
  const set = (patch: Partial<PortalConfig>) => s.setDraft({ ...d, ...patch });
  const validate = (v: PortalConfig) => (v.inviteValidityDays >= 1 && v.inviteValidityDays <= 60 ? [] : ['Invite validity must be between 1 and 60 days.']);
  return (
    <SectionShell title="Partner Portal" description="Who gets access to the partner portal and how invitations work."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <RuleRow title="Partner types with portal access" description="Users can be invited only for these partner types.">
        <div style={{ width: 300 }}><MultiSelect values={d.partnerTypeIds} onChange={(v) => set({ partnerTypeIds: v })} options={config.partnerTypes.map((t) => ({ value: t.id, label: t.name }))} placeholder="None" /></div>
      </RuleRow>
      <SwitchRule title="Invite the contact person on activation" description="When a partner becomes Active, its contact person gets an Owner invite automatically." checked={d.autoInviteOnActivation} onChange={(v) => set({ autoInviteOnActivation: v })} />
      <RuleRow title="Invite valid for" description="After this the link expires and the invite can be resent.">
        <div style={{ width: 130 }}><NumberInput value={d.inviteValidityDays} min={1} onChange={(v) => set({ inviteValidityDays: v ?? 0 })} suffix="days" /></div>
      </RuleRow>
    </SectionShell>
  );
};
