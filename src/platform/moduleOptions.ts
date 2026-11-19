/**
 * Module options (level 2 of configuration): what each switched-on module does for this principal.
 * Level 1 = module on/off (PlatformContext). Level 3 = per partner / hospital settings (inside each module).
 * Options are stored per principal; a module reads them with opt(module, key) and hides what is off.
 * INTEGRATION POINT: GET/PUT /principals/:id/module-options.
 */
import type { ModuleId } from './modules';
import { loadJson, saveJson } from './store';

export type OptionValue = boolean | string;
export interface OptionDef {
  key: string;
  label: string;
  help?: string;
  /** bool = on/off; choice = one of `choices`. */
  type: 'bool' | 'choice';
  choices?: { value: string; label: string }[];
  default: OptionValue;
  /** Only meaningful when this other option of the same module is on. */
  requires?: string;
}

export const MODULE_OPTIONS: Partial<Record<ModuleId, OptionDef[]>> = {
  procurement: [
    { key: 'owner', label: 'Who runs purchasing', help: 'VinFlux: POs, receipts and QC here. ERP: POs and receipts in your ERP; VinFlux shows them. Mixed: POs in the ERP, receipt and QC in VinFlux.', type: 'choice', default: 'vinflux', choices: [{ value: 'vinflux', label: 'VinFlux' }, { value: 'erp', label: 'Our ERP' }, { value: 'hybrid', label: 'Mixed (POs in ERP, receipt + QC here)' }] },
    { key: 'approvalLimit', label: 'PO approval above', type: 'choice', default: '500000', choices: [{ value: '100000', label: '₹1 lakh' }, { value: '500000', label: '₹5 lakh' }, { value: '2500000', label: '₹25 lakh' }, { value: '999999999', label: 'Never' }] },
    { key: 'inspection', label: 'Inspect receipts before stock is sellable', help: 'Receipts go to Quarantine until QC accepts them (needs Inventory → quarantine).', type: 'bool', default: true },
    { key: 'inspectorSeparate', label: 'QC by someone other than the receiver', type: 'bool', default: false, requires: 'inspection' },
    { key: 'overTolerance', label: 'Accept over-receipt up to', type: 'choice', default: '0', choices: [{ value: '0', label: '0% (always ask)' }, { value: '2', label: '2%' }, { value: '5', label: '5%' }] },
    { key: 'priceTolerance', label: 'Invoice price tolerance', type: 'choice', default: '1', choices: [{ value: '0', label: '0%' }, { value: '1', label: '1%' }, { value: '2', label: '2%' }] },
  ],
  crm: [
    { key: 'opportunities', label: 'Opportunities and pipeline', help: 'Off: leads only (add, follow up, convert).', type: 'bool', default: true },
    { key: 'teamDashboard', label: 'Team dashboard for managers', type: 'bool', default: true },
    { key: 'targets', label: 'Targets per salesperson', type: 'bool', default: true, requires: 'teamDashboard' },
    { key: 'staleDays', label: 'Flag follow-ups with no activity after', type: 'choice', default: '14', choices: [{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }] },
  ],
  surgical: [
    { key: 'cases', label: 'Surgery case tracking', help: 'Book cases, deliver sets, record usage and bill used items. Off: only the implant register and sets are kept (cases are run by partners on their own platform).', type: 'bool', default: true },
    { key: 'caseRoles', label: 'Separate roles per case', help: 'Case owner, goods supplier, OT support and billing can be different companies (e.g. distributor supplies, principal sends the OT person).', type: 'bool', default: true, requires: 'cases' },
    { key: 'loanerSets', label: 'Loaner instrument sets', type: 'bool', default: true },
    { key: 'consignmentSets', label: 'Consignment sets kept at hospitals', help: 'Used without a shipment; usage triggers replenishment.', type: 'bool', default: true },
    { key: 'implantRegister', label: 'Implant register (UDI per patient)', type: 'bool', default: true },
    { key: 'partnerUsage', label: 'See usage from cases run by partners', help: 'Read-only usage and implanted serials when a distributor or dealer runs the case.', type: 'bool', default: true },
    { key: 'sterilisation', label: 'Kit return check and sterilisation', type: 'bool', default: true },
  ],
  returns: [
    { key: 'qcStep', label: 'Returns check before restock', help: 'Returned goods go to Quarantine until checked (restock / scrap / return to manufacturer).', type: 'bool', default: true },
    { key: 'reversePickup', label: 'Reverse pickup', type: 'bool', default: true },
    { key: 'creditNotes', label: 'Credit notes from VinFlux', help: 'Off: the credit note is issued in your ERP and only its number is recorded.', type: 'bool', default: true },
  ],
  recall: [
    { key: 'complaints', label: 'Complaints and adverse events', type: 'bool', default: true },
    { key: 'capa', label: 'Investigation, root cause and CAPA', type: 'bool', default: true, requires: 'complaints' },
    { key: 'implantTrace', label: 'Trace to implanted patients', help: 'Needs the implant register in Surgery Cases.', type: 'bool', default: true },
  ],
  logistics: [
    { key: 'carriers', label: 'Carriers and rate cards', type: 'bool', default: true },
    { key: 'trips', label: 'One trip for several orders', type: 'bool', default: true },
    { key: 'pod', label: 'Proof of delivery', type: 'choice', default: 'otp', choices: [{ value: 'otp', label: 'OTP' }, { value: 'photo', label: 'Photo' }, { value: 'signature', label: 'Signature' }, { value: 'none', label: 'Not required' }] },
    { key: 'geofence', label: 'Geofence for pickup and delivery (field app)', type: 'bool', default: true },
    { key: 'claims', label: 'Shortage and damage claims', type: 'bool', default: true },
  ],
  'price-lists': [
    { key: 'rateContracts', label: 'Hospital rate contracts', type: 'bool', default: true },
    { key: 'schemes', label: 'Schemes', type: 'bool', default: true },
    { key: 'makerChecker', label: 'Maker-checker on price changes', type: 'bool', default: true },
  ],
  orders: [
    { key: 'invoicing', label: 'Who issues the tax invoice', type: 'choice', default: 'erp', choices: [{ value: 'erp', label: 'Our ERP (VinFlux records the number)' }, { value: 'vinflux', label: 'VinFlux' }] },
    { key: 'creditCheck', label: 'Credit check on orders', type: 'choice', default: 'block', choices: [{ value: 'block', label: 'Block' }, { value: 'warn', label: 'Warn only' }, { value: 'off', label: 'Off' }] },
    { key: 'licenceCheck', label: 'Partner licence check', type: 'choice', default: 'block', choices: [{ value: 'block', label: 'Block' }, { value: 'warn', label: 'Warn only' }, { value: 'off', label: 'Off' }] },
  ],
  inventory: [
    { key: 'partnerStock', label: 'Partner and hospital stock', help: 'Stock reported by distributors, dealers and consignment at hospitals.', type: 'bool', default: true },
    { key: 'expiry', label: 'Expiry and FEFO', type: 'bool', default: true },
    { key: 'quarantine', label: 'Quarantine until QC accepts receipts', type: 'bool', default: true },
  ],
};

