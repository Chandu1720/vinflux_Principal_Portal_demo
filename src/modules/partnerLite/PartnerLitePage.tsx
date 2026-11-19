/**
 * Partner Lite — the free, simple portal for partners without their own software (or without the VinFlux distributor
 * platform). One screen per job: place an order, see orders and answer part-fill questions, report stock and sales,
 * answer suggested orders, raise scheme claims, see the statement, and (if the principal shares it) the scorecard.
 * Runs outside the principal's app at /p — partner users sign in with email + OTP (sandbox OTP 123456).
 * INTEGRATION POINT: in production this is the partner edition's web app talking to the principal's tenant through the API.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, FileBarChart, Gift, Home, LogOut, PackagePlus, Receipt, RefreshCw, ShoppingCart } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorList, Field, FormGrid, Input, NumberInput, SearchableSelect, Select, Tabs, Textarea } from '../../platform/ui';
import type { BadgeTone } from '../gtm-v2/types';
import { useSubscribe } from '../../platform/useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../gtm-v2/hooks/useGtmData';
import { useOrderCtx } from '../orders/useOrderCtx';
import { answerPartFill, createOrder, orders, orderValue, subscribeOrders } from '../orders/orderStore';
import { priceLine, shipFromFor } from '../orders/intake';
import { routeOrder, routedOrders, supplierOf } from '../orders/routing';
import { reports as secReports, submitReport, subscribeSecondary, thisPeriod } from '../secondary/secondaryStore';
import type { RawLine } from '../secondary/secondaryStore';
import { claimSchemes, claims, raiseClaim, subscribeClaims } from '../claims/claimsStore';
import { proposals, respondProposal, subscribeReplenishment } from '../replenishment/replenishmentStore';
import { ageing, statement, subscribeCollections } from '../collections/collectionsStore';
import { perfSettings, scorecards, thisMonth } from '../performance/performanceStore';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const KEY = 'vinflux.partnerLite.session';
const STATUS_TONE: Record<string, BadgeTone> = { Received: 'slate', 'Awaiting approval': 'amber', Validated: 'blue', 'Awaiting partner': 'amber', 'On hold': 'red', Confirmed: 'blue', Shipped: 'purple', Completed: 'green', Rejected: 'red', Cancelled: 'slate' };

const SignIn: React.FC<{ onIn: (partnerId: string) => void }> = ({ onIn }) => {
  const partners = (usePartners().data ?? []).filter((p) => !p.institution && p.status === 'Active');
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [sent, setSent] = useState<string | null>(null); const [err, setErr] = useState('');
  const send = (e: string) => {
    const p = partners.find((x) => x.email?.toLowerCase() === e.trim().toLowerCase() || x.portalUsers?.some((u) => u.email.toLowerCase() === e.trim().toLowerCase()));
    if (!p) { setErr('This email is not registered with any partner. Ask your principal to add you as a portal user.'); return; }
    setErr(''); setSent(p.id);
  };
  return (
    <div className="g2-stack" style={{ maxWidth: 440, margin: '60px auto' }}>
      <Card title="Sign in to Partner Lite" subtitle="Your principal’s portal for orders, stock reports, claims and statements">
        {err && <Alert tone="warn">{err}</Alert>}
        {!sent ? <>
          <Field label="Work email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcompany.in" /></Field>
          <div style={{ marginTop: 10 }}><Button variant="primary" onClick={() => send(email)}>Send OTP</Button></div>
          <div className="g2-small g2-muted" style={{ marginTop: 12 }}>Demo partners: {partners.slice(0, 4).map((p) => <a key={p.id} href="#" style={{ marginRight: 8 }} onClick={(e) => { e.preventDefault(); setEmail(p.email); send(p.email); }}>{p.name}</a>)}</div>
        </> : <>
          <Alert tone="info">OTP sent to {email}. (Sandbox: 123456)</Alert>
          <Field label="OTP"><Input value={otp} onChange={(e) => setOtp(e.target.value)} /></Field>
          <div style={{ marginTop: 10 }} className="g2-row"><Button onClick={() => setSent(null)}>Back</Button><Button variant="primary" onClick={() => (otp === '123456' ? onIn(sent) : setErr('Wrong OTP.'))}>Sign in</Button></div>
        </>}
      </Card>
    </div>
  );
};

const PartnerLitePage: React.FC = () => {
  useSubscribe(subscribeOrders, subscribeSecondary, subscribeClaims, subscribeReplenishment, subscribeCollections);
  const { activePrincipal, products, showToast } = useApp();
  const ctx = useOrderCtx();
  const partners = usePartners().data ?? [];
  const [pid, setPid] = useState<string | null>(() => { try { return sessionStorage.getItem(KEY); } catch { return null; } });
  const [tab, setTab] = useState('home');
  const [errs, setErrs] = useState<string[]>([]);
  const me = partners.find((p) => p.id === pid);
  // Only products the partner may buy: in one of its active sales policies (same rule as the order check).
  const sellable = useMemo(() => {
    const p = partners.find((x) => x.id === pid);
    const flows = (ctx?.flows ?? []).filter((f) => p?.flowIds.includes(f.id) && f.status === 'Active');
    const act = products.filter((x) => x.lifecycleStatus === 'Active');
    if (!p || !ctx) return act;
    const ok = act.filter((x) => flows.some((f) => f.productScope.allProducts || f.productScope.productIds.includes(x.id) || f.productScope.portfolioIds.includes(x.portfolioId) || f.productScope.categoryIds.includes(x.categoryId)));
    return ok.length ? ok : act;
  }, [products, partners, pid, ctx]);
  // Order
  const [cart, setCart] = useState<{ productId: string; qty: number }[]>([{ productId: '', qty: 1 }]);
  const [po, setPo] = useState('');
  const [routed, setRouted] = useState<string | null>(null);
  // Report
  const [rep, setRep] = useState<{ stock: Record<string, number>; sales: { productId: string; qty: number; customer: string; type: string; town: string; value: number }[] }>({ stock: {}, sales: [] });
  // Claim
  const [cl, setCl] = useState({ schemeId: '', qty: 0, amount: 0, evidence: '' });
  // Suggestions
  const [sq, setSq] = useState<Record<string, Record<string, number>>>({});
  const [why, setWhy] = useState('');
  useEffect(() => { try { if (pid) sessionStorage.setItem(KEY, pid); else sessionStorage.removeItem(KEY); } catch { /* private mode */ } }, [pid]);

  if (!partners.length) return <div className="g2" style={{ padding: 40 }}>Loading…</div>;
  if (!me) return <div className="g2" style={{ minHeight: '100vh', background: '#f4f5f7', padding: 16, width: '100%', flex: 1 }}><SignIn onIn={setPid} /></div>;

  const my = orders().filter((o) => o.principalId === activePrincipal.id && o.partnerId === me.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const open = my.filter((o) => !['Completed', 'Rejected', 'Cancelled'].includes(o.status));
  const sugg = proposals(activePrincipal.id).filter((p) => p.partnerId === me.id && p.status === 'Sent');
  const age = ageing(activePrincipal.id).find((r) => r.partnerId === me.id);
  const st = statement(activePrincipal.id, me.id);
  const schemes = claimSchemes(activePrincipal.id).filter((s) => s.status === 'Active' && (!s.partnerIds.length || s.partnerIds.includes(me.id)));
  const myClaims = claims(activePrincipal.id).filter((c) => c.partnerId === me.id);
  const share = perfSettings().sharePartner;
  const card = share ? scorecards(activePrincipal.id, thisMonth(), [{ id: me.id, name: me.name, partnerTypeId: me.partnerTypeId, territoryIds: me.territoryIds }], products, (id) => products.find((x) => x.id === id)?.pricingReference?.standardCost ?? 0)[0] : null;
  const lastRep = secReports(activePrincipal.id).filter((r) => r.partnerId === me.id).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
  const tell = (r: { ok: boolean; message: string; errors?: string[] }) => { if (!r.ok) setErrs(r.errors ?? [r.message]); else { setErrs([]); showToast(r.message, 'success'); } return r.ok; };

  const placeOrder = () => {
    if (!ctx) return;
    const lines = cart.filter((c) => c.productId && c.qty > 0);
    if (!lines.length) { setErrs(['Add at least one product.']); return; }
    const transfer = me.partnerTypeId === 'pt-cnf';
    const shipFrom = shipFromFor(me.id, ctx, ctx.warehouses ?? [], lines.map((l) => l.productId));
    if (!shipFrom) {
      // GTM-04: you buy through a distributor — the order goes to them (or you're told whom to order from).
      if (supplierOf(me.id, ctx)) {
        const rr = routeOrder({ principalId: activePrincipal.id, from: me, source: 'Partner Lite', poNumber: po.trim(), by: `${me.name} (Partner Lite)`,
          lines: lines.map((l) => { const pr = products.find((x) => x.id === l.productId); return { productId: l.productId, name: pr?.name ?? l.productId, qty: l.qty, unitValue: (pr?.pricingReference?.mrp ?? 0) * 0.7 }; }) }, ctx);
        if (tell({ ok: rr.ok, message: rr.ok ? (routedOrders(activePrincipal.id).find((x) => x.id === rr.id)?.message ?? rr.message) : rr.message })) { setCart([{ productId: '', qty: 1 }]); setPo(''); setRouted(rr.id ?? null); }
        return;
      }
      setErrs(['Your ordering route isn’t set up yet — please contact your principal.']); return;
    }
    const r = createOrder({ principalId: activePrincipal.id, partner: me, channelId: null, orderType: transfer ? 'Stock transfer' : 'Sale', shipFrom, poNumber: po.trim() || `PL/${me.code}/${Date.now().toString().slice(-5)}`, poDate: new Date().toISOString().slice(0, 10),
      requiredBy: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), source: 'Portal', notes: 'Placed in Partner Lite', lines: lines.map((l) => priceLine(ctx, me.id, activePrincipal.id, l.productId, null, l.qty, transfer)) }, `${me.contactPerson || me.name} (Partner Lite)`, ctx);
    if (tell(r)) { setCart([{ productId: '', qty: 1 }]); setPo(''); setTab('orders'); }
  };
  const submitRep = () => {
    const lines: RawLine[] = [
      ...Object.entries(rep.stock).filter(([, q]) => q >= 0).map(([productId, qty]) => ({ kind: 'stock' as const, code: products.find((p) => p.id === productId)?.code ?? productId, qty })),
      ...rep.sales.filter((s) => s.productId && s.qty > 0).map((s) => ({ kind: 'sale' as const, code: products.find((p) => p.id === s.productId)?.code ?? s.productId, qty: s.qty, customer: s.customer || 'Walk-in', customerType: s.type, town: s.town, value: s.value, date: new Date().toISOString().slice(0, 10), invoiceNo: '' })),
    ];
    if (!lines.length) { setErrs(['Enter your closing stock or at least one sale.']); return; }
    const r = submitReport({ principalId: activePrincipal.id, partnerId: me.id, partnerName: me.name, locType: me.partnerTypeId === 'pt-cnf' ? 'CNF' : 'PARTNER', period: thisPeriod(), route: 'portal', system: 'Partner Lite', lines }, products, `${me.name} (Partner Lite)`);
    if (tell({ ok: r.ok, message: r.ok ? 'Report sent — your principal will review it.' : r.message, errors: r.errors })) setRep({ stock: {}, sales: [] });
  };

  return (
    <div className="g2" style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', flexDirection: 'column', width: '100%', flex: 1 }}>
      <div style={{ background: '#1e1b4b', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box' }}>
        <span style={{ background: '#fff', color: '#4c1d95', borderRadius: 6, padding: '2px 8px', fontWeight: 800 }}>V</span>
        <strong>Partner Lite</strong><span style={{ opacity: 0.7 }}>· {activePrincipal.name}</span><span className="g2-spacer" />
        <span>{me.name}</span><Button size="sm" icon={<LogOut size={13} />} onClick={() => setPid(null)}>Sign out</Button>
      </div>
      <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: 16, boxSizing: 'border-box' }} className="g2-stack">
        <Tabs active={tab} onChange={(t) => { setTab(t); setErrs([]); }} tabs={[
          { id: 'home', label: 'Home', icon: <Home size={14} /> }, { id: 'order', label: 'Place order', icon: <ShoppingCart size={14} /> }, { id: 'orders', label: 'My orders', count: open.length || undefined, icon: <ClipboardList size={14} /> },
          { id: 'suggest', label: 'Suggested orders', count: sugg.length || undefined, icon: <RefreshCw size={14} /> }, { id: 'report', label: 'Stock & sales', icon: <FileBarChart size={14} /> },
          { id: 'claims', label: 'Claims', count: myClaims.filter((c) => c.status === 'Under review').length || undefined, icon: <Gift size={14} /> }, { id: 'statement', label: 'Statement', icon: <Receipt size={14} /> },
        ]} />
        {errs.length > 0 && <ErrorList errors={errs} title="Please check" />}

        {tab === 'home' && (
          <div className="g2-stack">
            <div className="g2-grid g2-grid-4">
              <Card title="Open orders"><div style={{ fontSize: 24, fontWeight: 700 }}>{open.length}</div><div className="g2-small g2-muted">{inr(open.reduce((a, o) => a + orderValue(o), 0))}</div></Card>
              <Card title="Outstanding"><div style={{ fontSize: 24, fontWeight: 700 }}>{inr(age?.outstanding ?? 0)}</div><div className="g2-small" style={{ color: age?.overdue ? '#b91c1c' : undefined }}>{inr(age?.overdue ?? 0)} overdue</div></Card>
              <Card title="Suggested orders"><div style={{ fontSize: 24, fontWeight: 700 }}>{sugg.length}</div><div className="g2-small g2-muted">waiting for your answer</div></Card>
              <Card title="Last stock report"><div style={{ fontSize: 16, fontWeight: 700 }}>{lastRep ? lastRep.period : 'None yet'}</div><div className="g2-small g2-muted">{lastRep ? `${lastRep.status} · ${lastRep.submittedAt.slice(0, 10)}` : 'Send one under Stock & sales'}</div></Card>
            </div>
            {my.some((o) => o.status === 'Awaiting partner') && <Alert tone="warn">Your principal is asking how to handle a short supply — see My orders.</Alert>}
            {card && (
              <Card title={`Your scorecard — ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`} subtitle={`Score ${card.score ?? '—'} · grade ${card.grade} — the same view your principal has`}>
                <div className="g2-grid g2-grid-4">{card.metrics.map((m) => <div key={m.key}><div className="g2-small g2-muted">{m.label}</div><div style={{ fontWeight: 700 }}>{m.value}</div><div className="g2-cell-sub">{m.hint}</div></div>)}</div>
              </Card>
            )}
          </div>
        )}

        {tab === 'order' && routed && <Alert tone="success">{routedOrders(activePrincipal.id).find((x) => x.id === routed)?.message}</Alert>}
        {tab === 'order' && (
          <Card title="New order" subtitle="Prices, schemes and checks apply exactly as when your principal’s order desk enters it">
            <div className="g2-stack">
              {cart.map((c, i) => (
                <div key={i} className="g2-row" style={{ gap: 8 }}>
                  <div style={{ flex: 1 }}><SearchableSelect value={c.productId || null} options={sellable.map((p) => ({ value: p.id, label: p.name, description: p.code }))} onChange={(v) => setCart(cart.map((x, k) => (k === i ? { ...x, productId: v ?? '' } : x)))} /></div>
                  <div style={{ width: 110 }}><NumberInput value={c.qty} onChange={(v) => setCart(cart.map((x, k) => (k === i ? { ...x, qty: Math.max(0, v ?? 0) } : x)))} /></div>
                  <Button size="sm" onClick={() => setCart(cart.filter((_, k) => k !== i))}>Remove</Button>
                </div>
              ))}
              <div className="g2-row" style={{ gap: 8 }}><Button size="sm" icon={<PackagePlus size={13} />} onClick={() => setCart([...cart, { productId: '', qty: 1 }])}>Add product</Button></div>
              <FormGrid cols={3}><Field label="Your PO number (optional)"><Input value={po} onChange={(e) => setPo(e.target.value)} /></Field></FormGrid>
              <div><Button variant="primary" disabled={!ctx} icon={<CheckCircle2 size={15} />} onClick={placeOrder}>Place order</Button></div>
            </div>
          </Card>
        )}

        {tab === 'orders' && (
          <Card flush>
            <div className="g2-table-wrap"><table className="g2-table">
              <thead><tr><th>Order</th><th>Date</th><th>Products</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th><th>Shipments</th></tr></thead>
              <tbody>{my.length === 0 && <tr><td colSpan={6} className="g2-muted">No orders yet.</td></tr>}
                {my.map((o) => (
                  <tr key={o.id}>
                    <td className="g2-mono">{o.code}<div className="g2-cell-sub">PO {o.poNumber}</div></td><td className="g2-small">{o.createdAt}</td>
                    <td className="g2-small">{o.lines.map((l) => `${l.name.slice(0, 30)} × ${l.qty}`).join('; ')}</td>
                    <td style={{ textAlign: 'right' }}>{inr(orderValue(o))}</td>
                    <td><Badge tone={STATUS_TONE[o.status] ?? 'slate'} dot>{o.status}</Badge>
                      {o.status === 'Awaiting partner' && ctx && <div className="g2-row" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        <Button size="sm" onClick={() => tell(answerPartFill(o.id, 'ship-available', 'Partner link', ctx, `${me.name} (Partner Lite)`))}>Ship what’s available</Button>
                        <Button size="sm" onClick={() => tell(answerPartFill(o.id, 'wait', 'Partner link', ctx, `${me.name} (Partner Lite)`))}>Wait for all</Button>
                        <Button size="sm" onClick={() => tell(answerPartFill(o.id, 'accept-proposed', 'Partner link', ctx, `${me.name} (Partner Lite)`))}>Accept proposed qty</Button></div>}
                    </td>
                    <td className="g2-small">{o.shipments.map((s) => <div key={s.id}>{s.no} · {s.carrier} {s.awb} · {s.deliveredAt ? 'delivered' : `ETA ${s.eta}`} · inv {s.invoiceNo}</div>)}</td>
                  </tr>
                ))}</tbody>
            </table></div>
          </Card>
        )}

        {tab === 'suggest' && (
          <div className="g2-stack">
            {sugg.length === 0 && <Card><div className="g2-muted">No suggested orders waiting.</div></Card>}
            {sugg.map((p) => { const q = sq[p.id] ?? Object.fromEntries(p.lines.map((l) => [l.productId, l.qty])); return (
              <Card key={p.id} title={`${p.no} — suggested by ${activePrincipal.name}`} subtitle="Based on your stock and sales; change any quantity">
                <table className="g2-table"><thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Your stock</th><th style={{ textAlign: 'right' }}>Selling / day</th><th style={{ width: 120 }}>Order qty</th></tr></thead>
                  <tbody>{p.lines.map((l) => <tr key={l.productId}><td>{l.name}</td><td style={{ textAlign: 'right' }}>{l.stock}</td><td style={{ textAlign: 'right' }}>{l.avgDaily}</td><td><NumberInput value={q[l.productId] ?? 0} onChange={(v) => setSq({ ...sq, [p.id]: { ...q, [l.productId]: Math.max(0, v ?? 0) } })} /></td></tr>)}</tbody></table>
                <div className="g2-row" style={{ gap: 8, marginTop: 10 }}>
                  <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (to reject)" />
                  <Button variant="danger" onClick={() => tell(respondProposal(p.id, false, {}, why, `${me.name} (Partner Lite)`, 'Partner link', ctx))}>Reject</Button>
                  <Button variant="primary" disabled={!ctx} onClick={() => tell(respondProposal(p.id, true, q, '', `${me.name} (Partner Lite)`, 'Partner link', ctx))}>Accept and order</Button>
                </div>
              </Card>
            ); })}
          </div>
        )}

        {tab === 'report' && (
          <Card title={`Stock and sales — ${thisPeriod()}`} subtitle="Month to date. Your principal checks it against what they delivered to you.">
            <div className="g2-stack">
              <strong style={{ fontSize: 13 }}>Closing stock today</strong>
              <div className="g2-grid g2-grid-3">{sellable.slice(0, 9).map((p) => <Field key={p.id} label={p.name.slice(0, 48)}><NumberInput value={rep.stock[p.id] ?? null} allowEmpty onChange={(v) => { const s = { ...rep.stock }; if (v === null) delete s[p.id]; else s[p.id] = v; setRep({ ...rep, stock: s }); }} /></Field>)}</div>
              <strong style={{ fontSize: 13 }}>Sales this month</strong>
              {rep.sales.map((s, i) => (
                <div key={i} className="g2-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 200 }}><SearchableSelect value={s.productId || null} options={sellable.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => setRep({ ...rep, sales: rep.sales.map((x, k) => (k === i ? { ...x, productId: v ?? '' } : x)) })} /></div>
                  <div style={{ width: 80 }}><NumberInput value={s.qty} onChange={(v) => setRep({ ...rep, sales: rep.sales.map((x, k) => (k === i ? { ...x, qty: v ?? 0 } : x)) })} /></div>
                  <div style={{ flex: 1, minWidth: 140 }}><Input value={s.customer} placeholder="Customer" onChange={(e) => setRep({ ...rep, sales: rep.sales.map((x, k) => (k === i ? { ...x, customer: e.target.value } : x)) })} /></div>
                  <div style={{ width: 120 }}><Select value={s.type} options={['Hospital', 'Dealer', 'Clinic', 'Retailer', 'Institution', 'Other'].map((x) => ({ value: x, label: x }))} onChange={(v) => setRep({ ...rep, sales: rep.sales.map((x, k) => (k === i ? { ...x, type: v } : x)) })} /></div>
                  <div style={{ width: 120 }}><Input value={s.town} placeholder="Town" onChange={(e) => setRep({ ...rep, sales: rep.sales.map((x, k) => (k === i ? { ...x, town: e.target.value } : x)) })} /></div>
                  <div style={{ width: 120 }}><NumberInput value={s.value} placeholder="Value ₹" onChange={(v) => setRep({ ...rep, sales: rep.sales.map((x, k) => (k === i ? { ...x, value: v ?? 0 } : x)) })} /></div>
                </div>
              ))}
              <div className="g2-row" style={{ gap: 8 }}><Button size="sm" onClick={() => setRep({ ...rep, sales: [...rep.sales, { productId: '', qty: 1, customer: '', type: 'Hospital', town: me.address?.city ?? '', value: 0 }] })}>Add sale</Button><span className="g2-spacer" /><Button variant="primary" onClick={submitRep}>Send report</Button></div>
            </div>
          </Card>
        )}

        {tab === 'claims' && (
          <div className="g2-stack">
            <Card title="Raise a claim" subtitle="Checked against the stock and sales you reported">
              {schemes.length === 0 ? <div className="g2-muted">No active schemes for you.</div> : <>
                <FormGrid cols={3}>
                  <Field label="Scheme"><Select value={cl.schemeId} placeholder="Choose…" options={schemes.map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))} onChange={(v) => setCl({ ...cl, schemeId: v })} /></Field>
                  <Field label="Units"><NumberInput value={cl.qty} onChange={(v) => setCl({ ...cl, qty: v ?? 0 })} /></Field>
                  <Field label="Amount (₹)"><NumberInput value={cl.amount} onChange={(v) => setCl({ ...cl, amount: v ?? 0 })} /></Field>
                </FormGrid>
                <Field label="Evidence"><Textarea rows={2} value={cl.evidence} onChange={(e) => setCl({ ...cl, evidence: e.target.value })} placeholder="Invoices, photos, display proof…" /></Field>
                <div style={{ marginTop: 8 }}><Button variant="primary" onClick={() => { if (tell(raiseClaim({ principalId: activePrincipal.id, schemeId: cl.schemeId, partnerId: me.id, partnerName: me.name, period: thisPeriod(), source: 'partner', claimedQty: cl.qty, claimedAmount: cl.amount, evidence: cl.evidence, by: `${me.name} (Partner Lite)` }))) setCl({ schemeId: '', qty: 0, amount: 0, evidence: '' }); }}>Submit claim</Button></div>
              </>}
            </Card>
            <Card title="My claims" flush><div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Claim</th><th>Period</th><th style={{ textAlign: 'right' }}>Claimed</th><th style={{ textAlign: 'right' }}>Verified</th><th>Status</th></tr></thead>
              <tbody>{myClaims.length === 0 && <tr><td colSpan={5} className="g2-muted">None yet.</td></tr>}{myClaims.map((c) => <tr key={c.id}><td className="g2-mono">{c.no}</td><td>{c.period}</td><td style={{ textAlign: 'right' }}>{inr(c.claimedAmount)}</td><td style={{ textAlign: 'right' }}>{inr(c.computedAmount)}</td><td><Badge tone={c.status === 'Settled' ? 'green' : c.status === 'Rejected' ? 'red' : 'amber'}>{c.status}</Badge>{c.settlement && <div className="g2-cell-sub">{c.settlement.method} {c.settlement.ref}</div>}</td></tr>)}</tbody></table></div></Card>
          </div>
        )}

        {tab === 'statement' && (
          <Card title="Account statement" subtitle={age ? `Outstanding ${inr(age.outstanding)} · overdue ${inr(age.overdue)}` : 'No invoices yet'} flush>
            <div className="g2-table-wrap"><table className="g2-table"><thead><tr><th>Date</th><th>Document</th><th>Details</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
              <tbody>{st.length === 0 && <tr><td colSpan={6} className="g2-muted">Nothing yet.</td></tr>}{st.map((r, i) => <tr key={i}><td className="g2-small">{r.date}</td><td className="g2-mono g2-small">{r.doc}</td><td className="g2-small">{r.text}</td><td style={{ textAlign: 'right' }}>{r.debit ? inr(r.debit) : ''}</td><td style={{ textAlign: 'right' }}>{r.credit ? inr(r.credit) : ''}</td><td style={{ textAlign: 'right' }}>{inr(r.balance)}</td></tr>)}</tbody></table></div>
          </Card>
        )}
      </div>
    </div>
  );
};
export default PartnerLitePage;
