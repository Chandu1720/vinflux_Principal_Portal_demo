import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, Badge, Modal, StatusBadge, Tabs } from '../../components/ui';
import { OriginBadge, PartnerStatusBadge } from '../../components/domain/Badges';
import { FlowDiagram } from '../../components/domain/FlowDiagram';
import { TradeStatusPanel } from '../../components/domain/HealthBadges';
import { useWarehouses } from '../../hooks/useProductMaster';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { COMMERCIAL_FIELDS, resolveTerms } from '../../utils/commercial';
import { partnerChannelId } from '../../utils/eligibility';
import { mappingRouteView } from '../../utils/route';
import { poTarget, primarySupplierOf } from '../../utils/supply';
import { complianceOf, portalEnabledFor, portalSummary, tradeStatusOf } from '../../utils/health';
import { collapseSelection, territoryPath } from '../../utils/territory';
import { assignmentState, ownerName } from '../../utils/coverage';
import { useProductMaster } from '../../hooks/useProductMaster';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/navigation';
import { formatCommercial, formatDateTime } from '../../utils/format';
import type { Partner, SupplierLink } from '../../types';
import type { GtmBundle } from './stepProps';
import { CreditPanel } from './panels/CreditPanel';
import { LicencePanel } from './panels/LicencePanel';
import { PortalPanel } from './panels/PortalPanel';

