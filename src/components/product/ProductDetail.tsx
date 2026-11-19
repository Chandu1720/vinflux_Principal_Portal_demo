import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { Product } from '../../types/product.ts';
import { LifecycleDialog, availableActions } from './LifecycleDialog.tsx';
import type { LifecycleAction } from './LifecycleDialog.tsx';
import { expiryLabel, packOf } from '../../utils/productLifecycle.ts';
import { ComplianceView } from './ComplianceFields.tsx';
import { initialPrincipals } from '../../data/productMasterData.ts';

const principalName = (id?: string) => initialPrincipals.find((x) => x.id === id)?.name ?? id ?? '—';
import { isValidGtin } from '../../utils/gs1.ts';
import { 
  ArrowLeft, 
  Edit3, 
  Copy, 
  Printer, 
  Check, 
  X,
  Plus
} from 'lucide-react';

interface ProductDetailProps {
  productId: string;
  onBack: () => void;
  onEdit: (productId: string) => void;
  onPrintLabel: (product: Product) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  productId,
  onBack,
  onEdit,
  onPrintLabel
}) => {
  const { products, portfolios, productTypes, duplicateProduct, showToast, currentUser, attributeTemplates, industryPacks } = useApp();
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null);

  const [activeTab, setActiveTab] = useState<string>('overview');

  const product = products.find((p) => p.id === productId) || products[0];
  const portfolio = portfolios.find((port) => port.id === product.portfolioId);
  const category = portfolio?.categories.find((c) => c.id === product.categoryId);
  const subCategory = category?.subCategories.find((s) => s.id === product.subCategoryId);
  const pType = productTypes.find((t) => t.id === product.productTypeId);

  const handleDuplicate = () => {
    const cloned = duplicateProduct(product.id);
    showToast(`Product duplicated as "${cloned.name}".`, 'success');
  };

  const isImplant = product.productTypeId === 'type-implant' || product.trackingMode.includes('Batch');
  const primaryId = product.identifiers?.find((id) => id.isPrimary) || product.identifiers?.[0];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'classification', label: 'Classification' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'variants', label: 'Variants & SKUs' },
    { id: 'identifiers', label: 'Identifiers & Barcodes' },
    { id: 'packaging', label: 'UOM & Packaging' },
    { id: 'tracking', label: 'Tracking & Compliance' },
    { id: 'inventoryPolicy', label: 'Inventory Policy & Stock Thresholds' },
    { id: 'documents', label: 'Documents' },
    { id: 'pricing', label: 'Pricing Reference' },
    { id: 'integration', label: 'Integration & External IDs' },
    { id: 'history', label: 'Change History' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--vf-slate-500)' }}>
        <button
          type="button"
          className="vf-btn vf-btn-secondary vf-btn-xs"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ArrowLeft size={13} />
          <span>Product Master</span>
        </button>
        <span>/</span>
        <span>Products</span>
        <span>/</span>
        <strong style={{ color: 'var(--vf-slate-800)' }}>{product.name}</strong>
      </div>

      {/* Product Hero Header */}
      <div className="vf-card" style={{ padding: '20px 24px', display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Placeholder / Image Box */}
        <div className="vf-detail-ph">
          <svg width="48" height="48" viewBox="0 0 72 72" fill="none" stroke="#475569" strokeWidth="2.5">
            <path d="M10 24h52l-6 16H44l-4 22H32l-4-22H16z" />
          </svg>
        </div>

        {/* Product Identity */}
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--vf-slate-900)' }}>
              {product.name.toUpperCase()}
            </h1>
            <span className={`vf-badge ${product.lifecycleStatus === 'Active' ? 'vf-badge-approved' : product.lifecycleStatus === 'Draft' ? 'vf-badge-warning' : 'vf-badge-danger'}`}>
              {product.lifecycleStatus}
            </span>
            <span className="vf-badge vf-badge-type">
              {pType?.name || 'Implant'}
            </span>
            <span className="vf-badge vf-badge-principal">
              {principalName(product.principalId)}
            </span>
            <span className="vf-badge vf-badge-portfolio">
              {portfolio?.name || 'Arthroplasty'}
            </span>
            <span className="vf-badge vf-badge-categery">
              {category?.name}→{subCategory?.name}
            </span>
            <span className="vf-badge vf-badge-tracking">
              {product.trackingMode}
            </span>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Code: <strong>{product.code}</strong></span>
            <span>·</span>
            <span>Internal ID: <code>VF-PROD-{product.id.slice(-6)}</code></span>
            <span>·</span>
            <span>Brand: <strong>{product.brand || 'Genius Evocon'}</strong></span>
            <span>·</span>
            <span>Revision: <strong>Rev 2.4</strong></span>
            <span>·</span>
            <span>Last Updated: {product.updatedAt || '2026-10-31'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="vf-btn vf-btn-secondary"
            onClick={() => onPrintLabel(product)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={14} />
            <span>Print Label</span>
          </button>

          <button
            type="button"
            className="vf-btn vf-btn-secondary"
            onClick={handleDuplicate}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Copy size={14} />
            <span>Clone</span>
          </button>

          {availableActions(product, currentUser.permissions).filter((a) => a !== 'reject').map((a) => (
            <button key={a} type="button" className={`vf-btn ${a === 'retire' ? 'vf-btn-secondary' : 'vf-btn-secondary'}`} onClick={() => setLifecycle(a)}
              style={a === 'retire' ? { color: '#dc2626', borderColor: '#fecaca' } : { color: '#4338ca', borderColor: '#c7d2fe' }}>
              {a === 'submit' ? 'Submit for approval' : a === 'approve' ? 'Review & approve' : 'Retire'}
            </button>
          ))}

          <button
            type="button"
            className="vf-btn vf-btn-primary vf-btn-lg"
            onClick={() => onEdit(product.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Edit3 size={15} />
            <span>Edit Product</span>
          </button>
        </div>
      </div>

      {product.approvalStatus === 'Pending Approval' && (
        <div className="vf-lc-banner pending">
          <span>⏳ <strong>Waiting for approval</strong>{product.submittedBy ? ` — submitted by ${product.submittedBy}${product.submittedAt ? ` on ${product.submittedAt}` : ''}` : ''}.{product.lifecycleStatus === 'Active' ? ' The current approved version stays sellable meanwhile.' : ''}</span>
          {currentUser.permissions.canApproveProducts && <button type="button" className="vf-btn vf-btn-sm vf-btn-primary" onClick={() => setLifecycle('approve')}>Review</button>}
        </div>
      )}
      {product.approvalStatus === 'Rejected' && (
        <div className="vf-lc-banner rejected"><span>↩ <strong>Sent back:</strong> {product.rejectionReason || 'No reason given'}</span></div>
      )}
      {product.lifecycleStatus === 'Retired' && (
        <div className="vf-lc-banner retired"><span><strong>Retired</strong>{product.retireReason ? `: ${product.retireReason}` : ''}. It can’t be ordered; history is kept.</span></div>
      )}

      {/* Tabs Bar */}
      <div className="vf-detail-tabs" role="tablist" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff', padding: '0 12px', borderRadius: '6px 6px 0 0', overflowX: 'auto' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`vf-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT PANES */}
      <div>
        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW (Diagnostic Cards + 11 Top Stat Tiles) */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 11 KPI Highlights Top Bar (.tl) */}
            {/* <div className="vf-detail-tl">
              <div>
                <span>Portfolio</span>
                <b>{portfolio?.name || 'Arthroplasty'}</b>
              </div>
              <div>
                <span>Category</span>
                <b>{category?.name || 'Revision TKR'}</b>
              </div>
              <div>
                <span>Sub-Category</span>
                <b>{subCategory?.name || 'Knee Replacement'}</b>
              </div>
              <div>
                <span>Product Type</span>
                <b>{pType?.name || 'Implant'}</b>
              </div>
              <div>
                <span>Brand</span>
                <b>{product.brand || 'GENIUS EVOCON'}</b>
              </div>
              <div>
                <span>Principal</span>
                <b>{principalName(product.principalId)}</b>
              </div>
              <div>
                <span>Primary GTIN</span>
                <b>{primaryId?.value || product.code}</b>
              </div>
              <div>
                <span>HSN Code</span>
                <b>{product.hsnCode || '90213100'}</b>
              </div>
              <div>
                <span>Tracking</span>
                <b>{product.trackingMode}</b>
              </div>
              <div>
                <span>UOM (Base)</span>
                <b>{product.baseUom || 'Each'}</b>
              </div>
              <div>
                <span>Lifecycle</span>
                <b>{product.lifecycleStatus}</b>
              </div>
            </div> */}

            {/* Diagnostic Grid (.dg) */}
            <div className="vf-detail-dg">
              {/* Card 1: Product Details (c1) */}
              <section className="vf-detail-dc vf-detail-c1">
                <h3>
                  <span>Product Details</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Master Identity</span>
                </h3>
                <dl>
                  <div><dt>Product Name</dt><dd>{product.name}</dd></div>
                  <div><dt>Description</dt><dd>{product.description || 'Tibial tray, full augment, for knee revision arthroplasty.'}</dd></div>
                  <div><dt>Internal Code</dt><dd><code>VF-PROD-{product.id.slice(-6)}</code></dd></div>
                  <div><dt>External Code / SKU</dt><dd><code>{product.code}</code></dd></div>
                  <div><dt>Status</dt><dd><span className={`vf-badge ${product.lifecycleStatus === 'Active' ? 'vf-badge-approved' : 'vf-badge-warning'}`}>{product.lifecycleStatus}</span></dd></div>
                  <div><dt>Template</dt><dd>Implant Structural Template</dd></div>
                </dl>
              </section>

              {/* Card 2: Classification (c2) */}
              <section className="vf-detail-dc vf-detail-c2">
                <h3>
                  <span>Classification</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Taxonomy</span>
                </h3>
                <dl>
                  <div><dt>Portfolio</dt><dd>{portfolio?.name || 'Arthroplasty — Joint Replacement'}</dd></div>
                  <div><dt>Category</dt><dd>{category?.name || 'Genius Evocon Revision TKR'}</dd></div>
                  <div><dt>Sub-Category</dt><dd>{subCategory?.name || 'Knee Replacement'}</dd></div>
                  <div><dt>Product Type</dt><dd>{pType?.name || 'Implant'}</dd></div>
                  <div><dt>Product Template</dt><dd>Implant Template (v2)</dd></div>
                  <div><dt>Industry</dt><dd>Healthcare / Orthopaedics</dd></div>
                </dl>
              </section>

              {/* Card 3: Business Information (c3) */}
              <section className="vf-detail-dc vf-detail-c3">
                <h3>
                  <span>Business Information</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Commercial Entity</span>
                </h3>
                <dl>
                  <div><dt>Principal / Manufacturer</dt><dd>{principalName(product.principalId)}</dd></div>
                  <div><dt>Brand</dt><dd>{product.brand || 'GENIUS EVOCON'}</dd></div>
                  <div><dt>Manufacturer Part No.</dt><dd><code>MPN-{product.code.slice(-6)}</code></dd></div>
                  <div><dt>Supplier / Vendor</dt><dd>Biorad Global Logistics</dd></div>
                  <div><dt>Country of Origin</dt><dd>India (Domestic Manufacturing)</dd></div>
                </dl>
              </section>

              {/* Card 4: Regulatory & Compliance (c4) */}
              <section className="vf-detail-dc vf-detail-c4">
                <h3>
                  <span>Regulatory & Compliance</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Statutory</span>
                </h3>
                <dl>
                  <div><dt>Regulatory Classification</dt><dd>{isImplant ? 'Medical Device (MDR 2017)' : 'Standard Goods'}</dd></div>
                  <div><dt>Regulatory Category</dt><dd>{isImplant ? 'Class III (High-Risk Implant)' : 'General'}</dd></div>
                  <div><dt>UDI Required</dt><dd>{isImplant ? 'Yes (UDI-DI + UDI-PI)' : 'No'}</dd></div>
                  <div><dt>CE Marking</dt><dd>{isImplant ? 'Yes (CE 0123 Notified Body)' : '—'}</dd></div>
                  <div><dt>Certificates</dt><dd>ISO 13485:2016, Free Sale Cert</dd></div>
                </dl>
              </section>

              {/* Card 5: Variant Information (c5) */}
              <section className="vf-detail-dc vf-detail-c5">
                <h3>
                  <span>Variant Information</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Dimensional Matrix</span>
                </h3>
                <dl>
                  <div><dt>Mode</dt><dd>{product.hasVariants ? 'Variant Matrix Product' : 'Simple Product'}</dd></div>
                  <div><dt>Total SKUs / Variants</dt><dd><strong>{product.variantCount || product.variants?.length || '1 (Implicit SKU)'}</strong></dd></div>
                  <div><dt>Variant Sample</dt><dd>Size 3 · Thickness 10mm · Left</dd></div>
                  <div><dt>Configuration</dt><dd>Full Augment Modular Tray</dd></div>
                </dl>
              </section>

              {/* Card 6: UOM & Packaging (c1) */}
              <section className="vf-detail-dc vf-detail-c1">
                <h3>
                  <span>UOM & Packaging</span>
                  <button 
                    type="button" 
                    className="vf-btn vf-btn-secondary vf-btn-xs"
                    onClick={() => onEdit(product.id)}
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    + Edit
                  </button>
                </h3>
                <dl>
                  <div><dt>Base UOM</dt><dd><strong>{product.baseUom || 'Each'}</strong></dd></div>
                  <div><dt>Packaging Levels</dt><dd>{product.uomHierarchy?.length ? `${product.uomHierarchy.length} Configured Levels` : '1 Each (Base only)'}</dd></div>
                  <div>
                    <dt>Packaging Path</dt>
                    <dd>
                      {product.uomHierarchy?.length ? (
                        <span>
                          1 {product.baseUom || 'Each'} 
                          {product.uomHierarchy.map((u) => ` → 1 ${u.level} (${u.factor})`).join('')}
                        </span>
                      ) : (
                        <span>1 {product.baseUom || 'Each'} (Base)</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Permitted Uses</dt>
                    <dd>Stocking, Clinical Sales, Logistics Dispatch</dd>
                  </div>
                </dl>
              </section>

              {/* Card 7: Identifiers & Barcodes (c5) */}
              <section className="vf-detail-dc vf-detail-c5">
                <h3>
                  <span>Identifiers & Barcodes</span>
                  <button 
                    type="button" 
                    className="vf-btn vf-btn-secondary vf-btn-xs"
                    onClick={() => onEdit(product.id)}
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    + Edit
                  </button>
                </h3>
                <dl>
                  <div><dt>Primary Scanning Code</dt><dd><code>{primaryId?.value || product.code}</code> ({primaryId?.type || 'Barcode'})</dd></div>
                  <div><dt>Internal Master SKU</dt><dd><code>{product.code}</code></dd></div>
                  <div>
                    <dt>Registered Codes ({product.identifiers?.length || 0})</dt>
                    <dd>
                      {(!product.identifiers || product.identifiers.length === 0) ? (
                        <span>None configured</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {product.identifiers.map((id, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', border: 'none', padding: 0 }}>
                              <span>{id.type}: <code>{id.value}</code></span>
                              {id.isPrimary && <span className="vf-badge vf-badge-approved" style={{ fontSize: '10px' }}>Primary</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Card 8: Tax & Commercial (c6) */}
              <section className="vf-detail-dc vf-detail-c6">
                <h3>
                  <span>Tax & Commercial</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Pricing Baseline</span>
                </h3>
                <dl>
                  <div><dt>HSN / Commodity Code</dt><dd><code>{product.hsnCode || '90213100'}</code></dd></div>
                  <div><dt>Tax Category</dt><dd>{product.taxRate || 'GST 12% (Medical Devices)'}</dd></div>
                  <div><dt>Reference MRP</dt><dd>₹ {(product.pricingReference?.mrp || 45000).toLocaleString('en-IN')}</dd></div>
                  <div><dt>Dealer Transfer Cap</dt><dd>₹ {(product.pricingReference?.dealerTransferCap || 32000).toLocaleString('en-IN')}</dd></div>
                  <div><dt>Price Control</dt><dd><span className="pro">Connected to Channel Price Lists</span></dd></div>
                </dl>
              </section>

              {/* Card 9: Product Behaviour (c4) */}
              <section className="vf-detail-dc vf-detail-c4">
                <h3>
                  <span>Product Behaviour</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Engine Flags</span>
                </h3>
                <dl>
                  <div>
                    <dt>Procurement Engine</dt>
                    <dd style={{ color: 'var(--vf-success)' }}>
                      <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Purchasable (Standard PO)
                    </dd>
                  </div>
                  <div>
                    <dt>Inventory Engine</dt>
                    <dd style={{ color: 'var(--vf-success)' }}>
                      <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Stockable (Multi-Warehouse Tracked)
                    </dd>
                  </div>
                  <div>
                    <dt>Sales Engine</dt>
                    <dd style={{ color: 'var(--vf-success)' }}>
                      <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Saleable across Distributors
                    </dd>
                  </div>
                  <div>
                    <dt>Quality Control</dt>
                    <dd style={{ color: isImplant ? 'var(--vf-success)' : 'var(--vf-slate-500)' }}>
                      {isImplant ? <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> : <X size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />}
                      {isImplant ? 'Mandatory Inward QC' : 'Not Required'}
                    </dd>
                  </div>
                  <div>
                    <dt>Batch Tracking</dt>
                    <dd style={{ color: product.trackingMode.includes('Batch') ? 'var(--vf-success)' : 'var(--vf-slate-500)' }}>
                      {product.trackingMode.includes('Batch') ? <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> : <X size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />}
                      {product.trackingMode.includes('Batch') ? 'Enabled (Lot / Heat Number)' : 'Off'}
                    </dd>
                  </div>
                  <div>
                    <dt>Serial Tracking</dt>
                    <dd style={{ color: product.trackingMode.includes('Serial') ? 'var(--vf-success)' : 'var(--vf-slate-500)' }}>
                      {product.trackingMode.includes('Serial') ? <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> : <X size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />}
                      {product.trackingMode.includes('Serial') ? 'Enabled (Unit Serial)' : 'Off'}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Card 10: Documents & Media (c3) */}
              <section className="vf-detail-dc vf-detail-c3">
                <h3>
                  <span>Documents & Media</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Regulatory Dossier</span>
                </h3>
                <dl>
                  <div><dt>Technical Spec Sheet</dt><dd><code>TDS-EVOCON-v2.pdf</code></dd></div>
                  <div><dt>CE Compliance Certificate</dt><dd><code>CE-MDR-0123-v1.pdf</code></dd></div>
                  <div><dt>Instructions for Use (IFU)</dt><dd><code>IFU-ORTHO-TKR-rev4.pdf</code></dd></div>
                  <div><dt>Packaging Label Artwork</dt><dd><code>ART-LABEL-TRAY-10MM.ai</code></dd></div>
                </dl>
              </section>

              {/* Card 11: Lifecycle & Audit (c2) */}
              <section className="vf-detail-dc vf-detail-c2">
                <h3>
                  <span>Lifecycle & Audit</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Governance</span>
                </h3>
                <dl>
                  <div><dt>Lifecycle Status</dt><dd><span className={`vf-badge ${product.lifecycleStatus === 'Active' ? 'vf-badge-approved' : 'vf-badge-warning'}`}>{product.lifecycleStatus}</span></dd></div>
                  <div><dt>Approval Status</dt><dd><span className={`vf-badge ${product.approvalStatus === 'Approved' ? 'vf-badge-approved' : 'vf-badge-pending'}`}>{product.approvalStatus}</span></dd></div>
                  <div><dt>Source System</dt><dd>{product.sourceSystem || 'Manual Entry'}</dd></div>
                  <div><dt>Last Updated</dt><dd>{product.updatedAt || '2026-10-31'} by {product.updatedBy || 'Product Admin'}</dd></div>
                  <div><dt>Audit Version</dt><dd>Version 1.0 (Signed)</dd></div>
                  <div>
                    <dt>Audit Trail Entries</dt>
                    <dd>{product.changeHistory?.length || 1} Registered Changes</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CLASSIFICATION */}
        {/* ========================================================= */}
        {activeTab === 'classification' && (() => {
          const boxStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e5e9f2', borderRadius: '16px', boxShadow: '0 1px 2px rgba(15,23,42,.04)', padding: '22px 24px' };
          const titleStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' };
          const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '11px 0', borderBottom: '1px solid #f1f4f9', fontSize: '12.5px' };
          const keyStyle: React.CSSProperties = { color: '#64748b' };
          const valStyle: React.CSSProperties = { color: '#0f172a', fontWeight: 500, textAlign: 'right' };

          const levels = [
            { n: '1. Commercial Portfolio', v: portfolio?.name || 'Arthroplasty — Joint Replacement', tag: (portfolio as any)?.code || 'PORT-ARTH', color: '#4f46e5' },
            { n: '2. Category', v: category?.name || 'Genius Evocon Revision TKR', color: '#4f46e5' },
            { n: '3. Sub-Category', v: subCategory?.name || 'Knee Replacement (Revision)', color: '#818cf8' },
            { n: '4. Product Type', v: pType?.name || 'Implant', badge: 'Physical Asset', color: '#93a3f8' },
            { n: '5. Product Definition', v: product.name, bold: true, color: '#10b981' }
          ];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Hierarchy */}
              <div style={boxStyle}>
                <h3 style={titleStyle}>Universal Enterprise Data Hierarchy</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {levels.map((l, i) => (
                    <div
                      key={l.n}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: `${i * 20}px`, borderLeft: `3px solid ${l.color}`, paddingLeft: '14px', minHeight: '30px' }}
                    >
                      <span style={{ flex: '0 0 150px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#64748b' }}>
                        {l.n}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: l.bold ? 700 : 500, color: '#0f172a' }}>{l.v}</span>
                      {l.tag && <span style={{ fontSize: '11px', color: '#94a3b8' }}>({l.tag})</span>}
                      {l.badge && <span className="vf-badge vf-badge-type">{l.badge}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Two cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '18px', alignItems: 'stretch' }}>
                <div style={boxStyle}>
                  <h3 style={titleStyle}>Commercial Principal Relationship</h3>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>
                    In VinFlux, the <strong style={{ color: '#0f172a' }}>Principal</strong> is a commercial business partner entity (Manufacturer, IP Owner, or Master Supplier), separated from the taxonomy category.
                  </p>
                  <div style={rowStyle}><span style={keyStyle}>Principal Organization</span><span style={valStyle}>{principalName(product.principalId)}</span></div>
                  <div style={rowStyle}><span style={keyStyle}>Principal Code</span><code>BIORAD-MED</code></div>
                  <div style={rowStyle}><span style={keyStyle}>Country of Origin / HQ</span><span style={valStyle}>India</span></div>
                  <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={keyStyle}>Business Entity Role</span><span style={valStyle}>Manufacturer & Principal</span></div>
                </div>

                <div style={boxStyle}>
                  <h3 style={titleStyle}>Brand & Regulatory Classification</h3>
                  <div style={rowStyle}><span style={keyStyle}>Registered Brand</span><span style={valStyle}>{product.brand || 'Genius Evocon'}</span></div>
                  <div style={rowStyle}><span style={keyStyle}>Medical Device Class</span><span style={valStyle}>{isImplant ? 'Class C (High Risk / Implantable)' : 'Class A (Low Risk)'}</span></div>
                  <div style={rowStyle}><span style={keyStyle}>GMDN / EMDN Term</span><span style={valStyle}>Knee joint prosthesis augment (P0902)</span></div>
                  <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={keyStyle}>Sterility Mandate</span><span style={valStyle}>Terminal Sterilization Required</span></div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* TAB 3: ATTRIBUTES */}
        {/* ========================================================= */}
        {activeTab === 'attributes' && (() => {
          const tpl = pType ? attributeTemplates[pType.attributeTemplate] ?? [] : [];
          const extra = Object.entries(product.attributes ?? {}).filter(([k]) => !tpl.some((x) => x.id === k));
          return (
            <div className="vf-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Attributes</h3>
              <div style={{ fontSize: 12.5, color: 'var(--vf-slate-500)', marginBottom: 14 }}>From the “{pType?.name ?? 'product type'}” template · industry pack: {industryPacks.find((x) => x.id === packOf(product.productTypeId, productTypes))?.name}</div>
              <table className="vf-table" style={{ width: '100%' }}>
                <thead><tr><th>Attribute</th><th>Group</th><th>Role</th><th>Value</th><th>Required</th></tr></thead>
                <tbody>
                  {tpl.map((x) => (
                    <tr key={x.id}>
                      <td><strong>{x.name}</strong></td>
                      <td>{x.group}</td>
                      <td>{x.isVariant ? <span className="vf-badge vf-badge-type">Variant</span> : <span className="vf-badge" style={{ background: '#f1f5f9' }}>Descriptive</span>}</td>
                      <td>{x.isVariant && product.hasVariants ? <span style={{ color: 'var(--vf-slate-500)' }}>Per SKU ({product.variants.length})</span> : (product.attributes?.[x.id] || <span style={{ color: 'var(--vf-slate-400)' }}>—</span>)}{x.unit && product.attributes?.[x.id] ? ` ${x.unit}` : ''}</td>
                      <td>{x.required ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                  {extra.map(([k, v]) => <tr key={k}><td><strong>{k}</strong></td><td>Other</td><td /><td>{v}</td><td>No</td></tr>)}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {activeTab === 'variants' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Dimensional SKUs & Product Variants</h3>
                <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                  {product.variants?.length ? `${product.variants.length} variant(s)` : 'Single SKU product (no variants)'}
                </div>
              </div>
            </div>

            <table className="vf-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Variant SKU</th>
                  <th>{(product.variantAxes?.length ? product.variantAxes : ['Size', 'Thickness', 'Side']).join(' · ')}</th>
                  <th>Status</th>
                  <th>GTIN Barcode</th>
                  <th>UOM</th>
                  <th>Stocking Status</th>
                </tr>
              </thead>
              <tbody>
                {(!product.variants || product.variants.length === 0) ? (
                  <tr>
                    <td><code>{product.code}</code></td>
                    <td>Single SKU</td>
                    <td><span className="vf-badge vf-badge-approved">{product.lifecycleStatus}</span></td>
                    <td><code>{product.identifiers?.find((i) => /GTIN/i.test(i.type))?.value ?? '—'}</code></td>
                    <td>{product.baseUom || 'Each'}</td>
                    <td><span className="vf-badge vf-badge-approved">Managed</span></td>
                  </tr>
                ) : (
                  product.variants.map((v, i) => (
                    <tr key={i}>
                      <td><code>{v.sku}</code></td>
                      <td>{[v.size, v.thickness, v.side].filter((x) => x && x !== 'N/A').join(' · ')}</td>
                      <td><span className="vf-badge vf-badge-approved">{v.status || 'Active'}</span></td>
                      <td><code>{v.gtin || '—'}</code>{v.gtin && !isValidGtin(v.gtin) && <div className="vf-exp-bad" style={{ fontSize: 11 }}>Invalid check digit</div>}</td>
                      <td>{product.baseUom || 'Each'}</td>
                      <td><span className="vf-badge vf-badge-approved">Managed</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {product.isKit && (
              <div style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px' }}>Set / Kit Contents</h3>
                <table className="vf-table" style={{ width: '100%' }}>
                  <thead><tr><th>Component</th><th>Variant</th><th style={{ textAlign: 'right' }}>Qty per set</th></tr></thead>
                  <tbody>{(product.kitComponents ?? []).map((c, i) => {
                    const cp = products.find((x) => x.id === c.productId);
                    return <tr key={i}><td><strong>{cp?.name ?? c.productId}</strong><div style={{ fontSize: 11.5, color: 'var(--vf-slate-500)' }}>{cp?.code}</div></td><td>{c.variantSku ? <code>{c.variantSku}</code> : 'Any'}</td><td style={{ textAlign: 'right' }}>{c.qty}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: IDENTIFIERS & BARCODES */}
        {/* ========================================================= */}
        {activeTab === 'identifiers' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Registered Scanning Identifiers</h3>
                <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                  GS1, GTIN, UDI-DI, and warehouse scanning codes.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="vf-btn vf-btn-secondary vf-btn-sm"
                  onClick={() => onPrintLabel(product)}
                >
                  <Printer size={13} style={{ marginRight: '4px' }} />
                  <span>Print Barcode Label</span>
                </button>
                <button
                  type="button"
                  className="vf-btn vf-btn-primary vf-btn-sm"
                  onClick={() => onEdit(product.id)}
                >
                  <Plus size={13} style={{ marginRight: '4px' }} />
                  <span>+ Manage Identifiers</span>
                </button>
              </div>
            </div>

            <table className="vf-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Identifier Type</th>
                  <th>Identifier Value</th>
                  <th>Applies To</th>
                  <th>Source</th>
                  <th>Primary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(!product.identifiers || product.identifiers.length === 0) ? (
                  <tr>
                    <td>Internal SKU</td>
                    <td><code>{product.code}</code></td>
                    <td>Product level</td>
                    <td>VinFlux rule</td>
                    <td><span className="vf-badge vf-badge-approved">Yes</span></td>
                    <td><span className="vf-badge vf-badge-approved">Active</span></td>
                  </tr>
                ) : (
                  product.identifiers.map((id, i) => (
                    <tr key={i}>
                      <td><strong>{id.type}</strong></td>
                      <td><code>{id.value}</code></td>
                      <td>{id.uom || 'Product level'}</td>
                      <td>{id.source || 'Manufacturer'}</td>
                      <td>{id.isPrimary ? <span className="vf-badge vf-badge-approved">✓ Primary</span> : 'No'}</td>
                      <td><span className="vf-badge vf-badge-approved">{id.status || 'Active'}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: UOM & PACKAGING */}
        {/* ========================================================= */}
        {activeTab === 'packaging' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Unit of Measure & Packaging Hierarchy</h3>
                <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                  Base unit: <strong>{product.baseUom || 'Each'}</strong>. Conversions derived strictly from quantities per parent.
                </div>
              </div>
              <button
                type="button"
                className="vf-btn vf-btn-primary vf-btn-sm"
                onClick={() => onEdit(product.id)}
              >
                <Plus size={13} style={{ marginRight: '4px' }} />
                <span>+ Edit Packaging Hierarchy</span>
              </button>
            </div>

            <table className="vf-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Packaging Level</th>
                  <th>Parent Level</th>
                  <th>Qty per Parent</th>
                  <th>= Base Units</th>
                  <th>Permitted Use</th>
                  <th>Dimensions (L×W×H)</th>
                  <th>Gross Weight</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f8fafc' }}>
                  <td><strong>{product.baseUom || 'Each'} (Base)</strong></td>
                  <td>—</td>
                  <td>1</td>
                  <td><strong>1 {product.baseUom || 'Each'}</strong></td>
                  <td>Base Stocking Unit</td>
                  <td>12 × 10 × 4 cm</td>
                  <td>0.12 kg</td>
                </tr>
                {(!product.uomHierarchy || product.uomHierarchy.length === 0) ? (
                  <>
                    <tr>
                      <td><strong>Box</strong></td>
                      <td>{product.baseUom || 'Each'}</td>
                      <td>10</td>
                      <td><strong>10 {product.baseUom || 'Each'}s</strong></td>
                      <td>Clinical Sales & Dispensing</td>
                      <td>25 × 15 × 10 cm</td>
                      <td>0.45 kg</td>
                    </tr>
                    <tr>
                      <td><strong>Carton</strong></td>
                      <td>Box</td>
                      <td>10</td>
                      <td><strong>100 {product.baseUom || 'Each'}s</strong></td>
                      <td>Purchase & Logistic Dispatch</td>
                      <td>60 × 40 × 30 cm</td>
                      <td>5.20 kg</td>
                    </tr>
                  </>
                ) : (
                  product.uomHierarchy.map((u, i) => (
                    <tr key={i}>
                      <td><strong>{u.level}</strong></td>
                      <td>{i === 0 ? (product.baseUom || 'Each') : product.uomHierarchy![i - 1].level}</td>
                      <td>{u.factor / (i === 0 ? 1 : product.uomHierarchy![i - 1].factor || 1)}</td>
                      <td><strong>{u.factor} {product.baseUom || 'Each'}s</strong></td>
                      <td>{u.isSales ? 'Sales' : u.isPurchase ? 'Purchase' : 'Logistics'}</td>
                      <td>{u.dimensions || 'Standard'}</td>
                      <td>{u.weight || '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: TRACKING & COMPLIANCE */}
        {/* ========================================================= */}
        {activeTab === 'tracking' && (() => {
          const pk = packOf(product.productTypeId, productTypes);
          const r = product.regulatory;
          const t = product.trackingRules;
          const lic = expiryLabel(r?.licenceValidUntil, 90);
          return (
            <div className="vf-card" style={{ padding: '24px' }}>
              {pk !== 'medical-devices' && pk !== 'general' && <div style={{ marginBottom: 24 }}><ComplianceView pack={pk} typeId={product.productTypeId} values={product.compliance} /></div>}
              {pk === 'medical-devices' && <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Regulatory Registration (CDSCO, MDR 2017)</h3>}
              {pk !== 'medical-devices' ? null : r ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px', marginBottom: '24px' }}>
                  <div className="vf-breakdown-row"><span>Risk class</span><strong>Class {r.riskClass}</strong></div>
                  <div className="vf-breakdown-row"><span>Licence</span><strong>{r.licenceType}</strong></div>
                  <div className="vf-breakdown-row"><span>Licence number</span><strong>{r.licenceNo || '—'}</strong></div>
                  <div className="vf-breakdown-row"><span>Valid until</span><strong>{r.licenceValidUntil || '—'} {lic && <span className={`vf-exp-${lic.tone}`}>· {lic.text}</span>}</strong></div>
                  <div className="vf-breakdown-row"><span>Implantable</span><strong>{r.implantable ? 'Yes' : 'No'}</strong></div>
                  <div className="vf-breakdown-row"><span>Sterile</span><strong>{r.sterile ? 'Yes' : 'No'}</strong></div>
                  <div className="vf-breakdown-row"><span>Shelf life</span><strong>{r.shelfLifeMonths ? `${r.shelfLifeMonths} months` : 'No expiry'}</strong></div>
                </div>
              ) : <div className="vf-lc-errors" style={{ marginBottom: 20 }}>Regulatory details are missing — edit the product to add the CDSCO risk class and licence.</div>}
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Traceability Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px' }}>
                <div className="vf-breakdown-row"><span>Tracking mode</span><strong>{product.trackingMode}</strong></div>
                <div className="vf-breakdown-row"><span>Manufacturing date</span><strong>{t?.mfgDateRequired ? 'Required at goods receipt' : 'Not required'}</strong></div>
                <div className="vf-breakdown-row"><span>Expiry date</span><strong>{t?.expiryDateRequired ? 'Required (first-expiry-first-out)' : 'Not required'}</strong></div>
                <div className="vf-breakdown-row"><span>Serial numbers</span><strong>{product.trackingMode.includes('Serial') ? 'Required' : 'Not required'}</strong></div>
                <div className="vf-breakdown-row"><span>QC inspection</span><strong>{t?.qcInspectionRequired ? 'Required before release' : 'Not required'}</strong></div>
                <div className="vf-breakdown-row"><span>Min. shelf life to distributors</span><strong>{t?.minShelfLifeDistributorDays ?? '—'} days</strong></div>
                <div className="vf-breakdown-row"><span>Min. shelf life to hospitals</span><strong>{t?.minShelfLifeInstitutionDays ?? '—'} days</strong></div>
                <div className="vf-breakdown-row"><span>UDI-DI</span><strong>{t?.udiDiRequired ? 'Required' : 'Not required'}</strong></div>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* TAB 8: INVENTORY POLICY */}
        {/* ========================================================= */}
        {activeTab === 'inventoryPolicy' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Inventory Holding & Safety Stock Policy</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px', marginBottom: '20px' }}>
              <div className="vf-breakdown-row"><span>Low-Stock Alerting</span><strong>Enabled</strong></div>
              <div className="vf-breakdown-row"><span>Minimum Safety Threshold</span><strong>{product.inventoryPolicy?.minSafetyThreshold || 10} Units</strong></div>
              <div className="vf-breakdown-row"><span>Reorder Point (ROP)</span><strong>{product.inventoryPolicy?.reorderPoint || 20} Units</strong></div>
              <div className="vf-breakdown-row"><span>Standard Replenishment Lead Time</span><strong>7 Days</strong></div>
              <div className="vf-breakdown-row"><span>Tracking Scope</span><strong>Variant + Stocking Point</strong></div>
              <div className="vf-breakdown-row"><span>Stock Notification Destination</span><span>Regional Warehouse Logistics Team</span></div>
            </div>

            <div className="note" style={{ fontSize: '12.5px' }}>
              <b>Note:</b> Inventory policies define thresholds and triggers. Live balances, inward stock receipts, and reservation batches are managed by the VinFlux Inventory Engine.
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 9: DOCUMENTS */}
        {/* ========================================================= */}
        {activeTab === 'documents' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Technical & Regulatory Documents</h3>
            {(product.documents ?? []).length === 0 ? <div style={{ color: 'var(--vf-slate-500)', fontSize: 13 }}>No documents attached.</div> : (
              <table className="vf-table" style={{ width: '100%' }}>
                <thead><tr><th>Document</th><th>Type</th><th>Version</th><th>Effective</th><th>Expiry</th><th>Status</th></tr></thead>
                <tbody>
                  {product.documents.map((d) => {
                    const e = expiryLabel(d.expiry, 90);
                    return (
                      <tr key={d.name + d.version}>
                        <td><strong>{d.name}</strong><div style={{ fontSize: 11.5, color: 'var(--vf-slate-500)' }}>{d.size}</div></td>
                        <td>{d.type}</td><td>{d.version}</td><td>{d.effective}</td>
                        <td>{d.expiry || '—'}{e && <div className={`vf-exp-${e.tone}`} style={{ fontSize: 11.5 }}>{e.text}</div>}</td>
                        <td><span className={`vf-badge ${d.status === 'Approved' ? 'vf-badge-approved' : 'vf-badge-pending'}`}>{d.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 10: PRICING REFERENCE */}
        {/* ========================================================= */}
        {activeTab === 'pricing' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Commercial Pricing Baseline & Statutory HSN</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px', marginBottom: '20px' }}>
              <div className="vf-breakdown-row"><span>HSN / Commodity Code</span><code>{product.hsnCode || '90213100'}</code></div>
              <div className="vf-breakdown-row"><span>GST Tax Bracket</span><strong>{product.taxRate || '12% GST'}</strong></div>
              <div className="vf-breakdown-row"><span>Maximum Retail Price (MRP)</span><strong>₹ {(product.pricingReference?.mrp || 45000).toLocaleString('en-IN')}</strong></div>
              <div className="vf-breakdown-row"><span>Dealer Transfer Ceiling</span><strong>₹ {(product.pricingReference?.dealerTransferCap || 32000).toLocaleString('en-IN')}</strong></div>
              <div className="vf-breakdown-row"><span>Institutional Tender Cap</span><strong>₹ {(product.pricingReference?.institutionalTenderCap || 28000).toLocaleString('en-IN')}</strong></div>
              <div className="vf-breakdown-row"><span>Government Price Cap Enforced</span><strong>Yes (NPPA / DPCO Ceiling Regulated)</strong></div>
            </div>
            <div className="note" style={{ fontSize: '12.5px' }}>
              Specific commercial partner discounts, credit terms, and territory overrides are governed in <strong>GTM Configuration</strong> and <strong>Partner Management</strong>.
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 11: INTEGRATION */}
        {/* ========================================================= */}
        {activeTab === 'integration' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>External Systems & ERP ID Mappings</h3>
            <table className="vf-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Connected System</th>
                  <th>Entity Mapping</th>
                  <th>External Identifier</th>
                  <th>Last Sync</th>
                  <th>Sync Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>External ERP (SAP S/4HANA)</strong></td>
                  <td>Material Master (MARA)</td>
                  <td><code>SAP-MAT-8903209</code></td>
                  <td>2026-10-31 08:30</td>
                  <td><span className="vf-badge vf-badge-approved">Synchronized</span></td>
                </tr>
                <tr>
                  <td><strong>Principal Supplier API</strong></td>
                  <td>Article Reference</td>
                  <td><code>SUP-BMR-4412</code></td>
                  <td>2026-10-30 22:15</td>
                  <td><span className="vf-badge vf-badge-approved">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 12: HISTORY */}
        {/* ========================================================= */}
        {activeTab === 'history' && (
          <div className="vf-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Regulatory Audit Trail & Change History</h3>
            <table className="vf-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Field / Entity</th>
                  <th>Previous Value</th>
                  <th>New Value</th>
                  <th>Changed By</th>
                  <th>Timestamp</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {(!product.changeHistory || product.changeHistory.length === 0) ? (
                  <tr>
                    <td>Lifecycle Status</td>
                    <td>Draft</td>
                    <td>Active</td>
                    <td>Product Admin</td>
                    <td>2026-10-30</td>
                    <td>Initial clinical sign-off and approval</td>
                  </tr>
                ) : (
                  product.changeHistory.map((h, i) => (
                    <tr key={i}>
                      <td><strong>{h.field}</strong></td>
                      <td><code>{h.prevValue}</code></td>
                      <td><span className="vf-badge vf-badge-approved">{h.newValue}</span></td>
                      <td>{h.changedBy}</td>
                      <td>{h.changedAt}</td>
                      <td>{h.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {lifecycle && <LifecycleDialog product={product} action={lifecycle} onClose={() => setLifecycle(null)} />}

    </div>
  );
};
