import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, FileWarning, MailWarning, ShieldCheck } from 'lucide-react';
import { Badge, Card, EmptyState } from '../../components/ui';
import { ROUTES } from '../../constants/navigation';
import { complianceOf, creditOf, portalStatus, tradeStatusOf } from '../../utils/health';
import { formatCompactINR } from '../../utils/format';
import type { GtmBundle } from '../partner-onboarding/stepProps';

interface Item { key: string; partnerId: string; name: string; text: string; tone: 'red' | 'amber'; tab: string; icon: React.ReactNode }

/**
 * "Needs attention" — the one list a sales ops / finance user checks every morning:
 * blocked partners, expiring licences, credit issues and stale portal invites.
 */
export const PartnerHealthCard: React.FC<{ data: GtmBundle }> = ({ data }) => {
  const navigate = useNavigate();
  const config = data.config;
  const { counts, items, exposure } = useMemo(() => {
    const counts = { ready: 0, attention: 0, blocked: 0 };
    const items: Item[] = [];
    let exposure = 0;
    if (!config) return { counts, items, exposure };
    data.partners.filter((p) => p.status === 'Active').forEach((p) => {
      const t = tradeStatusOf(p, config, data);
      if (!t.canTrade) counts.blocked += 1; else if (t.tone === 'amber') counts.attention += 1; else counts.ready += 1;
      complianceOf(p, config).items.forEach((i) => {
        if (i.state === 'expired') items.push({ key: `${p.id}-${i.doc.id}`, partnerId: p.id, name: p.name, text: `${i.docName} expired${i.renewalPending ? ' · renewal in review' : ''}`, tone: 'red', tab: 'kyc', icon: <FileWarning size={15} /> });
        if (i.state === 'expiring') items.push({ key: `${p.id}-${i.doc.id}`, partnerId: p.id, name: p.name, text: `${i.docName} expires in ${i.daysLeft} days`, tone: 'amber', tab: 'kyc', icon: <FileWarning size={15} /> });
      });
      const c = creditOf(p, config, data);
      exposure += c.outstanding;
      if (c.state === 'hold') items.push({ key: `${p.id}-hold`, partnerId: p.id, name: p.name, text: `On credit hold · ${formatCompactINR(c.outstanding)} outstanding`, tone: 'red', tab: 'credit', icon: <CreditCard size={15} /> });
      else if (c.state === 'over') items.push({ key: `${p.id}-over`, partnerId: p.id, name: p.name, text: `Over credit limit (${c.utilPct}%)`, tone: 'red', tab: 'credit', icon: <CreditCard size={15} /> });
      else if (c.state === 'overdue') items.push({ key: `${p.id}-od`, partnerId: p.id, name: p.name, text: `${formatCompactINR(c.overdue)} overdue`, tone: config.compliance.blockWhenOverdue ? 'red' : 'amber', tab: 'credit', icon: <CreditCard size={15} /> });
      else if (c.state === 'watch') items.push({ key: `${p.id}-watch`, partnerId: p.id, name: p.name, text: `Credit ${c.utilPct}% used`, tone: 'amber', tab: 'credit', icon: <CreditCard size={15} /> });
      const expired = (p.portalUsers ?? []).filter((u) => portalStatus(u) === 'Expired').length;
      if (expired) items.push({ key: `${p.id}-portal`, partnerId: p.id, name: p.name, text: `${expired} portal invite(s) expired — resend`, tone: 'amber', tab: 'portal', icon: <MailWarning size={15} /> });
    });
    items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'red' ? -1 : 1));
    return { counts, items, exposure };
  }, [data, config]);

  const tile = (label: string, n: number, tone: 'green' | 'amber' | 'red', health: string) => (
    <button type="button" className={`g2-health-tile g2-trade-${tone}`} onClick={() => navigate(`${ROUTES.partners}?health=${health}`)}>
      <span className="g2-kpi-value" style={{ fontSize: 24 }}>{n}</span><span className="g2-small">{label}</span>
    </button>
  );

  return (
    <Card title="Partner Health" subtitle={`Licences and credit across ${counts.ready + counts.attention + counts.blocked} active partners · ${formatCompactINR(exposure)} receivables`}>
      <div className="g2-health-tiles">
        {tile('Ready to trade', counts.ready, 'green', 'ready')}
        {tile('Needs attention', counts.attention, 'amber', 'attention')}
        {tile('Blocked', counts.blocked, 'red', 'blocked')}
      </div>
      {items.length === 0 ? <EmptyState icon={<ShieldCheck size={24} />} title="All partners are healthy" /> : items.slice(0, 7).map((i) => (
        <button key={i.key} type="button" className="g2-list-item g2-health-item" onClick={() => navigate(`${ROUTES.partners}?focus=${i.partnerId}&tab=${i.tab}`)}>
          <span style={{ color: i.tone === 'red' ? '#dc2626' : '#d97706', display: 'flex' }}>{i.icon}</span>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}><div className="g2-cell-main g2-ellipsis">{i.name}</div><div className="g2-cell-sub">{i.text}</div></div>
          <Badge tone={i.tone}>{i.tone === 'red' ? 'Blocked' : 'Watch'}</Badge>
        </button>
      ))}
      {items.length > 7 && <div className="g2-small g2-muted" style={{ marginTop: 6 }}>+{items.length - 7} more in Reports → Partner Health</div>}
    </Card>
  );
};
