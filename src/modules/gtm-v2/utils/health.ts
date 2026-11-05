/**
 * Partner health: one place that answers "can this partner trade today, and if not, why?"
 * Combines status, licence validity (compliance) and credit position.
 */
import type {
  CommercialTermRecord, GtmConfiguration, KycDocument, Partner, PortalUser, SalesChannel, Territory,
} from '../types';
import { resolveTerms } from './commercial';
import { partnerChannelId } from './eligibility';

const DAY = 86400000;
export const today = () => new Date().toISOString().slice(0, 10);
export const daysUntil = (iso: string, from = today()) =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / DAY);
export const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * DAY).toISOString();

/* ------------------------------ Compliance ------------------------------ */

export type LicenceState = 'valid' | 'expiring' | 'expired' | 'no-date';

export interface LicenceItem {
  doc: KycDocument;
  docName: string;
  state: LicenceState;
  daysLeft: number | null;
  /** A renewed copy is waiting for Compliance; the state above is still based on the verified copy. */
  renewalPending?: boolean;
}

export const licenceItems = (p: Partner, config: GtmConfiguration): LicenceItem[] => {
  const alert = config.compliance.expiryAlertDays;
  return p.kycDocuments.flatMap((doc): LicenceItem[] => {
    const req = config.kycDocuments.find((k) => k.id === doc.docTypeId);
    if (!req?.tracksExpiry || doc.status === 'Rejected') return [];
    // For a trading partner an unverified renewal does not count yet — use the copy it replaces.
    const prev = (doc as KycDocument & { replaces?: KycDocument | null }).replaces;
    const renewalPending = doc.status === 'Under Review' && !!prev;
    const until = renewalPending ? prev!.validUntil : doc.validUntil;
    if (!until) return [{ doc, docName: req.name, state: 'no-date', daysLeft: null, renewalPending }];
    const d = daysUntil(until);
    return [{ doc, docName: req.name, state: d < 0 ? 'expired' : d <= alert ? 'expiring' : 'valid', daysLeft: d, renewalPending }];
  });
};

/** Worst licence state of the partner (null = nothing tracked). */
export const complianceOf = (p: Partner, config: GtmConfiguration) => {
  const items = licenceItems(p, config);
  const order: LicenceState[] = ['expired', 'expiring', 'no-date', 'valid'];
  const worst = items.slice().sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))[0] ?? null;
  return { items, worst };
};

/* -------------------------------- Credit -------------------------------- */

export type CreditState = 'ok' | 'watch' | 'over' | 'overdue' | 'hold' | 'n/a';

export interface CreditView {
  limit: number;
  periodDays: number;
  outstanding: number;
  overdue: number;
  available: number;
  utilPct: number;
  state: CreditState;
  asOf: string | null;
}

export const creditOf = (
  p: Partner, config: GtmConfiguration, ctx: { channels: SalesChannel[]; terms: CommercialTermRecord[]; territories: Territory[] },
): CreditView => {
  const channel = ctx.channels.find((c) => c.id === partnerChannelId(p, config.partnerTypes));
  const r = channel ? resolveTerms({ channel, partnerId: p.id, territoryIds: p.territoryIds, records: ctx.terms, territories: ctx.territories }) : null;
  const limit = r?.creditLimit.value ?? 0;
  const outstanding = p.credit?.outstanding ?? 0;
  const overdue = p.credit?.overdue ?? 0;
  const utilPct = limit > 0 ? Math.round((outstanding / limit) * 100) : 0;
  const state: CreditState = p.credit?.hold ? 'hold'
    : !p.credit ? 'n/a'
      : limit > 0 && outstanding > limit ? 'over'
        : overdue > 0 ? 'overdue'
          : utilPct >= config.compliance.creditWarnPct ? 'watch' : 'ok';
  return { limit, periodDays: r?.creditPeriodDays.value ?? 0, outstanding, overdue, available: Math.max(0, limit - outstanding), utilPct, state, asOf: p.credit?.asOf ?? null };
};

/* ----------------------------- Trade status ----------------------------- */

