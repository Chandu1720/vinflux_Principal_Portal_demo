/**
 * ERP adapter profiles — how VinFlux talks to each ERP family.
 *
 * Every adapter does the same five jobs, translated into the ERP's own objects:
 *   1. Stock      (ERP → VinFlux)  on-hand by location / batch / serial, first full load then changes
 *   2. Products   (ERP → VinFlux)  item codes matched to Product Master (code, SKU, GTIN or ERP code)
 *   3. Partners   (both)           customer account per partner (GSTIN as the match key)
 *   4. Sales order (VinFlux → ERP) created when an order is confirmed
 *   5. Invoice    (ERP → VinFlux)  tax invoice, IRN, e-way bill back when the ERP bills the order
 * The adapter translates the ERP's response into VinFlux's stock template, so every ERP goes through
 * the same checks, history and undo as a file import.
 */

export type ErpAccess = 'cloud-api' | 'agent' | 'file';
export interface ErpObject { vinflux: string; erp: string; direction: 'ERP → VinFlux' | 'VinFlux → ERP' | 'Both' }
export interface ErpProfile {
  id: string;
  name: string;
  vendor: 'SAP' | 'Oracle' | 'Microsoft' | 'Odoo' | 'Zoho' | 'Tally' | 'Frappe' | 'Marg' | 'Busy';
  /** Who it typically suits. */
  fit: string;
  editions: string;
  access: ErpAccess;
  api: string;
  auth: string;
  /** What the ERP calls a stock location, and what one looks like. */
  locationLabel: string;
  locationHint: string;
  sampleLocations: string[];
  tenantLabel: string;
  endpointHint: string;
  objects: ErpObject[];
  batchSerial: string;
  setup: string[];
  /** Document numbers as the ERP prints them (demo). */
  soNo: (n: number) => string;
  invNo: (n: number) => string;
  status: 'sandbox' | 'planned';
}

const pad = (n: number, w: number) => String(n).padStart(w, '0');
const yr = () => new Date().getFullYear();

