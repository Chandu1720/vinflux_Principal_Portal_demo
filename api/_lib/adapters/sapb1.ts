/**
 * SAP Business One — Service Layer (REST / OData), session login.
 * Config: BASE_URL (https://<server>:50000/b1s/v1), COMPANY_DB, USER, PASSWORD.
 *   stock      Items → ItemWarehouseInfoCollection (quantity per warehouse); batch / serial detail via BatchNumberDetails / SerialNumberDetails
 *              (per-batch quantities need a Service Layer SQL view on most versions — warehouse totals load without it)
 *   order      Orders
 *   invoices   Invoices with the same customer reference (NumAtCard)
 */
import { json, num, isoDate, request, trimSlash } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine } from '../types.js';
const trk = (b: boolean, s: boolean): ProductLine['tracking'] => (b && s ? 'Batch + Serial' : b ? 'Batch' : s ? 'Serial' : 'None');


const sessions = new Map<string, { cookie: string; exp: number }>();
const login = async (cfg: Cfg) => {
  const k = `${cfg.BASE_URL}|${cfg.COMPANY_DB}|${cfg.USER}`;
  const s = sessions.get(k);
  if (s && s.exp > Date.now()) return s.cookie;
  const r = await request(`${trimSlash(cfg.BASE_URL)}/Login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ CompanyDB: cfg.COMPANY_DB, UserName: cfg.USER, Password: cfg.PASSWORD }) });
  if (!r.ok) throw new ErpError(`SAP Business One login failed (HTTP ${r.status}) — check company database, user and password.`, r.status, (await r.text()).slice(0, 300));
  const body = await r.json() as { SessionTimeout?: number };
  const cookie = (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter(Boolean).join('; ');
  sessions.set(k, { cookie, exp: Date.now() + Math.max(5, (body.SessionTimeout ?? 30) - 5) * 60000 });
  return cookie;
};
const sl = async <T = any>(cfg: Cfg, path: string, init: RequestInit = {}) => json<T>(path.startsWith('http') ? path : `${trimSlash(cfg.BASE_URL)}/${path}`, { ...init, headers: { Cookie: await login(cfg), Prefer: 'odata.maxpagesize=500', ...(init.headers ?? {}) } });
const getAll = async (cfg: Cfg, path: string) => {
  const out: Record<string, any>[] = [];
  let next: string | null = path;
  for (let i = 0; next && i < 400; i += 1) {
    const r: { value: Record<string, any>[]; 'odata.nextLink'?: string; '@odata.nextLink'?: string } = await sl(cfg, next);
    out.push(...r.value);
    const n = r['odata.nextLink'] ?? r['@odata.nextLink'];
    next = n ? n.replace(/^\/?b1s\/v\d\//, '') : null;
  }
  return out;
};

export const sapB1: Adapter = {
  id: 'sap-b1',
  required: ['BASE_URL', 'COMPANY_DB', 'USER', 'PASSWORD'],
  async test(cfg) {
    const w = await getAll(cfg, 'Warehouses?$select=WarehouseCode,WarehouseName');
    return { ok: true, message: `Connected to SAP Business One company ${cfg.COMPANY_DB}.`, details: { warehouses: w.map((x) => x.WarehouseCode) } };
  },
  async stock(cfg, opts) {
    const items = await getAll(cfg, "Items?$select=ItemCode,BarCode,AvgStdPrice,ManageBatchNumbers,ManageSerialNumbers,ItemWarehouseInfoCollection&$filter=InventoryItem eq 'tYES'");
    const out: Awaited<ReturnType<Adapter['stock']>> = [];
    items.forEach((it) => (it.ItemWarehouseInfoCollection ?? []).forEach((w: Record<string, any>) => {
      if (!num(w.InStock) || (opts.locations?.length && !opts.locations.includes(w.WarehouseCode))) return;
      out.push({ location: String(w.WarehouseCode), itemCode: String(it.ItemCode), batch: '', serial: null, mfgDate: null, expiryDate: null, qty: num(w.InStock), unitCost: it.AvgStdPrice !== undefined ? num(it.AvgStdPrice) : null, status: 'Available' });
    }));
    return out;
  },
  async createSalesOrder(cfg, so) {
    const r = await sl<{ DocEntry: number; DocNum: number }>(cfg, 'Orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      CardCode: so.customerCode, NumAtCard: so.poNumber, DocDate: so.poDate, DocDueDate: so.requiredBy, Comments: `VinFlux ${so.vinfluxRef}${so.notes ? ` — ${so.notes}` : ''}`.slice(0, 254),
      DocumentLines: so.lines.map((l) => ({ ItemCode: l.itemCode, Quantity: l.qty, ...(l.unitPrice !== null ? { UnitPrice: l.unitPrice } : {}), ...(so.location ? { WarehouseCode: so.location } : {}) })),
    }) });
    return { erpId: String(r.DocEntry), erpNumber: String(r.DocNum) };
  },
  async products(cfg): Promise<ProductLine[]> {
    const rows = await getAll(cfg, "Items?$select=ItemCode,ItemName,ForeignName,BarCode,SalesUnit,InventoryUOM,AvgStdPrice,ManageBatchNumbers,ManageSerialNumbers,Valid,Frozen,ItemsGroupCode,ChapterID&$filter=InventoryItem eq 'tYES'")
      .catch(() => getAll(cfg, "Items?$select=ItemCode,ItemName,BarCode,InventoryUOM,AvgStdPrice,ManageBatchNumbers,ManageSerialNumbers,Valid&$filter=InventoryItem eq 'tYES'"));
    return rows.map((r) => ({ erpId: String(r.ItemCode), itemCode: String(r.ItemCode), name: String(r.ItemName ?? r.ItemCode), description: String(r.ForeignName ?? ''), barcode: r.BarCode || null,
      hsn: r.ChapterID && /^\d{4,8}$/.test(String(r.ChapterID)) ? String(r.ChapterID) : null, gstRate: null, uom: r.InventoryUOM || r.SalesUnit || null, salesRate: null, cost: r.AvgStdPrice !== undefined ? num(r.AvgStdPrice) : null,
      brand: null, category: r.ItemsGroupCode !== undefined ? String(r.ItemsGroupCode) : null, tracking: trk(r.ManageBatchNumbers === 'tYES', r.ManageSerialNumbers === 'tYES'), active: r.Valid !== 'tNO' && r.Frozen !== 'tYES' }));
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const rows = await getAll(cfg, "BusinessPartners?$select=CardCode,CardName,EmailAddress,Phone1,Cellular,City,BillToState,ZipCode,Address,FederalTaxID,Valid&$filter=CardType eq 'cCustomer'");
    return rows.map((r) => ({ erpId: String(r.CardCode), code: String(r.CardCode), name: String(r.CardName), gstin: r.FederalTaxID && String(r.FederalTaxID).length === 15 ? String(r.FederalTaxID) : null, email: r.EmailAddress || null, phone: r.Cellular || r.Phone1 || null,
      address: r.Address || null, city: r.City || null, state: r.BillToState || null, pincode: r.ZipCode || null, active: r.Valid !== 'tNO' }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const rows = await getAll(cfg, 'Warehouses?$select=WarehouseCode,WarehouseName,Street,City,State,ZipCode');
    return rows.map((r) => ({ code: String(r.WarehouseCode), name: String(r.WarehouseName ?? r.WarehouseCode), address: r.Street || null, city: r.City || null, state: r.State || null, pincode: r.ZipCode || null }));
  },
  async invoicesFor(cfg, ref) {
    const rows = await getAll(cfg, `Invoices?$select=DocNum,DocDate,DocTotal,DocumentStatus&$filter=${encodeURIComponent(`NumAtCard eq '${ref.poNumber.replace(/'/g, "''")}'`)}`);
    return rows.map((r) => ({ number: String(r.DocNum), date: isoDate(r.DocDate), status: r.DocumentStatus === 'bost_Close' ? 'Closed' : 'Open', amount: num(r.DocTotal), irn: null, ewayBill: null }));
  },
};