const KEY = 'vinflux.moduleOptions.v1';
type Store = Record<string, Record<string, OptionValue>>;
let all: Store = loadJson<Store>(KEY, {});
let principal = '';
const listeners = new Set<() => void>();

/** Called by PlatformProvider while rendering, so it must not notify (the provider re-renders the app anyway). */
export const setOptionsPrincipal = (id: string) => { principal = id; };
export const subscribeOptions = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const def = (m: ModuleId, key: string) => MODULE_OPTIONS[m]?.find((o) => o.key === key);
/** Raw stored value or the default. */
export const optValue = (m: ModuleId, key: string): OptionValue => all[principal]?.[`${m}.${key}`] ?? def(m, key)?.default ?? false;
/** Boolean option, false when an option it requires is off. */
export const opt = (m: ModuleId, key: string): boolean => {
  const d = def(m, key);
  if (d?.requires && !opt(m, d.requires)) return false;
  const v = optValue(m, key);
  return typeof v === 'boolean' ? v : v !== 'off' && v !== 'none';
};
export const optChoice = (m: ModuleId, key: string): string => String(optValue(m, key));

export const setOptions = (values: Record<string, OptionValue>) => {
  all = { ...all, [principal]: { ...(all[principal] ?? {}), ...values } };
  saveJson(KEY, all);
  listeners.forEach((l) => l());
};
export const setOption = (m: ModuleId, key: string, v: OptionValue) => setOptions({ [`${m}.${key}`]: v });
