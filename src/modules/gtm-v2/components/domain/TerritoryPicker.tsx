import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, X } from 'lucide-react';
import type { Territory, TerritoryLevelLabel, TerritoryNode } from '../../types';
import { buildTerritoryTree, collapseSelection, flattenTree, getDepth, getDescendantIds, levelLabelFor } from '../../utils/territory';
import { Checkbox, SearchInput } from '../ui/Form';
import { Highlight } from '../ui/Display';
import { useDismiss } from '../ui/Dropdown';

interface PickerProps {
  territories: Territory[];
  levelLabels: TerritoryLevelLabel[];
  values: string[];
  onChange: (ids: string[]) => void;
  includeInactive?: boolean;
  /** Limit selectable nodes (e.g. eligible territories). */
  selectableIds?: Set<string>;
  maxHeight?: number;
  /** Full territory list when `territories` is a subset — keeps level labels at their real depth. */
  allTerritories?: Territory[];
}

/**
 * Searchable hierarchical multi-select. Unlimited depth; labels come from configuration.
 * "Cascade" mode selects a node together with all descendants; otherwise individual nodes.
 */
export const TerritoryTreePicker: React.FC<PickerProps> = ({ territories, levelLabels, values, onChange, includeInactive, selectableIds, maxHeight = 320, allTerritories }) => {
  const [q, setQ] = useState('');
  const [cascade, setCascade] = useState(true);
  const visibleItems = useMemo(() => territories.filter((t) => includeInactive || t.status === 'Active'), [territories, includeInactive]);
  const tree = useMemo(() => {
    const built = buildTerritoryTree(visibleItems, levelLabels);
    if (!allTerritories) return built;
    // Subset trees: relabel each node with its absolute depth in the full hierarchy.
    const relabel = (n: TerritoryNode): TerritoryNode => {
      const depth = getDepth(n.id, allTerritories);
      return { ...n, levelLabel: levelLabelFor(depth, levelLabels), children: n.children.map(relabel) };
    };
    return built.map(relabel);
  }, [visibleItems, levelLabels, allTerritories]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tree.slice(0, 1).map((n) => n.id).concat(tree[0]?.children.map((c) => c.id) ?? [])));
  const selected = useMemo(() => new Set(values), [values]);

  const matches = useMemo(() => {
    if (!q.trim()) return null;
    const ql = q.toLowerCase();
    const hit = new Set<string>();
    flat.forEach((n) => {
      if (n.name.toLowerCase().includes(ql) || n.code.toLowerCase().includes(ql)) {
        hit.add(n.id);
        // keep ancestors visible
        let p = n.parentId;
        while (p) { hit.add(p); p = flat.find((x) => x.id === p)?.parentId ?? null; }
      }
    });
    return hit;
  }, [q, flat]);

  const toggle = (node: TerritoryNode, checked: boolean) => {
    const ids = cascade ? [node.id, ...getDescendantIds(node.id, visibleItems)] : [node.id];
    const allowed = ids.filter((i) => !selectableIds || selectableIds.has(i));
    const next = new Set(values);
    allowed.forEach((i) => (checked ? next.add(i) : next.delete(i)));
    onChange([...next]);
  };

  const renderNode = (n: TerritoryNode): React.ReactNode => {
    if (matches && !matches.has(n.id)) return null;
    const isOpen = matches ? true : expanded.has(n.id);
    const desc = n.children.length ? getDescendantIds(n.id, visibleItems) : [];
    const someDesc = desc.some((d) => selected.has(d));
    const disabled = selectableIds ? !selectableIds.has(n.id) : false;
    return (
      <div key={n.id}>
        <div className={`g2-tree-row ${selected.has(n.id) ? 'selected' : ''}`} style={{ paddingLeft: 6 + n.depth * 20 }}>
          {n.children.length ? (
            <button type="button" className="g2-tree-toggle" aria-label={isOpen ? 'Collapse' : 'Expand'} onClick={() => setExpanded((s) => { const x = new Set(s); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; })}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span style={{ width: 22 }} />}
          <Checkbox checked={selected.has(n.id)} indeterminate={someDesc} disabled={disabled} onChange={(c) => toggle(n, c)}
            label={<span><span className={`g2-tree-name ${n.status === 'Inactive' ? 'inactive' : ''}`}><Highlight text={n.name} query={q} /></span> <span className="g2-muted g2-small">{n.code}</span></span>} />
          <span className="g2-tree-level" style={{ marginLeft: 'auto' }}>{n.levelLabel}</span>
        </div>
        {isOpen && n.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div>
      <div className="g2-row" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 180 }}><SearchInput value={q} onChange={setQ} placeholder="Search territories…" /></div>
        <Checkbox checked={cascade} onChange={setCascade} label={<span className="g2-small">Include descendants</span>} />
      </div>
      <div className="g2-row g2-small g2-muted" style={{ marginBottom: 6, justifyContent: 'space-between' }}>
        <span><strong style={{ color: 'var(--g2-primary)' }}>{values.length}</strong> territor{values.length === 1 ? 'y' : 'ies'} selected</span>
        <span className="g2-row" style={{ gap: 4 }}>
          <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => setExpanded(new Set(flat.map((f) => f.id)))}>Expand all</button>
          <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => setExpanded(new Set())}>Collapse</button>
          <button type="button" className="g2-btn g2-btn-ghost g2-btn-sm" onClick={() => onChange([])} disabled={!values.length}>Clear</button>
        </span>
      </div>
      <div className="g2-tree" style={{ maxHeight, overflowY: 'auto', border: '1px solid var(--g2-border)', borderRadius: 10, padding: 4 }}>
        {tree.map(renderNode)}
        {matches && matches.size === 0 && <div className="g2-muted g2-small" style={{ padding: 12 }}>No territories match “{q}”.</div>}
      </div>
    </div>
  );
};

/** Compact dropdown wrapper showing selected territories as chips. */
export const TerritoryMultiSelect: React.FC<PickerProps & { placeholder?: string; invalid?: boolean; disabled?: boolean }> = ({ placeholder = 'Select territories…', invalid, disabled, ...props }) => {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const top = collapseSelection(props.values, props.territories);
  const name = (id: string) => props.territories.find((t) => t.id === id)?.name ?? id;
  return (
    <div className={`g2-dd ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className={`g2-dd-trigger ${invalid ? 'invalid' : ''}`} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <MapPin size={14} style={{ color: 'var(--g2-text-3)' }} />
        {props.values.length === 0 && <span className="g2-dd-placeholder">{placeholder}</span>}
        {top.slice(0, 3).map((id) => (
          <span key={id} className="g2-chip">
            <span className="g2-ellipsis">{name(id)}</span>
            {!disabled && <span role="button" tabIndex={-1} aria-label={`Remove ${name(id)}`} style={{ display: 'inline-flex', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); const drop = new Set([id, ...getDescendantIds(id, props.territories)]); props.onChange(props.values.filter((v) => !drop.has(v))); }}><X size={12} /></span>}
          </span>
        ))}
        {top.length > 3 && <span className="g2-chip neutral">+{top.length - 3}</span>}
        {props.values.length > 0 && <span className="g2-muted g2-small" style={{ marginLeft: 'auto' }}>{props.values.length} selected</span>}
        <ChevronDown size={15} className="g2-dd-caret" style={props.values.length ? { marginLeft: 6 } : undefined} />
      </button>
      {open && <div className="g2-dd-menu" style={{ padding: 10, minWidth: 360 }}><TerritoryTreePicker {...props} /></div>}
    </div>
  );
};
