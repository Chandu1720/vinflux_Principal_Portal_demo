/**
 * ERPNext / Frappe — REST API with API key + secret.
 * Config: URL, API_KEY, API_SECRET, COMPANY (optional).
 *   stock      Bin (warehouse totals) → batch split via get_batch_qty, serials via Serial No
 *   order      Sales Order (submitted)
 *   invoices   Sales Invoice linked through its items' sales_order (IRN / e-way bill from India Compliance when installed)
 */
import { json, num, isoDate, trimSlash } from '../http.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine } from '../types.js';
const trk = (b: boolean, s: boolean): ProductLine['tracking'] => (b && s ? 'Batch + Serial' : b ? 'Batch' : s ? 'Serial' : 'None');


const h = (cfg: Cfg) => ({ Authorization: `token ${cfg.API_KEY}:${cfg.API_SECRET}` });
const q = (o: unknown) => encodeURIComponent(JSON.stringify(o));
const list = async (cfg: Cfg, doctype: string, fields: string[], filters: unknown[] = []) =>
  (await json<{ data: Record<string, any>[] }>(`${trimSlash(cfg.URL)}/api/resource/${encodeURIComponent(doctype)}?fields=${q(fields)}&filters=${q(filters)}&limit_page_length=0`, { headers: h(cfg) })).data;
const method = async <T = any>(cfg: Cfg, name: string, args: Record<string, string>) =>
  (await json<{ message: T }>(`${trimSlash(cfg.URL)}/api/method/${name}?${new URLSearchParams(args)}`, { headers: h(cfg) })).message;

