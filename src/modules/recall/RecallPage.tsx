import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertOctagon, ClipboardList, MessageSquareWarning, Plus, ShieldAlert, Siren } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, KpiCard, Modal, MultiSelect, NumberInput, PageHeader, SearchableSelect, SearchInput, Select, Stepper, Tabs, Textarea } from '../../platform/ui';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useImportContext } from '../../platform/import/useImportContext';
import { balances, subscribeStock } from '../inventory/stockStore';
import { allShipments, subscribeOrders } from '../orders/orderStore';
import type { OrderCtx } from '../orders/orderStore';
import { useOrderCtx } from '../orders/useOrderCtx';
import { ensureDemo } from '../orders/seedDemo';
import { register } from '../surgical/surgicalStore';
import { subscribeReturns } from '../returns/returnStore';
import {
  CATEGORIES, COMPLAINT_FLOW, accountFor, acknowledge, activateRecall, cancelRecall, closeComplaint, closeRecall, complaints as listComplaints, createComplaint, createRecall, effectiveness,
  ensureRecallDemo, getComplaint, getRecall, markReported, minSeverity, recallSettings, recalls as listRecalls, recordFindings, recoverStock, retrace, saveRecallSettings, startInvestigation,
  subscribeRecall, syncComplaintsFromReturns, traceForward,
} from './recallStore';
import type { Complaint, ComplaintCategory, Party, PatientOutcome, RecallClass, RecallType, Severity } from './recallStore';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const today = () => new Date().toISOString().slice(0, 10);
const SEV_TONE: Record<Severity, 'slate' | 'blue' | 'amber' | 'red'> = { Low: 'slate', Medium: 'blue', High: 'amber', Critical: 'red' };
const KIND_LABEL: Record<Party['kind'], string> = { COMPANY: 'Our warehouse', TRANSIT: 'In transit', CNF: 'C&F depot', PARTNER: 'Partner stock', HOSPITAL: 'Hospital consignment', CONSUMED: 'Sold to hospital (used)', PATIENT: 'Implanted' };
const OUTCOMES: PatientOutcome[] = ['No patient involved', 'No injury', 'Injury', 'Serious injury', 'Death'];
type Run = (r: { ok: boolean; message: string; errors?: string[]; id?: string }) => boolean;
const useRun = (setErrs: (e: string[]) => void): Run => {
  const { showToast } = useApp();
  return (r) => { if (!r.ok) { setErrs([r.message, ...(r.errors ?? [])]); return false; } setErrs([]); showToast(r.message, 'success'); return true; };
};

/** Batches / serials VinFlux has seen for a product (stock and shipments). */
const knownLots = (productId: string) => {
  const b = new Set<string>(); const s = new Set<string>();
  balances().filter((x) => x.productId === productId).forEach((x) => { if (x.batch) b.add(x.batch); if (x.serial) s.add(x.serial); });
  allShipments().forEach(({ shipment }) => shipment.allocations.filter((a) => a.productId === productId).forEach((a) => { if (a.batch) b.add(a.batch); if (a.serial) s.add(a.serial); }));
  return { batches: [...b].sort(), serials: [...s].sort() };
};

/* ---------------------------------- Complaints ---------------------------------- */

