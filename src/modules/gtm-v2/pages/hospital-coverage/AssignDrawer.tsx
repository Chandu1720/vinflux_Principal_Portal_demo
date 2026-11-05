import React, { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Alert, Button, ErrorList, Field, FormGrid, Input, Modal, SearchableSelect, Segmented, Select } from '../../components/ui';
import { coverageService, readDb, validateAssignment } from '../../services';
import type { AssignInput } from '../../services';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { todayStr } from '../../utils/coverage';
import type { GtmBundle } from '../partner-onboarding/stepProps';
import { candidatePartners, hospitalsOf } from './model';
import type { PortfolioCol } from './model';

export const AssignDrawer: React.FC<{ data: GtmBundle; cols: PortfolioCol[]; preset?: Partial<AssignInput>; onClose: () => void }> = ({ data, cols, preset, onClose }) => {
  const { actor, principal } = useGtmAuth();
  const { run, pending } = useAction();
  const config = data.config!;
  const [f, setF] = useState<AssignInput>({ customerId: '', portfolioId: null, servedBy: 'PARTNER', partnerId: null, role: 'PRIMARY', effectiveFrom: todayStr(), ...preset });
  const [touched, setTouched] = useState(false);
  const hospitals = hospitalsOf(data.partners, config);
  const hospital = data.partners.find((p) => p.id === f.customerId);
  const candidates = useMemo(() => candidatePartners(hospital, data.partners, config, data.territories), [hospital, data.partners, config, data.territories]);
  const errs = touched ? validateAssignment(readDb(), f) : [];
  const typeName = (id: string) => config.partnerTypes.find((t) => t.id === id)?.name ?? '';

  const save = async () => {
    setTouched(true);
    if (validateAssignment(readDb(), f).length) return;
    const r = await run(() => coverageService.assign(f, actor), 'Hospital assigned.');
    if (r) onClose();
  };

  return (
    <Modal open title="Assign hospital" subtitle="Who serves this hospital, for which portfolio, from which date." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Link2 size={15} />} loading={pending} onClick={save}>Assign</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <Field label="Hospital" required>
          <SearchableSelect value={f.customerId || null} placeholder="Choose hospital…" onChange={(v) => setF({ ...f, customerId: v ?? '', partnerId: null })}
            options={hospitals.map((h) => ({ value: h.id, label: h.name, description: h.institution?.hospitalGroup ?? h.address.city }))} />
        </Field>
        <FormGrid>
          <Field label="Portfolio" required>
            <Select value={f.portfolioId ?? ''} onChange={(v) => setF({ ...f, portfolioId: v || null })} options={[{ value: '', label: 'All portfolios' }, ...cols.map((c) => ({ value: c.id, label: c.name }))]} />
          </Field>
          <Field label="Effective from" required><Input type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
        </FormGrid>
        <Field label="Served by">
          <Segmented value={f.servedBy} onChange={(v) => setF({ ...f, servedBy: v as AssignInput['servedBy'], partnerId: null })}
            options={[{ id: 'PARTNER', label: 'A partner' }, { id: 'DIRECT', label: `${principal.name.split(' ')[0]} direct` }]} />
        </Field>
        {f.servedBy === 'PARTNER' && (
          <Field label="Partner" required hint={hospital ? 'Active trading partners whose territory covers this hospital.' : 'Choose the hospital first.'}>
            <SearchableSelect value={f.partnerId} placeholder="Choose partner…" onChange={(v) => setF({ ...f, partnerId: v })}
              options={candidates.map((p) => ({ value: p.id, label: p.name, description: `${typeName(p.partnerTypeId)} · ${p.code}` }))} />
          </Field>
        )}
        <Field label="Role">
          <Segmented value={f.role} onChange={(v) => setF({ ...f, role: v as AssignInput['role'] })} options={[{ id: 'PRIMARY', label: 'Primary' }, { id: 'BACKUP', label: 'Backup' }]} />
        </Field>
        <Alert tone="info">Rule: one primary per hospital and portfolio{config.coverage.allowBackup ? '; a backup supplies only when the primary can’t' : ''}. Two partners can share a hospital by splitting portfolios.</Alert>
      </div>
    </Modal>
  );
};
