/**
 * ERP stock sync (SAP S/4HANA, Tally via on-premise agent).
 *
 * First sync  = full snapshot through the import pipeline (checks, failures, history, undo).
 * Later syncs = delta: VinFlux compares the ERP's current stock for the warehouses this connector feeds with its
 *               own mirror and posts ERP_SYNC movements for the differences (Auto), or parks them for review.
 * The ERP stays the master of company warehouses — VinFlux never edits that stock by hand.
 *
 * DEMO: each connector has an "ERP sandbox" (the ERP's own stock) that changes over time
 * (production receipts, direct sales) and is reduced when the ERP invoices a VinFlux order.
 * INTEGRATION POINT: SAP — API_MATERIAL_STOCK_SRV / batch & serial APIs; Tally — agent reads XML over port 9000.
 */
import { ENTITIES, autoMatch, rowsFromTable } from '../import/entities';
import { importHistory, runImport } from '../import/history';
import type { ImportContext, RowResult } from '../import/types';
import { emit } from '../events';
import { loadJson, newId, saveJson } from '../store';
import { workspaceKey } from '../workspace';
import { CONNECTORS, connectorSettings, sapStockSnapshot, saveRunsList, saveSettings, sourceLabel, syncRuns } from './connectors';
import { erpProfile } from './erpProfiles';
import { callErp, isLive, linesToTable } from './liveClient';
import type { LiveError, LiveStockLine } from './liveClient';
import type { ConnectorSettings, StockChange, SyncFailure, SyncRun } from './connectors';
import { balances, post } from '../../modules/inventory/stockStore';
import type { StockStatus } from '../../modules/inventory/stockStore';
import { notErp, resolveSource, sourceSettings } from '../../modules/inventory/stockSource';
import type { StockSource } from '../../modules/inventory/stockSource';

export interface ErpRow {
  warehouseId: string; productId: string; variantSku: string | null; batch: string; serial: string | null;
  mfgDate: string | null; expiryDate: string | null; qty: number; unitCost: number | null; status: StockStatus;
}
interface Sandbox { rows: ErpRow[]; tick: number }
const SB = (id: string) => workspaceKey(`vinflux.erpSandbox.${id}.v1`);
export const sandbox = (id: string): Sandbox => loadJson<Sandbox>(SB(id), { rows: [], tick: 0 });
const saveSandbox = (id: string, s: Sandbox) => saveJson(SB(id), s);

const SOURCE = new Proxy({} as Record<string, string>, { get: (_t, k: string) => (isLive(k) ? `${erpProfile(k)?.name ?? k} (live)` : sourceLabel(k)) });
const keyOf = (r: Pick<ErpRow, 'warehouseId' | 'productId' | 'variantSku' | 'batch' | 'serial' | 'status'>) => [r.warehouseId, r.productId, r.variantSku ?? '', r.batch, r.serial ?? '', r.status].join('|');

/** Warehouse ids fed by a connector (from its location mapping). */
export const fedWarehouses = (id: string, ctx: Pick<ImportContext, 'warehouses'>) => {
  const s = connectorSettings(id);
  const codes = new Set(Object.values(s.plantMap).filter(Boolean));
  return ctx.warehouses.filter((w) => codes.has(w.code) && !notErp(w.id)).map((w) => w.id);
};
/** Which connector is the master of a warehouse (null = none: stock comes from imports). */
export const masterOf = (warehouseId: string, ctx: Pick<ImportContext, 'warehouses'>) =>
  CONNECTORS.find((c) => c.kind === 'ERP' && c.availability === 'sandbox' && connectorSettings(c.id).enabled && fedWarehouses(c.id, ctx).includes(warehouseId))?.id ?? null;

/** Effective stock source of a company warehouse (ERP / VinFlux / orders only). */
export const sourceOf = (warehouseId: string, ctx: Pick<ImportContext, 'warehouses'>): StockSource => resolveSource(warehouseId, !!masterOf(warehouseId, ctx));
/** ERP figures older than the configured limit (null = fresh or not ERP-fed). */
export const staleSync = (warehouseId: string, ctx: Pick<ImportContext, 'warehouses'>): { connector: string; hours: number } | null => {
  const id = masterOf(warehouseId, ctx);
  if (!id) return null;
  const at = connectorSettings(id).lastSyncAt;
  const hours = at ? Math.floor((Date.now() - Date.parse(at)) / 3600000) : Infinity;
  return hours >= sourceSettings().staleHours ? { connector: CONNECTORS.find((c) => c.id === id)?.name ?? id, hours } : null;
};

