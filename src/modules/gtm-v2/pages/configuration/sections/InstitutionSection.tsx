import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { FieldRequirement, GtmConfiguration, InstitutionFieldKey, InstitutionOnboardingConfig } from '../../../types';
import { Button, Input, Segmented } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';

export const INSTITUTION_FIELDS: { key: InstitutionFieldKey; label: string; group: string }[] = [
  { key: 'gst', label: 'GSTIN', group: 'Statutory' },
  { key: 'pan', label: 'PAN', group: 'Statutory' },
  { key: 'registrationNo', label: 'Clinical establishment / hospital registration no.', group: 'Statutory' },
  { key: 'drugLicenseNo', label: 'Drug licence no. (in-house pharmacy)', group: 'Statutory' },
  { key: 'institutionType', label: 'Institution type', group: 'Profile' },
  { key: 'ownership', label: 'Ownership', group: 'Profile' },
  { key: 'bedCount', label: 'Bed count', group: 'Profile' },
  { key: 'contactPerson', label: 'Contact person', group: 'Contact' },
  { key: 'phone', label: 'Phone', group: 'Contact' },
  { key: 'email', label: 'Email', group: 'Contact' },
  { key: 'procurementContact', label: 'Procurement / purchase contact', group: 'Contact' },
  { key: 'hospitalGroup', label: 'Hospital group / chain', group: 'Profile' },
  { key: 'address', label: 'Address (line, city, state, PIN)', group: 'Contact' },
];

export const ListEditor: React.FC<{ title: string; values: string[]; onChange: (v: string[]) => void }> = ({ title, values, onChange }) => {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim(); if (t && !values.includes(t)) onChange([...values, t]); setV(''); };
  return (
    <div>
      <div className="g2-label" style={{ marginBottom: 6 }}>{title}</div>
      <div className="g2-row" style={{ marginBottom: 8 }}>
        {values.map((x) => (
          <span key={x} className="g2-chip">{x}<button type="button" aria-label={`Remove ${x}`} onClick={() => onChange(values.filter((y) => y !== x))}><X size={12} /></button></span>
        ))}
      </div>
      <div className="g2-row" style={{ flexWrap: 'nowrap' }}>
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add value…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button icon={<Plus size={14} />} onClick={add}>Add</Button>
      </div>
    </div>
  );
};

/**
 * Institution / hospital onboarding — a lighter process than full partner onboarding,
 * similar to how ERPs create institutional customer accounts. Every field is configurable.
 */
export const InstitutionSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('institutionOnboarding', config);
  const d = s.draft;
  const set = (patch: Partial<InstitutionOnboardingConfig>) => s.setDraft({ ...d, ...patch });
  const setField = (k: InstitutionFieldKey, r: FieldRequirement) => set({ fields: { ...d.fields, [k]: r } });
  const validate = (v: InstitutionOnboardingConfig) => {
    const e: string[] = [];
    if (v.fields.institutionType !== 'hidden' && !v.institutionTypes.length) e.push('Add at least one institution type.');
    if (v.fields.ownership !== 'hidden' && !v.ownershipTypes.length) e.push('Add at least one ownership type.');
    return e;
  };

  return (
    <SectionShell title="Short Onboarding Form" description="One-screen form used by end-customer partner types (hospitals, institutions). Choose which fields are required, optional or hidden."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <RuleRow title="Partner types using the short form" description="Set per type in Configuration → Partner Types (Onboarding form = Short).">
        <div className="g2-row">{config.partnerTypes.filter((t) => t.onboardingForm === 'short').map((t) => <span key={t.id} className="g2-chip">{t.name}</span>)}</div>
      </RuleRow>
      <SwitchRule title="Require approval before use" description="When on, a new institution waits for an 'Institution Onboarding' approval before partners can sell to it." checked={d.requireApproval} onChange={(v) => set({ requireApproval: v })} />
      <SwitchRule title="Verify GSTIN when entered" description="If a GSTIN is entered it must be verified against the GST registry (details are auto-filled)." checked={d.verifyGstWhenProvided} onChange={(v) => set({ verifyGstWhenProvided: v })} />

      <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10, marginTop: 8 }}>
        <table className="g2-table">
          <thead><tr><th>Field</th><th>Group</th><th style={{ width: 280 }}>Requirement</th></tr></thead>
          <tbody>
            <tr><td className="g2-strong">Institution name, partner type, territory</td><td className="g2-muted">Core</td><td><span className="g2-muted g2-small">Always required</span></td></tr>
            {INSTITUTION_FIELDS.map((f) => (
              <tr key={f.key}>
                <td className="g2-strong">{f.label}</td>
                <td className="g2-muted">{f.group}</td>
                <td>
                  <Segmented value={d.fields[f.key]} onChange={(v) => setField(f.key, v as FieldRequirement)}
                    options={[{ id: 'required', label: 'Required' }, { id: 'optional', label: 'Optional' }, { id: 'hidden', label: 'Hidden' }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="g2-grid g2-grid-2" style={{ marginTop: 12 }}>
        <ListEditor title="Institution types" values={d.institutionTypes} onChange={(v) => set({ institutionTypes: v })} />
        <ListEditor title="Ownership types" values={d.ownershipTypes} onChange={(v) => set({ ownershipTypes: v })} />
      </div>
    </SectionShell>
  );
};
