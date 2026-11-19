import type {
  CommercialField, CommercialTermRecord, CommercialValues, ResolvedTerms, ResolvedValue, SalesChannel, Territory, TermScope,
} from '../types';
import { getAncestorIds, getDepth, territoryPath } from './territory';

export const COMMERCIAL_FIELDS: { key: CommercialField; label: string; kind: 'pct' | 'days' | 'money' | 'bool' }[] = [
  { key: 'standardDiscountPct', label: 'Discount %', kind: 'pct' },
  { key: 'creditPeriodDays', label: 'Credit Period', kind: 'days' },
  { key: 'creditLimit', label: 'Credit Limit', kind: 'money' },
  { key: 'depositRequired', label: 'Deposit Required', kind: 'bool' },
  { key: 'depositAmount', label: 'Deposit Amount', kind: 'money' },
];

export const SCOPE_LABEL: Record<TermScope, string> = {
  RELATIONSHIP: 'Relationship override',
  PARTNER: 'Partner override',
  TERRITORY: 'Territory terms',
  CHANNEL: 'Channel default',
};

export const SCOPE_PRECEDENCE: TermScope[] = ['RELATIONSHIP', 'PARTNER', 'TERRITORY', 'CHANNEL'];

/**
 * Versioned channel defaults: returns the channel term version effective on `onDate`.
 * A future-dated change therefore never silently alters today's relationships.
 */
export const channelTermsOn = (channel: SalesChannel, onDate: string) => {
  const versions = channel.history.slice().sort((a, b) => b.version - a.version);
  const v = versions.find((h) => h.terms.effectiveFrom <= onDate && (!h.terms.effectiveTo || h.terms.effectiveTo >= onDate));
  return v ? { version: v.version, terms: v.terms } : { version: channel.version, terms: channel.terms };
};

const isEffective = (r: CommercialTermRecord, onDate: string) =>
  r.effectiveFrom <= onDate && (!r.effectiveTo || r.effectiveTo >= onDate);

const isUsable = (r: CommercialTermRecord) => r.approvalStatus === 'Approved' || r.approvalStatus === 'Not Required';

export interface ResolveContext {
  channel: SalesChannel;
  partnerId?: string | null;
  mappingId?: string | null;
  /** Territories to use for territory-level lookup (partner territories or a single territory). */
  territoryIds?: string[];
  records: CommercialTermRecord[];
  territories: Territory[];
  onDate?: string;
  /** Include pending records (for "preview" in onboarding). */
  includePending?: boolean;
}

/**
 * Resolve each commercial field using precedence:
 * 1. Approved relationship-specific  2. Approved partner-specific
 * 3. Territory-specific (most specific territory wins, ancestors inherit)  4. Default channel
 */
export const resolveTerms = (ctx: ResolveContext): ResolvedTerms => {
  const onDate = ctx.onDate ?? new Date().toISOString().slice(0, 10);
  const usable = (r: CommercialTermRecord) => (ctx.includePending ? r.approvalStatus !== 'Rejected' : isUsable(r)) && isEffective(r, onDate);
  const rel = ctx.mappingId
    ? ctx.records.filter((r) => r.scope === 'RELATIONSHIP' && r.mappingId === ctx.mappingId && usable(r))
    : [];
  const ptr = ctx.partnerId
    ? ctx.records.filter((r) => r.scope === 'PARTNER' && r.partnerId === ctx.partnerId && r.channelId === ctx.channel.id && usable(r))
    : [];

  // Territory candidates: each partner territory + its ancestors, ranked by depth (deepest first)
  const terrCandidates = new Map<string, number>();
  (ctx.territoryIds ?? []).forEach((tid) => {
    [tid, ...getAncestorIds(tid, ctx.territories)].forEach((x) => terrCandidates.set(x, getDepth(x, ctx.territories)));
  });
  const ter = ctx.records
    .filter((r) => r.scope === 'TERRITORY' && r.channelId === ctx.channel.id && r.territoryId && terrCandidates.has(r.territoryId) && usable(r))
    .sort((a, b) => (terrCandidates.get(b.territoryId!) ?? 0) - (terrCandidates.get(a.territoryId!) ?? 0));

  const pick = <K extends CommercialField>(key: K): ResolvedValue<CommercialValues[K]> => {
    const latest = (list: CommercialTermRecord[]) => list.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find((r) => r.values[key] !== undefined);
    const r1 = latest(rel);
    if (r1) return { value: r1.values[key] as CommercialValues[K], scope: 'RELATIONSHIP', recordId: r1.id, label: SCOPE_LABEL.RELATIONSHIP };
    const r2 = latest(ptr);
    if (r2) return { value: r2.values[key] as CommercialValues[K], scope: 'PARTNER', recordId: r2.id, label: SCOPE_LABEL.PARTNER };
    const r3 = ter.find((r) => r.values[key] !== undefined);
    if (r3) return { value: r3.values[key] as CommercialValues[K], scope: 'TERRITORY', recordId: r3.id, label: `Territory: ${territoryPath(r3.territoryId!, ctx.territories).split(' › ').pop()}` };
    return { value: chTerms.terms[key] as CommercialValues[K], scope: 'CHANNEL', recordId: null, label: `Channel default (v${chTerms.version})` };
  };
  const chTerms = channelTermsOn(ctx.channel, onDate);

  return {
    standardDiscountPct: pick('standardDiscountPct'),
    creditPeriodDays: pick('creditPeriodDays'),
    creditLimit: pick('creditLimit'),
    depositRequired: pick('depositRequired'),
    depositAmount: pick('depositAmount'),
  };
};

export const flattenResolved = (r: ResolvedTerms): CommercialValues => ({
  standardDiscountPct: r.standardDiscountPct.value,
  creditPeriodDays: r.creditPeriodDays.value,
  creditLimit: r.creditLimit.value,
  depositRequired: r.depositRequired.value,
  depositAmount: r.depositAmount.value,
});
