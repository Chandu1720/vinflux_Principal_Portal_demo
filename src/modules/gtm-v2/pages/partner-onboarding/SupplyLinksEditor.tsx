import React, { useMemo } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpLeft, CheckCircle2, ChevronRight, FileText, Lock, Pencil, Plus, Trash2, UserRound, Warehouse as WarehouseIcon } from 'lucide-react';
import type {
  CustomerLink, GtmConfiguration, Partner, PartnerFlowMapping, SalesChannel, SalesFlow, SupplierLink, Territory,
} from '../../types';
import type { Warehouse } from '../../../../types/warehouse.ts';
import type { TradeStatus } from '../../utils/health';
import { Alert, Badge, Button, Checkbox, Field, MultiSelect, SearchableSelect, Segmented } from '../../components/ui';
import { stageVisual } from '../../components/domain/FlowDiagram';
import { PartnerStatusBadge } from '../../components/domain/Badges';
import { evaluateStageEligibility, shortFormTypeIds } from '../../utils/eligibility';
import {
  derivedUpstream, downstreamChannels, newSupplier, poTarget, tradeModelOf, upstreamChannels, validateLinks,
} from '../../utils/supply';

type Portfolio = { id: string; name: string };

/**
 * Neighbours-only route editor for ONE partner within one sales policy.
 * The partner records only whom it buys from (one level up) and whom it sells to (one level down).
 * Everything above its suppliers is derived from the suppliers' own records and shown read-only.
 */
