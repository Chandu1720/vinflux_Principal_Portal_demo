import React from 'react';
import { ArrowDownRight, ArrowUpLeft, X } from 'lucide-react';
import type {
  CommercialTermRecord, GtmConfiguration, Partner, PartnerFlowMapping, PartnerFlowOverride, SalesChannel, SalesFlow, SupplierLink, Territory,
} from '../../types';
import { Badge, Card, StatusBadge } from '../../components/ui';
import { poTarget, primarySupplierOf } from '../../utils/supply';
import { useWarehouses } from '../../hooks/useProductMaster';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { OriginBadge, PartnerStatusBadge } from '../../components/domain/Badges';
import { COMMERCIAL_FIELDS, resolveTerms } from '../../utils/commercial';
import { partnerChannelId } from '../../utils/eligibility';
import { territoryPath } from '../../utils/territory';
import { formatCommercial, formatDate } from '../../utils/format';

export const PartnerDetailPanel: React.FC<{
  partner: Partner;
  partners: Partner[];
  upstream: string[];
  downstream: string[];
  mappings: PartnerFlowMapping[];
  overrides: PartnerFlowOverride[];
  flows: SalesFlow[];
  channels: SalesChannel[];
  territories: Territory[];
  terms: CommercialTermRecord[];
  config?: GtmConfiguration;
  onSelect: (id: string) => void;
  onClose: () => void;
}> = ({ partner, partners, upstream, downstream, mappings, overrides, flows, channels, territories, terms, config, onSelect, onClose }) => {
  const warehouses = useWarehouses();
  const { principal } = useGtmAuth();
  const type = config?.partnerTypes.find((t) => t.id === partner.partnerTypeId);
  const chId = config ? partnerChannelId(partner, config.partnerTypes) : null;
  const channel = channels.find((c) => c.id === chId);
  const own = mappings.filter((m) => m.partnerId === partner.id);
  const pName = (id: string) => partners.find((p) => p.id === id)?.name ?? id;

  // One resolved set per relationship; a partner-level set when there are no relationships.
  const termSets = channel
    ? (own.length ? own : [null]).map((m) => ({
      label: m ? flows.find((f) => f.id === m.flowId)?.name ?? 'Relationship' : 'Partner level',
      resolved: resolveTerms({ channel, partnerId: partner.id, mappingId: m?.id ?? null, territoryIds: partner.territoryIds, records: terms, territories }),
    }))
    : [];

  const linkList = (ids: string[], icon: React.ReactNode) => ids.length === 0 ? <span className="g2-muted g2-small">None</span> : (
    <div className="g2-row" style={{ gap: 6 }}>
      {ids.map((id) => <button key={id} type="button" className="g2-chip" style={{ cursor: 'pointer' }} onClick={() => onSelect(id)}>{icon}{pName(id)}</button>)}
    </div>
  );

  return (
    <Card
      title={partner.name}
      subtitle={<span className="g2-row" style={{ gap: 6 }}><span className="g2-mono">{partner.code}</span> · {type?.name ?? 'Unknown type'} <PartnerStatusBadge status={partner.status} config={config} /></span>}
      actions={<button type="button" className="g2-icon-btn" aria-label="Close details" onClick={onClose}><X size={16} /></button>}
    >
      <dl className="g2-dl">
        <dt>Contact</dt><dd>{partner.contactPerson}<div className="g2-cell-sub">{partner.email} · {partner.phone}</div></dd>
        <dt>Business</dt><dd>{partner.businessName}<div className="g2-cell-sub">{partner.address.city}, {partner.address.state}</div></dd>
        <dt>Channel</dt><dd>{channel?.name ?? '—'}</dd>
        <dt>KYC</dt><dd><StatusBadge status={partner.kycStatus} /></dd>
        <dt>Active since</dt><dd>{formatDate(partner.activatedAt)}</dd>
      </dl>

      <div className="g2-divider" />
      <div className="g2-label" style={{ marginBottom: 6 }}>Upstream partners</div>
      {linkList(upstream, <ArrowUpLeft size={11} />)}
      <div className="g2-label" style={{ margin: '10px 0 6px' }}>Downstream partners</div>
      {linkList(downstream, <ArrowDownRight size={11} />)}

      <div className="g2-divider" />
      <div className="g2-label" style={{ marginBottom: 6 }}>Territory assignments ({partner.territoryIds.length})</div>
      {partner.territoryIds.length === 0 ? <span className="g2-muted g2-small">None</span> : (
        <ul style={{ margin: 0, paddingLeft: 16 }} className="g2-small">{partner.territoryIds.map((t) => <li key={t}>{territoryPath(t, territories)}</li>)}</ul>
      )}

      <div className="g2-divider" />
      <div className="g2-label" style={{ marginBottom: 6 }}>Sales policies ({own.length})</div>
      {own.length === 0 && <span className="g2-muted g2-small">No supply links yet.</span>}
      {own.map((m) => {
        const flow = flows.find((f) => f.id === m.flowId);
        if (!flow) return null;
        const stage = flow.stages.find((s) => s.id === m.ownStageId);
        const ovr = overrides.filter((o) => o.partnerId === partner.id && o.flowId === flow.id);
        return (
          <div key={m.id} style={{ border: '1px solid var(--g2-border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div className="g2-row" style={{ justifyContent: 'space-between' }}>
              <span className="g2-strong">{flow.name}</span>
              <span className="g2-row" style={{ gap: 4 }}>{m.flowVersion !== flow.version && <Badge tone="amber">mapped v{m.flowVersion}</Badge>}<StatusBadge status={m.status} /></span>
            </div>
            {(() => {
              const links: SupplierLink[] = m.suppliers?.length ? m.suppliers : [primarySupplierOf(m, flows)].filter(Boolean) as SupplierLink[];
              return links.map((l) => {
                const t = poTarget(l, channels, partners, warehouses, principal.name);
                return (
                  <div key={l.id} className="g2-cell-sub" style={{ marginTop: 4 }}>
                    <Badge tone={l.role === 'PRIMARY' ? 'purple' : 'slate'}>{l.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge>{' '}
                    {l.portfolioIds.length ? `${l.portfolioIds.length} portfolio(s)` : 'All products'}: PO to <strong>{t.poTo}</strong> · ships from {t.shipsFrom}
                  </div>
                );
              });
            })()}
            {(m.customers ?? []).length > 0 && <div className="g2-cell-sub" style={{ marginTop: 4 }}>Sells to: {(m.customers ?? []).map((c) => `${channels.find((x) => x.id === c.channelId)?.name ?? 'Customer'}${c.partnerIds.length ? ` (${c.partnerIds.length})` : ''}`).join(', ')}</div>}
            {!m.suppliers && <div className="g2-cell-sub">Position: <strong>{stage?.label ?? 'stage removed'}</strong></div>}
            {ovr.map((o) => (
              <div key={o.id} className="g2-cell-sub" style={{ marginTop: 4 }}>
                Override: bypasses {flow.stages.filter((s) => o.skippedStageIds.includes(s.id)).map((s) => s.label).join(', ')} <StatusBadge status={o.approvalStatus} />
              </div>
            ))}
          </div>
        );
      })}

      <div className="g2-divider" />
      <div className="g2-label" style={{ marginBottom: 6 }}>Commercial terms (resolved)</div>
      {termSets.length === 0 && <span className="g2-muted g2-small">Partner type is not linked to a channel.</span>}
      {termSets.map((ts) => (
        <div key={ts.label} style={{ marginBottom: 10 }}>
          {termSets.length > 1 && <div className="g2-small g2-strong" style={{ marginBottom: 4 }}>{ts.label}</div>}
          <table className="g2-table" style={{ fontSize: 12.5 }}>
            <tbody>
              {COMMERCIAL_FIELDS.map((f) => (
                <tr key={f.key}>
                  <td style={{ padding: '6px 8px' }} className="g2-muted">{f.label}</td>
                  <td style={{ padding: '6px 8px' }} className="g2-strong">{formatCommercial(f.kind, ts.resolved[f.key].value)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}><OriginBadge scope={ts.resolved[f.key].scope} label={ts.resolved[f.key].label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Card>
  );
};
