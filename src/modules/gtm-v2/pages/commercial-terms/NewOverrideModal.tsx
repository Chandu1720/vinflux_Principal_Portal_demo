import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Alert, Badge, Button, ErrorList, Field, FormGrid, Input, Modal, SearchableSelect, Segmented, Textarea } from '../../components/ui';
import { CommercialOverrideEditor, changedTerms } from '../../components/domain/CommercialOverrideEditor';
import { flattenResolved, resolveTerms } from '../../utils/commercial';
import { partnerChannelId } from '../../utils/eligibility';
import { territoryPath } from '../../utils/territory';
import { todayISO } from '../../utils/format';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { commercialService } from '../../services';
import type { CommercialField, CommercialValues } from '../../types';
import type { GtmBundle } from '../partner-onboarding/stepProps';
import { predictTermCategories, workflowLabel } from '../partner-onboarding/wizardModel';

type Scope = 'TERRITORY' | 'PARTNER' | 'RELATIONSHIP';

export const NewOverrideModal: React.FC<{ data: GtmBundle; onClose: () => void }> = ({ data, onClose }) => {
  const { actor } = useGtmAuth();
  const { run, pending, errors } = useAction();
  const config = data.config!;
  const [scope, setScope] = useState<Scope>('PARTNER');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [values, setValues] = useState<Partial<CommercialValues>>({});
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState<string | null>(null);

  const partner = data.partners.find((p) => p.id === partnerId);
  const effChannelId = scope === 'TERRITORY' ? channelId : partner ? partnerChannelId(partner, config.partnerTypes) : null;
  const channel = data.channels.find((c) => c.id === effChannelId);
  const mappings = partner ? data.mappings.filter((m) => m.partnerId === partner.id) : [];

  const resolved = useMemo(() => {
    if (!channel) return null;
    if (scope === 'TERRITORY') return territoryId ? resolveTerms({ channel, territoryIds: [territoryId], records: data.terms, territories: data.territories }) : null;
    if (!partner) return null;
    if (scope === 'RELATIONSHIP' && !mappingId) return null;
    return resolveTerms({ channel, partnerId: partner.id, mappingId: scope === 'RELATIONSHIP' ? mappingId : null, territoryIds: partner.territoryIds, records: data.terms, territories: data.territories });
  }, [channel, scope, territoryId, partner, mappingId, data.terms, data.territories]);

  const base = resolved ? flattenResolved(resolved) : null;
  const changed: Partial<CommercialValues> = {};
  if (base) (Object.keys(values) as CommercialField[]).forEach((k) => { if (values[k] !== base[k]) (changed as Record<string, unknown>)[k] = values[k]; });
  const cats = base && scope !== 'TERRITORY' ? predictTermCategories(base, changed) : [];

  const resetTarget = (s: Scope) => { setScope(s); setValues({}); setMappingId(null); setEditing(false); };

  const save = async () => {
    const r = await run(() => commercialService.create({ scope, channelId: effChannelId ?? '', territoryId: scope === 'TERRITORY' ? territoryId : null, partnerId: scope === 'TERRITORY' ? null : partnerId, mappingId: scope === 'RELATIONSHIP' ? mappingId : null, values: changed, reason, effectiveFrom: from, effectiveTo: to }, actor),
      (res) => (res.pendingApproval ? 'Override submitted — pending approval.' : 'Commercial terms saved and effective.'));
    if (r) onClose();
  };

  const partnerOptions = data.partners.filter((p) => ['Active', 'Suspended', 'Approval Pending'].includes(p.status))
    .map((p) => ({ value: p.id, label: p.name, description: `${p.code} · ${config.partnerTypes.find((t) => t.id === p.partnerTypeId)?.name ?? ''}` }));

  return (
    <Modal open size="lg" title="New commercial terms" subtitle="Only changed values are stored; everything else keeps inheriting." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={pending} disabled={!Object.keys(changed).length} onClick={save}>{cats.length ? 'Submit for approval' : 'Save terms'}</Button></>}>
      <div className="g2-stack">
        <Segmented value={scope} onChange={(s) => resetTarget(s as Scope)} options={[
          { id: 'PARTNER', label: 'Partner override' }, { id: 'RELATIONSHIP', label: 'Relationship override' }, { id: 'TERRITORY', label: 'Territory terms' },
        ]} />
        <Alert tone="info" icon={<Info size={16} />}>
          {scope === 'TERRITORY' && 'Territory terms are master configuration for a channel in a territory (and its sub-territories). No approval is required.'}
          {scope === 'PARTNER' && 'Partner overrides apply to all of the partner\'s relationships in its channel. Changes require approval per the configured workflows.'}
          {scope === 'RELATIONSHIP' && 'Relationship overrides apply to one partner’s supply link under a sales policy and take highest precedence. Approval required.'}
        </Alert>
        <FormGrid>
          {scope === 'TERRITORY' ? (
            <>
              <Field label="Sales channel" required><SearchableSelect value={channelId} onChange={(v) => { setChannelId(v); setValues({}); }} options={data.channels.filter((c) => c.status === 'Active').map((c) => ({ value: c.id, label: c.name }))} /></Field>
              <Field label="Territory" required><SearchableSelect value={territoryId} onChange={(v) => { setTerritoryId(v); setValues({}); }} options={data.territories.filter((t) => t.status === 'Active').map((t) => ({ value: t.id, label: t.name, description: territoryPath(t.id, data.territories) }))} /></Field>
            </>
          ) : (
            <>
              <Field label="Partner" required hint={channel ? `Channel: ${channel.name}` : undefined}><SearchableSelect value={partnerId} onChange={(v) => { setPartnerId(v); setMappingId(null); setValues({}); }} options={partnerOptions} /></Field>
              {scope === 'RELATIONSHIP' && (
                <Field label="Relationship (sales policy)" required hint={partner && !mappings.length ? 'This partner has no supply links yet.' : undefined}>
                  <SearchableSelect value={mappingId} disabled={!partner} onChange={(v) => { setMappingId(v); setValues({}); }}
                    options={mappings.map((m) => ({ value: m.id, label: data.flows.find((f) => f.id === m.flowId)?.name ?? m.flowId, description: `Mapped ${m.effectiveFrom} · ${m.status}` }))} />
                </Field>
              )}
            </>
          )}
        </FormGrid>

        {resolved ? (
          <CommercialOverrideEditor
            resolved={resolved}
            enabled={editing}
            values={values}
            label={scope === 'TERRITORY' ? 'Set territory terms' : 'Override commercial terms'}
            onEnabledChange={(on) => { setEditing(on); setValues({}); }}
            onValuesChange={(v) => setValues(base ? changedTerms(base, v) : v)}
          />
        ) : <div className="g2-muted g2-small">Select the target above to see the currently inherited values.</div>}

        <FormGrid>
          <Field label={scope === 'TERRITORY' ? 'Notes / reason' : 'Override reason'} required className="g2-span-2"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="Requested by"><Input value={actor} disabled /></Field>
          <div />
          <Field label="Effective from" required><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Effective to" hint="Empty = open-ended"><Input type="date" value={to ?? ''} onChange={(e) => setTo(e.target.value || null)} /></Field>
        </FormGrid>

        {cats.length > 0 && (
          <div>
            <div className="g2-label" style={{ marginBottom: 6 }}>Approvals that will be raised</div>
            {cats.map((c) => {
              const wf = workflowLabel(config, c.cat);
              return <div key={c.cat} className="g2-list-item g2-small"><Badge tone="purple">{wf.label}</Badge><span>{c.label}: {c.from} → <strong>{c.to}</strong></span><span className="g2-spacer" /><span className="g2-muted">{wf.enabled ? wf.levels.join(' → ') : 'Auto-approved'}</span></div>;
            })}
          </div>
        )}
        <ErrorList errors={errors} title="Could not save" />
      </div>
    </Modal>
  );
};
