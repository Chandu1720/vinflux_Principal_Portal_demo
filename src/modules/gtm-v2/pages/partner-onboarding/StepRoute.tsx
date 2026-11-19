import React, { useMemo, useState } from 'react';
import { Building2, GitFork, Pencil, Route, Users } from 'lucide-react';
import type { CustomerLink, OnboardingFlowSelection, SalesFlow, SupplierLink } from '../../types';
import { Alert, Badge, Checkbox, EmptyState } from '../../components/ui';
import { stageVisual } from '../../components/domain/FlowDiagram';
import { applicableFlows } from '../../utils/flow';
import { linksCompat, newSupplier } from '../../utils/supply';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { useProductMaster, useWarehouses } from '../../hooks/useProductMaster';
import type { StepProps } from './stepProps';
import { emptyScope } from './wizardModel';
import { QuickFlowEditDrawer } from './QuickFlowEditDrawer';
import { InstitutionDrawer } from './InstitutionDrawer';
import { SupplyLinksEditor } from './SupplyLinksEditor';
import { shortFormTypeIds } from '../../utils/eligibility';
import { tradeStatusOf } from '../../utils/health';

/**
 * Partner type + route builder + actual partner mapping on ONE screen.
 * Sales policies only say which channels may resell / buy which products where;
 * the partner's real route (who it buys from, who it sells to) is built here.
 */
