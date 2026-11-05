/**
 * Price Lists & Rate Contracts.
 *  - CHANNEL list: price for every partner in a sales channel (optionally only in some territories).
 *  - PARTNER list: special prices for one partner.
 *  - CONTRACT: hospital / institution rate contract (tender), one or more hospitals, fixed validity.
 * Every list goes Draft → Pending → Active (maker-checker). Activating a new version supersedes the old one.
 * Price lookup waterfall: contract > partner list > channel list (territory-specific first), then quantity slab,
 * then the partner's invoice discount from Go-to-Market terms, then schemes, then GST.
 * INTEGRATION POINT: GET|POST /price-lists, /schemes, POST /price-lists/{id}/submit|approve|reject, GET /price/quote.
 */
import type { Product } from '../../types/product.ts';
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';

export type ListType = 'CHANNEL' | 'PARTNER' | 'CONTRACT';
export type ListStatus = 'Draft' | 'Pending' | 'Active' | 'Superseded' | 'Rejected';

export interface Slab { minQty: number; price: number }
export interface PriceLine { id: string; productId: string; price: number; slabs: Slab[] }

export interface PriceList {
  id: string;
  code: string;
  name: string;
  type: ListType;
  principalId: string;
  channelId: string | null;
  /** PARTNER: one partner; CONTRACT: one or more hospitals. */
  partnerIds: string[];
  /** CHANNEL only; empty = everywhere. */
  territoryIds: string[];
  validFrom: string;
  validTo: string | null;
  version: number;
  /** Lists that are versions of each other share a family id. */
  familyId: string;
  status: ListStatus;
  lines: PriceLine[];
  contractRef?: string;
  /** Lists created together by a multi-channel revision share a batch and are approved together. */
  batchId?: string | null;
  committedValue?: number | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  history: { at: string; by: string; action: string; note?: string }[];
}

export interface Scheme {
  id: string;
  name: string;
  kind: 'FREE_QTY' | 'EXTRA_DISCOUNT';
  principalId: string;
  channelIds: string[];
  productIds: string[];
  buyQty: number;
  freeQty: number;
  discountPct: number;
  validFrom: string;
  validTo: string;
  status: 'Active' | 'Paused';
}

export const TYPE_LABEL: Record<ListType, string> = { CHANNEL: 'Channel price list', PARTNER: 'Partner price list', CONTRACT: 'Rate contract' };
export const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
export const gstOf = (p?: Product) => (p ? parseFloat(p.taxRate) || 0 : 0);

/* --------------------------------- Seed --------------------------------- */

