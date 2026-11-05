import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, GitBranch, History, Info, Lock, MapPin, Package, Save, Settings2, Users } from 'lucide-react';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useAction } from '../../hooks/useAction';
import { useWarehouses } from '../../hooks/useProductMaster';
import { flowService } from '../../services';
import type { FlowInput } from '../../services';
import type { FlowStage, SalesFlow } from '../../types';
import FlowListPage from './FlowListPage';
import { ROUTES } from '../../constants/navigation';
import { flowCoverage, validateFlowStages } from '../../utils/flow';
import { expandWithDescendants, territoriesOverlap } from '../../utils/territory';
import { formatDate, formatDateTime, todayISO, uid } from '../../utils/format';
import {
  Alert, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorList, ErrorState, Field, FormGrid, Input, LoadingState,
  Modal, Select, StatusBadge, Textarea,
} from '../../components/ui';
import { CoverageSection } from './CoverageSection';
import { ProductScopePicker } from '../../components/domain/ProductScopePicker';
import { FlowChain } from '../../components/domain/FlowDiagram';
import { ChannelPathSelector } from './ChannelPathSelector';

const sourceStage = (): FlowStage => ({ id: uid('stg'), kind: 'SOURCE', warehouseId: null, channelId: null, label: 'Company Warehouse', allowMultiplePartners: false });

const blankFlow = (code: string): FlowInput => ({
  code, name: '', description: '', status: 'Draft', effectiveFrom: todayISO(), effectiveTo: null,
  stages: [sourceStage()], territoryIds: [], zoneIds: [],
  productScope: { allProducts: false, portfolioIds: [], categoryIds: [], subCategoryIds: [], productIds: [] },
});

const toInput = (f: SalesFlow): FlowInput => ({
  code: f.code, name: f.name, description: f.description, status: f.status, effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo,
  stages: structuredClone(f.stages), territoryIds: [...f.territoryIds], zoneIds: [...f.zoneIds], productScope: structuredClone(f.productScope),
});

