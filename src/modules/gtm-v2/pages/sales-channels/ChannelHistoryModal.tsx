import React from 'react';
import type { ChannelTerms, SalesChannel } from '../../types';
import { Badge, Button, Modal } from '../../components/ui';
import { formatDate, formatDateTime, formatINR } from '../../utils/format';

const FIELDS: { key: keyof ChannelTerms; label: string; fmt: (v: ChannelTerms) => string }[] = [
  { key: 'standardDiscountPct', label: 'Discount', fmt: (v) => `${v.standardDiscountPct}%` },
  { key: 'creditPeriodDays', label: 'Credit period', fmt: (v) => `${v.creditPeriodDays} days` },
  { key: 'creditLimit', label: 'Credit limit', fmt: (v) => formatINR(v.creditLimit) },
  { key: 'depositRequired', label: 'Deposit', fmt: (v) => (v.depositRequired ? formatINR(v.depositAmount) : 'Not required') },
  { key: 'minOrderValue', label: 'Min order', fmt: (v) => formatINR(v.minOrderValue) },
  { key: 'maxOrderValue', label: 'Max order', fmt: (v) => (v.maxOrderValue === null ? 'No limit' : formatINR(v.maxOrderValue)) },
  { key: 'effectiveFrom', label: 'Effective', fmt: (v) => `${formatDate(v.effectiveFrom)} → ${v.effectiveTo ? formatDate(v.effectiveTo) : 'open'}` },
];

export const ChannelHistoryModal: React.FC<{ channel: SalesChannel | null; onClose: () => void }> = ({ channel, onClose }) => {
  if (!channel) return null;
  const versions = channel.history.slice().sort((a, b) => b.version - a.version);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Modal open size="lg" onClose={onClose} title={`Configuration history · ${channel.name}`} subtitle="Each commercial change is stored as an effective-dated version." footer={<Button onClick={onClose}>Close</Button>}>
      <ul className="g2-timeline">
        {versions.map((h) => {
          const prev = channel.history.find((x) => x.version === h.version - 1);
          const effective = h.terms.effectiveFrom <= today && (!h.terms.effectiveTo || h.terms.effectiveTo >= today);
          const future = h.terms.effectiveFrom > today;
          const changed = FIELDS.filter((f) => prev && f.fmt(prev.terms) !== f.fmt(h.terms));
          return (
            <li key={h.version}>
              <span className="tdot" style={effective ? { background: 'var(--g2-green)' } : future ? { background: 'var(--g2-cyan)' } : undefined} />
              <div className="g2-row">
                <strong>v{h.version}</strong>
                {effective && <Badge tone="green" dot>In effect today</Badge>}
                {future && <Badge tone="cyan" dot>Scheduled</Badge>}
                {!effective && !future && <Badge tone="slate">Superseded</Badge>}
                <span className="g2-small g2-muted">{formatDateTime(h.changedAt)} · {h.changedBy}</span>
              </div>
              <div className="g2-small" style={{ margin: '4px 0 8px' }}>{h.changeNote}</div>
              <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 8 }}>
                <table className="g2-table">
                  <tbody>
                    {(prev ? changed : FIELDS).map((f) => (
                      <tr key={f.key}>
                        <td style={{ width: 150 }} className="g2-muted">{f.label}</td>
                        {prev && <td style={{ textDecoration: 'line-through', color: 'var(--g2-text-3)' }}>{f.fmt(prev.terms)}</td>}
                        <td className="g2-strong">{f.fmt(h.terms)}</td>
                      </tr>
                    ))}
                    {prev && changed.length === 0 && <tr><td className="g2-muted">No commercial differences</td></tr>}
                  </tbody>
                </table>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
};
