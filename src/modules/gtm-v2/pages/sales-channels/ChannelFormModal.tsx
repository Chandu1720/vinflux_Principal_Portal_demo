import React, { useEffect, useState } from 'react';
import { CalendarClock, Info, Percent, Settings2 } from 'lucide-react';
import type { SalesChannel } from '../../types';
import type { ChannelInput } from '../../services';
import { Alert, Button, Checkbox, ErrorList, Field, FormGrid, FormSection, Input, Modal, NumberInput, Segmented, Select, Switch, Textarea } from '../../components/ui';
import { todayISO } from '../../utils/format';

const blank = (): ChannelInput => ({
  code: '', name: '', description: '', tierRank: 1, canBeEndpoint: false, tradeModel: 'RESELL', status: 'Active',
  terms: {
    standardDiscountPct: 0, creditPeriodDays: 30, creditLimit: 0, depositRequired: false, depositAmount: 0,
    minOrderValue: 0, maxOrderValue: null, effectiveFrom: todayISO(), effectiveTo: null,
  },
});

const validateChannelForm = (f: ChannelInput, channels: SalesChannel[], id: string | null): string[] => {
  const e: string[] = [];
  if (!f.name.trim()) e.push('Channel name is required.');
  if (!f.code.trim()) e.push('Channel code is required.');
  if (f.code.trim() && channels.some((c) => c.id !== id && c.code.toLowerCase() === f.code.trim().toLowerCase())) e.push(`Channel code "${f.code.trim()}" already exists.`);
  if (f.name.trim() && channels.some((c) => c.id !== id && c.name.toLowerCase() === f.name.trim().toLowerCase())) e.push(`Channel "${f.name.trim()}" already exists.`);
  if (!Number.isFinite(f.tierRank) || f.tierRank < 1) e.push('Tier rank must be 1 or higher.');
  const t = f.terms;
  if (t.standardDiscountPct < 0 || t.standardDiscountPct > 100) e.push('Discount must be between 0 and 100%.');
  if (t.creditPeriodDays < 0) e.push('Credit period cannot be negative.');
  if (t.creditLimit < 0) e.push('Credit limit cannot be negative.');
  if (t.depositRequired && t.depositAmount <= 0) e.push('Deposit amount is required when a deposit is mandatory.');
  if (t.minOrderValue < 0) e.push('Minimum order value cannot be negative.');
  if (t.maxOrderValue !== null && t.maxOrderValue < t.minOrderValue) e.push('Maximum order value must be greater than the minimum.');
  if (!t.effectiveFrom) e.push('Effective from date is required.');
  if (t.effectiveTo && t.effectiveTo < t.effectiveFrom) e.push('Effective to must be after effective from.');
  return e;
};

