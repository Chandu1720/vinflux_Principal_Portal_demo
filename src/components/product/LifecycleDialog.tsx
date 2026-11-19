import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { ActionResult } from '../../context/AppContext.tsx';
import type { Product } from '../../types/product.ts';

export type LifecycleAction = 'submit' | 'approve' | 'reject' | 'retire';

const COPY: Record<LifecycleAction, { title: string; label: string; reason: string; required: boolean; tone: 'primary' | 'danger'; note: string }> = {
  submit: { title: 'Submit for approval', label: 'Submit', reason: 'Note for the approver', required: false, tone: 'primary', note: 'All blocking validation rules are checked now. An active product stays sellable while the change is reviewed.' },
  approve: { title: 'Review product', label: 'Approve', reason: 'Comment (required to reject)', required: false, tone: 'primary', note: 'Approving makes the product (or its change) live for price lists, orders and Go-to-Market.' },
  reject: { title: 'Send back to maker', label: 'Reject', reason: 'What needs to change?', required: true, tone: 'danger', note: 'The maker sees this reason on the product and can resubmit.' },
  retire: { title: 'Retire product', label: 'Retire', reason: 'Why is it being retired?', required: true, tone: 'danger', note: 'Retired products can’t be ordered. History, stock records and past transactions are kept.' },
};

/** One dialog for every maker-checker step, so rules and wording stay consistent. */
export const LifecycleDialog: React.FC<{ product: Product; action: LifecycleAction; onClose: () => void }> = ({ product, action, onClose }) => {
  const { submitProduct, approveProduct, rejectProduct, retireProduct, showToast } = useApp();
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const c = COPY[action];

  const run = () => {
    if (c.required && !reason.trim()) { setResult({ ok: false, message: 'Please enter a reason.' }); return; }
    const r = action === 'submit' ? submitProduct(product.id, reason)
      : action === 'approve' ? approveProduct(product.id, reason)
        : action === 'reject' ? rejectProduct(product.id, reason)
          : retireProduct(product.id, reason);
    if (r.ok) { showToast(r.message, action === 'reject' || action === 'retire' ? 'warning' : 'success'); onClose(); }
    else setResult(r);
  };
  const reject = () => {
    if (!reason.trim()) { setResult({ ok: false, message: 'Enter what needs to change before rejecting.' }); return; }
    const r = rejectProduct(product.id, reason);
    if (r.ok) { showToast(r.message, 'warning'); onClose(); } else setResult(r);
  };

  return (
    <div className="vf-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-drawer vf-drawer-sm" style={{ width: '480px' }} role="dialog" aria-label={c.title}>
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <h3 className="vf-drawer-title">{c.title}</h3>
            <p className="vf-drawer-subtitle">{product.name}</p>
          </div>
          <button type="button" className="vf-drawer-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="vf-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {product.submittedBy && action !== 'submit' && (
            <div style={{ fontSize: 12.5, color: 'var(--vf-slate-600)' }}>Submitted by <strong>{product.submittedBy}</strong>{product.submittedAt ? ` on ${product.submittedAt}` : ''}</div>
          )}
          <div>
            <label className="vf-form-label">{c.reason}{c.required && ' *'}</label>
            <textarea rows={3} className="vf-form-control" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {result && !result.ok && (
            <div className="vf-lc-errors" role="alert">
              <strong>{result.message}</strong>
              {result.errors && result.errors.length > 0 && <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--vf-slate-500)" }}>{c.note}</div>
        </div>
        <div className="vf-drawer-footer">
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>Cancel</button>
          {action === 'approve' && <button type="button" className="vf-btn vf-btn-danger" onClick={reject}>Reject</button>}
          <button type="button" className={`vf-btn ${c.tone === 'danger' ? 'vf-btn-danger' : 'vf-btn-primary'}`} onClick={run}>{c.label}</button>
        </div>
      </div>
    </div>
  );
};

/** Which lifecycle buttons the current user may see for a product. */
export const availableActions = (p: Product, perms: { canApproveProducts: boolean; canPublishProducts: boolean; canRetireProducts: boolean }): LifecycleAction[] => {
  const out: LifecycleAction[] = [];
  const pending = p.approvalStatus === 'Pending Approval';
  if (!pending && p.lifecycleStatus !== 'Retired' && p.approvalStatus !== 'Approved' && perms.canPublishProducts) out.push('submit');
  if (pending && perms.canApproveProducts) out.push('approve', 'reject');
  if (p.lifecycleStatus !== 'Retired' && perms.canRetireProducts) out.push('retire');
  return out;
};
