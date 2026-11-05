import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import { Alert, Badge, Button, Card, StatusBadge } from '../../components/ui';
import { COMMERCIAL_FIELDS, flattenResolved, resolveTerms } from '../../utils/commercial';
import { partnerChannelId } from '../../utils/eligibility';
import { collapseSelection, territoryPath } from '../../utils/territory';
import { formatCommercial, formatDate } from '../../utils/format';
import type { ApprovalCategory } from '../../types';
import type { StepProps } from './stepProps';
import { STEP, emptyScope, predictTermCategories, workflowLabel } from './wizardModel';
import { useProductMaster, useWarehouses } from '../../hooks/useProductMaster';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import { poTarget } from '../../utils/supply';

export const StepReview: React.FC<StepProps & { onJump: (i: number) => void; serverErrors: string[] }> = ({ state, data, config, onJump, serverErrors }) => {
  const { input, extras } = state;
  const pm = useProductMaster();
  const warehouses = useWarehouses();
  const { principal } = useGtmAuth();
  const type = config.partnerTypes.find((t) => t.id === input.partnerTypeId);
  const channelId = partnerChannelId(input, config.partnerTypes);
  const channel = data.channels.find((c) => c.id === channelId);
  const missing = config.kycDocuments.filter((k) => k.status === 'Active' && k.mandatoryForPartnerTypeIds.includes(input.partnerTypeId) && !input.kycDocuments.some((d) => d.docTypeId === k.id && d.status !== 'Rejected'));
  const resolved = useMemo(() => (channel ? resolveTerms({ channel, partnerId: state.id, territoryIds: input.territoryIds, records: data.terms, territories: data.territories }) : null), [channel, state.id, input.territoryIds, data.terms, data.territories]);
  const termCats = resolved && extras.commercialOverride ? predictTermCategories(flattenResolved(resolved), extras.commercialOverride.values) : [];

  const approvals: { cat: ApprovalCategory; note: string }[] = [];
  if (missing.length === 0) {
    approvals.push({ cat: 'KYC_VERIFICATION', note: `${input.kycDocuments.length} document(s)` });
    approvals.push({ cat: 'PARTNER_ONBOARDING', note: 'Raised after KYC is verified' });
  }
  extras.flowSelections.filter((s) => s.skippedStageIds.length).forEach((s) => approvals.push({ cat: 'PARTNER_FLOW_OVERRIDE', note: data.flows.find((f) => f.id === s.flowId)?.name ?? '' }));
  termCats.forEach((c) => approvals.push({ cat: c.cat, note: `${c.label}: ${c.from} → ${c.to}` }));

  const edit = (i: number) => <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => onJump(i)}>Edit</Button>;
  const pName = (id: string) => data.partners.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="g2-stack">
      {serverErrors.length > 0 && (
        <Alert tone="error" icon={<AlertTriangle size={16} />}><strong>Submission failed</strong><ul>{serverErrors.map((e) => <li key={e}>{e}</li>)}</ul></Alert>
      )}
      {missing.length > 0 ? (
        <Alert tone="warn" icon={<AlertTriangle size={16} />}>Missing mandatory KYC: {missing.map((m) => m.name).join(', ')}. On submit the partner status will be <strong>KYC Pending</strong> and no approvals will be raised until documents are complete.</Alert>
      ) : (
        <Alert tone="success" icon={<CheckCircle2 size={16} />}>KYC complete. On submit the partner moves to <strong>KYC Under Review</strong>, then <strong>Approval Pending</strong>, then <strong>Active</strong> once approved.</Alert>
      )}

      <div className="g2-grid g2-grid-2">
        <Card title="Basic details" actions={edit(STEP.BASIC)}>
          <dl className="g2-dl">
            <dt>Partner</dt><dd>{input.name} <span className="g2-muted">({input.code})</span></dd>
            <dt>Type / channel</dt><dd>{type?.name ?? '—'} · {channel?.name ?? '—'}</dd>
            <dt>Contact</dt><dd>{input.contactPerson} · {input.email} · {input.phone}</dd>
            <dt>Business</dt><dd>{input.businessName}</dd>
            <dt>Address</dt><dd>{[input.address.line1, input.address.city, input.address.state, input.address.pincode].filter(Boolean).join(', ')}</dd>
            <dt>GSTIN / PAN</dt><dd className="g2-mono">{input.gst} / {input.pan}</dd>
          </dl>
        </Card>
        <Card title="KYC documents" actions={edit(STEP.KYC)}>
          {input.kycDocuments.length === 0 && <div className="g2-muted">No documents uploaded.</div>}
          {input.kycDocuments.map((d) => (
            <div key={d.id} className="g2-list-item g2-small">
              <span className="g2-strong">{config.kycDocuments.find((k) => k.id === d.docTypeId)?.name}</span>
              <span className="g2-muted g2-ellipsis">{d.fileName}</span>
              <span className="g2-spacer" /><StatusBadge status={d.status} />
            </div>
          ))}
        </Card>
        <Card title="Territories" actions={edit(STEP.TERRITORIES)}>
          <div className="g2-row">{collapseSelection(input.territoryIds, data.territories).map((t) => <span key={t} className="g2-chip">{territoryPath(t, data.territories)}</span>)}</div>
          <div className="g2-small g2-muted" style={{ marginTop: 6 }}>{input.territoryIds.length} territories in total</div>
        </Card>
        <Card title="Products" actions={edit(STEP.PRODUCTS)}>
          <div className="g2-small">{pm.describeScope(input.productScope ?? emptyScope())}</div>
          <div className="g2-small g2-muted" style={{ marginTop: 6 }}>{pm.productsInScope(input.productScope ?? emptyScope()).length} Product Master items</div>
        </Card>
        <Card title="Commercial terms" actions={edit(STEP.COMMERCIAL)}>
          {resolved && COMMERCIAL_FIELDS.map((f) => {
            const ov = extras.commercialOverride?.values[f.key];
            return (
              <div key={f.key} className="g2-list-item g2-small">
                <span style={{ width: 130 }}>{f.label}</span>
                <span>{formatCommercial(f.kind, resolved[f.key].value)}</span>
                {ov !== undefined && <><span>→</span><strong style={{ color: 'var(--g2-primary)' }}>{formatCommercial(f.kind, ov)}</strong><Badge tone="amber">Override</Badge></>}
              </div>
            );
          })}
          {extras.commercialOverride && Object.keys(extras.commercialOverride.values).length > 0 && (
            <div className="g2-small g2-muted" style={{ marginTop: 6 }}>Effective {formatDate(extras.commercialOverride.effectiveFrom)}{extras.commercialOverride.effectiveTo ? ` – ${formatDate(extras.commercialOverride.effectiveTo)}` : ''} · {extras.commercialOverride.reason}</div>
          )}
        </Card>
      </div>

      <Card title="Route & partner mapping" actions={<>{edit(STEP.ROUTE)}</>}>
        {extras.flowSelections.length === 0 && <div className="g2-muted">No sales policies selected.</div>}
        {extras.flowSelections.map((s) => {
          const f = data.flows.find((x) => x.id === s.flowId);
          if (!f) return null;
          return (
            <div key={s.flowId} className="g2-list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
              <div className="g2-strong">{f.name}</div>
              <div className="g2-small">
                {s.suppliers ? (
                  <div className="g2-stack" style={{ gap: 4 }}>
                    {s.suppliers.map((l) => {
                      const t = poTarget(l, data.channels, data.partners, warehouses, principal.name);
                      const sup = l.kind === 'COMPANY' ? `${principal.name} (direct)` : `${data.channels.find((c) => c.id === l.channelId)?.name ?? 'Supplier'}: ${l.partnerId ? pName(l.partnerId) : 'not selected'}`;
                      const prods = l.portfolioIds.length ? l.portfolioIds.map((id) => pm.portfolios.find((p) => p.id === id)?.name ?? id).join(', ') : 'All products';
                      return <div key={l.id}><strong>Buys from</strong> {sup} <Badge tone={l.role === 'PRIMARY' ? 'purple' : 'slate'}>{l.role === 'PRIMARY' ? 'Primary' : 'Backup'}</Badge> · {prods} → <strong>PO to {t.poTo}</strong>, ships from {t.shipsFrom}</div>;
                    })}
                    <div><strong>Sells to</strong> {(s.customers ?? []).length === 0 ? <span className="g2-muted">—</span> : (s.customers ?? []).map((c) => `${data.channels.find((x) => x.id === c.channelId)?.name ?? 'Customer'}${c.partnerIds.length ? ` (${c.partnerIds.map(pName).join(', ')})` : ''}`).join(' · ')}</div>
                  </div>
                ) : s.route ? (
                  <div className="g2-flow-mini">
                    {s.route.map((r, i) => {
                      const chName = data.channels.find((c) => c.id === r.channelId)?.name ?? 'Stage';
                      const label = r.kind === 'SOURCE'
                        ? `Warehouse${r.warehouseId ? ` (${warehouses.find((w) => w.id === r.warehouseId)?.name ?? r.warehouseId})` : ''}`
                        : r.kind === 'SELF' ? 'This partner'
                          : `${chName}${r.partnerIds.length ? `: ${r.partnerIds.map(pName).join(', ')}` : ' (to be mapped)'}`;
                      return <React.Fragment key={r.id}>{i > 0 && <span className="sep">→</span>}<span className={r.kind === 'SELF' ? 'g2-strong' : ''}>{label}</span></React.Fragment>;
                    })}
                  </div>
                ) : (() => {
                  const sup = f.stages.find((st) => st.id === s.supplierStageId);
                  const supIds = sup ? s.stageAssignments.find((x) => x.stageId === sup.id)?.partnerIds ?? [] : [];
                  const ownIdx = f.stages.findIndex((st) => st.id === s.ownStageId);
                  const down = s.stageAssignments.filter((x) => f.stages.findIndex((st) => st.id === x.stageId) > ownIdx);
                  return (
                    <>
                      <div><strong>Buys from:</strong> {!sup ? <span className="g2-muted">not set</span> : sup.kind === 'SOURCE' ? `Company direct${s.supplyWarehouseId ? ` (${warehouses.find((w) => w.id === s.supplyWarehouseId)?.name ?? s.supplyWarehouseId})` : ''}` : `${sup.label}${supIds.length ? ` — ${supIds.map(pName).join(', ')}` : ' (partner to be mapped)'}`}</div>
                      <div><strong>Sells to:</strong> {down.length === 0 ? <span className="g2-muted">—</span> : down.map((x) => {
                        const st = f.stages.find((y) => y.id === x.stageId);
                        return `${st?.label ?? 'customer'}${x.partnerIds.length ? ` (${x.partnerIds.map(pName).join(', ')})` : ''}`;
                      }).join(' · ')}</div>
                    </>
                  );
                })()}
              </div>
              {s.skippedStageIds.length > 0 && <div className="g2-small g2-muted">Override reason: {s.overrideReason}</div>}
            </div>
          );
        })}
      </Card>

      <Card title="Approvals that will be raised" subtitle="Based on the configured approval workflows">
        {approvals.length === 0 && <div className="g2-muted">None — the partner will wait in KYC Pending.</div>}
        {approvals.map((a, i) => {
          const wf = workflowLabel(config, a.cat);
          return (
            <div key={`${a.cat}-${i}`} className="g2-list-item g2-small">
              <Badge tone="purple">{wf.label}</Badge><span>{a.note}</span><span className="g2-spacer" />
              <span className="g2-muted">{wf.enabled ? wf.levels.join(' → ') : 'Auto-approved (workflow disabled)'}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
};
