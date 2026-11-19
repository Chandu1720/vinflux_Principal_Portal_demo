/**
 * SAP S/4HANA (Cloud or on-premise via SAP Gateway / Cloud Connector) — OData v2 APIs.
 * Config: BASE_URL (…/sap/opu/odata/sap), USER + PASSWORD (communication user) or API_KEY (SAP API sandbox),
 *         CLIENT (sap-client, optional), SALES_ORG, DIST_CHANNEL, DIVISION, ORDER_TYPE (default OR), LOCATION_LEVEL (plant | storage).
 *   stock      API_MATERIAL_STOCK_SRV / A_MatlStkInAcctMod  (+ API_BATCH_SRV for expiry / manufacture dates)
 *   order      API_SALES_ORDER_SRV / A_SalesOrder (deep insert with to_Item; CSRF token)
 *   invoices   API_BILLING_DOCUMENT_SRV / A_BillingDocumentItem → A_BillingDocument
 * Prices: SAP determines prices from its own condition records; VinFlux's net price is sent only as a reference.
 */
import { basic, isoDate, json, num, request, trimSlash } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine, StockLine } from '../types.js';

const headers = (cfg: Cfg): Record<string, string> => ({
  Accept: 'application/json',
  ...(cfg.API_KEY ? { APIKey: cfg.API_KEY } : { Authorization: basic(cfg.USER, cfg.PASSWORD) }),
});
const url = (cfg: Cfg, path: string) => {
  const u = `${trimSlash(cfg.BASE_URL)}/${path}`;
  const extra = [cfg.CLIENT ? `sap-client=${cfg.CLIENT}` : '', '$format=json'].filter(Boolean).join('&');
  return `${u}${u.includes('?') ? '&' : '?'}${extra}`;
};
/** Follow OData v2 server paging (d.__next). */
const getAll = async (cfg: Cfg, path: string) => {
  const out: Record<string, any>[] = [];
  let next: string | null = url(cfg, path);
  for (let i = 0; next && i < 200; i += 1) {
    const r: { d: { results: Record<string, any>[]; __next?: string } } = await json(next, { headers: headers(cfg) });
    out.push(...r.d.results);
    next = r.d.__next ? (r.d.__next.startsWith('http') ? r.d.__next : `${trimSlash(cfg.BASE_URL)}/${path.split('/')[0]}/${r.d.__next}`) : null;
  }
  return out;
};
const status = (t: string): StockLine['status'] => (t === '01' ? 'Available' : t === '02' ? 'Quarantine' : 'Blocked');
const odataDate = (iso: string) => `/Date(${Date.parse(`${iso}T00:00:00Z`)})/`;

