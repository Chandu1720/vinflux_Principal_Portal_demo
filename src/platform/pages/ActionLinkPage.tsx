/**
 * Public page behind an action link (/a/{token}) — no sign-in. Shows only what the decision needs,
 * acts once, and records the action as if made on screen ("via email link").
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Link2Off, ShieldCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Textarea } from '../ui';
import { checkLink, useLink as markUsed } from '../actionLinks';
import { roles, users } from '../../modules/users/userStore';
import { useApp } from '../../context/AppContext.tsx';
import { useOrderCtx } from '../../modules/orders/useOrderCtx';
import { answerPartFill, approveOrder, getOrder, orderValue, rejectOrder } from '../../modules/orders/orderStore';
import { decideClaim, getClaim, getScheme } from '../../modules/claims/claimsStore';
import { acknowledgePO, getPO } from '../../modules/procurement/procurementStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
/** The person behind an approval level (first active user with that role). */
const personFor = (role: string) => {
  const r = roles().find((x) => x.name === role);
  return users().find((u) => u.status === 'Active' && r && u.roleIds.includes(r.id))?.name ?? role;
};

const Shell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="g2" style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
    <div style={{ width: '100%', maxWidth: 620 }} className="g2-stack">
      <div className="g2-row" style={{ gap: 8 }}><span style={{ background: '#6d28d9', color: '#fff', borderRadius: 8, padding: '4px 9px', fontWeight: 700 }}>V</span><strong>VinFlux</strong><span className="g2-spacer" /><span className="g2-small g2-muted" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><ShieldCheck size={14} /> Secure one-time link</span></div>
      <h2 style={{ margin: '8px 0 0' }}>{title}</h2>
      {children}
    </div>
  </div>
);

