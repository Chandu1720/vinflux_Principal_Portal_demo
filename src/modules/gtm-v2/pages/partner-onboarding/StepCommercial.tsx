import React, { useMemo } from 'react';
import { Lock, Scale } from 'lucide-react';
import { Alert, Badge, Field, FormGrid, Input, Textarea } from '../../components/ui';
import { CommercialOverrideEditor, changedTerms } from '../../components/domain/CommercialOverrideEditor';
import { flattenResolved, resolveTerms } from '../../utils/commercial';
import { partnerChannelId } from '../../utils/eligibility';
import { todayISO } from '../../utils/format';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import type { OnboardingCommercialOverride } from '../../types';
import type { StepProps } from './stepProps';
import { predictTermCategories, workflowLabel } from './wizardModel';

export const StepCommercial: React.FC<StepProps> = ({ state, update, data, config, showErrors }) => {
  const { can, actor } = useGtmAuth();
  const channelId = partnerChannelId(state.input, config.partnerTypes);
  const channel = data.channels.find((c) => c.id === channelId);
  const resolved = useMemo(
    () => (channel ? resolveTerms({ channel, partnerId: state.id, territoryIds: state.input.territoryIds, records: data.terms, territories: data.territories }) : null),
    [channel, state.id, state.input.territoryIds, data.terms, data.territories],
  );
  if (!channel || !resolved) return <Alert tone="error">Select a partner type linked to a sales channel (step 1).</Alert>;

  const base = flattenResolved(resolved);
  const enabled = !!state.extras.commercialOverride;
  const co: OnboardingCommercialOverride = state.extras.commercialOverride ?? { channelId: channel.id, values: {}, reason: '', effectiveFrom: todayISO(), effectiveTo: null };
  const setCo = (next: Partial<OnboardingCommercialOverride>) => update((s) => ({ ...s, extras: { ...s.extras, commercialOverride: { ...co, channelId: channel.id, ...next } } }));
  const setEnabled = (on: boolean) => update((s) => ({ ...s, extras: { ...s.extras, commercialOverride: on ? { ...co, channelId: channel.id, values: {} } : null } }));
  const cats = predictTermCategories(base, co.values);
  const hasOverride = enabled && Object.keys(co.values).length > 0;

  return (
    <div className="g2-stack">
      <Alert tone="info" icon={<Scale size={16} />}>
        Defaults are inherited automatically from the <strong>{channel.name}</strong> channel configuration, refined by territory and any existing partner terms
        (precedence: Relationship → Partner → Territory → Channel default).
      </Alert>
      {!can.overrideCommercials && <Alert tone="warn" icon={<Lock size={16} />}>You are not authorised to override commercial terms. The partner will use inherited terms.</Alert>}

      <CommercialOverrideEditor
        resolved={resolved}
        enabled={enabled}
        values={co.values}
        disabled={!can.overrideCommercials}
        onEnabledChange={(on) => setEnabled(on)}
        onValuesChange={(v) => setCo({ values: changedTerms(base, v) })}
      />

      {hasOverride && (
        <div className="g2-form-section">
          <FormGrid>
            <Field label="Override reason" required className="g2-span-2" error={showErrors && !co.reason.trim() ? 'Reason is required for overrides.' : null}>
              <Textarea value={co.reason} invalid={showErrors && !co.reason.trim()} onChange={(e) => setCo({ reason: e.target.value })} placeholder="Business justification for the deviation" />
            </Field>
            <Field label="Requested by"><Input value={actor} disabled /></Field>
            <Field label="Approval status"><div><Badge tone={cats.length ? 'amber' : 'slate'}>{cats.length ? 'Will be Pending on submit' : 'No change from inherited'}</Badge></div></Field>
            <Field label="Effective from" required><Input type="date" value={co.effectiveFrom} onChange={(e) => setCo({ effectiveFrom: e.target.value })} /></Field>
            <Field label="Effective to" hint="Leave empty for open-ended"><Input type="date" value={co.effectiveTo ?? ''} onChange={(e) => setCo({ effectiveTo: e.target.value || null })} /></Field>
          </FormGrid>
          {cats.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="g2-label" style={{ marginBottom: 6 }}>Approvals that will be raised</div>
              {cats.map((c) => {
                const wf = workflowLabel(config, c.cat);
                return (
                  <div key={c.cat} className="g2-list-item g2-small">
                    <Badge tone="purple">{wf.label}</Badge>
                    <span>{c.label}: {c.from} → <strong>{c.to}</strong></span>
                    <span className="g2-spacer" />
                    <span className="g2-muted">{wf.enabled ? wf.levels.join(' → ') : 'Workflow disabled — auto-approved'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
