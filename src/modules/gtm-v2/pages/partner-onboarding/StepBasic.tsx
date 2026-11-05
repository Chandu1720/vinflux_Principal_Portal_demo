import React, { useState } from 'react';
import { BadgeCheck, Building, Lock, MapPin, ShieldCheck, User, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Field, FormGrid, FormSection, Input } from '../../components/ui';
import { gstService, SANDBOX_GSTINS } from '../../services';
import type { PartnerInput } from '../../services';
import { errorMessage } from '../../services/apiClient';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { checkGstin } from '../../utils/gstin';
import { formatDate, formatDateTime } from '../../utils/format';
import type { StepProps } from './stepProps';
import { validateBasic } from './wizardModel';

/** Small label shown next to fields that were filled from the GST registry. */
const RegistryTag: React.FC = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: 'var(--g2-green)' }}>
    <Lock size={10} />GST registry
  </span>
);

export const StepBasic: React.FC<StepProps> = ({ state, update, data, showErrors }) => {
  const { input } = state;
  const { actor, showToast } = useGtmAuth();
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const errs = showErrors ? validateBasic(input, data.partners, state.id) : {};
  const set = <K extends keyof PartnerInput>(k: K, v: PartnerInput[K]) => update((s) => ({ ...s, input: { ...s.input, [k]: v } }));
  const setAddr = (k: keyof PartnerInput['address'], v: string) => update((s) => ({ ...s, input: { ...s.input, address: { ...s.input.address, [k]: v } } }));

  const gv = input.gstVerification;
  const verified = !!gv && gv.gstin === input.gst.toUpperCase() && gv.status === 'Active';
  const offline = input.gst.length === 15 ? checkGstin(input.gst) : null;


  // Editing the GSTIN invalidates any previous verification.
  const changeGst = (v: string) => {
    setVerifyError(null);
    update((s) => ({ ...s, input: { ...s.input, gst: v.toUpperCase(), gstVerification: s.input.gstVerification?.gstin === v.toUpperCase() ? s.input.gstVerification : null } }));
  };

  const verify = async (gstin = input.gst) => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const r = await gstService.verify(gstin, actor);
      update((s) => ({
        ...s,
        input: {
          ...s.input,
          gst: r.gstin,
          gstVerification: r,
          // Registered details from the GST registry
          businessName: r.legalName,
          name: s.input.name.trim() ? s.input.name : r.tradeName,
          pan: r.pan,
          address: { ...r.address },
        },
      }));
      if (r.status === 'Active') showToast(`GSTIN verified — registered details of ${r.legalName} filled in.`, 'success');
      else showToast(`GST registration is ${r.status}. This partner cannot be onboarded.`, 'danger');
    } catch (e) {
      setVerifyError(errorMessage(e));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <FormSection title="GST verification" icon={<ShieldCheck size={16} />} description="Verify the GSTIN first — the registered business name, PAN and address are filled in from the GST registry.">
        <div className="g2-row" style={{ alignItems: 'flex-start' }}>
          <Field label="GSTIN" required error={errs.gst ?? (offline && !offline.ok ? offline.error : null)} hint={offline?.ok ? `${offline.state} · PAN ${offline.pan}` : '15 characters'} className="g2-flex-1">
            <Input value={input.gst} maxLength={15} invalid={!!errs.gst || (!!offline && !offline.ok)} onChange={(e) => changeGst(e.target.value)} className="g2-mono"
              placeholder="e.g. 36AAECC5521M1ZK" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void verify(); } }} />
          </Field>
          <Button variant={verified ? 'secondary' : 'primary'} icon={verified ? <BadgeCheck size={15} /> : <ShieldCheck size={15} />} loading={verifying}
            disabled={input.gst.length !== 15} onClick={() => verify()} style={{ marginTop: 22 }}>
            {verified ? 'Re-verify' : 'Verify GSTIN'}
          </Button>
        </div>

        {verifyError && <div style={{ marginTop: 10 }}><Alert tone="error" icon={<XCircle size={16} />}>{verifyError}</Alert></div>}

        {gv && gv.gstin === input.gst.toUpperCase() && (
          <div style={{ marginTop: 12 }}>
            <Alert tone={gv.status === 'Active' ? 'success' : 'error'} icon={gv.status === 'Active' ? <BadgeCheck size={16} /> : <XCircle size={16} />}>
              <div className="g2-row" style={{ gap: 8 }}>
                <strong>{gv.legalName}</strong>
                <Badge tone={gv.status === 'Active' ? 'green' : 'red'}>{gv.status}</Badge>
              </div>
              <div style={{ marginTop: 4 }}>
                Trade name: {gv.tradeName} · {gv.constitution} · {gv.taxpayerType} taxpayer · Registered {formatDate(gv.registrationDate)} · {gv.state} ({gv.stateCode})
              </div>
              <div className="g2-small" style={{ marginTop: 4, opacity: 0.8 }}>Verified {formatDateTime(gv.verifiedAt)} by {gv.verifiedBy} · Source: {gv.source}</div>
            </Alert>
          </div>
        )}

        {!verified && (
          <div className="g2-small g2-muted" style={{ marginTop: 10 }}>
            Sandbox GSTINs (until the GSP backend is connected):{' '}
            {SANDBOX_GSTINS.map((g, i) => (
              <React.Fragment key={g.gstin}>
                {i > 0 && ' · '}
                <button type="button" className="g2-mono" style={{ border: 0, background: 'none', padding: 0, color: 'var(--g2-primary)', cursor: 'pointer', fontSize: 11.5 }}
                  title={`${g.name} (${g.status})`} onClick={() => { changeGst(g.gstin); void verify(g.gstin); }}>{g.gstin}</button>
              </React.Fragment>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Partner identity" icon={<User size={16} />} description="Partner type is chosen later, after territories and products, from the types the sales policies support.">
        <FormGrid>
          <Field label="Partner name" required error={errs.name} hint={verified ? 'Pre-filled with the GST trade name — editable' : undefined}><Input value={input.name} invalid={!!errs.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Krishna Medi Distributors" /></Field>
          <Field label="Partner code" required error={errs.code} hint="Auto-suggested; must be unique"><Input value={input.code} invalid={!!errs.code} onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
          <Field label="Contact person" required error={errs.contactPerson}><Input value={input.contactPerson} invalid={!!errs.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} /></Field>
          <Field label="Email" required error={errs.email}><Input type="email" value={input.email} invalid={!!errs.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Phone" required error={errs.phone}><Input value={input.phone} invalid={!!errs.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98480 00000" /></Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Registered business" icon={<Building size={16} />} description={verified ? 'Locked to the GST registry. Change the GSTIN to edit.' : 'Filled automatically after GSTIN verification.'}>
        <FormGrid>
          <Field label={<>Registered business name{verified && <RegistryTag />}</>} required error={errs.businessName} className="g2-span-2">
            <Input value={input.businessName} readOnly={verified} invalid={!!errs.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </Field>
          <Field label={<>PAN{verified && <RegistryTag />}</>} required error={errs.pan} hint="Derived from GSTIN characters 3–12">
            <Input value={input.pan} maxLength={10} readOnly={verified} invalid={!!errs.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} className="g2-mono" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Registered address" icon={<MapPin size={16} />}>
        <FormGrid>
          <Field label={<>Address line{verified && <RegistryTag />}</>} required error={errs.line1} className="g2-span-2"><Input value={input.address.line1} readOnly={verified} invalid={!!errs.line1} onChange={(e) => setAddr('line1', e.target.value)} /></Field>
          <Field label={<>City{verified && <RegistryTag />}</>} required error={errs.city}><Input value={input.address.city} readOnly={verified} invalid={!!errs.city} onChange={(e) => setAddr('city', e.target.value)} /></Field>
          <Field label={<>State{verified && <RegistryTag />}</>} required error={errs.state}><Input value={input.address.state} readOnly={verified} invalid={!!errs.state} onChange={(e) => setAddr('state', e.target.value)} /></Field>
          <Field label={<>PIN code{verified && <RegistryTag />}</>} required error={errs.pincode}><Input value={input.address.pincode} readOnly={verified} maxLength={6} inputMode="numeric" invalid={!!errs.pincode} onChange={(e) => setAddr('pincode', e.target.value.replace(/\D/g, ''))} /></Field>
        </FormGrid>
      </FormSection>
    </div>
  );
};
