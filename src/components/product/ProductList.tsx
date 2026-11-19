import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CloudDownload, Copy, Download,
  Eye, FileSpreadsheet, Filter, FolderTree, Gauge, LayoutGrid, Layers, List, MoreHorizontal, Package, PackageSearch, Pencil,
  Plus, Puzzle, Ruler, ScanBarcode, Search, Send, Settings2, ShieldCheck, SlidersHorizontal, Tag, Tags, Upload, X, Archive, Minus, Fingerprint,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { Product } from '../../types/product.ts';
import { LifecycleDialog, availableActions } from './LifecycleDialog.tsx';
import type { LifecycleAction } from './LifecycleDialog.tsx';
import { IndustryPacksDrawer } from './IndustryPacksDrawer.tsx';
import { packOf } from '../../utils/productLifecycle.ts';

interface ProductListProps {
  onViewProduct: (productId: string) => void;
  onEditProduct: (productId: string) => void;
  onCreateProduct: () => void;
  onOpenConfigStudio: (section?: string) => void;
  onPrintLabel: (product: Product) => void;
  onOpenImport: () => void;
  onOpenErpImport?: () => void;
  onOpenExport: () => void;
  searchTerm?: string;
}

type Status = Product['lifecycleStatus'];
type SortKey = 'name' | 'updated' | 'mrp';
const STATUS_TABS: { id: '' | Status; label: string }[] = [
  { id: '', label: 'All' }, { id: 'Active', label: 'Active' }, { id: 'Draft', label: 'Draft' }, { id: 'Pending Approval', label: 'Pending' }, { id: 'Retired', label: 'Retired' },
];
const PILL: Record<Status, string> = { Active: 'pl-pill-active', Draft: 'pl-pill-draft', 'Pending Approval': 'pl-pill-pending', Retired: 'pl-pill-retired' };
const TRACK_ICON: Record<Product['trackingMode'], React.ReactNode> = {
  'Batch + Serial': <Layers size={14} />, 'Batch / Lot': <Boxes size={14} />, Serial: <Fingerprint size={14} />, None: <Minus size={14} />,
};
const SWATCHES = [
  ['#eff6ff', '#1d4ed8'], ['#ecfdf5', '#047857'], ['#fef3c7', '#b45309'], ['#f5f3ff', '#6d28d9'],
  ['#fdf2f8', '#be185d'], ['#ecfeff', '#0e7490'], ['#fff7ed', '#c2410c'], ['#f1f5f9', '#334155'],
];
const swatch = (key: string) => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SWATCHES[h % SWATCHES.length]; };
const initials = (name: string) => name.split(/[\s\-/]+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';
const fmtDate = (d: string) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const fmtINR = (n: number) => (n ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '');
/** A record that can't go live as-is: no code, no valid HSN, or no GST rate. */
const needsAttention = (p: Product) => !p.code || !/^\d{6,8}$/.test(p.hsnCode || '') || !p.taxRate;
const VIEW_KEY = 'vinflux.productList.view';
const readView = (): 'table' | 'grid' => { try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table'; } catch { return 'table'; } };

/** Closes a popover on outside click / Escape. */
const useDismiss = (open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) => {
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, close, ref]);
};

const Menu: React.FC<{ trigger: (toggle: () => void, open: boolean) => React.ReactNode; wide?: boolean; children: (close: () => void) => React.ReactNode }> = ({ trigger, wide, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  return (
    <div className="pl-menu-wrap" ref={ref}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && <div className={`pl-menu${wide ? ' pl-menu-wide' : ''}`} role="menu">{children(close)}</div>}
    </div>
  );
};

