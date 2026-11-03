import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  width?: string;
  footer?: React.ReactNode;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'lg',
  width,
  footer
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = size ? `vf-drawer-${size}` : 'vf-drawer-lg';

  return (
    <div
      className="vf-drawer-overlay"
      onClick={onClose}
      style={{ zIndex: 1100 }}
    >
      <div
        className={`vf-drawer ${sizeClass}`}
        style={width ? { width, maxWidth: '98vw' } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="vf-drawer-header">
          <div className="vf-drawer-title-wrap">
            <h2 className="vf-drawer-title" style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="vf-drawer-subtitle" style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="vf-drawer-close"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#E2E8F0';
              e.currentTarget.style.color = '#0F172A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F1F5F9';
              e.currentTarget.style.color = '#64748B';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="vf-drawer-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto', backgroundColor: '#FFFFFF' }}>
          {children}
        </div>

        {/* Optional Footer */}
        {footer && <div className="vf-drawer-footer">{footer}</div>}
      </div>
    </div>
  );
};