export const ChannelFormModal: React.FC<{
  open: boolean;
  editing: SalesChannel | null;
  channels: SalesChannel[];
  pending: boolean;
  serverErrors: string[];
  onClose: () => void;
  onSubmit: (input: ChannelInput, note: string) => void;
}> = ({ open, editing, channels, pending, serverErrors, onClose, onSubmit }) => {
  const [form, setForm] = useState<ChannelInput>(blank);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [unlimitedMax, setUnlimitedMax] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setNote('');
    if (editing) {
      setForm({ code: editing.code, name: editing.name, description: editing.description, tierRank: editing.tierRank, canBeEndpoint: editing.canBeEndpoint, tradeModel: editing.tradeModel ?? 'RESELL', status: editing.status, terms: { ...editing.terms } });
      setUnlimitedMax(editing.terms.maxOrderValue === null);
    } else { setForm(blank()); setUnlimitedMax(true); }
  }, [open, editing]);

  const t = form.terms;
  const setT = (patch: Partial<ChannelInput['terms']>) => setForm((f) => ({ ...f, terms: { ...f.terms, ...patch } }));
  const errs = validateChannelForm(form, channels, editing?.id ?? null);
  const termsChanged = !!editing && JSON.stringify({ ...t, depositAmount: t.depositRequired ? t.depositAmount : 0 }) !== JSON.stringify(editing.terms);
  const sameEffective = termsChanged && editing && t.effectiveFrom <= editing.terms.effectiveFrom;
  const show = touched ? [...new Set([...errs, ...serverErrors])] : serverErrors;

  const submit = () => { setTouched(true); if (!errs.length) onSubmit(form, note); };

  return (
    <Modal
      open={open}
      size="lg"
      onClose={onClose}
      title={editing ? `Edit channel · ${editing.name}` : 'Create sales channel'}
      subtitle={editing ? `Current version v${editing.version}. Commercial changes create a new version.` : 'Channel names and stages are fully configurable — nothing is hard-coded.'}
      footer={<><Button onClick={onClose} disabled={pending}>Cancel</Button><Button variant="primary" loading={pending} onClick={submit}>{editing ? (termsChanged ? `Save as v${editing.version + 1}` : 'Save changes') : 'Create channel'}</Button></>}
    >
      <div className="g2-stack">
        <ErrorList errors={show} />
        <FormSection title="Channel definition" icon={<Settings2 size={16} />}>
          <FormGrid cols={3}>
            <Field label="Channel name" required><Input value={form.name} invalid={touched && !form.name.trim()} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Distributor" /></Field>
            <Field label="Channel code" required><Input value={form.code} invalid={touched && !form.code.trim()} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. DIST" /></Field>
            <Field label="Status"><Select value={form.status} onChange={(v) => setForm({ ...form, status: v as ChannelInput['status'] })} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} /></Field>
            <Field label="How it trades" required hint={form.tradeModel === 'AGENT' ? 'Holds and dispatches company stock. Partners below raise POs to the company, not to this agent.' : 'Buys, owns and resells stock. Partners below raise POs to this partner.'} className="g2-span-2">
              <Segmented value={form.tradeModel ?? 'RESELL'} onChange={(v) => setForm({ ...form, tradeModel: v as 'RESELL' | 'AGENT' })}
                options={[{ id: 'RESELL', label: 'Buys & resells (e.g. Super Stockist, Distributor)' }, { id: 'AGENT', label: 'Agent / stock point (e.g. C&F)' }]} />
            </Field>
            <Field label="Level" required hint="Position in the chain (1 = closest to company). Used to check who can supply whom.">
              <NumberInput min={1} value={form.tierRank} onChange={(v) => setForm({ ...form, tierRank: v ?? 1 })} />
            </Field>
            <Field label="End-customer channel" hint="Can be the end customer of a sales policy" className="g2-span-2">
              <div className="g2-row" style={{ height: 38 }}><Switch checked={form.canBeEndpoint} onChange={(v) => setForm({ ...form, canBeEndpoint: v })} label="Can be endpoint" /><span className="g2-small">{form.canBeEndpoint ? 'Yes — e.g. hospitals, retailers' : 'No — intermediate channel'}</span></div>
            </Field>
            <Field label="Description" className="g2-span-all"><Textarea value={form.description} style={{ minHeight: 52 }} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Default commercial terms" description="Inherited automatically by partners in this channel unless overridden." icon={<Percent size={16} />}>
          <FormGrid cols={3}>
            <Field label="Standard discount" required><NumberInput min={0} max={100} step={0.5} value={t.standardDiscountPct} suffix="%" onChange={(v) => setT({ standardDiscountPct: v ?? 0 })} /></Field>
            <Field label="Credit period" required><NumberInput min={0} value={t.creditPeriodDays} suffix="days" onChange={(v) => setT({ creditPeriodDays: v ?? 0 })} /></Field>
            <Field label="Credit limit (₹)" required><NumberInput min={0} step={10000} value={t.creditLimit} onChange={(v) => setT({ creditLimit: v ?? 0 })} /></Field>
            <Field label="Deposit">
              <div className="g2-row" style={{ height: 38 }}><Checkbox checked={t.depositRequired} onChange={(v) => setT({ depositRequired: v, depositAmount: v ? t.depositAmount : 0 })} label="Deposit required" /></div>
            </Field>
            {t.depositRequired ? (
              <Field label="Deposit amount (₹)" required><NumberInput min={0} step={10000} value={t.depositAmount} invalid={touched && t.depositAmount <= 0} onChange={(v) => setT({ depositAmount: v ?? 0 })} /></Field>
            ) : <div />}
            <div />
            <Field label="Minimum order value (₹)"><NumberInput min={0} step={1000} value={t.minOrderValue} onChange={(v) => setT({ minOrderValue: v ?? 0 })} /></Field>
            <Field label="Maximum order value (₹)">
              <div className="g2-stack" style={{ gap: 6 }}>
                <Checkbox checked={unlimitedMax} onChange={(v) => { setUnlimitedMax(v); setT({ maxOrderValue: v ? null : Math.max(t.minOrderValue, 100000) }); }} label={<span className="g2-small">No maximum</span>} />
                {!unlimitedMax && <NumberInput min={0} step={1000} value={t.maxOrderValue} onChange={(v) => setT({ maxOrderValue: v ?? 0 })} />}
              </div>
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Effective period & versioning" icon={<CalendarClock size={16} />}>
          <FormGrid cols={3}>
            <Field label="Effective from" required><Input type="date" value={t.effectiveFrom} onChange={(e) => setT({ effectiveFrom: e.target.value })} /></Field>
            <Field label="Effective to" hint="Leave empty for open-ended"><Input type="date" value={t.effectiveTo ?? ''} onChange={(e) => setT({ effectiveTo: e.target.value || null })} /></Field>
            {editing && <Field label="Change note" hint="Recorded in configuration history"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are terms changing?" /></Field>}
          </FormGrid>
          {termsChanged && (
            <div style={{ marginTop: 12 }}>
              <Alert tone={sameEffective ? 'warn' : 'info'} icon={<Info size={15} />}>
                Saving creates <strong>version v{(editing?.version ?? 0) + 1}</strong> effective from {t.effectiveFrom}. Earlier versions remain valid for their own dates, so existing partner relationships and historical transactions are not silently changed.
                {sameEffective && ' Tip: set a future effective date to schedule the change instead of applying it from the previous start date.'}
              </Alert>
            </div>
          )}
        </FormSection>
      </div>
    </Modal>
  );
};
