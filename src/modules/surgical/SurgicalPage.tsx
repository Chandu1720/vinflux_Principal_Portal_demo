import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, CalendarClock, ClipboardCheck, Printer, Search, ShieldAlert, Stethoscope } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, Input, KpiCard, Modal, MultiSelect, NumberInput, PageHeader, SearchableSelect, Select, Stepper, Tabs, Textarea,
} from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useAssignments, useChannels, useConfig, usePartners, useTerms, useTerritories } from '../gtm-v2/hooks/useGtmData';
import { tradeStatusOf } from '../gtm-v2/utils/health';
import { assignmentState } from '../gtm-v2/utils/coverage';
import type { Partner } from '../gtm-v2/types';
import { gstOf, subscribePricing } from '../pricing/pricingStore';
import { quoteFor } from '../pricing/quoteFor';
import {
  bookCase, cancelCase, cases as listCases, closeCase, dispatchKit, getCase, getSet, markExplanted, recordUsage, refillImplants, register as listRegister,
  replaceItems, returnKit, sets as listSets, sterilised, subscribeSurgical, trace, udiString,
} from './surgicalStore';
import type { CaseStatus, ImplantRecord, InstrumentSet, SetStatus, SurgeryCase, UsageLine } from './surgicalStore';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86400000)) : 0);
const STEPS: CaseStatus[] = ['Confirmed', 'Kit dispatched', 'Surgery done', 'Kit returned', 'Closed'];
const CASE_TONE: Record<CaseStatus, 'blue' | 'amber' | 'purple' | 'green' | 'slate' | 'red'> = { Confirmed: 'blue', 'Kit dispatched': 'amber', 'Surgery done': 'purple', 'Kit returned': 'amber', Closed: 'green', Cancelled: 'slate' };
const SET_TONE: Record<SetStatus, 'green' | 'blue' | 'amber' | 'red' | 'purple'> = { Available: 'green', Reserved: 'blue', 'At hospital': 'purple', Incomplete: 'red', Sterilising: 'amber' };

/** GTM data the module needs (hospitals, partners, coverage, terms for prices). */
const useGtm = () => {
  const partners = usePartners().data ?? [];
  const config = useConfig().data;
  const channels = useChannels().data ?? [];
  const terms = useTerms().data ?? [];
  const territories = useTerritories().data ?? [];
  const assignments = useAssignments().data ?? [];
  return { partners, config, channels, terms, territories, assignments };
};

/* --------------------------------- New case --------------------------------- */

