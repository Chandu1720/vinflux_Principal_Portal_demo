/**
 * Integration Hub: connector definitions, their settings (value mappings, schedule) and sync runs.
 * Every connector reuses the import pipeline (same checks, history and undo as file imports).
 * Only the SAP connector runs in sandbox mode in the demo; real connectors call the ERP / service API.
 */
import { ENTITIES } from '../import/entities';
import { runImport } from '../import/history';
import type { ImportContext, RowValues } from '../import/types';
import { emit } from '../events';
import { loadJson, saveJson } from '../store';
import { workspaceKey } from '../workspace';
import { ERP_PROFILES, erpProfile } from './erpProfiles';

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

/** Priority order: SAP, Oracle, Odoo, Zoho, Microsoft, then the rest. */
const ERP_ORDER = ['sap', 'sap-b1', 'oracle-fusion', 'netsuite', 'odoo', 'zoho', 'd365-bc', 'd365-fo', 'tally', 'erpnext', 'marg', 'busy'];
export const CONNECTORS: ConnectorDef[] = [
  ...[...ERP_PROFILES].sort((x, y) => ERP_ORDER.indexOf(x.id) - ERP_ORDER.indexOf(y.id)).map((p): ConnectorDef => ({
    id: p.id, name: p.name, kind: 'ERP', description: `${p.fit}. ${p.api}; ${p.access === 'agent' ? 'on-premise agent' : 'cloud / network API'}. Stock, products, partners, sales orders and invoices.`,
    entities: p.objects.map((o) => o.vinflux), direction: 'Both', availability: p.status,
  })),
  { id: 'sftp', name: 'File drop (SFTP / shared folder)', kind: 'ERP', description: 'Any other ERP that can export a stock report: VinFlux picks up the CSV / Excel from a folder on a schedule.', entities: ['Stock'], direction: 'Inbound', availability: 'planned' },
  { id: 'gsp', name: 'GST (GSTN via GSP)', kind: 'Tax / GST', description: 'GSTIN verification in partner onboarding. E-invoice and e-way bill in the Orders phase.', entities: ['GSTIN verification'], direction: 'Outbound', availability: 'built-in' },
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
  /** Auto = apply ERP changes at once; Review = changes wait in Inventory → Reconciliation. */
  applyMode?: 'Auto' | 'Review';
  /** On-premise agent (Tally). */
  agentKey?: string;
  agentStatus?: 'Not installed' | 'Online' | 'Offline';
  agentHeartbeatAt?: string | null;
  sourceCompany?: string;
  /** Sandbox = demo data; Live = the real ERP through the VinFlux integration service. */
  mode?: 'Sandbox' | 'Live';
  /** '/api/erp' (Vercel function) or the integration service URL (…/api/erp). */
  serviceUrl?: string;
  /** VinFlux partner id → customer code / id in this ERP (for sales orders). */
  customerMap?: Record<string, string>;
  lastTest?: { at: string; ok: boolean; message: string; locations?: string[] } | null;
}

export interface SyncFailure { row: number; values: RowValues; errors: string[]; resolved: boolean }
export interface StockChange {
  warehouseId: string; productId: string; variantSku: string | null; batch: string; serial: string | null; status: 'Available' | 'Quarantine' | 'Blocked';
  mfgDate: string | null; expiryDate: string | null; unitCost: number | null; vinflux: number; erp: number;
}
export interface SyncRun {
  id: string; connectorId: string; entity: string; at: string; by: string;
  total: number; imported: number; failed: number; importId: string | null;
  status: 'Success' | 'Partial' | 'Failed' | 'No changes' | 'Waiting review'; message: string; failures: SyncFailure[];
  /** Delta syncs: what changed in the ERP since the last sync. */
  changes?: StockChange[];
  applied?: boolean;
}

