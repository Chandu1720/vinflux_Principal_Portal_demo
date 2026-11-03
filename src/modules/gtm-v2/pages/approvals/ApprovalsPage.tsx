import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { ApprovalRequest, ApprovalRequestStatus } from '../../types/gtmV2.types';
import { Modal } from '../../components/common/Modal';

export const ApprovalsPage: React.FC = () => {
  const { approvals, approveRequest, rejectRequest } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('Pending');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);

  // Decision Modal state
  const [decisionType, setDecisionType] = useState<'Approve' | 'Reject' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: approvals.length, Pending: 0, Approved: 0, Rejected: 0 };
    approvals.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      const matchSearch =
        a.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.partnerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.justification.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = selectedStatusTab === 'All' || a.status === selectedStatusTab;
      const matchType = selectedTypeFilter === 'All' || a.requestType === selectedTypeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [approvals, searchTerm, selectedStatusTab, selectedTypeFilter]);

  const handleExecuteDecision = () => {
    if (!selectedRequest || !decisionType) return;

    if (decisionType === 'Approve') {
      approveRequest(selectedRequest.id, decisionNotes.trim() || 'Approved by Commercial Director.');
    } else {
      rejectRequest(selectedRequest.id, decisionNotes.trim() || 'Rejected due to margin threshold constraint.');
    }

    setDecisionType(null);
    setSelectedRequest(null);
    setDecisionNotes('');
  };

  const getStatusBadge = (status: ApprovalRequestStatus) => {
    switch (status) {
      case 'Approved':
        return { bg: '#DCFCE7', color: '#16A34A', border: '#86EFAC' };
      case 'Rejected':
        return { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
      case 'Pending':
      default:
        return { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* -------------------------------------------------------------------- */}
      {/* HEADER */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
              Governance & Commercial Approvals Queue
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: statusCounts.Pending > 0 ? '#FEE2E2' : '#EDE9FE',
                color: statusCounts.Pending > 0 ? '#DC2626' : '#7C3AED',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}
            >
              {statusCounts.Pending} Action Required
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Review, audit, and authorize commercial terms deviations, KYC exceptions, and credit ceiling adjustments.
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FILTER TABS & SEARCH */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Status Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
          {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((status) => {
            const isSelected = selectedStatusTab === status;
            const count = statusCounts[status] || 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatusTab(status)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? '#7C3AED' : '#F8FAFC',
                  color: isSelected ? '#FFFFFF' : '#64748B',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <span>{status}</span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                    color: isSelected ? '#FFFFFF' : '#475569',
                    fontWeight: 700
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8'
              }}
            />
            <input
              type="text"
              placeholder="Search by partner or request..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 34px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} color="#64748B" />
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="All">All Request Types</option>
              <option value="Partner Onboarding">Partner Onboarding</option>
              <option value="KYC Verification">KYC Verification</option>
              <option value="Discount Override">Discount Override</option>
              <option value="Credit Limit Change">Credit Limit Change</option>
              <option value="Credit Period Extension">Credit Period Extension</option>
              <option value="Deposit Waiver">Deposit Waiver</option>
              <option value="Sales Flow Override">Sales Flow Override</option>
            </select>
          </div>
        </div>

        {/* Approvals Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 14px' }}>Request Type & ID</th>
                <th style={{ padding: '10px 14px' }}>Partner Entity</th>
                <th style={{ padding: '10px 14px' }}>Requested Variance</th>
                <th style={{ padding: '10px 14px' }}>Initiated By</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                    No approval requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredApprovals.map((req) => {
                  const badge = getStatusBadge(req.status);
                  return (
                    <tr
                      key={req.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{req.requestType}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          ID: {req.id} • {new Date(req.requestedAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{req.partnerName}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          Code: {req.partnerCode}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', color: '#334155' }}>
                          {req.proposedValues.discountPercent !== undefined && (
                            <span>
                              Discount: <strong>{req.proposedValues.discountPercent}%</strong> (was {req.previousValues?.discountPercent}%)
                            </span>
                          )}
                          {req.proposedValues.creditLimit !== undefined && (
                            <div>
                              Credit Limit: <strong>₹{(req.proposedValues.creditLimit / 100000).toFixed(1)}L</strong>
                            </div>
                          )}
                          {req.proposedValues.creditPeriodDays !== undefined && (
                            <div>
                              Credit Days: <strong>{req.proposedValues.creditPeriodDays} Days</strong>
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12.5px', color: '#334155' }}>{req.requestedBy}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {req.justification.slice(0, 35)}...
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          {req.status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#7C3AED',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {req.status === 'Pending' ? 'Review & Decide' : 'View Audit'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* AUDIT & DECISION MODAL */}
      {/* -------------------------------------------------------------------- */}
      {selectedRequest && (
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => {
            setSelectedRequest(null);
            setDecisionType(null);
          }}
          title={`Approval Audit: ${selectedRequest.requestType}`}
          subtitle={`Partner: ${selectedRequest.partnerName} (${selectedRequest.partnerCode})`}
          maxWidth="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>
                Application Details & Context
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B', lineHeight: '1.5' }}>
                {selectedRequest.description}
              </div>
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1', fontSize: '12px' }}>
                <span style={{ color: '#64748B' }}>Business Justification: </span>
                <strong style={{ color: '#0F172A' }}>{selectedRequest.justification}</strong>
              </div>
            </div>

            {/* Variance Comparison Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Standard / Previous Baseline
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                  <div>Discount: <strong>{selectedRequest.previousValues?.discountPercent ?? 'Default'}%</strong></div>
                  <div>Credit Limit: <strong>₹{selectedRequest.previousValues?.creditLimit?.toLocaleString() ?? 'Default'}</strong></div>
                  <div>Credit Period: <strong>{selectedRequest.previousValues?.creditPeriodDays ?? 'Default'} Days</strong></div>
                </div>
              </div>

              <div style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>
                  Proposed Concession / Variance
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                  <div>Discount: <strong style={{ color: '#7C3AED' }}>{selectedRequest.proposedValues.discountPercent ?? 'Unchanged'}%</strong></div>
                  <div>Credit Limit: <strong style={{ color: '#7C3AED' }}>₹{selectedRequest.proposedValues.creditLimit?.toLocaleString() ?? 'Unchanged'}</strong></div>
                  <div>Credit Period: <strong style={{ color: '#7C3AED' }}>{selectedRequest.proposedValues.creditPeriodDays ?? 'Unchanged'} Days</strong></div>
                </div>
              </div>
            </div>

            {/* Decision Input if Pending */}
            {selectedRequest.status === 'Pending' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Commercial Decision Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter decision rationale or conditions attached to this authorization..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionType('Reject');
                      handleExecuteDecision();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <XCircle size={15} />
                    <span>Reject Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDecisionType('Approve');
                      handleExecuteDecision();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Authorize & Approve</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#166534' }}>
                Decision logged by <strong>{selectedRequest.decisionBy || 'Commercial Director'}</strong> on{' '}
                {selectedRequest.decisionAt ? new Date(selectedRequest.decisionAt).toLocaleDateString() : 'Recent'}:{' '}
                "{selectedRequest.decisionNotes || 'Approved'}"
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
