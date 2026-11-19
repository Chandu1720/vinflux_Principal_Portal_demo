/**
 * Audit log (PL7): who did what, when, on which record and from where — across every module. Read-only (AUD-02):
 * nobody, including administrators, can edit or delete an entry. Search, filter and export (AUD-03).
 */
import React, { useMemo, useState } from 'react';
import { Download, History, ShieldCheck, Users } from 'lucide-react';
import { Badge, Button, Card, KpiCard, PageHeader, SearchInput, Select } from '../ui';
import type { BadgeTone } from '../../modules/gtm-v2/types';
import { useApp } from '../../context/AppContext.tsx';
import { auditTrail, download, toCsv } from '../audit';

const SRC: Record<string, BadgeTone> = { Screen: 'slate', 'Email action link': 'blue', 'Partner Lite': 'cyan', 'Connector / ERP': 'purple', System: 'amber', Event: 'green' };

const AuditLogPage: React.FC = () => {
  const { activePrincipal, currentUser } = useApp();
  const [q, setQ] = useState(''); const [mod, setMod] = useState(''); const [who, setWho] = useState(''); const [src, setSrc] = useState(''); const [days, setDays] = useState('30');
  const [limit, setLimit] = useState(200);
  const all = useMemo(() => auditTrail(activePrincipal.id), [activePrincipal.id]);
  const since = days === 'all' ? '' : new Date(Date.now() - Number(days) * 86400000).toISOString();
  const rows = all.filter((r) => (!since || r.at >= since) && (!mod || r.module === mod) && (!who || r.by === who) && (!src || r.source === src)
    && (!q || `${r.record} ${r.action} ${r.note} ${r.by}`.toLowerCase().includes(q.toLowerCase())));
  const mods = Array.from(new Set(all.map((r) => r.module))).sort();
  const people = Array.from(new Set(all.map((r) => r.by))).sort();
  const canExport = !currentUser.matrix || (currentUser.role ?? '').includes('Administrator') || (currentUser.role ?? '').includes('Auditor');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Audit log" description="Every change, approval, import, sync and decision — who, when, on which record and from where. Entries can't be edited or deleted by anyone." actions={canExport ? <Button icon={<Download size={15} />} onClick={() => download(`audit-${today}.csv`, toCsv(rows.map((r) => ({ when: r.at, who: r.by, module: r.module, record: r.record, action: r.action, note: r.note, source: r.source }))))}>Export {rows.length} row(s)</Button> : undefined} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Entries (filtered)" value={rows.length.toLocaleString('en-IN')} icon={<History size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${all.length.toLocaleString('en-IN')} in all`} />
        <KpiCard label="People" value={new Set(rows.map((r) => r.by)).size} icon={<Users size={22} />} color="#2563eb" bg="#eff6ff" foot="acted in this view" />
        <KpiCard label="From outside screens" value={rows.filter((r) => r.source !== 'Screen' && r.source !== 'Event').length} icon={<ShieldCheck size={22} />} color="#059669" bg="#ecfdf5" foot="email links, Partner Lite, connectors, system" />
        <KpiCard label="Today" value={rows.filter((r) => r.at.slice(0, 10) === today).length} icon={<History size={22} />} color="#d97706" bg="#fffbeb" foot="entries" />
      </div>
      <Card flush>
        <div className="g2-filterbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ width: 260 }}><SearchInput value={q} onChange={setQ} placeholder="Record, action, note…" /></div>
          <div style={{ width: 170 }}><Select value={mod} options={[{ value: '', label: 'All modules' }, ...mods.map((m) => ({ value: m, label: m }))]} onChange={setMod} /></div>
          <div style={{ width: 190 }}><Select value={who} options={[{ value: '', label: 'Everyone' }, ...people.map((m) => ({ value: m, label: m }))]} onChange={setWho} /></div>
          <div style={{ width: 170 }}><Select value={src} options={[{ value: '', label: 'Any source' }, ...Object.keys(SRC).map((m) => ({ value: m, label: m }))]} onChange={setSrc} /></div>
          <div style={{ width: 140 }}><Select value={days} options={[{ value: '1', label: 'Last 24 h' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'all', label: 'All time' }]} onChange={setDays} /></div>
        </div>
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th style={{ width: 140 }}>When</th><th>Who</th><th>Module</th><th>Record</th><th>What happened</th><th>Source</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="g2-muted">No entries for these filters.</td></tr>}
            {rows.slice(0, limit).map((r) => (
              <tr key={r.id}>
                <td className="g2-small">{r.at.slice(0, 16).replace('T', ' ')}</td>
                <td className="g2-small">{r.by}</td>
                <td><Badge tone="slate">{r.module}</Badge></td>
                <td className="g2-mono g2-small">{r.record}</td>
                <td className="g2-small">{r.action}{r.note && <div className="g2-cell-sub">{r.note}</div>}</td>
                <td><Badge tone={SRC[r.source] ?? 'slate'}>{r.source}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {rows.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><Button size="sm" onClick={() => setLimit(limit + 300)}>Show more ({rows.length - limit} left)</Button></div>}
      </Card>
    </div>
  );
};
export default AuditLogPage;