export const ERP_PROFILES: ErpProfile[] = [
  {
    id: 'sap', name: 'SAP S/4HANA', vendor: 'SAP', fit: 'Large manufacturers and importers',
    editions: 'S/4HANA Cloud (public / private) and on-premise; SAP ECC via the same APIs on SAP Gateway',
    access: 'cloud-api', api: 'OData APIs (SAP Business Accelerator Hub)', auth: 'Communication arrangement — OAuth 2.0 or technical user (on-premise through SAP Cloud Connector)',
    locationLabel: 'Plant / storage location', locationHint: 'e.g. WH01', sampleLocations: ['WH01', 'WH02', 'WH03'],
    tenantLabel: 'SAP client', endpointHint: 'https://<host>/sap/opu/odata/sap/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'API_MATERIAL_STOCK_SRV (plant, storage location, batch, stock type)', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'API_PRODUCT_SRV (material master)', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'API_BUSINESS_PARTNER (customer role, GSTIN)', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'API_SALES_ORDER_SRV', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'API_BILLING_DOCUMENT_SRV (+ e-invoice IRN from the GST add-on)', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Batch with SLED (shelf-life expiry) per plant; serial numbers from the material serial profile.',
    setup: ['Basis team creates a communication user and arrangement for the APIs above.', 'Share the API host, client and credentials (or Cloud Connector location).', 'Map each plant / storage location to a VinFlux warehouse.', 'Run the first full load; then choose the schedule.'],
    soNo: (n) => `${10000000 + n}`, invNo: (n) => `${90000000 + n}`, status: 'sandbox',
  },
  {
    id: 'sap-b1', name: 'SAP Business One', vendor: 'SAP', fit: 'Mid-size importers and distributors',
    editions: 'SAP Business One (SQL Server or HANA), on-premise or partner-hosted',
    access: 'cloud-api', api: 'Service Layer (REST / OData)', auth: 'Service Layer login — company database, user and password (session)',
    locationLabel: 'Warehouse code', locationHint: 'e.g. 01', sampleLocations: ['01', '02-HYD'],
    tenantLabel: 'Company database', endpointHint: 'https://<server>:50000/b1s/v1/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'Items → ItemWarehouseInfoCollection, BatchNumberDetails, SerialNumberDetails', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'Items', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'BusinessPartners (customers)', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'Orders', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'Invoices', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Batches and serial numbers per warehouse, with expiry on the batch.',
    setup: ['Partner / IT opens the Service Layer to VinFlux (HTTPS, or via the agent if on a private network).', 'Create an API user in the company database.', 'Map warehouse codes to VinFlux warehouses.'],
    soNo: (n) => `${2000 + n}`, invNo: (n) => `${5000 + n}`, status: 'sandbox',
  },
  {
    id: 'oracle-fusion', name: 'Oracle Fusion Cloud SCM', vendor: 'Oracle', fit: 'Large multinationals',
    editions: 'Oracle Fusion Cloud Applications (Inventory, Order Management, Receivables)',
    access: 'cloud-api', api: 'Fusion REST APIs', auth: 'Integration user — OAuth 2.0 (Identity Domain) or basic auth',
    locationLabel: 'Inventory organisation / subinventory', locationHint: 'e.g. M1 / FGI', sampleLocations: ['M1 / FGI', 'M2 / FGI'],
    tenantLabel: 'Business unit', endpointHint: 'https://<pod>.fa.<region>.oraclecloud.com/fscmRestApi/resources/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'Inventory on-hand quantities (organisation, subinventory, lot, serial)', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'Items (Product Hub)', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'Customer accounts and sites', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'Sales Orders for Order Hub', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'Receivables invoices', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Lot and serial control per item and organisation, with lot expiry.',
    setup: ['Oracle admin creates an integration user with the inventory, order and receivables roles.', 'Share the pod URL and business unit.', 'Map organisation / subinventory to VinFlux warehouses.'],
    soNo: (n) => `${300000 + n}`, invNo: (n) => `AR-${yr()}-${pad(n, 6)}`, status: 'sandbox',
  },
  {
    id: 'netsuite', name: 'Oracle NetSuite', vendor: 'Oracle', fit: 'Fast-growing mid-size companies',
    editions: 'NetSuite (OneWorld supported — one subsidiary per principal)',
    access: 'cloud-api', api: 'SuiteTalk REST web services + SuiteQL', auth: 'Token-based authentication (TBA) or OAuth 2.0 integration record',
    locationLabel: 'Location', locationHint: 'e.g. Hyderabad DC', sampleLocations: ['Hyderabad DC', 'Bengaluru DC'],
    tenantLabel: 'Account ID / subsidiary', endpointHint: 'https://<account>.suitetalk.api.netsuite.com/services/rest/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'inventoryItem locations + inventoryNumber (lot / serial) via SuiteQL', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'inventoryItem / lotNumberedInventoryItem / serializedInventoryItem', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'customer', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'salesOrder', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'invoice', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Lot-numbered and serialised items, expiry on the inventory number.',
    setup: ['Admin enables REST web services and creates an integration record + access token.', 'Share account ID and subsidiary.', 'Map locations to VinFlux warehouses.'],
    soNo: (n) => `SO${pad(n, 5)}`, invNo: (n) => `INV${pad(n, 5)}`, status: 'sandbox',
  },
  {
    id: 'd365-bc', name: 'Microsoft Dynamics 365 Business Central', vendor: 'Microsoft', fit: 'Mid-size manufacturers and distributors',
    editions: 'Business Central online (SaaS); on-premise with the same APIs',
    access: 'cloud-api', api: 'Business Central API v2.0 (REST / OData)', auth: 'OAuth 2.0 — Microsoft Entra ID app registration (service-to-service)',
    locationLabel: 'Location code', locationHint: 'e.g. MAIN', sampleLocations: ['MAIN', 'HYD'],
    tenantLabel: 'Tenant / environment / company', endpointHint: 'https://api.businesscentral.dynamics.com/v2.0/<tenant>/<environment>/api/v2.0/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'items + item ledger entries with item tracking (lot / serial) per location', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'items', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'customers', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'salesOrders', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'salesInvoices (posted)', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Item tracking codes for lot and serial numbers, with expiration dates.',
    setup: ['IT registers an app in Microsoft Entra ID and grants it Business Central API access.', 'Add the app in Business Central (Microsoft Entra Applications) with permissions.', 'Map location codes to VinFlux warehouses.'],
    soNo: (n) => `S-ORD${101000 + n}`, invNo: (n) => `PS-INV${103000 + n}`, status: 'sandbox',
  },
  {
    id: 'd365-fo', name: 'Microsoft Dynamics 365 Finance & Supply Chain', vendor: 'Microsoft', fit: 'Large enterprises',
    editions: 'Dynamics 365 Finance and Supply Chain Management (cloud)',
    access: 'cloud-api', api: 'OData data entities (+ Data management packages for bulk loads)', auth: 'OAuth 2.0 — Microsoft Entra ID app registration',
    locationLabel: 'Site / warehouse', locationHint: 'e.g. HYD / 11', sampleLocations: ['HYD / 11', 'MUM / 21'],
    tenantLabel: 'Legal entity', endpointHint: 'https://<environment>.operations.dynamics.com/data/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'Warehouse on-hand entity (site, warehouse, batch, serial)', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'Released products', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'Customers', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'Sales order headers and lines', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'Customer invoice journal', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Tracking dimensions — batch number (with expiry) and serial number.',
    setup: ['IT registers an Entra ID app and adds it in Finance & Operations (Microsoft Entra applications).', 'Share the environment URL and legal entity.', 'Map site / warehouse to VinFlux warehouses.'],
    soNo: (n) => `SO-${pad(n, 6)}`, invNo: (n) => `CIV-${pad(n, 6)}`, status: 'sandbox',
  },
  {
    id: 'odoo', name: 'Odoo', vendor: 'Odoo', fit: 'SMEs and mid-size companies',
    editions: 'Odoo Online, Odoo.sh and on-premise (Community or Enterprise)',
    access: 'cloud-api', api: 'External API (JSON-RPC / XML-RPC)', auth: 'API key of an integration user',
    locationLabel: 'Stock location', locationHint: 'e.g. WH/Stock', sampleLocations: ['WH/Stock', 'BLR/Stock'],
    tenantLabel: 'Database', endpointHint: 'https://<company>.odoo.com',
    objects: [
      { vinflux: 'Stock on hand', erp: 'stock.quant (location, lot / serial via stock.lot)', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'product.product', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'res.partner', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'sale.order', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'account.move (customer invoice)', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Lots & serial numbers (Inventory settings), expiry dates when enabled.',
    setup: ['Create an integration user and generate an API key (Preferences → Account security).', 'Share the URL and database name.', 'Map stock locations to VinFlux warehouses.'],
    soNo: (n) => `S${pad(n, 5)}`, invNo: (n) => `INV/${yr()}/${pad(n, 5)}`, status: 'sandbox',
  },
  {
    id: 'zoho', name: 'Zoho Inventory / Books', vendor: 'Zoho', fit: 'Small and growing companies',
    editions: 'Zoho Inventory (batch & serial tracking), Zoho Books for invoicing',
    access: 'cloud-api', api: 'Zoho Inventory REST API v1', auth: 'OAuth 2.0 (Zoho API console; India data centre: zoho.in)',
    locationLabel: 'Warehouse / location', locationHint: 'e.g. Hyderabad Warehouse', sampleLocations: ['Hyderabad Warehouse', 'Mumbai Warehouse'],
    tenantLabel: 'Organization ID', endpointHint: 'https://www.zohoapis.in/inventory/v1/',
    objects: [
      { vinflux: 'Stock on hand', erp: 'items (warehouse stock) with batches / serial numbers', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'items', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'contacts (customers)', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'salesorders', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'invoices (with e-invoice details for India)', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Batch and serial tracking need Zoho Inventory; Zoho Books alone tracks quantity only.',
    setup: ['Register VinFlux in the Zoho API console and authorise the organisation.', 'Share the organization ID.', 'Map warehouses to VinFlux warehouses.'],
    soNo: (n) => `SO-${pad(n, 5)}`, invNo: (n) => `INV-${pad(n, 6)}`, status: 'sandbox',
  },
  {
    id: 'tally', name: 'Tally Prime', vendor: 'Tally', fit: 'Small and mid-size Indian companies',
    editions: 'TallyPrime (single or multi-user), installed on a local PC / server',
    access: 'agent', api: 'Tally XML / ODBC on port 9000, read by the VinFlux agent', auth: 'Agent key — the agent calls out over HTTPS (no inbound ports)',
    locationLabel: 'Godown', locationHint: 'e.g. Bommasandra Godown', sampleLocations: ['Bommasandra Godown', 'Andheri Godown'],
    tenantLabel: 'Tally company', endpointHint: 'http://localhost:9000',
    objects: [
      { vinflux: 'Stock on hand', erp: 'Stock items × godown × batch (Batch-wise details)', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'Stock items', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'Ledgers under Sundry Debtors', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'Sales Order voucher', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'Sales voucher (with e-invoice / e-way bill if enabled)', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Batch-wise details with expiry; no native serial numbers (kept in VinFlux).',
    setup: ['Install the VinFlux agent next to Tally and paste the agent key.', 'Choose the Tally company.', 'Map godowns to VinFlux warehouses.'],
    soNo: (n) => `SO/${yr() % 100}-${(yr() + 1) % 100}/${pad(n, 4)}`, invNo: (n) => `INV/${yr() % 100}-${(yr() + 1) % 100}/${pad(n, 4)}`, status: 'sandbox',
  },
  {
    id: 'erpnext', name: 'ERPNext', vendor: 'Frappe', fit: 'SMEs (open source)',
    editions: 'Frappe Cloud or self-hosted ERPNext',
    access: 'cloud-api', api: 'Frappe REST API (/api/resource)', auth: 'API key + API secret of an integration user',
    locationLabel: 'Warehouse', locationHint: 'e.g. Stores - BMS', sampleLocations: ['Stores - BMS', 'Finished Goods - BMS'],
    tenantLabel: 'Company', endpointHint: 'https://<site>.frappe.cloud',
    objects: [
      { vinflux: 'Stock on hand', erp: 'Bin + Stock Ledger Entry (Batch, Serial No)', direction: 'ERP → VinFlux' },
      { vinflux: 'Products', erp: 'Item', direction: 'ERP → VinFlux' },
      { vinflux: 'Partners', erp: 'Customer', direction: 'Both' },
      { vinflux: 'Sales order', erp: 'Sales Order', direction: 'VinFlux → ERP' },
      { vinflux: 'Invoice', erp: 'Sales Invoice (India Compliance app for e-invoice)', direction: 'ERP → VinFlux' },
    ],
    batchSerial: 'Batch (with expiry) and Serial No doctypes.',
    setup: ['Create an integration user and generate API key / secret.', 'Share the site URL and company.', 'Map warehouses to VinFlux warehouses.'],
    soNo: (n) => `SAL-ORD-${yr()}-${pad(n, 5)}`, invNo: (n) => `ACC-SINV-${yr()}-${pad(n, 5)}`, status: 'sandbox',
  },
  {
    id: 'marg', name: 'Marg ERP 9+', vendor: 'Marg', fit: 'Pharma and medical distributors / C&F',
    editions: 'Marg ERP 9+ (desktop)', access: 'agent', api: 'Scheduled stock & sales export read by the VinFlux agent', auth: 'Agent key',
    locationLabel: 'Godown / branch', locationHint: 'e.g. Main', sampleLocations: [], tenantLabel: 'Company', endpointHint: 'Export folder on the Marg PC',
    objects: [{ vinflux: 'Stock on hand', erp: 'Batch-wise stock export', direction: 'ERP → VinFlux' }, { vinflux: 'Sales', erp: 'Sales register export', direction: 'ERP → VinFlux' }],
    batchSerial: 'Batch and expiry.', setup: ['Install the agent; point it at the Marg export folder.'], soNo: (n) => `SO${n}`, invNo: (n) => `INV${n}`, status: 'planned',
  },
  {
    id: 'busy', name: 'Busy Accounting', vendor: 'Busy', fit: 'Small Indian businesses',
    editions: 'Busy 21 (desktop)', access: 'agent', api: 'Busy export read by the VinFlux agent', auth: 'Agent key',
    locationLabel: 'Material centre', locationHint: 'e.g. Main Store', sampleLocations: [], tenantLabel: 'Company', endpointHint: 'Export folder',
    objects: [{ vinflux: 'Stock on hand', erp: 'Batch-wise stock export', direction: 'ERP → VinFlux' }],
    batchSerial: 'Batch and expiry.', setup: ['Install the agent; point it at the Busy export folder.'], soNo: (n) => `SO${n}`, invNo: (n) => `INV${n}`, status: 'planned',
  },
];

export const erpProfile = (id: string | null | undefined) => ERP_PROFILES.find((p) => p.id === id) ?? null;
/** The ERP's own document number for a VinFlux sales order / invoice (demo numbering). */
export const erpDocNo = (connectorId: string | null, kind: 'SO' | 'INV', n: number) => {
  const p = erpProfile(connectorId);
  if (!p) return kind === 'SO' ? `ERP-SO-${pad(n, 5)}` : `INV-${yr() % 100}-${7000 + n}`;
  return kind === 'SO' ? p.soNo(n) : p.invNo(n);
};
