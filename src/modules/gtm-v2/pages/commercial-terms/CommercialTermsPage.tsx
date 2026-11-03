import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { CommercialTermEntry, CommercialTermProvenance } from '../../types/gtmV2.types';
import { SideDrawer } from '../../components/common/SideDrawer';

export const CommercialTermsPage: React.FC = () => {
  const {
    resolvedCommercialTerms,
    salesChannels,
    createApprovalRequest
  } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('All');
  const [selectedProvenance, setSelectedProvenance] = useState<string>('All');

  // Override Request Modal state
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CommercialTermEntry | null>(null);
  const [proposedDiscount, setProposedDiscount] = useState<number>(0);
  const [proposedCreditDays, setProposedCreditDays] = useState<number>(0);
  const [proposedCreditLimit, setProposedCreditLimit] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const filteredEntries = useMemo(() => {
    return resolvedCommercialTerms.filter((term) => {
      const matchSearch =
        term.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        term.partnerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        term.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        term.territoryName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchChannel = selectedChannelId === 'All' || term.channelId === selectedChannelId;
      const matchProvenance = selectedProvenance === 'All' || term.provenance === selectedProvenance;

      return matchSearch && matchChannel && matchProvenance;
    });
  }, [resolvedCommercialTerms, searchTerm, selectedChannelId, selectedProvenance]);

  const getProvenanceBadgeStyle = (prov: CommercialTermProvenance) => {
    switch (prov) {
      case 'Approved Relationship Terms':
        return { bg: '#EDE9FE', color: '#6D28D9', border: '#DDD6FE', label: 'L1: Approved Relationship' };
      case 'Approved Partner Terms':
        return { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0', label: 'L2: Approved Partner' };
      case 'Territory-Specific Terms':
        return { bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD', label: 'L3: Territory Rule' };
      case 'Default Sales Channel Terms':
      default:
        return { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', label: 'L4: Channel Default' };
    }
  };

  const handleOpenOverrideModal = (entry: CommercialTermEntry) => {
    setEditingEntry(entry);
    setProposedDiscount(entry.approvedDiscount);
    setProposedCreditDays(entry.creditPeriodDays);
    setProposedCreditLimit(entry.creditLimit);
    setOverrideReason('');
    setIsOverrideModalOpen(true);
  };

  const handleSubmitOverrideRequest = () => {
    if (!editingEntry) return;

    createApprovalRequest({
      requestType: 'Discount Override',
      partnerId: editingEntry.partnerId,
      partnerName: editingEntry.partnerName,
      partnerCode: editingEntry.partnerCode,
      requestedBy: 'Zonal Commercial Manager',
      description: `Deviation request for ${editingEntry.partnerName} in ${editingEntry.channelName}.`,
      proposedValues: {
        discountPercent: proposedDiscount,
        creditPeriodDays: proposedCreditDays,
        creditLimit: proposedCreditLimit
      },
      previousValues: {
        discountPercent: editingEntry.standardDiscount,
        creditPeriodDays: editingEntry.creditPeriodDays,
        creditLimit: editingEntry.creditLimit
      },
      justification: overrideReason.trim() || 'Key hospital chain annual volume commitment.'
    });

    setIsOverrideModalOpen(false);
    alert('Deviation approval request dispatched to the Commercial Director.');
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
              Commercial Terms & Precedence Resolution Engine
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
              4-Tier Precedence Waterfall
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Deterministic rule precedence resolution: Approved Relationship &gt; Approved Partner &gt; Territory &gt; Base Channel.
          </p>
        </div>

        {/* Precedence Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontWeight: 700, color: '#7C3AED' }}>L1 Relationship</span>
          <ArrowRight size={11} />
          <span style={{ fontWeight: 700, color: '#16A34A' }}>L2 Partner</span>
          <ArrowRight size={11} />
          <span style={{ fontWeight: 700, color: '#0284C7' }}>L3 Territory</span>
          <ArrowRight size={11} />
          <span style={{ fontWeight: 600, color: '#64748B' }}>L4 Channel Default</span>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FILTER & MATRIX CONTROLS */}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
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
              placeholder="Search partner, channel, territory..."
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

            <select
              value={selectedProvenance}
              onChange={(e) => setSelectedProvenance(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="All">All Precedence Levels</option>
              <option value="Approved Relationship Terms">L1: Approved Relationship</option>
              <option value="Approved Partner Terms">L2: Approved Partner</option>
              <option value="Territory-Specific Terms">L3: Territory Rule</option>
              <option value="Default Sales Channel Terms">L4: Channel Default</option>
            </select>
          </div>
        </div>

        {/* Terms Resolution Matrix Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 14px' }}>Partner Entity</th>
                <th style={{ padding: '10px 14px' }}>Channel & Territory</th>
                <th style={{ padding: '10px 14px' }}>Standard vs Resolved Discount</th>
                <th style={{ padding: '10px 14px' }}>Credit Days & Limit</th>
                <th style={{ padding: '10px 14px' }}>Security Deposit</th>
                <th style={{ padding: '10px 14px' }}>Resolution Provenance</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                    No commercial term entries match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((term) => {
                  const badge = getProvenanceBadgeStyle(term.provenance);
                  const isDiscountDifferent = term.approvedDiscount !== term.standardDiscount;

                  return (
                    <tr
                      key={term.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                            {term.partnerCode}
                          </span>
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{term.partnerName}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 500, color: '#334155' }}>{term.channelName}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          Territory: {term.territoryName}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#7C3AED' }}>
                            {term.approvedDiscount}%
                          </span>
                          {isDiscountDifferent && (
                            <span style={{ fontSize: '11px', color: '#94A3B8', textDecoration: 'line-through' }}>
                              {term.standardDiscount}%
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>
                          ₹{term.creditLimit.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          {term.creditPeriodDays} Days Credit
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12.5px', color: '#334155' }}>
                          {term.requiresDeposit ? `₹${term.depositAmount.toLocaleString()}` : 'Waived'}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenOverrideModal(term)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#7C3AED',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Request Deviation
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
      {/* DEVIATION REQUEST DRAWER */}
      {/* -------------------------------------------------------------------- */}
      {isOverrideModalOpen && editingEntry && (
        <SideDrawer
          isOpen={isOverrideModalOpen}
          onClose={() => setIsOverrideModalOpen(false)}
          title={`Commercial Deviation Request: ${editingEntry.partnerName}`}
          subtitle={`Current Term: ${editingEntry.approvedDiscount}% Discount • ${editingEntry.creditPeriodDays} Days`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px' }}>
              <AlertTriangle size={18} color="#B45309" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#92400E' }}>
                Any concessions deviating from <strong>{editingEntry.channelName}</strong> standard policies must undergo formal multi-tier commercial authorization.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Proposed Discount %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={proposedDiscount}
                  onChange={(e) => setProposedDiscount(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Proposed Credit Days
                </label>
                <input
                  type="number"
                  value={proposedCreditDays}
                  onChange={(e) => setProposedCreditDays(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Proposed Credit Limit (₹)
                </label>
                <input
                  type="number"
                  value={proposedCreditLimit}
                  onChange={(e) => setProposedCreditLimit(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Business Justification & Expected ROI *
              </label>
              <textarea
                rows={3}
                placeholder="Explain justification (e.g. exclusive multi-hospital tender contract, competitive displacement)..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setIsOverrideModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitOverrideRequest}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Submit Deviation Request
              </button>
            </div>
          </div>
        </SideDrawer>
      )}
    </div>
  );
};
