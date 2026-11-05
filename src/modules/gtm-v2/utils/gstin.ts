/**
 * GSTIN helpers — format, check digit (GSTN mod-36 algorithm), state and PAN derivation.
 */
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GST state / UT codes (first two digits of the GSTIN). */
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland',
  '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};

export const gstinCheckDigit = (first14: string): string => {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
};

export type GstinCheck = { ok: true; stateCode: string; state: string; pan: string } | { ok: false; error: string };

/** Offline structural validation — run before calling the registry. */
export const checkGstin = (raw: string): GstinCheck => {
  const g = raw.trim().toUpperCase();
  if (g.length !== 15) return { ok: false, error: 'GSTIN must be 15 characters.' };
  if (!GSTIN_FORMAT.test(g)) return { ok: false, error: 'GSTIN format is invalid (e.g. 36AAECC5521M1ZK).' };
  const state = GST_STATE_CODES[g.slice(0, 2)];
  if (!state) return { ok: false, error: `Unknown GST state code "${g.slice(0, 2)}".` };
  if (gstinCheckDigit(g.slice(0, 14)) !== g[14]) return { ok: false, error: 'GSTIN check digit is invalid — please re-check the number.' };
  return { ok: true, stateCode: g.slice(0, 2), state, pan: g.slice(2, 12) };
};
