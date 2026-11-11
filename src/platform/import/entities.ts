/**
 * Importable data types. Add a new one by writing a definition and listing it in ENTITIES —
 * the wizard, templates, column matching, checks, history and undo work automatically.
 */
import type { Product } from '../../types/product.ts';
import type { ImportEntity, RowResult, RowValues } from './types';
import { daysBetween, norm, parseDate, parseNumber, today } from './values';
import { addOpening, balances, post, reverseImport, serialsInStock } from '../../modules/inventory/stockStore';
import type { LocType } from '../../modules/inventory/stockStore';
import type { StockStatus } from '../../modules/inventory/stockStore';
import { gtinError, normalise, usedGtins } from '../../utils/gs1.ts';
import { packOf } from '../../utils/productLifecycle.ts';
import { emit } from '../events';
import { checkList, getList, priceLists, setLines } from '../../modules/pricing/pricingStore';
import type { PriceLine } from '../../modules/pricing/pricingStore';
import { newId } from '../store';

/** Find a product by code, variant SKU, GTIN (any packaging) or ERP material code. */
export const findProduct = (code: string, products: Product[]): { product: Product; variantSku: string | null } | null => {
  const c = code.trim();
  if (!c) return null;
  const lc = c.toLowerCase();
  for (const p of products) {
    if (p.code.toLowerCase() === lc || p.id.toLowerCase() === lc || (p.externalRef ?? '').toLowerCase() === lc) return { product: p, variantSku: null };
    const v = p.variants?.find((x) => x.sku.toLowerCase() === lc || (/^\d{8,14}$/.test(c) && x.gtin && normalise(x.gtin) === normalise(c)));
    if (v) return { product: p, variantSku: v.sku };
    if (/^\d{8,14}$/.test(c) && (p.identifiers ?? []).some((i) => /^\d{8,14}$/.test(i.value) && normalise(i.value) === normalise(c))) return { product: p, variantSku: null };
    if ((p.integrationMapping ?? []).some((m) => m.externalId.toLowerCase() === lc)) return { product: p, variantSku: null };
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Opening stock                                                      */
/* ------------------------------------------------------------------ */

interface StockResolved { warehouseId: string; productId: string; variantSku: string | null; batch: string; serial: string | null; mfgDate: string | null; expiryDate: string | null; qty: number; unitCost: number | null }

const openingStock: ImportEntity = {
  id: 'opening-stock',
  label: 'Opening stock',
  module: 'inventory',
  description: 'Stock on hand by warehouse, bin, batch / serial and expiry — e.g. an ERP stock report at a cut-off date. Recorded as opening-balance entries, so it can be undone.',
  columns: [
    { key: 'warehouse', label: 'Warehouse code', required: true, example: 'WH-MEDC-06', aliases: ['plant', 'warehouse', 'warehousecode', 'whcode', 'location', 'depot', 'godown'] },
    { key: 'bin', label: 'Bin', example: 'A-01-03', aliases: ['bin', 'binlocation', 'storagelocation', 'storagebin', 'rack', 'shelf'] },
    { key: 'product', label: 'Product code / SKU / GTIN / ERP code', required: true, example: 'EVO-TRAY-SZ3-10L', aliases: ['material', 'materialcode', 'item', 'itemcode', 'sku', 'productcode', 'gtin', 'barcode'] },
    { key: 'batch', label: 'Batch / lot', example: 'B2611A', aliases: ['batch', 'lot', 'batchno', 'lotno', 'charg'] },
    { key: 'serial', label: 'Serial no.', example: 'SN000123', aliases: ['serial', 'serialno', 'serialnumber', 'sernr'], hint: 'Serial-tracked items: one row per unit, quantity 1' },
    { key: 'mfg', label: 'Mfg date', example: '2026-01-15', aliases: ['mfgdate', 'manufacturingdate', 'mfd', 'productiondate'] },
    { key: 'expiry', label: 'Expiry date', example: '2030-12-31', aliases: ['expiry', 'expirydate', 'exp', 'sled', 'shelflifeexpirationdate', 'shelflifeexpiration', 'bestbefore'] },
    { key: 'qty', label: 'Quantity', required: true, example: '25', aliases: ['qty', 'quantity', 'stock', 'onhand', 'unrestricted', 'closingstock'] },
    { key: 'cost', label: 'Unit cost (₹)', example: '18500', aliases: ['cost', 'unitcost', 'rate', 'valuationprice', 'mapprice', 'movingavgprice', 'movingaverageprice'] },
  ],
  options: [{ key: 'status', label: 'Stock status after import', default: 'Available', choices: [{ value: 'Available', label: 'Available — already QC released in the ERP' }, { value: 'Quarantine', label: 'Quarantine — QC must release it in VinFlux' }] }],
  validate: (rows, ctx) => {
    const serials = serialsInStock();
    const seenSerial = new Set<string>();
    const seenBatch = new Map<string, number>();
    return rows.map((v, i): RowResult => {
      const errors: string[] = []; const warnings: string[] = [];
      const wh = ctx.warehouses.find((w) => w.code.toLowerCase() === v.warehouse.toLowerCase() || w.id.toLowerCase() === v.warehouse.toLowerCase());
      if (!v.warehouse) errors.push('Warehouse is missing.');
      else if (!wh) errors.push(`Unknown warehouse “${v.warehouse}”.`);
      else if (wh.status !== 'Active') errors.push(`Warehouse ${wh.code} is inactive.`);
      const hit = findProduct(v.product, ctx.products);
      if (!v.product) errors.push('Product is missing.');
      else if (!hit) errors.push(`Unknown product “${v.product}” (not a product code, SKU, GTIN or ERP code).`);
      else if (hit.product.lifecycleStatus === 'Retired') errors.push(`${hit.product.name} is retired.`);
      const p = hit?.product;
      const tracking = p?.trackingMode ?? 'None';
      const qty = parseNumber(v.qty);
      if (qty === undefined) errors.push('Quantity is missing.');
      else if (qty === null || !Number.isInteger(qty)) errors.push(`Quantity “${v.qty}” must be a whole number.`);
      else if (qty <= 0) errors.push('Quantity must be more than 0.');
      if (tracking.includes('Batch') && !v.batch) errors.push(`${p?.name ?? 'Product'} is batch-tracked — batch is required.`);
      if (tracking.includes('Serial')) {
        if (!v.serial) errors.push(`${p?.name ?? 'Product'} is serial-tracked — serial number is required.`);
        else {
          if (qty && qty !== 1) errors.push('Serial-tracked items need one row per unit (quantity 1).');
          const k = `${p?.id}|${v.serial}`;
          if (seenSerial.has(k)) errors.push(`Serial ${v.serial} appears twice in this file.`);
          else if (serials.has(k)) errors.push(`Serial ${v.serial} is already in stock.`);
          seenSerial.add(k);
        }
      }
      const mfg = parseDate(v.mfg); const exp = parseDate(v.expiry);
      if (mfg === null) errors.push(`Mfg date “${v.mfg}” is not a date.`);
      if (exp === null) errors.push(`Expiry date “${v.expiry}” is not a date.`);
      if (p?.trackingRules?.expiryDateRequired && exp === undefined) errors.push(`${p.name} needs an expiry date.`);
      if (exp) {
        if (exp < today()) errors.push(`Batch ${v.batch || ''} expired on ${exp}.`.replace('  ', ' '));
        else {
          const left = daysBetween(today(), exp);
          const min = p?.trackingRules?.minShelfLifeDistributorDays ?? 0;
          if (min && left < min) warnings.push(`Only ${left} days of shelf life left (distributor minimum ${min}).`);
        }
        if (mfg && mfg > exp) errors.push('Mfg date is after expiry date.');
      }
      if (mfg && mfg > today()) errors.push('Mfg date is in the future.');
      const cost = parseNumber(v.cost);
      if (cost === null || (typeof cost === 'number' && cost < 0)) errors.push(`Unit cost “${v.cost}” is not a valid amount.`);
      if (p && !tracking.includes('Serial') && v.batch && wh) {
        const k = `${wh.id}|${v.bin}|${p.id}|${hit?.variantSku}|${v.batch}`;
        if (seenBatch.has(k)) warnings.push(`Same batch as row ${seenBatch.get(k)} — quantities will be added.`);
        else seenBatch.set(k, i + 2);
      }
      const resolved: StockResolved | undefined = wh && p && typeof qty === 'number' ? {
        warehouseId: wh.id, productId: p.id, variantSku: hit?.variantSku ?? null, batch: v.batch || '—', serial: v.serial || null,
        mfgDate: mfg ?? null, expiryDate: exp ?? null, qty, unitCost: typeof cost === 'number' ? cost : null,
      } : undefined;
      return { row: i + 2, values: v, errors, warnings, action: 'create', resolved };
    });
  },
  apply: (rows, ctx, opts, importId, source) => {
    const status = (opts.status as StockStatus) || 'Available';
    const created = addOpening(rows.map((r) => {
      const x = r.resolved as StockResolved;
      return { ...x, bin: r.values.bin || '', status, importId, source, by: ctx.actor };
    }), ctx.actor, source);
    const units = created.reduce((a, m) => a + m.qty, 0);
    return { refs: { lines: created.length }, summary: `${created.length} stock line(s), ${units.toLocaleString('en-IN')} unit(s) as ${status}` };
  },
  undo: (_refs, ctx, importId) => `${reverseImport(importId, ctx.actor)} stock line(s) reversed`,
};

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */

interface ProductResolved { existing?: Product; patch?: Partial<Product>; create?: Product }

const findBy = <T extends { id: string; name: string; code?: string }>(list: T[], s: string) =>
  list.find((x) => norm(x.name) === norm(s) || (x.code && norm(x.code) === norm(s)) || x.id === s);

const products: ImportEntity = {
  id: 'products',
  label: 'Products',
  module: 'product-master',
  description: 'Product master from an ERP item list. New codes are created as Draft (they go through approval); existing codes have the listed fields updated.',
  columns: [
    { key: 'code', label: 'Product code', required: true, example: 'TIB-INS-PE-03', aliases: ['productcode', 'itemcode', 'material', 'materialcode', 'code', 'sku'] },
    { key: 'name', label: 'Name', required: true, example: 'Tibial Insert Polyethylene Size 3', aliases: ['name', 'productname', 'itemname', 'description', 'materialdescription'], hint: 'Required for new products' },
    { key: 'type', label: 'Product type', example: 'Implantable Medical Device', aliases: ['producttype', 'type', 'materialtype', 'itemgroup'], hint: 'Name or code; required for new products' },
    { key: 'portfolio', label: 'Portfolio', example: 'Arthroplasty — Joint Replacement', aliases: ['portfolio', 'division', 'businessunit'], hint: 'Required for new products' },
    { key: 'category', label: 'Category', example: '', aliases: ['category', 'productgroup'] },
    { key: 'brand', label: 'Brand', example: 'Genius', aliases: ['brand', 'make'] },
    { key: 'hsn', label: 'HSN code', example: '90213100', aliases: ['hsn', 'hsncode', 'hsnsac'] },
    { key: 'gst', label: 'GST rate', example: '5%', aliases: ['gst', 'gstrate', 'taxrate', 'tax'] },
    { key: 'uom', label: 'Base unit', example: 'Each', aliases: ['uom', 'baseuom', 'unit'] },
    { key: 'mrp', label: 'MRP (₹)', example: '24500', aliases: ['mrp', 'maxretailprice', 'listprice'] },
    { key: 'gtin', label: 'GTIN', example: '', aliases: ['gtin', 'ean', 'barcode', 'upc'] },
    { key: 'erp', label: 'ERP code', example: 'MAT-SAP-100231', aliases: ['erpcode', 'externalid', 'sapcode', 'legacycode'] },
    { key: 'tracking', label: 'Tracking', example: 'Batch', aliases: ['tracking', 'trackingmode', 'batchserial'], hint: 'Batch, Serial, Batch + Serial or None — used for new products' },
    { key: 'cost', label: 'Standard cost (₹)', example: '9800', aliases: ['cost', 'standardcost', 'unitcost', 'purchaserate', 'valuationrate'] },
    { key: 'description', label: 'Description', example: '', aliases: ['description', 'longdescription', 'salesdescription'] },
  ],
  validate: (rows, ctx) => {
    const seen = new Map<string, number>();
    const TRACK: Record<string, Product['trackingMode']> = { batch: 'Batch / Lot', 'batch / lot': 'Batch / Lot', lot: 'Batch / Lot', serial: 'Serial', 'batch + serial': 'Batch + Serial', none: 'None' };
    return rows.map((v, i): RowResult => {
      const errors: string[] = []; const warnings: string[] = [];
      const existing = ctx.products.find((p) => p.code.toLowerCase() === v.code.toLowerCase());
      if (!v.code) errors.push('Product code is missing.');
      else if (seen.has(v.code.toLowerCase())) errors.push(`Code ${v.code} appears twice (row ${seen.get(v.code.toLowerCase())}).`);
      seen.set(v.code.toLowerCase(), i + 2);
      if (v.hsn && !/^\d{8}$/.test(v.hsn)) errors.push(`HSN “${v.hsn}” must be 8 digits.`);
      const mrp = parseNumber(v.mrp);
      if (mrp === null || (typeof mrp === 'number' && mrp < 0)) errors.push(`MRP “${v.mrp}” is not a valid amount.`);
      const cost = parseNumber(v.cost ?? '');
      if (cost === null || (typeof cost === 'number' && cost < 0)) errors.push(`Cost “${v.cost}” is not a valid amount.`);
      const tracking = v.tracking ? TRACK[v.tracking.trim().toLowerCase()] : undefined;
      if (v.tracking && !tracking) warnings.push(`Tracking “${v.tracking}” not recognised — the product type's default is used.`);
      if (v.gtin) {
        const e = gtinError(v.gtin);
        if (e) errors.push(`GTIN ${v.gtin}: ${e}`);
        else if (usedGtins(ctx.products, existing?.id ?? null).has(normalise(v.gtin))) errors.push(`GTIN ${v.gtin} belongs to another product.`);
      }
      const gst = v.gst ? (v.gst.endsWith('%') ? v.gst : `${v.gst}%`) : '';
      if (gst && !['0%', '5%', '12%', '18%', '28%'].includes(gst)) warnings.push(`GST rate ${gst} is not a standard slab.`);
      if (existing) {
        if (existing.lifecycleStatus === 'Retired') errors.push(`${existing.code} is retired and can't be updated.`);
        const patch: Partial<Product> = {};
        if (v.name && v.name !== existing.name) patch.name = v.name;
        if (v.brand) patch.brand = v.brand;
        if (v.hsn) patch.hsnCode = v.hsn;
        if (gst) patch.taxRate = gst;
        if (typeof mrp === 'number' || typeof cost === 'number') patch.pricingReference = { ...existing.pricingReference, ...(typeof mrp === 'number' ? { mrp } : {}), ...(typeof cost === 'number' ? { standardCost: cost } : {}) };
        if (v.description && v.description !== existing.description) patch.description = v.description;
        if (tracking && tracking !== existing.trackingMode) warnings.push(`ERP tracks it as “${tracking}”, VinFlux as “${existing.trackingMode}” — not changed automatically; check it in Product Master.`);
        if (v.erp) patch.externalRef = v.erp;
        if (!Object.keys(patch).length) warnings.push('No changes — row will be skipped.');
        if (existing.lifecycleStatus === 'Active' && Object.keys(patch).length) warnings.push('Active product: the change is applied and recorded in its history.');
        return { row: i + 2, values: v, errors, warnings, action: 'update', resolved: { existing, patch } as ProductResolved };
      }
      if (!v.name) errors.push('Name is required for a new product.');
      const type = v.type ? findBy(ctx.productTypes, v.type) : undefined;
      if (!v.type) errors.push('Product type is required for a new product.');
      else if (!type) errors.push(`Unknown product type “${v.type}”.`);
      else if (!ctx.industryPacks.find((pk) => pk.id === packOf(type.id, ctx.productTypes))?.enabled) errors.push(`${type.name} belongs to a switched-off industry pack.`);
      const pf = v.portfolio ? findBy(ctx.portfolios, v.portfolio) : undefined;
      if (!v.portfolio) errors.push('Portfolio is required for a new product.');
      else if (!pf) errors.push(`Unknown portfolio “${v.portfolio}”.`);
      const cat = pf ? (v.category ? findBy(pf.categories, v.category) : pf.categories[0]) : undefined;
      if (pf && v.category && !cat) errors.push(`Category “${v.category}” is not in ${pf.name}.`);
      let create: Product | undefined;
      if (!errors.length && type && pf) {
        const pack = ctx.industryPacks.find((pk) => pk.id === packOf(type.id, ctx.productTypes));
        const now = today();
        create = {
          id: `prod-imp-${Date.now().toString(36)}${i}`, name: v.name, code: v.code, description: v.description ?? '', portfolioId: pf.id, categoryId: cat?.id ?? '', subCategoryId: cat?.subCategories[0]?.id ?? '',
          principalId: '', brand: v.brand, productTypeId: type.id, baseUom: v.uom || 'Each', lifecycleStatus: 'Draft', approvalStatus: 'Draft',
          trackingMode: tracking ?? ((type.defaultTracking as Product['trackingMode']) || pack?.defaultTracking || 'None'), hsnCode: v.hsn || pack?.defaultHsn || '', taxRate: gst || pack?.defaultTax || '18%',
          sourceSystem: 'Data import', externalRef: v.erp, hasVariants: false, variantCount: 0, updatedAt: now, updatedBy: ctx.actor, attributes: {},
          inventoryPolicy: { inheritDefaults: true, minSafetyThreshold: type.defaultMinStockThreshold, reorderPoint: Math.round(type.defaultMinStockThreshold * 1.5), reorderQty: type.defaultMinStockThreshold * 2, leadTimeDays: 30, safetyStockDays: 30 },
          variants: [], identifiers: v.gtin ? [{ type: 'GTIN', value: v.gtin, isPrimary: true, uom: 'Product level', source: 'Import', status: 'Active' }] : [],
          uomHierarchy: [], trackingRules: { mode: tracking ?? type.defaultTracking, mfgDateRequired: (tracking ?? type.defaultTracking) !== 'None', expiryDateRequired: (tracking ?? type.defaultTracking).includes('Batch'), minShelfLifeDistributorDays: 0, minShelfLifeInstitutionDays: 0, udiDiRequired: pack?.id === 'medical-devices', qcInspectionRequired: pack?.id !== 'general' },
          documents: [], pricingReference: { isEngineConnected: false, engineSource: 'Import', lastSync: now, mrp: typeof mrp === 'number' ? mrp : 0, ...(typeof cost === 'number' ? { standardCost: cost } : {}), currency: 'INR', dealerTransferCap: 0, institutionalTenderCap: 0, govPriceCapEnforced: pack?.id === 'medical-devices', marginFloorPercent: 0, priceListsLinked: [] },
          integrationMapping: v.erp ? [{ system: 'ERP (import)', entityType: 'Material', externalId: v.erp, status: 'Mapped', lastSync: now, mappingDirection: 'Inbound' }] : [],
          changeHistory: [{ field: 'Created', prevValue: '--', newValue: 'Draft', changedBy: ctx.actor, changedAt: now, reason: 'Data import' }],
        };
        warnings.push('Created as Draft — complete regulatory / pack fields and submit for approval.');
      }
      return { row: i + 2, values: v, errors, warnings, action: 'create', resolved: { create } as ProductResolved };
    });
  },
  apply: (rows, ctx) => {
    const created = rows.map((r) => (r.resolved as ProductResolved).create).filter(Boolean) as Product[];
    const updates = rows.filter((r) => r.action === 'update' && Object.keys((r.resolved as ProductResolved).patch ?? {}).length)
      .map((r) => { const x = r.resolved as ProductResolved; return { id: x.existing!.id, patch: { ...x.patch!, changeHistory: [{ field: 'Data import', prevValue: '—', newValue: Object.keys(x.patch!).join(', '), changedBy: ctx.actor, changedAt: today(), reason: 'Updated by data import' }, ...(x.existing!.changeHistory ?? [])] } }; });
    const before = updates.map((u) => {
      const p = ctx.products.find((x) => x.id === u.id)!;
      return { id: u.id, values: Object.fromEntries(Object.keys(u.patch).map((k) => [k, p[k as keyof Product]])) as Partial<Product> };
    });
    ctx.importProducts(created, updates);
    if (created.length) emit('product.imported', 'Product Master', ctx.actor, `${created.length} product(s) created as Draft by import`, { ids: created.map((c) => c.id) });
    return { refs: { createdIds: created.map((c) => c.id), before }, summary: `${created.length} created (Draft), ${updates.length} updated` };
  },
  undo: (refs, ctx) => {
    const r = refs as { createdIds: string[]; before: { id: string; values: Partial<Product> }[] };
    if (balances().some((b) => r.createdIds.includes(b.productId) && b.qty > 0)) throw new Error('Some of these products already have stock. Undo the stock import first.');
    ctx.revertProductImport(r.createdIds, r.before);
    return `${r.createdIds.length} product(s) removed, ${r.before.length} restored`;
  },
};

/* ------------------------------------------------------------------ */
/* Price list lines                                                   */
/* ------------------------------------------------------------------ */

const priceLines: ImportEntity = {
  id: 'price-lines',
  label: 'Price list prices',
  module: 'price-lists',
  description: 'Prices (and quantity slabs) into a draft price list or rate contract — e.g. a price list exported from the ERP or a tender sheet. The list still goes through approval.',
  columns: [
    { key: 'product', label: 'Product code / SKU / GTIN / ERP code', required: true, example: 'PRD-EVOCON-001', aliases: ['material', 'materialcode', 'item', 'itemcode', 'sku', 'productcode', 'gtin'] },
    { key: 'price', label: 'Price ex-GST (₹)', required: true, example: '33500', aliases: ['price', 'rate', 'netprice', 'listprice', 'basicprice', 'kbetr', 'amount'] },
    { key: 'slab1Qty', label: 'Slab 1 from qty', example: '10', aliases: ['slab1qty', 'slabqty', 'minqty', 'scaleqty', 'scalequantity'] },
    { key: 'slab1Price', label: 'Slab 1 price', example: '32800', aliases: ['slab1price', 'slabprice', 'scaleprice', 'scaleamount'] },
    { key: 'slab2Qty', label: 'Slab 2 from qty', example: '25', aliases: ['slab2qty', 'scaleqty2'] },
    { key: 'slab2Price', label: 'Slab 2 price', example: '32000', aliases: ['slab2price', 'scaleamount2'] },
  ],
  get options() {
    const drafts = priceLists().filter((l) => ['Draft', 'Rejected'].includes(l.status));
    return [{ key: 'list', label: 'Into which draft list', default: drafts[0]?.id ?? '',
      choices: drafts.length ? drafts.map((l) => ({ value: l.id, label: `${l.name || l.code} v${l.version} (${l.status})` })) : [{ value: '', label: 'No draft lists — create one in Price Lists first' }] }];
  },
  validate: (rows, ctx, opts) => {
    const list = getList(opts.list ?? '');
    const seen = new Map<string, number>();
    return rows.map((v, i): RowResult => {
      const errors: string[] = []; const warnings: string[] = [];
      if (!list) errors.push('Choose a draft price list (create one in Price Lists first).');
      const hit = findProduct(v.product, ctx.products);
      if (!v.product) errors.push('Product is missing.');
      else if (!hit) errors.push(`Unknown product “${v.product}”.`);
      else if (list && hit.product.principalId !== list.principalId) errors.push(`${hit.product.name} belongs to another principal.`);
      const price = parseNumber(v.price);
      if (price === undefined) errors.push('Price is missing.');
      else if (price === null || price <= 0) errors.push(`Price “${v.price}” is not valid.`);
      const slabs: { minQty: number; price: number }[] = [];
      ([['slab1Qty', 'slab1Price'], ['slab2Qty', 'slab2Price']] as const).forEach(([qk, pk]) => {
        const q = parseNumber(v[qk] ?? ''); const sp = parseNumber(v[pk] ?? '');
        if (q === undefined && sp === undefined) return;
        if (typeof q !== 'number' || typeof sp !== 'number') errors.push(`${qk.startsWith('slab1') ? 'Slab 1' : 'Slab 2'} needs both a quantity and a price.`);
        else slabs.push({ minQty: q, price: sp });
      });
      let line: PriceLine | undefined;
      if (hit && typeof price === 'number' && price > 0 && list) {
        line = { id: newId('ln'), productId: hit.product.id, price, slabs };
        const k = hit.product.id;
        if (seen.has(k)) errors.push(`Same product as row ${seen.get(k)}.`); else seen.set(k, i + 2);
        checkList({ ...list, lines: [line] }, ctx.products).forEach((x) => (x.level === 'error' ? errors : warnings).push(x.text));
      }
      const exists = !!(list && hit && list.lines.some((x) => x.productId === hit.product.id));
      return { row: i + 2, values: v, errors, warnings, action: exists ? 'update' : 'create', resolved: line };
    });
  },
  apply: (rows, ctx, opts) => {
    const list = getList(opts.list)!;
    const incoming = rows.map((r) => r.resolved as PriceLine);
    const lines = [...list.lines.filter((x) => !incoming.some((n) => n.productId === x.productId)), ...incoming];
    setLines(list.id, lines, ctx.actor, `Imported ${incoming.length} price(s)`);
    return { refs: { listId: list.id, before: list.lines }, summary: `${incoming.length} price(s) into ${list.name || list.code} v${list.version}` };
  },
  undo: (refs, ctx) => {
    const r = refs as { listId: string; before: PriceLine[] };
    const list = getList(r.listId);
    if (!list || !['Draft', 'Rejected'].includes(list.status)) throw new Error('The list was already submitted — undo is no longer possible.');
    setLines(r.listId, r.before, ctx.actor, 'Import undone');
    return `Prices restored on ${list.name || list.code}`;
  },
};

/* ------------------------------------------------------------------ */
/* Partner stock report (channel stock)                               */
/* ------------------------------------------------------------------ */

interface ChannelResolved { partnerId: string; locType: LocType; productId: string; variantSku: string | null; batch: string; serial: string | null; expiryDate: string | null; qty: number }
const channelStock: ImportEntity = {
  id: 'channel-stock',
  label: 'Partner stock report',
  module: 'inventory',
  description: 'Stock held by C&F agents, distributors and hospitals (consignment) — e.g. a monthly stock statement. Each report replaces that holder’s previous figures; it can be undone.',
  columns: [
    { key: 'partner', label: 'Partner code or name', required: true, example: 'PTR-0002', aliases: ['partner', 'partnercode', 'distributor', 'stockist', 'customer', 'party'] },
    { key: 'product', label: 'Product code / SKU / GTIN', required: true, example: 'EVO-TRAY-SZ3-10L', aliases: ['material', 'item', 'itemcode', 'sku', 'productcode', 'gtin'] },
    { key: 'batch', label: 'Batch / lot', example: 'B2611A', aliases: ['batch', 'lot', 'batchno'] },
    { key: 'serial', label: 'Serial no.', example: '', aliases: ['serial', 'serialno'] },
    { key: 'expiry', label: 'Expiry date', example: '2030-12-31', aliases: ['expiry', 'expirydate', 'exp'] },
    { key: 'qty', label: 'Closing quantity', required: true, example: '12', aliases: ['qty', 'quantity', 'closing', 'closingqty', 'closingstock', 'stock'] },
  ],
  validate: (rows, ctx) => rows.map((v, i): RowResult => {
    const errors: string[] = []; const warnings: string[] = [];
    const p = (ctx.partners ?? []).find((x) => x.code.toLowerCase() === v.partner.trim().toLowerCase() || x.name.toLowerCase() === v.partner.trim().toLowerCase());
    if (!p) errors.push(`Unknown partner “${v.partner}”.`);
    else if (p.status !== 'Active') warnings.push(`${p.name} is ${p.status}.`);
    const hit = findProduct(v.product, ctx.products);
    if (!hit) errors.push(`Unknown product “${v.product}”.`);
    const qty = parseNumber(v.qty);
    if (typeof qty !== 'number' || qty < 0) errors.push(`Quantity “${v.qty}” is not valid.`);
    const exp = parseDate(v.expiry);
    if (exp === null) errors.push(`Expiry “${v.expiry}” is not a date.`);
    if (exp && exp < today()) warnings.push(`Batch ${v.batch} expired on ${exp} — it will show as expired channel stock.`);
    const locType: LocType = p?.partnerTypeId === 'pt-cnf' ? 'CNF' : p?.institution ? 'HOSPITAL' : 'PARTNER';
    const resolved: ChannelResolved | undefined = p && hit && typeof qty === 'number' ? { partnerId: p.id, locType, productId: hit.product.id, variantSku: hit.variantSku, batch: v.batch || '—', serial: v.serial || null, expiryDate: exp ?? null, qty } : undefined;
    return { row: i + 2, values: v, errors, warnings, action: 'update', resolved };
  }),
  apply: (rows, ctx, _opts, importId, source) => {
    const lines = rows.map((r) => r.resolved as ChannelResolved);
    const holders = Array.from(new Set(lines.map((l) => l.partnerId)));
    // A stock report is a full count: zero the holder's old figures, then post the reported ones.
    const old = balances().filter((b) => holders.includes(b.warehouseId) && b.locType !== 'TRANSIT' && b.locType !== 'COMPANY');
    const base = { bin: '', mfgDate: null, unitCost: null, status: 'Available' as const, importId, source: `Partner stock report (${source})`, by: ctx.actor, refId: null };
    post([
      ...old.map((b) => ({ ...base, type: 'PARTNER_REPORT' as const, locType: b.locType, warehouseId: b.warehouseId, productId: b.productId, variantSku: b.variantSku, batch: b.batch, serial: b.serial, expiryDate: b.expiryDate, unitCost: b.unitCost, status: b.status, qty: -b.qty })),
      ...lines.filter((l) => l.qty > 0).map((l) => ({ ...base, type: 'PARTNER_REPORT' as const, locType: l.locType, warehouseId: l.partnerId, productId: l.productId, variantSku: l.variantSku, batch: l.batch, serial: l.serial, expiryDate: l.expiryDate, qty: l.qty, unitCost: ctx.products.find((p) => p.id === l.productId)?.pricingReference?.standardCost ?? null })),
    ]);
    return { refs: { holders }, summary: `${lines.length} line(s) for ${holders.length} holder(s); previous figures replaced` };
  },
  undo: (_refs, ctx, importId) => `${reverseImport(importId, ctx.actor)} stock line(s) reversed`,
};

export const ENTITIES: ImportEntity[] = [openingStock, products, priceLines, channelStock];

/** Auto-match file headers to entity columns (exact key, label or known ERP alias). */
export const autoMatch = (headers: string[], entity: ImportEntity, saved?: Record<string, string>): Record<string, string> => {
  const map: Record<string, string> = {};
  entity.columns.forEach((c) => {
    const fromSaved = saved?.[c.key];
    if (fromSaved && headers.includes(fromSaved)) { map[c.key] = fromSaved; return; }
    const h = headers.find((x) => [c.key, c.label, ...c.aliases].some((a) => norm(a) === norm(x)));
    if (h) map[c.key] = h;
  });
  return map;
};

export const rowsFromTable = (table: string[][], mapping: Record<string, string>, entity: ImportEntity): RowValues[] => {
  const [head, ...body] = table;
  const idx = (k: string) => (mapping[k] ? head.indexOf(mapping[k]) : -1);
  return body.map((r) => Object.fromEntries(entity.columns.map((c) => [c.key, idx(c.key) >= 0 ? (r[idx(c.key)] ?? '').trim() : ''])));
};
