import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './fakeErp.js';
import { odoo } from '../../api/_lib/adapters/odoo.js';
import { zoho } from '../../api/_lib/adapters/zoho.js';
import { sap } from '../../api/_lib/adapters/sap.js';
import { d365bc } from '../../api/_lib/adapters/d365bc.js';
import { d365fo } from '../../api/_lib/adapters/d365fo.js';
import { sapB1 } from '../../api/_lib/adapters/sapb1.js';
import { erpnext } from '../../api/_lib/adapters/erpnext.js';
import { netsuite, signatureBase } from '../../api/_lib/adapters/netsuite.js';
import { oracleFusion } from '../../api/_lib/adapters/oraclefusion.js';
import { tally, tallyDate } from '../../api/_lib/adapters/tally.js';
import { handle } from '../../api/_lib/handler.js';
import type { SalesOrderIn } from '../../api/_lib/types.js';

const SO: SalesOrderIn = { vinfluxRef: 'SO-26-1005', poNumber: 'PO-77', poDate: '2026-11-06', requiredBy: '2026-11-10', customerCode: 'C-YASH', location: null, lines: [{ itemCode: 'PAD-10', qty: 20, unitPrice: 3150 }], notes: '' };
const body = (s: { body: string }) => JSON.parse(s.body || '{}');

test('Odoo: login, stock with lots / serials / expiry, sales order, invoices', async () => {
  const f = await start((s) => {
    const p = body(s).params;
    if (p.service === 'common') return { json: { result: p.method === 'version' ? { server_version: '17.0' } : (p.args[2] === 'k' ? 7 : false) } };
    const [, , , model, method] = p.args;
    const R: Record<string, unknown> = {
      'stock.location.search_read': [{ complete_name: 'WH/Stock' }],
      'stock.quant.search_read': [{ product_id: [10, '[PAD-10] Pad'], location_id: [8, 'WH/Stock'], lot_id: [55, 'L1'], quantity: 12 }, { product_id: [11, '[TRAY-1] Tray'], location_id: [8, 'WH/Stock'], lot_id: [56, 'SN-1'], quantity: 1 }],
      'product.product.read': [{ id: 10, default_code: 'PAD-10', barcode: false, standard_price: 120, tracking: 'lot' }, { id: 11, default_code: 'TRAY-1', barcode: false, standard_price: 9000, tracking: 'serial' }],
      'stock.lot.read': [{ id: 55, name: 'L1', expiration_date: '2028-01-31 00:00:00' }, { id: 56, name: 'SN-1', expiration_date: false }],
      'res.partner.search_read': [{ id: 3 }], 'product.product.search_read': [{ id: 10, default_code: 'PAD-10', barcode: false }],
      'sale.order.create': 99, 'sale.order.action_confirm': true, 'sale.order.read': [{ name: 'S00099' }],
      'account.move.search_read': [{ name: 'INV/2026/00001', invoice_date: '2026-11-06', state: 'posted', amount_total: 1416 }],
    };
    return { json: { result: R[`${model}.${method}`] } };
  });
  const cfg = { URL: f.url, DB: 'demo', LOGIN: 'api@x', API_KEY: 'k' };
  assert.match((await odoo.test(cfg)).message, /Odoo 17\.0/);
  const st = await odoo.stock(cfg, {});
  assert.deepEqual(st[0], { location: 'WH/Stock', itemCode: 'PAD-10', batch: 'L1', serial: null, mfgDate: null, expiryDate: '2028-01-31', qty: 12, unitCost: 120, status: 'Available' });
  assert.equal(st[1].serial, 'SN-1');
  const so = await odoo.createSalesOrder(cfg, SO);
  assert.deepEqual(so, { erpId: '99', erpNumber: 'S00099' });
  const create = f.seen.map(body).find((b) => b.params?.args?.[4] === 'create');
  assert.equal(create.params.args[5][0].client_order_ref, 'PO-77');
  assert.equal(create.params.args[5][0].order_line[0][2].product_uom_qty, 20);
  assert.equal((await odoo.invoicesFor(cfg, { erpId: '99', erpNumber: 'S00099', poNumber: 'PO-77' }))[0].number, 'INV/2026/00001');
  await assert.rejects(odoo.test({ ...cfg, API_KEY: 'bad', LOGIN: 'other' }), /rejected the login/);
  await f.close();
});

