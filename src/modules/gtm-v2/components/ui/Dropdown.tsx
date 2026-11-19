import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { SelectOption } from './Form';

/** Closes a popover on outside click / Escape. */
export const useDismiss = (open: boolean, close: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
};

export interface RichOption extends SelectOption { description?: string }

/** Single-value searchable select. */
export const SearchableSelect: React.FC<{
  value: string | null;
  options: RichOption[];
  onChange: (v: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}> = ({ value, options, onChange, placeholder = 'Select…', clearable, invalid, disabled, id }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(0);
  const ref = useDismiss(open, () => setOpen(false));
  const filtered = useMemo(() => options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const selected = options.find((o) => o.value === value);

  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div className={`g2-dd ${open ? 'open' : ''}`} ref={ref}>
      <button id={id} type="button" className={`g2-dd-trigger ${invalid ? 'invalid' : ''}`} disabled={disabled} onClick={() => { setOpen((o) => !o); setFocus(0); }}>
        {selected ? <span className="g2-ellipsis">{selected.label}</span> : <span className="g2-dd-placeholder">{placeholder}</span>}
        {clearable && selected && !disabled && (
          <span role="button" tabIndex={-1} aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(null); }} style={{ marginLeft: 'auto', display: 'inline-flex', color: 'var(--g2-text-3)' }}><X size={14} /></span>
        )}
        <ChevronDown size={15} className="g2-dd-caret" style={clearable && selected ? { marginLeft: 4 } : undefined} />
      </button>
      {open && (
        <div className="g2-dd-menu">
          <div className="g2-dd-search">
            <input
              autoFocus value={q} placeholder="Search…" onChange={(e) => { setQ(e.target.value); setFocus(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((f) => Math.min(f + 1, filtered.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((f) => Math.max(f - 1, 0)); }
                if (e.key === 'Enter' && filtered[focus] && !filtered[focus].disabled) { e.preventDefault(); pick(filtered[focus].value); }
              }}
            />
          </div>
          <div className="g2-dd-list" role="listbox">
            {filtered.length === 0 && <div className="g2-dd-option g2-muted">No matches</div>}
            {filtered.map((o, i) => (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value} disabled={o.disabled}
                className={`g2-dd-option ${o.value === value ? 'selected' : ''} ${i === focus ? 'focused' : ''}`} onClick={() => pick(o.value)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="g2-ellipsis" style={{ display: 'block' }}>{o.label}</span>
                  {o.description && <span className="g2-cell-sub">{o.description}</span>}
                </span>
                {o.value === value && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Flat multi-select with search, chips, select-all. */
export const MultiSelect: React.FC<{
  values: string[];
  options: RichOption[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  maxChips?: number;
}> = ({ values, options, onChange, placeholder = 'Select…', invalid, disabled, maxChips = 3 }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useDismiss(open, () => setOpen(false));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const sel = options.filter((o) => values.includes(o.value));

  return (
    <div className={`g2-dd ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className={`g2-dd-trigger ${invalid ? 'invalid' : ''}`} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {sel.length === 0 && <span className="g2-dd-placeholder">{placeholder}</span>}
        {sel.slice(0, maxChips).map((o) => (
          <span key={o.value} className="g2-chip">
            <span className="g2-ellipsis">{o.label}</span>
            {!disabled && <span role="button" tabIndex={-1} aria-label={`Remove ${o.label}`} onClick={(e) => { e.stopPropagation(); toggle(o.value); }} style={{ display: 'inline-flex', cursor: 'pointer' }}><X size={12} /></span>}
          </span>
        ))}
        {sel.length > maxChips && <span className="g2-chip neutral">+{sel.length - maxChips}</span>}
        <ChevronDown size={15} className="g2-dd-caret" />
      </button>
      {open && (
        <div className="g2-dd-menu">
          <div className="g2-dd-search"><input autoFocus value={q} placeholder="Search…" onChange={(e) => setQ(e.target.value)} /></div>
          <div className="g2-dd-list">
            {filtered.length === 0 && <div className="g2-dd-option g2-muted">No matches</div>}
            {filtered.map((o) => (
              <button key={o.value} type="button" className={`g2-dd-option ${values.includes(o.value) ? 'selected' : ''}`} disabled={o.disabled} onClick={() => toggle(o.value)}>
                <input type="checkbox" readOnly checked={values.includes(o.value)} tabIndex={-1} style={{ accentColor: 'var(--g2-primary)' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="g2-ellipsis" style={{ display: 'block' }}>{o.label}</span>
                  {o.description && <span className="g2-cell-sub">{o.description}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="g2-dd-footer">
            <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => onChange([...new Set([...values, ...filtered.filter((o) => !o.disabled).map((o) => o.value)])])}>Select all</button>
            <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => onChange([])}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
};
