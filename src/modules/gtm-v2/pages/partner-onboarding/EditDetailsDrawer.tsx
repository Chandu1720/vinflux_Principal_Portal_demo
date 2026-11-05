import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Alert, Button, ErrorList, Field, FormGrid, FormSection, Input, Modal, NumberInput, Select } from '../../components/ui';
import { partnerService } from '../../services';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import type { GtmConfiguration, Partner } from '../../types';

/** Edit contacts, address and (for hospitals) the institution profile after onboarding. */
export const EditDetailsDrawer: React.FC<{ partner: Partner; config: GtmConfiguration; onClose: () => void }> = ({ partner, config, onClose }) => {
  const { actor } = useGtmAuth();
  const { run, pending, errors } = useAction();
  const [f, setF] = useState({ contactPerson: partner.contactPerson, email: partner.email, phone: partner.phone, address: { ...partner.address }, institution: partner.institution ? { ...partner.institution } : null });
  const locked = !!partner.gstVerification && partner.gstVerification.status === 'Active';
  const cfg = config.institutionOnboarding;
  const save = async () => { const r = await run(() => partnerService.updateDetails(partner.id, f, actor), 'Details updated.'); if (r) onClose(); };
  return (
    <Modal open title={`Edit ${partner.name}`} subtitle="Contacts and address. Legal name, GSTIN and PAN stay as verified." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={pending} onClick={save}>Save</Button></>}>
      <div className="g2-stack">
        {errors.length > 0 && <ErrorList errors={errors} />}
        <FormSection title="Contact">
          <FormGrid>
            <Field label="Contact person" required><Input value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} /></Field>
            <Field label="Phone" required><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          </FormGrid>
        </FormSection>
        <FormSection title="Address">
          {locked && <Alert tone="info" icon={<Lock size={14} />}>Address is locked to the GST registry. It changes when the GSTIN registration changes.</Alert>}
          <FormGrid>
            <Field label="Address line" className="g2-span-2"><Input value={f.address.line1} readOnly={locked} onChange={(e) => setF({ ...f, address: { ...f.address, line1: e.target.value } })} /></Field>
            <Field label="City"><Input value={f.address.city} readOnly={locked} onChange={(e) => setF({ ...f, address: { ...f.address, city: e.target.value } })} /></Field>
            <Field label="State"><Input value={f.address.state} readOnly={locked} onChange={(e) => setF({ ...f, address: { ...f.address, state: e.target.value } })} /></Field>
            <Field label="PIN code"><Input value={f.address.pincode} readOnly={locked} maxLength={6} onChange={(e) => setF({ ...f, address: { ...f.address, pincode: e.target.value.replace(/\D/g, '') } })} /></Field>
          </FormGrid>
        </FormSection>
        {f.institution && (
          <FormSection title="Institution profile">
            <FormGrid>
              <Field label="Hospital group / chain"><Input value={f.institution.hospitalGroup ?? ''} onChange={(e) => setF({ ...f, institution: { ...f.institution!, hospitalGroup: e.target.value } })} /></Field>
              <Field label="Institution type"><Select value={f.institution.institutionType} onChange={(v) => setF({ ...f, institution: { ...f.institution!, institutionType: v } })} options={cfg.institutionTypes.map((x) => ({ value: x, label: x }))} /></Field>
              <Field label="Ownership"><Select value={f.institution.ownership} onChange={(v) => setF({ ...f, institution: { ...f.institution!, ownership: v } })} options={cfg.ownershipTypes.map((x) => ({ value: x, label: x }))} /></Field>
              <Field label="Bed count"><NumberInput value={f.institution.bedCount} allowEmpty min={0} onChange={(v) => setF({ ...f, institution: { ...f.institution!, bedCount: v } })} /></Field>
              <Field label="Procurement contact"><Input value={f.institution.procurementContact} onChange={(e) => setF({ ...f, institution: { ...f.institution!, procurementContact: e.target.value } })} /></Field>
              <Field label="Registration no."><Input value={f.institution.registrationNo} onChange={(e) => setF({ ...f, institution: { ...f.institution!, registrationNo: e.target.value } })} /></Field>
            </FormGrid>
          </FormSection>
        )}
      </div>
    </Modal>
  );
};
