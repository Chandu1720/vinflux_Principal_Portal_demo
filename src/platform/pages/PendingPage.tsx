/**
 * What's pending — module by module: demo gaps, functionality still to build, what go-live needs (backend and real
 * integrations) and decisions that are parked. Ticks are per viewer (this browser) so a team can walk through it.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Construction, Flag, MonitorPlay, Rocket } from 'lucide-react';
import { Badge, Card, KpiCard, PageHeader, SearchInput, Segmented } from '../ui';
import type { BadgeTone } from '../../modules/gtm-v2/types';
import { usePlatform } from '../PlatformContext';
import { useApp } from '../../context/AppContext.tsx';
import { MODULES } from '../modules';
import { NOTHING_PENDING, ROADMAP, doneSet, setDone } from '../roadmap';
import type { PendingKind } from '../roadmap';

const KIND: Record<PendingKind, { tone: BadgeTone; hint: string }> = {
  'Demo gap': { tone: 'amber', hint: 'Built, but the demo data doesn’t show it yet' },
  'To build': { tone: 'blue', hint: 'Functionality not built yet' },
  'Go-live': { tone: 'purple', hint: 'Needs the backend or a real integration' },
  Decision: { tone: 'slate', hint: 'Parked until decided' },
};

const PendingPage: React.FC = () => {
  const { enabled } = usePlatform();
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [kind, setKind] = useState<'all' | PendingKind>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<'open' | 'all'>('all');
  const [done, setD] = useState(doneSet());
  const toggle = (id: string, on: boolean) => { setDone(id, on, currentUser.name); setD(doneSet()); };
  const all = ROADMAP.flatMap((gr) => gr.items);
  const count = (k: PendingKind) => all.filter((i) => i.kind === k && !done[i.id]).length;
  const groups = ROADMAP.map((gr) => ({ ...gr, items: gr.items.filter((i) => (kind === 'all' || i.kind === kind) && (open === 'all' || !done[i.id]) && (!q || `${gr.title} ${i.text}`.toLowerCase().includes(q.toLowerCase()))) })).filter((gr) => gr.items.length);
  const go = (path: string) => (path === '/p' ? window.open('/p', '_blank') : navigate(path));
  const modName = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="g2 g2-embed">
      <PageHeader title="What's pending" description="Module by module: what the demo doesn't show yet, what is still to build, what go-live needs, and what is waiting for a decision. Tick items as you close them — ticks are kept in this browser." />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Demo gaps" value={count('Demo gap')} icon={<MonitorPlay size={22} />} color="#c77700" bg="#fff5e0" foot={KIND['Demo gap'].hint} onClick={() => setKind('Demo gap')} />
        <KpiCard label="To build" value={count('To build')} icon={<Construction size={22} />} color="#2563eb" bg="#eaf1ff" foot={KIND['To build'].hint} onClick={() => setKind('To build')} />
        <KpiCard label="Go-live" value={count('Go-live')} icon={<Rocket size={22} />} color="#7c3aed" bg="#f1ebfd" foot={KIND['Go-live'].hint} onClick={() => setKind('Go-live')} />
        <KpiCard label="Decisions" value={count('Decision')} icon={<Flag size={22} />} color="#55607a" bg="#f1f3f7" foot={KIND.Decision.hint} onClick={() => setKind('Decision')} />
      </div>
      <div className="g2-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Segmented options={[{ id: 'all', label: 'All' }, ...(Object.keys(KIND) as PendingKind[]).map((k) => ({ id: k, label: k }))]} value={kind} onChange={(v) => setKind(v as 'all' | PendingKind)} />
        <Segmented options={[{ id: 'all', label: 'With done' }, { id: 'open', label: 'Open only' }]} value={open} onChange={(v) => setOpen(v as 'open' | 'all')} />
        <span className="g2-spacer" />
        <div style={{ width: 260 }}><SearchInput value={q} onChange={setQ} placeholder="Search module or item" /></div>
      </div>
      {groups.length === 0 ? <Card><div className="g2-small g2-muted">Nothing open for this filter.</div></Card> : (
        <div className="pd-grid">
          {groups.map((gr) => (
            <div key={gr.key} className="pd-card">
              <div className="pd-h">
                <h3>{gr.title}</h3>
                <span className="pd-count">{gr.items.filter((i) => !done[i.id]).length}</span>
                {gr.module && <Badge tone={enabled(gr.module) ? 'green' : 'slate'}>{enabled(gr.module) ? 'On' : 'Off'}</Badge>}
                <span className="g2-spacer" />
                {gr.path && <button type="button" className="pd-open" onClick={() => go(gr.path!)}>Open <ArrowRight size={13} /></button>}
              </div>
              {gr.items.map((i) => (
                <label key={i.id} className={`pd-row ${done[i.id] ? 'done' : ''}`}>
                  <input type="checkbox" checked={!!done[i.id]} onChange={(e) => toggle(i.id, e.target.checked)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pd-text">{i.text}</div>
                    {done[i.id] && <div className="g2-small g2-muted">Done · {done[i.id]}</div>}
                  </div>
                  <Badge tone={KIND[i.kind].tone}>{i.kind}</Badge>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="g2-small g2-muted" style={{ marginTop: 16 }}>
        No open items beyond the shared backend: {NOTHING_PENDING.map(modName).join(', ')}.
      </div>
      <style>{`
        .pd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
        .pd-card{background:#fff;border:1px solid #e4e8f0;border-radius:10px;box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.06);overflow:hidden}
        .pd-h{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #eef1f6;background:linear-gradient(90deg,#f5f8ff,#fff)}
        .pd-h h3{margin:0;font-size:14px;font-weight:600;color:#0f1a33}
        .pd-count{font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:20px;background:#eaf1ff;color:#2563eb}
        .pd-open{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;color:#2563eb;padding:4px 6px;border-radius:6px}
        .pd-open:hover{background:#eaf1ff}
        .pd-row{display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-top:1px solid #f3f5f9;cursor:pointer}
        .pd-row:first-of-type{border-top:0}
        .pd-row input{margin-top:3px;flex:0 0 auto}
        .pd-text{font-size:13px;color:#1f2a44;line-height:1.45}
        .pd-row.done .pd-text{text-decoration:line-through;color:#8a93a8}
        @media (max-width: 1000px){ .pd-grid{grid-template-columns:1fr} }
      `}</style>
    </div>
  );
};
export default PendingPage;
