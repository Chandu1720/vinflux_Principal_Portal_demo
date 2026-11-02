import React from 'react';
import { useApp } from '../../context/AppContext.tsx';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="vf-toast-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toasts.map((toast) => {
        let bg = '#1e293b';
        let color = '#f8fafc';
        let borderColor = '#334155';

        if (toast.type === 'success') {
          bg = '#065f46';
          color = '#ecfdf5';
          borderColor = '#047857';
        } else if (toast.type === 'danger') {
          bg = '#991b1b';
          color = '#fef2f2';
          borderColor = '#b91c1c';
        } else if (toast.type === 'warning') {
          bg = '#92400e';
          color = '#fffbeb';
          borderColor = '#b45309';
        }

        return (
          <div
            key={toast.id}
            style={{
              backgroundColor: bg,
              color: color,
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              minWidth: '300px',
              maxWidth: '480px',
              animation: 'vfToastIn 0.2s ease-out'
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: color,
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px',
                lineHeight: 1
              }}
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
};
