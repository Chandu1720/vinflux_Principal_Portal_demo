/**
 * Browser side of the live ERP connectors: calls the VinFlux integration service (Vercel function /api/erp or the
 * standalone service). ERP credentials never reach the browser — only the VinFlux access key, kept in this browser.
 */
import { connectorSettings } from './connectors';

const KEY_STORE = 'vinflux.erpAccessKey';
export const accessKey = () => { try { return localStorage.getItem(KEY_STORE) ?? ''; } catch { return ''; } };
export const setAccessKey = (k: string) => { try { localStorage.setItem(KEY_STORE, k.trim()); } catch { /* private mode */ } };
export const isLive = (connectorId: string | null | undefined) => !!connectorId && connectorSettings(connectorId).mode === 'Live';
const serviceUrl = (id: string) => connectorSettings(id).serviceUrl?.trim() || '/api/erp';

export interface LiveStockLine { location: string; itemCode: string; batch: string; serial: string | null; mfgDate: string | null; expiryDate: string | null; qty: number; unitCost: number | null; status: 'Available' | 'Quarantine' | 'Blocked' }
export class LiveError extends Error { detail?: string; constructor(m: string, detail?: string) { super(m); this.detail = detail; } }

export const callErp = async <T,>(connector: string, op: string, payload: Record<string, unknown> = {}): Promise<T> => {
  let r: Response;
  try {
    r = await fetch(serviceUrl(connector), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vinflux-key': accessKey().trim() }, body: JSON.stringify({ connector, op, ...payload }) });
  } catch {
    throw new LiveError(`Can't reach the VinFlux integration service at ${serviceUrl(connector)}.`);
  }
  const text = await r.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { throw new LiveError(r.status === 404 ? 'The integration service is not deployed at this address (no /api/erp).' : `Unexpected answer from the integration service (HTTP ${r.status}).`); }
  if (!r.ok) throw new LiveError(String(data.error ?? `HTTP ${r.status}`), data.erpBody ? String(data.erpBody) : undefined);
  return data as T;
};

/** ERP stock lines → VinFlux stock template (same table the import pipeline reads). */
export const linesToTable = (lines: LiveStockLine[]): string[][] => [
  ['Warehouse code', 'Bin', 'Product code / SKU / GTIN / ERP code', 'Batch / lot', 'Serial no.', 'Mfg date', 'Expiry date', 'Quantity', 'Unit cost (₹)'],
  ...lines.filter((l) => l.qty > 0).map((l) => [l.location, '', l.itemCode, l.batch, l.serial ?? '', l.mfgDate ?? '', l.expiryDate ?? '', String(l.qty), l.unitCost === null ? '' : String(l.unitCost)]),
];
