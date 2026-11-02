import React, { useState, useEffect } from 'react';
import type { Partner, KycDocument } from '../../types/partner';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  FileText, 
  Upload, 
  Info
} from 'lucide-react';

interface PartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner?: Partner | null;
}

export const PartnerFormModal: React.FC<PartnerFormModalProps> = ({
  isOpen,
  onClose,
  partner
}) => {
  const { 
    addPartner, 
    updatePartner, 
    territories, 
    distributionRoutes, 
    partnerTiers, 
    distributionLevels, 
    showToast 
  } = useApp();

  const isEditMode = Boolean(partner);

  const [selectedTierId, setSelectedTierId] = useState(
    partner?.classification?.performanceTierId || 'tier-gold'
  );
  const [selectedLevelId, setSelectedLevelId] = useState(
    partner?.classification?.distributionLevelId || 'dl-tier2'
  );
  const [classificationReason, setClassificationReason] = useState(
    partner?.classification?.reason || 'Approved commercial partner classification'
  );

  // Form State
  const [formData, setFormData] = useState<Partial<Partner>>({
    name: '',
    code: '',
    typeId: 'ct-distributor',
    typeName: 'Authorized Distributor',
    status: 'Active',
    tierPriceLevel: 'PTD (Tier 1)',
    assignedRouteId: 'path-02',
    assignedTerritoryIds: ['terr-west'],
    assignedChannelIds: ['chan-dist'],

    // KYC
    gstin: '',
    gstinStatus: 'Pending Verification',
    pan: '',
    drugLicenseNo: '',
    drugLicenseExpiry: '2028-12-31',
    mdrLicenseNo: '',
    authorizedContactPerson: '',
    contactDesignation: 'Managing Director',
    officialEmail: '',
    mobilePhone: '',
    warehouseAddress: '',
    kycStatus: 'Draft',
    kycDocuments: [],

    // Credit
    creditLimit: 3500000,
    creditDays: '45 days (Tier Default)',
    gracePeriodDays: 7,
    outstandingAmount: 0,
    overdueAmount: 0,
    openOrdersAmount: 0,
    creditHold: false,
    securityDepositHeld: 1200000,
    depositInstrument: 'Bank Guarantee (HDFC Bank)',
    depositExpiry: '2028-03-31',

    // Invitation
    invitationStatus: 'Not Invited',
    portalAccessStatus: 'Disabled',
    portalUsers: []
  });

  const [activeTab, setActiveTab] = useState<'entity' | 'commercial' | 'kyc' | 'docs'>('entity');
  const [newDocType, setNewDocType] = useState<KycDocument['type']>('GSTIN Certificate');
  const [newDocTitle, setNewDocTitle] = useState('');

  useEffect(() => {
    if (partner) {
      setFormData({ ...partner });
    } else {
      // Defaults for new partner
      const randCode = `DIST-REG-${Math.floor(10 + Math.random() * 90)}`;
      setFormData({
        name: '',
        code: randCode,
        typeId: 'ct-distributor',
        typeName: 'Authorized Distributor',
        status: 'Active',
        tierPriceLevel: 'PTD (Tier 1)',
        assignedRouteId: 'path-02',
        assignedTerritoryIds: ['terr-west'],
        assignedChannelIds: ['chan-dist'],

        gstin: '',
        gstinStatus: 'Pending Verification',
        pan: '',
        drugLicenseNo: '',
        drugLicenseExpiry: '2028-12-31',
        mdrLicenseNo: '',
        authorizedContactPerson: '',
        contactDesignation: 'Managing Director',
        officialEmail: '',
        mobilePhone: '',
        warehouseAddress: '',
        kycStatus: 'Draft',
        kycDocuments: [
          {
            id: 'doc-gstin-tmpl',
            title: 'GSTIN Registration Certificate Form REG-06',
            type: 'GSTIN Certificate',
            fileName: 'gstin_reg06.pdf',
            uploadDate: new Date().toISOString().substring(0, 10),
            verificationStatus: 'Pending',
            fileSize: '1.4 MB'
          },
          {
            id: 'doc-pan-tmpl',
            title: 'Permanent Account Number Card Copy',
            type: 'PAN Card',
            fileName: 'pan_card.pdf',
            uploadDate: new Date().toISOString().substring(0, 10),
            verificationStatus: 'Pending',
            fileSize: '840 KB'
          }
        ],

        creditLimit: 2500000,
        creditDays: '45 days (Tier Default)',
        gracePeriodDays: 7,
        outstandingAmount: 0,
        overdueAmount: 0,
        openOrdersAmount: 0,
        creditHold: false,
        securityDepositHeld: 1000000,
        depositInstrument: 'Bank Guarantee (HDFC Bank)',
        depositExpiry: '2028-03-31',

        invitationStatus: 'Not Invited',
        portalAccessStatus: 'Disabled',
        portalUsers: [],
        activeContractsCount: 1,
        createdAt: new Date().toISOString().substring(0, 10),
        updatedAt: new Date().toISOString().substring(0, 10)
      });
    }
  }, [partner, isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (typeId: string) => {
    let typeName = 'Authorized Distributor';
    if (typeId === 'ct-super-stockist') typeName = 'Super Stockist';
    else if (typeId === 'ct-cnf') typeName = 'C&F Agent (Consignee)';
    else if (typeId === 'ct-sub-dist') typeName = 'Sub-Distributor / Regional Dealer';
    else if (typeId === 'ct-institution') typeName = 'Direct Institution / Hospital';
    else if (typeId === 'ct-stockist') typeName = 'Stockist / Wholesaler';
    else if (typeId === 'ct-retailer') typeName = 'Pharmacy Retailer';

    setFormData((prev) => ({
      ...prev,
      typeId,
      typeName
    }));
  };

  const handleAddMockDocument = () => {
    const docTitle = newDocTitle.trim() || `${newDocType} Copy`;
    const newDoc: KycDocument = {
      id: `doc-${Date.now()}`,
      title: docTitle,
      type: newDocType,
      fileName: `${newDocType.toLowerCase().replace(/[^a-z0-9]/g, '_')}_verified.pdf`,
      uploadDate: new Date().toISOString().substring(0, 10),
      verificationStatus: 'Pending',
      fileSize: '1.2 MB'
    };

    setFormData((prev) => ({
      ...prev,
      kycDocuments: [...(prev.kycDocuments || []), newDoc]
    }));
    setNewDocTitle('');
    showToast(`Uploaded document "${docTitle}".`, 'info');
  };

  const handleToggleDocStatus = (docId: string, status: KycDocument['verificationStatus']) => {
    setFormData((prev) => {
      const updatedDocs = (prev.kycDocuments || []).map((d) => 
        d.id === docId ? { ...d, verificationStatus: status } : d
      );

      // Check if all verified
      const allVerified = updatedDocs.length > 0 && updatedDocs.every((d) => d.verificationStatus === 'Verified');
      const hasRejected = updatedDocs.some((d) => d.verificationStatus === 'Rejected');

      let kycStatus: Partner['kycStatus'] = prev.kycStatus || 'Draft';
      if (allVerified) kycStatus = 'Verified';
      else if (hasRejected) kycStatus = 'Rejected';
      else kycStatus = 'Pending Verification';

      return {
        ...prev,
        kycDocuments: updatedDocs,
        kycStatus
      };
    });
  };

  const handleRemoveDoc = (docId: string) => {
    setFormData((prev) => ({
      ...prev,
      kycDocuments: (prev.kycDocuments || []).filter((d) => d.id !== docId)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      showToast('Please enter Partner Legal Entity Name.', 'danger');
      return;
    }
    if (!formData.code?.trim()) {
      showToast('Please enter Partner Trade Code.', 'danger');
      return;
    }
    if (!formData.officialEmail?.trim()) {
      showToast('Please enter Official Ordering Email.', 'danger');
      return;
    }

    const chosenTier = partnerTiers.find((t) => t.id === selectedTierId) || partnerTiers[0];
    const chosenLevel = distributionLevels.find((l) => l.id === selectedLevelId) || distributionLevels[0];

    const classificationData = {
      partnerType: formData.typeName || 'Authorized Distributor',
      performanceTierId: chosenTier.id,
      performanceTierName: chosenTier.name,
      distributionLevelId: chosenLevel.id,
      distributionLevelName: chosenLevel.name,
      effectiveDate: partner?.classification?.effectiveDate || new Date().toISOString().substring(0, 10),
      reason: classificationReason,
      approvalStatus: partner?.classification?.approvalStatus || ('Approved' as const),
      history: partner?.classification?.history || []
    };

    if (isEditMode && partner) {
      updatePartner(partner.id, {
        ...formData,
        classification: classificationData,
        updatedAt: new Date().toISOString().substring(0, 10)
      });
      showToast(`Partner "${formData.name}" updated successfully.`, 'success');
    } else {
      const newPartner: Partner = {
        ...(formData as Partner),
        id: `part-${Date.now().toString().slice(-5)}`,
        classification: classificationData,
        territoryCommercials: {},
        activeContractsCount: 1,
        createdAt: new Date().toISOString().substring(0, 10),
        updatedAt: new Date().toISOString().substring(0, 10)
      };

      // Set territory commercial defaults
      (formData.assignedTerritoryIds || []).forEach((tId) => {
        const t = territories.find((x) => x.id === tId);
        const terrDiscount = t ? t.defaultCommercialTerms.defaultDiscountPercent : 5.0;
        newPartner.territoryCommercials[tId] = {
          territoryId: tId,
          territoryName: t ? t.name : tId,
          inheritedDefaultDiscount: terrDiscount,
          partnerOverrideDiscount: null,
          effectiveDiscount: terrDiscount,
          overrideOrigin: 'Territory Default',
          notes: 'Initial territory assignment'
        };
      });

      addPartner(newPartner);
    }

    onClose();
  };

  return (
    <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        className="vf-drawer vf-drawer-xl" 
        style={{ width: '840px' }}
      >
        {/* Drawer Header */}
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <h3 className="vf-drawer-title">
              <Building2 size={20} className="text-blue-600" />
              <span>{isEditMode ? `Edit Partner: ${formData.name}` : 'Onboard New Channel Partner'}</span>
            </h3>
            <p className="vf-drawer-subtitle">
              Configure commercial entity, statutory KYC verification, distribution topology, and credit controls.
            </p>
          </div>
          <button 
            type="button" 
            className="vf-drawer-close"
            onClick={onClose} 
            title="Close Drawer"
          >
            &times;
          </button>
        </div>

        {/* Status bar in modal */}
        <div style={{ background: '#f8fafc', padding: '10px 24px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--vf-slate-500)' }}>KYC Status:</span>
            <span className={`vf-badge ${formData.kycStatus === 'Verified' ? 'vf-badge-active' : formData.kycStatus === 'Pending Verification' ? 'vf-badge-pending' : formData.kycStatus === 'Rejected' ? 'vf-badge-danger' : 'vf-badge-draft'}`}>
              {formData.kycStatus}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--vf-slate-500)' }}>Invitation Status:</span>
            <span className={`vf-badge ${formData.invitationStatus === 'Accepted' ? 'vf-badge-active' : formData.invitationStatus === 'Invite Sent' ? 'vf-badge-warning' : 'vf-badge-draft'}`}>
              {formData.invitationStatus}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--vf-slate-500)' }}>Portal Access:</span>
            <span className={`vf-badge ${formData.portalAccessStatus === 'Active' ? 'vf-badge-active' : 'vf-badge-draft'}`}>
              {formData.portalAccessStatus}
            </span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="vf-btn vf-btn-secondary vf-btn-xs"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  kycStatus: prev.kycStatus === 'Verified' ? 'Pending Verification' : 'Verified',
                  gstinStatus: 'Verified on GST Portal'
                }));
                showToast('Toggled KYC status for validation testing.', 'info');
              }}
            >
              Toggle KYC Status ({formData.kycStatus})
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', padding: '0 24px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff' }}>
          <button
            type="button"
            className={`vf-tab-btn ${activeTab === 'entity' ? 'active' : ''}`}
            onClick={() => setActiveTab('entity')}
          >
            1. Entity & Channels
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeTab === 'commercial' ? 'active' : ''}`}
            onClick={() => setActiveTab('commercial')}
          >
            2. Commercial & Credit
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeTab === 'kyc' ? 'active' : ''}`}
            onClick={() => setActiveTab('kyc')}
          >
            3. Statutory KYC
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('docs')}
          >
            4. KYC Documents ({formData.kycDocuments?.length || 0})
          </button>
        </div>

        {/* Drawer Body Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* TAB 1: ENTITY & CHANNELS */}
          {activeTab === 'entity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                Partner Entity Profile & Channel Classification
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Partner Legal Entity Name *</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. Sterling Healthcare Distributors Pvt Ltd"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="vf-form-label">Partner Trade Code *</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. DIST-WEST-01"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Channel Tier / Type *</label>
                  <select
                    className="vf-form-control"
                    value={formData.typeId}
                    onChange={(e) => handleTypeChange(e.target.value)}
                  >
                    <option value="ct-distributor">Authorized Distributor</option>
                    <option value="ct-super-stockist">Super Stockist</option>
                    <option value="ct-cnf">C&F Agent (Consignee)</option>
                    <option value="ct-sub-dist">Sub-Distributor / Regional Dealer</option>
                    <option value="ct-institution">Direct Institution / Hospital</option>
                    <option value="ct-stockist">Stockist / Wholesaler</option>
                    <option value="ct-retailer">Pharmacy Retailer</option>
                  </select>
                </div>
                <div>
                  <label className="vf-form-label">Operational Status</label>
                  <select
                    className="vf-form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px' }}>
                  Distribution Topology & Pricing Tier
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">Assigned Distribution Topology *</label>
                    <select
                      className="vf-form-control"
                      value={formData.assignedRouteId}
                      onChange={(e) => setFormData({ ...formData, assignedRouteId: e.target.value })}
                    >
                      {distributionRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                      Physical transit stages from manufacturer warehouse to end recipient.
                    </span>
                  </div>
                  <div>
                    <label className="vf-form-label">Applicable Base Price Tier</label>
                    <select
                      className="vf-form-control"
                      value={formData.tierPriceLevel}
                      onChange={(e) => setFormData({ ...formData, tierPriceLevel: e.target.value })}
                    >
                      <option value="PTD (Tier 1)">PTD (Price to Distributor - Tier 1)</option>
                      <option value="PTS (Super Stockist)">PTS (Price to Stockist)</option>
                      <option value="PTR (Retail)">PTR (Price to Retailer)</option>
                      <option value="Direct Institutional Rate Contract">Direct Institutional Rate Contract</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dedicated Partner Classification Section (Section 6.4) */}
              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '4px' }}>
                  Enterprise Partner Classification (Decoupled Governance)
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>
                  Performance Tier (grading) and Distribution Level (network topology position) are kept strictly separate from Partner Type.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
                  <div>
                    <label className="vf-form-label">Partner Performance Tier</label>
                    <select
                      className="vf-form-control"
                      value={selectedTierId}
                      onChange={(e) => setSelectedTierId(e.target.value)}
                    >
                      {partnerTiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Rank {t.rank})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="vf-form-label">Distribution Level (Topology Position)</label>
                    <select
                      className="vf-form-control"
                      value={selectedLevelId}
                      onChange={(e) => setSelectedLevelId(e.target.value)}
                    >
                      {distributionLevels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Classification Strategic Justification</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    value={classificationReason}
                    onChange={(e) => setClassificationReason(e.target.value)}
                    placeholder="Document business rationale for this partner tier assignment..."
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px' }}>
                  Territory Association
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="vf-form-label">Initial Assigned Territories (select all that apply):</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {territories.map((t) => {
                      const isChecked = (formData.assignedTerritoryIds || []).includes(t.id);
                      return (
                        <label
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: isChecked ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${isChecked ? '#bfdbfe' : '#e2e8f0'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12.5px'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const curr = formData.assignedTerritoryIds || [];
                              if (e.target.checked) {
                                setFormData({ ...formData, assignedTerritoryIds: [...curr, t.id] });
                              } else {
                                setFormData({ ...formData, assignedTerritoryIds: curr.filter((x) => x !== t.id) });
                              }
                            }}
                          />
                          <div>
                            <strong>{t.name}</strong> <span style={{ color: 'var(--vf-slate-500)', fontSize: '11.5px' }}>({t.code})</span>
                            <div style={{ fontSize: '11px', color: '#2563eb' }}>Default Discount: {t.defaultCommercialTerms.defaultDiscountPercent}%</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>
                    * Detailed territory-specific commercial terms and discount overrides can also be managed in the dedicated <strong>Assign Territories</strong> modal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMERCIAL & CREDIT */}
          {activeTab === 'commercial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                Credit Governance & Collateral Terms
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Approved Credit Limit (₹) *</label>
                  <input
                    type="number"
                    className="vf-form-control"
                    value={formData.creditLimit || 0}
                    onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                    step="50000"
                    required
                  />
                </div>
                <div>
                  <label className="vf-form-label">Credit Period (Days)</label>
                  <select
                    className="vf-form-control"
                    value={formData.creditDays}
                    onChange={(e) => setFormData({ ...formData, creditDays: e.target.value })}
                  >
                    <option value="30 days">30 Days</option>
                    <option value="45 days (Tier Default)">45 Days (Standard)</option>
                    <option value="60 days">60 Days (Govt/Institutional)</option>
                    <option value="90 days">90 Days (Tender Special)</option>
                    <option value="0 days (Advance)">0 Days (100% Advance)</option>
                  </select>
                </div>
                <div>
                  <label className="vf-form-label">Grace Period (Days)</label>
                  <input
                    type="number"
                    className="vf-form-control"
                    value={formData.gracePeriodDays || 7}
                    onChange={(e) => setFormData({ ...formData, gracePeriodDays: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Security Deposit Held (₹)</label>
                  <input
                    type="number"
                    className="vf-form-control"
                    value={formData.securityDepositHeld || 0}
                    onChange={(e) => setFormData({ ...formData, securityDepositHeld: Number(e.target.value) })}
                    step="50000"
                  />
                </div>
                <div>
                  <label className="vf-form-label">Collateral Instrument Type</label>
                  <select
                    className="vf-form-control"
                    value={formData.depositInstrument}
                    onChange={(e) => setFormData({ ...formData, depositInstrument: e.target.value })}
                  >
                    <option value="Bank Guarantee (HDFC Bank)">Bank Guarantee (BG)</option>
                    <option value="Fixed Deposit Lien (SBI)">Fixed Deposit Lien (FD)</option>
                    <option value="Post-Dated Cheques (PDC Held)">Post-Dated Cheques (PDC)</option>
                    <option value="Irrevocable Letter of Credit">Letter of Credit (LC)</option>
                    <option value="Corporate Tender Guarantee">Corporate Guarantee</option>
                    <option value="Unsecured (Director Indemnity)">None / Unsecured</option>
                  </select>
                </div>
                <div>
                  <label className="vf-form-label">Instrument Expiry Date</label>
                  <input
                    type="date"
                    className="vf-form-control"
                    value={formData.depositExpiry || ''}
                    onChange={(e) => setFormData({ ...formData, depositExpiry: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid var(--vf-slate-200)', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vf-slate-800)', marginBottom: '8px' }}>
                  Automated Credit Protection Controls
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked /> Auto-hold dispatch when outstanding exceeds approved credit limit
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked /> Block orders upon invoices exceeding credit period + grace days
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.creditHold || false}
                      onChange={(e) => setFormData({ ...formData, creditHold: e.target.checked })}
                    />
                    <strong>Manual Credit Hold Flag</strong> (Order dispatch blocked manually)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STATUTORY KYC */}
          {activeTab === 'kyc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                Statutory Licensing & Regulatory Identity
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">GSTIN Identification Number *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. 27AABCS9912E1Z4"
                      value={formData.gstin || ''}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      required
                    />
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary vf-btn-sm"
                      onClick={() => {
                        if (formData.gstin && formData.gstin.length >= 15) {
                          setFormData({ ...formData, gstinStatus: 'Verified on GST Portal' });
                          showToast(`GSTIN "${formData.gstin}" verified with GSTN Portal.`, 'success');
                        } else {
                          showToast('Please enter a valid 15-character GSTIN.', 'warning');
                        }
                      }}
                    >
                      Verify GSTN
                    </button>
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`vf-badge ${formData.gstinStatus === 'Verified on GST Portal' ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                      {formData.gstinStatus}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">PAN Number *</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. AABCS9912E"
                    value={formData.pan || ''}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Drug License Numbers (Form 20B / 21B)</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. MH-MZ2-20B-184920 / 21B-184921"
                    value={formData.drugLicenseNo || ''}
                    onChange={(e) => setFormData({ ...formData, drugLicenseNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="vf-form-label">Drug License Expiry Date</label>
                  <input
                    type="date"
                    className="vf-form-control"
                    value={formData.drugLicenseExpiry || ''}
                    onChange={(e) => setFormData({ ...formData, drugLicenseExpiry: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="vf-form-label">Medical Device MDR Wholesale License</label>
                <input
                  type="text"
                  className="vf-form-control"
                  placeholder="e.g. MD-42-MH-2023-00918 (CDSCO / State FDA)"
                  value={formData.mdrLicenseNo || ''}
                  onChange={(e) => setFormData({ ...formData, mdrLicenseNo: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px' }}>
                  Authorized Signatory & Ordering Contacts
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">Authorized Contact Person *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. Mahesh Chawla"
                      value={formData.authorizedContactPerson || ''}
                      onChange={(e) => setFormData({ ...formData, authorizedContactPerson: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">Designation</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. Managing Director / Partner"
                      value={formData.contactDesignation || ''}
                      onChange={(e) => setFormData({ ...formData, contactDesignation: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                  <div>
                    <label className="vf-form-label">Official Ordering Email *</label>
                    <input
                      type="email"
                      className="vf-form-control"
                      placeholder="e.g. orders@sterlinghealthcare.in"
                      value={formData.officialEmail || ''}
                      onChange={(e) => setFormData({ ...formData, officialEmail: e.target.value })}
                      required
                    />
                    <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                      Used for Distribution Portal login invitation and automated invoices.
                    </span>
                  </div>
                  <div>
                    <label className="vf-form-label">Mobile / Phone Number *</label>
                    <input
                      type="tel"
                      className="vf-form-control"
                      placeholder="e.g. +91 98201 44521"
                      value={formData.mobilePhone || ''}
                      onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label className="vf-form-label">Registered Warehouse / Logistics Delivery Address</label>
                  <textarea
                    rows={2}
                    className="vf-form-control"
                    placeholder="e.g. Unit 14, Commercial Logistics Park, Andheri East, Mumbai 400069"
                    value={formData.warehouseAddress || ''}
                    onChange={(e) => setFormData({ ...formData, warehouseAddress: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KYC DOCUMENTS & VERIFICATION */}
          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                    Mandatory Statutory KYC Uploads
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                    Regulatory compliance requires verified GSTIN, Drug License, and Collateral before portal activation.
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Overall KYC Workflow:</span>
                  <div style={{ marginTop: '4px' }}>
                    <select
                      className="vf-form-control"
                      style={{ fontSize: '12px', height: '30px' }}
                      value={formData.kycStatus}
                      onChange={(e) => setFormData({ ...formData, kycStatus: e.target.value as any })}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Pending Verification">Pending Verification</option>
                      <option value="Verified">Verified</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload control box */}
              <div style={{ padding: '14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="vf-form-control"
                    style={{ flex: 1, minWidth: '220px' }}
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as any)}
                  >
                    <option value="GSTIN Certificate">GSTIN Certificate (REG-06)</option>
                    <option value="PAN Card">PAN Card Copy</option>
                    <option value="Drug License Form 20B/21B">Drug License Form 20B/21B</option>
                    <option value="MDR Medical Device License">MDR Medical Device License</option>
                    <option value="Bank Guarantee / Collateral Lien">Bank Guarantee / Collateral Lien</option>
                    <option value="Signed Agreement">Signed Commercial Agreement</option>
                  </select>

                  <input
                    type="text"
                    className="vf-form-control"
                    style={{ flex: 1.5, minWidth: '220px' }}
                    placeholder="Document title or reference number (optional)"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                  />

                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary"
                    onClick={handleAddMockDocument}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Upload size={14} />
                    <span>Upload Document</span>
                  </button>
                </div>
              </div>

              {/* Documents table */}
              <table className="vf-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Document Name & Type</th>
                    <th>File</th>
                    <th>Uploaded Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Verification Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.kycDocuments || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                        No KYC documents uploaded yet. Use the upload control above.
                      </td>
                    </tr>
                  ) : (
                    formData.kycDocuments!.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} className="text-blue-500" />
                            <div>
                              <strong>{doc.title}</strong>
                              <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{doc.type}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '11px' }}>{doc.fileName}</code>
                          <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginLeft: '6px' }}>({doc.fileSize})</span>
                        </td>
                        <td>{doc.uploadDate}</td>
                        <td>
                          <span className={`vf-badge ${doc.verificationStatus === 'Verified' ? 'vf-badge-active' : doc.verificationStatus === 'Rejected' ? 'vf-badge-danger' : 'vf-badge-pending'}`}>
                            {doc.verificationStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {doc.verificationStatus !== 'Verified' && (
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                style={{ color: 'var(--vf-success)', borderColor: 'var(--vf-success)' }}
                                onClick={() => handleToggleDocStatus(doc.id, 'Verified')}
                                title="Mark Verified"
                              >
                                ✓ Verify
                              </button>
                            )}
                            {doc.verificationStatus !== 'Rejected' && (
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                style={{ color: 'var(--vf-danger)', borderColor: 'var(--vf-danger)' }}
                                onClick={() => handleToggleDocStatus(doc.id, 'Rejected')}
                                title="Mark Rejected"
                              >
                                ✕ Reject
                              </button>
                            )}
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => handleRemoveDoc(doc.id)}
                              title="Delete Document"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {formData.kycStatus === 'Draft' && (
                <div style={{ padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12.5px', color: '#1e40af' }}>
                  <Info size={18} />
                  <span>
                    <strong>Business Governance Notice:</strong> Partners in <em>Draft</em> KYC status cannot receive Distribution Portal invitations until statutory verification is submitted and approved.
                  </span>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Drawer Footer */}
          <div className="vf-drawer-footer" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {activeTab !== 'docs' ? (
                <button
                  type="button"
                  className="vf-btn vf-btn-secondary"
                  onClick={() => {
                    if (activeTab === 'entity') setActiveTab('commercial');
                    else if (activeTab === 'commercial') setActiveTab('kyc');
                    else if (activeTab === 'kyc') setActiveTab('docs');
                  }}
                >
                  Next Step &rarr;
                </button>
              ) : null}
              <button
                type="submit"
                className="vf-btn vf-btn-primary"
                style={{ fontWeight: 700 }}
              >
                {isEditMode ? '✓ Save Changes' : '✓ Complete Partner Registration'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
