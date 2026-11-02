import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { DistributionRoute } from '../../types/gtm.ts';
import { RouteDetailDrawer } from './RouteDetailDrawer.tsx';
import { RouteBuilderDrawer } from './RouteBuilderDrawer.tsx';
import { 
  Search, 
  Plus, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Users, 
  Eye, 
  Edit3, 
  Copy, 
  Power 
} from 'lucide-react';

export const RoutesOverview: React.FC = () => {
  const { 
    distributionRoutes, 
    territories, 
    salesChannels, 
    partners, 
    duplicateDistributionRoute, 
    toggleDistributionRouteStatus 
  } = useApp();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [territoryFilter, setTerritoryFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'code' | 'name' | 'status' | 'updatedAt'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals & Drawers state
  const [selectedRouteForDetail, setSelectedRouteForDetail] = useState<DistributionRoute | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [isBuilderDrawerOpen, setIsBuilderDrawerOpen] = useState(false);

  // Deactivate Confirmation Dialog state
  const [routeToDeactivate, setRouteToDeactivate] = useState<DistributionRoute | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // -------------------------------------------------------------
  // CALCULATED METRICS
  // -------------------------------------------------------------
  const totalRoutesCount = distributionRoutes.length;
  const activeRoutesCount = distributionRoutes.filter((r) => r.status === 'Active').length;
  const draftRoutesCount = distributionRoutes.filter((r) => r.status === 'Draft').length;
  const pendingRoutesCount = distributionRoutes.filter((r) => r.status === 'Pending Approval').length;

  // Calculate unique partners assigned across all routes
  const uniqueAssignedPartners = new Set<string>();
  distributionRoutes.forEach((route) => {
    (route.nodes || []).forEach((node) => {
      (node.assignedPartners || []).forEach((ap) => uniqueAssignedPartners.add(ap.partnerId));
    });
  });
  partners.forEach((p) => {
    if (p.assignedRouteId) uniqueAssignedPartners.add(p.id);
  });
  const totalAssignedPartnersCount = uniqueAssignedPartners.size;

  // -------------------------------------------------------------
  // FILTERING & SORTING
  // -------------------------------------------------------------
  const filteredRoutes = distributionRoutes.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      r.name.toLowerCase().includes(term) ||
      r.code.toLowerCase().includes(term) ||
      (r.description || '').toLowerCase().includes(term) ||
      r.stages.some((s) => s.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || r.routeType === typeFilter;
    const matchesTerritory = territoryFilter === 'ALL' || r.applicableTerritoryIds.includes(territoryFilter);
    const matchesChannel = channelFilter === 'ALL' || (r.applicableChannelIds || []).includes(channelFilter);

    return matchesSearch && matchesStatus && matchesType && matchesTerritory && matchesChannel;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') comparison = a.name.localeCompare(b.name);
    else if (sortField === 'code') comparison = a.code.localeCompare(b.code);
    else if (sortField === 'status') comparison = a.status.localeCompare(b.status);
    else if (sortField === 'updatedAt') comparison = (a.updatedAt || '').localeCompare(b.updatedAt || '');
    return sortAsc ? comparison : -comparison;
  });

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleOpenCreateRoute = () => {
    setEditRouteId(null);
    setIsBuilderDrawerOpen(true);
  };

  const handleOpenEditRoute = (route: DistributionRoute) => {
    setEditRouteId(route.id);
    setIsBuilderDrawerOpen(true);
  };

  const handleOpenViewDetails = (route: DistributionRoute) => {
    setSelectedRouteForDetail(route);
    setIsDetailDrawerOpen(true);
  };

  const handleInitiateToggleStatus = (route: DistributionRoute) => {
    if (route.status === 'Active') {
      setRouteToDeactivate(route);
      setIsConfirmModalOpen(true);
    } else {
      toggleDistributionRouteStatus(route.id);
    }
  };

  const handleConfirmDeactivation = () => {
    if (routeToDeactivate) {
      toggleDistributionRouteStatus(routeToDeactivate.id);
      setIsConfirmModalOpen(false);
      setRouteToDeactivate(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="vf-badge vf-badge-approved">Active</span>;
      case 'Draft':
        return <span className="vf-badge vf-badge-draft">Draft</span>;
      case 'Pending Approval':
        return <span className="vf-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Pending Approval</span>;
      case 'Inactive':
      default:
        return <span className="vf-badge vf-badge-danger">Inactive</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 5 Summary KPI Cards (Prompt Section 4) */}
      <div className="vf-metric-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', margin: 0 }}>
        {/* Total Routes */}
        <div className="vf-metric-card accent" style={{ padding: '16px' }}>
          <div className="vf-metric-label">
            <span>Total Sales Routes</span>
            <Layers size={16} />
          </div>
          <div className="vf-metric-value">{totalRoutesCount}</div>
          <div className="vf-metric-meta">Configured topologies</div>
        </div>

        {/* Active Routes */}
        <div className="vf-metric-card success" style={{ padding: '16px' }}>
          <div className="vf-metric-label">
            <span>Active Deployable</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="vf-metric-value">{activeRoutesCount}</div>
          <div className="vf-metric-meta">Order inbox enabled</div>
        </div>

        {/* Draft Routes */}
        <div className="vf-metric-card" style={{ padding: '16px' }}>
          <div className="vf-metric-label">
            <span>Draft Routes</span>
            <Clock size={16} />
          </div>
          <div className="vf-metric-value">{draftRoutesCount}</div>
          <div className="vf-metric-meta">In-progress architecture</div>
        </div>

        {/* Pending Approval */}
        <div className="vf-metric-card warning" style={{ padding: '16px' }}>
          <div className="vf-metric-label">
            <span>Pending Approval</span>
            <AlertTriangle size={16} />
          </div>
          <div className="vf-metric-value">{pendingRoutesCount}</div>
          <div className="vf-metric-meta">Governance sign-off</div>
        </div>

        {/* Assigned Partners */}
        <div className="vf-metric-card purple" style={{ padding: '16px' }}>
          <div className="vf-metric-label">
            <span>Assigned Partners</span>
            <Users size={16} />
          </div>
          <div className="vf-metric-value">{totalAssignedPartnersCount}</div>
          <div className="vf-metric-meta">Unique active participants</div>
        </div>
      </div>

      {/* Search, Filter Bar & Create Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#ffffff', padding: '14px 18px', border: '1px solid var(--vf-slate-200)', borderRadius: '8px' }}>
        
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div className="vf-search-input-wrap" style={{ width: '100%' }}>
            <Search size={14} className="vf-search-icon" />
            <input
              type="text"
              className="vf-search-input"
              placeholder="Search by route name, code, stages, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <select
            className="vf-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px', width: '130px' }}
          >
            <option value="ALL">Status: All</option>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Route Type Filter */}
          <select
            className="vf-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px', width: '160px' }}
          >
            <option value="ALL">Type: All Models</option>
            <option value="Direct">Direct (Mfr → Hosp)</option>
            <option value="Single-Tier Intermediary">Single-Tier Intermediary</option>
            <option value="Multi-Tier Wholesale">Multi-Tier Wholesale</option>
            <option value="Consignment Distribution">Consignment Hub & Spoke</option>
            <option value="Institutional Tender">Institutional Tender</option>
          </select>

          {/* Territory Filter */}
          <select
            className="vf-select"
            value={territoryFilter}
            onChange={(e) => setTerritoryFilter(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px', width: '150px' }}
          >
            <option value="ALL">Territory: All</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Channel Filter */}
          <select
            className="vf-select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px', width: '150px' }}
          >
            <option value="ALL">Channel: All</option>
            {salesChannels.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Primary Create Button */}
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={handleOpenCreateRoute}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={15} />
            <span>Create Sales Route</span>
          </button>
        </div>

      </div>

      {/* Routes Master Data Table (Prompt Section 4) */}
      <div className="vf-table-container">
        <table className="vf-table">
          <thead>
            <tr>
              <th 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (sortField === 'code') setSortAsc(!sortAsc);
                  else { setSortField('code'); setSortAsc(true); }
                }}
              >
                Route Code {sortField === 'code' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (sortField === 'name') setSortAsc(!sortAsc);
                  else { setSortField('name'); setSortAsc(true); }
                }}
              >
                Route Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th>Distribution Flow</th>
              <th>Route Type</th>
              <th>Territories</th>
              <th>Channels</th>
              <th>Partners</th>
              <th 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (sortField === 'status') setSortAsc(!sortAsc);
                  else { setSortField('status'); setSortAsc(true); }
                }}
              >
                Status {sortField === 'status' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th>Updated</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--vf-slate-500)' }}>
                  <Layers size={32} className="text-slate-300" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--vf-slate-700)' }}>
                    No Sales Routes Match Filter Criteria
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Try clearing search filters or create a new configurable distribution route.
                  </div>
                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary vf-btn-sm"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('ALL');
                      setTypeFilter('ALL');
                      setTerritoryFilter('ALL');
                      setChannelFilter('ALL');
                    }}
                    style={{ marginTop: '12px' }}
                  >
                    Reset Filters
                  </button>
                </td>
              </tr>
            ) : (
              filteredRoutes.map((route) => {
                // Calculate assigned partners on this route
                const assignedOnRoute = new Set<string>();
                (route.nodes || []).forEach((n) => {
                  (n.assignedPartners || []).forEach((ap) => assignedOnRoute.add(ap.partnerId));
                });
                partners.forEach((p) => {
                  if (p.assignedRouteId === route.id) assignedOnRoute.add(p.id);
                });

                return (
                  <tr key={route.id}>
                    <td>
                      <code style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--vf-accent)' }}>
                        {route.code}
                      </code>
                    </td>
                    <td>
                      <div 
                        style={{ fontWeight: 700, fontSize: '13px', color: 'var(--vf-slate-900)', cursor: 'pointer' }}
                        onClick={() => handleOpenViewDetails(route)}
                        title="Click to view detailed route topology"
                      >
                        {route.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {route.description || 'Configured commercial distribution path.'}
                      </div>
                    </td>
                    <td>
                      {/* Connected Distribution Flow Pill Representation */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {route.stages.map((stage, idx) => (
                          <React.Fragment key={idx}>
                            <span 
                              className="vf-badge"
                              style={{ 
                                fontSize: '10px', 
                                padding: '2px 6px',
                                background: idx === 0 ? '#f1f5f9' : idx === route.stages.length - 1 ? '#dcfce7' : '#eff6ff',
                                color: idx === 0 ? 'var(--vf-slate-700)' : idx === route.stages.length - 1 ? '#166534' : '#1d4ed8'
                              }}
                            >
                              {stage}
                            </span>
                            {idx < route.stages.length - 1 && (
                              <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', fontWeight: 700 }}>&rarr;</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="vf-badge vf-badge-type" style={{ fontSize: '11px' }}>
                        {route.routeType || 'Multi-Tier'}
                      </span>
                    </td>
                    <td>
                      <span className="vf-badge vf-badge-neutral" title={route.applicableTerritoryIds.join(', ')}>
                        {route.applicableTerritoryIds.length} Territories
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                        {(route.applicableChannelIds || []).slice(0, 2).map((cId) => {
                          const chan = salesChannels.find((c) => c.id === cId);
                          return (
                            <span key={cId} className="vf-badge" style={{ fontSize: '9.5px', background: '#f8fafc' }}>
                              {chan?.code || cId}
                            </span>
                          );
                        })}
                        {(route.applicableChannelIds || []).length > 2 && (
                          <span className="vf-badge" style={{ fontSize: '9.5px', background: '#f8fafc' }}>
                            +{(route.applicableChannelIds || []).length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`vf-badge ${assignedOnRoute.size > 0 ? 'vf-badge-active' : 'vf-badge-neutral'}`}>
                        {assignedOnRoute.size} Partners
                      </span>
                    </td>
                    <td>
                      {getStatusBadge(route.status)}
                    </td>
                    <td style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)', whiteSpace: 'nowrap' }}>
                      {route.updatedAt || route.effectiveFrom}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleOpenViewDetails(route)}
                          title="View Route Details"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleOpenEditRoute(route)}
                          title="Edit Route in Builder"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => duplicateDistributionRoute(route.id)}
                          title="Duplicate Route"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleInitiateToggleStatus(route)}
                          title={route.status === 'Active' ? 'Deactivate Route' : 'Activate Route'}
                          style={{ color: route.status === 'Active' ? 'var(--vf-danger)' : 'var(--vf-success)' }}
                        >
                          <Power size={12} />
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

      {/* Confirmation Dialog Before Deactivating Route (Prompt Section 4, 12) */}
      {isConfirmModalOpen && routeToDeactivate && (
        <div 
          className="vf-modal-backdrop" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConfirmModalOpen(false);
          }}
        >
          <div className="vf-modal vf-modal-compact" style={{ width: '480px', padding: 0 }}>
            <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)' }}>
              <div className="vf-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
                <AlertTriangle size={18} />
                <span>Confirm Route Deactivation</span>
              </div>
              <button 
                type="button" 
                className="vf-modal-close" 
                onClick={() => setIsConfirmModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="vf-modal-body" style={{ padding: '20px', fontSize: '13px', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 12px 0', color: 'var(--vf-slate-700)' }}>
                Are you sure you want to deactivate the distribution route <strong>"{routeToDeactivate.name}"</strong> (<code>{routeToDeactivate.code}</code>)?
              </p>
              
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#991b1b', marginBottom: '12px' }}>
                <strong>Enterprise Preservation Rule:</strong> Deactivating this route will not delete historical transaction records or silently remove existing partner linkages. Future order bookings under this topology will be blocked until reactivated.
              </div>
            </div>

            <div className="vf-modal-footer" style={{ padding: '12px 20px', background: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-danger"
                onClick={handleConfirmDeactivation}
              >
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Details Side Drawer */}
      <RouteDetailDrawer
        route={selectedRouteForDetail}
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedRouteForDetail(null);
        }}
        onEdit={(route) => handleOpenEditRoute(route)}
        onDuplicate={(id) => duplicateDistributionRoute(id)}
        onToggleStatus={(id) => {
          const r = distributionRoutes.find((rt) => rt.id === id);
          if (r) handleInitiateToggleStatus(r);
        }}
      />

      {/* Visual Route Builder Side Drawer */}
      <RouteBuilderDrawer
        isOpen={isBuilderDrawerOpen}
        onClose={() => {
          setIsBuilderDrawerOpen(false);
          setEditRouteId(null);
        }}
        editRouteId={editRouteId}
      />

    </div>
  );
};
