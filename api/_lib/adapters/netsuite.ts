/**
 * Oracle NetSuite — SuiteTalk REST web services + SuiteQL, Token-Based Authentication (OAuth 1.0a, HMAC-SHA256).
 * Config: ACCOUNT_ID (e.g. 1234567 or 1234567_SB1), CONSUMER_KEY, CONSUMER_SECRET, TOKEN_ID, TOKEN_SECRET.
 *   stock      SuiteQL over InventoryBalance (item, location, inventory number = lot / serial)  — VERIFY table / column names on the account
 *   order      record/v1/salesOrder (entity = customer internal id or entityId)
 *   invoices   SuiteQL: invoices created from the sales order (transaction.createdFrom)
 */
import { createHmac, randomBytes } from 'node:crypto';
import { json, num, isoDate, request } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine } from '../types.js';

const host = (cfg: Cfg) => process.env.VFX_NETSUITE_BASE ?? `https://${cfg.ACCOUNT_ID.toLowerCase().replace(/_/g, '-')}.suitetalk.api.netsuite.com`;
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/** OAuth 1.0a header for NetSuite TBA (realm = account id, upper case). */
/** RFC 5849 §3.4.1 signature base string (query parameters + oauth parameters, sorted by encoded name then value). */
export const signatureBase = (method: string, url: string, oauth: [string, string][]) => {
  const u = new URL(url);
  const params: [string, string][] = [...oauth, ...[...u.searchParams.entries()] as [string, string][]];
  const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  const norm = params.map(([k, v]) => [enc(k), enc(v)]).sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1])).map(([k, v]) => `${k}=${v}`).join('&');
  return [method.toUpperCase(), enc(`${u.protocol}//${u.host.toLowerCase()}${u.pathname}`), enc(norm)].join('&');
};
export const oauthHeader = (cfg: Cfg, method: string, url: string, nonce = randomBytes(12).toString('hex'), ts = Math.floor(Date.now() / 1000).toString()) => {
  const baseStr = signatureBase(method, url, [
    ['oauth_consumer_key', cfg.CONSUMER_KEY], ['oauth_nonce', nonce], ['oauth_signature_method', 'HMAC-SHA256'],
    ['oauth_timestamp', ts], ['oauth_token', cfg.TOKEN_ID], ['oauth_version', '1.0'],
  ]);
  const sig = createHmac('sha256', `${enc(cfg.CONSUMER_SECRET)}&${enc(cfg.TOKEN_SECRET)}`).update(baseStr).digest('base64');
  const realm = cfg.ACCOUNT_ID.toUpperCase();
  return `OAuth realm="${realm}", oauth_consumer_key="${enc(cfg.CONSUMER_KEY)}", oauth_token="${enc(cfg.TOKEN_ID)}", oauth_signature_method="HMAC-SHA256", oauth_timestamp="${ts}", oauth_nonce="${nonce}", oauth_version="1.0", oauth_signature="${enc(sig)}"`;
};
const ns = async <T = any>(cfg: Cfg, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
  const url = `${host(cfg)}${path}`;
  return json<T>(url, { method, headers: { Authorization: oauthHeader(cfg, method, url), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
};
const suiteql = async (cfg: Cfg, q: string) => {
  const out: Record<string, any>[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const r = await ns<{ items: Record<string, any>[]; hasMore: boolean }>(cfg, 'POST', `/services/rest/query/v1/suiteql?limit=1000&offset=${offset}`, { q }, { Prefer: 'transient' });
    out.push(...r.items);
    if (!r.hasMore) break;
  }
  return out;
};

export const netsuite: Adapter = {
  id: 'netsuite',
  required: ['ACCOUNT_ID', 'CONSUMER_KEY', 'CONSUMER_SECRET', 'TOKEN_ID', 'TOKEN_SECRET'],
  async test(cfg) {
    const locs = await suiteql(cfg, 'SELECT id, name FROM location WHERE isinactive = \'F\'');
    return { ok: true, message: `Connected to NetSuite account ${cfg.ACCOUNT_ID}.`, details: { locations: locs.map((l) => l.name) } };
  },
  async stock(cfg, opts) {
    const rows = await suiteql(cfg, `SELECT BUILTIN.DF(ib.location) AS location, i.itemid AS itemcode, i.upccode AS upc, i.averagecost AS cost, inv.inventorynumber AS invnumber, inv.expirationdate AS expiry, i.isserialitem AS isserial, ib.quantityonhand AS qty
      FROM InventoryBalance ib JOIN item i ON i.id = ib.item LEFT JOIN inventorynumber inv ON inv.id = ib.inventorynumber WHERE ib.quantityonhand <> 0`);
    return rows.filter((r) => !opts.locations?.length || opts.locations.includes(r.location)).map((r) => {
      const serial = r.isserial === 'T' && r.invnumber ? String(r.invnumber) : null;
      return { location: String(r.location ?? ''), itemCode: String(r.itemcode ?? r.upc ?? ''), batch: serial ? '' : String(r.invnumber ?? ''), serial, mfgDate: null, expiryDate: isoDate(r.expiry), qty: num(r.qty), unitCost: r.cost !== undefined ? num(r.cost) : null, status: 'Available' as const };
    });
  },
  async createSalesOrder(cfg, so) {
    const cust = /^\d+$/.test(so.customerCode) ? so.customerCode : (await suiteql(cfg, `SELECT id FROM customer WHERE entityid = '${so.customerCode.replace(/'/g, "''")}'`))[0]?.id;
    if (!cust) throw new ErpError(`NetSuite: customer “${so.customerCode}” not found.`);
    const codes = so.lines.map((l) => `'${l.itemCode.replace(/'/g, "''")}'`).join(',');
    const items = new Map((await suiteql(cfg, `SELECT id, itemid FROM item WHERE itemid IN (${codes})`)).map((r) => [String(r.itemid), String(r.id)]));
    const missing = so.lines.filter((l) => !items.has(l.itemCode)).map((l) => l.itemCode);
    if (missing.length) throw new ErpError(`NetSuite: items not found: ${missing.join(', ')}`);
    let loc: string | undefined;
    if (so.location) loc = (await suiteql(cfg, `SELECT id FROM location WHERE name = '${so.location.replace(/'/g, "''")}'`))[0]?.id;
    const url = `${host(cfg)}/services/rest/record/v1/salesOrder`;
    const r = await request(url, { method: 'POST', headers: { Authorization: oauthHeader(cfg, 'POST', url), 'Content-Type': 'application/json' }, body: JSON.stringify({
      entity: { id: cust }, otherRefNum: so.poNumber, tranDate: so.poDate, shipDate: so.requiredBy, memo: `VinFlux ${so.vinfluxRef}`, ...(loc ? { location: { id: loc } } : {}),
      item: { items: so.lines.map((l) => ({ item: { id: items.get(l.itemCode) }, quantity: l.qty, ...(l.unitPrice !== null ? { rate: l.unitPrice } : {}) })) },
    }) });
    if (r.status !== 204 && !r.ok) throw new ErpError(`NetSuite refused the sales order (HTTP ${r.status})`, r.status, (await r.text()).slice(0, 500));
    const id = (r.headers.get('location') ?? '').split('/').pop() ?? '';
    const tran = (await suiteql(cfg, `SELECT tranid FROM transaction WHERE id = ${Number(id)}`))[0]?.tranid;
    return { erpId: id, erpNumber: String(tran ?? id) };
  },
  async products(cfg): Promise<ProductLine[]> {
    const rows = await suiteql(cfg, "SELECT id, itemid, displayname, salesdescription, upccode, averagecost, islotitem, isserialitem, isinactive FROM item WHERE itemtype IN ('InvtPart', 'Assembly')");
    return rows.map((r) => {
      const lot = r.islotitem === 'T'; const ser = r.isserialitem === 'T';
      return { erpId: String(r.id), itemCode: String(r.itemid), name: String(r.displayname || r.itemid), description: String(r.salesdescription ?? ''), barcode: r.upccode || null, hsn: null, gstRate: null, uom: null,
        salesRate: null, cost: r.averagecost !== undefined && r.averagecost !== null ? num(r.averagecost) : null, brand: null, category: null, tracking: lot && ser ? 'Batch + Serial' as const : lot ? 'Batch' as const : ser ? 'Serial' as const : 'None' as const, active: r.isinactive !== 'T' };
    });
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const rows = await suiteql(cfg, 'SELECT id, entityid, companyname, email, phone, isinactive FROM customer');
    return rows.map((r) => ({ erpId: String(r.id), code: String(r.entityid), name: String(r.companyname || r.entityid), gstin: null, email: r.email || null, phone: r.phone || null, address: null, city: null, state: null, pincode: null, active: r.isinactive !== 'T' }));
  },
  async locations(cfg): Promise<LocationLine[]> {
    const rows = await suiteql(cfg, "SELECT id, name FROM location WHERE isinactive = 'F'");
    return rows.map((r) => ({ code: String(r.name), name: String(r.name), address: null, city: null, state: null, pincode: null }));
  },
  async invoicesFor(cfg, ref) {
    const rows = await suiteql(cfg, `SELECT t.tranid, t.trandate, BUILTIN.DF(t.status) AS status, t.foreigntotal FROM transaction t WHERE t.type = 'CustInvc' AND t.id IN (SELECT tl.transaction FROM transactionline tl WHERE tl.createdfrom = ${Number(ref.erpId)})`);
    return rows.map((r) => ({ number: String(r.tranid), date: isoDate(r.trandate), status: String(r.status), amount: num(r.foreigntotal), irn: null, ewayBill: null }));
  },
};
