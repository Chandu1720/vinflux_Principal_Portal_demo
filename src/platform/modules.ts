/**
 * Module registry — every VinFlux module describes itself here (manifest).
 * A module can be switched on/off per principal; dependencies must be on first.
 * Modules marked 'planned' are on the roadmap and can't be enabled yet.
 */
import type { IndustryPackId } from '../types/product.ts';

export type ModuleId =
  | 'product-master' | 'go-to-market' | 'integration-hub' | 'inventory'
  | 'price-lists' | 'orders' | 'logistics' | 'returns' | 'recall' | 'performance' | 'users' | 'surgical';

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
  { id: 'inventory', name: 'Inventory', description: 'Stock across the chain: company warehouses mirrored from the ERP (scheduled delta sync, reconciliation), C&F, partner and hospital stock, in transit, available-to-promise, expiry, receipts and claims.', version: '1.0', status: 'available', phase: 2, dependsOn: ['product-master'], paths: ['/inventory'], publishes: ['stock.received', 'stock.reversed'], subscribes: ['order.invoiced', 'order.delivered', 'connector.synced'] },
  { id: 'users', name: 'Users & Roles', description: 'Staff and partner users, roles, permission matrix, data scope by principal, territory and warehouse.', version: '1.0', core: true, status: 'available', dependsOn: [], paths: ['/users'], publishes: ['user.changed', 'role.changed'], subscribes: [] },
  { id: 'price-lists', name: 'Price Lists & Rate Contracts', description: 'Channel and partner price lists, hospital rate contracts, schemes; MRP / NPPA / floor-price checks, maker-checker and versions.', version: '1.0', status: 'available', phase: 1, dependsOn: ['product-master', 'go-to-market'], paths: ['/pricing'], publishes: ['price.submitted', 'price.activated', 'price.rejected'], subscribes: [] },
  { id: 'surgical', name: 'Surgery Cases & Implants', description: 'Case booking with loaner / consignment instrument sets, usage after surgery, implant register with UDI per patient, kit return check, sterilisation, recall trace.', version: '1.0', status: 'available', dependsOn: ['product-master', 'go-to-market'], paths: ['/surgical'], publishes: ['implant.recorded', 'case.closed'], subscribes: [], industries: ['medical-devices'] },
  { id: 'orders', name: 'Order Management', description: 'Order inbox with checks (licence, route, products, price & cap, credit, stock with shelf life), part-confirm / backorder / substitute, credit release, ERP sales order; hands confirmed orders to Logistics (or a simple ship / deliver step when Logistics is off).', version: '1.0', status: 'available', phase: 3, dependsOn: ['inventory', 'price-lists', 'go-to-market'], paths: ['/orders'], publishes: ['order.confirmed', 'order.invoiced', 'order.dispatched', 'order.delivered'], subscribes: ['connector.synced'] },
  { id: 'logistics', name: 'Logistics & Shipments', description: 'Dispatch queue for confirmed orders, shipments (invoice, e-way bill, vehicle, packages, freight), one trip for several orders, carriers with rate cards and scorecards, in-transit tracking, proof of delivery, shortage / damage claims. When off, Orders keeps a simple ship / deliver step.', version: '1.0', status: 'available', phase: 3, dependsOn: ['orders'], paths: ['/logistics'], publishes: ['order.dispatched', 'order.delivered'], subscribes: ['order.confirmed'] },
  { id: 'returns', name: 'Returns', description: 'Return requests checked against the original delivery (batch / serial, quantity) and the return policy (window, credit %, restockable per reason); auto-approval limit with maker-checker; reverse pickup; receipt into Quarantine; returns check (restock / scrap / return to manufacturer); credit notes.', version: '1.0', status: 'available', phase: 4, dependsOn: ['orders'], paths: ['/returns'], publishes: ['stock.received'], subscribes: ['order.delivered'] },
  { id: 'recall', name: 'Complaints & Recall', description: 'Complaints and adverse events by batch / serial with regulator-report due dates, investigation → root cause → CAPA; recalls with trace-forward (warehouses, C&F, partners, hospitals, transit, implanted patients), maker-checker start, stock blocking, partner notice and acknowledgement, recovery and effectiveness to close.', version: '1.0', status: 'available', phase: 5, dependsOn: ['returns'], paths: ['/recall'], publishes: ['complaint.logged', 'recall.started'], subscribes: ['stock.received'] },
  { id: 'performance', name: 'Performance', description: 'Partner and transporter scorecards from orders, deliveries, returns and payments.', version: '—', status: 'planned', phase: 6, dependsOn: ['orders'], paths: [], publishes: [], subscribes: [] },
];

export const manifest = (id: ModuleId) => MODULES.find((m) => m.id === id)!;
