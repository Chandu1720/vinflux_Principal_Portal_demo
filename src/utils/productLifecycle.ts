/**
 * Product Master rules applied on "Submit for approval" (maker) and "Approve" (checker).
 * Each check is linked to a Validation Rule so it can be switched off in Configuration Studio.
 */
import type { AttributeDefinition, IndustryPackId, Product, ProductType, ValidationRule } from '../types/product.ts';
import { gtinError, normalise, usedGtins } from './gs1.ts';
import { checkCompliance } from '../data/compliance.ts';

export const todayISO = () => new Date().toISOString().slice(0, 10);
const isDate = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

const on = (rules: ValidationRule[], id: string) => rules.find((r) => r.id === id)?.enforced ?? true;

export const licenceFormFor = (riskClass: string) => (riskClass === 'A' || riskClass === 'B' ? 'Manufacturing (MD-5)' : 'Manufacturing (MD-9)');

export interface CheckResult { errors: string[]; warnings: string[] }

/** Pack of a product type (older types without a pack are medical devices). */
export const packOf = (productTypeId: string | undefined, types: ProductType[]): IndustryPackId =>
  types.find((t) => t.id === productTypeId)?.industryPackId ?? (productTypeId === 'type-digital' || productTypeId === 'type-service' ? 'general' : 'medical-devices');

export interface CheckContext { productTypes: ProductType[]; attributeTemplates: Record<string, AttributeDefinition[]> }

export const checkProduct = (p: Partial<Product>, all: Product[], rules: ValidationRule[], selfId: string | null, ctx?: CheckContext): CheckResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!p.name?.trim()) errors.push('Product name is required.');
  if (!p.code?.trim()) errors.push('Product code is required.');
  if (on(rules, 'val-unique-code') && p.code && all.some((x) => x.id !== selfId && x.code.trim().toLowerCase() === p.code!.trim().toLowerCase())) errors.push(`Product code ${p.code} is already used by another product.`);

  const digital = p.productTypeId === 'type-digital' || p.productTypeId === 'type-service';
  if (on(rules, 'val-hsn') && !digital && !/^\d{8}$/.test(p.hsnCode ?? '')) errors.push('HSN code must be 8 digits.');

  // GTINs: check digit + uniqueness across the catalogue
  const taken = usedGtins(all, selfId);
  // The same GTIN may appear as identifier, variant and base-unit barcode of ONE item; it must not
  // be shared by two different variants or two different packaging levels.
  const groups: { kind: string; list: { where: string; code: string }[] }[] = [
    { kind: 'identifier', list: (p.identifiers ?? []).filter((i) => /GTIN/i.test(i.type)).map((i) => ({ where: `Identifier ${i.type}`, code: i.value })) },
    { kind: 'variant', list: (p.variants ?? []).filter((v) => v.gtin).map((v) => ({ where: `Variant ${v.sku}`, code: v.gtin })) },
    { kind: 'packaging', list: (p.uomHierarchy ?? []).filter((u) => /^\d{8,14}$/.test(u.barcode)).map((u) => ({ where: `${u.level} barcode`, code: u.barcode })) },
  ];
  groups.forEach(({ kind, list }) => {
    const seen = new Set<string>();
    list.forEach(({ where, code }) => {
      const e = gtinError(code);
      if (e && on(rules, 'val-gs1-check')) errors.push(`${where} ${code}: ${e}`);
      const n = normalise(code);
      if (on(rules, 'val-unique-code') && taken.has(n)) errors.push(`${where} ${code} is already used by another product.`);
      if (seen.has(n)) errors.push(`${where} ${code} is shared by two ${kind === 'variant' ? 'variants' : kind === 'packaging' ? 'packaging levels' : 'identifiers'}.`);
      seen.add(n);
    });
  });

  const pack = packOf(p.productTypeId, ctx?.productTypes ?? []);
  const type = ctx?.productTypes.find((t) => t.id === p.productTypeId);
  const template = type ? ctx?.attributeTemplates[type.attributeTemplate] ?? [] : [];
  if (on(rules, 'val-required-attrs')) {
    template.filter((a) => a.required && !(a.isVariant && p.hasVariants)).forEach((a) => {
      if (!String(p.attributes?.[a.id] ?? '').trim()) errors.push(`Attribute "${a.name}" is required for ${type?.name}.`);
    });
  }

  const reg = p.regulatory;
  const implant = pack === 'medical-devices' && (reg?.implantable || p.productTypeId === 'type-implant');
  if (on(rules, 'val-udi') && implant && !(p.identifiers ?? []).some((i) => /GTIN|UDI/i.test(i.type))) errors.push('Implantable devices need a GTIN / UDI-DI identifier.');

  if (pack !== 'medical-devices' && pack !== 'general' && on(rules, 'val-pack-compliance')) {
    const r = checkCompliance(pack, p.productTypeId, p.compliance ?? {}, todayISO());
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  if (pack === 'medical-devices' && (!digital || reg)) {
    if (!reg) errors.push('Regulatory details (CDSCO risk class and licence) are required.');
    else {
      if (on(rules, 'val-licence') && reg.licenceType !== 'Not required') {
        if (!reg.licenceNo.trim()) errors.push('Licence number is required.');
        if (!reg.licenceValidUntil) errors.push('Licence validity date is required.');
        else if (reg.licenceValidUntil < todayISO()) errors.push(`Licence ${reg.licenceNo} expired on ${reg.licenceValidUntil}.`);
        if (reg.licenceType.startsWith('Manufacturing') && reg.licenceType !== licenceFormFor(reg.riskClass)) errors.push(`Class ${reg.riskClass} devices need a ${licenceFormFor(reg.riskClass)} licence, not ${reg.licenceType}.`);
      }
      if (reg.licenceType === 'Not required' && reg.riskClass !== 'A') warnings.push(`Class ${reg.riskClass} devices normally need a CDSCO licence.`);
      if (reg.sterile && !reg.shelfLifeMonths) errors.push('Sterile products need a shelf life.');
    }
  }

  const pr = p.pricingReference;
  if (on(rules, 'val-price-ceiling') && pr?.govPriceCapEnforced && pr.govNpddCeiling && pr.mrp > pr.govNpddCeiling) errors.push(`MRP ₹${pr.mrp.toLocaleString('en-IN')} is above the NPPA ceiling ₹${pr.govNpddCeiling.toLocaleString('en-IN')}.`);

  if (p.isKit) {
    const comps = p.kitComponents ?? [];
    if (!comps.length) errors.push('A set / kit needs at least one component.');
    if (comps.some((c) => c.productId === selfId)) errors.push('A set cannot contain itself.');
    if (comps.some((c) => !(c.qty > 0))) errors.push('Every kit component needs a quantity above 0.');
  }

  (p.documents ?? []).forEach((d) => { if (isDate(d.expiry) && d.expiry < todayISO()) warnings.push(`Document "${d.name}" expired on ${d.expiry}.`); });
  return { errors, warnings };
};

/** Days until a YYYY-MM-DD date (negative = past). */
export const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayISO()}T00:00:00`).getTime()) / 86400000);

export const expiryLabel = (iso?: string | null, warnDays = 60): { text: string; tone: 'ok' | 'warn' | 'bad' } | null => {
  if (!isDate(iso)) return null;
  const d = daysUntil(iso);
  if (d < 0) return { text: `Expired ${-d}d ago`, tone: 'bad' };
  if (d <= warnDays) return { text: `Expires in ${d}d`, tone: 'warn' };
  return { text: 'Valid', tone: 'ok' };
};
