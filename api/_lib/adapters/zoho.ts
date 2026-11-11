/**
 * Zoho Inventory — REST API v1 with OAuth 2.0 (self-client or server-based app, refresh token).
 * Config: DC (in | com | eu | com.au), CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, ORG_ID.
 *   stock      items → per-warehouse stock on hand (batch detail where the item tracks batches)
 *   order      salesorders (+ mark confirmed)
 *   invoices   invoices linked to the sales order
 * VERIFY against a live org: the batch endpoint name (marked below) — the warehouse quantities are standard.
 */
import { cacheToken, cachedToken, json, num, isoDate } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine } from '../types.js';

const dc = (cfg: Cfg) => cfg.DC || 'in';
const api = (cfg: Cfg) => process.env.VFX_ZOHO_API_BASE ?? `https://www.zohoapis.${dc(cfg)}/inventory/v1`;
const token = async (cfg: Cfg) => {
  const k = `zoho|${cfg.CLIENT_ID}|${cfg.ORG_ID}`;
  const hit = cachedToken(k);
  if (hit) return hit;
  const accounts = process.env.VFX_ZOHO_ACCOUNTS_BASE ?? `https://accounts.zoho.${dc(cfg)}`;
  const q = new URLSearchParams({ refresh_token: cfg.REFRESH_TOKEN, client_id: cfg.CLIENT_ID, client_secret: cfg.CLIENT_SECRET, grant_type: 'refresh_token' });
  const r = await json<{ access_token?: string; expires_in?: number; error?: string }>(`${accounts}/oauth/v2/token?${q}`, { method: 'POST' });
  if (!r.access_token) throw new ErpError(`Zoho refused the refresh token${r.error ? ` (${r.error})` : ''} — re-authorise VinFlux in the Zoho API console.`, 401);
  cacheToken(k, r.access_token, r.expires_in ?? 3600);
  return r.access_token;
};
const z = async <T = any>(cfg: Cfg, path: string, init: RequestInit = {}) => {
  const sep = path.includes('?') ? '&' : '?';
  const r = await json<T & { code?: number; message?: string }>(`${api(cfg)}${path}${sep}organization_id=${encodeURIComponent(cfg.ORG_ID)}`, { ...init, headers: { Authorization: `Zoho-oauthtoken ${await token(cfg)}`, ...(init.headers ?? {}) } });
  if (r.code && r.code !== 0) throw new ErpError(`Zoho: ${r.message ?? `error ${r.code}`}`);
  return r;
};
const allItems = async (cfg: Cfg) => {
  const out: Record<string, any>[] = [];
  for (let page = 1; page < 50; page += 1) {
    const r = await z<{ items: Record<string, any>[]; page_context?: { has_more_page?: boolean } }>(cfg, `/items?page=${page}&per_page=200&filter_by=Status.Active`);
    out.push(...r.items);
    if (!r.page_context?.has_more_page) break;
  }
  return out;
};
const itemBySku = async (cfg: Cfg, sku: string) => (await z<{ items: Record<string, any>[] }>(cfg, `/items?sku=${encodeURIComponent(sku)}`)).items[0] ?? null;

const pagedAll = async (cfg: Cfg, path: string, key: string) => {
  const out: Record<string, any>[] = [];
  for (let page = 1; page < 100; page += 1) {
    const r = await z<Record<string, any>>(cfg, `${path}${path.includes('?') ? '&' : '?'}page=${page}&per_page=200`);
    out.push(...((r[key] ?? []) as Record<string, any>[]));
    if (!r.page_context?.has_more_page) break;
  }
  return out;
};
const str = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));
const gstOf = (it: Record<string, any>) => {
  const prefs = (it.item_tax_preferences ?? []) as Record<string, any>[];
  const t = prefs.find((p) => /intra/i.test(String(p.tax_specification ?? ''))) ?? prefs[0];
  const pct = t?.tax_percentage ?? it.tax_percentage;
  return pct === undefined || pct === null || pct === '' ? null : num(pct);
};

