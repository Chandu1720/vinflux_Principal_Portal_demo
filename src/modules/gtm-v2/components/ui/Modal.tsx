import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

/** Stack of open overlays so Escape only closes the top-most one. */
const overlayStack: number[] = [];
let overlaySeq = 0;

/**
 * Overlay container. Default variant is a right-side DRAWER (used for all GTM V2 forms
 * and detail views); `variant="modal"` renders a centred dialog (confirmations).
 */
export const Modal: React.FC<{
  open: boolean;
  variant?: 'drawer' | 'modal';
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, variant = 'drawer', title, subtitle, onClose, size = 'md', footer, children }) => {
  useEffect(() => {
    if (!open) return;
    const id = ++overlaySeq;
    overlayStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      // Escape inside an open dropdown only closes the dropdown, not the drawer.
      if (e.key === 'Escape' && document.querySelector('.g2-dd.open')) return;
      if (e.key === 'Escape' && overlayStack[overlayStack.length - 1] === id) { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      const i = overlayStack.indexOf(id);
      if (i >= 0) overlayStack.splice(i, 1);
    };
  }, [open, onClose]);
  const drawer = variant === 'drawer';

  if (!open) return null;
  return createPortal(
    <div className="g2 g2-modal-host" style={{ minHeight: 0, display: 'contents' }}>
      {/* Drawers hold forms: an outside click must not discard input, so only dialogs close on backdrop click. */}
      <div className={`g2-modal-backdrop ${drawer ? 'drawer' : ''}`} onMouseDown={(e) => { if (!drawer && e.target === e.currentTarget) onClose(); }}>
        <div className={`g2-modal ${drawer ? 'drawer' : ''} ${size === 'md' ? '' : size}`} role="dialog" aria-modal="true">
          <div className="g2-modal-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="g2-modal-title">{title}</h2>
              {subtitle && <div className="g2-modal-sub">{subtitle}</div>}
            </div>
            <button type="button" className="g2-icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="g2-modal-body">{children}</div>
          {footer && <div className="g2-modal-foot">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', loading, onConfirm, onCancel }) => (
  <Modal
    open={open}
    variant="modal"
    title={title}
    onClose={onCancel}
    footer={<>
      <Button onClick={onCancel} disabled={loading}>Cancel</Button>
      <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
    </>}
  >
    <div style={{ display: 'flex', gap: 12 }}>
      {tone === 'danger' && <span style={{ color: 'var(--g2-red)', flexShrink: 0 }}><AlertTriangle size={20} /></span>}
      <div style={{ fontSize: 13.5, color: 'var(--g2-text-2)', lineHeight: 1.55 }}>{message}</div>
    </div>
  </Modal>
);