const SKEY = () => workspaceKey('vinflux.connectors.v1');
const RKEY = () => workspaceKey('vinflux.syncRuns.v1');
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const subscribeConnectors = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const DEFAULT_SAP: ConnectorSettings = {
  enabled: true, schedule: 'Manual', endpoint: 'https://sandbox.s4hana.example/sap/opu/odata', client: '100',
  plantMap: { WH01: 'WH-MEDC-06', WH02: 'WH-BHIW-01', WH03: 'WH-PEEN-04' }, lastSyncAt: null,
};
const DEFAULT_TALLY: ConnectorSettings = {
  enabled: false, schedule: 'Hourly', endpoint: 'http://localhost:9000 (Tally on the principal’s server)', client: 'Agent', applyMode: 'Auto',
  plantMap: { 'Bommasandra Godown': 'WH-BOMM-05', 'Andheri Godown': 'WH-ANDH-02' }, lastSyncAt: null,
  agentKey: 'VFX-AGT-7Q4M-2K9D', agentStatus: 'Not installed', agentHeartbeatAt: null, sourceCompany: 'Biorad Medisys Pvt Ltd (FY 2026-27)',
};
export const connectorSettings = (id: string): ConnectorSettings => {
  const saved = loadJson<Record<string, ConnectorSettings>>(SKEY(), {})[id];
  const prof = erpProfile(id);
  const base: ConnectorSettings = id === 'tally' ? DEFAULT_TALLY : id === 'sap' ? DEFAULT_SAP
    : { enabled: false, schedule: 'Hourly', endpoint: prof?.endpointHint ?? '', client: '', lastSyncAt: null, applyMode: 'Auto',
      plantMap: Object.fromEntries((prof?.sampleLocations ?? []).map((l) => [l, ''])),
      ...(prof?.access === 'agent' ? { agentKey: `VFX-AGT-${id.toUpperCase().slice(0, 4)}-${id.length * 1371}`, agentStatus: 'Not installed' as const, agentHeartbeatAt: null, sourceCompany: '' } : {}) };
  return { ...base, applyMode: 'Auto', ...saved };
};
/** A warehouse can be mastered by one ERP connector only — otherwise two systems would fight over its stock. */
export const mappingConflicts = (id: string, s: ConnectorSettings): string[] => {
  const mine = new Set(Object.values(s.plantMap).filter(Boolean));
  return CONNECTORS.filter((c) => c.id !== id && c.kind === 'ERP' && c.availability === 'sandbox').flatMap((c) => {
    const o = connectorSettings(c.id);
    if (!o.enabled) return [];
    return Object.values(o.plantMap).filter((w) => mine.has(w)).map((w) => `${w} is already fed by ${c.name}.`);
  });
};
export const saveSettings = (id: string, s: ConnectorSettings) => { const all = loadJson<Record<string, ConnectorSettings>>(SKEY(), {}); all[id] = s; saveJson(SKEY(), all); notify(); };
export const saveRunsList = (r: SyncRun[]) => saveRuns(r);
export const syncRuns = (): SyncRun[] => loadJson<SyncRun[]>(RKEY(), []);
const saveRuns = (r: SyncRun[]) => { saveJson(RKEY(), r.slice(0, 50)); notify(); };

/** How stock rows from a connector are labelled in the ledger and import history. */
export const sourceLabel = (id: string) => { const p = erpProfile(id); return p ? `${p.name} (${p.access === 'agent' ? 'agent' : 'sandbox'})` : id; };

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

/** Re-check failed records with the current mappings and import the ones that now pass. */
export const retryFailures = (runId: string, ctx: ImportContext): { fixed: number; still: number } => {
  const runs = syncRuns();
  const run = runs.find((r) => r.id === runId);
  if (!run) return { fixed: 0, still: 0 };
  const s = connectorSettings(run.connectorId);
  const entity = ENTITIES.find((e) => e.label === run.entity) ?? ENTITIES.find((e) => e.id === 'opening-stock')!;
  const open = run.failures.filter((f) => !f.resolved);
  const remapped = open.map((f) => ({ ...f.values, warehouse: s.plantMap[f.values.warehouse] || f.values.warehouse }));
  const results = entity.validate(remapped, ctx, { status: 'Available' });
  const okIdx = results.map((r, i) => (r.errors.length ? -1 : i)).filter((i) => i >= 0);
  if (okIdx.length) runImport(entity, okIdx.map((i) => results[i]), ctx, { status: 'Available' }, `${erpProfile(run.connectorId)?.name ?? run.connectorId} retry ${new Date().toISOString().slice(0, 10)}`, `${sourceLabel(run.connectorId)} · retry`);
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
  emit('connector.synced', 'Integration Hub', ctx.actor, `${erpProfile(run.connectorId)?.name ?? run.connectorId} retry: ${okIdx.length} record(s) imported, ${open.length - okIdx.length} still failing`, { runId });
  return { fixed: okIdx.length, still: open.length - okIdx.length };
};