export const SupplyLinksEditor: React.FC<{
  policy: SalesFlow;
  suppliers: SupplierLink[];
  customers: CustomerLink[];
  onChange: (next: { suppliers: SupplierLink[]; customers: CustomerLink[] }) => void;
  selfChannelId: string | null;
  partnerTypeName: string;
  partnerPortfolios: Portfolio[];
  channels: SalesChannel[];
  partners: Partner[];
  territories: Territory[];
  warehouses: Warehouse[];
  mappings: PartnerFlowMapping[];
  flows: SalesFlow[];
  config: GtmConfiguration;
  territoryIds: string[];
  excludePartnerId?: string;
  principalName: string;
  onEditPolicy: (channelId: string | null) => void;
  onAddInstitution: (channelId: string, partnerTypeId: string) => void;
  /** Trade status of a candidate supplier (licence / credit) — shown as a warning, not a block. */
  tradeOf?: (p: Partner) => TradeStatus;
}> = (props) => {
  const { policy, suppliers, customers, onChange, selfChannelId, partnerTypeName, partnerPortfolios, channels, partners, territories, warehouses, mappings, flows, config, territoryIds, excludePartnerId, principalName, onEditPolicy, onAddInstitution, tradeOf } = props;
  const up = upstreamChannels(policy, selfChannelId, channels);
  const down = downstreamChannels(policy, selfChannelId, channels);
  const issues = useMemo(() => validateLinks(suppliers, customers, policy, selfChannelId, channels, partnerPortfolios.map((p) => p.id), config.flowRules.blockedConnections),
    [suppliers, customers, policy, selfChannelId, channels, partnerPortfolios, config.flowRules.blockedConnections]);
  const instTypeIds = shortFormTypeIds(config);
  const selfChannel = channels.find((c) => c.id === selfChannelId);
  const portfolioName = (id: string) => partnerPortfolios.find((p) => p.id === id)?.name ?? id;

  const setSup = (id: string, patch: Partial<SupplierLink>) => onChange({ suppliers: suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)), customers });
  const addSup = () => onChange({ suppliers: [...suppliers, newSupplier(policy, suppliers.some((s) => s.role === 'PRIMARY') ? 'BACKUP' : 'PRIMARY')], customers });
  const removeSup = (id: string) => onChange({ suppliers: suppliers.filter((s) => s.id !== id), customers });
  const setCust = (channelId: string, ids: string[] | null) => onChange({
    suppliers, customers: [...customers.filter((c) => c.channelId !== channelId), ...(ids ? [{ channelId, partnerIds: ids }] : [])],
  });

  const eligibleFor = (ch: SalesChannel) => {
    const candidates = partners.filter((p) => config.partnerTypes.find((t) => t.id === p.partnerTypeId)?.channelId === ch.id);
    const stage = { id: ch.id, kind: 'CHANNEL' as const, channelId: ch.id, label: ch.name, allowMultiplePartners: true };
    return evaluateStageEligibility(stage, candidates, territoryIds, config.partnerTypes, territories, config.eligibility, excludePartnerId, ch.canBeEndpoint)
      .sort((a, b) => Number(b.eligible) - Number(a.eligible));
  };

  // Derived (read-only) chain above the PRIMARY supplier
  const primary = suppliers.find((s) => s.role === 'PRIMARY') ?? suppliers[0];
  const inherited = primary?.kind === 'PARTNER' ? derivedUpstream(primary.partnerId, mappings, flows, partners, config.partnerTypes, channels, warehouses, policy.id) : [];
  const supplierOwner = primary?.kind === 'PARTNER' ? partners.find((p) => p.id === primary.partnerId)?.name : null;

  const visual = (ch: SalesChannel | undefined, company: boolean) => (company
    ? stageVisual({ id: 'x', kind: 'SOURCE', label: '', allowMultiplePartners: false }, undefined)
    : stageVisual({ id: 'x', kind: 'CHANNEL', channelId: ch?.id ?? null, label: '', allowMultiplePartners: true }, ch));

  const miniNode = (key: string, title: string, sub: string, v: ReturnType<typeof visual>, opts: { dim?: boolean; self?: boolean; badge?: React.ReactNode } = {}) => (
    <div key={key} className={`g2-flow-node ${opts.self ? 'g2-route-self' : ''} ${opts.dim ? 'g2-route-inherited' : ''}`} style={{ minWidth: 140 }}>
      <div className="g2-flow-node-icon" style={{ background: opts.self ? 'var(--g2-primary)' : v.bg, color: opts.self ? '#fff' : v.c }}>
        {opts.self ? <UserRound size={18} /> : <v.Icon size={18} />}
      </div>
      <div className="g2-flow-node-title">{title}</div>
      <div className="g2-flow-node-sub g2-ellipsis" style={{ maxWidth: 160 }}>{sub}</div>
      {opts.badge}
    </div>
  );
  const arrow = (k: string) => <div key={k} className="g2-flow-arrow"><ChevronRight size={16} /></div>;

  const supplierNodes = suppliers.map((s) => {
    const ch = channels.find((c) => c.id === s.channelId);
    const p = partners.find((x) => x.id === s.partnerId);
    const wh = warehouses.find((w) => w.id === s.warehouseId);
    return miniNode(s.id, s.kind === 'COMPANY' ? 'Company Warehouse' : ch?.name ?? 'Supplier', s.kind === 'COMPANY' ? wh?.name ?? 'Any warehouse' : p?.name ?? 'Not selected',
      visual(ch, s.kind === 'COMPANY'), { badge: <div className="g2-row" style={{ gap: 4, justifyContent: 'center' }}><Badge tone={s.role === 'PRIMARY' ? 'purple' : 'slate'}>{s.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge>{s.portfolioIds.length > 0 && <Badge tone="blue">{s.portfolioIds.length} portfolio{s.portfolioIds.length > 1 ? 's' : ''}</Badge>}</div> });
  });
  const customerNodes = customers.map((c) => {
    const ch = channels.find((x) => x.id === c.channelId);
    const names = c.partnerIds.map((id) => partners.find((p) => p.id === id)?.name ?? id);
    return miniNode(`c-${c.channelId}`, ch?.name ?? 'Customer', names.length ? `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}` : 'Customers to be mapped', visual(ch, false));
  });

  // PO summary per supplier link
  const poRows = suppliers.map((s) => ({ s, t: poTarget(s, channels, partners, warehouses, principalName) }));

  return (
    <div className="g2-stack" style={{ gap: 14 }}>
      {/* Visual: derived chain (read-only) → suppliers → this partner → customers */}
      <div style={{ background: '#fafbfd', border: '1px solid var(--g2-border)', borderRadius: 12 }}>
        <div className="g2-flow">
          {inherited.map((n, i) => (
            <React.Fragment key={`inh-${i}`}>
              {i > 0 && arrow(`ia-${i}`)}
              {miniNode(`inh-n-${i}`, n.label, n.sub, visual(channels.find((c) => c.id === n.channelId), n.company), { dim: true })}
            </React.Fragment>
          ))}
          {inherited.length > 0 && arrow('ia-last')}
          {supplierNodes.length ? (supplierNodes.length === 1 ? supplierNodes[0] : <div className="g2-flow-stack">{supplierNodes}</div>) : miniNode('nosup', 'Supplier', 'Add below', visual(undefined, false), { dim: true })}
          {arrow('a-self')}
          {miniNode('self', 'This partner', partnerTypeName, visual(selfChannel, false), { self: true })}
          {customerNodes.length > 0 && arrow('a-cust')}
          {customerNodes.length > 1 ? <div className="g2-flow-stack">{customerNodes}</div> : customerNodes}
        </div>
      </div>
      {inherited.length > 0 && (
        <div className="g2-small g2-muted" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: -6 }}>
          <Lock size={12} /> Greyed stages come from <strong>{supplierOwner}</strong>'s own setup and can't be changed here.
        </div>
      )}

      <div className="g2-grid g2-grid-2" style={{ alignItems: 'start' }}>
        {/* Buys from */}
        <div className="g2-form-section">
          <div className="g2-form-section-head">
            <ArrowUpLeft size={16} color="#6d28d9" />
            <div><div className="g2-form-section-title">Buys from</div><div className="g2-form-section-desc">One level up only · add more suppliers for other portfolios or as backup</div></div>
          </div>
          <div className="g2-stack" style={{ gap: 10 }}>
            {suppliers.map((s, i) => {
              const ch = channels.find((c) => c.id === s.channelId);
              const t = poTarget(s, channels, partners, warehouses, principalName);
              const checks = ch ? eligibleFor(ch) : [];
              return (
                <div key={s.id} className="g2-supplier-card">
                  <div className="g2-row" style={{ marginBottom: 8 }}>
                    <strong className="g2-small">Supplier {i + 1}</strong>
                    <span className="g2-spacer" />
                    <Segmented value={s.role} onChange={(v) => setSup(s.id, { role: v as SupplierLink['role'] })} options={[{ id: 'PRIMARY', label: 'Primary' }, { id: 'BACKUP', label: 'Backup' }]} />
                    <button type="button" className="g2-icon-btn" title="Remove supplier" onClick={() => removeSup(s.id)}><Trash2 size={14} /></button>
                  </div>
                  <div className="g2-stack" style={{ gap: 8 }}>
                    <Field label="Buys from" hint={<button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" style={{ height: 22, padding: '0 4px' }} onClick={() => onEditPolicy(null)}><Pencil size={11} /> Supplier type not available? Edit sales policy</button>}>
                      <SearchableSelect value={s.kind === 'COMPANY' ? '__company' : s.channelId}
                        onChange={(v) => setSup(s.id, v === '__company' || !v
                          ? { kind: 'COMPANY', channelId: null, partnerId: null, warehouseId: policy.stages.find((x) => x.kind === 'SOURCE')?.warehouseId ?? null }
                          : { kind: 'PARTNER', channelId: v, partnerId: null, warehouseId: null })}
                        options={[
                          { value: '__company', label: `${principalName} (direct)`, description: 'Buys directly from the company warehouse' },
                          ...channels.filter((c) => c.status === 'Active' && !c.canBeEndpoint && c.id !== selfChannelId).map((c) => ({
                            value: c.id, label: c.name, disabled: !up.some((u) => u.id === c.id),
                            description: up.some((u) => u.id === c.id) ? (tradeModelOf(c) === 'AGENT' ? 'Agent — dispatches company stock' : 'Buys & resells') : 'Not allowed by this sales policy',
                          })),
                        ]} />
                    </Field>
                    {s.kind === 'COMPANY' ? (
                      <Field label="Ships from warehouse">
                        <SearchableSelect value={s.warehouseId} clearable placeholder="Any active warehouse" onChange={(v) => setSup(s.id, { warehouseId: v })}
                          options={warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: w.name, description: `${w.code} · ${w.city}` }))} />
                      </Field>
                    ) : ch && (
                      <Field label={`${ch.name} partner`} required>
                        <SearchableSelect value={s.partnerId} invalid={!s.partnerId} placeholder={checks.length ? `Select ${ch.name}…` : `No ${ch.name} partners yet`}
                          onChange={(v) => setSup(s.id, { partnerId: v })}
                          options={checks.map((c) => {
                            const ts = tradeOf?.(c.partner);
                            const health = ts && ts.tone !== 'green' ? ` · ${ts.canTrade ? '' : '⚠ '}${ts.label}` : '';
                            return { value: c.partner.id, label: c.partner.name, disabled: !c.eligible, description: c.eligible ? `${c.partner.code} · Eligible${health}` : c.reasons.join(', ') };
                          })} />
                        {(() => {
                          const sp = partners.find((x) => x.id === s.partnerId);
                          const ts = sp && tradeOf?.(sp);
                          return ts && !ts.canTrade ? <div className="g2-po-line" style={{ color: '#b45309' }}>⚠ {sp.name} is currently blocked ({ts.reasons[0]?.text}). Add a backup supplier.</div> : null;
                        })()}
                      </Field>
                    )}
                    <Field label="Portfolios from this supplier" hint="Leave empty for all of the partner's products">
                      <MultiSelect values={s.portfolioIds} placeholder="All products" onChange={(v) => setSup(s.id, { portfolioIds: v })}
                        options={partnerPortfolios.map((p) => ({ value: p.id, label: p.name }))} />
                    </Field>
                    <div className="g2-po-line"><FileText size={13} /> PO goes to <strong>{t.poTo}</strong> · ships from {t.shipsFrom}</div>
                  </div>
                </div>
              );
            })}
            <div><Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={addSup}>Add supplier</Button></div>
          </div>
        </div>

        {/* Sells to */}
        <div className="g2-form-section">
          <div className="g2-form-section-head">
            <ArrowDownRight size={16} color="#6d28d9" />
            <div><div className="g2-form-section-title">Sells to</div><div className="g2-form-section-desc">Direct customers only (one level down)</div></div>
          </div>
          {down.length === 0 && <div className="g2-small g2-muted">{selfChannel?.canBeEndpoint ? 'This partner is an end customer.' : 'This sales policy has no customer channels below this partner type.'}</div>}
          {down.map((ch) => {
            const sel = customers.find((c) => c.channelId === ch.id);
            const checks = sel ? eligibleFor(ch) : [];
            const instType = config.partnerTypes.find((t) => t.channelId === ch.id && instTypeIds.includes(t.id));
            return (
              <div key={ch.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--g2-border)' }}>
                <Checkbox checked={!!sel} onChange={(v) => setCust(ch.id, v ? [] : null)} label={<span className="g2-strong">{ch.name}{ch.canBeEndpoint && <span className="g2-muted g2-small"> · end customer</span>}</span>} />
                {sel && (
                  <div className="g2-stack" style={{ gap: 4, marginTop: 6, paddingLeft: 24 }}>
                    {checks.length === 0 && <div className="g2-small g2-muted">No {ch.name} partners yet — map later{instType ? ' or add one below' : ''}.</div>}
                    {checks.map((c) => (
                      <div key={c.partner.id} className="g2-row" style={{ padding: '4px 8px', borderRadius: 8, background: sel.partnerIds.includes(c.partner.id) ? 'var(--g2-primary-50)' : undefined, opacity: c.eligible ? 1 : 0.55, flexWrap: 'nowrap' }}>
                        <Checkbox checked={sel.partnerIds.includes(c.partner.id)} disabled={!c.eligible && !sel.partnerIds.includes(c.partner.id)}
                          onChange={(on) => setCust(ch.id, on ? [...sel.partnerIds, c.partner.id] : sel.partnerIds.filter((x) => x !== c.partner.id))}
                          label={<span><span className="g2-strong">{c.partner.name}</span> <span className="g2-muted g2-small">{c.partner.code}</span></span>} />
                        <span className="g2-spacer" />
                        <PartnerStatusBadge status={c.partner.status} config={config} />
                        {!c.eligible && <Badge tone="red" title={c.reasons.join(', ')}>{c.reasons[0]}</Badge>}
                      </div>
                    ))}
                    {instType && <div><Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={() => onAddInstitution(ch.id, instType.id)}>Add hospital / institution</Button></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Who receives this partner's POs */}
      {poRows.length > 0 && (
        <div className="g2-form-section">
          <div className="g2-form-section-head"><FileText size={16} color="#6d28d9" /><div><div className="g2-form-section-title">Purchase orders</div><div className="g2-form-section-desc">PO goes to the nearest upstream party that owns the stock. Agents (e.g. C&amp;F) only dispatch — their POs go to the company.</div></div></div>
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>Products</th><th>Role</th><th>PO goes to</th><th>Ships from</th><th>Why</th></tr></thead>
              <tbody>
                {poRows.map(({ s, t }) => (
                  <tr key={s.id}>
                    <td>{s.portfolioIds.length ? s.portfolioIds.map(portfolioName).join(', ') : 'All products'}</td>
                    <td><Badge tone={s.role === 'PRIMARY' ? 'purple' : 'slate'}>{s.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge></td>
                    <td className="g2-strong">{t.poTo}</td>
                    <td><span className="g2-row" style={{ gap: 4 }}><WarehouseIcon size={13} />{t.shipsFrom}</span></td>
                    <td className="g2-small g2-muted">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="g2-stack" style={{ gap: 6 }}>
        {issues.length === 0 && <Alert tone="success" icon={<CheckCircle2 size={15} />}>Route is valid for policy “{policy.name}”.</Alert>}
        {issues.map((i, k) => <Alert key={k} tone={i.severity === 'error' ? 'error' : 'warn'} icon={<AlertTriangle size={15} />}>{i.message}</Alert>)}
      </div>
    </div>
  );
};