test('Zoho Inventory: OAuth refresh, warehouse + batch stock, sales order, invoices', async () => {
  const f = await start((s) => {
    if (s.path.startsWith('/oauth/v2/token')) return { json: { access_token: 'AT', expires_in: 3600 } };
    assert.equal(s.headers.authorization, 'Zoho-oauthtoken AT');
    assert.match(s.path, /organization_id=ORG1/);
    if (s.path.startsWith('/items?page')) return { json: { code: 0, items: [{ item_id: '1', item_type: 'inventory' }], page_context: { has_more_page: false } } };
    if (s.path.startsWith('/items/1/batches')) return { json: { code: 0, batches: [{ batch_number: 'B9', warehouse_id: 'W1', expiry_date: '2028-03-01', balance_quantity: 30 }] } };
    if (s.path.startsWith('/items/1')) return { json: { code: 0, item: { sku: 'PAD-10', purchase_rate: 110, track_batch_number: true, warehouses: [{ warehouse_id: 'W1', warehouse_name: 'Hyderabad Warehouse', warehouse_stock_on_hand: 30 }] } } };
    if (s.path.startsWith('/contacts')) return { json: { code: 0, contacts: [{ contact_id: '777' }] } };
    if (s.path.startsWith('/items?sku')) return { json: { code: 0, items: [{ item_id: '1' }] } };
    if (s.path.startsWith('/salesorders?')) return { json: { code: 0, salesorder: { salesorder_id: '55', salesorder_number: 'SO-00055' } } };
    if (s.path.startsWith('/salesorders/55/status')) return { json: { code: 0 } };
    if (s.path.startsWith('/salesorders/55')) return { json: { code: 0, salesorder: { invoices: [{ invoice_number: 'INV-000012', date: '2026-11-07', status: 'sent', total: 63000 }] } } };
    return { status: 404, json: { code: 5, message: 'nope' } };
  });
  process.env.VFX_ZOHO_API_BASE = f.url; process.env.VFX_ZOHO_ACCOUNTS_BASE = f.url;
  const cfg = { CLIENT_ID: 'c', CLIENT_SECRET: 's', REFRESH_TOKEN: 'r', ORG_ID: 'ORG1' };
  const st = await zoho.stock(cfg, {});
  assert.deepEqual(st, [{ location: 'Hyderabad Warehouse', itemCode: 'PAD-10', batch: 'B9', serial: null, mfgDate: null, expiryDate: '2028-03-01', qty: 30, unitCost: 110, status: 'Available' }]);
  assert.deepEqual(await zoho.createSalesOrder(cfg, SO), { erpId: '55', erpNumber: 'SO-00055' });
  const post = f.seen.find((s) => s.method === 'POST' && s.path.startsWith('/salesorders?'))!;
  assert.equal(body(post).reference_number, 'PO-77');
  assert.equal((await zoho.invoicesFor(cfg, { erpId: '55', erpNumber: 'SO-00055', poNumber: 'PO-77' }))[0].number, 'INV-000012');
  await f.close();
});

test('Zoho Inventory: newer orgs — stock by locations, item-level fallback', async () => {
  const f = await start((s) => {
    if (s.path.startsWith('/oauth/v2/token')) return { json: { access_token: 'AT2', expires_in: 3600 } };
    if (s.path.startsWith('/items?page') || s.path.startsWith('/items?per_page')) return { json: { code: 0, items: [{ item_id: '7', item_type: 'inventory' }, { item_id: '8', item_type: 'inventory' }], page_context: { has_more_page: false } } };
    if (s.path.startsWith('/items/7')) return { json: { code: 0, item: { sku: 'GLOVE-M', purchase_rate: 5, locations: [{ location_id: 'L1', location_name: 'Head Office', location_stock_on_hand: 120 }, { location_id: 'L2', location_name: 'Hyd Store', location_stock_on_hand: 0 }] } } };
    if (s.path.startsWith('/items/8')) return { json: { code: 0, item: { sku: 'MASK', stock_on_hand: 40 } } };
    if (s.path.startsWith('/locations')) return { json: { code: 0, locations: [{ location_name: 'Head Office' }, { location_name: 'Hyd Store' }] } };
    return { status: 404, json: { code: 5, message: 'nope' } };
  });
  process.env.VFX_ZOHO_API_BASE = f.url; process.env.VFX_ZOHO_ACCOUNTS_BASE = f.url;
  const cfg = { CLIENT_ID: 'c2', CLIENT_SECRET: 's', REFRESH_TOKEN: 'r', ORG_ID: 'ORG2' };
  assert.deepEqual((await zoho.test(cfg)).details?.locations, ['Head Office', 'Hyd Store']);
  assert.deepEqual((await zoho.stock(cfg, {})).map((x) => `${x.location}:${x.itemCode}:${x.qty}`), ['Head Office:GLOVE-M:120', 'Default:MASK:40']);
  await f.close();
});