const L = (productId: string, price: number, slabs: Slab[] = []): PriceLine => ({ id: `${productId}-${price}`, productId, price, slabs });
const base = (x: Partial<PriceList> & Pick<PriceList, 'id' | 'code' | 'name' | 'type' | 'lines'>): PriceList => ({
  principalId: 'princ-biorad', channelId: null, partnerIds: [], territoryIds: [], validFrom: '2026-04-01', validTo: null, version: 1, familyId: x.id,
  status: 'Active', notes: '', createdBy: 'Priya Menon', createdAt: '2026-03-20', submittedBy: 'Priya Menon', submittedAt: '2026-03-22',
  approvedBy: 'Meera Iyer', approvedAt: '2026-03-25', rejectionReason: null,
  history: [{ at: '2026-03-20T10:00:00Z', by: 'Priya Menon', action: 'Created' }, { at: '2026-03-22T10:00:00Z', by: 'Priya Menon', action: 'Submitted' }, { at: '2026-03-25T10:00:00Z', by: 'Meera Iyer', action: 'Approved' }],
  ...x,
});
const SEED_LISTS: PriceList[] = [
  base({ id: 'pl-dist', code: 'PL-DIST-26', name: 'Distributor price list FY26-27', type: 'CHANNEL', channelId: 'chn-dist',
    lines: [L('PRD-EVOCON-001', 33500, [{ minQty: 10, price: 32800 }]), L('PRD-CSM-003', 2750, [{ minQty: 50, price: 2650 }]), L('PRD-EVOCON-005', 515000), L('PRD-EVOCON-006', 21000)] }),
  base({ id: 'pl-dealer', code: 'PL-DLR-26', name: 'Dealer price list FY26-27', type: 'CHANNEL', channelId: 'chn-dealer',
    lines: [L('PRD-EVOCON-001', 37500), L('PRD-CSM-003', 3080), L('PRD-EVOCON-006', 23500)] }),
  base({ id: 'pl-hosp', code: 'PL-HOSP-26', name: 'Hospital direct price list FY26-27', type: 'CHANNEL', channelId: 'chn-hosp',
    lines: [L('PRD-EVOCON-001', 41000), L('PRD-CSM-003', 3400), L('PRD-EVOCON-005', 575000), L('PRD-EVOCON-006', 26000)] }),
  base({ id: 'pl-ss', code: 'PL-SS-26', name: 'Super Stockist price list FY26-27', type: 'CHANNEL', channelId: 'chn-ss',
    lines: [L('PRD-EVOCON-001', 31800), L('PRD-CSM-003', 2620)] }),
  // Agri: distributor → retailer (agri input dealer) → farmer at MRP
  base({ id: 'pl-har-dist', principalId: 'princ-haritha', code: 'HAR-PTD-26', name: 'Haritha distributor price list 2026-27', type: 'CHANNEL', channelId: 'chn-dist',
    lines: [L('PRD-AGR-101', 270, [{ minQty: 100, price: 265 }]), L('PRD-AGR-102', 2420), L('PRD-AGR-103', 188)] }),
  base({ id: 'pl-har-rtl', principalId: 'princ-haritha', code: 'HAR-PTR-26', name: 'Haritha retailer price list 2026-27', type: 'CHANNEL', channelId: 'chn-retail',
    lines: [L('PRD-AGR-101', 302), L('PRD-AGR-102', 2700), L('PRD-AGR-103', 210)] }),
  // Automotive: distributor → workshop / retailer dealer
  base({ id: 'pl-vel-dist', principalId: 'princ-velocity', code: 'VEL-PTD-26', name: 'Velocity distributor price list 2026-27', type: 'CHANNEL', channelId: 'chn-dist',
    lines: [L('PRD-AUT-201', 1180, [{ minQty: 50, price: 1150 }]), L('PRD-AUT-202', 3550)] }),
  base({ id: 'pl-vel-dlr', principalId: 'princ-velocity', code: 'VEL-DLR-26', name: 'Velocity dealer price list 2026-27', type: 'CHANNEL', channelId: 'chn-dealer',
    lines: [L('PRD-AUT-201', 1330), L('PRD-AUT-202', 3950)] }),
  // Electronics: distributor → dealer
  base({ id: 'pl-vol-dist', principalId: 'princ-voltix', code: 'VOL-PTD-26', name: 'Voltix distributor price list 2026-27', type: 'CHANNEL', channelId: 'chn-dist',
    lines: [L('PRD-ELE-301', 1560, [{ minQty: 100, price: 1520 }])] }),
  base({ id: 'pl-vol-dlr', principalId: 'princ-voltix', code: 'VOL-DLR-26', name: 'Voltix dealer price list 2026-27', type: 'CHANNEL', channelId: 'chn-dealer',
    lines: [L('PRD-ELE-301', 1750)] }),
  base({ id: 'pl-krishna', code: 'PL-P-KRISHNA', name: 'Krishna Medi — special prices', type: 'PARTNER', channelId: 'chn-dist', partnerIds: ['ptr-dist-vja'], validFrom: '2026-06-01',
    notes: 'Volume commitment for Vijayawada & Guntur hospitals.', lines: [L('PRD-EVOCON-001', 33000), L('PRD-CSM-003', 2700)] }),
  base({ id: 'rc-yashoda', code: 'RC-YASHODA-26', name: 'Yashoda Hospitals rate contract 2026-27', type: 'CONTRACT', channelId: 'chn-hosp', partnerIds: ['ptr-hosp-hyd', 'ptr-hosp-sec'],
    validFrom: '2026-07-01', validTo: '2027-06-30', contractRef: 'YH/PUR/RC/2026-27/114', committedValue: 12500000,
    notes: 'Group rate contract for all Yashoda units in Hyderabad. Prices firm for 12 months.', lines: [L('PRD-EVOCON-001', 38500), L('PRD-CSM-003', 3150), L('PRD-EVOCON-006', 24500)] }),
  base({ id: 'pl-dist-v2', familyId: 'pl-dist', version: 2, code: 'PL-DIST-26', name: 'Distributor price list FY26-27', type: 'CHANNEL', channelId: 'chn-dist', validFrom: '2026-12-01',
    status: 'Pending', approvedBy: null, approvedAt: null, createdAt: '2026-11-02', submittedAt: '2026-11-03', notes: 'Price revision: steel & titanium cost increase.',
    history: [{ at: '2026-11-02T10:00:00Z', by: 'Priya Menon', action: 'Revised from v1' }, { at: '2026-11-03T10:00:00Z', by: 'Priya Menon', action: 'Submitted', note: 'Tray +3%, gauze down to clear stock' }],
    lines: [L('PRD-EVOCON-001', 34500, [{ minQty: 10, price: 33800 }]), L('PRD-CSM-003', 2550, [{ minQty: 50, price: 2500 }]), L('PRD-EVOCON-005', 525000), L('PRD-EVOCON-006', 21600)] }),
];
const SEED_SCHEMES: Scheme[] = [
  { id: 'sch-gauze', name: 'Gauze 10 + 1 free', kind: 'FREE_QTY', principalId: 'princ-biorad', channelIds: ['chn-dist', 'chn-dealer'], productIds: ['PRD-CSM-003'], buyQty: 10, freeQty: 1, discountPct: 0, validFrom: '2026-10-01', validTo: '2026-12-31', status: 'Active' },
  { id: 'sch-kharif', name: 'Rabi booster: 20 + 2 free', kind: 'FREE_QTY', principalId: 'princ-haritha', channelIds: ['chn-dist', 'chn-retail'], productIds: ['PRD-AGR-101'], buyQty: 20, freeQty: 2, discountPct: 0, validFrom: '2026-10-15', validTo: '2027-01-31', status: 'Active' },
  { id: 'sch-battery', name: 'Battery dealer 2% festive', kind: 'EXTRA_DISCOUNT', principalId: 'princ-velocity', channelIds: ['chn-dealer'], productIds: ['PRD-AUT-202'], buyQty: 0, freeQty: 0, discountPct: 2, validFrom: '2026-10-15', validTo: '2026-11-30', status: 'Active' },
];

