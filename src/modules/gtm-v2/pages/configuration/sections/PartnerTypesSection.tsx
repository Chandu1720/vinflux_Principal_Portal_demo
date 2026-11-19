import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { GtmConfiguration, Partner, PartnerType, SalesChannel } from '../../../types';
import { Button, IconButton, Input, Segmented, Select, StatusBadge, Switch } from '../../../components/ui';
import { uid } from '../../../utils/format';
import { SectionShell, useConfigSection } from '../useConfigSection';

export const PartnerTypesSection: React.FC<{ config: GtmConfiguration; channels: SalesChannel[]; partners: Partner[] }> = ({ config, channels, partners }) => {
  const s = useConfigSection('partnerTypes', config);
  const update = (id: string, patch: Partial<PartnerType>) => s.setDraft(s.draft.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const usage = (id: string) => partners.filter((p) => p.partnerTypeId === id).length;

  const validate = (list: PartnerType[]) => {
    const errs: string[] = [];
    list.forEach((p, i) => {
      if (!p.code.trim() || !p.name.trim()) errs.push(`Row ${i + 1}: code and name are required.`);
      if (!p.channelId) errs.push(`Row ${i + 1}: select the sales channel this partner type operates in.`);
    });
    const codes = list.map((p) => p.code.trim().toLowerCase());
    if (new Set(codes).size !== codes.length) errs.push('Partner type codes must be unique.');
    return errs;
  };

  return (
    <SectionShell title="Partner Types" description="Partner types link partners to a sales channel and decide the onboarding form: Full (distributors, dealers…) or Short (hospitals and other end customers)."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}
      extraActions={!s.readOnly && <Button variant="soft" icon={<Plus size={15} />} onClick={() => s.setDraft([...s.draft, { id: uid('pt'), code: '', name: '', description: '', channelId: '', status: 'Active', onboardingForm: 'full' }])}>Add type</Button>}>
      <div className="g2-table-wrap">
        <table className="g2-table">
          <thead><tr><th style={{ width: 110 }}>Code</th><th>Name</th><th>Description</th><th style={{ width: 190 }}>Sales Channel</th><th style={{ width: 170 }}>Onboarding form</th><th>Partners</th><th>Status</th><th /></tr></thead>
          <tbody>
            {s.draft.map((p) => {
              const used = usage(p.id);
              return (
                <tr key={p.id}>
                  <td><Input value={p.code} onChange={(e) => update(p.id, { code: e.target.value.toUpperCase() })} placeholder="CODE" /></td>
                  <td><Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} placeholder="Name" /></td>
                  <td><Input value={p.description} onChange={(e) => update(p.id, { description: e.target.value })} placeholder="Optional" /></td>
                  <td><Select value={p.channelId} onChange={(v) => update(p.id, { channelId: v })} placeholder="Select channel" options={channels.map((c) => ({ value: c.id, label: `${c.name}${c.status === 'Inactive' ? ' (inactive)' : ''}` }))} /></td>
                  <td><Segmented value={p.onboardingForm ?? 'full'} onChange={(v) => update(p.id, { onboardingForm: v as 'full' | 'short' })}
                    options={[{ id: 'full', label: 'Full (7 steps)' }, { id: 'short', label: 'Short' }]} /></td>
                  <td className="num">{used}</td>
                  <td><div className="g2-row" style={{ flexWrap: 'nowrap' }}><Switch checked={p.status === 'Active'} onChange={(v) => update(p.id, { status: v ? 'Active' : 'Inactive' })} label="Active" /><StatusBadge status={p.status} /></div></td>
                  <td className="actions">
                    <IconButton label={used ? `Used by ${used} partner(s) — deactivate instead` : 'Remove'} disabled={used > 0 || s.readOnly} onClick={() => s.setDraft(s.draft.filter((x) => x.id !== p.id))}><Trash2 size={15} /></IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
};