const NewComplaintDrawer: React.FC<{ ctx: OrderCtx; onClose: () => void; onOpen: (id: string) => void }> = ({ ctx, onClose, onOpen }) => {
  const { activePrincipal, currentUser } = useApp();
  const [errs, setErrs] = useState<string[]>([]);
  const run = useRun(setErrs);
  const [f, setF] = useState({ source: 'Hospital' as Complaint['source'], partnerId: '', reporter: '', pv: '', batch: '', serial: '', qty: 1, category: 'Quality defect' as ComplaintCategory, patient: 'No patient involved' as PatientOutcome, severity: 'Low' as Severity, description: '' });
  const products = ctx.products.filter((p) => p.principalId === activePrincipal.id);
  const [pid, sku] = f.pv.split('|');
  const prod = products.find((p) => p.id === pid);
  const lots = pid ? knownLots(pid) : { batches: [], serials: [] };
  const min = minSeverity(f.category, f.patient);
  const save = () => {
    const p = ctx.partners.find((x) => x.id === f.partnerId);
    const r = createComplaint(activePrincipal.id, { source: f.source, partnerId: p?.id ?? null, partnerName: p?.name ?? '—', reporter: f.reporter, productId: pid ?? '', variantSku: sku || null, name: prod?.variants.find((v) => v.sku === sku)?.name ?? prod?.name ?? '',
      batch: f.batch, serial: f.serial || null, qty: f.qty, category: f.category, description: f.description, severity: f.severity, patient: f.patient, returnId: null, createdBy: currentUser.name });
    if (run(r) && r.id) { onClose(); onOpen(r.id); }
  };
  return (
    <Modal open size="lg" title="Log a complaint" subtitle="Quality problems, malfunctions and adverse events — with the batch or serial so it can be traced." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Log complaint</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <FormGrid>
          <Field label="Reported by (source)"><Select value={f.source} options={['Hospital', 'Partner', 'Doctor / patient', 'Internal'].map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, source: v as Complaint['source'] })} /></Field>
          <Field label="Partner / hospital"><SearchableSelect value={f.partnerId} options={ctx.partners.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => setF({ ...f, partnerId: v ?? '' })} /></Field>
          <Field label="Reporter name / role" required><Input value={f.reporter} onChange={(e) => setF({ ...f, reporter: e.target.value })} /></Field>
          <Field label="Product" required><SearchableSelect value={f.pv} options={products.flatMap((p) => (p.variants.length ? p.variants.map((v) => ({ value: `${p.id}|${v.sku}`, label: v.name, description: v.sku })) : [{ value: `${p.id}|`, label: p.name, description: p.code }]))} onChange={(v) => setF({ ...f, pv: v ?? '', batch: '', serial: '' })} /></Field>
          <Field label="Batch / lot" required hint={lots.batches.length ? `Known: ${lots.batches.slice(0, 6).join(', ')}` : undefined}><Input value={f.batch} list="lots" onChange={(e) => setF({ ...f, batch: e.target.value })} /><datalist id="lots">{lots.batches.map((b) => <option key={b} value={b} />)}</datalist></Field>
          <Field label="Serial (if any)"><Input value={f.serial} list="sns" onChange={(e) => setF({ ...f, serial: e.target.value })} /><datalist id="sns">{lots.serials.map((b) => <option key={b} value={b} />)}</datalist></Field>
          <Field label="Units affected"><NumberInput value={f.qty} onChange={(v) => setF({ ...f, qty: Math.max(1, v ?? 1) })} /></Field>
          <Field label="Category"><Select value={f.category} options={CATEGORIES.map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, category: v as ComplaintCategory })} /></Field>
          <Field label="Patient involved?"><Select value={f.patient} options={OUTCOMES.map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, patient: v as PatientOutcome })} /></Field>
          <Field label="Severity" hint={min !== 'Low' ? `At least ${min} for this category / outcome` : undefined}><Select value={f.severity} options={(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, severity: v as Severity })} /></Field>
        </FormGrid>
        <Field label="What happened" required><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {(f.patient !== 'No patient involved' || f.category === 'Adverse event') && <Alert tone="warn">Adverse event — a regulator report due date is set from your SOP (Settings tab). For medical devices in India this is typically reported under the Materiovigilance Programme (MvPI); follow your regulatory team’s procedure.</Alert>}
      </div>
    </Modal>
  );
};