const KEY = 'vinflux.pricing.v4';
export interface PricingSettings { tierNames: Record<string, string>; companyFloorPct: number; channelFloors: Record<string, number> }
interface Db { lists: PriceList[]; schemes: Scheme[]; settings?: Partial<PricingSettings> }
let cache: Db | null = null;
const listeners = new Set<() => void>();
const db = (): Db => (cache ??= loadJson<Db>(KEY, { lists: SEED_LISTS, schemes: SEED_SCHEMES }));
const commit = (d: Db) => { cache = d; saveJson(KEY, d); listeners.forEach((l) => l()); };
export const subscribePricing = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const priceLists = () => db().lists;
export const schemes = () => db().schemes;
export const getList = (id: string) => db().lists.find((l) => l.id === id) ?? null;

/* -------------------------------- Checks -------------------------------- */

export interface LineIssue { lineId: string; productId: string; level: 'error' | 'warning'; text: string }

/** Price rules per line: MRP (incl. GST), government ceiling, floor price, slabs. */
export const checkList = (list: PriceList, products: Product[]): LineIssue[] => {
  const out: LineIssue[] = [];
  const seen = new Set<string>();
  list.lines.forEach((ln) => {
    const p = products.find((x) => x.id === ln.productId);
    const add = (level: LineIssue['level'], text: string) => out.push({ lineId: ln.id, productId: ln.productId, level, text });
    if (!p) { add('error', 'Product not found in Product Master.'); return; }
    if (seen.has(ln.productId)) add('error', 'Product appears twice in this list.');
    seen.add(ln.productId);
    if (p.lifecycleStatus === 'Retired') add('warning', 'Product is retired.');
    if (!(ln.price > 0)) { add('error', 'Price must be more than 0.'); return; }
    const gst = gstOf(p);
    const ref = p.pricingReference;
    const all = [ln.price, ...ln.slabs.map((s) => s.price)];
    const max = Math.max(...all);
    const min = Math.min(...all);
    if (ref?.mrp > 0 && max * (1 + gst / 100) > ref.mrp + 0.001) add('error', `Price + ${gst}% GST (₹${Math.round(max * (1 + gst / 100)).toLocaleString('en-IN')}) is above MRP ₹${ref.mrp.toLocaleString('en-IN')}.`);
    if (ref?.govPriceCapEnforced && ref.govNpddCeiling && max * (1 + gst / 100) > ref.govNpddCeiling) add('error', `Above the government (NPPA) ceiling of ₹${ref.govNpddCeiling.toLocaleString('en-IN')} incl. GST.`);
    const floor = list.type === 'CONTRACT' ? ref?.institutionalTenderCap : ref?.dealerTransferCap;
    if (floor && min < floor) add('warning', `Below the ${list.type === 'CONTRACT' ? 'tender' : 'trade'} floor price ₹${floor.toLocaleString('en-IN')} — the approver must accept the lower margin.`);
    const cost = ref?.standardCost ?? 0;
    const cFloor = settings().companyFloorPct;
    if (cost > 0 && min > 0 && ((min - cost) / min) * 100 < cFloor) add('warning', `Company margin ${(((min - cost) / min) * 100).toFixed(1)}% is below the ${cFloor}% floor (cost ₹${cost.toLocaleString('en-IN')}).`);
    const slabs = [...ln.slabs].sort((a, b) => a.minQty - b.minQty);
    slabs.forEach((s, i) => {
      if (!(s.minQty > 1)) add('error', 'Slab quantity must be more than 1.');
      if (s.price >= (i ? slabs[i - 1].price : ln.price)) add('error', `Slab ${s.minQty}+ must be cheaper than the price before it.`);
      if (i && s.minQty === slabs[i - 1].minQty) add('error', `Two slabs start at ${s.minQty}.`);
    });
  });
  return out;
};

