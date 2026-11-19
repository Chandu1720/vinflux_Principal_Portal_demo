import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import type { ProductScope } from '../../types';
import { useProductMaster } from '../../hooks/useProductMaster';
import { Checkbox, SearchInput } from '../ui/Form';
import { Highlight } from '../ui/Display';

type Level = 'portfolioIds' | 'categoryIds' | 'subCategoryIds' | 'productIds';

/**
 * Applicable-products selector backed by the EXISTING Product Master
 * (Portfolio → Category → Subcategory → Product). Only IDs are stored.
 * Selecting a higher level covers everything beneath it, including products added later.
 */
export const ProductScopePicker: React.FC<{
  value: ProductScope;
  onChange: (v: ProductScope) => void;
  disabled?: boolean;
  /** Restrict the tree to these products (e.g. what the partner's applicable flows sell). */
  availableProductIds?: Set<string>;
  maxHeight?: number;
}> = ({ value, onChange, disabled, availableProductIds, maxHeight = 300 }) => {
  const pm = useProductMaster();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set(pm.portfolios.map((p) => p.id)));
  const pool = availableProductIds ? pm.products.filter((p) => availableProductIds.has(p.id)) : pm.products;
  const covered = pm.productsInScope(value).filter((p) => !availableProductIds || availableProductIds.has(p.id));

  const toggle = (level: Level, id: string, checked: boolean) => {
    const set = new Set(value[level]);
    if (checked) set.add(id); else set.delete(id);
    onChange({ ...value, allProducts: false, [level]: [...set] });
  };
  const flip = (id: string) => setOpen((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  const ql = q.trim().toLowerCase();
  const productsBySub = useMemo(() => {
    const m = new Map<string, typeof pm.products>();
    pool.forEach((p) => m.set(p.subCategoryId, [...(m.get(p.subCategoryId) ?? []), p]));
    return m;
  }, [pool]);

  const row = (depth: number, id: string, label: string, code: string, level: Level, inherited: boolean, hasChildren: boolean, count?: number) => (
    <div className={`g2-tree-row ${value[level].includes(id) ? 'selected' : ''}`} style={{ paddingLeft: 6 + depth * 20 }}>
      {hasChildren ? (
        <button type="button" className="g2-tree-toggle" onClick={() => flip(id)} aria-label="Toggle">{open.has(id) || ql ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
      ) : <span style={{ width: 22 }} />}
      <Checkbox checked={inherited || value[level].includes(id)} disabled={disabled || inherited || value.allProducts} onChange={(c) => toggle(level, id, c)}
        label={<span><span className="g2-tree-name"><Highlight text={label} query={q} /></span> <span className="g2-muted g2-small">{code}</span></span>} />
      <span className="g2-tree-level" style={{ marginLeft: 'auto' }}>{level === 'portfolioIds' ? 'Portfolio' : level === 'categoryIds' ? 'Category' : level === 'subCategoryIds' ? 'Subcategory' : 'Product'}{count !== undefined ? ` · ${count}` : ''}</span>
    </div>
  );

  return (
    <div>
      <div className="g2-row" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 180 }}><SearchInput value={q} onChange={setQ} placeholder="Search Product Master…" /></div>
        {!availableProductIds && <Checkbox checked={value.allProducts} disabled={disabled} onChange={(c) => onChange({ ...value, allProducts: c })} label={<strong className="g2-small">All products</strong>} />}
      </div>
      <div className="g2-row g2-small g2-muted" style={{ marginBottom: 6 }}>
        <Package size={13} /> <span><strong style={{ color: 'var(--g2-primary)' }}>{covered.length}</strong> of {pool.length} {availableProductIds ? 'available products' : 'Product Master items'} covered</span>
      </div>
      <div className="g2-tree" style={{ maxHeight, overflowY: 'auto', border: '1px solid var(--g2-border)', borderRadius: 10, padding: 4, opacity: value.allProducts ? 0.6 : 1 }}>
        {pm.portfolios.map((pf) => {
          const pfSel = value.portfolioIds.includes(pf.id);
          const pfMatch = !ql || pf.name.toLowerCase().includes(ql) || pf.categories.some((c) => c.name.toLowerCase().includes(ql) || c.subCategories.some((s) => s.name.toLowerCase().includes(ql) || (productsBySub.get(s.id) ?? []).some((p) => p.name.toLowerCase().includes(ql))));
          const hasPool = (subIds: string[]) => !availableProductIds || subIds.some((sid) => (productsBySub.get(sid) ?? []).length > 0);
          if (!pfMatch || !hasPool(pf.categories.flatMap((c) => c.subCategories.map((x) => x.id)))) return null;
          return (
            <div key={pf.id}>
              {row(0, pf.id, pf.name, pf.code, 'portfolioIds', false, pf.categories.length > 0)}
              {(open.has(pf.id) || ql) && pf.categories.filter((c) => hasPool(c.subCategories.map((x) => x.id))).map((c) => {
                const cSel = pfSel || value.categoryIds.includes(c.id);
                return (
                  <div key={c.id}>
                    {row(1, c.id, c.name, c.code, 'categoryIds', pfSel, c.subCategories.length > 0)}
                    {(open.has(c.id) || ql) && c.subCategories.filter((x) => hasPool([x.id])).map((s) => {
                      const prods = productsBySub.get(s.id) ?? [];
                      const sSel = cSel || value.subCategoryIds.includes(s.id);
                      return (
                        <div key={s.id}>
                          {row(2, s.id, s.name, s.code, 'subCategoryIds', cSel, prods.length > 0, prods.length)}
                          {(open.has(s.id) || ql) && prods.filter((p) => !ql || p.name.toLowerCase().includes(ql) || s.name.toLowerCase().includes(ql)).map((p) => (
                            <div key={p.id}>{row(3, p.id, p.name, p.code, 'productIds', sSel, false)}</div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