export const zoho: Adapter = {
  id: 'zoho',
  required: ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN', 'ORG_ID'],
  async test(cfg) {
    // Newer orgs use "locations"; older ones "warehouses" — try both.
    const locs = await z<{ locations?: Record<string, any>[] }>(cfg, '/locations').then((r) => (r.locations ?? []).map((x) => String(x.location_name))).catch(() => [] as string[]);
    const whs = locs.length ? [] : await z<{ warehouses?: Record<string, any>[] }>(cfg, '/settings/warehouses').then((r) => (r.warehouses ?? []).map((x) => String(x.warehouse_name))).catch(() => [] as string[]);
    const items = await z<{ items: Record<string, any>[] }>(cfg, '/items?per_page=200&filter_by=Status.Active');
    const tracked = items.items.filter((i) => i.item_type === 'inventory' || i.track_inventory).length;
    return { ok: true, message: `Connected to Zoho Inventory org ${cfg.ORG_ID}.`, details: { locations: [...locs, ...whs], items: items.items.length, inventoryTrackedItems: tracked } };
  },
  async stock(cfg, opts) {
    const items = (await allItems(cfg)).filter((i) => i.item_type !== 'service' && i.product_type !== 'service');
    const out: Awaited<ReturnType<Adapter['stock']>> = [];
    for (const it of items) {
      const d = await z<{ item: Record<string, any> }>(cfg, `/items/${it.item_id}`);
      const code = String(d.item.sku || d.item.upc || d.item.ean || d.item.name);
      const cost = d.item.purchase_rate !== undefined ? num(d.item.purchase_rate) : null;
      // Stock per location (newer orgs) or per warehouse (older orgs); otherwise one org-level figure.
      const whs = ((d.item.locations?.length ? d.item.locations : d.item.warehouses) ?? []).map((w: Record<string, any>) => ({
        warehouse_id: w.location_id ?? w.warehouse_id, warehouse_name: String(w.location_name ?? w.warehouse_name ?? 'Default'),
        warehouse_stock_on_hand: w.location_stock_on_hand ?? w.warehouse_stock_on_hand ?? w.location_actual_available_stock ?? 0,
      })) as Record<string, any>[];
      if (!whs.length && num(d.item.stock_on_hand ?? d.item.actual_available_stock)) whs.push({ warehouse_id: null, warehouse_name: 'Default', warehouse_stock_on_hand: d.item.stock_on_hand ?? d.item.actual_available_stock });
      // Batch-tracked items: VERIFY endpoint on a live org (Zoho Inventory "batches" for an item).
      let batches: Record<string, any>[] = [];
      if (d.item.track_batch_number) batches = (await z<{ batches?: Record<string, any>[] }>(cfg, `/items/${it.item_id}/batches`).catch(() => ({ batches: [] }))).batches ?? [];
      for (const w of whs) {
        if (opts.locations?.length && !opts.locations.includes(w.warehouse_name)) continue;
        const inWh = batches.filter((b) => !(b.warehouse_id ?? b.location_id) || (b.warehouse_id ?? b.location_id) === w.warehouse_id);
        if (inWh.length) inWh.forEach((b) => out.push({ location: w.warehouse_name, itemCode: code, batch: String(b.batch_number ?? b.batch_no ?? ''), serial: null, mfgDate: isoDate(b.manufacturer_date ?? b.manufactured_date), expiryDate: isoDate(b.expiry_date), qty: num(b.balance_quantity ?? b.quantity_available ?? b.quantity), unitCost: cost, status: 'Available' }));
        else if (num(w.warehouse_stock_on_hand)) out.push({ location: w.warehouse_name, itemCode: code, batch: '', serial: null, mfgDate: null, expiryDate: null, qty: num(w.warehouse_stock_on_hand), unitCost: cost, status: 'Available' });
      }
    }
    return out;
  },
  async createSalesOrder(cfg, so) {
    const customerId = /^\d{10,}$/.test(so.customerCode) ? so.customerCode
      : (await z<{ contacts: { contact_id: string }[] }>(cfg, `/contacts?contact_type=customer&search_text=${encodeURIComponent(so.customerCode)}`)).contacts[0]?.contact_id;
    if (!customerId) throw new ErpError(`Zoho: customer “${so.customerCode}” not found — map the partner to its Zoho contact.`);
    const lines = [];
    for (const l of so.lines) {
      const it = await itemBySku(cfg, l.itemCode);
      if (!it) throw new ErpError(`Zoho: no item with SKU ${l.itemCode}.`);
      lines.push({ item_id: it.item_id, quantity: l.qty, ...(l.unitPrice !== null ? { rate: l.unitPrice } : {}) });
    }
    const r = await z<{ salesorder: { salesorder_id: string; salesorder_number: string } }>(cfg, '/salesorders', { method: 'POST', body: JSON.stringify({
      customer_id: customerId, reference_number: so.poNumber, date: so.poDate, shipment_date: so.requiredBy, notes: `VinFlux ${so.vinfluxRef}${so.notes ? ` — ${so.notes}` : ''}`, line_items: lines,
    }) });
    await z(cfg, `/salesorders/${r.salesorder.salesorder_id}/status/confirmed`, { method: 'POST' }).catch(() => undefined);
    return { erpId: r.salesorder.salesorder_id, erpNumber: r.salesorder.salesorder_number };
  },
  async products(cfg): Promise<ProductLine[]> {
    const list = await pagedAll(cfg, '/items', 'items');
    const out: ProductLine[] = [];
    for (const it of list.filter((i) => i.item_type !== 'service' && i.product_type !== 'service')) {
      // Item detail carries tax preferences and batch / serial flags (list may not).
      const d = list.length <= 300 ? (await z<{ item: Record<string, any> }>(cfg, `/items/${it.item_id}`).catch(() => ({ item: it }))).item : it;
      const batch = !!(d.track_batch_number ?? d.is_batch_tracked); const serial = !!(d.track_serial_number ?? d.is_serial_tracked);
      out.push({ erpId: String(it.item_id), itemCode: String(d.sku || it.sku || d.name), name: String(d.name ?? it.name), description: String(d.description ?? ''),
        barcode: str(d.upc || d.ean || d.isbn), hsn: str(d.hsn_or_sac), gstRate: gstOf(d), uom: str(d.unit), salesRate: d.rate !== undefined ? num(d.rate) : null, cost: d.purchase_rate !== undefined ? num(d.purchase_rate) : null,
        brand: str(d.brand), category: str(d.category_name), tracking: batch && serial ? 'Batch + Serial' : batch ? 'Batch' : serial ? 'Serial' : 'None', active: String(d.status ?? 'active') === 'active' });
    }
    return out;
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const list = await pagedAll(cfg, '/contacts?contact_type=customer', 'contacts');
    return list.map((c) => ({ erpId: String(c.contact_id), code: String(c.contact_id), name: String(c.company_name || c.contact_name), gstin: str(c.gst_no), email: str(c.email), phone: str(c.mobile || c.phone),
      address: str(c.billing_address?.address), city: str(c.billing_address?.city ?? c.city), state: str(c.billing_address?.state ?? c.state ?? c.place_of_contact), pincode: str(c.billing_address?.zip ?? c.zip), active: String(c.status ?? 'active') === 'active' }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const l = await z<{ locations?: Record<string, any>[] }>(cfg, '/locations').then((r) => r.locations ?? []).catch(() => [] as Record<string, any>[]);
    const rows = l.length ? l : await z<{ warehouses?: Record<string, any>[] }>(cfg, '/settings/warehouses').then((r) => r.warehouses ?? []).catch(() => [] as Record<string, any>[]);
    return rows.map((w) => ({ code: String(w.location_name ?? w.warehouse_name), name: String(w.location_name ?? w.warehouse_name), address: str(typeof w.address === 'object' && w.address ? w.address.street_address1 ?? w.address.address : w.address ?? w.street_address1), city: str(w.address?.city ?? w.city), state: str(w.address?.state ?? w.state), pincode: str(w.address?.zip ?? w.zip) }));
  },
  async invoicesFor(cfg, ref) {
    const r = await z<{ salesorder: { invoices?: Record<string, any>[] } }>(cfg, `/salesorders/${ref.erpId}`);
    return (r.salesorder.invoices ?? []).map((i) => ({ number: String(i.invoice_number), date: isoDate(i.date), status: String(i.status), amount: i.total !== undefined ? num(i.total) : null, irn: null, ewayBill: null }));
  },
};

/** Raw read for set-up / troubleshooting (prints what Zoho actually returns). */
export const zohoRaw = (cfg: Cfg, path: string) => z(cfg, path);
