import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'md', icon, loading, children, className = '', disabled, type = 'button', ...rest }) => (
  <button
    type={type}
    className={`g2-btn g2-btn-${variant} ${size === 'sm' ? 'g2-btn-sm' : ''} ${className}`}
    disabled={disabled || loading}
    {...rest}
  >
    {loading ? <Loader2 size={15} className="g2-spin" /> : icon}
    {children}
  </button>
);

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  bordered?: boolean;
  badge?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({ label, bordered, badge, children, className = '', type = 'button', ...rest }) => (
  <button type={type} className={`g2-icon-btn ${bordered ? 'bordered' : ''} ${className}`} title={label} aria-label={label} {...rest}>
    {children}
    {badge ? <span className="g2-dot-badge">{badge > 99 ? '99+' : badge}</span> : null}
  </button>
);
