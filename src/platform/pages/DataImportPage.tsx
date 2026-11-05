import React, { useMemo, useRef, useState } from 'react';
import readXlsxFile from 'read-excel-file';
import { CheckCircle2, Download, FileSpreadsheet, History, RotateCcw, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, ConfirmDialog, PageHeader, Select, Stepper, Tabs } from '../ui';
import { ENTITIES, autoMatch, rowsFromTable } from '../import/entities';
import { importHistory, runImport, saveMapping, savedMapping, subscribeImports, undoImport } from '../import/history';
import type { ImportBatch, ImportEntity, RowResult } from '../import/types';
import { cellToString } from '../import/values';
import { downloadText, parseCsv, toCsv } from '../import/csv';
import { useImportContext } from '../import/useImportContext';
import { usePlatform } from '../PlatformContext';
import { useSubscribe } from '../useStore';
import { sapStockSnapshot } from '../integrations/connectors';
import { useApp } from '../../context/AppContext.tsx';

const STEPS = ['Choose data', 'Upload file', 'Match columns', 'Check rows', 'Done'];

/** Demo files: a realistic ERP export with a few rows that fail the checks. */
const sampleTable = (e: ImportEntity, ctx: ReturnType<typeof useImportContext>): string[][] => {
  if (e.id === 'opening-stock') {
    // Same shape as an SAP MB52 export, but with plant codes replaced by VinFlux warehouse codes.
    const t = sapStockSnapshot(ctx);
    const map: Record<string, string> = { WH01: 'WH-MEDC-06', WH02: 'WH-BHIW-01', WH03: 'WH-PEEN-04' };
    return [t[0], ...t.slice(1).map((r) => [map[r[0]] ?? r[0], ...r.slice(1)])];
  }
  if (e.id === 'price-lines') {
    // Shape of an SAP condition-record export (KONP): material, amount, scale quantity / scale amount.
    return [
      ['Material', 'Description', 'Amount', 'Scale Qty', 'Scale Amount', 'Scale Qty 2', 'Scale Amount 2'],
      ['MAT-SAP-994820', 'Tibial tray augment Sz3', '37200', '5', '36800', '', ''],
      ['8906001248095', 'Hemostatic gauze 10x10', '3050', '50', '2950', '100', '2900'],
      ['8903209045587', 'Femoral stem extension', '25000', '', '', '', ''],
      ['8903209041121', 'Revision instrument set', '548000', '', '', '', ''],
      ['MAT-UNKNOWN-9', 'Old discontinued item', '1200', '', '', '', ''],
    ];
  }
  const existing = ctx.products[0];
  return [
    ['Item Code', 'Item Name', 'Item Group', 'Division', 'Brand', 'HSN', 'GST', 'UOM', 'MRP', 'EAN', 'SAP Code'],
    ['TIB-INS-PE-03', 'Tibial Insert Polyethylene Size 3', 'Implantable Medical Device', 'Arthroplasty — Joint Replacement', 'Genius', '90213100', '5', 'Each', '24500', '', 'MAT-SAP-100231'],
    ['VBP-HY-3302', 'Velocity Ceramic Rear Brake Pad Set — Creta', 'Automotive Spare Part', 'Automotive Aftermarket', 'Velocity', '87083000', '18', 'Set', '1650', '', 'MAT-SAP-100232'],
    ['SCR-CORT-35-20', 'Cortical Screw 3.5 x 20 mm', 'Implantable Medical Device', 'Trauma & Extremities', 'Genius', '90211000', '5', 'Each', '1850', '8901234999990', 'MAT-SAP-100233'],
    [existing?.code ?? 'X', existing?.name ?? 'X', '', '', '', '', '', '', String((existing?.pricingReference?.mrp ?? 1000) + 500), '', ''],
    ['DRP-SURG-01', 'Surgical Drape Large', 'Disposable Drape', 'Hospital Consumables & Bio-Materials', 'Biorad', '6307', '12', 'Each', '420', '', ''],
  ];
};

