import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, MinusCircle } from 'lucide-react';
import { Field, FormGrid, Input, NumberInput, SearchableSelect } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useChannels, useConfig, usePartners, useTerms, useTerritories } from '../gtm-v2/hooks/useGtmData';
import { resolveTerms } from '../gtm-v2/utils/commercial';
import { partnerChannelId } from '../gtm-v2/utils/eligibility';
import { getAncestorIds } from '../gtm-v2/utils/territory';
import { tradeStatusOf } from '../gtm-v2/utils/health';
import { Alert } from '../../platform/ui';
import { quote, subscribePricing, today } from './pricingStore';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "What price will this customer pay?" — the same lookup Orders will use, with every step shown. */
export const PriceCheckTab: React.FC = () => {
  useSubscribe(subscribePricing);
  const { products, activePrincipal } = useApp();
  const partners = usePartners().data ?? [];
  const channels = useChannels().data ?? [];
  const territories = useTerritories().data ?? [];
  const terms = useTerms().data ?? [];
  const config = useConfig().data;
  const [partnerId, setPartnerId] = useState<string>('ptr-hosp-hyd');
  // (default customer exists only in the medical demo; other workspaces pick one)
  const [productId, setProductId] = useState<string>('PRD-EVOCON-001');
  const [qty, setQty] = useState<number>(12);
  const [on, setOn] = useState(today());
  const partner = partners.find((p) => p.id === partnerId);

  const result = useMemo(() => {
    if (!partner || !config || !productId) return null;
    const channelId = partnerChannelId(partner, config.partnerTypes);
    const channel = channels.find((c) => c.id === channelId);
    const r = channel ? resolveTerms({ channel, partnerId: partner.id, territoryIds: partner.territoryIds, records: terms, territories, onDate: on }) : null;
    const tset = new Set<string>(partner.territoryIds.flatMap((t) => [t, ...getAncestorIds(t, territories)]));
    return quote({
      principalId: activePrincipal.id, partnerId: partner.id, channelId, partnerTerritoryIds: tset, productId, qty: qty || 1, on,
      discountPct: r?.standardDiscountPct.value ?? 0, discountSource: r ? r.standardDiscountPct.label : 'no terms',
    }, products);
  }, [partner, config, channels, terms, territories, productId, qty, on, activePrincipal.id, products]);

  const icon = (s: string) => (s === 'used' ? <CheckCircle2 size={16} color="#059669" /> : s === 'skipped' ? <MinusCircle size={16} color="#94a3b8" /> : <CircleDashed size={16} color="#cbd5e1" />);
  return (
    <div style={{ padding: 16 }} className="g2-stack">
      <FormGrid cols={3}>
        <Field label="Customer / partner"><SearchableSelect value={partnerId} options={partners.filter((p) => p.status === 'Active').map((p) => ({ value: p.id, label: p.name, description: config?.partnerTypes.find((t) => t.id === p.partnerTypeId)?.name }))} onChange={(v) => setPartnerId(v ?? '')} /></Field>
        <Field label="Product"><SearchableSelect value={productId} options={products.filter((p) => p.principalId === activePrincipal.id).map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setProductId(v ?? '')} /></Field>
        <FormGrid>
          <Field label="Quantity"><NumberInput value={qty} onChange={(v) => setQty(v ?? 1)} /></Field>
          <Field label="Order date"><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        </FormGrid>
      </FormGrid>
      {partner && config && (() => {
        const ts = tradeStatusOf(partner, config, { channels, terms, territories });
        return !ts.canTrade ? <Alert tone="error">{partner.name} can’t trade: {ts.reasons.filter((r) => r.tone === 'red' || r.tone === 'slate').map((r) => r.text).join('; ')}. Orders will be blocked until this is fixed.</Alert> : null;
      })()}
      {result && (
        <div className="g2-grid g2-grid-2" style={{ alignItems: 'start' }}>
          <div className="g2-card" style={{ padding: 16 }}>
            <div className="g2-label" style={{ marginBottom: 8 }}>How the price was found</div>
            {result.steps.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', opacity: s.state === 'none' ? 0.6 : 1 }}>
                <span style={{ flex: 'none', marginTop: 1 }}>{icon(s.state)}</span>
                <div style={{ minWidth: 0 }}><div className="g2-strong" style={{ fontSize: 13 }}>{s.label}</div><div className="g2-small g2-muted">{s.state === 'skipped' ? `${s.detail} — not used, a higher rule won` : s.detail}</div></div>
              </div>
            ))}
          </div>
          <div className="g2-card" style={{ padding: 16 }}>
            <div className="g2-label" style={{ marginBottom: 8 }}>Price for this order</div>
            {result.unitPrice === null ? <div className="g2-muted">No price list covers this customer and product on {on}. Orders would be blocked until a price is approved.</div> : (
              <dl className="g2-dl">
                <dt>List price</dt><dd>{inr(result.basePrice!)}{result.slab ? ` → slab ${inr(result.unitPrice)}` : ''}</dd>
                <dt>Invoice discount</dt><dd>{result.discountPct}%</dd>
                {result.schemeDiscountPct > 0 && <><dt>Scheme discount</dt><dd>{result.schemeDiscountPct}%</dd></>}
                <dt>Net unit price</dt><dd className="g2-strong">{inr(result.netUnit!)}</dd>
                <dt>Taxable ({qty} units)</dt><dd>{inr(result.taxable)}</dd>
                <dt>GST {result.gstPct}%</dt><dd>{inr(result.gst)}</dd>
                <dt>Invoice total</dt><dd className="g2-strong" style={{ fontSize: 16 }}>{inr(result.total)}</dd>
                {result.freeQty > 0 && <><dt>Free goods</dt><dd>{result.freeQty} unit(s) at no charge</dd></>}
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
