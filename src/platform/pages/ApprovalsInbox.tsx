/**
 * Approvals inbox (PL5): every decision waiting on someone, from every module, in one queue — oldest and overdue first.
 * Approve from here where the decision is a yes/no; open the record where it needs more (claim amount, QC checks).
 * Delegation (USR-07): a user hands their role's approvals to another holder of the same role for a period.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Inbox, UserCheck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, KpiCard, Modal, PageHeader, Select, Tabs } from '../ui';
import type { BadgeTone } from '../../modules/gtm-v2/types';
import { usePlatform } from '../PlatformContext';
import { useSubscribe } from '../useStore';
import { useApp } from '../../context/AppContext.tsx';
import { useOrderCtx } from '../../modules/orders/useOrderCtx';
import { approveOrder, canApproveLevel, orders, orderValue, subscribeOrders } from '../../modules/orders/orderStore';
import { orderSettings } from '../../modules/orders/orderSettings';
import { approveList, priceLists, subscribePricing } from '../../modules/pricing/pricingStore';
import { claimSchemes, claims, decideScheme, subscribeClaims } from '../../modules/claims/claimsStore';
import { approvePO, pos, poValue, subscribeProcurement, vendorInvoices } from '../../modules/procurement/procurementStore';
import { adjustments, decideAdjustment } from '../../modules/inventory/stockSource';
import { approveReturn, returns, subscribeReturns } from '../../modules/returns/returnStore';
import { recalls, subscribeRecall } from '../../modules/recall/recallStore';
import { inspections, subscribeQc } from '../../modules/qc/qcStore';
import { prodSettings, receipts as prodReceipts, subscribeProduction } from '../../modules/production/productionStore';
import { approveAward, approveBidPrice, subscribeTenders, tenders } from '../../modules/tenders/tendersStore';
import { roles as allRoles, users as allUsers } from '../../modules/users/userStore';
import { activeFor, addDelegation, delegations, revokeDelegation, subscribeDelegation } from '../delegation';

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const hoursSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3600000));
const ageText = (h: number) => (h < 1 ? 'just now' : h < 48 ? `${h} h` : `${Math.round(h / 24)} d`);

interface Item {
  key: string; module: string; ref: string; title: string; detail: string; value?: number; since: string; role: string; path: string;
  approve?: () => { ok: boolean; message: string; errors?: string[] }; reject?: () => { ok: boolean; message: string };
}

const ApprovalsInbox: React.FC = () => {
  useSubscribe(subscribeOrders, subscribePricing, subscribeClaims, subscribeProcurement, subscribeReturns, subscribeRecall, subscribeQc, subscribeProduction, subscribeTenders, subscribeDelegation);
  const { enabled } = usePlatform();
  const { activePrincipal, currentUser, products, showToast } = useApp();
  const ctx = useOrderCtx();
  const navigate = useNavigate();
  const [tab, setTab] = useState('mine');
  const [dlg, setDlg] = useState(false);
  const [d, setD] = useState({ toUser: '', role: '', from: new Date().toISOString().slice(0, 10), to: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), note: '' });
  const pid = activePrincipal.id;
  const me = currentUser.name; const myRoles = (currentUser.role ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const admin = !currentUser.matrix || myRoles.includes('Administrator');
  const delegatedToMe = activeFor(me);
  const escalateH = orderSettings().approval.escalateHours;
  const user = { name: me, role: currentUser.role ?? '' };

  const items = useMemo(() => {
    const out: Item[] = [];
    if (enabled('orders')) orders().filter((o) => o.principalId === pid && o.status === 'Awaiting approval').forEach((o) => {
      const lvl = o.approval?.levels[o.approval.step] ?? 'Approver';
      out.push({ key: `o-${o.id}`, module: 'Orders', ref: o.code, title: `${o.partnerName} — order approval (${lvl})`, detail: o.approval?.reasons.join('; ') ?? '', value: orderValue(o), since: o.approval?.stepSince ?? o.createdAt, role: lvl, path: `/orders?tab=approval`,
        approve: ctx && canApproveLevel(o, user) ? () => approveOrder(o.id, 'Approved from the approvals inbox', ctx, user) : undefined });
    });
    if (enabled('price-lists')) priceLists().filter((l) => l.principalId === pid && l.status === 'Pending').forEach((l) => out.push({ key: `pl-${l.id}`, module: 'Price lists', ref: l.code, title: `${l.name} v${l.version}`, detail: `Submitted by ${l.submittedBy}`, since: l.submittedAt ?? l.createdAt, role: 'Finance Controller', path: '/pricing?tab=approvals',
      approve: () => approveList(l.id, me, products, 'Approved from the approvals inbox') }));
    if (enabled('claims')) {
      claimSchemes(pid).filter((s) => s.status === 'Pending approval').forEach((s) => out.push({ key: `sc-${s.id}`, module: 'Schemes', ref: s.code, title: s.name, detail: `Budget ${inr(s.budget)} · by ${s.makerBy}`, value: s.budget, since: s.history[s.history.length - 1]?.at ?? '', role: 'Finance Controller', path: '/claims?tab=schemes',
        approve: () => decideScheme(s.id, true, me, 'Approved from the approvals inbox'), reject: () => decideScheme(s.id, false, me, 'Rejected from the approvals inbox') }));
      claims(pid).filter((c) => c.status === 'Under review').forEach((c) => out.push({ key: `cl-${c.id}`, module: 'Claims', ref: c.no, title: `${c.partnerName} — claim ${c.period}`, detail: `Claimed ${inr(c.claimedAmount)} · verified ${inr(c.computedAmount)}`, value: c.claimedAmount, since: c.history[0]?.at ?? '', role: 'Channel / Finance', path: '/claims' }));
    }
    if (enabled('procurement')) {
      pos(pid).filter((p) => p.status === 'Awaiting approval').forEach((p) => out.push({ key: `po-${p.id}`, module: 'Procurement', ref: p.no, title: `${p.vendorName} — purchase order`, detail: 'Above the approval limit', value: poValue(p), since: p.history[p.history.length - 1]?.at ?? '', role: 'Finance Controller', path: '/procurement',
        approve: () => approvePO(p.id, me, true, 'Approved from the approvals inbox'), reject: () => approvePO(p.id, me, false, 'Rejected from the approvals inbox') }));
      vendorInvoices(pid).filter((i) => i.status === 'Exception').forEach((i) => out.push({ key: `vi-${i.id}`, module: 'Procurement', ref: i.no, title: `${i.vendorName} — invoice doesn’t match`, detail: i.exceptions.join('; ') || 'Three-way match exception', since: i.date, value: i.amount, role: 'Finance Controller', path: '/procurement?tab=invoices' }));
    }
    if (enabled('inventory')) adjustments().filter((a) => a.status === 'Pending').forEach((a) => out.push({ key: `adj-${a.id}`, module: 'Inventory', ref: a.no, title: `Stock adjustment ${a.delta > 0 ? '+' : ''}${a.delta}`, detail: `${a.reason} · by ${a.requestedBy}`, since: a.requestedAt, role: 'Warehouse Manager', path: '/inventory',
      approve: () => decideAdjustment(a.id, true, me), reject: () => decideAdjustment(a.id, false, me) }));
    if (enabled('returns')) returns().filter((r) => r.principalId === pid && r.status === 'Requested').forEach((r) => out.push({ key: `rt-${r.id}`, module: 'Returns', ref: r.no, title: `${r.partnerName} — return`, detail: r.lines.map((l) => l.reason).join(', '), since: r.history[0]?.at ?? '', role: 'Order desk', path: '/returns',
      approve: () => approveReturn(r.id, true, 'Approved from the approvals inbox', me) }));
    if (enabled('recall')) recalls().filter((r) => r.principalId === pid && r.status === 'Draft').forEach((r) => out.push({ key: `rc-${r.id}`, module: 'Recall', ref: r.no, title: 'Recall waiting for activation', detail: r.reason, since: r.history[0]?.at ?? '', role: 'Regulatory Approver', path: '/recall?tab=recalls' }));
    if (enabled('qc')) inspections(pid).filter((i) => i.status === 'Awaiting release').forEach((i) => out.push({ key: `qc-${i.id}`, module: 'Quality Control', ref: i.no, title: `${i.party} — release from Quarantine`, detail: `Inspected by ${i.inspectedBy}`, since: i.history[i.history.length - 1]?.at ?? i.receivedAt, role: 'QC Approver', path: '/qc' }));
    if (enabled('production') && prodSettings().releaseBy === 'vinflux') prodReceipts(pid).filter((r) => r.status === 'In Quarantine').forEach((r) => out.push({ key: `pr-${r.id}`, module: 'Production', ref: r.no, title: `${r.productName.slice(0, 40)} — batch ${r.batch}`, detail: `${r.qty} unit(s) from ${r.plant}`, since: r.pulledAt, role: 'QC Approver', path: '/production' }));
    if (enabled('tenders')) tenders(pid).forEach((t) => {
      if (t.status === 'Registered' && !t.priceApprovedBy && t.lines.every((l) => l.offeredPrice > 0)) out.push({ key: `tb-${t.id}`, module: 'Tenders', ref: t.no, title: `${t.buyer} — bid prices`, detail: `Due ${t.dueDate}`, since: t.createdAt, role: 'Finance Controller', path: '/tenders', approve: () => approveBidPrice(t.id, me) });
      if (t.award && !t.award.rateContractId) out.push({ key: `ta-${t.id}`, module: 'Tenders', ref: t.no, title: `${t.buyer} — awarded prices → rate contract`, detail: `Recorded by ${t.award.markedBy}`, since: t.history[t.history.length - 1]?.at ?? '', role: 'Finance Controller', path: '/tenders', approve: () => approveAward(t.id, me, products) });
    });
    return out.sort((a, b) => (a.since < b.since ? -1 : 1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pid, ctx, products, me]);

  const delegatedRoles = delegatedToMe.map((x) => x.role);
  const mine = admin ? items : items.filter((i) => myRoles.some((r) => i.role.includes(r) || r.includes(i.role)) || delegatedRoles.some((r) => i.role.includes(r)));
  const shown = tab === 'mine' ? mine : tab === 'overdue' ? items.filter((i) => hoursSince(i.since) > escalateH) : items;
  const overdue = items.filter((i) => hoursSince(i.since) > escalateH);
  const run = (fn?: () => { ok: boolean; message: string; errors?: string[] }) => { if (!fn) return; const r = fn(); showToast(r.ok ? r.message : (r.errors?.[0] ?? r.message), r.ok ? 'success' : 'warning'); };
  const staffRoles = allRoles().filter((r) => r.kind === 'Staff').map((r) => r.name);
  const holders = (role: string) => { const r = allRoles().find((x) => x.name === role); return allUsers().filter((u) => u.status === 'Active' && r && u.roleIds.includes(r.id)).map((u) => u.name); };
  const myDelegations = delegations().filter((x) => x.fromUser === me || x.toUser === me || admin);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Approvals" description="Every decision waiting on someone, from every module — oldest first. Approve here or open the record." actions={<Button icon={<UserCheck size={15} />} onClick={() => setDlg(true)}>Delegate my approvals</Button>} />
      {delegatedToMe.length > 0 && <Alert tone="info">You are covering approvals for {delegatedToMe.map((x) => `${x.fromUser} (${x.role}, until ${x.to})`).join(', ')}.</Alert>}
      <div className="g2-grid g2-grid-4" style={{ margin: '12px 0 16px' }}>
        <KpiCard label="Waiting on me" value={mine.length} icon={<Inbox size={22} />} color="#6d28d9" bg="#f5f3ff" foot={`${items.length} across the company`} onClick={() => setTab('mine')} />
        <KpiCard label="Overdue" value={overdue.length} icon={<Clock size={22} />} color="#dc2626" bg="#fef2f2" foot={`older than ${escalateH} h — escalated`} onClick={() => setTab('overdue')} />
        <KpiCard label="Value waiting" value={inr(items.reduce((a, i) => a + (i.value ?? 0), 0))} icon={<CheckCircle2 size={22} />} color="#059669" bg="#ecfdf5" foot="orders, POs, schemes, claims" />
        <KpiCard label="Delegations active" value={delegations().filter((x) => !x.revoked && x.to >= new Date().toISOString().slice(0, 10)).length} icon={<UserCheck size={22} />} color="#2563eb" bg="#eff6ff" foot="role holders covering for each other" onClick={() => setTab('delegations')} />
      </div>
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'mine', label: 'Waiting on me', count: mine.length || undefined }, { id: 'overdue', label: 'Overdue', count: overdue.length || undefined }, { id: 'all', label: 'All', count: items.length || undefined }, { id: 'delegations', label: 'Delegations', count: myDelegations.length || undefined }]} /></div>
        {tab !== 'delegations' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>Waiting</th><th>What</th><th>Who decides</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ width: 260 }} /></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={5} className="g2-muted">Nothing waiting.</td></tr>}
              {shown.map((i) => { const h = hoursSince(i.since); const late = h > escalateH; return (
                <tr key={i.key}>
                  <td style={{ whiteSpace: 'nowrap' }}><Badge tone={(late ? 'red' : h > escalateH / 2 ? 'amber' : 'slate') as BadgeTone}>{ageText(h)}</Badge>{late && <div className="g2-cell-sub" style={{ color: '#b91c1c' }}>escalated</div>}</td>
                  <td><div className="g2-row" style={{ gap: 6 }}><Badge tone="purple">{i.module}</Badge><strong style={{ fontSize: 13 }}>{i.title}</strong></div><div className="g2-cell-sub"><span className="g2-mono">{i.ref}</span>{i.detail ? ` · ${i.detail}` : ''}</div></td>
                  <td className="g2-small">{i.role}</td>
                  <td style={{ textAlign: 'right' }}>{i.value ? inr(i.value) : '—'}</td>
                  <td style={{ textAlign: 'right' }}><div className="g2-row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {i.reject && <Button size="sm" icon={<XCircle size={13} />} onClick={() => run(i.reject)}>Reject</Button>}
                    {i.approve && <Button size="sm" variant="primary" icon={<CheckCircle2 size={13} />} onClick={() => run(i.approve)}>Approve</Button>}
                    <Button size="sm" variant="ghost" onClick={() => navigate(i.path)}>Open <ArrowRight size={12} /></Button>
                  </div></td>
                </tr>
              ); })}
            </tbody>
          </table></div>
        )}
        {tab === 'delegations' && (
          <div className="g2-table-wrap"><table className="g2-table">
            <thead><tr><th>From</th><th>To</th><th>Role</th><th>Period</th><th>Note</th><th /></tr></thead>
            <tbody>
              {myDelegations.length === 0 && <tr><td colSpan={6} className="g2-muted">No delegations.</td></tr>}
              {myDelegations.map((x) => <tr key={x.id} style={{ opacity: x.revoked ? 0.5 : 1 }}><td>{x.fromUser}</td><td>{x.toUser}</td><td>{x.role}</td><td className="g2-small">{x.from} → {x.to}{x.revoked ? ' · revoked' : ''}</td><td className="g2-small">{x.note}</td><td style={{ textAlign: 'right' }}>{!x.revoked && (x.fromUser === me || admin) && <Button size="sm" onClick={() => revokeDelegation(x.id)}>Revoke</Button>}</td></tr>)}
            </tbody>
          </table></div>
        )}
      </Card>
      {dlg && (
        <Modal open variant="modal" title="Delegate my approvals" subtitle="Only to another holder of the same role, for a set period (USR-07)" onClose={() => setDlg(false)}
          footer={<><Button onClick={() => setDlg(false)}>Cancel</Button><Button variant="primary" onClick={() => { const r = addDelegation({ fromUser: me, ...d }, holders); showToast(r.message, r.ok ? 'success' : 'warning'); if (r.ok) setDlg(false); }}>Delegate</Button></>}>
          <FormGrid cols={2}>
            <Field label="Role"><Select value={d.role} placeholder="Choose…" options={(admin ? staffRoles : myRoles).map((r) => ({ value: r, label: r }))} onChange={(v) => setD({ ...d, role: v, toUser: '' })} /></Field>
            <Field label="To"><Select value={d.toUser} placeholder={d.role ? 'Choose…' : 'Pick the role first'} options={(d.role ? holders(d.role) : []).filter((n) => n !== me).map((n) => ({ value: n, label: n }))} onChange={(v) => setD({ ...d, toUser: v })} /></Field>
            <Field label="From"><Input type="date" value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} /></Field>
            <Field label="To date"><Input type="date" value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} /></Field>
          </FormGrid>
          <Field label="Note"><Input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="e.g. on leave" /></Field>
        </Modal>
      )}
    </div>
  );
};
export default ApprovalsInbox;
