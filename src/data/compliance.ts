/**
 * Industry compliance fields (India). Each industry pack lists the registrations, licences and
 * declarations a product needs; the product form, product detail and approval checks are all
 * driven by this schema, so adding a field here needs no screen changes.
 * Medical devices use the dedicated CDSCO form (risk class / licence), not this schema.
 */
import type { ComplianceField, IndustryPackId } from '../types/product.ts';

const CP = 'type-agri-cp';
const SEED = 'type-agri-seed';
const FERT = 'type-agri-fert';
const EQUIP = 'type-agri-equip';
const PART = 'type-auto-part';
const BATT = 'type-auto-battery';
const TYRE = 'type-auto-tyre';
const LUBE = 'type-auto-lube';
const CONS = 'type-elec-consumer';
const APPL = 'type-elec-appliance';
const COMP = 'type-elec-component';

export const COMPLIANCE_FIELDS: Partial<Record<IndustryPackId, ComplianceField[]>> = {
  agri: [
    // Crop protection — Insecticides Act 1968
    { id: 'cibrc', label: 'CIB&RC registration no.', kind: 'text', required: true, types: [CP], group: 'Crop protection (Insecticides Act)', placeholder: 'CIR-142,861/2019-Imidacloprid (SL)', hint: 'Central Insecticides Board registration printed on the label' },
    { id: 'activeIngredient', label: 'Active ingredient & strength', kind: 'text', required: true, types: [CP], group: 'Crop protection (Insecticides Act)', placeholder: 'Imidacloprid 17.8% SL' },
    { id: 'formulation', label: 'Formulation', kind: 'select', options: ['EC', 'SL', 'SC', 'WP', 'WG', 'GR', 'OD', 'FS', 'DS'], required: true, types: [CP], group: 'Crop protection (Insecticides Act)' },
    { id: 'toxicity', label: 'Toxicity label', kind: 'select', options: ['Red — extremely toxic', 'Yellow — highly toxic', 'Blue — moderately toxic', 'Green — slightly toxic'], required: true, types: [CP], group: 'Crop protection (Insecticides Act)' },
    { id: 'insLicence', label: 'Manufacturing licence no.', kind: 'text', required: true, types: [CP], group: 'Crop protection (Insecticides Act)' },
    { id: 'insLicenceValid', label: 'Manufacturing licence valid until', kind: 'date', required: true, expiry: true, types: [CP], group: 'Crop protection (Insecticides Act)' },
    // Seeds — Seeds Act 1966
    { id: 'variety', label: 'Variety / hybrid', kind: 'text', required: true, types: [SEED], group: 'Seeds (Seeds Act)' },
    { id: 'crop', label: 'Crop', kind: 'text', required: true, types: [SEED], group: 'Seeds (Seeds Act)' },
    { id: 'seedClass', label: 'Seed class', kind: 'select', options: ['Breeder', 'Foundation', 'Certified', 'Truthfully labelled'], required: true, types: [SEED], group: 'Seeds (Seeds Act)' },
    { id: 'germination', label: 'Minimum germination (%)', kind: 'number', min: 0, max: 100, required: true, types: [SEED], group: 'Seeds (Seeds Act)' },
    { id: 'purity', label: 'Physical purity (%)', kind: 'number', min: 0, max: 100, types: [SEED], group: 'Seeds (Seeds Act)' },
    { id: 'seedLicence', label: 'Seed licence no.', kind: 'text', required: true, types: [SEED], group: 'Seeds (Seeds Act)' },
    { id: 'seedLicenceValid', label: 'Seed licence valid until', kind: 'date', required: true, expiry: true, types: [SEED], group: 'Seeds (Seeds Act)' },
    // Fertilisers — Fertiliser (Control) Order 1985
    { id: 'fcoCategory', label: 'FCO category', kind: 'select', options: ['Straight', 'Complex (NPK)', 'Water-soluble', 'Micronutrient', 'Bio-fertiliser', 'Organic'], required: true, types: [FERT], group: 'Fertiliser (FCO 1985)' },
    { id: 'npk', label: 'Nutrient grade (N-P-K)', kind: 'text', required: true, types: [FERT], group: 'Fertiliser (FCO 1985)', placeholder: '19-19-19', pattern: '^\\d{1,2}(\\.\\d)?[-:]\\d{1,2}(\\.\\d)?[-:]\\d{1,2}(\\.\\d)?$', patternHint: 'Write it as N-P-K, e.g. 19-19-19' },
    { id: 'fcoCert', label: 'FCO certificate of manufacture', kind: 'text', required: true, types: [FERT], group: 'Fertiliser (FCO 1985)' },
    { id: 'fcoValid', label: 'FCO certificate valid until', kind: 'date', required: true, expiry: true, types: [FERT], group: 'Fertiliser (FCO 1985)' },
    { id: 'subsidised', label: 'Subsidised (sold through PoS with Aadhaar)', kind: 'bool', types: [FERT], group: 'Fertiliser (FCO 1985)' },
    // Common
    { id: 'netQty', label: 'Net quantity on pack', kind: 'text', required: true, types: [CP, SEED, FERT], group: 'Pack label', placeholder: '250 ml / 10 kg' },
    { id: 'season', label: 'Season', kind: 'select', options: ['Kharif', 'Rabi', 'Zaid', 'All seasons'], types: [CP, SEED, FERT], group: 'Pack label' },
    { id: 'agriWarranty', label: 'Warranty (months)', kind: 'number', min: 0, types: [EQUIP], group: 'Equipment' },
    { id: 'agriTest', label: 'Test certificate (CFMTTI / BIS)', kind: 'text', types: [EQUIP], group: 'Equipment', hint: 'Needed for subsidy schemes' },
  ],
  automotive: [
    { id: 'partNo', label: 'Part number', kind: 'text', required: true, group: 'Part identity' },
    { id: 'partSource', label: 'Part source', kind: 'select', options: ['Genuine (OEM)', 'OES (supplier to OEM)', 'Aftermarket'], required: true, group: 'Part identity' },
    { id: 'oemRef', label: 'OEM reference / cross-reference', kind: 'text', types: [PART], group: 'Part identity', hint: 'Lets dealers find the part by the vehicle maker’s number' },
    { id: 'supersededBy', label: 'Superseded by part no.', kind: 'text', group: 'Part identity' },
    { id: 'segment', label: 'Vehicle segment', kind: 'select', options: ['Two-wheeler', 'Three-wheeler', 'Passenger car', 'Commercial vehicle', 'Tractor / farm', 'Off-highway'], required: true, group: 'Fitment' },
    { id: 'fitment', label: 'Vehicle fitment (make · model · years)', kind: 'textarea', required: true, types: [PART, BATT, TYRE], group: 'Fitment', placeholder: 'Maruti Suzuki Swift 2018–2024; Dzire 2017–2024' },
    { id: 'tyreSize', label: 'Tyre size', kind: 'text', required: true, types: [TYRE], group: 'Fitment', placeholder: '185/65 R15 88H' },
    { id: 'viscosity', label: 'Viscosity grade', kind: 'text', required: true, types: [LUBE], group: 'Fitment', placeholder: '15W-40' },
    { id: 'apiSpec', label: 'API / JASO specification', kind: 'text', types: [LUBE], group: 'Fitment', placeholder: 'API CK-4' },
    { id: 'warrantyMonths', label: 'Warranty (months)', kind: 'number', min: 0, required: true, group: 'Warranty' },
    { id: 'warrantyKm', label: 'Warranty (km)', kind: 'number', min: 0, types: [PART, TYRE], group: 'Warranty' },
    { id: 'bisLicence', label: 'BIS licence no. (ISI mark)', kind: 'text', required: true, types: [TYRE, BATT], group: 'Certification', placeholder: 'CM/L-7600123456', hint: 'ISI mark is mandatory for tyres (IS 15633) and automotive batteries' },
    { id: 'bisValid', label: 'BIS licence valid until', kind: 'date', required: true, expiry: true, types: [TYRE, BATT], group: 'Certification' },
    { id: 'eprBattery', label: 'EPR registration (Battery Waste Management Rules 2022)', kind: 'text', required: true, types: [BATT], group: 'Certification' },
    { id: 'coreCharge', label: 'Exchange / core charge (₹)', kind: 'number', min: 0, types: [BATT], group: 'Certification', hint: 'Refunded when the old battery is returned' },
  ],
  electronics: [
    { id: 'model', label: 'Model number', kind: 'text', required: true, group: 'Identity' },
    { id: 'ratedPower', label: 'Rated voltage / power', kind: 'text', required: true, types: [CONS, APPL], group: 'Identity', placeholder: '100–240 V AC · 65 W' },
    { id: 'warrantyMonths', label: 'Warranty (months)', kind: 'number', min: 0, required: true, group: 'Identity' },
    { id: 'bisRequired', label: 'Under BIS Compulsory Registration Scheme', kind: 'bool', group: 'BIS (CRS)' },
    { id: 'bisCrs', label: 'BIS registration no.', kind: 'text', requiredWhen: { field: 'bisRequired', in: ['Yes'] }, showWhen: { field: 'bisRequired', in: ['Yes'] }, pattern: '^R-\\d{8}$', patternHint: 'Format R-12345678', group: 'BIS (CRS)' },
    { id: 'isStandard', label: 'Indian Standard', kind: 'text', requiredWhen: { field: 'bisRequired', in: ['Yes'] }, showWhen: { field: 'bisRequired', in: ['Yes'] }, placeholder: 'IS 13252 (Part 1)', group: 'BIS (CRS)' },
    { id: 'bisValid', label: 'BIS registration valid until', kind: 'date', expiry: true, requiredWhen: { field: 'bisRequired', in: ['Yes'] }, showWhen: { field: 'bisRequired', in: ['Yes'] }, group: 'BIS (CRS)' },
    { id: 'beeStar', label: 'BEE star rating', kind: 'select', options: ['Not covered', '1 star', '2 star', '3 star', '4 star', '5 star'], required: true, types: [APPL], group: 'Energy label (BEE)' },
    { id: 'beeValid', label: 'BEE label valid until', kind: 'date', expiry: true, types: [APPL], requiredWhen: { field: 'beeStar', in: ['1 star', '2 star', '3 star', '4 star', '5 star'] }, group: 'Energy label (BEE)' },
    { id: 'eprEwaste', label: 'EPR authorisation (E-Waste Rules 2022)', kind: 'text', required: true, types: [CONS, APPL], group: 'Environment' },
    { id: 'wpc', label: 'WPC / ETA approval (wireless)', kind: 'text', types: [CONS, APPL], group: 'Environment', hint: 'Only for Wi-Fi / Bluetooth products' },
    { id: 'imei', label: 'Track IMEI for every unit', kind: 'bool', types: [CONS], group: 'Identity' },
    { id: 'packageType', label: 'Package', kind: 'text', types: [COMP], group: 'Identity', placeholder: 'QFN-32' },
    { id: 'rohs', label: 'RoHS compliant', kind: 'bool', types: [COMP], group: 'Environment' },
  ],
};

