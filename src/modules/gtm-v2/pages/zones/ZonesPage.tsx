import React, { useMemo, useState } from 'react';
import { Edit3, Lock, Plus, Power } from 'lucide-react';
import { useConfig, useFlows, useTerritories, useZones } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { zoneService } from '../../services';
import type { ZoneInput } from '../../services';
import type { Zone } from '../../types';
import { collapseSelection } from '../../utils/territory';
import { formatDate, includesText } from '../../utils/format';
import { Button, Card, ConfirmDialog, DataTable, ErrorState, Highlight, IconButton, PageHeader, SearchInput, Select, StatusBadge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { ZoneFormModal } from './ZoneFormModal';

const ZonesPage: React.FC = () => {
  const zonesQ = useZones();
  const { data: territories = [] } = useTerritories();
  const { data: flows = [] } = useFlows();
  const { data: config } = useConfig();
  const { actor, can } = useGtmAuth();
  const action = useAction();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<{ open: boolean; editing: Zone | null }>({ open: false, editing: null });
  const [toggle, setToggle] = useState<Zone | null>(null);

  const zones = useMemo(() => zonesQ.data ?? [], [zonesQ.data]);
  const tName = (id: string) => territories.find((t) => t.id === id)?.name ?? id;

  const rows = useMemo(() => zones.filter((z) =>
    (!status || z.status === status)
    && (includesText([z.name, z.code, z.description], q) || z.territoryIds.some((t) => includesText([tName(t)], q)))), [zones, q, status, territories]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<Zone>[] = [
    { key: 'name', header: 'Zone', sortValue: (z) => z.name, render: (z) => <div><div className="g2-cell-main"><Highlight text={z.name} query={q} /></div><div className="g2-cell-sub">{z.description || '—'}</div></div> },
    { key: 'code', header: 'Code', sortValue: (z) => z.code, render: (z) => <span className="g2-mono">{z.code}</span> },
    { key: 'count', header: 'Territories', align: 'right', sortValue: (z) => z.territoryIds.length, render: (z) => <span className="g2-strong">{z.territoryIds.length}</span> },
    {
      key: 'terr', header: 'Coverage', render: (z) => {
        const top = collapseSelection(z.territoryIds, territories);
        return <div className="g2-row" style={{ gap: 4 }}>{top.slice(0, 4).map((id) => <span key={id} className="g2-chip">{tName(id)}</span>)}{top.length > 4 && <span className="g2-chip neutral">+{top.length - 4}</span>}</div>;
      },
    },
    { key: 'flows', header: 'Sales Policies', align: 'right', sortValue: (z) => flows.filter((f) => f.zoneIds.includes(z.id)).length, render: (z) => flows.filter((f) => f.zoneIds.includes(z.id)).length },
    { key: 'updated', header: 'Updated', sortValue: (z) => z.updatedAt, render: (z) => <span className="g2-small">{formatDate(z.updatedAt)}</span> },
    { key: 'status', header: 'Status', sortValue: (z) => z.status, render: (z) => <StatusBadge status={z.status} /> },
    {
      key: 'actions', header: '', className: 'actions', render: (z) => can.manageConfig ? (
        <span onClick={(e) => e.stopPropagation()}>
          <IconButton label="Edit zone" onClick={() => { action.setErrors([]); setForm({ open: true, editing: z }); }}><Edit3 size={15} /></IconButton>
          <IconButton label={z.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => setToggle(z)}><Power size={15} /></IconButton>
        </span>
      ) : null,
    },
  ];

  const submit = async (input: ZoneInput) => {
    const r = await action.run(() => (form.editing ? zoneService.update(form.editing.id, input, actor) : zoneService.create(input, actor)), form.editing ? 'Zone updated.' : 'Zone created.');
    if (r) setForm({ open: false, editing: null });
  };

  const doToggle = async () => {
    if (!toggle) return;
    const next = toggle.status === 'Active' ? 'Inactive' : 'Active';
    await action.run(() => zoneService.setStatus(toggle.id, next, actor), `Zone ${next === 'Active' ? 'activated' : 'deactivated'}.`);
    setToggle(null);
  };

  if (zonesQ.error) return <ErrorState message={zonesQ.error} onRetry={zonesQ.refetch} />;

  return (
    <div className="g2-stack">
      <PageHeader
        title="Zone Management"
        description="Configurable commercial zones built from any combination of territories. Zones can overlap."
        actions={can.manageConfig ? <Button variant="primary" icon={<Plus size={15} />} onClick={() => { action.setErrors([]); setForm({ open: true, editing: null }); }}>Create zone</Button> : <span className="g2-row g2-small g2-muted"><Lock size={13} /> Read-only</span>}
      />
      <Card flush>
        <div className="g2-filterbar" style={{ paddingTop: 4 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search zones or territories…" />
          <Select value={status} onChange={setStatus} placeholder="All statuses" options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} aria-label="Status filter" />
          <span className="g2-spacer" />
          <span className="g2-small g2-muted">{rows.length} of {zones.length} zones</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(z) => z.id}
          loading={zonesQ.loading}
          onRowClick={can.manageConfig ? (z) => { action.setErrors([]); setForm({ open: true, editing: z }); } : undefined}
          emptyTitle={zones.length ? 'No zones match your filters' : 'No zones yet'}
          emptyDescription={zones.length ? undefined : 'Create a zone to group territories for sales policies and reporting.'}
        />
      </Card>

      {config && (
        <ZoneFormModal
          open={form.open}
          editing={form.editing}
          zones={zones}
          territories={territories}
          levelLabels={config.territoryRules.levelLabels}
          pending={action.pending}
          serverErrors={action.errors}
          onClose={() => setForm({ open: false, editing: null })}
          onSubmit={submit}
        />
      )}
      <ConfirmDialog
        open={!!toggle}
        loading={action.pending}
        tone={toggle?.status === 'Active' ? 'danger' : 'primary'}
        title={toggle?.status === 'Active' ? `Deactivate ${toggle?.name}?` : `Activate ${toggle?.name}?`}
        confirmLabel={toggle?.status === 'Active' ? 'Deactivate' : 'Activate'}
        message={toggle?.status === 'Active'
          ? 'Inactive zones cannot be selected in new sales policies. Zones used by active sales policies cannot be deactivated.'
          : 'The zone becomes available for sales policies and reports again.'}
        onCancel={() => setToggle(null)}
        onConfirm={doToggle}
      />
    </div>
  );
};

export default ZonesPage;
