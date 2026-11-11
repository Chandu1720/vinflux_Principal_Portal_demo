/**
 * TallyPrime — XML over HTTP on the Tally machine (port 9000 by default; enable it under F1 Help → Settings → Connectivity).
 * Tally has no cloud API, so this adapter runs inside the VinFlux agent on the principal's network (server/agent.ts),
 * never on Vercel. Config: URL (http://localhost:9000), COMPANY (exact Tally company name).
 *   stock      batch-wise closing balance per godown (TDL collection over Batch objects of each stock item)
 *   order      Sales Order voucher import
 *   invoices   Sales vouchers whose order reference is the sales order
 * VERIFY on the customer's TallyPrime release: TDL field names (ClosingBalance, ExpiryPeriod, MfdOn) and the
 * party / sales ledger names used in the voucher import.
 */
import { request, trimSlash } from '../http.js';
import { ErpError } from '../types.js';
import type { Adapter, Cfg, CustomerLine, LocationLine, ProductLine, StockLine } from '../types.js';

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const post = async (cfg: Cfg, xml: string) => {
  const r = await request(trimSlash(cfg.URL || 'http://localhost:9000'), { method: 'POST', headers: { 'Content-Type': 'text/xml;charset=utf-8' }, body: xml });
  const text = await r.text();
  if (!r.ok) throw new ErpError(`Tally answered HTTP ${r.status}`, r.status, text.slice(0, 300));
  const err = text.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/);
  if (err) throw new ErpError(`Tally: ${err[1].trim()}`);
  return text;
};
const staticVars = (cfg: Cfg) => `<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${cfg.COMPANY ? `<SVCURRENTCOMPANY>${xmlEsc(cfg.COMPANY)}</SVCURRENTCOMPANY>` : ''}</STATICVARIABLES>`;
const collection = (cfg: Cfg, name: string, tdl: string) => `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC>${staticVars(cfg)}<TDL><TDLMESSAGE>${tdl}</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
/** Pull <TAG>value</TAG> out of a Tally record (Tally wraps values with TYPE attributes). */
const field = (rec: string, tag: string) => { const m = rec.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''; };
const records = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) => m[0]);
const qtyOf = (s: string) => { const n = parseFloat(s.replace(/,/g, '')); return Number.isFinite(n) ? Math.abs(n) : 0; };
/** Tally dates: 20261106 or 6-Nov-2026. */
export const tallyDate = (s: string): string | null => {
  const t = s.trim();
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  const d = Date.parse(t.replace(/-/g, ' '));
  return Number.isFinite(d) ? new Date(d + 12 * 3600000).toISOString().slice(0, 10) : null;
};

export const tally: Adapter = {
  id: 'tally',
  required: ['URL'],
  async test(cfg) {
    const xml = await post(cfg, collection(cfg, 'VFXGodowns', '<COLLECTION NAME="VFXGodowns"><TYPE>Godown</TYPE><FETCH>Name</FETCH></COLLECTION>'));
    const godowns = records(xml, 'GODOWN').map((r) => r.match(/NAME="([^"]+)"/)?.[1] ?? field(r, 'NAME'));
    return { ok: true, message: `Connected to Tally${cfg.COMPANY ? ` (${cfg.COMPANY})` : ''}.`, details: { godowns } };
  },
  async stock(cfg, opts) {
    const itemsXml = await post(cfg, collection(cfg, 'VFXItems', '<COLLECTION NAME="VFXItems"><TYPE>StockItem</TYPE><FETCH>Name, PartNo, ClosingBalance, ClosingRate, IsBatchWiseOn</FETCH></COLLECTION>'));
    const items = records(itemsXml, 'STOCKITEM').map((r) => ({ name: r.match(/NAME="([^"]+)"/)?.[1] ?? field(r, 'NAME'), partNo: field(r, 'PARTNO'), batchWise: /yes/i.test(field(r, 'ISBATCHWISEON')), closing: qtyOf(field(r, 'CLOSINGBALANCE')), rate: qtyOf(field(r, 'CLOSINGRATE')) }));
    const out: StockLine[] = [];
    for (const it of items) {
      if (!it.closing) continue;
      const code = it.partNo || it.name;
      const bx = await post(cfg, collection(cfg, 'VFXBatches', `<COLLECTION NAME="VFXBatches"><TYPE>Batch</TYPE><CHILDOF>${xmlEsc(it.name)}</CHILDOF><FETCH>Name, GodownName, ClosingBalance, ExpiryPeriod, MfdOn</FETCH></COLLECTION>`)).catch(() => '');
      const batches = records(bx, 'BATCH').map((r) => ({ batch: r.match(/NAME="([^"]+)"/)?.[1] ?? field(r, 'NAME'), godown: field(r, 'GODOWNNAME') || 'Main Location', qty: qtyOf(field(r, 'CLOSINGBALANCE')), exp: tallyDate(field(r, 'EXPIRYPERIOD')), mfd: tallyDate(field(r, 'MFDON')) }))
        .filter((b) => b.qty && (!opts.locations?.length || opts.locations.includes(b.godown)));
      if (batches.length) batches.forEach((b) => out.push({ location: b.godown, itemCode: code, batch: b.batch === 'Primary Batch' ? '' : b.batch, serial: null, mfgDate: b.mfd, expiryDate: b.exp, qty: b.qty, unitCost: it.rate || null, status: 'Available' }));
      else if (!opts.locations?.length || opts.locations.includes('Main Location')) out.push({ location: 'Main Location', itemCode: code, batch: '', serial: null, mfgDate: null, expiryDate: null, qty: it.closing, unitCost: it.rate || null, status: 'Available' });
    }
    return out;
  },
  async createSalesOrder(cfg, so) {
    const d = so.poDate.replace(/-/g, '');
    const no = `VFX-${so.vinfluxRef}`;
    const lines = so.lines.map((l) => {
      const amt = (l.unitPrice ?? 0) * l.qty;
      return `<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>${xmlEsc(l.itemCode)}</STOCKITEMNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><RATE>${l.unitPrice ?? 0}</RATE><AMOUNT>${amt.toFixed(2)}</AMOUNT><ACTUALQTY>${l.qty}</ACTUALQTY><BILLEDQTY>${l.qty}</BILLEDQTY>`
        + `<BATCHALLOCATIONS.LIST>${so.location ? `<GODOWNNAME>${xmlEsc(so.location)}</GODOWNNAME>` : ''}<ORDERNO>${xmlEsc(no)}</ORDERNO><AMOUNT>${amt.toFixed(2)}</AMOUNT><ACTUALQTY>${l.qty}</ACTUALQTY><BILLEDQTY>${l.qty}</BILLEDQTY><ORDERDUEDATE>${so.requiredBy.replace(/-/g, '')}</ORDERDUEDATE></BATCHALLOCATIONS.LIST>`
        + `<ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME>${xmlEsc(cfg.SALES_LEDGER || 'Sales')}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${amt.toFixed(2)}</AMOUNT></ACCOUNTINGALLOCATIONS.LIST></ALLINVENTORYENTRIES.LIST>`;
    }).join('');
    const total = so.lines.reduce((a, l) => a + (l.unitPrice ?? 0) * l.qty, 0);
    const xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME>${staticVars(cfg)}</REQUESTDESC><REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">`
      + `<VOUCHER VCHTYPE="Sales Order" ACTION="Create"><DATE>${d}</DATE><VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME><VOUCHERNUMBER>${xmlEsc(no)}</VOUCHERNUMBER><REFERENCE>${xmlEsc(so.poNumber)}</REFERENCE>`
      + `<PARTYLEDGERNAME>${xmlEsc(so.customerCode)}</PARTYLEDGERNAME><NARRATION>${xmlEsc(`VinFlux ${so.vinfluxRef}`)}</NARRATION><PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>`
      + `<LEDGERENTRIES.LIST><LEDGERNAME>${xmlEsc(so.customerCode)}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>${(-total).toFixed(2)}</AMOUNT></LEDGERENTRIES.LIST>${lines}</VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    const res = await post(cfg, xml);
    if (!/<CREATED>\s*1\s*<\/CREATED>/.test(res)) throw new ErpError(`Tally did not create the sales order: ${res.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    return { erpId: field(res, 'LASTVCHID') || no, erpNumber: no };
  },
  async products(cfg): Promise<ProductLine[]> {
    const xml = await post(cfg, collection(cfg, 'VFXItemMaster', '<COLLECTION NAME="VFXItemMaster"><TYPE>StockItem</TYPE><FETCH>Name, PartNo, Parent, BaseUnits, IsBatchWiseOn, HasMfgDate, GSTDetails.List, ClosingRate, Description</FETCH></COLLECTION>'));
    return records(xml, 'STOCKITEM').map((r) => {
      const name = r.match(/NAME="([^"]+)"/)?.[1] ?? field(r, 'NAME');
      const rate = field(r, 'IGSTRATE') || field(r, 'GSTRATE');
      return { erpId: name, itemCode: field(r, 'PARTNO') || name, name, description: field(r, 'DESCRIPTION'), barcode: null, hsn: field(r, 'HSNCODE') || null, gstRate: rate ? qtyOf(rate) : null,
        uom: field(r, 'BASEUNITS') || null, salesRate: null, cost: qtyOf(field(r, 'CLOSINGRATE')) || null, brand: null, category: field(r, 'PARENT') || null, tracking: /yes/i.test(field(r, 'ISBATCHWISEON')) ? 'Batch' as const : 'None' as const, active: true };
    });
  },
  async customers(cfg): Promise<CustomerLine[]> {
    const xml = await post(cfg, collection(cfg, 'VFXDebtors', '<COLLECTION NAME="VFXDebtors"><TYPE>Ledger</TYPE><CHILDOF>Sundry Debtors</CHILDOF><BELONGSTO>Yes</BELONGSTO><FETCH>Name, PartyGSTIN, Email, LedgerPhone, LedgerMobile, Address.List, LedStateName, PinCode</FETCH></COLLECTION>'));
    return records(xml, 'LEDGER').map((r) => {
      const name = r.match(/NAME="([^"]+)"/)?.[1] ?? field(r, 'NAME');
      return { erpId: name, code: name, name, gstin: field(r, 'PARTYGSTIN') || null, email: field(r, 'EMAIL') || null, phone: field(r, 'LEDGERMOBILE') || field(r, 'LEDGERPHONE') || null,
        address: field(r, 'ADDRESS') || null, city: null, state: field(r, 'LEDSTATENAME') || null, pincode: field(r, 'PINCODE') || null, active: true };
    });
  },
  async locations(cfg): Promise<LocationLine[]> {
    const xml = await post(cfg, collection(cfg, 'VFXGodowns', '<COLLECTION NAME="VFXGodowns"><TYPE>Godown</TYPE><FETCH>Name, Address</FETCH></COLLECTION>'));
    return records(xml, 'GODOWN').map((r) => { const n = r.match(/NAME="([^"]+)"/)?.[1] ?? field(r, 'NAME'); return { code: n, name: n, address: field(r, 'ADDRESS') || null, city: null, state: null, pincode: null }; });
  },
  async invoicesFor(cfg, ref) {
    const xml = await post(cfg, collection(cfg, 'VFXSales', `<COLLECTION NAME="VFXSales"><TYPE>Voucher</TYPE><FETCH>VoucherNumber, Date, Reference, Amount, IRN, EWayBillNo</FETCH><FILTER>VFXIsSale</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="VFXIsSale">$$IsSales:$VoucherTypeName AND $Reference = "${xmlEsc(ref.poNumber)}"</SYSTEM>`));
    return records(xml, 'VOUCHER').map((r) => ({ number: field(r, 'VOUCHERNUMBER'), date: tallyDate(field(r, 'DATE')), status: 'Posted', amount: qtyOf(field(r, 'AMOUNT')), irn: field(r, 'IRN') || null, ewayBill: field(r, 'EWAYBILLNO') || null }));
  },
};
