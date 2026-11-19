import React from 'react';
import type { ComplianceConfig, GtmConfiguration } from '../../../types';
import { NumberInput } from '../../../components/ui';
import { SectionShell, useConfigSection } from '../useConfigSection';
import { RuleRow, SwitchRule } from './RuleRow';

/** Rules behind the single "Trade status" signal: licence validity and credit position. */
export const ComplianceCreditSection: React.FC<{ config: GtmConfiguration }> = ({ config }) => {
  const s = useConfigSection('compliance', config);
  const d = s.draft;
  const set = (patch: Partial<ComplianceConfig>) => s.setDraft({ ...d, ...patch });
  const validate = (v: ComplianceConfig) => {
    const e: string[] = [];
    if (!(v.expiryAlertDays >= 1 && v.expiryAlertDays <= 365)) e.push('Expiry alert must be between 1 and 365 days.');
    if (!(v.creditWarnPct >= 1 && v.creditWarnPct <= 100)) e.push('Credit warning must be between 1% and 100%.');
    return e;
  };
  const tracked = config.kycDocuments.filter((k) => k.tracksExpiry).map((k) => k.name);

  return (
    <SectionShell title="Compliance & Credit" description="Decides when a partner shows “Ready to trade”, “Needs attention” or “Blocked”. Applies everywhere: partner list, dashboard, reports."
      {...s} onSave={() => s.save(validate)} onDiscard={s.discard}>
      <div className="g2-label" style={{ margin: '4px 0 6px' }}>Licences</div>
      <RuleRow title="Alert before expiry" description={`Documents with expiry tracking: ${tracked.length ? tracked.join(', ') : 'none (turn it on in KYC Documents)'}.`}>
        <div style={{ width: 130 }}><NumberInput value={d.expiryAlertDays} min={1} onChange={(v) => set({ expiryAlertDays: v ?? 0 })} suffix="days" /></div>
      </RuleRow>
      <SwitchRule title="Block trading when a licence has expired" description="Selling medical devices without a valid sale registration (MD-42) is not allowed — recommended on." checked={d.blockOnExpiredLicence} onChange={(v) => set({ blockOnExpiredLicence: v })} />
      <div className="g2-label" style={{ margin: '14px 0 6px' }}>Credit</div>
      <RuleRow title="Warn at credit utilisation" description="Outstanding as a share of the partner’s credit limit (from commercial terms).">
        <div style={{ width: 130 }}><NumberInput value={d.creditWarnPct} min={1} max={100} onChange={(v) => set({ creditWarnPct: v ?? 0 })} suffix="%" /></div>
      </RuleRow>
      <SwitchRule title="Block when over the credit limit" description="New orders are blocked automatically while outstanding exceeds the limit." checked={d.blockWhenOverLimit} onChange={(v) => set({ blockWhenOverLimit: v })} />
      <SwitchRule title="Block when payment is overdue" description="Block as soon as any invoice passes its credit period. Off = warn only." checked={d.blockWhenOverdue} onChange={(v) => set({ blockWhenOverdue: v })} />
      <div className="g2-hint" style={{ marginTop: 8 }}>Manual credit holds are placed from a partner’s Credit tab. Releasing a hold follows the “Credit Hold Release” approval workflow.</div>
    </SectionShell>
  );
};
