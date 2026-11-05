/**
 * Integration Hub: connector definitions, their settings (value mappings, schedule) and sync runs.
 * Every connector reuses the import pipeline (same checks, history and undo as file imports).
 * Only the SAP connector runs in sandbox mode in the demo; real connectors call the ERP / service API.
 */
import { ENTITIES, rowsFromTable, autoMatch } from '../import/entities';
import { importHistory, runImport } from '../import/history';
import type { ImportContext, RowResult, RowValues } from '../import/types';
import { emit } from '../events';
import { loadJson, newId, saveJson } from '../store';

export type ConnectorKind = 'ERP' | 'Tax / GST' | 'Logistics' | 'Messaging';

export interface ConnectorDef {
  id: string;
  name: string;
  kind: ConnectorKind;
  description: string;
  entities: string[];
  direction: 'Inbound' | 'Outbound' | 'Both';
  /** sandbox = works in the demo with sample data. */
  availability: 'sandbox' | 'built-in' | 'planned';
}

export const CONNECTORS: ConnectorDef[] = [
  { id: 'sap', name: 'SAP S/4HANA', kind: 'ERP', description: 'Material master and stock by plant / storage location / batch / serial (MB52-style snapshot).', entities: ['Opening stock', 'Products'], direction: 'Both', availability: 'sandbox' },
  { id: 'gsp', name: 'GST (GSTN via GSP)', kind: 'Tax / GST', description: 'GSTIN verification in partner onboarding. E-invoice and e-way bill in the Orders phase.', entities: ['GSTIN verification'], direction: 'Outbound', availability: 'built-in' },
  { id: 'tally', name: 'Tally Prime', kind: 'ERP', description: 'Stock items, godown balances and ledgers via Tally XML / ODBC.', entities: ['Products', 'Opening stock'], direction: 'Both', availability: 'planned' },
  { id: 'zoho', name: 'Zoho Books / Inventory', kind: 'ERP', description: 'Items, warehouses and stock adjustments via REST API.', entities: ['Products', 'Opening stock'], direction: 'Both', availability: 'planned' },
  { id: 'netsuite', name: 'Oracle NetSuite', kind: 'ERP', description: 'Items, locations and inventory numbers via SuiteTalk REST.', entities: ['Products', 'Opening stock'], direction: 'Both', availability: 'planned' },
  { id: 'dynamics', name: 'Microsoft Dynamics 365', kind: 'ERP', description: 'Released products and on-hand inventory via OData.', entities: ['Products', 'Opening stock'], direction: 'Both', availability: 'planned' },
  { id: 'shiprocket', name: 'Courier aggregator (Shiprocket / Delhivery)', kind: 'Logistics', description: 'AWB creation, pickup, live tracking and proof of delivery.', entities: ['Shipments'], direction: 'Both', availability: 'planned' },
  { id: 'whatsapp', name: 'WhatsApp / SMS / Email', kind: 'Messaging', description: 'Order, shipment, credit and recall notifications to partners.', entities: ['Notifications'], direction: 'Outbound', availability: 'planned' },
];

export interface ConnectorSettings {
  enabled: boolean;
  schedule: 'Manual' | 'Every 15 minutes' | 'Hourly' | 'Nightly';
  endpoint: string;
  client: string;
  /** SAP plant → VinFlux warehouse code. */
  plantMap: Record<string, string>;
  lastSyncAt: string | null;
}

export interface SyncFailure { row: number; values: RowValues; errors: string[]; resolved: boolean }
export interface SyncRun {
  id: string; connectorId: string; entity: string; at: string; by: string;
  total: number; imported: number; failed: number; importId: string | null;
  status: 'Success' | 'Partial' | 'Failed' | 'No changes'; message: string; failures: SyncFailure[];
}

