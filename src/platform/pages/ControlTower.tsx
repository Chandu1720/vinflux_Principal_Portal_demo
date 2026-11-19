/**
 * Control tower (AN1): one screen over the whole supply chain — supplier → port → QC → own warehouse → transit →
 * channel partners → hospitals and customers. Opens on where money is stuck and what needs action, filtered by the
 * viewer's role lens. Every number opens the records behind it; every number from an outside source shows its age.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight, Boxes, Building2, ChevronRight, Clock, Factory, Hospital, IndianRupee, LayoutGrid, Radar, Ship, ShieldCheck, Truck, Users, Warehouse } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card, PageHeader, Segmented, Tabs } from '../ui';
import type { BadgeTone } from '../../modules/gtm-v2/types';
import { usePlatform } from '../PlatformContext';
import { useSubscribe } from '../useStore';
import { useApp } from '../../context/AppContext.tsx';
import { usePartners } from '../../modules/gtm-v2/hooks/useGtmData';
import { allShipments, orders, orderValue, subscribeOrders } from '../../modules/orders/orderStore';
import { balances, subscribeStock } from '../../modules/inventory/stockStore';
import { staleSync } from '../integrations/stockSync';
import { coverage, partnerBoard, reports as secReports, subscribeSecondary } from '../../modules/secondary/secondaryStore';
import { claims, subscribeClaims } from '../../modules/claims/claimsStore';
import { cases as surgicalCases, sets as surgicalSets, subscribeSurgical } from '../../modules/surgical/surgicalStore';
import { returns, subscribeReturns } from '../../modules/returns/returnStore';
import { recalls, subscribeRecall } from '../../modules/recall/recallStore';
import { ageing, subscribeCollections } from '../../modules/collections/collectionsStore';
import { inspections as qcInspections, subscribeQc } from '../../modules/qc/qcStore';
import { suggest, subscribeReplenishment } from '../../modules/replenishment/replenishmentStore';
import { landed, missingDocs, shipments as impShipments, subscribeImports } from '../../modules/imports/importsStore';
import { grns as procGrns, poValue, pos as procPos, subscribeProcurement } from '../../modules/procurement/procurementStore';
import { agreementFor, reminders as tenderReminders, stateOf as agreementState, subscribeTenders } from '../../modules/tenders/tendersStore';
import { invSettings, invoices as allInvoices, subscribeInvoicing } from '../../modules/invoicing/invoiceStore';
import { contractsNearLimit } from '../../modules/pricing/contractUsage';
import { routedSummary, subscribeRouting } from '../../modules/orders/routing';
import { expectedSupply as prodExpected, receipts as prodReceipts, subscribeProduction } from '../../modules/production/productionStore';
import HomeDashboard from './HomeDashboard';

type Lens = 'all' | 'sales' | 'desk' | 'finance' | 'channel' | 'supply' | 'quality';
const LENSES: { id: Lens; label: string }[] = [
  { id: 'all', label: 'Management' }, { id: 'sales', label: 'Sales' }, { id: 'desk', label: 'Order desk' }, { id: 'finance', label: 'Finance' },
  { id: 'channel', label: 'Channel' }, { id: 'supply', label: 'Supply' }, { id: 'quality', label: 'Quality' },
];
const lensFor = (role: string): Lens => /Administrator|Director|Owner/i.test(role) ? 'all' : /Finance/i.test(role) ? 'finance' : /QC|Regulatory|QA/i.test(role) ? 'quality' : /Warehouse|Procure/i.test(role) ? 'supply'
  : /Sales|RSM|Regional/i.test(role) ? 'sales' : /Order/i.test(role) ? 'desk' : 'all';

const inr = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const ago = (h: number) => (h === Infinity ? 'never synced' : h < 1 ? 'just now' : h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`);
type Health = 'ok' | 'warn' | 'bad' | 'off';
const HEALTH: Record<Health, { c: string; bg: string; b: string }> = {
  ok: { c: '#047857', bg: '#ecfdf5', b: '#a7f3d0' }, warn: { c: '#b45309', bg: '#fffbeb', b: '#fde68a' }, bad: { c: '#b91c1c', bg: '#fef2f2', b: '#fecaca' }, off: { c: '#6b7280', bg: '#f9fafb', b: '#e5e7eb' },
};

interface Money { key: string; label: string; value: number; units?: string; foot: string; path: string; tone: BadgeTone; lenses: Lens[] }
interface Node { key: string; title: string; icon: React.ReactNode; health: Health; main: string; lines: { text: string; tone?: BadgeTone }[]; path: string }
interface Exception { key: string; sev: 'critical' | 'high' | 'medium'; text: string; detail: string; count: number; value?: number; owner: string; path: string; lenses: Lens[] }
interface Watch { partnerId: string; name: string; flags: { text: string; tone: BadgeTone }[]; overdue: number; cover: number | null; dataAge: number | null; fresh: boolean; score: number }

const ControlTower: React.FC = () => {
  useSubscribe(subscribeOrders, subscribeStock, subscribeSecondary, subscribeClaims, subscribeSurgical, subscribeReturns, subscribeRecall, subscribeCollections, subscribeProcurement, subscribeImports, subscribeQc, subscribeReplenishment, subscribeTenders, subscribeInvoicing, subscribeRouting, subscribeProduction);
  const { enabled } = usePlatform();
  const navigate = useNavigate();
  const { activePrincipal, products, currentUser, warehouses } = useApp();
  const partnersAll = usePartners().data ?? [];
  const pid = activePrincipal.id;
  const [view, setView] = useState<'tower' | 'modules'>('tower');
  const [lens, setLens] = useState<Lens>(() => lensFor(currentUser.role ?? ''));
  const unitValue = (id: string) => { const p = products.find((x) => x.id === id); return p?.pricingReference?.standardCost ?? (p?.pricingReference?.mrp ?? 0) * 0.6; };
  const sellValue = (id: string) => { const p = products.find((x) => x.id === id); return (p?.pricingReference?.mrp ?? unitValue(id) / 0.6) * 0.8; };

  const d = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10);
    const lim90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const money: Money[] = []; const nodes: Node[] = []; const ex: Exception[] = [];
    const channelPartners = partnersAll.filter((p) => !p.institution && p.status === 'Active');
    const pName = (id: string) => partnersAll.find((p) => p.id === id)?.name ?? id;
    const bal = enabled('inventory') ? balances().filter((b) => b.qty > 0) : [];
    const exc = (e: Exception) => { if (e.count > 0) ex.push(e); };

    /* ---------------- Supply side ---------------- */
    if (enabled('procurement')) {
      const ps = procPos(pid).filter((p) => ['Sent', 'Acknowledged', 'Part received', 'Approved'].includes(p.status));
      const late = ps.filter((p) => (p.ack?.promisedDate ?? p.deliveryDate) < t);
      const lateVal = late.reduce((a, p) => a + poValue(p), 0);
      nodes.push({ key: 'vendors', title: 'Suppliers', icon: <Factory size={18} />, health: late.length ? 'bad' : ps.length ? 'ok' : 'off', main: `${ps.length} open PO${ps.length === 1 ? '' : 's'}`,
        lines: [{ text: inr(ps.reduce((a, p) => a + poValue(p), 0)) + ' on order' }, ...(late.length ? [{ text: `${late.length} late · ${inr(lateVal)}`, tone: 'red' as BadgeTone }] : [])], path: '/procurement' });
      if (late.length) money.push({ key: 'supply', label: 'Supply running late', value: lateVal, foot: `${late.length} purchase order(s) past the promised date`, path: '/procurement', tone: 'amber', lenses: ['all', 'supply'] });
      exc({ key: 'po-late', sev: 'high', text: 'Purchase orders past their promised date', detail: late.map((p) => `${p.no} ${p.vendorName}`).slice(0, 3).join(' · '), count: late.length, value: lateVal, owner: 'Procurement', path: '/procurement', lenses: ['all', 'supply'] });
      exc({ key: 'po-appr', sev: 'medium', text: 'Purchase orders waiting for approval', detail: 'Above the approval limit', count: procPos(pid).filter((p) => p.status === 'Awaiting approval').length, owner: 'Finance', path: '/procurement', lenses: ['all', 'finance', 'supply'] });
    }
    if (enabled('production')) {
      const pr = prodReceipts(pid); const q = pr.filter((r) => r.status === 'In Quarantine'); const exp = prodExpected(pid);
      nodes.push({ key: 'plant', title: 'Own plant', icon: <Factory size={18} />, health: q.length ? 'warn' : 'ok', main: `${exp.reduce((a, p) => a + p.qty, 0)} units planned`,
        lines: [{ text: `${exp.length} run(s) from the ERP` }, ...(q.length ? [{ text: `${q.length} batch(es) awaiting release`, tone: 'amber' as BadgeTone }] : [])], path: '/production' });
      exc({ key: 'prod-q', sev: 'medium', text: 'Production batches waiting for quality release', detail: q.map((r) => `${r.no} ${r.productName.slice(0, 30)} · ${r.batch}`).slice(0, 2).join(' · '), count: q.length, owner: 'QA', path: '/production', lenses: ['all', 'quality', 'supply'] });
    }
    if (enabled('imports')) {
      const ss = impShipments(pid).filter((s) => s.status !== 'Received');
      const port = ss.filter((s) => s.status === 'Arrived at port');
      const miss = ss.filter((s) => missingDocs(s).length);
      const val = ss.reduce((a, s) => a + landed(s).total, 0);
      nodes.push({ key: 'imports', title: 'Imports & port', icon: <Ship size={18} />, health: miss.length ? 'bad' : port.length ? 'warn' : ss.length ? 'ok' : 'off', main: `${ss.length} shipment${ss.length === 1 ? '' : 's'}`,
        lines: [{ text: `${inr(val)} landed` }, ...(port.length ? [{ text: `${port.length} at port`, tone: 'amber' as BadgeTone }] : []), ...(miss.length ? [{ text: `${miss.length} missing documents`, tone: 'red' as BadgeTone }] : [])], path: '/imports' });
      exc({ key: 'imp-docs', sev: 'high', text: 'Import shipments missing documents', detail: miss.map((s) => `${s.no}: ${missingDocs(s).join(', ')}`).slice(0, 2).join(' · '), count: miss.length, owner: 'Imports', path: '/imports', lenses: ['all', 'supply'] });
      exc({ key: 'imp-port', sev: 'medium', text: 'Shipments at port waiting for clearance', detail: 'Duty and bill of entry', count: port.length, owner: 'Imports', path: '/imports', lenses: ['all', 'supply'] });
    }
    {
      const q = bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Quarantine');
      const qi = enabled('qc') ? qcInspections(pid) : [];
      const toDo = qi.filter((i) => i.status === 'To inspect').length; const rel = qi.filter((i) => i.status === 'Awaiting release').length; const held = qi.filter((i) => i.status === 'On hold').length;
      const qVal = q.reduce((a, b) => a + b.qty * unitValue(b.productId), 0);
      const grnQc = enabled('procurement') ? procGrns(pid).filter((g) => g.status === 'In QC').length : 0;
      if (enabled('qc') || q.length || grnQc) {
        nodes.push({ key: 'qc', title: 'Quality control', icon: <ShieldCheck size={18} />, health: held ? 'bad' : toDo + rel + grnQc ? 'warn' : 'ok', main: toDo || grnQc ? `${toDo || grnQc} lot${(toDo || grnQc) === 1 ? '' : 's'} to inspect` : held + rel ? `${held + rel} lot(s) in progress` : 'Nothing waiting',
          lines: [...(q.length ? [{ text: `${q.reduce((a, b) => a + b.qty, 0)} units · ${inr(qVal)} not sellable yet` }] : []), ...(rel ? [{ text: `${rel} awaiting release`, tone: 'blue' as BadgeTone }] : []), ...(held ? [{ text: `${held} on hold`, tone: 'red' as BadgeTone }] : [])], path: enabled('qc') ? '/qc' : '/procurement?tab=grn' });
        if (qVal) money.push({ key: 'quarantine', label: 'Stock waiting for QC', value: qVal, units: `${q.reduce((a, b) => a + b.qty, 0)} units`, foot: 'Received but not yet sellable', path: enabled('qc') ? '/qc' : '/procurement?tab=grn', tone: 'amber', lenses: ['all', 'supply', 'quality'] });
        exc({ key: 'qc-todo', sev: 'medium', text: 'Lots in Quarantine waiting for inspection', detail: 'Goods received, not sellable until released', count: toDo || grnQc, value: qVal, owner: 'QC inspector', path: enabled('qc') ? '/qc' : '/procurement?tab=grn', lenses: ['all', 'quality', 'supply'] });
        exc({ key: 'qc-rel', sev: 'medium', text: 'Inspected lots waiting for QC release', detail: 'A second person releases', count: rel, owner: 'QC approver', path: '/qc', lenses: ['all', 'quality'] });
        exc({ key: 'qc-hold', sev: 'high', text: 'Lots on QC hold', detail: 'Waiting for certificate or decision', count: held, owner: 'QA', path: '/qc', lenses: ['all', 'quality'] });
      }
    }
    if (enabled('inventory')) {
      const own = bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Available');
      const near = own.filter((b) => b.expiryDate && b.expiryDate <= lim90);
      const blocked = bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Blocked');
      const stale = warehouses.map((w) => ({ w, s: staleSync(w.id, { warehouses }) })).filter((x) => x.s);
      nodes.push({ key: 'wh', title: 'Own warehouses', icon: <Warehouse size={18} />, health: stale.length || blocked.length ? 'warn' : 'ok', main: `${own.reduce((a, b) => a + b.qty, 0).toLocaleString('en-IN')} units available`,
        lines: [{ text: inr(own.reduce((a, b) => a + b.qty * unitValue(b.productId), 0)) }, ...(near.length ? [{ text: `${near.reduce((a, b) => a + b.qty, 0)} expiring ≤ 90 d`, tone: 'amber' as BadgeTone }] : []),
          ...(stale.length ? [{ text: `ERP stock ${ago(stale[0].s!.hours)}`, tone: 'amber' as BadgeTone }] : [])], path: '/inventory' });
      exc({ key: 'erp-stale', sev: 'high', text: 'Stock figures from the ERP are out of date', detail: stale.map((x) => `${x.w.name}: ${x.s!.connector} ${ago(x.s!.hours)}`).slice(0, 2).join(' · '), count: stale.length, owner: 'Integration admin', path: '/integrations', lenses: ['all', 'desk', 'supply'] });
    }
    if (enabled('logistics') || enabled('orders')) {
      const sh = allShipments().filter((x) => x.order.principalId === pid && !x.shipment.deliveredAt);
      const late = sh.filter((x) => x.shipment.eta < t);
      const v = (x: typeof sh[number]) => x.shipment.allocations.reduce((a, al) => a + al.qty * (x.order.lines.find((l) => l.productId === al.productId)?.netUnit ?? sellValue(al.productId)), 0);
      nodes.push({ key: 'transit', title: 'In transit', icon: <Truck size={18} />, health: late.length ? 'bad' : sh.length ? 'ok' : 'off', main: `${sh.length} shipment${sh.length === 1 ? '' : 's'}`,
        lines: [{ text: inr(sh.reduce((a, x) => a + v(x), 0)) }, ...(late.length ? [{ text: `${late.length} past ETA`, tone: 'red' as BadgeTone }] : [])], path: enabled('logistics') ? '/logistics?tab=transit' : '/orders' });
      exc({ key: 'ship-late', sev: 'high', text: 'Shipments past their delivery date', detail: late.map((x) => `${x.shipment.no} → ${x.order.partnerName}`).slice(0, 2).join(' · '), count: late.length, value: late.reduce((a, x) => a + v(x), 0), owner: 'Logistics', path: '/logistics?tab=transit', lenses: ['all', 'desk', 'supply'] });
    }

    /* ---------------- Demand side ---------------- */
    let stockouts: { partnerId: string; name: string; product: string; cover: number | null; perMonth: number }[] = [];
    const coverBy: Record<string, number | null> = {};
    if (enabled('replenishment') || enabled('secondary')) {
      const sg = suggest(pid, channelPartners.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId })), products);
      sg.filter((s) => s.ok).forEach((s) => {
        const covers = s.rows.filter((r) => r.avgDaily > 0).map((r) => r.coverNow ?? 0);
        coverBy[s.partnerId] = covers.length ? Math.min(...covers) : null;
        s.rows.filter((r) => r.avgDaily > 0 && (r.coverNow ?? 0) < Math.min(14, r.targetDays / 3)).forEach((r) => stockouts.push({ partnerId: s.partnerId, name: s.partnerName, product: r.name, cover: r.coverNow, perMonth: r.avgDaily * 30 * sellValue(r.productId) }));
      });
      stockouts = stockouts.sort((a, b) => (a.cover ?? 0) - (b.cover ?? 0));
    }
    if (enabled('secondary')) {
      const board = partnerBoard(pid, channelPartners.map((p) => p.id), unitValue); const cov = coverage(board);
      const ch = bal.filter((b) => b.locType === 'CNF' || b.locType === 'PARTNER');
      const chNear = ch.filter((b) => b.expiryDate && b.expiryDate <= lim90);
      const stale = board.filter((r) => !r.fresh && !r.estimated);
      const chVal = ch.reduce((a, b) => a + b.qty * unitValue(b.productId), 0);
      nodes.push({ key: 'channel', title: 'C&F and distributors', icon: <Users size={18} />, health: stockouts.length ? 'bad' : stale.length || chNear.length ? 'warn' : 'ok', main: `${inr(chVal)} channel stock`,
        lines: [{ text: `${cov.pct}% reported and fresh`, tone: cov.pct < 60 ? 'amber' : undefined }, ...(stockouts.length ? [{ text: `${new Set(stockouts.map((s) => s.partnerId)).size} partner(s) near stock-out`, tone: 'red' as BadgeTone }] : []),
          ...(chNear.length ? [{ text: `${inr(chNear.reduce((a, b) => a + b.qty * unitValue(b.productId), 0))} expiring ≤ 90 d`, tone: 'amber' as BadgeTone }] : [])], path: '/secondary' });
      if (stockouts.length) money.push({ key: 'stockout', label: 'Sales at risk — partner stock-outs', value: stockouts.reduce((a, s) => a + s.perMonth, 0), foot: `${stockouts.length} product(s) at ${new Set(stockouts.map((s) => s.partnerId)).size} partner(s) with under 2 weeks’ cover (a month’s sales)`, path: enabled('replenishment') ? '/replenishment' : '/secondary', tone: 'red', lenses: ['all', 'sales', 'channel'] });
      if (chNear.length) money.push({ key: 'ch-expiry', label: 'Channel stock expiring ≤ 90 days', value: chNear.reduce((a, b) => a + b.qty * unitValue(b.productId), 0), units: `${chNear.reduce((a, b) => a + b.qty, 0)} units`, foot: `At ${new Set(chNear.map((b) => b.warehouseId)).size} partner(s) — liquidate or return before write-off`, path: '/inventory?tab=expiry', tone: 'amber', lenses: ['all', 'sales', 'channel'] });
      exc({ key: 'stockout', sev: 'critical', text: 'Partners about to run out', detail: stockouts.slice(0, 3).map((s) => `${s.name}: ${s.product.slice(0, 28)} (${s.cover ?? 0} d)`).join(' · '), count: stockouts.length, value: stockouts.reduce((a, s) => a + s.perMonth, 0), owner: 'Sales / channel', path: enabled('replenishment') ? '/replenishment' : '/secondary', lenses: ['all', 'sales', 'channel'] });
      exc({ key: 'sec-stale', sev: 'medium', text: 'Partners not reporting stock and sales', detail: stale.map((r) => `${pName(r.partnerId)} (${r.age === null ? 'never' : `${r.age} d`})`).slice(0, 3).join(' · '), count: stale.length, owner: 'Channel manager', path: '/secondary', lenses: ['all', 'channel', 'sales'] });
      exc({ key: 'sec-review', sev: 'medium', text: 'Partner reports waiting for review', detail: 'Reconciliation or unmapped codes', count: secReports(pid).filter((r) => r.status === 'Needs review').length, owner: 'Channel manager', path: '/secondary?tab=review', lenses: ['all', 'channel'] });
      exc({ key: 'ch-exp', sev: 'medium', text: 'Channel stock expiring within 90 days', detail: 'Plan liquidation, schemes or returns', count: chNear.length, value: chNear.reduce((a, b) => a + b.qty * unitValue(b.productId), 0), owner: 'Channel manager', path: '/inventory?tab=expiry', lenses: ['all', 'channel', 'sales'] });
    }
    {
      // Hospitals and end customers: secondary sales this month, surgeries, consignment.
      const month = t.slice(0, 7);
      const latest = new Map<string, number>();
      secReports(pid).filter((r) => r.status === 'Accepted' && r.period === month).sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1)).forEach((r) => latest.set(r.partnerId, r.sales.reduce((a, s) => a + s.value, 0)));
      const sold = [...latest.values()].reduce((a, v) => a + v, 0);
      const cs = enabled('surgical') ? surgicalCases().filter((c) => c.principalId === pid) : [];
      const up = cs.filter((c) => c.status === 'Confirmed' && c.surgeryDate >= t).length;
      const loanerLate = enabled('surgical') ? surgicalSets().filter((s) => s.kind === 'Loaner' && s.hospitalId && s.sentAt && Date.now() - Date.parse(s.sentAt) > 7 * 86400000) : [];
      const hosp = bal.filter((b) => b.locType === 'HOSPITAL');
      if (enabled('secondary') || enabled('surgical')) {
        nodes.push({ key: 'customers', title: 'Hospitals & customers', icon: <Hospital size={18} />, health: loanerLate.length ? 'warn' : 'ok', main: `${inr(sold)} sold this month`,
          lines: [...(enabled('surgical') ? [{ text: `${up} upcoming surger${up === 1 ? 'y' : 'ies'}` }] : []), ...(hosp.length ? [{ text: `${hosp.reduce((a, b) => a + b.qty, 0)} units on consignment` }] : []), ...(loanerLate.length ? [{ text: `${loanerLate.length} loaner set(s) overdue`, tone: 'amber' as BadgeTone }] : [])],
          path: enabled('surgical') ? '/surgical' : '/secondary?tab=customers' });
        exc({ key: 'loaner', sev: 'medium', text: 'Loaner sets out more than 7 days', detail: 'Chase the hospital or partner', count: loanerLate.length, owner: 'Surgical team', path: '/surgical?tab=sets', lenses: ['all', 'sales'] });
      }
    }

    /* ---------------- Orders and money ---------------- */
    if (enabled('orders')) {
      const os = orders().filter((o) => o.principalId === pid);
      const stuck = os.filter((o) => ['On hold', 'Awaiting approval', 'Awaiting partner', 'Received'].includes(o.status));
      const hold = os.filter((o) => o.status === 'On hold'); const appr = os.filter((o) => o.status === 'Awaiting approval'); const part = os.filter((o) => o.status === 'Awaiting partner');
      const back = os.filter((o) => o.lines.some((l) => l.backorderQty > 0) && !['Cancelled', 'Rejected', 'Completed'].includes(o.status));
      money.push({ key: 'orders', label: 'Orders not moving', value: stuck.reduce((a, o) => a + orderValue(o), 0), foot: `${hold.length} on credit hold · ${appr.length} waiting approval · ${part.length} waiting for partner`, path: '/orders', tone: stuck.length ? 'amber' : 'green', lenses: ['all', 'desk', 'sales', 'finance'] });
      exc({ key: 'hold', sev: 'critical', text: 'Orders on credit hold', detail: hold.map((o) => `${o.code} ${o.partnerName}`).slice(0, 3).join(' · '), count: hold.length, value: hold.reduce((a, o) => a + orderValue(o), 0), owner: 'Finance', path: '/orders', lenses: ['all', 'finance', 'desk'] });
      exc({ key: 'appr', sev: 'high', text: 'Orders waiting for approval', detail: appr.map((o) => `${o.code} ${o.partnerName}`).slice(0, 3).join(' · '), count: appr.length, value: appr.reduce((a, o) => a + orderValue(o), 0), owner: 'Approver', path: '/orders', lenses: ['all', 'desk', 'sales'] });
      exc({ key: 'part', sev: 'medium', text: 'Partners still to answer a part-fill question', detail: 'Ship available now, wait, or accept proposed', count: part.length, value: part.reduce((a, o) => a + orderValue(o), 0), owner: 'Order desk', path: '/orders', lenses: ['all', 'desk'] });
      exc({ key: 'back', sev: 'medium', text: 'Orders with backorders', detail: 'Waiting for stock', count: back.length, owner: 'Order desk', path: '/orders', lenses: ['all', 'desk', 'supply'] });
    }
    let overdueBy: Record<string, number> = {};
    if (enabled('collections')) {
      const rows = ageing(pid); overdueBy = Object.fromEntries(rows.map((r) => [r.partnerId, r.overdue]));
      const od = rows.reduce((a, r) => a + r.overdue, 0); const o90 = rows.filter((r) => r.buckets['90+'] > 0);
      money.push({ key: 'overdue', label: 'Overdue from partners', value: od, foot: `${rows.filter((r) => r.overdue > 0).length} partner(s) · ${inr(rows.reduce((a, r) => a + r.buckets['90+'], 0))} over 90 days`, path: '/collections', tone: od ? 'red' : 'green', lenses: ['all', 'finance', 'sales'] });
      exc({ key: 'o90', sev: 'critical', text: 'Partners with invoices over 90 days', detail: o90.map((r) => `${r.partnerName} ${inr(r.buckets['90+'])}`).slice(0, 3).join(' · '), count: o90.length, value: o90.reduce((a, r) => a + r.buckets['90+'], 0), owner: 'Finance', path: '/collections', lenses: ['all', 'finance', 'sales'] });
    }
    if (enabled('claims')) {
      const cl = claims(pid); const q = cl.filter((c) => c.status === 'Under review'); const settle = cl.filter((c) => ['Approved', 'Partly approved'].includes(c.status));
      const leak = cl.filter((c) => c.status !== 'Rejected').reduce((a, c) => a + Math.max(0, c.claimedAmount - c.computedAmount), 0);
      money.push({ key: 'claims', label: 'Scheme claims open', value: q.reduce((a, c) => a + c.claimedAmount, 0) + settle.reduce((a, c) => a + (c.approvedAmount ?? 0), 0), foot: `${q.length} to review · ${settle.length} to settle${leak ? ` · ${inr(leak)} claimed above verified` : ''}`, path: '/claims', tone: leak ? 'red' : 'amber', lenses: ['all', 'finance', 'channel'] });
      exc({ key: 'leak', sev: 'high', text: 'Claims above what secondary data verifies', detail: 'Pay only the verified part', count: cl.filter((c) => c.status === 'Under review' && c.claimedAmount > c.computedAmount).length, value: leak, owner: 'Channel / finance', path: '/claims', lenses: ['all', 'finance', 'channel'] });
    }
    if (enabled('recall')) {
      const act = recalls().filter((r) => r.principalId === pid && r.status === 'Active');
      exc({ key: 'recall', sev: 'critical', text: 'Active recalls', detail: act.map((r) => r.no ?? r.id).slice(0, 3).join(' · '), count: act.length, owner: 'Regulatory', path: '/recall?tab=recalls', lenses: ['all', 'quality', 'sales', 'channel'] });
    }
    if (enabled('returns')) {
      const rs = returns().filter((r) => r.principalId === pid);
      exc({ key: 'ret', sev: 'medium', text: 'Returns waiting for a decision', detail: 'Approve, inspect or credit', count: rs.filter((r) => ['Requested', 'Inspected'].includes(r.status)).length, owner: 'Order desk', path: '/returns', lenses: ['all', 'desk', 'quality'] });
    }
    // Partner licences expiring in 30 days.
    const lim30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const lic = channelPartners.flatMap((p) => p.kycDocuments.filter((k) => k.validUntil && k.validUntil <= lim30).map((k) => ({ p, k })));
    exc({ key: 'lic', sev: lic.some((x) => x.k.validUntil! < t) ? 'critical' : 'high', text: 'Partner licences expired or expiring in 30 days', detail: lic.map((x) => `${x.p.name} (${x.k.validUntil! < t ? 'expired' : x.k.validUntil})`).slice(0, 3).join(' · '), count: lic.length, owner: 'Regulatory', path: '/gtm-v2/partners', lenses: ['all', 'quality', 'sales', 'desk'] });

    if (enabled('tenders')) {
      const rem = tenderReminders(pid);
      const bids = rem.filter((r) => r.kind === 'Bid due'); const ren = rem.filter((r) => r.kind === 'Renewal'); const dep = rem.filter((r) => r.kind === 'EMD' || r.kind === 'Performance guarantee');
      exc({ key: 'bids', sev: bids.some((r) => r.overdue) ? 'critical' : 'high', text: 'Tender bids due within 7 days', detail: bids.map((r) => `${r.ref} ${r.text.split(' — ')[0]} (${r.date})`).slice(0, 2).join(' · '), count: bids.length, owner: 'Institutional sales', path: '/tenders', lenses: ['all', 'sales'] });
      exc({ key: 'renew', sev: ren.some((r) => r.overdue) ? 'high' : 'medium', text: 'Channel agreements expired or due for renewal', detail: ren.map((r) => `${r.text.split(' — ')[1]} (${r.overdue ? 'expired' : r.date})`).slice(0, 3).join(' · '), count: ren.length, owner: 'Channel manager', path: '/tenders?tab=agreements', lenses: ['all', 'channel', 'sales'] });
      exc({ key: 'deposit', sev: 'medium', text: 'Tender deposits and guarantees expiring', detail: dep.map((r) => `${r.ref} ${r.kind} (${r.date})`).slice(0, 2).join(' · '), count: dep.length, owner: 'Finance', path: '/tenders?tab=reminders', lenses: ['all', 'finance'] });
    }
    if (enabled('invoicing')) {
      const s = invSettings(); const iv = allInvoices(pid).filter((x) => x.status === 'Issued');
      const irn = iv.filter((x) => s.einvoice && x.buyer.gstin && !x.irn); const ewb = iv.filter((x) => x.total > s.ewayLimit && !x.ewayBill);
      exc({ key: 'irn', sev: 'high', text: 'Invoices without e-invoice IRN', detail: irn.map((x) => `${x.no} ${x.buyer.name}`).slice(0, 2).join(' · '), count: irn.length, value: irn.reduce((a, x) => a + x.total, 0), owner: 'Finance', path: '/invoices', lenses: ['all', 'finance', 'desk'] });
      exc({ key: 'ewb', sev: 'high', text: 'Shipments without the e-way bill they need', detail: ewb.map((x) => `${x.no} ${inr(x.total)}`).slice(0, 2).join(' · '), count: ewb.length, owner: 'Logistics', path: '/invoices', lenses: ['all', 'finance', 'supply', 'desk'] });
    }

    if (enabled('price-lists')) {
      const near = contractsNearLimit(pid);
      exc({ key: 'rc', sev: near.some((x) => x.pct >= 100) ? 'high' : 'medium', text: 'Rate contracts at 80% or more of the contracted quantity', detail: near.map((x) => `${x.l.name.slice(0, 40)} ${x.pct}%`).slice(0, 2).join(' · '), count: near.length, owner: 'Institutional sales', path: '/pricing?tab=contracts', lenses: ['all', 'sales', 'desk'] });
    }
    if (enabled('orders')) {
      const rs = routedSummary(pid);
      exc({ key: 'routed', sev: 'medium', text: 'Dealer orders routed to their distributors this month (demand you don’t invoice)', detail: rs.count ? `Across ${rs.suppliers} distributor(s) — see Orders → Routed to partners` : '', count: rs.count, value: rs.value, owner: 'Sales', path: '/orders?tab=routed', lenses: ['all', 'sales', 'channel'] });
    }

    /* ---------------- Partner watchlist ---------------- */
    const board = enabled('secondary') ? partnerBoard(pid, channelPartners.map((p) => p.id), unitValue) : [];
    const watch: Watch[] = channelPartners.map((p) => {
      const b = board.find((x) => x.partnerId === p.id); const flags: { text: string; tone: BadgeTone }[] = []; let score = 0;
      const so = stockouts.filter((s) => s.partnerId === p.id); if (so.length) { flags.push({ text: `${so.length} near stock-out`, tone: 'red' }); score += 30; }
      const od = overdueBy[p.id] ?? p.credit?.overdue ?? 0; if (od > 0) { flags.push({ text: `${inr(od)} overdue`, tone: 'red' }); score += 25; }
      if (p.credit?.hold) { flags.push({ text: 'Credit hold', tone: 'red' }); score += 20; }
      const l = lic.filter((x) => x.p.id === p.id); if (l.length) { flags.push({ text: l.some((x) => x.k.validUntil! < t) ? 'Licence expired' : 'Licence expiring', tone: l.some((x) => x.k.validUntil! < t) ? 'red' : 'amber' }); score += 15; }
      if (enabled('tenders')) { const ag = agreementFor(pid, p.id); if (ag && agreementState(ag) === 'Expired') { flags.push({ text: 'Agreement expired', tone: 'red' }); score += 12; } }
      if (b && !b.fresh && !b.estimated) { flags.push({ text: 'Not reporting', tone: 'amber' }); score += 10; }
      if (b?.estimated) { flags.push({ text: 'Not connected', tone: 'slate' }); score += 3; }
      if (b?.reconOk === false) { flags.push({ text: 'Numbers don’t reconcile', tone: 'amber' }); score += 8; }
      return { partnerId: p.id, name: p.name, flags, overdue: od, cover: coverBy[p.id] ?? null, dataAge: b?.age ?? null, fresh: !!b?.fresh, score };
    }).filter((w) => w.flags.length).sort((a, b) => b.score - a.score);

    /* ---------------- Trend: primary vs secondary by month ---------------- */
    const months = Array.from({ length: 6 }, (_, i) => { const x = new Date(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() - (5 - i)); return x.toISOString().slice(0, 7); });
    const trend = months.map((m) => {
      const primary = enabled('orders') ? orders().filter((o) => o.principalId === pid && o.createdAt.slice(0, 7) === m && !['Rejected', 'Cancelled'].includes(o.status)).reduce((a, o) => a + orderValue(o), 0) : 0;
      const last = new Map<string, number>(); secReports(pid).filter((r) => r.status === 'Accepted' && r.period === m).sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1)).forEach((r) => last.set(r.partnerId, r.sales.reduce((a, s) => a + s.value, 0)));
      return { month: m.slice(2).replace('-', '/'), primary: Math.round(primary), secondary: Math.round([...last.values()].reduce((a, v) => a + v, 0)) };
    });

    // Start from the first month that has any data (at least the last 3 months).
    const first = trend.findIndex((x) => x.primary || x.secondary);
    const trendShown = trend.slice(Math.max(0, Math.min(first === -1 ? 3 : first, 3)));
    const sevOrder = { critical: 0, high: 1, medium: 2 };
    ex.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev] || (b.value ?? 0) - (a.value ?? 0));
    return { money, nodes, ex, watch, trend: trendShown, stockouts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pid, partnersAll, products, warehouses]);

  const money = d.money.filter((m) => m.lenses.includes(lens) || lens === 'all');
  const exs = d.ex.filter((e) => lens === 'all' || e.lenses.includes(lens));
  const atRisk = money.filter((m) => m.tone !== 'green').reduce((a, m) => a + m.value, 0);
  const critical = exs.filter((e) => e.sev === 'critical').length;
  const SEV: Record<Exception['sev'], { tone: BadgeTone; label: string }> = { critical: { tone: 'red', label: 'Critical' }, high: { tone: 'amber', label: 'High' }, medium: { tone: 'slate', label: 'Medium' } };

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Control tower" description={<>{activePrincipal.name} — the whole chain from supplier to hospital, on one screen. Every number opens the records behind it.</>}
        actions={<Tabs active={view} onChange={(v) => setView(v as 'tower' | 'modules')} tabs={[{ id: 'tower', label: 'Control tower', icon: <Radar size={14} /> }, { id: 'modules', label: 'By module', icon: <LayoutGrid size={14} /> }]} />} />
      {view === 'modules' ? <HomeDashboard embedded /> : (
        <div className="g2-stack" style={{ gap: 16 }}>
          <div className="g2-row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="g2-small g2-muted">View as</span>
            <Segmented options={LENSES.map((l) => ({ id: l.id, label: l.label }))} value={lens} onChange={(v) => setLens(v as Lens)} />
            <span className="g2-spacer" />
            {critical > 0 && <Badge tone="red" dot>{critical} critical</Badge>}
            <span className="g2-small g2-muted"><Clock size={12} style={{ verticalAlign: -2 }} /> Live as of {new Date().toTimeString().slice(0, 5)}</span>
          </div>

          {/* Where money is stuck */}
          <Card title={<span className="g2-row" style={{ gap: 8 }}><IndianRupee size={16} /> Where money is stuck <Badge tone={atRisk ? 'red' : 'green'}>{inr(atRisk)}</Badge></span>} subtitle="Value held up right now — click any figure for the records">
            {money.length === 0 ? <div className="g2-small g2-muted">Nothing stuck for this view.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                {money.map((m) => (
                  <button key={m.key} type="button" onClick={() => navigate(m.path)} className="ct-money" style={{ borderLeft: `4px solid ${m.tone === 'red' ? '#dc2626' : m.tone === 'amber' ? '#d97706' : '#059669'}` }}>
                    <div className="g2-small g2-muted">{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.tone === 'red' ? '#b91c1c' : m.tone === 'amber' ? '#b45309' : '#047857' }}>{inr(m.value)}</div>
                    {m.units && <div className="g2-small" style={{ fontWeight: 600 }}>{m.units}</div>}
                    <div className="g2-small g2-muted" style={{ marginTop: 2 }}>{m.foot}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Supply chain flow */}
          <Card title={<span className="g2-row" style={{ gap: 8 }}><Boxes size={16} /> Supply chain, end to end</span>} subtitle="Green — flowing · amber — watch · red — act now. Click a stage to open it.">
            <div className="ct-flow">
              {d.nodes.map((n, i) => (
                <React.Fragment key={n.key}>
                  {i > 0 && <div className="ct-arrow"><ChevronRight size={18} /></div>}
                  <div role="button" tabIndex={0} className="ct-node" onClick={() => navigate(n.path)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(n.path); }} style={{ background: HEALTH[n.health].bg, borderColor: HEALTH[n.health].b }}>
                    <div className="g2-row" style={{ gap: 6, color: HEALTH[n.health].c }}>{n.icon}<strong style={{ fontSize: 13 }}>{n.title}</strong><span className="ct-dot" style={{ background: HEALTH[n.health].c }} /></div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6, lineHeight: 1.3 }}>{n.main}</div>
                    {n.lines.map((l, k) => <div key={k} className="g2-small" style={{ color: l.tone === 'red' ? '#b91c1c' : l.tone === 'amber' ? '#b45309' : l.tone === 'blue' ? '#1d4ed8' : '#4b5563', fontWeight: l.tone ? 600 : undefined }}>{l.text}</div>)}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
            {/* Exceptions */}
            <Card title={<span className="g2-row" style={{ gap: 8 }}><AlertOctagon size={16} /> Exceptions</span>} subtitle={exs.length ? `${exs.length} open · worst first` : 'All clear for this view'} flush>
              {exs.length === 0 && <div className="g2-small g2-muted" style={{ padding: 16 }}>Nothing needs action.</div>}
              <div>
                {exs.map((e) => (
                  <div key={e.key} className="ct-ex" onClick={() => navigate(e.path)}>
                    <Badge tone={SEV[e.sev].tone}>{SEV[e.sev].label}</Badge>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e.count} · {e.text}{e.value ? <span style={{ color: '#b91c1c', fontWeight: 600 }}> · {inr(e.value)}</span> : null}</div>
                      {e.detail && <div className="g2-small g2-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detail}</div>}
                    </div>
                    <span className="g2-small g2-muted" style={{ whiteSpace: 'nowrap' }}>{e.owner}</span>
                    <ArrowRight size={14} className="g2-muted" />
                  </div>
                ))}
              </div>
            </Card>

            {/* Partner watchlist */}
            <Card title={<span className="g2-row" style={{ gap: 8 }}><Building2 size={16} /> Partners needing action</span>} subtitle="Stock-out risk, overdue money, licences, reporting" flush>
              {d.watch.length === 0 && <div className="g2-small g2-muted" style={{ padding: 16 }}>Every partner is in good shape.</div>}
              <div className="g2-table-wrap"><table className="g2-table">
                <thead><tr><th>Partner</th><th>Why</th><th style={{ textAlign: 'right' }}>Cover</th><th style={{ textAlign: 'right' }}>Data</th></tr></thead>
                <tbody>{d.watch.slice(0, 8).map((w) => (
                  <tr key={w.partnerId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/secondary?partner=${w.partnerId}`)}>
                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                    <td><div className="g2-row" style={{ gap: 4, flexWrap: 'wrap' }}>{w.flags.map((f) => <Badge key={f.text} tone={f.tone}>{f.text}</Badge>)}</div></td>
                    <td style={{ textAlign: 'right', color: w.cover !== null && w.cover < 14 ? '#b91c1c' : undefined, fontWeight: w.cover !== null && w.cover < 14 ? 700 : undefined }}>{w.cover === null ? '—' : `${w.cover} d`}</td>
                    <td style={{ textAlign: 'right' }} className="g2-small">{w.dataAge === null ? <span className="g2-muted">none</span> : <span style={{ color: w.fresh ? '#047857' : '#b45309' }}>{w.dataAge === 0 ? 'today' : `${w.dataAge} d`}</span>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Card>
          </div>

          {/* Trend */}
          {(enabled('orders') || enabled('secondary')) && (
            <Card title="Sell-in vs sell-out by month" subtitle="Primary = your orders to partners. Secondary = partners’ reported sales to hospitals and customers. A widening gap means stock piling up in the channel.">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={d.trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} fontSize={12} />
                    <YAxis tickFormatter={(v: number) => inr(v)} width={70} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => inr(Number(v))} />
                    <Legend />
                    {enabled('orders') && <Bar dataKey="primary" name="Primary (sell-in)" fill="#6d28d9" radius={[4, 4, 0, 0]} />}
                    {enabled('secondary') && <Line dataKey="secondary" name="Secondary (sell-out)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}
      <style>{`
        .ct-money{all:unset;cursor:pointer;display:flex;flex-direction:column;justify-content:flex-start;box-sizing:border-box;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;transition:box-shadow .15s}
        .ct-money:hover{box-shadow:0 2px 10px rgba(0,0,0,.07)}
        .ct-flow{display:flex;align-items:stretch;gap:4px;overflow-x:auto;padding-bottom:4px}
        .ct-node{position:relative;cursor:pointer;display:block;padding-right:22px !important;flex:1 1 0;min-width:128px;border:1px solid;border-radius:10px;padding:10px 12px;box-sizing:border-box;transition:transform .12s;text-align:left;vertical-align:top}
        .ct-node:hover{transform:translateY(-2px)}
        .ct-arrow{display:flex;align-items:center;color:#9ca3af;flex:0 0 auto}
        .ct-dot{position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%}
        .ct-ex{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #f1f2f4;cursor:pointer}
        .ct-ex:hover{background:#fafafa}
        @media (max-width: 900px){ .ct-flow{flex-direction:column} .ct-arrow{transform:rotate(90deg);justify-content:center} }
      `}</style>
    </div>
  );
};
export default ControlTower;