test('SAP S/4HANA: paged stock, stock types, batch dates, CSRF sales order, billing documents', async () => {
  const f = await start((s) => {
    if (s.path.includes('A_MatlStkInAcctMod') && !s.path.includes('skiptoken')) return { json: { d: { results: [{ Material: '000000000000001234', Plant: 'WH01', StorageLocation: '0101', Batch: 'L26A', InventoryStockType: '01', InventorySpecialStockType: '', MatlWrhsStkQtyInMatlBaseUnit: '40.000' }], __next: `${f.url}/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?$skiptoken=1` } } };
    if (s.path.includes('skiptoken')) return { json: { d: { results: [{ Material: 'TRAY-1', Plant: 'WH01', StorageLocation: '0102', Batch: '', InventoryStockType: '02', InventorySpecialStockType: '', MatlWrhsStkQtyInMatlBaseUnit: '3' }] } } };
    if (s.path.includes('API_BATCH_SRV')) return { json: { d: { results: [{ Material: '000000000000001234', Batch: 'L26A', ShelfLifeExpirationDate: '/Date(1830211200000)/', ManufactureDate: '/Date(1767225600000)/' }] } } };
    if (s.method === 'GET' && s.path.startsWith('/API_SALES_ORDER_SRV/')) return { headers: { 'x-csrf-token': 'TOK', 'set-cookie': 'SAP_SESSIONID=abc; path=/' }, json: {} };
    if (s.method === 'POST' && s.path.includes('A_SalesOrder')) {
      if (s.headers['x-csrf-token'] !== 'TOK' || !String(s.headers.cookie).includes('SAP_SESSIONID=abc')) return { status: 403, json: { error: 'CSRF token validation failed' } };
      return { status: 201, json: { d: { SalesOrder: '10001234' } } };
    }
    if (s.path.includes('A_BillingDocumentItem')) return { json: { d: { results: [{ BillingDocument: '90005678' }] } } };
    if (s.path.includes("A_BillingDocument('90005678')")) return { json: { d: { BillingDocumentDate: '/Date(1793923200000)/', TotalNetAmount: '1000.00', TotalTaxAmount: '180.00', OverallBillingStatus: 'C' } } };
    return { status: 404, json: {} };
  });
  const cfg = { BASE_URL: f.url, USER: 'COMM_USER', PASSWORD: 'p', CLIENT: '100', SALES_ORG: '1710', DIST_CHANNEL: '10', DIVISION: '00' };
  const st = await sap.stock(cfg, { locations: ['WH01'] });
  assert.equal(st.length, 2);
  assert.deepEqual(st[0], { location: 'WH01', itemCode: '1234', batch: 'L26A', serial: null, mfgDate: '2026-01-01', expiryDate: '2027-12-31', qty: 40, unitCost: null, status: 'Available' });
  assert.equal(st[1].status, 'Quarantine');
  assert.match(f.seen[0].path, /sap-client=100/);
  assert.match(f.seen[0].headers.authorization, /^Basic /);
  assert.deepEqual(await sap.createSalesOrder(cfg, SO), { erpId: '10001234', erpNumber: '10001234' });
  const post = body(f.seen.find((s) => s.method === 'POST')!);
  assert.equal(post.PurchaseOrderByCustomer, 'PO-77');
  assert.equal(post.to_Item.results[0].RequestedQuantity, '20');
  const inv = await sap.invoicesFor(cfg, { erpId: '10001234', erpNumber: '10001234', poNumber: 'PO-77' });
  assert.deepEqual(inv[0], { number: '90005678', date: '2026-11-06', status: 'C', amount: 1180, irn: null, ewayBill: null });
  await assert.rejects(sap.createSalesOrder({ BASE_URL: f.url, API_KEY: 'x' }, SO), /read-only/);
  await f.close();
});