const ComplaintDrawer: React.FC<{ id: string; onClose: () => void; onRecall: (c: Complaint) => void }> = ({ id, onClose, onRecall }) => {
  useSubscribe(subscribeRecall);
  const { currentUser } = useApp();
  const [errs, setErrs] = useState<string[]>([]);
  const run = useRun(setErrs);
  const c = getComplaint(id);
  const [f, setF] = useState({ root: '', capa: '', ref: '', note: '' });
  if (!c) return null;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.products?.includes('approve') || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  const idx = COMPLAINT_FLOW.indexOf(c.status);
  const overdue = c.report && !c.report.reportedAt && c.report.dueBy < today();
  return (
    <Modal open size="lg" title={`${c.no} · ${c.name}`} subtitle={<span className="g2-row">{c.category} · batch {c.batch}{c.serial ? ` · ${c.serial}` : ''} · {c.qty} unit(s) · from {c.partnerName} ({c.source}) <Badge tone={SEV_TONE[c.severity]} dot>{c.severity}</Badge></span>} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {canEdit && !c.recallId && c.status !== 'Closed' && <Button variant="danger" icon={<Siren size={14} />} onClick={() => onRecall(c)}>Start a recall</Button>}
        {canEdit && c.status === 'Open' && <Button variant="primary" onClick={() => run(startInvestigation(c.id, currentUser.name))}>Start investigation</Button>}
        {canEdit && c.status === 'Investigating' && <Button variant="primary" onClick={() => run(recordFindings(c.id, f.root, f.capa, currentUser.name))}>Save root cause & CAPA</Button>}
        {canEdit && c.status === 'CAPA' && <Button variant="primary" onClick={() => run(closeComplaint(c.id, f.note, currentUser.name))}>Close complaint</Button>}
      </>}>
      <div className="g2-stack">
        <Stepper steps={COMPLAINT_FLOW} current={c.status === 'Closed' ? COMPLAINT_FLOW.length : idx} maxReached={idx} onSelect={() => undefined} />
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t continue" />}
        <Card title="What happened"><div className="g2-small">{c.description}</div><div className="g2-cell-sub" style={{ marginTop: 6 }}>Reported by {c.reporter} · patient: {c.patient} · logged by {c.createdBy} {when(c.createdAt)}</div></Card>
        {c.report && (
          <Alert tone={c.report.reportedAt ? 'success' : overdue ? 'error' : 'warn'}>
            {c.report.reportedAt ? <>Reported to the regulator {when(c.report.reportedAt)} — ref <strong>{c.report.ref}</strong></>
              : <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}><span>Regulator report {overdue ? 'OVERDUE — was ' : ''}due by <strong>{c.report.dueBy}</strong></span>
                {canEdit && <><div style={{ width: 200 }}><Input placeholder="Report / ack. number" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></div><Button size="sm" onClick={() => run(markReported(c.id, f.ref, currentUser.name))}>Mark reported</Button></>}</div>}
          </Alert>
        )}
        {c.recallId && <Alert tone="info">Linked to recall {getRecall(c.recallId)?.no} ({getRecall(c.recallId)?.status}).</Alert>}
        {c.investigation && <Card title="Investigation"><dl className="g2-dl"><dt>Root cause</dt><dd>{c.investigation.rootCause}</dd><dt>CAPA</dt><dd>{c.investigation.capa}</dd><dt>By</dt><dd>{c.investigation.by} · {when(c.investigation.at)}</dd></dl></Card>}
        {canEdit && c.status === 'Investigating' && <FormGrid><Field label="Root cause" required><Textarea rows={3} value={f.root} onChange={(e) => setF({ ...f, root: e.target.value })} /></Field><Field label="Corrective / preventive action (CAPA)" required><Textarea rows={3} value={f.capa} onChange={(e) => setF({ ...f, capa: e.target.value })} /></Field></FormGrid>}
        {canEdit && c.status === 'CAPA' && <Field label="Closing note (CAPA effectiveness)"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>}
        <div><div className="g2-label" style={{ marginBottom: 6 }}>Timeline</div>
          {c.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {when(x.at)}{x.note ? ` — ${x.note}` : ''}</span></div>)}</div>
      </div>
    </Modal>
  );
};

/* ------------------------------------ Recalls ------------------------------------ */

const PartiesTable: React.FC<{ parties: Party[] }> = ({ parties }) => (
  <div className="g2-table-wrap"><table className="g2-table">
    <thead><tr><th>Where</th><th>Type</th><th style={{ textAlign: 'right' }}>Units</th></tr></thead>
    <tbody>{parties.length === 0 ? <tr><td colSpan={3} className="g2-muted">Nothing found for these batches / serials.</td></tr> : parties.map((p) => <tr key={p.key}><td>{p.name}</td><td className="g2-small">{KIND_LABEL[p.kind]}</td><td style={{ textAlign: 'right' }}>{p.qty}</td></tr>)}</tbody>
  </table></div>
);