/** Tally export translated by the agent into the stock template (godown names instead of plant codes). */
const tallySnapshot = (ctx: ImportContext): string[][] => {
  const head = ['Warehouse code', 'Bin', 'Product code / SKU / GTIN / ERP code', 'Batch / lot', 'Serial no.', 'Mfg date', 'Expiry date', 'Quantity', 'Unit cost (₹)'];
  const godowns = Object.keys(connectorSettings('tally').plantMap);
  const rows: string[][] = [head];
  ctx.products.filter((p) => p.lifecycleStatus === 'Active' && p.trackingMode.includes('Batch') && !p.trackingMode.includes('Serial')).forEach((p, i) => {
    godowns.forEach((g, j) => rows.push([g, 'MAIN', p.externalRef || p.code, `T26${i}${j}`, '', '2026-08-01', new Date(Date.now() + (400 + i * 90) * 86400000).toISOString().slice(0, 10), String(25 + i * 10 + j * 7), String(Math.round((p.pricingReference?.mrp ?? 1000) * 0.5))]));
  });
  return rows;
};

/** Any other ERP: the adapter's answer translated into the stock template (one row per location × item × batch / serial). */
const genericSnapshot = (id: string, ctx: ImportContext): string[][] => {
  const head = ['Warehouse code', 'Bin', 'Product code / SKU / GTIN / ERP code', 'Batch / lot', 'Serial no.', 'Mfg date', 'Expiry date', 'Quantity', 'Unit cost (₹)'];
  const locs = Object.keys(connectorSettings(id).plantMap);
  const seed = id.length;
  const tag = id.replace(/[^a-z]/g, '').slice(0, 2).toUpperCase();
  const rows: string[][] = [head];
  const prods = ctx.products.filter((p) => p.lifecycleStatus === 'Active' && p.trackingMode !== 'None');
  locs.forEach((loc, j) => prods.forEach((p, i) => {
    if ((i + j + seed) % 2) return;
    const code = p.variants?.[0]?.sku ?? p.externalRef ?? p.code;
    const exp = new Date(Date.now() + (420 + i * 60 + j * 30) * 86400000).toISOString().slice(0, 10);
    const cost = String(Math.round((p.pricingReference?.mrp ?? 1000) * 0.52));
    if (p.trackingMode.includes('Serial')) for (let k = 1; k <= 2; k += 1) rows.push([loc, '', code, `${tag}26${i}${j}`, `${tag}-SN${seed}${i}${j}${k}`, '2026-07-01', exp, '1', cost]);
    else rows.push([loc, '', code, `${tag}26${i}${j}L`, '', '2026-07-01', exp, String(20 + ((i * 7 + j * 11 + seed) % 40)), cost]);
  }));
  if (locs[0]) rows.push([locs[0], '', `${tag}-ITEM-UNMAPPED`, `${tag}2699`, '', '2026-07-01', new Date(Date.now() + 500 * 86400000).toISOString().slice(0, 10), '6', '900']);
  return rows;
};

const toFailures = (results: RowResult[]): SyncFailure[] => results.filter((r) => r.errors.length).map((r) => ({ row: r.row, values: r.values, errors: r.errors, resolved: false }));

/** ERP-side activity between syncs (demo): a production receipt and some direct sales. */
const simulateErpActivity = (id: string, ctx: ImportContext) => {
  const sb = sandbox(id);
  if (!sb.rows.length) return;
  const tick = sb.tick + 1;
  const batchRows = sb.rows.filter((r) => !r.serial && r.status === 'Available' && r.qty > 5);
  const rows = [...sb.rows];
  if (batchRows.length) {
    const sale = batchRows[tick % batchRows.length];
    rows[rows.indexOf(sale)] = { ...sale, qty: sale.qty - (3 + (tick % 4)) };
    const src = batchRows[(tick * 3) % batchRows.length];
    const p = ctx.products.find((x) => x.id === src.productId);
    rows.push({ ...src, batch: `${src.batch.slice(0, 3)}${String(tick).padStart(2, '0')}N`, mfgDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + (p?.trackingRules?.expiryDateRequired ? 1000 : 1800) * 86400000).toISOString().slice(0, 10), qty: 20 + (tick % 3) * 10 });
  }
  saveSandbox(id, { rows, tick });
};