test('Business Central: Entra token, custom stock API, sales order + lines, invoices', async () => {
  const f = await start((s) => {
    if (s.path.endsWith('/oauth2/v2.0/token')) { assert.match(s.body, /client_credentials/); return { json: { access_token: 'BCT', expires_in: 3600 } }; }
    assert.equal(s.headers.authorization, 'Bearer BCT');
    if (s.path.includes('/api/vinflux/stock/v1.0/')) return { json: { value: [{ itemNo: '1000', locationCode: 'MAIN', lotNo: 'LOT1', serialNo: '', expirationDate: '2028-05-01', remainingQuantity: 15 }] } };
    if (s.path.includes('salesOrderLines')) return { status: 201, json: { id: 'L1' } };
    if (s.method === 'POST' && s.path.endsWith('/salesOrders')) return { status: 201, json: { id: 'G1', number: 'S-ORD101005' } };
    if (s.path.includes('salesInvoices')) return { json: { value: [{ number: 'PS-INV103002', invoiceDate: '2026-11-07', status: 'Open', totalAmountIncludingTax: 5000 }] } };
    return { status: 404, json: {} };
  });
  process.env.VFX_ENTRA_AUTHORITY = f.url; process.env.VFX_BC_API_BASE = f.url;
  const cfg = { TENANT: 't1', ENVIRONMENT: 'Production', COMPANY_ID: 'c1', CLIENT_ID: 'a', CLIENT_SECRET: 'b', STOCK_API: 'vinflux/stock/v1.0' };
  assert.deepEqual(await d365bc.stock(cfg, {}), [{ location: 'MAIN', itemCode: '1000', batch: 'LOT1', serial: null, mfgDate: null, expiryDate: '2028-05-01', qty: 15, unitCost: null, status: 'Available' }]);
  assert.deepEqual(await d365bc.createSalesOrder(cfg, SO), { erpId: 'G1', erpNumber: 'S-ORD101005' });
  assert.equal(body(f.seen.find((s) => s.path.includes('salesOrderLines'))!).lineObjectNumber, 'PAD-10');
  assert.equal((await d365bc.invoicesFor(cfg, { erpId: 'G1', erpNumber: 'S-ORD101005', poNumber: 'PO-77' }))[0].amount, 5000);
  await f.close();
});

test('Dynamics 365 F&SCM: on-hand entity with configurable names, order header + lines', async () => {
  const f = await start((s) => {
    if (s.path.endsWith('/oauth2/v2.0/token')) return { json: { access_token: 'FOT', expires_in: 3600 } };
    if (s.path.startsWith('/data/WarehousesOnHandV2')) { assert.match(decodeURIComponent(s.path), /dataAreaId eq 'inmf'/); return { json: { value: [{ ItemNumber: 'PAD-10', InventorySiteId: 'HYD', InventoryWarehouseId: '11', ItemBatchNumber: 'B1', AvailableOnHandQuantity: 9 }] } }; }
    if (s.path.startsWith('/data/SalesOrderHeadersV2')) return { status: 201, json: { SalesOrderNumber: 'SO-000321' } };
    if (s.path.startsWith('/data/SalesOrderLines')) return { status: 201, json: {} };
    return { status: 404, json: {} };
  });
  process.env.VFX_ENTRA_AUTHORITY = f.url;
  const cfg = { ENV_URL: f.url, TENANT: 't', CLIENT_ID: 'a', CLIENT_SECRET: 'b', LEGAL_ENTITY: 'inmf' };
  assert.deepEqual((await d365fo.stock(cfg, {}))[0], { location: 'HYD / 11', itemCode: 'PAD-10', batch: 'B1', serial: null, mfgDate: null, expiryDate: null, qty: 9, unitCost: null, status: 'Available' });
  assert.equal((await d365fo.createSalesOrder(cfg, SO)).erpNumber, 'SO-000321');
  await f.close();
});

