import React from 'react';
import { ArrowRight, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ApprovalRequest, GtmConfiguration, Partner } from '../../types';
import { Button, Modal, StatusBadge } from '../../components/ui';
import { PartnerStatusBadge } from '../../components/domain/Badges';
import { formatDate, formatDateTime } from '../../utils/format';

const STEP_COLOR: Record<string, string> = { Approved: 'var(--g2-green)', Rejected: 'var(--g2-red)', Pending: '#f59e0b', Waiting: 'var(--g2-slate-bd)' };

export const ApprovalDetailModal: React.FC<{
  req: ApprovalRequest;
  categoryLabel: string;
  partner: Partner | null;
  config?: GtmConfiguration;
  canApprove: boolean;
  onClose: () => void;
  onDecide: (mode: 'Approved' | 'Rejected') => void;
}> = ({ req, categoryLabel, partner, config, canApprove, onClose, onDecide }) => {
  const ptype = config?.partnerTypes.find((t) => t.id === partner?.partnerTypeId);
  return (
    <Modal
      open
      size="lg"
      title={<span className="g2-row">{req.requestNo} <StatusBadge status={req.status} /></span>}
      subtitle={`${categoryLabel} · requested by ${req.requestedBy} on ${formatDateTime(req.requestedAt)}`}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {req.status === 'Pending' && <>
          <Button variant="danger" icon={<ThumbsDown size={15} />} disabled={!canApprove} title={canApprove ? undefined : 'No approval authority'} onClick={() => onDecide('Rejected')}>Reject</Button>
          <Button variant="success" icon={<ThumbsUp size={15} />} disabled={!canApprove} title={canApprove ? undefined : 'No approval authority'} onClick={() => onDecide('Approved')}>Approve</Button>
        </>}
      </>}
    >
      <div className="g2-stack">
        <div className="g2-alert g2-alert-info">{req.summary}</div>
        <div>
          <div className="g2-form-section-title" style={{ marginBottom: 8 }}>Requested changes</div>
          <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}>
            <table className="g2-table">
              <thead><tr><th>Field</th><th>Current</th><th /><th>Requested</th></tr></thead>
              <tbody>
                {req.details.map((d, i) => (
                  <tr key={i}>
                    <td className="g2-strong">{d.label}</td>
                    <td className="g2-muted">{d.from ?? '—'}</td>
                    <td style={{ width: 24 }}>{d.from !== undefined && <ArrowRight size={14} className="g2-muted" />}</td>
                    <td style={{ fontWeight: 600, color: d.from !== undefined ? 'var(--g2-primary)' : undefined }}>{d.to}</td>
                  </tr>
                ))}
                {req.details.length === 0 && <tr><td colSpan={4} className="g2-muted">No details.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="g2-grid g2-grid-2">
          <div>
            <div className="g2-form-section-title" style={{ marginBottom: 10 }}>Approval steps</div>
            <ul className="g2-timeline">
              {req.steps.map((s) => (
                <li key={s.level}>
                  <span className="tdot" style={{ background: STEP_COLOR[s.status] }} />
                  <div className="g2-row" style={{ gap: 6 }}><strong>Level {s.level} · {s.role}</strong> <StatusBadge status={s.status} /></div>
                  <div className="g2-cell-sub">
                    {s.actedBy ? `${s.actedBy} · ${formatDateTime(s.actedAt)}` : s.status === 'Pending' ? 'Awaiting decision' : 'Waiting for previous level'}
                  </div>
                  {s.comments && <div className="g2-small" style={{ marginTop: 2 }}>“{s.comments}”</div>}
                </li>
              ))}
              {req.steps.length === 0 && <li className="g2-muted">Auto-approved (workflow disabled).</li>}
            </ul>
          </div>
          <div>
            <div className="g2-form-section-title" style={{ marginBottom: 10 }}>Linked partner</div>
            {partner ? (
              <dl className="g2-dl">
                <dt>Partner</dt><dd>{partner.name} <span className="g2-muted g2-small">{partner.code}</span></dd>
                <dt>Type</dt><dd>{ptype?.name ?? '—'}</dd>
                <dt>Status</dt><dd><PartnerStatusBadge status={partner.status} config={config} /></dd>
                <dt>KYC</dt><dd><StatusBadge status={partner.kycStatus} /></dd>
                <dt>Contact</dt><dd>{partner.contactPerson} · {partner.email}</dd>
                <dt>GSTIN / PAN</dt><dd className="g2-mono">{partner.gst} / {partner.pan}</dd>
                <dt>Submitted</dt><dd>{formatDate(partner.submittedAt)}</dd>
              </dl>
            ) : <div className="g2-muted">No partner linked.</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
};
