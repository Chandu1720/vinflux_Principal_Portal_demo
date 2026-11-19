import React, { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Alert, Button, Field, Textarea } from '../../../components/ui';
import { CreditBar } from '../../../components/domain/HealthBadges';
import { partnerOpsService } from '../../../services';
import { useAction } from '../../../hooks/useAction';
import { useGtmAuth } from '../../../hooks/useGtmAuth';
import { creditOf } from '../../../utils/health';
import { formatDate, formatDateTime, formatINR } from '../../../utils/format';
import type { Partner } from '../../../types';
import type { GtmBundle } from '../stepProps';

/**
 * Credit position and hold. Limit and period come from the commercial-terms resolver;
 * outstanding / overdue come from the ERP ledger. Holding is immediate, releasing needs approval.
 */
export const CreditPanel: React.FC<{ partner: Partner; data: GtmBundle }> = ({ partner, data }) => {
  const { actor, can } = useGtmAuth();
  const { run, pending } = useAction();
  const [reason, setReason] = useState('');
  const config = data.config!;
  const c = creditOf(partner, config, data);
  const hold = partner.credit?.hold ?? null;
  const releaseReq = hold?.releaseRequestId ? data.approvals.find((a) => a.id === hold.releaseRequestId) : null;
  const cfg = config.compliance;

  const kpi = (label: string, value: string, tone?: string) => (
    <div className="g2-mini-kpi"><div className="g2-cell-sub">{label}</div><div className="g2-strong" style={{ fontSize: 17, color: tone }}>{value}</div></div>
  );

  return (
    <div className="g2-stack">
      <div className="g2-mini-kpis">
        {kpi('Credit limit', formatINR(c.limit))}
        {kpi('Outstanding', formatINR(c.outstanding))}
        {kpi('Available', formatINR(c.available), c.available === 0 && c.limit > 0 ? 'var(--g2-danger, #dc2626)' : undefined)}
        {kpi('Overdue', formatINR(c.overdue), c.overdue > 0 ? '#d97706' : undefined)}
        {kpi('Credit period', `${c.periodDays} days`)}
      </div>
      <CreditBar credit={c} />
      <p className="g2-hint" style={{ margin: 0 }}>
        Limit and period come from commercial terms (see the Commercial Terms tab for where each value is inherited from).
        Balances {c.asOf ? `as of ${formatDate(c.asOf)}` : 'not yet received'} from the ERP ledger.
        Rules: warn at {cfg.creditWarnPct}%{cfg.blockWhenOverLimit ? ', block above limit' : ''}{cfg.blockWhenOverdue ? ', block when overdue' : ''}.
      </p>

      {hold ? (
        <div className="g2-form-section">
          <div className="g2-row"><Lock size={16} color="#dc2626" /><strong>On credit hold</strong></div>
          <dl className="g2-dl" style={{ marginTop: 8 }}>
            <dt>Reason</dt><dd>{hold.reason}</dd>
            <dt>Placed by</dt><dd>{hold.heldBy} · {formatDateTime(hold.heldAt)}</dd>
          </dl>
          {releaseReq && releaseReq.status === 'Pending' ? (
            <Alert tone="info">Release requested ({releaseReq.requestNo}) — waiting for {releaseReq.steps.find((s) => s.status === 'Pending')?.role ?? 'approval'}.</Alert>
          ) : can.manageConfig ? (
            <div className="g2-stack" style={{ marginTop: 8 }}>
              <Field label="Why release the hold?" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment of ₹12.5 L received on 25 Oct" /></Field>
              <div><Button variant="primary" icon={<LockOpen size={14} />} loading={pending} disabled={!reason.trim()}
                onClick={async () => { const r = await run(() => partnerOpsService.requestRelease(partner.id, reason, actor), (x) => (x.needsApproval ? 'Release request sent for approval.' : 'Credit hold released.')); if (r) setReason(''); }}>
                Request release</Button></div>
              <span className="g2-hint">Releasing a hold goes to the “Credit Hold Release” approval workflow.</span>
            </div>
          ) : null}
        </div>
      ) : can.manageConfig ? (
        <div className="g2-form-section">
          <div className="g2-row"><Lock size={16} /><strong>Place on credit hold</strong></div>
          <p className="g2-hint" style={{ margin: '4px 0 8px' }}>Takes effect immediately: the partner can’t receive new orders until the hold is released.</p>
          <Field label="Reason" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cheque bounce, dispute, audit" /></Field>
          <div style={{ marginTop: 8 }}><Button variant="danger" icon={<Lock size={14} />} loading={pending} disabled={!reason.trim()}
            onClick={async () => { const r = await run(() => partnerOpsService.placeHold(partner.id, reason, actor), `${partner.name} placed on credit hold.`); if (r) setReason(''); }}>
            Place hold</Button></div>
        </div>
      ) : null}
    </div>
  );
};
