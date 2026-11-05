/** Price lookup for one partner — same waterfall as Price check, reusable by Orders and Surgery cases. */
import type { Product } from '../../types/product.ts';
import type { CommercialTermRecord, GtmConfiguration, Partner, SalesChannel, Territory } from '../gtm-v2/types';
import { resolveTerms } from '../gtm-v2/utils/commercial';
import { partnerChannelId } from '../gtm-v2/utils/eligibility';
import { getAncestorIds } from '../gtm-v2/utils/territory';
import { quote } from './pricingStore';
import type { Quote } from './pricingStore';

export interface GtmContext { config: GtmConfiguration; channels: SalesChannel[]; terms: CommercialTermRecord[]; territories: Territory[] }

export const quoteFor = (ctx: GtmContext, partner: Partner, principalId: string, productId: string, qty: number, on: string, products: Product[]): Quote => {
  const channelId = partnerChannelId(partner, ctx.config.partnerTypes);
  const channel = ctx.channels.find((c) => c.id === channelId);
  const r = channel ? resolveTerms({ channel, partnerId: partner.id, territoryIds: partner.territoryIds, records: ctx.terms, territories: ctx.territories, onDate: on }) : null;
  const tset = new Set<string>(partner.territoryIds.flatMap((t) => [t, ...getAncestorIds(t, ctx.territories)]));
  return quote({
    principalId, partnerId: partner.id, channelId, partnerTerritoryIds: tset, productId, qty: qty || 1, on,
    discountPct: r?.standardDiscountPct.value ?? 0, discountSource: r ? r.standardDiscountPct.label : 'no terms',
  }, products);
};