test('SAP Business One: session login, warehouse stock with paging, order, invoices', async () => {
  const f = await start((s) => {
    if (s.path === '/b1s/v1/Login') return { headers: { 'set-cookie': 'B1SESSION=xyz; path=/' }, json: { SessionId: 'xyz', SessionTimeout: 30 } };
    assert.match(String(s.headers.cookie), /B1SESSION=xyz/);
    if (s.path.startsWith('/b1s/v1/Items') && !s.path.includes('skip')) return { json: { value: [{ ItemCode: 'PAD-10', AvgStdPrice: 100, ItemWarehouseInfoCollection: [{ WarehouseCode: '01', InStock: 25 }, { WarehouseCode: '02', InStock: 0 }] }], 'odata.nextLink': 'Items?$skip=500' } };
    if (s.path.includes('skip')) return { json: { value: [{ ItemCode: 'TRAY-1', ItemWarehouseInfoCollection: [{ WarehouseCode: '01', InStock: 2 }] }] } };
    if (s.path === '/b1s/v1/Orders') return { status: 201, json: { DocEntry: 81, DocNum: 2081 } };
    if (s.path.startsWith('/b1s/v1/Invoices')) return { json: { value: [{ DocNum: 5081, DocDate: '2026-11-07', DocTotal: 74340, DocumentStatus: 'bost_Open' }] } };
    return { status: 404, json: {} };
  });
  const cfg = { BASE_URL: `${f.url}/b1s/v1`, COMPANY_DB: 'SBODEMOIN', USER: 'manager', PASSWORD: 'p' };
  const st = await sapB1.stock(cfg, {});
  assert.deepEqual(st.map((x) => `${x.location}:${x.itemCode}:${x.qty}`), ['01:PAD-10:25', '01:TRAY-1:2']);
  assert.deepEqual(await sapB1.createSalesOrder(cfg, SO), { erpId: '81', erpNumber: '2081' });
  assert.equal(body(f.seen.find((s) => s.path === '/b1s/v1/Orders')!).NumAtCard, 'PO-77');
  assert.equal((await sapB1.invoicesFor(cfg, { erpId: '81', erpNumber: '2081', poNumber: 'PO-77' }))[0].number, '5081');
  await f.close();
});

test('ERPNext: bins split into batches and serials, submitted sales order, invoices with IRN', async () => {
  const f = await start((s) => {
    assert.equal(s.headers.authorization, 'token k:sec');
    const p = decodeURIComponent(s.path);
    if (p.startsWith('/api/resource/Item?')) return { json: { data: [{ item_code: 'PAD-10', has_batch_no: 1, has_serial_no: 0, valuation_rate: 99 }, { item_code: 'TRAY-1', has_batch_no: 0, has_serial_no: 1, valuation_rate: 9000 }] } };
    if (p.startsWith('/api/resource/Bin?')) return { json: { data: [{ item_code: 'PAD-10', warehouse: 'Stores - BMS', actual_qty: 30 }, { item_code: 'TRAY-1', warehouse: 'Stores - BMS', actual_qty: 2 }] } };
    if (p.startsWith('/api/resource/Serial No?')) return { json: { data: [{ name: 'SN1', item_code: 'TRAY-1', warehouse: 'Stores - BMS', batch_no: null }, { name: 'SN2', item_code: 'TRAY-1', warehouse: 'Stores - BMS', batch_no: null }] } };
    if (p.startsWith('/api/resource/Batch?')) return { json: { data: [{ name: 'B-1', expiry_date: '2028-02-29', manufacturing_date: '2026-03-01' }] } };
    if (p.startsWith('/api/method/erpnext.stock.doctype.batch.batch.get_batch_qty')) return { json: { message: [{ batch_no: 'B-1', qty: 30 }] } };
    if (s.method === 'POST' && p.startsWith('/api/resource/Sales Order')) return { json: { data: { name: 'SAL-ORD-2026-00031' } } };
    if (p.startsWith('/api/resource/Sales Invoice?')) return { json: { data: [{ name: 'ACC-SINV-2026-00012', posting_date: '2026-11-07', status: 'Unpaid', grand_total: 70000, irn: 'abc123', ewaybill: '331000111222' }] } };
    return { status: 404, json: {} };
  });
  const cfg = { URL: f.url, API_KEY: 'k', API_SECRET: 'sec' };
  const st = await erpnext.stock(cfg, {});
  assert.deepEqual(st.map((x) => `${x.itemCode}:${x.batch}:${x.serial}:${x.qty}:${x.expiryDate}`), ['PAD-10:B-1:null:30:2028-02-29', 'TRAY-1::SN1:1:null', 'TRAY-1::SN2:1:null']);
  assert.equal((await erpnext.createSalesOrder(cfg, SO)).erpNumber, 'SAL-ORD-2026-00031');
  assert.equal(body(f.seen.find((s) => s.method === 'POST')!).docstatus, 1);
  const inv = await erpnext.invoicesFor(cfg, { erpId: 'x', erpNumber: 'SAL-ORD-2026-00031', poNumber: 'PO-77' });
  assert.equal(inv[0].irn, 'abc123'); assert.equal(inv[0].ewayBill, '331000111222');
  await f.close();
});

