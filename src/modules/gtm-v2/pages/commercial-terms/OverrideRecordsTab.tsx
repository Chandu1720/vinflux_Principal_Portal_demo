import React, { useState } from 'react';
import { CalendarX } from 'lucide-react';
import { ConfirmDialog, DataTable, IconButton, SearchInput, Select, StatusBadge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { OriginBadge } from '../../components/domain/Badges';
import { COMMERCIAL_FIELDS, SCOPE_LABEL } from '../../utils/commercial';
import { formatCommercial, formatDate, includesText, todayISO } from '../../utils/format';
import { territoryPath } from '../../utils/territory';
import { useAction } from '../../hooks/useAction';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { commercialService } from '../../services';
import type { CommercialTermRecord } from '../../types';
import type { GtmBundle } from '../partner-onboarding/stepProps';

const lifecycle = (r: CommercialTermRecord, today: string) =>
  r.effectiveTo && r.effectiveTo < today ? 'Expired' : r.effectiveFrom > today ? 'Scheduled' : 'Active';

export const OverrideRecordsTab: React.FC<{ data: GtmBundle }> = ({ data }) => {
  const { actor, can } = useGtmAuth();
  const { run, pending } = useAction();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('');
  const [approval, setApproval] = useState('');
  const [expireRec, setExpireRec] = useState<CommercialTermRecord | null>(null);
  const today = todayISO();

  const pName = (id: string | null) => (id ? data.partners.find((p) => p.id === id)?.name ?? id : '');
  const target = (r: CommercialTermRecord) => {
    if (r.scope === 'TERRITORY') return r.territoryId ? territoryPath(r.territoryId, data.territories) : '—';
    if (r.scope === 'RELATIONSHIP') {
      const m = data.mappings.find((x) => x.id === r.mappingId);
      return `${pName(r.partnerId)} · ${data.flows.find((f) => f.id === m?.flowId)?.name ?? 'relationship'}`;
    }
    return pName(r.partnerId);
  };

  const rows = data.terms.filter((r) => (!scope || r.scope === scope) && (!approval || r.approvalStatus === approval)
    && includesText([target(r), r.overrideReason, r.requestedBy], q)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<CommercialTermRecord>[] = [
    { key: 'scope', header: 'Scope', sortValue: (r) => r.scope, render: (r) => <OriginBadge scope={r.scope} label={SCOPE_LABEL[r.scope]} /> },
    { key: 'target', header: 'Applies to', sortValue: (r) => target(r), render: (r) => <><div className="g2-cell-main">{target(r)}</div><div className="g2-cell-sub">{data.channels.find((c) => c.id === r.channelId)?.name}</div></> },
    { key: 'values', header: 'Values', render: (r) => <div className="g2-small">{COMMERCIAL_FIELDS.filter((f) => r.values[f.key] !== undefined).map((f) => <div key={f.key}>{f.label}: <strong>{formatCommercial(f.kind, r.values[f.key])}</strong></div>)}</div> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="g2-small" style={{ display: 'block', maxWidth: 240 }}>{r.overrideReason || '—'}</span> },
    { key: 'by', header: 'Requested by', sortValue: (r) => r.requestedBy, render: (r) => <><div>{r.requestedBy}</div><div className="g2-cell-sub">{formatDate(r.createdAt)}</div></> },
    { key: 'appr', header: 'Approval', sortValue: (r) => r.approvalStatus, render: (r) => <StatusBadge status={r.approvalStatus} /> },
    { key: 'eff', header: 'Effective', sortValue: (r) => r.effectiveFrom, render: (r) => <div className="g2-small">{formatDate(r.effectiveFrom)} – {r.effectiveTo ? formatDate(r.effectiveTo) : 'open'}<div><StatusBadge status={lifecycle(r, today)} /></div></div> },
    { key: 'act', header: '', className: 'actions', render: (r) => (
      can.overrideCommercials && lifecycle(r, today) !== 'Expired' && r.approvalStatus !== 'Rejected'
        ? <IconButton label="End-date this record" onClick={() => setExpireRec(r)}><CalendarX size={15} /></IconButton> : null
    ) },
  ];

  return (
    <>
      <div className="g2-filterbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search partner, territory, reason…" />
        <Select value={scope} placeholder="All scopes" options={(['RELATIONSHIP', 'PARTNER', 'TERRITORY'] as const).map((s) => ({ value: s, label: SCOPE_LABEL[s] }))} onChange={setScope} />
        <Select value={approval} placeholder="Any approval status" options={['Pending', 'Approved', 'Rejected', 'Not Required'].map((s) => ({ value: s, label: s }))} onChange={setApproval} />
        <span className="g2-spacer" /><span className="g2-small g2-muted">{rows.length} records</span>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="No override records" emptyDescription="Territory terms and partner / relationship overrides appear here." />
      {expireRec && (
        <ConfirmDialog open title="End-date this record?" tone="danger" confirmLabel="End-date" loading={pending}
          message="The record is closed (effective-to set to yesterday) rather than deleted, so history is preserved. Values fall back to the next level of precedence."
          onCancel={() => setExpireRec(null)}
          onConfirm={async () => { const r = await run(() => commercialService.expire(expireRec.id, actor), 'Record end-dated.'); if (r) setExpireRec(null); }} />
      )}
    </>
  );
};
