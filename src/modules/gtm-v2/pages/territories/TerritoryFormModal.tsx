import React, { useEffect, useMemo, useState } from 'react';
import type { Territory, TerritoryRules } from '../../types';
import { Button, ErrorList, Field, FormGrid, Input, Modal, SearchableSelect, Select, Textarea, Alert } from '../../components/ui';
import { getDepth, levelLabelFor, territoryPath, wouldCreateCycle } from '../../utils/territory';
import type { TerritoryInput } from '../../services';

export const TerritoryFormModal: React.FC<{
  open: boolean;
  editing: Territory | null;
  defaultParentId: string | null;
  territories: Territory[];
  rules: TerritoryRules;
  pending: boolean;
  serverErrors: string[];
  onClose: () => void;
  onSubmit: (input: TerritoryInput) => void;
}> = ({ open, editing, defaultParentId, territories, rules, pending, serverErrors, onClose, onSubmit }) => {
  const [form, setForm] = useState<TerritoryInput>({ code: '', name: '', description: '', parentId: null, status: 'Active' });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setForm(editing
      ? { code: editing.code, name: editing.name, description: editing.description, parentId: editing.parentId, status: editing.status }
      : { code: '', name: '', description: '', parentId: defaultParentId, status: 'Active' });
  }, [open, editing, defaultParentId]);

  const parentOptions = useMemo(() => territories
    .map((t) => ({
      value: t.id,
      label: territoryPath(t.id, territories),
      description: `${levelLabelFor(getDepth(t.id, territories), rules.levelLabels)} · ${t.code}${t.status === 'Inactive' ? ' · Inactive' : ''}`,
      disabled: editing ? wouldCreateCycle(editing.id, t.id, territories) : false,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)), [territories, editing, rules.levelLabels]);

  const code = rules.codeUppercase ? form.code.trim().toUpperCase() : form.code.trim();
  const errs: string[] = [];
  if (!code) errs.push('Territory code is required.');
  if (!form.name.trim()) errs.push('Territory name is required.');
  if (code && territories.some((t) => t.id !== editing?.id && t.code.toLowerCase() === code.toLowerCase())) errs.push(`Code "${code}" already exists.`);
  if (rules.uniqueNameWithinParent && form.name.trim() && territories.some((t) => t.id !== editing?.id && t.parentId === form.parentId && t.name.trim().toLowerCase() === form.name.trim().toLowerCase())) {
    errs.push('A territory with this name already exists under the same parent.');
  }
  if (editing && wouldCreateCycle(editing.id, form.parentId, territories)) errs.push('Circular relationship: cannot move a territory under itself or its descendants.');
  const depth = form.parentId ? getDepth(form.parentId, territories) + 1 : 0;
  if (rules.maxDepth !== null && depth >= rules.maxDepth) errs.push(`Maximum depth of ${rules.maxDepth} levels exceeded.`);

  const parent = territories.find((t) => t.id === form.parentId);
  const childCount = editing ? territories.filter((t) => t.parentId === editing.id).length : 0;

  const submit = () => {
    setTouched(true);
    if (errs.length) return;
    onSubmit({ ...form, code });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit territory · ${editing.name}` : 'Add territory'}
      subtitle={`Level: ${levelLabelFor(depth, rules.levelLabels)} (depth ${depth + 1})${parent ? ` under ${territoryPath(parent.id, territories)}` : ' · root level'}`}
      footer={<><Button onClick={onClose} disabled={pending}>Cancel</Button><Button variant="primary" loading={pending} onClick={submit}>{editing ? 'Save changes' : 'Create territory'}</Button></>}
    >
      <div className="g2-stack">
        <ErrorList errors={touched ? [...new Set([...errs, ...serverErrors])] : serverErrors} />
        <FormGrid>
          <Field label="Territory code" required hint={rules.codeUppercase ? 'Stored in uppercase; must be unique.' : 'Must be unique.'}>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} invalid={touched && !code} placeholder="e.g. AP-VJA" />
          </Field>
          <Field label="Territory name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={touched && !form.name.trim()} placeholder="e.g. Vijayawada" />
          </Field>
          <Field label="Parent territory" className="g2-span-2" hint="Leave empty for a root territory. Descendants of this territory cannot be chosen.">
            <SearchableSelect value={form.parentId} options={parentOptions} onChange={(v) => setForm({ ...form, parentId: v })} placeholder="No parent (root)" clearable />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(v) => setForm({ ...form, status: v as TerritoryInput['status'] })} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
          </Field>
          <Field label="Description" className="g2-span-all">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
          </Field>
        </FormGrid>
        {editing && childCount > 0 && editing.parentId !== form.parentId && (
          <Alert tone="info">Moving this territory also moves its {childCount} child territor{childCount === 1 ? 'y' : 'ies'}; level labels are recalculated from configuration.</Alert>
        )}
      </div>
    </Modal>
  );
};
