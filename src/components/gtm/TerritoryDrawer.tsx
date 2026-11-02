import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { Territory, GeographicArea } from '../../types/gtm.ts';
import { 
  X, 
  MapPin, 
  AlertTriangle, 
  Check, 
  Plus, 
  Trash2, 
  Building2, 
  Layers,
  Lock,
  Unlock,
  CheckCircle2
} from 'lucide-react';

interface TerritoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  territory: Territory | null;
}

const COMMON_INDIAN_STATES = [
  "Andhra Pradesh",
  "Telangana",
  "Karnataka",
  "Tamil Nadu",
  "Maharashtra",
  "Kerala",
  "Gujarat",
  "Delhi NCR",
  "Rajasthan",
  "West Bengal",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "Punjab",
  "Haryana",
  "Odisha",
  "Bihar",
  "Assam",
  "Goa"
];

const ZONES = [
  "South Zone",
  "West Zone",
  "North Zone",
  "East Zone",
  "Central Zone"
];

export const TerritoryDrawer: React.FC<TerritoryDrawerProps> = ({
  isOpen,
  onClose,
  territory
}) => {
  const {
    territories,
    salesChannels,
    distributionRoutes,
    addTerritory,
    updateTerritory,
    showToast
  } = useApp();

  const isEdit = Boolean(territory);

  // Form Fields - General
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [parentTerritoryId, setParentTerritoryId] = useState<string>('');
  const [assignedChannelId, setAssignedChannelId] = useState('ct-distributor');
  const [assignedRouteId, setAssignedRouteId] = useState('path-02');
  const [lead, setLead] = useState('');
  const [annualTarget, setAnnualTarget] = useState(50000000);
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Draft' | 'Archived'>('Active');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');

  // Primary Geographic Fields
  const [country, setCountry] = useState('India');
  const [zone, setZone] = useState('South Zone');
  const [state, setState] = useState('Andhra Pradesh');
  const [district, setDistrict] = useState('NTR District');
  const [city, setCity] = useState('Vijayawada');
  const [pinCode, setPinCode] = useState('520001 - 520010');

  // Geographic Coverage Areas & Sub-cluster builder
  const [coverageAreas, setCoverageAreas] = useState<GeographicArea[]>([]);
  const [clusterState, setClusterState] = useState('Andhra Pradesh');
  const [clusterDistrict, setClusterDistrict] = useState('NTR District');
  const [clusterCity, setClusterCity] = useState('Vijayawada');
  const [clusterLocality, setClusterLocality] = useState('Benz Circle');
  const [clusterPinInput, setClusterPinInput] = useState('');
  const [clusterPinChips, setClusterPinChips] = useState<string[]>(['520001', '520010']);

  // Commercial Terms & Channel Inheritance
  const [isCommercialOverridden, setIsCommercialOverridden] = useState(false);
  const [defaultDiscount, setDefaultDiscount] = useState(12.0);
  const [creditLimit, setCreditLimit] = useState(3500000);
  const [creditPeriod, setCreditPeriod] = useState(45);
  const [securityDeposit, setSecurityDeposit] = useState(1000000);

  // Overlap Warning State
  const [overlapWarnings, setOverlapWarnings] = useState<string[]>([]);

  // Salesforce ETM Model Lifecycle, Priority Score & Assignment Predicates
  const [priorityScore, setPriorityScore] = useState<number>(80);
  const [lifecycleState, setLifecycleState] = useState<'Active' | 'Draft' | 'Archived'>('Active');
  const [selectedFacilityTypes, setSelectedFacilityTypes] = useState<string[]>([
    'Corporate Tertiary Hospital',
    'Government Medical College',
    'Specialist Surgical Center'
  ]);
  const [minBedCount, setMinBedCount] = useState<number>(100);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([
    'Orthopedic Surgery',
    'Trauma Care Level-1',
    'Robotic OT'
  ]);
  const [minSpendCapacity, setMinSpendCapacity] = useState<number>(10000000);

  // Find currently selected channel
  const selectedChannel = salesChannels.find((c) => c.id === assignedChannelId) || salesChannels[0];

  // Initialize or populate data
  useEffect(() => {
    if (territory) {
      setName(territory.name);
      setCode(territory.code);
      setDescription(territory.description || '');
      setCountry(territory.country || 'India');
      setZone(territory.zone || 'South Zone');
      setState(territory.state);
      setDistrict(territory.district || '');
      setCity(territory.city || '');
      setPinCode(territory.pinCode || '');
      setParentTerritoryId(territory.parentTerritoryId || '');
      setAssignedChannelId(territory.assignedChannelId);
      setAssignedRouteId(territory.assignedRouteId);
      setLead(territory.lead);
      setAnnualTarget(territory.annualTarget);
      setStatus(territory.status);
      setEffectiveFrom(territory.effectiveFrom);
      setEffectiveTo(territory.effectiveTo || '');
      setNotes(territory.notes || '');
      setCoverageAreas(territory.geographicCoverage || []);

      const channelObj = salesChannels.find((c) => c.id === territory.assignedChannelId);
      const terms = territory.defaultCommercialTerms;

      if (terms) {
        setDefaultDiscount(terms.defaultDiscountPercent);
        setCreditLimit(terms.creditLimit);
        setCreditPeriod(terms.creditPeriodDays);
        setSecurityDeposit(terms.minimumSecurityDeposit);

        // Check if values deviate from channel defaults
        if (channelObj && (
          terms.defaultDiscountPercent !== channelObj.standardMarginPercent ||
          terms.creditPeriodDays !== channelObj.defaultCreditDays
        )) {
          setIsCommercialOverridden(true);
        } else {
          setIsCommercialOverridden(false);
        }
      }

      setClusterState(territory.state || 'Andhra Pradesh');
      setClusterDistrict(territory.district || '');
      setClusterCity(territory.city || '');
      setClusterLocality('');
      setClusterPinChips([]);

      setPriorityScore(territory.priorityScore || 80);
      setLifecycleState(territory.lifecycleState || 'Active');
      setSelectedFacilityTypes(territory.assignmentPredicates?.facilityTypes || [
        'Corporate Tertiary Hospital',
        'Government Medical College',
        'Specialist Surgical Center'
      ]);
      setMinBedCount(territory.assignmentPredicates?.minBedCount || 100);
      setSelectedSpecialties(territory.assignmentPredicates?.requiredSpecialties || [
        'Orthopedic Surgery',
        'Trauma Care Level-1',
        'Robotic OT'
      ]);
      setMinSpendCapacity(territory.assignmentPredicates?.minSpendCapacity || 10000000);
    } else {
      // New Territory Defaults
      setName('');
      setCode(`TERR-${Math.floor(100 + Math.random() * 900)}`);
      setDescription('');
      setCountry('India');
      setZone('South Zone');
      setState('Andhra Pradesh');
      setDistrict('NTR District');
      setCity('Vijayawada');
      setPinCode('520001 - 520010');
      setParentTerritoryId('');
      setAssignedChannelId('ct-distributor');
      setAssignedRouteId('path-02');
      setLead('Zonal Commercial Manager');
      setAnnualTarget(60000000);
      setStatus('Active');
      setEffectiveFrom(new Date().toISOString().substring(0, 10));
      setEffectiveTo('');
      setNotes('');
      setCoverageAreas([
        {
          id: `geo-${Date.now()}-1`,
          country: 'India',
          zone: 'South Zone',
          state: 'Andhra Pradesh',
          district: 'NTR District',
          city: 'Vijayawada',
          locality: 'Benz Circle',
          pinCodes: ['520001', '520010'],
          notes: 'Vijayawada commercial medical hub'
        }
      ]);

      const distChannel = salesChannels.find((c) => c.id === 'ct-distributor');
      setIsCommercialOverridden(false);
      setDefaultDiscount(distChannel?.standardMarginPercent ?? 12.0);
      setCreditLimit(3500000);
      setCreditPeriod(distChannel?.defaultCreditDays ?? 45);
      setSecurityDeposit(distChannel?.requiresDeposit ? 1000000 : 0);

      setClusterState('Andhra Pradesh');
      setClusterDistrict('NTR District');
      setClusterCity('Vijayawada');
      setClusterLocality('Benz Circle');
      setClusterPinChips(['520001', '520010']);

      setPriorityScore(80);
      setLifecycleState('Active');
      setSelectedFacilityTypes([
        'Corporate Tertiary Hospital',
        'Government Medical College',
        'Specialist Surgical Center'
      ]);
      setMinBedCount(100);
      setSelectedSpecialties(['Orthopedic Surgery', 'Trauma Care Level-1', 'Robotic OT']);
      setMinSpendCapacity(10000000);
    }
  }, [territory, isOpen, salesChannels]);

  // When assignedChannelId changes and override is not active, auto-inherit terms
  const handleChannelChange = (newChannelId: string) => {
    setAssignedChannelId(newChannelId);
    if (!isCommercialOverridden) {
      const ch = salesChannels.find((c) => c.id === newChannelId);
      if (ch) {
        setDefaultDiscount(ch.standardMarginPercent);
        setCreditPeriod(ch.defaultCreditDays);
        setSecurityDeposit(ch.requiresDeposit ? 1000000 : 0);
        setCreditLimit(ch.isReseller ? 3500000 : 0);
      }
    }
  };

  // Toggle override
  const handleToggleOverride = (enableOverride: boolean) => {
    setIsCommercialOverridden(enableOverride);
    if (!enableOverride && selectedChannel) {
      setDefaultDiscount(selectedChannel.standardMarginPercent);
      setCreditPeriod(selectedChannel.defaultCreditDays);
      setSecurityDeposit(selectedChannel.requiresDeposit ? 1000000 : 0);
      setCreditLimit(selectedChannel.isReseller ? 3500000 : 0);
    }
  };

  // Check for geographic overlaps across other territories
  useEffect(() => {
    const warnings: string[] = [];
    const currentPins = coverageAreas.flatMap((ca) => ca.pinCodes);
    
    territories.forEach((other) => {
      if (territory && other.id === territory.id) return;
      const otherPins = (other.geographicCoverage || []).flatMap((ca) => ca.pinCodes);
      const overlappingPins = currentPins.filter((pin) => otherPins.includes(pin));
      if (overlappingPins.length > 0) {
        warnings.push(
          `PIN overlap: [${overlappingPins.join(', ')}] is already mapped in "${other.name}" (${other.code}). Multi-partner authorized overlaps remain valid.`
        );
      }
    });

    setOverlapWarnings(warnings);
  }, [coverageAreas, territories, territory]);

  if (!isOpen) return null;

  // Add a PIN chip
  const handleAddPinChip = (pinRaw: string) => {
    const pins = pinRaw
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 4);

    if (pins.length === 0) return;

    setClusterPinChips((prev) => {
      const set = new Set([...prev, ...pins]);
      return Array.from(set);
    });
    setClusterPinInput('');
  };

  // Remove a PIN chip
  const handleRemovePinChip = (pinToRemove: string) => {
    setClusterPinChips((prev) => prev.filter((p) => p !== pinToRemove));
  };

  // Add sub-cluster into coverage areas
  const handleAddCoverageCluster = () => {
    if (!clusterState.trim() && !clusterCity.trim() && clusterPinChips.length === 0) {
      showToast('Specify at least a State, City, or PIN code.', 'warning');
      return;
    }

    const newArea: GeographicArea = {
      id: `geo-${Date.now()}`,
      country,
      zone,
      state: clusterState.trim() || state,
      district: clusterDistrict.trim() || `${clusterCity.trim() || clusterState.trim()} District`,
      city: clusterCity.trim() || 'Central Hub',
      locality: clusterLocality.trim() || 'Primary Medical Cluster',
      pinCodes: clusterPinChips.length > 0 ? clusterPinChips : ['520001'],
      notes: `${clusterCity || clusterDistrict || clusterState} operational area`
    };

    setCoverageAreas((prev) => [...prev, newArea]);
    showToast(`Added ${newArea.locality} (${newArea.city}) with ${newArea.pinCodes.length} PIN codes.`, 'info');

    // Reset cluster builder inputs
    setClusterLocality('');
    setClusterPinChips([]);
    setClusterPinInput('');
  };

  const handleRemoveArea = (areaId: string) => {
    setCoverageAreas((prev) => prev.filter((a) => a.id !== areaId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Territory Name is mandatory.', 'warning');
      return;
    }

    const channel = salesChannels.find((c) => c.id === assignedChannelId);
    const route = distributionRoutes.find((r) => r.id === assignedRouteId);
    const parent = territories.find((t) => t.id === parentTerritoryId);

    if (isEdit && territory) {
      updateTerritory(territory.id, {
        name: name.trim(),
        code: code.trim(),
        description: description.trim(),
        country,
        zone,
        state,
        district,
        city,
        pinCode,
        parentTerritoryId: parentTerritoryId || null,
        parentTerritoryName: parent?.name || null,
        assignedChannelId,
        assignedChannelName: channel?.name || 'Authorized Distributor',
        assignedRouteId,
        assignedRouteName: route?.name || 'Standard Direct Distribution',
        lead,
        annualTarget: Number(annualTarget),
        status,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        notes: notes.trim(),
        priorityScore: Number(priorityScore),
        lifecycleState,
        assignmentPredicates: {
          facilityTypes: selectedFacilityTypes,
          minBedCount: Number(minBedCount),
          requiredSpecialties: selectedSpecialties,
          minSpendCapacity: Number(minSpendCapacity)
        },
        geographicCoverage: coverageAreas,
        defaultCommercialTerms: {
          ...territory.defaultCommercialTerms,
          defaultDiscountPercent: Number(defaultDiscount),
          creditLimit: Number(creditLimit),
          creditPeriodDays: Number(creditPeriod),
          minimumSecurityDeposit: Number(securityDeposit)
        }
      });
      showToast(`Territory "${name}" updated successfully.`, 'info');
    } else {
      const newId = `terr-${Date.now().toString().slice(-4)}`;
      const newTerritory: Territory = {
        id: newId,
        name: name.trim(),
        code: code.trim(),
        description: description.trim(),
        country,
        zone,
        state,
        district,
        city,
        pinCode,
        parentTerritoryId: parentTerritoryId || null,
        parentTerritoryName: parent?.name || null,
        assignedChannelId,
        assignedChannelName: channel?.name || 'Authorized Distributor',
        assignedRouteId,
        assignedRouteName: route?.name || 'Standard Direct Distribution',
        lead: lead || 'Commercial Territory Lead',
        activePartnersCount: 0,
        annualTarget: Number(annualTarget),
        status,
        effectiveFrom: effectiveFrom || new Date().toISOString().substring(0, 10),
        effectiveTo: effectiveTo || undefined,
        notes: notes.trim(),
        priorityScore: Number(priorityScore),
        lifecycleState,
        assignmentPredicates: {
          facilityTypes: selectedFacilityTypes,
          minBedCount: Number(minBedCount),
          requiredSpecialties: selectedSpecialties,
          minSpendCapacity: Number(minSpendCapacity)
        },
        targetAccountsCount: 30,
        coveredAccountsCount: 28,
        coverageRatio: 93.33,
        conflictCount: 0,
        geographicCoverage: coverageAreas,
        history: [
          {
            id: `th-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            action: 'Territory Created',
            performedBy: 'Commercial Administrator',
            details: `Established territory ${name} under ${zone} with ${channel?.name}.`
          }
        ],
        defaultCommercialTerms: {
          territoryId: newId,
          territoryName: name.trim(),
          defaultDiscountPercent: Number(defaultDiscount),
          creditLimit: Number(creditLimit),
          creditPeriodDays: Number(creditPeriod),
          minimumSecurityDeposit: Number(securityDeposit),
          productDiscounts: [],
          applicableRateRules: [
            isCommercialOverridden ? 'Territory Regional Deviation Rule' : `${channel?.name || 'Channel'} Standard Terms`
          ],
          effectiveFrom: effectiveFrom || new Date().toISOString().substring(0, 10),
          version: 'v1.0',
          status: 'Active',
          history: [
            {
              version: 'v1.0',
              effectiveDate: effectiveFrom || new Date().toISOString().substring(0, 10),
              discountPercent: Number(defaultDiscount),
              creditLimit: Number(creditLimit),
              modifiedBy: 'Commercial Operations',
              changeReason: isCommercialOverridden ? 'Territory Regional Override applied' : 'Inherited standard channel baseline'
            }
          ]
        }
      };

      addTerritory(newTerritory);
      showToast(`Territory "${name}" created successfully.`, 'success');
    }

    onClose();
  };

  return (
    <div className="vf-drawer-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="vf-drawer vf-drawer-xl" 
        style={{ width: '920px', maxWidth: '96vw', display: 'flex', flexDirection: 'column' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="vf-drawer-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="vf-badge vf-badge-approved">Geographic Master</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                {isEdit ? `Edit Territory: ${territory?.name}` : 'Configure Commercial Territory'}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
              Configure hierarchical boundary coverage (Country &rarr; Zone &rarr; State &rarr; District &rarr; City &rarr; PINs) and channel-aligned terms.
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vf-slate-400)', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="vf-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Overlap Warning Banner */}
          {overlapWarnings.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '12px 16px', display: 'flex', gap: '10px' }}>
              <AlertTriangle size={18} className="text-amber-600" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#92400e' }}>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>Geographic Overlap Advisory</div>
                {overlapWarnings.map((w, idx) => (
                  <div key={idx} style={{ marginTop: '2px' }}>• {w}</div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Identification & Top Governance */}
          <div style={{ background: '#ffffff', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--vf-slate-800)', borderBottom: '1px solid var(--vf-slate-100)', paddingBottom: '8px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} className="text-blue-600" />
              <span>1. Identification & Organizational Master</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="vf-form-label">Territory Name *</label>
                <input 
                  type="text" 
                  className="vf-form-control vf-form-input" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. AP & Telangana Territory"
                  required 
                />
              </div>
              <div>
                <label className="vf-form-label">Territory Code *</label>
                <input 
                  type="text" 
                  className="vf-form-control vf-form-input" 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)} 
                  placeholder="e.g. TERR-APT"
                  required 
                />
              </div>
              <div>
                <label className="vf-form-label">Model Lifecycle State</label>
                <select 
                  className="vf-form-control vf-form-select" 
                  value={lifecycleState} 
                  onChange={(e) => setLifecycleState(e.target.value as any)}
                >
                  <option value="Active">Active (Production)</option>
                  <option value="Draft">Draft (Scenario Planning)</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="vf-form-label">Priority Score (1-100) *</label>
                <input 
                  type="number" 
                  min={1}
                  max={100}
                  className="vf-form-control vf-form-input" 
                  value={priorityScore} 
                  onChange={(e) => setPriorityScore(Number(e.target.value))} 
                  title="Deterministic conflict arbitration score"
                  required 
                />
              </div>
            </div>

            <div>
              <label className="vf-form-label">Territory Description & Healthcare Scope</label>
              <textarea 
                className="vf-form-control vf-form-input" 
                rows={2} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe key regional hospital clusters, tertiary centers, and transport corridors..."
              />
            </div>
          </div>

          {/* Section 2: Structured Geographic Hierarchy & Multi-Area PINs */}
          <div style={{ background: '#ffffff', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--vf-slate-800)', borderBottom: '1px solid var(--vf-slate-100)', paddingBottom: '8px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} className="text-blue-600" />
                <span>2. Geographic Hierarchy & Coverage (Country &rarr; Zone &rarr; State &rarr; City &rarr; PINs)</span>
              </div>
              <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                {coverageAreas.length} Configured Clusters
              </span>
            </div>

            {/* Primary Geographic Placement Row */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--vf-slate-600)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Primary Geographic Anchors
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '12px' }}>
                <div>
                  <label className="vf-form-label">Country</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="vf-form-control vf-form-input" 
                      value={country} 
                      onChange={(e) => setCountry(e.target.value)} 
                      placeholder="e.g. India"
                    />
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Zone</label>
                  <select 
                    className="vf-form-control vf-form-select" 
                    value={zone} 
                    onChange={(e) => setZone(e.target.value)}
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="vf-form-label">Primary State</label>
                  <select 
                    className="vf-form-control vf-form-select" 
                    value={state} 
                    onChange={(e) => setState(e.target.value)}
                  >
                    {COMMON_INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label className="vf-form-label">District / Metro</label>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    value={district} 
                    onChange={(e) => setDistrict(e.target.value)} 
                    placeholder="e.g. NTR District, Visakhapatnam"
                  />
                </div>

                <div>
                  <label className="vf-form-label">Headquarters / Hub City</label>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    value={city} 
                    onChange={(e) => setCity(e.target.value)} 
                    placeholder="e.g. Vijayawada, Hyderabad"
                  />
                </div>

                <div>
                  <label className="vf-form-label">Postal PIN Range Summary</label>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    value={pinCode} 
                    onChange={(e) => setPinCode(e.target.value)} 
                    placeholder="e.g. 520001 - 530048"
                  />
                </div>
              </div>
            </div>

            {/* List of Configured Geographic Clusters */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '8px' }}>
                Configured Coverage Clusters & Mapped PIN Codes
              </div>

              {coverageAreas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '6px', border: '1px dashed var(--vf-slate-300)', color: 'var(--vf-slate-500)', fontSize: '12.5px' }}>
                  No sub-area clusters configured. Use the builder below to map States, Cities, Localities, and PIN codes.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {coverageAreas.map((area) => (
                    <div 
                      key={area.id} 
                      style={{ 
                        background: '#ffffff', 
                        padding: '10px 14px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--vf-slate-200)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vf-slate-900)' }}>
                            {area.locality || 'Central Area'}
                          </span>
                          <span style={{ color: 'var(--vf-slate-400)', fontSize: '11px' }}>&bull;</span>
                          <span style={{ fontSize: '12px', color: 'var(--vf-slate-700)' }}>
                            {area.city || area.district}
                          </span>
                          <span className="vf-badge" style={{ background: '#f1f5f9', color: 'var(--vf-slate-600)', fontSize: '10.5px' }}>
                            {area.district}
                          </span>
                          <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '10.5px' }}>
                            {area.state}
                          </span>
                        </div>

                        {/* PIN Code Tags */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginRight: '2px' }}>
                            PINs ({area.pinCodes.length}):
                          </span>
                          {area.pinCodes.map((p) => (
                            <span 
                              key={p} 
                              style={{ 
                                background: '#f8fafc', 
                                border: '1px solid var(--vf-slate-300)', 
                                borderRadius: '4px', 
                                padding: '1px 6px', 
                                fontSize: '11px', 
                                fontFamily: 'monospace',
                                color: 'var(--vf-slate-700)'
                              }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveArea(area.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                        title="Remove cluster"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Cluster & PIN Code Builder Box */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} className="text-blue-600" />
                <span>Add Sub-Area Cluster & Covered Postal PIN Codes</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="vf-form-label" style={{ fontSize: '11px' }}>Cluster State</label>
                  <select 
                    className="vf-form-control vf-form-select" 
                    style={{ fontSize: '12px', height: '32px' }}
                    value={clusterState}
                    onChange={(e) => setClusterState(e.target.value)}
                  >
                    {COMMON_INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="vf-form-label" style={{ fontSize: '11px' }}>District</label>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    style={{ fontSize: '12px', height: '32px' }}
                    value={clusterDistrict}
                    onChange={(e) => setClusterDistrict(e.target.value)}
                    placeholder="e.g. NTR District"
                  />
                </div>

                <div>
                  <label className="vf-form-label" style={{ fontSize: '11px' }}>City Hub</label>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    style={{ fontSize: '12px', height: '32px' }}
                    value={clusterCity}
                    onChange={(e) => setClusterCity(e.target.value)}
                    placeholder="e.g. Vijayawada"
                  />
                </div>

                <div>
                  <label className="vf-form-label" style={{ fontSize: '11px' }}>Locality / Hospital Cluster</label>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    style={{ fontSize: '12px', height: '32px' }}
                    value={clusterLocality}
                    onChange={(e) => setClusterLocality(e.target.value)}
                    placeholder="e.g. Benz Circle"
                  />
                </div>
              </div>

              {/* Postal PIN Codes Input & Chips */}
              <div style={{ marginTop: '8px' }}>
                <label className="vf-form-label" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Postal PIN Codes (6 Digits)</span>
                  <span style={{ color: 'var(--vf-slate-400)', fontWeight: 400 }}>Enter single or comma-separated PINs (e.g. 520001, 520010)</span>
                </label>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    className="vf-form-control vf-form-input" 
                    style={{ fontSize: '12px', height: '32px', flex: 1 }}
                    placeholder="Type PIN codes here, e.g. 520001, 520010"
                    value={clusterPinInput}
                    onChange={(e) => setClusterPinInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPinChip(clusterPinInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary"
                    style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                    onClick={() => handleAddPinChip(clusterPinInput)}
                  >
                    Add PIN
                  </button>
                </div>

                {/* Rendered Chips Preview for this Cluster */}
                {clusterPinChips.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Staged PINs:</span>
                    {clusterPinChips.map((pin) => (
                      <span 
                        key={pin}
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '11.5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <strong>{pin}</strong>
                        <span 
                          onClick={() => handleRemovePinChip(pin)}
                          style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', lineHeight: 1 }}
                          title="Remove"
                        >
                          &times;
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary"
                    onClick={handleAddCoverageCluster}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px', background: '#ffffff', borderColor: '#2563eb', color: '#1d4ed8' }}
                  >
                    <Plus size={14} />
                    <span>Add Area Cluster to Coverage</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Commercial Channel & Terms (Auto-Inherited with Regional Override) */}
          <div style={{ background: '#ffffff', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--vf-slate-800)', borderBottom: '1px solid var(--vf-slate-100)', paddingBottom: '8px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} className="text-blue-600" />
              <span>3. Commercial Channel & Default Commercial Terms</span>
            </div>

            {/* Channel Selection & Route Mapping */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="vf-form-label">Primary Sales Channel *</label>
                <select 
                  className="vf-form-control vf-form-select" 
                  value={assignedChannelId} 
                  onChange={(e) => handleChannelChange(e.target.value)}
                >
                  {salesChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) — Margin: {c.standardMarginPercent}%
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginTop: '2px', display: 'block' }}>
                  Determines the baseline commercial rates and supply terms for this territory.
                </span>
              </div>

              <div>
                <label className="vf-form-label">Default Distribution Route *</label>
                <select 
                  className="vf-form-control vf-form-select" 
                  value={assignedRouteId} 
                  onChange={(e) => setAssignedRouteId(e.target.value)}
                >
                  {distributionRoutes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginTop: '2px', display: 'block' }}>
                  Standard product movement route configured for partners in this territory.
                </span>
              </div>
            </div>

            {/* Inherited Terms Card & Regional Override Switch */}
            <div style={{ 
              background: isCommercialOverridden ? '#fffbeb' : '#f0fdf4', 
              border: isCommercialOverridden ? '1px solid #fde68a' : '1px solid #bbf7d0', 
              borderRadius: '6px', 
              padding: '12px 16px', 
              marginBottom: '14px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{ 
                  fontSize: '12.5px', 
                  fontWeight: 700, 
                  color: isCommercialOverridden ? '#b45309' : '#166534', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}>
                  {isCommercialOverridden ? (
                    <>
                      <Unlock size={15} />
                      <span>Territory Regional Commercial Override Enabled</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Commercial Terms Auto-Inherited from Sales Channel ({selectedChannel?.name})</span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: isCommercialOverridden ? '#92400e' : '#15803d', marginTop: '3px' }}>
                  Channel Baseline: <strong>{selectedChannel?.standardMarginPercent}% Margin</strong> • <strong>{selectedChannel?.defaultCreditDays} Days Credit</strong> • <strong>{selectedChannel?.requiresDeposit ? 'Security Deposit Required' : 'Deposit Exempt'}</strong> ({selectedChannel?.marginType})
                </div>
              </div>

              {/* Override Checkbox */}
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '12px', 
                fontWeight: 600, 
                color: 'var(--vf-slate-800)', 
                cursor: 'pointer', 
                background: '#ffffff', 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: '1px solid var(--vf-slate-300)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <input 
                  type="checkbox" 
                  checked={isCommercialOverridden} 
                  onChange={(e) => handleToggleOverride(e.target.checked)} 
                  style={{ accentColor: '#2563eb' }}
                />
                <span>Enable Territory Override</span>
              </label>
            </div>

            {/* Commercial Terms Form Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div>
                <label className="vf-form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Default Discount (%)</span>
                  {!isCommercialOverridden && <span title="Inherited from Channel"><Lock size={12} className="text-slate-400" /></span>}
                </label>
                <input 
                  type="number" 
                  step="0.5" 
                  className={`vf-form-control vf-form-input ${!isCommercialOverridden ? 'bg-slate-50' : ''}`}
                  value={defaultDiscount} 
                  onChange={(e) => setDefaultDiscount(Number(e.target.value))} 
                  disabled={!isCommercialOverridden}
                />
              </div>

              <div>
                <label className="vf-form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Credit Limit Floor (₹)</span>
                  {!isCommercialOverridden && <span title="Inherited from Channel"><Lock size={12} className="text-slate-400" /></span>}
                </label>
                <input 
                  type="number" 
                  step="100000" 
                  className={`vf-form-control vf-form-input ${!isCommercialOverridden ? 'bg-slate-50' : ''}`}
                  value={creditLimit} 
                  onChange={(e) => setCreditLimit(Number(e.target.value))} 
                  disabled={!isCommercialOverridden}
                />
              </div>

              <div>
                <label className="vf-form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Credit Period (Days)</span>
                  {!isCommercialOverridden && <span title="Inherited from Channel"><Lock size={12} className="text-slate-400" /></span>}
                </label>
                <input 
                  type="number" 
                  className={`vf-form-control vf-form-input ${!isCommercialOverridden ? 'bg-slate-50' : ''}`}
                  value={creditPeriod} 
                  onChange={(e) => setCreditPeriod(Number(e.target.value))} 
                  disabled={!isCommercialOverridden}
                />
              </div>

              <div>
                <label className="vf-form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Min Security Deposit (₹)</span>
                  {!isCommercialOverridden && <span title="Inherited from Channel"><Lock size={12} className="text-slate-400" /></span>}
                </label>
                <input 
                  type="number" 
                  step="100000" 
                  className={`vf-form-control vf-form-input ${!isCommercialOverridden ? 'bg-slate-50' : ''}`}
                  value={securityDeposit} 
                  onChange={(e) => setSecurityDeposit(Number(e.target.value))} 
                  disabled={!isCommercialOverridden}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Operational Governance & Accountability */}
          <div style={{ background: '#ffffff', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--vf-slate-800)', borderBottom: '1px solid var(--vf-slate-100)', paddingBottom: '8px', marginBottom: '14px' }}>
              4. Operational Governance & Accountability
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="vf-form-label">Zonal Commercial Lead</label>
                <input 
                  type="text" 
                  className="vf-form-control vf-form-input" 
                  value={lead} 
                  onChange={(e) => setLead(e.target.value)} 
                  placeholder="e.g. K. Sudhakar Rao (ZCM)"
                />
              </div>
              <div>
                <label className="vf-form-label">Annual Sales Target (₹)</label>
                <input 
                  type="number" 
                  step="1000000" 
                  className="vf-form-control vf-form-input" 
                  value={annualTarget} 
                  onChange={(e) => setAnnualTarget(Number(e.target.value))} 
                />
              </div>
              <div>
                <label className="vf-form-label">Effective Date Range</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <input 
                    type="date" 
                    className="vf-form-control vf-form-input" 
                    value={effectiveFrom} 
                    onChange={(e) => setEffectiveFrom(e.target.value)} 
                  />
                  <input 
                    type="date" 
                    className="vf-form-control vf-form-input" 
                    value={effectiveTo} 
                    onChange={(e) => setEffectiveTo(e.target.value)} 
                    placeholder="End date"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="vf-form-label">Internal Operational Notes</label>
              <textarea 
                className="vf-form-control vf-form-input" 
                rows={2} 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Hospital account priorities, regional transport constraints, tender dates..."
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="vf-drawer-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
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
            onClick={handleSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={16} />
            <span>{isEdit ? 'Save Changes' : 'Establish Territory'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
