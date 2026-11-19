import React, { useState } from 'react';
import { BadgeCheck, Building2, Contact, MapPin, ShieldCheck, XCircle } from 'lucide-react';
import type { GtmConfiguration, InstitutionFieldKey, Partner, Territory } from '../../types';
import { Alert, Button, ErrorList, Field, FormGrid, FormSection, Input, Modal, NumberInput, Select } from '../../components/ui';
import { TerritoryMultiSelect } from '../../components/domain/TerritoryPicker';
import { shortFormTypeIds } from '../../utils/eligibility';
import { gstService, partnerService, validateInstitution, readDb } from '../../services';
import type { InstitutionInput } from '../../services';
import { errorMessage } from '../../services/apiClient';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';

const blank = (partnerTypeId: string, territoryIds: string[]): InstitutionInput => ({
  name: '', partnerTypeId, territoryIds, gst: '', gstVerification: null, pan: '', contactPerson: '', email: '', phone: '',
  address: { line1: '', city: '', state: '', pincode: '' },
  institution: { institutionType: '', ownership: '', bedCount: null, registrationNo: '', drugLicenseNo: '', procurementContact: '', hospitalGroup: '' },
});

/**
 * Add a hospital / institution (end customer). Which fields appear and which are mandatory
 * comes from Configuration → Institution Onboarding.
 */
