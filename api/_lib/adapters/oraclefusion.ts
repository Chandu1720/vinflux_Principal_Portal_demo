/**
 * Oracle Fusion Cloud SCM — REST APIs (fscmRestApi), integration user (basic auth or OAuth bearer).
 * Config: BASE_URL (https://<pod>.fa.<region>.oraclecloud.com), USER + PASSWORD or BEARER, BUSINESS_UNIT,
 *         optional: API_VERSION (default 11.13.18.05), ONHAND_RESOURCE (default inventoryOnhandBalances — VERIFY on the pod).
 *   stock      on-hand balances by organisation / subinventory / lot / serial
 *   order      salesOrdersForOrderHub (source system VINFLUX)
 *   invoices   receivablesInvoices filtered by the sales order reference
 */
import { basic, json, num, isoDate, trimSlash } from '../http.js';
import type { Adapter, Cfg } from '../types.js';

const v = (cfg: Cfg) => cfg.API_VERSION || '11.13.18.05';
const res = (cfg: Cfg, name: string) => `${trimSlash(cfg.BASE_URL)}/fscmRestApi/resources/${v(cfg)}/${name}`;
const fin = (cfg: Cfg, name: string) => `${trimSlash(cfg.BASE_URL)}/fscmRestApi/resources/${v(cfg)}/${name}`;
const h = (cfg: Cfg) => ({ Authorization: cfg.BEARER ? `Bearer ${cfg.BEARER}` : basic(cfg.USER, cfg.PASSWORD), 'REST-Framework-Version': '4' });
const getAll = async (cfg: Cfg, url: string) => {
  const out: Record<string, any>[] = [];
  for (let offset = 0; offset < 200000; offset += 500) {
    const r = await json<{ items: Record<string, any>[]; hasMore: boolean }>(`${url}${url.includes('?') ? '&' : '?'}limit=500&offset=${offset}&onlyData=true`, { headers: h(cfg) });
    out.push(...r.items);
    if (!r.hasMore) break;
  }
  return out;
};
const pick = (r: Record<string, any>, ...k: string[]) => k.map((x) => r[x]).find((x) => x !== undefined && x !== null && x !== '');

export const oracleFusion: Adapter = {
  id: 'oracle-fusion',
  required: ['BASE_URL'],
  async test(cfg) {
    const r = await json<{ items: Record<string, any>[] }>(`${res(cfg, 'inventoryOrganizations')}?limit=25&onlyData=true`, { headers: h(cfg) });
    return { ok: true, message: `Connected to Oracle Fusion at ${new URL(cfg.BASE_URL).host}.`, details: { organizations: r.items.map((o) => pick(o, 'OrganizationCode', 'Code')) } };
  },
  async stock(cfg, opts) {
    const rows = await getAll(cfg, res(cfg, cfg.ONHAND_RESOURCE || 'inventoryOnhandBalances'));
    return rows.map((r) => ({
      location: `${pick(r, 'OrganizationCode') ?? ''} / ${pick(r, 'SubinventoryCode', 'Subinventory') ?? ''}`, itemCode: String(pick(r, 'ItemNumber', 'Item') ?? ''),
      batch: String(pick(r, 'LotNumber', 'Lot') ?? ''), serial: (pick(r, 'SerialNumber') as string) ?? null, mfgDate: null, expiryDate: isoDate(pick(r, 'LotExpirationDate', 'ExpirationDate')),
      qty: num(pick(r, 'PrimaryOnhandQuantity', 'OnhandQuantity', 'TransactionQuantity')), unitCost: null, status: 'Available' as const,
    })).filter((s) => s.qty !== 0 && (!opts.locations?.length || opts.locations.includes(s.location)));
  },
  async createSalesOrder(cfg, so) {
    const [org] = (so.location ?? '').split(' / ');
    const r = await json<Record<string, any>>(res(cfg, 'salesOrdersForOrderHub'), { method: 'POST', headers: { ...h(cfg), 'Content-Type': 'application/vnd.oracle.adf.resourceitem+json' }, body: JSON.stringify({
      SourceTransactionNumber: so.vinfluxRef, SourceTransactionSystem: 'VINFLUX', SourceTransactionId: so.vinfluxRef, BusinessUnitName: cfg.BUSINESS_UNIT,
      BuyingPartyNumber: so.customerCode, CustomerPONumber: so.poNumber, TransactionalCurrencyCode: 'INR', RequestedShipDate: so.requiredBy, SubmittedFlag: true, FreezePriceFlag: false,
      lines: so.lines.map((l, i) => ({ SourceTransactionLineId: String(i + 1), SourceTransactionLineNumber: String(i + 1), SourceScheduleNumber: '1', SourceTransactionScheduleId: String(i + 1),
        ProductNumber: l.itemCode, OrderedQuantity: l.qty, OrderedUOM: 'Each', ...(org ? { RequestedFulfillmentOrganizationCode: org } : {}) })),
    }) });
    return { erpId: String(r.HeaderId ?? r.OrderNumber), erpNumber: String(r.OrderNumber ?? r.SourceTransactionNumber) };
  },
  async invoicesFor(cfg, ref) {
    const rows = await getAll(cfg, `${fin(cfg, 'receivablesInvoices')}?q=${encodeURIComponent(`PurchaseOrder='${ref.poNumber}'`)}`);
    return rows.map((r) => ({ number: String(pick(r, 'TransactionNumber')), date: isoDate(pick(r, 'TransactionDate')), status: String(pick(r, 'TransactionStatus', 'Status') ?? ''), amount: num(pick(r, 'EnteredAmount', 'InvoiceAmount')), irn: null, ewayBill: null }));
  },
};
