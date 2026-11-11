/**
 * Microsoft Dynamics 365 Business Central — API v2.0, OAuth 2.0 client credentials (Microsoft Entra ID app).
 * Config: TENANT, ENVIRONMENT (e.g. Production), COMPANY_ID, CLIENT_ID, CLIENT_SECRET,
 *         STOCK_API (optional, e.g. vinflux/stock/v1.0 — the custom API page in server/erp-extensions/bc-vinflux-stock.al).
 *   stock      with STOCK_API: open item ledger entries by location / lot / serial / expiry
 *              without it:     items.inventory (one total per item, location “ALL”) — the standard API has no lot/location split
 *   order      salesOrders + salesOrderLines
 *   invoices   salesInvoices filtered by orderNumber
 */
import { entraToken, json, num, isoDate, trimSlash } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine } from '../types.js';

const root = (cfg: Cfg) => trimSlash(process.env.VFX_BC_API_BASE ?? 'https://api.businesscentral.dynamics.com/v2.0');
const base = (cfg: Cfg) => `${root(cfg)}/${cfg.TENANT}/${cfg.ENVIRONMENT}/api/v2.0/companies(${cfg.COMPANY_ID})`;
const auth = async (cfg: Cfg) => ({ Authorization: `Bearer ${await entraToken(cfg.TENANT, cfg.CLIENT_ID, cfg.CLIENT_SECRET, 'https://api.businesscentral.dynamics.com/.default')}` });
const getAll = async (cfg: Cfg, first: string) => {
  const out: Record<string, any>[] = [];
  let next: string | null = first;
  for (let i = 0; next && i < 200; i += 1) {
    const r: { value: Record<string, any>[]; '@odata.nextLink'?: string } = await json(next, { headers: await auth(cfg) });
    out.push(...r.value);
    next = r['@odata.nextLink'] ?? null;
  }
  return out;
};

export const d365bc: Adapter = {
  id: 'd365-bc',
  required: ['TENANT', 'ENVIRONMENT', 'COMPANY_ID', 'CLIENT_ID', 'CLIENT_SECRET'],
  async test(cfg) {
    const c = await json<Record<string, any>>(base(cfg), { headers: await auth(cfg) });
    const locs = await getAll(cfg, `${base(cfg)}/locations?$select=code`);
    return { ok: true, message: `Connected to Business Central company “${c.displayName ?? c.name}”.`, details: { locations: locs.map((l) => l.code), customStockApi: !!cfg.STOCK_API } };
  },
  async stock(cfg, opts) {
    if (cfg.STOCK_API) {
      const rows = await getAll(cfg, `${root(cfg)}/${cfg.TENANT}/${cfg.ENVIRONMENT}/api/${cfg.STOCK_API}/companies(${cfg.COMPANY_ID})/stockLines`);
      return rows.filter((r) => !opts.locations?.length || opts.locations.includes(r.locationCode)).map((r) => ({
        location: String(r.locationCode || 'BLANK'), itemCode: String(r.itemNo), batch: String(r.lotNo ?? ''), serial: r.serialNo ? String(r.serialNo) : null,
        mfgDate: null, expiryDate: isoDate(r.expirationDate), qty: num(r.remainingQuantity), unitCost: r.unitCost !== undefined ? num(r.unitCost) : null, status: 'Available' as const,
      }));
    }
    const items = await getAll(cfg, `${base(cfg)}/items?$select=number,gtin,inventory,unitCost,type&$filter=type eq 'Inventory'`);
    return items.filter((i) => num(i.inventory) !== 0).map((i) => ({ location: 'ALL', itemCode: String(i.number), batch: '', serial: null, mfgDate: null, expiryDate: null, qty: num(i.inventory), unitCost: num(i.unitCost), status: 'Available' as const }));
  },
  async createSalesOrder(cfg, so) {
    const h = { ...(await auth(cfg)), 'Content-Type': 'application/json' };
    const head = await json<{ id: string; number: string }>(`${base(cfg)}/salesOrders`, { method: 'POST', headers: h, body: JSON.stringify({ customerNumber: so.customerCode, externalDocumentNumber: so.poNumber.slice(0, 35), orderDate: so.poDate, requestedDeliveryDate: so.requiredBy }) });
    let locationId: string | undefined;
    if (so.location && so.location !== 'ALL') locationId = (await getAll(cfg, `${base(cfg)}/locations?$filter=code eq '${so.location}'`))[0]?.id;
    for (const l of so.lines) {
      await json(`${base(cfg)}/salesOrders(${head.id})/salesOrderLines`, { method: 'POST', headers: h, body: JSON.stringify({ lineType: 'Item', lineObjectNumber: l.itemCode, quantity: l.qty, ...(l.unitPrice !== null ? { unitPrice: l.unitPrice } : {}), ...(locationId ? { locationId } : {}) }) })
        .catch((e) => { throw new ErpError(`Business Central created order ${head.number} but line ${l.itemCode} failed: ${(e as Error).message}`); });
    }
    return { erpId: head.id, erpNumber: head.number };
  },
  async products(cfg): Promise<ProductLine[]> {
    const rows = await getAll(cfg, `${base(cfg)}/items?$filter=type eq 'Inventory'`);
    return rows.map((r) => ({ erpId: String(r.id), itemCode: String(r.number), name: String(r.displayName ?? r.number), description: '', barcode: r.gtin || null, hsn: null, gstRate: null,
      uom: r.baseUnitOfMeasureCode || null, salesRate: r.unitPrice !== undefined ? num(r.unitPrice) : null, cost: r.unitCost !== undefined ? num(r.unitCost) : null, brand: null, category: r.itemCategoryCode || null, tracking: null, active: !r.blocked }));
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const rows = await getAll(cfg, `${base(cfg)}/customers`);
    return rows.map((r) => ({ erpId: String(r.id), code: String(r.number), name: String(r.displayName), gstin: r.taxRegistrationNumber || null, email: r.email || null, phone: r.phoneNumber || null,
      address: r.addressLine1 || null, city: r.city || null, state: r.state || null, pincode: r.postalCode || null, active: !r.blocked || r.blocked === '_x0020_' }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const rows = await getAll(cfg, `${base(cfg)}/locations`);
    return rows.map((r) => ({ code: String(r.code), name: String(r.displayName ?? r.code), address: r.addressLine1 || null, city: r.city || null, state: r.state || null, pincode: r.postalCode || null }));
  },
  async invoicesFor(cfg, ref) {
    const inv = await getAll(cfg, `${base(cfg)}/salesInvoices?$filter=orderNumber eq '${ref.erpNumber}'`);
    return inv.map((i) => ({ number: String(i.number), date: isoDate(i.invoiceDate), status: String(i.status), amount: num(i.totalAmountIncludingTax), irn: null, ewayBill: null }));
  },
};
