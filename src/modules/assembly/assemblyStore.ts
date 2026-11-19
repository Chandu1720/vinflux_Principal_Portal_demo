/**
 * Assembly and kitting (SU2) — for principals that buy parts and assemble, test and pack in VinFlux (no ERP for it),
 * and for building kits / instrument sets from single products.
 * ASM-01 An assembly order starts only when its components are available; shortages show which purchase orders cover them.
 * ASM-02 Completing consumes components and creates the finished batch / serials in Quarantine until final QC accepts them.
 * ASM-03 Serial-tracked components are recorded per finished unit; the link (genealogy) is permanent.
 * ASM-04 Disassembling returns the components to stock with the same lots and serials.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { emit } from '../../platform/events';
import { opt } from '../../platform/moduleOptions';
import type { Product } from '../../types/product.ts';
import { balances, post } from '../inventory/stockStore';
import type { StockBalance } from '../inventory/stockStore';
import { pos } from '../procurement/procurementStore';

export interface BomLine { productId: string; qty: number }
export interface Bom { id: string; principalId: string; productId: string; kind: 'Assembly' | 'Kit'; version: number; effectiveFrom: string; lines: BomLine[]; active: boolean; note: string }
export interface Consumed { productId: string; batch: string; serial: string | null; expiry: string | null; qty: number; unitCost: number | null; forUnit: string | null }
export type AsmStatus = 'Planned' | 'Completed' | 'Disassembled' | 'Cancelled';
export interface AsmOrder {
  id: string; no: string; principalId: string; bomId: string; bomVersion: number; productId: string; qty: number; warehouseId: string; planned: string;
  status: AsmStatus; consumed: Consumed[]; outputBatch: string | null; outputSerials: string[]; outputStatus: 'Quarantine' | 'Available' | null; scrap: string;
  createdBy: string; history: { at: string; by: string; action: string; note?: string }[];
}
interface Db { boms: Bom[]; orders: AsmOrder[]; seq: number; seeded: string[] }
const now = () => new Date().toISOString();
const KEY = () => workspaceKey('vinflux.assembly.v1');
let cache: { key: string; d: Db } | null = null;
const listeners = new Set<() => void>();
const db = (): Db => {
  if (!cache || cache.key !== KEY()) { const x = loadJson<Partial<Db> | null>(KEY(), null); cache = { key: KEY(), d: { boms: Array.isArray(x?.boms) ? x!.boms : [], orders: Array.isArray(x?.orders) ? x!.orders : [], seq: x?.seq ?? 1100, seeded: Array.isArray(x?.seeded) ? x!.seeded : [] } }; }
  return cache.d;
};
const commit = (d: Db) => { cache = { key: KEY(), d }; saveJson(KEY(), d); listeners.forEach((l) => l()); };
export const subscribeAssembly = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
type R = { ok: boolean; message: string; errors?: string[] };
const serialised = (p?: Product) => ((p?.trackingRules?.mode ?? p?.trackingMode ?? '') as string).includes('Serial');

export const boms = (principalId: string) => db().boms.filter((b) => b.principalId === principalId);
export const asmOrders = (principalId: string) => db().orders.filter((o) => o.principalId === principalId);
export const getAsm = (id: string) => db().orders.find((o) => o.id === id) ?? null;

/** Save a BOM. Changing an active BOM's components creates a new version from today; orders keep the version they used. */
export const saveBom = (b: Bom): R => {
  const errs: string[] = [];
  if (!b.productId) errs.push('Choose the finished product or kit.');
  if (!b.lines.length) errs.push('Add at least one component.');
  if (b.lines.some((l) => l.productId === b.productId)) errs.push('A product can’t be its own component.');
  if (b.lines.some((l) => !(l.qty > 0))) errs.push('Every component needs a quantity.');
  if (new Set(b.lines.map((l) => l.productId)).size !== b.lines.length) errs.push('A component is listed twice — combine the quantities.');
  if (errs.length) return { ok: false, message: 'Can’t save the bill of materials.', errors: errs };
  const d = db();
  if (!b.id) { commit({ ...d, boms: [...d.boms.map((x) => (x.productId === b.productId && x.principalId === b.principalId ? { ...x, active: false } : x)), { ...b, id: newId('bom'), version: 1 }] }); return { ok: true, message: 'Bill of materials saved.' }; }
  const old = d.boms.find((x) => x.id === b.id)!;
  const changed = JSON.stringify(old.lines) !== JSON.stringify(b.lines);
  if (changed && d.orders.some((o) => o.bomId === old.id)) {
    commit({ ...d, boms: [...d.boms.map((x) => (x.id === old.id ? { ...x, active: false } : x)), { ...b, id: newId('bom'), version: old.version + 1, effectiveFrom: now().slice(0, 10), active: true }] });
    return { ok: true, message: `Version ${old.version + 1} saved — orders already made keep version ${old.version}.` };
  }
  commit({ ...d, boms: d.boms.map((x) => (x.id === b.id ? b : x)) });
  return { ok: true, message: 'Bill of materials saved.' };
};

