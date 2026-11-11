/**
 * Normalised shapes every ERP adapter speaks. The VinFlux app never sees ERP-specific fields:
 * adapters translate the ERP's objects into these and back.
 */
export interface StockLine {
  /** ERP location as the ERP names it (plant/storage location, warehouse code, stock location…). */
  location: string;
  itemCode: string;
  batch: string;
  serial: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  qty: number;
  unitCost: number | null;
  /** Unrestricted / available unless the ERP says otherwise. */
  status: 'Available' | 'Quarantine' | 'Blocked';
}
export interface SalesOrderIn {
  /** VinFlux order code, kept on the ERP document for traceability. */
  vinfluxRef: string;
  poNumber: string;
  poDate: string;
  requiredBy: string;
  /** Customer as the ERP knows it (from the connector's partner mapping). */
  customerCode: string;
  location: string | null;
  lines: { itemCode: string; qty: number; unitPrice: number | null }[];
  notes: string;
}
export interface SalesOrderOut { erpId: string; erpNumber: string }
export interface InvoiceOut { number: string; date: string | null; status: string; amount: number | null; irn: string | null; ewayBill: string | null }
/** An item / material as the ERP knows it. */
export interface ProductLine {
  erpId: string; itemCode: string; name: string; description: string;
  barcode: string | null; hsn: string | null; gstRate: number | null; uom: string | null;
  salesRate: number | null; cost: number | null; brand: string | null; category: string | null;
  tracking: 'Batch' | 'Serial' | 'Batch + Serial' | 'None' | null; active: boolean;
}
/** A customer account in the ERP. */
export interface CustomerLine {
  erpId: string; code: string; name: string; gstin: string | null; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null; pincode: string | null; active: boolean;
}
/** A stock location / warehouse in the ERP. */
export interface LocationLine { code: string; name: string; address: string | null; city: string | null; state: string | null; pincode: string | null }
export interface TestResult { ok: boolean; message: string; details?: Record<string, unknown> }

export interface Adapter {
  id: string;
  /** Config keys the adapter needs (read from VFX_<ID>_<KEY> env vars or the service config file). */
  required: string[];
  test(cfg: Cfg): Promise<TestResult>;
  stock(cfg: Cfg, opts: { locations?: string[] }): Promise<StockLine[]>;
  createSalesOrder(cfg: Cfg, so: SalesOrderIn): Promise<SalesOrderOut>;
  invoicesFor(cfg: Cfg, ref: { erpId: string; erpNumber: string; poNumber: string }): Promise<InvoiceOut[]>;
  /** Master data (optional per ERP). */
  products?(cfg: Cfg): Promise<ProductLine[]>;
  customers?(cfg: Cfg): Promise<CustomerLine[]>;
  locations?(cfg: Cfg): Promise<LocationLine[]>;
}
export type Cfg = Record<string, string>;

export class ErpError extends Error {
  status: number; body: string;
  constructor(message: string, status = 0, body = '') { super(message); this.status = status; this.body = body; }
}