/** Differences between the ERP and VinFlux's mirror for the warehouses this connector feeds. */
export const stockDiff = (id: string, ctx: Pick<ImportContext, 'warehouses'>): StockChange[] => {
  const whs = new Set(fedWarehouses(id, ctx));
  const erp = new Map<string, ErpRow>();
  sandbox(id).rows.filter((r) => whs.has(r.warehouseId)).forEach((r) => {
    const k = keyOf(r);
    const prev = erp.get(k);
    erp.set(k, prev ? { ...prev, qty: prev.qty + r.qty } : { ...r });
  });
  const mine = new Map<string, number>();
  const meta = new Map<string, ErpRow>();
  balances().filter((b) => (b.locType ?? 'COMPANY') === 'COMPANY' && whs.has(b.warehouseId)).forEach((b) => {
    const k = keyOf(b);
    mine.set(k, (mine.get(k) ?? 0) + b.qty);
    meta.set(k, { warehouseId: b.warehouseId, productId: b.productId, variantSku: b.variantSku, batch: b.batch, serial: b.serial, mfgDate: b.mfgDate, expiryDate: b.expiryDate, qty: b.qty, unitCost: b.unitCost, status: b.status });
  });
  const out: StockChange[] = [];
  new Set([...erp.keys(), ...mine.keys()]).forEach((k) => {
    const e = erp.get(k)?.qty ?? 0;
    const v = mine.get(k) ?? 0;
    if (e === v) return;
    const m = erp.get(k) ?? meta.get(k)!;
    out.push({ warehouseId: m.warehouseId, productId: m.productId, variantSku: m.variantSku, batch: m.batch, serial: m.serial, status: m.status, mfgDate: m.mfgDate, expiryDate: m.expiryDate, unitCost: m.unitCost, vinflux: v, erp: e });
  });
  return out;
};

/** Post ERP figures for the given changes. */
export const applyChanges = (id: string, changes: StockChange[], by: string, refId: string | null) => {
  // Post each difference against the bins that already hold that stock, so balances net out per bin.
  const all = balances().filter((b) => (b.locType ?? 'COMPANY') === 'COMPANY');
  post(changes.flatMap((c) => {
    const base = { type: 'ERP_SYNC' as const, locType: 'COMPANY' as const, warehouseId: c.warehouseId, productId: c.productId, variantSku: c.variantSku, batch: c.batch, serial: c.serial,
      mfgDate: c.mfgDate, expiryDate: c.expiryDate, unitCost: c.unitCost, status: c.status, importId: null, source: SOURCE[id] ?? id, by, refId };
    const holders = all.filter((b) => keyOf(b) === keyOf(c) && b.qty > 0);
    let delta = c.erp - c.vinflux;
    if (delta > 0) return [{ ...base, bin: holders[0]?.bin ?? '', qty: delta }];
    const out: (typeof base & { bin: string; qty: number })[] = [];
    holders.forEach((b) => { if (delta >= 0) return; const take = Math.min(b.qty, -delta); out.push({ ...base, bin: b.bin, qty: -take }); delta += take; });
    if (delta < 0) out.push({ ...base, bin: '', qty: delta });
    return out;
  }));
};

/** Accept the pending changes of a review-mode run (or the live differences). */
export const acceptChanges = (id: string, ctx: ImportContext, runId?: string) => {
  const changes = stockDiff(id, ctx);
  applyChanges(id, changes, ctx.actor, runId ?? null);
  if (runId) saveRunsList(syncRuns().map((r) => (r.id === runId ? { ...r, applied: true, status: 'Success' as const, message: `${changes.length} change(s) accepted by ${ctx.actor}` } : r)));
  emit('connector.synced', 'Integration Hub', ctx.actor, `${CONNECTORS.find((c) => c.id === id)?.name}: ${changes.length} stock difference(s) accepted`, { connectorId: id });
  return changes.length;
};

/** The ERP invoiced a VinFlux order: its own stock goes down (demo sandbox only). */
export const erpIssue = (warehouseId: string, lines: { productId: string; variantSku: string | null; batch: string; serial: string | null; qty: number }[], ctx: Pick<ImportContext, 'warehouses'>) => {
  const id = masterOf(warehouseId, ctx);
  if (!id) return;
  const sb = sandbox(id);
  const rows = [...sb.rows];
  lines.forEach((l) => {
    let need = l.qty;
    rows.forEach((r, i) => {
      if (need <= 0 || r.warehouseId !== warehouseId || r.productId !== l.productId || (r.variantSku ?? null) !== (l.variantSku ?? null) || r.batch !== l.batch || (r.serial ?? null) !== (l.serial ?? null)) return;
      const take = Math.min(need, r.qty);
      rows[i] = { ...r, qty: r.qty - take };
      need -= take;
    });
  });
  saveSandbox(id, { ...sb, rows: rows.filter((r) => r.qty > 0) });
};