const ActionLinkPage: React.FC = () => {
  const { token = '' } = useParams();
  const ctx = useOrderCtx();
  const { products } = useApp();
  const [state, setState] = useState(() => checkLink(token));
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);

  if (done) return <Shell title={done.ok ? 'Done' : 'Couldn’t complete'}><Alert tone={done.ok ? 'success' : 'warn'} icon={done.ok ? <CheckCircle2 size={16} /> : undefined}>{done.message}</Alert>{!done.ok && <div className="g2-small">Open VinFlux to finish this, or ask for a new link.</div>}</Shell>;
  if (!state.ok) return <Shell title={state.reason.includes('expired') ? 'Link expired' : 'Link can’t be used'}><Alert tone="warn" icon={state.reason.includes('expired') ? <Clock size={16} /> : <Link2Off size={16} />}>{state.reason}</Alert></Shell>;
  const link = state.link;
  const finish = (r: { ok: boolean; message: string }, by: string, result: string) => {
    if (r.ok) { markUsed(token, by, result); setState(checkLink(token)); }
    setDone(r);
  };
  const footer = <div className="g2-small g2-muted">Valid until {link.expiresAt.slice(0, 16).replace('T', ' ')} · works once · your decision is recorded on the record with “via email link”.</div>;

  /* ---------------- Order approval ---------------- */
  if (link.kind === 'order-approve' || link.kind === 'order-partfill') {
    const o = getOrder(link.refId);
    if (!o) return <Shell title="Order not found"><Alert tone="warn">The order no longer exists.</Alert></Shell>;
    if (!ctx) return <Shell title="Loading…"><div /></Shell>;
    const lines = (
      <Card title={`${o.code} · ${o.partnerName}`} subtitle={`PO ${o.poNumber} · required by ${o.requiredBy}`}>
        <div className="g2-stack" style={{ gap: 4 }}>
          {o.lines.map((l) => {
            const offer = link.kind === 'order-partfill' ? o.partFill?.proposal[l.id] ?? l.qty : null;
            return <div key={l.id} className="g2-row" style={{ justifyContent: 'space-between' }}><span>{l.name}</span><span>{offer !== null && offer < l.qty ? <><strong>{offer}</strong> of {l.qty} now</> : l.qty}</span></div>;
          })}
          <div className="g2-row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--g2-border)', paddingTop: 6, marginTop: 4 }}><span className="g2-muted">Value</span><strong>{inr(orderValue(o))}</strong></div>
        </div>
      </Card>
    );
    if (link.kind === 'order-approve') {
      const who = personFor(link.audience);
      const waiting = o.status === 'Awaiting approval' && o.approval && !o.approval.done && o.approval.levels[o.approval.step] === link.audience;
      return (
        <Shell title={`Approve order ${o.code}?`}>
          <div className="g2-small">For <strong>{who}</strong> ({link.audience})</div>
          {o.approval && <Alert tone="info">Needs approval because: {o.approval.reasons.join('; ')}</Alert>}
          {lines}
          {!waiting ? <Alert tone="warn">This order is no longer waiting for {link.audience} (now: {o.status}).</Alert> : (
            <Card>
              <Field label="Note (required to reject)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="g2-row" style={{ gap: 8, marginTop: 12 }}>
                <Button variant="danger" onClick={() => finish(rejectOrder(o.id, note, `${who} (via email link)`), who, 'Rejected')}>Reject</Button>
                <Button variant="primary" icon={<CheckCircle2 size={15} />} onClick={() => finish(approveOrder(o.id, note ? `${note} (via email link)` : 'via email link', ctx, { name: who, role: link.audience }), who, 'Approved')}>Approve</Button>
              </div>
            </Card>
          )}
          {footer}
        </Shell>
      );
    }
    const waiting = o.status === 'Awaiting partner' && !!o.partFill && !o.partFill.answer;
    const choose = (a: 'ship-available' | 'wait' | 'accept-proposed', text: string) => finish(answerPartFill(o.id, a, 'Partner link', ctx, `${o.partnerName} (via email link)`), o.partnerName, text);
    return (
      <Shell title="Part of your order is available now">
        <div className="g2-small">For <strong>{o.partnerName}</strong></div>
        {lines}
        {!waiting ? <Alert tone="warn">This order is no longer waiting for your answer (now: {o.status}).</Alert> : (
          <div className="g2-stack" style={{ gap: 8 }}>
            <Button variant="primary" onClick={() => choose('ship-available', 'Ship available now, rest on backorder')}>Ship what’s available now — rest on backorder</Button>
            <Button onClick={() => choose('accept-proposed', 'Accept the available quantity only')}>Accept only the available quantity (cancel the rest)</Button>
            <Button onClick={() => choose('wait', 'Wait for the complete order')}>Wait and ship the complete order</Button>
          </div>
        )}
        {footer}
      </Shell>
    );
  }

  /* ---------------- Vendor acknowledges a PO ---------------- */
  if (link.kind === 'po-ack') {
    const po = getPO(link.refId);
    if (!po) return <Shell title="Purchase order not found"><Alert tone="warn">The purchase order no longer exists.</Alert></Shell>;
    return (
      <Shell title={`Purchase order ${po.no}`}>
        <div className="g2-small">For <strong>{po.vendorName}</strong> · delivery requested by {po.deliveryDate} · {po.terms}</div>
        <Card>
          <div className="g2-stack" style={{ gap: 4 }}>{po.lines.map((l) => <div key={l.id} className="g2-row" style={{ justifyContent: 'space-between' }}><span>{products.find((p) => p.id === l.productId)?.name ?? l.name}</span><span>{l.qty} × {po.currency === 'INR' ? '₹' : `${po.currency} `}{l.price.toLocaleString('en-IN')}</span></div>)}</div>
        </Card>
        {po.status !== 'Sent' ? <Alert tone="warn">This order is no longer waiting for acknowledgement (now: {po.status}).</Alert> : (
          <Card>
            <Field label="We can deliver by" required><input className="g2-input" type="date" defaultValue={po.deliveryDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setNote(`${e.target.value}|${note.split('|')[1] ?? ''}`)} /></Field>
            <Field label="Note (optional)"><Textarea rows={2} onChange={(e) => setNote(`${note.split('|')[0] || po.deliveryDate}|${e.target.value}`)} /></Field>
            <div style={{ marginTop: 12 }}><Button variant="primary" icon={<CheckCircle2 size={15} />} onClick={() => { const [d, n] = (note || po.deliveryDate).split('|'); finish(acknowledgePO(po.id, d || po.deliveryDate, n ?? '', `${po.vendorName} (via email link)`, 'Vendor link'), po.vendorName, `Acknowledged for ${d || po.deliveryDate}`); }}>Acknowledge order</Button></div>
          </Card>
        )}
        {footer}
      </Shell>
    );
  }

  /* ---------------- Claim decision ---------------- */
  const c = getClaim(link.refId); const s = c ? getScheme(c.schemeId) : null;
  if (!c || !s) return <Shell title="Claim not found"><Alert tone="warn">This claim was replaced (for example by the partner’s own claim for the same month) or removed. Use the latest message.</Alert></Shell>;
  const who = personFor(link.audience);
  const verified = ['PER_UNIT', 'TARGET'].includes(s.type);
  const amount = verified ? Math.min(c.claimedAmount, c.computedAmount) : c.claimedAmount;
  return (
    <Shell title={`Claim ${c.no} — ${c.partnerName}`}>
      <div className="g2-small">For <strong>{who}</strong> ({link.audience}) · {s.code} {s.name} · {c.period}</div>
      {c.flags.length > 0 && <Alert tone="warn">{c.flags.join(' ')}</Alert>}
      <Card>
        <div className="g2-row" style={{ justifyContent: 'space-between' }}><span>Claimed</span><strong>{inr(c.claimedAmount)}</strong></div>
        <div className="g2-row" style={{ justifyContent: 'space-between' }}><span>{verified ? 'Verified from secondary data' : 'Per scheme terms'}</span><strong>{inr(c.computedAmount)}</strong></div>
        {c.evidence && <div className="g2-small g2-muted" style={{ marginTop: 6 }}>Evidence: {c.evidence}</div>}
        {products.length === 0 && null}
      </Card>
      {c.status !== 'Under review' ? <Alert tone="warn">This claim is no longer under review (now: {c.status}).</Alert> : (
        <Card>
          <Field label="Note (required to reject)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="g2-row" style={{ gap: 8, marginTop: 12 }}>
            <Button variant="danger" onClick={() => finish(decideClaim(c.id, false, 0, `${who} (via email link)`, note, false), who, 'Rejected')}>Reject</Button>
            <Button variant="primary" icon={<CheckCircle2 size={15} />} onClick={() => finish(decideClaim(c.id, true, amount, `${who} (via email link)`, note || 'via email link', false), who, `Approved ${inr(amount)}`)}>Approve {inr(amount)}{amount < c.claimedAmount ? ' (verified part)' : ''}</Button>
          </div>
          <div className="g2-small g2-muted" style={{ marginTop: 6 }}>To approve a different amount or over budget, open the claim in VinFlux.</div>
        </Card>
      )}
      <Badge tone="slate">Settlement is done in VinFlux after approval</Badge>
      {footer}
    </Shell>
  );
};
export default ActionLinkPage;