const NewRecallDrawer: React.FC<{ ctx: OrderCtx; from: Complaint | null; onClose: () => void; onOpen: (id: string) => void }> = ({ ctx, from, onClose, onOpen }) => {
  const { activePrincipal, currentUser, warehouses } = useApp();
  const [errs, setErrs] = useState<string[]>([]);
  const run = useRun(setErrs);
  const products = ctx.products.filter((p) => p.principalId === activePrincipal.id);
  const [f, setF] = useState({ productId: from?.productId ?? '', batches: from?.batch ? [from.batch] : [] as string[], serials: from?.serial ? [from.serial] : [] as string[], cls: (from?.severity === 'Critical' ? 'Class I' : 'Class II') as RecallClass, type: 'Recall' as RecallType, reason: from ? `${from.category}: ${from.description}` : '', complaintIds: from ? [from.id] : [] as string[] });
  const lots = f.productId ? knownLots(f.productId) : { batches: [], serials: [] };
  const preview = useMemo(() => (f.productId && (f.batches.length || f.serials.length) ? traceForward(f.productId, f.batches, f.serials, ctx.partners, warehouses) : []), [f.productId, f.batches, f.serials, ctx.partners, warehouses]);
  const prod = products.find((p) => p.id === f.productId);
  const save = () => { const r = createRecall(activePrincipal.id, { ...f, name: prod?.name ?? '' }, ctx.partners, warehouses, currentUser.name); if (run(r) && r.id) { onClose(); onOpen(r.id); } };
  return (
    <Modal open size="xl" title="New recall" subtitle="Choose the affected batches / serials. VinFlux traces every place they went; a second person approves before stock is blocked and partners are told." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={save}>Create draft</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} />}
        <FormGrid>
          <Field label="Product" required><SearchableSelect value={f.productId} options={products.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setF({ ...f, productId: v ?? '', batches: [], serials: [] })} /></Field>
          <Field label="Class" hint="I = may cause serious harm · II = temporary / reversible · III = unlikely to harm"><Select value={f.cls} options={['Class I', 'Class II', 'Class III'].map((x) => ({ value: x, label: x }))} onChange={(v) => setF({ ...f, cls: v as RecallClass })} /></Field>
          <Field label="Batches"><MultiSelect values={f.batches} options={lots.batches.map((b) => ({ value: b, label: b }))} onChange={(v) => setF({ ...f, batches: v })} /></Field>
          {lots.serials.length > 0 && <Field label="Serials (single units)"><MultiSelect values={f.serials} options={lots.serials.map((b) => ({ value: b, label: b }))} onChange={(v) => setF({ ...f, serials: v })} /></Field>}
          <Field label="Action"><Select value={f.type} options={[{ value: 'Recall', label: 'Recall — block and bring back' }, { value: 'Stop sale', label: 'Stop sale — block, partners hold' }, { value: 'Field safety notice', label: 'Field safety notice — inform only' }]} onChange={(v) => setF({ ...f, type: v as RecallType })} /></Field>
          <Field label="Linked complaints"><MultiSelect values={f.complaintIds} options={listComplaints().filter((c) => c.productId === f.productId).map((c) => ({ value: c.id, label: `${c.no} · ${c.batch}` }))} onChange={(v) => setF({ ...f, complaintIds: v })} /></Field>
        </FormGrid>
        <Field label="Reason (goes on the partner notice)" required><Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        {preview.length > 0 && <Card title={`Trace forward — ${preview.reduce((a, p) => a + p.qty, 0)} unit(s) in ${preview.length} place(s)`}><PartiesTable parties={preview} /></Card>}
      </div>
    </Modal>
  );
};

