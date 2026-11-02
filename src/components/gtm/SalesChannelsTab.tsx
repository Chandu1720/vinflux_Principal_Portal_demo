import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { SalesChannel, PartnerChannelAssignment } from '../../types/gtm.ts';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Edit3, 
  Trash2, 
  X
} from 'lucide-react';

export const SalesChannelsTab: React.FC = () => {
  const {
    salesChannels,
    partners,
    territories,
    addSalesChannel,
    updateSalesChannel,
    addPartnerChannelAssignment,
    updatePartnerChannelAssignment,
    deletePartnerChannelAssignment,
    showToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'channels' | 'assignments'>('assignments');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCommercial, setFilterCommercial] = useState('ALL');

  // Channel Master Modal
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [isReseller, setIsReseller] = useState(true);
  const [standardMargin, setStandardMargin] = useState(12.0);
  const [marginType, setMarginType] = useState('Price to Distributor (PTD)');
  const [requiresDeposit, setRequiresDeposit] = useState(true);
  const [defaultCreditDays, setDefaultCreditDays] = useState(45);
  const [channelStatus, setChannelStatus] = useState<'Active' | 'Inactive'>('Active');

  // Assign Channel to Partner Drawer
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(partners[0]?.id || '');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(salesChannels[0]?.id || '');
  const [territoryScope, setTerritoryScope] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().substring(0, 10));
  const [assignmentStatus, setAssignmentStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isDeviated, setIsDeviated] = useState(false);
  const [overrideDiscount, setOverrideDiscount] = useState<number>(14.0);
  const [deviationReason, setDeviationReason] = useState('');

  // Flatten all partner-channel assignments
  const allAssignments = useMemo(() => {
    const list: (PartnerChannelAssignment & { partnerName: string; partnerCode: string; partnerStatus: string })[] = [];
    partners.forEach((p) => {
      (p.channelAssignments || []).forEach((ca) => {
        list.push({
          ...ca,
          partnerName: p.name,
          partnerCode: p.code,
          partnerStatus: p.status
        });
      });
    });
    return list;
  }, [partners]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return allAssignments.filter((a) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesPartner = a.partnerName.toLowerCase().includes(q) || a.partnerCode.toLowerCase().includes(q);
        const matchesChannel = a.salesChannelName.toLowerCase().includes(q) || a.salesChannelCode.toLowerCase().includes(q);
        if (!matchesPartner && !matchesChannel) return false;
      }
      if (filterChannel !== 'ALL' && a.salesChannelId !== filterChannel) return false;
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
      if (filterCommercial !== 'ALL') {
        if (filterCommercial === 'STANDARD' && a.commercialTermStatus !== 'Standard') return false;
        if (filterCommercial === 'DEVIATED' && !a.commercialTermStatus?.startsWith('Deviated')) return false;
        if (filterCommercial === 'PENDING' && a.commercialTermStatus !== 'Deviated — Pending Approval') return false;
      }
      return true;
    });
  }, [allAssignments, searchTerm, filterChannel, filterStatus, filterCommercial]);

  // Unique partner metrics
  const metrics = useMemo(() => {
    const totalAssignments = allAssignments.length;
    const uniquePartnersWithChannels = new Set(allAssignments.map((a) => a.partnerId)).size;
    const standardCount = allAssignments.filter((a) => a.commercialTermStatus === 'Standard').length;
    const deviatedCount = allAssignments.filter((a) => a.commercialTermStatus?.startsWith('Deviated')).length;
    const pendingCount = allAssignments.filter((a) => a.commercialTermStatus === 'Deviated — Pending Approval').length;
    return { totalAssignments, uniquePartnersWithChannels, standardCount, deviatedCount, pendingCount };
  }, [allAssignments]);

  const openCreateChannel = () => {
    setEditingChannel(null);
    setChannelName('');
    setChannelCode(`CHAN-${Math.floor(100 + Math.random() * 900)}`);
    setChannelDesc('');
    setIsReseller(true);
    setStandardMargin(12.0);
    setMarginType('Price to Distributor (PTD)');
    setRequiresDeposit(true);
    setDefaultCreditDays(45);
    setChannelStatus('Active');
    setIsChannelModalOpen(true);
  };

  const openEditChannel = (ch: SalesChannel) => {
    setEditingChannel(ch);
    setChannelName(ch.name);
    setChannelCode(ch.code);
    setChannelDesc(ch.description);
    setIsReseller(ch.isReseller);
    setStandardMargin(ch.standardMarginPercent);
    setMarginType(ch.marginType);
    setRequiresDeposit(ch.requiresDeposit);
    setDefaultCreditDays(ch.defaultCreditDays);
    setChannelStatus(ch.status);
    setIsChannelModalOpen(true);
  };

  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) {
      showToast('Channel name is mandatory.', 'warning');
      return;
    }

    if (editingChannel) {
      updateSalesChannel(editingChannel.id, {
        name: channelName.trim(),
        code: channelCode.trim().toUpperCase(),
        description: channelDesc.trim(),
        isReseller,
        standardMarginPercent: Number(standardMargin),
        marginType,
        requiresDeposit,
        defaultCreditDays: Number(defaultCreditDays),
        status: channelStatus
      });
      showToast(`Sales channel "${channelName}" updated.`, 'info');
    } else {
      const newCh: SalesChannel = {
        id: `ct-${Date.now()}`,
        code: channelCode.trim().toUpperCase(),
        name: channelName.trim(),
        description: channelDesc.trim(),
        isReseller,
        standardMarginPercent: Number(standardMargin),
        marginType,
        requiresDeposit,
        defaultCreditDays: Number(defaultCreditDays),
        status: channelStatus
      };
      addSalesChannel(newCh);
      showToast(`Sales channel "${channelName}" created.`, 'success');
    }

    setIsChannelModalOpen(false);
  };

  const openAssignDrawer = () => {
    setSelectedPartnerId(partners[0]?.id || '');
    setSelectedChannelId(salesChannels[0]?.id || '');
    setTerritoryScope([]);
    setEffectiveFrom(new Date().toISOString().substring(0, 10));
    setAssignmentStatus('Active');
    setIsDeviated(false);
    setOverrideDiscount(14.0);
    setDeviationReason('');
    setIsAssignDrawerOpen(true);
  };

  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const partner = partners.find((p) => p.id === selectedPartnerId);
    const channel = salesChannels.find((c) => c.id === selectedChannelId);

    if (!partner || !channel) return;

    // Check if partner already has this channel assigned
    const existing = (partner.channelAssignments || []).find((ca) => ca.salesChannelId === channel.id);
    if (existing) {
      showToast(`Partner "${partner.name}" is already assigned to "${channel.name}".`, 'warning');
      return;
    }

    const defaultMargin = channel.standardMarginPercent;

    addPartnerChannelAssignment(partner.id, {
      salesChannelId: channel.id,
      salesChannelName: channel.name,
      salesChannelCode: channel.code,
      territoryScope: territoryScope.length > 0 ? territoryScope : partner.assignedTerritoryIds,
      effectiveFrom,
      status: assignmentStatus,
      commercialTermStatus: isDeviated ? 'Deviated — Pending Approval' : 'Standard',
      commercialOverride: {
        channelDefaultDiscount: defaultMargin,
        overrideDiscountPercent: isDeviated ? Number(overrideDiscount) : null,
        requestedDiscount: isDeviated ? Number(overrideDiscount) : defaultMargin,
        requestReason: deviationReason.trim() || (isDeviated ? 'Commercial incentive request' : 'Standard terms'),
        approvalHistory: []
      },
      notes: isDeviated ? 'Commercial deviation submitted for Director approval' : 'Standard channel assignment'
    });

    setIsAssignDrawerOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} className="text-blue-600" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
              Sales Channel Management & Partner Assignments
            </h2>
            <span className="vf-badge vf-badge-approved">Multi-Channel Architecture</span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
            Govern master sales channels and model each partner's multi-channel relationships as distinct, independent assignments.
          </p>
        </div>

        {/* Sub-tab Switches & Primary Action */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
            <button
              type="button"
              className={`vf-tab-btn ${activeSubTab === 'assignments' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('assignments')}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
            >
              Partner-Channel Assignments ({allAssignments.length})
            </button>
            <button
              type="button"
              className={`vf-tab-btn ${activeSubTab === 'channels' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('channels')}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
            >
              Sales Channel Master ({salesChannels.length})
            </button>
          </div>

          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={activeSubTab === 'assignments' ? openAssignDrawer : openCreateChannel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
          >
            <Plus size={15} />
            <span>{activeSubTab === 'assignments' ? 'Assign Channel to Partner' : 'New Sales Channel'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Channel Assignments</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{metrics.totalAssignments}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Total partner-channel mappings</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Unique Partners</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1d4ed8' }}>{metrics.uniquePartnersWithChannels}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Distinct partner entities</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Standard Terms</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857' }}>{metrics.standardCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Using channel baseline</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Deviated Overrides</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>{metrics.deviatedCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Negotiated partner terms</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Pending Approvals</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: metrics.pendingCount > 0 ? '#dc2626' : 'var(--vf-slate-800)' }}>
            {metrics.pendingCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Requires commercial sign-off</div>
        </div>
      </div>

      {/* SUBTAB 1: PARTNER-CHANNEL ASSIGNMENT REGISTRY */}
      {activeSubTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Filters Bar */}
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--vf-slate-400)' }} />
              <input
                type="text"
                className="vf-form-control vf-form-input vf-search-input"
                style={{ paddingLeft: '30px', fontSize: '12px', height: '32px' }}
                placeholder="Search by partner name, code, or channel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="vf-form-control vf-form-select"
              style={{ width: '180px', fontSize: '12px', height: '32px' }}
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
            >
              <option value="ALL">All Sales Channels</option>
              {salesChannels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              className="vf-form-control vf-form-select"
              style={{ width: '170px', fontSize: '12px', height: '32px' }}
              value={filterCommercial}
              onChange={(e) => setFilterCommercial(e.target.value)}
            >
              <option value="ALL">All Commercial Statuses</option>
              <option value="STANDARD">Standard Terms Only</option>
              <option value="DEVIATED">Deviated Terms (All)</option>
              <option value="PENDING">Pending Approval Only</option>
            </select>

            <select
              className="vf-form-control vf-form-select"
              style={{ width: '140px', fontSize: '12px', height: '32px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Assignments Table */}
          <div className="vf-table-container">
            <table className="vf-table">
              <thead>
                <tr>
                  <th>Partner Name & Code</th>
                  <th>Sales Channel</th>
                  <th>Territory Scope</th>
                  <th>Channel Default</th>
                  <th>Effective Terms</th>
                  <th>Commercial Status</th>
                  <th>Assignment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--vf-slate-400)' }}>
                      No partner-channel assignments match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a) => {
                    const defaultMargin = a.commercialOverride?.channelDefaultDiscount ?? 12.0;
                    const effectiveDiscount = a.commercialOverride?.overrideDiscountPercent ?? defaultMargin;

                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--vf-slate-900)' }}>{a.partnerName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{a.partnerCode}</div>
                        </td>
                        <td>
                          <span className="vf-badge" style={{ background: '#f1f5f9', fontWeight: 600 }}>
                            {a.salesChannelName}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(a.territoryScope || []).map((tid) => {
                              const terr = territories.find((t) => t.id === tid);
                              return (
                                <span key={tid} className="vf-badge" style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8' }}>
                                  {terr?.name || tid}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                          {defaultMargin}% margin
                        </td>
                        <td>
                          <strong style={{ color: a.commercialTermStatus?.startsWith('Deviated') ? '#b45309' : '#047857' }}>
                            {effectiveDiscount}%
                          </strong>
                          {a.commercialOverride?.overrideCreditPeriodDays && (
                            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-500)' }}>
                              {a.commercialOverride.overrideCreditPeriodDays} Days credit
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`vf-badge ${a.commercialTermStatus === 'Deviated — Approved' ? 'vf-badge-approved' : a.commercialTermStatus === 'Deviated — Pending Approval' ? 'vf-badge-warning' : 'vf-badge-active'}`}>
                            {a.commercialTermStatus}
                          </span>
                        </td>
                        <td>
                          <span className={`vf-badge ${a.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary"
                              onClick={() => {
                                const next = a.status === 'Active' ? 'Inactive' : 'Active';
                                updatePartnerChannelAssignment(a.partnerId, a.id, { status: next });
                              }}
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              title="Toggle active status"
                            >
                              {a.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePartnerChannelAssignment(a.partnerId, a.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Remove assignment"
                            >
                              <Trash2 size={13} />
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
      )}

      {/* SUBTAB 2: SALES CHANNELS MASTER */}
      {activeSubTab === 'channels' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
          {salesChannels.map((ch) => {
            const assignedCount = allAssignments.filter((a) => a.salesChannelId === ch.id).length;

            return (
              <div
                key={ch.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid var(--vf-slate-200)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                      {ch.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)', fontFamily: 'monospace' }}>
                      Code: {ch.code} • {ch.isReseller ? 'Reseller Channel' : 'Direct Channel'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`vf-badge ${ch.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                      {ch.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditChannel(ch)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vf-slate-500)', padding: '4px' }}
                      title="Edit channel"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: 'var(--vf-slate-600)', lineHeight: '1.4' }}>
                  {ch.description}
                </p>

                {/* Terms Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-500)' }}>Default Margin</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1d4ed8' }}>{ch.standardMarginPercent}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-500)' }}>Credit Period</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>{ch.defaultCreditDays} Days</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-500)' }}>Deposit Req.</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: ch.requiresDeposit ? '#b45309' : '#047857' }}>
                      {ch.requiresDeposit ? 'Mandatory' : 'Exempt'}
                    </div>
                  </div>
                </div>

                {/* Footer Count */}
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--vf-slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                    <strong>{assignedCount}</strong> Partner Assignments
                  </div>
                  <span className="vf-badge" style={{ background: '#f1f5f9', fontSize: '11px' }}>
                    Margin: {ch.marginType}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN CHANNEL TO PARTNER DRAWER */}
      {isAssignDrawerOpen && (
        <div className="vf-drawer-overlay" onClick={() => setIsAssignDrawerOpen(false)} style={{ zIndex: 1100 }}>
          <div className="vf-drawer" style={{ width: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-drawer-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                Assign Sales Channel to Partner
              </div>
              <button type="button" onClick={() => setIsAssignDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="vf-drawer-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
                <div>
                  <label className="vf-form-label">Select Partner *</label>
                  <select className="vf-form-control vf-form-select" value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)}>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="vf-form-label">Select Sales Channel *</label>
                  <select className="vf-form-control vf-form-select" value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>
                    {salesChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) — Default Margin: {c.standardMarginPercent}%
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="vf-form-label">Territory Scope (Select Applicable Territories)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', maxHeight: '140px', overflowY: 'auto', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                    {territories.map((t) => {
                      const isChecked = territoryScope.includes(t.id);
                      return (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTerritoryScope((prev) => [...prev, t.id]);
                              } else {
                                setTerritoryScope((prev) => prev.filter((id) => id !== t.id));
                              }
                            }}
                          />
                          <span>{t.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Effective From Date</label>
                    <input type="date" className="vf-form-control vf-form-input" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="vf-form-label">Assignment Status</label>
                    <select className="vf-form-control vf-form-select" value={assignmentStatus} onChange={(e) => setAssignmentStatus(e.target.value as any)}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Commercial Terms Section */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                      Commercial Terms Specification
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isDeviated}
                        onChange={(e) => setIsDeviated(e.target.checked)}
                      />
                      <strong>Request Commercial Deviation</strong>
                    </label>
                  </div>

                  {!isDeviated ? (
                    <div style={{ fontSize: '12px', color: '#047857', background: '#ecfdf5', padding: '8px 12px', borderRadius: '4px' }}>
                      ✓ Standard Terms: Partner will inherit channel default margin ({salesChannels.find((c) => c.id === selectedChannelId)?.standardMarginPercent}%) and standard credit period.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label className="vf-form-label">Negotiated / Requested Discount Margin (%)</label>
                        <input
                          type="number"
                          step="0.5"
                          className="vf-form-control vf-form-input"
                          value={overrideDiscount}
                          onChange={(e) => setOverrideDiscount(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="vf-form-label">Deviation Justification (Will be queued for approval)</label>
                        <textarea
                          className="vf-form-control vf-form-input"
                          rows={2}
                          value={deviationReason}
                          onChange={(e) => setDeviationReason(e.target.value)}
                          placeholder="Explain strategic volume target or regional competitive pricing..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="vf-drawer-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc' }}>
                <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setIsAssignDrawerOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="vf-btn vf-btn-primary">
                  Save Channel Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALES CHANNEL CREATE / EDIT MODAL */}
      {isChannelModalOpen && (
        <div className="vf-modal-backdrop" onClick={() => setIsChannelModalOpen(false)} style={{ zIndex: 1200 }}>
          <div className="vf-modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                {editingChannel ? `Edit Channel: ${editingChannel.name}` : 'Create Master Sales Channel'}
              </div>
              <button type="button" onClick={() => setIsChannelModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Channel Name *</label>
                    <input type="text" className="vf-form-control vf-form-input" value={channelName} onChange={(e) => setChannelName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="vf-form-label">Channel Code *</label>
                    <input type="text" className="vf-form-control vf-form-input" value={channelCode} onChange={(e) => setChannelCode(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Channel Description</label>
                  <textarea className="vf-form-control vf-form-input" rows={2} value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Standard Margin (%)</label>
                    <input type="number" step="0.5" className="vf-form-control vf-form-input" value={standardMargin} onChange={(e) => setStandardMargin(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="vf-form-label">Default Credit Days</label>
                    <input type="number" className="vf-form-control vf-form-input" value={defaultCreditDays} onChange={(e) => setDefaultCreditDays(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="vf-form-label">Status</label>
                    <select className="vf-form-control vf-form-select" value={channelStatus} onChange={(e) => setChannelStatus(e.target.value as any)}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Margin Type</label>
                    <input type="text" className="vf-form-control vf-form-input" value={marginType} onChange={(e) => setMarginType(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', paddingTop: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isReseller} onChange={(e) => setIsReseller(e.target.checked)} />
                      <span>Commercial Reseller</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={requiresDeposit} onChange={(e) => setRequiresDeposit(e.target.checked)} />
                      <span>Mandatory Security Deposit</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="vf-modal-footer" style={{ padding: '14px 20px', background: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setIsChannelModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="vf-btn vf-btn-primary">
                  Save Sales Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