const avail = (warehouseId: string, productId: string, all: StockBalance[] = balances()) => all.filter((b) => b.warehouseId === warehouseId && b.productId === productId && b.status === 'Available' && b.qty > 0 && (b.locType ?? 'COMPANY') === 'COMPANY');
/** ASM-01: what each component needs, what is available, and which open purchase orders would cover a shortage. */
export const availability = (bom: Bom, qty: number, warehouseId: string) => {
  const all = balances();
  return bom.lines.map((l) => {
    const need = l.qty * qty; const have = avail(warehouseId, l.productId, all).reduce((a, b) => a + b.qty, 0);
    const cover = need > have ? pos(bom.principalId).filter((p) => ['Sent', 'Acknowledged', 'Part received', 'Approved'].includes(p.status) && p.lines.some((x) => x.productId === l.productId)).map((p) => `${p.no} (${p.ack?.promisedDate ?? p.deliveryDate})`) : [];
    return { productId: l.productId, need, have, short: Math.max(0, need - have), cover };
  });
};

export const createAsm = (principalId: string, bomId: string, qty: number, warehouseId: string, planned: string, by: string): R & { id?: string } => {
  const b = db().boms.find((x) => x.id === bomId); if (!b) return { ok: false, message: 'Choose the bill of materials.' };
  if (!(qty > 0)) return { ok: false, message: 'Quantity must be more than 0.' };
  if (!warehouseId) return { ok: false, message: 'Choose where it is assembled.' };
  const d = db(); const seq = d.seq + 1;
  const o: AsmOrder = { id: newId('asm'), no: `AO-26-${seq}`, principalId, bomId, bomVersion: b.version, productId: b.productId, qty, warehouseId, planned, status: 'Planned', consumed: [], outputBatch: null, outputSerials: [], outputStatus: null, scrap: '', createdBy: by,
    history: [{ at: now(), by, action: `${b.kind === 'Kit' ? 'Kit build' : 'Assembly'} order created`, note: `${qty} unit(s), BOM v${b.version}` }] };
  commit({ ...d, seq, orders: [o, ...d.orders] });
  return { ok: true, message: `${o.no} planned.`, id: o.id };
};

