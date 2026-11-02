import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useApp();
  const [format, setFormat] = useState('csv');

  if (!isOpen) return null;

  const handleDownload = () => {
    showToast(`Product Master registry exported successfully in .${format.toUpperCase()} format!`, 'success');
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
          width: '520px',
          maxWidth: '92vw',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="vf-modal-title" style={{ fontSize: '16px', fontWeight: 700 }}>Export Product Master Registry</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--vf-slate-400)' }}>&times;</button>
        </div>

        <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="vf-form-group">
            <label className="vf-label">Export Format</label>
            <select className="vf-select" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="csv">Standard CSV (Comma Delimited)</option>
              <option value="xlsx">Excel Workbook (.XLSX) with SKU Matrices</option>
              <option value="json">VinFlux Universal JSON Data Package</option>
              <option value="gs1">GS1 GDSN Sync XML</option>
            </select>
          </div>

          <div className="vf-form-group">
            <label className="vf-label">Include Data Subsets</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> Operational SKUs & Matrix Variants
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> Packaging Hierarchy & Barcodes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> External ERP ID Mappings (SAP / Oracle)
              </label>
            </div>
          </div>
        </div>

        <div className="vf-modal-footer" style={{ padding: '14px 20px', backgroundColor: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="vf-btn vf-btn-primary" onClick={handleDownload}>Download Export</button>
        </div>
      </div>
    </div>
  );
};
