/** Client-side export helpers (CSV / Excel-compatible / print). */

const escapeCsv = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (headers: string[], rows: (string | number | boolean | null | undefined)[][]): string =>
  [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');

export const downloadFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportCsv = (filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) =>
  downloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, '﻿' + toCsv(headers, rows), 'text/csv;charset=utf-8');

/** Excel opens HTML tables saved as .xls — no extra dependency needed. */
export const exportExcel = (filename: string, title: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) => {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<html><head><meta charset="utf-8"></head><body><h3>${esc(title)}</h3><table border="1"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  downloadFile(filename.endsWith('.xls') ? filename : `${filename}.xls`, html, 'application/vnd.ms-excel');
};
