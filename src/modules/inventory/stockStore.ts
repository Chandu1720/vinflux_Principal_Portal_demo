/**
 * Inventory foundation: stock is a LEDGER of movements, never a typed-in number.
 * Balances = sum of movements by location × bin × product × batch × serial × status.
 *
 * Who owns which stock:
 *  - COMPANY warehouses: the principal's ERP is the master. VinFlux only mirrors it (ERP_SYNC) and posts
 *    ISSUE when the ERP confirms an invoice, so the figure is right before the next sync.
 *  - CNF depots, PARTNER godowns, HOSPITAL consignment, TRANSIT: VinFlux is the master (receipts, partner reports).
 * INTEGRATION POINT: GET /stock/balances, POST /stock/movements (or ERP sync).
 */
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';

export type StockStatus = 'Available' | 'Quarantine' | 'Blocked';
export type MovementType = 'OPENING' | 'REVERSAL' | 'ERP_SYNC' | 'ISSUE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'RECEIPT' | 'PARTNER_REPORT' | 'CLAIM' | 'ADJUSTMENT' | 'RETURN' | 'SCRAP' | 'RTM' | 'BLOCK';
/** Kind of place the stock is in. `warehouseId` holds a warehouse id (COMPANY) or a partner id (CNF / PARTNER / HOSPITAL / TRANSIT). */
export type LocType = 'COMPANY' | 'CNF' | 'PARTNER' | 'HOSPITAL' | 'TRANSIT';
export const LOC_LABEL: Record<LocType, string> = { COMPANY: 'Company warehouse (ERP)', CNF: 'C&F depot', PARTNER: 'Partner godown', HOSPITAL: 'Hospital consignment', TRANSIT: 'In transit' };

export interface StockMovement {
  id: string;
  type: MovementType;
  warehouseId: string;
  bin: string;
  productId: string;
  variantSku: string | null;
  batch: string;
  serial: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  qty: number;
  unitCost: number | null;
  status: StockStatus;
  importId: string | null;
  source: string;
  at: string;
  by: string;
  /** Defaults to COMPANY for older entries. */
  locType?: LocType;
  /** Order / shipment / sync run that caused the movement. */
  refId?: string | null;
}

export interface StockBalance extends Omit<StockMovement, 'id' | 'type' | 'qty' | 'importId' | 'source' | 'at' | 'by' | 'refId'> {
  locType: LocType;
  key: string;
  qty: number;
  value: number;
  lastSource: string;
}

const KEY = () => workspaceKey('vinflux.stock.v1');
const listeners = new Set<() => void>();
let cache: StockMovement[] | null = null;

export const movements = (): StockMovement[] => (cache ??= loadJson<StockMovement[]>(KEY(), []));
const commit = (list: StockMovement[]) => { cache = list; saveJson(KEY(), list); listeners.forEach((l) => l()); };
export const subscribeStock = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const addOpening = (rows: Omit<StockMovement, 'id' | 'type' | 'at'>[], by: string, source: string) => {
  const at = new Date().toISOString();
  const created = rows.map((r) => ({ ...r, id: newId('mv'), type: 'OPENING' as const, at }));
  commit([...movements(), ...created]);
  const units = created.reduce((a, m) => a + m.qty, 0);
  emit('stock.received', 'Inventory', by, `Opening stock: ${created.length} line(s), ${units} unit(s) from ${source}`, { lines: created.length, units });
  return created;
};

/** Post any movements (one transaction). */
export const post = (rows: Omit<StockMovement, 'id' | 'at'>[]) => {
  if (!rows.length) return [];
  const at = new Date().toISOString();
  const created = rows.map((r) => ({ ...r, id: newId('mv'), at }));
  commit([...movements(), ...created]);
  return created;
};

/** Undo = reversing entries (the ledger is never edited or deleted). */
export const reverseImport = (importId: string, by: string) => {
  const list = movements();
  const open = list.filter((m) => m.importId === importId && m.type !== 'REVERSAL');
  const already = list.some((m) => m.importId === importId && m.type === 'REVERSAL');
  if (already || !open.length) return 0;
  const at = new Date().toISOString();
  commit([...list, ...open.map((m) => ({ ...m, id: newId('mv'), type: 'REVERSAL' as const, qty: -m.qty, at, by, source: 'Import undo' }))]);
  emit('stock.reversed', 'Inventory', by, `Reversed ${open.length} line(s) of import ${importId}`, { importId });
  return open.length;
};

export const balanceKey = (m: Pick<StockMovement, 'warehouseId' | 'bin' | 'productId' | 'variantSku' | 'batch' | 'serial' | 'status'>) =>
  [m.warehouseId, m.bin, m.productId, m.variantSku ?? '', m.batch, m.serial ?? '', m.status].join('|');

export const balances = (): StockBalance[] => {
  const map = new Map<string, StockBalance>();
  movements().forEach((m) => {
    const k = balanceKey(m);
    const b = map.get(k) ?? { key: k, locType: m.locType ?? 'COMPANY', warehouseId: m.warehouseId, bin: m.bin, productId: m.productId, variantSku: m.variantSku, batch: m.batch, serial: m.serial, mfgDate: m.mfgDate, expiryDate: m.expiryDate, unitCost: m.unitCost, status: m.status, qty: 0, value: 0, lastSource: m.source };
    b.qty += m.qty;
    b.value += m.qty * (m.unitCost ?? 0);
    b.lastSource = m.source;
    if (m.expiryDate) b.expiryDate = m.expiryDate;
    map.set(k, b);
  });
  return [...map.values()].filter((b) => b.qty !== 0);
};

/** Serials currently in stock (for duplicate checks). */
export const serialsInStock = () => new Set(balances().filter((b) => b.serial && b.qty > 0).map((b) => `${b.productId}|${b.serial}`));
