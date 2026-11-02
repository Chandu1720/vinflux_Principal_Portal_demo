import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { 
  Plus, 
  ArrowLeft, 
  Copy, 
  Edit3, 
  Eye, 
  RotateCcw,
  Sliders
} from 'lucide-react';

interface ConfigurationStudioProps {
  initialSection?: string;
  onBack: () => void;
  onOpenQuickAdd?: (target: string) => void;
}

// Data structures from the wireframe reference
const TRACK = ['None', 'Batch / Lot', 'Serial', 'Batch + Serial'];
const ST = ['Active', 'Inactive'];

const OC: Record<string, Record<string, string[]>> = {
  'Arthroplasty — Joint Replacement': {
    'Genius Evocon Revision TKR': ['Knee Replacement', 'Revision Knee Replacement'],
    'Hip Replacement': ['Primary Hip']
  },
  'Trauma': {
    'Plating Systems': ['Locking Plates']
  },
  'Spine': {
    'Fusion': ['Cervical Cages']
  },
  'Surgical Instruments': {
    'Reusable Instruments': ['Forceps']
  },
  'Consumer Electronics': {
    'Power': ['Chargers']
  },
  'Professional Services': {
    'Support': ['Installation']
  },
  'Software': {
    'Licences': ['Subscriptions']
  }
};

const SEED = () => {
  const mk = (name: string, code: string, desc: string, tmpl: string, attrSet: string, uom: string, variants: boolean, purch: boolean, stock: boolean, sale: boolean, pack: boolean, track: string, qc: boolean) => ({
    name, code, desc, status: 'Active', tmpl, attrSet, uom, variants, purch, stock, sale, pack, track, qc, rules: [] as string[]
  });

  const A = (name: string, dtype: string, variant: boolean, values: string, req: boolean = false, unit: string = '') => ({
    name,
    code: name.toUpperCase().replace(/\W+/g, '_'),
    dtype,
    unit: unit || '',
    req,
    variant,
    search: true,
    filter: true,
    def: '',
    values,
    rule: '',
    status: 'Active'
  });

  const c: Record<string, any[]> = {
    types: [
      mk('Implant', 'IMP', 'Implantable medical device', 'Implant Template', 'Implant Set', 'Each', true, true, true, true, true, 'Batch + Serial', true),
      mk('Goods', 'GDS', 'Physical product', 'Simple Goods', 'Goods Set', 'Each', true, true, true, true, true, 'None', false),
      mk('Service', 'SRV', 'Service offering', 'Service', 'Service Set', 'Hour', false, false, false, true, false, 'None', false),
      mk('Digital', 'DIG', 'Digital product', 'Digital', 'Digital Set', 'Licence', true, false, false, true, false, 'None', false)
    ],
    templates: [
      ['Implant Template', ['Implant'], 'Implant Set'],
      ['Simple Goods', ['Goods'], 'Goods Set'],
      ['Electronics', ['Goods'], 'Goods Set'],
      ['Service', ['Service'], 'Service Set'],
      ['Digital', ['Digital'], 'Digital Set']
    ].map((x) => ({ name: x[0] as string, types: x[1] as string[], attrSet: x[2] as string, status: 'Active' })),
    attrs: [
      A('Material', 'Single Select', false, 'Titanium,CoCr,UHMWPE', true),
      A('Size', 'Single Select', true, '2,3,4', true),
      A('Thickness', 'Measurement', true, '8 mm,10 mm,12 mm', false, 'mm'),
      A('Side', 'Single Select', true, 'Left,Right'),
      A('Sterility', 'Single Select', false, 'Sterile,Non-sterile'),
      A('Implant Type', 'Single Select', false, 'Tibial tray,Femoral component'),
      A('Voltage', 'Number', false, '5 V,12 V'),
      A('Capacity', 'Measurement', true, '10 Ah,20 Ah'),
      A('Colour', 'Single Select', true, 'Black,White'),
      A('Connector Type', 'Single Select', false, 'USB-C,Barrel'),
      A('SLA Hours', 'Number', false, '4,8,24'),
      A('Delivery Mode', 'Single Select', false, 'On-site,Remote'),
      A('Licence Term', 'Single Select', false, '1 year,3 years'),
      A('Platform', 'Multi-Select', false, 'Web,Windows,macOS')
    ],
    attrsets: [
      ['Implant Set', 'Material,Size,Thickness,Side,Sterility,Implant Type'],
      ['Goods Set', 'Voltage,Capacity,Colour,Connector Type'],
      ['Service Set', 'SLA Hours,Delivery Mode'],
      ['Digital Set', 'Licence Term,Platform']
    ].map((x) => ({ name: x[0], attrs: (x[1] as string).split(','), status: 'Active' })),
    trackrules: [
      { name: 'Implant traceability', mode: 'Batch + Serial', mfg: true, exp: true, us: true, qc: true, status: 'Active' },
      { name: 'Consumable lot', mode: 'Batch / Lot', mfg: true, exp: true, us: false, qc: false, status: 'Active' }
    ],
    rules: [
      { name: 'Unique product code', applies: '', rule: 'Code must be unique across products', status: 'Active' },
      { name: 'Implants need UDI identifier', applies: 'Implant', rule: 'At least one UDI identifier before activation', status: 'Active' }
    ],
    portfolios: Object.keys(OC).map((n) => ({ name: n, code: n.slice(0, 3).toUpperCase(), desc: '', status: 'Active' })),
    categories: [] as any[],
    subs: [] as any[],
    uomdef: [
      { name: 'Physical goods default', baseUom: 'Each', purchUom: 'Carton', salesUom: 'Box', status: 'Active' }
    ],
    invdef: [
      { name: 'Implant stocking default', type: 'Implant', lowAlert: true, minQty: 10, scope: 'Variant + Stocking Point', status: 'Active' }
    ]
  };

  Object.entries(OC).forEach(([p, cs]) => {
    Object.entries(cs).forEach(([cn, ss]) => {
      c.categories.push({ name: cn, code: cn.slice(0, 4).toUpperCase(), desc: '', portfolios: [p], status: 'Active' });
      ss.forEach((sn) => c.subs.push({ name: sn, code: sn.slice(0, 4).toUpperCase(), cat: cn, desc: '', status: 'Active' }));
    });
  });

  return c;
};