test('NetSuite: TBA header, SuiteQL paging, base string ordering', async () => {
  const f = await start((s) => {
    assert.match(s.headers.authorization, /^OAuth realm="TSTDRV1", oauth_consumer_key="ck", oauth_token="tid", oauth_signature_method="HMAC-SHA256"/);
    const q = body(s).q as string;
    if (q?.includes('InventoryBalance')) return { json: { items: [{ location: 'Hyderabad DC', itemcode: 'PAD-10', invnumber: 'L7', expiry: '2028-06-30', isserial: 'F', qty: '14', cost: '101' }], hasMore: false } };
    if (q?.includes('FROM location')) return { json: { items: [{ id: '1', name: 'Hyderabad DC' }], hasMore: false } };
    return { json: { items: [], hasMore: false } };
  });
  process.env.VFX_NETSUITE_BASE = f.url;
  const cfg = { ACCOUNT_ID: 'tstdrv1', CONSUMER_KEY: 'ck', CONSUMER_SECRET: 'cs', TOKEN_ID: 'tid', TOKEN_SECRET: 'ts' };
  assert.deepEqual(await netsuite.stock(cfg, {}), [{ location: 'Hyderabad DC', itemCode: 'PAD-10', batch: 'L7', serial: null, mfgDate: null, expiryDate: '2028-06-30', qty: 14, unitCost: 101, status: 'Available' }]);
  assert.equal(f.seen[0].headers.prefer, 'transient');
  const b = signatureBase('post', 'https://Acct.Example.com/q?limit=10&a=b c', [['oauth_nonce', 'n'], ['oauth_consumer_key', 'k']]);
  assert.equal(b, 'POST&https%3A%2F%2Facct.example.com%2Fq&a%3Db%2520c%26limit%3D10%26oauth_consumer_key%3Dk%26oauth_nonce%3Dn');
  await f.close();
});

test('Oracle Fusion: paged on-hand balances, Order Hub payload', async () => {
  const f = await start((s) => {
    if (s.path.includes('/inventoryOnhandBalances')) return { json: { items: s.path.includes('offset=0') ? [{ OrganizationCode: 'M1', SubinventoryCode: 'FGI', ItemNumber: 'PAD-10', LotNumber: 'LT1', LotExpirationDate: '2028-09-30', PrimaryOnhandQuantity: 8 }] : [], hasMore: s.path.includes('offset=0') } };
    if (s.path.includes('/salesOrdersForOrderHub')) return { status: 201, json: { HeaderId: 3001, OrderNumber: '300125' } };
    return { status: 404, json: {} };
  });
  const cfg = { BASE_URL: f.url, USER: 'u', PASSWORD: 'p', BUSINESS_UNIT: 'Vision Operations' };
  assert.deepEqual(await oracleFusion.stock(cfg, {}), [{ location: 'M1 / FGI', itemCode: 'PAD-10', batch: 'LT1', serial: null, mfgDate: null, expiryDate: '2028-09-30', qty: 8, unitCost: null, status: 'Available' }]);
  assert.equal((await oracleFusion.createSalesOrder(cfg, SO)).erpNumber, '300125');
  assert.equal(body(f.seen.find((s) => s.method === 'POST')!).SourceTransactionSystem, 'VINFLUX');
  await f.close();
});