const FlowBuilderPage: React.FC = () => {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const data = useGtmBundle();
  const warehouses = useWarehouses();
  const { actor, can } = useGtmAuth();
  const { run, pending, errors } = useAction();
  const readOnly = !can.manageConfig;

  const existing = flowId ? data.flows.find((f) => f.id === flowId) : undefined;
  const [form, setForm] = useState<FlowInput | null>(null);
  const [baseline, setBaseline] = useState('');
  const [note, setNote] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Initialise form once data is available (and whenever the route changes)
  useEffect(() => {
    if (data.loading) return;
    const key = flowId ?? 'new';
    if (loadedFor === key) return;
    let init: FlowInput | null = null;
    if (flowId) {
      if (!existing) return;
      init = toInput(existing);
    } else {
      let n = data.flows.length + 1;
      let code = `SF-${String(n).padStart(3, '0')}`;
      while (data.flows.some((f) => f.code === code)) code = `SF-${String(++n).padStart(3, '0')}`;
      init = blankFlow(code);
    }
    setForm(init);
    setBaseline(JSON.stringify(init));
    setNote('');
    setLoadedFor(key);
  }, [data.loading, data.flows, existing, flowId, loadedFor]);

  const dirty = !!form && JSON.stringify(form) !== baseline;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const rules = data.config?.flowRules;
  const issues = useMemo(() => (form && rules ? validateFlowStages(form.stages, data.channels, rules) : []), [form, rules, data.channels]);

  const coverageIds = useMemo(() => (form ? flowCoverage(form, data.zones) : []), [form, data.zones]);
  const resolvedCoverage = useMemo(() => expandWithDescendants(coverageIds, data.territories).size, [coverageIds, data.territories]);
  const overlapping = useMemo(() => (form ? data.flows.filter((f) => f.id !== flowId && f.status === 'Active'
    && territoriesOverlap(flowCoverage(f, data.zones), coverageIds, data.territories, 'hierarchy')) : []), [form, data.flows, data.zones, data.territories, coverageIds, flowId]);
  const flowMappings = useMemo(() => data.mappings.filter((m) => flowId && m.flowId === flowId), [data.mappings, flowId]);

  /** The builder opens as a wide side drawer over the flow list. */
  const shell = (body: React.ReactNode) => (
    <>
      <FlowListPage />
      <Modal open size="xl" title={existing ? existing.name : 'Sales policy'} onClose={() => navigate(ROUTES.flows)}>{body}</Modal>
    </>
  );
  if (data.loading || (!form && (!flowId || existing))) return shell(<LoadingState label="Loading flow builder…" />);
  if (data.error) return shell(<ErrorState message={data.error} />);
  if (flowId && !existing) {
    return shell(<EmptyState title="Sales policy not found" description="It may have been deleted." action={<Button onClick={() => navigate(ROUTES.flows)}>Back to sales policies</Button>} />);
  }
  if (!form || !rules) return shell(<LoadingState />);

  const set = <K extends keyof FlowInput>(k: K, v: FlowInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setStages = (stages: FlowStage[]) => set('stages', stages);
  const occupiedStageIds = new Set(flowMappings.filter((m) => m.status === 'Active').map((m) => m.ownStageId));

  const structuralChange = !!existing && JSON.stringify([existing.stages, existing.territoryIds, existing.zoneIds, existing.productScope])
    !== JSON.stringify([form.stages, form.territoryIds, form.zoneIds, form.productScope]);
  const needsNote = structuralChange && flowMappings.length > 0;

  const save = async () => {
    if (needsNote && !note.trim()) { void run(() => Promise.reject(new Error('A change note is required because partner relationships exist on this flow.'))); return; }
    if (existing) {
      const r = await run(() => flowService.update(existing.id, form, note, actor), (x) => (x.versioned ? `Saved as version ${x.flow.version}.` : 'Flow saved.'));
      if (r) { setBaseline(JSON.stringify(form)); setNote(''); }
    } else {
      const r = await run(() => flowService.create(form, actor), (f) => `Flow "${f.name}" created.`);
      if (r) { setBaseline(JSON.stringify(form)); navigate(ROUTES.flowEdit(r.id), { replace: true }); }
    }
  };

  const partnerName = (id: string) => data.partners.find((p) => p.id === id)?.name ?? id;

  const close = () => (dirty ? setLeaveOpen(true) : navigate(ROUTES.flows));

  return (
    <>
      <FlowListPage />
      <Modal
        open
        size="xl"
        onClose={close}
        title={existing ? existing.name : 'New sales policy'}
        subtitle={existing ? <span className="g2-row" style={{ gap: 8 }}><span className="g2-mono">{existing.code}</span> · Version {existing.version} · <StatusBadge status={existing.status} /> {dirty && <Badge tone="amber">Unsaved changes</Badge>}</span> : 'Define what can be sold, where, and through which channels. Partner routes are built during onboarding.'}
        footer={<>
          <Button icon={<ArrowLeft size={15} />} onClick={close}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && <Button variant="primary" icon={<Save size={15} />} loading={pending} disabled={!dirty && !!existing} onClick={save}>{existing ? 'Save changes' : 'Create policy'}</Button>}
        </>}
      >

      {readOnly && <div style={{ marginBottom: 16 }}><Alert icon={<Lock size={15} />}>You have view-only access. Configuration rights are required to modify sales policies.</Alert></div>}
      {errors.length > 1 && <div style={{ marginBottom: 16 }}><ErrorList errors={errors} /></div>}

      <div className="g2-stack">
        <Card title={<span className="g2-row" style={{ gap: 8 }}><span className="g2-step-badge">1</span><Package size={16} color="#6d28d9" /> What to sell — products</span>} subtitle="Drill down Portfolio → Category → Sub-category → Product from the existing Product Master. Selecting a level covers everything under it.">
          <ProductScopePicker value={form.productScope} onChange={(v) => set('productScope', v)} disabled={readOnly} />
        </Card>
        <Card title={<span className="g2-row" style={{ gap: 8 }}><span className="g2-step-badge">2</span><MapPin size={16} color="#6d28d9" /> Where to sell — coverage</span>} subtitle="Choose zones first, then the territories in each zone">
          <div className="g2-stack" style={{ gap: 12 }}>
            <CoverageSection
              key={flowId ?? 'new'}
              zones={data.zones}
              territories={data.territories}
              levelLabels={data.config?.territoryRules.levelLabels ?? []}
              zoneIds={form.zoneIds}
              territoryIds={form.territoryIds}
              readOnly={readOnly}
              onChange={(c) => setForm((f) => (f ? { ...f, zoneIds: c.zoneIds, territoryIds: c.territoryIds } : f))}
            />
            <div className="g2-row g2-small"><Badge tone="purple">{resolvedCoverage}</Badge> territories covered (including descendants)</div>
            {overlapping.length > 0 && (
              <Alert icon={<Info size={15} />}>
                <strong>{overlapping.length} other active flow{overlapping.length > 1 ? 's' : ''} cover overlapping territories.</strong> This is allowed — partners pick the applicable flow during onboarding.
                <ul>{overlapping.map((f) => <li key={f.id}>{f.name} — <FlowChain stages={f.stages} channels={data.channels} /></li>)}</ul>
              </Alert>
            )}
          </div>
        </Card>
        <Card
          title={<span className="g2-row" style={{ gap: 8 }}><span className="g2-step-badge">3</span><GitBranch size={17} color="#6d28d9" /> How it sells — sales channels</span>}
          subtitle="Select which channels can resell (sells through) and which end customers can buy (sells to)."
        >
          <ChannelPathSelector
            stages={form.stages}
            channels={data.channels}
            warehouses={warehouses}
            issues={issues}
            occupiedStageIds={occupiedStageIds}
            readOnly={readOnly}
            onChange={setStages}
          />
        </Card>

        <Card title={<span className="g2-row" style={{ gap: 8 }}><span className="g2-step-badge">4</span><Settings2 size={16} color="#6d28d9" /> Policy details</span>} subtitle="Name, code, status and effective dates">
          <FormGrid cols={3}>
            <Field label="Flow name" required><Input value={form.name} disabled={readOnly} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Standard Multi-tier Hospital Flow" /></Field>
            <Field label="Flow code" required><Input value={form.code} disabled={readOnly} onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
            <Field label="Status" hint="Activation validates stages, coverage and products">
              <Select value={form.status} disabled={readOnly} onChange={(v) => set('status', v as FlowInput['status'])} options={['Draft', 'Active', 'Inactive'].map((s) => ({ value: s, label: s }))} />
            </Field>
            <Field label="Effective from" required><Input type="date" value={form.effectiveFrom} disabled={readOnly} onChange={(e) => set('effectiveFrom', e.target.value)} /></Field>
            <Field label="Effective to" hint="Leave empty for open-ended"><Input type="date" value={form.effectiveTo ?? ''} disabled={readOnly} onChange={(e) => set('effectiveTo', e.target.value || null)} /></Field>
            <Field label="Description"><Input value={form.description} disabled={readOnly} onChange={(e) => set('description', e.target.value)} placeholder="Short summary" /></Field>
          </FormGrid>
        </Card>

        {existing && (
          <div className="g2-grid g2-grid-2">
            <Card title={<span className="g2-row"><Users size={16} color="#6d28d9" /> Partner routes using this policy</span>} subtitle="Read-only. Actual partner mappings are managed through onboarding and never change this master.">
              {flowMappings.length === 0 ? <div className="g2-muted g2-small">No partners mapped yet.</div> : (
                <div>
                  {flowMappings.map((m) => {
                    const own = existing.stages.find((s) => s.id === m.ownStageId);
                    return (
                      <div key={m.id} className="g2-list-item" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="g2-cell-main">{partnerName(m.partnerId)} <span className="g2-muted g2-small">at {own?.label ?? 'removed stage'}</span></div>
                          <div className="g2-cell-sub">
                            {m.stageAssignments.length === 0 ? 'No linked partners' : m.stageAssignments.map((a) => `${existing.stages.find((s) => s.id === a.stageId)?.label ?? 'stage'}: ${a.partnerIds.map(partnerName).join(', ')}`).join(' · ')}
                          </div>
                        </div>
                        <div className="g2-row" style={{ gap: 4 }}>
                          {m.flowVersion !== existing.version && <Badge tone="amber" title="Mapped against an earlier flow version — review recommended">v{m.flowVersion}</Badge>}
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {needsNote && !readOnly && (
                <div style={{ marginTop: 12 }} className="g2-stack">
                  <Alert tone="warn" icon={<AlertTriangle size={15} />}>Structural changes create version {existing.version + 1}. Existing partner relationships stay on the version they were mapped to and will be flagged for review.</Alert>
                  <Field label="Change note" required><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this policy changing?" /></Field>
                </div>
              )}
            </Card>
            <Card title={<span className="g2-row"><History size={16} color="#6d28d9" /> Version history</span>} subtitle={`Created ${formatDate(existing.createdAt)} by ${existing.createdBy}`}>
              <ul className="g2-timeline">
                {existing.history.slice().reverse().map((h) => (
                  <li key={h.version}>
                    <span className="tdot" style={h.version === existing.version ? { background: 'var(--g2-primary)' } : undefined} />
                    <div className="g2-strong">v{h.version} · {h.note}</div>
                    <div className="g2-cell-sub">{formatDateTime(h.changedAt)} · {h.changedBy}</div>
                    {h.stageSummary && <div className="g2-small" style={{ marginTop: 2 }}>{h.stageSummary}</div>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
      </Modal>

      <ConfirmDialog open={leaveOpen} title="Discard unsaved changes?" message="Your changes to this flow will be lost." confirmLabel="Discard" tone="danger"
        onCancel={() => setLeaveOpen(false)} onConfirm={() => { setLeaveOpen(false); navigate(ROUTES.flows); }} />
    </>
  );
};

export default FlowBuilderPage;
