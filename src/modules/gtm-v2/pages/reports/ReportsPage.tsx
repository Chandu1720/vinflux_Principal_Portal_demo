import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Printer, RotateCcw } from 'lucide-react';
import { useGtmBundle } from '../../hooks/useGtmData';
import { useProductMaster, useWarehouses } from '../../hooks/useProductMaster';
import { useGtmAuth } from '../../hooks/useGtmAuth';
import {
  Badge, Button, Card, DataTable, ErrorState, Field, Input, LoadingState, PageHeader, Select, Tabs,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { TerritoryMultiSelect } from '../../components/domain/TerritoryPicker';
import { exportCsv, exportExcel } from '../../utils/export';
import { getDepth, levelLabelFor } from '../../utils/territory';
import { EMPTY_FILTERS, REPORTS } from './reports';
import type { ReportFilters } from './reports';

const ReportsPage: React.FC = () => {
  const b = useGtmBundle();
  const pm = useProductMaster();
  const warehouses = useWarehouses();
  const { showToast, principal } = useGtmAuth();
  const [reportId, setReportId] = useState(REPORTS[0].id);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const report = REPORTS.find((r) => r.id === reportId) ?? REPORTS[0];
  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => {
    if (!b.config) return null;
    return report.build({
      filters, config: b.config, territories: b.territories, zones: b.zones, channels: b.channels, flows: b.flows,
      partners: b.partners, mappings: b.mappings, terms: b.terms, pm, warehouses, principalName: principal.name, assignments: b.assignments,
    });
  }, [report, filters, b.config, b.territories, b.zones, b.channels, b.flows, b.partners, b.mappings, b.terms, b.assignments, pm, warehouses, principal.name]);

  const maxDepth = useMemo(() => b.territories.reduce((m, t) => Math.max(m, getDepth(t.id, b.territories)), 0), [b.territories]);

  if (b.error) return <ErrorState message={b.error} />;
  if (b.loading || !b.config || !result) return <LoadingState label="Loading report data…" />;
  const config = b.config;

  const columns: Column<unknown>[] = report.columns.map((c) => ({
    key: c.key, header: c.header, align: c.align, sortValue: c.value, render: (r) => c.render ? c.render(r) : c.value(r),
  }));
  const exportRows = () => result.rows.map((r) => report.columns.map((c) => c.value(r)));
  const headers = report.columns.map((c) => c.header);
  const fileBase = `gtm-${report.id}-report-${new Date().toISOString().slice(0, 10)}`;
  const has = (k: string) => (report.filters as string[]).includes(k);
  const activeFilterCount = [filters.territoryIds.length, filters.zoneId, filters.channelId, filters.status, filters.from, filters.to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="GTM Reports"
        description="Operational reports computed live from Go-to-Market masters, partner relationships and the Product Master."
        actions={<>
          <Button icon={<FileDown size={15} />} disabled={!result.rows.length} onClick={() => { exportCsv(fileBase, headers, exportRows()); showToast(`Exported ${result.rows.length} rows to CSV.`, 'success'); }}>CSV</Button>
          <Button icon={<FileSpreadsheet size={15} />} disabled={!result.rows.length} onClick={() => { exportExcel(fileBase, report.label, headers, exportRows()); showToast(`Exported ${result.rows.length} rows to Excel.`, 'success'); }}>Excel</Button>
          <Button icon={<Printer size={15} />} onClick={() => window.print()}>Print</Button>
        </>}
      />
      <Card flush>
        <div style={{ padding: '0 18px' }}>
          <Tabs active={reportId} onChange={setReportId} tabs={REPORTS.map((r) => ({ id: r.id, label: r.label }))} />
        </div>
        <div style={{ padding: '14px 18px 0' }}>
          <h3 className="g2-card-title">{report.label}</h3>
          <div className="g2-card-sub">{report.description}</div>
        </div>
        <div className="g2-filterbar" style={{ alignItems: 'flex-end' }}>
          {has('level') && (
            <Field label="Roll up to level">
              <Select value={String(filters.level)} onChange={(v) => set('level', Number(v))}
                options={Array.from({ length: maxDepth + 1 }, (_, d) => ({ value: String(d), label: levelLabelFor(d, config.territoryRules.levelLabels) }))} />
            </Field>
          )}
          {has('territory') && (
            <Field label="Territory">
              <div style={{ width: 260 }}>
                <TerritoryMultiSelect territories={b.territories} levelLabels={config.territoryRules.levelLabels} values={filters.territoryIds} onChange={(v) => set('territoryIds', v)} includeInactive placeholder="All territories" />
              </div>
            </Field>
          )}
          {has('zone') && (
            <Field label="Zone"><Select value={filters.zoneId} onChange={(v) => set('zoneId', v)} placeholder="All zones" options={b.zones.map((z) => ({ value: z.id, label: z.name }))} /></Field>
          )}
          {has('channel') && (
            <Field label="Channel"><Select value={filters.channelId} onChange={(v) => set('channelId', v)} placeholder="All channels" options={b.channels.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          )}
          {has('status') && (
            <Field label="Partner status"><Select value={filters.status} onChange={(v) => set('status', v)} placeholder="All statuses" options={config.partnerStatuses.map((s) => ({ value: s.key, label: s.label }))} /></Field>
          )}
          {has('date') && (<>
            <Field label="From"><Input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} style={{ width: 150 }} /></Field>
            <Field label="To"><Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to', e.target.value)} style={{ width: 150 }} /></Field>
          </>)}
          {activeFilterCount > 0 && <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setFilters({ ...EMPTY_FILTERS, level: filters.level })}>Clear ({activeFilterCount})</Button>}
        </div>
        <div className="g2-row" style={{ padding: '0 18px 14px', gap: 8 }}>
          {result.summary.map((s) => <Badge key={s.label} tone={s.tone ?? 'slate'}>{s.label}: <strong style={{ marginLeft: 3 }}>{s.value}</strong></Badge>)}
        </div>
        <DataTable key={report.id} columns={columns} rows={result.rows} rowKey={report.rowKey} pageSize={20}
          emptyTitle="No data for this report" emptyDescription="Try widening the filters." />
      </Card>
    </>
  );
};

export default ReportsPage;
