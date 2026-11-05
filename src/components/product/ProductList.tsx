import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { Product } from '../../types/product.ts';
import { LifecycleDialog, availableActions } from './LifecycleDialog.tsx';
import { IndustryPacksDrawer } from './IndustryPacksDrawer.tsx';
import type { LifecycleAction } from './LifecycleDialog.tsx';

interface ProductListProps {
  onViewProduct: (productId: string) => void;
  onEditProduct: (productId: string) => void;
  onCreateProduct: () => void;
  onOpenConfigStudio: (section?: string) => void;
  onPrintLabel: (product: Product) => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  searchTerm?: string;
}

export const ProductList: React.FC<ProductListProps> = ({
  onViewProduct,
  onEditProduct,
  onCreateProduct,
  onOpenConfigStudio,
  onPrintLabel,
  onOpenImport,
  onOpenExport,
  searchTerm = ''
}) => {
  const {
    products,
    portfolios,
    productTypes,
    duplicateProduct,
    bulkApproveProducts,
    currentUser,
    showToast
  } = useApp();
  const [lifecycle, setLifecycle] = useState<{ product: Product; action: LifecycleAction } | null>(null);
  const [packsOpen, setPacksOpen] = useState(false);

  const [configureOpen, setConfigureOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [localSearch, setLocalSearch] = useState('');
  const [selectedPortfolio, setSelectedPortfolio] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductType, setSelectedProductType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTracking, setSelectedTracking] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [savedView, setSavedView] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Active filter count calculation
  const effectiveSearch = searchTerm || localSearch;

  // Categories under selected portfolio
  const availableCategories = useMemo(() => {
    if (!selectedPortfolio) {
      return portfolios.flatMap((p) => p.categories);
    }
    const port = portfolios.find((p) => p.id === selectedPortfolio);
    return port ? port.categories : [];
  }, [selectedPortfolio, portfolios]);

  // Saved View toggles
  const applySavedView = (view: string) => {
    setSavedView(view);
    if (view === 'all') {
      setSelectedStatus('');
      setSelectedProductType('');
      setSelectedTracking('');
    } else if (view === 'active-implants') {
      setSelectedStatus('Active');
      setSelectedProductType('type-implant');
      setSelectedTracking('');
    } else if (view === 'pending') {
      setSelectedStatus('Pending Approval');
      setSelectedProductType('');
      setSelectedTracking('');
    } else if (view === 'drafts') {
      setSelectedStatus('Draft');
      setSelectedProductType('');
      setSelectedTracking('');
    } else if (view === 'batch-serial') {
      setSelectedStatus('');
      setSelectedProductType('');
      setSelectedTracking('Batch + Serial');
    }
  };

  const handleClearFilters = () => {
    setLocalSearch('');
    setSelectedPortfolio('');
    setSelectedCategory('');
    setSelectedProductType('');
    setSelectedStatus('');
    setSelectedTracking('');
    setSelectedSource('');
    setSavedView('all');
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      if (effectiveSearch) {
        const query = effectiveSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesCode = p.code.toLowerCase().includes(query);
        const matchesBrand = (p.brand || '').toLowerCase().includes(query);
        const matchesSku = p.variants.some((v) => v.sku.toLowerCase().includes(query) || v.gtin.toLowerCase().includes(query));
        if (!matchesName && !matchesCode && !matchesBrand && !matchesSku) return false;
      }

      // Portfolio
      if (selectedPortfolio && p.portfolioId !== selectedPortfolio) return false;

      // Category
      if (selectedCategory && p.categoryId !== selectedCategory) return false;

      // Product Type
      if (selectedProductType && p.productTypeId !== selectedProductType) return false;

      // Status
      if (selectedStatus && p.lifecycleStatus !== selectedStatus) return false;

      // Tracking
      if (selectedTracking && p.trackingMode !== selectedTracking) return false;

      // Source
      if (selectedSource && !p.sourceSystem.toLowerCase().includes(selectedSource.toLowerCase())) return false;

      return true;
    });
  }, [
    products,
    effectiveSearch,
    selectedPortfolio,
    selectedCategory,
    selectedProductType,
    selectedStatus,
    selectedTracking,
    selectedSource
  ]);

  // Metrics calculation
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.lifecycleStatus === 'Active').length;
  const draftCount = products.filter((p) => p.lifecycleStatus === 'Draft').length;
  const pendingCount = products.filter((p) => p.lifecycleStatus === 'Pending Approval').length;
  const variantCount = products.filter((p) => p.hasVariants).length;
  const incompleteCount = products.filter((p) => !p.code || !p.hsnCode).length;

  // Pagination slice
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Checkbox Selection
  const allCurrentSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((p) => selectedIds.has(p.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const next = new Set(selectedIds);
      paginatedProducts.forEach((p) => next.add(p.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedProducts.forEach((p) => next.delete(p.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkStatus = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const r = bulkApproveProducts(ids);
    showToast(r.message, r.ok ? 'success' : 'warning');
    (r.errors ?? []).slice(0, 3).forEach((e) => showToast(e, 'warning'));
    setSelectedIds(new Set());
  };

  const handleBulkExport = () => {
    showToast(`Exporting ${selectedIds.size} selected products...`, 'info');
    onOpenExport();
  };

  return (
    <div id="view-product-list" className="vf-view active">
      {/* Page Header */}
      <div className="vf-page-header">
        <div className="vf-page-title-group">
          <h1 className="vf-page-title">
            <span>Product Master</span>
            <span className="vf-badge vf-badge-approved" style={{ fontSize: '11px' }}>
              Universal Registry
            </span>
          </h1>
          <p className="vf-page-desc">
            Manage product definitions, classifications, variants, identifiers, and product lifecycle across universal deployment scenarios.
          </p>
        </div>

        <div className="vf-header-actions" style={{ position: 'relative' }}>
          {/* Configure Dropdown */}
          <div className="vf-dropdown-wrap">
            <button
              type="button"
              className="vf-btn vf-btn-secondary"
              onClick={() => setConfigureOpen(!configureOpen)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <span>Configure ▾</span>
            </button>

            {configureOpen && (
              <div
                className="vf-dropdown-menu active"
                style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100 }}
                onClick={() => setConfigureOpen(false)}
              >
                <div className="vf-dropdown-header">Product Configuration</div>
                <div className="vf-dropdown-item" onClick={() => { setPacksOpen(true); setConfigureOpen(false); }}>
                  <span className="vf-dropdown-icon">🧩</span>
                  <div>
                    <div className="vf-dropdown-title">Industry Packs</div>
                    <div className="vf-dropdown-desc">Switch Medical Devices / FMCG / General on or off</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('productTypes')}>
                  <span className="vf-dropdown-icon">🏷️</span>
                  <div>
                    <div className="vf-dropdown-title">Product Types</div>
                    <div className="vf-dropdown-desc">Define behavior, stockability & tracking</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('productTemplates')}>
                  <span className="vf-dropdown-icon">📐</span>
                  <div>
                    <div className="vf-dropdown-title">Product Templates</div>
                    <div className="vf-dropdown-desc">Reusable structures & attribute bindings</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('attributes')}>
                  <span className="vf-dropdown-icon">⚙️</span>
                  <div>
                    <div className="vf-dropdown-title">Attributes & Attribute Sets</div>
                    <div className="vf-dropdown-desc">Data types, units, rules & variant dimensions</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('trackingRules')}>
                  <span className="vf-dropdown-icon">🔍</span>
                  <div>
                    <div className="vf-dropdown-title">Tracking Rules</div>
                    <div className="vf-dropdown-desc">Traceability policies & regulatory mandates</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('validationRules')}>
                  <span className="vf-dropdown-icon">🛡️</span>
                  <div>
                    <div className="vf-dropdown-title">Validation Rules</div>
                    <div className="vf-dropdown-desc">Pre-approval checks & mandatory field criteria</div>
                  </div>
                </div>

                <div className="vf-dropdown-header">Classification Management</div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('portfolios')}>
                  <span className="vf-dropdown-icon">📁</span>
                  <div>
                    <div className="vf-dropdown-title">Portfolios</div>
                    <div className="vf-dropdown-desc">Commercial business groupings & divisions</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('categories')}>
                  <span className="vf-dropdown-icon">🗂️</span>
                  <div>
                    <div className="vf-dropdown-title">Categories</div>
                    <div className="vf-dropdown-desc">Product taxonomic classifications</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('subCategories')}>
                  <span className="vf-dropdown-icon">📑</span>
                  <div>
                    <div className="vf-dropdown-title">Sub-Categories</div>
                    <div className="vf-dropdown-desc">Specialized clinical & technical segments</div>
                  </div>
                </div>

                <div className="vf-dropdown-header">Additional Settings</div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('uomPackaging')}>
                  <span className="vf-dropdown-icon">📦</span>
                  <div>
                    <div className="vf-dropdown-title">UOM & Packaging Defaults</div>
                    <div className="vf-dropdown-desc">Conversion factors & packaging hierarchies</div>
                  </div>
                </div>
                <div className="vf-dropdown-item" onClick={() => onOpenConfigStudio('inventoryPolicy')}>
                  <span className="vf-dropdown-icon">📊</span>
                  <div>
                    <div className="vf-dropdown-title">Inventory Policy Defaults</div>
                    <div className="vf-dropdown-desc">Safety thresholds, reorder points & lead times</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Import Button */}
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onOpenImport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Import</span>
          </button>

          {/* Export Button */}
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onOpenExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>

          {/* Create Product Button */}
          <button type="button" className="vf-btn vf-btn-primary vf-btn-lg" onClick={onCreateProduct}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Product</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="vf-metric-grid">
        <div className="vf-metric-card accent">
          <div className="vf-metric-label">
            <span>Total Products</span>
            <span style={{ fontSize: '14px' }}>📦</span>
          </div>
          <div className="vf-metric-value">{totalCount}</div>
          <div className="vf-metric-meta">Across 5 commercial portfolios</div>
        </div>

        <div className="vf-metric-card success">
          <div className="vf-metric-label">
            <span>Active Products</span>
            <span style={{ fontSize: '14px' }}>✓</span>
          </div>
          <div className="vf-metric-value">{activeCount}</div>
          <div className="vf-metric-meta">Available for pricing & orders</div>
        </div>

        <div className="vf-metric-card warning">
          <div className="vf-metric-label">
            <span>Draft Records</span>
            <span style={{ fontSize: '14px' }}>📝</span>
          </div>
          <div className="vf-metric-value">{draftCount}</div>
          <div className="vf-metric-meta">Work in progress definitions</div>
        </div>

        <div className="vf-metric-card purple">
          <div className="vf-metric-label">
            <span>Pending Approval</span>
            <span style={{ fontSize: '14px' }}>⏳</span>
          </div>
          <div className="vf-metric-value">{pendingCount}</div>
          <div className="vf-metric-meta">Regulatory sign-off required</div>
        </div>

        <div className="vf-metric-card accent">
          <div className="vf-metric-label">
            <span>With Variants</span>
            <span style={{ fontSize: '14px' }}>🔀</span>
          </div>
          <div className="vf-metric-value">{variantCount}</div>
          <div className="vf-metric-meta">Configurable SKU matrices</div>
        </div>

        <div className="vf-metric-card">
          <div className="vf-metric-label">
            <span>Incomplete Records</span>
            <span style={{ fontSize: '14px' }}>⚠️</span>
          </div>
          <div className="vf-metric-value">{incompleteCount}</div>
          <div className="vf-metric-meta">Missing UDI or Tax code</div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="vf-filter-card">
        {/* Top Row: Saved Views */}
        <div className="vf-filter-row-top">
          <div className="vf-saved-views">
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--vf-slate-500)', textTransform: 'uppercase', marginRight: '4px' }}>
              Views:
            </span>
            <button
              className={`vf-view-pill ${savedView === 'all' ? 'active' : ''}`}
              onClick={() => applySavedView('all')}
            >
              All Products
            </button>
            <button
              className={`vf-view-pill ${savedView === 'active-implants' ? 'active' : ''}`}
              onClick={() => applySavedView('active-implants')}
            >
              Active Implants
            </button>
            <button
              className={`vf-view-pill ${savedView === 'pending' ? 'active' : ''}`}
              onClick={() => applySavedView('pending')}
            >
              Pending Approval
            </button>
            <button
              className={`vf-view-pill ${savedView === 'drafts' ? 'active' : ''}`}
              onClick={() => applySavedView('drafts')}
            >
              Drafts
            </button>
            <button
              className={`vf-view-pill ${savedView === 'batch-serial' ? 'active' : ''}`}
              onClick={() => applySavedView('batch-serial')}
            >
              Batch + Serial Tracked
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="vf-btn vf-btn-sm vf-btn-secondary" onClick={handleClearFilters}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Filter Grid */}
        <div className="vf-filter-grid">
          <div className="vf-form-group" style={{ gridColumn: 'span 2' }}>
            <label className="vf-label">Search Products & Identifiers</label>
            <input
              type="text"
              className="vf-input"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Name, code, SKU, GTIN, or brand..."
            />
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Portfolio</label>
            <select
              className="vf-select"
              value={selectedPortfolio}
              onChange={(e) => {
                setSelectedPortfolio(e.target.value);
                setSelectedCategory('');
              }}
            >
              <option value="">All Portfolios</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Category</label>
            <select
              className="vf-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Product Type</label>
            <select
              className="vf-select"
              value={selectedProductType}
              onChange={(e) => setSelectedProductType(e.target.value)}
            >
              <option value="">All Product Types</option>
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Status</label>
            <select
              className="vf-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Retired">Retired</option>
            </select>
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Tracking Mode</label>
            <select
              className="vf-select"
              value={selectedTracking}
              onChange={(e) => setSelectedTracking(e.target.value)}
            >
              <option value="">All Tracking</option>
              <option value="Batch + Serial">Batch + Serial</option>
              <option value="Batch / Lot">Batch / Lot</option>
              <option value="Serial">Serial Only</option>
              <option value="None">None</option>
            </select>
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Source System</label>
            <select
              className="vf-select"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="SAP">SAP S/4HANA</option>
              <option value="Oracle">Oracle Fusion</option>
              <option value="CSV">Excel / CSV Import</option>
              <option value="VinFlux">VinFlux Direct</option>
            </select>
          </div>
        </div>

        {/* Active Filter Tags */}
        <div className="vf-active-tags-row">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedPortfolio || selectedCategory || selectedProductType || selectedStatus || selectedTracking || selectedSource || effectiveSearch ? (
              <>
                <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)', fontWeight: 600 }}>Active Filters:</span>
                {effectiveSearch && <span className="vf-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>Search: "{effectiveSearch}"</span>}
                {selectedPortfolio && <span className="vf-badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>Portfolio Filtered</span>}
                {selectedCategory && <span className="vf-badge" style={{ background: '#f5f3ff', color: '#6d28d9' }}>Category Filtered</span>}
                {selectedProductType && <span className="vf-badge" style={{ background: '#f0fdf4', color: '#166534' }}>Type Filtered</span>}
                {selectedStatus && <span className="vf-badge" style={{ background: '#fef3c7', color: '#92400e' }}>Status: {selectedStatus}</span>}
                {selectedTracking && <span className="vf-badge" style={{ background: '#f1f5f9', color: '#334155' }}>Tracking: {selectedTracking}</span>}
                {selectedSource && <span className="vf-badge" style={{ background: '#fdf2f8', color: '#9d174d' }}>Source: {selectedSource}</span>}
              </>
            ) : (
              <span style={{ color: 'var(--vf-slate-400)', fontSize: '11.5px' }}>
                No custom filters active (showing default set)
              </span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>Universal Multi-Facet Filter Engine</span>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="vf-bulk-bar" style={{ display: 'flex' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, color: '#60a5fa' }}>{selectedIds.size} product(s) selected</span>
            <span style={{ color: '#64748b' }}>|</span>
            <button
              type="button"
              className="vf-btn vf-btn-sm vf-btn-secondary"
              onClick={handleBulkStatus}
              style={{ background: '#334155', color: '#fff', borderColor: '#475569' }}
              disabled={!currentUser.permissions.canApproveProducts}
              title={currentUser.permissions.canApproveProducts ? 'Approve selected products that are pending approval' : 'You do not have approval rights'}
            >
              Approve selected
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-sm vf-btn-secondary"
              onClick={handleBulkExport}
              style={{ background: '#334155', color: '#fff', borderColor: '#475569' }}
            >
              Export Selected
            </button>
          </div>
          <button
            type="button"
            className="vf-btn vf-btn-sm"
            onClick={() => setSelectedIds(new Set())}
            style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer' }}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Products Table */}
      <div className="vf-table-container">
        <div className="vf-table-responsive">
          <table className="vf-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allCurrentSelected}
                    onChange={handleSelectAll}
                    title="Select all on this page"
                  />
                </th>
                <th>Product Definition & Code</th>
                <th>SKU / Variants</th>
                <th>Portfolio & Category</th>
                <th>Product Type</th>
                <th>Principal & Source</th>
                <th>Tracking</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((p) => {
                const portfolio = portfolios.find((port) => port.id === p.portfolioId);
                const category = portfolio?.categories.find((c) => c.id === p.categoryId);
                const pType = productTypes.find((t) => t.id === p.productTypeId);

                return (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => handleToggleSelect(p.id)}
                      />
                    </td>
                    <td>
                      <div
                        style={{ fontWeight: 700, color: 'var(--vf-primary)', cursor: 'pointer', lineHeight: 1.3 }}
                        onClick={() => onViewProduct(p.id)}
                        title="View Product Detail"
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                        Code: <code>{p.code}</code> · HSN: <strong>{p.hsnCode}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                        {p.hasVariants ? `${p.variants.length} Variants` : '1 Base SKU'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{portfolio?.name || 'General'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{category?.name || '--'}</div>
                    </td>
                    <td>
                      <span className="vf-badge vf-badge-type">{pType?.name || 'Implant'}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>Biorad Medisys</div>
                      <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>{p.sourceSystem}</div>
                    </td>
                    <td>
                      <span className="vf-badge vf-badge-tracking">{p.trackingMode}</span>
                    </td>
                    <td>
                      <span
                        className={`vf-badge ${
                          p.lifecycleStatus === 'Active'
                            ? 'vf-badge-approved'
                            : p.lifecycleStatus === 'Draft'
                            ? 'vf-badge-warning'
                            : p.lifecycleStatus === 'Retired'
                            ? 'vf-badge-danger'
                            : 'vf-badge-pending'
                        }`}
                      >
                        {p.lifecycleStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`vf-badge ${
                          p.approvalStatus === 'Approved' ? 'vf-badge-approved' : 'vf-badge-pending'
                        }`}
                      >
                        {p.approvalStatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '11.5px', color: 'var(--vf-slate-600)' }}>{p.updatedAt}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)' }}>{p.updatedBy}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="vf-btn vf-btn-sm vf-btn-secondary"
                          onClick={() => onViewProduct(p.id)}
                          title="View Detail"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-sm vf-btn-secondary"
                          onClick={() => onEditProduct(p.id)}
                          title="Edit Product"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-sm vf-btn-secondary"
                          onClick={() => onPrintLabel(p)}
                          title="Print Barcode Label"
                        >
                          🏷️
                        </button>
                        <button
                          type="button"
                          className="vf-btn vf-btn-sm vf-btn-secondary"
                          onClick={() => duplicateProduct(p.id)}
                          title="Duplicate Product"
                        >
                          📋
                        </button>
                        {availableActions(p, currentUser.permissions).filter((a) => a !== 'reject').map((a) => (
                          <button
                            key={a}
                            type="button"
                            className="vf-btn vf-btn-sm"
                            style={a === 'retire'
                              ? { background: 'transparent', border: '1px solid #fecaca', color: '#dc2626' }
                              : { background: 'transparent', border: '1px solid #c7d2fe', color: '#4338ca' }}
                            onClick={() => setLifecycle({ product: p, action: a })}
                            title={a === 'submit' ? 'Submit for approval' : a === 'approve' ? 'Approve' : 'Retire product'}
                          >
                            {a === 'submit' ? 'Submit' : a === 'approve' ? 'Review' : 'Retire'}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔍</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--vf-slate-800)', marginBottom: '4px' }}>
              No matching product records
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--vf-slate-500)', maxWidth: '420px', margin: '0 auto 16px' }}>
              Try adjusting your search criteria, clearing active filters, or changing saved views.
            </p>
            <button className="vf-btn vf-btn-secondary" onClick={handleClearFilters}>
              Clear All Filters
            </button>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="vf-pagination">
          <div>
            Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
          </div>
          <div className="vf-pagination-controls">
            <button
              className="vf-btn vf-btn-sm vf-btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
            >
              &larr; Previous
            </button>
            <span style={{ fontSize: '12px', padding: '0 8px', alignSelf: 'center' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="vf-btn vf-btn-sm vf-btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
      {packsOpen && <IndustryPacksDrawer onClose={() => setPacksOpen(false)} />}
      {lifecycle && <LifecycleDialog product={lifecycle.product} action={lifecycle.action} onClose={() => setLifecycle(null)} />}
    </div>
  );
};
