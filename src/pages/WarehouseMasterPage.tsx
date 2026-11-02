import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Warehouse } from '../types/warehouse';
import { 
  Warehouse as WarehouseIcon, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Eye, 
  ThermometerSnowflake 
} from 'lucide-react';

export const WarehouseMasterPage: React.FC = () => {
  const { warehouses, branches, addWarehouse, updateWarehouse, toggleWarehouseStatus, showToast } = useApp();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingWarehouse, setViewingWarehouse] = useState<Warehouse | null>(null);

  // Active branches (only active branches selectable when creating new warehouse)
  const activeBranches = useMemo(() => {
    return branches.filter((b) => b.status === 'Active');
  }, [branches]);

  // Form state
  const [formData, setFormData] = useState<Partial<Warehouse>>({
    name: '',
    code: '',
    branchId: '',
    address: '',
    state: 'Maharashtra',
    city: '',
    pinCode: '',
    manager: '',
    contactNumber: '',
    email: '',
    status: 'Active',
    storageCapacity: '25,000 sq ft',
    temperatureControlled: false
  });

  // Filtered warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        w.city.toLowerCase().includes(q) ||
        w.state.toLowerCase().includes(q) ||
        w.manager.toLowerCase().includes(q) ||
        (w.branchName && w.branchName.toLowerCase().includes(q));

      const matchBranch = filterBranchId === 'ALL' || w.branchId === filterBranchId;
      const matchState = filterState === 'ALL' || w.state === filterState;
      const matchStatus = filterStatus === 'ALL' || w.status === filterStatus;

      return matchSearch && matchBranch && matchState && matchStatus;
    });
  }, [warehouses, searchQuery, filterBranchId, filterState, filterStatus]);

  // Paginated
  const paginatedWarehouses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWarehouses.slice(start, start + pageSize);
  }, [filteredWarehouses, currentPage]);

  const totalPages = Math.ceil(filteredWarehouses.length / pageSize) || 1;

  // Unique states
  const uniqueStates = useMemo(() => {
    return Array.from(new Set(warehouses.map((w) => w.state)));
  }, [warehouses]);

  // Metrics
  const metrics = useMemo(() => {
    const total = warehouses.length;
    const active = warehouses.filter((w) => w.status === 'Active').length;
    const coldChain = warehouses.filter((w) => w.temperatureControlled).length;
    const branchesUsed = new Set(warehouses.map((w) => w.branchId)).size;
    return { total, active, coldChain, branchesUsed };
  }, [warehouses]);

  // Open Create
  const handleOpenCreate = () => {
    if (activeBranches.length === 0) {
      showToast('No active branches available. Please create or activate a branch first.', 'danger');
      return;
    }

    const defaultBranch = activeBranches[0];
    const nextCode = `WH-REG-0${warehouses.length + 1}`;
    setEditingWarehouse(null);
    setFormData({
      name: '',
      code: nextCode,
      branchId: defaultBranch.id,
      address: '',
      state: defaultBranch.state,
      city: defaultBranch.city,
      pinCode: '',
      manager: '',
      contactNumber: '',
      email: '',
      status: 'Active',
      storageCapacity: '20,000 sq ft',
      temperatureControlled: false
    });
    setIsFormModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({ ...wh });
    setIsFormModalOpen(true);
  };

  // Open View
  const handleOpenView = (wh: Warehouse) => {
    setViewingWarehouse(wh);
    setIsViewModalOpen(true);
  };

  // When branch is selected in create/edit modal
  const handleBranchSelect = (branchId: string) => {
    const selectedBr = branches.find((b) => b.id === branchId);
    setFormData((prev) => ({
      ...prev,
      branchId,
      state: selectedBr ? selectedBr.state : prev.state,
      city: selectedBr ? selectedBr.city : prev.city
    }));
  };

  // Save Warehouse
  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      showToast('Please enter Warehouse Name.', 'danger');
      return;
    }
    if (!formData.code?.trim()) {
      showToast('Please enter Warehouse Code.', 'danger');
      return;
    }
    if (!formData.branchId) {
      showToast('Please select an associated Branch.', 'danger');
      return;
    }

    if (editingWarehouse) {
      const res = updateWarehouse(editingWarehouse.id, {
        ...formData,
        code: formData.code!.trim().toUpperCase()
      });
      if (res.success) setIsFormModalOpen(false);
    } else {
      const newWh: Warehouse = {
        id: `wh-${Date.now()}`,
        name: formData.name!.trim(),
        code: formData.code!.trim().toUpperCase(),
        branchId: formData.branchId,
        address: formData.address || '',
        state: formData.state || 'Maharashtra',
        city: formData.city || '',
        pinCode: formData.pinCode || '',
        manager: formData.manager || '',
        contactNumber: formData.contactNumber || '',
        email: formData.email || '',
        status: (formData.status as 'Active' | 'Inactive') || 'Active',
        storageCapacity: formData.storageCapacity || '20,000 sq ft',
        temperatureControlled: Boolean(formData.temperatureControlled),
        createdAt: new Date().toISOString().substring(0, 10),
        updatedAt: new Date().toISOString().substring(0, 10)
      };

      const res = addWarehouse(newWh);
      if (res.success) setIsFormModalOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', background: '#ffffff', padding: '20px 24px', border: '1px solid var(--vf-slate-200)', borderRadius: 'var(--vf-radius-md)', boxShadow: 'var(--vf-shadow-sm)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WarehouseIcon size={22} className="text-blue-600" />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--vf-slate-900)' }}>
              Warehouse Master
            </h1>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--vf-slate-500)' }}>
            Manage central depots, regional distribution centers, and cold-chain vaults linked to company branches.
          </p>
        </div>

        <button
          type="button"
          className="vf-btn vf-btn-primary"
          onClick={handleOpenCreate}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>+ Create New Warehouse</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Total Registered Warehouses
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vf-slate-800)', margin: '4px 0' }}>
            {metrics.total}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Logistics hubs & depots</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Active Supply Warehouses
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vf-success)', margin: '4px 0' }}>
            {metrics.active}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Available for partner dispatches</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Cold Chain & Vault Depots
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThermometerSnowflake size={22} className="text-sky-600" />
            <span>{metrics.coldChain}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>2°C - 8°C temperature managed</span>
        </div>

        <div className="vf-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)' }}>
            Branches with Depots
          </span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed', margin: '4px 0' }}>
            {metrics.branchesUsed}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Of {branches.length} corporate branches</span>
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
              placeholder="Search warehouse name, code, manager, city, branch..."
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
              style={{ width: '180px', height: '32px', fontSize: '12px' }}
              value={filterBranchId}
              onChange={(e) => { setFilterBranchId(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              className="vf-form-control"
              style={{ width: '150px', height: '32px', fontSize: '12px' }}
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

            {(searchQuery || filterBranchId !== 'ALL' || filterState !== 'ALL' || filterStatus !== 'ALL') && (
              <button
                type="button"
                className="vf-btn vf-btn-secondary vf-btn-xs"
                onClick={() => {
                  setSearchQuery('');
                  setFilterBranchId('ALL');
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
              <th>Warehouse Code & Name</th>
              <th>Associated Branch</th>
              <th>Location & City</th>
              <th>Warehouse Manager & Contacts</th>
              <th>Features</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWarehouses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--vf-slate-400)' }}>
                  No warehouses found matching your filter criteria.
                </td>
              </tr>
            ) : (
              paginatedWarehouses.map((wh) => {
                const parentBranch = branches.find((b) => b.id === wh.branchId);
                return (
                  <tr key={wh.id} style={{ background: wh.status === 'Inactive' ? '#fcfcfc' : undefined }}>
                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: 'var(--vf-slate-900)' }}>{wh.name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                          Code: <code>{wh.code}</code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span className={`vf-badge ${parentBranch?.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`} style={{ fontSize: '11px' }}>
                          {parentBranch?.name || wh.branchName || wh.branchId}
                        </span>
                        <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', marginTop: '2px' }}>
                          Branch Code: <code>{parentBranch?.code || 'N/A'}</code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{wh.city}, {wh.state}</div>
                        <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={wh.address}>
                          {wh.address}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <strong>{wh.manager || 'Unassigned'}</strong>
                        <div style={{ color: 'var(--vf-slate-500)', fontSize: '11px' }}>{wh.email}</div>
                        <div style={{ color: 'var(--vf-slate-400)', fontSize: '10.5px' }}>{wh.contactNumber}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                        {wh.temperatureControlled && (
                          <span className="vf-badge" style={{ background: '#f0f9ff', color: '#0369a1', padding: '1px 5px', width: 'fit-content' }}>
                            ❄ Cold Chain (2°C-8°C)
                          </span>
                        )}
                        <span style={{ color: 'var(--vf-slate-500)' }}>{wh.storageCapacity}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`vf-badge ${wh.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>
                        {wh.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleOpenView(wh)}
                          title="View Warehouse Details"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          onClick={() => handleOpenEdit(wh)}
                          title="Edit Warehouse"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-secondary vf-btn-xs"
                          style={{
                            color: wh.status === 'Active' ? 'var(--vf-warning)' : 'var(--vf-success)'
                          }}
                          onClick={() => toggleWarehouseStatus(wh.id)}
                          title={wh.status === 'Active' ? 'Deactivate Warehouse' : 'Activate Warehouse'}
                        >
                          {wh.status === 'Active' ? 'Deactivate' : 'Activate'}
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
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredWarehouses.length} warehouses)
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

      {/* Create / Edit Warehouse Side Drawer */}
      {isFormModalOpen && (
        <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsFormModalOpen(false); }}>
          <div className="vf-drawer vf-drawer-md">
            <div className="vf-drawer-header">
              <div className="vf-drawer-title-wrap">
                <h3 className="vf-drawer-title">
                  <WarehouseIcon size={20} className="text-blue-600" />
                  <span>{editingWarehouse ? `Edit Warehouse: ${editingWarehouse.name}` : 'Register New Warehouse'}</span>
                </h3>
                <p className="vf-drawer-subtitle">
                  {editingWarehouse ? 'Update warehouse specifications and linked branch' : 'Register a new warehouse facility associated with a branch'}
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

            <form onSubmit={handleSaveWarehouse} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Branch Selection with rule enforcement */}
                <div>
                  <label className="vf-form-label">Associated Company Branch * (Only Active branches are selectable)</label>
                  <select
                    className="vf-form-control"
                    value={formData.branchId || ''}
                    onChange={(e) => handleBranchSelect(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Select Active Branch --</option>
                    {/* Business Rule: Only Active branches selectable when creating new warehouse */}
                    {(editingWarehouse ? branches : activeBranches).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}) — {b.city}, {b.state} {b.status !== 'Active' ? '[INACTIVE]' : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                    Each warehouse must be linked to a valid company branch.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">Warehouse Name *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. Bhiwandi Central Mother Warehouse & Distribution Hub"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">Warehouse Code * (Unique)</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      placeholder="e.g. WH-BHIW-01"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="vf-form-label">Physical Address *</label>
                  <textarea
                    rows={2}
                    className="vf-form-control"
                    placeholder="Plot/shed number, logistics park, road..."
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="vf-form-label">State *</label>
                    <input
                      type="text"
                      className="vf-form-control"
                      value={formData.state || ''}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="vf-form-label">City *</label>
                    <input
                      type="text"
                      className="vf-form-control"
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
                      placeholder="e.g. 421302"
                      value={formData.pinCode || ''}
                      onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-500)', marginBottom: '10px' }}>
                    Warehouse Operations & Facility Specifications
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="vf-form-label">Warehouse Manager</label>
                      <input
                        type="text"
                        className="vf-form-control"
                        placeholder="e.g. Gajanan Patil"
                        value={formData.manager || ''}
                        onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="vf-form-label">Contact Number</label>
                      <input
                        type="tel"
                        className="vf-form-control"
                        placeholder="e.g. +91 98230 44910"
                        value={formData.contactNumber || ''}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="vf-form-label">Email Address</label>
                      <input
                        type="email"
                        className="vf-form-control"
                        placeholder="e.g. wh.bhiwandi@bioradmedisys.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px', marginTop: '12px', alignItems: 'center' }}>
                    <div>
                      <label className="vf-form-label">Storage Capacity & Clean Level</label>
                      <input
                        type="text"
                        className="vf-form-control"
                        placeholder="e.g. 45,000 sq ft · Class 100K Clean Logistics"
                        value={formData.storageCapacity || ''}
                        onChange={(e) => setFormData({ ...formData, storageCapacity: e.target.value })}
                      />
                    </div>
                    <div style={{ paddingTop: '18px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(formData.temperatureControlled)}
                          onChange={(e) => setFormData({ ...formData, temperatureControlled: e.target.checked })}
                        />
                        <span><strong>Cold Chain Facility</strong> (2°C - 8°C)</span>
                      </label>
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
                    <option value="Active">Active (Available for partner distribution supply)</option>
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
                  {editingWarehouse ? '✓ Save Changes' : '✓ Register Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Warehouse Details Side Drawer */}
      {isViewModalOpen && viewingWarehouse && (
        <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsViewModalOpen(false); }}>
          <div className="vf-drawer vf-drawer-lg">
            <div className="vf-drawer-header">
              <div className="vf-drawer-title-wrap">
                <h3 className="vf-drawer-title">
                  <WarehouseIcon size={20} className="text-blue-600" />
                  <span>{viewingWarehouse.name}</span>
                </h3>
                <p className="vf-drawer-subtitle">
                  Warehouse Code: <code>{viewingWarehouse.code}</code> · Status: <span className={`vf-badge ${viewingWarehouse.status === 'Active' ? 'vf-badge-active' : 'vf-badge-danger'}`}>{viewingWarehouse.status}</span>
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
              {/* Warehouse Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--vf-slate-200)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Associated Branch</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                    {branches.find((b) => b.id === viewingWarehouse.branchId)?.name || viewingWarehouse.branchName || viewingWarehouse.branchId}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Warehouse Manager</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{viewingWarehouse.manager || 'Unassigned'}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>{viewingWarehouse.contactNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Storage Profile</span>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{viewingWarehouse.storageCapacity}</div>
                  {viewingWarehouse.temperatureControlled && (
                    <span className="vf-badge" style={{ background: '#f0f9ff', color: '#0369a1', marginTop: '4px' }}>
                      ❄ Cold Storage
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Location Address</span>
                <div style={{ fontSize: '13px', color: 'var(--vf-slate-800)', marginTop: '4px' }}>
                  {viewingWarehouse.address}, {viewingWarehouse.city}, {viewingWarehouse.state} - {viewingWarehouse.pinCode}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--vf-slate-200)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>Governance & System Metadata</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginTop: '6px' }}>
                  <div>Stable Branch Reference ID: <code>{viewingWarehouse.branchId}</code></div>
                  <div>Registered Date: <code>{viewingWarehouse.createdAt}</code></div>
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
                  handleOpenEdit(viewingWarehouse);
                }}
              >
                Edit Warehouse
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