const RecallDrawer: React.FC<{ id: string; ctx: OrderCtx; onClose: () => void }> = ({ id, ctx, onClose }) => {
  useSubscribe(subscribeRecall, subscribeStock);
  const { currentUser, warehouses } = useApp();
  const [errs, setErrs] = useState<string[]>([]);
  const run = useRun(setErrs);
  const r = getRecall(id);
  const [note, setNote] = useState('');
  const [act, setAct] = useState<Record<string, { qty: number; wh: string; note: string }>>({});
  if (!r) return null;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.products?.includes('approve') || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  const e = effectiveness(r);
  const implants = register().filter((x) => x.productId === r.productId && (r.batches.includes(x.batch) || (!!x.serial && r.serials.includes(x.serial))));
  const a = (p: Party) => act[p.key] ?? { qty: Math.max(0, p.qty - p.recovered - p.accounted), wh: warehouses.find((w) => w.status === 'Active')?.id ?? '', note: '' };
  return (
    <Modal open size="xl" title={`${r.no} · ${r.name}`} subtitle={<span className="g2-row">{r.type} · {r.cls} · {[...r.batches, ...r.serials].join(', ')} <Badge tone={r.status === 'Active' ? 'red' : r.status === 'Draft' ? 'amber' : 'slate'} dot>{r.status}</Badge></span>} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {canEdit && r.status === 'Draft' && <><Button onClick={() => run(retrace(r.id, ctx.partners, warehouses, currentUser.name))}>Trace again</Button><Button variant="ghost" onClick={() => run(cancelRecall(r.id, note, currentUser.name))}>Cancel draft</Button>
          <Button variant="danger" icon={<Siren size={14} />} onClick={() => run(activateRecall(r.id, ctx.partners, warehouses, currentUser.name))}>Approve & start</Button></>}
        {canEdit && r.status === 'Active' && <Button variant="primary" onClick={() => run(closeRecall(r.id, note, currentUser.name))}>Close recall ({e.pct}%)</Button>}
      </>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t continue" />}
        <Card title="Reason"><div className="g2-small">{r.reason}</div><div className="g2-cell-sub" style={{ marginTop: 4 }}>Created by {r.createdBy} {when(r.createdAt)}{r.approvedBy ? ` · approved by ${r.approvedBy} ${when(r.activatedAt!)}` : ''}{r.complaintIds.length ? ` · complaints ${r.complaintIds.map((x) => getComplaint(x)?.no).join(', ')}` : ''}</div></Card>
        {r.status === 'Draft' && <Alert tone="warn">Draft — nothing is blocked yet. Approval (by someone other than {r.createdBy}) blocks {r.type === 'Field safety notice' ? 'nothing (inform only)' : 'every affected unit VinFlux holds'} and notifies {r.parties.filter((p) => !['COMPANY', 'TRANSIT'].includes(p.kind)).length} partner(s) / hospital(s). For ERP-mastered warehouses on a live ERP, block the batch in the ERP too.</Alert>}
        {r.status !== 'Draft' && (
          <div className="g2-grid g2-grid-3" style={{ gap: 10 }}>
            <KpiCard label="Accounted for" value={`${e.pct}%`} icon={<ShieldAlert size={22} />} color={e.pct >= 100 ? '#059669' : '#dc2626'} bg={e.pct >= 100 ? '#ecfdf5' : '#fef2f2'} foot={`${e.done} of ${e.total} unit(s)`} />
            <KpiCard label="Notified" value={e.notified} icon={<MessageSquareWarning size={22} />} color="#2563eb" bg="#eff6ff" foot={`${e.acked} acknowledged`} />
            <KpiCard label="Implanted units" value={implants.length} icon={<AlertOctagon size={22} />} color="#d97706" bg="#fffbeb" foot="patients to follow up" />
          </div>
        )}
        <Card title="Where the units are">
          {r.status === 'Draft' ? <PartiesTable parties={r.parties} /> : (
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Where</th><th style={{ textAlign: 'right' }}>Units</th><th>Notified / ack.</th><th style={{ textAlign: 'right' }}>Recovered</th><th style={{ textAlign: 'right' }}>Accounted</th><th style={{ minWidth: 340 }}>Action</th></tr></thead>
              <tbody>{r.parties.map((p) => {
                const open = p.qty - p.recovered - p.accounted;
                const x = a(p);
                return (
                  <tr key={p.key}>
                    <td><div className="g2-strong">{p.name}</div><div className="g2-cell-sub">{KIND_LABEL[p.kind]}{p.note ? ` · ${p.note}` : ''}</div></td>
                    <td style={{ textAlign: 'right' }}>{p.qty}</td>
                    <td className="g2-small">{p.notifiedAt ? `Notified ${p.notifiedAt.slice(0, 10)}` : '—'}{p.acknowledgedAt ? <div className="g2-cell-sub">Ack. — holds {p.ackQty}</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{p.recovered || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{p.accounted || '—'}</td>
                    <td>{r.status === 'Active' && canEdit && open > 0 ? <div className="g2-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {p.notifiedAt && !p.acknowledgedAt && <Button size="sm" onClick={() => run(acknowledge(r.id, p.key, open, currentUser.name))}>Acknowledged</Button>}
                      <div style={{ width: 70 }}><NumberInput value={x.qty} aria-label={`Qty ${p.name}`} onChange={(v) => setAct({ ...act, [p.key]: { ...x, qty: Math.max(0, Math.min(open, v ?? 0)) } })} /></div>
                      {['CNF', 'PARTNER', 'HOSPITAL'].includes(p.kind) ? <>
                        <div style={{ width: 150 }}><Select value={x.wh} options={warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: w.code }))} onChange={(v) => setAct({ ...act, [p.key]: { ...x, wh: v } })} /></div>
                        <Button size="sm" variant="primary" onClick={() => run(recoverStock(r.id, p.key, x.qty, x.wh, warehouses, currentUser.name))}>Recovered</Button></>
                        : <><div style={{ width: 160 }}><Input placeholder="How accounted" value={x.note} onChange={(e2) => setAct({ ...act, [p.key]: { ...x, note: e2.target.value } })} /></div>
                          <Button size="sm" onClick={() => run(accountFor(r.id, p.key, x.qty, x.note, currentUser.name))}>Account</Button></>}
                    </div> : open <= 0 ? <Badge tone="green">Done</Badge> : null}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Card>
        {implants.length > 0 && (
          <Card title="Implanted in patients (implant register)" subtitle="Hand these to the hospitals and surgeons for patient follow-up.">
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Patient ref.</th><th>Hospital</th><th>Surgeon</th><th>Surgery</th><th>Batch / serial</th></tr></thead>
              <tbody>{implants.map((x) => <tr key={x.id}><td className="g2-mono">{x.patientRef}</td><td>{x.hospitalName}</td><td>{x.surgeon}</td><td>{x.surgeryDate}</td><td className="g2-mono g2-small">{x.batch}{x.serial ? ` · ${x.serial}` : ''}</td></tr>)}</tbody>
            </table></div>
          </Card>
        )}
        {canEdit && ['Draft', 'Active'].includes(r.status) && <Field label={r.status === 'Draft' ? 'Note (needed to cancel)' : 'Closing note (needed below 100%)'}><Textarea rows={2} value={note} onChange={(e2) => setNote(e2.target.value)} /></Field>}
        {r.closedNote && <Alert tone="info">{r.status}: {r.closedNote}</Alert>}
        <div><div className="g2-label" style={{ marginBottom: 6 }}>Timeline</div>
          {r.history.slice().reverse().map((x, i) => <div key={i} className="g2-list-item g2-small"><span className="g2-strong">{x.action}</span><span className="g2-muted">{x.by} · {when(x.at)}{x.note ? ` — ${x.note}` : ''}</span></div>)}</div>
      </div>
    </Modal>
  );
};

/* ------------------------------------- Page ------------------------------------- */

const RecallPage: React.FC = () => {
  useSubscribe(subscribeRecall, subscribeOrders, subscribeStock, subscribeReturns);
  const ctx = useOrderCtx();
  const imp = useImportContext();
  const { activePrincipal, currentUser, warehouses, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'complaints';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [openC, setOpenC] = useState<string | null>(null);
  const [openR, setOpenR] = useState<string | null>(null);
  const [newC, setNewC] = useState(false);
  const [newR, setNewR] = useState<{ from: Complaint | null } | null>(null);
  const [st, setSt] = useState(recallSettings());
  useEffect(() => { if (ctx) { ensureDemo(imp, ctx, activePrincipal.id); syncComplaintsFromReturns(activePrincipal.id); ensureRecallDemo(activePrincipal.id, ctx.products, ctx.partners, warehouses); } }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return <div className="g2 g2-embed" style={{ padding: 24 }}>Loading…</div>;
  const m = currentUser.matrix;
  const canEdit = !m || !!m.products?.includes('approve') || !!m.inventory?.includes('edit') || !!m.gtm?.includes('edit');
  const cs = listComplaints().filter((c) => c.principalId === activePrincipal.id);
  const rs = listRecalls().filter((r) => r.principalId === activePrincipal.id);
  const due = cs.filter((c) => c.report && !c.report.reportedAt);
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Complaints & Recall" description="Log complaints and adverse events with the batch / serial, investigate to root cause and CAPA, and recall: trace every unit forward, block it, notify partners and hospitals, recover it and prove every unit is accounted for."
        actions={canEdit && <><Button icon={<Plus size={15} />} onClick={() => setNewC(true)}>Log complaint</Button><Button variant="danger" icon={<Siren size={15} />} onClick={() => setNewR({ from: null })}>New recall</Button></>} />
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Open complaints" value={cs.filter((c) => c.status !== 'Closed').length} icon={<MessageSquareWarning size={22} />} color="#2563eb" bg="#eff6ff" foot={`${cs.filter((c) => c.status !== 'Closed' && ['High', 'Critical'].includes(c.severity)).length} high / critical`} />
        <KpiCard label="Regulator reports due" value={due.length} icon={<ClipboardList size={22} />} color={due.some((c) => c.report!.dueBy < today()) ? '#dc2626' : '#d97706'} bg="#fffbeb" foot={`${due.filter((c) => c.report!.dueBy < today()).length} overdue`} />
        <KpiCard label="Active recalls" value={rs.filter((r) => r.status === 'Active').length} icon={<Siren size={22} />} color="#dc2626" bg="#fef2f2" foot={`${rs.filter((r) => r.status === 'Draft').length} draft(s) waiting approval`} />
        <KpiCard label="Units still out" value={rs.filter((r) => r.status === 'Active').reduce((a, r) => { const e = effectiveness(r); return a + e.total - e.done; }, 0)} icon={<ShieldAlert size={22} />} color="#7c3aed" bg="#f5f3ff" foot="not yet recovered or accounted" />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: 'complaints', label: 'Complaints', count: cs.filter((c) => c.status !== 'Closed').length || undefined }, { id: 'recalls', label: 'Recalls', count: rs.filter((r) => ['Draft', 'Active'].includes(r.status)).length || undefined }, { id: 'settings', label: 'Settings' }]} />
          <span className="g2-spacer" />
          {tab !== 'settings' && <SearchInput value={q} onChange={setQ} placeholder="Number, product, batch, partner…" />}
        </div>
        {tab === 'complaints' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Complaint</th><th>Product · batch</th><th>From</th><th>Category</th><th>Severity</th><th>Regulator report</th><th>Status</th></tr></thead>
            <tbody>
              {cs.filter((c) => match(`${c.no} ${c.name} ${c.batch} ${c.serial ?? ''} ${c.partnerName}`)).length === 0 && <tr><td colSpan={7} className="g2-muted">No complaints.</td></tr>}
              {cs.filter((c) => match(`${c.no} ${c.name} ${c.batch} ${c.serial ?? ''} ${c.partnerName}`)).map((c) => (
                <tr key={c.id} onClick={() => setOpenC(c.id)} style={{ cursor: 'pointer' }}>
                  <td><div className="g2-strong">{c.no}</div><div className="g2-cell-sub">{c.createdAt.slice(0, 10)} · {c.source}</div></td>
                  <td>{c.name.slice(0, 40)}<div className="g2-cell-sub g2-mono">{c.batch}{c.serial ? ` · ${c.serial}` : ''}</div></td>
                  <td className="g2-small">{c.partnerName}</td><td className="g2-small">{c.category}{c.patient !== 'No patient involved' ? <div className="g2-cell-sub">{c.patient}</div> : null}</td>
                  <td><Badge tone={SEV_TONE[c.severity]} dot>{c.severity}</Badge></td>
                  <td className="g2-small">{!c.report ? '—' : c.report.reportedAt ? <Badge tone="green">Reported</Badge> : <Badge tone={c.report.dueBy < today() ? 'red' : 'amber'}>Due {c.report.dueBy}</Badge>}</td>
                  <td><Badge tone={c.status === 'Closed' ? 'green' : 'blue'} dot>{c.status}</Badge>{c.recallId && <div className="g2-cell-sub">{getRecall(c.recallId)?.no}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {tab === 'recalls' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Recall</th><th>Product</th><th>Batches / serials</th><th>Action</th><th style={{ width: 180 }}>Accounted for</th><th>Status</th></tr></thead>
            <tbody>
              {rs.filter((r) => match(`${r.no} ${r.name} ${r.batches.join(' ')} ${r.serials.join(' ')}`)).length === 0 && <tr><td colSpan={6} className="g2-muted">No recalls.</td></tr>}
              {rs.filter((r) => match(`${r.no} ${r.name} ${r.batches.join(' ')} ${r.serials.join(' ')}`)).map((r) => {
                const e = effectiveness(r);
                return (
                  <tr key={r.id} onClick={() => setOpenR(r.id)} style={{ cursor: 'pointer' }}>
                    <td><div className="g2-strong">{r.no}</div><div className="g2-cell-sub">{r.createdAt.slice(0, 10)}</div></td>
                    <td>{r.name.slice(0, 40)}</td><td className="g2-mono g2-small">{[...r.batches, ...r.serials].join(', ')}</td>
                    <td className="g2-small">{r.type}<div className="g2-cell-sub">{r.cls}</div></td>
                    <td>{r.status === 'Draft' ? <span className="g2-muted g2-small">{e.total} unit(s) traced</span> : <div><div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}><div style={{ width: `${e.pct}%`, height: 6, background: e.pct >= 100 ? '#059669' : '#dc2626', borderRadius: 3 }} /></div><div className="g2-cell-sub">{e.pct}% · {e.done}/{e.total}</div></div>}</td>
                    <td><Badge tone={r.status === 'Active' ? 'red' : r.status === 'Draft' ? 'amber' : 'slate'} dot>{r.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        {tab === 'settings' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <Alert tone="info">Regulator-report deadlines follow your own SOP and the regulations that apply to your products — set them with your regulatory team. VinFlux only tracks the due dates.</Alert>
            <FormGrid>
              <Field label="Report serious adverse events within (days)"><NumberInput value={st.reportDaysSerious} onChange={(v) => setSt({ ...st, reportDaysSerious: Math.max(1, v ?? 1) })} /></Field>
              <Field label="Report other adverse events within (days)"><NumberInput value={st.reportDaysOther} onChange={(v) => setSt({ ...st, reportDaysOther: Math.max(1, v ?? 1) })} /></Field>
            </FormGrid>
            {canEdit && <div><Button variant="primary" onClick={() => { saveRecallSettings(st); showToast('Settings saved.', 'success'); }}>Save</Button></div>}
          </div>
        )}
      </Card>
      {newC && <NewComplaintDrawer ctx={ctx} onClose={() => setNewC(false)} onOpen={setOpenC} />}
      {openC && <ComplaintDrawer key={openC} id={openC} onClose={() => setOpenC(null)} onRecall={(c) => { setOpenC(null); setNewR({ from: c }); }} />}
      {newR && <NewRecallDrawer ctx={ctx} from={newR.from} onClose={() => setNewR(null)} onOpen={(id) => { setTab('recalls'); setOpenR(id); }} />}
      {openR && <RecallDrawer key={openR} id={openR} ctx={ctx} onClose={() => setOpenR(null)} />}
    </div>
  );
};
export default RecallPage;