const SKEY = 'vinflux.connectors.v1';
const RKEY = 'vinflux.syncRuns.v1';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const subscribeConnectors = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const DEFAULT_SAP: ConnectorSettings = {
  enabled: true, schedule: 'Manual', endpoint: 'https://sandbox.s4hana.example/sap/opu/odata', client: '100',
  plantMap: { WH01: 'WH-MEDC-06', WH02: 'WH-BHIW-01', WH03: 'WH-PEEN-04' }, lastSyncAt: null,
};
export const connectorSettings = (id: string): ConnectorSettings => loadJson<Record<string, ConnectorSettings>>(SKEY, {})[id] ?? { ...DEFAULT_SAP, enabled: id === 'sap', plantMap: id === 'sap' ? DEFAULT_SAP.plantMap : {} };
export const saveSettings = (id: string, s: ConnectorSettings) => { const all = loadJson<Record<string, ConnectorSettings>>(SKEY, {}); all[id] = s; saveJson(SKEY, all); notify(); };
export const syncRuns = (): SyncRun[] => loadJson<SyncRun[]>(RKEY, []);
const saveRuns = (r: SyncRun[]) => { saveJson(RKEY, r.slice(0, 50)); notify(); };

/* --------------------- SAP sandbox: stock snapshot --------------------- */

const fmt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const addYears = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };

/** Builds an MB52-style export from the current catalogue, with a few realistic problems. */
export const sapStockSnapshot = (ctx: ImportContext): string[][] => {
  const head = ['Plant', 'Storage Location', 'Material', 'Batch', 'Serial Number', 'Mfg Date', 'SLED', 'Unrestricted', 'Moving Avg Price'];
  const rows: string[][] = [head];
  const plants = ['WH01', 'WH02', 'WH03'];
  ctx.products.filter((p) => p.lifecycleStatus === 'Active' && p.trackingMode !== 'None').forEach((p, i) => {
    const material = p.externalRef || p.code;
    const plant = plants[i % plants.length];
    const cost = Math.round((p.pricingReference?.mrp ?? 1000) * 0.55);
    const mfg = fmt(new Date(Date.now() - (90 + i * 20) * 86400000).toISOString().slice(0, 10));
    const exp = fmt(addYears(p.trackingRules?.expiryDateRequired ? 3 : 5));
    const target = p.variants?.length ? p.variants.slice(0, 2).map((v) => v.sku) : [material];
    target.forEach((code, j) => {
      if (p.trackingMode.includes('Serial')) {
        for (let k = 1; k <= 3; k += 1) rows.push([plant, `0${k}01`, code, `B26${i}${j}`, `SN${(i + 1) * 1000 + j * 10 + k}`, mfg, exp, '1', String(cost)]);
      } else {
        rows.push([plant, '0101', code, `L26${i}${j}A`, '', mfg, exp, String(40 + i * 15 + j * 5), String(cost)]);
      }
    });
  });
  // A short-dated batch (shows near-expiry alerts), then realistic problems: an unmapped plant, an unknown material, an expired batch.
  const soon = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const any = ctx.products.find((p) => p.lifecycleStatus === 'Active' && p.trackingMode === 'Batch / Lot');
  rows.push(['WH01', '0102', any?.code ?? 'X', 'L2512S', '', '01.12.2025', fmt(soon), '18', '500']);
  rows.push(['WH09', '0101', any?.code ?? 'X', 'L2699Z', '', '01.01.2026', fmt(addYears(2)), '30', '500']);
  rows.push(['WH01', '0101', 'MAT-SAP-000000', 'L2600X', '', '01.01.2026', fmt(addYears(2)), '12', '800']);
  rows.push(['WH02', '0101', any?.code ?? 'X', 'L2401E', '', '01.01.2024', '30.06.2025', '8', '500']);
  return rows;
};

/** Apply value mapping (plant → warehouse) to a parsed SAP table. */
const mapValues = (rows: RowValues[], s: ConnectorSettings) => rows.map((r) => ({ ...r, warehouse: s.plantMap[r.warehouse] ?? r.warehouse }));

const toFailures = (results: RowResult[]): SyncFailure[] => results.filter((r) => r.errors.length).map((r) => ({ row: r.row, values: r.values, errors: r.errors, resolved: false }));

