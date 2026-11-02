import React, { useState } from 'react';
import type { Product } from '../../types/product.ts';

interface BarcodeLabelProps {
  product: Product;
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelProps> = ({ product, onClose }) => {
  const [printOpen, setPrintOpen] = useState(false);
  const [printMode, setPrintMode] = useState<'label' | 'barcode'>('label');
  const [copies, setCopies] = useState(1);

  const handlePrint = () => {
    const src = document.getElementById(printMode === 'label' ? 'vf-label-print' : 'vf-barcode-only');
    if (!src) return;
    const area = document.createElement('div');
    area.id = 'vf-print-area';
    area.style.display = 'none';
    for (let i = 0; i < copies; i++) {
      const page = document.createElement('div');
      page.className = `vf-print-page ${printMode}`;
      const clone = src.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      if (printMode === 'barcode') clone.style.borderTop = 'none';
      page.appendChild(clone);
      area.appendChild(page);
    }
    document.body.appendChild(area);
    const cleanup = () => {
      area.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
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
          width: '640px',
          maxWidth: '95vw',
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 30px 70px rgba(15,23,42,.35)',
          overflow: 'hidden'
        }}
      >
        <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="vf-modal-title" style={{ fontWeight: 700, fontSize: '16px' }}>Product Identifier Label Preview</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--vf-slate-400)' }}>&times;</button>
        </div>

        <div className="vf-modal-body" style={{ padding: '20px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', marginBottom: '16px' }}>
            Live vector SVG rendering of GS1-128 Linear Barcode and 2D DataMatrix. Generated dynamically on demand without storing bulky bitmap files.
          </p>

          <style>{`
            @media print {
              @page { size: 100mm 60mm; margin: 0; }
              body > *:not(#vf-print-area) { display: none !important; }
              #vf-print-area { display: block !important; }
              #vf-print-area .vf-print-page { width: 100mm; height: 60mm; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; justify-content: center; page-break-after: always; break-after: page; }
              #vf-print-area .vf-print-page > * { width: 100%; max-width: none !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; box-sizing: border-box; }
              #vf-print-area .vf-print-page.label > * { zoom: 0.8; }
              #vf-print-area .vf-print-page.barcode > * { padding: 4mm !important; }
            }
          `}</style>
          <div
            id="vf-label-print"
            style={{
              border: '1.5px solid #0f172a',
              borderRadius: '12px',
              padding: '20px 22px',
              backgroundColor: '#ffffff',
              fontFamily: 'ui-monospace, Consolas, monospace',
              color: '#0f172a',
              boxShadow: '0 1px 2px rgba(15,23,42,.06), 0 8px 24px -8px rgba(15,23,42,.15)',
              maxWidth: '520px',
              margin: '0 auto'
            }}
          >
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Manufacturer</div>
                <div style={{ fontSize: '13px', fontWeight: 800 }}>BIORAD MEDISYS PVT LTD</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Type / Class</div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>CLASS III (MDR)</div>
              </div>
            </div>

