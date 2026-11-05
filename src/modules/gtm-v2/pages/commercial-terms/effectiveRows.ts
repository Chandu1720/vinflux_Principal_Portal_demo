import { channelTermsOn, resolveTerms } from '../../utils/commercial';
import { partnerChannelId } from '../../utils/eligibility';
import { collapseSelection } from '../../utils/territory';
import { todayISO } from '../../utils/format';
import type { Partner, PartnerFlowMapping, ResolvedTerms, ResolvedValue, SalesChannel } from '../../types';
import type { GtmBundle } from '../partner-onboarding/stepProps';

export interface EffectiveRow {
  key: string;
  partner: Partner;
  channel: SalesChannel;
  mapping: PartnerFlowMapping | null;
  primaryTerritoryId: string | null;
  defaultDiscount: number;
  resolved: ResolvedTerms;
  from: string;
  to: string | null;
  pending: number;
}

export const buildEffectiveRows = (data: GtmBundle): EffectiveRow[] => {
  const config = data.config;
  if (!config) return [];
  const today = todayISO();
  const rows: EffectiveRow[] = [];
  data.partners.filter((p) => p.status === 'Active' || p.status === 'Suspended').forEach((p) => {
    const channel = data.channels.find((c) => c.id === partnerChannelId(p, config.partnerTypes));
    if (!channel) return;
    const def = channelTermsOn(channel, today);
    const relMappings = data.mappings.filter((m) => m.partnerId === p.id && data.terms.some((t) => t.scope === 'RELATIONSHIP' && t.mappingId === m.id));
    const contexts: (PartnerFlowMapping | null)[] = [null, ...relMappings];
    contexts.forEach((m) => {
      const resolved = resolveTerms({ channel, partnerId: p.id, mappingId: m?.id ?? null, territoryIds: p.territoryIds, records: data.terms, territories: data.territories, onDate: today });
      const used = data.terms.filter((t) => Object.values(resolved).some((v: ResolvedValue<unknown>) => v.recordId === t.id));
      const from = [def.terms.effectiveFrom, ...used.map((u) => u.effectiveFrom)].sort().pop()!;
      const tos = [def.terms.effectiveTo, ...used.map((u) => u.effectiveTo)].filter((x): x is string => !!x).sort();
      rows.push({
        key: `${p.id}-${m?.id ?? 'p'}`, partner: p, channel, mapping: m, primaryTerritoryId: collapseSelection(p.territoryIds, data.territories)[0] ?? null,
        defaultDiscount: def.terms.standardDiscountPct, resolved, from, to: tos[0] ?? null,
        pending: data.terms.filter((t) => t.partnerId === p.id && t.approvalStatus === 'Pending' && (m ? t.mappingId === m.id : t.scope === 'PARTNER')).length,
      });
    });
  });
  return rows;
};

