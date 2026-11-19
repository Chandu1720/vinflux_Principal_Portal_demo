import React, { useMemo, useState } from 'react';
import { Building2, Edit3, History, Info, Lock, Plus } from 'lucide-react';
import { useChannels, useConfig, useFlows, usePartners } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { channelService } from '../../services';
import type { ChannelInput } from '../../services';
import type { SalesChannel } from '../../types';
import { formatCompactINR, includesText } from '../../utils/format';
import { Alert, Badge, Button, Card, DataTable, ErrorState, Highlight, IconButton, PageHeader, SearchInput, Select, StatusBadge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { ChannelFormModal } from './ChannelFormModal';
import { ChannelHistoryModal } from './ChannelHistoryModal';

const SalesChannelsPage: React.FC = () => {
  const channelsQ = useChannels();
  const { data: config } = useConfig();
  const { data: flows = [] } = useFlows();
  const { data: partners = [] } = usePartners();
  const { actor, can } = useGtmAuth();
  const action = useAction();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [form, setForm] = useState<{ open: boolean; editing: SalesChannel | null }>({ open: false, editing: null });
  const [history, setHistory] = useState<SalesChannel | null>(null);

  const channels = useMemo(() => channelsQ.data ?? [], [channelsQ.data]);
  const rows = useMemo(() => channels.filter((c) => (!status || c.status === status)
    && (!role || (role === 'end' ? c.canBeEndpoint : !c.canBeEndpoint))
    && includesText([c.name, c.code, c.description], q)), [channels, q, status, role]);

  const partnerCount = (id: string) => partners.filter((p) => config?.partnerTypes.find((t) => t.id === p.partnerTypeId)?.channelId === id).length;

  const columns: Column<SalesChannel>[] = [
    { key: 'name', header: 'Channel', sortValue: (c) => c.name, render: (c) => <div><div className="g2-cell-main"><Highlight text={c.name} query={q} /></div><div className="g2-cell-sub g2-mono">{c.code}</div></div> },
    { key: 'tier', header: 'Tier', align: 'right', sortValue: (c) => c.tierRank, render: (c) => c.tierRank },
    { key: 'trade', header: 'Trades as', sortValue: (c) => c.tradeModel ?? 'RESELL', render: (c) => ((c.tradeModel ?? 'RESELL') === 'AGENT' ? <Badge tone="amber" title="Dispatches company stock — POs go to the company">Agent</Badge> : <Badge tone="blue" title="Buys and resells — receives POs">Buys &amp; resells</Badge>) },
    { key: 'end', header: 'Role', sortValue: (c) => (c.canBeEndpoint ? 1 : 0), render: (c) => (c.canBeEndpoint ? <Badge tone="green"><Building2 size={11} />End customer</Badge> : <Badge tone="slate">Intermediate</Badge>) },
    { key: 'disc', header: 'Discount', align: 'right', sortValue: (c) => c.terms.standardDiscountPct, render: (c) => `${c.terms.standardDiscountPct}%` },
    { key: 'cl', header: 'Credit', align: 'right', sortValue: (c) => c.terms.creditLimit, render: (c) => <div><div>{formatCompactINR(c.terms.creditLimit)}</div><div className="g2-cell-sub">{c.terms.creditPeriodDays} days</div></div> },
    { key: 'dep', header: 'Deposit', align: 'right', sortValue: (c) => c.terms.depositAmount, render: (c) => (c.terms.depositRequired ? formatCompactINR(c.terms.depositAmount) : <span className="g2-muted">—</span>) },
    { key: 'usage', header: 'Usage', render: (c) => <span className="g2-small" style={{ whiteSpace: 'nowrap' }}>{flows.filter((f) => f.stages.some((s) => s.channelId === c.id)).length} flows · {partnerCount(c.id)} partners</span> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => <span className="g2-row" style={{ gap: 4, flexWrap: 'nowrap' }}><StatusBadge status={c.status} /><Badge tone="purple" title="Configuration version">v{c.version}</Badge></span> },
    {
      key: 'actions', header: '', className: 'actions', render: (c) => (
        <span onClick={(e) => e.stopPropagation()}>
          <IconButton label="Configuration history" onClick={() => setHistory(c)}><History size={15} /></IconButton>
          {can.manageConfig && <IconButton label="Edit channel" onClick={() => { action.setErrors([]); setForm({ open: true, editing: c }); }}><Edit3 size={15} /></IconButton>}
        </span>
      ),
    },
  ];

  const submit = async (input: ChannelInput, note: string) => {
    const editing = form.editing;
    const r = editing
      ? await action.run(() => channelService.update(editing.id, input, note, actor), (res) => (res.versioned ? `Saved as version v${res.channel.version}.` : 'Channel updated.'))
      : await action.run(() => channelService.create(input, actor), 'Sales channel created.');
    if (r) setForm({ open: false, editing: null });
  };

  if (channelsQ.error) return <ErrorState message={channelsQ.error} onRetry={channelsQ.refetch} />;

  return (
    <div className="g2-stack">
      <PageHeader
        title="Sales Channel Configuration"
        description="Define distribution channels and their default commercial terms. Channels are configuration — add any channel your business needs."
        actions={can.manageConfig ? <Button variant="primary" icon={<Plus size={15} />} onClick={() => { action.setErrors([]); setForm({ open: true, editing: null }); }}>Create channel</Button> : <span className="g2-row g2-small g2-muted"><Lock size={13} /> Read-only</span>}
      />
      <Alert tone="info" icon={<Info size={15} />}>
        Default terms flow automatically into partner assignments (lowest precedence after relationship, partner and territory terms).
        Changes are versioned with effective dates, so active relationships and historical transactions keep the terms that applied at the time.
      </Alert>
      <Card flush>
        <div className="g2-filterbar" style={{ paddingTop: 4 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search channels…" />
          <Select value={status} onChange={setStatus} placeholder="All statuses" options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} aria-label="Status filter" />
          <Select value={role} onChange={setRole} placeholder="All roles" options={[{ value: 'end', label: 'End customer' }, { value: 'mid', label: 'Intermediate' }]} aria-label="Role filter" />
          <span className="g2-spacer" />
          <span className="g2-small g2-muted">{rows.length} of {channels.length} channels</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          loading={channelsQ.loading}
          initialSort={{ key: 'tier', dir: 'asc' }}
          onRowClick={can.manageConfig ? (c) => { action.setErrors([]); setForm({ open: true, editing: c }); } : (c) => setHistory(c)}
          emptyTitle={channels.length ? 'No channels match your filters' : 'No sales channels yet'}
        />
      </Card>

      <ChannelFormModal
        open={form.open}
        editing={form.editing}
        channels={channels}
        pending={action.pending}
        serverErrors={action.errors}
        onClose={() => setForm({ open: false, editing: null })}
        onSubmit={submit}
      />
      <ChannelHistoryModal channel={history} onClose={() => setHistory(null)} />
    </div>
  );
};

export default SalesChannelsPage;
