/**
 * Microsoft Dynamics 365 Finance & Supply Chain Management — OData data entities, Entra ID client credentials.
 * Config: ENV_URL (https://<env>.operations.dynamics.com), TENANT, CLIENT_ID, CLIENT_SECRET, LEGAL_ENTITY (dataAreaId),
 *         optional entity names: ONHAND_ENTITY, SO_HEADER_ENTITY, SO_LINE_ENTITY, INVOICE_ENTITY.
 * VERIFY on the customer's environment: entity names and field names vary by version / customisation —
 * defaults below are the common public entities, and every name can be overridden in config.
 */
import { entraToken, json, num, isoDate, trimSlash } from '../http.js';
import type { Adapter, Cfg } from '../types.js';

const E = (cfg: Cfg) => ({
  onhand: cfg.ONHAND_ENTITY || 'WarehousesOnHandV2', head: cfg.SO_HEADER_ENTITY || 'SalesOrderHeadersV2',
  line: cfg.SO_LINE_ENTITY || 'SalesOrderLines', invoice: cfg.INVOICE_ENTITY || 'SalesInvoiceHeadersV2',
});
const data = (cfg: Cfg) => `${trimSlash(cfg.ENV_URL)}/data`;
const auth = async (cfg: Cfg) => ({ Authorization: `Bearer ${await entraToken(cfg.TENANT, cfg.CLIENT_ID, cfg.CLIENT_SECRET, `${trimSlash(cfg.ENV_URL)}/.default`)}` });
const getAll = async (cfg: Cfg, first: string) => {
  const out: Record<string, any>[] = [];
  let next: string | null = first;
  for (let i = 0; next && i < 500; i += 1) {
    const r: { value: Record<string, any>[]; '@odata.nextLink'?: string } = await json(next, { headers: await auth(cfg) });
    out.push(...r.value); next = r['@odata.nextLink'] ?? null;
  }
  return out;
};
const pick = (r: Record<string, any>, ...k: string[]) => k.map((x) => r[x]).find((v) => v !== undefined && v !== null && v !== '');
const le = (cfg: Cfg) => `dataAreaId eq '${cfg.LEGAL_ENTITY}'`;

export const d365fo: Adapter = {
  id: 'd365-fo',
  required: ['ENV_URL', 'TENANT', 'CLIENT_ID', 'CLIENT_SECRET', 'LEGAL_ENTITY'],
  async test(cfg) {
    const r = await json<{ value: Record<string, any>[] }>(`${data(cfg)}/${E(cfg).onhand}?$top=5&cross-company=true&$filter=${encodeURIComponent(le(cfg))}`, { headers: await auth(cfg) });
    return { ok: true, message: `Connected to ${cfg.ENV_URL} (${cfg.LEGAL_ENTITY}) — on-hand entity answered.`, details: { sample: r.value.length, entity: E(cfg).onhand } };
  },
  async stock(cfg, opts) {
    const rows = await getAll(cfg, `${data(cfg)}/${E(cfg).onhand}?cross-company=true&$filter=${encodeURIComponent(le(cfg))}`);
    return rows.map((r) => {
      const site = String(pick(r, 'InventorySiteId', 'SiteId') ?? '');
      const wh = String(pick(r, 'InventoryWarehouseId', 'WarehouseId') ?? '');
      return { location: site ? `${site} / ${wh}` : wh, itemCode: String(pick(r, 'ItemNumber', 'ItemId') ?? ''), batch: String(pick(r, 'ItemBatchNumber', 'BatchNumber', 'InventBatchId') ?? ''),
        serial: (pick(r, 'ItemSerialNumber', 'SerialNumber') as string) ?? null, mfgDate: isoDate(pick(r, 'ManufacturingDate')), expiryDate: isoDate(pick(r, 'BatchExpirationDate', 'ExpirationDate')),
        qty: num(pick(r, 'AvailableOnHandQuantity', 'OnHandQuantity', 'PhysicalInventory')), unitCost: null, status: 'Available' as const };
    }).filter((s) => s.qty !== 0 && (!opts.locations?.length || opts.locations.includes(s.location)));
  },
  async createSalesOrder(cfg, so) {
    const h = { ...(await auth(cfg)), 'Content-Type': 'application/json' };
    const [site, wh] = (so.location ?? '').split(' / ');
    const head = await json<Record<string, any>>(`${data(cfg)}/${E(cfg).head}`, { method: 'POST', headers: h, body: JSON.stringify({
      dataAreaId: cfg.LEGAL_ENTITY, OrderingCustomerAccountNumber: so.customerCode, CustomersOrderReference: so.poNumber, RequestedShippingDate: `${so.requiredBy}T12:00:00Z`,
      ...(site ? { DefaultShippingSiteId: site } : {}), ...(wh ? { DefaultShippingWarehouseId: wh } : {}),
    }) });
    const no = String(head.SalesOrderNumber);
    for (const l of so.lines) await json(`${data(cfg)}/${E(cfg).line}`, { method: 'POST', headers: h, body: JSON.stringify({ dataAreaId: cfg.LEGAL_ENTITY, SalesOrderNumber: no, ItemNumber: l.itemCode, OrderedSalesQuantity: l.qty, ...(l.unitPrice !== null ? { SalesPrice: l.unitPrice } : {}) }) });
    return { erpId: no, erpNumber: no };
  },
  async invoicesFor(cfg, ref) {
    const rows = await getAll(cfg, `${data(cfg)}/${E(cfg).invoice}?cross-company=true&$filter=${encodeURIComponent(`${le(cfg)} and SalesOrderNumber eq '${ref.erpNumber}'`)}`);
    return rows.map((r) => ({ number: String(pick(r, 'InvoiceNumber')), date: isoDate(pick(r, 'InvoiceDate')), status: 'Posted', amount: num(pick(r, 'TotalInvoiceAmount', 'InvoiceAmount')), irn: null, ewayBill: null }));
  },
};