const matches = (f: ComplianceField, typeId?: string) => !f.types?.length || (!!typeId && f.types.includes(typeId));
const inList = (cond: { field: string; in: string[] } | undefined, v: Record<string, string>) => !cond || cond.in.includes(v[cond.field] ?? (cond.in.includes('No') ? 'No' : ''));

/** Fields that apply to a product type, honouring "show when". */
export const complianceFieldsFor = (pack: IndustryPackId, typeId: string | undefined, values: Record<string, string> = {}): ComplianceField[] =>
  (COMPLIANCE_FIELDS[pack] ?? []).filter((f) => matches(f, typeId) && inList(f.showWhen, values));

export const isRequired = (f: ComplianceField, values: Record<string, string>) => !!f.required || (!!f.requiredWhen && inList(f.requiredWhen, values));

/** Problems with the values: missing required fields, bad formats, expired dates (errors) and near expiry (warnings). */
export const checkCompliance = (pack: IndustryPackId, typeId: string | undefined, values: Record<string, string> = {}, today: string, warnDays = 90): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  complianceFieldsFor(pack, typeId, values).forEach((f) => {
    const v = (values[f.id] ?? '').trim();
    if (!v) { if (isRequired(f, values)) errors.push(`${f.label} is required.`); return; }
    if (f.pattern && !new RegExp(f.pattern).test(v)) errors.push(`${f.label}: ${f.patternHint ?? 'wrong format'}.`);
    if (f.kind === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) errors.push(`${f.label} must be a number.`);
      else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) errors.push(`${f.label} must be between ${f.min ?? '…'} and ${f.max ?? '…'}.`);
    }
    if (f.expiry && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      if (v < today) errors.push(`${f.label}: expired on ${v}.`);
      else {
        const days = Math.round((Date.parse(v) - Date.parse(today)) / 86400000);
        if (days <= warnDays) warnings.push(`${f.label}: expires in ${days} day(s) (${v}).`);
      }
    }
  });
  return { errors, warnings };
};
