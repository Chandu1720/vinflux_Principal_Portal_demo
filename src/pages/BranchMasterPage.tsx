import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Branch } from '../types/branch';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Eye, 
  Warehouse as WarehouseIcon
} from 'lucide-react';

export const BranchMasterPage: React.FC = () => {
  const { branches, warehouses, addBranch, updateBranch, toggleBranchStatus, showToast } = useApp();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Branch>>({
    name: '',
    code: '',
    address: '',
    state: 'Maharashtra',
    city: '',
    pinCode: '',
    manager: '',
    contactNumber: '',
    email: '',
    status: 'Active'
  });

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.state.toLowerCase().includes(q) ||
        b.manager.toLowerCase().includes(q);

      const matchState = filterState === 'ALL' || b.state === filterState;
      const matchStatus = filterStatus === 'ALL' || b.status === filterStatus;

      return matchSearch && matchState && matchStatus;
    });
  }, [branches, searchQuery, filterState, filterStatus]);

  // Paginated
  const paginatedBranches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, currentPage]);

  const totalPages = Math.ceil(filteredBranches.length / pageSize) || 1;

  // Unique states
  const uniqueStates = useMemo(() => {
    return Array.from(new Set(branches.map((b) => b.state)));
  }, [branches]);

  // Metrics
  const metrics = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.status === 'Active').length;
    const statesCount = uniqueStates.length;
    const linkedWarehouses = warehouses.length;
    return { total, active, statesCount, linkedWarehouses };
  }, [branches, uniqueStates, warehouses]);

  // Open Create Modal
  const handleOpenCreate = () => {
    const nextCode = `BR-REG-0${branches.length + 1}`;
    setEditingBranch(null);
    setFormData({
      name: '',
      code: nextCode,
      address: '',
      state: 'Maharashtra',
      city: '',
      pinCode: '',
      manager: '',
      contactNumber: '',
      email: '',
      status: 'Active'
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({ ...branch });
    setIsFormModalOpen(true);
  };

  // Open View Modal
  const handleOpenView = (branch: Branch) => {
    setViewingBranch(branch);
    setIsViewModalOpen(true);
  };

  // Save Branch
  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      showToast('Please enter Branch Name.', 'danger');
      return;
    }
    if (!formData.code?.trim()) {
      showToast('Please enter Branch Code.', 'danger');
      return;
    }
    if (!formData.city?.trim() || !formData.state?.trim()) {
      showToast('City and State are required.', 'danger');
      return;
    }

    if (editingBranch) {
      const res = updateBranch(editingBranch.id, {
        ...formData,
        code: formData.code!.trim().toUpperCase()
      });
      if (res.success) setIsFormModalOpen(false);
    } else {
      const newBranch: Branch = {
        id: `br-${Date.now()}`,
        name: formData.name!.trim(),
        code: formData.code!.trim().toUpperCase(),
        address: formData.address || '',
        state: formData.state || 'Maharashtra',
        city: formData.city || '',
        pinCode: formData.pinCode || '',
        manager: formData.manager || '',
        contactNumber: formData.contactNumber || '',
        email: formData.email || '',
        status: (formData.status as 'Active' | 'Inactive') || 'Active',
        activeWarehousesCount: 0,
        createdAt: new Date().toISOString().substring(0, 10),
        updatedAt: new Date().toISOString().substring(0, 10)
      };

      const res = addBranch(newBranch);
      if (res.success) setIsFormModalOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', background: '#ffffff', padding: '20px 24px', border: '1px solid var(--vf-slate-200)', borderRadius: 'var(--vf-radius-md)', boxShadow: 'var(--vf-shadow-sm)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={22} className="text-blue-600" />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--vf-slate-900)' }}>
              Branch Master
            </h1>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--vf-slate-500)' }}>
            Manage regional corporate branches, operational centers, state coverage, and supply jurisdiction.
          </p>
        </div>

        <button
          type="button"
          className="vf-btn vf-btn-primary"
          onClick={handleOpenCreate}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>+ Create New Branch</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Total Registered Branches
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vf-slate-800)', margin: '4px 0' }}>
            {metrics.total}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Corporate & Regional Entities</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Active Operating Branches
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vf-success)', margin: '4px 0' }}>
            {metrics.active}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Available for new warehouses</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            States & Territories Covered
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>
            {metrics.statesCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Across India MedTech corridors</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Linked Warehouses
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed', margin: '4px 0' }}>
            {metrics.linkedWarehouses}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Associated logistics stockyards</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="vf-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--vf-slate-400)' }} />
            <input
              type="text"
              className="vf-form-control"
              style={{ paddingLeft: '34px', height: '36px', fontSize: '13px' }}
              placeholder="Search branch name, code, manager, city, state..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--vf-slate-500)', fontWeight: 600 }}>
              <Filter size={14} />
              <span>Filter:</span>
            </div>

            <select
              className="vf-form-control"
              style={{ width: '160px', height: '32px', fontSize: '12px' }}
              value={filterState}
              onChange={(e) => { setFilterState(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All States</option>
              {uniqueStates.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            <select
              className="vf-form-control"
              style={{ width: '140px', height: '32px', fontSize: '12px' }}
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            {(searchQuery || filterState !== 'ALL' || filterStatus !== 'ALL') && (
              <button
                type="button"
                className="vf-btn vf-btn-secondary vf-btn-xs"
                onClick={() => {
                  setSearchQuery('');
                  setFilterState('ALL');
                  setFilterStatus('ALL');
                  setCurrentPage(1);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="vf-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="vf-table" style={{ width: '100%', margin: 0 }}>
          <thead>
            <tr>
              <th>Branch Code & Name</th>
              <th>Location & City</th>
              <th>State & PIN</th>
              <th>Branch Manager & Contacts</th>
              <th style={{ textAlign: 'center' }}>Linked Warehouses</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBranches.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--vf-slate-400)' }}>
                  No branches found matching your filter criteria.
                </td>
              </tr>
            ) : (
              paginatedBranches.map((branch) => {
                const linkedWhs = warehouses.filter((w) => w.branchId === branch.id);
                return (
                  <tr key={branch.id} style={{ background: branch.status === 'Inactive' ? '#fcfcfc' : undefined }}>
                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: 'var(--vf-slate-900)' }}>{branch.name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                          Code: <code>{branch.code}</code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{branch.city}</div>
                        <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={branch.address}>
                          {branch.address}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                          {branch.state}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>PIN: {branch.pinCode}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <strong>{branch.manager || 'Unassigned'}</strong>
                        <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>{branch.email}</div>
                        <div style={{ color: 'var(--vf-slate-400)', fontSize: '10.5px' }}>{branch.contactNumber}</div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span 
                        className="vf-badge" 
                        style={{ 
                          background: linkedWhs.length > 0 ? '#f0fdf4' : '#f8fafc',
                          color: linkedWhs.length > 0 ? '#15803d' : 'var(--vf-slate-500)',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleOpenView(branch)}
                        title="Click to view linked warehouses"
                      >
                        <WarehouseIcon size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {linkedWhs.length} Warehouse{linkedWhs.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`vf-badge ${branch.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>
                        {branch.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleOpenView(branch)}
                          title="View Branch Details"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleOpenEdit(branch)}
                          title="Edit Branch"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          style={{
                            color: branch.status === 'Active' ? 'var(--vf-warning)' : 'var(--vf-success)'
                          }}
                          onClick={() => toggleBranchStatus(branch.id)}
                          title={branch.status === 'Active' ? 'Deactivate Branch' : 'Activate Branch'}
                        >
                          {branch.status === 'Active' ? 'Deactivate' : 'Activate'}
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
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredBranches.length} branches)
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

      {/* Create / Edit Branch Side Drawer */}
      {isFormModalOpen && (
        <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsFormModalOpen(false); }}>
          <div className="vf-drawer vf-drawer-md">
            <div className="vf-drawer-header">
              <div className="vf-drawer-title-wrap">
                <h3 className="vf-drawer-title">
                  <Building2 size={20} className="text-blue-600" />
                  <span>{editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Create New Company Branch'}</span>
                </h3>
                <p className="vf-drawer-subtitle">
                  {editingBranch ? 'Update branch address, assigned manager and contact details' : 'Configure a new company branch location and code'}
                </p>
              </div>
              <button 
                type="button" 
                className="vf-drawer-close"
                onClick={() => setIsFormModalOpen(false)} 
                title="Close Drawer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveBranch} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">Branch Name *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. West Zone HQ — Mumbai Central Branch"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">Branch Code * (Unique)</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. BR-MUM-01"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Office Address *</label>
                  <textarea
                    rows={2}
                    className="vf-form-control"
                    placeholder="Street address, building, industrial area..."
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">State *</label>
                    <select
                      className="vf-form-control"
                      value={formData.state || 'Maharashtra'}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    >
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Telangana">Telangana</option>
                      <option value="Andhra Pradesh">Andhra Pradesh</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="West Bengal">West Bengal</option>
                      <option value="Kerala">Kerala</option>
                    </select>
                  </div>
                  <div>
                    <label className="vf-form-label">City *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. Mumbai"
                      value={formData.city || ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">PIN Code *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. 400093"
                      value={formData.pinCode || ''}
                      onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px' }}>
                    Branch Management & Communications
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="vf-form-label">Branch Manager</label>
                      <input
                        type="text"
                        className="vf-form-control"
                        placeholder="e.g. Vikramaditya Kulkarni"
                        value={formData.manager || ''}
                        onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="vf-form-label">Contact Number</label>
                      <input
                        type="tel"
                        className="vf-form-control"
                        placeholder="e.g. +91 22 6128 4400"
                        value={formData.contactNumber || ''}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="vf-form-label">Official Email</label>
                      <input
                        type="email"
                        className="vf-form-control"
                        placeholder="e.g. mumbai.branch@bioradmedisys.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Operational Status</label>
                  <select
                    className="vf-form-control"
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="Active">Active (Eligible for warehouse creation and partner supply)</option>
                    <option value="Inactive">Inactive (Existing assignments preserved, new assignments blocked)</option>
                  </select>
                </div>
              </div>

              <div className="vf-drawer-footer">
                <button
                  type="button"
                  className="vf-btn vf-btn-secondary"
                  onClick={() => setIsFormModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="vf-btn vf-btn-primary"
                  style={{ fontWeight: 700 }}
                >
                  {editingBranch ? '✓ Save Changes' : '✓ Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Branch Details Side Drawer */}
      {isViewModalOpen && viewingBranch && (
        <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsViewModalOpen(false); }}>
          <div className="vf-drawer vf-drawer-lg">
            <div className="vf-drawer-header">
              <div className="vf-drawer-title-wrap">
                <h3 className="vf-drawer-title">
                  <Building2 size={20} className="text-blue-600" />
                  <span>{viewingBranch.name}</span>
                </h3>
                <p className="vf-drawer-subtitle">
                  Branch Code: <code>{viewingBranch.code}</code> · Status: <span className={`vf-badge ${viewingBranch.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>{viewingBranch.status}</span>
                </p>
              </div>
              <button 
                type="button" 
                className="vf-drawer-close"
                onClick={() => setIsViewModalOpen(false)} 
                title="Close Drawer"
              >
                &times;
              </button>
            </div>

            <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Branch Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>City & State</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{viewingBranch.city}, {viewingBranch.state}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>PIN: {viewingBranch.pinCode}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Branch Manager</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{viewingBranch.manager || 'Unassigned'}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>{viewingBranch.contactNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Official Email</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{viewingBranch.email}</div>
                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>Created: {viewingBranch.createdAt}</div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Full Address</span>
                <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-800)', marginTop: '4px' }}>{viewingBranch.address}</div>
              </div>

              {/* Linked Warehouses Section */}
              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <WarehouseIcon size={16} className="text-blue-600" />
                    <span>Linked Warehouses & Stockyards ({warehouses.filter((w) => w.branchId === viewingBranch.id).length})</span>
                  </div>
                </div>

                <div style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '6px', overflow: 'hidden' }}>
                  <table className="vf-table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Warehouse Code & Name</th>
                        <th>Location</th>
                        <th>Manager</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehouses.filter((w) => w.branchId === viewingBranch.id).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--vf-slate-400)' }}>
                            No warehouses currently linked to this branch.
                          </td>
                        </tr>
                      ) : (
                        warehouses
                          .filter((w) => w.branchId === viewingBranch.id)
                          .map((wh) => (
                            <tr key={wh.id}>
                              <td>
                                <strong>{wh.name}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Code: <code>{wh.code}</code></div>
                              </td>
                              <td style={{ fontSize: '12px' }}>{wh.city}, {wh.state}</td>
                              <td style={{ fontSize: '12px' }}>{wh.manager} ({wh.contactNumber})</td>
                              <td>
                                <span className={`vf-badge ${wh.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>
                                  {wh.status}
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div className="vf-drawer-footer">
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={() => setIsViewModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenEdit(viewingBranch);
                }}
              >
                Edit Branch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
