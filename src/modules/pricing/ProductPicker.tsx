import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, Button, Checkbox, Field, FormGrid, Modal, NumberInput, SearchInput, Select } from '../../platform/ui';
import { useApp } from '../../context/AppContext.tsx';
import type { Product } from '../../types/product.ts';
import { gstOf, priceLists } from './pricingStore';
import type { PriceLine, PriceList } from './pricingStore';
import { newId } from '../../platform/store';

type Basis = 'blank' | 'mrp' | 'list' | 'floor';
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

interface Node { id: string; label: string; level: 0 | 1 | 2; products: Product[]; children: Node[] }

/**
 * Add many products to a price list at once: select all, or drill down
 * portfolio → category → sub-category → product, and fill starting prices in one go.
 */
export const ProductPicker: React.FC<{ list: PriceList; onClose: () => void; onAdd: (lines: PriceLine[]) => void }> = ({ list, onClose, onAdd }) => {
  const { products, portfolios } = useApp();
  const inList = useMemo(() => new Set(list.lines.map((l) => l.productId)), [list.lines]);
  const eligible = useMemo(() => products.filter((p) => p.principalId === list.principalId && p.lifecycleStatus !== 'Retired'), [products, list.principalId]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(() => new Set(portfolios.map((p) => p.id)));
  const [basis, setBasis] = useState<Basis>('mrp');
  const [pct, setPct] = useState<number | null>(70);
  const [fromList, setFromList] = useState('');
  const sources = priceLists().filter((l) => l.principalId === list.principalId && l.id !== list.id && ['Active', 'Pending', 'Draft'].includes(l.status));

  const match = (p: Product) => !q || [p.name, p.code, p.brand ?? ''].some((x) => x.toLowerCase().includes(q.toLowerCase()));
  const tree: Node[] = useMemo(() => portfolios.map((pf) => {
    const inPf = eligible.filter((p) => p.portfolioId === pf.id && match(p));
    const cats = pf.categories.map((c): Node => {
      const inCat = inPf.filter((p) => p.categoryId === c.id);
      const subs = c.subCategories.map((s): Node => ({ id: s.id, label: s.name, level: 2, products: inCat.filter((p) => p.subCategoryId === s.id), children: [] }));
      const loose = inCat.filter((p) => !c.subCategories.some((s) => s.id === p.subCategoryId));
      if (loose.length) subs.push({ id: `${c.id}-other`, label: 'Other', level: 2, products: loose, children: [] });
      return { id: c.id, label: c.name, level: 1, products: inCat, children: subs.filter((s) => s.products.length) };
    });
    const loose = inPf.filter((p) => !pf.categories.some((c) => c.id === p.categoryId));
    if (loose.length) cats.push({ id: `${pf.id}-other`, label: 'Other', level: 1, products: loose, children: [{ id: `${pf.id}-other-s`, label: 'Other', level: 2, products: loose, children: [] }] });
    return { id: pf.id, label: pf.name, level: 0 as const, products: inPf, children: cats.filter((c) => c.products.length) };
  }).filter((n) => n.products.length),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [portfolios, eligible, q]);

  const selectable = (ps: Product[]) => ps.filter((p) => !inList.has(p.id));
  const stateOf = (ps: Product[]) => {
    const s = selectable(ps);
    const n = s.filter((p) => sel.has(p.id)).length;
    return { checked: s.length > 0 && n === s.length, indeterminate: n > 0 && n < s.length, n, total: s.length };
  };
  const toggleMany = (ps: Product[], on: boolean) => setSel((prev) => {
    const next = new Set(prev);
    selectable(ps).forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
    return next;
  });
  const flip = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /** Starting price (ex-GST) for a product under the chosen basis. */
  const startPrice = (p: Product): { price: number; slabs: { minQty: number; price: number }[] } => {
    const f = (pct ?? 0) / 100;
    const ref = p.pricingReference;
    if (basis === 'mrp' && ref?.mrp) return { price: round((ref.mrp / (1 + gstOf(p) / 100)) * f), slabs: [] };
    if (basis === 'floor') {
      const floor = list.type === 'CONTRACT' ? ref?.institutionalTenderCap : ref?.dealerTransferCap;
      if (floor) return { price: round(floor * (1 + f)), slabs: [] };
    }
    if (basis === 'list') {
      const ln = sources.find((l) => l.id === fromList)?.lines.find((x) => x.productId === p.id);
      if (ln) return { price: round(ln.price * (1 + f)), slabs: ln.slabs.map((s) => ({ minQty: s.minQty, price: round(s.price * (1 + f)) })) };
    }
    return { price: 0, slabs: [] };
  };
  const chosen = eligible.filter((p) => sel.has(p.id));
  const preview = chosen.slice(0, 4).map((p) => ({ p, ...startPrice(p) }));
  const unpriced = chosen.filter((p) => !startPrice(p).price).length;
  const all = stateOf(tree.flatMap((n) => n.products));

  const add = () => {
    onAdd(chosen.map((p) => ({ id: newId('ln'), productId: p.id, ...startPrice(p) })));
    onClose();
  };

  const row = (label: React.ReactNode, ps: Product[], depth: number, nodeId?: string, extra?: React.ReactNode) => {
    const st = stateOf(ps);
    return (
      <div className="g2-row" style={{ padding: '7px 10px', paddingLeft: 10 + depth * 22, borderBottom: '1px solid var(--g2-border)', gap: 8, background: depth === 0 ? 'var(--g2-slate-bg)' : undefined }}>
        {nodeId ? <button type="button" className="g2-icon-btn" style={{ width: 22, height: 22 }} aria-label={open.has(nodeId) ? 'Collapse' : 'Expand'} onClick={() => flip(nodeId)}>{open.has(nodeId) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button> : <span style={{ width: 22 }} />}
        <Checkbox checked={st.checked} indeterminate={st.indeterminate} disabled={!st.total} onChange={(v) => toggleMany(ps, v)} label={label} />
        <span className="g2-spacer" />
        {extra ?? <span className="g2-small g2-muted">{st.n ? `${st.n} of ${st.total} selected` : `${st.total} product(s)`}{ps.length > st.total ? ` · ${ps.length - st.total} already in list` : ''}</span>}
      </div>
    );
  };

  return (
    <Modal open size="xl" title="Add products to the price list" subtitle={`${list.name || 'New list'} · choose everything, or drill down portfolio → category → sub-category → product`} onClose={onClose}
      footer={<><span className="g2-small g2-muted" style={{ marginRight: 'auto' }}>{chosen.length} selected{unpriced ? ` · ${unpriced} without a starting price (enter manually)` : ''}</span><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!chosen.length} onClick={add}>Add {chosen.length} product(s)</Button></>}>
      <div className="g2-stack">
        <div className="g2-row">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, code, brand…" width={320} />
          <span className="g2-spacer" />
          <Button size="sm" onClick={() => toggleMany(tree.flatMap((n) => n.products), true)} disabled={!all.total}>Select all ({all.total})</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())} disabled={!sel.size}>Clear</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(new Set(tree.flatMap((n) => [n.id, ...n.children.flatMap((c) => [c.id, ...c.children.map((s) => s.id)])])))}>Expand all</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}>Collapse</Button>
        </div>

        <div style={{ border: '1px solid var(--g2-border)', borderRadius: 10, maxHeight: 380, overflow: 'auto' }}>
          {tree.length === 0 && <div className="g2-muted" style={{ padding: 16 }}>No products match.</div>}
          {tree.map((pf) => (
            <React.Fragment key={pf.id}>
              {row(<strong>{pf.label}</strong>, pf.products, 0, pf.id)}
              {open.has(pf.id) && pf.children.map((c) => (
                <React.Fragment key={c.id}>
                  {row(<span className="g2-strong">{c.label}</span>, c.products, 1, c.id)}
                  {open.has(c.id) && c.children.map((s) => (
                    <React.Fragment key={s.id}>
                      {row(s.label, s.products, 2, s.id)}
                      {open.has(s.id) && s.products.map((p) => {
                        const already = inList.has(p.id);
                        return (
                          <React.Fragment key={p.id}>
                            {row(<span><span>{p.name}</span><span className="g2-cell-sub" style={{ display: 'block' }}>{p.code} · GST {gstOf(p)}%</span></span>, [p], 3, undefined,
                              already ? <Badge tone="slate">Already in list</Badge> : <span className="g2-small g2-muted">MRP {p.pricingReference?.mrp ? inr(p.pricingReference.mrp) : '—'}</span>)}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="g2-card" style={{ padding: 14 }}>
          <div className="g2-label" style={{ marginBottom: 8 }}>Starting price for the selected products</div>
          <FormGrid cols={3}>
            <Field label="Based on">
              <Select value={basis} onChange={(v) => { setBasis(v as Basis); setPct(v === 'mrp' ? 70 : v === 'floor' ? 5 : 0); }} options={[
                { value: 'mrp', label: '% of MRP (before GST)' },
                { value: 'floor', label: list.type === 'CONTRACT' ? 'Tender floor price + %' : 'Trade floor price + %' },
                { value: 'list', label: 'Another price list ± %' },
                { value: 'blank', label: 'Leave empty — I’ll type prices' },
              ]} />
            </Field>
            {basis === 'list' && <Field label="Copy from"><Select value={fromList} placeholder="Choose a list…" options={sources.map((l) => ({ value: l.id, label: `${l.name} v${l.version} (${l.status})` }))} onChange={setFromList} /></Field>}
            {basis !== 'blank' && <Field label={basis === 'mrp' ? '% of MRP' : 'Change %'} hint={basis === 'mrp' ? 'e.g. 70 = price is 70% of MRP before GST' : 'e.g. 5 = 5% higher, -3 = 3% lower'}><NumberInput value={pct} onChange={setPct} /></Field>}
          </FormGrid>
          {preview.length > 0 && (
            <div className="g2-small" style={{ marginTop: 8 }}>
              <span className="g2-muted">Preview: </span>
              {preview.map(({ p, price }) => <span key={p.id} className="g2-chip" style={{ marginRight: 6 }}>{p.name.slice(0, 28)}{p.name.length > 28 ? '…' : ''} → {price ? inr(price) : 'enter manually'}</span>)}
              {chosen.length > preview.length && <span className="g2-muted">+{chosen.length - preview.length} more</span>}
            </div>
          )}
          <div className="g2-small g2-muted" style={{ marginTop: 6 }}>Every price is still checked against MRP, the government ceiling and the floor price before the list can be submitted.</div>
        </div>
      </div>
    </Modal>
  );
};
