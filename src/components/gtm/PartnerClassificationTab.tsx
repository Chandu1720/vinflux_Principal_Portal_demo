import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { PartnerPerformanceTier, DistributionLevel } from '../../types/gtm.ts';
import { 
  Plus, 
  Award, 
  ShieldCheck, 
  ArrowUpRight, 
  CheckCircle2, 
  Edit3, 
  Power, 
  Check, 
  X,
  TrendingUp,
  BarChart3
} from 'lucide-react';

export const PartnerClassificationTab: React.FC = () => {
  const {
    partnerTiers,
    distributionLevels,
    partners,
    territories,
    salesChannels,
    addPartnerTier,
    updatePartnerTier,
    togglePartnerTierStatus,
    addDistributionLevel,
    updateDistributionLevel,
    toggleDistributionLevelStatus,
    approvePartnerTierUpgrade,
    showToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'tiers' | 'levels' | 'reviews' | 'matrix'>('tiers');

  // Tier Drawer State
  const [isTierDrawerOpen, setIsTierDrawerOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PartnerPerformanceTier | null>(null);
  const [tierName, setTierName] = useState('');
  const [tierCode, setTierCode] = useState('');
  const [tierRank, setTierRank] = useState(1);
  const [tierDescription, setTierDescription] = useState('');
  const [tierCriteria, setTierCriteria] = useState('');
  const [tierBenefits, setTierBenefits] = useState('');
  const [tierFrequency, setTierFrequency] = useState<'Monthly' | 'Quarterly' | 'Biannual' | 'Annual'>('Quarterly');
  const [tierStatus, setTierStatus] = useState<'Active' | 'Inactive'>('Active');

  // Distribution Level Drawer State
  const [isLevelDrawerOpen, setIsLevelDrawerOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<DistributionLevel | null>(null);
  const [levelName, setLevelName] = useState('');
  const [levelCode, setLevelCode] = useState('');
  const [levelDescription, setLevelDescription] = useState('');
  const [allowedTypes, setAllowedTypes] = useState('Distributor, Super Stockist');
  const [levelStatus, setLevelStatus] = useState<'Active' | 'Inactive'>('Active');

  // Upgrade Modal State
  const [upgradePartnerId, setUpgradePartnerId] = useState<string | null>(null);
  const [targetTierId, setTargetTierId] = useState<string>('tier-plat');
  const [upgradeReason, setUpgradeReason] = useState('');

  // Partners due for review or with proposed upgrades
  const reviewDuePartners = useMemo(() => {
    return partners.filter((p) => p.classification?.reviewDue || p.classification?.proposedTierId);
  }, [partners]);

  // Classification KPI calculations
  const stats = useMemo(() => {
    const totalActivePartners = partners.filter((p) => p.status === 'Active').length;
    const platinumCount = partners.filter((p) => p.classification?.performanceTierId === 'tier-plat').length;
    const goldCount = partners.filter((p) => p.classification?.performanceTierId === 'tier-gold').length;
    const silverCount = partners.filter((p) => p.classification?.performanceTierId === 'tier-silver').length;
    const bronzeCount = partners.filter((p) => p.classification?.performanceTierId === 'tier-bronze').length;
    const reviewsPending = reviewDuePartners.length;

    return { totalActivePartners, platinumCount, goldCount, silverCount, bronzeCount, reviewsPending };
  }, [partners, reviewDuePartners]);

  // Open Tier Drawer
  const openCreateTier = () => {
    setEditingTier(null);
    setTierName('');
    setTierCode('TIER-' + Math.floor(100 + Math.random() * 900));
    setTierRank(partnerTiers.length + 1);
    setTierDescription('');
    setTierCriteria('Annual procurement threshold\nCompliant payment record\nCold-chain infrastructure');
    setTierBenefits('Priority dispatch\nDedicated KAM support\nStandard grace window');
    setTierFrequency('Quarterly');
    setTierStatus('Active');
    setIsTierDrawerOpen(true);
  };

  const openEditTier = (tier: PartnerPerformanceTier) => {
    setEditingTier(tier);
    setTierName(tier.name);
    setTierCode(tier.code);
    setTierRank(tier.rank);
    setTierDescription(tier.description);
    setTierCriteria(tier.eligibilityCriteria.join('\n'));
    setTierBenefits(tier.benefits.join('\n'));
    setTierFrequency(tier.reviewFrequency);
    setTierStatus(tier.status);
    setIsTierDrawerOpen(true);
  };

  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierName.trim() || !tierCode.trim()) {
      showToast('Tier Name and Code are mandatory.', 'warning');
      return;
    }

    const criteriaList = tierCriteria
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const benefitsList = tierBenefits
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingTier) {
      updatePartnerTier(editingTier.id, {
        name: tierName.trim(),
        code: tierCode.trim().toUpperCase(),
        rank: Number(tierRank),
        description: tierDescription.trim(),
        eligibilityCriteria: criteriaList,
        benefits: benefitsList,
        reviewFrequency: tierFrequency,
        status: tierStatus
      });
    } else {
      const newTier: PartnerPerformanceTier = {
        id: `tier-${Date.now()}`,
        name: tierName.trim(),
        code: tierCode.trim().toUpperCase(),
        rank: Number(tierRank),
        description: tierDescription.trim(),
        eligibilityCriteria: criteriaList,
        benefits: benefitsList,
        reviewFrequency: tierFrequency,
        status: tierStatus,
        effectiveFrom: new Date().toISOString().substring(0, 10)
      };
      addPartnerTier(newTier);
    }

    setIsTierDrawerOpen(false);
  };

  // Open Level Drawer
  const openCreateLevel = () => {
    setEditingLevel(null);
    setLevelName('');
    setLevelCode(`DL-${distributionLevels.length + 1}`);
    setLevelDescription('');
    setAllowedTypes('Distributor, Sub-Distributor');
    setLevelStatus('Active');
    setIsLevelDrawerOpen(true);
  };

  const openEditLevel = (lvl: DistributionLevel) => {
    setEditingLevel(lvl);
    setLevelName(lvl.name);
    setLevelCode(lvl.code);
    setLevelDescription(lvl.description);
    setAllowedTypes(lvl.allowedPartnerTypes.join(', '));
    setLevelStatus(lvl.status);
    setIsLevelDrawerOpen(true);
  };

  const handleSaveLevel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelName.trim() || !levelCode.trim()) {
      showToast('Level Name and Code are mandatory.', 'warning');
      return;
    }

    const typesList = allowedTypes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingLevel) {
      updateDistributionLevel(editingLevel.id, {
        name: levelName.trim(),
        code: levelCode.trim().toUpperCase(),
        description: levelDescription.trim(),
        allowedPartnerTypes: typesList,
        status: levelStatus
      });
    } else {
      const newLvl: DistributionLevel = {
        id: `dl-${Date.now()}`,
        name: levelName.trim(),
        code: levelCode.trim().toUpperCase(),
        description: levelDescription.trim(),
        allowedPartnerTypes: typesList,
        status: levelStatus
      };
      addDistributionLevel(newLvl);
    }

    setIsLevelDrawerOpen(false);
  };

  // Handle Upgrade Approval
  const handleApproveUpgrade = () => {
    if (!upgradePartnerId) return;
    approvePartnerTierUpgrade(upgradePartnerId, targetTierId, upgradeReason);
    setUpgradePartnerId(null);
    setUpgradeReason('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header & Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} className="text-blue-600" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
              Partner Classification & Tier Management
            </h2>
            <span className="vf-badge vf-badge-approved">Explicit Decoupling Model</span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
            Enterprise policy separating <strong>Partner Type</strong> (entity role), <strong>Performance Tier</strong> (grading), and <strong>Distribution Level</strong> (network tier).
          </p>
        </div>

        {/* Subtab Switches */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'tiers' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('tiers')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
          >
            Performance Tiers ({partnerTiers.length})
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'levels' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('levels')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
          >
            Distribution Levels ({distributionLevels.length})
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('reviews')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px', position: 'relative' }}
          >
            Tier Reviews Due
            {stats.reviewsPending > 0 && (
              <span style={{ marginLeft: '6px', background: '#dc2626', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '10px' }}>
                {stats.reviewsPending}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('matrix')}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
          >
            Classification Analytics & Matrix
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Active Partners</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{stats.totalActivePartners}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Classified accounts</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Platinum Strategic</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1d4ed8' }}>{stats.platinumCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Rank 1 flagship</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Gold Premier</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>{stats.goldCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Rank 2 core</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Silver Growth</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#475569' }}>{stats.silverCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Rank 3 emerging</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Bronze Onboarding</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#94a3b8' }}>{stats.bronzeCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Rank 4 trial</div>
        </div>

        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginBottom: '3px' }}>Reviews Due</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: stats.reviewsPending > 0 ? '#dc2626' : '#047857' }}>
            {stats.reviewsPending}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>Scheduled evaluation</div>
        </div>
      </div>

      {/* SUBTAB 1: PERFORMANCE TIERS MASTER */}
      {activeSubTab === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--vf-slate-600)' }}>
              Configurable partner grading tiers governing non-monetary operational benefits and executive review cadences.
            </div>
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              onClick={openCreateTier}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <Plus size={14} />
              <span>Create Performance Tier</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
            {partnerTiers
              .sort((a, b) => a.rank - b.rank)
              .map((tier) => {
                const assignedPartners = partners.filter(
                  (p) => p.classification?.performanceTierId === tier.id
                );

                return (
                  <div
                    key={tier.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid var(--vf-slate-200)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                            {tier.name}
                          </span>
                          <span className="vf-badge vf-badge-outline">Rank {tier.rank}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', fontFamily: 'monospace' }}>
                          Code: {tier.code} • Cadence: {tier.reviewFrequency}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`vf-badge ${tier.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                          {tier.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditTier(tier)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vf-slate-500)', padding: '4px' }}
                          title="Edit tier"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePartnerTierStatus(tier.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: tier.status === 'Active' ? '#ef4444' : '#22c55e', padding: '4px' }}
                          title={tier.status === 'Active' ? 'Deactivate tier' : 'Activate tier'}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--vf-slate-600)', lineHeight: '1.4' }}>
                      {tier.description}
                    </p>

                    {/* Eligibility Criteria */}
                    <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--vf-slate-700)', marginBottom: '4px' }}>
                        Eligibility Criteria:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {tier.eligibilityCriteria.map((c, idx) => (
                          <div key={idx} style={{ fontSize: '11.5px', color: 'var(--vf-slate-600)', display: 'flex', gap: '6px' }}>
                            <span style={{ color: '#2563eb' }}>✓</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Non-Monetary Benefits */}
                    <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e40af', marginBottom: '4px' }}>
                        Assigned Tier Benefits:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {tier.benefits.map((b, idx) => (
                          <div key={idx} style={{ fontSize: '11px', color: '#1e3a8a', display: 'flex', gap: '6px' }}>
                            <span>•</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Assigned Partners Footer */}
                    <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--vf-slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', color: 'var(--vf-slate-600)' }}>
                        <strong>{assignedPartners.length}</strong> Partners actively assigned
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {assignedPartners.slice(0, 3).map((p) => (
                          <span key={p.id} className="vf-badge" style={{ fontSize: '10px', background: '#f1f5f9' }} title={p.name}>
                            {p.code}
                          </span>
                        ))}
                        {assignedPartners.length > 3 && (
                          <span className="vf-badge" style={{ fontSize: '10px', background: '#e2e8f0' }}>
                            +{assignedPartners.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: DISTRIBUTION LEVELS MASTER */}
      {activeSubTab === 'levels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--vf-slate-600)' }}>
              Configurable structural distribution levels indicating a partner's position in supply chain topology (Tier 1 Aggregator &rarr; Tier 2 Stockist &rarr; Tier 3 Retailer).
            </div>
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              onClick={openCreateLevel}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <Plus size={14} />
              <span>Create Distribution Level</span>
            </button>
          </div>

          <div className="vf-table-container">
            <table className="vf-table">
              <thead>
                <tr>
                  <th>Level Code</th>
                  <th>Distribution Level Name</th>
                  <th>Topology Description</th>
                  <th>Permitted Partner Types</th>
                  <th>Assigned Partners</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {distributionLevels.map((lvl) => {
                  const assignedCount = partners.filter(
                    (p) => p.classification?.distributionLevelId === lvl.id
                  ).length;

                  return (
                    <tr key={lvl.id}>
                      <td>
                        <span className="vf-badge vf-badge-outline">{lvl.code}</span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--vf-slate-900)' }}>{lvl.name}</strong>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--vf-slate-600)', maxWidth: '320px' }}>
                        {lvl.description}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {lvl.allowedPartnerTypes.map((t, idx) => (
                            <span key={idx} className="vf-badge" style={{ background: '#f1f5f9', fontSize: '10.5px' }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                          {assignedCount} Partners
                        </span>
                      </td>
                      <td>
                        <span className={`vf-badge ${lvl.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                          {lvl.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="vf-btn vf-btn-secondary"
                            onClick={() => openEditLevel(lvl)}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            className="vf-btn vf-btn-secondary"
                            onClick={() => toggleDistributionLevelStatus(lvl.id)}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            title="Toggle status"
                          >
                            <Power size={12} className={lvl.status === 'Active' ? 'text-red-500' : 'text-green-500'} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TIER REVIEWS & UPGRADE ENGINE */}
      {activeSubTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                Scheduled Partner Performance Review Engine
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                Identifies partners meeting upgrade thresholds or scheduled for periodic tier re-assessment based on procurement volume and credit history.
              </p>
            </div>
          </div>

          {reviewDuePartners.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', color: 'var(--vf-slate-400)' }}>
              <CheckCircle2 size={36} className="text-green-500" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vf-slate-700)' }}>
                All Partner Classifications Are Up to Date
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                No partner accounts currently require scheduled tier re-assessment or pending upgrade actions.
              </p>
            </div>
          ) : (
            <div className="vf-table-container">
              <table className="vf-table">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Current Performance Tier</th>
                    <th>Recommended / Target Tier</th>
                    <th>Review Trigger</th>
                    <th>Procurement & Compliance Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewDuePartners.map((p) => {
                    const currentTier = p.classification?.performanceTierName || 'Standard Tier';
                    const proposedTier = p.classification?.proposedTierName || 'Platinum Strategic Partner';

                    return (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ color: 'var(--vf-slate-900)' }}>{p.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{p.code} • {p.typeName}</div>
                        </td>
                        <td>
                          <span className="vf-badge vf-badge-outline">{currentTier}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ArrowUpRight size={14} className="text-green-600" />
                            <strong style={{ color: '#1d4ed8' }}>{proposedTier}</strong>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--vf-slate-700)' }}>
                          {p.classification?.reason || '12 consecutive months of on-time payment settlement'}
                        </td>
                        <td>
                          <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-600)' }}>
                            Outstanding: ₹{(p.outstandingAmount / 100000).toFixed(1)}L • Overdue: ₹0
                          </div>
                          <span className="vf-badge vf-badge-approved" style={{ fontSize: '10px' }}>
                            Clean Credit Record
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="vf-btn vf-btn-primary"
                            onClick={() => {
                              setUpgradePartnerId(p.id);
                              setTargetTierId(p.classification?.proposedTierId || 'tier-plat');
                              setUpgradeReason(`Approved scheduled upgrade based on quarterly review meeting.`);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '5px 10px' }}
                          >
                            <Check size={13} />
                            <span>Approve Upgrade</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: CLASSIFICATION ANALYTICS & MATRIX */}
      {activeSubTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            {/* Performance Tier vs Distribution Level Matrix */}
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart3 size={16} className="text-blue-600" />
                <span>Classification Matrix: Performance Tier vs Distribution Level</span>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                Cross-tabulation validating complete structural independence of partner tiers and distribution levels.
              </p>

              <div className="vf-table-container">
                <table className="vf-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Tier \ Level</th>
                      {distributionLevels.map((l) => (
                        <th key={l.id}>{l.code}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerTiers.map((t) => {
                      const tierPartners = partners.filter((p) => p.classification?.performanceTierId === t.id);
                      return (
                        <tr key={t.id}>
                          <td><strong>{t.name}</strong></td>
                          {distributionLevels.map((l) => {
                            const count = tierPartners.filter((p) => p.classification?.distributionLevelId === l.id).length;
                            return (
                              <td key={l.id} style={{ textAlign: 'center', fontWeight: count > 0 ? 700 : 400 }}>
                                {count > 0 ? (
                                  <span className="vf-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
                                    {count}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--vf-slate-300)' }}>0</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {tierPartners.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Partners by Territory & Channel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} className="text-blue-600" />
                  <span>Partners by Territory Breakdown</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {territories.map((t) => {
                    const count = partners.filter((p) => p.assignedTerritoryIds?.includes(t.id)).length;
                    return (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8fafc', borderRadius: '4px', fontSize: '12px' }}>
                        <span>{t.name} ({t.code})</span>
                        <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                          {count} Partners
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px' }}>
                  Partners by Sales Channel
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {salesChannels.slice(0, 4).map((c) => {
                    const count = partners.filter((p) => (p.channelAssignments || []).some((ca) => ca.salesChannelId === c.id)).length;
                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8fafc', borderRadius: '4px', fontSize: '12px' }}>
                        <span>{c.name} ({c.code})</span>
                        <span className="vf-badge" style={{ background: '#ecfdf5', color: '#047857' }}>
                          {count} Partners
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIER CREATION / EDIT DRAWER */}
      {isTierDrawerOpen && (
        <div className="vf-drawer-overlay" onClick={() => setIsTierDrawerOpen(false)} style={{ zIndex: 1100 }}>
          <div className="vf-drawer" style={{ width: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-drawer-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                {editingTier ? `Edit Tier: ${editingTier.name}` : 'Create Partner Performance Tier'}
              </div>
              <button type="button" onClick={() => setIsTierDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTier} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="vf-drawer-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Tier Name *</label>
                    <input type="text" className="vf-form-control vf-form-input" value={tierName} onChange={(e) => setTierName(e.target.value)} required placeholder="e.g. Diamond Elite Partner" />
                  </div>
                  <div>
                    <label className="vf-form-label">Tier Code *</label>
                    <input type="text" className="vf-form-control vf-form-input" value={tierCode} onChange={(e) => setTierCode(e.target.value)} required placeholder="e.g. DIAMOND" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Rank / Priority (1 = Top)</label>
                    <input type="number" min={1} className="vf-form-control vf-form-input" value={tierRank} onChange={(e) => setTierRank(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="vf-form-label">Review Cadence</label>
                    <select className="vf-form-control vf-form-select" value={tierFrequency} onChange={(e) => setTierFrequency(e.target.value as any)}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Biannual">Biannual</option>
                      <option value="Annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className="vf-form-label">Status</label>
                    <select className="vf-form-control vf-form-select" value={tierStatus} onChange={(e) => setTierStatus(e.target.value as any)}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Tier Strategic Description</label>
                  <textarea className="vf-form-control vf-form-input" rows={2} value={tierDescription} onChange={(e) => setTierDescription(e.target.value)} placeholder="Operational scope and account profile..." />
                </div>

                <div>
                  <label className="vf-form-label">Eligibility Criteria (One per line)</label>
                  <textarea className="vf-form-control vf-form-input" rows={3} value={tierCriteria} onChange={(e) => setTierCriteria(e.target.value)} placeholder="Annual procurement > ₹X\nCredit compliance..." />
                </div>

                <div>
                  <label className="vf-form-label">Assigned Non-Monetary Benefits (One per line)</label>
                  <textarea className="vf-form-control vf-form-input" rows={3} value={tierBenefits} onChange={(e) => setTierBenefits(e.target.value)} placeholder="Priority batch allocation\nQBR review..." />
                </div>
              </div>

              <div className="vf-drawer-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc' }}>
                <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setIsTierDrawerOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="vf-btn vf-btn-primary">
                  Save Performance Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISTRIBUTION LEVEL CREATION / EDIT DRAWER */}
      {isLevelDrawerOpen && (
        <div className="vf-drawer-overlay" onClick={() => setIsLevelDrawerOpen(false)} style={{ zIndex: 1100 }}>
          <div className="vf-drawer" style={{ width: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-drawer-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                {editingLevel ? `Edit Level: ${editingLevel.name}` : 'Create Distribution Level'}
              </div>
              <button type="button" onClick={() => setIsLevelDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLevel} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="vf-drawer-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="vf-form-label">Level Name *</label>
                    <input type="text" className="vf-form-control vf-form-input" value={levelName} onChange={(e) => setLevelName(e.target.value)} required placeholder="e.g. Tier 1 — Central Hub" />
                  </div>
                  <div>
                    <label className="vf-form-label">Level Code *</label>
                    <input type="text" className="vf-form-control vf-form-input" value={levelCode} onChange={(e) => setLevelCode(e.target.value)} required placeholder="e.g. DL-1" />
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Topology Description</label>
                  <textarea className="vf-form-control vf-form-input" rows={2} value={levelDescription} onChange={(e) => setLevelDescription(e.target.value)} placeholder="Network position and authorized supply responsibilities..." />
                </div>

                <div>
                  <label className="vf-form-label">Allowed Partner Types (Comma-separated)</label>
                  <input type="text" className="vf-form-control vf-form-input" value={allowedTypes} onChange={(e) => setAllowedTypes(e.target.value)} placeholder="Distributor, Super Stockist, C&F Agent" />
                </div>

                <div>
                  <label className="vf-form-label">Status</label>
                  <select className="vf-form-control vf-form-select" value={levelStatus} onChange={(e) => setLevelStatus(e.target.value as any)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="vf-drawer-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc' }}>
                <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setIsLevelDrawerOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="vf-btn vf-btn-primary">
                  Save Distribution Level
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPGRADE CONFIRMATION MODAL */}
      {upgradePartnerId && (
        <div className="vf-modal-backdrop" onClick={() => setUpgradePartnerId(null)} style={{ zIndex: 1200 }}>
          <div className="vf-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={18} className="text-blue-600" />
                <span>Authorize Partner Tier Upgrade</span>
              </div>
            </div>

            <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--vf-slate-700)' }}>
                Upgrading partner: <strong>{partners.find((p) => p.id === upgradePartnerId)?.name}</strong>
              </div>

              <div>
                <label className="vf-form-label">Target Performance Tier</label>
                <select className="vf-form-control vf-form-select" value={targetTierId} onChange={(e) => setTargetTierId(e.target.value)}>
                  {partnerTiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (Rank {t.rank})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="vf-form-label">Executive Justification / Review Minutes</label>
                <textarea
                  className="vf-form-control vf-form-input"
                  rows={3}
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                  placeholder="Record justification from quarterly performance review meeting..."
                />
              </div>

              <div style={{ fontSize: '11.5px', color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: '4px' }}>
                <em>Important: Upgrading performance tier does not automatically alter commercial pricing terms. Commercial terms must be explicitly governed per sales channel.</em>
              </div>
            </div>

            <div className="vf-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setUpgradePartnerId(null)}>
                Cancel
              </button>
              <button type="button" className="vf-btn vf-btn-primary" onClick={handleApproveUpgrade}>
                Confirm & Upgrade Tier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
