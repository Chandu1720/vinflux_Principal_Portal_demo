import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { Partner } from '../../types/partner.ts';

interface InvitePartnerModalProps {
  partner: Partner;
  isOpen: boolean;
  onClose: () => void;
}

export const InvitePartnerModal: React.FC<InvitePartnerModalProps> = ({
  partner,
  isOpen,
  onClose
}) => {
  const {
    sendPartnerInvitation,
    resendPartnerInvitation,
    cancelPartnerInvitation,
    updatePartner,
    showToast
  } = useApp();

  if (!isOpen) return null;

  const isKycValid = partner.kycStatus === 'Verified' || partner.kycStatus === 'Pending Verification';
  const isKycDraft = partner.kycStatus === 'Draft';
  const isKycRejected = partner.kycStatus === 'Rejected';

  const handleSend = () => {
    const res = sendPartnerInvitation(partner.id);
    if (res.success) {
      onClose();
    }
  };

  const handleResend = () => {
    const res = resendPartnerInvitation(partner.id);
    if (res.success) {
      onClose();
    }
  };

  const handleCancel = () => {
    const res = cancelPartnerInvitation(partner.id);
    if (res.success) {
      onClose();
    }
  };

  // Prototype helper to simulate the partner receiving the email and accepting the invite
  const handleSimulateAccept = () => {
    updatePartner(partner.id, {
      invitationStatus: 'Accepted',
      invitationAcceptedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      portalAccessStatus: 'Active',
      lastActiveDate: 'Just now',
      portalUsers: [
        {
          id: `usr-${Date.now().toString().slice(-4)}`,
          name: partner.authorizedContactPerson,
          email: partner.officialEmail,
          role: 'Distributor Administrator (Ordering & Payments)',
          status: 'Active',
          lastLogin: 'Just now'
        }
      ]
    });
    showToast(`Simulated: Partner "${partner.name}" accepted invitation. Distribution Portal access is now ACTIVE!`, 'success');
    onClose();
  };

  return (
    <div
      className="vf-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="vf-drawer vf-drawer-md"
        style={{ width: '620px' }}
      >
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <h3 className="vf-drawer-title">
              Distribution Portal Invitation: {partner.name}
            </h3>
            <div className="vf-drawer-subtitle">
              Partner Code: <code>{partner.code}</code> · Email: <strong>{partner.officialEmail}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            className="vf-drawer-close"
            title="Close Drawer"
          >
            &times;
          </button>
        </div>

        <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Current Status Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                KYC Verification
              </div>
              <div style={{ marginTop: '4px' }}>
                <span
                  className={`vf-badge ${
                    partner.kycStatus === 'Verified'
                      ? 'vf-badge-approved'
                      : partner.kycStatus === 'Draft'
                      ? 'vf-badge-warning'
                      : partner.kycStatus === 'Rejected'
                      ? 'vf-badge-danger'
                      : 'vf-badge-pending'
                  }`}
                >
                  {partner.kycStatus}
                </span>
              </div>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                Invitation Status
              </div>
              <div style={{ marginTop: '4px' }}>
                <span
                  className={`vf-badge ${
                    partner.invitationStatus === 'Accepted'
                      ? 'vf-badge-approved'
                      : partner.invitationStatus === 'Invite Sent'
                      ? 'vf-badge-warning'
                      : partner.invitationStatus === 'Cancelled'
                      ? 'vf-badge-danger'
                      : ''
                  }`}
                  style={{
                    background: partner.invitationStatus === 'Not Invited' ? '#f1f5f9' : undefined,
                    color: partner.invitationStatus === 'Not Invited' ? '#475569' : undefined
                  }}
                >
                  {partner.invitationStatus}
                </span>
              </div>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                Portal Access Status
              </div>
              <div style={{ marginTop: '4px' }}>
                <span
                  className={`vf-badge ${
                    partner.portalAccessStatus === 'Active'
                      ? 'vf-badge-approved'
                      : partner.portalAccessStatus === 'Suspended'
                      ? 'vf-badge-danger'
                      : ''
                  }`}
                  style={{
                    background: partner.portalAccessStatus === 'Disabled' ? '#f1f5f9' : undefined,
                    color: partner.portalAccessStatus === 'Disabled' ? '#64748b' : undefined
                  }}
                >
                  {partner.portalAccessStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Invitation Timeline / Details */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="vf-breakdown-row">
                <span>Invited Email Destination</span>
                <strong>{partner.officialEmail}</strong>
              </div>
              {partner.invitationSentDate && (
                <div className="vf-breakdown-row">
                  <span>Invitation Sent Date</span>
                  <span>{partner.invitationSentDate}</span>
                </div>
              )}
              {partner.invitationExpiryDate && (
                <div className="vf-breakdown-row">
                  <span>Invitation Expiry Date</span>
                  <span>{partner.invitationExpiryDate}</span>
                </div>
              )}
              {partner.invitationAcceptedDate && (
                <div className="vf-breakdown-row">
                  <span>Invitation Accepted Date</span>
                  <strong style={{ color: 'var(--vf-success)' }}>{partner.invitationAcceptedDate}</strong>
                </div>
              )}
              {partner.lastActiveDate && (
                <div className="vf-breakdown-row">
                  <span>Last Portal Session</span>
                  <span>{partner.lastActiveDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Business Rules & Validation Notice */}
          {isKycDraft && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '12px', fontSize: '12.5px', color: '#92400e' }}>
              <strong>KYC Requirement Warning:</strong> Partner statutory KYC is currently in <strong>Draft</strong>. Per compliance rules, KYC verification is required before sending Distribution Portal invitations. Please complete and verify KYC documents in the partner profile.
            </div>
          )}

          {isKycRejected && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', fontSize: '12.5px', color: '#b91c1c' }}>
              <strong>KYC Rejected:</strong> Statutory verification was rejected. Portal invitations cannot be dispatched until valid regulatory documents are supplied.
            </div>
          )}

          {!isKycDraft && !isKycRejected && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px', fontSize: '12.5px', color: '#166534' }}>
              <strong>Governance Rule:</strong> Sending an invitation dispatches a single-use onboarding token. Access will remain <strong>Disabled</strong> until the partner accepts the terms and establishes credentials.
            </div>
          )}
        </div>

        <div
          className="vf-modal-footer"
          style={{
            padding: '14px 22px',
            backgroundColor: 'var(--vf-slate-50)',
            borderTop: '1px solid var(--vf-slate-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {/* Acceptance simulation test trigger for demonstration */}
          <div>
            {partner.invitationStatus === 'Invite Sent' && (
              <button
                type="button"
                className="vf-btn vf-btn-sm"
                style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '11.5px', fontWeight: 600 }}
                onClick={handleSimulateAccept}
                title="Simulate partner clicking email invitation link to accept"
              >
                ⚡ Simulate Partner Acceptance
              </button>
            )}
          </div>
        </div>

        <div className="vf-drawer-footer">
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>
            Close
          </button>

          {partner.invitationStatus === 'Invite Sent' && (
            <>
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={handleCancel}
                style={{ color: 'var(--vf-danger)' }}
              >
                Cancel Invitation
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                onClick={handleResend}
              >
                Resend Invitation
              </button>
            </>
          )}

          {(partner.invitationStatus === 'Not Invited' || partner.invitationStatus === 'Cancelled' || partner.invitationStatus === 'Expired') && (
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              disabled={!isKycValid}
              onClick={handleSend}
              style={{
                opacity: !isKycValid ? 0.5 : 1,
                cursor: !isKycValid ? 'not-allowed' : 'pointer',
                fontWeight: 700
              }}
            >
              Send Invitation &rarr;
            </button>
          )}

          {partner.invitationStatus === 'Accepted' && (
            <button
              type="button"
              className="vf-btn vf-btn-secondary"
              onClick={() => {
                updatePartner(partner.id, {
                  portalAccessStatus: partner.portalAccessStatus === 'Active' ? 'Suspended' : 'Active'
                });
                onClose();
              }}
            >
              {partner.portalAccessStatus === 'Active' ? 'Suspend Portal Access' : 'Reactivate Portal Access'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
