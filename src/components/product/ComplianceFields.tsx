import React from 'react';
import type { IndustryPackId } from '../../types/product.ts';
import { complianceFieldsFor, isRequired } from '../../data/compliance.ts';
import { expiryLabel } from '../../utils/productLifecycle.ts';

const PACK_TITLE: Partial<Record<IndustryPackId, string>> = {
  agri: 'Agri registrations & label declarations',
  automotive: 'Part identity, fitment & certification',
  electronics: 'BIS, BEE, EPR & warranty',
};

const groupsOf = <T extends { group: string }>(list: T[]) => Array.from(new Set(list.map((f) => f.group))).map((g) => ({ g, items: list.filter((f) => f.group === g) }));

/** Editable compliance section, driven by src/data/compliance.ts. */
export const ComplianceForm: React.FC<{ pack: IndustryPackId; typeId?: string; values: Record<string, string>; onChange: (v: Record<string, string>) => void }> = ({ pack, typeId, values, onChange }) => {
  const fields = complianceFieldsFor(pack, typeId, values);
  if (!fields.length) return null;
  const set = (id: string, v: string) => onChange({ ...values, [id]: v });
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--vf-slate-200)', paddingTop: 18 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{PACK_TITLE[pack] ?? 'Compliance'}</h4>
      <p style={{ fontSize: 12, color: 'var(--vf-slate-500)', margin: '0 0 12px' }}>Checked when the product is submitted and approved. An expired licence or registration blocks approval.</p>
      {groupsOf(fields).map(({ g, items }) => (
        <div key={g} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--vf-slate-500)', marginBottom: 8 }}>{g}</div>
          <div className="vf-grid-2col" style={{ gap: '14px 16px' }}>
            {items.map((f) => {
              const v = values[f.id] ?? '';
              const req = isRequired(f, values);
              const exp = f.expiry ? expiryLabel(v, 90) : null;
              return (
                <div key={f.id} className="vf-form-group" style={f.kind === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                  {f.kind !== 'bool' && <label className="vf-label" htmlFor={`cf-${f.id}`}>{f.label}{req && ' *'}</label>}
                  {f.kind === 'select' && (
                    <select id={`cf-${f.id}`} className="vf-select" value={v} onChange={(e) => set(f.id, e.target.value)}>
                      <option value="">Choose…</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {f.kind === 'textarea' && <textarea id={`cf-${f.id}`} className="vf-input" rows={2} value={v} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} />}
                  {(f.kind === 'text' || f.kind === 'number' || f.kind === 'date') && (
                    <input id={`cf-${f.id}`} className="vf-input" type={f.kind === 'text' ? 'text' : f.kind} min={f.min} max={f.max} value={v} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} />
                  )}
                  {f.kind === 'bool' && (
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center', marginTop: 22 }}>
                      <input type="checkbox" checked={v === 'Yes'} onChange={(e) => set(f.id, e.target.checked ? 'Yes' : 'No')} /> {f.label}
                    </label>
                  )}
                  {exp && <span className={`vf-exp-${exp.tone}`} style={{ fontSize: 11.5 }}>{exp.text}</span>}
                  {!exp && (f.hint || f.patternHint) && <span style={{ fontSize: 11.5, color: 'var(--vf-slate-500)' }}>{f.hint ?? f.patternHint}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Read-only compliance section for the product detail page. */
export const ComplianceView: React.FC<{ pack: IndustryPackId; typeId?: string; values?: Record<string, string> }> = ({ pack, typeId, values = {} }) => {
  const fields = complianceFieldsFor(pack, typeId, values);
  if (!fields.length) return null;
  const missing = fields.filter((f) => isRequired(f, values) && !(values[f.id] ?? '').trim());
  return (
    <>
      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>{PACK_TITLE[pack] ?? 'Compliance'}</h3>
      {missing.length > 0 && <div className="vf-lc-errors" style={{ marginBottom: 14 }}>Missing: {missing.map((f) => f.label).join(', ')} — edit the product to add them.</div>}
      {groupsOf(fields).map(({ g, items }) => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--vf-slate-500)', marginBottom: 8 }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px', fontSize: '13px' }}>
            {items.map((f) => {
              const v = values[f.id] ?? '';
              const exp = f.expiry ? expiryLabel(v, 90) : null;
              return (
                <div key={f.id} className="vf-breakdown-row" style={f.kind === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                  <span>{f.label}</span>
                  <strong>{v || '—'} {exp && <span className={`vf-exp-${exp.tone}`}>· {exp.text}</span>}</strong>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
};
