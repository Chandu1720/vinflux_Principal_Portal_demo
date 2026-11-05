import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { packOf } from '../../utils/productLifecycle.ts';

/** Turn industry packs on or off. Off = its product types can't be chosen for new products (existing ones stay). */
export const IndustryPacksDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { industryPacks, setIndustryPackEnabled, productTypes, products, currentUser, showToast } = useApp();
  const canEdit = currentUser.matrix ? !!currentUser.matrix.products?.includes('configure') : currentUser.permissions.canManageConfig;
  return (
    <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-drawer vf-drawer-sm" style={{ width: '520px' }} role="dialog" aria-label="Industry packs">
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <h3 className="vf-drawer-title">Industry Packs</h3>
            <p className="vf-drawer-subtitle">One Product Master for any industry — each pack adds its own fields and checks.</p>
          </div>
          <button type="button" className="vf-drawer-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {industryPacks.map((pk) => {
            const types = productTypes.filter((t) => packOf(t.id, productTypes) === pk.id);
            const count = products.filter((p) => types.some((t) => t.id === p.productTypeId)).length;
            return (
              <div key={pk.id} style={{ border: '1px solid var(--vf-slate-200)', borderRadius: 10, padding: 14, opacity: pk.enabled ? 1 : 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>{pk.name}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vf-slate-500)' }}>{count} product(s)</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
                    <input type="checkbox" checked={pk.enabled} disabled={!canEdit}
                      onChange={(e) => { setIndustryPackEnabled(pk.id, e.target.checked); showToast(`${pk.name} ${e.target.checked ? 'enabled' : 'disabled'}.`, 'info'); }} />
                    {pk.enabled ? 'On' : 'Off'}
                  </label>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--vf-slate-600)', marginTop: 4 }}>{pk.description}</div>
                <div style={{ fontSize: 12, color: 'var(--vf-slate-500)', marginTop: 6 }}>
                  Product types: {types.map((t) => t.name).join(', ') || '—'} · Default tracking: {pk.defaultTracking} · Default GST: {pk.defaultTax}
                </div>
              </div>
            );
          })}
          {!canEdit && <div style={{ fontSize: 12, color: '#b45309' }}>Only users with configuration rights can change packs.</div>}
          <div style={{ fontSize: 12, color: 'var(--vf-slate-500)' }}>Switching a pack off hides its product types for new products. Existing products keep working.</div>
        </div>
        <div className="vf-drawer-footer"><button type="button" className="vf-btn vf-btn-primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
};
