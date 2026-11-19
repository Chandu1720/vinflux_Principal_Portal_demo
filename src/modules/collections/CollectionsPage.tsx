/**
 * Collections: ageing by partner, invoices, payments (cheques, post-dated, bounced), promises to pay,
 * follow-ups, reminder schedule and statements of account. Keeps each partner's credit position current.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, BellRing, Download, HandCoins, IndianRupee, Plus, Receipt, Timer } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, ErrorList, Field, FormGrid, Input, KpiCard, Modal, NumberInput, PageHeader, SearchableSelect, SearchInput, Select, Tabs } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useOrderCtx } from '../orders/useOrderCtx';
import { subscribeOrders } from '../orders/orderStore';
import { orderSettings } from '../orders/orderSettings';
import { creditOf } from '../gtm-v2/utils/health';
import { partnerOpsService } from '../gtm-v2/services/partnerOpsService';
import {
  BUCKETS, MODES, addPromise, addTask, ageing, allTasks, balanceOf, bounceCheque, bucketOf, checkPromises, clearCheque, collSettings, daysPast, doneTask, ensureCollectionsDemo,
  invoices as allInvoices, payments as allPayments, promisesOf, recordPayment, remindersOf, runReminders, saveCollSettings, statement, subscribeCollections, syncInvoices, tasksOf, unallocated,
} from './collectionsStore';
import type { Mode, PayStatus } from './collectionsStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const PAY_TONE: Record<PayStatus, BadgeTone> = { Cleared: 'green', 'Awaiting clearance': 'amber', 'Held (post-dated)': 'blue', Bounced: 'red' };
const BUCKET_TONE: Record<string, string> = { 'Not due': '#475569', '0–30': '#b45309', '31–60': '#c2410c', '61–90': '#b91c1c', '90+': '#7f1d1d' };

/* --------------------------------- Record payment --------------------------------- */

const PaymentModal: React.FC<{ partners: { id: string; name: string }[]; preset?: string; onClose: () => void }> = ({ partners, preset, onClose }) => {
  const { activePrincipal, currentUser, showToast } = useApp();
  const [f, setF] = useState({ partnerId: preset ?? '', date: today(), amount: 0, mode: 'NEFT / RTGS' as Mode, ref: '', chequeDate: '', photo: '' as string });
  const [pick, setPick] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [errs, setErrs] = useState<string[]>([]);
  const open = allInvoices(activePrincipal.id).filter((i) => i.partnerId === f.partnerId && balanceOf(i) > 0).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const save = () => {
    const p = partners.find((x) => x.id === f.partnerId);
    const r = recordPayment({ principalId: activePrincipal.id, partnerId: f.partnerId, partnerName: p?.name ?? '', date: f.date, amount: f.amount, mode: f.mode, ref: f.ref, chequeDate: f.mode.includes('heque') ? f.chequeDate || f.date : null, receiptPhoto: f.photo || null, picks: pick ? picks : null, by: currentUser.name });
    if (!r.ok) { setErrs(r.errors ?? [r.message]); return; }
    showToast(r.message, 'success'); onClose();
  };
  return (
    <Modal open size="lg" title="Record a payment" subtitle="From the bank statement, a cheque collected in the field, or UPI" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Record payment</Button></>}>
      <div className="g2-stack">
        {errs.length > 0 && <ErrorList errors={errs} title="Can’t record yet" />}
        <FormGrid>
          <Field label="Partner" required><SearchableSelect value={f.partnerId} options={partners.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => { setF({ ...f, partnerId: v ?? '' }); setPicks({}); }} /></Field>
          <Field label="Mode"><Select value={f.mode} options={MODES.map((m) => ({ value: m, label: m }))} onChange={(v) => setF({ ...f, mode: v as Mode })} /></Field>
          <Field label="Amount (₹)" required><NumberInput value={f.amount} onChange={(v) => setF({ ...f, amount: v ?? 0 })} /></Field>
          <Field label={f.mode === 'Post-dated cheque' ? 'Received on' : 'Paid on'}><Input type="date" value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={f.mode.includes('heque') ? 'Cheque no.' : f.mode === 'Cash' ? 'Receipt no. (optional)' : 'UTR / UPI reference'} required={f.mode !== 'Cash'}><Input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Field>
          {f.mode === 'Post-dated cheque' && <Field label="Cheque date" required><Input type="date" value={f.chequeDate} min={today()} onChange={(e) => setF({ ...f, chequeDate: e.target.value })} /></Field>}
          <Field label="Receipt / cheque photo" hint="Field users attach a photo"><input type="file" accept="image/*" onChange={(e) => setF({ ...f, photo: e.target.files?.[0]?.name ?? '' })} /></Field>
        </FormGrid>
        {f.mode !== 'Post-dated cheque' && f.partnerId && (
          <Card title="Allocate to invoices" subtitle={pick ? 'Enter the amount against each invoice' : 'Oldest due first, automatically'}>
            <Checkbox checked={pick} onChange={(v) => { setPick(v); setPicks({}); }} label="Choose invoices myself" />
            {pick && <div className="g2-stack" style={{ gap: 6, marginTop: 8 }}>
              {open.length === 0 && <div className="g2-small g2-muted">No open invoices — the payment stays on account.</div>}
              {open.map((i) => (
                <div key={i.id} className="g2-row" style={{ gap: 8 }}>
                  <span className="g2-mono" style={{ width: 150 }}>{i.no}</span><span className="g2-small" style={{ width: 170 }}>due {i.dueDate} · {inr(balanceOf(i))}</span>
                  <div style={{ width: 160 }}><NumberInput value={picks[i.id] ?? null} onChange={(v) => setPicks({ ...picks, [i.id]: v ?? 0 })} /></div>
                </div>
              ))}
              <div className="g2-small">Allocated {inr(Object.values(picks).reduce((a, x) => a + x, 0))} of {inr(f.amount)}; the rest stays on account.</div>
            </div>}
          </Card>
        )}
        {f.mode === 'Post-dated cheque' && <Alert tone="info">Held until its date — it doesn’t reduce the outstanding until it clears.</Alert>}
      </div>
    </Modal>
  );
};

