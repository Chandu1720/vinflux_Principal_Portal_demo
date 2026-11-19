import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, UserPlus } from 'lucide-react';
import { useGtmBundle } from '../../hooks/useGtmData';
import type { Partner } from '../../types';
import { ROUTES } from '../../constants/navigation';
import { partnerChannelId } from '../../utils/eligibility';
import { territoriesOverlap } from '../../utils/territory';
import { includesText } from '../../utils/format';
import {
  Button, Card, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, SearchableSelect, SearchInput, Segmented, Select,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { PartnerStatusBadge } from '../../components/domain/Badges';
import { NetworkCanvas } from './NetworkCanvas';
import type { NetColumn } from './NetworkCanvas';
import { PartnerDetailPanel } from './PartnerDetailPanel';
import { buildEdges, connectedSet, SOURCE_NODE } from './networkGraph';

const PartnerNetworkPage: React.FC = () => {
  const navigate = useNavigate();
  const data = useGtmBundle();
  const [view, setView] = useState('graph');
  const [q, setQ] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

  const { partners, channels, territories, zones, flows, mappings, overrides, terms, config } = data;
  const types = useMemo(() => config?.partnerTypes ?? [], [config]);

  const visible = useMemo(() => partners.filter((p) => {
    if (p.status === 'Draft' && status !== 'Draft') return false;
    if (status && p.status !== status) return false;
    if (channelId && partnerChannelId(p, types) !== channelId) return false;
    if (territoryId && !territoriesOverlap(p.territoryIds, [territoryId], territories, 'hierarchy')) return false;
    if (zoneId) {
      const z = zones.find((x) => x.id === zoneId);
      if (!z || !territoriesOverlap(p.territoryIds, z.territoryIds, territories, 'hierarchy')) return false;
    }
    return includesText([p.name, p.code, p.businessName, p.contactPerson], q);
  }), [partners, status, channelId, territoryId, zoneId, q, territories, zones, types]);

  const visibleIds = useMemo(() => new Set(visible.map((p) => p.id)), [visible]);
  const allEdges = useMemo(() => buildEdges(mappings, flows, channels), [mappings, flows, channels]);
  const edges = useMemo(() => allEdges.filter((e) => (e.from === SOURCE_NODE || visibleIds.has(e.from)) && visibleIds.has(e.to)), [allEdges, visibleIds]);

  const columns = useMemo<NetColumn[]>(() => {
    const byChannel = new Map<string, Partner[]>();
    visible.forEach((p) => { const c = partnerChannelId(p, types) ?? 'unknown'; byChannel.set(c, [...(byChannel.get(c) ?? []), p]); });
    const cols = [...byChannel.entries()].map(([cid, ps]) => {
      const ch = channels.find((c) => c.id === cid);
      return { id: cid, title: ch?.name ?? 'Unlinked', rank: ch ? (ch.canBeEndpoint ? 1000 + ch.tierRank : ch.tierRank) : 2000, partners: ps.slice().sort((a, b) => a.name.localeCompare(b.name)) };
    }).sort((a, b) => a.rank - b.rank);
    const hasSource = edges.some((e) => e.from === SOURCE_NODE);
    return [...(hasSource ? [{ id: SOURCE_NODE, title: 'Source', partners: [] }] : []), ...cols];
  }, [visible, channels, edges, types]);

  const focus = useMemo(() => (focusId && visibleIds.has(focusId) ? connectedSet(focusId, edges) : null), [focusId, edges, visibleIds]);
  const focusPartner = focusId ? partners.find((p) => p.id === focusId) : undefined;
  const typeName = (p: Partner) => types.find((t) => t.id === p.partnerTypeId)?.name ?? '—';
  const terrNames = (p: Partner) => p.territoryIds.map((t) => territories.find((x) => x.id === t)?.name ?? t).join(', ');
  const direct = (id: string, dir: 'up' | 'down') => allEdges.filter((e) => (dir === 'up' ? e.to === id && e.from !== SOURCE_NODE : e.from === id)).map((e) => (dir === 'up' ? e.from : e.to));

  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error} />;

  const tableCols: Column<Partner>[] = [
    { key: 'name', header: 'Partner', sortValue: (p) => p.name, render: (p) => <div><div className="g2-cell-main">{p.name}</div><div className="g2-cell-sub">{p.code} · {typeName(p)}</div></div> },
    { key: 'terr', header: 'Territories', render: (p) => <span className="g2-small">{terrNames(p) || '—'}</span> },
    { key: 'up', header: 'Upstream', render: (p) => <span className="g2-small">{direct(p.id, 'up').map((id) => partners.find((x) => x.id === id)?.name).join(', ') || '—'}</span> },
    { key: 'down', header: 'Downstream', render: (p) => <span className="g2-small">{direct(p.id, 'down').map((id) => partners.find((x) => x.id === id)?.name).join(', ') || '—'}</span> },
    { key: 'flows', header: 'Sales Policies', align: 'right', sortValue: (p) => mappings.filter((m) => m.partnerId === p.id).length, render: (p) => mappings.filter((m) => m.partnerId === p.id).length },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <PartnerStatusBadge status={p.status} config={config} /> },
  ];

  return (
    <>
      <PageHeader
        title="Partner Network"
        description="Actual upstream and downstream partner relationships mapped onto master sales policies. Click a partner to trace its connections."
        actions={<>
          <Segmented options={[{ id: 'graph', label: 'Network' }, { id: 'list', label: 'List' }]} value={view} onChange={setView} />
          <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => navigate(`${ROUTES.partners}?new=1`)}>Onboard partner</Button>
        </>}
      />
      <Card flush>
        <div className="g2-filterbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search partners…" width={240} />
          <div style={{ minWidth: 170 }}><SearchableSelect value={channelId} onChange={setChannelId} clearable placeholder="Any channel" options={channels.map((c) => ({ value: c.id, label: c.name }))} /></div>
          <div style={{ minWidth: 190 }}><SearchableSelect value={territoryId} onChange={setTerritoryId} clearable placeholder="Any territory" options={territories.map((t) => ({ value: t.id, label: t.name, description: t.code }))} /></div>
          <div style={{ minWidth: 170 }}><SearchableSelect value={zoneId} onChange={setZoneId} clearable placeholder="Any zone" options={zones.map((z) => ({ value: z.id, label: z.name }))} /></div>
          <Select value={status} onChange={setStatus} placeholder="All statuses (excl. drafts)" options={(config?.partnerStatuses ?? []).map((s) => ({ value: s.key, label: s.label }))} />
          <span className="g2-spacer" />
          <span className="g2-muted g2-small">{visible.length} partners · {edges.filter((e) => e.from !== SOURCE_NODE).length} links</span>
        </div>
      </Card>

      <div className="g2-grid g2-grid-main g2-mt" style={{ alignItems: 'start' }}>
        <Card
          title={view === 'graph' ? 'Distribution network' : 'Partner relationships'}
          subtitle={view === 'graph' ? 'Columns follow channel tier order. Dashed links are relationships pending activation.' : undefined}
          flush
          style={!focusPartner ? { gridColumn: '1 / -1' } : undefined}
        >
          {visible.length === 0 ? (
            <EmptyState icon={<Network size={24} />} title="No partners match" description="Adjust the filters to see partner relationships." />
          ) : view === 'graph' ? (
            <NetworkCanvas columns={columns} edges={edges} focusId={focusId} focusSet={focus?.all ?? null} config={config} onSelect={setFocusId}
              subtitle={(p) => `${p.code} · ${terrNames(p) || 'No territory'}`} />
          ) : (
            <DataTable columns={tableCols} rows={visible} rowKey={(p) => p.id} onRowClick={(p) => setFocusId(p.id)} />
          )}
        </Card>
        {focusPartner && (
          <div style={{ position: 'sticky', top: 80 }}>
            <PartnerDetailPanel
              partner={focusPartner}
              partners={partners}
              upstream={direct(focusPartner.id, 'up')}
              downstream={direct(focusPartner.id, 'down')}
              mappings={mappings}
              overrides={overrides}
              flows={flows}
              channels={channels}
              territories={territories}
              terms={terms}
              config={config}
              onSelect={setFocusId}
              onClose={() => setFocusId(null)}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default PartnerNetworkPage;
