# VinFlux ERP connectors

Live connectors read stock from the principal's ERP, create the sales order there when an order is
confirmed, and fetch the ERP's tax invoice when the shipment is created. ERP passwords and keys stay
on the server, never in the browser.

```
Browser (VinFlux app)  ──x-vinflux-key──►  /api/erp  ──►  ERP adapter  ──►  SAP / Oracle / Odoo / Zoho / Dynamics / …
                                         (Vercel function, or the standalone service)
On-premise ERP (Tally):  agent next to Tally ──outbound HTTPS──► standalone service ◄── browser
```

| File | What it is |
|---|---|
| `api/erp.ts` | Vercel function (cloud ERPs) |
| `api/_lib/handler.ts` | The one request handler: access key, config, ops `status / test / stock / salesOrder / invoices` |
| `api/_lib/adapters/*.ts` | One adapter per ERP, all speaking the same normalised shapes (`api/_lib/types.ts`) |
| `server/standalone.ts` | Same handler as a long-running service (`npm run service`); adds the agent endpoints |
| `server/agent.ts` | Agent for on-premise ERPs (`npm run agent`) |
| `server/erp-extensions/bc-vinflux-stock.al` | Business Central API page for stock by location / lot / serial |
| `server/test/` | Adapter tests against fake ERP servers (`npm run test:connectors`) |

## 1. Turn it on

1. Set `VFX_API_KEY` on the server (a long random string). Users type the same value under
   Integration Hub → connector → Connection → "VinFlux access key". Requests without it are refused.
2. Add the ERP's variables (below). On Vercel: Project → Settings → Environment Variables. For the
   standalone service: environment variables, or `server/connectors.json` (git-ignored).
3. In the app: Integration Hub → the ERP → Mode **Live** → Test connection → map the ERP's locations
   to VinFlux warehouses → map partners to ERP customers → Sync live stock now.

The standalone service also needs `VFX_ALLOWED_ORIGIN` (the app's URL) and, for agents, `VFX_AGENT_KEY`.

## 2. Variables per ERP

| ERP | Variables | Notes |
|---|---|---|
| SAP S/4HANA | `VFX_SAP_BASE_URL` (…/sap/opu/odata/sap), `VFX_SAP_USER`, `VFX_SAP_PASSWORD`, `VFX_SAP_CLIENT`, `VFX_SAP_SALES_ORG`, `VFX_SAP_DIST_CHANNEL`, `VFX_SAP_DIVISION`, optional `VFX_SAP_ORDER_TYPE`, `VFX_SAP_LOCATION_LEVEL` (plant / storage) | Communication arrangement for API_MATERIAL_STOCK_SRV, API_BATCH_SRV, API_SALES_ORDER_SRV, API_BILLING_DOCUMENT_SRV. `VFX_SAP_API_KEY` instead of user/password = SAP API sandbox (read-only). SAP prices orders itself. |
| SAP Business One | `VFX_SAP_B1_BASE_URL` (…:50000/b1s/v1), `VFX_SAP_B1_COMPANY_DB`, `VFX_SAP_B1_USER`, `VFX_SAP_B1_PASSWORD` | Warehouse totals out of the box; quantity per batch needs a Service Layer SQL view. |
| Oracle Fusion Cloud SCM | `VFX_ORACLE_FUSION_BASE_URL`, `VFX_ORACLE_FUSION_USER` + `_PASSWORD` (or `_BEARER`), `VFX_ORACLE_FUSION_BUSINESS_UNIT`, optional `_API_VERSION`, `_ONHAND_RESOURCE` | **Check** the on-hand resource name on the customer's pod. |
| Oracle NetSuite | `VFX_NETSUITE_ACCOUNT_ID`, `_CONSUMER_KEY`, `_CONSUMER_SECRET`, `_TOKEN_ID`, `_TOKEN_SECRET` | Token-based auth (HMAC-SHA256). **Check** the SuiteQL InventoryBalance columns on the account. |
| Odoo | `VFX_ODOO_URL`, `VFX_ODOO_DB`, `VFX_ODOO_LOGIN`, `VFX_ODOO_API_KEY` | Customers are matched by the partner's Odoo *Reference*; products by *Internal reference* or barcode. |
| Zoho Inventory | `VFX_ZOHO_DC` (in / com / eu), `VFX_ZOHO_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`, `_ORG_ID` | Scopes: ZohoInventory items, salesorders, invoices, contacts, settings (read). **Check** the batch endpoint on a live org. |
| Dynamics 365 Business Central | `VFX_D365_BC_TENANT`, `_ENVIRONMENT`, `_COMPANY_ID`, `_CLIENT_ID`, `_CLIENT_SECRET`, optional `_STOCK_API=vinflux/stock/v1.0` | Without the AL page only item totals are available (location "ALL"). |
| Dynamics 365 Finance & SCM | `VFX_D365_FO_ENV_URL`, `_TENANT`, `_CLIENT_ID`, `_CLIENT_SECRET`, `_LEGAL_ENTITY`, optional `_ONHAND_ENTITY`, `_SO_HEADER_ENTITY`, `_SO_LINE_ENTITY`, `_INVOICE_ENTITY` | **Check** entity names on the environment; all can be overridden. |
| ERPNext | `VFX_ERPNEXT_URL`, `_API_KEY`, `_API_SECRET`, optional `_COMPANY` | IRN / e-way bill read when the India Compliance app is installed. |
| Tally Prime | On the agent PC: `VFX_TALLY_URL` (http://localhost:9000), `VFX_TALLY_COMPANY`, optional `VFX_TALLY_SALES_LEDGER`; plus `VFX_SERVICE_URL`, `VFX_AGENT_KEY` | Runs only through the agent and the standalone service. **Check** TDL field names on the customer's TallyPrime release. |

## 3. What has been tested and what hasn't

- **Tested here:** every adapter against fake ERP servers that answer in each vendor's published
  response format (`npm run test:connectors`). This covers sign-in, paging, stock normalisation
  (batch, serial, expiry, stock type), the sales-order payloads and invoice reading.
- **Also tested end to end:** the app in Live mode → standalone service → a fake SAP: test
  connection, sales order on confirm, invoice fetch at shipment, live stock sync and reconciliation.
  Also the agent → service → fake Tally flow.
- **Not tested:** any real ERP. Each connector needs one run against a real test login before a
  customer goes live. The items marked **Check** above are the most likely to differ.

## 4. Running the standalone service and the agent

```bash
npm install
VFX_API_KEY=... VFX_AGENT_KEY=... VFX_ALLOWED_ORIGIN=https://your-app npm run service      # port 8787
# on the Tally PC:
VFX_SERVICE_URL=https://service-host VFX_AGENT_KEY=... VFX_TALLY_URL=http://localhost:9000 VFX_TALLY_COMPANY="..." npm run agent
```

The agent's stock snapshot and job queue live in memory, so restarting the service clears them. A
database is the next step for the separate service.
