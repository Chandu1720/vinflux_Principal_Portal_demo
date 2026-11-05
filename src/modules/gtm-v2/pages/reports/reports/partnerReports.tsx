import type { ReportContext, ReportDefinition } from './types';
import { channelName, filterPartners, partnerChannel, partnerTypeName, territoryNames } from './types';
import { formatDate } from '../../../utils/format';
import { StatusBadge } from '../../../components/ui';
import { PartnerStatusBadge } from '../../../components/domain/Badges';
import type { GtmConfiguration, KycDocument } from '../../../types';

interface StatusRow { id: string; code: string; name: string; type: string; channel: string; territories: string; status: string; state: 'Active' | 'Inactive'; submitted: string; activated: string; config: GtmConfiguration }

export const activeInactiveReport: ReportDefinition<StatusRow> = {
  id: 'active-inactive',
  label: 'Active / Inactive Partners',
  description: 'Every partner classified as Active (trading) or Inactive (onboarding, suspended or rejected).',
  filters: ['territory', 'zone', 'channel', 'status', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'code', header: 'Code', value: (r) => r.code, render: (r) => <span className="g2-mono">{r.code}</span> },
    { key: 'name', header: 'Partner', value: (r) => r.name, render: (r) => <span className="g2-cell-main">{r.name}</span> },
    { key: 'type', header: 'Partner Type', value: (r) => r.type },
    { key: 'channel', header: 'Channel', value: (r) => r.channel },
    { key: 'terr', header: 'Territories', value: (r) => r.territories, render: (r) => <span className="g2-small g2-ellipsis" style={{ maxWidth: 220, display: 'inline-block' }} title={r.territories}>{r.territories}</span> },
    { key: 'state', header: 'Active / Inactive', value: (r) => r.state, render: (r) => <StatusBadge status={r.state} /> },
    { key: 'status', header: 'Lifecycle Status', value: (r) => r.status, render: (r) => <PartnerStatusBadge status={r.status} config={r.config} /> },
    { key: 'submitted', header: 'Submitted', value: (r) => r.submitted },
    { key: 'activated', header: 'Activated', value: (r) => r.activated },
  ],
  build: (ctx) => {
    const rows = filterPartners(ctx).map((p) => ({
      id: p.id, code: p.code, name: p.name, type: partnerTypeName(p, ctx), channel: channelName(partnerChannel(p, ctx), ctx),
      territories: territoryNames(p.territoryIds, ctx), status: p.status, state: (p.status === 'Active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
      submitted: formatDate(p.submittedAt), activated: formatDate(p.activatedAt), config: ctx.config,
    }));
    const active = rows.filter((r) => r.state === 'Active').length;
    return {
      rows,
      summary: [
        { label: 'Partners', value: rows.length, tone: 'purple' },
        { label: 'Active', value: active, tone: 'green' },
        { label: 'Inactive', value: rows.length - active, tone: 'slate' },
        { label: 'Suspended', value: rows.filter((r) => r.status === 'Suspended').length, tone: 'red' },
      ],
    };
  },
};

const missingDocs = (ctx: ReportContext, partnerTypeId: string, docs: KycDocument[]) =>
  ctx.config.kycDocuments.filter((k) => k.status === 'Active' && k.mandatoryForPartnerTypeIds.includes(partnerTypeId) && !docs.some((d) => d.docTypeId === k.id && d.status !== 'Rejected'));

interface KycRow { id: string; code: string; name: string; type: string; kyc: string; status: string; uploaded: number; missing: string; missingCount: number; submitted: string; ageing: number; config: GtmConfiguration }

export const kycPendingReport: ReportDefinition<KycRow> = {
  id: 'kyc',
  label: 'KYC Pending',
  description: 'Partners whose KYC is not yet verified, with missing mandatory documents (from KYC Document Requirements) and ageing since submission.',
  filters: ['territory', 'zone', 'channel', 'status', 'date'],
  rowKey: (r) => r.id,
  columns: [
    { key: 'code', header: 'Code', value: (r) => r.code, render: (r) => <span className="g2-mono">{r.code}</span> },
    { key: 'name', header: 'Partner', value: (r) => r.name, render: (r) => <span className="g2-cell-main">{r.name}</span> },
    { key: 'type', header: 'Partner Type', value: (r) => r.type },
    { key: 'kyc', header: 'KYC Status', value: (r) => r.kyc, render: (r) => <StatusBadge status={r.kyc} /> },
    { key: 'status', header: 'Partner Status', value: (r) => r.status, render: (r) => <PartnerStatusBadge status={r.status} config={r.config} /> },
    { key: 'uploaded', header: 'Docs Uploaded', value: (r) => r.uploaded, align: 'right' },
    { key: 'missing', header: 'Missing Mandatory Docs', value: (r) => r.missing, render: (r) => r.missingCount ? <span style={{ color: 'var(--g2-red)' }} className="g2-small">{r.missing}</span> : <span className="g2-muted g2-small">None</span> },
    { key: 'submitted', header: 'Submitted', value: (r) => r.submitted },
    { key: 'ageing', header: 'Ageing (days)', value: (r) => r.ageing, render: (r) => <span style={{ fontWeight: 600, color: r.ageing > 14 ? 'var(--g2-red)' : r.ageing > 7 ? 'var(--g2-amber)' : undefined }}>{r.ageing}</span>, align: 'right' },
  ],
  build: (ctx) => {
    const now = Date.now();
    const rows = filterPartners(ctx).filter((p) => p.kycStatus !== 'Verified').map((p) => {
      const miss = missingDocs(ctx, p.partnerTypeId, p.kycDocuments);
      const since = p.submittedAt ?? p.createdAt;
      return {
        id: p.id, code: p.code, name: p.name, type: partnerTypeName(p, ctx), kyc: p.kycStatus, status: p.status, uploaded: p.kycDocuments.length,
        missing: miss.map((m) => m.name).join(', '), missingCount: miss.length, submitted: formatDate(p.submittedAt),
        ageing: Math.max(0, Math.floor((now - new Date(since).getTime()) / 86400000)), config: ctx.config,
      };
    }).sort((a, b) => b.ageing - a.ageing);
    return {
      rows,
      summary: [
        { label: 'KYC not verified', value: rows.length, tone: 'amber' },
        { label: 'Under review', value: rows.filter((r) => r.kyc === 'Under Review').length, tone: 'blue' },
        { label: 'Rejected', value: rows.filter((r) => r.kyc === 'Rejected').length, tone: 'red' },
        { label: 'Missing documents', value: rows.filter((r) => r.missingCount > 0).length, tone: 'red' },
        { label: 'Older than 14 days', value: rows.filter((r) => r.ageing > 14).length, tone: 'slate' },
      ],
    };
  },
};
