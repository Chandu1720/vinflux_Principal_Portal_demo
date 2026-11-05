import React from 'react';
import { AlertCircle, Search } from 'lucide-react';

export const Field: React.FC<{
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}> = ({ label, required, hint, error, className = '', children, htmlFor }) => (
  <div className={`g2-field ${className}`}>
    {label && <label className="g2-label" htmlFor={htmlFor}>{label}{required && <span className="req">*</span>}</label>}
    {children}
    {error ? <span className="g2-error-text">{error}</span> : hint ? <span className="g2-hint">{hint}</span> : null}
  </div>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; suffix?: React.ReactNode };
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ invalid, className = '', suffix, ...rest }, ref) => (
  suffix ? (
    <div className="g2-input-wrap" style={{ position: 'relative' }}>
      <input ref={ref} className={`g2-input ${invalid ? 'invalid' : ''} ${className}`} style={{ paddingRight: 44 }} {...rest} />
      <span className="g2-input-suffix">{suffix}</span>
    </div>
  ) : <input ref={ref} className={`g2-input ${invalid ? 'invalid' : ''} ${className}`} {...rest} />
));
Input.displayName = 'Input';

export const NumberInput: React.FC<Omit<InputProps, 'value' | 'onChange'> & { value: number | null; onChange: (v: number | null) => void; allowEmpty?: boolean }> = ({ value, onChange, allowEmpty, ...rest }) => (
  <Input
    type="number"
    inputMode="decimal"
    value={value === null || Number.isNaN(value) ? '' : value}
    onChange={(e) => {
      const raw = e.target.value;
      if (raw === '') onChange(allowEmpty ? null : 0);
      else onChange(Number(raw));
    }}
    {...rest}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }> = ({ invalid, className = '', ...rest }) => (
  <textarea className={`g2-textarea ${invalid ? 'invalid' : ''} ${className}`} {...rest} />
);

export interface SelectOption { value: string; label: string; disabled?: boolean }

export const Select: React.FC<Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  options: SelectOption[]; placeholder?: string; invalid?: boolean; onChange: (v: string) => void;
}> = ({ options, placeholder, invalid, className = '', onChange, ...rest }) => (
  <select className={`g2-select ${invalid ? 'invalid' : ''} ${className}`} onChange={(e) => onChange(e.target.value)} {...rest}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
  </select>
);

export const Checkbox: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; disabled?: boolean; indeterminate?: boolean }> = ({ checked, onChange, label, disabled, indeterminate }) => (
  <label className="g2-check" onClick={(e) => e.stopPropagation()}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate && !checked; }}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);

export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }> = ({ checked, onChange, disabled, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`g2-switch ${checked ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!checked)} />
);

export const FormSection: React.FC<{ title: string; description?: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, description, icon, actions, children }) => (
  <section className="g2-form-section">
    <div className="g2-form-section-head">
      {icon && <span style={{ color: 'var(--g2-primary)', display: 'inline-flex' }}>{icon}</span>}
      <div>
        <div className="g2-form-section-title">{title}</div>
        {description && <div className="g2-form-section-desc">{description}</div>}
      </div>
      {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
    </div>
    {children}
  </section>
);

export const FormGrid: React.FC<{ cols?: 2 | 3; children: React.ReactNode }> = ({ cols = 2, children }) => (
  <div className={`g2-form-grid ${cols === 3 ? 'g2-form-grid-3' : ''}`}>{children}</div>
);

export const ErrorList: React.FC<{ errors: string[]; title?: string }> = ({ errors, title = 'Please fix the following' }) =>
  errors.length ? (
    <div className="g2-alert g2-alert-error" role="alert">
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong>{title}</strong>
        <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
    </div>
  ) : null;

export const Alert: React.FC<{ tone?: 'info' | 'warn' | 'error' | 'success'; icon?: React.ReactNode; children: React.ReactNode }> = ({ tone = 'info', icon, children }) => (
  <div className={`g2-alert g2-alert-${tone}`}>
    {icon && <span style={{ flexShrink: 0, display: 'inline-flex', marginTop: 1 }}>{icon}</span>}
    <div style={{ minWidth: 0 }}>{children}</div>
  </div>
);

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string }> = ({ value, onChange, placeholder = 'Search…', width }) => (
  <div className="g2-input-wrap" style={width ? { width } : undefined}>
    <Search size={15} />
    <input className="g2-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
  </div>
);
