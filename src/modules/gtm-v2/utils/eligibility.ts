import type { EligibilityRules, FlowStage, Partner, PartnerType, Territory } from '../types';
import { territoriesOverlap } from './territory';

export interface EligibilityCheck {
  partner: Partner;
  eligible: boolean;
  reasons: string[];
}

/**
 * Evaluate which onboarded partners may occupy a flow stage, using configurable rules:
 * partner type ↔ stage channel, territory overlap, active status and KYC/approval status.
 */
export const evaluateStageEligibility = (
  stage: FlowStage,
  candidates: Partner[],
  contextTerritoryIds: string[],
  partnerTypes: PartnerType[],
  territories: Territory[],
  rules: EligibilityRules,
  excludePartnerId?: string,
  /** End-customer stages (hospitals, institutions): principal KYC is not required — they follow the institution process. */
  endCustomer = false,
): EligibilityCheck[] =>
  candidates
    .filter((p) => p.id !== excludePartnerId)
    .map((p) => {
      const reasons: string[] = [];
      const pt = partnerTypes.find((t) => t.id === p.partnerTypeId);
      if (rules.requireChannelMatch && pt?.channelId !== stage.channelId) reasons.push('Partner type does not match stage channel');
      if (rules.requireTerritoryOverlap && !territoriesOverlap(p.territoryIds, contextTerritoryIds, territories, rules.territoryMatchMode)) reasons.push('No territory overlap');
      if (rules.requireActiveStatus && p.status !== 'Active') reasons.push(`Status is ${p.status}`);
      if (rules.requireKycVerified && !endCustomer && p.kycStatus !== 'Verified') reasons.push(`KYC ${p.kycStatus}`);
      return { partner: p, eligible: reasons.length === 0, reasons };
    });

export const partnerChannelId = (p: Pick<Partner, 'partnerTypeId'>, partnerTypes: PartnerType[]): string | null =>
  partnerTypes.find((t) => t.id === p.partnerTypeId)?.channelId ?? null;

/** Partner types onboarded with the short (end-customer) form. */
export const shortFormTypeIds = (config: { partnerTypes: { id: string; onboardingForm?: 'full' | 'short' }[] }): string[] =>
  config.partnerTypes.filter((t) => t.onboardingForm === 'short').map((t) => t.id);
