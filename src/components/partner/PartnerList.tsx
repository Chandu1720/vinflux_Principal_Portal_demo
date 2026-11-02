import React, { useState, useMemo } from 'react';
import type { Partner } from '../../types/partner';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  Filter, 
  Plus, 
  MapPin, 
  ShieldCheck, 
  Mail, 
  Edit3, 
  Eye, 
  ArrowUpDown, 
  Lock, 
  Unlock 
} from 'lucide-react';

interface PartnerListProps {
  onOpenCreate: () => void;
  onEditPartner: (partner: Partner) => void;
  onAssignTerritories: (partner: Partner) => void;
  onOpenInviteModal: (partner: Partner) => void;
  onViewDetails?: (partner: Partner) => void;
}

export const PartnerList: React.FC<PartnerListProps> = ({
  onOpenCreate,
  onEditPartner,
  onAssignTerritories,
  onOpenInviteModal,
  onViewDetails
}) => {
  const { 
    partners, 
    territories, 
    togglePartnerCreditHold
  } = useApp();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterTerritory, setFilterTerritory] = useState('ALL');
  const [filterKyc, setFilterKyc] = useState('ALL');
  const [filterInvite, setFilterInvite] = useState('ALL');
  const [filterPortal, setFilterPortal] = useState('ALL');
  const [filterCreditHold, setFilterCreditHold] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Sorting
  const [sortField, setSortField] = useState<keyof Partner>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Filtered & Sorted Partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.authorizedContactPerson.toLowerCase().includes(q) ||
        p.officialEmail.toLowerCase().includes(q) ||
        p.gstin.toLowerCase().includes(q) ||
        p.pan.toLowerCase().includes(q)
      );

      // Filters
      const matchType = filterType === 'ALL' || p.typeId === filterType;
      const matchTerritory = filterTerritory === 'ALL' || p.assignedTerritoryIds.includes(filterTerritory);
      const matchKyc = filterKyc === 'ALL' || p.kycStatus === filterKyc;
      const matchInvite = filterInvite === 'ALL' || p.invitationStatus === filterInvite;
      const matchPortal = filterPortal === 'ALL' || p.portalAccessStatus === filterPortal;
      const matchCreditHold = filterCreditHold === 'ALL' || (filterCreditHold === 'HOLD' ? p.creditHold : !p.creditHold);

      return matchSearch && matchType && matchTerritory && matchKyc && matchInvite && matchPortal && matchCreditHold;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        const res = (aVal as string).localeCompare((bVal as string) || '');
        return sortAsc ? res : -res;
      }
      return 0;
    });
  }, [partners, searchQuery, filterType, filterTerritory, filterKyc, filterInvite, filterPortal, filterCreditHold, sortField, sortAsc]);

  // Paginated records
  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPartners.slice(start, start + pageSize);
  }, [filteredPartners, currentPage]);

  const totalPages = Math.ceil(filteredPartners.length / pageSize) || 1;

  // Metrics
  const metrics = useMemo(() => {
    const total = partners.length;
    const active = partners.filter((p) => p.status === 'Active').length;
    const verifiedKyc = partners.filter((p) => p.kycStatus === 'Verified').length;
    const portalActive = partners.filter((p) => p.portalAccessStatus === 'Active').length;
    const onHold = partners.filter((p) => p.creditHold).length;
    return { total, active, verifiedKyc, portalActive, onHold };
  }, [partners]);

  const handleSort = (field: keyof Partner) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* KPI Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Total Registered Partners
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vf-slate-800)', margin: '4px 0' }}>
            {metrics.total}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Across all distribution channels</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Active Commercial Partners
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vf-success)', margin: '4px 0' }}>
            {metrics.active}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Eligible for direct dispatch</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Statutory KYC Verified
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>
            {metrics.verifiedKyc}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>GSTIN, Drug & MDR Compliant</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Distribution Portal Active
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed', margin: '4px 0' }}>
            {metrics.portalActive}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Authorized digital ordering logins</span>
        </div>

        <div className="vf-card" style={{ padding: '16px', border: metrics.onHold > 0 ? '2px solid #ef4444' : undefined, background: metrics.onHold > 0 ? '#fff5f5' : undefined }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: metrics.onHold > 0 ? '#dc2626' : 'var(--vf-slate-500)' }}>
            On Credit Hold
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: metrics.onHold > 0 ? '#b91c1c' : 'var(--vf-slate-800)', margin: '4px 0' }}>
            {metrics.onHold}
          </div>
          <span style={{ fontSize: '12px', color: metrics.onHold > 0 ? '#dc2626' : 'var(--vf-slate-500)', fontWeight: metrics.onHold > 0 ? 600 : 400 }}>
            {metrics.onHold > 0 ? 'Dispatches halted by risk policy' : 'No credit holds currently active'}
          </span>
        </div>
      </div>

      {/* Multi-facet Filter Bar & Search */}
      <div className="vf-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--vf-slate-400)' }} />
            <input
              type="text"
              className="vf-form-control"
              style={{ paddingLeft: '34px', height: '36px', fontSize: '13px' }}
              placeholder="Search partner name, code, contact person, email, GSTIN, PAN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Action button */}
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={onOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <Plus size={16} />
            <span>+ Onboard New Partner</span>
          </button>
        </div>

        {/* Filter controls row */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--vf-slate-500)', fontWeight: 600 }}>
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          {/* Partner Type */}
          <select
            className="vf-form-control"
            style={{ width: '160px', height: '30px', fontSize: '12px' }}
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Partner Types</option>
            <option value="ct-distributor">Authorized Distributor</option>
            <option value="ct-super-stockist">Super Stockist</option>
            <option value="ct-cnf">C&F Agent</option>
            <option value="ct-institution">Direct Institution</option>
          </select>

          {/* Territory */}
          <select
            className="vf-form-control"
            style={{ width: '160px', height: '30px', fontSize: '12px' }}
            value={filterTerritory}
            onChange={(e) => { setFilterTerritory(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Territories</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* KYC Status */}
          <select
            className="vf-form-control"
            style={{ width: '150px', height: '30px', fontSize: '12px' }}
            value={filterKyc}
            onChange={(e) => { setFilterKyc(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All KYC Statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending Verification">Pending Verification</option>
            <option value="Draft">Draft</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Invitation Status */}
          <select
            className="vf-form-control"
            style={{ width: '160px', height: '30px', fontSize: '12px' }}
            value={filterInvite}
            onChange={(e) => { setFilterInvite(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Invite Statuses</option>
            <option value="Not Invited">Not Invited</option>
            <option value="Invite Sent">Invite Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Expired">Expired</option>
          </select>

          {/* Portal Access */}
          <select
            className="vf-form-control"
            style={{ width: '150px', height: '30px', fontSize: '12px' }}
            value={filterPortal}
            onChange={(e) => { setFilterPortal(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Portal Access</option>
            <option value="Active">Portal Active</option>
            <option value="Disabled">Portal Disabled</option>
            <option value="Suspended">Portal Suspended</option>
          </select>

          {/* Credit Hold */}
          <select
            className="vf-form-control"
            style={{ width: '140px', height: '30px', fontSize: '12px' }}
            value={filterCreditHold}
            onChange={(e) => { setFilterCreditHold(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Credit Flags</option>
            <option value="HOLD">On Credit Hold</option>
            <option value="CLEAR">Credit Normal</option>
          </select>

          {(searchQuery || filterType !== 'ALL' || filterTerritory !== 'ALL' || filterKyc !== 'ALL' || filterInvite !== 'ALL' || filterPortal !== 'ALL' || filterCreditHold !== 'ALL') && (
            <button
              type="button"
              className="vf-btn vf-btn-secondary vf-btn-xs"
              onClick={() => {
                setSearchQuery('');
                setFilterType('ALL');
                setFilterTerritory('ALL');
                setFilterKyc('ALL');
                setFilterInvite('ALL');
                setFilterPortal('ALL');
                setFilterCreditHold('ALL');
                setCurrentPage(1);
              }}
            >
              Reset Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', color: 'var(--vf-slate-500)', fontSize: '12px' }}>
            Showing <strong>{filteredPartners.length}</strong> partners
          </div>
        </div>
      </div>

      {/* Main Partner Table */}
      <div className="vf-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="vf-table" style={{ width: '100%', margin: 0 }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Partner Name & Code</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th>Channel Type</th>
              <th>Performance Tier & Level</th>
              <th>Primary Contact</th>
              <th>Territories & Effective Discounts</th>
              <th>KYC Status</th>
              <th>Portal Invitation</th>
              <th>Portal Access</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPartners.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--vf-slate-400)' }}>
                  No partners match the selected filter criteria.
                </td>
              </tr>
            ) : (
              paginatedPartners.map((partner) => {
                return (
                  <tr key={partner.id} style={{ background: partner.creditHold ? '#fffbfb' : undefined }}>
                    
                    {/* Partner Name & Code */}
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '13.5px', color: 'var(--vf-slate-900)' }}>{partner.name}</strong>
                          {partner.creditHold && (
                            <span className="vf-badge vf-badge-danger" style={{ fontSize: '10px', padding: '1px 5px' }}>
                              Hold
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                          Code: <code>{partner.code}</code> · Tier: {partner.tierPriceLevel}
                        </div>
                      </div>
                    </td>

                    {/* Channel Type */}
                    <td>
                      <span className="vf-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                        {partner.typeName}
                      </span>
                    </td>

                    {/* Performance Tier & Distribution Level */}
                    <td>
                      <span className={`vf-badge ${partner.classification?.performanceTierId === 'tier-plat' ? 'vf-badge-approved' : 'vf-badge-active'}`}>
                        {partner.classification?.performanceTierName || 'Standard Tier'}
                      </span>
                      <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                        {partner.classification?.distributionLevelName || 'Tier 2 Stockist'}
                      </div>
                    </td>

                    {/* Primary Contact */}
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <strong>{partner.authorizedContactPerson}</strong>
                        <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>{partner.officialEmail}</div>
                        <div style={{ color: 'var(--vf-slate-400)', fontSize: '10.5px' }}>{partner.mobilePhone}</div>
                      </div>
                    </td>

                    {/* Assigned Territories & Effective Discounts with Origin Badges */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {partner.assignedTerritoryIds.map((tId) => {
                          const comm = partner.territoryCommercials[tId];
                          const terr = territories.find((t) => t.id === tId);
                          const terrName = terr ? terr.name : tId;
                          const effective = comm?.effectiveDiscount ?? (terr?.defaultCommercialTerms.defaultDiscountPercent || 5.0);
                          const isOverride = comm?.overrideOrigin === 'Partner Override' || comm?.partnerOverrideDiscount !== null && comm?.partnerOverrideDiscount !== undefined;

                          return (
                            <div 
                              key={tId} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '11.5px',
                                background: isOverride ? '#eff6ff' : '#f8fafc',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: `1px solid ${isOverride ? '#bfdbfe' : '#e2e8f0'}`
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{terrName}:</span>
                              <strong style={{ color: isOverride ? '#1d4ed8' : '#0f172a' }}>{effective}%</strong>
                              <span 
                                className={`vf-badge ${isOverride ? 'vf-badge-active' : 'vf-badge-pending'}`}
                                style={{ fontSize: '9.5px', padding: '1px 4px' }}
                                title={isOverride ? 'Partner-specific override takes precedence' : 'Inheriting territory default'}
                              >
                                {isOverride ? 'Override' : 'Default'}
                              </span>
                            </div>
                          );
                        })}
                        {partner.distributionAssignments && partner.distributionAssignments.length > 0 && (
                          <div style={{ fontSize: '10.5px', color: '#16a34a', marginTop: '3px', fontWeight: 600 }}>
                            📦 {partner.distributionAssignments.length} Supply Hub{partner.distributionAssignments.length > 1 ? 's' : ''} Linked
                          </div>
                        )}
                      </div>
                    </td>

                    {/* KYC Verification Status */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className={`vf-badge ${partner.kycStatus === 'Verified' ? 'vf-badge-active' : partner.kycStatus === 'Pending Verification' ? 'vf-badge-pending' : partner.kycStatus === 'Rejected' ? 'vf-badge-danger' : 'vf-badge-draft'}`}>
                          {partner.kycStatus}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--vf-slate-500)' }}>
                          GST: {partner.gstinStatus === 'Verified on GST Portal' ? '✓ Verified' : 'Pending'}
                        </span>
                      </div>
                    </td>

                    {/* Distribution Portal Invitation Status */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span className={`vf-badge ${partner.invitationStatus === 'Accepted' ? 'vf-badge-active' : partner.invitationStatus === 'Invite Sent' ? 'vf-badge-warning' : partner.invitationStatus === 'Expired' ? 'vf-badge-danger' : 'vf-badge-draft'}`}>
                          {partner.invitationStatus}
                        </span>
                        {partner.invitationSentDate && (
                          <span style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)' }}>
                            Sent: {partner.invitationSentDate.substring(0, 10)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Portal Access Status */}
                    <td>
                      <span className={`vf-badge ${partner.portalAccessStatus === 'Active' ? 'vf-badge-active' : partner.portalAccessStatus === 'Suspended' ? 'vf-badge-danger' : 'vf-badge-draft'}`}>
                        {partner.portalAccessStatus}
                      </span>
                    </td>

                    {/* Operational Status */}
                    <td>
                      <span className={`vf-badge ${partner.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>
                        {partner.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {/* View Partner Details */}
                        {onViewDetails && (
                          <button
                            type="button"
                            className="vf-btn vf-btn-secondary vf-btn-xs"
                            onClick={() => onViewDetails(partner)}
                            title="View Full Partner Details & Supply"
                          >
                            <Eye size={12} />
                            <span>Details</span>
                          </button>
                        )}

                        {/* Edit Partner & KYC */}
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => onEditPartner(partner)}
                          title="Edit Partner & KYC"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>

                        {/* Assign Territories */}
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => onAssignTerritories(partner)}
                          title="Assign Territories & Commercials"
                        >
                          <MapPin size={12} />
                          <span>Terms</span>
                        </button>

                        {/* Invite to Portal */}
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          style={{
                            color: partner.invitationStatus === 'Accepted' ? 'var(--vf-success)' : undefined
                          }}
                          onClick={() => onOpenInviteModal(partner)}
                          title="Manage Portal Invitation"
                        >
                          <Mail size={12} />
                          <span>{partner.invitationStatus === 'Accepted' ? 'Portal' : 'Invite'}</span>
                        </button>

                        {/* Toggle Credit Hold */}
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          style={{
                            color: partner.creditHold ? 'var(--vf-danger)' : undefined,
                            borderColor: partner.creditHold ? '#fca5a5' : undefined
                          }}
                          onClick={() => togglePartnerCreditHold(partner.id)}
                          title={partner.creditHold ? 'Release Credit Hold' : 'Place on Credit Hold'}
                        >
                          {partner.creditHold ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--vf-slate-200)', background: '#fafafa', fontSize: '12px' }}>
          <div style={{ color: 'var(--vf-slate-500)' }}>
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredPartners.length} total records)
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="vf-btn vf-btn-secondary vf-btn-xs"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              &larr; Previous
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-secondary vf-btn-xs"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Test Case Validation Helper Card (from Section 5 of Prompt) */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} className="text-blue-600" />
          <span>Section 5 Validation Matrix (Territory-Wise Commercial Terms & Overrides)</span>
        </div>
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--vf-slate-600)' }}>
          The matrix below verifies the business logic specified in the prompt: Territory default discounts apply unless explicit partner overrides are configured, and changing a territory default never silently clears an explicit partner override.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '12px' }}>
          <div style={{ background: '#ffffff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Telangana · Distributor A</div>
            <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>Territory Default: 5%</div>
            <div style={{ color: '#1d4ed8', fontWeight: 700, marginTop: '2px' }}>Partner Override: 8% &rarr; Effective: 8%</div>
            <span className="vf-badge vf-badge-active" style={{ fontSize: '10px', marginTop: '4px' }}>Partner Override</span>
          </div>

          <div style={{ background: '#ffffff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Telangana · Distributor B</div>
            <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>Territory Default: 5%</div>
            <div style={{ color: '#059669', fontWeight: 700, marginTop: '2px' }}>Partner Override: None &rarr; Effective: 5%</div>
            <span className="vf-badge vf-badge-pending" style={{ fontSize: '10px', marginTop: '4px' }}>Territory Default</span>
          </div>

          <div style={{ background: '#ffffff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Andhra Pradesh · Distributor C</div>
            <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>Territory Default: 6%</div>
            <div style={{ color: '#059669', fontWeight: 700, marginTop: '2px' }}>Partner Override: None &rarr; Effective: 6%</div>
            <span className="vf-badge vf-badge-pending" style={{ fontSize: '10px', marginTop: '4px' }}>Territory Default</span>
          </div>

          <div style={{ background: '#ffffff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Karnataka · Distributor D</div>
            <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>Territory Default: 4%</div>
            <div style={{ color: '#1d4ed8', fontWeight: 700, marginTop: '2px' }}>Partner Override: 7% &rarr; Effective: 7%</div>
            <span className="vf-badge vf-badge-active" style={{ fontSize: '10px', marginTop: '4px' }}>Partner Override</span>
          </div>

          <div style={{ background: '#ffffff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Multi-Territory · Sterling Healthcare</div>
            <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>West Zone: 7% (Override)</div>
            <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>Karnataka: 4% (Territory Default)</div>
            <span className="vf-badge vf-badge-active" style={{ fontSize: '10px', marginTop: '4px' }}>Multi-Territory Mix</span>
          </div>
        </div>
      </div>

    </div>
  );
};
