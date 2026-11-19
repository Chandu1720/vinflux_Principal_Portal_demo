import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, GitFork, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { useProductMaster } from '../../hooks/useProductMaster';
import { flowService } from '../../services';
import type { FlowStatus, SalesFlow } from '../../types';
import { ROUTES } from '../../constants/navigation';
import { flowCoverage } from '../../utils/flow';
import { expandWithDescendants } from '../../utils/territory';
import { formatDate, includesText } from '../../utils/format';
import {
  Button, Card, ConfirmDialog, DataTable, ErrorState, IconButton, KpiCard, LoadingState, PageHeader, SearchableSelect, SearchInput, Select, StatusBadge,
} from '../../components/ui';
import type { Column } from '../../components/ui';

type Pending = { kind: 'delete' | 'status'; flow: SalesFlow; status?: FlowStatus } | null;

const FlowListPage: React.FC = () => {
  const navigate = useNavigate();
  const data = useGtmBundle();
  const pm = useProductMaster();
  const { actor, can } = useGtmAuth();
  const { run, pending } = useAction();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);

  const { flows, channels, territories, zones, mappings } = data;

  const terrName = (id: string) => territories.find((t) => t.id === id)?.name ?? id;
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;

  const rows = useMemo(() => {
    return flows.filter((f) => {
      if (status && f.status !== status) return false;
      if (channelId && !f.stages.some((s) => s.channelId === channelId)) return false;
      if (territoryId) {
        const cov = expandWithDescendants(flowCoverage(f, zones), territories);
        if (!cov.has(territoryId)) return false;
      }
      return includesText([f.name, f.code, f.description], q);
    });
  }, [flows, status, channelId, territoryId, q, zones, territories]);

  const mapCount = (id: string) => mappings.filter((m) => m.flowId === id).length;

  const doConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'delete') await run(() => flowService.remove(confirm.flow.id), `Flow "${confirm.flow.name}" deleted.`);
    else await run(() => flowService.setStatus(confirm.flow.id, confirm.status!, actor), `Flow "${confirm.flow.name}" is now ${confirm.status}.`);
    setConfirm(null);
  };

  const columns: Column<SalesFlow>[] = [
    {
      key: 'name', header: 'Flow', sortValue: (f) => f.name,
      render: (f) => (
        <div>
          <div className="g2-cell-main">{f.name}</div>
          <div className="g2-cell-sub"><span className="g2-mono">{f.code}</span> · v{f.version}</div>
        </div>
      ),
    },
    { key: 'chain', header: 'Channels', render: (f) => {
      const ch = f.stages.filter((s) => s.kind === 'CHANNEL').map((s) => channels.find((c) => c.id === s.channelId)).filter(Boolean) as typeof channels;
      const through = ch.filter((c) => !c.canBeEndpoint).map((c) => c.name);
      const to = ch.filter((c) => c.canBeEndpoint).map((c) => c.name);
      return <div style={{ maxWidth: 360 }}><div className="g2-small"><span className="g2-muted">Through:</span> {through.join(', ') || 'Direct'}</div><div className="g2-small"><span className="g2-muted">To:</span> {to.join(', ') || '—'}</div></div>;
    } },
    {
      key: 'coverage', header: 'Coverage',
      render: (f) => {
        const parts = [...f.territoryIds.map(terrName), ...f.zoneIds.map((z) => `${zoneName(z)} (zone)`)];
        return <div style={{ maxWidth: 220 }} className="g2-small">{parts.length ? parts.join(', ') : <span className="g2-muted">Not assigned</span>}</div>;
      },
    },
    { key: 'products', header: 'Products', render: (f) => <span className="g2-small">{pm.describeScope(f.productScope)}</span> },
    { key: 'eff', header: 'Effective', sortValue: (f) => f.effectiveFrom, render: (f) => <span className="g2-small">{formatDate(f.effectiveFrom)} – {f.effectiveTo ? formatDate(f.effectiveTo) : 'Open'}</span> },
    { key: 'rel', header: 'Partners', align: 'right', sortValue: (f) => mapCount(f.id), render: (f) => mapCount(f.id) },
    { key: 'status', header: 'Status', sortValue: (f) => f.status, render: (f) => <StatusBadge status={f.status} /> },
    {
      key: 'actions', header: '', className: 'actions',
      render: (f) => (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 2 }}>
          <IconButton label={can.manageConfig ? 'Edit in builder' : 'View'} onClick={() => navigate(ROUTES.flowEdit(f.id))}><Pencil size={15} /></IconButton>
          {can.manageConfig && <>
            <IconButton label="Duplicate" onClick={() => run(() => flowService.duplicate(f.id, actor), (c) => `Duplicated as "${c.name}".`)}><Copy size={15} /></IconButton>
            <IconButton label={f.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => setConfirm({ kind: 'status', flow: f, status: f.status === 'Active' ? 'Inactive' : 'Active' })}><Power size={15} /></IconButton>
            <IconButton label="Delete" onClick={() => setConfirm({ kind: 'delete', flow: f })}><Trash2 size={15} /></IconButton>
          </>}
        </div>
      ),
    },
  ];

  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error} />;

  const active = flows.filter((f) => f.status === 'Active');
  const direct = flows.filter((f) => f.stages.length <= 2).length;

  return (
    <>
      <PageHeader
        title="Sales Policies"
        description="What can be sold, where, and through which channels to which end customers. Each partner's actual route is built during onboarding."
        actions={can.manageConfig && <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(ROUTES.flowNew)}>New flow</Button>}
      />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Total flows" value={flows.length} icon={<GitFork size={20} />} color="#6d28d9" bg="#f5f3ff" />
        <KpiCard label="Active" value={active.length} icon={<Power size={20} />} color="#059669" bg="#ecfdf5" />
        <KpiCard label="Direct flows" value={direct} icon={<GitFork size={20} />} color="#2563eb" bg="#eff6ff" foot="Warehouse → customer" />
        <KpiCard label="Partner relationships" value={mappings.length} icon={<GitFork size={20} />} color="#d97706" bg="#fffbeb" />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search flows…" width={260} />
          <Select value={status} onChange={setStatus} placeholder="All statuses" options={['Active', 'Draft', 'Inactive'].map((s) => ({ value: s, label: s }))} />
          <div style={{ minWidth: 190 }}>
            <SearchableSelect value={channelId} onChange={setChannelId} clearable placeholder="Any channel" options={channels.map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <div style={{ minWidth: 210 }}>
            <SearchableSelect value={territoryId} onChange={setTerritoryId} clearable placeholder="Any territory" options={territories.map((t) => ({ value: t.id, label: t.name, description: t.code }))} />
          </div>
          <span className="g2-spacer" />
          <span className="g2-muted g2-small">{rows.length} of {flows.length} flows</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(f) => f.id}
          onRowClick={(f) => navigate(ROUTES.flowEdit(f.id))}
          emptyTitle="No flows match"
          emptyDescription="Adjust filters or create a new distribution flow."
          emptyAction={can.manageConfig ? <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate(ROUTES.flowNew)}>New flow</Button> : undefined}
        />
      </Card>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'delete' ? 'Delete flow?' : `${confirm?.status === 'Active' ? 'Activate' : 'Deactivate'} flow?`}
        message={confirm?.kind === 'delete'
          ? <>Delete <strong>{confirm.flow.name}</strong>? Flows referenced by partner relationships cannot be deleted — deactivate them instead.</>
          : <>Set <strong>{confirm?.flow.name}</strong> to <strong>{confirm?.status}</strong>. Activation re-validates stages, coverage and products.</>}
        tone={confirm?.kind === 'delete' || confirm?.status === 'Inactive' ? 'danger' : 'primary'}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Confirm'}
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={doConfirm}
      />
    </>
  );
};

export default FlowListPage;
