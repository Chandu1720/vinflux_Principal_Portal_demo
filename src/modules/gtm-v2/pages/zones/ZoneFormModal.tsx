import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { Territory, TerritoryLevelLabel, Zone } from '../../types';
import type { ZoneInput } from '../../services';
import { Alert, Button, ErrorList, Field, FormGrid, Input, Modal, Select, Textarea } from '../../components/ui';
import { TerritoryTreePicker } from '../../components/domain/TerritoryPicker';

export const ZoneFormModal: React.FC<{
  open: boolean;
  editing: Zone | null;
  zones: Zone[];
  territories: Territory[];
  levelLabels: TerritoryLevelLabel[];
  pending: boolean;
  serverErrors: string[];
  onClose: () => void;
  onSubmit: (input: ZoneInput) => void;
}> = ({ open, editing, zones, territories, levelLabels, pending, serverErrors, onClose, onSubmit }) => {
  const [form, setForm] = useState<ZoneInput>({ code: '', name: '', description: '', status: 'Active', territoryIds: [] });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setForm(editing
      ? { code: editing.code, name: editing.name, description: editing.description, status: editing.status, territoryIds: [...editing.territoryIds] }
      : { code: '', name: '', description: '', status: 'Active', territoryIds: [] });
  }, [open, editing]);

  const errs: string[] = [];
  if (!form.name.trim()) errs.push('Zone name is required.');
  if (!form.code.trim()) errs.push('Zone code is required.');
  if (form.code.trim() && zones.some((z) => z.id !== editing?.id && z.code.toLowerCase() === form.code.trim().toLowerCase())) errs.push(`Zone code "${form.code.trim()}" already exists.`);
  if (form.name.trim() && zones.some((z) => z.id !== editing?.id && z.name.toLowerCase() === form.name.trim().toLowerCase())) errs.push(`Zone "${form.name.trim()}" already exists.`);
  if (!form.territoryIds.length) errs.push('Assign at least one territory.');

  const shared = useMemo(() => {
    const out: { territory: string; zones: string[] }[] = [];
    form.territoryIds.forEach((tid) => {
      const others = zones.filter((z) => z.id !== editing?.id && z.territoryIds.includes(tid)).map((z) => z.name);
      if (others.length) out.push({ territory: territories.find((t) => t.id === tid)?.name ?? tid, zones: others });
    });
    return out;
  }, [form.territoryIds, zones, editing, territories]);

  const submit = () => { setTouched(true); if (!errs.length) onSubmit(form); };

  return (
    <Modal
      open={open}
      size="lg"
      onClose={onClose}
      title={editing ? `Edit zone · ${editing.name}` : 'Create zone'}
      subtitle="Zones group territories from any level of the hierarchy. A territory may belong to several zones."
      footer={<><Button onClick={onClose} disabled={pending}>Cancel</Button><Button variant="primary" loading={pending} onClick={submit}>{editing ? 'Save zone' : 'Create zone'}</Button></>}
    >
      <div className="g2-stack">
        <ErrorList errors={touched ? [...new Set([...errs, ...serverErrors])] : serverErrors} />
        <FormGrid cols={3}>
          <Field label="Zone name" required><Input value={form.name} invalid={touched && !form.name.trim()} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. South Zone" /></Field>
          <Field label="Zone code" required hint="Stored in uppercase"><Input value={form.code} invalid={touched && !form.code.trim()} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. ZN-SOUTH" /></Field>
          <Field label="Status"><Select value={form.status} onChange={(v) => setForm({ ...form, status: v as ZoneInput['status'] })} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} /></Field>
          <Field label="Description" className="g2-span-all"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ minHeight: 56 }} /></Field>
        </FormGrid>
        <Field label="Assigned territories" required hint="Tick “Include descendants” to select a parent with its whole subtree, or untick it to pick individual territories.">
          <TerritoryTreePicker territories={territories} levelLabels={levelLabels} values={form.territoryIds} onChange={(ids) => setForm({ ...form, territoryIds: ids })} />
        </Field>
        {shared.length > 0 && (
          <Alert tone="info" icon={<Info size={15} />}>
            <strong>{shared.length}</strong> selected territor{shared.length === 1 ? 'y is' : 'ies are'} also part of other zones (allowed):{' '}
            {shared.slice(0, 4).map((s) => `${s.territory} (${s.zones.join(', ')})`).join('; ')}{shared.length > 4 ? '…' : ''}
          </Alert>
        )}
      </div>
    </Modal>
  );
};