export const headerErrors = (l: PriceList): string[] => {
  const e: string[] = [];
  if (!l.name.trim()) e.push('Name is required.');
  if (!l.validFrom) e.push('Valid-from date is required.');
  if (l.validTo && l.validTo < l.validFrom) e.push('Valid-to is before valid-from.');
  if (l.type === 'CHANNEL' && !l.channelId) e.push('Choose the sales channel.');
  if (l.type === 'PARTNER' && l.partnerIds.length !== 1) e.push('Choose one partner.');
  if (l.type === 'CONTRACT' && !l.partnerIds.length) e.push('Choose at least one hospital.');
  if (l.type === 'CONTRACT' && !l.validTo) e.push('A rate contract needs an end date.');
  if (!l.lines.length) e.push('Add at least one product.');
  return e;
};

/** Same "who it applies to" = versions compete with each other. */
const scopeKey = (l: PriceList) => [l.principalId, l.type, l.channelId ?? '', [...l.partnerIds].sort().join(','), [...l.territoryIds].sort().join(',')].join('|');

/* ------------------------------- Lifecycle ------------------------------- */

type Result = { ok: boolean; message: string; errors?: string[] };
const touch = (l: PriceList, by: string, action: string, note?: string): PriceList => ({ ...l, history: [...l.history, { at: nowIso(), by, action, note }] });
const put = (l: PriceList) => { const d = db(); commit({ ...d, lists: d.lists.some((x) => x.id === l.id) ? d.lists.map((x) => (x.id === l.id ? l : x)) : [...d.lists, l] }); };

export const blankList = (type: ListType, principalId: string, by: string): PriceList => {
  const id = newId('pl');
  return { id, familyId: id, code: '', name: '', type, principalId, channelId: type === 'CONTRACT' ? 'chn-hosp' : null, partnerIds: [], territoryIds: [], validFrom: today(), validTo: null, version: 1, status: 'Draft', lines: [], notes: '', createdBy: by, createdAt: today(), history: [], contractRef: '', committedValue: null };
};

export const saveDraft = (l: PriceList, by: string): Result => {
  if (!['Draft', 'Rejected'].includes(l.status)) return { ok: false, message: 'Only drafts can be edited — revise the list to make a new version.' };
  const isNew = !getList(l.id);
  put(touch({ ...l, status: 'Draft', code: l.code || `PL-${l.id.slice(-5).toUpperCase()}` }, by, isNew ? 'Created' : 'Edited'));
  return { ok: true, message: `Draft "${l.name || 'price list'}" saved.` };
};

export const submitList = (l: PriceList, by: string, products: Product[], note = ''): Result => {
  const errs = [...headerErrors(l), ...checkList(l, products).filter((i) => i.level === 'error').map((i) => `${products.find((p) => p.id === i.productId)?.code ?? i.productId}: ${i.text}`)];
  if (errs.length) return { ok: false, message: 'Fix these before submitting.', errors: errs };
  put(touch({ ...l, code: l.code || `PL-${l.id.slice(-5).toUpperCase()}`, status: 'Pending', submittedBy: by, submittedAt: today(), rejectionReason: null }, by, 'Submitted', note));
  emit('price.submitted', 'Price Lists', by, `Submitted ${l.name} v${l.version} for approval`, { listId: l.id });
  return { ok: true, message: `"${l.name}" sent for approval.` };
};

export const approveList = (id: string, by: string, products: Product[], note = ''): Result => {
  const l = getList(id);
  if (!l || l.status !== 'Pending') return { ok: false, message: 'Only pending lists can be approved.' };
  if (l.submittedBy === by) return { ok: false, message: 'Maker-checker: you submitted this list, so someone else must approve it.' };
  const errs = checkList(l, products).filter((i) => i.level === 'error');
  if (errs.length) return { ok: false, message: 'The list has price errors.', errors: errs.map((e) => e.text) };
  const d = db();
  const key = scopeKey(l);
  const superseded: string[] = [];
  const lists = d.lists.map((x) => {
    if (x.id === id) return touch({ ...x, status: 'Active' as ListStatus, approvedBy: by, approvedAt: today() }, by, 'Approved', note);
    if (x.status === 'Active' && scopeKey(x) === key && (!x.validTo || x.validTo >= l.validFrom)) {
      superseded.push(`${x.name} v${x.version}`);
      // The old version stays in force until the day before the new one starts.
      return touch(l.validFrom > x.validFrom ? { ...x, validTo: dayBefore(l.validFrom) } : { ...x, status: 'Superseded' as ListStatus }, by, l.validFrom > x.validFrom ? `Ends ${dayBefore(l.validFrom)} — replaced by v${l.version}` : `Superseded by v${l.version}`);
    }
    return x;
  });
  commit({ ...d, lists });
  emit('price.activated', 'Price Lists', by, `Approved ${l.name} v${l.version} from ${l.validFrom}`, { listId: id, superseded });
  return { ok: true, message: `Approved. Prices apply from ${l.validFrom}${superseded.length ? `; ${superseded.join(', ')} ends the day before` : ''}.` };
};