export type TradeTone = 'green' | 'amber' | 'red' | 'slate';

export interface TradeStatus {
  canTrade: boolean;
  label: string;
  tone: TradeTone;
  /** Every reason, most severe first — shown in tooltips and the partner panel. */
  reasons: { tone: TradeTone; text: string }[];
}

/**
 * Single trade signal. Blocks: not Active, credit hold, expired licence (if configured),
 * over limit / overdue (if configured). Warnings: licence expiring, credit near limit.
 */
export const tradeStatusOf = (
  p: Partner, config: GtmConfiguration, ctx: { channels: SalesChannel[]; terms: CommercialTermRecord[]; territories: Territory[] },
): TradeStatus => {
  const reasons: TradeStatus['reasons'] = [];
  const cfg = config.compliance;
  if (p.status !== 'Active') reasons.push({ tone: 'slate', text: `Partner is ${p.status}` });
  const { items } = complianceOf(p, config);
  items.filter((i) => i.state === 'expired').forEach((i) => reasons.push({ tone: cfg.blockOnExpiredLicence ? 'red' : 'amber', text: `${i.docName} expired ${-(i.daysLeft ?? 0)} day(s) ago${i.renewalPending ? ' (renewal under review)' : ''}` }));
  items.filter((i) => i.state === 'no-date').forEach((i) => reasons.push({ tone: 'amber', text: `${i.docName}: validity date missing` }));
  items.filter((i) => i.state === 'expiring').forEach((i) => reasons.push({ tone: 'amber', text: `${i.docName} expires in ${i.daysLeft} day(s)${i.renewalPending ? ' (renewal under review)' : ''}` }));
  const c = creditOf(p, config, ctx);
  if (c.state === 'hold') reasons.push({ tone: 'red', text: `Credit hold: ${p.credit?.hold?.reason}` });
  if (c.limit > 0 && c.outstanding > c.limit) reasons.push({ tone: cfg.blockWhenOverLimit ? 'red' : 'amber', text: `Over credit limit (${c.utilPct}% used)` });
  if (c.overdue > 0) reasons.push({ tone: cfg.blockWhenOverdue ? 'red' : 'amber', text: 'Payment overdue' });
  if (c.state === 'watch') reasons.push({ tone: 'amber', text: `Credit ${c.utilPct}% used` });

  const order: TradeTone[] = ['slate', 'red', 'amber', 'green'];
  reasons.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));
  const blocked = reasons.some((r) => r.tone === 'red' || r.tone === 'slate');
  if (p.status !== 'Active') return { canTrade: false, label: 'Not active', tone: 'slate', reasons };
  if (blocked) {
    const first = reasons.find((r) => r.tone === 'red')!;
    const label = first.text.startsWith('Credit hold') ? 'On credit hold'
      : first.text.includes('expired') ? 'Licence expired'
        : first.text.startsWith('Over credit') ? 'Over credit limit' : 'Payment overdue';
    return { canTrade: false, label, tone: 'red', reasons };
  }
  if (reasons.length) return { canTrade: true, label: 'Attention', tone: 'amber', reasons };
  return { canTrade: true, label: 'Ready to trade', tone: 'green', reasons: [{ tone: 'green', text: 'Active, licences valid, within credit limit' }] };
};

/* -------------------------------- Portal -------------------------------- */

export type PortalDisplayStatus = 'Invited' | 'Active' | 'Revoked' | 'Expired';

export const portalStatus = (u: PortalUser): PortalDisplayStatus =>
  u.status === 'Invited' && u.expiresAt < new Date().toISOString() ? 'Expired' : u.status;

export const portalSummary = (p: Partner) => {
  const users = p.portalUsers ?? [];
  const s = users.map(portalStatus);
  return { active: s.filter((x) => x === 'Active').length, pending: s.filter((x) => x === 'Invited').length, expired: s.filter((x) => x === 'Expired').length, total: users.length };
};

export const portalEnabledFor = (p: Partner, config: GtmConfiguration) => config.portal.partnerTypeIds.includes(p.partnerTypeId);
