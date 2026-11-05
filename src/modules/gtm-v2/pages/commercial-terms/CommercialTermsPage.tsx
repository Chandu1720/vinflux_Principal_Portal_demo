import React, { useState } from 'react';
import { Download, Lock, Plus } from 'lucide-react';
import { Button, Card, ErrorState, LoadingState, PageHeader, Tabs } from '../../components/ui';
import { OriginBadge } from '../../components/domain/Badges';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { SCOPE_LABEL, SCOPE_PRECEDENCE } from '../../utils/commercial';
import { exportCsv } from '../../utils/export';
import { territoryPath } from '../../utils/territory';
import { EffectiveTermsTab } from './EffectiveTermsTab';
import { buildEffectiveRows } from './effectiveRows';
import { OverrideRecordsTab } from './OverrideRecordsTab';
import { NewOverrideModal } from './NewOverrideModal';

const PRECEDENCE_TEXT: Record<string, string> = {
  RELATIONSHIP: 'Approved terms for one partner’s supply link under a sales policy.',
  PARTNER: 'Approved partner-specific overrides.',
  TERRITORY: 'Channel terms for a territory; the most specific territory (or nearest ancestor) wins.',
  CHANNEL: 'Default terms from Sales Channel Configuration (versioned by effective date).',
};

const CommercialTermsPage: React.FC = () => {
  const data = useGtmBundle();
  const { can } = useGtmAuth();
  const [tab, setTab] = useState('effective');
  const [creating, setCreating] = useState(false);

  if (data.error) return <ErrorState message={data.error} />;
  if (data.loading || !data.config) return <LoadingState label="Loading commercial terms…" />;

  const pending = data.terms.filter((t) => t.approvalStatus === 'Pending').length;

  const exportEffective = () => {
    const rows = buildEffectiveRows(data);
    exportCsv('gtm-effective-commercial-terms', ['Partner', 'Code', 'Relationship', 'Channel', 'Territory', 'Standard Discount %', 'Approved Discount %', 'Discount Source', 'Credit Period', 'Credit Period Source', 'Credit Limit', 'Credit Limit Source', 'Deposit Required', 'Deposit Amount', 'Deposit Source', 'Effective From', 'Effective To', 'Pending Overrides'],
      rows.map((r) => [r.partner.name, r.partner.code, r.mapping ? data.flows.find((f) => f.id === r.mapping!.flowId)?.name : 'Partner level', r.channel.name, r.primaryTerritoryId ? territoryPath(r.primaryTerritoryId, data.territories) : '',
        r.defaultDiscount, r.resolved.standardDiscountPct.value, r.resolved.standardDiscountPct.label, r.resolved.creditPeriodDays.value, r.resolved.creditPeriodDays.label,
        r.resolved.creditLimit.value, r.resolved.creditLimit.label, r.resolved.depositRequired.value ? 'Yes' : 'No', r.resolved.depositAmount.value, r.resolved.depositAmount.label, r.from, r.to ?? '', r.pending]));
  };

  return (
    <>
      <PageHeader
        title="Commercial Terms"
        description="Inherited and overridden commercial terms — every value shows where it came from."
        actions={<>
          <Button icon={<Download size={15} />} onClick={exportEffective}>Export</Button>
          {can.overrideCommercials
            ? <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>New override</Button>
            : <Button icon={<Lock size={15} />} disabled title="Requires configuration permission">New override</Button>}
        </>}
      />
      <Card title="Precedence" subtitle="The first level that defines a value wins; levels below fill the remaining fields." style={{ marginBottom: 16 }}>
        <div className="g2-grid g2-grid-4">
          {SCOPE_PRECEDENCE.map((s, i) => (
            <div key={s} className="g2-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span className="g2-step-num" style={{ border: '2px solid var(--g2-primary-200)', color: 'var(--g2-primary)', width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <div><OriginBadge scope={s} label={SCOPE_LABEL[s]} /><div className="g2-small g2-muted" style={{ marginTop: 4 }}>{PRECEDENCE_TEXT[s]}</div></div>
            </div>
          ))}
        </div>
      </Card>
      <Card flush>
        <div style={{ padding: '0 18px' }}>
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'effective', label: 'Effective terms' },
            { id: 'records', label: 'Override records', count: data.terms.length },
            { id: 'pending', label: 'Pending approval', count: pending },
          ]} />
        </div>
        {tab === 'effective' && <EffectiveTermsTab data={data} />}
        {tab === 'records' && <OverrideRecordsTab data={data} />}
        {tab === 'pending' && <OverrideRecordsTab key="pending" data={{ ...data, terms: data.terms.filter((t) => t.approvalStatus === 'Pending') }} />}
      </Card>
      {creating && <NewOverrideModal data={data} onClose={() => setCreating(false)} />}
    </>
  );
};

export default CommercialTermsPage;