/** ASM-02 / ASM-03: consume components first-expiry-first-out, create the finished batch and serials with their genealogy. */
export const completeAsm = (id: string, products: Product[], by: string): R => {
  const o = getAsm(id); if (!o || o.status !== 'Planned') return { ok: false, message: 'Only a planned order can be completed.' };
  const b = db().boms.find((x) => x.id === o.bomId)!;
  const short = availability(b, o.qty, o.warehouseId).filter((x) => x.short > 0);
  if (short.length) return { ok: false, message: 'Components are short (ASM-01).', errors: short.map((s) => `${products.find((p) => p.id === s.productId)?.name ?? s.productId}: need ${s.need}, have ${s.have}${s.cover.length ? ` — covered by ${s.cover.join(', ')}` : ' — no purchase order covers it'}`) };
  const fin = products.find((p) => p.id === o.productId);
  const finSer = serialised(fin);
  const batch = `AS${String(o.no.slice(-4))}${now().slice(2, 4)}`;
  const units = finSer ? Array.from({ length: o.qty }, (_, i) => `${batch}-${String(i + 1).padStart(3, '0')}`) : [];
  const consumed: Consumed[] = [];
  const all = balances();
  for (const l of b.lines) {
    const comp = products.find((p) => p.id === l.productId);
    const lots = avail(o.warehouseId, l.productId, all).sort((x, y) => (x.expiryDate ?? '9999').localeCompare(y.expiryDate ?? '9999'));
    let left = l.qty * o.qty; let unitIdx = 0;
    for (const lot of lots) {
      if (left <= 0) break;
      if (serialised(comp) && lot.serial) {
        // One serial per finished unit (ASM-03).
        const forUnit = finSer ? units[Math.floor(unitIdx / l.qty)] ?? null : null; unitIdx++;
        consumed.push({ productId: l.productId, batch: lot.batch, serial: lot.serial, expiry: lot.expiryDate, qty: 1, unitCost: lot.unitCost, forUnit }); left -= 1;
      } else {
        const take = Math.min(left, lot.qty);
        consumed.push({ productId: l.productId, batch: lot.batch, serial: lot.serial, expiry: lot.expiryDate, qty: take, unitCost: lot.unitCost, forUnit: null }); left -= take;
      }
    }
  }
  const quarantine = opt('inventory', 'quarantine');
  const cost = consumed.reduce((a, c) => a + (c.unitCost ?? 0) * c.qty, 0) / o.qty;
  const outStatus = quarantine ? 'Quarantine' as const : 'Available' as const;
  const expiry = consumed.map((c) => c.expiry).filter(Boolean).sort()[0] ?? null;
  post([
    ...consumed.map((c) => ({ type: 'ISSUE' as const, locType: 'COMPANY' as const, warehouseId: o.warehouseId, bin: 'ASSEMBLY', productId: c.productId, variantSku: null, batch: c.batch, serial: c.serial, mfgDate: null, expiryDate: c.expiry, qty: -c.qty, unitCost: c.unitCost, status: 'Available' as const, importId: null, source: `Consumed by ${o.no}`, by, refId: o.id })),
    ...(finSer ? units.map((u) => ({ sn: u, q: 1 })) : [{ sn: null as string | null, q: o.qty }]).map((u) => ({ type: 'RECEIPT' as const, locType: 'COMPANY' as const, warehouseId: o.warehouseId, bin: quarantine ? 'QC' : 'MAIN', productId: o.productId, variantSku: null, batch, serial: u.sn, mfgDate: now().slice(0, 10), expiryDate: expiry, qty: u.q, unitCost: Math.round(cost * 100) / 100, status: outStatus, importId: null, source: `Assembled by ${o.no}`, by, refId: o.id })),
  ]);
  const next: AsmOrder = { ...o, status: 'Completed', consumed, outputBatch: batch, outputSerials: units, outputStatus: outStatus, history: [...o.history, { at: now(), by, action: 'Completed', note: `${consumed.length} component lot(s)/serial(s) consumed → batch ${batch}${quarantine ? ' in Quarantine for final QC' : ''}` }] };
  commit({ ...db(), orders: db().orders.map((x) => (x.id === id ? next : x)) });
  emit('stock.received', 'Assembly', by, `${o.no}: ${o.qty} × ${fin?.name ?? o.productId} assembled (batch ${batch})`, { asmId: o.id });
  return { ok: true, message: `${o.no} completed — batch ${batch}${units.length ? `, ${units.length} serials` : ''}${quarantine ? ' in Quarantine until final QC releases it' : ' available'}.` };
};

/** Final QC on the finished batch (assembly orders don't go through purchase receipts). */
export const releaseAsm = (id: string, by: string): R => {
  const o = getAsm(id); if (!o || o.status !== 'Completed' || o.outputStatus !== 'Quarantine') return { ok: false, message: 'Nothing in Quarantine for this order.' };
  if (o.createdBy === by || o.history.some((h) => h.action === 'Completed' && h.by === by)) return { ok: false, message: 'Maker-checker: final QC is by someone other than who planned or completed the assembly.' };
  const rows = (o.outputSerials.length ? o.outputSerials.map((s) => ({ s, q: 1 })) : [{ s: null as string | null, q: o.qty }]);
  const base = { locType: 'COMPANY' as const, warehouseId: o.warehouseId, productId: o.productId, variantSku: null, batch: o.outputBatch!, mfgDate: null, expiryDate: null, unitCost: null, importId: null, by, refId: o.id };
  post(rows.flatMap((u) => [{ ...base, type: 'ADJUSTMENT' as const, bin: 'QC', serial: u.s, qty: -u.q, status: 'Quarantine' as const, source: `Final QC ${o.no}` }, { ...base, type: 'ADJUSTMENT' as const, bin: 'MAIN', serial: u.s, qty: u.q, status: 'Available' as const, source: `Final QC ${o.no}` }]));
  commit({ ...db(), orders: db().orders.map((x) => (x.id === id ? { ...x, outputStatus: 'Available', history: [...x.history, { at: now(), by, action: 'Final QC passed — released to sale' }] } : x)) });
  return { ok: true, message: `${o.no}: batch ${o.outputBatch} released to sale.` };
};