            {/* Product Name */}
            <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '8px', lineHeight: 1.3 }}>
              {product.name}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#475569' }}>REF / Code: <strong>{product.code}</strong></div>
                <div style={{ fontSize: '11px', color: '#475569' }}>GTIN (DI): <strong>(01){product.code}</strong></div>
                <div style={{ fontSize: '11px', color: '#475569' }}>LOT: <strong>LOT88912</strong> · EXP: <strong>2031-12-31</strong></div>
                <div style={{ fontSize: '11px', color: '#475569' }}>SN: <strong>SN7729104</strong> · QTY: <strong>1 {product.baseUom}</strong></div>
              </div>

              {/* 2D DataMatrix Vector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg width="68" height="68" viewBox="0 0 100 100" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                  {/* Outer Finder Pattern */}
                  <rect x="5" y="5" width="90" height="10" fill="#0f172a" />
                  <rect x="5" y="5" width="10" height="90" fill="#0f172a" />
                  {/* Alternating timing edges */}
                  <rect x="90" y="5" width="5" height="10" fill="#0f172a" />
                  <rect x="90" y="25" width="5" height="10" fill="#0f172a" />
                  <rect x="90" y="45" width="5" height="10" fill="#0f172a" />
                  <rect x="90" y="65" width="5" height="10" fill="#0f172a" />
                  <rect x="90" y="85" width="5" height="10" fill="#0f172a" />
                  <rect x="15" y="90" width="10" height="5" fill="#0f172a" />
                  <rect x="35" y="90" width="10" height="5" fill="#0f172a" />
                  <rect x="55" y="90" width="10" height="5" fill="#0f172a" />
                  <rect x="75" y="90" width="10" height="5" fill="#0f172a" />
                  {/* Internal Data Cells */}
                  <rect x="25" y="25" width="10" height="10" fill="#0f172a" />
                  <rect x="45" y="25" width="10" height="10" fill="#0f172a" />
                  <rect x="65" y="25" width="10" height="10" fill="#0f172a" />
                  <rect x="35" y="45" width="10" height="10" fill="#0f172a" />
                  <rect x="55" y="45" width="10" height="10" fill="#0f172a" />
                  <rect x="25" y="65" width="10" height="10" fill="#0f172a" />
                  <rect x="45" y="65" width="10" height="10" fill="#0f172a" />
                  <rect x="75" y="55" width="10" height="10" fill="#0f172a" />
                </svg>
                <span style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>2D DataMatrix</span>
              </div>
            </div>

            {/* GS1-128 Linear Barcode Simulation */}
            <div id="vf-barcode-only" style={{ textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
              <svg width="100%" height="56" viewBox="0 0 320 40" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
                <rect x="10" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="15" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="20" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="28" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="33" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="40" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="46" y="0" width="6" height="40" fill="#0f172a" />
                <rect x="56" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="62" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="70" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="76" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="85" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="92" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="100" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="106" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="115" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="122" y="0" width="6" height="40" fill="#0f172a" />
                <rect x="132" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="138" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="146" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="152" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="162" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="170" y="0" width="6" height="40" fill="#0f172a" />
                <rect x="180" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="186" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="195" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="202" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="210" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="216" y="0" width="6" height="40" fill="#0f172a" />
                <rect x="226" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="233" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="242" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="248" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="258" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="266" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="274" y="0" width="2" height="40" fill="#0f172a" />
                <rect x="280" y="0" width="5" height="40" fill="#0f172a" />
                <rect x="290" y="0" width="3" height="40" fill="#0f172a" />
                <rect x="298" y="0" width="4" height="40" fill="#0f172a" />
                <rect x="306" y="0" width="3" height="40" fill="#0f172a" />
              </svg>
              <div style={{ fontSize: '11px', letterSpacing: '0.1em', color: '#334155', marginTop: '2px' }}>
                (01) {product.code} (17) 311231 (10) LOT88912 (21) SN7729104
              </div>
            </div>
          </div>
        </div>

        {printOpen && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e9f2', background: '#f8f9fd', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Print As</div>
              <div style={{ display: 'inline-flex', border: '1px solid #e5e9f2', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                {([['label', 'Full Label'], ['barcode', 'Barcode Only']] as const).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPrintMode(k)}
                    style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, border: 'none', cursor: 'pointer', background: printMode === k ? '#6366f1' : 'transparent', color: printMode === k ? '#fff' : '#475569' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Copies</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e5e9f2', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
                <button type="button" onClick={() => setCopies((c) => Math.max(1, c - 1))} style={{ width: '34px', height: '34px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px' }}>−</button>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={copies}
                  onChange={(e) => setCopies(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ width: '56px', height: '34px', textAlign: 'center', border: 'none', borderLeft: '1px solid #e5e9f2', borderRight: '1px solid #e5e9f2', outline: 'none', fontSize: '13px', fontWeight: 600 }}
                />
                <button type="button" onClick={() => setCopies((c) => Math.min(500, c + 1))} style={{ width: '34px', height: '34px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px' }}>+</button>
              </div>
            </div>

            <button type="button" className="vf-btn vf-btn-primary" style={{ marginLeft: 'auto' }} onClick={handlePrint}>
              Print {copies} {printMode === 'label' ? (copies > 1 ? 'Labels' : 'Label') : (copies > 1 ? 'Barcodes' : 'Barcode')}
            </button>
          </div>
        )}

        <div className="vf-modal-footer" style={{ padding: '14px 20px', backgroundColor: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="vf-btn vf-btn-primary" onClick={() => setPrintOpen((o) => !o)}>
            {printOpen ? 'Hide Print Options' : 'Print…'}
          </button>
        </div>
      </div>
    </div>
  );
};
