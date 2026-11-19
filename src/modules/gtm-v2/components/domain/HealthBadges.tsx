import React from 'react';
import { CheckCircle2, CircleSlash, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui';
import type { CreditView, LicenceItem, TradeStatus } from '../../utils/health';
import { formatCompactINR, formatDate } from '../../utils/format';

/** One chip that says whether the partner can trade; hover shows every reason. */
export const TradeStatusBadge: React.FC<{ status: TradeStatus }> = ({ status }) => (
  <Badge tone={status.tone} dot title={status.reasons.map((r) => `• ${r.text}`).join('\n')}>{status.label}</Badge>
);

/** Full reasons list used in the partner panel. */
export const TradeStatusPanel: React.FC<{ status: TradeStatus }> = ({ status }) => {
  const Icon = status.canTrade ? (status.tone === 'green' ? CheckCircle2 : AlertTriangle) : CircleSlash;
  return (
    <div className={`g2-trade-panel g2-trade-${status.tone}`}>
      <div className="g2-row" style={{ gap: 8 }}>
        <Icon size={18} />
        <strong>{status.canTrade ? (status.tone === 'green' ? 'Ready to trade' : 'Can trade — needs attention') : `Blocked: ${status.label}`}</strong>
      </div>
      <ul>{status.reasons.map((r) => <li key={r.text} className={`g2-trade-${r.tone}`}>{r.text}</li>)}</ul>
    </div>
  );
};

export const LicenceBadge: React.FC<{ item: LicenceItem | null }> = ({ item }) => {
  if (!item) return <span className="g2-muted">—</span>;
  if (item.renewalPending) return <Badge tone={item.state === 'expired' ? 'red' : 'blue'} dot title="Renewed copy waiting for Compliance verification">{item.state === 'expired' ? 'Expired · renewal in review' : 'Renewal in review'}</Badge>;
  switch (item.state) {
    case 'expired': return <Badge tone="red" dot title={`Expired on ${formatDate(item.doc.validUntil)}`}>Expired</Badge>;
    case 'expiring': return <Badge tone="amber" dot title={`Valid until ${formatDate(item.doc.validUntil)}`}>{item.daysLeft === 0 ? 'Expires today' : `Expires in ${item.daysLeft}d`}</Badge>;
    case 'no-date': return <Badge tone="amber" dot>No validity date</Badge>;
    default: return <Badge tone="green" dot title={`Valid until ${formatDate(item.doc.validUntil)}`}>Valid</Badge>;
  }
};

const CREDIT_COLOR: Record<CreditView['state'], string> = {
  ok: '#059669', watch: '#d97706', overdue: '#d97706', over: '#dc2626', hold: '#dc2626', 'n/a': '#94a3b8',
};

/** Compact utilisation bar: outstanding vs limit. */
export const CreditBar: React.FC<{ credit: CreditView; compact?: boolean }> = ({ credit, compact }) => {
  if (credit.state === 'n/a') return <span className="g2-muted">—</span>;
  const pct = Math.min(100, credit.utilPct);
  return (
    <div className="g2-credit" title={`Outstanding ${formatCompactINR(credit.outstanding)} of ${formatCompactINR(credit.limit)}${credit.overdue ? ` · Overdue ${formatCompactINR(credit.overdue)}` : ''}`}>
      <div className="g2-credit-bar"><span style={{ width: `${pct}%`, background: CREDIT_COLOR[credit.state] }} /></div>
      {!compact && <div className="g2-cell-sub">{credit.utilPct}% of {formatCompactINR(credit.limit)}{credit.state === 'hold' ? ' · On hold' : credit.overdue ? ' · Overdue' : ''}</div>}
    </div>
  );
};