const NewCaseDrawer: React.FC<{ onClose: () => void; onOpen: (id: string) => void }> = ({ onClose, onOpen }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const g = useGtm();
  const hospitals = g.partners.filter((p) => p.institution && p.status === 'Active');
  const resellers = g.partners.filter((p) => !p.institution && p.status === 'Active');
  const [f, setF] = useState({ hospitalId: '', surgeon: '', procedure: 'Revision total knee replacement', surgeryDate: '', patientRef: '', servedBy: 'COMPANY' as 'COMPANY' | 'PARTNER', partnerId: '', setIds: [] as string[], notes: '' });
  const [errs, setErrs] = useState<string[]>([]);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const hospital = hospitals.find((h) => h.id === f.hospitalId);
  // Default supplier = whoever is the primary for this hospital in Hospital Coverage.
  const pickHospital = (id: string) => {
    const prim = g.assignments.find((a) => a.customerId === id && a.role === 'PRIMARY' && assignmentState(a) === 'Current');
    set({ hospitalId: id, servedBy: prim?.servedBy === 'PARTNER' ? 'PARTNER' : 'COMPANY', partnerId: prim?.partnerId ?? '', setIds: [] });
  };
  const freeSets = listSets().filter((s) => (s.kind === 'Loaner' ? s.status === 'Available' : s.hospitalId === f.hospitalId && s.status === 'At hospital' && !s.caseId));
  const blockers: string[] = [];
  const ctx = { channels: g.channels, terms: g.terms, territories: g.territories };
  if (hospital && g.config) { const t = tradeStatusOf(hospital, g.config, ctx); if (!t.canTrade) blockers.push(`${hospital.name} can’t be supplied: ${t.reasons.filter((r) => r.tone === 'red' || r.tone === 'slate').map((r) => r.text).join('; ')}.`); }
  const partner = resellers.find((p) => p.id === f.partnerId);
  if (f.servedBy === 'PARTNER' && partner && g.config) { const t = tradeStatusOf(partner, g.config, ctx); if (!t.canTrade) blockers.push(`${partner.name} can’t take this case: ${t.reasons.filter((r) => r.tone === 'red' || r.tone === 'slate').map((r) => r.text).join('; ')}.`); }
  if (f.servedBy === 'PARTNER' && !f.partnerId) blockers.push('Choose the partner serving this case.');
  const save = () => {
    const r = bookCase({ principalId: activePrincipal.id, hospitalId: f.hospitalId, hospitalName: hospital?.name ?? '', surgeon: f.surgeon, procedure: f.procedure, surgeryDate: f.surgeryDate, patientRef: f.patientRef,
      servedBy: f.servedBy, partnerId: f.servedBy === 'PARTNER' ? f.partnerId : null, partnerName: f.servedBy === 'PARTNER' ? partner?.name ?? null : null, setIds: f.setIds, notes: f.notes }, currentUser.name, blockers);
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose(); if (r.id) onOpen(r.id);
  };
  return (
    <Modal open size="lg" title="Book a surgery case" subtitle="Reserve instrument sets and implants for a scheduled surgery" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Book case</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t book yet" />}
        {blockers.length > 0 && errs.length === 0 && <Alert tone="error">{blockers.join(' ')}</Alert>}
        <FormGrid>
          <Field label="Hospital" required><SearchableSelect value={f.hospitalId} options={hospitals.map((h) => ({ value: h.id, label: h.name, description: h.institution?.hospitalGroup || h.address.city }))} placeholder="Choose hospital…" onChange={(v) => pickHospital(v ?? '')} /></Field>
          <Field label="Surgery date" required><Input type="date" value={f.surgeryDate} min={today()} onChange={(e) => set({ surgeryDate: e.target.value })} /></Field>
          <Field label="Surgeon" required><Input value={f.surgeon} placeholder="Dr. …" onChange={(e) => set({ surgeon: e.target.value })} /></Field>
          <Field label="Procedure" required><Input value={f.procedure} onChange={(e) => set({ procedure: e.target.value })} /></Field>
          <Field label="Hospital patient ID" required hint="UHID / IP number only — no patient names are stored"><Input value={f.patientRef} placeholder="e.g. YH-UHID-2026-120001" onChange={(e) => set({ patientRef: e.target.value })} /></Field>
          <Field label="Served by" hint={f.hospitalId ? 'Defaults to the primary in Hospital Coverage' : undefined}>
            <Select value={f.servedBy} options={[{ value: 'COMPANY', label: 'Company direct' }, { value: 'PARTNER', label: 'Channel partner' }]} onChange={(v) => set({ servedBy: v as 'COMPANY' | 'PARTNER' })} />
          </Field>
          {f.servedBy === 'PARTNER' && <Field label="Partner" required><SearchableSelect value={f.partnerId} options={resellers.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => set({ partnerId: v ?? '' })} /></Field>}
        </FormGrid>
        <Field label="Instrument sets" required hint={f.hospitalId ? `${freeSets.length} set(s) free — loaner sets from the warehouse, or consignment sets already at this hospital` : 'Choose the hospital first'}>
          <MultiSelect values={f.setIds} disabled={!f.hospitalId} placeholder="Choose sets…" options={freeSets.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}`, description: `${s.kind} · ${s.items.filter((i) => i.kind === 'Implant').length} implants loaded · cycle ${s.sterilisationCycles}` }))} onChange={(v) => set({ setIds: v })} />
        </Field>
        <Field label="Notes for the case"><Textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
};

/* -------------------------------- Case drawer -------------------------------- */

const CaseDrawer: React.FC<{ id: string; onClose: () => void; canEdit: boolean }> = ({ id, onClose, canEdit }) => {
  useSubscribe(subscribeSurgical, subscribePricing);
  const { products, currentUser, showToast } = useApp();
  const g = useGtm();
  const c = getCase(id);
  const [errs, setErrs] = useState<string[]>([]);
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState<{ productId: string; batch: string; serial: string; expiry: string; qty: number }[]>([]);
  const [counts, setCounts] = useState<Record<string, { returned: number; damaged: boolean }>>({});
  const [cancelReason, setCancelReason] = useState('');
  if (!c) return null;
  const caseSets = c.setIds.map(getSet).filter(Boolean) as InstrumentSet[];
  const hospital = g.partners.find((p) => p.id === c.hospitalId);
  const price = (productId: string, qty: number) => {
    if (!hospital || !g.config) return { unit: null as number | null, source: 'Hospital not found' };
    const q = quoteFor({ config: g.config, channels: g.channels, terms: g.terms, territories: g.territories }, hospital, c.principalId, productId, qty, c.surgeryDate, products);
    return { unit: q.netUnit, source: q.list ? `${q.list.type === 'CONTRACT' ? 'Rate contract' : 'Price list'} ${q.list.code}` : 'No price list' };
  };
  const run = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return; } setErrs([]); showToast(r.message, 'success'); };
  const implantFlag = (pid: string) => !!products.find((p) => p.id === pid)?.regulatory?.implantable;

  const saveUsage = () => {
    const lines: Omit<UsageLine, 'id'>[] = [];
    caseSets.forEach((s) => s.items.filter((it) => it.kind === 'Implant' && used[it.id]).forEach((it) => {
      const pr = price(it.productId!, 1);
      lines.push({ itemId: it.id, productId: it.productId!, name: it.name, variantSku: it.variantSku ?? null, udiDi: it.udiDi ?? '', batch: it.batch ?? '', serial: it.serial ?? null, expiry: it.expiry ?? null, qty: 1, implant: true, unitPrice: pr.unit, gstPct: gstOf(products.find((p) => p.id === it.productId)), priceSource: pr.source });
    }));
    extra.filter((e) => e.productId).forEach((e) => {
      const p = products.find((x) => x.id === e.productId)!;
      const pr = price(p.id, e.qty);
      lines.push({ itemId: null, productId: p.id, name: p.name, variantSku: null, udiDi: p.code, batch: e.batch, serial: e.serial || null, expiry: e.expiry || null, qty: e.qty, implant: implantFlag(p.id), unitPrice: pr.unit, gstPct: gstOf(p), priceSource: pr.source });
    });
    run(recordUsage(c.id, lines, currentUser.name));
  };

  const billLines = c.usage.map((u) => ({ name: `${u.name}${u.serial ? ` · SN ${u.serial}` : ''}`, qty: u.qty, unit: u.unitPrice, gst: u.gstPct, source: u.priceSource }));
  const taxable = billLines.reduce((a, l) => a + (l.unit ?? 0) * l.qty, 0) + c.missing.reduce((a, m) => a + m.charge, 0);
  const gst = billLines.reduce((a, l) => a + ((l.unit ?? 0) * l.qty * l.gst) / 100, 0) + c.missing.reduce((a, m) => a + (m.charge * 18) / 100, 0);
  const step = c.status === 'Cancelled' ? 0 : STEPS.indexOf(c.status);

  return (
    <Modal open size="xl" title={`${c.code} · ${c.hospitalName}`} subtitle={<span className="g2-row">{c.procedure} · {c.surgeryDate} · {c.surgeon} <Badge tone={CASE_TONE[c.status]} dot>{c.status}</Badge></span>} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {canEdit && c.status === 'Confirmed' && <Button variant="primary" onClick={() => run(dispatchKit(c.id, currentUser.name))}>Dispatch kit</Button>}
        {canEdit && c.status === 'Kit dispatched' && <Button variant="primary" onClick={saveUsage}>Save surgery usage</Button>}
        {canEdit && c.status === 'Surgery done' && <Button variant="primary" onClick={() => run(returnKit(c.id, counts, currentUser.name))}>Receive kit back</Button>}
        {canEdit && c.status === 'Kit returned' && <Button variant="primary" onClick={() => run(closeCase(c.id, currentUser.name))}>Close case & raise bill</Button>}
      </>}>
      <div className="g2-stack">
        {c.status !== 'Cancelled' && <Stepper steps={STEPS} current={step} maxReached={step} onSelect={() => undefined} />}
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t continue" />}
        <dl className="g2-dl">
          <dt>Hospital patient ID</dt><dd className="g2-mono">{c.patientRef}</dd>
          <dt>Served by</dt><dd>{c.servedBy === 'COMPANY' ? 'Company direct' : c.partnerName}</dd>
          <dt>Sets</dt><dd>{caseSets.map((s) => `${s.code} (${s.kind})`).join(', ')}</dd>
          {c.notes && <><dt>Notes</dt><dd>{c.notes}</dd></>}
          {c.billNo && <><dt>Bill</dt><dd className="g2-strong">{c.billNo}</dd></>}
        </dl>

        {c.status === 'Kit dispatched' && (
          <Card title="What was used in surgery" subtitle="Tick the implants taken from the set; add anything else used. Implants go to the implant register against this patient.">
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th style={{ width: 40 }} /><th>Implant in set</th><th>Batch</th><th>Serial</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Hospital price</th></tr></thead>
              <tbody>{caseSets.flatMap((s) => s.items.filter((it) => it.kind === 'Implant').map((it) => {
                const pr = price(it.productId!, 1);
                return (
                  <tr key={it.id}>
                    <td><Checkbox checked={!!used[it.id]} disabled={!canEdit} onChange={(v) => setUsed({ ...used, [it.id]: v })} /></td>
                    <td>{it.name}<div className="g2-cell-sub g2-mono">{it.variantSku}</div></td><td className="g2-mono">{it.batch}</td><td className="g2-mono">{it.serial}</td><td>{it.expiry}</td>
                    <td style={{ textAlign: 'right' }}>{pr.unit !== null ? inr(pr.unit) : <span className="g2-muted">—</span>}<div className="g2-cell-sub">{pr.source}</div></td>
                  </tr>
                );
              }))}</tbody>
            </table></div>
            <div className="g2-label" style={{ margin: '12px 0 6px' }}>Other items used (consumables, implants not from the set)</div>
            {extra.map((e, i) => (
              <div key={i} className="g2-row" style={{ gap: 6, marginBottom: 6 }}>
                <div style={{ flex: 2 }}><SearchableSelect value={e.productId} options={products.filter((p) => p.lifecycleStatus === 'Active').map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setExtra(extra.map((x, j) => (j === i ? { ...x, productId: v ?? '' } : x)))} /></div>
                <Input placeholder="Batch" value={e.batch} onChange={(ev) => setExtra(extra.map((x, j) => (j === i ? { ...x, batch: ev.target.value } : x)))} />
                <Input placeholder="Serial" value={e.serial} onChange={(ev) => setExtra(extra.map((x, j) => (j === i ? { ...x, serial: ev.target.value } : x)))} />
                <Input type="date" value={e.expiry} onChange={(ev) => setExtra(extra.map((x, j) => (j === i ? { ...x, expiry: ev.target.value } : x)))} />
                <div style={{ width: 80 }}><NumberInput value={e.qty} onChange={(v) => setExtra(extra.map((x, j) => (j === i ? { ...x, qty: v ?? 1 } : x)))} /></div>
              </div>
            ))}
            {canEdit && <Button size="sm" variant="ghost" onClick={() => setExtra([...extra, { productId: '', batch: '', serial: '', expiry: '', qty: 1 }])}>+ Add item</Button>}
          </Card>
        )}

        {c.status === 'Surgery done' && (
          <Card title="Kit return check" subtitle="Count every instrument. Short or damaged items are charged to the hospital at replacement cost.">
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Instrument</th><th>Set</th><th style={{ textAlign: 'right' }}>Sent</th><th style={{ width: 110 }}>Returned</th><th>Damaged</th><th style={{ textAlign: 'right' }}>Replacement cost</th></tr></thead>
              <tbody>{caseSets.flatMap((s) => s.items.filter((it) => it.kind === 'Instrument').map((it) => {
                const k = counts[it.id] ?? { returned: it.qty, damaged: false };
                return (
                  <tr key={it.id} style={{ background: k.returned < it.qty || k.damaged ? '#fef2f2' : undefined }}>
                    <td>{it.name}</td><td className="g2-small">{s.code}</td><td style={{ textAlign: 'right' }}>{it.qty}</td>
                    <td><NumberInput value={k.returned} aria-label={`Returned ${it.name}`} onChange={(v) => setCounts({ ...counts, [it.id]: { ...k, returned: Math.max(0, Math.min(it.qty, v ?? 0)) } })} /></td>
                    <td><Checkbox checked={k.damaged} onChange={(v) => setCounts({ ...counts, [it.id]: { ...k, damaged: v } })} /></td>
                    <td style={{ textAlign: 'right' }}>{inr(it.value)}</td>
                  </tr>
                );
              }))}</tbody>
            </table></div>
          </Card>
        )}

        {(c.usage.length > 0 || c.missing.length > 0) && (
          <Card title={c.status === 'Closed' ? `Bill ${c.billNo}` : 'Bill preview'} subtitle={c.servedBy === 'PARTNER' ? `${c.partnerName} bills the hospital; the company replenishes the used items to the partner.` : 'Company bills the hospital directly at its contract / list price.'}>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit price</th><th>Price from</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {billLines.map((l, i) => <tr key={i}><td>{l.name}</td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right' }}>{l.unit !== null ? inr(l.unit) : <Badge tone="red">No price</Badge>}</td><td className="g2-small">{l.source}</td><td style={{ textAlign: 'right' }}>{l.unit !== null ? inr(l.unit * l.qty) : '—'}</td></tr>)}
                {c.missing.map((m) => <tr key={m.itemId}><td>{m.damaged ? 'Damaged' : 'Missing'}: {m.name}</td><td style={{ textAlign: 'right' }}>{m.qty}</td><td style={{ textAlign: 'right' }}>{inr(m.charge / m.qty)}</td><td className="g2-small">Replacement cost</td><td style={{ textAlign: 'right' }}>{inr(m.charge)}</td></tr>)}
                <tr><td colSpan={4} style={{ textAlign: 'right' }}>Taxable</td><td style={{ textAlign: 'right' }}>{inr(Math.round(taxable))}</td></tr>
                <tr><td colSpan={4} style={{ textAlign: 'right' }}>GST</td><td style={{ textAlign: 'right' }}>{inr(Math.round(gst))}</td></tr>
                <tr><td colSpan={4} style={{ textAlign: 'right' }} className="g2-strong">Total</td><td style={{ textAlign: 'right' }} className="g2-strong">{inr(Math.round(taxable + gst))}</td></tr>
              </tbody>
            </table></div>
          </Card>
        )}

        {canEdit && ['Confirmed', 'Kit dispatched'].includes(c.status) && (
          <div className="g2-row" style={{ gap: 8 }}>
            <Input placeholder="Reason to cancel (surgery postponed…)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <Button variant="ghost" onClick={() => run(cancelCase(c.id, cancelReason, currentUser.name))}>Cancel case</Button>
          </div>
        )}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>History</div>
          {c.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {new Date(x.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{x.note ? ` — ${x.note}` : ''}</span></div>)}
        </div>
      </div>
    </Modal>
  );
};

/* -------------------------------- Set drawer -------------------------------- */

const SetDrawer: React.FC<{ id: string; onClose: () => void; canEdit: boolean; hospitalName: (id: string | null) => string }> = ({ id, onClose, canEdit, hospitalName }) => {
  useSubscribe(subscribeSurgical);
  const { currentUser, showToast, warehouses } = useApp();
  const s = getSet(id);
  const [method, setMethod] = useState('Steam autoclave 134 °C');
  const [load, setLoad] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!s) return null;
  const run = (r: { ok: boolean; message: string }) => { if (!r.ok) setErr(r.message); else { setErr(null); showToast(r.message, 'success'); } };
  const implants = s.items.filter((i) => i.kind === 'Implant');
  const soon = (e?: string | null) => !!e && (Date.parse(e) - Date.now()) / 86400000 < 180;
  return (
    <Modal open size="lg" title={`${s.code} · ${s.name}`} subtitle={<span className="g2-row">{s.kind} · serial {s.serial} · cycle {s.sterilisationCycles} <Badge tone={SET_TONE[s.status]} dot>{s.status}</Badge></span>} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {canEdit && s.status === 'Incomplete' && <Button variant="primary" onClick={() => run(replaceItems(s.id, currentUser.name))}>Items replaced</Button>}
        {canEdit && implants.length < 4 && !s.caseId && <Button onClick={() => run(refillImplants(s.id, currentUser.name))}>Refill implants from stock</Button>}
      </>}>
      <div className="g2-stack">
        {err && <Alert tone="error">{err}</Alert>}
        <dl className="g2-dl">
          <dt>Location</dt><dd>{s.hospitalId ? `${hospitalName(s.hospitalId)}${s.sentAt ? ` · ${daysSince(s.sentAt)} day(s)` : ''}` : warehouses.find((w) => w.id === s.homeWarehouseId)?.name ?? s.homeWarehouseId}</dd>
          <dt>Last sterilised</dt><dd>{s.lastSterilisedAt ?? '—'}</dd>
        </dl>
        {canEdit && s.status === 'Sterilising' && (
          <Card title="Sterilisation (CSSD)">
            <FormGrid cols={3}>
              <Field label="Method"><Select value={method} options={['Steam autoclave 134 °C', 'Ethylene oxide (EtO)', 'Hydrogen peroxide plasma'].map((m) => ({ value: m, label: m }))} onChange={setMethod} /></Field>
              <Field label="Load / batch no." required><Input value={load} onChange={(e) => setLoad(e.target.value)} placeholder="CSSD-2026-1104-03" /></Field>
              <Field label=" "><Button variant="primary" onClick={() => run(sterilised(s.id, method, load, currentUser.name))}>Sterilisation done</Button></Field>
            </FormGrid>
          </Card>
        )}
        <div className="g2-table-wrap"><table className="g2-table">
          <thead><tr><th>Item</th><th>Type</th><th style={{ textAlign: 'right' }}>Qty</th><th>Batch / serial</th><th>Expiry</th></tr></thead>
          <tbody>{s.items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td><td><Badge tone={it.kind === 'Implant' ? 'purple' : 'slate'}>{it.kind}</Badge></td><td style={{ textAlign: 'right' }}>{it.qty}</td>
              <td className="g2-mono g2-small">{it.kind === 'Implant' ? `${it.batch} · ${it.serial}` : '—'}</td>
              <td>{it.expiry ? <span style={{ color: soon(it.expiry) ? '#b45309' : undefined }}>{it.expiry}</span> : '—'}</td>
            </tr>
          ))}</tbody>
        </table></div>
        {implants.length < 4 && <Alert tone="warn">{4 - implants.length} implant slot(s) empty after the last surgery — refill before the next case.</Alert>}
        <div>
          <div className="g2-label" style={{ marginBottom: 6 }}>History</div>
          {s.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {new Date(x.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{x.note ? ` — ${x.note}` : ''}</span></div>)}
        </div>
      </div>
    </Modal>
  );
};

/* ------------------------------- Implant card ------------------------------- */

const ImplantCard: React.FC<{ r: ImplantRecord; manufacturer: string; onClose: () => void }> = ({ r, manufacturer, onClose }) => (
  <Modal open variant="modal" title="Implant card" subtitle="Give to the patient — needed for MRI checks, follow-up and recalls" onClose={onClose}
    footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" icon={<Printer size={14} />} onClick={() => window.print()}>Print</Button></>}>
    <div style={{ border: '2px solid #4c1d95', borderRadius: 12, padding: 16, fontSize: 13 }}>
      <div style={{ fontWeight: 800, color: '#4c1d95', marginBottom: 8 }}>IMPLANT CARD</div>
      <dl className="g2-dl">
        <dt>Patient ID</dt><dd className="g2-mono">{r.patientRef}</dd>
        <dt>Implant</dt><dd className="g2-strong">{r.name}</dd>
        <dt>Manufacturer</dt><dd>{manufacturer}</dd>
        <dt>UDI</dt><dd className="g2-mono" style={{ wordBreak: 'break-all' }}>{udiString(r)}</dd>
        <dt>Batch / serial</dt><dd className="g2-mono">{r.batch} / {r.serial ?? '—'}</dd>
        <dt>Implanted on</dt><dd>{r.surgeryDate}</dd>
        <dt>Hospital</dt><dd>{r.hospitalName}</dd>
        <dt>Surgeon</dt><dd>{r.surgeon}</dd>
      </dl>
    </div>
  </Modal>
);

/* ----------------------------------- Page ----------------------------------- */

const SurgicalPage: React.FC = () => {
  useSubscribe(subscribeSurgical);
  const { currentUser, products, activePrincipal, principals, showToast } = useApp();
  const g = useGtm();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'cases';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [newCase, setNewCase] = useState(false);
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [card, setCard] = useState<ImplantRecord | null>(null);
  const [tq, setTq] = useState({ productId: '', batch: '', serial: '' });
  const [explant, setExplant] = useState<{ id: string; reason: string } | null>(null);
  const m = currentUser.matrix;
  const canEdit = !m || !!m.gtm?.includes('edit') || !!m.inventory?.includes('edit');
  const hName = (id: string | null) => g.partners.find((p: Partner) => p.id === id)?.name ?? '—';
  const allCases = listCases().filter((c) => c.principalId === activePrincipal.id);
  const allSets = listSets();
  const reg = listRegister();
  const results = useMemo(() => trace({ productId: tq.productId || undefined, batch: tq.batch || undefined, serial: tq.serial || undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tq, reg]);
  const upcoming = allCases.filter((c) => c.status === 'Confirmed' && c.surgeryDate >= today()).length;
  const overdue = allSets.filter((s) => s.kind === 'Loaner' && s.hospitalId && daysSince(s.sentAt) > 7);
  const manufacturer = (pid: string) => principals.find((p) => p.id === products.find((x) => x.id === pid)?.principalId)?.name ?? activePrincipal.name;

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Surgery Cases & Implants" description="Book surgeries with loaner or consignment sets, record which implant went into which patient, check kits back, sterilise, and trace any batch or serial for a recall."
        actions={canEdit && <Button variant="primary" icon={<Stethoscope size={15} />} onClick={() => setNewCase(true)}>Book surgery case</Button>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Upcoming surgeries" value={upcoming} icon={<CalendarClock size={22} />} color="#2563eb" bg="#eff6ff" foot={`${allCases.filter((c) => ['Kit dispatched', 'Surgery done', 'Kit returned'].includes(c.status)).length} case(s) in progress`} />
        <KpiCard label="Sets at hospitals" value={allSets.filter((s) => s.hospitalId).length} icon={<Briefcase size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${allSets.filter((s) => s.status === 'Available').length} available in warehouse`} />
        <KpiCard label="Loaner sets overdue" value={overdue.length} icon={<ShieldAlert size={22} />} color="#dc2626" bg="#fef2f2" foot="out more than 7 days" />
        <KpiCard label="Implants registered" value={reg.length} icon={<ClipboardCheck size={22} />} color="#059669" bg="#ecfdf5" foot={`${reg.filter((r) => r.status === 'Explanted').length} explanted`} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'cases', label: 'Surgery cases', count: allCases.length }, { id: 'sets', label: 'Instrument sets', count: allSets.length }, { id: 'register', label: 'Implant register & trace', count: reg.length }]} />
        </div>
        {tab === 'cases' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Case</th><th>Hospital</th><th>Surgery</th><th>Served by</th><th>Sets</th><th>Status</th></tr></thead>
            <tbody>
              {allCases.length === 0 && <tr><td colSpan={6} className="g2-muted">No cases yet.</td></tr>}
              {allCases.map((c: SurgeryCase) => (
                <tr key={c.id} onClick={() => setOpenCase(c.id)} style={{ cursor: 'pointer' }}>
                  <td><div className="g2-strong">{c.code}</div><div className="g2-cell-sub">{c.procedure}</div></td>
                  <td>{c.hospitalName}<div className="g2-cell-sub">{c.surgeon}</div></td>
                  <td>{c.surgeryDate}</td>
                  <td className="g2-small">{c.servedBy === 'COMPANY' ? 'Company direct' : c.partnerName}</td>
                  <td className="g2-small">{c.setIds.map((id) => getSet(id)?.code).join(', ')}</td>
                  <td><Badge tone={CASE_TONE[c.status]} dot>{c.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {tab === 'sets' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Set</th><th>Type</th><th>Where</th><th style={{ textAlign: 'right' }}>Implants</th><th style={{ textAlign: 'right' }}>Cycles</th><th>Status</th></tr></thead>
            <tbody>{allSets.map((s) => {
              const late = s.kind === 'Loaner' && s.hospitalId && daysSince(s.sentAt) > 7;
              return (
                <tr key={s.id} onClick={() => setOpenSet(s.id)} style={{ cursor: 'pointer' }}>
                  <td><div className="g2-strong">{s.code}</div><div className="g2-cell-sub">{s.name} · {s.serial}</div></td>
                  <td>{s.kind}</td>
                  <td className="g2-small">{s.hospitalId ? hName(s.hospitalId) : 'Warehouse'}{s.sentAt && s.hospitalId ? ` · ${daysSince(s.sentAt)}d` : ''}{late && <> <Badge tone="red">Overdue</Badge></>}</td>
                  <td style={{ textAlign: 'right' }}>{s.items.filter((i) => i.kind === 'Implant').length} / 4</td>
                  <td style={{ textAlign: 'right' }}>{s.sterilisationCycles}</td>
                  <td><Badge tone={SET_TONE[s.status]} dot>{s.status}</Badge>{s.caseId && <div className="g2-cell-sub">{getCase(s.caseId)?.code}</div>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        {tab === 'register' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div style={{ width: 300 }}><SearchableSelect value={tq.productId} clearable placeholder="Any product" options={products.filter((p) => p.regulatory?.implantable).map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setTq({ ...tq, productId: v ?? '' })} /></div>
              <div style={{ width: 160 }}><Input placeholder="Batch" value={tq.batch} onChange={(e) => setTq({ ...tq, batch: e.target.value })} /></div>
              <div style={{ width: 200 }}><Input placeholder="Serial (part ok)" value={tq.serial} onChange={(e) => setTq({ ...tq, serial: e.target.value })} /></div>
              <span className="g2-small g2-muted"><Search size={13} style={{ verticalAlign: -2 }} /> {results.length} patient implant(s) found{tq.batch || tq.serial || tq.productId ? ' — use this list for a recall' : ''}</span>
            </div>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Implant</th><th>Batch / serial</th><th>Patient ID</th><th>Hospital · surgeon</th><th>Implanted</th><th>Status</th><th /></tr></thead>
              <tbody>
                {results.length === 0 && <tr><td colSpan={7} className="g2-muted">No implants match.</td></tr>}
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}<div className="g2-cell-sub g2-mono">{r.udiDi}</div></td>
                    <td className="g2-mono g2-small">{r.batch} / {r.serial ?? '—'}</td>
                    <td className="g2-mono">{r.patientRef}</td>
                    <td className="g2-small">{r.hospitalName}<div className="g2-cell-sub">{r.surgeon} · {r.caseCode}</div></td>
                    <td>{r.surgeryDate}</td>
                    <td><Badge tone={r.status === 'Implanted' ? 'green' : 'slate'} dot>{r.status}</Badge></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Button size="sm" icon={<Printer size={13} />} onClick={() => setCard(r)}>Implant card</Button>{' '}
                      {canEdit && r.status === 'Implanted' && <Button size="sm" variant="ghost" onClick={() => setExplant({ id: r.id, reason: '' })}>Explant</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </Card>
      {newCase && <NewCaseDrawer onClose={() => setNewCase(false)} onOpen={setOpenCase} />}
      {openCase && <CaseDrawer id={openCase} canEdit={canEdit} onClose={() => setOpenCase(null)} />}
      {openSet && <SetDrawer id={openSet} canEdit={canEdit} hospitalName={hName} onClose={() => setOpenSet(null)} />}
      {card && <ImplantCard r={card} manufacturer={manufacturer(card.productId)} onClose={() => setCard(null)} />}
      {explant && (
        <Modal open variant="modal" title="Mark implant as explanted" onClose={() => setExplant(null)}
          footer={<><Button onClick={() => setExplant(null)}>Cancel</Button><Button variant="primary" onClick={() => { const r = markExplanted(explant.id, explant.reason, currentUser.name); showToast(r.message, r.ok ? 'success' : 'warning'); if (r.ok) setExplant(null); }}>Save</Button></>}>
          <Field label="Reason" required><Textarea rows={2} value={explant.reason} placeholder="Revision surgery, infection, recall…" onChange={(e) => setExplant({ ...explant, reason: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
};
export default SurgicalPage;
