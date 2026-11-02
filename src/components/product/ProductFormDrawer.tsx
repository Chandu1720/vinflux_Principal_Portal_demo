import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { 
  Product, 
  ProductIdentifier, 
  UomHierarchyItem, 
  ProductVariant, 
  ProductDocument 
} from '../../types/product.ts';
import { 
  Package, 
  Trash2, 
  Plus, 
  Sparkles, 
  Check, 
  Upload, 
  FileText, 
  Barcode, 
  Sliders, 
  DollarSign, 
  CheckCircle2 
} from 'lucide-react';

interface ProductFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editProductId: string | null;
}

export const ProductFormDrawer: React.FC<ProductFormDrawerProps> = ({
  isOpen,
  onClose,
  editProductId
}) => {
  const { products, portfolios, productTypes, addProduct, updateProduct, showToast } = useApp();

  const isEditMode = Boolean(editProductId);
  const editingProduct = editProductId ? products.find((p) => p.id === editProductId) : null;

  // Active Wizard Step (1 to 10)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    code: '',
    description: '',
    portfolioId: '',
    categoryId: '',
    subCategoryId: '',
    principalId: 'Biorad Medisys Pvt Ltd',
    brand: 'Genius Evocon',
    productTypeId: 'type-implant',
    baseUom: 'Each',
    trackingMode: 'Batch + Serial',
    hsnCode: '90213100',
    taxRate: '12% GST',
    sourceSystem: 'Manual Creation',
    lifecycleStatus: 'Active',
    approvalStatus: 'Approved',
    hasVariants: false,
    externalRef: '',
    attributes: {},
    variants: [],
    identifiers: [],
    uomHierarchy: [],
    documents: []
  });

  // Variant Matrix state
  const [hasVariantsToggle, setHasVariantsToggle] = useState<boolean>(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, boolean>>({});

  // Identifier creation input state (KEPT AS IT IS)
  const [newIdType, setNewIdType] = useState('Barcode');
  const [newIdValue, setNewIdValue] = useState('');
  const [newIdApplies, setNewIdApplies] = useState('Product level');
  const [newIdSource, setNewIdSource] = useState('Internal');

  // Load editing product or default blank state
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        ...editingProduct,
        attributes: editingProduct.attributes ? { ...editingProduct.attributes } : {},
        identifiers: editingProduct.identifiers ? [...editingProduct.identifiers] : [],
        uomHierarchy: editingProduct.uomHierarchy ? [...editingProduct.uomHierarchy] : [],
        variants: editingProduct.variants ? [...editingProduct.variants] : [],
        documents: editingProduct.documents ? [...editingProduct.documents] : []
      });
      setHasVariantsToggle(!!editingProduct.hasVariants);
      
      const initSelected: Record<string, boolean> = {};
      (editingProduct.variants || []).forEach(v => {
        initSelected[v.id || v.sku] = true;
      });
      setSelectedVariants(initSelected);
    } else {
      const nextCode = `8903${Math.floor(100000000 + Math.random() * 900000000)}`;
      const defaultPort = portfolios[0];
      const defaultCat = defaultPort?.categories[0];
      const defaultSub = defaultCat?.subCategories[0];
      const defaultType = productTypes[0];

      setFormData({
        name: '',
        code: nextCode,
        description: '',
        portfolioId: defaultPort?.id || '',
        categoryId: defaultCat?.id || '',
        subCategoryId: defaultSub?.id || '',
        principalId: 'Biorad Medisys Pvt Ltd',
        brand: 'Genius Evocon',
        productTypeId: defaultType?.id || 'type-implant',
        baseUom: 'Each',
        trackingMode: 'Batch + Serial',
        hsnCode: '90213100',
        taxRate: '5%',
        sourceSystem: 'Manual Creation',
        externalRef: `MAT-SAP-${Math.floor(100000 + Math.random() * 900000)}`,
        hasVariants: false,
        lifecycleStatus: 'Active',
        approvalStatus: 'Approved',
        attributes: {
          material: 'Titanium Alloy (Ti6Al4V ELI)',
          site: 'Knee - Tibial Tray',
          implantSize: 'Size 3',
          thickness: '10 mm',
          laterality: 'Universal / Bilateral',
          sterility: 'Sterile - Gamma Radiation'
        },
        trackingRules: {
          mode: 'Batch + Serial',
          mfgDateRequired: true,
          expiryDateRequired: true,
          minShelfLifeDistributorDays: 365,
          minShelfLifeInstitutionDays: 180,
          udiDiRequired: true,
          qcInspectionRequired: true
        },
        inventoryPolicy: {
          inheritDefaults: true,
          minSafetyThreshold: 50,
          reorderPoint: 75,
          reorderQty: 100,
          leadTimeDays: 45,
          safetyStockDays: 60
        },
        pricingReference: {
          isEngineConnected: true,
          engineSource: 'VinFlux Pricing Engine v3.2',
          lastSync: '2026-11-01',
          mrp: 48500,
          currency: 'INR',
          dealerTransferCap: 34000,
          institutionalTenderCap: 29500,
          govPriceCapEnforced: true,
          marginFloorPercent: 18,
          priceListsLinked: ['Tier 1 Standard Distribution']
        },
        identifiers: [
          {
            type: 'Internal SKU',
            value: nextCode,
            isPrimary: true,
            uom: 'Product level',
            source: 'VinFlux rule',
            status: 'Active'
          },
          {
            type: 'GTIN',
            value: `0${nextCode}`,
            isPrimary: false,
            uom: 'Product level',
            source: 'Manufacturer',
            status: 'Active'
          }
        ],
        uomHierarchy: [
          {
            level: 'Box',
            uom: 'Box',
            factor: 10,
            isBase: false,
            isSales: true,
            isPurchase: false,
            dimensions: '25 × 15 × 10 cm',
            weight: '0.45 kg',
            barcode: `BX-${nextCode}`
          },
          {
            level: 'Carton',
            uom: 'Carton',
            factor: 100,
            isBase: false,
            isSales: false,
            isPurchase: true,
            dimensions: '60 × 40 × 30 cm',
            weight: '5.20 kg',
            barcode: `CT-${nextCode}`
          }
        ],
        documents: [
          {
            name: 'Instructions For Use (IFU) - Rev D',
            type: 'IFU / Clinical Manual',
            version: 'v4.1',
            effective: '2025-01-15',
            expiry: '2028-01-15',
            status: 'Approved',
            size: '2.4 MB PDF'
          },
          {
            name: 'CE Certificate Annex IX',
            type: 'MDR Regulatory Clearance',
            version: 'v2.0',
            effective: '2024-06-10',
            expiry: '2029-06-09',
            status: 'Approved',
            size: '1.8 MB PDF'
          }
        ]
      });
      setHasVariantsToggle(false);
      setSelectedVariants({
        'EVO-SZ2-10MM-L': true,
        'EVO-SZ2-10MM-R': true,
        'EVO-SZ3-10MM-L': true,
        'EVO-SZ3-10MM-R': true,
        'EVO-SZ4-15MM-L': true,
        'EVO-SZ4-15MM-R': true
      });
    }
    setCurrentStep(1);
  }, [editProductId, editingProduct, isOpen, portfolios, productTypes]);

  if (!isOpen) return null;

  // Selected portfolio & categories
  const currentPortfolio = portfolios.find((p) => p.id === formData.portfolioId) || portfolios[0];
  const availableCategories = currentPortfolio?.categories || [];
  const currentCategory = availableCategories.find((c) => c.id === formData.categoryId) || availableCategories[0];
  const availableSubCategories = currentCategory?.subCategories || [];

  // -------------------------------------------------------------
  // STEPPER NAVIGATION
  // -------------------------------------------------------------
  const wizardSteps = [
    { num: 1, label: 'Basic Info' },
    { num: 2, label: 'Classification' },
    { num: 3, label: 'Attributes' },
    { num: 4, label: 'Variants & SKUs' },
    { num: 5, label: 'Identifiers' },
    { num: 6, label: 'UOM & Packaging' },
    { num: 7, label: 'Tracking & Inventory' },
    { num: 8, label: 'Documents' },
    { num: 9, label: 'Pricing Reference' },
    { num: 10, label: 'Review & Submit' }
  ];

  const handleNextStep = () => {
    // Validate Step 1
    if (currentStep === 1) {
      if (!formData.name?.trim()) {
        showToast('Product Name is required to proceed.', 'danger');
        return;
      }
      if (!formData.code?.trim()) {
        showToast('Product Code / Primary Key is required.', 'danger');
        return;
      }
    }
    if (currentStep < 10) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleAutoGenerateCode = (checked: boolean) => {
    if (checked) {
      const generated = `8903${Math.floor(100000000 + Math.random() * 900000000)}`;
      setFormData((prev) => ({ ...prev, code: generated }));
      showToast(`Auto-generated GTIN/Code: ${generated}`, 'info');
    }
  };

  // -------------------------------------------------------------
  // DYNAMIC ATTRIBUTES HANDLERS (STEP 3)
  // -------------------------------------------------------------
  const handleAttributeChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [key]: value
      }
    }));
  };

  // -------------------------------------------------------------
  // IDENTIFIERS: ADD & DELETE HANDLERS (KEPT AS IT IS)
  // -------------------------------------------------------------
  const handleAddIdentifier = () => {
    const trimmedVal = newIdValue.trim();
    if (!trimmedVal) {
      showToast('Please enter an identifier value.', 'warning');
      return;
    }

    const currentIds = formData.identifiers || [];
    const isDuplicate = currentIds.some((id) => id.value.toLowerCase() === trimmedVal.toLowerCase());
    if (isDuplicate) {
      showToast('An identifier with this value already exists on this product.', 'danger');
      return;
    }

    const newId: ProductIdentifier = {
      type: newIdType,
      value: trimmedVal,
      isPrimary: currentIds.length === 0,
      uom: newIdApplies,
      source: newIdSource,
      status: 'Active'
    };

    setFormData((prev) => ({
      ...prev,
      identifiers: [...(prev.identifiers || []), newId]
    }));

    setNewIdValue('');
    showToast(`Added identifier ${newIdType} (${trimmedVal}).`, 'success');
  };

  const handleDeleteIdentifier = (index: number) => {
    setFormData((prev) => {
      const nextIds = [...(prev.identifiers || [])];
      const removed = nextIds.splice(index, 1)[0];
      if (removed?.isPrimary && nextIds.length > 0) {
        nextIds[0].isPrimary = true;
      }
      return { ...prev, identifiers: nextIds };
    });
    showToast('Identifier removed.', 'info');
  };

  const handleMakePrimaryIdentifier = (index: number) => {
    setFormData((prev) => {
      const nextIds = (prev.identifiers || []).map((id, i) => ({
        ...id,
        isPrimary: i === index
      }));
      return { ...prev, identifiers: nextIds };
    });
    showToast('Primary identifier updated.', 'info');
  };

  const handleGenerateRuleBarcode = () => {
    const genVal = `GEN-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newId: ProductIdentifier = {
      type: 'Barcode',
      value: genVal,
      isPrimary: false,
      uom: 'Product level',
      source: 'Internal (Rule Generated)',
      status: 'Active'
    };
    setFormData((prev) => ({
      ...prev,
      identifiers: [...(prev.identifiers || []), newId]
    }));
    showToast(`Generated rule barcode: ${genVal}`, 'success');
  };

  // -------------------------------------------------------------
  // UOM & PACKAGING: ADD & DELETE HANDLERS (KEPT AS IT IS)
  // -------------------------------------------------------------
  const handleAddUomLevel = () => {
    setFormData((prev) => {
      const currentLevels = prev.uomHierarchy || [];
      const count = currentLevels.length;

      let defaultName = 'Box';
      let prevFactor = 1;

      if (count === 0) {
        defaultName = 'Box';
        prevFactor = 1;
      } else if (count === 1) {
        defaultName = 'Carton';
        prevFactor = currentLevels[0].factor || 10;
      } else if (count === 2) {
        defaultName = 'Pallet';
        prevFactor = currentLevels[1].factor || 100;
      } else {
        defaultName = `Level-${count + 1}`;
        prevFactor = currentLevels[count - 1].factor || 1000;
      }

      const newLevel: UomHierarchyItem = {
        level: defaultName,
        uom: defaultName,
        factor: prevFactor * 10,
        isBase: false,
        isSales: count === 0,
        isPurchase: count > 0,
        dimensions: '40 × 30 × 20 cm',
        weight: '2.5 kg',
        barcode: `PK-${Math.floor(100000 + Math.random() * 900000)}`
      };

      return {
        ...prev,
        uomHierarchy: [...currentLevels, newLevel]
      };
    });
    showToast('Added packaging level.', 'success');
  };

  const handleDeleteUomLevel = (index: number) => {
    setFormData((prev) => {
      const nextLevels = [...(prev.uomHierarchy || [])];
      nextLevels.splice(index, 1);
      return { ...prev, uomHierarchy: nextLevels };
    });
    showToast('Packaging level removed.', 'info');
  };

  const handleUpdateUomLevel = (index: number, field: keyof UomHierarchyItem, value: any) => {
    setFormData((prev) => {
      const nextLevels = [...(prev.uomHierarchy || [])];
      nextLevels[index] = {
        ...nextLevels[index],
        [field]: value
      };
      return { ...prev, uomHierarchy: nextLevels };
    });
  };

  // -------------------------------------------------------------
  // SIMULATED DOCUMENT UPLOAD
  // -------------------------------------------------------------
  const handleSimulateDocumentUpload = () => {
    const docNames = [
      'Packaging Artwork Specifications v2',
      'Bio-compatibility Technical Dossier ISO 10993',
      'Sterilization Validation Certificate gamma',
      'Material Mill Test Report Grade 5 Ti'
    ];
    const picked = docNames[Math.floor(Math.random() * docNames.length)];
    const newDoc: ProductDocument = {
      name: picked,
      type: 'Technical Specification',
      version: `v${Math.floor(1 + Math.random() * 3)}.0`,
      effective: '2026-01-01',
      expiry: '2029-01-01',
      status: 'Approved',
      size: `${(1.2 + Math.random() * 3).toFixed(1)} MB PDF`
    };
    setFormData((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), newDoc]
    }));
    showToast(`Uploaded document: ${picked}`, 'success');
  };

  // -------------------------------------------------------------
  // FORM SUBMISSION (DRAFT OR PUBLISH)
  // -------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      showToast('Please enter a Product Name.', 'danger');
      setCurrentStep(1);
      return;
    }

    const finalStatus = asDraft ? 'Draft' : 'Active';
    const finalAppr = asDraft ? 'Draft' : 'Approved';

    // Assemble variants if enabled
    const finalVariants: ProductVariant[] = hasVariantsToggle
      ? [
          { id: 'EVO-SZ2-10MM-L', sku: 'EVO-SZ2-10MM-L', name: `${formData.name} - Sz 2 / 10mm Left`, size: 'Size 2', thickness: '10 mm', side: 'Left', gtin: '089032090124', status: 'Active' },
          { id: 'EVO-SZ2-10MM-R', sku: 'EVO-SZ2-10MM-R', name: `${formData.name} - Sz 2 / 10mm Right`, size: 'Size 2', thickness: '10 mm', side: 'Right', gtin: '089032090125', status: 'Active' },
          { id: 'EVO-SZ3-10MM-L', sku: 'EVO-SZ3-10MM-L', name: `${formData.name} - Sz 3 / 10mm Left`, size: 'Size 3', thickness: '10 mm', side: 'Left', gtin: '089032090126', status: 'Active' },
          { id: 'EVO-SZ3-10MM-R', sku: 'EVO-SZ3-10MM-R', name: `${formData.name} - Sz 3 / 10mm Right`, size: 'Size 3', thickness: '10 mm', side: 'Right', gtin: '089032090127', status: 'Active' },
          { id: 'EVO-SZ4-15MM-L', sku: 'EVO-SZ4-15MM-L', name: `${formData.name} - Sz 4 / 15mm Left`, size: 'Size 4', thickness: '15 mm', side: 'Left', gtin: '089032090128', status: 'Active' },
          { id: 'EVO-SZ4-15MM-R', sku: 'EVO-SZ4-15MM-R', name: `${formData.name} - Sz 4 / 15mm Right`, size: 'Size 4', thickness: '15 mm', side: 'Right', gtin: '089032090129', status: 'Active' }
        ].filter(v => selectedVariants[v.id] !== false)
      : [];

    if (isEditMode && editingProduct) {
      updateProduct(editingProduct.id, {
        ...formData,
        hasVariants: hasVariantsToggle,
        variantCount: finalVariants.length,
        variants: finalVariants,
        lifecycleStatus: finalStatus,
        approvalStatus: finalAppr,
        updatedAt: '2026-11-02',
        updatedBy: 'Product Admin'
      });
      showToast(`Product "${formData.name}" updated successfully.`, 'success');
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: formData.name!.trim(),
        code: formData.code?.trim() || `8903${Math.floor(100000000 + Math.random() * 900000000)}`,
        description: formData.description || '',
        portfolioId: formData.portfolioId || portfolios[0]?.id || '',
        categoryId: formData.categoryId || availableCategories[0]?.id || '',
        subCategoryId: formData.subCategoryId || availableSubCategories[0]?.id || '',
        principalId: formData.principalId || 'Biorad Medisys Pvt Ltd',
        brand: formData.brand || 'Genius Evocon',
        productTypeId: formData.productTypeId || 'type-implant',
        baseUom: formData.baseUom || 'Each',
        lifecycleStatus: finalStatus,
        approvalStatus: finalAppr,
        trackingMode: (formData.trackingMode as any) || 'Batch + Serial',
        hsnCode: formData.hsnCode || '90213100',
        taxRate: formData.taxRate || '5%',
        sourceSystem: formData.sourceSystem || 'Manual Creation',
        externalRef: formData.externalRef || '',
        hasVariants: hasVariantsToggle,
        variantCount: finalVariants.length,
        updatedAt: '2026-11-02',
        updatedBy: 'Product Admin',
        attributes: formData.attributes || {},
        inventoryPolicy: formData.inventoryPolicy || {
          inheritDefaults: true,
          minSafetyThreshold: 50,
          reorderPoint: 75,
          reorderQty: 100,
          leadTimeDays: 45,
          safetyStockDays: 60
        },
        variants: finalVariants,
        identifiers: formData.identifiers || [],
        uomHierarchy: formData.uomHierarchy || [],
        trackingRules: formData.trackingRules || {
          mode: formData.trackingMode || 'Batch + Serial',
          mfgDateRequired: true,
          expiryDateRequired: true,
          minShelfLifeDistributorDays: 365,
          minShelfLifeInstitutionDays: 180,
          udiDiRequired: true,
          qcInspectionRequired: true
        },
        documents: formData.documents || [],
        pricingReference: formData.pricingReference || {
          isEngineConnected: true,
          engineSource: 'VinFlux Pricing Engine v3.2',
          lastSync: '2026-11-01',
          mrp: 48500,
          currency: 'INR',
          dealerTransferCap: 34000,
          institutionalTenderCap: 29500,
          govPriceCapEnforced: true,
          marginFloorPercent: 18,
          priceListsLinked: ['Tier 1 Standard Distribution']
        },
        integrationMapping: [
          {
            system: 'SAP S/4HANA',
            entityType: 'Material Master',
            externalId: formData.externalRef || 'MAT-SAP-994820',
            status: 'Synced',
            lastSync: '2026-11-01 10:30',
            mappingDirection: 'Bi-directional'
          }
        ],
        changeHistory: [
          {
            field: 'Lifecycle Status',
            prevValue: 'New',
            newValue: finalStatus,
            changedBy: 'Product Admin',
            changedAt: '2026-11-02 11:30',
            reason: isEditMode ? 'Updated via Product Master Side Drawer' : 'Created via Universal Wizard'
          }
        ]
      };

      addProduct(newProduct);
      showToast(`Product "${newProduct.name}" created successfully.`, 'success');
    }

    onClose();
  };

  return (
    <div
      className="vf-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vf-drawer vf-drawer-2xl" style={{ width: '960px' }}>
        
        {/* Wizard Header inside Drawer */}
        <div className="vf-drawer-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--vf-accent)', letterSpacing: '0.05em' }}>
              Product Creation & Architecture Wizard
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={20} className="text-blue-600" />
              <span>{isEditMode ? `Edit Universal Product Definition: ${editingProduct?.name}` : 'Create Universal Product Definition'}</span>
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vf-slate-500)', background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px' }}>
              Step {currentStep} of 10
            </span>
            <button
              type="button"
              className="vf-drawer-close"
              onClick={onClose}
              title="Exit Wizard"
              style={{ fontSize: '20px', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* 10-Step Progress Stepper (Clickable Header Bar) */}
        <div className="vf-stepper" role="tablist" style={{ overflowX: 'auto', background: 'var(--vf-slate-50)', borderBottom: '1px solid var(--vf-slate-200)' }}>
          {wizardSteps.map((step) => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            return (
              <div
                key={step.num}
                className={`vf-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => setCurrentStep(step.num)}
                title={`Jump to Step ${step.num}: ${step.label}`}
                style={{ cursor: 'pointer', padding: '10px 14px', whiteSpace: 'nowrap' }}
              >
                <div className="vf-step-circle" style={{ width: '20px', height: '20px', fontSize: '10px' }}>
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : step.num}
                </div>
                <span style={{ fontSize: '12px' }}>{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Form Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="vf-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            
            {/* ============================================================== */}
            {/* STEP 1: CORE PRODUCT DEFINITION (BASIC INFO) */}
            {/* ============================================================== */}
            {currentStep === 1 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 1: Core Product Definition
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Define the primary identification attributes. Product Type determines downstream behavioral rules and tracking requirements.
                  </p>
                </div>

                <div className="vf-grid-2col" style={{ gap: '16px', marginBottom: '16px' }}>
                  <div className="vf-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="vf-label">
                      Product Name <span style={{ color: 'var(--vf-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="vf-input"
                      placeholder="e.g. GENIUS EVOCON TIBIAL TRAY FULL AUGMENT SIZE 3 — THICKNESS 10MM"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="vf-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="vf-label" style={{ margin: 0 }}>
                        Product Code / Primary Key <span style={{ color: 'var(--vf-danger)' }}>*</span>
                      </label>
                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--vf-accent)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          onChange={(e) => handleAutoGenerateCode(e.target.checked)}
                        />
                        Auto-generate GTIN/Code
                      </label>
                    </div>
                    <input
                      type="text"
                      className="vf-input"
                      placeholder="8903209039234"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>

                  {/* Product Type with Inline Configuration Action */}
                  <div className="vf-form-group">
                    <div className="vf-label-row">
                      <label className="vf-label" style={{ margin: 0 }}>
                        Product Type (Defines Behavior) <span style={{ color: 'var(--vf-danger)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('Product Types configuration managed in Configuration Studio.', 'info')}
                        title="Configure Product Types"
                      >
                        ⚙️ Manage Types
                      </button>
                    </div>
                    <select
                      className="vf-select"
                      value={formData.productTypeId || 'type-implant'}
                      onChange={(e) => setFormData({ ...formData, productTypeId: e.target.value })}
                    >
                      {productTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">Registered Brand Name</label>
                    <input
                      type="text"
                      className="vf-input"
                      placeholder="e.g. Genius Evocon"
                      value={formData.brand || ''}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>

                  <div className="vf-form-group">
                    <div className="vf-label-row">
                      <label className="vf-label" style={{ margin: 0 }}>
                        Base Unit of Measure (Base UOM) <span style={{ color: 'var(--vf-danger)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('UOM standard conversions managed in Configuration Studio.', 'info')}
                        title="Configure UOM Standards"
                      >
                        ⚙️ Manage UOM
                      </button>
                    </div>
                    <select
                      className="vf-select"
                      value={formData.baseUom || 'Each'}
                      onChange={(e) => setFormData({ ...formData, baseUom: e.target.value })}
                    >
                      <option value="Each">Each (Individual Unit)</option>
                      <option value="Set / Tray">Set / Tray</option>
                      <option value="Pack">Pack</option>
                      <option value="Box">Box</option>
                      <option value="License">License / Seat</option>
                    </select>
                  </div>

                  <div className="vf-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="vf-label">Product Clinical / Technical Description</label>
                    <textarea
                      className="vf-input"
                      rows={3}
                      style={{ height: 'auto', padding: '8px 10px' }}
                      placeholder="Detailed technical specifications, clinical indications, anatomical application..."
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 2: TAXONOMY & PRINCIPAL RELATIONSHIP (CLASSIFICATION) */}
            {/* ============================================================== */}
            {currentStep === 2 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 2: Taxonomy & Principal Relationship
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Categorize the product within commercial portfolios. Note: The Principal is a commercial business entity, kept distinct from the product category hierarchy.
                  </p>
                </div>

                <div className="vf-grid-2col" style={{ gap: '16px' }}>
                  {/* Commercial Portfolio */}
                  <div className="vf-form-group">
                    <div className="vf-label-row">
                      <label className="vf-label" style={{ margin: 0 }}>
                        Commercial Portfolio <span style={{ color: 'var(--vf-danger)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('Portfolios managed in Configuration Studio.', 'info')}
                      >
                        ⚙️ Manage Portfolios
                      </button>
                    </div>
                    <select
                      className="vf-select"
                      value={formData.portfolioId || ''}
                      onChange={(e) => {
                        const newPortId = e.target.value;
                        const newPort = portfolios.find((p) => p.id === newPortId);
                        const firstCat = newPort?.categories[0];
                        const firstSub = firstCat?.subCategories[0];
                        setFormData({
                          ...formData,
                          portfolioId: newPortId,
                          categoryId: firstCat?.id || '',
                          subCategoryId: firstSub?.id || ''
                        });
                      }}
                    >
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <div className="vf-form-group">
                    <div className="vf-label-row">
                      <label className="vf-label" style={{ margin: 0 }}>
                        Category <span style={{ color: 'var(--vf-danger)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('Categories managed in Configuration Studio.', 'info')}
                      >
                        ⚙️ Manage Categories
                      </button>
                    </div>
                    <select
                      className="vf-select"
                      value={formData.categoryId || ''}
                      onChange={(e) => {
                        const newCatId = e.target.value;
                        const newCat = availableCategories.find((c) => c.id === newCatId);
                        const firstSub = newCat?.subCategories[0];
                        setFormData({
                          ...formData,
                          categoryId: newCatId,
                          subCategoryId: firstSub?.id || ''
                        });
                      }}
                    >
                      {availableCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-Category */}
                  <div className="vf-form-group">
                    <div className="vf-label-row">
                      <label className="vf-label" style={{ margin: 0 }}>Sub-Category</label>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('Sub-categories managed in Configuration Studio.', 'info')}
                      >
                        ⚙️ Manage Sub-Categories
                      </button>
                    </div>
                    <select
                      className="vf-select"
                      value={formData.subCategoryId || ''}
                      onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                    >
                      {availableSubCategories.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Principal */}
                  <div className="vf-form-group">
                    <label className="vf-label">
                      Principal / Manufacturer Organization <span style={{ color: 'var(--vf-danger)' }}>*</span>
                    </label>
                    <select
                      className="vf-select"
                      value={formData.principalId || 'Biorad Medisys Pvt Ltd'}
                      onChange={(e) => setFormData({ ...formData, principalId: e.target.value })}
                    >
                      <option value="Biorad Medisys Pvt Ltd">Biorad Medisys Pvt Ltd (Principal Org)</option>
                      <option value="Maxx Orthopedics India">Maxx Orthopedics India</option>
                      <option value="Smith & Nephew Healthcare">Smith & Nephew Healthcare</option>
                      <option value="Depuy Synthes J&J">Depuy Synthes J&J</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">
                      HSN / Commodity Code <span style={{ color: 'var(--vf-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="vf-input"
                      value={formData.hsnCode || '90213100'}
                      placeholder="e.g. 90213100 (Artificial Joints)"
                      onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    />
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">Applicable GST / Tax Rate</label>
                    <select
                      className="vf-select"
                      value={formData.taxRate || '5%'}
                      onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    >
                      <option value="5%">5% (Medical Implants / Regulated Goods)</option>
                      <option value="12%">12% (Instruments & Consumables)</option>
                      <option value="18%">18% (Software Licenses / Capital Equipment)</option>
                      <option value="0%">0% (Exempt)</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">Source System</label>
                    <select
                      className="vf-select"
                      value={formData.sourceSystem || 'Manual Creation'}
                      onChange={(e) => setFormData({ ...formData, sourceSystem: e.target.value })}
                    >
                      <option value="Manual Creation">Manual Creation</option>
                      <option value="SAP S/4HANA (Direct Sync)">SAP S/4HANA (Direct Sync)</option>
                      <option value="Oracle Fusion ERP">Oracle Fusion ERP</option>
                      <option value="Excel Master CSV Import">Excel Master CSV Import</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">External Product Reference</label>
                    <input
                      type="text"
                      className="vf-input"
                      placeholder="e.g. MAT-SAP-994820"
                      value={formData.externalRef || ''}
                      onChange={(e) => setFormData({ ...formData, externalRef: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 3: DYNAMIC CONFIGURABLE ATTRIBUTES */}
            {/* ============================================================== */}
            {currentStep === 3 && (
              <div className="vf-step-pane active">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--vf-slate-900)' }}>
                    Step 3: Dynamic Configurable Attributes
                  </h3>
                  <button
                    type="button"
                    className="vf-btn-inline-manage"
                    onClick={() => showToast('Dynamic attribute schemas configured in Configuration Studio.', 'info')}
                  >
                    ⚙️ Configure Attribute Sets
                  </button>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', marginBottom: '20px' }}>
                  These attribute sets are dynamically loaded according to the selected Product Type and Template without requiring hardcoded schema modifications.
                </p>

                <div className="vf-grid-2col" style={{ gap: '16px' }}>
                  <div className="vf-form-group">
                    <label className="vf-label">Material Formulation</label>
                    <select
                      className="vf-select"
                      value={formData.attributes?.material || 'Titanium Alloy (Ti6Al4V ELI)'}
                      onChange={(e) => handleAttributeChange('material', e.target.value)}
                    >
                      <option value="Titanium Alloy (Ti6Al4V ELI)">Titanium Alloy (Ti6Al4V ELI)</option>
                      <option value="Cobalt Chromium (CoCrMo)">Cobalt Chromium (CoCrMo)</option>
                      <option value="PEEK Optima Medical Grade">PEEK Optima Medical Grade</option>
                      <option value="Ultra-High Molecular Weight Polyethylene (UHMWPE)">Ultra-High Molecular Weight Polyethylene (UHMWPE)</option>
                      <option value="Stainless Steel 316L VM">Stainless Steel 316L VM</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">Anatomical Application Site</label>
                    <select
                      className="vf-select"
                      value={formData.attributes?.site || 'Knee - Tibial Tray'}
                      onChange={(e) => handleAttributeChange('site', e.target.value)}
                    >
                      <option value="Knee - Tibial Tray">Knee - Tibial Tray</option>
                      <option value="Knee - Femoral Component">Knee - Femoral Component</option>
                      <option value="Hip - Acetabular Cup">Hip - Acetabular Cup</option>
                      <option value="Hip - Femoral Stem">Hip - Femoral Stem</option>
                      <option value="Spine - Interbody Cage">Spine - Interbody Cage</option>
                      <option value="Trauma - Distal Radius">Trauma - Distal Radius</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">
                      Implant Size <span className="vf-badge vf-badge-type" style={{ fontSize: '9px', padding: '1px 4px', marginLeft: '4px' }}>Generates Variant</span>
                    </label>
                    <select
                      className="vf-select"
                      value={formData.attributes?.implantSize || 'Size 3'}
                      onChange={(e) => handleAttributeChange('implantSize', e.target.value)}
                    >
                      <option value="Size 1">Size 1</option>
                      <option value="Size 2">Size 2</option>
                      <option value="Size 3">Size 3</option>
                      <option value="Size 4">Size 4</option>
                      <option value="Size 5">Size 5</option>
                      <option value="Size 6">Size 6</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">
                      Thickness / Augment Profile <span className="vf-badge vf-badge-type" style={{ fontSize: '9px', padding: '1px 4px', marginLeft: '4px' }}>Generates Variant</span>
                    </label>
                    <select
                      className="vf-select"
                      value={formData.attributes?.thickness || '10 mm'}
                      onChange={(e) => handleAttributeChange('thickness', e.target.value)}
                    >
                      <option value="5 mm">5 mm</option>
                      <option value="10 mm">10 mm</option>
                      <option value="12 mm">12 mm</option>
                      <option value="15 mm">15 mm</option>
                      <option value="18 mm">18 mm</option>
                      <option value="Wedge Profile 10°">Wedge Profile 10°</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">
                      Laterality / Anatomical Side <span className="vf-badge vf-badge-type" style={{ fontSize: '9px', padding: '1px 4px', marginLeft: '4px' }}>Generates Variant</span>
                    </label>
                    <select
                      className="vf-select"
                      value={formData.attributes?.laterality || 'Universal / Bilateral'}
                      onChange={(e) => handleAttributeChange('laterality', e.target.value)}
                    >
                      <option value="Left">Left</option>
                      <option value="Right">Right</option>
                      <option value="Universal / Bilateral">Universal / Bilateral</option>
                    </select>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-label">Sterilization Assurance Modality</label>
                    <select
                      className="vf-select"
                      value={formData.attributes?.sterility || 'Sterile - Gamma Radiation'}
                      onChange={(e) => handleAttributeChange('sterility', e.target.value)}
                    >
                      <option value="Sterile - Gamma Radiation">Sterile - Gamma Radiation (25 kGy)</option>
                      <option value="Sterile - Ethylene Oxide (EtO)">Sterile - Ethylene Oxide (EtO)</option>
                      <option value="Sterile - E-Beam">Sterile - E-Beam</option>
                      <option value="Non-Sterile (Hospital Steam Autoclave Required)">Non-Sterile (Hospital Steam Autoclave Required)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 4: VARIANTS & OPERATIONAL SKU MANAGEMENT */}
            {/* ============================================================== */}
            {currentStep === 4 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 4: Variants & Operational SKU Management
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Simple products map to a single operational SKU. Variant-based products generate combinations from dimensional parameters with preview and validation.
                  </p>
                </div>

                <div style={{ backgroundColor: 'var(--vf-slate-50)', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={hasVariantsToggle}
                      onChange={(e) => {
                        setHasVariantsToggle(e.target.checked);
                        setFormData({ ...formData, hasVariants: e.target.checked });
                      }}
                    />
                    <span>Enable Matrix Variants for this Product (Size, Thickness, Side)</span>
                  </label>
                </div>

                {hasVariantsToggle ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>Generated Combinations Preview</span>
                      <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>Uncheck any invalid or unmanufactured combinations</span>
                    </div>

                    <div className="vf-table-container">
                      <table className="vf-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>Include</th>
                            <th>Generated SKU Code</th>
                            <th>Size</th>
                            <th>Thickness</th>
                            <th>Side</th>
                            <th>Generated GTIN</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { sku: 'EVO-SZ2-10MM-L', size: 'Size 2', thick: '10 mm', side: 'Left', gtin: '089032090124' },
                            { sku: 'EVO-SZ2-10MM-R', size: 'Size 2', thick: '10 mm', side: 'Right', gtin: '089032090125' },
                            { sku: 'EVO-SZ3-10MM-L', size: 'Size 3', thick: '10 mm', side: 'Left', gtin: '089032090126' },
                            { sku: 'EVO-SZ3-10MM-R', size: 'Size 3', thick: '10 mm', side: 'Right', gtin: '089032090127' },
                            { sku: 'EVO-SZ4-15MM-L', size: 'Size 4', thick: '15 mm', side: 'Left', gtin: '089032090128' },
                            { sku: 'EVO-SZ4-15MM-R', size: 'Size 4', thick: '15 mm', side: 'Right', gtin: '089032090129' }
                          ].map((item) => {
                            const isInc = selectedVariants[item.sku] !== false;
                            return (
                              <tr key={item.sku}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isInc}
                                    onChange={(e) => setSelectedVariants({ ...selectedVariants, [item.sku]: e.target.checked })}
                                  />
                                </td>
                                <td><code>{item.sku}</code></td>
                                <td>{item.size}</td>
                                <td>{item.thick}</td>
                                <td>{item.side}</td>
                                <td><code>{item.gtin}</code></td>
                                <td><span className="vf-badge vf-badge-draft">Ready</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', border: '1px dashed var(--vf-slate-300)', borderRadius: '8px' }}>
                    <Sliders size={28} className="text-slate-400" style={{ margin: '0 auto 8px auto' }} />
                    <div style={{ fontWeight: 600, color: 'var(--vf-slate-700)', fontSize: '13px' }}>Single SKU Product Mode</div>
                    <div style={{ fontSize: '12px', color: 'var(--vf-slate-500)', marginTop: '4px' }}>
                      This product operates as a standalone master item without dimensional matrix permutations.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 5: MULTIPLE PRODUCT IDENTIFIERS & BARCODES (KEPT AS IT IS) */}
            {/* ============================================================== */}
            {currentStep === 5 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 5: Multiple Product Identifiers & Barcodes
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Register multiple identifiers (GS1-128, FDA/MDR UDI-DI, 2D DataMatrix, RFID) linked to specific packaging tiers.
                  </p>
                </div>

                {/* Table of Existing Identifiers */}
                <div className="vf-table-container" style={{ marginBottom: '16px' }}>
                  <table className="vf-table">
                    <thead>
                      <tr>
                        <th>Identifier Type</th>
                        <th>Identifier Value / Barcode</th>
                        <th>Primary Key</th>
                        <th>Applies To (UOM)</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.identifiers || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--vf-slate-500)' }}>
                            No identifiers assigned yet. Add one using the form below.
                          </td>
                        </tr>
                      ) : (
                        (formData.identifiers || []).map((id, index) => (
                          <tr key={`${id.type}-${id.value}-${index}`}>
                            <td>
                              <span className="vf-badge vf-badge-neutral" style={{ fontWeight: 600 }}>{id.type}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Barcode size={14} className="text-slate-400" />
                                <code style={{ fontWeight: 700, fontSize: '12.5px' }}>{id.value}</code>
                              </div>
                            </td>
                            <td>
                              {id.isPrimary ? (
                                <span className="vf-badge vf-badge-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Check size={11} /> Primary GTIN
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="vf-btn vf-btn-secondary vf-btn-xs"
                                  onClick={() => handleMakePrimaryIdentifier(index)}
                                  title="Set as primary identifier"
                                >
                                  Make Primary
                                </button>
                              )}
                            </td>
                            <td style={{ fontSize: '12px' }}>{id.uom || 'Product level'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>{id.source || 'Internal'}</td>
                            <td>
                              <span className="vf-badge vf-badge-active">{id.status || 'Active'}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                onClick={() => handleDeleteIdentifier(index)}
                                style={{ color: 'var(--vf-danger)' }}
                                title="Delete Identifier"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add Identifier Control Form (KEPT AS IT IS) */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--vf-slate-200)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={15} />
                      <span>Add New Product Identifier / Barcode</span>
                    </div>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary vf-btn-xs"
                      onClick={handleGenerateRuleBarcode}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Sparkles size={12} className="text-amber-500" />
                      <span>⚡ Generate by Rule</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                    <div>
                      <label className="vf-label" style={{ fontSize: '11px', marginBottom: '4px' }}>TYPE</label>
                      <select
                        className="vf-select"
                        value={newIdType}
                        onChange={(e) => setNewIdType(e.target.value)}
                        style={{ fontSize: '12.5px', padding: '6px 8px' }}
                      >
                        <option value="Barcode">Linear Barcode (Code-128)</option>
                        <option value="GTIN">GS1 GTIN-14</option>
                        <option value="UDI-DI">FDA / MDR UDI-DI</option>
                        <option value="HIBC">Health Industry Barcode (HIBC)</option>
                        <option value="2D DataMatrix">2D DataMatrix GS1</option>
                        <option value="RFID EPC">RFID EPC Gen2 Tag</option>
                        <option value="Catalog No">Catalog / Part No</option>
                      </select>
                    </div>

                    <div>
                      <label className="vf-label" style={{ fontSize: '11px', marginBottom: '4px' }}>IDENTIFIER VALUE / CODE *</label>
                      <input
                        type="text"
                        className="vf-input"
                        placeholder="e.g. 08903209039234"
                        value={newIdValue}
                        onChange={(e) => setNewIdValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIdentifier();
                          }
                        }}
                        style={{ fontSize: '12.5px', padding: '6px 8px' }}
                      />
                    </div>

                    <div>
                      <label className="vf-label" style={{ fontSize: '11px', marginBottom: '4px' }}>APPLIES TO (UOM)</label>
                      <select
                        className="vf-select"
                        value={newIdApplies}
                        onChange={(e) => setNewIdApplies(e.target.value)}
                        style={{ fontSize: '12.5px', padding: '6px 8px' }}
                      >
                        <option value="Product level">Base Unit (Each)</option>
                        <option value="Box level">Box Packaging</option>
                        <option value="Carton level">Master Carton</option>
                        <option value="Pallet level">Pallet Transport Tier</option>
                      </select>
                    </div>

                    <div>
                      <label className="vf-label" style={{ fontSize: '11px', marginBottom: '4px' }}>SOURCE</label>
                      <select
                        className="vf-select"
                        value={newIdSource}
                        onChange={(e) => setNewIdSource(e.target.value)}
                        style={{ fontSize: '12.5px', padding: '6px 8px' }}
                      >
                        <option value="Internal">Internal Rule</option>
                        <option value="Manufacturer">Manufacturer Registry</option>
                        <option value="GS1 India">GS1 India Authorized</option>
                        <option value="Customer Assigned">Customer Assigned</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="vf-btn vf-btn-primary"
                        onClick={handleAddIdentifier}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '35px', padding: '0 12px', fontSize: '12.5px' }}
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 6: UNITS OF MEASURE & PACKAGING HIERARCHY (KEPT AS IT IS) */}
            {/* ============================================================== */}
            {currentStep === 6 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 6: Units of Measure & Packaging Hierarchy
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Establish the packaging hierarchy (Each, Box, Carton) and conversion factors to govern supply chain transport and logistics.
                  </p>
                </div>

                {/* Base UOM Banner */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#16a34a', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                      1
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#166534', fontSize: '13px' }}>
                        Base Unit of Measure: {formData.baseUom || 'Each'} (Multiplier = 1.0)
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#15803d' }}>
                        This is the lowest indivisible unit for stocking, inventory valuation, and hospital dispensing.
                      </div>
                    </div>
                  </div>
                  <span className="vf-badge vf-badge-approved">Core System Standard</span>
                </div>

                {/* Packaging Hierarchy Table (KEPT AS IT IS) */}
                <div className="vf-table-container" style={{ marginBottom: '16px' }}>
                  <table className="vf-table">
                    <thead>
                      <tr>
                        <th>Packaging Level</th>
                        <th>UOM Label</th>
                        <th>Conversion Factor (= Base Units)</th>
                        <th>Permitted Use</th>
                        <th>Dimensions (L × W × H)</th>
                        <th>Gross Weight</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Base row (read only factor) */}
                      <tr style={{ background: '#fbfcfe' }}>
                        <td>
                          <strong>Primary Unit</strong>
                        </td>
                        <td>
                          <span className="vf-badge vf-badge-neutral">{formData.baseUom || 'Each'}</span>
                        </td>
                        <td>
                          <code>1 {formData.baseUom || 'Each'}</code>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--vf-slate-600)' }}>✓ Clinical Dispensing & Stocking</span>
                        </td>
                        <td>10 × 5 × 2 cm</td>
                        <td>0.08 kg</td>
                        <td style={{ textAlign: 'right', color: 'var(--vf-slate-400)', fontSize: '11px' }}>
                          Base Level
                        </td>
                      </tr>

                      {/* Dynamic user configured tiers */}
                      {(formData.uomHierarchy || []).map((tier, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              className="vf-input"
                              value={tier.level}
                              onChange={(e) => handleUpdateUomLevel(idx, 'level', e.target.value)}
                              style={{ width: '110px', padding: '4px 6px', fontSize: '12px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="vf-input"
                              value={tier.uom}
                              onChange={(e) => handleUpdateUomLevel(idx, 'uom', e.target.value)}
                              style={{ width: '100px', padding: '4px 6px', fontSize: '12px' }}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--vf-slate-500)' }}>=</span>
                              <input
                                type="number"
                                className="vf-input"
                                value={tier.factor}
                                onChange={(e) => handleUpdateUomLevel(idx, 'factor', Number(e.target.value) || 1)}
                                style={{ width: '80px', padding: '4px 6px', fontSize: '12px' }}
                              />
                              <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>{formData.baseUom || 'Each'}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!!tier.isSales}
                                  onChange={(e) => handleUpdateUomLevel(idx, 'isSales', e.target.checked)}
                                />
                                Sales
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!!tier.isPurchase}
                                  onChange={(e) => handleUpdateUomLevel(idx, 'isPurchase', e.target.checked)}
                                />
                                Purchase
                              </label>
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="vf-input"
                              value={tier.dimensions || ''}
                              onChange={(e) => handleUpdateUomLevel(idx, 'dimensions', e.target.value)}
                              placeholder="e.g. 25 × 15 × 10 cm"
                              style={{ width: '130px', padding: '4px 6px', fontSize: '12px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="vf-input"
                              value={tier.weight || ''}
                              onChange={(e) => handleUpdateUomLevel(idx, 'weight', e.target.value)}
                              placeholder="e.g. 0.45 kg"
                              style={{ width: '90px', padding: '4px 6px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="vf-btn vf-btn-secondary vf-btn-xs"
                              onClick={() => handleDeleteUomLevel(idx)}
                              style={{ color: 'var(--vf-danger)' }}
                              title="Delete Level"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary"
                    onClick={handleAddUomLevel}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                  >
                    <Plus size={14} />
                    <span>+ Add Packaging Tier</span>
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 7: TRACKING & INVENTORY POLICY THRESHOLDS */}
            {/* ============================================================== */}
            {currentStep === 7 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 7: Traceability, Compliance & Low-Stock Policy Thresholds
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Define the mandatory tracking rules and low-stock replenishment thresholds for this product. Product Master defines the policy threshold contract; Inventory Engine computes live stock.
                  </p>
                </div>

                <div className="vf-grid-2col" style={{ gap: '16px', marginBottom: '20px' }}>
                  {/* Card 1: Traceability & Tracking Rules */}
                  <div className="vf-card" style={{ padding: '16px' }}>
                    <div className="vf-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>Traceability & Tracking Rules</span>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('Tracking rules managed in Configuration Studio.', 'info')}
                      >
                        ⚙️ Rules
                      </button>
                    </div>

                    <div className="vf-form-group" style={{ marginBottom: '12px' }}>
                      <label className="vf-label">
                        Tracking Mode <span style={{ color: 'var(--vf-danger)' }}>*</span>
                      </label>
                      <select
                        className="vf-select"
                        value={formData.trackingMode || 'Batch + Serial'}
                        onChange={(e) => setFormData({ ...formData, trackingMode: e.target.value as any })}
                      >
                        <option value="Batch + Serial">Batch + Serial (Implants / High Traceability)</option>
                        <option value="Batch / Lot">Batch / Lot Only (Consumables)</option>
                        <option value="Serial">Serial Number Only (Capital Equipment)</option>
                        <option value="None">None (Services / Digital)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div className="vf-form-group">
                        <label className="vf-label">Distributor Shelf Life (Days)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.trackingRules?.minShelfLifeDistributorDays || 365}
                          onChange={(e) => setFormData({
                            ...formData,
                            trackingRules: {
                              ...(formData.trackingRules || {
                                mode: formData.trackingMode || 'Batch + Serial',
                                mfgDateRequired: true,
                                expiryDateRequired: true,
                                minShelfLifeInstitutionDays: 180,
                                udiDiRequired: true,
                                qcInspectionRequired: true
                              }),
                              minShelfLifeDistributorDays: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                      <div className="vf-form-group">
                        <label className="vf-label">Hospital Shelf Life (Days)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.trackingRules?.minShelfLifeInstitutionDays || 180}
                          onChange={(e) => setFormData({
                            ...formData,
                            trackingRules: {
                              ...(formData.trackingRules || {
                                mode: formData.trackingMode || 'Batch + Serial',
                                mfgDateRequired: true,
                                expiryDateRequired: true,
                                minShelfLifeDistributorDays: 365,
                                udiDiRequired: true,
                                qcInspectionRequired: true
                              }),
                              minShelfLifeInstitutionDays: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.trackingRules?.mfgDateRequired !== false}
                          onChange={(e) => setFormData({
                            ...formData,
                            trackingRules: {
                              ...(formData.trackingRules || {
                                mode: formData.trackingMode || 'Batch + Serial',
                                expiryDateRequired: true,
                                minShelfLifeDistributorDays: 365,
                                minShelfLifeInstitutionDays: 180,
                                udiDiRequired: true,
                                qcInspectionRequired: true
                              }),
                              mfgDateRequired: e.target.checked
                            }
                          })}
                        />
                        Manufacturing Date Required
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.trackingRules?.expiryDateRequired !== false}
                          onChange={(e) => setFormData({
                            ...formData,
                            trackingRules: {
                              ...(formData.trackingRules || {
                                mode: formData.trackingMode || 'Batch + Serial',
                                mfgDateRequired: true,
                                minShelfLifeDistributorDays: 365,
                                minShelfLifeInstitutionDays: 180,
                                udiDiRequired: true,
                                qcInspectionRequired: true
                              }),
                              expiryDateRequired: e.target.checked
                            }
                          })}
                        />
                        Expiry Date Required
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.trackingRules?.udiDiRequired !== false}
                          onChange={(e) => setFormData({
                            ...formData,
                            trackingRules: {
                              ...(formData.trackingRules || {
                                mode: formData.trackingMode || 'Batch + Serial',
                                mfgDateRequired: true,
                                expiryDateRequired: true,
                                minShelfLifeDistributorDays: 365,
                                minShelfLifeInstitutionDays: 180,
                                qcInspectionRequired: true
                              }),
                              udiDiRequired: e.target.checked
                            }
                          })}
                        />
                        UDI-DI Mandatory Registration
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.trackingRules?.qcInspectionRequired !== false}
                          onChange={(e) => setFormData({
                            ...formData,
                            trackingRules: {
                              ...(formData.trackingRules || {
                                mode: formData.trackingMode || 'Batch + Serial',
                                mfgDateRequired: true,
                                expiryDateRequired: true,
                                minShelfLifeDistributorDays: 365,
                                minShelfLifeInstitutionDays: 180,
                                udiDiRequired: true
                              }),
                              qcInspectionRequired: e.target.checked
                            }
                          })}
                        />
                        Gate QC Inspection Required
                      </label>
                    </div>
                  </div>

                  {/* Card 2: Inventory Policy & Stock Thresholds */}
                  <div className="vf-card" style={{ padding: '16px' }}>
                    <div className="vf-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>Inventory Policy & Stock Thresholds</span>
                      <button
                        type="button"
                        className="vf-btn-inline-manage"
                        onClick={() => showToast('Inventory policy defaults configured in Configuration Studio.', 'info')}
                      >
                        ⚙️ Default Policies
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--vf-slate-500)', marginBottom: '12px' }}>
                      Product Master governs the reorder baseline. Actual balances and low-stock alerts are monitored by the VinFlux Inventory Engine.
                    </p>

                    <div style={{ backgroundColor: 'var(--vf-slate-50)', border: '1px solid var(--vf-slate-200)', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.inventoryPolicy?.inheritDefaults !== false}
                          onChange={(e) => setFormData({
                            ...formData,
                            inventoryPolicy: {
                              ...(formData.inventoryPolicy || {
                                minSafetyThreshold: 50,
                                reorderPoint: 75,
                                reorderQty: 100,
                                leadTimeDays: 45,
                                safetyStockDays: 60
                              }),
                              inheritDefaults: e.target.checked
                            }
                          })}
                        />
                        <span>Inherit Default Inventory Policy for this Product Type</span>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div className="vf-form-group">
                        <label className="vf-label">Min Safety Stock Threshold</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.inventoryPolicy?.minSafetyThreshold || 50}
                          onChange={(e) => setFormData({
                            ...formData,
                            inventoryPolicy: {
                              ...(formData.inventoryPolicy || {
                                inheritDefaults: true,
                                reorderPoint: 75,
                                reorderQty: 100,
                                leadTimeDays: 45,
                                safetyStockDays: 60
                              }),
                              minSafetyThreshold: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                      <div className="vf-form-group">
                        <label className="vf-label">Reorder Point Level</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.inventoryPolicy?.reorderPoint || 75}
                          onChange={(e) => setFormData({
                            ...formData,
                            inventoryPolicy: {
                              ...(formData.inventoryPolicy || {
                                inheritDefaults: true,
                                minSafetyThreshold: 50,
                                reorderQty: 100,
                                leadTimeDays: 45,
                                safetyStockDays: 60
                              }),
                              reorderPoint: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="vf-form-group">
                        <label className="vf-label">Standard Reorder Qty (EOQ)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.inventoryPolicy?.reorderQty || 100}
                          onChange={(e) => setFormData({
                            ...formData,
                            inventoryPolicy: {
                              ...(formData.inventoryPolicy || {
                                inheritDefaults: true,
                                minSafetyThreshold: 50,
                                reorderPoint: 75,
                                leadTimeDays: 45,
                                safetyStockDays: 60
                              }),
                              reorderQty: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                      <div className="vf-form-group">
                        <label className="vf-label">Replenishment Lead Time (Days)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.inventoryPolicy?.leadTimeDays || 45}
                          onChange={(e) => setFormData({
                            ...formData,
                            inventoryPolicy: {
                              ...(formData.inventoryPolicy || {
                                inheritDefaults: true,
                                minSafetyThreshold: 50,
                                reorderPoint: 75,
                                reorderQty: 100,
                                safetyStockDays: 60
                              }),
                              leadTimeDays: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 8: REGULATORY DOCUMENTS & ATTACHMENTS */}
            {/* ============================================================== */}
            {currentStep === 8 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 8: Regulatory Documents & Attachments
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Attach technical files, Instructions for Use (IFU), CE/FDA clearance certificates, and packaging artwork.
                  </p>
                </div>

                {/* Dropzone */}
                <div style={{ border: '2px dashed var(--vf-slate-300)', borderRadius: '8px', padding: '28px 20px', textAlign: 'center', backgroundColor: 'var(--vf-slate-50)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontWeight: 600, color: 'var(--vf-slate-800)', marginBottom: '4px', fontSize: '13.5px' }}>
                    Drag and drop technical files or certificates
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--vf-slate-500)', marginBottom: '14px' }}>
                    Supports PDF, CAD, PNG, JPG (Max 50MB per file)
                  </div>
                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary"
                    onClick={handleSimulateDocumentUpload}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Upload size={14} />
                    <span>Browse & Attach Document</span>
                  </button>
                </div>

                {/* Documents Table */}
                <div className="vf-table-container">
                  <table className="vf-table">
                    <thead>
                      <tr>
                        <th>Document Title</th>
                        <th>Type</th>
                        <th>Version</th>
                        <th>Effective Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.documents || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--vf-slate-500)' }}>
                            No documents attached yet.
                          </td>
                        </tr>
                      ) : (
                        (formData.documents || []).map((doc, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={15} className="text-blue-600" />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{doc.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)' }}>{doc.size}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="vf-badge vf-badge-neutral">{doc.type}</span></td>
                            <td><code>{doc.version}</code></td>
                            <td style={{ fontSize: '12px' }}>{doc.effective}</td>
                            <td><span className="vf-badge vf-badge-approved">{doc.status}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="vf-btn vf-btn-secondary vf-btn-xs"
                                onClick={() => {
                                  const nextDocs = [...(formData.documents || [])];
                                  nextDocs.splice(idx, 1);
                                  setFormData({ ...formData, documents: nextDocs });
                                  showToast('Document removed.', 'info');
                                }}
                                style={{ color: 'var(--vf-danger)' }}
                              >
                                <Trash2 size={12} />
                              </button>
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
            {/* STEP 9: PRICING REFERENCE (COMMERCIAL LINKAGE) */}
            {/* ============================================================== */}
            {currentStep === 9 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 9: Pricing Engine Commercial Linkage
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Architectural boundary: Product Master does not store permanent customer transaction prices. Instead, it links to the <strong>VinFlux Pricing Engine</strong>.
                  </p>
                </div>

                <div className="vf-card" style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid var(--vf-accent)', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={16} className="text-blue-600" />
                    <span>Pricing Engine Integration Status</span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)', marginBottom: '12px' }}>
                    Once published, this product master record will automatically syndicate to Channel Price Lists (Screen 02) to establish distributor price caps, margins, and government price ceilings.
                  </p>
                  <span className="vf-badge vf-badge-approved">Ready for Channel Rate Cards</span>
                </div>

                <div className="vf-grid-2col" style={{ gap: '16px' }}>
                  <div className="vf-card" style={{ padding: '16px' }}>
                    <div className="vf-card-title" style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px' }}>
                      Indicative Commercial Reference Rates
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="vf-form-group">
                        <label className="vf-label">Max Retail Price (MRP ₹)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.pricingReference?.mrp || 48500}
                          onChange={(e) => setFormData({
                            ...formData,
                            pricingReference: {
                              ...(formData.pricingReference || {
                                isEngineConnected: true,
                                engineSource: 'VinFlux Pricing Engine v3.2',
                                lastSync: '2026-11-01',
                                dealerTransferCap: 34000,
                                institutionalTenderCap: 29500,
                                govPriceCapEnforced: true,
                                marginFloorPercent: 18,
                                currency: 'INR',
                                priceListsLinked: []
                              }),
                              mrp: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                      <div className="vf-form-group">
                        <label className="vf-label">Dealer Transfer Price Cap (₹)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.pricingReference?.dealerTransferCap || 34000}
                          onChange={(e) => setFormData({
                            ...formData,
                            pricingReference: {
                              ...(formData.pricingReference || {
                                isEngineConnected: true,
                                engineSource: 'VinFlux Pricing Engine v3.2',
                                lastSync: '2026-11-01',
                                mrp: 48500,
                                institutionalTenderCap: 29500,
                                govPriceCapEnforced: true,
                                marginFloorPercent: 18,
                                currency: 'INR',
                                priceListsLinked: []
                              }),
                              dealerTransferCap: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                      <div className="vf-form-group">
                        <label className="vf-label">Institutional Tender Cap (₹)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.pricingReference?.institutionalTenderCap || 29500}
                          onChange={(e) => setFormData({
                            ...formData,
                            pricingReference: {
                              ...(formData.pricingReference || {
                                isEngineConnected: true,
                                engineSource: 'VinFlux Pricing Engine v3.2',
                                lastSync: '2026-11-01',
                                mrp: 48500,
                                dealerTransferCap: 34000,
                                govPriceCapEnforced: true,
                                marginFloorPercent: 18,
                                currency: 'INR',
                                priceListsLinked: []
                              }),
                              institutionalTenderCap: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                      <div className="vf-form-group">
                        <label className="vf-label">Margin Floor Enforcement (%)</label>
                        <input
                          type="number"
                          className="vf-input"
                          value={formData.pricingReference?.marginFloorPercent || 18}
                          onChange={(e) => setFormData({
                            ...formData,
                            pricingReference: {
                              ...(formData.pricingReference || {
                                isEngineConnected: true,
                                engineSource: 'VinFlux Pricing Engine v3.2',
                                lastSync: '2026-11-01',
                                mrp: 48500,
                                dealerTransferCap: 34000,
                                institutionalTenderCap: 29500,
                                govPriceCapEnforced: true,
                                currency: 'INR',
                                priceListsLinked: []
                              }),
                              marginFloorPercent: Number(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="vf-card" style={{ padding: '16px' }}>
                    <div className="vf-card-title" style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px' }}>
                      Statutory Price Controls
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.pricingReference?.govPriceCapEnforced !== false}
                          onChange={(e) => setFormData({
                            ...formData,
                            pricingReference: {
                              ...(formData.pricingReference || {
                                isEngineConnected: true,
                                engineSource: 'VinFlux Pricing Engine v3.2',
                                lastSync: '2026-11-01',
                                mrp: 48500,
                                dealerTransferCap: 34000,
                                institutionalTenderCap: 29500,
                                marginFloorPercent: 18,
                                currency: 'INR',
                                priceListsLinked: []
                              }),
                              govPriceCapEnforced: e.target.checked
                            }
                          })}
                        />
                        <span style={{ fontWeight: 600 }}>Enforce NPPA / DPCO Ceiling Price Order</span>
                      </label>
                      <div style={{ fontSize: '12px', color: 'var(--vf-slate-500)', lineHeight: '1.5' }}>
                        When activated, transactions through partner portals will validate orders against national government price ceilings to prevent non-compliant invoicing.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 10: ARCHITECTURAL VERIFICATION & PUBLICATION */}
            {/* ============================================================== */}
            {currentStep === 10 && (
              <div className="vf-step-pane active">
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--vf-slate-900)' }}>
                    Step 10: Architectural Verification & Publication
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', margin: 0 }}>
                    Verify compliance with VinFlux Universal Master governance before submitting for regulatory sign-off.
                  </p>
                </div>

                <div className="vf-card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--vf-accent)', padding: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{formData.name || 'Untitled Product'}</h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>Code: <strong>{formData.code || 'Pending'}</strong></span>
                    <span>·</span>
                    <span>Type: <strong>{productTypes.find(t => t.id === formData.productTypeId)?.name || 'Implant'}</strong></span>
                    <span>·</span>
                    <span>Principal: <strong>{formData.principalId}</strong></span>
                    <span>·</span>
                    <span>Brand: <strong>{formData.brand || 'N/A'}</strong></span>
                  </div>
                </div>

                <div className="vf-grid-2col" style={{ gap: '16px', marginBottom: '16px' }}>
                  <div className="vf-card" style={{ padding: '16px' }}>
                    <div className="vf-card-title" style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                      Commercial & Classification
                    </div>
                    <div className="vf-meta-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Portfolio</span>
                        <span className="vf-meta-val" style={{ fontWeight: 600 }}>{currentPortfolio?.name || 'N/A'}</span>
                      </div>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Category</span>
                        <span className="vf-meta-val" style={{ fontWeight: 600 }}>{currentCategory?.name || 'N/A'}</span>
                      </div>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>HSN / Tax Rate</span>
                        <span className="vf-meta-val" style={{ fontWeight: 600 }}>{formData.hsnCode || 'N/A'} ({formData.taxRate || '5%'})</span>
                      </div>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Base UOM</span>
                        <span className="vf-meta-val" style={{ fontWeight: 600 }}>{formData.baseUom || 'Each'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="vf-card" style={{ padding: '16px' }}>
                    <div className="vf-card-title" style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                      Inventory Policy & Replenishment Thresholds
                    </div>
                    <div className="vf-meta-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Min Safety Stock</span>
                        <span className="vf-meta-val" style={{ fontWeight: 700 }}>{formData.inventoryPolicy?.minSafetyThreshold || 50} Units</span>
                      </div>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Reorder Point</span>
                        <span className="vf-meta-val" style={{ fontWeight: 700 }}>{formData.inventoryPolicy?.reorderPoint || 75} Units</span>
                      </div>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Standard EOQ</span>
                        <span className="vf-meta-val" style={{ fontWeight: 600 }}>{formData.inventoryPolicy?.reorderQty || 100} Units</span>
                      </div>
                      <div className="vf-meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="vf-meta-key" style={{ color: 'var(--vf-slate-500)' }}>Tracking Modality</span>
                        <span className="vf-meta-val"><span className="vf-badge vf-badge-tracking">{formData.trackingMode || 'Batch + Serial'}</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="vf-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', marginBottom: '16px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '12.5px' }}>
                    <div>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Identifiers Registered: </span>
                      <strong>{(formData.identifiers || []).length} items</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Packaging Levels: </span>
                      <strong>{1 + (formData.uomHierarchy || []).length} tiers</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--vf-slate-500)' }}>Attached Documents: </span>
                      <strong>{(formData.documents || []).length} files</strong>
                    </div>
                  </div>
                </div>

                <div className="vf-card" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px' }}>
                  <div style={{ fontWeight: 600, color: '#166534', fontSize: '13.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} />
                    <span>Product Architecture Verification Passed</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#15803d' }}>
                    All mandatory classification relationships, base UOM conversions, and regulatory safety thresholds comply with VinFlux Universal Master governance.
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Wizard Sticky Footer */}
          <div className="vf-wizard-footer" style={{ padding: '14px 24px', background: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={(e) => handleSubmit(e, true)}
                title="Save product state as Draft without publishing"
              >
                Save as Draft
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {currentStep > 1 && (
                <button
                  type="button"
                  className="vf-btn vf-btn-secondary"
                  onClick={handlePrevStep}
                >
                  &larr; Back
                </button>
              )}

              {currentStep < 10 ? (
                <button
                  type="button"
                  className="vf-btn vf-btn-primary"
                  onClick={handleNextStep}
                >
                  Next Step &rarr;
                </button>
              ) : (
                <button
                  type="submit"
                  className="vf-btn vf-btn-success"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <Check size={14} />
                  <span>Submit & Publish</span>
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
