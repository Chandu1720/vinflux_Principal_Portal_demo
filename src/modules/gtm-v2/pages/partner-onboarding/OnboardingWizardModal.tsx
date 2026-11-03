import React, { useState } from 'react';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Building2,
  FileText,
  MapPin,
  Workflow,
  Layers,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type {
  PartnerOnboardingRecord,
  KycDocument,
  PartnerCommercialOverride,
  OnboardingStatus
} from '../../types/gtmV2.types';
import { SideDrawer } from '../../components/common/SideDrawer';
import { HierarchicalTreeSelect } from '../../components/common/HierarchicalTreeSelect';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPartner: PartnerOnboardingRecord) => void;
}

const WIZARD_STEPS = [
  { step: 1, title: 'Basic Info', icon: <Building2 size={15} /> },
  { step: 2, title: 'KYC Documents', icon: <FileText size={15} /> },
  { step: 3, title: 'Territory Assignment', icon: <MapPin size={15} /> },
  { step: 4, title: 'Sales Flow Selection', icon: <Workflow size={15} /> },
  { step: 5, title: 'Stage Mapping', icon: <Layers size={15} /> },
  { step: 6, title: 'Commercial Terms', icon: <CreditCard size={15} /> },
  { step: 7, title: 'Review & Submit', icon: <ShieldCheck size={15} /> }
];

