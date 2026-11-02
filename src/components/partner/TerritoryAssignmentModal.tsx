import React, { useState, useEffect } from 'react';
import type { Partner } from '../../types/partner';
import { useApp } from '../../context/AppContext';
import { 
  MapPin, 
  RotateCcw, 
  Info 
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

interface TerritoryAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

export const TerritoryAssignmentModal: React.FC<TerritoryAssignmentModalProps> = ({
  isOpen,
  onClose,
  partner
}) => {
  const { 
    territories, 
    salesChannels, 
    distributionRoutes, 
    updatePartnerTerritoryAssignments, 
    showToast 
  } = useApp();

  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  
  // Working copy of territory commercials
  const [workingCommercials, setWorkingCommercials] = useState<Record<string, {
    partnerOverrideDiscount?: number | null;
    notes?: string;
  }>>({});

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (partner) {
      setSelectedTerritoryIds([...partner.assignedTerritoryIds]);
      setSelectedChannelIds([...partner.assignedChannelIds]);
      setSelectedRouteId(partner.assignedRouteId || 'path-02');

      const initialOverrides: Record<string, { partnerOverrideDiscount?: number | null; notes?: string }> = {};
      partner.assignedTerritoryIds.forEach((tId) => {
        const comm = partner.territoryCommercials[tId];
        initialOverrides[tId] = {
          partnerOverrideDiscount: comm?.partnerOverrideDiscount ?? null,
          notes: comm?.notes || ''
        };
      });
      setWorkingCommercials(initialOverrides);
    }
  }, [partner, isOpen]);

  if (!isOpen || !partner) return null;

  const handleToggleTerritory = (tId: string) => {
    if (selectedTerritoryIds.includes(tId)) {
      // Removing
      if (selectedTerritoryIds.length === 1) {
        showToast('A partner must be assigned to at least one territory.', 'warning');
        return;
      }
      setSelectedTerritoryIds((prev) => prev.filter((id) => id !== tId));
    } else {
      // Adding
      setSelectedTerritoryIds((prev) => [...prev, tId]);
      if (!workingCommercials[tId]) {
        // Look up previous or defaults
        const existing = partner.territoryCommercials[tId];
        setWorkingCommercials((prev) => ({
          ...prev,
          [tId]: {
            partnerOverrideDiscount: existing?.partnerOverrideDiscount ?? null,
            notes: existing?.notes || ''
          }
        }));
      }
    }
  };

  const handleOverrideChange = (tId: string, valStr: string) => {
    const val = valStr === '' ? null : parseFloat(valStr);
    setWorkingCommercials((prev) => ({
      ...prev,
      [tId]: {
        ...prev[tId],
        partnerOverrideDiscount: isNaN(val as number) ? null : val
      }
    }));
  };

  const handleResetToDefault = (tId: string) => {
    const territory = territories.find((t) => t.id === tId);
    const terrDefault = territory ? territory.defaultCommercialTerms.defaultDiscountPercent : 5.0;

    setWorkingCommercials((prev) => ({
      ...prev,
      [tId]: {
        partnerOverrideDiscount: null,
        notes: `Reset to territory default (${terrDefault}%)`
      }
    }));
    showToast(`Reset discount for ${territory?.name || tId} to default ${terrDefault}%.`, 'info');
  };

  const handleSaveClick = () => {
    // Check if there are changes
    const removedTerritories = partner.assignedTerritoryIds.filter((id) => !selectedTerritoryIds.includes(id));
    const addedTerritories = selectedTerritoryIds.filter((id) => !partner.assignedTerritoryIds.includes(id));
    
    // Check if override changes occurred
    let hasOverrideChanges = false;
    for (const tId of selectedTerritoryIds) {
      const existing = partner.territoryCommercials[tId]?.partnerOverrideDiscount ?? null;
      const current = workingCommercials[tId]?.partnerOverrideDiscount ?? null;
      if (existing !== current) {
        hasOverrideChanges = true;
        break;
      }
    }

    if (removedTerritories.length > 0 || addedTerritories.length > 0 || hasOverrideChanges) {
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = () => {
    updatePartnerTerritoryAssignments(
      partner.id,
      selectedTerritoryIds,
      selectedChannelIds,
      workingCommercials
    );
    setShowConfirmModal(false);
    onClose();
  };

  return (
    <>
      <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div 
          className="vf-drawer vf-drawer-xl" 
          style={{ width: '880px' }}
        >
          {/* Header */}
          <div className="vf-drawer-header">
            <div className="vf-drawer-title-wrap">
              <h3 className="vf-drawer-title">
                <MapPin size={20} className="text-blue-600" />
                <span>Territory & Commercial Terms Assignment</span>
              </h3>
              <p className="vf-drawer-subtitle">
                Partner: <strong>{partner.name}</strong> <code>({partner.code})</code> · Type: {partner.typeName}
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

          {/* Body */}
          <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Business Logic Principle Notice */}
            <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12.5px', color: '#1e40af' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                <Info size={16} />
                <span>Commercial Terms Precedence & Override Preservation</span>
              </div>
              <div>
                Partners automatically inherit each territory's default terms. Any partner-specific override entered below takes precedence. 
                Updating a territory default in GTM Configuration will <strong>never silently overwrite</strong> explicit partner overrides configured here.
              </div>
            </div>

            {/* Step 1: Assign Territories Multi-select */}
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                1. Select Assigned Distribution Territories
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {territories.map((terr) => {
                  const isAssigned = selectedTerritoryIds.includes(terr.id);
                  return (
                    <div
                      key={terr.id}
                      onClick={() => handleToggleTerritory(terr.id)}
                      style={{
                        padding: '12px',
                        border: `2px solid ${isAssigned ? 'var(--vf-primary)' : 'var(--vf-slate-200)'}`,
                        borderRadius: '8px',
                        background: isAssigned ? '#f0f7ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--vf-slate-900)' }}>{terr.name}</strong>
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          readOnly
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                        Code: <code>{terr.code}</code> · State: {terr.state}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600, marginTop: '4px' }}>
                        Default Discount: {terr.defaultCommercialTerms.defaultDiscountPercent}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Commercial Terms Table by Assigned Territory */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.5px' }}>
                  2. Effective Commercial Terms & Partner Overrides ({selectedTerritoryIds.length} assigned)
                </div>
              </div>

              <div style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="vf-table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Territory</th>
                      <th style={{ textAlign: 'right' }}>Territory Default</th>
                      <th style={{ width: '160px' }}>Partner Override</th>
                      <th style={{ textAlign: 'right' }}>Effective Discount</th>
                      <th>Origin Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTerritoryIds.map((tId) => {
                      const terr = territories.find((t) => t.id === tId);
                      const defaultDisc = terr ? terr.defaultCommercialTerms.defaultDiscountPercent : 5.0;
                      
                      const overrideVal = workingCommercials[tId]?.partnerOverrideDiscount;
                      const hasOverride = overrideVal !== null && overrideVal !== undefined && !isNaN(overrideVal);
                      const effectiveDisc = hasOverride ? overrideVal : defaultDisc;
                      const origin = hasOverride ? 'Partner Override' : 'Territory Default';

                      return (
                        <tr key={tId}>
                          <td>
                            <div>
                              <strong>{terr?.name || tId}</strong>
                              <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                                Code: <code>{terr?.code || tId}</code> · Credit Period: {terr?.defaultCommercialTerms.creditPeriodDays}d
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--vf-slate-600)' }}>
                            {defaultDisc.toFixed(1)}%
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                className="vf-form-control"
                                style={{ width: '85px', height: '30px', fontSize: '12.5px', textAlign: 'right' }}
                                placeholder="None"
                                value={hasOverride ? overrideVal : ''}
                                onChange={(e) => handleOverrideChange(tId, e.target.value)}
                              />
                              <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '14px', color: hasOverride ? '#1d4ed8' : 'var(--vf-slate-800)' }}>
                              {effectiveDisc.toFixed(1)}%
                            </strong>
                          </td>
                          <td>
                            <span className={`vf-badge ${hasOverride ? 'vf-badge-active' : 'vf-badge-pending'}`} style={{ whiteSpace: 'nowrap' }}>
                              {origin}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {hasOverride ? (
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                onClick={() => handleResetToDefault(tId)}
                                title="Reset to territory default"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <RotateCcw size={12} />
                                <span>Reset</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-400)' }}>Inheriting</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3: Distribution Route & Sales Channels */}
            <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                3. Distribution Route & Assigned Sales Channels
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="vf-form-label">Primary Distribution Route *</label>
                  <select
                    className="vf-form-control"
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                  >
                    {distributionRoutes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="vf-form-label">Applicable Sales Channels</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {salesChannels.map((c) => {
                      const isChecked = selectedChannelIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            padding: '4px 8px',
                            background: isChecked ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}`,
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedChannelIds((prev) => [...prev, c.id]);
                              } else {
                                setSelectedChannelIds((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                          />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="vf-drawer-footer" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>
              Assigned Territories: <strong>{selectedTerritoryIds.length}</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                onClick={handleSaveClick}
                style={{ fontWeight: 700 }}
              >
                ✓ Save Territory Assignments & Commercials
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Before Saving Changes */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Confirm Territory & Commercial Terms Update"
        message={
          <div>
            <p style={{ margin: '0 0 10px 0' }}>
              Are you sure you want to update territory assignments and commercial terms for <strong>{partner.name}</strong>?
            </p>
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Impact Preview:</div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--vf-slate-700)' }}>
                <li>Assigned Territories: {selectedTerritoryIds.length} active zones.</li>
                <li>Overrides will be applied immediately to ordering engines and contracts.</li>
                <li>Any territory default updates in GTM will respect explicit overrides configured here.</li>
              </ul>
            </div>
          </div>
        }
        confirmLabel="Confirm & Save"
        cancelLabel="Review Again"
        variant="primary"
        onConfirm={executeSave}
        onCancel={() => setShowConfirmModal(false)}
      />
    </>
  );
};
