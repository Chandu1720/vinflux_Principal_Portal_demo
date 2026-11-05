import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { CommercialField, CommercialValues, ResolvedTerms } from '../../types';
import { COMMERCIAL_FIELDS, flattenResolved } from '../../utils/commercial';
import { formatCommercial } from '../../utils/format';
import { Checkbox, NumberInput, Switch } from '../ui/Form';
import { Badge } from '../ui/Display';
import { OriginBadge } from './Badges';

/** Fields that differ from the inherited values. */
export const changedTerms = (base: CommercialValues, values: Partial<CommercialValues>): Partial<CommercialValues> => {
  const out: Partial<CommercialValues> = {};
  (Object.keys(values) as CommercialField[]).forEach((k) => {
    if (values[k] !== undefined && values[k] !== base[k]) (out as Record<string, unknown>)[k] = values[k];
  });
  return out;
};

/**
 * One "Override commercial terms" switch makes ALL terms editable at once.
 * Inputs start at the inherited values; only changed values are submitted.
 */
export const CommercialOverrideEditor: React.FC<{
  resolved: ResolvedTerms;
  enabled: boolean;
  values: Partial<CommercialValues>;
  onEnabledChange: (enabled: boolean, values: Partial<CommercialValues>) => void;
  onValuesChange: (values: Partial<CommercialValues>) => void;
  disabled?: boolean;
  label?: string;
}> = ({ resolved, enabled, values, onEnabledChange, onValuesChange, disabled, label = 'Override commercial terms' }) => {
  const base = flattenResolved(resolved);
  const current: CommercialValues = { ...base, ...values };
  const changed = changedTerms(base, values);
  const changedCount = Object.keys(changed).length;

  const setVal = (k: CommercialField, v: number | boolean | null) => {
    const next: Partial<CommercialValues> = { ...current, [k]: v ?? 0 };
    if (k === 'depositRequired' && v === false) next.depositAmount = 0;
    if (k === 'depositRequired' && v === true && !next.depositAmount) next.depositAmount = base.depositAmount;
    onValuesChange(next);
  };

  return (
    <div className="g2-stack" style={{ gap: 12 }}>
      <div className={`g2-override-toggle ${enabled ? 'on' : ''}`}>
        <Checkbox checked={enabled} disabled={disabled} onChange={(c) => onEnabledChange(c, c ? base : {})} label={<strong>{label}</strong>} />
        <span className="g2-small g2-muted" style={{ flex: 1 }}>
          {enabled ? 'All terms are editable. Only the values you change are submitted — unchanged terms keep inheriting.' : 'Inherited terms apply. Tick to edit all terms together.'}
        </span>
        {enabled && <Badge tone={changedCount ? 'amber' : 'slate'}>{changedCount} changed</Badge>}
      </div>

      <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10, background: '#fff' }}>
        <table className="g2-table">
          <thead><tr><th>Term</th><th>Inherited value</th><th>Source</th><th style={{ width: 240 }}>{enabled ? 'Override value' : 'Applied value'}</th></tr></thead>
          <tbody>
            {COMMERCIAL_FIELDS.map((f) => {
              const r = resolved[f.key];
              const v = current[f.key];
              const isChanged = f.key in changed;
              const depositOff = f.key === 'depositAmount' && !current.depositRequired;
              return (
                <tr key={f.key} className={enabled && isChanged ? 'g2-changed' : ''}>
                  <td className="g2-strong">{f.label}</td>
                  <td>{formatCommercial(f.kind, r.value)}</td>
                  <td><OriginBadge scope={r.scope} label={r.label} /></td>
                  <td>
                    {!enabled ? <span className="g2-muted">{formatCommercial(f.kind, r.value)}</span> : (
                      <div className="g2-row" style={{ flexWrap: 'nowrap' }}>
                        {f.kind === 'bool'
                          ? <div className="g2-row" style={{ flex: 1 }}><Switch checked={!!v} disabled={disabled} onChange={(x) => setVal(f.key, x)} label={f.label} /><span className="g2-small">{v ? 'Yes' : 'No'}</span></div>
                          : <div style={{ flex: 1 }}><NumberInput value={v as number} min={0} disabled={disabled || depositOff} onChange={(x) => setVal(f.key, x)} suffix={f.kind === 'pct' ? '%' : f.kind === 'days' ? 'days' : '₹'} /></div>}
                        <button type="button" className="g2-icon-btn" title="Reset to inherited" aria-label={`Reset ${f.label}`} disabled={!isChanged || disabled}
                          onClick={() => onValuesChange({ ...current, [f.key]: base[f.key], ...(f.key === 'depositRequired' ? { depositAmount: base.depositAmount } : {}) })}>
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