export const sap: Adapter = {
  id: 'sap',
  required: ['BASE_URL'],
  async test(cfg) {
    if (!cfg.API_KEY && !(cfg.USER && cfg.PASSWORD)) throw new ErpError('SAP: set USER and PASSWORD (communication user) or API_KEY (SAP API sandbox).');
    const rows = await json<{ d: { results: Record<string, any>[] } }>(url(cfg, 'API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?$top=5'), { headers: headers(cfg) });
    const plants = [...new Set(rows.d.results.map((r) => r.Plant))];
    return { ok: true, message: `Connected to SAP — stock API answered (${rows.d.results.length} sample line(s)).`, details: { samplePlants: plants } };
  },
  async stock(cfg, opts) {
    const plants = [...new Set((opts.locations ?? []).map((l) => l.split('/')[0]))];
    const filter = plants.length ? `$filter=${encodeURIComponent(plants.map((p) => `Plant eq '${p}'`).join(' or '))}&` : '';
    const rows = (await getAll(cfg, `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?${filter}$select=Material,Plant,StorageLocation,Batch,InventoryStockType,InventorySpecialStockType,MatlWrhsStkQtyInMatlBaseUnit`))
      .filter((r) => !r.InventorySpecialStockType && num(r.MatlWrhsStkQtyInMatlBaseUnit) !== 0);
    // Batch dates — one call per 15 materials.
    const dates = new Map<string, { mfg: string | null; exp: string | null }>();
    const mats = [...new Set(rows.filter((r) => r.Batch).map((r) => r.Material as string))];
    for (let i = 0; i < mats.length; i += 15) {
      const f = encodeURIComponent(mats.slice(i, i + 15).map((m) => `Material eq '${m}'`).join(' or '));
      try {
        (await getAll(cfg, `API_BATCH_SRV/Batch?$filter=${f}&$select=Material,Batch,ShelfLifeExpirationDate,ManufactureDate`))
          .forEach((b) => dates.set(`${b.Material}|${b.Batch}`, { mfg: isoDate(b.ManufactureDate), exp: isoDate(b.ShelfLifeExpirationDate) }));
      } catch { /* batch API not released for this user — quantities still load */ }
    }
    const storage = cfg.LOCATION_LEVEL === 'storage';
    return rows.map((r) => {
      const d = dates.get(`${r.Material}|${r.Batch}`);
      return { location: storage ? `${r.Plant}/${r.StorageLocation}` : String(r.Plant), itemCode: String(r.Material).replace(/^0+(?=\d)/, ''), batch: String(r.Batch ?? ''), serial: null,
        mfgDate: d?.mfg ?? null, expiryDate: d?.exp ?? null, qty: num(r.MatlWrhsStkQtyInMatlBaseUnit), unitCost: null, status: status(String(r.InventoryStockType)) };
    });
  },
  async createSalesOrder(cfg, so) {
    if (cfg.API_KEY) throw new ErpError('SAP API sandbox is read-only — sales orders need a real S/4HANA communication user.');
    // CSRF token + session cookie first.
    const pre = await request(url(cfg, 'API_SALES_ORDER_SRV/'), { headers: { ...headers(cfg), 'x-csrf-token': 'Fetch' } });
    const csrf = pre.headers.get('x-csrf-token');
    const cookie = (pre.headers.getSetCookie?.() ?? [pre.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).join('; ');
    if (!csrf) throw new ErpError(`SAP did not issue a CSRF token (HTTP ${pre.status}) — check the communication user.`, pre.status);
    const body = {
      SalesOrderType: cfg.ORDER_TYPE || 'OR', SalesOrganization: cfg.SALES_ORG, DistributionChannel: cfg.DIST_CHANNEL, OrganizationDivision: cfg.DIVISION,
      SoldToParty: so.customerCode, PurchaseOrderByCustomer: so.poNumber.slice(0, 35), CustomerPurchaseOrderDate: odataDate(so.poDate), RequestedDeliveryDate: odataDate(so.requiredBy),
      to_Item: { results: so.lines.map((l) => ({ Material: l.itemCode, RequestedQuantity: String(l.qty), ...(so.location ? { ProductionPlant: so.location.split('/')[0] } : {}) })) },
    };
    const r = await json<{ d: { SalesOrder: string } }>(url(cfg, 'API_SALES_ORDER_SRV/A_SalesOrder'), { method: 'POST', body: JSON.stringify(body), headers: { ...headers(cfg), 'x-csrf-token': csrf, Cookie: cookie, 'Content-Type': 'application/json' } });
    return { erpId: r.d.SalesOrder, erpNumber: r.d.SalesOrder };
  },
  async products(cfg): Promise<ProductLine[]> {
    const rows = await getAll(cfg, 'API_PRODUCT_SRV/A_Product?$select=Product,ProductType,BaseUnit,ProductGroup,IsMarkedForDeletion,ProductStandardID,IsBatchManagementRequired');
    const desc = new Map<string, string>();
    try { (await getAll(cfg, "API_PRODUCT_SRV/A_ProductDescription?$filter=Language eq 'EN'&$select=Product,ProductDescription")).forEach((d) => desc.set(String(d.Product), String(d.ProductDescription))); } catch { /* descriptions optional */ }
    return rows.map((r) => {
      const code = String(r.Product).replace(/^0+(?=\d)/, '');
      return { erpId: String(r.Product), itemCode: code, name: desc.get(String(r.Product)) ?? code, description: '', barcode: r.ProductStandardID || null, hsn: null, gstRate: null, uom: r.BaseUnit || null,
        salesRate: null, cost: null, brand: null, category: r.ProductGroup || null, tracking: r.IsBatchManagementRequired ? 'Batch' as const : null, active: !r.IsMarkedForDeletion };
    });
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const rows = await getAll(cfg, 'API_BUSINESS_PARTNER/A_Customer?$select=Customer,CustomerName,CustomerFullName,DeletionIndicator');
    const gst = new Map<string, string>();
    try { (await getAll(cfg, "API_BUSINESS_PARTNER/A_BusinessPartnerTaxNumber?$filter=BPTaxType eq 'IN3'&$select=BusinessPartner,BPTaxNumber")).forEach((t) => gst.set(String(t.BusinessPartner), String(t.BPTaxNumber))); } catch { /* tax numbers optional */ }
    return rows.map((r) => ({ erpId: String(r.Customer), code: String(r.Customer), name: String(r.CustomerFullName || r.CustomerName), gstin: gst.get(String(r.Customer)) ?? null, email: null, phone: null, address: null, city: null, state: null, pincode: null, active: !r.DeletionIndicator }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const rows = await getAll(cfg, 'API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?$select=Plant,StorageLocation');
    const storage = cfg.LOCATION_LEVEL === 'storage';
    return [...new Set(rows.map((r) => (storage ? `${r.Plant}/${r.StorageLocation}` : String(r.Plant))))].sort().map((c) => ({ code: c, name: c, address: null, city: null, state: null, pincode: null }));
  },
  async invoicesFor(cfg, ref) {
    const items = await getAll(cfg, `API_BILLING_DOCUMENT_SRV/A_BillingDocumentItem?$filter=${encodeURIComponent(`SalesDocument eq '${ref.erpNumber}'`)}&$select=BillingDocument`);
    const docs = [...new Set(items.map((i) => String(i.BillingDocument)))];
    const out = [];
    for (const d of docs) {
      const h = await json<{ d: Record<string, any> }>(url(cfg, `API_BILLING_DOCUMENT_SRV/A_BillingDocument('${d}')`), { headers: headers(cfg) });
      out.push({ number: d, date: isoDate(h.d.BillingDocumentDate), status: h.d.BillingDocumentIsCancelled ? 'Cancelled' : String(h.d.OverallBillingStatus ?? 'Billed'), amount: num(h.d.TotalNetAmount) + num(h.d.TotalTaxAmount), irn: null, ewayBill: null });
    }
    return out;
  },
};