/** ASM-04: take finished units apart; components return with the same lots and serials. */
export const disassemble = (id: string, by: string, reason: string): R => {
  const o = getAsm(id); if (!o || o.status !== 'Completed') return { ok: false, message: 'Only a completed order can be disassembled.' };
  if (!reason.trim()) return { ok: false, message: 'Give the reason.' };
  const held = balances().filter((b) => b.warehouseId === o.warehouseId && b.productId === o.productId && b.batch === o.outputBatch && b.qty > 0);
  const units = held.reduce((a, b) => a + b.qty, 0);
  if (units < o.qty) return { ok: false, message: `Only ${units} of ${o.qty} unit(s) of batch ${o.outputBatch} are still in this warehouse — the rest were sold or moved.` };
  post([
    ...held.map((b) => ({ type: 'ADJUSTMENT' as const, locType: 'COMPANY' as const, warehouseId: o.warehouseId, bin: b.bin, productId: o.productId, variantSku: null, batch: b.batch, serial: b.serial, mfgDate: null, expiryDate: b.expiryDate, qty: -b.qty, unitCost: null, status: b.status, importId: null, source: `Disassembled ${o.no}`, by, refId: o.id })),
    ...o.consumed.map((c) => ({ type: 'RECEIPT' as const, locType: 'COMPANY' as const, warehouseId: o.warehouseId, bin: 'MAIN', productId: c.productId, variantSku: null, batch: c.batch, serial: c.serial, mfgDate: null, expiryDate: c.expiry, qty: c.qty, unitCost: c.unitCost, status: 'Available' as const, importId: null, source: `Returned from ${o.no}`, by, refId: o.id })),
  ]);
  commit({ ...db(), orders: db().orders.map((x) => (x.id === id ? { ...x, status: 'Disassembled', history: [...x.history, { at: now(), by, action: 'Disassembled', note: reason }] } : x)) });
  return { ok: true, message: `${o.no} disassembled — components back in stock with their original lots and serials.` };
};

/** Genealogy: a finished serial/batch → its components; a component serial/lot → every finished unit built with it. */
export const trace = (principalId: string, code: string) => {
  const c = code.trim().toLowerCase(); if (!c) return { down: [] as { order: AsmOrder; unit: string | null; parts: Consumed[] }[], up: [] as { order: AsmOrder; unit: string | null; part: Consumed }[] };
  const os = asmOrders(principalId).filter((o) => o.status !== 'Cancelled');
  const down = os.filter((o) => o.outputBatch?.toLowerCase() === c || o.outputSerials.some((s) => s.toLowerCase() === c)).map((o) => {
    const unit = o.outputSerials.find((s) => s.toLowerCase() === c) ?? null;
    return { order: o, unit, parts: unit ? o.consumed.filter((x) => x.forUnit === unit || x.forUnit === null) : o.consumed };
  });
  const up = os.flatMap((o) => o.consumed.filter((x) => x.batch.toLowerCase() === c || x.serial?.toLowerCase() === c).map((part) => ({ order: o, unit: part.forUnit, part })));
  return { down, up };
};

/** Demo: an instrument-set kit built from two products, with component stock in the assembly warehouse. */
export const ensureAssemblyDemo = (principalId: string, products: Product[], warehouseId: string) => {
  const d = db(); if (d.seeded.includes(principalId) || products.length < 3 || !warehouseId) return;
  commit({ ...d, seeded: [...d.seeded, principalId] });
  const act = products.filter((p) => p.lifecycleStatus === 'Active'); if (act.length < 3) return;
  const [fin, a, b] = [act[1], act[0], act[2]];
  saveBom({ id: '', principalId, productId: fin.id, kind: 'Kit', version: 1, effectiveFrom: now().slice(0, 10), lines: [{ productId: a.id, qty: 1 }, { productId: b.id, qty: 4 }], active: true, note: 'Demo kit: one tray and four gauze packs per set' });
  const serA = serialised(a);
  post([
    ...(serA ? Array.from({ length: 6 }, (_, i) => ({ s: `CMP-${String(i + 1).padStart(3, '0')}`, q: 1 })) : [{ s: null as string | null, q: 6 }]).map((u) => ({ type: 'OPENING' as const, locType: 'COMPANY' as const, warehouseId, bin: 'MAIN', productId: a.id, variantSku: null, batch: 'CMPA2611', serial: u.s, mfgDate: null, expiryDate: null, qty: u.q, unitCost: a.pricingReference?.standardCost ?? 20000, status: 'Available' as const, importId: null, source: 'Component stock for assembly (demo)', by: 'System', refId: null })),
    { type: 'OPENING' as const, locType: 'COMPANY' as const, warehouseId, bin: 'MAIN', productId: b.id, variantSku: null, batch: 'CMPB2611', serial: null, mfgDate: null, expiryDate: new Date(Date.now() + 500 * 86400000).toISOString().slice(0, 10), qty: 40, unitCost: b.pricingReference?.standardCost ?? 300, status: 'Available' as const, importId: null, source: 'Component stock for assembly (demo)', by: 'System', refId: null },
  ]);
};