test('Tally: XML stock export with batches, sales order import, errors surfaced', async () => {
  const f = await start((s) => {
    if (s.body.includes('<ID>VFXItems</ID>')) return { text: '<ENVELOPE><COLLECTION><STOCKITEM NAME="Pad 10x10"><PARTNO>PAD-10</PARTNO><CLOSINGBALANCE> 45 Nos</CLOSINGBALANCE><CLOSINGRATE>120.00/Nos</CLOSINGRATE><ISBATCHWISEON>Yes</ISBATCHWISEON></STOCKITEM></COLLECTION></ENVELOPE>' };
    if (s.body.includes('<ID>VFXBatches</ID>')) return { text: '<ENVELOPE><COLLECTION><BATCH NAME="T26A"><GODOWNNAME>Bommasandra Godown</GODOWNNAME><CLOSINGBALANCE>40 Nos</CLOSINGBALANCE><EXPIRYPERIOD>31-Dec-2028</EXPIRYPERIOD><MFDON>20260801</MFDON></BATCH><BATCH NAME="Primary Batch"><GODOWNNAME>Andheri Godown</GODOWNNAME><CLOSINGBALANCE>5 Nos</CLOSINGBALANCE></BATCH></COLLECTION></ENVELOPE>' };
    if (s.body.includes('VCHTYPE="Sales Order"')) return { text: s.body.includes('BAD') ? '<RESPONSE><LINEERROR>Ledger \'BAD\' does not exist!</LINEERROR></RESPONSE>' : '<RESPONSE><CREATED>1</CREATED><LASTVCHID>412</LASTVCHID></RESPONSE>' };
    return { text: '<ENVELOPE/>' };
  });
  const cfg = { URL: f.url, COMPANY: 'Biorad Medisys Pvt Ltd' };
  const st = await tally.stock(cfg, {});
  assert.deepEqual(st.map((x) => `${x.location}|${x.itemCode}|${x.batch}|${x.qty}|${x.expiryDate}|${x.mfgDate}`), ['Bommasandra Godown|PAD-10|T26A|40|2028-12-31|2026-08-01', 'Andheri Godown|PAD-10||5|null|null']);
  assert.match(f.seen[0].body, /<SVCURRENTCOMPANY>Biorad Medisys Pvt Ltd<\/SVCURRENTCOMPANY>/);
  assert.deepEqual(await tally.createSalesOrder(cfg, SO), { erpId: '412', erpNumber: 'VFX-SO-26-1005' });
  await assert.rejects(tally.createSalesOrder(cfg, { ...SO, customerCode: 'BAD' }), /does not exist/);
  assert.equal(tallyDate('20261106'), '2026-11-06');
  await f.close();
});