export const rejectList = (id: string, by: string, reason: string): Result => {
  const l = getList(id);
  if (!l || l.status !== 'Pending') return { ok: false, message: 'Only pending lists can be rejected.' };
  if (!reason.trim()) return { ok: false, message: 'Say what needs to change.' };
  put(touch({ ...l, status: 'Rejected', rejectionReason: reason }, by, 'Rejected', reason));
  emit('price.rejected', 'Price Lists', by, `Rejected ${l.name} v${l.version}`, { listId: id });
  return { ok: true, message: `Sent back to ${l.submittedBy}.` };
};

/** New draft version of an active list (prices copied). */
export const reviseList = (id: string, by: string): PriceList | null => {
  const l = getList(id);
  if (!l) return null;
  const family = db().lists.filter((x) => x.familyId === l.familyId);
  if (family.some((x) => ['Draft', 'Pending', 'Rejected'].includes(x.status))) return null;
  const v = Math.max(...family.map((x) => x.version)) + 1;
  const n: PriceList = { ...l, id: newId('pl'), version: v, status: 'Draft', validFrom: today() > l.validFrom ? today() : l.validFrom, createdBy: by, createdAt: today(), submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null, rejectionReason: null,
    lines: l.lines.map((x) => ({ ...x, id: newId('ln'), slabs: x.slabs.map((s) => ({ ...s })) })), history: [{ at: nowIso(), by, action: `Revised from v${l.version}` }] };
  put(n);
  return n;
};

export const deleteDraft = (id: string): Result => {
  const l = getList(id);
  if (!l || !['Draft', 'Rejected'].includes(l.status)) return { ok: false, message: 'Only drafts can be deleted.' };
  const d = db(); commit({ ...d, lists: d.lists.filter((x) => x.id !== id) });
  return { ok: true, message: 'Draft deleted.' };
};

export const saveScheme = (s: Scheme): string | null => {
  if (!s.name.trim()) return 'Name is required.';
  if (!s.productIds.length || !s.channelIds.length) return 'Choose products and channels.';
  if (s.validTo < s.validFrom) return 'End date is before start date.';
  if (s.kind === 'FREE_QTY' && (!(s.buyQty > 0) || !(s.freeQty > 0))) return 'Enter buy and free quantities.';
  if (s.kind === 'EXTRA_DISCOUNT' && !(s.discountPct > 0 && s.discountPct < 50)) return 'Discount must be between 0 and 50%.';
  const d = db();
  commit({ ...d, schemes: d.schemes.some((x) => x.id === s.id) ? d.schemes.map((x) => (x.id === s.id ? s : x)) : [...d.schemes, { ...s, id: newId('sch') }] });
  return null;
};

/* ------------------------------ Price lookup ------------------------------ */

export const effectiveOn = (l: PriceList, on: string) => l.status === 'Active' && l.validFrom <= on && (!l.validTo || l.validTo >= on);

export interface QuoteInput {
  principalId: string;
  partnerId: string;
  channelId: string | null;
  /** Partner territories expanded with ancestors (so a state-level list matches a city partner). */
  partnerTerritoryIds: Set<string>;
  productId: string;
  qty: number;
  on: string;
  /** Invoice discount % from Go-to-Market commercial terms. */
  discountPct: number;
  discountSource: string;
}
export interface QuoteStep { label: string; detail: string; state: 'used' | 'skipped' | 'none' }
export interface Quote {
  steps: QuoteStep[];
  list: PriceList | null;
  basePrice: number | null;
  slab: Slab | null;
  unitPrice: number | null;
  discountPct: number;
  scheme: Scheme | null;
  schemeDiscountPct: number;
  freeQty: number;
  netUnit: number | null;
  gstPct: number;
  taxable: number;
  gst: number;
  total: number;
}

