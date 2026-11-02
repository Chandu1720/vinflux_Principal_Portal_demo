import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { DistributionRoute } from '../../types/gtm.ts';
import { 
  X, 
  Edit3, 
  Copy, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Layers, 
  DollarSign, 
  Building2, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';

interface RouteDetailDrawerProps {
  route: DistributionRoute | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (route: DistributionRoute) => void;
  onDuplicate: (routeId: string) => void;
  onToggleStatus: (routeId: string) => void;
}

export const RouteDetailDrawer: React.FC<RouteDetailDrawerProps> = ({
  route,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onToggleStatus
}) => {
  const { territories, salesChannels, partners } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'territories' | 'channels' | 'commercial' | 'partners' | 'history'>('overview');

  if (!isOpen || !route) return null;

  // Filter territories associated with this route
  const assignedTerritories = territories.filter((t) => route.applicableTerritoryIds.includes(t.id));

  // Filter sales channels associated with this route
  const assignedChannels = salesChannels.filter((c) => (route.applicableChannelIds || []).includes(c.id));

  // Collect all assigned partners across all nodes
  const nodePartnerIds = new Set<string>();
  route.nodes.forEach((node) => {
    (node.assignedPartners || []).forEach((ap) => nodePartnerIds.add(ap.partnerId));
  });

  // Also partners with assignedRouteId matching this route
  const assignedPartnersList = partners.filter((p) => p.assignedRouteId === route.id || nodePartnerIds.has(p.id));

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
    <div
      className="vf-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vf-drawer vf-drawer-xl" style={{ width: '920px' }}>
        
        {/* Drawer Header */}
        <div className="vf-drawer-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vf-accent)' }}>{route.code}</code>
              {getStatusBadge(route.status)}
              <span className="vf-badge vf-badge-type">{route.routeType || 'Multi-Tier'}</span>
              <span className="vf-badge" style={{ background: '#f8fafc', color: 'var(--vf-slate-600)' }}>
                {route.commercialModel || 'Title Transfer'}
              </span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)', margin: '2px 0 0 0' }}>
              {route.name}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
              {route.description || 'Configured commercial distribution path.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="vf-btn vf-btn-secondary vf-btn-sm"
              onClick={() => onDuplicate(route.id)}
              title="Duplicate Route"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Copy size={13} />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-primary vf-btn-sm"
              onClick={() => {
                onClose();
                onEdit(route);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Edit3 size={13} />
              <span>Edit Route</span>
            </button>
            <button
              type="button"
              className="vf-drawer-close"
              onClick={onClose}
              title="Close Drawer"
              style={{ fontSize: '20px', cursor: 'pointer', marginLeft: '6px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 7 Tab Navigation */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--vf-slate-50)', borderBottom: '1px solid var(--vf-slate-200)', padding: '0 16px', overflowX: 'auto' }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'steps', label: `Distribution Steps (${route.nodes.length})` },
            { id: 'territories', label: `Territory Coverage (${assignedTerritories.length})` },
            { id: 'channels', label: `Sales Channels (${assignedChannels.length})` },
            { id: 'commercial', label: 'Commercial Terms' },
            { id: 'partners', label: `Assigned Partners (${assignedPartnersList.length})` },
            { id: 'history', label: `History & Audit (${(route.history || []).length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`vf-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              style={{ whiteSpace: 'nowrap', fontSize: '12.5px', padding: '10px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div className="vf-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ============================================================== */}
          {/* TAB 1: OVERVIEW */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Visual Flow Topology Banner */}
              <div className="vf-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Visual Distribution Flow Sequence
                  </div>
                  <span className="vf-badge vf-badge-approved">
                    {route.nodes.length} Stages Flow
                  </span>
                </div>

                <div className="vf-path-builder-canvas" style={{ padding: '18px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', overflowX: 'auto', marginBottom: 0 }}>
                  <div className="vf-path-flow" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '600px' }}>
                    {route.nodes.map((node, idx) => (
                      <React.Fragment key={node.id || idx}>
                        <div
                          className={`vf-path-node ${idx === 0 ? 'mfr' : idx === route.nodes.length - 1 ? 'hospital' : ''}`}
                          style={{
                            background: '#ffffff',
                            border: `2px solid ${idx === 0 ? 'var(--vf-primary)' : idx === route.nodes.length - 1 ? 'var(--vf-success)' : 'var(--vf-slate-300)'}`,
                            borderRadius: '6px',
                            padding: '12px 14px',
                            minWidth: '150px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            boxShadow: 'var(--vf-shadow-xs)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
                              Step {node.level || idx + 1}
                            </span>
                            <span className="vf-badge" style={{ fontSize: '9px', padding: '1px 4px', background: '#f1f5f9' }}>
                              {node.participantType || node.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)' }}>
                            {node.label}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                            {node.role}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vf-accent)', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '2px' }}>
                            {node.pricingPoint}
                          </div>

                          {/* Assigned partner badge */}
                          {(node.assignedPartners || []).length > 0 ? (
                            <div style={{ fontSize: '10.5px', color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={11} />
                              <span>{node.assignedPartners!.length} Partner(s) Assigned</span>
                            </div>
                          ) : idx > 0 && idx < route.nodes.length - 1 ? (
                            <div style={{ fontSize: '10.5px', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <AlertTriangle size={11} />
                              <span>Unassigned</span>
                            </div>
                          ) : null}
                        </div>

                        {idx < route.nodes.length - 1 && (
                          <div className="vf-path-arrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--vf-slate-400)', minWidth: '32px' }}>
                            <ArrowRight size={18} strokeWidth={2.5} />
                            <span style={{ fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--vf-slate-400)' }}>Flow</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2-Column Meta & Operational Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Meta details card */}
                <div className="vf-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} className="text-blue-600" />
                    <span>Route Topology Metadata</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Route Code</span>
                      <code>{route.code}</code>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Route Classification</span>
                      <strong>{route.routeType || 'Multi-Tier'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Commercial Model</span>
                      <strong>{route.commercialModel || 'Title Transfer'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Effective Dates</span>
                      <span>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {route.effectiveFrom} {route.effectiveTo ? `to ${route.effectiveTo}` : '(Open-ended)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Permitted Portfolios</span>
                      <span style={{ textAlign: 'right', fontWeight: 600 }}>{route.permittedPortfolios.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Operational governance summary */}
                <div className="vf-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>Operational & Regulatory Governance</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Title & Inventory Ownership</span>
                      <span className="vf-badge vf-badge-neutral">
                        {route.nodes[1]?.operationalRules?.inventoryOwnership || 'Title Transfer at Intermediary'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Primary Invoicing Party</span>
                      <strong>{route.nodes[1]?.operationalRules?.invoicingParty || 'Principal / Distributor'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Statutory Price Ceiling</span>
                      <span className="vf-badge vf-badge-approved">NPPA / DPCO Compliant</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Credit Limit Enforcement</span>
                      <span className="vf-badge vf-badge-active">Automated at Order Booking</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes / Remarks */}
              {route.notes && (
                <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid var(--vf-slate-200)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--vf-slate-700)' }}>
                  <strong>Operational Notes:</strong> {route.notes}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: DISTRIBUTION STEPS */}
          {/* ============================================================== */}
          {activeTab === 'steps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  Configured Distribution Stages ({route.nodes.length} Steps)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>
                  Sequential flow from Principal to Consignee
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {route.nodes.map((node, index) => {
                  const assignedCount = (node.assignedPartners || []).length;
                  return (
                    <div
                      key={node.id || index}
                      className="vf-card"
                      style={{ padding: '16px', borderLeft: `4px solid ${index === 0 ? 'var(--vf-primary)' : index === route.nodes.length - 1 ? 'var(--vf-success)' : 'var(--vf-accent)'}` }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: '#f1f5f9', color: 'var(--vf-slate-700)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            STAGE {node.level || index + 1}
                          </span>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                            {node.label}
                          </h4>
                          <span className="vf-badge vf-badge-neutral">{node.participantType || 'Intermediary'}</span>
                          {node.isRequired && <span className="vf-badge vf-badge-approved" style={{ fontSize: '10px' }}>Mandatory</span>}
                        </div>
                        <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                          {node.pricingPoint}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--vf-slate-600)', marginBottom: '12px' }}>
                        Role: <strong>{node.role}</strong>
                      </div>

                      {/* Operational rules grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', fontSize: '11.5px', marginBottom: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--vf-slate-400)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Inventory Title</span>
                          <strong>{node.operationalRules?.inventoryOwnership || 'Title Transfer'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--vf-slate-400)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Stock Transit</span>
                          <strong>{node.operationalRules?.stockTransferResponsibility || 'Direct Dispatch'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--vf-slate-400)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Invoicing Entity</span>
                          <strong>{node.operationalRules?.invoicingParty || 'Principal'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--vf-slate-400)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Price Tier</span>
                          <strong>{node.operationalRules?.applicablePriceTier || 'Standard PTD'}</strong>
                        </div>
                      </div>

                      {/* Assigned Partners under this step */}
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '6px' }}>
                          Eligible Assigned Partners ({assignedCount})
                        </div>
                        {assignedCount === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--vf-slate-400)', fontStyle: 'italic' }}>
                            {index === 0 ? 'Principal corporate entity operates this step.' : index === route.nodes.length - 1 ? 'Designated hospital / clinical consignees.' : 'No partner explicitly assigned to this stage yet.'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {node.assignedPartners!.map((ap) => (
                              <div
                                key={ap.partnerId}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid var(--vf-slate-200)',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Building2 size={12} className="text-blue-600" />
                                <strong>{ap.partnerName}</strong>
                                <code>{ap.partnerCode}</code>
                                {ap.territoryName && <span style={{ color: 'var(--vf-slate-400)' }}>• {ap.territoryName}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: TERRITORY COVERAGE */}
          {/* ============================================================== */}
          {activeTab === 'territories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                    Permitted Territory Coverage ({assignedTerritories.length} Territories)
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                    Geographic regions where this distribution route topology is authorized for commercial execution.
                  </p>
                </div>
              </div>

              <div className="vf-table-container">
                <table className="vf-table">
                  <thead>
                    <tr>
                      <th>Territory Code</th>
                      <th>Territory Name</th>
                      <th>State / Zone</th>
                      <th>Commercial Lead</th>
                      <th>Active Partners</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedTerritories.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                          No specific territories mapped. Route applies to pan-India catalog.
                        </td>
                      </tr>
                    ) : (
                      assignedTerritories.map((terr) => (
                        <tr key={terr.id}>
                          <td><code>{terr.code}</code></td>
                          <td>
                            <strong>{terr.name}</strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                              <MapPin size={12} className="text-slate-400" />
                              <span>{terr.state || 'National Zone'}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '12px' }}>{terr.lead}</td>
                          <td>
                            <span className="vf-badge vf-badge-active">{terr.activePartnersCount} Partners</span>
                          </td>
                          <td>
                            <span className={`vf-badge ${terr.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-danger'}`}>
                              {terr.status}
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

          {/* ============================================================== */}
          {/* TAB 4: SALES CHANNELS */}
          {/* ============================================================== */}
          {activeTab === 'channels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  Applicable Sales Channels ({assignedChannels.length} Channels)
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                  Commercial sales channels connected to this physical distribution route.
                </p>
              </div>

              <div className="vf-table-container">
                <table className="vf-table">
                  <thead>
                    <tr>
                      <th>Channel Code</th>
                      <th>Channel Name</th>
                      <th>Commercial Nature</th>
                      <th>Default Margin %</th>
                      <th>Margin Mechanism</th>
                      <th>Credit Terms</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedChannels.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                          No dedicated sales channel restriction. Operates across general distribution.
                        </td>
                      </tr>
                    ) : (
                      assignedChannels.map((c) => (
                        <tr key={c.id}>
                          <td><code>{c.code}</code></td>
                          <td><strong>{c.name}</strong></td>
                          <td>
                            <span className="vf-badge vf-badge-type">
                              {c.isReseller ? 'Reseller Intermediary' : 'Direct End-User'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#166534' }}>{c.standardMarginPercent}%</td>
                          <td style={{ fontSize: '12px' }}>{c.marginType}</td>
                          <td style={{ fontSize: '12px' }}>{c.defaultCreditDays} Days</td>
                          <td>
                            <span className={`vf-badge ${c.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-danger'}`}>
                              {c.status}
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

          {/* ============================================================== */}
          {/* TAB 5: COMMERCIAL TERMS */}
          {/* ============================================================== */}
          {activeTab === 'commercial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ background: '#f8fafc', borderLeft: '4px solid var(--vf-accent)', padding: '14px 16px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--vf-slate-900)', marginBottom: '4px' }}>
                  Commercial Terms Integration Rule
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)', lineHeight: '1.5' }}>
                  <strong>Default commercial terms are based on Sales Channel, not Territory.</strong> Partner-specific commercial deviations or volume discounts apply automatically to orders routed through this distribution path.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="vf-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={15} className="text-blue-600" />
                    <span>Channel Baseline Margins</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    {assignedChannels.map((c) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--vf-slate-100)' }}>
                        <span>{c.name}</span>
                        <span>
                          <strong>{c.standardMarginPercent}%</strong> <span style={{ color: 'var(--vf-slate-400)', fontSize: '11px' }}>({c.marginType})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="vf-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>Statutory Ceiling Enforcement</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)', lineHeight: '1.5' }}>
                    All orders booked under <code>{route.code}</code> automatically validate against NPPA / DPCO statutory price ceilings. Any price deviation above the national ceiling triggers a hard commercial block.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 6: ASSIGNED PARTNERS */}
          {/* ============================================================== */}
          {activeTab === 'partners' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                    Assigned Channel Partners ({assignedPartnersList.length})
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                    Commercial partners authorized to participate in this distribution route.
                  </p>
                </div>
              </div>

              <div className="vf-table-container">
                <table className="vf-table">
                  <thead>
                    <tr>
                      <th>Partner Code</th>
                      <th>Partner Name</th>
                      <th>Type</th>
                      <th>KYC Status</th>
                      <th>Credit Limit</th>
                      <th>Contact</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedPartnersList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-400)' }}>
                          No partners currently assigned to this route.
                        </td>
                      </tr>
                    ) : (
                      assignedPartnersList.map((p) => (
                        <tr key={p.id}>
                          <td><code>{p.code}</code></td>
                          <td><strong>{p.name}</strong></td>
                          <td><span className="vf-badge vf-badge-neutral">{p.typeName}</span></td>
                          <td>
                            <span className={`vf-badge ${p.kycStatus === 'Verified' ? 'vf-badge-approved' : 'vf-badge-draft'}`}>
                              {p.kycStatus}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>₹{(p.creditLimit || 0).toLocaleString('en-IN')}</td>
                          <td style={{ fontSize: '12px' }}>
                            <div>{p.authorizedContactPerson}</div>
                            <div style={{ color: 'var(--vf-slate-400)', fontSize: '11px' }}>{p.mobilePhone}</div>
                          </td>
                          <td>
                            <span className={`vf-badge ${p.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-danger'}`}>
                              {p.status}
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

          {/* ============================================================== */}
          {/* TAB 7: HISTORY & AUDIT */}
          {/* ============================================================== */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  Route Governance & Audit Trail
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                  Timestamped audit history of all topology, step, partner, and status modifications.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(route.history || []).length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--vf-slate-400)', background: '#f8fafc', borderRadius: '6px' }}>
                    No audit records logged yet.
                  </div>
                ) : (
                  (route.history || []).map((h) => (
                    <div
                      key={h.id}
                      style={{
                        padding: '12px 16px',
                        background: '#ffffff',
                        border: '1px solid var(--vf-slate-200)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '50%', color: 'var(--vf-slate-600)' }}>
                          <Clock size={14} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="vf-badge vf-badge-neutral">{h.action}</span>
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--vf-slate-800)' }}>
                              {h.description}
                            </span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>
                            By {h.changedBy}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', whiteSpace: 'nowrap' }}>
                        {h.timestamp}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Drawer Sticky Footer */}
        <div className="vf-wizard-footer" style={{ padding: '14px 24px', background: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              type="button"
              className="vf-btn vf-btn-secondary"
              onClick={() => onToggleStatus(route.id)}
            >
              {route.status === 'Active' ? 'Deactivate Route' : 'Activate Route'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              onClick={() => {
                onClose();
                onEdit(route);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Edit3 size={14} />
              <span>Edit Route Configuration</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
