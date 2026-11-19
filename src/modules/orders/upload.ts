/**
 * Order upload — Excel / CSV / PDF purchase orders turned into a reviewed order.
 *
 *   1. read the file (Excel / CSV table, or the text of a PDF)
 *   2. find the partner (GSTIN, name or email in the file — or the one chosen)
 *   3. Excel: map the columns once per partner (remembered); PDF: lines are read as "code … qty … rate"
 *   4. match each line: partner's own item code (remembered per partner) → principal code / SKU / GTIN → shared aliases
 *   5. duplicate PO check; the review screen shows everything before "Create order"
 * INTEGRATION POINT: the same parser runs on email attachments (email sync) in the backend.
 */
import readXlsxFile from 'read-excel-file';
import type { Partner } from '../gtm-v2/types';
import type { Product } from '../../types/product.ts';
import { parseCsv } from '../../platform/import/csv';
import { findProduct } from '../../platform/import/entities';
import { loadJson, saveJson } from '../../platform/store';
import { workspaceKey } from '../../platform/workspace';
import { aliasFor } from './intake';
import { orders } from './orderStore';

export type Field = 'code' | 'name' | 'qty' | 'price' | 'ignore';
export interface ParsedDoc { kind: 'Excel' | 'CSV' | 'PDF'; name: string; table: string[][]; text: string }
export interface RawLine { code: string; name: string; qty: number; price: number | null; source: string }
export interface Match { productId: string; variantSku: string | null; via: 'Partner code' | 'Your code / SKU / GTIN' | 'Remembered' | 'Picked' }

/* ---------------------------------- Memory ---------------------------------- */

interface Memory { columns: Record<string, Record<string, Field>>; codes: Record<string, Record<string, { productId: string; variantSku: string | null }>> }
const KEY = () => workspaceKey('vinflux.orderUpload.v1');
const mem = (): Memory => loadJson<Memory>(KEY(), { columns: {}, codes: {} });
/** Column mapping remembered for a partner: header text → field. */
export const savedColumns = (partnerId: string) => mem().columns[partnerId] ?? null;
export const rememberColumns = (partnerId: string, headers: string[], map: Field[]) => {
  const m = mem();
  saveJson(KEY(), { ...m, columns: { ...m.columns, [partnerId]: Object.fromEntries(headers.map((h, i) => [h.trim().toLowerCase(), map[i] ?? 'ignore'])) } });
};
export const partnerCode = (partnerId: string, code: string) => mem().codes[partnerId]?.[code.trim().toLowerCase()] ?? null;
export const rememberPartnerCodes = (partnerId: string, map: Record<string, { productId: string; variantSku: string | null }>) => {
  const m = mem();
  saveJson(KEY(), { ...m, codes: { ...m.codes, [partnerId]: { ...(m.codes[partnerId] ?? {}), ...Object.fromEntries(Object.entries(map).map(([k, v]) => [k.trim().toLowerCase(), v])) } } });
};

/* ---------------------------------- Reading ---------------------------------- */

const cell = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();

/** Text of a PDF, one line per row of text (items grouped by their vertical position). */
const pdfText = async (buf: ArrayBuffer): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const out: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => out.push(items.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join('   ')));
  }
  return out.join('\n');
};

export const readOrderFile = async (file: File): Promise<ParsedDoc> => {
  const name = file.name;
  if (/\.pdf$/i.test(name)) {
    const text = await pdfText(await file.arrayBuffer());
    return { kind: 'PDF', name, table: [], text };
  }
  if (/\.(csv|txt)$/i.test(name)) {
    const table = parseCsv(await file.text()).map((r) => r.map(cell));
    return { kind: 'CSV', name, table, text: table.map((r) => r.join(' ')).join('\n') };
  }
  if (/\.xlsx?$/i.test(name)) {
    const table = (await readXlsxFile(file)).map((r) => r.map(cell));
    return { kind: 'Excel', name, table, text: table.map((r) => r.join(' ')).join('\n') };
  }
  throw new Error('Upload an Excel (.xlsx), CSV or PDF file.');
};

/* ------------------------------ Partner and PO ------------------------------ */