// GST State Codes Map
const GST_STATE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '19': 'West Bengal',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh'
};

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const {
    territories,
    salesChannels,
    salesFlows,
    partners,
    config,
    createPartnerOnboarding,
    createApprovalRequest
  } = useGtmV2();

  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [partnerCode] = useState(`PTR-${new Date().getFullYear()}-${String(partners.length + 1).padStart(3, '0')}`);
  const [gstin, setGstin] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [partnerType, setPartnerType] = useState('Distributor');
  const [salesChannelId, setSalesChannelId] = useState(salesChannels[0]?.id || '');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Andhra Pradesh');
  const [pinCode, setPinCode] = useState('');
  const [pan, setPan] = useState('');
  const [drugLicenseNo, setDrugLicenseNo] = useState('');

  // GSTIN Verification State
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);
  const [gstinVerifiedData, setGstinVerifiedData] = useState<{
    legalName: string;
    tradeName: string;
    pan: string;
    state: string;
    taxpayerType: string;
    status: string;
    address: string;
    pincode: string;
  } | null>(null);

  // Step 2 KYC
  const [kycDocs, setKycDocs] = useState<KycDocument[]>(
    config.requiredKycDocuments.map((docDef) => ({
      id: `kyc-${Date.now()}-${docDef.id}`,
      documentType: docDef.name,
      documentNumber: '',
      fileName: undefined,
      uploadedAt: '',
      status: 'Pending'
    }))
  );

  // Step 3 Territory
  const [primaryTerritoryId, setPrimaryTerritoryId] = useState('');
  const [coverageTerritoryIds, setCoverageTerritoryIds] = useState<string[]>([]);

  // Step 4 Sales Flow
  const [selectedFlowId, setSelectedFlowId] = useState(salesFlows[0]?.id || '');

  // Step 5 Stage Mapping
  const [mappedStageNumber, setMappedStageNumber] = useState(2);

  // Step 6 Commercial Terms Override
  const selectedChannel = salesChannels.find((c) => c.id === salesChannelId) || salesChannels[0];
  const [overrideDiscount, setOverrideDiscount] = useState<number | undefined>(undefined);
  const [overrideCreditDays, setOverrideCreditDays] = useState<number | undefined>(undefined);
  const [overrideCreditLimit, setOverrideCreditLimit] = useState<number | undefined>(undefined);
  const [overrideDeposit, setOverrideDeposit] = useState<number | undefined>(undefined);
  const [deviationReason, setDeviationReason] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if deviated
  const isDeviated =
    (overrideDiscount !== undefined && overrideDiscount !== selectedChannel?.standardDiscountPercent) ||
    (overrideCreditDays !== undefined && overrideCreditDays !== selectedChannel?.creditPeriodDays) ||
    (overrideCreditLimit !== undefined && overrideCreditLimit !== selectedChannel?.creditLimit) ||
    (overrideDeposit !== undefined && overrideDeposit !== selectedChannel?.depositAmount);

  const selectedFlow = salesFlows.find((f) => f.id === selectedFlowId) || salesFlows[0];

  // GSTIN Live Verification & Auto-Fill Handler
  const handleVerifyGstin = () => {
    const cleanGst = gstin.trim().toUpperCase();
    if (!cleanGst || cleanGst.length !== 15) {
      setErrors((prev) => ({
        ...prev,
        gstin: 'Please enter a valid 15-character GSTIN (e.g. 37AAACA1234A1Z5).'
      }));
      return;
    }

    setIsVerifyingGstin(true);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.gstin;
      return copy;
    });

    // Simulate GST Portal API handshake
    setTimeout(() => {
      const stateCode = cleanGst.substring(0, 2);
      const extractedPan = cleanGst.substring(2, 12);
      const resolvedState = GST_STATE_MAP[stateCode] || 'Andhra Pradesh';

      // Realistic business details based on PAN & State
      let resolvedLegalName = 'Apex Meditech Logistics Private Limited';
      let resolvedTradeName = 'Apex Meditech Devices';
      let resolvedCity = 'Vijayawada';
      let resolvedPin = '520007';
      let resolvedStreet = 'Plot 42, APIIC Auto Nagar Industrial Park';

      if (stateCode === '36') {
        resolvedLegalName = 'Deccan Surgical & Hospital Supplies Pvt Ltd';
        resolvedTradeName = 'Deccan Surgical';
        resolvedCity = 'Hyderabad';
        resolvedPin = '500034';
        resolvedStreet = 'Road No 12, Banjara Hills Commercial Complex';
      } else if (stateCode === '29') {
        resolvedLegalName = 'Karnataka Healthcare Logistics & Consignment LLP';
        resolvedTradeName = 'Karnataka Healthcare';
        resolvedCity = 'Bengaluru';
        resolvedPin = '560025';
        resolvedStreet = '24/1, Richmond Road Commercial Center';
      } else if (stateCode === '27') {
        resolvedLegalName = 'Western Medico Distribution Private Limited';
        resolvedTradeName = 'Western Medico';
        resolvedCity = 'Mumbai';
        resolvedPin = '400018';
        resolvedStreet = 'Unit 8, Peninsula Business Park, Lower Parel';
      } else if (stateCode === '33') {
        resolvedLegalName = 'Southern Ortho & Surgical Supplies Private Limited';
        resolvedTradeName = 'Southern Ortho';
        resolvedCity = 'Chennai';
        resolvedPin = '600006';
        resolvedStreet = '55, Anna Salai Commercial Tower';
      }

      // Auto-fill form fields
      setName(resolvedLegalName);
      setBusinessName(resolvedTradeName);
      setPan(extractedPan);
      setState(resolvedState);
      setCity(resolvedCity);
      setPinCode(resolvedPin);
      setStreet(resolvedStreet);

      setGstinVerifiedData({
        legalName: resolvedLegalName,
        tradeName: resolvedTradeName,
        pan: extractedPan,
        state: resolvedState,
        taxpayerType: 'Regular Taxpayer',
        status: 'Active (Valid GSTN Registration)',
        address: resolvedStreet,
        pincode: resolvedPin
      });

      setIsVerifyingGstin(false);
    }, 600);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!name.trim()) newErrors.name = 'Legal entity name is required.';
      if (!contactPerson.trim()) newErrors.contactPerson = 'Primary contact person is required.';
      if (!email.trim() || !email.includes('@')) newErrors.email = 'Valid business email is required.';
      if (!phone.trim() || phone.length < 10) newErrors.phone = 'Valid 10-digit phone number is required.';
      if (!gstin.trim() || gstin.length < 15) newErrors.gstin = 'Valid 15-character GSTIN is required.';
      if (!pan.trim() || pan.length < 10) newErrors.pan = 'Valid 10-character PAN is required.';
      if (!pinCode.trim() || pinCode.length < 6) newErrors.pinCode = '6-digit postal PIN is required.';
    } else if (step === 3) {
      if (!primaryTerritoryId) newErrors.primaryTerritoryId = 'Please select a primary home territory.';
    } else if (step === 4) {
      if (!selectedFlowId) newErrors.selectedFlowId = 'Please select an active Sales Flow.';
    } else if (step === 6) {
      if (isDeviated && !deviationReason.trim()) {
        newErrors.deviationReason = 'Justification is mandatory for terms deviating from channel standards.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((p) => Math.min(p + 1, 7));
    }
  };

  const handleBack = () => {
    setCurrentStep((p) => Math.max(p - 1, 1));
  };

  const handleUploadKycDoc = (docIndex: number) => {
    const updated = [...kycDocs];
    const doc = updated[docIndex];
    const dummyNum = doc.documentNumber || `DOC-${Math.floor(100000 + Math.random() * 900000)}`;
    updated[docIndex] = {
      ...doc,
      documentNumber: dummyNum,
      fileName: `${doc.documentType.replace(/\s+/g, '_')}_Verified.pdf`,
      uploadedAt: new Date().toISOString(),
      status: 'Verified'
    };
    setKycDocs(updated);
  };

  const handleSubmitOnboarding = () => {
    const effectiveDiscount = overrideDiscount !== undefined ? overrideDiscount : (selectedChannel?.standardDiscountPercent || 0);
    const effectiveCreditDays = overrideCreditDays !== undefined ? overrideCreditDays : (selectedChannel?.creditPeriodDays || 0);
    const effectiveCreditLimit = overrideCreditLimit !== undefined ? overrideCreditLimit : (selectedChannel?.creditLimit || 0);
    const effectiveDeposit = overrideDeposit !== undefined ? overrideDeposit : (selectedChannel?.depositAmount || 0);

    const commercialTermsData: PartnerCommercialOverride = {
      standardDiscount: selectedChannel?.standardDiscountPercent || 0,
      effectiveDiscount,
      isDiscountOverridden: overrideDiscount !== undefined && overrideDiscount !== selectedChannel?.standardDiscountPercent,
      standardCreditDays: selectedChannel?.creditPeriodDays || 0,
      effectiveCreditDays,
      isCreditDaysOverridden: overrideCreditDays !== undefined && overrideCreditDays !== selectedChannel?.creditPeriodDays,
      standardCreditLimit: selectedChannel?.creditLimit || 0,
      effectiveCreditLimit,
      isCreditLimitOverridden: overrideCreditLimit !== undefined && overrideCreditLimit !== selectedChannel?.creditLimit,
      requiresDeposit: selectedChannel?.requiresDeposit || false,
      depositAmount: effectiveDeposit,
      overrideReason: deviationReason.trim() || undefined,
      approvalStatus: isDeviated ? 'Pending Approval' : 'Standard'
    };

    let initialStatus: OnboardingStatus = 'Draft';
    if (isDeviated) {
      initialStatus = 'Approval Pending';
    } else {
      const allVerified = kycDocs.every((d) => d.status === 'Verified');
      initialStatus = allVerified ? 'Active' : 'KYC Under Review';
    }

    const primaryTerritory = territories.find((t) => t.id === primaryTerritoryId);
    const assignedTerritoryIds = [primaryTerritoryId, ...coverageTerritoryIds.filter((id) => id !== primaryTerritoryId)];

    const newPartnerRecord: Omit<PartnerOnboardingRecord, 'id' | 'onboardedAt' | 'updatedAt'> = {
      code: partnerCode,
      name: name.trim(),
      businessName: businessName.trim() || name.trim(),
      partnerType,
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: {
        street: street.trim() || 'Industrial Area',
        city: city.trim() || (primaryTerritory ? primaryTerritory.name : 'Vijayawada'),
        state: state.trim() || 'Andhra Pradesh',
        pinCode: pinCode.trim(),
        country: 'India'
      },
      gstin: gstin.trim().toUpperCase(),
      pan: pan.trim().toUpperCase(),
      drugLicenseNo: drugLicenseNo.trim(),
      status: initialStatus,
      kycDocuments: kycDocs,
      assignedTerritoryIds,
      assignedTerritoryNames: assignedTerritoryIds
        .map((id) => territories.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[],
      selectedSalesFlowIds: [selectedFlowId],
      selectedSalesFlowNames: [selectedFlow?.name || 'Default Flow'],
      partnerMappings: [
        {
          flowId: selectedFlowId,
          stageNumber: mappedStageNumber,
          stageChannelName: selectedChannel?.name || 'Standard Channel',
          mappedPartnerId: partnerCode,
          mappedPartnerName: name.trim(),
          mappedPartnerCode: partnerCode
        }
      ],
      commercialTerms: commercialTermsData
    };

    createPartnerOnboarding(newPartnerRecord);

    // If commercial terms deviated, automatically raise commercial approval request
    if (isDeviated) {
      createApprovalRequest({
        requestType: 'Discount Override',
        partnerId: partnerCode,
        partnerName: name.trim(),
        partnerCode,
        requestedBy: 'Channel Onboarding Lead',
        description: `Commercial deviation requested for ${name.trim()} (${partnerType}) in channel ${selectedChannel?.name}.`,
        proposedValues: {
          discountPercent: overrideDiscount,
          creditPeriodDays: overrideCreditDays,
          creditLimit: overrideCreditLimit,
          depositAmount: overrideDeposit
        },
        previousValues: {
          discountPercent: selectedChannel?.standardDiscountPercent,
          creditPeriodDays: selectedChannel?.creditPeriodDays,
          creditLimit: selectedChannel?.creditLimit,
          depositAmount: selectedChannel?.depositAmount
        },
        justification: deviationReason.trim()
      });
    }

    onSuccess({
      ...newPartnerRecord,
      id: `partner-${Date.now()}`,
      onboardedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    onClose();
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Partner Onboarding Wizard"
      subtitle={`Application Code: ${partnerCode} • Enterprise Channel Governance`}
      size="xl"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Wizard Progress Steps Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: '16px',
            overflowX: 'auto',
            gap: '8px'
          }}
        >
          {WIZARD_STEPS.map((s) => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;
            return (
              <div
                key={s.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isCurrent || isCompleted ? 1 : 0.45,
                  cursor: isCompleted ? 'pointer' : 'default',
                  flexShrink: 0
                }}
                onClick={() => {
                  if (isCompleted) setCurrentStep(s.step);
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent ? '#7C3AED' : isCompleted ? '#10B981' : '#E2E8F0',
                    color: isCurrent || isCompleted ? '#FFFFFF' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  {isCompleted ? <Check size={14} /> : s.step}
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#7C3AED' : isCompleted ? '#10B981' : '#64748B'
                  }}
                >
                  {s.title}
                </span>
                {s.step < 7 && <ChevronRight size={14} color="#CBD5E1" />}
              </div>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* STEP 1: BASIC INFORMATION WITH LIVE GSTIN VERIFICATION */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  Step 1: Statutory Identity & GSTIN Auto-Verification
                </h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Verify GSTIN to auto-fetch legal registered name, trade name, PAN, and official state.
                </p>
              </div>
            </div>

            {/* GSTIN Verification Input Banner */}
            <div
              style={{
                backgroundColor: '#F5F3FF',
                border: '1.5px solid #DDD6FE',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6D28D9' }}>
                GSTIN (15 Digits) *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. 37AAACA1234A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${errors.gstin ? '#EF4444' : '#CBD5E1'}`,
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    backgroundColor: '#FFFFFF'
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyGstin}
                  disabled={isVerifyingGstin}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isVerifyingGstin ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isVerifyingGstin ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Verify & Auto-Fill</span>
                    </>
                  )}
                </button>
              </div>
              {errors.gstin && <div style={{ fontSize: '11px', color: '#EF4444' }}>{errors.gstin}</div>}

              {/* Verified Result Banner */}
              {gstinVerifiedData && (
                <div
                  style={{
                    backgroundColor: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    marginTop: '4px',
                    fontSize: '12px',
                    color: '#15803D',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <CheckCircle2 size={15} />
                    <span>GSTIN Verified: {gstinVerifiedData.status}</span>
                  </div>
                  <div style={{ color: '#166534', fontSize: '11.5px' }}>
                    <strong>Legal:</strong> {gstinVerifiedData.legalName} • <strong>Trade:</strong> {gstinVerifiedData.tradeName} • <strong>PAN:</strong> {gstinVerifiedData.pan} • <strong>State:</strong> {gstinVerifiedData.state}
                  </div>
                </div>
              )}
            </div>

            {/* Detailed Entity Form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Legal Registered Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Surgical Healthcare Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${errors.name ? '#EF4444' : '#CBD5E1'}`,
                    fontSize: '13px'
                  }}
                />
                {errors.name && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.name}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Trade Name / DBA
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Medicare"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  PAN Card Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. AAACA1234A"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${errors.pan ? '#EF4444' : '#CBD5E1'}`, fontSize: '13px' }}
                />
                {errors.pan && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.pan}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Registered State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Partner Role / Classification
                </label>
                <select
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="C&F Agent">C&F Agent</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Dealer">Authorized Dealer</option>
                  <option value="Hospital / Direct Buyer">Hospital / Direct Buyer</option>
                  <option value="Sub-Distributor">Sub-Distributor</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned Sales Channel
                </label>
                <select
                  value={salesChannelId}
                  onChange={(e) => setSalesChannelId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  {salesChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - {c.standardDiscountPercent}% Std Disc
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Drug License (20B / 21B)
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL-AP-VJA-2024-998"
                  value={drugLicenseNo}
                  onChange={(e) => setDrugLicenseNo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Primary Contact Person *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar (Director)"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${errors.contactPerson ? '#EF4444' : '#CBD5E1'}`, fontSize: '13px' }}
                />
                {errors.contactPerson && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.contactPerson}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Official Email Address *
                </label>
                <input
                  type="email"
                  placeholder="contact@apexmedicare.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${errors.email ? '#EF4444' : '#CBD5E1'}`, fontSize: '13px' }}
                />
                {errors.email && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.email}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Phone / Mobile *
                </label>
                <input
                  type="tel"
                  placeholder="+91 98480 12345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${errors.phone ? '#EF4444' : '#CBD5E1'}`, fontSize: '13px' }}
                />
                {errors.phone && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.phone}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Postal PIN Code *
                </label>
                <input
                  type="text"
                  placeholder="520002"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${errors.pinCode ? '#EF4444' : '#CBD5E1'}`, fontSize: '13px' }}
                />
                {errors.pinCode && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.pinCode}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  City / District
                </label>
                <input
                  type="text"
                  placeholder="Vijayawada"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Street / Industrial Area Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Plot No 42, Auto Nagar Industrial Area"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 2: KYC DOCUMENTS */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Step 2: Statutory Compliance & KYC Verification
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Upload certified regulatory documents required for commercial accreditation in India.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {kycDocs.map((doc, idx) => {
                const isVerified = doc.status === 'Verified';
                return (
                  <div
                    key={doc.documentType}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: isVerified ? '#F0FDF4' : '#F8FAFC',
                      border: `1px solid ${isVerified ? '#BBF7D0' : '#E2E8F0'}`,
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: isVerified ? '#DCFCE7' : '#F1F5F9',
                          color: isVerified ? '#16A34A' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                          {doc.documentType}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {doc.fileName ? `${doc.fileName} • Doc #${doc.documentNumber}` : 'Document not yet attached'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isVerified ? '#DCFCE7' : '#FEF3C7',
                          color: isVerified ? '#16A34A' : '#B45309',
                          padding: '2px 8px',
                          borderRadius: '9999px'
                        }}
                      >
                        {doc.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUploadKycDoc(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: isVerified ? '#FFFFFF' : '#7C3AED',
                          color: isVerified ? '#334155' : '#FFFFFF',
                          border: isVerified ? '1px solid #CBD5E1' : 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Upload size={13} />
                        <span>{isVerified ? 'Re-upload' : 'Upload & Verify'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 3: TERRITORY ASSIGNMENT */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Step 3: Territory & Geographic Boundaries
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Select home territory and multi-region commercial coverage permissions.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Primary / Home Operating Territory *
              </label>
              <select
                value={primaryTerritoryId}
                onChange={(e) => setPrimaryTerritoryId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${errors.primaryTerritoryId ? '#EF4444' : '#CBD5E1'}`,
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <option value="">-- Choose Primary Territory --</option>
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}) - {t.levelLabel || 'Territory'}
                  </option>
                ))}
              </select>
              {errors.primaryTerritoryId && (
                <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.primaryTerritoryId}</div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Additional Coverage Territories (Multi-select)
              </label>
              <HierarchicalTreeSelect
                territories={territories}
                selectedIds={coverageTerritoryIds}
                onChange={setCoverageTerritoryIds}
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 4: SALES FLOW SELECTION */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Step 4: Fulfillment Flow Route
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Select the physical and commercial distribution pipeline that governs this partner's shipments.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {salesFlows.map((flow) => {
                const isSelected = flow.id === selectedFlowId;
                return (
                  <div
                    key={flow.id}
                    onClick={() => setSelectedFlowId(flow.id)}
                    style={{
                      border: `2px solid ${isSelected ? '#7C3AED' : '#E2E8F0'}`,
                      backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF',
                      borderRadius: '8px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#E2E8F0', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                        {flow.code}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>{flow.stages.length} Stages</span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{flow.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{flow.description}</div>

                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1', fontSize: '11.5px', color: '#475569' }}>
                      {flow.stages.map((s) => s.channelName).join(' → ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 5: STAGE MAPPING */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Step 5: Operational Echelon Position
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Map which stage in "{selectedFlow?.name}" this partner operates at to determine upstream source and downstream billing rules.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedFlow?.stages.map((stage) => {
                const isSelected = mappedStageNumber === stage.stageNumber;
                return (
                  <div
                    key={stage.stageNumber}
                    onClick={() => setMappedStageNumber(stage.stageNumber)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      border: `2px solid ${isSelected ? '#7C3AED' : '#E2E8F0'}`,
                      backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#7C3AED' : '#E2E8F0',
                          color: isSelected ? '#FFFFFF' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px'
                        }}
                      >
                        {stage.stageNumber}
                      </div>

                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                          Stage {stage.stageNumber}: {stage.channelName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          Role: {stage.stageRole} • Custody: {stage.inventoryOwnership} • Pricing Basis: {stage.pricingBasis}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {isSelected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7C3AED', fontWeight: 700, fontSize: '12px' }}>
                          <CheckCircle2 size={18} />
                          <span>Selected Stage</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Click to Map</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 6: COMMERCIAL TERMS & DEVIATION */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Step 6: Commercial Terms & Precedence Overrides
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Inherit base standards from "{selectedChannel?.name}" or define partner-specific overrides requiring authorization.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Standard Discount % (Channel Default: {selectedChannel?.standardDiscountPercent}%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={String(selectedChannel?.standardDiscountPercent)}
                  value={overrideDiscount !== undefined ? overrideDiscount : ''}
                  onChange={(e) => setOverrideDiscount(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Credit Period Days (Channel Default: {selectedChannel?.creditPeriodDays}d)
                </label>
                <input
                  type="number"
                  placeholder={String(selectedChannel?.creditPeriodDays)}
                  value={overrideCreditDays !== undefined ? overrideCreditDays : ''}
                  onChange={(e) => setOverrideCreditDays(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Credit Limit (₹) (Channel Default: ₹{selectedChannel?.creditLimit.toLocaleString()})
                </label>
                <input
                  type="number"
                  placeholder={String(selectedChannel?.creditLimit)}
                  value={overrideCreditLimit !== undefined ? overrideCreditLimit : ''}
                  onChange={(e) => setOverrideCreditLimit(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Security Deposit (₹) (Channel Default: ₹{selectedChannel?.depositAmount.toLocaleString()})
                </label>
                <input
                  type="number"
                  placeholder={String(selectedChannel?.depositAmount)}
                  value={overrideDeposit !== undefined ? overrideDeposit : ''}
                  onChange={(e) => setOverrideDeposit(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            {isDeviated && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 700, fontSize: '13px' }}>
                  <AlertTriangle size={16} />
                  <span>Commercial Deviation Flagged</span>
                </div>
                <div style={{ fontSize: '12px', color: '#92400E' }}>
                  The requested terms deviate from channel governance rules. A commercial deviation approval request will automatically be dispatched to the Commercial Director upon submission.
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#92400E', marginBottom: '4px' }}>
                    Justification / Business Case *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter reason for concession (e.g. key account volume commitment, competitive retention)..."
                    value={deviationReason}
                    onChange={(e) => setDeviationReason(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${errors.deviationReason ? '#EF4444' : '#FCD34D'}`, fontSize: '12.5px' }}
                  />
                  {errors.deviationReason && (
                    <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{errors.deviationReason}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STEP 7: REVIEW & SUBMIT */}
        {/* ------------------------------------------------------------------ */}
        {currentStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Step 7: Final Review & Application Dispatch
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Verify all operational parameters before submitting the partner record into the enterprise registry.
              </p>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{name}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {partnerType} • Code: {partnerCode} • GSTIN: {gstin}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isDeviated ? '#FEF3C7' : '#DCFCE7',
                    color: isDeviated ? '#B45309' : '#16A34A',
                    padding: '3px 10px',
                    borderRadius: '9999px'
                  }}
                >
                  {isDeviated ? 'Approval Pending' : 'Ready to Activate'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748B' }}>Primary Territory:</span>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {territories.find((t) => t.id === primaryTerritoryId)?.name || 'Default Territory'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>Channel & Echelon:</span>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {selectedChannel?.name} (Stage {mappedStageNumber})
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>Discount Terms:</span>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {overrideDiscount !== undefined ? `${overrideDiscount}% (Custom)` : `${selectedChannel?.standardDiscountPercent}% (Standard)`}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>Credit Period & Limit:</span>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {overrideCreditDays !== undefined ? `${overrideCreditDays}d` : `${selectedChannel?.creditPeriodDays}d`} • ₹
                    {(overrideCreditLimit !== undefined ? overrideCreditLimit : selectedChannel?.creditLimit || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', fontSize: '12px' }}>
                <span style={{ color: '#64748B' }}>KYC Status: </span>
                <strong style={{ color: '#0F172A' }}>
                  {kycDocs.filter((d) => d.status === 'Verified').length} of {kycDocs.length} Verified
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={currentStep === 1 ? onClose : handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {currentStep > 1 && <ChevronLeft size={16} />}
            <span>{currentStep === 1 ? 'Cancel' : 'Previous Step'}</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitOnboarding}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 22px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Check size={16} />
                <span>Submit & Complete Onboarding</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
};
