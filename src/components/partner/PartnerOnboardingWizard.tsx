import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { 
  Partner, 
  KycDocument, 
  PartnerDistributionAssignment,
  PartnerTerritoryCommercial,
  PartnerCommercialOverride
} from '../../types/partner';
import { 
  Building2, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Info,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface PartnerOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PartnerOnboardingWizard: React.FC<PartnerOnboardingWizardProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    addPartner, 
    territories, 
    salesChannels, 
    distributionRoutes, 
    branches, 
    warehouses, 
    showToast 
  } = useApp();

  // Wizard Step: 1 | 2 | 3 | 4 | 5
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Active branches & warehouses for new assignments
  const activeBranches = useMemo(() => branches.filter((b) => b.status === 'Active'), [branches]);
  const activeWarehouses = useMemo(() => warehouses.filter((w) => w.status === 'Active'), [warehouses]);

  // STEP 1 STATE: Basic Details & KYC
  const [name, setName] = useState('');
  const [code, setCode] = useState(`DIST-REG-${Math.floor(10 + Math.random() * 90)}`);
  const [typeId, setTypeId] = useState('ct-distributor');
  const [typeName, setTypeName] = useState('Authorized Distributor');
  const [tierPriceLevel, setTierPriceLevel] = useState('PTD (Tier 1)');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('Managing Director');
  const [officialEmail, setOfficialEmail] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  
  // KYC
  const [gstin, setGstin] = useState('');
  const [gstinStatus, setGstinStatus] = useState<Partner['gstinStatus']>('Pending Verification');
  const [pan, setPan] = useState('');
  const [drugLicenseNo, setDrugLicenseNo] = useState('');
  const [drugLicenseExpiry, setDrugLicenseExpiry] = useState('2028-12-31');
  const [mdrLicenseNo, setMdrLicenseNo] = useState('');
  const [kycStatus, setKycStatus] = useState<Partner['kycStatus']>('Draft');
  const [kycDocs, setKycDocs] = useState<KycDocument[]>([
    {
      id: 'doc-gst-01',
      title: 'GSTIN Registration Certificate (REG-06)',
      type: 'GSTIN Certificate',
      fileName: 'gstin_reg06.pdf',
      uploadDate: new Date().toISOString().substring(0, 10),
      verificationStatus: 'Pending',
      fileSize: '1.4 MB'
    },
    {
      id: 'doc-pan-02',
      title: 'Permanent Account Number (PAN) Card Copy',
      type: 'PAN Card',
      fileName: 'pan_card.pdf',
      uploadDate: new Date().toISOString().substring(0, 10),
      verificationStatus: 'Pending',
      fileSize: '620 KB'
    }
  ]);

  // Credit Master baseline
  const [creditLimit] = useState(3000000);
  const [creditDays] = useState('45 days (Tier Default)');
  const [gracePeriodDays] = useState(7);
  const [securityDepositHeld] = useState(1000000);
  const [depositInstrument] = useState('Bank Guarantee (HDFC Bank)');
  const [depositExpiry] = useState('2028-03-31');

  // STEP 2 STATE: Territory & Channel
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>(['terr-west']);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(['ct-distributor']);
  const [assignedRouteId, setAssignedRouteId] = useState('path-02');

  // STEP 3 STATE: Distribution & Supply Assignments
  const [supplyAssignments, setSupplyAssignments] = useState<Omit<PartnerDistributionAssignment, 'id' | 'partnerId'>[]>([]);
  // Input row state for adding supply assignment
  const [newAsgnTerritoryId, setNewAsgnTerritoryId] = useState(selectedTerritoryIds[0] || 'terr-west');
  const [newAsgnBranchId, setNewAsgnBranchId] = useState(activeBranches[0]?.id || '');
  const [newAsgnWarehouseId, setNewAsgnWarehouseId] = useState('');
  const [newAsgnType, setNewAsgnType] = useState<PartnerDistributionAssignment['assignmentType']>('Primary Invoicing & Dispatch');
  const [newAsgnIsPrimary, setNewAsgnIsPrimary] = useState(true);

  // Warehouses filtered by selected branch
  const branchFilteredWarehouses = useMemo(() => {
    return activeWarehouses.filter((w) => w.branchId === newAsgnBranchId);
  }, [activeWarehouses, newAsgnBranchId]);

  // Auto-select first warehouse when branch changes
  const handleBranchChange = (branchId: string) => {
    setNewAsgnBranchId(branchId);
    const available = activeWarehouses.filter((w) => w.branchId === branchId);
    setNewAsgnWarehouseId(available[0]?.id || '');
  };

  // STEP 4 STATE: Commercial Terms (Overrides per territory)
  // Store overrides by territoryId
  const [commercialOverrides, setCommercialOverrides] = useState<Record<string, {
    overrideDiscount: number | null;
    isDiscountOverridden: boolean;
    overrideCreditPeriod: number | null;
    isCreditPeriodOverridden: boolean;
    overrideCreditLimit: number | null;
    isCreditLimitOverridden: boolean;
    overrideSecurityDeposit: number | null;
    isDepositOverridden: boolean;
    reason: string;
  }>>({});

  // Initialize commercial overrides when territories change
  const initializeCommercialForTerritory = (tId: string) => {
    if (!commercialOverrides[tId]) {
      setCommercialOverrides((prev) => ({
        ...prev,
        [tId]: {
          overrideDiscount: null,
          isDiscountOverridden: false,
          overrideCreditPeriod: null,
          isCreditPeriodOverridden: false,
          overrideCreditLimit: null,
          isCreditLimitOverridden: false,
          overrideSecurityDeposit: null,
          isDepositOverridden: false,
          reason: 'Initial onboarding terms'
        }
      }));
    }
  };

  // Add Supply Assignment
  const handleAddAssignment = () => {
    if (!newAsgnTerritoryId) {
      showToast('Please select a territory for this supply assignment.', 'warning');
      return;
    }
    if (!newAsgnBranchId) {
      showToast('Please select an active company branch.', 'warning');
      return;
    }
    if (!newAsgnWarehouseId) {
      showToast('Please select an active supply warehouse under the selected branch.', 'warning');
      return;
    }

    const branch = branches.find((b) => b.id === newAsgnBranchId);
    const warehouse = warehouses.find((w) => w.id === newAsgnWarehouseId);
    const territory = territories.find((t) => t.id === newAsgnTerritoryId);

    // Validate warehouse belongs to branch
    if (warehouse?.branchId !== newAsgnBranchId) {
      showToast('Selected warehouse does not belong to the selected branch.', 'danger');
      return;
    }

    let updatedList = [...supplyAssignments];

    // If new assignment is primary, unset previous primary in this territory
    if (newAsgnIsPrimary) {
      updatedList = updatedList.map((a) =>
        a.territoryId === newAsgnTerritoryId ? { ...a, isPrimary: false } : a
      );
    }

    updatedList.push({
      territoryId: newAsgnTerritoryId,
      territoryName: territory?.name || newAsgnTerritoryId,
      branchId: newAsgnBranchId,
      branchName: branch?.name || newAsgnBranchId,
      warehouseId: newAsgnWarehouseId,
      warehouseName: warehouse?.name || newAsgnWarehouseId,
      assignmentType: newAsgnType,
      isPrimary: newAsgnIsPrimary,
      effectiveFrom: new Date().toISOString().substring(0, 10),
      status: 'Active',
      notes: 'Configured during onboarding'
    });

    setSupplyAssignments(updatedList);
    showToast(`Added supply route: ${branch?.name} → ${warehouse?.name}.`, 'success');
  };

  const handleRemoveAssignment = (index: number) => {
    setSupplyAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  // Type change
  const handleTypeSelect = (id: string) => {
    setTypeId(id);
    if (id === 'ct-super-stockist') setTypeName('Super Stockist');
    else if (id === 'ct-cnf') setTypeName('C&F Agent (Consignee)');
    else if (id === 'ct-institution') setTypeName('Direct Institution');
    else setTypeName('Authorized Distributor');
  };

  // Submit complete onboarding
  const handleCompleteOnboarding = () => {
    if (!name.trim()) {
      showToast('Please provide Partner Legal Entity Name.', 'danger');
      setCurrentStep(1);
      return;
    }
    if (!officialEmail.trim()) {
      showToast('Please provide Official Ordering Email.', 'danger');
      setCurrentStep(1);
      return;
    }
    if (selectedTerritoryIds.length === 0) {
      showToast('Please assign at least one territory in Step 2.', 'danger');
      setCurrentStep(2);
      return;
    }

    const partnerId = `part-${Date.now().toString().slice(-5)}`;

    // Build territory commercials and commercialOverrides
    const territoryCommercials: Record<string, PartnerTerritoryCommercial> = {};
    const finalCommercialOverrides: Record<string, PartnerCommercialOverride> = {};

    selectedTerritoryIds.forEach((tId) => {
      const terr = territories.find((t) => t.id === tId);
      const terrDefault = terr?.defaultCommercialTerms.defaultDiscountPercent || 5.0;
      const ovr = commercialOverrides[tId];

      const hasDiscOvr = ovr?.isDiscountOverridden && ovr?.overrideDiscount !== null && ovr?.overrideDiscount !== undefined;
      const effectiveDisc = hasDiscOvr ? ovr.overrideDiscount! : terrDefault;
      const origin = hasDiscOvr ? 'Partner Override' : 'Territory Default';

      territoryCommercials[tId] = {
        territoryId: tId,
        territoryName: terr?.name || tId,
        inheritedDefaultDiscount: terrDefault,
        partnerOverrideDiscount: hasDiscOvr ? ovr.overrideDiscount : null,
        effectiveDiscount: effectiveDisc,
        overrideOrigin: origin,
        creditLimitOverride: ovr?.isCreditLimitOverridden ? ovr.overrideCreditLimit : null,
        creditPeriodOverride: ovr?.isCreditPeriodOverridden ? ovr.overrideCreditPeriod : null,
        notes: ovr?.reason || 'Onboarded terms'
      };

      if (hasDiscOvr || ovr?.isCreditLimitOverridden || ovr?.isCreditPeriodOverridden || ovr?.isDepositOverridden) {
        finalCommercialOverrides[tId] = {
          id: `ovr-${partnerId}-${tId}`,
          partnerId,
          territoryId: tId,
          territoryName: terr?.name || tId,
          overrideDiscountPercent: hasDiscOvr ? ovr.overrideDiscount : null,
          overrideCreditPeriodDays: ovr?.isCreditPeriodOverridden ? ovr.overrideCreditPeriod : null,
          overrideCreditLimit: ovr?.isCreditLimitOverridden ? ovr.overrideCreditLimit : null,
          overrideSecurityDeposit: ovr?.isDepositOverridden ? ovr.overrideSecurityDeposit : null,
          effectiveFrom: new Date().toISOString().substring(0, 10),
          overrideReason: ovr?.reason || 'Onboarding commercial negotiation',
          updatedBy: 'Commercial Operations',
          history: [
            {
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              field: 'Initial Onboarding',
              oldValue: null,
              newValue: ovr,
              reason: 'Onboarded terms approval',
              updatedBy: 'Commercial Operations'
            }
          ]
        };
      }
    });

    // Build final distribution assignments
    const finalAssignments: PartnerDistributionAssignment[] = supplyAssignments.map((a, idx) => ({
      ...a,
      id: `asgn-${Date.now()}-${idx}`,
      partnerId
    }));

    const newPartner: Partner = {
      id: partnerId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      typeId,
      typeName,
      status: 'Active',
      tierPriceLevel,
      
      // KYC
      gstin: gstin.trim().toUpperCase(),
      gstinStatus,
      pan: pan.trim().toUpperCase(),
      drugLicenseNo: drugLicenseNo.trim(),
      drugLicenseExpiry,
      mdrLicenseNo: mdrLicenseNo.trim(),
      authorizedContactPerson: contactPerson.trim(),
      contactDesignation: designation.trim(),
      officialEmail: officialEmail.trim(),
      mobilePhone: mobilePhone.trim(),
      warehouseAddress: warehouseAddress.trim(),
      kycStatus,
      kycDocuments: kycDocs,

      // Credit baseline
      creditLimit,
      creditDays,
      gracePeriodDays,
      outstandingAmount: 0,
      overdueAmount: 0,
      openOrdersAmount: 0,
      creditHold: false,
      securityDepositHeld,
      depositInstrument,
      depositExpiry,

      // Territories, Channels, Supply
      assignedTerritoryIds: selectedTerritoryIds,
      assignedChannelIds: selectedChannelIds,
      assignedRouteId,
      territoryCommercials,
      commercialOverrides: finalCommercialOverrides,
      distributionAssignments: finalAssignments,

      // Invitation & Portal: Creating partner NEVER grants portal access!
      invitationStatus: 'Not Invited',
      portalAccessStatus: 'Disabled',
      portalUsers: [],

      activeContractsCount: 1,
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10)
    };

    addPartner(newPartner);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-drawer vf-drawer-2xl" style={{ width: '920px' }}>
        
        {/* Wizard Header */}
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <h3 className="vf-drawer-title">
              <Building2 size={20} className="text-blue-600" />
              <span>Partner Onboarding Workflow</span>
            </h3>
            <p className="vf-drawer-subtitle">
              Complete statutory KYC, territorial mapping, supply chain warehouse linkage, and commercial terms.
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

        {/* 5-Step Process Indicator Bar (Section 6 Requirement) */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--vf-slate-200)', background: '#f8fafc', padding: '0 16px' }}>
          {[
            { step: 1, title: '1. Basic Details & KYC' },
            { step: 2, title: '2. Territory & Channel' },
            { step: 3, title: '3. Distribution & Supply' },
            { step: 4, title: '4. Commercial Terms' },
            { step: 5, title: '5. Review & Onboard' }
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => setCurrentStep(item.step as any)}
              style={{
                flex: 1,
                padding: '12px 6px',
                border: 'none',
                background: 'none',
                borderBottom: currentStep === item.step ? '3px solid var(--vf-primary)' : '3px solid transparent',
                fontWeight: currentStep === item.step ? 700 : 500,
                color: currentStep === item.step ? 'var(--vf-primary)' : 'var(--vf-slate-600)',
                fontSize: '12.5px',
                cursor: 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Wizard Step Body */}
        <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ============================================================== */}
          {/* STEP 1: BASIC DETAILS & KYC */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                1. Entity Identity & Statutory Regulatory Licensing
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Partner Legal Entity Name *</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. Zenith Ortho & Surgicals LLP"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="vf-form-label">Partner Trade Code *</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. DIST-WEST-04"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">Channel Tier / Classification *</label>
                  <select
                    className="vf-form-control"
                    value={typeId}
                    onChange={(e) => handleTypeSelect(e.target.value)}
                  >
                    <option value="ct-distributor">Authorized Distributor</option>
                    <option value="ct-super-stockist">Super Stockist</option>
                    <option value="ct-cnf">C&F Agent (Consignee)</option>
                    <option value="ct-institution">Direct Institution / Hospital</option>
                  </select>
                </div>
                <div>
                  <label className="vf-form-label">Applicable Base Price Tier</label>
                  <select
                    className="vf-form-control"
                    value={tierPriceLevel}
                    onChange={(e) => setTierPriceLevel(e.target.value)}
                  >
                    <option value="PTD (Tier 1)">PTD (Price to Distributor - Tier 1)</option>
                    <option value="PTS (Super Stockist)">PTS (Price to Stockist)</option>
                    <option value="PTR (Retail)">PTR (Price to Retailer)</option>
                    <option value="Direct Institutional Rate Contract">Direct Institutional Rate Contract</option>
                  </select>
                </div>
              </div>

              {/* Statutory KYC Grid */}
              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '12px' }}>
                  Statutory Identification & Licensing (CDSCO / State FDA)
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">GSTIN Identification Number *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="vf-form-control"
                        placeholder="e.g. 27AABCS9912E1Z4"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      />
                      <button
                        type="button"
                        className="vf-btn vf-btn-secondary vf-btn-sm"
                        onClick={() => {
                          if (gstin.length >= 15) {
                            setGstinStatus('Verified on GST Portal');
                            showToast(`GSTIN ${gstin} verified with GSTN Portal.`, 'success');
                          } else {
                            showToast('Please enter a valid 15-character GSTIN.', 'warning');
                          }
                        }}
                      >
                        Verify GSTN
                      </button>
                    </div>
                    <span className={`vf-badge ${gstinStatus === 'Verified on GST Portal' ? 'vf-badge-active' : 'vf-badge-pending'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                      {gstinStatus}
                    </span>
                  </div>

                  <div>
                    <label className="vf-form-label">PAN Card Number *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. AABCS9912E"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px', marginTop: '12px' }}>
                  <div>
                    <label className="vf-form-label">Drug License Numbers (Form 20B / 21B)</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. MH-PUN-20B-184920 / 21B-184921"
                      value={drugLicenseNo}
                      onChange={(e) => setDrugLicenseNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">Drug License Expiry</label>
                    <input
                      type="date"
                      className="vf-form-control"
                      value={drugLicenseExpiry}
                      onChange={(e) => setDrugLicenseExpiry(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label className="vf-form-label">Medical Device MDR Wholesale License</label>
                  <input
                    type="text"
                    className="vf-form-control"
                    placeholder="e.g. MD-42-MH-2024-00129"
                    value={mdrLicenseNo}
                    onChange={(e) => setMdrLicenseNo(e.target.value)}
                  />
                </div>
              </div>

              {/* Authorized Contacts */}
              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '12px' }}>
                  Authorized Signatory & Contact Logistics
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">Authorized Contact Person *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. Rajesh Sharma"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">Designation</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. Managing Director"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                  <div>
                    <label className="vf-form-label">Official Ordering Email *</label>
                    <input
                      type="email"
                      className="vf-form-control"
                      placeholder="orders@zenithortho.in"
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">Mobile Phone Number *</label>
                    <input
                      type="tel"
                      className="vf-form-control"
                      placeholder="+91 98220 11223"
                      value={mobilePhone}
                      onChange={(e) => setMobilePhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label className="vf-form-label">Registered Warehouse / Commercial Delivery Address</label>
                  <textarea
                    rows={2}
                    className="vf-form-control"
                    placeholder="Plot 45, Bhosari Industrial Area, Sector 10, Pune 411026"
                    value={warehouseAddress}
                    onChange={(e) => setWarehouseAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* KYC Document Table */}
              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
                    Statutory KYC Document Uploads ({kycDocs.length})
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>KYC Workflow Status:</span>
                    <select
                      className="vf-form-control"
                      style={{ fontSize: '12px', height: '28px', width: '150px' }}
                      value={kycStatus}
                      onChange={(e) => setKycStatus(e.target.value as any)}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Pending Verification">Pending Verification</option>
                      <option value="Verified">Verified</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <table className="vf-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>File Name</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kycDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <strong>{doc.title}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{doc.type}</div>
                        </td>
                        <td><code>{doc.fileName}</code></td>
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
                              setKycDocs((prev) =>
                                prev.map((d) =>
                                  d.id === doc.id
                                    ? { ...d, verificationStatus: d.verificationStatus === 'Verified' ? 'Pending' : 'Verified' }
                                    : d
                                )
                              );
                            }}
                          >
                            {doc.verificationStatus === 'Verified' ? 'Set Pending' : '✓ Mark Verified'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: TERRITORY & CHANNEL */}
          {/* ============================================================== */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                2. Distribution Territory & Channel Route Assignments
              </div>

              <div>
                <label className="vf-form-label">Assigned Distribution Territories * (Select all that apply)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {territories.map((t) => {
                    const isChecked = selectedTerritoryIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          background: isChecked ? '#eff6ff' : '#f8fafc',
                          border: `2px solid ${isChecked ? 'var(--vf-primary)' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTerritoryIds((prev) => [...prev, t.id]);
                              initializeCommercialForTerritory(t.id);
                            } else {
                              if (selectedTerritoryIds.length > 1) {
                                setSelectedTerritoryIds((prev) => prev.filter((id) => id !== t.id));
                              } else {
                                showToast('At least one territory must remain assigned.', 'warning');
                              }
                            }
                          }}
                        />
                        <div>
                          <strong>{t.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                            Code: <code>{t.code}</code> · State: {t.state}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                            Territory Default Discount: {t.defaultCommercialTerms.defaultDiscountPercent}%
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <label className="vf-form-label">Permitted Sales Channels</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {salesChannels.map((c) => {
                    const isChecked = selectedChannelIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          padding: '6px 12px',
                          background: isChecked ? '#eff6ff' : '#ffffff',
                          border: `1px solid ${isChecked ? '#93c5fd' : '#cbd5e1'}`,
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedChannelIds((prev) => [...prev, c.id]);
                            else setSelectedChannelIds((prev) => prev.filter((id) => id !== c.id));
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <label className="vf-form-label">Assigned Distribution Route Topology *</label>
                <select
                  className="vf-form-control"
                  value={assignedRouteId}
                  onChange={(e) => setAssignedRouteId(e.target.value)}
                >
                  {distributionRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code}) — {r.description}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginTop: '4px', display: 'block' }}>
                  Distribution routes describe the physical transit stages, separate from commercial branch supply assignments.
                </span>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: DISTRIBUTION & SUPPLY ASSIGNMENT */}
          {/* ============================================================== */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                  3. Distribution & Supply Branch/Warehouse Assignments
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-600)' }}>
                  Link the partner to physical supply warehouses. You can assign multiple warehouses in the same territory and across multiple territories.
                </p>
              </div>

              {/* Add Assignment Control Card */}
              <div style={{ background: '#f8fafc', padding: '16px', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--vf-slate-800)' }}>
                  + Configure New Supply Linkage
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.5fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Territory *</label>
                    <select
                      className="vf-form-control"
                      value={newAsgnTerritoryId}
                      onChange={(e) => setNewAsgnTerritoryId(e.target.value)}
                    >
                      {selectedTerritoryIds.map((tId) => {
                        const t = territories.find((x) => x.id === tId);
                        return <option key={tId} value={tId}>{t?.name || tId}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="vf-form-label">Company Branch * (Active)</label>
                    <select
                      className="vf-form-control"
                      value={newAsgnBranchId}
                      onChange={(e) => handleBranchChange(e.target.value)}
                    >
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="vf-form-label">Supply Warehouse * (Filtered to Branch)</label>
                    <select
                      className="vf-form-control"
                      value={newAsgnWarehouseId}
                      onChange={(e) => setNewAsgnWarehouseId(e.target.value)}
                    >
                      {branchFilteredWarehouses.length === 0 ? (
                        <option value="">No active warehouses under this branch</option>
                      ) : (
                        branchFilteredWarehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.city}) {w.temperatureControlled ? '❄ Cold' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                  <div>
                    <label className="vf-form-label">Assignment Purpose / Type</label>
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

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', paddingBottom: '8px' }}>
                      <input
                        type="checkbox"
                        checked={newAsgnIsPrimary}
                        onChange={(e) => setNewAsgnIsPrimary(e.target.checked)}
                      />
                      <span><strong>Primary Warehouse</strong> for Territory</span>
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary"
                      onClick={handleAddAssignment}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={14} />
                      <span>Add Supply Link</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Assignments Table */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '8px' }}>
                  Configured Distribution Supply Routes ({supplyAssignments.length})
                </div>

                <table className="vf-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Territory</th>
                      <th>Supplying Branch</th>
                      <th>Supplying Warehouse</th>
                      <th>Purpose / Type</th>
                      <th>Primary</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplyAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                          No supply linkages added yet. Use the configuration card above to link branches and warehouses.
                        </td>
                      </tr>
                    ) : (
                      supplyAssignments.map((asgn, idx) => (
                        <tr key={idx}>
                          <td><strong>{asgn.territoryName}</strong></td>
                          <td>{asgn.branchName}</td>
                          <td>
                            <strong>{asgn.warehouseName}</strong>
                          </td>
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
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => handleRemoveAssignment(idx)}
                              style={{ color: 'var(--vf-danger)' }}
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
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: COMMERCIAL TERMS (DEFAULTS & OVERRIDES) */}
          {/* ============================================================== */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12.5px', color: '#1e40af' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={16} />
                  <span>Master Defaults & Partner Override Architecture</span>
                </div>
                <div style={{ marginTop: '4px' }}>
                  The table below loads Master Defaults from the Go-to-Market configuration. You can selectively override discount, credit limit, or credit period per territory. Only explicit overrides are stored; inherited master defaults stay protected.
                </div>
              </div>

              {selectedTerritoryIds.map((tId) => {
                const terr = territories.find((t) => t.id === tId);
                const masterDefaultDiscount = terr?.defaultCommercialTerms.defaultDiscountPercent || 5.0;
                const masterDefaultCreditLimit = terr?.defaultCommercialTerms.creditLimit || 3500000;
                const masterDefaultCreditPeriod = terr?.defaultCommercialTerms.creditPeriodDays || 45;

                const ovr = commercialOverrides[tId] || {
                  overrideDiscount: null,
                  isDiscountOverridden: false,
                  overrideCreditPeriod: null,
                  isCreditPeriodOverridden: false,
                  overrideCreditLimit: null,
                  isCreditLimitOverridden: false,
                  overrideSecurityDeposit: null,
                  isDepositOverridden: false,
                  reason: ''
                };

                const effectiveDisc = ovr.isDiscountOverridden && ovr.overrideDiscount !== null ? ovr.overrideDiscount : masterDefaultDiscount;
                const effectiveLimit = ovr.isCreditLimitOverridden && ovr.overrideCreditLimit !== null ? ovr.overrideCreditLimit : masterDefaultCreditLimit;
                const effectivePeriod = ovr.isCreditPeriodOverridden && ovr.overrideCreditPeriod !== null ? ovr.overrideCreditPeriod : masterDefaultCreditPeriod;

                return (
                  <div key={tId} style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--vf-slate-900)' }}>{terr?.name || tId}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginLeft: '8px' }}>
                          Code: <code>{terr?.code || tId}</code> · State: {terr?.state}
                        </span>
                      </div>
                      <span className={`vf-badge ${ovr.isDiscountOverridden ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                        {ovr.isDiscountOverridden ? 'Partner Override Active' : 'Inheriting Master Defaults'}
                      </span>
                    </div>

                    <table className="vf-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Commercial Term</th>
                          <th style={{ textAlign: 'right' }}>Master Default</th>
                          <th style={{ width: '220px' }}>Partner Override</th>
                          <th style={{ textAlign: 'right' }}>Effective Term</th>
                          <th>Origin Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Discount % */}
                        <tr>
                          <td><strong>Discount Percentage</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{masterDefaultDiscount}%</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="checkbox"
                                checked={ovr.isDiscountOverridden}
                                onChange={(e) => {
                                  setCommercialOverrides((prev) => ({
                                    ...prev,
                                    [tId]: {
                                      ...ovr,
                                      isDiscountOverridden: e.target.checked,
                                      overrideDiscount: e.target.checked ? (ovr.overrideDiscount || masterDefaultDiscount + 2) : null
                                    }
                                  }));
                                }}
                              />
                              {ovr.isDiscountOverridden ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  className="vf-form-control"
                                  style={{ width: '90px', height: '28px', fontSize: '12px', textAlign: 'right' }}
                                  value={ovr.overrideDiscount ?? masterDefaultDiscount}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setCommercialOverrides((prev) => ({
                                      ...prev,
                                      [tId]: { ...ovr, overrideDiscount: isNaN(val) ? 0 : val }
                                    }));
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--vf-slate-400)' }}>None (Inherited)</span>
                              )}
                              {ovr.isDiscountOverridden && <span>%</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: ovr.isDiscountOverridden ? '#1d4ed8' : '#0f172a' }}>
                              {effectiveDisc}%
                            </strong>
                          </td>
                          <td>
                            <span className={`vf-badge ${ovr.isDiscountOverridden ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                              {ovr.isDiscountOverridden ? 'Partner Override' : 'Master Default'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {ovr.isDiscountOverridden && (
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                onClick={() => {
                                  setCommercialOverrides((prev) => ({
                                    ...prev,
                                    [tId]: { ...ovr, isDiscountOverridden: false, overrideDiscount: null }
                                  }));
                                  showToast(`Reset discount for ${terr?.name} to master default.`, 'info');
                                }}
                              >
                                <RotateCcw size={11} style={{ marginRight: '4px' }} />
                                Reset
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Credit Limit */}
                        <tr>
                          <td><strong>Credit Limit (₹)</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹ {(masterDefaultCreditLimit / 100000).toFixed(1)}L</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="checkbox"
                                checked={ovr.isCreditLimitOverridden}
                                onChange={(e) => {
                                  setCommercialOverrides((prev) => ({
                                    ...prev,
                                    [tId]: {
                                      ...ovr,
                                      isCreditLimitOverridden: e.target.checked,
                                      overrideCreditLimit: e.target.checked ? (ovr.overrideCreditLimit || masterDefaultCreditLimit) : null
                                    }
                                  }));
                                }}
                              />
                              {ovr.isCreditLimitOverridden ? (
                                <input
                                  type="number"
                                  step="50000"
                                  className="vf-form-control"
                                  style={{ width: '110px', height: '28px', fontSize: '12px', textAlign: 'right' }}
                                  value={ovr.overrideCreditLimit ?? masterDefaultCreditLimit}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCommercialOverrides((prev) => ({
                                      ...prev,
                                      [tId]: { ...ovr, overrideCreditLimit: isNaN(val) ? 0 : val }
                                    }));
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--vf-slate-400)' }}>None (Inherited)</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: ovr.isCreditLimitOverridden ? '#1d4ed8' : '#0f172a' }}>
                              ₹ {(effectiveLimit / 100000).toFixed(1)}L
                            </strong>
                          </td>
                          <td>
                            <span className={`vf-badge ${ovr.isCreditLimitOverridden ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                              {ovr.isCreditLimitOverridden ? 'Partner Override' : 'Master Default'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {ovr.isCreditLimitOverridden && (
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                onClick={() => {
                                  setCommercialOverrides((prev) => ({
                                    ...prev,
                                    [tId]: { ...ovr, isCreditLimitOverridden: false, overrideCreditLimit: null }
                                  }));
                                }}
                              >
                                Reset
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Credit Period */}
                        <tr>
                          <td><strong>Credit Period (Days)</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{masterDefaultCreditPeriod} Days</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="checkbox"
                                checked={ovr.isCreditPeriodOverridden}
                                onChange={(e) => {
                                  setCommercialOverrides((prev) => ({
                                    ...prev,
                                    [tId]: {
                                      ...ovr,
                                      isCreditPeriodOverridden: e.target.checked,
                                      overrideCreditPeriod: e.target.checked ? (ovr.overrideCreditPeriod || 60) : null
                                    }
                                  }));
                                }}
                              />
                              {ovr.isCreditPeriodOverridden ? (
                                <input
                                  type="number"
                                  className="vf-form-control"
                                  style={{ width: '80px', height: '28px', fontSize: '12px', textAlign: 'right' }}
                                  value={ovr.overrideCreditPeriod ?? masterDefaultCreditPeriod}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCommercialOverrides((prev) => ({
                                      ...prev,
                                      [tId]: { ...ovr, overrideCreditPeriod: isNaN(val) ? 0 : val }
                                    }));
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--vf-slate-400)' }}>None (Inherited)</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: ovr.isCreditPeriodOverridden ? '#1d4ed8' : '#0f172a' }}>
                              {effectivePeriod} Days
                            </strong>
                          </td>
                          <td>
                            <span className={`vf-badge ${ovr.isCreditPeriodOverridden ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                              {ovr.isCreditPeriodOverridden ? 'Partner Override' : 'Master Default'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {ovr.isCreditPeriodOverridden && (
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                onClick={() => {
                                  setCommercialOverrides((prev) => ({
                                    ...prev,
                                    [tId]: { ...ovr, isCreditPeriodOverridden: false, overrideCreditPeriod: null }
                                  }));
                                }}
                              >
                                Reset
                              </button>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {(ovr.isDiscountOverridden || ovr.isCreditLimitOverridden || ovr.isCreditPeriodOverridden) && (
                      <div style={{ marginTop: '10px' }}>
                        <label className="vf-form-label">Justification / Reason for Commercial Overrides *</label>
                        <input
                          type="text"
                          className="vf-form-control"
                          placeholder="e.g. Higher volume target commitment agreed in contract..."
                          value={ovr.reason || ''}
                          onChange={(e) => {
                            setCommercialOverrides((prev) => ({
                              ...prev,
                              [tId]: { ...ovr, reason: e.target.value }
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: REVIEW & ONBOARD */}
          {/* ============================================================== */}
          {currentStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                5. Comprehensive Onboarding Review & Confirmation
              </div>

              {/* Entity & KYC Summary */}
              <div style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                <strong style={{ fontSize: '14px', color: 'var(--vf-slate-900)' }}>1. Entity Profile & Statutory KYC</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '10px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Legal Name:</span>
                    <div style={{ fontWeight: 700 }}>{name || 'Not Provided'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>Code: <code>{code}</code> · {typeName}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>GSTIN & PAN:</span>
                    <div style={{ fontWeight: 600 }}>{gstin || 'None'} ({gstinStatus})</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-600)' }}>PAN: {pan || 'None'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Primary Contact:</span>
                    <div style={{ fontWeight: 600 }}>{contactPerson} ({designation})</div>
                    <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{officialEmail} · {mobilePhone}</div>
                  </div>
                </div>
              </div>

              {/* Territories & Supply Summary */}
              <div style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                <strong style={{ fontSize: '14px', color: 'var(--vf-slate-900)' }}>2. Territories & Supply Distribution Points</strong>
                <div style={{ marginTop: '8px', fontSize: '12.5px' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Assigned Territories:</span>{' '}
                    <strong>{selectedTerritoryIds.map((tId) => territories.find((t) => t.id === tId)?.name).join(', ')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--vf-slate-500)' }}>Linked Supply Warehouses ({supplyAssignments.length}):</span>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                      {supplyAssignments.map((a, i) => (
                        <li key={i}>
                          <strong>{a.territoryName}</strong>: {a.branchName} &rarr; <strong>{a.warehouseName}</strong> ({a.assignmentType}) {a.isPrimary ? '★ Primary' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Commercial Terms Summary */}
              <div style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                <strong style={{ fontSize: '14px', color: 'var(--vf-slate-900)' }}>3. Effective Commercial Terms</strong>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  {selectedTerritoryIds.map((tId) => {
                    const terr = territories.find((t) => t.id === tId);
                    const defDisc = terr?.defaultCommercialTerms.defaultDiscountPercent || 5.0;
                    const ovr = commercialOverrides[tId];
                    const effDisc = ovr?.isDiscountOverridden && ovr?.overrideDiscount !== null ? ovr.overrideDiscount : defDisc;
                    const isOvr = ovr?.isDiscountOverridden;

                    return (
                      <div key={tId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '180px', fontWeight: 600 }}>{terr?.name}:</span>
                        <span>Effective Discount: <strong style={{ color: isOvr ? '#1d4ed8' : '#059669' }}>{effDisc}%</strong></span>
                        <span className={`vf-badge ${isOvr ? 'vf-badge-active' : 'vf-badge-pending'}`}>
                          {isOvr ? 'Partner Override' : 'Master Default'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                <strong>Governance Reminder:</strong> Completing partner onboarding creates the commercial entity and registers supply linkages. Distribution Portal access is <em>not</em> granted automatically; invitations must be explicitly triggered from Partner Management after KYC verification.
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Controls */}
        <div className="vf-drawer-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={() => setCurrentStep((s) => (s - 1) as any)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep < 5 ? (
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                onClick={() => setCurrentStep((s) => (s + 1) as any)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                onClick={handleCompleteOnboarding}
                style={{ fontWeight: 700 }}
              >
                ✓ Complete Partner Onboarding
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
