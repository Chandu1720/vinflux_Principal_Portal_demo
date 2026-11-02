import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Compass, 
  MapPin, 
  Users, 
  Award, 
  Layers, 
  DollarSign, 
  CheckCircle2, 
  Filter, 
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';

interface GTMOverviewDashboardProps {
  onNavigateTab: (tab: 'overview' | 'territories' | 'classification' | 'channels' | 'terms' | 'routes') => void;
}

export const GTMOverviewDashboard: React.FC<GTMOverviewDashboardProps> = ({
  onNavigateTab
}) => {
  const {
    territories,
    partners,
    salesChannels,
    distributionRoutes,
    partnerTiers,
    distributionLevels
  } = useApp();

  // Filters State
  const [filterZone, setFilterZone] = useState('ALL');
  const [filterTerritory, setFilterTerritory] = useState('ALL');
  const [filterPartnerType, setFilterPartnerType] = useState('ALL');
  const [filterTier, setFilterTier] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterPartnerStatus, setFilterPartnerStatus] = useState('ALL');
  const [filterCommercialStatus, setFilterCommercialStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 12 Computed KPI Metrics (from actual data!)
  const totalTerritories = territories.length;
  const activeTerritories = territories.filter((t) => t.status === 'Active').length;
  
  const activePartners = partners.filter((p) => p.status === 'Active').length;
  const platinumPartners = partners.filter((p) => p.classification?.performanceTierId === 'tier-plat').length;
  const goldPartners = partners.filter((p) => p.classification?.performanceTierId === 'tier-gold').length;
  const silverPartners = partners.filter((p) => p.classification?.performanceTierId === 'tier-silver').length;
  const otherTiersPartners = partners.filter(
    (p) => !['tier-plat', 'tier-gold', 'tier-silver'].includes(p.classification?.performanceTierId || '')
  ).length;

  const activeChannels = salesChannels.filter((c) => c.status === 'Active').length;
  const activeRoutes = distributionRoutes.filter((r) => r.status === 'Active').length;

  // Flattened channel assignments
  const allAssignments = useMemo(() => {
    const list: any[] = [];
    partners.forEach((p) => {
      (p.channelAssignments || []).forEach((ca) => {
        list.push({
          ...ca,
          partnerId: p.id,
          partnerName: p.name,
          partnerCode: p.code,
          partnerType: p.typeName || 'Distributor',
          partnerTierId: p.classification?.performanceTierId,
          partnerTierName: p.classification?.performanceTierName || 'Standard Tier',
          distributionLevelId: p.classification?.distributionLevelId,
          distributionLevelName: p.classification?.distributionLevelName || 'Tier 2 Stockist',
          partnerStatus: p.status,
          partnerTerritories: p.assignedTerritoryIds || []
        });
      });
    });
    return list;
  }, [partners]);

  const standardAssignmentsCount = allAssignments.filter((a) => a.commercialTermStatus === 'Standard').length;
  const deviatedAssignmentsCount = allAssignments.filter((a) => a.commercialTermStatus?.startsWith('Deviated')).length;
  const pendingApprovalsCount = allAssignments.filter((a) => a.commercialTermStatus === 'Deviated — Pending Approval').length;

  // Filtered rows for the live interactive overview table
  const filteredAssignments = useMemo(() => {
    return allAssignments.filter((a) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = a.partnerName.toLowerCase().includes(q) || a.partnerCode.toLowerCase().includes(q);
        const matchChannel = a.salesChannelName.toLowerCase().includes(q);
        if (!matchName && !matchChannel) return false;
      }

      if (filterZone !== 'ALL') {
        const matchingTerritories = territories.filter((t) => t.zone === filterZone).map((t) => t.id);
        const inZone = a.partnerTerritories.some((tid: string) => matchingTerritories.includes(tid));
        if (!inZone) return false;
      }

      if (filterTerritory !== 'ALL' && !a.partnerTerritories.includes(filterTerritory)) return false;
      if (filterPartnerType !== 'ALL' && a.partnerType !== filterPartnerType) return false;
      if (filterTier !== 'ALL' && a.partnerTierId !== filterTier) return false;
      if (filterLevel !== 'ALL' && a.distributionLevelId !== filterLevel) return false;
      if (filterChannel !== 'ALL' && a.salesChannelId !== filterChannel) return false;
      if (filterPartnerStatus !== 'ALL' && a.partnerStatus !== filterPartnerStatus) return false;
      if (filterCommercialStatus !== 'ALL' && a.commercialTermStatus !== filterCommercialStatus) return false;

      return true;
    });
  }, [
    allAssignments,
    searchTerm,
    filterZone,
    filterTerritory,
    filterPartnerType,
    filterTier,
    filterLevel,
    filterChannel,
    filterPartnerStatus,
    filterCommercialStatus,
    territories
  ]);

  const resetFilters = () => {
    setFilterZone('ALL');
    setFilterTerritory('ALL');
    setFilterPartnerType('ALL');
    setFilterTier('ALL');
    setFilterLevel('ALL');
    setFilterChannel('ALL');
    setFilterPartnerStatus('ALL');
    setFilterCommercialStatus('ALL');
    setSearchTerm('');
  };

  const zonesList = Array.from(new Set(territories.map((t) => t.zone).filter(Boolean)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Intro Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', padding: '20px 24px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Compass size={22} className="text-blue-400" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
              VinFlux Go-to-Market (GTM) Operations Cockpit
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Unified principal intelligence across authorized territories, classified partner tiers, multi-channel supply routes, and statutory commercial approvals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="vf-badge" style={{ background: '#3b82f6', color: '#ffffff', fontSize: '11px', padding: '6px 12px' }}>
            {activeTerritories} Active Territories
          </span>
          <span className="vf-badge" style={{ background: '#10b981', color: '#ffffff', fontSize: '11px', padding: '6px 12px' }}>
            {activePartners} Active Partners
          </span>
          <span className="vf-badge" style={{ background: '#8b5cf6', color: '#ffffff', fontSize: '11px', padding: '6px 12px' }}>
            {activeRoutes} Active Routes
          </span>
        </div>
      </div>

      {/* 12 Clickable Summary KPI Cards */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
          GTM Commercial & Distribution Metrics (Click any card to inspect or jump to section)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          {/* 1. Total Territories */}
          <div 
            onClick={() => onNavigateTab('territories')}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Total Territories</span>
              <MapPin size={15} className="text-blue-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{totalTerritories}</div>
            <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>View hierarchy</span>
              <ExternalLink size={10} />
            </div>
          </div>

          {/* 2. Active Territories */}
          <div 
            onClick={() => onNavigateTab('territories')}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Active Territories</span>
              <CheckCircle2 size={15} className="text-green-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#047857' }}>{activeTerritories}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Authorized operational</div>
          </div>

          {/* 3. Active Partners */}
          <div 
            onClick={() => { setFilterPartnerStatus('Active'); }}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Active Partners</span>
              <Users size={15} className="text-blue-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#1d4ed8' }}>{activePartners}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Unique verified entities</div>
          </div>

          {/* 4. Platinum Partners */}
          <div 
            onClick={() => { setFilterTier('tier-plat'); onNavigateTab('classification'); }}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Platinum Partners</span>
              <Award size={15} className="text-indigo-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#4338ca' }}>{platinumPartners}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Rank 1 flagship tier</div>
          </div>

          {/* 5. Gold Partners */}
          <div 
            onClick={() => { setFilterTier('tier-gold'); onNavigateTab('classification'); }}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Gold Partners</span>
              <Award size={15} className="text-amber-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#b45309' }}>{goldPartners}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Rank 2 core tier</div>
          </div>

          {/* 6. Silver Partners */}
          <div 
            onClick={() => { setFilterTier('tier-silver'); onNavigateTab('classification'); }}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Silver Partners</span>
              <Award size={15} className="text-slate-500" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#475569' }}>{silverPartners}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Rank 3 emerging tier</div>
          </div>

          {/* 7. Other Configured Partner Tiers */}
          <div 
            onClick={() => onNavigateTab('classification')}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Other Tiers (Bronze)</span>
              <Award size={15} className="text-amber-700" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#78350f' }}>{otherTiersPartners}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Trial / entry level</div>
          </div>

          {/* 8. Active Sales Channels */}
          <div 
            onClick={() => onNavigateTab('channels')}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Active Channels</span>
              <DollarSign size={15} className="text-blue-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>{activeChannels}</div>
            <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>Channel master</span>
              <ExternalLink size={10} />
            </div>
          </div>

          {/* 9. Active Sales Routes */}
          <div 
            onClick={() => onNavigateTab('routes')}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Active Sales Routes</span>
              <Layers size={15} className="text-blue-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#047857' }}>{activeRoutes}</div>
            <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>Visual route builder</span>
              <ExternalLink size={10} />
            </div>
          </div>

          {/* 10. Standard Partner-Channel Assignments */}
          <div 
            onClick={() => { setFilterCommercialStatus('Standard'); }}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Standard Asgns</span>
              <CheckCircle2 size={15} className="text-green-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#047857' }}>{standardAssignmentsCount}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Channel baseline</div>
          </div>

          {/* 11. Deviated Partner-Channel Assignments */}
          <div 
            onClick={() => { onNavigateTab('terms'); }}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>Deviated Asgns</span>
              <DollarSign size={15} className="text-amber-600" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#b45309' }}>{deviatedAssignmentsCount}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>Special commercial terms</div>
          </div>

          {/* 12. Pending Commercial Approvals */}
          <div 
            onClick={() => onNavigateTab('terms')}
            style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: pendingApprovalsCount > 0 ? '1px solid #fca5a5' : '1px solid var(--vf-slate-200)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            className="vf-stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11.5px', color: pendingApprovalsCount > 0 ? '#b91c1c' : 'var(--vf-slate-500)' }}>Pending Approvals</span>
              <span className="vf-badge" style={{ background: pendingApprovalsCount > 0 ? '#fee2e2' : '#f1f5f9', color: pendingApprovalsCount > 0 ? '#b91c1c' : 'var(--vf-slate-500)', fontSize: '10px' }}>
                Queue
              </span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: pendingApprovalsCount > 0 ? '#dc2626' : 'var(--vf-slate-900)' }}>
              {pendingApprovalsCount}
            </div>
            <div style={{ fontSize: '10.5px', color: pendingApprovalsCount > 0 ? '#b91c1c' : 'var(--vf-slate-400)', marginTop: '2px', fontWeight: pendingApprovalsCount > 0 ? 600 : 400 }}>
              {pendingApprovalsCount > 0 ? 'Action required &rarr;' : 'Clear'}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Faceted Filters Bar */}
      <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
            <Filter size={15} className="text-blue-600" />
            <span>Cross-Module Filter Explorer</span>
            <span className="vf-badge" style={{ fontSize: '10.5px', background: '#eff6ff', color: '#1d4ed8' }}>
              Showing {filteredAssignments.length} of {allAssignments.length} mappings
            </span>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--vf-slate-500)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={12} />
            <span>Reset Filters</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {/* Search Term */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--vf-slate-400)' }} />
            <input
              type="text"
              className="vf-form-control vf-form-input vf-search-input"
              style={{ paddingLeft: '30px', fontSize: '12px', height: '32px' }}
              placeholder="Search partner or channel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Zone Filter */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
          >
            <option value="ALL">All Zones</option>
            {zonesList.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          {/* Territory Filter */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterTerritory}
            onChange={(e) => setFilterTerritory(e.target.value)}
          >
            <option value="ALL">All Territories</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Sales Channel Filter */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
          >
            <option value="ALL">All Sales Channels</option>
            {salesChannels.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Partner Performance Tier */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
          >
            <option value="ALL">All Performance Tiers</option>
            {partnerTiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Distribution Level */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="ALL">All Distribution Levels</option>
            {distributionLevels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Partner Status */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterPartnerStatus}
            onChange={(e) => setFilterPartnerStatus(e.target.value)}
          >
            <option value="ALL">All Partner Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>

          {/* Commercial Terms Status */}
          <select
            className="vf-form-control vf-form-select"
            style={{ fontSize: '12px', height: '32px' }}
            value={filterCommercialStatus}
            onChange={(e) => setFilterCommercialStatus(e.target.value)}
          >
            <option value="ALL">All Commercial Statuses</option>
            <option value="Standard">Standard (Channel Default)</option>
            <option value="Deviated — Approved">Deviated — Approved</option>
            <option value="Deviated — Pending Approval">Deviated — Pending Approval</option>
            <option value="Deviated — Rejected">Deviated — Rejected</option>
          </select>
        </div>
      </div>

      {/* Filtered Partner-Channel Relationships Table */}
      <div className="vf-table-container">
        <table className="vf-table">
          <thead>
            <tr>
              <th>Partner Entity</th>
              <th>Performance Tier</th>
              <th>Distribution Level</th>
              <th>Sales Channel</th>
              <th>Covered Territories</th>
              <th>Channel Margin</th>
              <th>Commercial Status</th>
              <th>Partner Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--vf-slate-400)' }}>
                  No partner-channel relationships match the selected filter combination.
                </td>
              </tr>
            ) : (
              filteredAssignments.map((row) => {
                const defaultMargin = row.commercialOverride?.channelDefaultDiscount || 12.0;
                const effectiveDiscount = row.commercialOverride?.overrideDiscountPercent || defaultMargin;

                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--vf-slate-900)' }}>{row.partnerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                        {row.partnerCode} • {row.partnerType}
                      </div>
                    </td>
                    <td>
                      <span className={`vf-badge ${row.partnerTierId === 'tier-plat' ? 'vf-badge-approved' : 'vf-badge-active'}`}>
                        {row.partnerTierName}
                      </span>
                    </td>
                    <td style={{ fontSize: '11.5px', color: 'var(--vf-slate-700)' }}>
                      {row.distributionLevelName}
                    </td>
                    <td>
                      <span className="vf-badge" style={{ background: '#f1f5f9', fontWeight: 600 }}>
                        {row.salesChannelName}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(row.partnerTerritories || []).map((tid: string) => {
                          const terr = territories.find((t) => t.id === tid);
                          return (
                            <span key={tid} className="vf-badge" style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8' }}>
                              {terr?.name || tid}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: row.commercialTermStatus?.startsWith('Deviated') ? '#b45309' : '#047857' }}>
                        {effectiveDiscount}%
                      </strong>
                      <div style={{ fontSize: '10px', color: 'var(--vf-slate-400)' }}>
                        Default: {defaultMargin}%
                      </div>
                    </td>
                    <td>
                      <span className={`vf-badge ${row.commercialTermStatus === 'Deviated — Approved' ? 'vf-badge-approved' : row.commercialTermStatus === 'Deviated — Pending Approval' ? 'vf-badge-warning' : 'vf-badge-active'}`}>
                        {row.commercialTermStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`vf-badge ${row.partnerStatus === 'Active' ? 'vf-badge-approved' : 'vf-badge-rejected'}`}>
                        {row.partnerStatus}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