export const InstitutionDrawer: React.FC<{
  open: boolean;
  config: GtmConfiguration;
  territories: Territory[];
  defaultPartnerTypeId?: string;
  defaultTerritoryIds?: string[];
  onClose: () => void;
  onCreated?: (p: Partner) => void;
}> = ({ open, config, territories, defaultPartnerTypeId, defaultTerritoryIds = [], onClose, onCreated }) => {
  const cfg = config.institutionOnboarding;
  const types = config.partnerTypes.filter((t) => shortFormTypeIds(config).includes(t.id) && t.status === 'Active');
  const [form, setForm] = useState<InstitutionInput>(() => blank(defaultPartnerTypeId ?? types[0]?.id ?? '', defaultTerritoryIds));
  const [touched, setTouched] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [gstError, setGstError] = useState<string | null>(null);
  const { run, pending, errors } = useAction();
  const { actor } = useGtmAuth();

  const f = cfg.fields;
  const show = (k: InstitutionFieldKey) => f[k] !== 'hidden';
  const req = (k: InstitutionFieldKey) => f[k] === 'required';
  const set = (patch: Partial<InstitutionInput>) => setForm((x) => ({ ...x, ...patch }));
  const setInst = (patch: Partial<InstitutionInput['institution']>) => setForm((x) => ({ ...x, institution: { ...x.institution, ...patch } }));
  const setAddr = (patch: Partial<InstitutionInput['address']>) => setForm((x) => ({ ...x, address: { ...x.address, ...patch } }));
  const verified = !!form.gstVerification && form.gstVerification.gstin === form.gst.toUpperCase() && form.gstVerification.status === 'Active';
  const localErrors = touched ? validateInstitution(form, readDb()) : [];

  const verify = async () => {
    setVerifying(true); setGstError(null);
    try {
      const r = await gstService.verify(form.gst, actor);
      setForm((x) => ({ ...x, gst: r.gstin, gstVerification: r, name: x.name.trim() ? x.name : r.tradeName, pan: r.pan, address: { ...r.address } }));
    } catch (e) { setGstError(errorMessage(e)); } finally { setVerifying(false); }
  };

  const save = async () => {
    setTouched(true);
    if (validateInstitution(form, readDb()).length) return;
    const p = await run(() => partnerService.createInstitution(form, actor),
      (x) => (x.status === 'Active' ? `${x.name} added and ready to use.` : `${x.name} added — waiting for Institution Onboarding approval.`));
    if (p) { onCreated?.(p); onClose(); }
  };

  return (
    <Modal open={open} size="lg" onClose={onClose} title={`Add ${types.find((t) => t.id === form.partnerTypeId)?.name ?? 'end customer'}`}
      subtitle={cfg.requireApproval ? 'Requires approval before partners can sell to it.' : 'Available immediately as an end customer.'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Building2 size={15} />} loading={pending} onClick={save}>Add</Button></>}>
      <div className="g2-stack">
        <ErrorList errors={touched ? [...new Set([...localErrors, ...errors])] : errors} />

        <datalist id="g2-hospital-groups">{Array.from(new Set(readDb().partners.map((p) => p.institution?.hospitalGroup).filter(Boolean))).map((g) => <option key={g} value={g} />)}</datalist>
        <FormSection title="Institution" icon={<Building2 size={16} />}>
          <FormGrid>
            <Field label="Institution name" required className="g2-span-2"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sunrise Multi-speciality Hospital" /></Field>
            <Field label="Partner type" required><Select value={form.partnerTypeId} onChange={(v) => set({ partnerTypeId: v })} options={types.map((t) => ({ value: t.id, label: t.name }))} /></Field>
            <Field label="Territory" required>
              <TerritoryMultiSelect territories={territories} levelLabels={config.territoryRules.levelLabels} values={form.territoryIds} onChange={(v) => set({ territoryIds: v })} />
            </Field>
            {show('institutionType') && <Field label="Institution type" required={req('institutionType')}><Select value={form.institution.institutionType} placeholder="Select…" onChange={(v) => setInst({ institutionType: v })} options={cfg.institutionTypes.map((x) => ({ value: x, label: x }))} /></Field>}
            {show('ownership') && <Field label="Ownership" required={req('ownership')}><Select value={form.institution.ownership} placeholder="Select…" onChange={(v) => setInst({ ownership: v })} options={cfg.ownershipTypes.map((x) => ({ value: x, label: x }))} /></Field>}
            {show('bedCount') && <Field label="Bed count" required={req('bedCount')}><NumberInput value={form.institution.bedCount} allowEmpty min={0} onChange={(v) => setInst({ bedCount: v })} /></Field>}
            {show('hospitalGroup') && <Field label="Hospital group / chain" required={req('hospitalGroup')} hint="Hospitals of one group are shown together in Hospital Coverage"><Input value={form.institution.hospitalGroup ?? ''} list="g2-hospital-groups" onChange={(e) => setInst({ hospitalGroup: e.target.value })} placeholder="e.g. Yashoda Hospitals" /></Field>}
          </FormGrid>
        </FormSection>

        {(show('gst') || show('pan') || show('registrationNo') || show('drugLicenseNo')) && (
          <FormSection title="Statutory" icon={<ShieldCheck size={16} />} description={show('gst') ? 'If a GSTIN is entered, verify it to auto-fill the registered name, PAN and address.' : undefined}>
            <FormGrid>
              {show('gst') && (
                <Field label="GSTIN" required={req('gst')} error={gstError} hint={verified ? `Verified · ${form.gstVerification?.legalName}` : undefined}>
                  <div className="g2-row" style={{ flexWrap: 'nowrap' }}>
                    <Input value={form.gst} maxLength={15} className="g2-mono" onChange={(e) => set({ gst: e.target.value.toUpperCase(), gstVerification: null })} placeholder="15-character GSTIN" />
                    <Button size="sm" variant={verified ? 'secondary' : 'soft'} icon={verified ? <BadgeCheck size={14} /> : <ShieldCheck size={14} />} loading={verifying} disabled={form.gst.length !== 15} onClick={verify}>{verified ? 'Verified' : 'Verify'}</Button>
                  </div>
                </Field>
              )}
              {show('pan') && <Field label="PAN" required={req('pan')}><Input value={form.pan} maxLength={10} className="g2-mono" readOnly={verified} onChange={(e) => set({ pan: e.target.value.toUpperCase() })} /></Field>}
              {show('registrationNo') && <Field label="Registration no." required={req('registrationNo')} hint="Clinical establishment / hospital registration"><Input value={form.institution.registrationNo} onChange={(e) => setInst({ registrationNo: e.target.value })} /></Field>}
              {show('drugLicenseNo') && <Field label="Drug licence no." required={req('drugLicenseNo')} hint="For an in-house pharmacy"><Input value={form.institution.drugLicenseNo} onChange={(e) => setInst({ drugLicenseNo: e.target.value })} /></Field>}
            </FormGrid>
            {form.gstVerification && form.gstVerification.status !== 'Active' && <div style={{ marginTop: 8 }}><Alert tone="error" icon={<XCircle size={15} />}>GST registration is {form.gstVerification.status}.</Alert></div>}
          </FormSection>
        )}

        {(show('contactPerson') || show('phone') || show('email') || show('procurementContact')) && (
          <FormSection title="Contacts" icon={<Contact size={16} />}>
            <FormGrid>
              {show('contactPerson') && <Field label="Contact person" required={req('contactPerson')}><Input value={form.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} /></Field>}
              {show('phone') && <Field label="Phone" required={req('phone')}><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98480 00000" /></Field>}
              {show('email') && <Field label="Email" required={req('email')}><Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>}
              {show('procurementContact') && <Field label="Procurement contact" required={req('procurementContact')}><Input value={form.institution.procurementContact} onChange={(e) => setInst({ procurementContact: e.target.value })} placeholder="Name / phone of purchase department" /></Field>}
            </FormGrid>
          </FormSection>
        )}

        {show('address') && (
          <FormSection title="Address" icon={<MapPin size={16} />}>
            <FormGrid>
              <Field label="Address line" required={req('address')} className="g2-span-2"><Input value={form.address.line1} readOnly={verified} onChange={(e) => setAddr({ line1: e.target.value })} /></Field>
              <Field label="City" required={req('address')}><Input value={form.address.city} readOnly={verified} onChange={(e) => setAddr({ city: e.target.value })} /></Field>
              <Field label="State" required={req('address')}><Input value={form.address.state} readOnly={verified} onChange={(e) => setAddr({ state: e.target.value })} /></Field>
              <Field label="PIN code" required={req('address')}><Input value={form.address.pincode} readOnly={verified} maxLength={6} onChange={(e) => setAddr({ pincode: e.target.value.replace(/\D/g, '') })} /></Field>
            </FormGrid>
          </FormSection>
        )}
        <div className="g2-small g2-muted">Field rules are set in Configuration → Short Onboarding Form.</div>
      </div>
    </Modal>
  );
};