// Field definitions for each configuration section
const SEC: Record<string, { t: string; cols: string[]; f: [string, string, string, any?][] }> = {
  types: {
    t: 'Product Types',
    cols: ['name', 'code', 'tmpl', 'attrSet', 'track', 'status'],
    f: [
      ['name', 'Type Name', 'text'],
      ['code', 'Type Code', 'text'],
      ['desc', 'Description', 'area'],
      ['status', 'Status', 'sel', ST],
      ['tmpl', 'Default Product Template', 'sel', 'templates'],
      ['attrSet', 'Attribute Set', 'sel', 'attrsets'],
      ['uom', 'Default UOM', 'sel', ['Each', 'Kg', 'Hour', 'Licence']],
      ['track', 'Tracking Mode', 'sel', TRACK],
      ['variants', 'Variant support', 'bool'],
      ['purch', 'Purchasable', 'bool'],
      ['stock', 'Stockable', 'bool'],
      ['sale', 'Saleable', 'bool'],
      ['pack', 'Packaging required', 'bool'],
      ['qc', 'QC required', 'bool'],
      ['rules', 'Applicable validation rules', 'multi', 'rules']
    ]
  },
  templates: {
    t: 'Product Templates',
    cols: ['name', 'types', 'attrSet', 'status'],
    f: [
      ['name', 'Template Name', 'text'],
      ['types', 'Compatible Product Types', 'multi', 'types'],
      ['attrSet', 'Default Attribute Set', 'sel', 'attrsets'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  attrs: {
    t: 'Attributes',
    cols: ['name', 'code', 'dtype', 'variant', 'req', 'status'],
    f: [
      ['name', 'Attribute Name', 'text'],
      ['code', 'Code', 'text'],
      ['dtype', 'Data Type', 'sel', ['Text', 'Number', 'Decimal', 'Boolean', 'Date', 'Date and Time', 'Single Select', 'Multi-Select', 'Measurement', 'Reference', 'Document Reference']],
      ['unit', 'Unit', 'text'],
      ['values', 'Allowed values (comma separated)', 'text'],
      ['def', 'Default value', 'text'],
      ['rule', 'Validation rule', 'text'],
      ['req', 'Required', 'bool'],
      ['variant', 'Variant-enabled', 'bool'],
      ['search', 'Searchable', 'bool'],
      ['filter', 'Filterable', 'bool'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  attrsets: {
    t: 'Attribute Sets',
    cols: ['name', 'attrs', 'status'],
    f: [
      ['name', 'Set Name', 'text'],
      ['attrs', 'Attributes', 'multi', 'attrs'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  trackrules: {
    t: 'Tracking Rules',
    cols: ['name', 'mode', 'status'],
    f: [
      ['name', 'Rule Name', 'text'],
      ['mode', 'Tracking Mode', 'sel', TRACK],
      ['mfg', 'Manufacturing date required', 'bool'],
      ['exp', 'Expiry date required', 'bool'],
      ['us', 'Unique serial required', 'bool'],
      ['qc', 'QC required', 'bool'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  rules: {
    t: 'Validation Rules',
    cols: ['name', 'applies', 'rule', 'status'],
    f: [
      ['name', 'Rule Name', 'text'],
      ['applies', 'Applies to Product Type', 'sel', 'types'],
      ['rule', 'Rule Description', 'text'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  portfolios: {
    t: 'Portfolios',
    cols: ['name', 'code', 'desc', 'status'],
    f: [
      ['name', 'Portfolio Name', 'text'],
      ['code', 'Code', 'text'],
      ['desc', 'Description', 'area'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  categories: {
    t: 'Categories',
    cols: ['name', 'code', 'portfolios', 'status'],
    f: [
      ['name', 'Category Name', 'text'],
      ['code', 'Code', 'text'],
      ['desc', 'Description', 'area'],
      ['portfolios', 'Portfolios (none = shared)', 'multi', 'portfolios'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  subs: {
    t: 'Sub-Categories',
    cols: ['name', 'code', 'cat', 'status'],
    f: [
      ['name', 'Sub-Category Name', 'text'],
      ['code', 'Code', 'text'],
      ['cat', 'Parent Category', 'sel', 'categories'],
      ['desc', 'Description', 'area'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  uomdef: {
    t: 'UOM & Packaging Defaults',
    cols: ['name', 'baseUom', 'purchUom', 'salesUom', 'status'],
    f: [
      ['name', 'Default set name', 'text'],
      ['baseUom', 'Base UOM', 'text'],
      ['purchUom', 'Purchase UOM', 'text'],
      ['salesUom', 'Sales UOM', 'text'],
      ['status', 'Status', 'sel', ST]
    ]
  },
  invdef: {
    t: 'Inventory Policy Defaults',
    cols: ['name', 'type', 'lowAlert', 'minQty', 'scope', 'status'],
    f: [
      ['name', 'Policy name', 'text'],
      ['type', 'Product Type', 'sel', 'types'],
      ['lowAlert', 'Low-stock alert enabled', 'bool'],
      ['minQty', 'Minimum stock quantity', 'num'],
      ['scope', 'Tracking scope', 'sel', ['Product', 'Variant', 'Variant + Stocking Point']],
      ['status', 'Status', 'sel', ST]
    ]
  }
};

const GRP: [string, string[]][] = [
  ['Product Configuration', ['types', 'templates', 'attrs', 'attrsets', 'trackrules', 'rules']],
  ['Classification Management', ['portfolios', 'categories', 'subs']],
  ['Additional Settings', ['uomdef', 'invdef']]
];

export const ConfigurationStudio: React.FC<ConfigurationStudioProps> = ({
  initialSection = 'types',
  onBack
}) => {
  const { showToast } = useApp();

  // Normalize initial section
  const normalizeKey = (key: string) => {
    const map: Record<string, string> = {
      productTypes: 'types',
      productTemplates: 'templates',
      attributes: 'attrs',
      attributeSets: 'attrsets',
      trackingRules: 'trackrules',
      validationRules: 'rules',
      portfolios: 'portfolios',
      categories: 'categories',
      subCategories: 'subs',
      uomPackaging: 'uomdef',
      inventoryPolicy: 'invdef'
    };
    return map[key] || key;
  };

  const [activeSection, setActiveSection] = useState<string>(normalizeKey(initialSection));

  // Configuration Database state
  const [cfg, setCfg] = useState<Record<string, any[]>>(() => {
    try {
      const saved = localStorage.getItem('vf_pm_cfg');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback to seed
    }
    return SEED();
  });

  // Persist to local storage
  const persistCfg = (newCfg: Record<string, any[]>) => {
    setCfg(newCfg);
    try {
      localStorage.setItem('vf_pm_cfg', JSON.stringify(newCfg));
    } catch (e) {
      // ignore
    }
  };

  // Drawer state for Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [drawerFormData, setDrawerFormData] = useState<Record<string, any>>({});

  const currentSection = SEC[activeSection] || SEC.types;
  const currentRecords = cfg[activeSection] || [];

  // Helper to get active names of a section for dropdowns
  const getActiveNames = (k: string) => {
    return (cfg[k] || []).filter((r) => r.status !== 'Inactive').map((r) => r.name);
  };

  // Open Form Drawer
  const handleOpenForm = (index: number, readOnly: boolean = false) => {
    setEditingIndex(index);
    setIsReadOnly(readOnly);
    if (index >= 0) {
      setDrawerFormData({ ...currentRecords[index] });
    } else {
      const initialVals: Record<string, any> = { status: 'Active' };
      currentSection.f.forEach(([k, , t]) => {
        if (t === 'bool') initialVals[k] = false;
        else if (t === 'multi') initialVals[k] = [];
        else initialVals[k] = '';
      });
      initialVals.status = 'Active';
      setDrawerFormData(initialVals);
    }
    setIsDrawerOpen(true);
  };

  // Save Record
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerFormData.name?.trim()) {
      showToast('Name is required.', 'danger');
      return;
    }

    const trimmedName = drawerFormData.name.trim();
    // Unique check
    const isDuplicate = currentRecords.some((x, i) => i !== editingIndex && x.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      showToast('A configuration record with this name already exists.', 'danger');
      return;
    }

    const updated = { ...drawerFormData, name: trimmedName };
    const nextList = [...currentRecords];

    if (editingIndex >= 0) {
      nextList[editingIndex] = updated;
      showToast(`Updated ${currentSection.t.replace(/s$/, '')} "${trimmedName}".`, 'success');
    } else {
      nextList.push(updated);
      showToast(`Created ${currentSection.t.replace(/s$/, '')} "${trimmedName}".`, 'success');
    }

    const nextCfg = { ...cfg, [activeSection]: nextList };
    persistCfg(nextCfg);
    setIsDrawerOpen(false);
  };

  // Duplicate Record
  const handleDuplicate = (index: number) => {
    const orig = currentRecords[index];
    const duplicated = {
      ...JSON.parse(JSON.stringify(orig)),
      name: `${orig.name} (Copy)`,
      code: orig.code ? `${orig.code}-2` : undefined,
      status: 'Inactive'
    };
    const nextList = [...currentRecords, duplicated];
    const nextCfg = { ...cfg, [activeSection]: nextList };
    persistCfg(nextCfg);
    showToast(`Duplicated "${orig.name}" as inactive copy.`, 'info');
  };

  // Toggle Status
  const handleToggleStatus = (index: number) => {
    const orig = currentRecords[index];
    const nextStatus = orig.status === 'Active' ? 'Inactive' : 'Active';
    const nextList = [...currentRecords];
    nextList[index] = { ...orig, status: nextStatus };
    const nextCfg = { ...cfg, [activeSection]: nextList };
    persistCfg(nextCfg);
    showToast(`Status changed to ${nextStatus}.`, 'info');
  };

  // Reset to Seed
  const handleResetSampleData = () => {
    const seedData = SEED();
    persistCfg(seedData);
    showToast('Configuration reset to default reference sample data.', 'success');
  };

  // Helper to format cell values
  const formatCell = (val: any) => {
    if (Array.isArray(val)) return val.join(', ') || '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (val === 'Active') return <span className="vf-badge vf-badge-approved">Active</span>;
    if (val === 'Inactive') return <span className="vf-badge vf-badge-warning">Inactive</span>;
    return String(val || '—');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
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
          <span>Configure</span>
          <span>/</span>
          <strong style={{ color: 'var(--vf-slate-800)' }}>{currentSection.t}</strong>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="vf-btn vf-btn-secondary"
            onClick={handleResetSampleData}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RotateCcw size={13} />
            <span>Reset Sample Data</span>
          </button>

          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={() => handleOpenForm(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
          >
            <Plus size={15} />
            <span>+ New {currentSection.t.replace(/s$/, '')}</span>
          </button>
        </div>
      </div>

      {/* Main Configuration Layout: Sidebar + Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left Sub-Navigation */}
        <div className="vf-card" style={{ padding: '12px' }}>
          {GRP.map(([groupName, sectionKeys], gIdx) => (
            <div key={gIdx} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--vf-slate-400)', padding: '6px 8px', letterSpacing: '0.4px' }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {sectionKeys.map((k) => {
                  const s = SEC[k];
                  const isActive = activeSection === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      style={{
                        textAlign: 'left',
                        padding: '7px 10px',
                        border: 'none',
                        background: isActive ? '#eff6ff' : 'transparent',
                        color: isActive ? 'var(--vf-primary)' : 'var(--vf-slate-700)',
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => setActiveSection(k)}
                    >
                      <span>{s.t}</span>
                      <span style={{ fontSize: '11px', color: 'var(--vf-slate-400)', background: '#f1f5f9', padding: '1px 6px', borderRadius: '10px' }}>
                        {(cfg[k] || []).length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Content Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div className="note" style={{ fontSize: '12.5px' }}>
            All product forms, filters, and validation rules read dynamically from these exact configuration records.
          </div>

          <div className="vf-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  {currentSection.t}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--vf-slate-500)', marginTop: '2px' }}>
                  {currentRecords.length} records configured
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="vf-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    {currentSection.cols.map((colKey) => {
                      const matchField = currentSection.f.find((f) => f[0] === colKey);
                      const headerTitle = matchField ? matchField[1] : colKey.toUpperCase();
                      return <th key={colKey}>{headerTitle}</th>;
                    })}
                    <th style={{ textAlign: 'right', minWidth: '180px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={currentSection.cols.length + 1} style={{ textAlign: 'center', padding: '32px', color: 'var(--vf-slate-400)' }}>
                        Nothing configured yet. Click <strong>+ New {currentSection.t.replace(/s$/, '')}</strong> to create the first record.
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((row, idx) => (
                      <tr key={idx}>
                        {currentSection.cols.map((colKey) => (
                          <td key={colKey}>
                            {colKey === 'name' ? (
                              <strong style={{ color: 'var(--vf-slate-900)' }}>{row[colKey]}</strong>
                            ) : colKey === 'code' ? (
                              <code>{row[colKey]}</code>
                            ) : (
                              formatCell(row[colKey])
                            )}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', fontSize: '12px' }}>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => handleOpenForm(idx, true)}
                              title="View details"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => handleOpenForm(idx, false)}
                              title="Edit configuration"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => handleDuplicate(idx)}
                              title="Duplicate as inactive copy"
                            >
                              <Copy size={12} />
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              style={{ color: row.status === 'Active' ? 'var(--vf-warning)' : 'var(--vf-success)' }}
                              onClick={() => handleToggleStatus(idx)}
                              title={row.status === 'Active' ? 'Deactivate record' : 'Activate record'}
                            >
                              {row.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONFIGURATION FORM SIDE DRAWER (FROM THE HTML WIREFRAME) */}
      {/* ============================================================== */}
      {isDrawerOpen && (
        <div
          className="vf-drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDrawerOpen(false);
          }}
        >
          <div className="vf-drawer vf-drawer-md" style={{ width: '640px' }}>
            
            {/* Header */}
            <div className="vf-drawer-header">
              <div className="vf-drawer-title-wrap">
                <h3 className="vf-drawer-title">
                  <Sliders size={18} className="text-blue-600" />
                  <span>
                    {isReadOnly 
                      ? `View ${currentSection.t.replace(/s$/, '')}: ${drawerFormData.name}`
                      : editingIndex >= 0 
                      ? `Edit ${currentSection.t.replace(/s$/, '')}: ${drawerFormData.name}` 
                      : `New ${currentSection.t.replace(/s$/, '')}`
                    }
                  </span>
                </h3>
                <p className="vf-drawer-subtitle">
                  Configure structural rules and taxonomies defined in Product Master specifications.
                </p>
              </div>
              <button
                type="button"
                className="vf-drawer-close"
                onClick={() => setIsDrawerOpen(false)}
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveRecord} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {editingIndex >= 0 && !isReadOnly && (
                  <div className="note" style={{ fontSize: '11.5px' }}>
                    Note: Updating this configuration record will be reflected in all product selection lists and filters.
                  </div>
                )}

                {/* Dynamic Fields from SEC[k].f */}
                {currentSection.f.map(([fieldKey, fieldLabel, fieldType, rawOptions]) => {
                  const val = drawerFormData[fieldKey];

                  // Resolve options if function/ref key
                  let options: string[] = [];
                  if (typeof rawOptions === 'string') {
                    options = getActiveNames(rawOptions);
                  } else if (Array.isArray(rawOptions)) {
                    options = rawOptions;
                  }

                  // 1. Boolean Checkbox
                  if (fieldType === 'bool') {
                    return (
                      <div key={fieldKey} style={{ paddingTop: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isReadOnly ? 'default' : 'pointer', fontSize: '13px' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            disabled={isReadOnly}
                            onChange={(e) => setDrawerFormData({ ...drawerFormData, [fieldKey]: e.target.checked })}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--vf-slate-800)' }}>{fieldLabel}</span>
                        </label>
                      </div>
                    );
                  }

                  // 2. Select Single Option
                  if (fieldType === 'sel') {
                    return (
                      <div key={fieldKey}>
                        <label className="vf-form-label">{fieldLabel}</label>
                        <select
                          className="vf-form-control"
                          value={val || ''}
                          disabled={isReadOnly}
                          onChange={(e) => setDrawerFormData({ ...drawerFormData, [fieldKey]: e.target.value })}
                        >
                          <option value="">— Select Option —</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  // 3. Multi-Select Checkboxes
                  if (fieldType === 'multi') {
                    const selectedArr: string[] = Array.isArray(val) ? val : [];
                    return (
                      <div key={fieldKey} style={{ border: '1px solid var(--vf-slate-200)', borderRadius: '6px', padding: '12px', background: '#f8fafc' }}>
                        <label className="vf-form-label" style={{ marginBottom: '8px' }}>{fieldLabel}</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                          {options.length === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--vf-slate-400)' }}>No available options configured yet.</span>
                          ) : (
                            options.map((opt) => {
                              const isChecked = selectedArr.includes(opt);
                              return (
                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: isReadOnly ? 'default' : 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isReadOnly}
                                    onChange={(e) => {
                                      const next = e.target.checked 
                                        ? [...selectedArr, opt]
                                        : selectedArr.filter((x) => x !== opt);
                                      setDrawerFormData({ ...drawerFormData, [fieldKey]: next });
                                    }}
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 4. Textarea
                  if (fieldType === 'area') {
                    return (
                      <div key={fieldKey}>
                        <label className="vf-form-label">{fieldLabel}</label>
                        <textarea
                          rows={3}
                          className="vf-form-control"
                          value={val || ''}
                          disabled={isReadOnly}
                          onChange={(e) => setDrawerFormData({ ...drawerFormData, [fieldKey]: e.target.value })}
                        />
                      </div>
                    );
                  }

                  // 5. Standard Text or Number Input
                  return (
                    <div key={fieldKey}>
                      <label className="vf-form-label">{fieldLabel} {fieldKey === 'name' ? '*' : ''}</label>
                      <input
                        type={fieldType === 'num' ? 'number' : 'text'}
                        className="vf-form-control"
                        value={val !== undefined ? val : ''}
                        disabled={isReadOnly}
                        required={fieldKey === 'name'}
                        onChange={(e) => setDrawerFormData({
                          ...drawerFormData,
                          [fieldKey]: fieldType === 'num' ? (parseInt(e.target.value) || 0) : e.target.value
                        })}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Drawer Footer */}
              <div className="vf-drawer-footer">
                <button
                  type="button"
                  className="vf-btn vf-btn-secondary"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  {isReadOnly ? 'Close' : 'Cancel'}
                </button>
                {!isReadOnly && (
                  <button
                    type="submit"
                    className="vf-btn vf-btn-primary"
                    style={{ fontWeight: 700 }}
                  >
                    ✓ Save {currentSection.t.replace(/s$/, '')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