export const runSapStockSync = (ctx: ImportContext): SyncRun => {
  const s = connectorSettings('sap');
  const entity = ENTITIES.find((e) => e.id === 'opening-stock')!;
  const now = new Date().toISOString();
  const loaded = importHistory().some((b) => b.entityId === 'opening-stock' && b.source.startsWith('SAP S/4HANA') && b.status === 'Imported');
  let run: SyncRun;
  if (!s.enabled) {
    run = { id: newId('run'), connectorId: 'sap', entity: entity.label, at: now, by: ctx.actor, total: 0, imported: 0, failed: 0, importId: null, status: 'Failed', message: 'Connector is switched off.', failures: [] };
  } else if (loaded) {
    run = { id: newId('run'), connectorId: 'sap', entity: entity.label, at: now, by: ctx.actor, total: 0, imported: 0, failed: 0, importId: null, status: 'No changes', message: 'Opening stock already loaded from SAP. Later syncs bring only stock movements (delta); none in the sandbox.', failures: [] };
  } else {
    const table = sapStockSnapshot(ctx);
    const rows = mapValues(rowsFromTable(table, autoMatch(table[0], entity), entity), s);
    const results = entity.validate(rows, ctx, { status: 'Available' });
    const ok = results.filter((r) => !r.errors.length);
    const batch = ok.length ? runImport(entity, results, ctx, { status: 'Available' }, `SAP stock snapshot ${now.slice(0, 10)}`, 'SAP S/4HANA (sandbox)') : null;
    const failures = toFailures(results);
    run = {
      id: newId('run'), connectorId: 'sap', entity: entity.label, at: now, by: ctx.actor, total: results.length, imported: ok.length, failed: failures.length,
      importId: batch?.id ?? null, status: failures.length ? (ok.length ? 'Partial' : 'Failed') : 'Success',
      message: batch ? batch.summary : 'Nothing imported.', failures,
    };
  }
  saveRuns([run, ...syncRuns()]);
  saveSettings('sap', { ...s, lastSyncAt: now });
  emit(run.status === 'Failed' ? 'connector.failed' : 'connector.synced', 'Integration Hub', ctx.actor, `SAP S/4HANA · ${run.entity}: ${run.status} — ${run.imported} imported, ${run.failed} failed`, { runId: run.id });
  return run;
};

/** Re-check failed records with the current mappings and import the ones that now pass. */
export const retryFailures = (runId: string, ctx: ImportContext): { fixed: number; still: number } => {
  const runs = syncRuns();
  const run = runs.find((r) => r.id === runId);
  if (!run) return { fixed: 0, still: 0 };
  const s = connectorSettings(run.connectorId);
  const entity = ENTITIES.find((e) => e.label === run.entity)!;
  const open = run.failures.filter((f) => !f.resolved);
  const remapped = open.map((f) => ({ ...f.values, warehouse: s.plantMap[f.values.warehouse] ?? f.values.warehouse }));
  const results = entity.validate(remapped, ctx, { status: 'Available' });
  const okIdx = results.map((r, i) => (r.errors.length ? -1 : i)).filter((i) => i >= 0);
  if (okIdx.length) runImport(entity, okIdx.map((i) => results[i]), ctx, { status: 'Available' }, `SAP retry ${new Date().toISOString().slice(0, 10)}`, 'SAP S/4HANA (sandbox) · retry');
  const next = runs.map((r) => (r.id !== runId ? r : {
    ...r,
    imported: r.imported + okIdx.length,
    failures: r.failures.map((f) => {
      const k = open.indexOf(f);
      if (k < 0) return f;
      return results[k].errors.length ? { ...f, errors: results[k].errors } : { ...f, resolved: true };
    }),
  }));
  next.forEach((r) => { if (r.id === runId) { const left = r.failures.filter((f) => !f.resolved).length; r.failed = left; r.status = left ? 'Partial' : 'Success'; } });
  saveRuns(next);
  emit('connector.synced', 'Integration Hub', ctx.actor, `SAP retry: ${okIdx.length} record(s) imported, ${open.length - okIdx.length} still failing`, { runId });
  return { fixed: okIdx.length, still: open.length - okIdx.length };
};