/* ---------------------------------- Partner panel ---------------------------------- */

const PartnerPanel: React.FC<{ partnerId: string; name: string; onClose: () => void; onPay: () => void; canEdit: boolean }> = ({ partnerId, name, onClose, onPay, canEdit }) => {
  useSubscribe(subscribeCollections);
  const { activePrincipal, currentUser, showToast } = useApp();
  const [ptp, setPtp] = useState({ amount: 0, date: '', note: '' });
  const [fu, setFu] = useState({ note: '', due: '', owner: currentUser.name });
  const inv = allInvoices(activePrincipal.id).filter((i) => i.partnerId === partnerId && balanceOf(i) > 0).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const st = statement(activePrincipal.id, partnerId);
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  const csv = `Date,Document,Particulars,Debit,Credit,Balance\n${st.map((r) => [r.date, r.doc, `"${r.text}"`, r.debit || '', r.credit || '', r.balance].join(',')).join('\n')}\n`;
  return (
    <Modal open size="xl" title={name} subtitle="Open invoices, statement, promises and follow-ups" onClose={onClose} footer={canEdit ? <Button variant="primary" icon={<IndianRupee size={15} />} onClick={onPay}>Record payment</Button> : undefined}>
      <div className="g2-stack">
        <Card title="Open invoices" flush>
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th>Age</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>{inv.length === 0 ? <tr><td colSpan={6} className="g2-muted">Nothing outstanding.</td></tr> : inv.map((i) => { const b = bucketOf(i); return <tr key={i.id}><td className="g2-mono">{i.no}<div className="g2-cell-sub">{i.source}</div></td><td className="g2-small">{i.date}</td><td className="g2-small">{i.dueDate}</td><td><span style={{ color: BUCKET_TONE[b], fontWeight: 600 }}>{b === 'Not due' ? 'Not due' : `${daysPast(i.dueDate)}d`}</span></td><td style={{ textAlign: 'right' }}>{inr(i.amount)}</td><td style={{ textAlign: 'right' }}>{inr(balanceOf(i))}</td></tr>; })}</tbody>
          </table></div>
        </Card>
        <div className="g2-grid g2-grid-2">
          <Card title="Promise to pay">
            {promisesOf(partnerId).slice(0, 4).map((p) => <div key={p.id} className="g2-row g2-small" style={{ gap: 6 }}><Badge tone={p.status === 'Kept' ? 'green' : p.status === 'Broken' ? 'red' : 'amber'}>{p.status}</Badge>{inr(p.amount)} by {p.date}<span className="g2-muted">· {p.note}</span></div>)}
            {canEdit && <div className="g2-row" style={{ gap: 6, marginTop: 8 }}>
              <div style={{ width: 120 }}><NumberInput value={ptp.amount} onChange={(v) => setPtp({ ...ptp, amount: v ?? 0 })} /></div>
              <div style={{ width: 150 }}><Input type="date" value={ptp.date} min={today()} onChange={(e) => setPtp({ ...ptp, date: e.target.value })} /></div>
              <Input value={ptp.note} placeholder="Who promised, how" onChange={(e) => setPtp({ ...ptp, note: e.target.value })} />
              <Button size="sm" onClick={() => { const r = addPromise(partnerId, ptp.amount, ptp.date, ptp.note, currentUser.name); tell(r); if (r.ok) setPtp({ amount: 0, date: '', note: '' }); }}>Add</Button>
            </div>}
          </Card>
          <Card title="Follow-ups">
            {tasksOf(partnerId).slice(0, 5).map((t) => <div key={t.id} className="g2-row g2-small" style={{ gap: 6 }}><Badge tone={t.done ? 'green' : t.due < today() ? 'red' : 'amber'}>{t.done ? 'Done' : t.due}</Badge><span style={{ flex: 1 }}>{t.note} · {t.owner}</span>{!t.done && canEdit && <Button size="sm" onClick={() => doneTask(t.id)}>Done</Button>}</div>)}
            {canEdit && <div className="g2-row" style={{ gap: 6, marginTop: 8 }}>
              <Input value={fu.note} placeholder="e.g. Collect cheque on visit" onChange={(e) => setFu({ ...fu, note: e.target.value })} />
              <div style={{ width: 150 }}><Input type="date" value={fu.due} min={today()} onChange={(e) => setFu({ ...fu, due: e.target.value })} /></div>
              <Button size="sm" onClick={() => { const r = addTask(partnerId, fu.note, fu.due, fu.owner); tell(r); if (r.ok) setFu({ ...fu, note: '', due: '' }); }}>Add</Button>
            </div>}
          </Card>
        </div>
        <Card title="Statement of account" actions={<a className="g2-btn g2-btn-secondary g2-btn-sm" download={`statement-${name.replace(/\W+/g, '-')}.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}><Download size={13} /> Download</a>} flush>
          <div className="g2-table-wrap" style={{ maxHeight: 260, overflow: 'auto' }}><table className="g2-table">
            <thead><tr><th>Date</th><th>Document</th><th>Particulars</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>{st.map((r, i) => <tr key={i}><td className="g2-small">{r.date}</td><td className="g2-mono g2-small">{r.doc}</td><td className="g2-small">{r.text}</td><td style={{ textAlign: 'right' }}>{r.debit ? inr(r.debit) : ''}</td><td style={{ textAlign: 'right' }}>{r.credit ? inr(r.credit) : ''}</td><td style={{ textAlign: 'right' }}>{inr(r.balance)}</td></tr>)}</tbody>
          </table></div>
        </Card>
        {remindersOf(partnerId).length > 0 && <Card title="Reminders sent"><div className="g2-stack" style={{ gap: 4 }}>{remindersOf(partnerId).slice(0, 8).map((r) => <div key={r.id} className="g2-small"><span className="g2-muted">{r.at.slice(0, 10)} · {r.channel} · {r.stage}</span> — {r.invoiceNo}</div>)}</div></Card>}
      </div>
    </Modal>
  );
};

/* -------------------------------------- Page -------------------------------------- */

const CollectionsPage: React.FC = () => {
  useSubscribe(subscribeCollections, subscribeOrders);
  const { activePrincipal, currentUser, showToast } = useApp();
  const ctx = useOrderCtx();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'ageing';
  const setTab = (t: string) => { params.set('tab', t); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [pay, setPay] = useState<{ preset?: string } | null>(null);
  const [openP, setOpenP] = useState<string | null>(null);
  const [bounce, setBounce] = useState<{ id: string; reason: string } | null>(null);
  const m = currentUser.matrix;
  const canEdit = !m || !!m.gtm?.includes('approve') || !!m.pricing?.includes('approve') || !!m.gtm?.includes('edit');
  const partners = useMemo(() => (ctx?.partners ?? []).filter((p) => p.status === 'Active').map((p) => ({ id: p.id, name: p.name })), [ctx]);
  const source = orderSettings().sources.credit;

  useEffect(() => {
    if (!ctx) return;
    ensureCollectionsDemo(activePrincipal.id, partners.filter((p) => !ctx.partners.find((x) => x.id === p.id)?.institution));
    const days = (pid: string) => { const p = ctx.partners.find((x) => x.id === pid); return p ? creditOf(p, ctx.config, ctx).periodDays : 0; };
    syncInvoices(activePrincipal.id, days); checkPromises();
  }, [ctx, activePrincipal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = ageing(activePrincipal.id);
  const sent = useRef(new Map<string, string>());
  // Keep each partner's credit position (used by the order credit check) in step with collections.
  useEffect(() => {
    if (!ctx || source === 'none') return;
    rows.forEach((r) => { const p = ctx.partners.find((x) => x.id === r.partnerId); const sig = `${r.outstanding}|${r.overdue}`; if (p && (p.credit?.outstanding !== r.outstanding || p.credit?.overdue !== r.overdue) && sent.current.get(p.id) !== sig) { sent.current.set(p.id, sig); partnerOpsService.syncCredit(p.id, r.outstanding, r.overdue, 'Collections').catch(() => undefined); } });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const inv = allInvoices(activePrincipal.id);
  const pays = allPayments(activePrincipal.id);
  const total = rows.reduce((a, r) => a + r.outstanding, 0); const overdue = rows.reduce((a, r) => a + r.overdue, 0);
  const pdc = pays.filter((p) => p.status === 'Held (post-dated)');
  const month = today().slice(0, 7);
  const collected = pays.filter((p) => p.date.slice(0, 7) === month && p.status !== 'Bounced' && p.status !== 'Held (post-dated)').reduce((a, p) => a + p.amount, 0);
  const tasksDue = allTasks().filter((t) => !t.done && t.due <= today() && rows.some((r) => r.partnerId === t.partnerId));
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const tell = (r: { ok: boolean; message: string }) => showToast(r.message, r.ok ? 'success' : 'warning');
  const doBounce = () => {
    if (!bounce) return; const p = pays.find((x) => x.id === bounce.id)!;
    const r = bounceCheque(bounce.id, bounce.reason, currentUser.name); tell(r);
    if (r.ok && r.hold) partnerOpsService.placeHold(p.partnerId, `Cheque ${p.ref} bounced (${bounce.reason})`, currentUser.name).catch(() => undefined);
    if (r.ok) setBounce(null);
  };

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Collections" description="What partners owe, what they paid, and who to chase — kept in step with each partner’s credit position for the order credit check."
        actions={canEdit && <><Button icon={<BellRing size={15} />} onClick={() => { const n = runReminders(activePrincipal.id); showToast(n ? `${n} reminder(s) sent (logged in the demo).` : 'No reminders due today.', 'success'); }}>Send due reminders</Button><Button variant="primary" icon={<Plus size={15} />} onClick={() => setPay({})}>Record payment</Button></>} />
      {source === 'connected' && <div style={{ marginBottom: 12 }}><Alert tone="info">Outstanding is owned by your ERP (Orders → Data sources). Payments recorded here are sent to the ERP as receipts; the ERP’s figure wins on the next sync.</Alert></div>}
      {source === 'none' && <div style={{ marginBottom: 12 }}><Alert tone="warn">Credit is switched off in Orders → Data sources, so the order credit check doesn’t use these figures.</Alert></div>}
      <div className="g2-grid g2-grid-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Outstanding" value={inr(total)} icon={<Receipt size={22} />} color="#2563eb" bg="#eff6ff" foot={`${rows.filter((r) => r.outstanding > 0).length} partners`} />
        <KpiCard label="Overdue" value={inr(overdue)} icon={<Timer size={22} />} color="#dc2626" bg="#fef2f2" foot={`${inr(rows.reduce((a, r) => a + r.buckets['90+'], 0))} over 90 days`} />
        <KpiCard label="Collected this month" value={inr(collected)} icon={<HandCoins size={22} />} color="#059669" bg="#ecfdf5" foot={`${inr(pdc.reduce((a, p) => a + p.amount, 0))} in post-dated cheques`} onClick={() => setTab('payments')} />
        <KpiCard label="Follow-ups due" value={tasksDue.length} icon={<AlarmClock size={22} />} color="#d97706" bg="#fffbeb" foot={`${rows.filter((r) => r.promise).length} open promise(s) to pay`} />
      </div>
      <Card flush>
        <div className="g2-filterbar">
          <Tabs active={tab} onChange={setTab} tabs={[
            { id: 'ageing', label: 'Ageing by partner', count: rows.filter((r) => r.overdue > 0).length || undefined },
            { id: 'invoices', label: 'Open invoices', count: inv.filter((i) => balanceOf(i) > 0).length },
            { id: 'payments', label: 'Payments', count: pays.filter((p) => ['Awaiting clearance', 'Held (post-dated)'].includes(p.status)).length || undefined },
            { id: 'settings', label: 'Reminders & settings' },
          ]} />
          <span className="g2-spacer" />
          {tab !== 'settings' && <SearchInput value={q} onChange={setQ} placeholder="Partner, invoice, reference…" />}
        </div>

        {tab === 'ageing' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Partner</th><th style={{ textAlign: 'right' }}>Outstanding</th>{BUCKETS.map((b) => <th key={b} style={{ textAlign: 'right' }}>{b}</th>)}<th>Chasing</th></tr></thead>
            <tbody>
              {rows.filter((r) => match(r.partnerName)).map((r) => (
                <tr key={r.partnerId} style={{ cursor: 'pointer' }} onClick={() => setOpenP(r.partnerId)}>
                  <td className="g2-strong">{r.partnerName}{r.oldestDays > 0 && <div className="g2-cell-sub">oldest {r.oldestDays} days overdue</div>}</td>
                  <td style={{ textAlign: 'right' }}>{inr(r.outstanding)}{r.credits > 0 && <div className="g2-cell-sub">{inr(r.credits)} on account</div>}</td>
                  {BUCKETS.map((b) => <td key={b} style={{ textAlign: 'right', color: r.buckets[b] ? BUCKET_TONE[b] : '#cbd5e1', fontWeight: r.buckets[b] && b !== 'Not due' ? 600 : 400 }}>{r.buckets[b] ? inr(r.buckets[b]) : '—'}</td>)}
                  <td className="g2-small">{r.promise && <div><Badge tone="amber">Promise</Badge> {inr(r.promise.amount)} by {r.promise.date}</div>}{r.pdc > 0 && <div><Badge tone="blue">PDC</Badge> {inr(r.pdc)}</div>}{r.openTasks > 0 && <div>{r.openTasks} follow-up(s)</div>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {tab === 'invoices' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Invoice</th><th>Partner</th><th>Date</th><th>Due</th><th>Age</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>{inv.filter((i) => balanceOf(i) > 0 && match(`${i.no} ${i.partnerName} ${i.ref}`)).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).map((i) => { const b = bucketOf(i); return (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setOpenP(i.partnerId)}><td className="g2-mono">{i.no}<div className="g2-cell-sub">{i.source}{i.ref && i.source !== 'Opening balance' ? ` · ${i.ref}` : ''}</div></td><td>{i.partnerName}</td><td className="g2-small">{i.date}</td><td className="g2-small">{i.dueDate}</td><td><span style={{ color: BUCKET_TONE[b], fontWeight: 600 }}>{b === 'Not due' ? 'Not due' : `${daysPast(i.dueDate)}d`}</span></td><td style={{ textAlign: 'right' }}>{inr(i.amount)}</td><td style={{ textAlign: 'right' }}>{inr(balanceOf(i))}</td></tr>
            ); })}</tbody>
          </table></div>
        )}

        {tab === 'payments' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Receipt</th><th>Partner</th><th>Mode · reference</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Allocated</th><th>Status</th><th /></tr></thead>
            <tbody>{pays.filter((p) => match(`${p.no} ${p.partnerName} ${p.ref}`)).map((p) => (
              <tr key={p.id}>
                <td className="g2-mono">{p.no}<div className="g2-cell-sub">{p.recordedBy}{p.receiptPhoto ? ' · 📎 photo' : ''}</div></td><td>{p.partnerName}</td>
                <td className="g2-small">{p.mode}<div className="g2-cell-sub g2-mono">{p.ref}{p.chequeDate && p.mode.includes('heque') ? ` · dated ${p.chequeDate}` : ''}</div></td>
                <td className="g2-small">{p.date}</td><td style={{ textAlign: 'right' }}>{inr(p.amount)}</td>
                <td className="g2-small">{p.allocations.length ? `${p.allocations.length} invoice(s)` : '—'}{unallocated(p) > 0 && p.status !== 'Bounced' && p.status !== 'Held (post-dated)' ? <div className="g2-cell-sub">{inr(unallocated(p))} on account</div> : null}</td>
                <td><Badge tone={PAY_TONE[p.status]} dot>{p.status}</Badge></td>
                <td style={{ whiteSpace: 'nowrap' }}>{canEdit && ['Awaiting clearance', 'Held (post-dated)'].includes(p.status) && <><Button size="sm" variant="success" disabled={p.status === 'Held (post-dated)' && !!p.chequeDate && p.chequeDate > today()} onClick={() => tell(clearCheque(p.id, currentUser.name))}>Cleared</Button> <Button size="sm" variant="danger" onClick={() => setBounce({ id: p.id, reason: 'Insufficient funds' })}>Bounced</Button></>}
                  {canEdit && p.status === 'Cleared' && p.mode.includes('heque') && <Button size="sm" variant="danger" onClick={() => setBounce({ id: p.id, reason: 'Insufficient funds' })}>Bounced</Button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}

        {tab === 'settings' && (
          <div style={{ padding: 16 }} className="g2-stack">
            <Card title="Reminder schedule" subtitle="Each open invoice gets each stage once; run daily in production (CRD-04)">
              <div className="g2-stack" style={{ gap: 6 }}>{collSettings().reminders.map((r, i) => (
                <div key={i} className="g2-row" style={{ gap: 8 }}>
                  <div style={{ width: 110 }}><NumberInput value={r.offset} disabled={!canEdit} onChange={(v) => saveCollSettings({ ...collSettings(), reminders: collSettings().reminders.map((x, j) => (j === i ? { ...x, offset: v ?? 0 } : x)) })} /></div>
                  <span className="g2-small" style={{ width: 160 }}>{r.offset < 0 ? 'days before due' : r.offset === 0 ? 'on the due date' : 'days after due'}</span>
                  <div style={{ width: 200 }}><Select value={r.channel} disabled={!canEdit} options={['Email', 'WhatsApp', 'Email + WhatsApp'].map((c) => ({ value: c, label: c }))} onChange={(v) => saveCollSettings({ ...collSettings(), reminders: collSettings().reminders.map((x, j) => (j === i ? { ...x, channel: v as typeof x.channel } : x)) })} /></div>
                </div>
              ))}</div>
            </Card>
            <FormGrid>
              <Field label="Cheque bounce charge (₹)" hint="Added to the partner’s account when a cheque bounces (CRD-05)"><NumberInput value={collSettings().bounceCharge} disabled={!canEdit} onChange={(v) => saveCollSettings({ ...collSettings(), bounceCharge: v ?? 0 })} /></Field>
              <Field label="Credit hold on bounce"><Select value={collSettings().holdOnBounce ? 'yes' : 'no'} disabled={!canEdit} options={[{ value: 'yes', label: 'Put the partner on credit hold' }, { value: 'no', label: 'No automatic hold' }]} onChange={(v) => saveCollSettings({ ...collSettings(), holdOnBounce: v === 'yes' })} /></Field>
              <Field label="Credit days when terms have none"><NumberInput value={collSettings().defaultCreditDays} disabled={!canEdit} onChange={(v) => saveCollSettings({ ...collSettings(), defaultCreditDays: v ?? 30 })} /></Field>
            </FormGrid>
          </div>
        )}
      </Card>
      {pay && <PaymentModal partners={partners} preset={pay.preset} onClose={() => setPay(null)} />}
      {openP && <PartnerPanel partnerId={openP} name={partners.find((p) => p.id === openP)?.name ?? ''} canEdit={canEdit} onClose={() => setOpenP(null)} onPay={() => { setPay({ preset: openP }); setOpenP(null); }} />}
      {bounce && (
        <Modal open variant="modal" title="Cheque bounced" onClose={() => setBounce(null)} footer={<><Button onClick={() => setBounce(null)}>Cancel</Button><Button variant="danger" onClick={doBounce}>Record bounce</Button></>}>
          <div className="g2-stack">
            <Field label="Bank’s reason" required><Input value={bounce.reason} onChange={(e) => setBounce({ ...bounce, reason: e.target.value })} /></Field>
            <Alert tone="warn">The payment is reversed, its invoices open again{collSettings().bounceCharge ? `, a ₹${collSettings().bounceCharge} charge is added` : ''}{collSettings().holdOnBounce ? ' and the partner goes on credit hold' : ''}.</Alert>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default CollectionsPage;