const DataImportPage: React.FC = () => {
  const ctx = useImportContext();
  const { showToast, currentUser } = useApp();
  const canImport = currentUser.permissions.canImport !== false;
  const { enabled } = usePlatform();
  useSubscribe(subscribeImports);
  const [tab, setTab] = useState('new');
  const [step, setStep] = useState(0);
  const [entity, setEntity] = useState<ImportEntity | null>(null);
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [usedSaved, setUsedSaved] = useState(false);
  const [opts, setOpts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings'>('all');
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const entities = ENTITIES.filter((e) => enabled(e.module));
  const history = importHistory();

  const reset = () => { setStep(0); setEntity(null); setTable(null); setResults(null); setBatch(null); setFileName(''); setMapping({}); };
  const pick = (e: ImportEntity) => { setEntity(e); setOpts(Object.fromEntries((e.options ?? []).map((o) => [o.key, o.default]))); setStep(1); };
  const template = (e: ImportEntity) => downloadText(`vinflux-${e.id}-template.csv`, toCsv([e.columns.map((c) => c.label), e.columns.map((c) => c.example)]));

  const loadTable = (t: string[][], name: string) => {
    if (!entity) return;
    if (t.length < 2) { showToast('The file has no data rows.', 'warning'); return; }
    const head = t[0].map((h) => h.trim());
    const saved = savedMapping(entity.id, 'default');
    const m = autoMatch(head, entity, saved);
    setTable([head, ...t.slice(1)]); setFileName(name); setMapping(m); setUsedSaved(!!saved && Object.keys(saved).some((k) => m[k] === saved[k]));
    setStep(2);
  };
  const onFile = async (f: File) => {
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const rows = await readXlsxFile(f);
        loadTable(rows.map((r) => r.map(cellToString)), f.name);
      } else if (/\.csv$/i.test(f.name)) loadTable(parseCsv(await f.text()), f.name);
      else showToast('Upload an .xlsx or .csv file.', 'warning');
    } catch { showToast(`Could not read ${f.name}.`, 'danger'); }
  };

  const missingRequired = entity ? entity.columns.filter((c) => c.required && !mapping[c.key]) : [];
  const check = () => {
    if (!entity || !table) return;
    saveMapping(entity.id, 'default', mapping);
    setResults(entity.validate(rowsFromTable(table, mapping, entity), ctx, opts));
    setFilter('all'); setStep(3);
  };
  const counts = useMemo(() => {
    const r = results ?? [];
    const skip = (x: RowResult) => x.action === 'update' && x.warnings.some((w) => w.startsWith('No changes'));
    return {
      create: r.filter((x) => !x.errors.length && x.action === 'create').length,
      update: r.filter((x) => !x.errors.length && x.action === 'update' && !skip(x)).length,
      errors: r.filter((x) => x.errors.length).length,
      warnings: r.filter((x) => !x.errors.length && x.warnings.length).length,
    };
  }, [results]);
  const doImport = () => {
    if (!entity || !results) return;
    try {
      const b = runImport(entity, results, ctx, opts, fileName, 'File upload');
      setBatch(b); setStep(4); showToast(`Imported: ${b.summary}.`, 'success');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Import failed.', 'danger'); }
  };
  const errorReport = () => {
    if (!entity || !results) return;
    downloadText(`${entity.id}-errors.csv`, toCsv([['Row', ...entity.columns.map((c) => c.label), 'Errors', 'Warnings'],
      ...results.filter((r) => r.errors.length || r.warnings.length).map((r) => [r.row, ...entity.columns.map((c) => r.values[c.key]), r.errors.join(' | '), r.warnings.join(' | ')])]));
  };
  const confirmUndo = () => {
    if (!undoId) return;
    try { showToast(`Undone: ${undoImport(undoId, ctx)}.`, 'success'); if (batch?.id === undoId) setBatch({ ...batch, status: 'Undone' }); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Undo failed.', 'danger'); }
    setUndoId(null);
  };

  const keyCols = entity ? entity.columns.filter((c) => c.required).slice(0, 4) : [];
  const shown = (results ?? []).filter((r) => filter === 'all' || (filter === 'errors' ? r.errors.length : !r.errors.length && r.warnings.length));

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Data Import" description="Bring data in from an existing ERP or spreadsheet: template → upload → match columns → check every row → import. Every import can be undone." />
      {!canImport && <div style={{ marginBottom: 12 }}><Alert tone="warn">Your role can view import history but can’t run or undo imports.</Alert></div>}
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'new', label: 'New import' }, { id: 'history', label: 'Import history', count: history.length }]} /></div>
        {tab === 'new' && (
          <div style={{ padding: 18 }} className="g2-stack">
            <Stepper steps={STEPS} current={step} maxReached={step} onSelect={(i) => { if (i < step && step < 4) setStep(i); }} />

            {step === 0 && (
              <div className="g2-grid g2-grid-2">
                {entities.map((e) => (
                  <div key={e.id} className="g2-card" style={{ padding: 16 }}>
                    <div className="g2-row"><FileSpreadsheet size={18} /><strong>{e.label}</strong></div>
                    <div className="g2-small" style={{ margin: '6px 0 10px', color: 'var(--g2-text-2)' }}>{e.description}</div>
                    <div className="g2-small g2-muted" style={{ marginBottom: 10 }}>Columns: {e.columns.map((c) => `${c.label}${c.required ? '*' : ''}`).join(', ')}</div>
                    <div className="g2-row">
                      <Button size="sm" icon={<Download size={13} />} onClick={() => template(e)}>Template</Button>
                      <Button size="sm" variant="primary" disabled={!canImport} title={canImport ? undefined : 'Your role can’t run imports'} onClick={() => pick(e)}>Import {e.label.toLowerCase()}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 1 && entity && (
              <div className="g2-stack">
                <input ref={fileRef} type="file" hidden accept=".xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
                <div className="g2-dropzone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
                  <Upload size={22} />
                  <div style={{ marginTop: 6 }}><strong>Drop an Excel (.xlsx) or CSV file here, or click to browse</strong></div>
                  <div className="g2-small g2-muted" style={{ marginTop: 4 }}>First row = column headers. ERP column names are recognised automatically.</div>
                </div>
                <div className="g2-row">
                  <Button onClick={() => setStep(0)}>Back</Button>
                  <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={() => template(entity)}>Download template</Button>
                  <span className="g2-spacer" />
                  <Button variant="soft" onClick={() => loadTable(sampleTable(entity, ctx), entity.id === 'opening-stock' ? 'sap-mb52-stock-export.xlsx (sample)' : entity.id === 'price-lines' ? 'sap-konp-prices.xlsx (sample)' : 'erp-item-master.xlsx (sample)')}>Use a sample ERP export</Button>
                </div>
              </div>
            )}

            {step === 2 && entity && table && (
              <div className="g2-stack">
                <div className="g2-small"><strong>{fileName}</strong> · {table.length - 1} data rows · {table[0].length} columns {usedSaved && <Badge tone="blue">Saved mapping reused</Badge>}</div>
                <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}>
                  <table className="g2-table">
                    <thead><tr><th>VinFlux field</th><th style={{ width: 280 }}>Column in your file</th><th>First value</th></tr></thead>
                    <tbody>{entity.columns.map((c) => {
                      const idx = mapping[c.key] ? table[0].indexOf(mapping[c.key]) : -1;
                      return (
                        <tr key={c.key}>
                          <td><span className="g2-strong">{c.label}</span>{c.required && <span style={{ color: 'var(--g2-red)' }}> *</span>}{c.hint && <div className="g2-cell-sub">{c.hint}</div>}</td>
                          <td><Select value={mapping[c.key] ?? ''} invalid={c.required && !mapping[c.key]} placeholder="— not in file —" options={table[0].map((h) => ({ value: h, label: h }))} onChange={(v) => setMapping({ ...mapping, [c.key]: v })} /></td>
                          <td className="g2-mono g2-small">{idx >= 0 ? table[1]?.[idx] : <span className="g2-muted">—</span>}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                {(entity.options ?? []).map((o) => (
                  <div key={o.key} className="g2-row"><span className="g2-strong g2-small">{o.label}:</span><div style={{ width: 380 }}><Select value={opts[o.key]} options={o.choices} onChange={(v) => setOpts({ ...opts, [o.key]: v })} /></div></div>
                ))}
                {missingRequired.length > 0 && <Alert tone="warn">Match the required fields: {missingRequired.map((c) => c.label).join(', ')}.</Alert>}
                <div className="g2-row"><Button onClick={() => setStep(1)}>Back</Button><span className="g2-spacer" /><Button variant="primary" disabled={missingRequired.length > 0} onClick={check}>Check rows</Button></div>
              </div>
            )}

            {step === 3 && entity && results && (
              <div className="g2-stack">
                <div className="g2-row" style={{ gap: 8 }}>
                  <Badge tone="green">{counts.create} new</Badge>
                  {counts.update > 0 && <Badge tone="blue">{counts.update} update{counts.update === 1 ? '' : 's'}</Badge>}
                  <Badge tone="amber">{counts.warnings} with warnings</Badge>
                  <Badge tone="red">{counts.errors} with errors (skipped)</Badge>
                  <span className="g2-spacer" />
                  <Tabs active={filter} onChange={(v) => setFilter(v as typeof filter)} tabs={[{ id: 'all', label: 'All', count: results.length }, { id: 'errors', label: 'Errors', count: counts.errors }, { id: 'warnings', label: 'Warnings', count: counts.warnings }]} />
                </div>
                <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10, maxHeight: 420, overflow: 'auto' }}>
                  <table className="g2-table">
                    <thead><tr><th>Row</th>{keyCols.map((c) => <th key={c.key}>{c.label}</th>)}<th>Result</th><th>Details</th></tr></thead>
                    <tbody>{shown.map((r) => (
                      <tr key={r.row}>
                        <td className="g2-muted">{r.row}</td>
                        {keyCols.map((c) => <td key={c.key} className="g2-small">{r.values[c.key] || <span className="g2-muted">—</span>}</td>)}
                        <td>{r.errors.length ? <Badge tone="red" dot>Error</Badge> : r.action === 'update' ? <Badge tone="blue" dot>Update</Badge> : <Badge tone="green" dot>New</Badge>}</td>
                        <td className="g2-small">{r.errors.map((e) => <div key={e} style={{ color: 'var(--g2-red)' }}>{e}</div>)}{r.warnings.map((w) => <div key={w} style={{ color: 'var(--g2-amber)' }}>{w}</div>)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {counts.errors > 0 && <Alert tone="info">Rows with errors are skipped. Download the error report, fix the rows in your file and import them later — or fix the mapping and check again.</Alert>}
                <div className="g2-row">
                  <Button onClick={() => setStep(2)}>Back to mapping</Button>
                  {(counts.errors > 0 || counts.warnings > 0) && <Button icon={<Download size={13} />} onClick={errorReport}>Error report</Button>}
                  <span className="g2-spacer" />
                  <Button variant="primary" disabled={!(counts.create + counts.update)} onClick={doImport}>Import {counts.create + counts.update} row(s)</Button>
                </div>
              </div>
            )}

            {step === 4 && batch && (
              <div className="g2-stack">
                <Alert tone={batch.status === 'Undone' ? 'warn' : 'success'} icon={<CheckCircle2 size={16} />}>
                  {batch.status === 'Undone' ? 'This import was undone.' : <>Imported <strong>{batch.summary}</strong> from {batch.fileName}. Import ID <span className="g2-mono">{batch.id}</span>.</>}
                </Alert>
                <div className="g2-row">
                  <Button variant="primary" onClick={reset}>New import</Button>
                  <Button icon={<History size={14} />} onClick={() => setTab('history')}>Import history</Button>
                  {batch.status === 'Imported' && <Button variant="danger" icon={<RotateCcw size={14} />} onClick={() => setUndoId(batch.id)}>Undo this import</Button>}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>When</th><th>Data</th><th>File / source</th><th>By</th><th>Rows</th><th>Result</th><th>Status</th><th /></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={8} className="g2-muted">No imports yet.</td></tr>}
                {history.map((b) => (
                  <tr key={b.id}>
                    <td className="g2-small">{new Date(b.at).toLocaleString('en-IN')}</td>
                    <td className="g2-strong">{b.entityLabel}</td>
                    <td className="g2-small">{b.fileName}<div className="g2-cell-sub">{b.source}</div></td>
                    <td className="g2-small">{b.by}</td>
                    <td className="g2-small">{b.counts.total} · <span style={{ color: 'var(--g2-red)' }}>{b.counts.errors} skipped</span></td>
                    <td className="g2-small">{b.summary}</td>
                    <td><Badge tone={b.status === 'Imported' ? 'green' : 'slate'} dot>{b.status}</Badge>{b.undoneBy && <div className="g2-cell-sub">by {b.undoneBy}</div>}</td>
                    <td>{b.status === 'Imported' && canImport && <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => setUndoId(b.id)}>Undo</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog open={!!undoId} title="Undo this import?" tone="danger" confirmLabel="Undo import"
        message="Stock is reversed with balancing entries (the ledger keeps both). Created products are removed and updated fields restored."
        onCancel={() => setUndoId(null)} onConfirm={confirmUndo} />
    </div>
  );
};
export default DataImportPage;