/** Row "more" menu — fixed-positioned so the scrollable table can't clip it. */
const RowMenu: React.FC<{ children: (close: () => void) => React.ReactNode }> = ({ children }) => {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setPos(null), []);
  useDismiss(!!pos, close, ref);
  const place = React.useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r || r.bottom < 0 || r.top > window.innerHeight) { setPos(null); return; }
    setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 220), right: window.innerWidth - r.right });
  }, []);
  useEffect(() => {
    if (!pos) return;
    // Follow the button when the page or the table scrolls (clicking can scroll the table into view).
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', close); };
  }, [pos, place, close]);
  return (
    <div ref={ref} style={{ display: 'inline-flex' }}>
      <button ref={btn} type="button" className="pl-icon-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded={!!pos}
        onClick={(e) => { e.stopPropagation(); if (pos) close(); else place(); }}>
        <MoreHorizontal size={16} />
      </button>
      {pos && <div className="pl-menu" role="menu" style={{ position: 'fixed', top: pos.top, right: pos.right }} onClick={(e) => e.stopPropagation()}>{children(close)}</div>}
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; title: string; desc?: string; danger?: boolean; disabled?: boolean; onClick: () => void }> = ({ icon, title, desc, danger, disabled, onClick }) => (
  <button type="button" role="menuitem" className={`pl-menu-item${danger ? ' danger' : ''}`} disabled={disabled} style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={onClick}>
    {icon}<span>{title}{desc && <small>{desc}</small>}</span>
  </button>
);

