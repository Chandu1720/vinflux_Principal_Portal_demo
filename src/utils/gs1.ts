/**
 * GS1 helpers: check digit, GTIN validation and generation.
 * GTIN-13 = GS1 company prefix + item reference + check digit.
 * GTIN-14 (packaging levels) = indicator digit (1–8) + first 12 digits of the GTIN-13 + new check digit.
 */
import type { Product } from '../types/product.ts';

/** GS1 mod-10 check digit for a numeric body (any length). */
export const gs1CheckDigit = (body: string): number => {
  let sum = 0;
  const digits = body.split('').reverse();
  digits.forEach((d, i) => { sum += Number(d) * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10;
};

export const isValidGtin = (code: string): boolean => {
  const c = code.trim();
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  return gs1CheckDigit(c.slice(0, -1)) === Number(c.slice(-1));
};

export const gtinError = (code: string): string | null => {
  const c = code.trim();
  if (!/^\d+$/.test(c)) return 'GTIN must contain digits only.';
  if (![8, 12, 13, 14].includes(c.length)) return 'GTIN must be 8, 12, 13 or 14 digits.';
  if (!isValidGtin(c)) return `Check digit is wrong — expected ${gs1CheckDigit(c.slice(0, -1))}.`;
  return null;
};

/** Every GTIN already used in the catalogue (identifiers, variants, packaging barcodes). */
export const usedGtins = (products: Product[], excludeProductId?: string | null): Set<string> => {
  const s = new Set<string>();
  products.filter((p) => p.id !== excludeProductId).forEach((p) => {
    (p.identifiers ?? []).forEach((i) => { if (/^\d{8,14}$/.test(i.value)) s.add(normalise(i.value)); });
    (p.variants ?? []).forEach((v) => { if (v.gtin) s.add(normalise(v.gtin)); });
    (p.uomHierarchy ?? []).forEach((u) => { if (/^\d{8,14}$/.test(u.barcode)) s.add(normalise(u.barcode)); });
  });
  return s;
};

/** Compare GTINs regardless of leading-zero padding (GTIN-13 "890…" == GTIN-14 "0890…"). */
export const normalise = (g: string) => g.trim().padStart(14, '0');

/** Demo GS1 India company prefix for the principal (890 = GS1 India). */
export const COMPANY_PREFIX = '8901234';

/** Next free GTIN-13 under the company prefix, avoiding every code in `taken`. */
export const nextGtin13 = (taken: Set<string>, prefix = COMPANY_PREFIX): string => {
  const refLen = 12 - prefix.length;
  for (let ref = 1; ref < 10 ** refLen; ref += 1) {
    const body = prefix + String(ref).padStart(refLen, '0');
    const gtin = body + gs1CheckDigit(body);
    if (!taken.has(normalise(gtin))) { taken.add(normalise(gtin)); return gtin; }
  }
  throw new Error('GS1 company prefix exhausted');
};

/** GTIN-14 for a packaging level (indicator 1 = inner box, 2 = carton…). */
export const packGtin14 = (gtin13: string, indicator: number): string => {
  const body = `${indicator}${gtin13.slice(0, 12)}`;
  return body + gs1CheckDigit(body);
};