export const quote = (q: QuoteInput, products: Product[]): Quote => {
  const lists = priceLists().filter((l) => l.principalId === q.principalId && effectiveOn(l, q.on) && l.lines.some((x) => x.productId === q.productId));
  const contract = lists.find((l) => l.type === 'CONTRACT' && l.partnerIds.includes(q.partnerId));
  const partnerList = lists.find((l) => l.type === 'PARTNER' && l.partnerIds.includes(q.partnerId));
  const chLists = lists.filter((l) => l.type === 'CHANNEL' && l.channelId === q.channelId && (!l.territoryIds.length || l.territoryIds.some((t) => q.partnerTerritoryIds.has(t))));
  const channelList = chLists.find((l) => l.territoryIds.length) ?? chLists[0];
  const pick = contract ?? partnerList ?? channelList ?? null;
  const step = (label: string, l: PriceList | undefined, chosen: boolean): QuoteStep => ({
    label, detail: l ? `${l.name} v${l.version} (${l.code})${l.contractRef ? ` · ${l.contractRef}` : ''}` : 'None found', state: !l ? 'none' : chosen ? 'used' : 'skipped',
  });
  const steps: QuoteStep[] = [
    step('1. Rate contract for this customer', contract, pick === contract),
    step('2. Partner price list', partnerList, pick === partnerList),
    step('3. Channel price list', channelList, pick === channelList),
  ];
  const product = products.find((p) => p.id === q.productId);
  const gstPct = gstOf(product);
  const empty: Quote = { steps, list: null, basePrice: null, slab: null, unitPrice: null, discountPct: 0, scheme: null, schemeDiscountPct: 0, freeQty: 0, netUnit: null, gstPct, taxable: 0, gst: 0, total: 0 };
  if (!pick) return empty;
  const line = pick.lines.find((x) => x.productId === q.productId)!;
  const slab = [...line.slabs].sort((a, b) => b.minQty - a.minQty).find((s) => q.qty >= s.minQty) ?? null;
  const unitPrice = slab ? slab.price : line.price;
  steps.push({ label: '4. Quantity slab', detail: slab ? `${slab.minQty}+ units → ₹${slab.price.toLocaleString('en-IN')}` : line.slabs.length ? `Below the first slab (${Math.min(...line.slabs.map((s) => s.minQty))}+)` : 'No slabs', state: slab ? 'used' : 'none' });
  // Contract prices are net: no further trade discount.
  const discountPct = pick.type === 'CONTRACT' ? 0 : q.discountPct;
  steps.push({ label: '5. Invoice discount (Go-to-Market terms)', detail: pick.type === 'CONTRACT' ? 'Not applied — contract prices are net' : `${q.discountPct}% · ${q.discountSource}`, state: discountPct ? 'used' : 'none' });
  const scheme = pick.type === 'CONTRACT' ? null : schemes().find((s) => s.status === 'Active' && s.principalId === q.principalId && s.productIds.includes(q.productId) && q.channelId && s.channelIds.includes(q.channelId) && s.validFrom <= q.on && s.validTo >= q.on) ?? null;
  const freeQty = scheme?.kind === 'FREE_QTY' ? Math.floor(q.qty / scheme.buyQty) * scheme.freeQty : 0;
  const schemeDiscountPct = scheme?.kind === 'EXTRA_DISCOUNT' ? scheme.discountPct : 0;
  steps.push({ label: '6. Scheme', detail: scheme ? `${scheme.name}${freeQty ? ` → ${freeQty} free` : schemeDiscountPct ? ` → ${schemeDiscountPct}% off` : ' (quantity too low)'}` : pick.type === 'CONTRACT' ? 'Not applied to contracts' : 'No active scheme', state: scheme && (freeQty || schemeDiscountPct) ? 'used' : 'none' });
  const netUnit = Math.round(unitPrice * (1 - discountPct / 100) * (1 - schemeDiscountPct / 100) * 100) / 100;
  const taxable = Math.round(netUnit * q.qty * 100) / 100;
  const gst = Math.round(taxable * gstPct) / 100;
  return { steps, list: pick, basePrice: line.price, slab, unitPrice, discountPct, scheme, schemeDiscountPct, freeQty, netUnit, gstPct, taxable, gst, total: Math.round((taxable + gst) * 100) / 100 };
};

/** Used by the importer: replace / add lines on a draft list. */
export const setLines = (id: string, lines: PriceLine[], by: string, note: string) => {
  const l = getList(id);
  if (l) put(touch({ ...l, lines }, by, note));
};


/* ----------------------- Settings: tier names & margin floor ----------------------- */