export const StepRoute: React.FC<StepProps> = ({ state, update, data, config, showErrors }) => {
  const pm = useProductMaster();
  const warehouses = useWarehouses();
  const [quickEdit, setQuickEdit] = useState<{ channelId: string | null; flowIds?: string[] } | null>(null);
  const [addInst, setAddInst] = useState<{ flowId: string; channelId: string; partnerTypeId: string } | null>(null);
  const { principal } = useGtmAuth();

  const instTypeIds = shortFormTypeIds(config);
  const partnerProducts = useMemo(() => new Set(pm.productsInScope(state.input.productScope ?? emptyScope()).map((p) => p.id)), [pm, state.input.productScope]);
  const productMatch = (f: SalesFlow) => pm.productsInScope(f.productScope).filter((p) => partnerProducts.has(p.id)).length;

  // Sales policies that sell the partner's products in its territories (any channel)
  const areaPolicies = useMemo(() => applicableFlows(data.flows, data.zones, data.territories, state.input.territoryIds, null, config.eligibility.territoryMatchMode)
    .filter((f) => partnerProducts.size === 0 || pm.productsInScope(f.productScope).some((p) => partnerProducts.has(p.id))),
  [data.flows, data.zones, data.territories, state.input.territoryIds, config.eligibility.territoryMatchMode, partnerProducts, pm]);
  const supported = new Set(areaPolicies.flatMap((f) => f.stages.map((s) => s.channelId).filter(Boolean) as string[]));

  const types = config.partnerTypes.filter((t) => t.status === 'Active' && !instTypeIds.includes(t.id));
  const type = config.partnerTypes.find((t) => t.id === state.input.partnerTypeId);
  const channelId = type?.channelId ?? null;
  const policies = areaPolicies.filter((f) => f.stages.some((s) => s.channelId === channelId))
    .map((f) => ({ f, match: productMatch(f) })).sort((a, b) => b.match - a.match);
  const sels = state.extras.flowSelections;  

  const chooseType = (id: string) => update((s) => (s.input.partnerTypeId === id ? s : {
    ...s, input: { ...s.input, partnerTypeId: id }, extras: { ...s.extras, flowSelections: [], commercialOverride: null },
  }));

  const partnerPortfolios = useMemo(() => {
    const ids = new Set(pm.productsInScope(state.input.productScope ?? emptyScope()).map((p) => p.portfolioId));
    return pm.portfolios.filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
  }, [pm, state.input.productScope]);

  const setLinks = (policy: SalesFlow, next: { suppliers: SupplierLink[]; customers: CustomerLink[] }) => update((s) => ({
    ...s,
    extras: {
      ...s.extras,
      flowSelections: s.extras.flowSelections.map((x) => (x.flowId === policy.id ? { ...x, ...next, route: undefined, ...linksCompat(next.suppliers, next.customers, policy, channelId) } : x)),
    },
  }));

  const togglePolicy = (f: SalesFlow, on: boolean) => update((s) => {
    if (!on) return { ...s, extras: { ...s.extras, flowSelections: s.extras.flowSelections.filter((x) => x.flowId !== f.id) } };
    const suppliers = [newSupplier(f)];
    const sel: OnboardingFlowSelection = { flowId: f.id, suppliers, customers: [], ...linksCompat(suppliers, [], f, channelId), skippedStageIds: [], overrideReason: '' };
    return { ...s, extras: { ...s.extras, flowSelections: [...s.extras.flowSelections, sel] } };
  });

  if (!state.input.territoryIds.length) return <Alert tone="warn">Select territories first (step 2).</Alert>;

  return (
    <div className="g2-stack">
      <Alert tone="info" icon={<Route size={16} />}>
        Choose the partner type, then record <strong>its own neighbours</strong>: whom it buys from (one level up) and whom it sells to (one level down). The rest of the chain comes from those partners' own setup.
        Only channels allowed by the sales policies for the selected territories and products can be used.
      </Alert>

      {/* 1. Partner type */}
      <section>
        <div className="g2-label" style={{ marginBottom: 6 }}>1. Partner type</div>
        {showErrors && !type && <div className="g2-error-text" style={{ marginBottom: 6 }}>Select a partner type.</div>}
        <div className="g2-channel-grid">
          {types.map((t) => {
            const ch = data.channels.find((c) => c.id === t.channelId);
            const ok = supported.has(t.channelId);
            const on = t.id === state.input.partnerTypeId;
            const v = stageVisual({ id: t.id, kind: 'CHANNEL', channelId: t.channelId, label: '', allowMultiplePartners: true }, ch);
            return (
              <div key={t.id} className={`g2-channel-pick ${on ? 'on' : ''}`} style={{ opacity: ok || on ? 1 : 0.6 }}>
                <label className="g2-row" style={{ gap: 10, flexWrap: 'nowrap', cursor: ok ? 'pointer' : 'not-allowed' }}>
                  <input type="radio" name="partner-type" checked={on} disabled={!ok && !on} onChange={() => chooseType(t.id)} style={{ accentColor: 'var(--g2-primary)' }} />
                  <span className="g2-channel-pick-icon" style={{ background: v.bg, color: v.c }}><v.Icon size={16} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="g2-strong g2-ellipsis" style={{ display: 'block' }}>{t.name}</span>
                    <span className="g2-cell-sub">{ok ? `Channel: ${ch?.name ?? '—'}` : 'Not in a sales policy here'}</span>
                  </span>
                </label>
                {!ok && areaPolicies.length > 0 && (
                  <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" style={{ marginTop: 6, marginLeft: 22 }} onClick={() => setQuickEdit({ channelId: t.channelId })}>
                    <Pencil size={12} /> Edit sales policy
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {areaPolicies.length === 0 && (
          <div style={{ marginTop: 8 }}><Alert tone="warn">No active sales policy sells the selected products in these territories. Create one under Sales Policies, or change territories / products.</Alert></div>
        )}
        <div className="g2-small g2-muted" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={13} /> Hospitals and institutions are added with the shorter institution form (Partners → Add institution, or inside the route).
        </div>
      </section>

      {/* 2. Sales policies & route builder */}
      {type && (
        <section className="g2-stack">
          <div className="g2-label">2. Sales policy &amp; route</div>
          {policies.length === 0 && <EmptyState icon={<GitFork size={24} />} title="No sales policy includes this partner type" description="Use “Edit sales policy” on the partner type to add its channel." />}
          {policies.map(({ f, match }, i) => {
            const sel = sels.find((x) => x.flowId === f.id);
            return (
              <div key={f.id} className="g2-card" style={{ borderColor: sel ? 'var(--g2-primary-200)' : undefined }}>
                <div className="g2-card-body">
                  <div className="g2-row">
                    <Checkbox checked={!!sel} onChange={(on) => togglePolicy(f, on)} label={<span><span className="g2-strong">{f.name}</span> <span className="g2-muted g2-small">{f.code}</span></span>} />
                    <span className="g2-spacer" />
                    {i === 0 && match > 0 && <Badge tone="green" dot>Best match</Badge>}
                    {partnerProducts.size > 0 && <Badge tone="blue">Sells {match} of your {partnerProducts.size} products</Badge>}
                    <Badge tone="purple">{pm.describeScope(f.productScope)}</Badge>
                  </div>
                  {!sel && <div className="g2-small g2-muted" style={{ marginLeft: 24 }}>Tick to build this partner's route under this policy.</div>}
                  {sel && (
                    <div style={{ marginTop: 12 }}>
                      <SupplyLinksEditor
                        policy={f}
                        suppliers={sel.suppliers ?? []}
                        customers={sel.customers ?? []}
                        onChange={(n) => setLinks(f, n)}
                        tradeOf={(p) => tradeStatusOf(p, config, data)}
                        selfChannelId={channelId}
                        partnerTypeName={type.name}
                        partnerPortfolios={partnerPortfolios}
                        channels={data.channels}
                        partners={data.partners}
                        territories={data.territories}
                        warehouses={warehouses}
                        mappings={data.mappings}
                        flows={data.flows}
                        config={config}
                        territoryIds={state.input.territoryIds}
                        excludePartnerId={state.id ?? undefined}
                        principalName={principal.name}
                        onEditPolicy={(cid) => setQuickEdit({ channelId: cid, flowIds: [f.id] })}
                        onAddInstitution={(cid, partnerTypeId) => setAddInst({ flowId: f.id, channelId: cid, partnerTypeId })}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {sels.length === 0 && policies.length > 0 && <div className="g2-small g2-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Users size={13} /> Select at least one sales policy to build the route (or continue and map later).</div>}
        </section>
      )}

      {quickEdit && data.config && (
        <QuickFlowEditDrawer open flows={quickEdit.flowIds ? areaPolicies.filter((f) => quickEdit.flowIds!.includes(f.id)) : areaPolicies}
          channels={data.channels} mappings={data.mappings} rules={data.config.flowRules}
          neededChannelId={quickEdit.channelId} onClose={() => setQuickEdit(null)} />
      )}
      {addInst && (
        <InstitutionDrawer open config={config} territories={data.territories} defaultPartnerTypeId={addInst.partnerTypeId} defaultTerritoryIds={state.input.territoryIds}
          onClose={() => setAddInst(null)}
          onCreated={(p) => {
            if (p.status !== 'Active') return;
            const sel = sels.find((x) => x.flowId === addInst.flowId);
            const policy = data.flows.find((x) => x.id === addInst.flowId);
            if (!sel || !policy) return;
            const customers = (sel.customers ?? []).map((c) => (c.channelId === addInst.channelId ? { ...c, partnerIds: [...c.partnerIds, p.id] } : c));
            setLinks(policy, { suppliers: sel.suppliers ?? [], customers });
          }} />
      )}
    </div>
  );
};