/** The partner the document is from: GSTIN, then email, then name found in the file. */
export const detectPartner = (doc: ParsedDoc, partners: Partner[]): Partner | null => {
  const t = doc.text.toUpperCase();
  const norm = (s: string) => s.toUpperCase().replace(/\b(PVT|PRIVATE|LTD|LIMITED|LLP|AND|&|CO|THE)\b\.?/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  const nt = norm(doc.text);
  return partners.find((p) => p.gst && t.includes(p.gst.toUpperCase()))
    ?? partners.find((p) => p.email && t.includes(p.email.toUpperCase()))
    ?? partners.filter((p) => norm(p.name).length > 4 && nt.includes(norm(p.name))).sort((a, b) => b.name.length - a.name.length)[0]
    ?? null;
};

const DATE = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/;
const isoDate = (s: string | undefined) => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
/** PO number, PO date and required-by date read from the document. */
export const poMeta = (doc: ParsedDoc) => {
  const t = doc.text;
  const po = t.match(/\b(?:P\.?O\.?|Purchase\s+Order)\s*(?:No\.?|Number|#|Ref)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,})/i)?.[1] ?? null;
  const poDate = isoDate(t.match(new RegExp(`(?:PO\\s*Date|Order\\s*Date|Date)\\s*[:-]?\\s*${DATE.source}`, 'i'))?.[1]);
  const requiredBy = isoDate(t.match(new RegExp(`(?:Required\\s*by|Delivery\\s*(?:date|by)|Deliver\\s*by)\\s*[:-]?\\s*${DATE.source}`, 'i'))?.[1]);
  return { po, poDate, requiredBy };
};

/* ---------------------------------- Lines ---------------------------------- */

const HEAD: [Field, RegExp][] = [
  ['qty', /\b(qty|quantity|units|nos|order\s*qty)\b/i],
  ['price', /\b(rate|price|unit\s*price|unit\s*cost)\b/i],
  ['code', /\b(code|sku|item\s*(no|code)?|part\s*(no)?|cat(alog)?\s*(no)?|gtin|barcode|material)\b/i],
  ['name', /\b(desc(ription)?|product|item\s*name|name|particulars)\b/i],
];
/** The header row: the first row with at least two recognisable column titles. */
export const headerRow = (table: string[][]) => table.findIndex((r) => r.filter((c) => HEAD.some(([, re]) => re.test(c))).length >= 2);
/** Guess a field per column from its title (or the partner's saved mapping). */
export const guessColumns = (headers: string[], saved: Record<string, Field> | null): Field[] => {
  const used = new Set<Field>();
  return headers.map((h) => {
    const s = saved?.[h.trim().toLowerCase()];
    if (s) return s;
    const f = HEAD.find(([k, re]) => !used.has(k) && re.test(h))?.[0] ?? 'ignore';
    if (f !== 'ignore') used.add(f);
    return f;
  });
};
const num = (s: string) => { const n = Number(s.replace(/[₹,\s]|rs\.?|inr/gi, '')); return Number.isFinite(n) && s.trim() !== '' ? n : null; };

/** Lines from a table with a column mapping. */
export const tableLines = (table: string[][], head: number, map: Field[]): RawLine[] =>
  table.slice(head + 1).map((r, i) => {
    const get = (f: Field) => { const j = map.indexOf(f); return j >= 0 ? r[j] ?? '' : ''; };
    const qty = num(get('qty'));
    return { code: get('code'), name: get('name'), qty: qty ?? 0, price: num(get('price')), source: `Row ${head + i + 2}` };
  }).filter((l) => (l.code || l.name) && l.qty > 0);

/**
 * Lines from PDF text: a code-like token, then the numbers at the END of the line — the usual PO layout is
 * code · description · qty · rate · amount (numbers inside the description, like "Size 2" or "10mm", are ignored).
 */
export const textLines = (text: string, isKnown: (code: string) => boolean): RawLine[] =>
  text.split('\n').flatMap((line, i) => {
    const tokens = line.split(/\s+/).filter(Boolean);
    const known = tokens.findIndex((t) => isKnown(t));
    const at = known >= 0 ? known : tokens.findIndex((t) => /^[A-Z0-9][A-Z0-9./-]{3,}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t));
    if (at < 0) return [];
    const rest = tokens.slice(at + 1);
    let k = rest.length;
    while (k > 0 && num(rest[k - 1]) !== null) k--;
    const tail = rest.slice(k).map((t) => num(t)!);
    if (!tail.length) return [];
    // 3+ trailing numbers: qty, rate, amount (take qty / rate from the end); 2: qty, rate; 1: qty.
    const qty = tail.length >= 3 ? tail[tail.length - 3] : tail[0];
    const price = tail.length >= 3 ? tail[tail.length - 2] : tail.length === 2 ? tail[1] : null;
    if (!Number.isInteger(qty) || qty <= 0 || qty >= 100000) return [];
    return [{ code: tokens[at], name: rest.slice(0, k).join(' '), qty, price, source: `Line ${i + 1}` }];
  });

/** Match a line to a product: partner's own code → principal code / SKU / GTIN → shared alias. */
export const matchLine = (l: RawLine, partnerId: string | null, products: Product[]): Match | null => {
  const pc = partnerId && l.code ? partnerCode(partnerId, l.code) : null;
  if (pc) return { ...pc, via: 'Partner code' };
  const f = l.code ? findProduct(l.code, products) : null;
  if (f) return { productId: f.product.id, variantSku: f.variantSku, via: 'Your code / SKU / GTIN' };
  const a = l.code ? aliasFor(l.code) : null;
  if (a) return { ...a, via: 'Remembered' };
  return null;
};

/** An open or past order from the same partner with the same PO number (rejected / cancelled ones don't count). */
export const duplicateOf = (partnerId: string, po: string) =>
  orders().find((o) => o.partnerId === partnerId && o.poNumber.trim().toLowerCase() === po.trim().toLowerCase() && !['Rejected', 'Cancelled'].includes(o.status)) ?? null;

/* ------------------------------- Demo samples ------------------------------- */

/** A small, valid one-page PDF with the given lines of text (demo sample PO). */
export const samplePdf = (lines: string[]): Blob => {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '');
  const stream = `BT /F1 11 Tf 50 790 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
};
