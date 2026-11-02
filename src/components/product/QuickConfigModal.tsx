import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';

interface QuickConfigModalProps {
  target: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickConfigModal: React.FC<QuickConfigModalProps> = ({ target, isOpen, onClose }) => {
  const { addPortfolio, addProductType, showToast } = useApp();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const getTitle = () => {
    switch (target) {
      case 'portfolios': return 'Add Commercial Portfolio';
      case 'categories': return 'Add Product Category';
      case 'subCategories': return 'Add Sub-Category';
      case 'productTypes': return 'Configure New Product Type';
      case 'uomPackaging': return 'Add UOM Packaging Standard';
      default: return 'Quick Configuration Record';
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('Name is required.', 'warning');
      return;
    }
    const generatedCode = code.trim() || name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10);

    if (target === 'portfolios') {
      addPortfolio({
        id: `port-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        code: generatedCode,
        description: description || 'User-configured portfolio division.',
        categories: []
      });
    } else if (target === 'productTypes') {
      addProductType({
        id: `type-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        code: generatedCode,
        nature: 'Physical Goods',
        defaultTracking: 'Batch + Serial',
        isStockable: true,
        requiresPackaging: true,
        requiresRegulatoryDossier: true,
        variantAllowed: true,
        attributeTemplate: 'tpl-implant',
        defaultMinStockThreshold: 50
      });
    } else {
      showToast(`Record "${name}" created and applied.`, 'success');
    }

    setName('');
    setCode('');
    setDescription('');
    onClose();
  };

  return (
    <div
      className="vf-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="vf-modal vf-modal-compact"
        style={{
          width: '480px',
          maxWidth: '92vw',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        <div
          className="vf-modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--vf-slate-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div className="vf-modal-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
            {getTitle()}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--vf-slate-400)' }}
          >
            &times;
          </button>
        </div>

        <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="vf-form-group">
            <label className="vf-label">Record Name *</label>
            <input
              type="text"
              className="vf-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spine & Vertebral Systems"
              autoFocus
            />
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Identification Code</label>
            <input
              type="text"
              className="vf-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated if left blank"
            />
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Description / Clinical Purpose</label>
            <textarea
              className="vf-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or clinical category segment..."
              style={{ height: 'auto', padding: '8px 10px' }}
            />
          </div>
        </div>

        <div
          className="vf-modal-footer"
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--vf-slate-50)',
            borderTop: '1px solid var(--vf-slate-200)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="vf-btn vf-btn-primary" onClick={handleSave}>
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