test('Handler: access key, missing config, on-premise refusal in the cloud, status hides secrets', async () => {
  const env = { VFX_API_KEY: 'secret-key', VFX_ODOO_URL: 'http://127.0.0.1:1', VFX_ODOO_DB: 'd', VFX_ODOO_LOGIN: 'l', VFX_ODOO_API_KEY: 'TOPSECRET' };
  const st = await (await handle(new Request('http://x/api/erp?op=status'), { env, host: 'cloud' })).json() as any;
  assert.equal(st.connectors.find((c: any) => c.id === 'odoo').configured, true);
  assert.equal(st.connectors.find((c: any) => c.id === 'zoho').missing.includes('ORG_ID'), true);
  assert.ok(!JSON.stringify(st).includes('TOPSECRET'));
  const call = (b: unknown, key = 'secret-key') => handle(new Request('http://x/api/erp', { method: 'POST', headers: { 'x-vinflux-key': key }, body: JSON.stringify(b) }), { env, host: 'cloud' });
  assert.equal((await call({ connector: 'odoo', op: 'test' }, 'wrong')).status, 401);
  assert.equal((await call({ connector: 'zoho', op: 'test' })).status, 412);
  assert.equal((await call({ connector: 'tally', op: 'stock' })).status, 409);
  const unreachable = await call({ connector: 'odoo', op: 'test' });
  assert.equal(unreachable.status, 502);
  assert.match(((await unreachable.json()) as any).error, /Can't reach 127\.0\.0\.1:1/);
});

test('Master data: Zoho items / contacts / locations, Odoo products / customers, unsupported ERP answers 501', async () => {
  const f = await start((s) => {
    if (s.path.startsWith('/oauth/v2/token')) return { json: { access_token: 'AT3', expires_in: 3600 } };
    if (s.path.startsWith('/items?page')) return { json: { code: 0, items: [{ item_id: '7', item_type: 'inventory', sku: 'AVA-15', name: 'Ava 15' }], page_context: { has_more_page: false } } };
    if (s.path.startsWith('/items/7')) return { json: { code: 0, item: { sku: 'AVA-15', name: 'Ava 15', hsn_or_sac: '90189099', unit: 'pcs', rate: 300, purchase_rate: 200, upc: '8901234567897', track_batch_number: true, status: 'active', item_tax_preferences: [{ tax_specification: 'intra', tax_percentage: 12 }] } } };
    if (s.path.startsWith('/contacts?')) return { json: { code: 0, contacts: [{ contact_id: '9001', contact_name: 'Ravi', company_name: 'Sunrise Ortho Clinic', gst_no: '36ABCDE1234F1Z5', email: 'a@b.in', mobile: '9876543210', billing_address: { city: 'Hyderabad', state: 'Telangana', zip: '500001' }, status: 'active' }], page_context: { has_more_page: false } } };
    if (s.path.startsWith('/locations')) return { json: { code: 0, locations: [{ location_name: 'Head Office', address: { city: 'Hyderabad', state: 'Telangana', zip: '500081' } }] } };
    if (s.path === '/jsonrpc') {
      const p = JSON.parse(s.body).params;
      if (p.service === 'common') return { json: { result: 7 } };
      const [, , , model, method] = p.args;
      const R: Record<string, unknown> = {
        'product.product.search_read': [{ id: 10, default_code: 'PAD-10', name: 'Pad', barcode: false, uom_id: [1, 'Units'], list_price: 350, standard_price: 120, tracking: 'lot', active: true, categ_id: [2, 'All / Wound care'], taxes_id: [5], l10n_in_hsn_code: '30059040' }],
        'account.tax.read': [{ id: 5, amount: 12, amount_type: 'percent' }],
        'res.partner.search_read': [{ id: 3, name: 'Yashoda Hospitals', ref: 'C-YASH', vat: '36AAACY1234K1Z9', email: false, phone: '040', city: 'Hyderabad', state_id: [1, 'Telangana (IN)'], zip: '500082', active: true }],
      };
      return { json: { result: R[`${model}.${method}`] } };
    }
    return { status: 404, json: { code: 5, message: 'nope' } };
  });
  process.env.VFX_ZOHO_API_BASE = f.url; process.env.VFX_ZOHO_ACCOUNTS_BASE = f.url;
  const z = { CLIENT_ID: 'c3', CLIENT_SECRET: 's', REFRESH_TOKEN: 'r', ORG_ID: 'ORG3' };
  assert.deepEqual(await zoho.products!(z), [{ erpId: '7', itemCode: 'AVA-15', name: 'Ava 15', description: '', barcode: '8901234567897', hsn: '90189099', gstRate: 12, uom: 'pcs', salesRate: 300, cost: 200, brand: null, category: null, tracking: 'Batch', active: true }]);
  const c = (await zoho.customers!(z))[0];
  assert.equal(c.gstin, '36ABCDE1234F1Z5'); assert.equal(c.city, 'Hyderabad'); assert.equal(c.code, '9001');
  assert.deepEqual((await zoho.locations!(z))[0], { code: 'Head Office', name: 'Head Office', address: null, city: 'Hyderabad', state: 'Telangana', pincode: '500081' });
  const o = { URL: f.url, DB: 'd', LOGIN: 'l', API_KEY: 'k' };
  const op = (await odoo.products!(o))[0];
  assert.equal(op.hsn, '30059040'); assert.equal(op.gstRate, 12); assert.equal(op.tracking, 'Batch'); assert.equal(op.category, 'All / Wound care');
  const oc = (await odoo.customers!(o))[0];
  assert.equal(oc.code, 'C-YASH'); assert.equal(oc.state, 'Telangana');
  const env = { VFX_API_KEY: 'k1', VFX_ORACLE_FUSION_BASE_URL: 'http://x' };
  const r = await handle(new Request('http://x/api/erp', { method: 'POST', headers: { 'x-vinflux-key': 'k1' }, body: JSON.stringify({ connector: 'oracle-fusion', op: 'products' }) }), { env, host: 'cloud' });
  assert.equal(r.status, 501);
  await f.close();
});