/** Indian trade names for channel prices (editable). */
export const DEFAULT_TIER_NAMES: Record<string, string> = {
  'chn-cnf': 'C&F', 'chn-ss': 'PTS', 'chn-dist': 'PTD', 'chn-dealer': 'PT-Dealer', 'chn-retail': 'PTR', 'chn-hosp': 'Institution', 'chn-direct': 'Direct',
};
/** Minimum margin each reseller tier should keep (%). */
export const DEFAULT_CHANNEL_FLOORS: Record<string, number> = { 'chn-ss': 4, 'chn-dist': 10, 'chn-dealer': 8, 'chn-retail': 15 };
export const settings = (): PricingSettings => ({
  tierNames: { ...DEFAULT_TIER_NAMES, ...(db().settings?.tierNames ?? {}) },
  companyFloorPct: db().settings?.companyFloorPct ?? 30,
  channelFloors: { ...DEFAULT_CHANNEL_FLOORS, ...(db().settings?.channelFloors ?? {}) },
});
export const saveSettings = (s: PricingSettings) => { const d = db(); commit({ ...d, settings: s }); };
export const tierName = (channelId: string | null, fallback = '') => (channelId ? settings().tierNames[channelId] || fallback : fallback);

/* ------------------------- Channel price "in force" ------------------------- */

export interface CellPrice { price: number; list: PriceList }
/** National channel price in force on a date, plus the next proposed / scheduled price (if any). */
export const channelPrice = (principalId: string, channelId: string, productId: string, on: string): { current: CellPrice | null; next: CellPrice | null } => {
  const scope = db().lists.filter((l) => l.type === 'CHANNEL' && l.principalId === principalId && l.channelId === channelId && !l.territoryIds.length && l.lines.some((x) => x.productId === productId));
  const cur = scope.filter((l) => effectiveOn(l, on)).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  const nxt = scope.filter((l) => (l.status === 'Active' && l.validFrom > on) || ['Pending', 'Draft', 'Rejected'].includes(l.status))
    .sort((a, b) => b.version - a.version || b.validFrom.localeCompare(a.validFrom))[0];
  const cell = (l?: PriceList): CellPrice | null => (l ? { price: l.lines.find((x) => x.productId === productId)!.price, list: l } : null);
  return { current: cell(cur), next: cell(nxt) };
};

/* ------------------------------- Margin ladder ------------------------------- */

export interface LadderTier { channelId: string; name: string; rank: number; resell: boolean }
export interface LadderCell { channelId: string; price: number | null; companyMarginPct: number | null; resellerMarginPct: number | null; pctOfMrp: number | null; issues: string[] }

/**
 * Margins across the chain for one product.
 * Company margin = (price − cost) / price. Reseller margin = (next tier's price − this price) / next tier's price;
 * the last reseller is measured against the institution price, or MRP before GST.
 */
export const ladderFor = (product: Product, tiers: LadderTier[], prices: Record<string, number | null>): LadderCell[] => {
  const ref = product.pricingReference;
  const gst = gstOf(product);
  const mrpEx = ref?.mrp ? ref.mrp / (1 + gst / 100) : null;
  const cost = ref?.standardCost ?? 0;
  const st = settings();
  const ordered = [...tiers].sort((a, b) => a.rank - b.rank);
  const resellers = ordered.filter((t) => t.resell && prices[t.channelId]);
  const endTier = ordered.find((t) => !t.resell && prices[t.channelId]);
  return ordered.map((t) => {
    const price = prices[t.channelId] ?? null;
    const issues: string[] = [];
    if (!price) return { channelId: t.channelId, price: null, companyMarginPct: null, resellerMarginPct: null, pctOfMrp: null, issues };
    const companyMarginPct = cost ? ((price - cost) / price) * 100 : null;
    let resellerMarginPct: number | null = null;
    if (t.resell) {
      const i = resellers.findIndex((r) => r.channelId === t.channelId);
      const sellAt = resellers[i + 1] ? prices[resellers[i + 1].channelId]! : endTier ? prices[endTier.channelId]! : mrpEx;
      if (sellAt) resellerMarginPct = ((sellAt - price) / sellAt) * 100;
      if (resellerMarginPct !== null && resellerMarginPct < 0) issues.push(`${t.name} is dearer than the price it sells at — the ladder is broken.`);
      else if (resellerMarginPct !== null && st.channelFloors[t.channelId] && resellerMarginPct < st.channelFloors[t.channelId]) issues.push(`${t.name} keeps ${resellerMarginPct.toFixed(1)}% — below its ${st.channelFloors[t.channelId]}% floor.`);
    }
    if (companyMarginPct !== null && companyMarginPct < st.companyFloorPct) issues.push(`Company margin ${companyMarginPct.toFixed(1)}% is below ${st.companyFloorPct}%.`);
    if (ref?.mrp && price * (1 + gst / 100) > ref.mrp + 0.001) issues.push('Above MRP incl. GST.');
    if (ref?.govPriceCapEnforced && ref.govNpddCeiling && price * (1 + gst / 100) > ref.govNpddCeiling) issues.push('Above the government ceiling.');
    return { channelId: t.channelId, price, companyMarginPct, resellerMarginPct, pctOfMrp: mrpEx ? (price / mrpEx) * 100 : null, issues };
  });
};

