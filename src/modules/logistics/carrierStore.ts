/**
 * Carriers (courier, surface, road transport, own vehicle) with rate cards and a scorecard built from shipments.
 * INTEGRATION POINT: courier / aggregator APIs (Blue Dart, Delhivery, Shiprocket…) for AWB booking, pickup and tracking.
 */
import { loadJson, newId, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { allShipments, claims } from '../orders/orderStore';

export type CarrierMode = 'Courier (air)' | 'Courier (surface)' | 'Road transport (LTL / FTL)' | 'Own vehicle';
export interface Carrier {
  id: string; name: string; mode: CarrierMode;
  ratePerKg: number; minCharge: number; tatDays: number;
  /** States served (empty = all India). */
  states: string[];
  coldChain: boolean; booking: 'Manual (enter AWB / LR)' | 'API (demo)';
  active: boolean;
}
const SEED: Carrier[] = [
  { id: 'car-bluedart', name: 'Blue Dart', mode: 'Courier (air)', ratePerKg: 95, minCharge: 250, tatDays: 1, states: [], coldChain: true, booking: 'API (demo)', active: true },
  { id: 'car-delhivery', name: 'Delhivery', mode: 'Courier (surface)', ratePerKg: 38, minCharge: 120, tatDays: 3, states: [], coldChain: false, booking: 'API (demo)', active: true },
  { id: 'car-dtdc', name: 'DTDC', mode: 'Courier (surface)', ratePerKg: 45, minCharge: 150, tatDays: 3, states: [], coldChain: false, booking: 'Manual (enter AWB / LR)', active: true },
  { id: 'car-vrl', name: 'VRL Logistics', mode: 'Road transport (LTL / FTL)', ratePerKg: 14, minCharge: 1500, tatDays: 2, states: ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra'], coldChain: false, booking: 'Manual (enter AWB / LR)', active: true },
  { id: 'car-own', name: 'Own vehicle', mode: 'Own vehicle', ratePerKg: 0, minCharge: 900, tatDays: 1, states: ['Telangana'], coldChain: false, booking: 'Manual (enter AWB / LR)', active: true },
];
let cache: Carrier[] | null = null;
const listeners = new Set<() => void>();
const KEY = () => workspaceKey('vinflux.carriers.v1');
export const carriers = (): Carrier[] => (cache ??= loadJson<Carrier[]>(KEY(), SEED));
const commit = (c: Carrier[]) => { cache = c; saveJson(KEY(), c); listeners.forEach((l) => l()); };
export const subscribeCarriers = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const carrierByName = (name: string) => carriers().find((c) => c.name === name) ?? null;

export const saveCarrier = (c: Carrier): { ok: boolean; message: string; errors?: string[] } => {
  const errs: string[] = [];
  if (!c.name.trim()) errs.push('Name is required.');
  if (carriers().some((x) => x.id !== c.id && x.name.toLowerCase() === c.name.trim().toLowerCase())) errs.push('A carrier with this name already exists.');
  if (c.ratePerKg < 0 || c.minCharge < 0) errs.push('Rates can’t be negative.');
  if (!(c.tatDays > 0)) errs.push('Delivery days must be at least 1.');
  if (errs.length) return { ok: false, message: 'Can’t save.', errors: errs };
  const exists = carriers().some((x) => x.id === c.id);
  commit(exists ? carriers().map((x) => (x.id === c.id ? { ...c, name: c.name.trim() } : x)) : [...carriers(), { ...c, id: newId('car'), name: c.name.trim() }]);
  return { ok: true, message: `${c.name} saved.` };
};
export const blankCarrier = (): Carrier => ({ id: '', name: '', mode: 'Courier (surface)', ratePerKg: 40, minCharge: 150, tatDays: 3, states: [], coldChain: false, booking: 'Manual (enter AWB / LR)', active: true });

/** Freight estimate from the rate card. */
export const freightFor = (c: Carrier | null, weightKg: number) => (c ? Math.round(Math.max(c.minCharge, c.ratePerKg * weightKg)) : 0);
export const serves = (c: Carrier, state: string | undefined) => !c.states.length || !state || c.states.includes(state);

/** Scorecard from real shipments: on-time delivery, late in transit, claims. */
export const scorecard = (name: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const mine = allShipments().filter((x) => x.shipment.carrier === name);
  const delivered = mine.filter((x) => x.shipment.deliveredAt);
  const onTime = delivered.filter((x) => x.shipment.deliveredAt!.slice(0, 10) <= x.shipment.eta).length;
  const lateOpen = mine.filter((x) => !x.shipment.deliveredAt && x.shipment.eta < today).length;
  const shipNos = new Set(mine.map((x) => x.shipment.no));
  const cl = claims().filter((c) => shipNos.has(c.shipmentNo));
  return { shipments: mine.length, delivered: delivered.length, onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : null, lateOpen, claims: cl.length, claimValue: cl.reduce((a, c) => a + c.value, 0), freight: mine.reduce((a, x) => a + (x.shipment.freight ?? 0), 0) };
};
