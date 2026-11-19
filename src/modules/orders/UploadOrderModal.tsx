import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, Modal, NumberInput, SearchableSelect, Select } from '../../platform/ui';
import { useApp } from '../../context/AppContext.tsx';
import type { Partner } from '../gtm-v2/types';
import { createOrder, getOrder, routeOf } from './orderStore';
import type { OrderCtx } from './orderStore';
import { priceLine, rememberAliases, shipFromFor } from './intake';
import { routeOrder, supplierOf } from './routing';
import { channelOpen } from './orderSettings';
import {
  detectPartner, duplicateOf, guessColumns, headerRow, matchLine, poMeta, readOrderFile, rememberColumns, rememberPartnerCodes, samplePdf, savedColumns, tableLines, textLines,
} from './upload';
import type { Field as Col, Match, ParsedDoc, RawLine } from './upload';

const inr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const FIELDS: { value: Col; label: string }[] = [{ value: 'code', label: 'Item code' }, { value: 'name', label: 'Description' }, { value: 'qty', label: 'Quantity' }, { value: 'price', label: 'Rate' }, { value: 'ignore', label: '— ignore —' }];
const download = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };

interface Row extends RawLine { match: Match | null; usePo: boolean }

export const UploadOrderModal: React.FC<{ ctx: OrderCtx; onClose: () => void; onOpen: (id: string) => void }> = ({ ctx, onClose, onOpen }) => {
  const { activePrincipal, currentUser, warehouses, showToast } = useApp();
  const products = useMemo(() => ctx.products.filter((p) => p.principalId === activePrincipal.id), [ctx.products, activePrincipal.id]);
  const productOpts = useMemo(() => products.flatMap((p) => (p.variants.length ? p.variants.map((v) => ({ value: `${p.id}|${v.sku}`, label: v.name, description: v.sku })) : [{ value: `${p.id}|`, label: p.name, description: p.code }])), [products]);
  const partners = ctx.partners.filter((p) => p.status === 'Active');
  const [docs, setDocs] = useState<ParsedDoc[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [detected, setDetected] = useState(false);
  const [meta, setMeta] = useState({ po: '', poDate: inDays(0), requiredBy: inDays(4) });
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [created, setCreated] = useState<string[]>([]);
  const doc = docs[idx];
  const partner = partners.find((p) => p.id === partnerId) ?? null;
  const head = doc && doc.kind !== 'PDF' ? headerRow(doc.table) : -1;
  const headers = head >= 0 ? doc.table[head] : [];

  /** (Re)read the lines of the current document with the partner and column mapping in force. */
  const build = (d: ParsedDoc, p: Partner | null, map: Col[] | null) => {
    let raw: RawLine[];
    let m = map;
    if (d.kind === 'PDF') raw = textLines(d.text, (c) => !!matchLine({ code: c, name: '', qty: 1, price: null, source: '' }, p?.id ?? null, products));
    else {
      const h = headerRow(d.table);
      if (h < 0) { setErrs(['Couldn’t find a header row (columns like Item code, Description, Qty, Rate). Use the VinFlux template or add a header row.']); setRows([]); return; }
      m = map ?? guessColumns(d.table[h], p ? savedColumns(p.id) : null);
      setCols(m);
      raw = tableLines(d.table, h, m);
    }
    setRows(raw.map((l) => ({ ...l, match: matchLine(l, p?.id ?? null, products), usePo: false })));
    setErrs(raw.length ? [] : ['No order lines found in this file.']);
  };
  const load = (d: ParsedDoc, keepPartner = '') => {
    const found = keepPartner ? partners.find((p) => p.id === keepPartner) ?? null : detectPartner(d, partners);
    setPartnerId(found?.id ?? '');
    setDetected(!!found && !keepPartner);
    const m = poMeta(d);
    setMeta({ po: m.po ?? '', poDate: m.poDate ?? inDays(0), requiredBy: m.requiredBy ?? inDays(4) });
    build(d, found, null);
  };
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErrs([]);
    try {
      const read = await Promise.all([...files].map(readOrderFile));
      setDocs(read); setIdx(0); setCreated([]); load(read[0], partnerId);
    } catch (e) { setErrs([(e as Error).message]); }
    setBusy(false);
  };
  const samples = (kind: 'csv' | 'pdf') => {
    const p = partner ?? partners.find((x) => routeOf(x.id, ctx).ok) ?? partners[0];
    const items = products.filter((x) => x.lifecycleStatus === 'Active').slice(0, 3).map((x, i) => ({ code: x.variants[0]?.sku ?? x.code, name: (x.variants[0]?.name ?? x.name).slice(0, 48), qty: [10, 4, 25][i], rate: Math.round((x.pricingReference?.mrp ?? 1000) * 0.6) }));
    if (kind === 'csv') {
      const csv = ['Item Code,Description,Qty,Rate', ...items.map((x) => `${x.code},"${x.name.replace(/"/g, '')}",${x.qty},${x.rate}`)].join('\n');
      download(new Blob([csv], { type: 'text/csv' }), 'sample-order.csv');
    } else {
      download(samplePdf([`${p?.name ?? 'Partner'}`, `GSTIN: ${p?.gst ?? ''}`, 'PURCHASE ORDER', `PO No: PO/${(p?.code ?? 'PTR').replace(/[^A-Z0-9]/gi, '')}/${Math.floor(Math.random() * 900 + 100)}`, `PO Date: ${new Date().toLocaleDateString('en-GB')}`, `Required by: ${new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-GB')}`, '',
        'Item Code   Description   Qty   Rate   Amount', ...items.map((x) => `${x.code}   ${x.name}   ${x.qty}   ${x.rate.toFixed(2)}   ${(x.qty * x.rate).toFixed(2)}`), '', 'Authorised signatory']), 'sample-po.pdf');
    }
  };

  const route = partner ? routeOf(partner.id, ctx) : null;
  const channel = doc ? (doc.kind === 'PDF' ? 'pdf' : 'excel') : null;
  const blockedChannel = channel && !channelOpen(channel, partner?.id) ? `${doc!.kind === 'PDF' ? 'PDF' : 'Excel'} upload is switched off${partner && channelOpen(channel) ? ` for ${partner.name}` : ''} (Orders → Settings → Order intake).` : null;
  const dup = partner && meta.po ? duplicateOf(partner.id, meta.po) : null;
  const transfer = partner?.partnerTypeId === 'pt-cnf';
  const priced = rows.map((r) => (partner && r.match ? priceLine(ctx, partner.id, activePrincipal.id, r.match.productId, r.match.variantSku, r.qty, transfer) : null));

  const create = () => {
    const e: string[] = [];
    if (!partner) e.push('Choose the partner the order is from.');
    if (blockedChannel) e.push(blockedChannel);
    // GTM-04: a partner that buys through a distributor — route the uploaded order to that distributor as demand.
    if (partner && route && !route.ok && supplierOf(partner.id, ctx) && doc && rows.every((r) => r.match)) {
      const rr = routeOrder({ principalId: activePrincipal.id, from: partner, source: doc.kind === 'PDF' ? 'PDF' : 'Excel', poNumber: meta.po.trim(), by: currentUser.name,
        lines: rows.map((r) => { const pr = ctx.products.find((x) => x.id === r.match!.productId); return { productId: r.match!.productId, name: pr?.name ?? r.name, qty: r.qty, unitValue: r.price ?? (pr?.pricingReference?.mrp ?? 0) * 0.7 }; }) }, ctx);
      if (rr.ok) { showToast(rr.message, 'success'); onClose(); return; }
    }
    if (route && !route.ok) e.push(route.text);
    if (!meta.po.trim()) e.push('PO number is required.');
    if (dup) e.push(`PO ${meta.po} from ${partner?.name} is already order ${dup.code} (${dup.status}). Change the PO number if this is a different order.`);
    rows.forEach((r, i) => { if (!r.match) e.push(`Line ${i + 1} (${r.code || r.name}): pick the product.`); });
    if (!rows.length) e.push('No lines to order.');
    if (e.length || !partner) { setErrs(e); return; }
    const shipFrom = shipFromFor(partner.id, ctx, warehouses, rows.map((r) => r.match!.productId));
    if (!shipFrom) { setErrs([route?.text ?? 'No supply route.']); return; }
    const lines = rows.map((r, i) => {
      const l = priced[i]!;
      const po = r.price;
      return { ...l, poPrice: po, partnerCode: r.code || null,
        ...(r.usePo && po !== null && po !== l.netUnit ? { netUnit: po, priceSource: `PO price (list ${inr(l.netUnit)})` } : {}) };
    });
    const res = createOrder({ principalId: activePrincipal.id, partner, channelId: null, orderType: transfer ? 'Stock transfer' : 'Sale', shipFrom, poNumber: meta.po.trim(), poDate: meta.poDate, requiredBy: meta.requiredBy,
      source: doc.kind === 'PDF' ? 'PDF' : 'Excel', notes: `Uploaded from ${doc.name}`, enteredFor: partner.name, attachment: { name: doc.name, kind: doc.kind }, lines }, currentUser.name, ctx);
    if (!res.ok || !res.id) { setErrs(res.errors ?? [res.message]); return; }
    // Remember what people taught VinFlux for this partner: item codes and the Excel column layout.
    const codes = Object.fromEntries(rows.filter((r) => r.code && r.match && r.match.via !== 'Your code / SKU / GTIN').map((r) => [r.code, { productId: r.match!.productId, variantSku: r.match!.variantSku }]));
    if (Object.keys(codes).length) { rememberPartnerCodes(partner.id, codes); rememberAliases(codes); }
    if (doc.kind !== 'PDF' && head >= 0) rememberColumns(partner.id, headers, cols);
    const o = getOrder(res.id)!;
    showToast(`${o.code} created from ${doc.name} — ${o.status}.`, 'success');
    const done = [...created, res.id];
    setCreated(done);
    if (idx + 1 < docs.length) { setIdx(idx + 1); load(docs[idx + 1]); } else { onClose(); onOpen(res.id); }
  };

  return (
    <Modal open size="xl" title="Upload an order" subtitle="Excel, CSV or PDF purchase orders from partners who don’t use the portal. Nothing becomes an order until you press Create order." onClose={onClose}
      footer={<><Button onClick={onClose}>Close</Button>{doc && <Button variant="primary" icon={<Upload size={14} />} onClick={create} disabled={!rows.length}>Create order{docs.length > 1 ? ` (${idx + 1} of ${docs.length})` : ''}</Button>}</>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <Card>
          <div className="g2-row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="File(s)" hint="Excel (.xlsx), CSV or PDF — several files become several orders.">
              <input type="file" accept=".xlsx,.xls,.csv,.pdf" multiple aria-label="Order files" onChange={(e) => { void pick(e.target.files); e.target.value = ''; }} />
            </Field>
            <span className="g2-spacer" />
            <Button size="sm" variant="ghost" icon={<FileSpreadsheet size={14} />} onClick={() => samples('csv')}>Sample Excel / CSV</Button>
            <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => samples('pdf')}>Sample PDF PO</Button>
          </div>
          {busy && <div className="g2-small g2-muted" style={{ marginTop: 8 }}>Reading…</div>}
          {created.length > 0 && <Alert tone="success">{created.length} order(s) created so far.</Alert>}
        </Card>

        {doc && (
          <>
            <Card title={<span className="g2-row" style={{ gap: 8 }}>{doc.kind === 'PDF' ? <FileText size={16} /> : <FileSpreadsheet size={16} />}{doc.name}<Badge tone="slate">{doc.kind}</Badge></span>}>
              <FormGrid cols={3}>
                <Field label="Partner" required hint={detected ? 'Found in the file (GSTIN / name / email).' : 'Not found in the file — choose it.'}>
                  <SearchableSelect value={partnerId} options={partners.map((p) => ({ value: p.id, label: p.name, description: p.gst }))} onChange={(v) => { setPartnerId(v ?? ''); setDetected(false); build(doc, partners.find((p) => p.id === v) ?? null, null); }} />
                </Field>
                <Field label="PO number" required><Input value={meta.po} onChange={(e) => setMeta({ ...meta, po: e.target.value })} /></Field>
                <Field label="Required by"><Input type="date" value={meta.requiredBy} onChange={(e) => setMeta({ ...meta, requiredBy: e.target.value })} /></Field>
              </FormGrid>
              {detected && partner && <Badge tone="green" dot>Partner detected: {partner.name}</Badge>}
              {route && !route.ok && <Alert tone="error">{route.text}</Alert>}
              {blockedChannel && <Alert tone="error">{blockedChannel}</Alert>}
              {dup && <Alert tone="warn">Possible duplicate: PO {meta.po} from {partner?.name} is already order <strong>{dup.code}</strong> ({dup.status}).</Alert>}
            </Card>

            {doc.kind !== 'PDF' && head >= 0 && (
              <Card title="Columns" subtitle={partner && savedColumns(partner.id) ? `Using the layout remembered for ${partner.name}.` : 'Check what each column holds — remembered for this partner once you create the order.'}>
                <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {headers.map((h, i) => (
                    <div key={i} style={{ minWidth: 150 }}>
                      <div className="g2-small g2-strong" style={{ marginBottom: 4 }}>{h || `Column ${i + 1}`}</div>
                      <Select value={cols[i] ?? 'ignore'} aria-label={`Column ${h}`} options={FIELDS} onChange={(v) => { const m = [...cols]; m[i] = v as Col; setCols(m); build(doc, partner, m); }} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {doc.kind === 'PDF' && (
              <details className="g2-small"><summary style={{ cursor: 'pointer' }}>Text read from the PDF</summary><pre style={{ whiteSpace: 'pre-wrap', background: 'var(--g2-surface-2, #f8fafc)', padding: 10, borderRadius: 8, maxHeight: 220, overflow: 'auto' }}>{doc.text}</pre></details>
            )}

            <Card title={`Lines (${rows.length})`} subtitle="Unmatched codes: pick the product once — remembered as this partner’s item code.">
              <div className="g2-table-wrap"><table className="g2-table">
                <thead><tr><th>From file</th><th style={{ minWidth: 260 }}>Product</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>PO rate</th><th style={{ textAlign: 'right' }}>Price list</th><th>Use</th></tr></thead>
                <tbody>{rows.map((r, i) => {
                  const pl = priced[i];
                  const diff = pl && r.price !== null && pl.netUnit !== null && Math.abs(r.price - pl.netUnit) >= 1;
                  return (
                    <tr key={i}>
                      <td><div className="g2-mono g2-small">{r.code || '—'}</div><div className="g2-cell-sub">{r.name.slice(0, 50)} · {r.source}</div></td>
                      <td>
                        <SearchableSelect value={r.match ? `${r.match.productId}|${r.match.variantSku ?? ''}` : ''} options={productOpts}
                          onChange={(v) => { const [productId, sku] = (v ?? '').split('|'); setRows(rows.map((x, j) => (j === i ? { ...x, match: v ? { productId, variantSku: sku || null, via: 'Picked' } : null } : x))); }} />
                        {r.match ? <span className="g2-cell-sub">{r.match.via}</span> : <Badge tone="amber">Not matched</Badge>}
                      </td>
                      <td style={{ textAlign: 'right', width: 90 }}><NumberInput value={r.qty} aria-label={`Quantity line ${i + 1}`} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: Math.max(0, v ?? 0) } : x)))} /></td>
                      <td style={{ textAlign: 'right' }}>{inr(r.price)}</td>
                      <td style={{ textAlign: 'right' }}>{pl ? inr(pl.netUnit) : '—'}{pl && <div className="g2-cell-sub">{pl.priceSource}</div>}</td>
                      <td style={{ minWidth: 170 }}>{diff && !transfer ? <Select value={r.usePo ? 'po' : 'list'} aria-label={`Price for line ${i + 1}`} options={[{ value: 'list', label: 'Price list' }, { value: 'po', label: 'PO rate (needs approval)' }]} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, usePo: v === 'po' } : x)))} /> : <span className="g2-muted g2-small">Price list</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </Card>
          </>
        )}
      </div>
    </Modal>
  );
};
