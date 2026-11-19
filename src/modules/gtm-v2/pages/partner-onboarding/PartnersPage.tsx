import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Eye, Pencil, FileEdit, PlayCircle, Trash2, UserPlus, Users } from 'lucide-react';
import { InstitutionDrawer } from './InstitutionDrawer';
import { PartnerTypeChooser } from './PartnerTypeChooser';
import { EditDetailsDrawer } from './EditDetailsDrawer';
import {
  Button, Card, ConfirmDialog, DataTable, ErrorState, IconButton, LoadingState, PageHeader, SearchInput, SearchableSelect, Select, StatusBadge,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { PartnerStatusBadge } from '../../components/domain/Badges';
import { CreditBar, TradeStatusBadge } from '../../components/domain/HealthBadges';
import { creditOf, tradeStatusOf } from '../../utils/health';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { partnerService } from '../../services';
import { ROUTES } from '../../constants/navigation';
import { collapseSelection, expandWithDescendants, scopeMatcher, territoryPath } from '../../utils/territory';
import { ScopeBanner } from '../../components/domain/ScopeBanner';
import { formatDate, includesText } from '../../utils/format';
import type { Partner } from '../../types';
import { PartnerDetailsModal } from './PartnerDetailsModal';

type Pending = { kind: 'suspend' | 'reactivate' | 'delete'; partner: Partner } | null;

const PartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const data = useGtmBundle();
  const { actor, can, territoryScope } = useGtmAuth();
  const { run, pending } = useAction();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [typeId, setTypeId] = useState('');
  const [kyc, setKyc] = useState('');
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [health, setHealth] = useState(params.get('health') ?? '');
  const [confirm, setConfirm] = useState<Pending>(null);
  const [addInst, setAddInst] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [choose, setChoose] = useState(params.get('new') === '1');
  const focusId = params.get('focus');
  const focusTab = params.get('tab') ?? undefined;

  const config = data.config;
  const typeName = (id: string) => config?.partnerTypes.find((t) => t.id === id)?.name ?? '—';
  const channelName = (typeIdArg: string) => data.channels.find((c) => c.id === config?.partnerTypes.find((t) => t.id === typeIdArg)?.channelId)?.name ?? '—';
  const terrName = (id: string) => data.territories.find((t) => t.id === id)?.name ?? id;

  const healthKey = (p: Partner) => {
    if (!config || p.status !== 'Active') return 'na';
    const t = tradeStatusOf(p, config, data);
    return !t.canTrade ? 'blocked' : t.tone === 'amber' ? 'attention' : 'ready';
  };

  const inScope = useMemo(() => scopeMatcher(territoryScope, data.territories), [territoryScope, data.territories]);
  const visible = useMemo(() => data.partners.filter((p) => inScope(p.territoryIds)), [data.partners, inScope]);
  const filtered = useMemo(() => {
    const scope = territoryId ? expandWithDescendants([territoryId], data.territories) : null;
    return visible.filter((p) => includesText([p.name, p.code, p.businessName, p.contactPerson, p.email], q)
      && (!status || p.status === status)
      && (!typeId || p.partnerTypeId === typeId)
      && (!kyc || p.kycStatus === kyc)
      && (!scope || p.territoryIds.some((t) => scope.has(t)))
      && (!health || !config || healthKey(p) === health));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, data.territories, data.terms, data.channels, config, q, status, typeId, kyc, territoryId, health]);

  if (data.error) return <ErrorState message={data.error} />;
  if (data.loading || !config) return <LoadingState label="Loading partners…" />;

  const counts = config.partnerStatuses.map((s) => ({ ...s, n: visible.filter((p) => p.status === s.key).length }));
  const focus = focusId ? data.partners.find((p) => p.id === focusId) ?? null : null;
  const closeChooser = () => { setChoose(false); if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); } };
  const closeFocus = () => { params.delete('focus'); params.delete('tab'); setParams(params, { replace: true }); };
  const open = (p: Partner) => { params.set('focus', p.id); setParams(params, { replace: true }); };

  const doConfirm = async () => {
    if (!confirm) return;
    const { kind, partner } = confirm;
    const r = kind === 'delete'
      ? await run(() => partnerService.removeDraft(partner.id), 'Draft deleted.')
      : await run(() => partnerService.setStatus(partner.id, kind === 'suspend' ? 'Suspended' : 'Active', actor), kind === 'suspend' ? `${partner.name} suspended.` : `${partner.name} reactivated.`);
    if (r !== undefined) { setConfirm(null); if (kind === 'delete' && focusId === partner.id) closeFocus(); }
  };

  const rowActions = (p: Partner) => (
    <>
      <IconButton label="View details" onClick={(e) => { e.stopPropagation(); open(p); }}><Eye size={15} /></IconButton>
      {['Active', 'Suspended', 'Approval Pending'].includes(p.status) && <IconButton label="Edit details" onClick={(e) => { e.stopPropagation(); setEditing(p); }}><Pencil size={15} /></IconButton>}
      {(p.status === 'Draft' || p.status === 'KYC Pending') && <IconButton label={p.status === 'Draft' ? 'Continue onboarding' : 'Complete KYC'} onClick={(e) => { e.stopPropagation(); navigate(ROUTES.onboardEdit(p.id)); }}><FileEdit size={15} /></IconButton>}
      {p.status === 'Active' && can.manageConfig && <IconButton label="Suspend" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'suspend', partner: p }); }}><Ban size={15} /></IconButton>}
      {p.status === 'Suspended' && can.manageConfig && <IconButton label="Reactivate" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'reactivate', partner: p }); }}><PlayCircle size={15} /></IconButton>}
      {p.status === 'Draft' && <IconButton label="Delete draft" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'delete', partner: p }); }}><Trash2 size={15} /></IconButton>}
    </>
  );

  const columns: Column<Partner>[] = [
    { key: 'name', header: 'Partner', sortValue: (p) => p.name, render: (p) => <><div className="g2-cell-main">{p.name}</div><div className="g2-cell-sub">{p.code} · {p.contactPerson}</div></> },
    { key: 'type', header: 'Type', sortValue: (p) => typeName(p.partnerTypeId), render: (p) => <>{typeName(p.partnerTypeId)}<div className="g2-cell-sub">{channelName(p.partnerTypeId)}</div></> },
    { key: 'trade', header: 'Trade status', sortValue: (p) => healthKey(p), render: (p) => (p.status === 'Active' ? <TradeStatusBadge status={tradeStatusOf(p, config, data)} /> : <span className="g2-muted">—</span>) },
    { key: 'credit', header: 'Credit used', sortValue: (p) => creditOf(p, config, data).utilPct, render: (p) => <div style={{ minWidth: 110 }}><CreditBar credit={creditOf(p, config, data)} /></div> },
    { key: 'terr', header: 'Territories', render: (p) => {
      const top = collapseSelection(p.territoryIds, data.territories);
      return <span title={top.map((t) => territoryPath(t, data.territories)).join('\n')}>{top.slice(0, 2).map(terrName).join(', ')}{top.length > 2 ? ` +${top.length - 2}` : ''}{!top.length && <span className="g2-muted">—</span>}</span>;
    } },
    { key: 'kyc', header: 'KYC', sortValue: (p) => p.kycStatus, render: (p) => <StatusBadge status={p.kycStatus} /> },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <PartnerStatusBadge status={p.status} config={config} /> },
    { key: 'submitted', header: 'Submitted', sortValue: (p) => p.submittedAt ?? '', render: (p) => formatDate(p.submittedAt) },
    { key: 'actions', header: '', className: 'actions', render: rowActions },
  ];

  const confirmText = confirm && {
    suspend: { t: `Suspend ${confirm.partner.name}?`, m: 'The partner will be blocked from trading and its supply links deactivated. Sales policies are not affected.', l: 'Suspend', tone: 'danger' as const },
    reactivate: { t: `Reactivate ${confirm.partner.name}?`, m: 'The partner and its supply links become active again.', l: 'Reactivate', tone: 'primary' as const },
    delete: { t: `Delete draft ${confirm.partner.name}?`, m: 'The draft onboarding will be permanently removed.', l: 'Delete', tone: 'danger' as const },
  }[confirm.kind];

  return (
    <>
      <PageHeader
        title="Partners"
        description="Partner register: onboarding pipeline, trade status (licences + credit) and portal access in one place."
        actions={<Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setChoose(true)}>Onboard partner</Button>}
      />
      <ScopeBanner scope={territoryScope} territories={data.territories} hidden={data.partners.length - visible.length} />
      <div className="g2-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 16 }}>
        {counts.map((c) => (
          <button key={c.key} type="button" className="g2-card" onClick={() => setStatus(status === c.key ? '' : c.key)}
            style={{ padding: 14, textAlign: 'left', cursor: 'pointer', borderColor: status === c.key ? 'var(--g2-primary)' : undefined }}>
            <PartnerStatusBadge status={c.key} config={config} />
            <div className="g2-kpi-value" style={{ fontSize: 22, marginTop: 6 }}>{c.n}</div>
          </button>
        ))}
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, code, contact…" />
          <Select value={status} placeholder="All statuses" options={config.partnerStatuses.map((s) => ({ value: s.key, label: s.label }))} onChange={setStatus} />
          <Select value={typeId} placeholder="All partner types" options={config.partnerTypes.map((t) => ({ value: t.id, label: t.name }))} onChange={setTypeId} />
          <Select value={health} placeholder="Any trade status" options={[{ value: 'ready', label: 'Ready to trade' }, { value: 'attention', label: 'Needs attention' }, { value: 'blocked', label: 'Blocked' }]} onChange={setHealth} />
          <Select value={kyc} placeholder="All KYC" options={['Pending', 'Under Review', 'Verified', 'Rejected'].map((k) => ({ value: k, label: `KYC: ${k}` }))} onChange={setKyc} />
          <div style={{ width: 240 }}>
            <SearchableSelect value={territoryId} clearable placeholder="Territory (incl. children)" onChange={setTerritoryId}
              options={data.territories.map((t) => ({ value: t.id, label: t.name, description: territoryPath(t.id, data.territories) }))} />
          </div>
          {(q || status || typeId || kyc || territoryId || health) && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setStatus(''); setTypeId(''); setKyc(''); setTerritoryId(null); setHealth(''); }}>Reset</Button>}
          <span className="g2-spacer" />
          <span className="g2-small g2-muted">{filtered.length} of {visible.length}</span>
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={(p) => p.id} onRowClick={open}
          emptyTitle={data.partners.length ? 'No partners match the filters' : 'No partners yet'}
          emptyDescription={data.partners.length ? 'Adjust the filters or search.' : 'Start by onboarding your first partner.'}
          emptyAction={!data.partners.length ? <Button variant="primary" icon={<Users size={15} />} onClick={() => setChoose(true)}>Onboard partner</Button> : undefined}
          initialSort={{ key: 'submitted', dir: 'desc' }} />
      </Card>

      {focus && <PartnerDetailsModal key={focus.id} partner={focus} data={data} initialTab={focusTab} onClose={closeFocus} footer={<div className="g2-row">{rowActions(focus)}</div>} />}
      {confirm && confirmText && (
        <ConfirmDialog open title={confirmText.t} message={confirmText.m} confirmLabel={confirmText.l} tone={confirmText.tone} loading={pending} onCancel={() => setConfirm(null)} onConfirm={doConfirm} />
      )}
      {editing && config && <EditDetailsDrawer partner={editing} config={config} onClose={() => setEditing(null)} />}
      {choose && config && (
        <PartnerTypeChooser config={config} channels={data.channels} onClose={closeChooser}
          onPick={(typeId, form) => { closeChooser(); if (form === 'short') setAddInst(typeId); else navigate(`${ROUTES.onboard}?type=${typeId}`); }} />
      )}
      {addInst && data.config && (
        <InstitutionDrawer open config={data.config} territories={data.territories} defaultPartnerTypeId={addInst} onClose={() => setAddInst(null)}
          onCreated={(p) => navigate(`${ROUTES.partners}?focus=${p.id}`)} />
      )}
    </>
  );
};

export default PartnersPage;