export const erpnext: Adapter = {
  id: 'erpnext',
  required: ['URL', 'API_KEY', 'API_SECRET'],
  async test(cfg) {
    const me = await method<string>(cfg, 'frappe.auth.get_logged_user', {});
    const w = await list(cfg, 'Warehouse', ['name'], [['is_group', '=', 0]]);
    return { ok: true, message: `Connected to ERPNext as ${me}.`, details: { warehouses: w.map((x) => x.name) } };
  },
  async stock(cfg, opts) {
    const items = new Map((await list(cfg, 'Item', ['item_code', 'barcodes', 'has_batch_no', 'has_serial_no', 'valuation_rate'], [['disabled', '=', 0]])).map((i) => [i.item_code as string, i]));
    const bins = (await list(cfg, 'Bin', ['item_code', 'warehouse', 'actual_qty'], [['actual_qty', '!=', 0]])).filter((b) => !opts.locations?.length || opts.locations.includes(b.warehouse));
    const out: Awaited<ReturnType<Adapter['stock']>> = [];
    const serials = await list(cfg, 'Serial No', ['name', 'item_code', 'warehouse', 'batch_no'], [['status', '=', 'Active'], ['warehouse', 'is', 'set']]).catch(() => []);
    const batchExpiry = new Map((await list(cfg, 'Batch', ['name', 'expiry_date', 'manufacturing_date'], []).catch(() => [])).map((b) => [b.name as string, b]));
    for (const b of bins) {
      const it = items.get(b.item_code);
      const cost = it ? num(it.valuation_rate) : null;
      if (it?.has_serial_no) {
        serials.filter((s) => s.item_code === b.item_code && s.warehouse === b.warehouse).forEach((s) => {
          const bt = batchExpiry.get(s.batch_no);
          out.push({ location: b.warehouse, itemCode: b.item_code, batch: String(s.batch_no ?? ''), serial: String(s.name), mfgDate: isoDate(bt?.manufacturing_date), expiryDate: isoDate(bt?.expiry_date), qty: 1, unitCost: cost, status: 'Available' });
        });
        continue;
      }
      if (it?.has_batch_no) {
        const rows = await method<{ batch_no: string; qty: number }[]>(cfg, 'erpnext.stock.doctype.batch.batch.get_batch_qty', { item_code: b.item_code, warehouse: b.warehouse }).catch(() => []);
        if (rows?.length) {
          rows.filter((r) => num(r.qty)).forEach((r) => { const bt = batchExpiry.get(r.batch_no); out.push({ location: b.warehouse, itemCode: b.item_code, batch: r.batch_no, serial: null, mfgDate: isoDate(bt?.manufacturing_date), expiryDate: isoDate(bt?.expiry_date), qty: num(r.qty), unitCost: cost, status: 'Available' }); });
          continue;
        }
      }
      out.push({ location: b.warehouse, itemCode: b.item_code, batch: '', serial: null, mfgDate: null, expiryDate: null, qty: num(b.actual_qty), unitCost: cost, status: 'Available' });
    }
    return out;
  },
  async createSalesOrder(cfg, so) {
    const r = await json<{ data: { name: string } }>(`${trimSlash(cfg.URL)}/api/resource/Sales%20Order`, { method: 'POST', headers: h(cfg), body: JSON.stringify({
      customer: so.customerCode, po_no: so.poNumber, po_date: so.poDate, transaction_date: so.poDate, delivery_date: so.requiredBy, ...(cfg.COMPANY ? { company: cfg.COMPANY } : {}),
      ...(so.location ? { set_warehouse: so.location } : {}), docstatus: 1,
      items: so.lines.map((l) => ({ item_code: l.itemCode, qty: l.qty, delivery_date: so.requiredBy, ...(l.unitPrice !== null ? { rate: l.unitPrice } : {}) })),
    }) });
    return { erpId: r.data.name, erpNumber: r.data.name };
  },
  async products(cfg): Promise<ProductLine[]> {
    const rows = await list(cfg, 'Item', ['name', 'item_code', 'item_name', 'description', 'stock_uom', 'gst_hsn_code', 'has_batch_no', 'has_serial_no', 'valuation_rate', 'standard_rate', 'disabled', 'brand', 'item_group', 'is_stock_item'], [['is_stock_item', '=', 1]])
      .catch(() => list(cfg, 'Item', ['name', 'item_code', 'item_name', 'description', 'stock_uom', 'has_batch_no', 'has_serial_no', 'valuation_rate', 'standard_rate', 'disabled', 'brand', 'item_group'], []));
    return rows.map((r) => ({ erpId: String(r.name), itemCode: String(r.item_code || r.name), name: String(r.item_name || r.item_code), description: String(r.description ?? '').replace(/<[^>]+>/g, ''), barcode: null,
      hsn: r.gst_hsn_code ? String(r.gst_hsn_code) : null, gstRate: null, uom: r.stock_uom ?? null, salesRate: r.standard_rate ? num(r.standard_rate) : null, cost: r.valuation_rate ? num(r.valuation_rate) : null,
      brand: r.brand ?? null, category: r.item_group ?? null, tracking: trk(!!r.has_batch_no, !!r.has_serial_no), active: !r.disabled }));
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const rows = await list(cfg, 'Customer', ['name', 'customer_name', 'gstin', 'email_id', 'mobile_no', 'disabled'], [])
      .catch(() => list(cfg, 'Customer', ['name', 'customer_name', 'email_id', 'mobile_no', 'disabled'], []));
    return rows.map((r) => ({ erpId: String(r.name), code: String(r.name), name: String(r.customer_name || r.name), gstin: r.gstin ?? null, email: r.email_id ?? null, phone: r.mobile_no ?? null, address: null, city: null, state: null, pincode: null, active: !r.disabled }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const rows = await list(cfg, 'Warehouse', ['name', 'warehouse_name', 'address_line_1', 'city', 'state', 'pin'], [['is_group', '=', 0]]).catch(() => list(cfg, 'Warehouse', ['name'], [['is_group', '=', 0]]));
    return rows.map((r) => ({ code: String(r.name), name: String(r.warehouse_name || r.name), address: r.address_line_1 ?? null, city: r.city ?? null, state: r.state ?? null, pincode: r.pin ?? null }));
  },
  async invoicesFor(cfg, ref) {
    const filters = [['Sales Invoice Item', 'sales_order', '=', ref.erpNumber], ['docstatus', '=', 1]];
    const rows = await list(cfg, 'Sales Invoice', ['name', 'posting_date', 'status', 'grand_total', 'irn', 'ewaybill'], filters)
      .catch(() => list(cfg, 'Sales Invoice', ['name', 'posting_date', 'status', 'grand_total'], filters));
    return rows.map((r) => ({ number: String(r.name), date: isoDate(r.posting_date), status: String(r.status), amount: num(r.grand_total), irn: r.irn ?? null, ewayBill: r.ewaybill ?? null }));
  },
};
