import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

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
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="vf-modal"
        style={{
          width: '540px',
          maxWidth: '92vw',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
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
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--vf-slate-400)' }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {typeof message === 'string' ? (
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--vf-slate-700)', lineHeight: 1.5 }}>
              {message}
            </p>
          ) : (
            message
          )}
        </div>

        <div
          className="vf-modal-footer"
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--vf-slate-50)',
            borderTop: '1px solid var(--vf-slate-200)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          <button type="button" className="vf-btn vf-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`vf-btn vf-btn-${variant}`}
            onClick={onConfirm}
            style={{ fontWeight: 600 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
