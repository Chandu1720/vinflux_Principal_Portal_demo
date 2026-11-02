import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Check, 
  X, 
  ArrowUpRight 
} from 'lucide-react';

export const CommercialTermsTab: React.FC = () => {
  const {
    salesChannels,
    partners,
    approveCommercialDeviation,
    rejectCommercialDeviation
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'defaults' | 'overrides'>('pending');

  // Approval Modal State
  const [selectedPendingAssignment, setSelectedPendingAssignment] = useState<{
    partnerId: string;
    partnerName: string;
    partnerCode: string;
    assignmentId: string;
    channelName: string;
    channelDefaultDiscount: number;
    requestedDiscount: number;
    requestReason?: string;
    requestedBy?: string;
    requestedAt?: string;
  } | null>(null);

  const [approvedDiscount, setApprovedDiscount] = useState<number>(14.0);
  const [approvalComments, setApprovalComments] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Extract all partner-channel assignments with commercial data
  const allAssignments = useMemo(() => {
    const list: any[] = [];
    partners.forEach((p) => {
      (p.channelAssignments || []).forEach((ca) => {
        list.push({
          ...ca,
          partnerId: p.id,
          partnerName: p.name,
          partnerCode: p.code,
          partnerTier: p.classification?.performanceTierName || 'Standard Tier',
          partnerStatus: p.status
        });
      });
    });
    return list;
  }, [partners]);

  // Pending Approvals Queue
  const pendingApprovals = useMemo(() => {
    return allAssignments.filter(
      (a) => a.commercialTermStatus === 'Deviated — Pending Approval'
    );
  }, [allAssignments]);

  // Approved Deviations Table
  const approvedDeviations = useMemo(() => {
    return allAssignments.filter(
      (a) => a.commercialTermStatus === 'Deviated — Approved'
    );
  }, [allAssignments]);

  // Commercial Governance Counts (strictly enforcing Section 8.4 business rule!)
  const stats = useMemo(() => {
    const totalAssignments = allAssignments.length;
    const uniquePartners = new Set(allAssignments.map((a) => a.partnerId)).size;
    const standardAssignments = allAssignments.filter((a) => a.commercialTermStatus === 'Standard').length;
    const approvedDeviatedAssignments = approvedDeviations.length;
    const pendingDeviatedAssignments = pendingApprovals.length;
    const rejectedAssignments = allAssignments.filter((a) => a.commercialTermStatus === 'Deviated — Rejected').length;

    return {
      totalAssignments,
      uniquePartners,
      standardAssignments,
      approvedDeviatedAssignments,
      pendingDeviatedAssignments,
      rejectedAssignments
    };
  }, [allAssignments, approvedDeviations, pendingApprovals]);

  const handleOpenApproveModal = (assignment: any) => {
    setSelectedPendingAssignment({
      partnerId: assignment.partnerId,
      partnerName: assignment.partnerName,
      partnerCode: assignment.partnerCode,
      assignmentId: assignment.id,
      channelName: assignment.salesChannelName,
      channelDefaultDiscount: assignment.commercialOverride?.channelDefaultDiscount || 12.0,
      requestedDiscount: assignment.commercialOverride?.requestedDiscount || 14.0,
      requestReason: assignment.commercialOverride?.requestReason,
      requestedBy: assignment.commercialOverride?.requestedBy,
      requestedAt: assignment.commercialOverride?.requestedAt
    });
    setApprovedDiscount(assignment.commercialOverride?.requestedDiscount || 14.0);
    setApprovalComments('Approved under delegated Commercial Director authority.');
  };

  const handleConfirmApproval = () => {
    if (!selectedPendingAssignment) return;
    approveCommercialDeviation(
      selectedPendingAssignment.partnerId,
      selectedPendingAssignment.assignmentId,
      approvedDiscount,
      approvalComments
    );
    setSelectedPendingAssignment(null);
  };

  const handleConfirmRejection = () => {
    if (!selectedPendingAssignment) return;
    rejectCommercialDeviation(
      selectedPendingAssignment.partnerId,
      selectedPendingAssignment.assignmentId,
      rejectionReason || 'Commercial margin criteria not met.'
    );
    setSelectedPendingAssignment(null);
    setIsRejectModalOpen(false);
    setRejectionReason('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} className="text-blue-600" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
              Commercial Terms & Approval Management
            </h2>
            <span className="vf-badge vf-badge-approved">Channel-Governed Engine</span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
            <strong>Enterprise Rule:</strong> Default commercial terms are determined by <strong>Sales Channel, not Territory</strong>. Partner deviations require commercial governance.
          </p>
        </div>

        {/* Subtabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pending')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px', position: 'relative' }}
          >
            Pending Approvals Queue
            {stats.pendingDeviatedAssignments > 0 && (
              <span style={{ marginLeft: '6px', background: '#dc2626', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                {stats.pendingDeviatedAssignments}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'defaults' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('defaults')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
          >
            Channel Default Terms ({salesChannels.length})
          </button>

          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'overrides' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('overrides')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
          >
            Approved Partner Overrides ({stats.approvedDeviatedAssignments})
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Unique Partners</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{stats.uniquePartners}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Distinct commercial entities</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Partner-Channel Asgns</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1d4ed8' }}>{stats.totalAssignments}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Total commercial relationships</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Standard Assignments</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857' }}>{stats.standardAssignments}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Standard channel defaults</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Approved Overrides</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>{stats.approvedDeviatedAssignments}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Valid approved business terms</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Pending Approvals</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: stats.pendingDeviatedAssignments > 0 ? '#dc2626' : 'var(--vf-slate-800)' }}>
            {stats.pendingDeviatedAssignments}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Awaiting commercial decision</div>
        </div>
      </div>

      {/* SUBTAB 1: PENDING COMMERCIAL APPROVALS QUEUE */}
      {activeSubTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                Commercial Approval Governance Queue
              </div>
              <div style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                Review requested partner discount deviations against channel benchmarks before contract activation.
              </div>
            </div>
            <span className="vf-badge" style={{ background: stats.pendingDeviatedAssignments > 0 ? '#fee2e2' : '#ecfdf5', color: stats.pendingDeviatedAssignments > 0 ? '#b91c1c' : '#047857' }}>
              {stats.pendingDeviatedAssignments} Pending Review
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', color: 'var(--vf-slate-400)' }}>
              <CheckCircle2 size={36} className="text-green-500" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vf-slate-700)' }}>
                Commercial Approval Queue is Clear
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                All partner-channel commercial terms are approved or adhering to standard channel benchmarks.
              </p>
            </div>
          ) : (
            <div className="vf-table-container">
              <table className="vf-table">
                <thead>
                  <tr>
                    <th>Partner Name & Code</th>
                    <th>Sales Channel</th>
                    <th>Channel Default</th>
                    <th>Requested Override</th>
                    <th>Deviation Spread</th>
                    <th>Requested By & Date</th>
                    <th>Business Justification</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((item) => {
                    const defaultMargin = item.commercialOverride?.channelDefaultDiscount || 12.0;
                    const requested = item.commercialOverride?.requestedDiscount || 14.0;
                    const spread = (requested - defaultMargin).toFixed(1);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--vf-slate-900)' }}>{item.partnerName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                            {item.partnerCode} • {item.partnerTier}
                          </div>
                        </td>
                        <td>
                          <span className="vf-badge" style={{ background: '#f1f5f9', fontWeight: 600 }}>
                            {item.salesChannelName}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                          {defaultMargin}% margin
                        </td>
                        <td>
                          <strong style={{ fontSize: '13px', color: '#b45309' }}>
                            {requested}%
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>
                            <ArrowUpRight size={14} />
                            <span>+{spread}% margin</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{item.commercialOverride?.requestedBy || 'Zonal Manager'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} />
                            <span>{item.commercialOverride?.requestedAt || 'Recent'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--vf-slate-700)', maxWidth: '240px' }}>
                          {item.commercialOverride?.requestReason || 'Introductory regional promotion'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="vf-btn vf-btn-primary"
                              onClick={() => handleOpenApproveModal(item)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              <Check size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary"
                              onClick={() => {
                                setSelectedPendingAssignment(item);
                                setIsRejectModalOpen(true);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '4px 10px', color: '#dc2626' }}
                            >
                              <X size={13} />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: CHANNEL DEFAULT COMMERCIAL TERMS */}
      {activeSubTab === 'defaults' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--vf-slate-600)' }}>
            Statutory baseline commercial terms determined by <strong>Sales Channel</strong>. New partner assignments inherit these terms by default.
          </div>

          <div className="vf-table-container">
            <table className="vf-table">
              <thead>
                <tr>
                  <th>Sales Channel Code & Name</th>
                  <th>Channel Classification</th>
                  <th>Standard Margin (%)</th>
                  <th>Margin Computation Type</th>
                  <th>Default Credit Days</th>
                  <th>Collateral / Security Deposit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salesChannels.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--vf-slate-900)' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontFamily: 'monospace' }}>{c.code}</div>
                    </td>
                    <td>
                      <span className="vf-badge" style={{ background: c.isReseller ? '#eff6ff' : '#f1f5f9', color: c.isReseller ? '#1d4ed8' : 'var(--vf-slate-700)' }}>
                        {c.isReseller ? 'Commercial Reseller' : 'Direct Supply'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '14px', color: '#1d4ed8' }}>{c.standardMarginPercent}%</strong>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--vf-slate-700)' }}>
                      {c.marginType}
                    </td>
                    <td style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      {c.defaultCreditDays} Days
                    </td>
                    <td>
                      <span className={`vf-badge ${c.requiresDeposit ? 'vf-badge-warning' : 'vf-badge-approved'}`}>
                        {c.requiresDeposit ? 'Deposit Required' : 'Exempt'}
                      </span>
                    </td>
                    <td>
                      <span className={`vf-badge ${c.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: APPROVED PARTNER OVERRIDES */}
      {activeSubTab === 'overrides' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--vf-slate-600)' }}>
            Active partner-specific deviations from channel benchmarks formally authorized under principal commercial governance.
          </div>

          <div className="vf-table-container">
            <table className="vf-table">
              <thead>
                <tr>
                  <th>Partner Name & Code</th>
                  <th>Sales Channel</th>
                  <th>Channel Default</th>
                  <th>Approved Override</th>
                  <th>Approved By & Date</th>
                  <th>Contract Justification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedDeviations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--vf-slate-400)' }}>
                      No partner commercial overrides currently approved. All assignments using channel defaults.
                    </td>
                  </tr>
                ) : (
                  approvedDeviations.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong style={{ color: 'var(--vf-slate-900)' }}>{a.partnerName}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{a.partnerCode} • {a.partnerTier}</div>
                      </td>
                      <td>
                        <span className="vf-badge" style={{ background: '#f1f5f9', fontWeight: 600 }}>
                          {a.salesChannelName}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                        {a.commercialOverride?.channelDefaultDiscount || 12.0}%
                      </td>
                      <td>
                        <strong style={{ fontSize: '13px', color: '#047857' }}>
                          {a.commercialOverride?.overrideDiscountPercent}%
                        </strong>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <div>{a.commercialOverride?.approvedBy || 'Commercial Director'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>{a.commercialOverride?.approvedAt || 'Active'}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--vf-slate-700)' }}>
                        {a.commercialOverride?.requestReason || 'Strategic Key Account volume target agreement'}
                      </td>
                      <td>
                        <span className="vf-badge vf-badge-approved">
                          Authorized Deviation
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPROVE DEVIATION MODAL */}
      {selectedPendingAssignment && !isRejectModalOpen && (
        <div className="vf-modal-backdrop" onClick={() => setSelectedPendingAssignment(null)} style={{ zIndex: 1200 }}>
          <div className="vf-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                Authorize Commercial Margin Deviation
              </div>
              <button type="button" onClick={() => setSelectedPendingAssignment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', fontSize: '12.5px', color: 'var(--vf-slate-700)' }}>
                <div>Partner: <strong>{selectedPendingAssignment.partnerName}</strong> ({selectedPendingAssignment.partnerCode})</div>
                <div style={{ marginTop: '2px' }}>Channel: <strong>{selectedPendingAssignment.channelName}</strong></div>
                <div style={{ marginTop: '2px' }}>Channel Standard Margin: <strong>{selectedPendingAssignment.channelDefaultDiscount}%</strong></div>
              </div>

              <div>
                <label className="vf-form-label">Authorized Discount Override (%)</label>
                <input
                  type="number"
                  step="0.5"
                  className="vf-form-control vf-form-input"
                  value={approvedDiscount}
                  onChange={(e) => setApprovedDiscount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="vf-form-label">Director Authorization Comments / Audit Note</label>
                <textarea
                  className="vf-form-control vf-form-input"
                  rows={3}
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="Record commercial justification and delegation reference..."
                />
              </div>

              <div style={{ fontSize: '11.5px', color: '#047857', background: '#ecfdf5', padding: '8px 12px', borderRadius: '4px' }}>
                ✓ An approved deviation represents a compliant, valid business arrangement under principal commercial policy.
              </div>
            </div>

            <div className="vf-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setSelectedPendingAssignment(null)}>
                Cancel
              </button>
              <button type="button" className="vf-btn vf-btn-primary" onClick={handleConfirmApproval}>
                Confirm & Approve Deviation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT DEVIATION MODAL */}
      {selectedPendingAssignment && isRejectModalOpen && (
        <div className="vf-modal-backdrop" onClick={() => setIsRejectModalOpen(false)} style={{ zIndex: 1200 }}>
          <div className="vf-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                Reject Commercial Deviation
              </div>
              <button type="button" onClick={() => setIsRejectModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-700)' }}>
                Rejecting requested {selectedPendingAssignment.requestedDiscount}% discount for <strong>{selectedPendingAssignment.partnerName}</strong>.
              </div>

              <div>
                <label className="vf-form-label">Rejection Reason</label>
                <textarea
                  className="vf-form-control vf-form-input"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State reason (e.g. gross margin threshold not satisfied, tender rate caps)..."
                />
              </div>
            </div>

            <div className="vf-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="vf-btn vf-btn-danger" onClick={handleConfirmRejection}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