/* ---------------------- Revise prices across channels ---------------------- */

export interface CrossChannelPrice { channelId: string; productId: string; price: number }

/**
 * One revision, many channels: prices land in one draft per channel (a new version of the
 * channel's national list, or a new list), all sharing a batch so they are approved together.
 */
export const proposeAcrossChannels = (input: { principalId: string; validFrom: string; by: string; note: string; submit: boolean; prices: CrossChannelPrice[]; products: Product[] }): Result & { listIds: string[]; batchId: string } => {
  const batchId = newId('batch');
  const byChannel = new Map<string, CrossChannelPrice[]>();
  input.prices.filter((x) => x.price > 0).forEach((x) => byChannel.set(x.channelId, [...(byChannel.get(x.channelId) ?? []), x]));
  const blocked: string[] = [];
  byChannel.forEach((_, ch) => {
    if (db().lists.some((l) => l.type === 'CHANNEL' && l.principalId === input.principalId && l.channelId === ch && !l.territoryIds.length && l.status === 'Pending'))
      blocked.push(`${tierName(ch, ch)} already has a list waiting for approval — approve or reject it first.`);
  });
  if (blocked.length) return { ok: false, message: 'Can’t start this revision.', errors: blocked, listIds: [], batchId };
  if (!byChannel.size) return { ok: false, message: 'No prices to save.', listIds: [], batchId };
  const listIds: string[] = [];
  byChannel.forEach((rows, ch) => {
    const scope = db().lists.filter((l) => l.type === 'CHANNEL' && l.principalId === input.principalId && l.channelId === ch && !l.territoryIds.length);
    let target = scope.filter((l) => ['Draft', 'Rejected'].includes(l.status)).sort((a, b) => b.version - a.version)[0];
    if (!target) {
      const active = scope.filter((l) => l.status === 'Active').sort((a, b) => b.version - a.version)[0];
      target = (active && reviseList(active.id, input.by)) || undefined as unknown as PriceList;
    }
    if (!target) {
      target = { ...blankList('CHANNEL', input.principalId, input.by), channelId: ch, name: `${tierName(ch, 'Channel')} price list`, history: [{ at: nowIso(), by: input.by, action: 'Created by multi-channel revision' }] };
      target.code = `PL-${tierName(ch, 'CH').replace(/[^A-Za-z]/g, '').toUpperCase()}-${target.id.slice(-4).toUpperCase()}`;
    }
    const lines = [...target.lines.filter((x) => !rows.some((r) => r.productId === x.productId)),
      ...rows.map((r) => {
        const old = target.lines.find((x) => x.productId === r.productId);
        // Keep slab discounts in the same proportion when the base price moves.
        const f = old && old.price ? r.price / old.price : 1;
        return { id: newId('ln'), productId: r.productId, price: r.price, slabs: (old?.slabs ?? []).map((sl) => ({ minQty: sl.minQty, price: Math.round(sl.price * f * 100) / 100 })) };
      })];
    put(touch({ ...target, lines, validFrom: input.validFrom > target.validFrom || target.status !== 'Active' ? input.validFrom : target.validFrom, batchId, status: 'Draft', notes: input.note || target.notes }, input.by, `Multi-channel revision (${rows.length} product(s))`, input.note));
    listIds.push(target.id);
  });
  if (input.submit) {
    const errs: string[] = [];
    listIds.forEach((id) => { const r = submitList(getList(id)!, input.by, input.products, input.note); if (!r.ok) errs.push(`${getList(id)?.name}: ${(r.errors ?? [r.message]).join(' ')}`); });
    if (errs.length) return { ok: false, message: 'Saved as drafts, but some lists could not be submitted.', errors: errs, listIds, batchId };
    return { ok: true, message: `${listIds.length} channel list(s) sent for approval together.`, listIds, batchId };
  }
  return { ok: true, message: `${listIds.length} draft list(s) saved — open them to review, then submit.`, listIds, batchId };
};

/** Approve every pending list of a multi-channel revision. */
export const approveBatch = (batchId: string, by: string, products: Product[], note = ''): Result => {
  const pending = db().lists.filter((l) => l.batchId === batchId && l.status === 'Pending');
  const errs: string[] = [];
  pending.forEach((l) => { const r = approveList(l.id, by, products, note); if (!r.ok) errs.push(`${l.name}: ${r.message}`); });
  if (errs.length) return { ok: false, message: 'Some lists were not approved.', errors: errs };
  return { ok: true, message: `Approved ${pending.length} list(s) together.` };
};
