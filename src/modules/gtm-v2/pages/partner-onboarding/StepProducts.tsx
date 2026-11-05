import React, { useMemo } from 'react';
import { Info, Package } from 'lucide-react';
import { Alert, Badge } from '../../components/ui';
import { ProductScopePicker } from '../../components/domain/ProductScopePicker';
import { applicableFlows } from '../../utils/flow';
import { partnerChannelId } from '../../utils/eligibility';
import { useProductMaster } from '../../hooks/useProductMaster';
import type { StepProps } from './stepProps';
import { emptyScope } from './wizardModel';

/**
 * Products step — based on the partner's territories (and channel), show only the portfolios /
 * categories / products that active sales policies actually sell there, then let the user pick.
 */
export const StepProducts: React.FC<StepProps> = ({ state, update, data, config, showErrors }) => {
  const pm = useProductMaster();
  const channelId = partnerChannelId(state.input, config.partnerTypes);
  const flows = useMemo(
    () => applicableFlows(data.flows, data.zones, data.territories, state.input.territoryIds, channelId, config.eligibility.territoryMatchMode),
    [data.flows, data.zones, data.territories, state.input.territoryIds, channelId, config.eligibility.territoryMatchMode],
  );
  const available = useMemo(() => {
    const ids = new Set<string>();
    flows.forEach((f) => pm.productsInScope(f.productScope).forEach((p) => ids.add(p.id)));
    return ids;
  }, [flows, pm]);

  const scope = state.input.productScope ?? emptyScope();
  const restricted = available.size > 0;
  const portfolios = pm.portfolios
    .map((pf) => ({ pf, count: pm.products.filter((p) => p.portfolioId === pf.id && (!restricted || available.has(p.id))).length }))
    .filter((x) => x.count > 0);
  const selectedCount = pm.productsInScope(scope).filter((p) => !restricted || available.has(p.id)).length;

  const setScope = (v: typeof scope) => update((s) => ({ ...s, input: { ...s.input, productScope: v } }));
  const togglePortfolio = (id: string) => {
    const on = scope.portfolioIds.includes(id);
    setScope({ ...scope, allProducts: false, portfolioIds: on ? scope.portfolioIds.filter((x) => x !== id) : [...scope.portfolioIds, id] });
  };

  return (
    <div className="g2-stack">
      {restricted ? (
        <Alert tone="info" icon={<Info size={16} />}>
          Showing what <strong>{flows.length}</strong> active sales policy{flows.length > 1 ? 's sell' : ' sells'} in the selected territories
          {channelId ? <> through the <strong>{data.channels.find((c) => c.id === channelId)?.name}</strong> channel</> : null}:
          {' '}<strong>{available.size}</strong> product{available.size > 1 ? 's' : ''} across <strong>{portfolios.length}</strong> portfolio{portfolios.length > 1 ? 's' : ''}.
          Your selection drives the sales policies suggested in the next step.
        </Alert>
      ) : (
        <Alert tone="warn" icon={<Info size={16} />}>
          No active sales policy covers these territories for this partner type yet, so the full Product Master is shown. You can still record the products — flows can be mapped later.
        </Alert>
      )}
      {showErrors && selectedCount === 0 && <Alert tone="error">Select at least one portfolio, category or product.</Alert>}

      <div>
        <div className="g2-label" style={{ marginBottom: 6 }}>Available portfolios <span className="g2-muted" style={{ fontWeight: 400 }}>— click to select a whole portfolio</span></div>
        <div className="g2-channel-grid">
          {portfolios.map(({ pf, count }) => {
            const on = scope.portfolioIds.includes(pf.id);
            return (
              <button key={pf.id} type="button" className={`g2-channel-pick ${on ? 'on' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => togglePortfolio(pf.id)}>
                <div className="g2-row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                  <span className="g2-channel-pick-icon" style={{ background: 'var(--g2-primary-50)', color: 'var(--g2-primary)' }}><Package size={16} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="g2-strong g2-ellipsis">{pf.name}</div>
                    <div className="g2-cell-sub">{pf.code} · {count} product{count > 1 ? 's' : ''}{restricted ? ' available' : ''}</div>
                  </div>
                  {on && <Badge tone="purple">Selected</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="g2-label" style={{ marginBottom: 6 }}>Or drill down to categories, sub-categories and products</div>
        <ProductScopePicker value={scope} onChange={setScope} availableProductIds={restricted ? available : undefined} maxHeight={340} />
      </div>
    </div>
  );
};