export const PartnerDetailsModal: React.FC<{ partner: Partner | null; data: GtmBundle; onClose: () => void; footer?: React.ReactNode; initialTab?: string }> = ({ partner, data, onClose, footer, initialTab }) => {
  const [tab, setTab] = useState(initialTab ?? 'overview');
  const warehouses = useWarehouses();
  const pm = useProductMaster();
  const { principal } = useGtmAuth();
  const config = data.config;
  const channelId = partner && config ? partnerChannelId(partner, config.partnerTypes) : null;
  const channel = data.channels.find((c) => c.id === channelId);
  const mappings = useMemo(() => (partner ? data.mappings.filter((m) => m.partnerId === partner.id) : []), [partner, data.mappings]);
  // Other partners that list this partner as a supplier or customer.
  const linkedIn = partner ? data.mappings.filter((m) => m.partnerId !== partner.id
    && ((m.suppliers ?? []).some((s) => s.partnerId === partner.id) || (m.customers ?? []).some((c) => c.partnerIds.includes(partner.id)))) : [];

  const termRows = useMemo(() => {
    if (!partner || !channel) return [];
    const base = { label: 'Partner level', r: resolveTerms({ channel, partnerId: partner.id, territoryIds: partner.territoryIds, records: data.terms, territories: data.territories }) };
    const rel = mappings
      .filter((m) => data.terms.some((t) => t.scope === 'RELATIONSHIP' && t.mappingId === m.id))
      .map((m) => ({ label: `Relationship: ${data.flows.find((f) => f.id === m.flowId)?.name ?? m.flowId}`, r: resolveTerms({ channel, partnerId: partner.id, mappingId: m.id, territoryIds: partner.territoryIds, records: data.terms, territories: data.territories }) }));
    return [base, ...rel];
  }, [partner, channel, mappings, data.terms, data.territories, data.flows]);

  if (!partner || !config) return null;
  const pName = (id: string) => data.partners.find((p) => p.id === id)?.name ?? id;
  const pendingTerms = data.terms.filter((t) => t.partnerId === partner.id && t.approvalStatus === 'Pending');
  const trade = tradeStatusOf(partner, config, data);
  const comp = complianceOf(partner, config);
  const portal = portalSummary(partner);
  const isSetup = ['Draft', 'KYC Pending', 'KYC Under Review', 'Rejected'].includes(partner.status);

  return (
    <Modal open title={partner.name} subtitle={<span className="g2-row">{partner.code} · {config.partnerTypes.find((t) => t.id === partner.partnerTypeId)?.name} · <PartnerStatusBadge status={partner.status} config={config} /></span>} onClose={onClose} size="xl" footer={footer}>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'kyc', label: 'KYC & Licences', count: comp.items.filter((i) => i.state !== 'valid').length || undefined },
        { id: 'supply', label: 'Supply chain', count: mappings.length },
        { id: 'terms', label: 'Commercial Terms' },
        ...(isSetup ? [] : [{ id: 'credit', label: 'Credit' }]),
        ...(isSetup || !portalEnabledFor(partner, config) ? [] : [{ id: 'portal', label: 'Portal access', count: portal.total || undefined }]),
      ]} />
      <div style={{ paddingTop: 16 }}>
        {tab === 'overview' && (
          <div className="g2-stack">
            {!isSetup && <TradeStatusPanel status={trade} />}
            <dl className="g2-dl">
              <dt>Business name</dt><dd>{partner.businessName}</dd>
              <dt>Sales channel</dt><dd>{channel?.name ?? '—'}</dd>
              <dt>Contact</dt><dd>{partner.contactPerson} · {partner.email} · {partner.phone}</dd>
              <dt>Address</dt><dd>{[partner.address.line1, partner.address.city, partner.address.state, partner.address.pincode].filter(Boolean).join(', ')}</dd>
              <dt>GSTIN / PAN</dt><dd className="g2-mono">{partner.gst || '—'} / {partner.pan || '—'}{partner.gstVerification && <> <Badge tone="green">GSTN verified</Badge></>}</dd>
              <dt>KYC status</dt><dd><StatusBadge status={partner.kycStatus} /></dd>
              {partner.institution && (() => {
                const cur = data.assignments.filter((a) => a.customerId === partner.id && assignmentState(a) === 'Current');
                return <>
                  <dt>Hospital group</dt><dd>{partner.institution.hospitalGroup || '—'}</dd>
                  <dt>Served by</dt><dd>{cur.length ? cur.map((a) => `${a.portfolioId ? pm.nameOf(a.portfolioId) : 'All portfolios'}: ${ownerName(a, data.partners, principal.name)}${a.role === 'BACKUP' ? ' (backup)' : ''}`).join(' · ') : 'Nobody yet'} · <Link to={`${ROUTES.coverage}?h=${partner.id}`}>Open coverage</Link></dd>
                </>;
              })()}
              {!partner.institution && data.assignments.some((a) => a.partnerId === partner.id && assignmentState(a) === 'Current') && <>
                <dt>Hospitals served</dt><dd>{Array.from(new Set(data.assignments.filter((a) => a.partnerId === partner.id && assignmentState(a) === 'Current').map((a) => data.partners.find((p) => p.id === a.customerId)?.name))).join(', ')}</dd>
              </>}
              <dt>Territories</dt><dd>{collapseSelection(partner.territoryIds, data.territories).map((t) => territoryPath(t, data.territories)).join(' · ') || '—'}</dd>
              {!isSetup && portalEnabledFor(partner, config) && <><dt>Portal</dt><dd>{portal.active} active · {portal.pending} pending{portal.expired ? ` · ${portal.expired} expired` : ''}</dd></>}
              <dt>Submitted</dt><dd>{formatDateTime(partner.submittedAt)}</dd>
              <dt>Activated</dt><dd>{formatDateTime(partner.activatedAt)}</dd>
              <dt>Last updated</dt><dd>{formatDateTime(partner.updatedAt)} by {partner.updatedBy}</dd>
            </dl>
          </div>
        )}
        {tab === 'kyc' && <LicencePanel partner={partner} data={data} />}
        {tab === 'supply' && (
          <div className="g2-stack">
            {mappings.length === 0 && <div className="g2-muted">No supply links yet.</div>}
            {mappings.map((m) => {
              const f = data.flows.find((x) => x.id === m.flowId);
              const view = mappingRouteView(m, f, data.partners, config.partnerTypes, data.channels, { mappings: data.mappings, flows: data.flows, warehouses });
              const links: SupplierLink[] = m.suppliers?.length ? m.suppliers : [primarySupplierOf(m, data.flows)].filter(Boolean) as SupplierLink[];
              return (
                <div key={m.id} className="g2-form-section">
                  <div className="g2-row">
                    <span className="g2-strong">{f?.name ?? 'Sales policy removed'}</span><span className="g2-muted g2-small">{f?.code}</span>
                    <StatusBadge status={m.status} />
                    {f && m.flowVersion < f.version && <Badge tone="amber" title="The sales policy changed after this link was created"><AlertTriangle size={11} /> Linked on v{m.flowVersion}, policy is v{f.version}</Badge>}
                  </div>
                  <FlowDiagram stages={view.stages} channels={data.channels} warehouses={warehouses}
                    highlightStageIds={view.stages.filter((s) => s.id === 'self').map((s) => s.id)}
                    stageFooter={(st) => (view.names[st.id]?.length ? <div className="g2-small g2-strong" style={{ color: 'var(--g2-primary-700)' }}>{view.names[st.id].join(', ')}</div> : null)} />
                  {links.map((l) => {
                    const t = poTarget(l, data.channels, data.partners, warehouses, principal.name);
                    return (
                      <div key={l.id} className="g2-cell-sub" style={{ marginTop: 4 }}>
                        <Badge tone={l.role === 'PRIMARY' ? 'purple' : 'slate'}>{l.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge>{' '}
                        {l.portfolioIds.length ? l.portfolioIds.length + ' portfolio(s)' : 'All products'}: PO to <strong>{t.poTo}</strong> · ships from {t.shipsFrom}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {linkedIn.length > 0 && (
              <div>
                <div className="g2-label" style={{ marginBottom: 6 }}>Linked by other partners</div>
                {linkedIn.map((m) => (
                  <div key={m.id} className="g2-list-item g2-small">
                    <span className="g2-strong">{pName(m.partnerId)}</span>
                    <span className="g2-muted">{(m.suppliers ?? []).some((s) => s.partnerId === partner.id) ? 'buys from this partner' : 'sells to this partner'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'terms' && (
          <div className="g2-stack">
            {pendingTerms.length > 0 && <Alert tone="warn">{pendingTerms.length} commercial override(s) awaiting approval — not yet effective.</Alert>}
            {!channel && <div className="g2-muted">Partner type has no sales channel.</div>}
            {termRows.map((row) => (
              <div key={row.label}>
                <div className="g2-label" style={{ marginBottom: 6 }}>{row.label}</div>
                <div className="g2-table-wrap"><table className="g2-table">
                  <thead><tr><th>Term</th><th>Value</th><th>Origin</th></tr></thead>
                  <tbody>{COMMERCIAL_FIELDS.map((f) => (
                    <tr key={f.key}><td>{f.label}</td><td className="g2-strong">{formatCommercial(f.kind, row.r[f.key].value)}</td><td><OriginBadge scope={row.r[f.key].scope} label={row.r[f.key].label} /></td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            ))}
          </div>
        )}
        {tab === 'credit' && <CreditPanel partner={partner} data={data} />}
        {tab === 'portal' && <PortalPanel partner={partner} data={data} />}
      </div>
    </Modal>
  );
};
