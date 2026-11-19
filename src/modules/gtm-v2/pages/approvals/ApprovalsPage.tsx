import React, { useMemo, useState } from 'react';
import { CheckCircle2, CheckSquare, Clock, Eye, ThumbsDown, ThumbsUp, UserCheck, XCircle } from 'lucide-react';
import type { ApprovalCategory, ApprovalRequest } from '../../types';
import { useApprovals, useConfig, usePartners } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { approvalService } from '../../services';
import {
  Badge, Button, Card, Checkbox, DataTable, ErrorState, IconButton, KpiCard, LoadingState, PageHeader, SearchInput, Select, StatusBadge, Tabs,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatDate, includesText } from '../../utils/format';
import { ApprovalDetailModal } from './ApprovalDetailModal';
import { DecisionModal } from './DecisionModal';

const ALL = 'ALL';

const ApprovalsPage: React.FC = () => {
  const approvalsQ = useApprovals();
  const configQ = useConfig();
  const partners = usePartners().data ?? [];
  const { can, actor, user, showToast } = useGtmAuth();
  const { run, pending } = useAction();

  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>('Pending');
  const [q, setQ] = useState('');
  const [view, setView] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<{ req: ApprovalRequest; mode: 'Approved' | 'Rejected' } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const approvals = useMemo(() => approvalsQ.data ?? [], [approvalsQ.data]);
  const workflows = useMemo(() => configQ.data?.approvalWorkflows ?? [], [configQ.data]);
  const catLabel = (c: ApprovalCategory) => workflows.find((w) => w.category === c)?.label ?? c;
  const partnerName = (id: string | null) => partners.find((p) => p.id === id)?.name ?? '—';
  const currentRole = (r: ApprovalRequest) => r.steps.find((s) => s.level === r.currentLevel)?.role ?? '—';

  const filtered = approvals.filter((a) =>
    (category === ALL || a.category === category)
    && (status === ALL || a.status === status)
    && includesText([a.requestNo, a.summary, a.requestedBy, partnerName(a.partnerId), catLabel(a.category)], q));

  const pendingAll = approvals.filter((a) => a.status === 'Pending');
  const myQueue = pendingAll.filter((a) => can.approve && (currentRole(a).toLowerCase() === user.role.toLowerCase() || can.manageConfig));

  const decide = async (req: ApprovalRequest, mode: 'Approved' | 'Rejected', comments: string) => {
    const r = await run(() => approvalService.act(req.id, mode, comments, actor));
    if (!r) return false;
    if (!r.final && 'nextRole' in r) showToast(`${req.requestNo} approved at level ${req.currentLevel}. Forwarded to ${r.nextRole}.`, 'info');
    else showToast(`${req.requestNo} ${r.status === 'Approved' ? 'fully approved' : 'rejected'}.`, r.status === 'Approved' ? 'success' : 'warning');
    setSelected((s) => { const x = new Set(s); x.delete(req.id); return x; });
    return true;
  };

  const bulkApprove = async () => {
    const reqs = approvals.filter((a) => selected.has(a.id) && a.status === 'Pending');
    let ok = 0;
    for (const req of reqs) {
      try { await approvalService.act(req.id, 'Approved', 'Bulk approved', actor); ok++; } catch { /* skipped */ }
    }
    showToast(`${ok} of ${reqs.length} request(s) approved at their current level.`, ok ? 'success' : 'warning');
    setSelected(new Set());
  };

  if (approvalsQ.error) return <ErrorState message={approvalsQ.error} onRetry={approvalsQ.refetch} />;
  if (approvalsQ.loading && !approvalsQ.data) return <LoadingState />;

  const selectablePending = filtered.filter((a) => a.status === 'Pending');
  const allChecked = selectablePending.length > 0 && selectablePending.every((a) => selected.has(a.id));

  const columns: Column<ApprovalRequest>[] = [
    ...(can.approve ? [{
      key: 'sel', header: <Checkbox checked={allChecked} onChange={(c) => setSelected(c ? new Set(selectablePending.map((a) => a.id)) : new Set())} />, width: 36,
      render: (r: ApprovalRequest) => r.status === 'Pending'
        ? <Checkbox checked={selected.has(r.id)} onChange={(c) => setSelected((s) => { const x = new Set(s); if (c) x.add(r.id); else x.delete(r.id); return x; })} />
        : null,
    }] : []),
    { key: 'no', header: 'Request ID', sortValue: (r) => r.requestNo, render: (r) => <span className="g2-mono g2-strong">{r.requestNo}</span> },
    { key: 'type', header: 'Request Type', sortValue: (r) => catLabel(r.category), render: (r) => <div><div className="g2-cell-main">{catLabel(r.category)}</div><div className="g2-cell-sub g2-ellipsis" style={{ maxWidth: 260 }}>{r.summary}</div></div> },
    { key: 'partner', header: 'Partner', sortValue: (r) => partnerName(r.partnerId), render: (r) => partnerName(r.partnerId) },
    { key: 'by', header: 'Requested By', sortValue: (r) => r.requestedBy, render: (r) => r.requestedBy },
    { key: 'date', header: 'Request Date', sortValue: (r) => r.requestedAt, render: (r) => formatDate(r.requestedAt) },
    { key: 'level', header: 'Current Level', render: (r) => r.status === 'Pending' ? <span className="g2-small">L{r.currentLevel}/{r.steps.length} · {currentRole(r)}</span> : <span className="g2-muted g2-small">Closed</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', className: 'actions', render: (r) => (
        <div className="g2-row" style={{ justifyContent: 'flex-end', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <IconButton label="View" onClick={() => setView(r)}><Eye size={16} /></IconButton>
          <IconButton label={can.approve ? 'Approve' : 'You do not have approval authority'} disabled={!can.approve || r.status !== 'Pending'} onClick={() => setDecision({ req: r, mode: 'Approved' })}><ThumbsUp size={16} color={can.approve && r.status === 'Pending' ? 'var(--g2-green)' : undefined} /></IconButton>
          <IconButton label={can.approve ? 'Reject' : 'You do not have approval authority'} disabled={!can.approve || r.status !== 'Pending'} onClick={() => setDecision({ req: r, mode: 'Rejected' })}><ThumbsDown size={16} color={can.approve && r.status === 'Pending' ? 'var(--g2-red)' : undefined} /></IconButton>
        </div>
      ),
    },
  ];

  const countFor = (c: string) => approvals.filter((a) => (c === ALL || a.category === c) && (status === ALL || a.status === status)).length;

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Governance queue for onboarding, KYC, commercial overrides, credit holds and hospital transfers. Multi-level workflows come from Configuration."
        actions={can.approve && selected.size > 0 ? <Button variant="success" icon={<CheckCircle2 size={15} />} loading={pending} onClick={bulkApprove}>Approve selected ({selected.size})</Button> : undefined}
      />
      {!can.approve && <div className="g2-alert g2-alert-warn" style={{ marginBottom: 16 }}>You can view requests but do not have approval authority (requires the “approve” permission from your VinFlux role).</div>}
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Pending" value={pendingAll.length} icon={<Clock size={22} />} color="#b45309" bg="#fffbeb" onClick={() => { setStatus('Pending'); setCategory(ALL); }} />
        <KpiCard label="Approved" value={approvals.filter((a) => a.status === 'Approved').length} icon={<CheckSquare size={22} />} color="#059669" bg="#ecfdf5" onClick={() => setStatus('Approved')} />
        <KpiCard label="Rejected" value={approvals.filter((a) => a.status === 'Rejected').length} icon={<XCircle size={22} />} color="#dc2626" bg="#fef2f2" onClick={() => setStatus('Rejected')} />
        <KpiCard label="My Queue" value={myQueue.length} icon={<UserCheck size={22} />} color="#6d28d9" bg="#f5f3ff" foot={can.approve ? 'Awaiting your action' : 'No approval authority'} onClick={() => setStatus('Pending')} />
      </div>
      <Card flush>
        <div style={{ padding: '0 18px' }}>
          <Tabs active={category} onChange={setCategory} tabs={[{ id: ALL, label: 'All', count: countFor(ALL) }, ...workflows.map((w) => ({ id: w.category, label: w.label, count: countFor(w.category) }))]} />
        </div>
        <div className="g2-filterbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search request, partner, requester…" />
          <Select value={status} onChange={setStatus} options={[{ value: ALL, label: 'All statuses' }, { value: 'Pending', label: 'Pending' }, { value: 'Approved', label: 'Approved' }, { value: 'Rejected', label: 'Rejected' }]} />
          {(q || category !== ALL || status !== 'Pending') && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setCategory(ALL); setStatus('Pending'); }}>Reset filters</Button>}
          <span className="g2-spacer" />
          <Badge tone="purple">{filtered.length} request(s)</Badge>
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} onRowClick={setView} initialSort={{ key: 'date', dir: 'desc' }}
          emptyTitle="No requests" emptyDescription="Nothing matches the current filters." />
      </Card>

      {view && (
        <ApprovalDetailModal
          req={approvals.find((a) => a.id === view.id) ?? view}
          categoryLabel={catLabel(view.category)}
          partner={partners.find((p) => p.id === view.partnerId) ?? null}
          config={configQ.data}
          canApprove={can.approve}
          onClose={() => setView(null)}
          onDecide={(mode) => { setDecision({ req: approvals.find((a) => a.id === view.id) ?? view, mode }); setView(null); }}
        />
      )}
      {decision && (
        <DecisionModal
          req={decision.req}
          mode={decision.mode}
          categoryLabel={catLabel(decision.req.category)}
          pending={pending}
          onCancel={() => setDecision(null)}
          onSubmit={async (c) => { if (await decide(decision.req, decision.mode, c)) setDecision(null); }}
        />
      )}
    </>
  );
};

export default ApprovalsPage;