/** Demo ERP (sandbox): mirror a stock change VinFlux recorded in an ERP-mastered warehouse (returns), so the next sync agrees.
 *  Live ERPs record the return themselves (return order / credit memo); the next live sync reconciles. */
export const erpMirror = (warehouseId: string, lines: { productId: string; variantSku: string | null; batch: string; serial: string | null; expiryDate: string | null; unitCost: number | null; qty: number; status: StockStatus }[], ctx: Pick<ImportContext, 'warehouses'>) => {
  const id = masterOf(warehouseId, ctx);
  if (!id || isLive(id)) return;
  const sb = sandbox(id);
  const rows = [...sb.rows];
  lines.forEach((l) => {
    const i = rows.findIndex((r) => r.warehouseId === warehouseId && r.productId === l.productId && (r.variantSku ?? null) === (l.variantSku ?? null) && r.batch === l.batch && (r.serial ?? null) === (l.serial ?? null) && r.status === l.status);
    if (i >= 0) rows[i] = { ...rows[i], qty: rows[i].qty + l.qty };
    else if (l.qty > 0) rows.push({ warehouseId, productId: l.productId, variantSku: l.variantSku, batch: l.batch, serial: l.serial, mfgDate: null, expiryDate: l.expiryDate, qty: l.qty, unitCost: l.unitCost, status: l.status });
  });
  saveSandbox(id, { ...sb, rows: rows.filter((r) => r.qty > 0) });
};

/** Live: the ERP's answer becomes the ERP mirror the delta compares against (same checks as a file import). */
const mirrorFromTable = (id: string, table: string[][], ctx: ImportContext) => {
  const s = connectorSettings(id);
  const entity = ENTITIES.find((e) => e.id === 'opening-stock')!;
  const rows = rowsFromTable(table, autoMatch(table[0], entity), entity).map((r) => ({ ...r, warehouse: s.plantMap[r.warehouse] || r.warehouse }));
  const ok = entity.validate(rows, ctx, { status: 'Available' }).filter((r) => !r.errors.length);
  saveSandbox(id, { tick: sandbox(id).tick + 1, rows: ok.map((r) => ({ ...(r.resolved as ErpRow), status: 'Available' as const })) });
};

/** Live sync: read stock from the real ERP through the integration service, then run the normal pipeline. */
export const runLiveSync = async (id: string, ctx: ImportContext, opts: { scheduled?: boolean } = {}): Promise<SyncRun> => {
  const s = connectorSettings(id);
  const mapped = Object.keys(s.plantMap).filter((k) => s.plantMap[k]);
  try {
    const r = await callErp<{ lines: LiveStockLine[]; at: string; via?: string }>(id, 'stock', { locations: mapped });
    return runStockSync(id, ctx, { ...opts, liveTable: linesToTable(r.lines.filter((l) => !mapped.length || mapped.includes(l.location))), liveAt: r.at });
  } catch (e) {
    const name = CONNECTORS.find((c) => c.id === id)?.name ?? id;
    const run: SyncRun = { id: newId('run'), connectorId: id, entity: 'Stock (live)', at: new Date().toISOString(), by: opts.scheduled ? `${ctx.actor} (scheduled)` : ctx.actor, total: 0, imported: 0, failed: 0, importId: null, failures: [],
      status: 'Failed', message: `${(e as Error).message}${(e as LiveError).detail ? ` — ${(e as LiveError).detail!.slice(0, 160)}` : ''}` };
    saveRunsList([run, ...syncRuns()]);
    emit('connector.failed', 'Integration Hub', run.by, `${name}: ${run.message}`, { runId: run.id });
    return run;
  }
};

