import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { GtmConfiguration, KycDocumentRequirement } from '../../../types';
import { Button, IconButton, Input, MultiSelect, NumberInput, Switch } from '../../../components/ui';
import { uid } from '../../../utils/format';
import { SectionShell, useConfigSection } from '../useConfigSection';

const FORMATS = ['pdf', 'jpg', 'png', 'jpeg', 'doc', 'docx', 'xls', 'xlsx'];

export const KycDocumentsSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('kycDocuments', config);
  const update = (id: string, patch: Partial<KycDocumentRequirement>) => s.setDraft(s.draft.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const typeOptions = config.partnerTypes.map((t) => ({ value: t.id, label: t.name }));

  const validate = (list: KycDocumentRequirement[]) => {
    const errs: string[] = [];
    list.forEach((d, i) => {
      if (!d.name.trim()) errs.push(`Row ${i + 1}: document name is required.`);
      if (!d.allowedFormats.length) errs.push(`${d.name || `Row ${i + 1}`}: select at least one allowed format.`);
      if (!(d.maxSizeMb > 0)) errs.push(`${d.name || `Row ${i + 1}`}: max size must be greater than 0.`);
    });
    const names = list.map((d) => d.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) errs.push('Document names must be unique.');
    return errs;
  };

  return (
    <SectionShell title="KYC Document Requirements" description="Documents collected in onboarding. Missing mandatory documents keep a partner in “KYC Pending”. Turn on “Tracks expiry” for licences — the validity date is then captured and alerted."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}
      extraActions={!s.readOnly && <Button variant="soft" icon={<Plus size={15} />} onClick={() => s.setDraft([...s.draft, { id: uid('kyc'), name: '', description: '', mandatoryForPartnerTypeIds: [], allowedFormats: ['pdf'], maxSizeMb: 5, status: 'Active' }])}>Add document</Button>}>
      <div className="g2-table-wrap">
        <table className="g2-table">
          <thead><tr><th>Document</th><th style={{ width: 260 }}>Mandatory for</th><th style={{ width: 200 }}>Allowed formats</th><th style={{ width: 110 }}>Max size</th><th>Tracks expiry</th><th>Active</th><th /></tr></thead>
          <tbody>
            {s.draft.map((d) => (
              <tr key={d.id}>
                <td>
                  <Input value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} placeholder="Document name" />
                  <Input value={d.description} onChange={(e) => update(d.id, { description: e.target.value })} placeholder="Description" style={{ marginTop: 6, height: 32 }} />
                </td>
                <td><MultiSelect values={d.mandatoryForPartnerTypeIds} options={typeOptions} onChange={(v) => update(d.id, { mandatoryForPartnerTypeIds: v })} placeholder="Optional for all" maxChips={2} disabled={s.readOnly} /></td>
                <td><MultiSelect values={d.allowedFormats} options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))} onChange={(v) => update(d.id, { allowedFormats: v })} maxChips={3} disabled={s.readOnly} /></td>
                <td><NumberInput value={d.maxSizeMb} min={1} onChange={(v) => update(d.id, { maxSizeMb: v ?? 0 })} suffix="MB" /></td>
                <td><Switch checked={!!d.tracksExpiry} onChange={(v) => update(d.id, { tracksExpiry: v })} label="Tracks expiry" /></td>
                <td><Switch checked={d.status === 'Active'} onChange={(v) => update(d.id, { status: v ? 'Active' : 'Inactive' })} label="Active" /></td>
                <td className="actions"><IconButton label="Remove" disabled={s.readOnly} onClick={() => s.setDraft(s.draft.filter((x) => x.id !== d.id))}><Trash2 size={15} /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="g2-hint" style={{ marginTop: 8 }}>Tip: deactivate a requirement instead of removing it to keep historical KYC records readable.</div>
    </SectionShell>
  );
};
