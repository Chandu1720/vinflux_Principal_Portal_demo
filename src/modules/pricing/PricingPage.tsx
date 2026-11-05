import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeIndianRupee, CalendarClock, ClipboardCheck, FileSignature, Plus, Tag } from 'lucide-react';
import { Alert, Badge, Button, Card, KpiCard, PageHeader, SearchInput, Select, Tabs } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useChannels, usePartners, useTerritories } from '../gtm-v2/hooks/useGtmData';
import { TYPE_LABEL, blankList, effectiveOn, priceLists, subscribePricing, today } from './pricingStore';
import type { ListType, PriceList } from './pricingStore';
import { PriceListDrawer, STATUS_TONE } from './PriceListDrawer';
import { PriceCheckTab } from './PriceCheckTab';
import { SchemesTab } from './SchemesTab';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const daysTo = (iso: string) => Math.round((Date.parse(iso) - Date.parse(today())) / 86400000);

const PricingPage: React.FC = () => {
  useSubscribe(subscribePricing);
  const { activePrincipal, currentUser } = useApp();
  const channels = useChannels().data ?? [];
  const partners = usePartners().data ?? [];
  const territories = useTerritories().data ?? [];
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'lists';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<PriceList | null>(null);
  const all = priceLists().filter((l) => l.principalId === activePrincipal.id);
  const on = today();
  const pending = all.filter((l) => l.status === 'Pending');
  const contracts = all.filter((l) => l.type === 'CONTRACT');
  const expiring = contracts.filter((l) => l.status === 'Active' && l.validTo && daysTo(l.validTo) <= 90 && daysTo(l.validTo) >= 0);
  const pName = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const appliesTo = (l: PriceList) => l.type === 'CHANNEL'
    ? `${channels.find((c) => c.id === l.channelId)?.name ?? '—'}${l.territoryIds.length ? ` · ${l.territoryIds.map((t) => territories.find((x) => x.id === t)?.name ?? t).join(', ')}` : ' · everywhere'}`
    : l.partnerIds.map(pName).join(', ');
  const listState = (l: PriceList) => {
    if (l.status !== 'Active') return { label: l.status === 'Pending' ? 'Pending approval' : l.status, tone: STATUS_TONE[l.status] };
    if (l.validFrom > on) return { label: `Starts ${l.validFrom}`, tone: 'blue' as const };
    if (l.validTo && l.validTo < on) return { label: 'Expired', tone: 'slate' as const };
    return { label: effectiveOn(l, on) ? 'In force' : 'Active', tone: 'green' as const };
  };
  const rows = useMemo(() => all.filter((l) => (tab === 'contracts' ? l.type === 'CONTRACT' : tab === 'approvals' ? l.status === 'Pending' : l.type !== 'CONTRACT')
    && (!status || l.status === status)
    && [l.name, l.code, l.contractRef ?? '', appliesTo(l)].some((x) => x.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name) || b.version - a.version),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [all, tab, status, q, partners, channels]);
  const create = (t: ListType) => setOpen(blankList(t, activePrincipal.id, currentUser.name));
  const canEdit = !!currentUser.permissions.canEditPricing;

  const table = (
    <div className="g2-table-wrap"><table className="g2-table">
      <thead><tr><th>Name</th><th>Applies to</th><th>Validity</th><th style={{ textAlign: 'right' }}>Products</th><th>Version</th><th>Status</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={6} className="g2-muted">{tab === 'approvals' ? 'Nothing waiting for approval.' : 'No price lists yet.'}</td></tr>}
        {rows.map((l) => {
          const s = listState(l);
          return (
            <tr key={l.id} className="g2-row-click" onClick={() => setOpen(l)} style={{ cursor: 'pointer' }}>
              <td><div className="g2-strong">{l.name}</div><div className="g2-cell-sub">{TYPE_LABEL[l.type]} · <span className="g2-mono">{l.code}</span>{l.contractRef ? ` · ${l.contractRef}` : ''}</div></td>
              <td className="g2-small" style={{ maxWidth: 260 }}>{appliesTo(l)}</td>
              <td className="g2-small">{l.validFrom} → {l.validTo ?? 'until replaced'}{l.type === 'CONTRACT' && l.validTo && l.status === 'Active' && daysTo(l.validTo) <= 90 && daysTo(l.validTo) >= 0 && <> <Badge tone="amber">Ends in {daysTo(l.validTo)}d</Badge></>}</td>
              <td style={{ textAlign: 'right' }}>{l.lines.length}</td>
              <td>v{l.version}</td>
              <td><Badge tone={s.tone} dot>{s.label}</Badge>{l.status === 'Pending' && <div className="g2-cell-sub">by {l.submittedBy}</div>}</td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Price Lists & Rate Contracts" description={<>Selling prices for <strong>{activePrincipal.name}</strong> by channel, partner and hospital contract. Every change is approved, versioned and checked against MRP, the government ceiling and floor prices.</>}
        actions={canEdit && <>
          <Button icon={<FileSignature size={15} />} onClick={() => create('CONTRACT')}>New rate contract</Button>
          <Button icon={<Plus size={15} />} onClick={() => create('PARTNER')}>Partner price list</Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => create('CHANNEL')}>Channel price list</Button>
        </>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Lists in force" value={all.filter((l) => effectiveOn(l, on) && l.type !== 'CONTRACT').length} icon={<Tag size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${all.filter((l) => l.type === 'PARTNER' && effectiveOn(l, on)).length} partner-specific`} />
        <KpiCard label="Rate contracts" value={contracts.filter((l) => effectiveOn(l, on)).length} icon={<FileSignature size={22} />} color="#059669" bg="#ecfdf5" foot={inr(contracts.filter((l) => effectiveOn(l, on)).reduce((a, l) => a + (l.committedValue ?? 0), 0)) + ' committed'} />
        <KpiCard label="Waiting for approval" value={pending.length} icon={<ClipboardCheck size={22} />} color="#d97706" bg="#fffbeb" foot={currentUser.permissions.canApprovePricing ? 'you can approve' : 'pricing approver needed'} />
        <KpiCard label="Contracts ending ≤ 90 days" value={expiring.length} icon={<CalendarClock size={22} />} color="#dc2626" bg="#fef2f2" foot="renew before they lapse" />
      </div>
      {!canEdit && <div style={{ marginBottom: 12 }}><Alert tone="warn">Your role can view prices but not change them.</Alert></div>}
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'lists', label: 'Price lists', count: all.filter((l) => l.type !== 'CONTRACT').length },
            { id: 'contracts', label: 'Rate contracts', count: contracts.length },
            { id: 'approvals', label: 'Approvals', count: pending.length || undefined },
            { id: 'check', label: 'Price check', icon: <BadgeIndianRupee size={14} /> },
            { id: 'schemes', label: 'Schemes' },
          ]} />
          <span className="g2-spacer" />
          {['lists', 'contracts'].includes(tab) && <>
            <SearchInput value={q} onChange={setQ} placeholder="Name, code, partner…" />
            <Select value={status} placeholder="All statuses" options={['Draft', 'Pending', 'Active', 'Superseded', 'Rejected'].map((s) => ({ value: s, label: s }))} onChange={setStatus} />
          </>}
        </div>
        {['lists', 'contracts', 'approvals'].includes(tab) && table}
        {tab === 'check' && <PriceCheckTab />}
        {tab === 'schemes' && <SchemesTab />}
      </Card>
      {open && <PriceListDrawer key={open.id} list={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
};
export default PricingPage;