export const ProductList: React.FC<ProductListProps> = ({
  onViewProduct, onEditProduct, onCreateProduct, onOpenConfigStudio, onPrintLabel, onOpenImport, onOpenErpImport, onOpenExport, searchTerm = '',
}) => {
  const { products, portfolios, productTypes, duplicateProduct, bulkApproveProducts, currentUser, showToast, industryPacks, activePrincipal } = useApp();

  const [view, setViewRaw] = useState<'table' | 'grid'>(readView);
  const setView = (v: 'table' | 'grid') => { setViewRaw(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience only */ } };
  const [lifecycle, setLifecycle] = useState<{ product: Product; action: LifecycleAction } | null>(null);
  const [packsOpen, setPacksOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [localSearch, setLocalSearch] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [attention, setAttention] = useState(false);
  const [pack, setPack] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [category, setCategory] = useState('');
  const [productType, setProductType] = useState('');
  const [tracking, setTracking] = useState('');
  const [source, setSource] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'updated', dir: 'desc' });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const effectiveSearch = (searchTerm || localSearch).trim();
  const enabledPacks = industryPacks.filter((pk) => pk.enabled);
  const portfolioOf = (p: Product) => portfolios.find((x) => x.id === p.portfolioId);
  const categoryOf = (p: Product) => portfolioOf(p)?.categories.find((c) => c.id === p.categoryId);
  const typeOf = (p: Product) => productTypes.find((t) => t.id === p.productTypeId);
  const categories = useMemo(() => (portfolio ? portfolios.find((p) => p.id === portfolio)?.categories ?? [] : portfolios.flatMap((p) => p.categories)), [portfolio, portfolios]);
  const usedTypes = useMemo(() => productTypes.filter((t) => products.some((p) => p.productTypeId === t.id)), [productTypes, products]);
  const sources = useMemo(() => [...new Set(products.map((p) => p.sourceSystem).filter(Boolean))].sort(), [products]);

  // Everything except the status tab, so the tab counts reflect the other filters.
  const baseFiltered = useMemo(() => {
    const q = effectiveSearch.toLowerCase();
    return products.filter((p) => {
      if (q && ![p.name, p.code, p.brand, p.hsnCode, ...p.variants.flatMap((v) => [v.sku, v.gtin])].some((s) => (s || '').toLowerCase().includes(q))) return false;
      if (pack && packOf(p.productTypeId, productTypes) !== pack) return false;
      if (portfolio && p.portfolioId !== portfolio) return false;
      if (category && p.categoryId !== category) return false;
      if (productType && p.productTypeId !== productType) return false;
      if (tracking && p.trackingMode !== tracking) return false;
      if (source && p.sourceSystem !== source) return false;
      if (attention && !needsAttention(p)) return false;
      return true;
    });
  }, [products, effectiveSearch, pack, productTypes, portfolio, category, productType, tracking, source, attention]);

  const filtered = useMemo(() => {
    const rows = status ? baseFiltered.filter((p) => p.lifecycleStatus === status) : baseFiltered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
      if (sort.key === 'mrp') return ((a.pricingReference?.mrp ?? 0) - (b.pricingReference?.mrp ?? 0)) * dir;
      return (a.updatedAt || '').localeCompare(b.updatedAt || '') * dir;
    });
  }, [baseFiltered, status, sort]);

  useEffect(() => { setPage(1); }, [effectiveSearch, status, pack, portfolio, category, productType, tracking, source, attention, pageSize]);

  const counts = {
    total: products.length,
    active: products.filter((p) => p.lifecycleStatus === 'Active').length,
    pending: products.filter((p) => p.lifecycleStatus === 'Pending Approval').length,
    draft: products.filter((p) => p.lifecycleStatus === 'Draft').length,
    tracked: products.filter((p) => p.trackingMode !== 'None').length,
    attention: products.filter(needsAttention).length,
  };
  const usedPortfolios = new Set(products.map((p) => p.portfolioId)).size;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);
  const allOnPage = rows.length > 0 && rows.every((p) => selectedIds.has(p.id));

  const toggle = (id: string) => setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelectedIds((s) => { const n = new Set(s); rows.forEach((p) => (allOnPage ? n.delete(p.id) : n.add(p.id))); return n; });

  const clearAll = () => {
    setLocalSearch(''); setStatus(''); setAttention(false); setPack(''); setPortfolio(''); setCategory(''); setProductType(''); setTracking(''); setSource('');
  };
  const chips: { label: string; clear: () => void }[] = [
    ...(effectiveSearch && !searchTerm ? [{ label: `“${effectiveSearch}”`, clear: () => setLocalSearch('') }] : []),
    ...(attention ? [{ label: 'Needs attention', clear: () => setAttention(false) }] : []),
    ...(pack ? [{ label: enabledPacks.find((x) => x.id === pack)?.name ?? pack, clear: () => setPack('') }] : []),
    ...(portfolio ? [{ label: portfolios.find((x) => x.id === portfolio)?.name ?? 'Portfolio', clear: () => { setPortfolio(''); setCategory(''); } }] : []),
    ...(category ? [{ label: categories.find((x) => x.id === category)?.name ?? 'Category', clear: () => setCategory('') }] : []),
    ...(productType ? [{ label: productTypes.find((x) => x.id === productType)?.name ?? 'Type', clear: () => setProductType('') }] : []),
    ...(tracking ? [{ label: `Tracking: ${tracking}`, clear: () => setTracking('') }] : []),
    ...(source ? [{ label: `Source: ${source}`, clear: () => setSource('') }] : []),
  ];
  const filterCount = chips.length - (effectiveSearch && !searchTerm ? 1 : 0);

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const SortHead: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className }) => (
    <th className={`sortable ${className ?? ''}`} onClick={() => sortBy(k)} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <span className="pl-sort">{children}{sort.key === k && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</span>
    </th>
  );

  const bulkApprove = () => {
    const r = bulkApproveProducts([...selectedIds]);
    showToast(r.message, r.ok ? 'success' : 'warning');
    (r.errors ?? []).slice(0, 3).forEach((e) => showToast(e, 'warning'));
    setSelectedIds(new Set());
  };

  const Avatar: React.FC<{ p: Product }> = ({ p }) => { const [bg, fg] = swatch(p.categoryId || p.portfolioId || p.id); return <span className="pl-avatar" style={{ background: bg, color: fg }} aria-hidden>{initials(p.name)}</span>; };
  const StatusPill: React.FC<{ p: Product }> = ({ p }) => (
    <span className={`pl-pill ${PILL[p.lifecycleStatus]}`} title={p.approvalStatus === 'Rejected' ? 'Last submission was rejected' : undefined}>
      <span className="pl-dot" />{p.lifecycleStatus === 'Pending Approval' ? 'Pending approval' : p.lifecycleStatus}{p.approvalStatus === 'Rejected' && ' · rejected'}
    </span>
  );
  const moreItems = (p: Product, close: () => void) => {
    const acts = availableActions(p, currentUser.permissions).filter((a) => a !== 'reject');
    return (
      <>
        <MenuItem icon={<ScanBarcode size={15} />} title="Print barcode label" onClick={() => { close(); onPrintLabel(p); }} />
        <MenuItem icon={<Copy size={15} />} title="Duplicate" onClick={() => { close(); duplicateProduct(p.id); }} />
        {acts.length > 0 && <div className="pl-menu-sep" />}
        {acts.map((a) => (
          <MenuItem key={a} danger={a === 'retire'} icon={a === 'submit' ? <Send size={15} /> : a === 'approve' ? <ShieldCheck size={15} /> : <Archive size={15} />}
            title={a === 'submit' ? 'Submit for approval' : a === 'approve' ? 'Review & approve' : 'Retire product'} onClick={() => { close(); setLifecycle({ product: p, action: a }); }} />
        ))}
      </>
    );
  };

  const configItems: [string, React.ReactNode, string, string][] = [
    ['productTypes', <Tag size={15} />, 'Product types', 'Behaviour, stockability and tracking'],
    ['productTemplates', <FileSpreadsheet size={15} />, 'Product templates', 'Reusable structures and attribute bindings'],
    ['attributes', <SlidersHorizontal size={15} />, 'Attributes & sets', 'Data types, units and variant dimensions'],
    ['trackingRules', <Fingerprint size={15} />, 'Tracking rules', 'Traceability policies and mandates'],
    ['validationRules', <ShieldCheck size={15} />, 'Validation rules', 'Checks before approval'],
  ];
  const classItems: [string, React.ReactNode, string][] = [
    ['portfolios', <FolderTree size={15} />, 'Portfolios'], ['categories', <Tags size={15} />, 'Categories'], ['subCategories', <Tags size={15} />, 'Sub-categories'],
  ];

  return (
    <div id="view-product-list" className="vf-view active pl">
      {/* Header */}
      <div className="pl-head">
        <div>
          <h1 className="pl-title">Products</h1>
          <p className="pl-sub">{counts.total} products across {usedPortfolios} portfolio{usedPortfolios === 1 ? '' : 's'} · {activePrincipal?.name}</p>
        </div>
        <div className="pl-actions">
          <Menu wide trigger={(t, open) => <button type="button" className={`pl-btn${open ? ' on' : ''}`} onClick={t} aria-haspopup="menu"><Settings2 size={15} />Configure<ChevronDown size={14} /></button>}>
            {(close) => (
              <>
                <div className="pl-menu-label">Product configuration</div>
                <MenuItem icon={<Puzzle size={15} />} title="Industry packs" desc={enabledPacks.map((x) => x.name).join(', ')} onClick={() => { close(); setPacksOpen(true); }} />
                {configItems.map(([id, icon, title, desc]) => <MenuItem key={id} icon={icon} title={title} desc={desc} onClick={() => { close(); onOpenConfigStudio(id); }} />)}
                <div className="pl-menu-label">Classification</div>
                {classItems.map(([id, icon, title]) => <MenuItem key={id} icon={icon} title={title} onClick={() => { close(); onOpenConfigStudio(id); }} />)}
                <div className="pl-menu-label">Defaults</div>
                <MenuItem icon={<Ruler size={15} />} title="UOM & packaging" onClick={() => { close(); onOpenConfigStudio('uomPackaging'); }} />
                <MenuItem icon={<Gauge size={15} />} title="Inventory policy" onClick={() => { close(); onOpenConfigStudio('inventoryPolicy'); }} />
              </>
            )}
          </Menu>
          <Menu trigger={(t, open) => <button type="button" className={`pl-btn${open ? ' on' : ''}`} onClick={t} aria-haspopup="menu"><Upload size={15} />Import<ChevronDown size={14} /></button>}>
            {(close) => (
              <>
                <MenuItem icon={<FileSpreadsheet size={15} />} title="From Excel / CSV" desc="Upload a file with the product template" onClick={() => { close(); onOpenImport(); }} />
                {onOpenErpImport && <MenuItem icon={<CloudDownload size={15} />} title="From ERP" desc="Read items from a live connection (Zoho, SAP, Odoo…)" onClick={() => { close(); onOpenErpImport(); }} />}
              </>
            )}
          </Menu>
          <button type="button" className="pl-btn" onClick={onOpenExport}><Download size={15} />Export</button>
          <button type="button" className="pl-btn pl-btn-primary" onClick={onCreateProduct}><Plus size={16} />New product</button>
        </div>
      </div>

      {/* Stats */}
      <div className="pl-stats">
        <button type="button" className={`pl-stat${!status && !attention ? ' on' : ''}`} onClick={() => { setStatus(''); setAttention(false); }}>
          <span className="pl-stat-label"><Package size={13} />Total products</span><span className="pl-stat-value">{counts.total}</span>
          <span className="pl-stat-meta">{products.filter((p) => p.hasVariants).length} with variants</span>
        </button>
        <button type="button" className={`pl-stat${status === 'Active' ? ' on' : ''}`} onClick={() => setStatus('Active')}>
          <span className="pl-stat-label"><span className="pl-dot" style={{ background: 'var(--vf-success)' }} />Active</span><span className="pl-stat-value">{counts.active}</span>
          <span className="pl-stat-meta">Ready for pricing and orders</span>
        </button>
        <button type="button" className={`pl-stat${status === 'Pending Approval' ? ' on' : ''}`} onClick={() => setStatus('Pending Approval')}>
          <span className="pl-stat-label"><span className="pl-dot" style={{ background: 'var(--vf-warning)' }} />Pending approval</span><span className="pl-stat-value">{counts.pending}</span>
          <span className="pl-stat-meta">{counts.draft} in draft</span>
        </button>
        <div className="pl-stat" style={{ cursor: 'default' }}>
          <span className="pl-stat-label"><Layers size={13} />Batch / serial tracked</span><span className="pl-stat-value">{counts.tracked}</span>
          <span className="pl-stat-meta">{counts.total ? Math.round((counts.tracked / counts.total) * 100) : 0}% of the catalogue</span>
        </div>
        <button type="button" className={`pl-stat${attention ? ' on' : ''}`} onClick={() => setAttention((a) => !a)}>
          <span className="pl-stat-label"><AlertTriangle size={13} color={counts.attention ? 'var(--vf-warning)' : undefined} />Needs attention</span><span className="pl-stat-value">{counts.attention}</span>
          <span className="pl-stat-meta">Missing code, HSN or GST rate</span>
        </button>
      </div>

      {/* Panel */}
      <div className="pl-panel">
        <div className="pl-toolbar">
          <div className="pl-tabs" role="tablist" aria-label="Status">
            {STATUS_TABS.map((t) => (
              <button key={t.id || 'all'} type="button" role="tab" aria-selected={status === t.id} className={`pl-tab${status === t.id ? ' on' : ''}`} onClick={() => setStatus(t.id)}>
                {t.label}<em>{t.id ? baseFiltered.filter((p) => p.lifecycleStatus === t.id).length : baseFiltered.length}</em>
              </button>
            ))}
          </div>
          <span className="pl-spacer" />
          {!searchTerm && (
            <div className="pl-search">
              <Search size={15} />
              <input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} placeholder="Search name, code, SKU, GTIN, HSN…" aria-label="Search products" />
              {localSearch && <button type="button" className="pl-icon-btn" aria-label="Clear search" onClick={() => setLocalSearch('')}><X size={14} /></button>}
            </div>
          )}
          <button type="button" className={`pl-btn${filtersOpen || filterCount ? ' on' : ''}`} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <Filter size={15} />Filters{filterCount > 0 && <span className="pl-count">{filterCount}</span>}
          </button>
          <div className="pl-seg" role="group" aria-label="View">
            <button type="button" className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} aria-label="Table view" aria-pressed={view === 'table'} title="Table view"><List size={16} /></button>
            <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} title="Grid view"><LayoutGrid size={16} /></button>
          </div>
        </div>

        {filtersOpen && (
          <div className="pl-filters">
            {enabledPacks.length > 1 && (
              <label>Industry
                <select value={pack} onChange={(e) => setPack(e.target.value)}>
                  <option value="">All industries</option>
                  {enabledPacks.map((pk) => <option key={pk.id} value={pk.id}>{pk.name} ({products.filter((p) => packOf(p.productTypeId, productTypes) === pk.id).length})</option>)}
                </select>
              </label>
            )}
            <label>Portfolio
              <select value={portfolio} onChange={(e) => { setPortfolio(e.target.value); setCategory(''); }}>
                <option value="">All portfolios</option>
                {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Product type
              <select value={productType} onChange={(e) => setProductType(e.target.value)}>
                <option value="">All types</option>
                {usedTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>Tracking
              <select value={tracking} onChange={(e) => setTracking(e.target.value)}>
                <option value="">Any tracking</option>
                <option value="Batch + Serial">Batch + serial</option>
                <option value="Batch / Lot">Batch / lot</option>
                <option value="Serial">Serial only</option>
                <option value="None">Not tracked</option>
              </select>
            </label>
            <label>Source
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Any source</option>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        )}

        {chips.length > 0 && (
          <div className="pl-chips">
            {chips.map((c) => <span key={c.label} className="pl-chip">{c.label}<button type="button" aria-label={`Remove ${c.label}`} onClick={c.clear}><X size={12} /></button></span>)}
            <button type="button" className="pl-link" onClick={clearAll}>Clear all</button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="pl-empty">
            <span className="pl-empty-icon"><PackageSearch size={24} /></span>
            {products.length === 0 ? (
              <>
                <h3>No products yet</h3>
                <p>Create your first product, or bring your catalogue in from Excel or your ERP.</p>
                <div className="pl-actions" style={{ justifyContent: 'center' }}>
                  <button type="button" className="pl-btn" onClick={onOpenImport}><FileSpreadsheet size={15} />Import file</button>
                  <button type="button" className="pl-btn pl-btn-primary" onClick={onCreateProduct}><Plus size={16} />New product</button>
                </div>
              </>
            ) : (
              <>
                <h3>No products match</h3>
                <p>Try a different search, or clear the filters.</p>
                <button type="button" className="pl-btn" onClick={clearAll}>Clear all filters</button>
              </>
            )}
          </div>
        ) : view === 'table' ? (
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th className="chk"><input type="checkbox" className="pl-check" checked={allOnPage} onChange={togglePage} aria-label="Select all on this page" /></th>
                  <SortHead k="name" className="pl-prod-col">Product</SortHead>
                  <th className="pl-col-sm">Type &amp; category</th>
                  <th className="pl-col-hide">Tracking</th>
                  <SortHead k="mrp" className="num">MRP</SortHead>
                  <th>Status</th>
                  <SortHead k="updated" className="pl-col-hide">Updated</SortHead>
                  <th className="act"><span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const cat = categoryOf(p);
                  return (
                    <tr key={p.id} className={selectedIds.has(p.id) ? 'sel' : ''} onClick={() => onViewProduct(p.id)}>
                      <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="pl-check" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                      <td>
                        <div className="pl-prod">
                          <Avatar p={p} />
                          <div style={{ minWidth: 0 }}>
                            <div className="pl-name">{p.name}</div>
                            <div className="pl-meta">
                              <span className="pl-mono">{p.code || <span className="pl-muted">no code</span>}</span>
                              <span className="pl-muted">·</span>
                              <span>HSN {p.hsnCode || <span style={{ color: 'var(--vf-warning)' }}>missing</span>}</span>
                              {p.hasVariants && <span className="pl-tag">{p.variants.length} variants</span>}
                              {needsAttention(p) && <span title="Missing code, HSN or GST rate"><AlertTriangle size={13} color="var(--vf-warning)" /></span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="pl-type pl-col-sm" title={`${typeOf(p)?.name ?? ''} — ${portfolioOf(p)?.name ?? 'General'}${cat ? ` › ${cat.name}` : ''}`}>
                        <div className="pl-cell-main">{typeOf(p)?.name ?? '—'}</div>
                        <div className="pl-cell-sub">{portfolioOf(p)?.name ?? 'General'}{cat ? ` › ${cat.name}` : ''}</div>
                      </td>
                      <td className="pl-col-hide"><span className="pl-track">{TRACK_ICON[p.trackingMode]}{p.trackingMode === 'None' ? 'Not tracked' : p.trackingMode}</span></td>
                      <td className="num">{fmtINR(p.pricingReference?.mrp ?? 0) || <span className="pl-muted">—</span>}</td>
                      <td><StatusPill p={p} /></td>
                      <td className="pl-col-hide">
                        <div style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.updatedAt)}</div>
                        <div className="pl-cell-sub" style={{ whiteSpace: 'nowrap' }}>{p.sourceSystem || p.updatedBy}</div>
                      </td>
                      <td className="act" onClick={(e) => e.stopPropagation()}>
                        <span className="pl-row-actions" style={{ display: 'inline-flex', gap: 2 }}>
                          <button type="button" className="pl-icon-btn" aria-label={`View ${p.name}`} title="View" onClick={() => onViewProduct(p.id)}><Eye size={16} /></button>
                          <button type="button" className="pl-icon-btn" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => onEditProduct(p.id)}><Pencil size={15} /></button>
                          <RowMenu>{(close) => moreItems(p, close)}</RowMenu>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pl-grid">
            {rows.map((p) => {
              const [bg] = swatch(p.categoryId || p.portfolioId || p.id);
              return (
                <div key={p.id} className={`pl-card${selectedIds.has(p.id) ? ' sel' : ''}`} onClick={() => onViewProduct(p.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onViewProduct(p.id); }}>
                  <div className="pl-card-top" style={{ background: `linear-gradient(135deg, ${bg}, #fff)` }}>
                    <input type="checkbox" className="pl-check" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${p.name}`} />
                    <Avatar p={p} />
                    <StatusPill p={p} />
                  </div>
                  <div className="pl-card-body">
                    <div className="pl-name">{p.name}</div>
                    <div className="pl-meta"><span className="pl-mono">{p.code}</span>{needsAttention(p) && <AlertTriangle size={13} color="var(--vf-warning)" />}</div>
                    <dl className="pl-card-facts">
                      <dt>Type</dt><dd>{typeOf(p)?.name ?? '—'}</dd>
                      <dt>Category</dt><dd>{categoryOf(p)?.name ?? '—'}</dd>
                      <dt>Tracking</dt><dd>{p.trackingMode === 'None' ? 'Not tracked' : p.trackingMode}</dd>
                      <dt>MRP</dt><dd>{fmtINR(p.pricingReference?.mrp ?? 0) || '—'}</dd>
                    </dl>
                  </div>
                  <div className="pl-card-foot" onClick={(e) => e.stopPropagation()}>
                    <span>{p.hasVariants ? `${p.variants.length} variants · ` : ''}Updated {fmtDate(p.updatedAt)}</span>
                    <span style={{ display: 'inline-flex' }}>
                      <button type="button" className="pl-icon-btn" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => onEditProduct(p.id)}><Pencil size={15} /></button>
                      <RowMenu>{(close) => moreItems(p, close)}</RowMenu>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="pl-foot">
            <span>{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="pl-pager">
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Rows per page">
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
              </select>
              <button type="button" className="pl-icon-btn" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span style={{ padding: '0 6px' }}>Page {current} of {totalPages}</span>
              <button type="button" className="pl-icon-btn" disabled={current >= totalPages} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="pl-bulk" role="toolbar" aria-label="Bulk actions">
          <strong>{selectedIds.size} selected</strong>
          <button type="button" className="pl-btn" onClick={bulkApprove} disabled={!currentUser.permissions.canApproveProducts}
            title={currentUser.permissions.canApproveProducts ? 'Approve the selected products that are pending approval' : 'Your role cannot approve products'}><Check size={15} />Approve</button>
          <button type="button" className="pl-btn" onClick={() => { showToast(`Exporting ${selectedIds.size} selected products…`, 'info'); onOpenExport(); }}><Download size={15} />Export</button>
          <button type="button" className="pl-icon-btn" aria-label="Clear selection" onClick={() => setSelectedIds(new Set())}><X size={16} /></button>
        </div>
      )}

      {packsOpen && <IndustryPacksDrawer onClose={() => setPacksOpen(false)} />}
      {lifecycle && <LifecycleDialog product={lifecycle.product} action={lifecycle.action} onClose={() => setLifecycle(null)} />}
    </div>
  );
};
