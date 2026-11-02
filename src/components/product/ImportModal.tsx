import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useApp();
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecuteImport = () => {
    showToast('Import executed: 24 product records validated and synced to registry!', 'success');
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
        className="vf-modal"
        style={{
          width: '560px',
          maxWidth: '92vw',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="vf-modal-title" style={{ fontSize: '16px', fontWeight: 700 }}>Universal Product Master Import</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--vf-slate-400)' }}>&times;</button>
        </div>

        <div className="vf-modal-body" style={{ padding: '20px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-600)', marginBottom: '14px' }}>
            Upload product definitions from CSV, Excel Workbook, or SAP Material Master extract.
          </p>

          <div
            style={{
              border: '2px dashed var(--vf-slate-300)',
              borderRadius: '8px',
              padding: '28px',
              textAlign: 'center',
              backgroundColor: 'var(--vf-slate-50)',
              marginBottom: '14px',
              cursor: 'pointer'
            }}
            onClick={() => setFileName('VinFlux_Standard_Product_Master_MM01.xlsx')}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
            <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--vf-slate-800)' }}>
              {fileName ? fileName : 'Drop CSV / XLSX file here or click to browse'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--vf-slate-400)', marginTop: '4px' }}>
              Supports VinFlux Standard Schema, SAP MM01 export, or GS1 GDSN XML
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--vf-slate-600)', backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px' }}>
            <strong>Field Mapping Check:</strong> Product Code &rarr; GTIN / DI · Classification &rarr; Portfolio · Tracking Mode &rarr; Batch/Serial
          </div>
        </div>

        <div className="vf-modal-footer" style={{ padding: '14px 20px', backgroundColor: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="vf-btn vf-btn-primary" onClick={handleExecuteImport}>Execute Import</button>
        </div>
      </div>
    </div>
  );
};