/** One sync of a connector: first full load, then delta. */
export const runStockSync = (id: string, ctx: ImportContext, opts: { scheduled?: boolean; liveTable?: string[][]; liveAt?: string } = {}): SyncRun => {
  const s: ConnectorSettings = connectorSettings(id);
  const name = CONNECTORS.find((c) => c.id === id)?.name ?? id;
  const entity = ENTITIES.find((e) => e.id === 'opening-stock')!;
  const now = new Date().toISOString();
  const by = opts.scheduled ? `${ctx.actor} (scheduled)` : ctx.actor;
  const base = { id: newId('run'), connectorId: id, entity: 'Stock', at: now, by, total: 0, imported: 0, failed: 0, importId: null, failures: [] as SyncFailure[] };
  let run: SyncRun;
  const loaded = importHistory().some((b) => b.entityId === 'opening-stock' && b.source.startsWith(SOURCE[id] ?? name) && b.status === 'Imported') || sandbox(id).rows.length > 0;
  if (!s.enabled) run = { ...base, status: 'Failed', message: 'Connector is switched off.' };
  else if (!opts.liveTable && erpProfile(id)?.access === 'agent' && s.agentStatus !== 'Online') run = { ...base, status: 'Failed', message: `The VinFlux agent next to ${name} is not online — check the agent service on the principal’s server.` };
  else if (!loaded) {
    // First sync: full snapshot through the import pipeline.
    const table = opts.liveTable ?? (id === 'tally' ? tallySnapshot(ctx) : id === 'sap' ? sapStockSnapshot(ctx) : genericSnapshot(id, ctx));
    const rows = rowsFromTable(table, autoMatch(table[0], entity), entity).map((r) => ({ ...r, warehouse: s.plantMap[r.warehouse] || r.warehouse }));
    const results = entity.validate(rows, ctx, { status: 'Available' });
    const ok = results.filter((r) => !r.errors.length);
    const batch = ok.length ? runImport(entity, results, ctx, { status: 'Available' }, `${name} stock snapshot ${now.slice(0, 10)}`, SOURCE[id] ?? name) : null;
    // The ERP sandbox starts as exactly what was loaded.
    saveSandbox(id, { tick: 0, rows: ok.map((r) => { const x = r.resolved as ErpRow; return { ...x, status: 'Available' as const }; }) });
    const failures = toFailures(results);
    run = { ...base, entity: 'Stock (first full load)', total: results.length, imported: ok.length, failed: failures.length, importId: batch?.id ?? null,
      status: failures.length ? (ok.length ? 'Partial' : 'Failed') : 'Success', message: batch ? batch.summary : 'Nothing imported.', failures };
  } else {
    // Delta sync.
    if (opts.liveTable) mirrorFromTable(id, opts.liveTable, ctx); else simulateErpActivity(id, ctx);
    const changes = stockDiff(id, ctx);
    const auto = (s.applyMode ?? 'Auto') === 'Auto';
    if (!changes.length) run = { ...base, entity: 'Stock (delta)', status: 'No changes', message: 'ERP and VinFlux match.', changes: [] };
    else {
      if (auto) applyChanges(id, changes, by, base.id);
      const units = changes.reduce((a, c) => a + (c.erp - c.vinflux), 0);
      run = { ...base, entity: 'Stock (delta)', total: changes.length, imported: auto ? changes.length : 0, changes, applied: auto,
        status: auto ? 'Success' : 'Waiting review',
        message: `${changes.length} line(s) changed in the ERP (${units >= 0 ? '+' : ''}${units} units)${auto ? ' — applied' : ' — waiting for review in Inventory → Reconciliation'}` };
    }
  }
  saveRunsList([run, ...syncRuns()]);
  saveSettings(id, { ...s, lastSyncAt: now, agentHeartbeatAt: erpProfile(id)?.access === 'agent' && s.agentStatus === 'Online' ? now : s.agentHeartbeatAt });
  emit(run.status === 'Failed' ? 'connector.failed' : 'connector.synced', 'Integration Hub', by, `${name} · ${run.entity}: ${run.status} — ${run.message}`, { runId: run.id });
  return run;
};

const INTERVAL: Record<ConnectorSettings['schedule'], number> = { Manual: Infinity, 'Every 15 minutes': 15 * 60000, Hourly: 3600000, Nightly: 86400000 };
export const nextRunAt = (id: string): string | null => {
  const s = connectorSettings(id);
  if (!s.enabled || s.schedule === 'Manual') return null;
  return new Date((s.lastSyncAt ? Date.parse(s.lastSyncAt) : Date.now()) + INTERVAL[s.schedule]).toISOString();
};
/** Called every minute by the app shell: runs connectors whose schedule is due. */
const running = new Set<string>();
export const runDueSyncs = (ctx: ImportContext, onLive?: (r: SyncRun) => void): SyncRun[] => CONNECTORS.filter((c) => c.kind === 'ERP' && c.availability === 'sandbox').flatMap((c) => {
  const s = connectorSettings(c.id);
  const next = nextRunAt(c.id);
  if (!next || !s.lastSyncAt || Date.parse(next) > Date.now()) return [];
  if (isLive(c.id)) {
    if (!running.has(c.id)) { running.add(c.id); runLiveSync(c.id, ctx, { scheduled: true }).then((r) => onLive?.(r)).finally(() => running.delete(c.id)); }
    return [];
  }
  return [runStockSync(c.id, ctx, { scheduled: true })];
});
