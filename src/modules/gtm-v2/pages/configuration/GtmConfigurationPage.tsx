import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Save,
  FileText
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';

export const GtmConfigurationPage: React.FC = () => {
  const { config, updateConfig, resetToInitialData } = useGtmV2();

  // Local state for editing
  const [partnerTypes, setPartnerTypes] = useState<string[]>([...config.partnerTypes]);
  const [newPartnerType, setNewPartnerType] = useState('');
  const [territoryLevelsMax, setTerritoryLevelsMax] = useState(config.territoryLevelsMax);
  const [allowOverlappingZones, setAllowOverlappingZones] = useState(config.allowOverlappingZones);
  const [maxDiscountDeviationPercent, setMaxDiscountDeviationPercent] = useState(
    config.maxDiscountDeviationPercent
  );
  const [autoApproveKycWithValidGst, setAutoApproveKycWithValidGst] = useState(
    config.autoApproveKycWithValidGst
  );
  const [requireDirectorApprovalForDepositWaiver, setRequireDirectorApprovalForDepositWaiver] = useState(
    config.requireDirectorApprovalForDepositWaiver
  );
  const [pricingBasisOptions, setPricingBasisOptions] = useState<string[]>([
    ...(config.pricingBasisOptions || [
      'Transfer Price',
      'PTS (Price to Stockist)',
      'PTR (Price to Retailer)',
      'MRP Discount',
      'Net Contract Price',
      'Cost Plus Margin'
    ])
  ]);
  const [newPricingBasis, setNewPricingBasis] = useState('');

  const [savedNotification, setSavedNotification] = useState(false);

  const handleAddPricingBasis = () => {
    if (!newPricingBasis.trim()) return;
    if (pricingBasisOptions.includes(newPricingBasis.trim())) {
      alert('This pricing basis already exists.');
      return;
    }
    setPricingBasisOptions([...pricingBasisOptions, newPricingBasis.trim()]);
    setNewPricingBasis('');
  };

  const handleRemovePricingBasis = (basisToRemove: string) => {
    if (pricingBasisOptions.length <= 1) {
      alert('At least one pricing basis must remain configured.');
      return;
    }
    setPricingBasisOptions(pricingBasisOptions.filter((b) => b !== basisToRemove));
  };

  const handleAddPartnerType = () => {
    if (!newPartnerType.trim()) return;
    if (partnerTypes.includes(newPartnerType.trim())) {
      alert('This partner type already exists.');
      return;
    }
    setPartnerTypes([...partnerTypes, newPartnerType.trim()]);
    setNewPartnerType('');
  };

  const handleRemovePartnerType = (typeToRemove: string) => {
    if (partnerTypes.length <= 1) {
      alert('At least one partner type must remain configured.');
      return;
    }
    setPartnerTypes(partnerTypes.filter((t) => t !== typeToRemove));
  };

  const handleSaveConfiguration = () => {
    updateConfig({
      partnerTypes,
      territoryLevelsMax,
      allowOverlappingZones,
      maxDiscountDeviationPercent,
      autoApproveKycWithValidGst,
      requireDirectorApprovalForDepositWaiver,
      pricingBasisOptions
    });

    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 3000);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all GTM V2 data (Territories, Zones, Channels, Flows, Partners) to factory enterprise defaults?')) {
      resetToInitialData();
      alert('GTM V2 master data has been reset to defaults.');
      window.location.reload();
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
              GTM Master Configuration & Governance Policies
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
              Enterprise Admin Rules
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Configure partner classifications, statutory document validation schemas, and approval authority matrices.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleResetData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              color: '#EF4444',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} />
            <span>Reset to Factory Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfiguration}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)'
            }}
          >
            <Save size={15} />
            <span>Save Governance Policies</span>
          </button>
        </div>
      </div>

      {savedNotification && (
        <div style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#15803D', fontSize: '13px', fontWeight: 600 }}>
          <CheckCircle2 size={16} />
          <span>Configuration updated successfully and saved to enterprise store.</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* CONFIGURATION SECTIONS */}
      {/* -------------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* 1. Partner Classifications */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Partner Classifications & Entity Types
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Allowed roles during partner onboarding and stage mapping.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="Add partner role (e.g. Consignment Agent)..."
              value={newPartnerType}
              onChange={(e) => setNewPartnerType(e.target.value)}
              style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
            />
            <button
              type="button"
              onClick={handleAddPartnerType}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#7C3AED', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {partnerTypes.map((type) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12.5px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>{type}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePartnerType(type)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                  title="Remove type"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Statutory KYC Requirements */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Statutory KYC Document Master
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Regulatory certifications verified during onboarding.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {config.requiredKycDocuments.map((doc) => (
              <div key={doc.id} style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#7C3AED" />
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>{doc.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      Mandatory for: {doc.mandatoryFor.join(', ')}
                    </div>
                  </div>
                </div>
                {doc.requiresExpiryDate && (
                  <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '4px' }}>
                    Requires Expiry
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Pricing Basis Master Catalog */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Pricing Basis Master Catalog
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Commercial valuation models available across Fulfillment Stages.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="Add pricing basis (e.g. Export CIF Rate)..."
              value={newPricingBasis}
              onChange={(e) => setNewPricingBasis(e.target.value)}
              style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
            />
            <button
              type="button"
              onClick={handleAddPricingBasis}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#7C3AED', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pricingBasisOptions.map((basis) => (
              <div key={basis} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12.5px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>{basis}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePricingBasis(basis)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                  title="Remove pricing basis"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Governance Policies & Approval Thresholds */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', gridColumn: '1 / -1' }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Commercial Approval Thresholds & Boundary Rules
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Control automatic versus elevated authorization workflows across the organization.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Max Allowed Territory Depth (Levels)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={territoryLevelsMax}
                onChange={(e) => setTerritoryLevelsMax(parseInt(e.target.value, 10) || 5)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                Currently supports dynamic N-level depth (Country &gt; State &gt; Division &gt; City &gt; Area).
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Discount Concession Director Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={maxDiscountDeviationPercent}
                onChange={(e) => setMaxDiscountDeviationPercent(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                Concessions exceeding this variance trigger commercial escalation.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowOverlappingZones}
                  onChange={(e) => setAllowOverlappingZones(e.target.checked)}
                />
                <span>Allow Same Territory in Multiple Commercial Zones</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoApproveKycWithValidGst}
                  onChange={(e) => setAutoApproveKycWithValidGst(e.target.checked)}
                />
                <span>Auto-Verify GSTIN Against Government Portal Check</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requireDirectorApprovalForDepositWaiver}
                  onChange={(e) => setRequireDirectorApprovalForDepositWaiver(e.target.checked)}
                />
                <span>Require Commercial Director Sign-off for Deposit Waivers</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
