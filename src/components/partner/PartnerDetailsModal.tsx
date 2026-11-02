import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { 
  Partner, 
  PartnerDistributionAssignment 
} from '../../types/partner';
import { 
  RotateCcw, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Send,
  Lock,
  Unlock
} from 'lucide-react';

interface PartnerDetailsModalProps {
  partner: Partner | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInviteModal?: (partner: Partner) => void;
}

export const PartnerDetailsModal: React.FC<PartnerDetailsModalProps> = ({
  partner,
  isOpen,
  onClose
}) => {
  const { 
    territories, 
    distributionRoutes,
    branches, 
    warehouses, 
    addPartnerDistributionAssignment, 
    deletePartnerDistributionAssignment,
    updatePartnerCommercialOverride,
    resetPartnerCommercialOverride,
    togglePartnerCreditHold,
    sendPartnerInvitation,
    resendPartnerInvitation,
    cancelPartnerInvitation,
    updatePartner,
    showToast 
  } = useApp();

  // Active tab: 'overview' | 'classification' | 'channels' | 'kyc' | 'territories' | 'supply' | 'commercial' | 'portal'
  const [activeTab, setActiveTab] = useState<
    'overview' | 'classification' | 'channels' | 'kyc' | 'territories' | 'supply' | 'commercial' | 'portal'
  >('overview');

  // Supply assignment inline add state
  const [newTerritoryId, setNewTerritoryId] = useState('');
  const [newBranchId, setNewBranchId] = useState('');
  const [newWarehouseId, setNewWarehouseId] = useState('');
  const [newAsgnType, setNewAsgnType] = useState<PartnerDistributionAssignment['assignmentType']>('Primary Invoicing & Dispatch');
  const [newIsPrimary, setNewIsPrimary] = useState(false);

  // Commercial override edit state: map of territoryId -> { discount, limit, period, reason }
  const [editingCommercialTerritoryId, setEditingCommercialTerritoryId] = useState<string | null>(null);
  const [overrideDiscountInput, setOverrideDiscountInput] = useState<string>('');
  const [overrideLimitInput, setOverrideLimitInput] = useState<string>('');
  const [overridePeriodInput, setOverridePeriodInput] = useState<string>('');
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>('');

  // Active branches & warehouses
  const activeBranches = useMemo(() => branches.filter((b) => b.status === 'Active'), [branches]);
  const activeWarehouses = useMemo(() => warehouses.filter((w) => w.status === 'Active'), [warehouses]);

  // Branch filtered warehouses for inline assignment
  const branchFilteredWarehouses = useMemo(() => {
    return activeWarehouses.filter((w) => w.branchId === newBranchId);
  }, [activeWarehouses, newBranchId]);

  if (!isOpen || !partner) return null;

  const handleBranchChange = (bId: string) => {
    setNewBranchId(bId);
    const available = activeWarehouses.filter((w) => w.branchId === bId);
    setNewWarehouseId(available[0]?.id || '');
  };

  const handleAddSupplyLinkage = () => {
    const tId = newTerritoryId || partner.assignedTerritoryIds[0];
    const bId = newBranchId || activeBranches[0]?.id;
    const wId = newWarehouseId || activeWarehouses.find((w) => w.branchId === bId)?.id;

    if (!tId || !bId || !wId) {
      showToast('Please select territory, branch, and warehouse.', 'warning');
      return;
    }

    const res = addPartnerDistributionAssignment(partner.id, {
      territoryId: tId,
      branchId: bId,
      warehouseId: wId,
      assignmentType: newAsgnType,
      isPrimary: newIsPrimary,
      effectiveFrom: new Date().toISOString().substring(0, 10),
      status: 'Active',
      notes: 'Added from Partner Details view'
    });

    if (res.success) {
      setNewTerritoryId('');
      setNewBranchId('');
      setNewWarehouseId('');
    }
  };

  const handleStartEditCommercial = (tId: string) => {
    const currentComm = partner.territoryCommercials[tId];
    setEditingCommercialTerritoryId(tId);
    setOverrideDiscountInput(currentComm?.partnerOverrideDiscount !== null && currentComm?.partnerOverrideDiscount !== undefined ? String(currentComm.partnerOverrideDiscount) : '');
    setOverrideLimitInput(currentComm?.creditLimitOverride !== null && currentComm?.creditLimitOverride !== undefined ? String(currentComm.creditLimitOverride) : '');
    setOverridePeriodInput(currentComm?.creditPeriodOverride !== null && currentComm?.creditPeriodOverride !== undefined ? String(currentComm.creditPeriodOverride) : '');
    setOverrideReasonInput('');
  };

  const handleSaveCommercialOverride = (tId: string) => {
    const disc = overrideDiscountInput === '' ? null : parseFloat(overrideDiscountInput);
    const limit = overrideLimitInput === '' ? null : parseInt(overrideLimitInput);
    const period = overridePeriodInput === '' ? null : parseInt(overridePeriodInput);

    updatePartnerCommercialOverride(
      partner.id,
      tId,
      {
        overrideDiscountPercent: disc,
        overrideCreditLimit: limit,
        overrideCreditPeriodDays: period
      },
      overrideReasonInput || 'Commercial adjustment via Partner Details'
    );

    setEditingCommercialTerritoryId(null);
  };

  return (
    <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-drawer vf-drawer-2xl" style={{ width: '960px' }}>
        
        {/* Header */}
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="vf-drawer-title">
                {partner.name}
              </h2>
              <span className="vf-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                {partner.typeName}
              </span>
              <span className={`vf-badge ${partner.classification?.performanceTierId === 'tier-plat' ? 'vf-badge-approved' : 'vf-badge-active'}`}>
                {partner.classification?.performanceTierName || 'Standard Tier'}
              </span>
              <span className={`vf-badge ${partner.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>
                {partner.lifecycleStatus || partner.status}
              </span>
              {partner.creditHold && (
                <span className="vf-badge vf-badge-danger">On Credit Hold</span>
              )}
            </div>
            <div className="vf-drawer-subtitle">
              Code: <code>{partner.code}</code> · Topology Level: <strong>{partner.classification?.distributionLevelName || 'Tier 2 Stockist'}</strong> · GSTIN: <strong>{partner.gstin || 'None'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="vf-btn vf-btn-secondary vf-btn-xs"
              onClick={() => togglePartnerCreditHold(partner.id)}
            >
              {partner.creditHold ? <Unlock size={12} style={{ marginRight: '4px' }} /> : <Lock size={12} style={{ marginRight: '4px' }} />}
              {partner.creditHold ? 'Release Hold' : 'Place Hold'}
            </button>
            <button 
              type="button" 
              className="vf-drawer-close"
              onClick={onClose} 
              title="Close Drawer"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Section 8 Requirement) */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--vf-slate-200)', background: '#f8fafc', padding: '0 16px', overflowX: 'auto' }}>
          {[
            { id: 'overview', label: '1. Overview' },
            { id: 'classification', label: '2. Classification & Tiers' },
            { id: 'channels', label: `3. Sales Channels (${partner.channelAssignments?.length || 0})` },
            { id: 'kyc', label: `4. KYC & Documents (${partner.kycDocuments?.length || 0})` },
            { id: 'territories', label: `5. Territory Scope (${partner.assignedTerritoryIds?.length || 0})` },
            { id: 'supply', label: `6. Distribution & Supply (${partner.distributionAssignments?.length || 0})` },
            { id: 'commercial', label: '7. Commercial Terms & Overrides' },
            { id: 'portal', label: `8. Portal Access (${partner.portalAccessStatus})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`vf-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Financial KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div className="vf-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>Approved Credit Limit</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--vf-slate-800)', margin: '3px 0' }}>
                    ₹ {(partner.creditLimit / 100000).toFixed(1)} Lakhs
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>{partner.creditDays}</span>
                </div>

                <div className="vf-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>Current Outstanding</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--vf-slate-800)', margin: '3px 0' }}>
                    ₹ {(partner.outstandingAmount / 100000).toFixed(2)} Lakhs
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Open orders: ₹ {(partner.openOrdersAmount / 100000).toFixed(2)}L</span>
                </div>

                <div className="vf-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>Collateral Deposit</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', margin: '3px 0' }}>
                    ₹ {(partner.securityDepositHeld / 100000).toFixed(1)} Lakhs
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>{partner.depositInstrument}</span>
                </div>

                <div className="vf-card" style={{ padding: '14px', border: partner.overdueAmount > 0 ? '2px solid #ef4444' : undefined }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: partner.overdueAmount > 0 ? '#dc2626' : 'var(--vf-slate-500)' }}>Overdue Amount</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: partner.overdueAmount > 0 ? '#b91c1c' : 'var(--vf-slate-800)', margin: '3px 0' }}>
                    ₹ {(partner.overdueAmount / 100000).toFixed(2)} Lakhs
                  </div>
                  <span style={{ fontSize: '11.5px', color: partner.overdueAmount > 0 ? '#dc2626' : 'var(--vf-slate-500)' }}>
                    {partner.overdueAmount > 0 ? 'Breached credit period' : 'Zero overdue invoices'}
                  </span>
                </div>
              </div>

              {/* Entity & Contacts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)' }}>Commercial Entity Contact</strong>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                    <div><strong>Contact Person:</strong> {partner.authorizedContactPerson} ({partner.contactDesignation})</div>
                    <div><strong>Email:</strong> {partner.officialEmail}</div>
                    <div><strong>Phone:</strong> {partner.mobilePhone}</div>
                    <div><strong>Warehouse Address:</strong> {partner.warehouseAddress}</div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)' }}>Supply & Topology Status</strong>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                    <div><strong>Assigned Route:</strong> <code>{partner.assignedRouteId}</code></div>
                    <div><strong>Assigned Territories:</strong> {partner.assignedTerritoryIds.map((tId) => territories.find((t) => t.id === tId)?.name).join(', ')}</div>
                    <div><strong>Supply Warehouses Linked:</strong> {partner.distributionAssignments?.length || 0} active hubs</div>
                    <div><strong>Portal Status:</strong> <span className={`vf-badge ${partner.portalAccessStatus === 'Active' ? 'vf-badge-active' : 'vf-badge-draft'}`}>{partner.portalAccessStatus}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLASSIFICATION & TIERS */}
          {activeTab === 'classification' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                <strong>Enterprise Decoupled Classification:</strong> Partner Type, Performance Tier, and Distribution Level are governed independently and never conflated into a single attribute.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>1. Partner Type</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)', margin: '4px 0' }}>
                    {partner.typeName}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Entity legal role</span>
                </div>

                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>2. Performance Tier</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1d4ed8', margin: '4px 0' }}>
                    {partner.classification?.performanceTierName || 'Standard Tier'}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Volume & compliance grading</span>
                </div>

                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>3. Distribution Level</div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#047857', margin: '4px 0' }}>
                    {partner.classification?.distributionLevelName || 'Tier 2 Regional Stockist'}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Supply topology position</span>
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px' }}>
                  Classification Parameters
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12.5px', color: 'var(--vf-slate-700)' }}>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Effective Date: </span>
                    <strong>{partner.classification?.effectiveDate || partner.createdAt}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Approval Status: </span>
                    <span className="vf-badge vf-badge-approved">{partner.classification?.approvalStatus || 'Approved'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Review Due: </span>
                    <span className={`vf-badge ${partner.classification?.reviewDue ? 'vf-badge-warning' : 'vf-badge-approved'}`}>
                      {partner.classification?.reviewDue ? 'Due for Upgrade Review' : 'Up to Date'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                  <strong>Strategic Reason:</strong> {partner.classification?.reason || 'Approved commercial partner classification.'}
                </div>
              </div>

              {/* Classification Audit Trail */}
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'block' }}>
                  Classification History & Grade Transitions ({(partner.classification?.history || []).length})
                </strong>
                {(partner.classification?.history || []).length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: 'var(--vf-slate-400)', fontSize: '12px' }}>
                    Initial classification recorded upon partner establishment.
                  </div>
                ) : (
                  <div className="vf-table-container">
                    <table className="vf-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Changed By</th>
                          <th>Previous Grade</th>
                          <th>New Grade</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(partner.classification?.history || []).map((h) => (
                          <tr key={h.id}>
                            <td>{h.timestamp}</td>
                            <td><strong>{h.changedBy}</strong></td>
                            <td><span className="vf-badge vf-badge-outline">{h.fromTier}</span></td>
                            <td><span className="vf-badge vf-badge-approved">{h.toTier}</span></td>
                            <td style={{ color: 'var(--vf-slate-600)' }}>{h.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MULTIPLE SALES CHANNELS */}
          {activeTab === 'channels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                <strong>Multi-Channel Architecture:</strong> This partner can operate across multiple commercial sales channels simultaneously (e.g. Authorized Distributor, Institutional Tender, B2B Portal) with independent status and commercial term governance.
              </div>

              <div className="vf-table-container">
                <table className="vf-table">
                  <thead>
                    <tr>
                      <th>Sales Channel</th>
                      <th>Channel Code</th>
                      <th>Channel Default</th>
                      <th>Partner Effective Term</th>
                      <th>Commercial Status</th>
                      <th>Assignment Status</th>
                      <th>Contract Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partner.channelAssignments || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                          No sales channels explicitly assigned to this partner.
                        </td>
                      </tr>
                    ) : (
                      (partner.channelAssignments || []).map((ca) => (
                        <tr key={ca.id}>
                          <td>
                            <strong>{ca.salesChannelName}</strong>
                          </td>
                          <td>
                            <span className="vf-badge vf-badge-outline">{ca.salesChannelCode}</span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                            {ca.commercialOverride?.channelDefaultDiscount || 12.0}%
                          </td>
                          <td>
                            <strong style={{ color: ca.commercialTermStatus?.startsWith('Deviated') ? '#b45309' : '#047857' }}>
                              {ca.commercialOverride?.overrideDiscountPercent || ca.commercialOverride?.channelDefaultDiscount || 12.0}%
                            </strong>
                          </td>
                          <td>
                            <span className={`vf-badge ${ca.commercialTermStatus === 'Deviated — Approved' ? 'vf-badge-approved' : ca.commercialTermStatus === 'Deviated — Pending Approval' ? 'vf-badge-warning' : 'vf-badge-active'}`}>
                              {ca.commercialTermStatus}
                            </span>
                          </td>
                          <td>
                            <span className={`vf-badge ${ca.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                              {ca.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                            {ca.notes || ca.commercialOverride?.requestReason || '--'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: KYC & DOCUMENTS */}
          {activeTab === 'kyc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontWeight: 700, textTransform: 'uppercase' }}>GSTIN</span>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', marginTop: '2px' }}>{partner.gstin || 'None'}</div>
                  <span className={`vf-badge ${partner.gstinStatus === 'Verified on GST Portal' ? 'vf-badge-active' : 'vf-badge-pending'}`} style={{ marginTop: '4px' }}>
                    {partner.gstinStatus}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontWeight: 700, textTransform: 'uppercase' }}>PAN Number</span>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', marginTop: '2px' }}>{partner.pan || 'None'}</div>
                  <span className="vf-badge vf-badge-active" style={{ marginTop: '4px' }}>Income Tax Verified</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontWeight: 700, textTransform: 'uppercase' }}>Drug License</span>
                  <div style={{ fontWeight: 700, fontSize: '12.5px', marginTop: '2px' }}>{partner.drugLicenseNo || 'None'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>Expiry: {partner.drugLicenseExpiry}</div>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'block' }}>
                  Statutory KYC Verification Documents ({partner.kycDocuments?.length || 0})
                </strong>
                <table className="vf-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Document Title & Type</th>
                      <th>File Name</th>
                      <th>Upload Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partner.kycDocuments || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--vf-slate-400)' }}>
                          No documents uploaded.
                        </td>
                      </tr>
                    ) : (
                      partner.kycDocuments.map((doc) => (
                        <tr key={doc.id}>
                          <td>
                            <strong>{doc.title}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{doc.type}</div>
                          </td>
                          <td><code>{doc.fileName}</code></td>
                          <td>{doc.uploadDate}</td>
                          <td>
                            <span className={`vf-badge ${doc.verificationStatus === 'Verified' ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                              {doc.verificationStatus}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => {
                                const nextStatus = doc.verificationStatus === 'Verified' ? 'Pending' : 'Verified';
                                updatePartner(partner.id, {
                                  kycDocuments: partner.kycDocuments.map((d) =>
                                    d.id === doc.id ? { ...d, verificationStatus: nextStatus } : d
                                  )
                                });
                                showToast(`Document "${doc.title}" status changed to ${nextStatus}.`, 'info');
                              }}
                            >
                              {doc.verificationStatus === 'Verified' ? 'Set Pending' : '✓ Mark Verified'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TERRITORY & CHANNEL */}
          {activeTab === 'territories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'block' }}>
                  Assigned Distribution Territories ({partner.assignedTerritoryIds?.length || 0})
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {partner.assignedTerritoryIds.map((tId) => {
                    const terr = territories.find((t) => t.id === tId);
                    const comm = partner.territoryCommercials[tId];
                    return (
                      <div key={tId} style={{ padding: '12px', border: '1px solid var(--vf-slate-200)', borderRadius: '6px', background: '#f8fafc' }}>
                        <strong style={{ fontSize: '13px' }}>{terr?.name || tId}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Code: <code>{terr?.code}</code> · State: {terr?.state}</div>
                        <div style={{ fontSize: '12px', marginTop: '6px', color: '#1d4ed8', fontWeight: 600 }}>
                          Effective Discount: {comm?.effectiveDiscount ?? terr?.defaultCommercialTerms.defaultDiscountPercent}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)' }}>Assigned Route Topology</strong>
                <div style={{ marginTop: '8px', fontSize: '12.5px' }}>
                  Route: <code>{partner.assignedRouteId}</code> — {distributionRoutes.find((r) => r.id === partner.assignedRouteId)?.name}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DISTRIBUTION & SUPPLY (Independently manageable!) */}
          {activeTab === 'supply' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: 'var(--vf-slate-800)' }}>
                      Distribution & Supply Warehouse Linkages
                    </strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                      Physical branch and warehouse supply routes. You can add or modify assignments here independently of KYC details.
                    </p>
                  </div>
                </div>
              </div>

              {/* Inline Add Supply Linkage Card */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '12.5px', color: 'var(--vf-slate-700)' }}>+ Link New Supply Warehouse</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.5fr', gap: '10px' }}>
                  <div>
                    <label className="vf-form-label">Territory</label>
                    <select
                      className="vf-form-control"
                      value={newTerritoryId}
                      onChange={(e) => setNewTerritoryId(e.target.value)}
                    >
                      <option value="">-- Select Territory --</option>
                      {partner.assignedTerritoryIds.map((tId) => {
                        const t = territories.find((x) => x.id === tId);
                        return <option key={tId} value={tId}>{t?.name || tId}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="vf-form-label">Branch (Active)</label>
                    <select
                      className="vf-form-control"
                      value={newBranchId}
                      onChange={(e) => handleBranchChange(e.target.value)}
                    >
                      <option value="">-- Select Branch --</option>
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="vf-form-label">Warehouse (Filtered to Branch)</label>
                    <select
                      className="vf-form-control"
                      value={newWarehouseId}
                      onChange={(e) => setNewWarehouseId(e.target.value)}
                    >
                      <option value="">-- Select Warehouse --</option>
                      {branchFilteredWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <label className="vf-form-label">Supply Purpose / Type</label>
                    <select
                      className="vf-form-control"
                      value={newAsgnType}
                      onChange={(e) => setNewAsgnType(e.target.value as any)}
                    >
                      <option value="Primary Invoicing & Dispatch">Primary Invoicing & Dispatch</option>
                      <option value="Secondary Stocking">Secondary Stocking</option>
                      <option value="Emergency Hospital Supply">Emergency Hospital Supply</option>
                      <option value="Transit & Cross-Dock Hub">Transit & Cross-Dock Hub</option>
                      <option value="Returns Processing">Returns Processing</option>
                    </select>
                  </div>

                  <div style={{ paddingBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newIsPrimary}
                        onChange={(e) => setNewIsPrimary(e.target.checked)}
                      />
                      <span>Mark as <strong>Primary Warehouse</strong></span>
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary"
                      onClick={handleAddSupplyLinkage}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} />
                      <span>Link Warehouse</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Table of assignments */}
              <table className="vf-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Territory</th>
                    <th>Branch</th>
                    <th>Warehouse</th>
                    <th>Assignment Type</th>
                    <th>Primary</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(partner.distributionAssignments || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                        No supply warehouse assignments configured. Use the form above to link a warehouse.
                      </td>
                    </tr>
                  ) : (
                    partner.distributionAssignments.map((asgn) => (
                      <tr key={asgn.id}>
                        <td><strong>{asgn.territoryName}</strong></td>
                        <td>{asgn.branchName}</td>
                        <td><strong>{asgn.warehouseName}</strong></td>
                        <td>
                          <span className="vf-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                            {asgn.assignmentType}
                          </span>
                        </td>
                        <td>
                          {asgn.isPrimary ? (
                            <span className="vf-badge vf-badge-active">★ Primary</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>Secondary</span>
                          )}
                        </td>
                        <td>
                          <span className={`vf-badge ${asgn.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>
                            {asgn.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="vf-btn vf-btn-secondary vf-btn-xs"
                            onClick={() => deletePartnerDistributionAssignment(partner.id, asgn.id)}
                            style={{ color: 'var(--vf-danger)' }}
                            title="Remove assignment"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: COMMERCIAL TERMS & OVERRIDES (Independently manageable!) */}
          {activeTab === 'commercial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12.5px', color: '#1e40af' }}>
                <strong>Critical Commercial Terms Governance:</strong> Commercial terms are resolved per territory. Master Defaults apply unless an authorized partner override is stored. You can modify overrides or reset to defaults below without modifying KYC.
              </div>

              {partner.assignedTerritoryIds.map((tId) => {
                const terr = territories.find((t) => t.id === tId);
                const comm = partner.territoryCommercials[tId];
                const masterDefault = terr?.defaultCommercialTerms.defaultDiscountPercent || 5.0;
                const isOverridden = comm?.overrideOrigin === 'Partner Override' || (comm?.partnerOverrideDiscount !== null && comm?.partnerOverrideDiscount !== undefined);
                const isEditing = editingCommercialTerritoryId === tId;

                return (
                  <div key={tId} style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--vf-slate-900)' }}>{terr?.name || tId}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginLeft: '8px' }}>
                          Territory Default Discount: <strong>{masterDefault}%</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className={`vf-badge ${isOverridden ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                          {isOverridden ? 'Partner Override Active' : 'Inheriting Master Default'}
                        </span>
                        {!isEditing && (
                          <button
                            type="button"
                            className="vf-btn vf-btn-secondary vf-btn-xs"
                            onClick={() => handleStartEditCommercial(tId)}
                          >
                            <Edit3 size={12} style={{ marginRight: '4px' }} />
                            Edit Overrides
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      /* Editing form */
                      <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div>
                            <label className="vf-form-label">Override Discount % (Default: {masterDefault}%)</label>
                            <input
                              type="number"
                              step="0.1"
                              className="vf-form-control"
                              placeholder={`Leave blank to inherit ${masterDefault}%`}
                              value={overrideDiscountInput}
                              onChange={(e) => setOverrideDiscountInput(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="vf-form-label">Override Credit Limit (₹)</label>
                            <input
                              type="number"
                              step="50000"
                              className="vf-form-control"
                              placeholder="Leave blank to inherit default"
                              value={overrideLimitInput}
                              onChange={(e) => setOverrideLimitInput(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="vf-form-label">Override Credit Period (Days)</label>
                            <input
                              type="number"
                              className="vf-form-control"
                              placeholder="Leave blank to inherit default"
                              value={overridePeriodInput}
                              onChange={(e) => setOverridePeriodInput(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="vf-form-label">Override Justification / Approval Reason *</label>
                          <input
                            type="text"
                            className="vf-form-control"
                            placeholder="e.g. Hospital group key accounts special pricing agreement"
                            value={overrideReasonInput}
                            onChange={(e) => setOverrideReasonInput(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            className="vf-btn vf-btn-secondary vf-btn-xs"
                            onClick={() => setEditingCommercialTerritoryId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="vf-btn vf-btn-primary vf-btn-xs"
                            onClick={() => handleSaveCommercialOverride(tId)}
                          >
                            Save Overrides
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display table */
                      <table className="vf-table" style={{ width: '100%', margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Commercial Term</th>
                            <th style={{ textAlign: 'right' }}>Master Default</th>
                            <th style={{ textAlign: 'right' }}>Partner Override</th>
                            <th style={{ textAlign: 'right' }}>Effective Term</th>
                            <th>Origin Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Discount Percentage</strong></td>
                            <td style={{ textAlign: 'right' }}>{masterDefault}%</td>
                            <td style={{ textAlign: 'right' }}>
                              {comm?.partnerOverrideDiscount !== null && comm?.partnerOverrideDiscount !== undefined ? (
                                <strong style={{ color: '#1d4ed8' }}>{comm.partnerOverrideDiscount}%</strong>
                              ) : (
                                <span style={{ color: 'var(--vf-slate-400)' }}>None</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong style={{ fontSize: '13.5px', color: isOverridden ? '#1d4ed8' : '#059669' }}>
                                {comm?.effectiveDiscount ?? masterDefault}%
                              </strong>
                            </td>
                            <td>
                              <span className={`vf-badge ${isOverridden ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                                {comm?.overrideOrigin || 'Territory Default'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isOverridden && (
                                <button
                                  type="button"
                                  className="vf-btn vf-btn-secondary vf-btn-xs"
                                  onClick={() => resetPartnerCommercialOverride(partner.id, tId)}
                                  title="Reset to Master Default"
                                >
                                  <RotateCcw size={11} style={{ marginRight: '4px' }} />
                                  Reset to Default
                                </button>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 6: DISTRIBUTION PORTAL ACCESS */}
          {activeTab === 'portal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontWeight: 700, textTransform: 'uppercase' }}>Invitation Status</span>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`vf-badge ${partner.invitationStatus === 'Accepted' ? 'vf-badge-active' : partner.invitationStatus === 'Invite Sent' ? 'vf-badge-warning' : partner.invitationStatus === 'Expired' ? 'vf-badge-danger' : 'vf-badge-draft'}`} style={{ fontSize: '12px' }}>
                      {partner.invitationStatus}
                    </span>
                  </div>
                  {partner.invitationSentDate && (
                    <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginTop: '4px' }}>Sent: {partner.invitationSentDate}</div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontWeight: 700, textTransform: 'uppercase' }}>Portal Access Status</span>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`vf-badge ${partner.portalAccessStatus === 'Active' ? 'vf-badge-active' : partner.portalAccessStatus === 'Suspended' ? 'vf-badge-danger' : 'vf-badge-draft'}`} style={{ fontSize: '12px' }}>
                      {partner.portalAccessStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginTop: '4px' }}>
                    {partner.portalAccessStatus === 'Active' ? 'Ordering login active' : 'Digital ordering disabled'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontWeight: 700, textTransform: 'uppercase' }}>Invited Target Email</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{partner.officialEmail}</div>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>Recipient: {partner.authorizedContactPerson}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {partner.invitationStatus === 'Not Invited' && (
                  <button
                    type="button"
                    className="vf-btn vf-btn-primary"
                    onClick={() => sendPartnerInvitation(partner.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={14} />
                    <span>Send Portal Invitation</span>
                  </button>
                )}

                {partner.invitationStatus === 'Invite Sent' && (
                  <>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary"
                      onClick={() => resendPartnerInvitation(partner.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={14} />
                      <span>Resend Invitation</span>
                    </button>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary"
                      onClick={() => cancelPartnerInvitation(partner.id)}
                      style={{ color: 'var(--vf-danger)' }}
                    >
                      Cancel Invitation
                    </button>
                    {/* Interactive demonstration helper */}
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary"
                      style={{ color: 'var(--vf-success)', borderColor: 'var(--vf-success)', marginLeft: 'auto' }}
                      onClick={() => {
                        updatePartner(partner.id, {
                          invitationStatus: 'Accepted',
                          portalAccessStatus: 'Active',
                          invitationAcceptedDate: new Date().toISOString().replace('T', ' ').substring(0, 16)
                        });
                        showToast(`Simulated partner acceptance for ${partner.name}. Portal access activated.`, 'success');
                      }}
                    >
                      ✓ Simulate Partner Acceptance
                    </button>
                  </>
                )}

                {partner.invitationStatus === 'Accepted' && (
                  <div style={{ color: 'var(--vf-success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Partner accepted invitation on {partner.invitationAcceptedDate || '2026-02-11'}. Portal ordering is operational.</span>
                  </div>
                )}
              </div>

              {/* Portal Users List */}
              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'block' }}>
                  Authorized Distributor Portal User Accounts ({partner.portalUsers?.length || 0})
                </strong>
                <table className="vf-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>User Name</th>
                      <th>Email Address</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partner.portalUsers || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--vf-slate-400)' }}>
                          No portal users registered yet.
                        </td>
                      </tr>
                    ) : (
                      partner.portalUsers.map((usr) => (
                        <tr key={usr.id}>
                          <td><strong>{usr.name}</strong></td>
                          <td>{usr.email}</td>
                          <td>{usr.role}</td>
                          <td>
                            <span className={`vf-badge ${usr.status === 'Active' ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                              {usr.status}
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

        </div>

        {/* Drawer Footer */}
        <div className="vf-drawer-footer">
          <button
            type="button"
            className="vf-btn vf-btn-secondary"
            onClick={onClose}
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};
