import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  Eye,
  FileText,
  MapPin
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { PartnerOnboardingRecord, OnboardingStatus, KycDocStatus } from '../../types/gtmV2.types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { OnboardingWizardModal } from './OnboardingWizardModal';

export const PartnerOnboardingPage: React.FC = () => {
  const {
    partners,
    salesChannels,
    updatePartnerOnboarding,
    updatePartnerKycStatus
  } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('All');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('All');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [viewPartner, setViewPartner] = useState<PartnerOnboardingRecord | null>(null);

  // Status Counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: partners.length };
    partners.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [partners]);

  // Filtering
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.contactPerson && p.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = selectedStatusTab === 'All' || p.status === selectedStatusTab;
      const matchChannel = selectedChannelId === 'All' || p.partnerMappings.some((m) => m.flowId === selectedChannelId);

      return matchSearch && matchStatus && matchChannel;
    });
  }, [partners, searchTerm, selectedStatusTab, selectedChannelId]);

  const handleKycStatusChange = (partnerId: string, docId: string, newStatus: KycDocStatus) => {
    updatePartnerKycStatus(partnerId, docId, newStatus, `Updated via partner dossier on ${new Date().toLocaleDateString()}`);
    if (viewPartner && viewPartner.id === partnerId) {
      const updatedDocs = viewPartner.kycDocuments.map((d) =>
        d.id === docId ? { ...d, status: newStatus } : d
      );
      setViewPartner({ ...viewPartner, kycDocuments: updatedDocs });
    }
  };

  const handleTogglePartnerStatus = (partner: PartnerOnboardingRecord) => {
    const nextStatus: OnboardingStatus = partner.status === 'Active' ? 'Suspended' : 'Active';
    updatePartnerOnboarding(partner.id, { status: nextStatus });
    if (viewPartner && viewPartner.id === partner.id) {
      setViewPartner({ ...viewPartner, status: nextStatus });
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
              Partner Onboarding & Channel Accreditation
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#EDE9FE',
                color: '#7C3AED',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}
            >
              {partners.length} Total Partners
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Comprehensive 7-step onboarding lifecycle, statutory KYC compliance verification, and commercial terms governance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#7C3AED',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7C3AED')}
        >
          <UserPlus size={16} />
          <span>Onboard New Partner</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* STATUS TABS & SEARCH CONTROLS */}
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
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
          {['All', 'Active', 'Approval Pending', 'KYC Under Review', 'Draft', 'Rejected', 'Suspended'].map((status) => {
            const count = statusCounts[status] || 0;
            const isSelected = selectedStatusTab === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatusTab(status)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
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

        {/* Filter Bar */}
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
              placeholder="Search partner code, name, GSTIN..."
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
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="All">All Channels</option>
              {salesChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Partners Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 14px' }}>Partner Entity & Code</th>
                <th style={{ padding: '10px 14px' }}>Classification</th>
                <th style={{ padding: '10px 14px' }}>Territory Assignment</th>
                <th style={{ padding: '10px 14px' }}>Commercial Terms</th>
                <th style={{ padding: '10px 14px' }}>KYC Compliance</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                    No partner records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => {
                  const verifiedKycCount = partner.kycDocuments.filter((d) => d.status === 'Verified').length;
                  const totalKycCount = partner.kycDocuments.length;
                  const primaryTerritoryName = partner.assignedTerritoryNames?.[0] || 'Unassigned';

                  return (
                    <tr
                      key={partner.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                            {partner.code}
                          </span>
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{partner.name}</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          GSTIN: {partner.gstin} • {partner.contactPerson} ({partner.phone})
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          {partner.partnerType}
                        </span>
                        <div style={{ fontSize: '11px', color: '#7C3AED', marginTop: '2px' }}>
                          {partner.partnerMappings[0]?.stageChannelName || 'Direct'}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: '#0F172A', fontWeight: 500 }}>
                          <MapPin size={13} color="#7C3AED" />
                          <span>{primaryTerritoryName}</span>
                        </div>
                        {partner.assignedTerritoryIds.length > 1 && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            +{partner.assignedTerritoryIds.length - 1} additional territories
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>
                            {partner.commercialTerms.effectiveDiscount}%
                          </span>
                          <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                            ({partner.commercialTerms.effectiveCreditDays}d / ₹{(partner.commercialTerms.effectiveCreditLimit / 100000).toFixed(1)}L)
                          </span>
                        </div>
                        {partner.commercialTerms.isDiscountOverridden && (
                          <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#B45309', padding: '1px 5px', borderRadius: '4px' }}>
                            Custom Overridden
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: verifiedKycCount === totalKycCount ? '#DCFCE7' : '#FEF3C7',
                              color: verifiedKycCount === totalKycCount ? '#16A34A' : '#B45309',
                              padding: '2px 8px',
                              borderRadius: '9999px'
                            }}
                          >
                            {verifiedKycCount} / {totalKycCount} Verified
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={partner.status} />
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setViewPartner(partner)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#F8FAFC',
                              color: '#475569',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="View Full Profile & KYC Dossier"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                        </div>
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
      {/* PARTNER PROFILE & KYC DOSSIER MODAL */}
      {/* -------------------------------------------------------------------- */}
      {viewPartner && (
        <Modal
          isOpen={!!viewPartner}
          onClose={() => setViewPartner(null)}
          title={`Partner Dossier: ${viewPartner.name}`}
          subtitle={`Code: ${viewPartner.code} • GSTIN: ${viewPartner.gstin}`}
          maxWidth="2xl"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Ribbon */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{viewPartner.businessName}</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {viewPartner.partnerType} • {viewPartner.contactPerson} ({viewPartner.email})
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge status={viewPartner.status} />
                <button
                  type="button"
                  onClick={() => handleTogglePartnerStatus(viewPartner)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: viewPartner.status === 'Active' ? '#EF4444' : '#10B981',
                    cursor: 'pointer'
                  }}
                >
                  {viewPartner.status === 'Active' ? 'Suspend Account' : 'Activate Partner'}
                </button>
              </div>
            </div>

            {/* Entity Attributes Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12.5px' }}>
              <div style={{ padding: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                <span style={{ color: '#64748B' }}>Primary Territory:</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  {viewPartner.assignedTerritoryNames?.[0] || 'Unassigned'}
                </div>
              </div>

              <div style={{ padding: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                <span style={{ color: '#64748B' }}>PAN Number:</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  {viewPartner.pan}
                </div>
              </div>

              <div style={{ padding: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                <span style={{ color: '#64748B' }}>Commercial Discount:</span>
                <div style={{ fontWeight: 600, color: '#7C3AED', marginTop: '2px' }}>
                  {viewPartner.commercialTerms.effectiveDiscount}% {viewPartner.commercialTerms.isDiscountOverridden ? '(Overridden)' : '(Standard)'}
                </div>
              </div>

              <div style={{ padding: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                <span style={{ color: '#64748B' }}>Credit Line & Terms:</span>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  ₹{viewPartner.commercialTerms.effectiveCreditLimit.toLocaleString()} • {viewPartner.commercialTerms.effectiveCreditDays} Days
                </div>
              </div>
            </div>

            {/* Statutory KYC Verification Section */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#FFFFFF' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Statutory KYC Verification Dossier ({viewPartner.kycDocuments.length} Documents)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {viewPartner.kycDocuments.map((doc) => {
                  const isVerified = doc.status === 'Verified';
                  const isRejected = doc.status === 'Rejected';
                  return (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={16} color="#64748B" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{doc.documentType}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Doc #{doc.documentNumber || 'N/A'} • {doc.fileName || 'Pending upload'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: isVerified ? '#DCFCE7' : isRejected ? '#FEE2E2' : '#FEF3C7',
                            color: isVerified ? '#16A34A' : isRejected ? '#DC2626' : '#B45309'
                          }}
                        >
                          {doc.status}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleKycStatusChange(viewPartner.id, doc.id, 'Verified')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #86EFAC',
                            backgroundColor: '#F0FDF4',
                            color: '#16A34A',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Verify
                        </button>

                        <button
                          type="button"
                          onClick={() => handleKycStatusChange(viewPartner.id, doc.id, 'Rejected')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setViewPartner(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* ONBOARDING 7-STEP WIZARD MODAL */}
      {/* -------------------------------------------------------------------- */}
      {isWizardOpen && (
        <OnboardingWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={(newPartner) => {
            setViewPartner(newPartner);
          }}
        />
      )}
    </div>
  );
};
