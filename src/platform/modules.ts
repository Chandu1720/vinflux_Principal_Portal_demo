/**
 * Module registry — every VinFlux module describes itself here (manifest).
 * A module can be switched on/off per principal; dependencies must be on first.
 * Modules marked 'planned' are on the roadmap and can't be enabled yet.
 */
import type { IndustryPackId } from '../types/product.ts';

export type ModuleId =
  | 'product-master' | 'go-to-market' | 'integration-hub' | 'inventory'
  | 'price-lists' | 'qc' | 'orders' | 'logistics' | 'returns' | 'recall' | 'performance' | 'users' | 'surgical';

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  version: string;
  /** core = always on. */
  core?: boolean;
  status: 'available' | 'planned';
  phase?: number;
  dependsOn: ModuleId[];
  /** Main-app paths owned by the module (hidden / blocked when off). */
  paths: string[];
  publishes: string[];
  subscribes: string[];
  /** Only offered to these industry workspaces (empty / missing = all). */
  industries?: IndustryPackId[];
}

export const MODULES: ModuleManifest[] = [
  { id: 'product-master', name: 'Product Master', description: 'Universal product definition with industry packs, GS1 barcodes, variants, kits and maker-checker approval.', version: '2.4', core: true, status: 'available', dependsOn: [], paths: ['/', '/products'], publishes: ['product.imported'], subscribes: [] },
  { id: 'integration-hub', name: 'Integration Hub & Data Import', description: 'Excel/CSV import with checks and undo; ERP and service connectors with field mapping and sync log.', version: '1.0', core: true, status: 'available', dependsOn: [], paths: ['/data-import', '/integrations'], publishes: ['import.completed', 'import.undone', 'connector.synced', 'connector.failed'], subscribes: [] },
  { id: 'go-to-market', name: 'Go-to-Market', description: 'Territories, channels, sales policies, partner onboarding, supply links, commercial terms, hospital coverage, credit, licences, portal.', version: '2.0', status: 'available', dependsOn: ['product-master'], paths: ['/gtm-v2'], publishes: [], subscribes: [] },
  { id: 'inventory', name: 'Inventory', description: 'Stock by warehouse, bin, batch, serial and expiry, kept as a ledger of movements. Opening stock via import or ERP sync.', version: '0.5', status: 'available', phase: 2, dependsOn: ['product-master'], paths: ['/inventory'], publishes: ['stock.received', 'stock.reversed'], subscribes: [] },
  { id: 'users', name: 'Users & Roles', description: 'Staff and partner users, roles, permission matrix, data scope by principal, territory and warehouse.', version: '1.0', core: true, status: 'available', dependsOn: [], paths: ['/users'], publishes: ['user.changed', 'role.changed'], subscribes: [] },
  { id: 'price-lists', name: 'Price Lists & Rate Contracts', description: 'Channel and partner price lists, hospital rate contracts, schemes; MRP / NPPA / floor-price checks, maker-checker and versions.', version: '1.0', status: 'available', phase: 1, dependsOn: ['product-master', 'go-to-market'], paths: ['/pricing'], publishes: ['price.submitted', 'price.activated', 'price.rejected'], subscribes: [] },
  { id: 'surgical', name: 'Surgery Cases & Implants', description: 'Case booking with loaner / consignment instrument sets, usage after surgery, implant register with UDI per patient, kit return check, sterilisation, recall trace.', version: '1.0', status: 'available', dependsOn: ['product-master', 'go-to-market'], paths: ['/surgical'], publishes: ['implant.recorded', 'case.closed'], subscribes: [], industries: ['medical-devices'] },
  { id: 'qc', name: 'Quality Control', description: 'Inbound and returns QC, inspection checklists per product type, batch release, deviations.', version: '—', status: 'planned', phase: 2, dependsOn: ['inventory'], paths: [], publishes: [], subscribes: [] },
  { id: 'orders', name: 'Order Management', description: 'Partner orders with trade/credit/price/stock checks, PO routing, allocation, surgery case orders.', version: '—', status: 'planned', phase: 3, dependsOn: ['inventory', 'price-lists', 'go-to-market'], paths: [], publishes: [], subscribes: [] },
  { id: 'logistics', name: 'Logistics & Shipments', description: 'Packing with batch/serial scan, transporters, e-way bill, tracking, proof of delivery, kit shipments.', version: '—', status: 'planned', phase: 3, dependsOn: ['orders'], paths: [], publishes: [], subscribes: [] },
  { id: 'returns', name: 'Returns', description: 'Return requests, policy checks, reverse pickup, QC disposition, credit notes.', version: '—', status: 'planned', phase: 4, dependsOn: ['orders', 'qc'], paths: [], publishes: [], subscribes: [] },
  { id: 'recall', name: 'Recall & Complaints', description: 'Complaints and vigilance, batch/serial recall with trace-forward, blocking, partner acknowledgement, closure.', version: '—', status: 'planned', phase: 5, dependsOn: ['logistics', 'returns'], paths: [], publishes: [], subscribes: [] },
  { id: 'performance', name: 'Performance', description: 'Partner and transporter scorecards from orders, deliveries, returns and payments.', version: '—', status: 'planned', phase: 6, dependsOn: ['orders'], paths: [], publishes: [], subscribes: [] },
];

export const manifest = (id: ModuleId) => MODULES.find((m) => m.id === id)!;
