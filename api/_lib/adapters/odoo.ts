/**
 * Odoo — External API over JSON-RPC (/jsonrpc), authenticated with an integration user's API key.
 * Config: URL, DB, LOGIN, API_KEY.  Works with Odoo Online, Odoo.sh and on-premise (16, 17, 18).
 *   stock      stock.quant on internal locations (+ stock.lot for lot / serial and expiry)
 *   order      sale.order (+ action_confirm)
 *   invoices   account.move (out_invoice) whose invoice_origin is the sales order
 */
import { json, num, isoDate, trimSlash } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine } from '../types.js';
const trk = (b: boolean, s: boolean): ProductLine['tracking'] => (b && s ? 'Batch + Serial' : b ? 'Batch' : s ? 'Serial' : 'None');


const rpc = async (cfg: Cfg, service: string, method: string, args: unknown[]) => {
  const r = await json<{ result?: unknown; error?: { message: string; data?: { message?: string } } }>(`${trimSlash(cfg.URL)}/jsonrpc`, {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params: { service, method, args } }),
  });
  if (r.error) throw new ErpError(`Odoo: ${r.error.data?.message ?? r.error.message}`);
  return r.result;
};
const uidCache = new Map<string, number>();
const uid = async (cfg: Cfg) => {
  const k = `${cfg.URL}|${cfg.DB}|${cfg.LOGIN}`;
  if (uidCache.has(k)) return uidCache.get(k)!;
  const u = await rpc(cfg, 'common', 'authenticate', [cfg.DB, cfg.LOGIN, cfg.API_KEY, {}]);
  if (!u) throw new ErpError('Odoo rejected the login — check database, login and API key.', 401);
  uidCache.set(k, u as number);
  return u as number;
};
const kw = async (cfg: Cfg, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
  rpc(cfg, 'object', 'execute_kw', [cfg.DB, await uid(cfg), cfg.API_KEY, model, method, args, kwargs]);
const m2o = (v: unknown): [number, string] | null => (Array.isArray(v) && v.length === 2 ? [v[0] as number, String(v[1])] : null);

export const odoo: Adapter = {
  id: 'odoo',
  required: ['URL', 'DB', 'LOGIN', 'API_KEY'],
  async test(cfg) {
    const version = await rpc(cfg, 'common', 'version', []) as { server_version?: string };
    const u = await uid(cfg);
    const locs = await kw(cfg, 'stock.location', 'search_read', [[['usage', '=', 'internal']]], { fields: ['complete_name'], limit: 50 }) as { complete_name: string }[];
    return { ok: true, message: `Connected to Odoo ${version.server_version ?? ''} as user #${u}.`, details: { locations: locs.map((l) => l.complete_name) } };
  },
  async stock(cfg, opts) {
    const domain: unknown[] = [['location_id.usage', '=', 'internal'], ['quantity', '!=', 0]];
    if (opts.locations?.length) domain.push(['location_id.complete_name', 'in', opts.locations]);
    const quants = await kw(cfg, 'stock.quant', 'search_read', [domain], { fields: ['product_id', 'location_id', 'lot_id', 'quantity'] }) as Record<string, unknown>[];
    const productIds = [...new Set(quants.map((q) => m2o(q.product_id)?.[0]).filter(Boolean))];
    const lotIds = [...new Set(quants.map((q) => m2o(q.lot_id)?.[0]).filter(Boolean))];
    const products = productIds.length ? await kw(cfg, 'product.product', 'read', [productIds], { fields: ['default_code', 'barcode', 'standard_price', 'tracking'] }) as Record<string, unknown>[] : [];
    // expiration_date exists when the product_expiry module is installed; fall back gracefully if not.
    let lots: Record<string, unknown>[] = [];
    if (lotIds.length) {
      try { lots = await kw(cfg, 'stock.lot', 'read', [lotIds], { fields: ['name', 'expiration_date'] }) as Record<string, unknown>[]; }
      catch { lots = await kw(cfg, 'stock.lot', 'read', [lotIds], { fields: ['name'] }) as Record<string, unknown>[]; }
    }
    const P = new Map(products.map((p) => [p.id as number, p]));
    const Lt = new Map(lots.map((l) => [l.id as number, l]));
    return quants.map((q) => {
      const p = P.get(m2o(q.product_id)?.[0] ?? -1);
      const lot = Lt.get(m2o(q.lot_id)?.[0] ?? -1);
      const serial = p?.tracking === 'serial' && lot ? String(lot.name) : null;
      return {
        location: m2o(q.location_id)?.[1] ?? '', itemCode: String(p?.default_code || p?.barcode || m2o(q.product_id)?.[1] || ''),
        batch: lot && !serial ? String(lot.name) : serial ? String(lot!.name) : '', serial, mfgDate: null, expiryDate: isoDate(lot?.expiration_date),
        qty: num(q.quantity), unitCost: p ? num(p.standard_price) : null, status: 'Available' as const,
      };
    });
  },
  async createSalesOrder(cfg, so) {
    const partner = await kw(cfg, 'res.partner', 'search_read', [[['ref', '=', so.customerCode]]], { fields: ['id'], limit: 1 }) as { id: number }[];
    const partnerId = partner[0]?.id ?? (/^\d+$/.test(so.customerCode) ? Number(so.customerCode) : null);
    if (!partnerId) throw new ErpError(`Odoo: no customer with reference “${so.customerCode}”. Set the partner's Odoo reference in the connector's partner mapping.`);
    const codes = so.lines.map((l) => l.itemCode);
    const prods = await kw(cfg, 'product.product', 'search_read', [['|', ['default_code', 'in', codes], ['barcode', 'in', codes]]], { fields: ['default_code', 'barcode'] }) as Record<string, unknown>[];
    const byCode = new Map<string, number>();
    prods.forEach((p) => { if (p.default_code) byCode.set(String(p.default_code), p.id as number); if (p.barcode) byCode.set(String(p.barcode), p.id as number); });
    const missing = codes.filter((c) => !byCode.has(c));
    if (missing.length) throw new ErpError(`Odoo: products not found by internal reference / barcode: ${missing.join(', ')}`);
    const id = await kw(cfg, 'sale.order', 'create', [{
      partner_id: partnerId, client_order_ref: so.poNumber, commitment_date: so.requiredBy ? `${so.requiredBy} 00:00:00` : false, note: `VinFlux ${so.vinfluxRef}${so.notes ? ` — ${so.notes}` : ''}`,
      order_line: so.lines.map((l) => [0, 0, { product_id: byCode.get(l.itemCode), product_uom_qty: l.qty, ...(l.unitPrice !== null ? { price_unit: l.unitPrice } : {}) }]),
    }]) as number;
    await kw(cfg, 'sale.order', 'action_confirm', [[id]]);
    const [rec] = await kw(cfg, 'sale.order', 'read', [[id]], { fields: ['name'] }) as { name: string }[];
    return { erpId: String(id), erpNumber: rec.name };
  },
  async products(cfg): Promise<ProductLine[]> {
    // l10n_in_hsn_code exists with the Indian localisation; read it when present.
    const fields = ['default_code', 'name', 'description_sale', 'barcode', 'uom_id', 'list_price', 'standard_price', 'tracking', 'active', 'categ_id', 'taxes_id'];
    const rows = await kw(cfg, 'product.product', 'search_read', [[['type', 'in', ['product', 'consu']]]], { fields: [...fields, 'l10n_in_hsn_code'] })
      .catch(() => kw(cfg, 'product.product', 'search_read', [[['type', 'in', ['product', 'consu']]]], { fields })) as Record<string, any>[];
    const taxIds = [...new Set(rows.flatMap((r) => (r.taxes_id ?? []) as number[]))];
    const taxes = taxIds.length ? new Map((await kw(cfg, 'account.tax', 'read', [taxIds], { fields: ['amount', 'amount_type'] }) as Record<string, any>[]).map((t) => [t.id as number, t])) : new Map();
    return rows.map((r) => {
      const tax = (r.taxes_id ?? []).map((id: number) => taxes.get(id)).find((t: Record<string, any> | undefined) => t?.amount_type === 'percent' || t?.amount_type === 'group');
      return { erpId: String(r.id), itemCode: String(r.default_code || r.barcode || r.id), name: String(r.name), description: String(r.description_sale || ''), barcode: r.barcode ? String(r.barcode) : null,
        hsn: r.l10n_in_hsn_code ? String(r.l10n_in_hsn_code) : null, gstRate: tax ? num(tax.amount) : null, uom: m2o(r.uom_id)?.[1] ?? null, salesRate: num(r.list_price), cost: num(r.standard_price),
        brand: null, category: m2o(r.categ_id)?.[1] ?? null, tracking: trk(r.tracking === 'lot', r.tracking === 'serial'), active: r.active !== false };
    });
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const rows = await kw(cfg, 'res.partner', 'search_read', [[['customer_rank', '>', 0], ['parent_id', '=', false]]], { fields: ['name', 'ref', 'vat', 'email', 'phone', 'mobile', 'street', 'city', 'state_id', 'zip', 'active'] }) as Record<string, any>[];
    return rows.map((r) => ({ erpId: String(r.id), code: String(r.ref || r.id), name: String(r.name), gstin: r.vat ? String(r.vat) : null, email: r.email || null, phone: r.mobile || r.phone || null,
      address: r.street || null, city: r.city || null, state: m2o(r.state_id)?.[1]?.replace(/\s*\(.*\)$/, '') ?? null, pincode: r.zip || null, active: r.active !== false }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const rows = await kw(cfg, 'stock.location', 'search_read', [[['usage', '=', 'internal']]], { fields: ['complete_name'] }) as Record<string, any>[];
    return rows.map((r) => ({ code: String(r.complete_name), name: String(r.complete_name), address: null, city: null, state: null, pincode: null }));
  },
  async invoicesFor(cfg, ref) {
    const moves = await kw(cfg, 'account.move', 'search_read', [[['move_type', '=', 'out_invoice'], ['invoice_origin', 'ilike', ref.erpNumber]]], { fields: ['name', 'invoice_date', 'state', 'amount_total'] }) as Record<string, unknown>[];
    return moves.map((m) => ({ number: String(m.name), date: isoDate(m.invoice_date), status: String(m.state), amount: num(m.amount_total), irn: null, ewayBill: null }));
  },
};
