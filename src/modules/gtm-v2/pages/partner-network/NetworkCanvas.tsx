import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Warehouse } from 'lucide-react';
import type { GtmConfiguration, Partner } from '../../types';
import type { NetEdge } from './networkGraph';
import { SOURCE_NODE } from './networkGraph';
import { PartnerStatusBadge } from '../../components/domain/Badges';

export interface NetColumn {
  id: string;
  title: string;
  partners: Partner[];
}

interface Line { key: string; d: string; highlighted: boolean; active: boolean }

/** Column-per-tier network with SVG edges measured from live DOM positions. */
export const NetworkCanvas: React.FC<{
  columns: NetColumn[];
  edges: NetEdge[];
  focusId: string | null;
  focusSet: Set<string> | null;
  config?: GtmConfiguration;
  onSelect: (id: string | null) => void;
  subtitle: (p: Partner) => string;
}> = ({ columns, edges, focusId, focusSet, config, onSelect, subtitle }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const pos = (id: string) => {
      const el = nodeRefs.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left - box.left + wrap.scrollLeft, r: r.right - box.left + wrap.scrollLeft, y: r.top - box.top + wrap.scrollTop + r.height / 2 };
    };
    const out: Line[] = [];
    edges.forEach((e) => {
      const a = pos(e.from);
      const b = pos(e.to);
      if (!a || !b) return;
      const forward = b.l >= a.r;
      const x1 = forward ? a.r : a.l;
      const x2 = forward ? b.l : b.r;
      const dx = Math.max(30, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
      out.push({
        key: `${e.from}>${e.to}`,
        d: `M ${x1} ${a.y} C ${x1 + dx} ${a.y}, ${x2 - dx} ${b.y}, ${x2} ${b.y}`,
        highlighted: !!focusSet && focusSet.has(e.from) && focusSet.has(e.to),
        active: e.active,
      });
    });
    setLines(out);
    setSize({ w: wrap.scrollWidth, h: wrap.scrollHeight });
  }, [edges, focusSet]);

  useLayoutEffect(() => {
    measure();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    nodeRefs.current.forEach((el) => ro.observe(el));
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [measure, columns]);

  const setRef = (id: string) => (el: HTMLElement | null) => { if (el) nodeRefs.current.set(id, el); else nodeRefs.current.delete(id); };
  const dim = (id: string) => !!focusSet && !focusSet.has(id);

  return (
    <div className="g2-net" ref={wrapRef} onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      <svg className="edges" width={size.w} height={size.h} aria-hidden="true">
        <defs>
          <marker id="g2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#a78bfa" /></marker>
          <marker id="g2-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6d28d9" /></marker>
        </defs>
        {lines.map((l) => (
          <path key={l.key} d={l.d} fill="none"
            stroke={l.highlighted ? '#6d28d9' : '#c4b5fd'} strokeWidth={l.highlighted ? 2.5 : 1.5}
            strokeDasharray={l.active ? undefined : '5 4'} opacity={focusSet && !l.highlighted ? 0.15 : 1}
            markerEnd={`url(#${l.highlighted ? 'g2-arrow-hl' : 'g2-arrow'})`} />
        ))}
      </svg>
      <div className="g2-net-cols">
        {columns.map((col) => (
          <div key={col.id} className="g2-net-col">
            <div className="g2-net-col-head">{col.title} <span className="g2-muted">({col.id === SOURCE_NODE ? 1 : col.partners.length})</span></div>
            {col.id === SOURCE_NODE ? (
              <div ref={setRef(SOURCE_NODE)} className={`g2-net-node ${dim(SOURCE_NODE) ? 'dim' : ''}`} style={{ cursor: 'default', background: '#f5f3ff', borderColor: '#ddd6fe' }}>
                <div className="g2-row" style={{ gap: 8 }}><Warehouse size={16} color="#6d28d9" /><span className="g2-strong">Company Warehouse</span></div>
                <div className="g2-cell-sub">Source of all supply</div>
              </div>
            ) : col.partners.map((p) => (
              <button
                type="button"
                key={p.id}
                ref={setRef(p.id)}
                className={`g2-net-node ${focusId === p.id ? 'focus' : ''} ${dim(p.id) ? 'dim' : ''}`}
                style={{ textAlign: 'left', font: 'inherit' }}
                onClick={() => onSelect(focusId === p.id ? null : p.id)}
              >
                <div className="g2-strong g2-ellipsis">{p.name}</div>
                <div className="g2-cell-sub g2-ellipsis">{subtitle(p)}</div>
                <div style={{ marginTop: 6 }}><PartnerStatusBadge status={p.status} config={config} /></div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
