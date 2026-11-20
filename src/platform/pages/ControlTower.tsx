/**
 * Control tower (AN1): one screen over the whole supply chain — supplier → port → QC → own warehouse → transit →
 * channel partners → hospitals and customers. Opens on where money is stuck and what needs action, filtered by the
 * viewer's role lens. Every number opens the records behind it; every number from an outside source shows its age.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Boxes, Building2, ChevronRight, ClipboardList, Clock, Factory, FileWarning, Gavel, Hospital, IndianRupee, Megaphone, PackageX, Radar, Receipt, Ship, ShieldCheck, Truck, TrendingUp, Users, Warehouse } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, KpiCard, PageHeader, Segmented } from '../ui';
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
import type { PartnerSuggest } from '../../modules/replenishment/replenishmentStore';
import type { SecondaryReport as SecReport } from '../../modules/secondary/secondaryStore';
import { claimSchemes, spentOf } from '../../modules/claims/claimsStore';
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

/** Indian states → sales zone (for the primary-vs-secondary-by-zone chart). */
const ZONES = ['North', 'West', 'South', 'East', 'Central', 'North-East', 'Other'];
const ZONE: Record<string, string> = Object.fromEntries([
  ...['Delhi', 'Haryana', 'Punjab', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jammu & Kashmir', 'Ladakh', 'Uttarakhand', 'Uttar Pradesh', 'Chandigarh', 'Rajasthan'].map((x) => [x, 'North']),
  ...['Maharashtra', 'Gujarat', 'Goa', 'Dadra and Nagar Haveli and Daman and Diu'].map((x) => [x, 'West']),
  ...['Telangana', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Puducherry', 'Lakshadweep', 'Andaman and Nicobar Islands'].map((x) => [x, 'South']),
  ...['West Bengal', 'Odisha', 'Bihar', 'Jharkhand'].map((x) => [x, 'East']),
  ...['Madhya Pradesh', 'Chhattisgarh'].map((x) => [x, 'Central']),
  ...['Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura', 'Arunachal Pradesh', 'Sikkim'].map((x) => [x, 'North-East']),
]);
const CLAIM_SLA_DAYS = 7;
const BRAND_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#94a3b8'];
type Tint = 'red' | 'amber' | 'purple' | 'blue' | 'teal' | 'green';
const TINT: Record<Tint, { bg: string; c: string }> = {
  red: { bg: '#fdecee', c: '#dc3545' }, amber: { bg: '#fff5e0', c: '#c77700' }, purple: { bg: '#f1ebfd', c: '#7c3aed' },
  blue: { bg: '#eaf1ff', c: '#2563eb' }, teal: { bg: '#e3f6f3', c: '#0f8f7e' }, green: { bg: '#e7f7ee', c: '#15803d' },
};
interface TRow { main: string; sub?: string; pill?: string; tone?: BadgeTone; pct?: number; plain?: boolean; path?: string; lenses?: Lens[] }
interface TCard { key: string; title: string; tint: Tint; icon: React.ReactNode; count: number; path: string; lenses: Lens[]; rows: TRow[] }
/** Exceptions without a dedicated card are grouped into these. */
const GROUPS: { key: string; title: string; tint: Tint; icon: React.ReactNode; keys: string[] }[] = [
  { key: 'g-supply', title: 'Supply & quality', tint: 'teal', icon: <Factory size={16} />, keys: ['po-late', 'po-appr', 'prod-q', 'imp-docs', 'imp-port', 'qc-todo', 'qc-rel', 'qc-hold', 'erp-stale', 'ship-late', 'back', 'ret'] },
  { key: 'g-comp', title: 'Compliance & documents', tint: 'red', icon: <FileWarning size={16} />, keys: ['recall', 'lic', 'irn', 'ewb'] },
  { key: 'g-data', title: 'Channel data & claims', tint: 'purple', icon: <BarChart3 size={16} />, keys: ['sec-stale', 'sec-review', 'leak', 'loaner'] },
  { key: 'g-inst', title: 'Tenders & contracts', tint: 'blue', icon: <Gavel size={16} />, keys: ['bids', 'renew', 'deposit', 'rc', 'routed'] },
];
const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

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
    let stockouts: { partnerId: string; name: string; productId: string; product: string; cover: number | null; perMonth: number }[] = [];
    let sgAll: PartnerSuggest[] = [];
    const coverBy: Record<string, number | null> = {};
    if (enabled('replenishment') || enabled('secondary')) {
      const sg = suggest(pid, channelPartners.map((p) => ({ id: p.id, name: p.name, partnerTypeId: p.partnerTypeId })), products); sgAll = sg;
      sg.filter((s) => s.ok).forEach((s) => {
        const covers = s.rows.filter((r) => r.avgDaily > 0).map((r) => r.coverNow ?? 0);
        coverBy[s.partnerId] = covers.length ? Math.min(...covers) : null;
        s.rows.filter((r) => r.avgDaily > 0 && (r.coverNow ?? 0) < Math.min(14, r.targetDays / 3)).forEach((r) => stockouts.push({ partnerId: s.partnerId, name: s.partnerName, productId: r.productId, product: r.name, cover: r.coverNow, perMonth: r.avgDaily * 30 * sellValue(r.productId) }));
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

    /* ---------------- Channel view: sell-out, zones, exception cards ---------------- */
    const from30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const prod = (id: string) => products.find((p) => p.id === id);
    const codeOf = (id: string) => prod(id)?.name || prod(id)?.code || id;
    const partnerOf = (id: string) => partnersAll.find((p) => p.id === id);
    const zoneOf = (id: string) => ZONE[partnerOf(id)?.address?.state ?? ''] ?? 'Other';
    const latestRep = new Map<string, SecReport>();
    if (enabled('secondary')) secReports(pid).filter((r) => r.status === 'Accepted').sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1)).forEach((r) => latestRep.set(`${r.partnerId}|${r.period}`, r));
    const sales30 = [...latestRep.values()].flatMap((r) => r.sales.map((x) => ({ ...x, partnerId: r.partnerId }))).filter((x) => x.date >= from30 && x.date <= t);
    const sources = [...new Set([...latestRep.values()].map((r) => r.system).filter(Boolean))];
    const brandTot = new Map<string, number>(); sales30.forEach((x) => { const b = prod(x.productId)?.brand || 'Other'; brandTot.set(b, (brandTot.get(b) ?? 0) + x.value); });
    const topBrands = [...brandTot.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
    const brands = topBrands.length > 4 ? [...topBrands.slice(0, 4), 'Other brands'] : topBrands;
    const brandKey = (pidx: string) => { const b = prod(pidx)?.brand || 'Other'; return brands.includes(b) ? b : 'Other brands'; };
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
    const byBrand = days.map((day) => { const row: Record<string, number | string> = { day: day.slice(5) }; brands.forEach((b) => { row[b] = 0; }); sales30.filter((x) => x.date === day).forEach((x) => { const k = brandKey(x.productId); row[k] = (row[k] as number) + x.value; }); return row; });
    const months6 = Array.from({ length: 6 }, (_, i) => { const x = new Date(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() - (5 - i)); return x.toISOString().slice(0, 7); });
    const salesAll = [...latestRep.values()].flatMap((r) => r.sales.map((x) => ({ ...x, partnerId: r.partnerId })));
    const brandsM = (() => { const tot = new Map<string, number>(); salesAll.forEach((x) => { const b = prod(x.productId)?.brand || 'Other'; tot.set(b, (tot.get(b) ?? 0) + x.value); }); const tb = [...tot.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b); return tb.length > 4 ? [...tb.slice(0, 4), 'Other brands'] : tb; })();
    const byBrandM = months6.map((m) => { const row: Record<string, number | string> = { day: m.slice(2).replace('-', '/') }; brandsM.forEach((b) => { row[b] = 0; }); salesAll.filter((x) => x.date.slice(0, 7) === m).forEach((x) => { const b = prod(x.productId)?.brand || 'Other'; const k2 = brandsM.includes(b) ? b : 'Other brands'; row[k2] = (row[k2] as number) + x.value; }); return row; });
    const firstM = byBrandM.findIndex((r) => brandsM.some((b) => (r[b] as number) > 0)); const byBrandMS = byBrandM.slice(Math.max(0, Math.min(firstM === -1 ? 3 : firstM, 3)));
    const dailySpread = new Set(sales30.map((x) => x.date)).size >= 10;
    const zones = new Map<string, { zone: string; primary: number; secondary: number }>();
    const zrow = (z: string) => zones.get(z) ?? zones.set(z, { zone: z, primary: 0, secondary: 0 }).get(z)!;
    if (enabled('orders')) orders().filter((o) => o.principalId === pid && o.createdAt.slice(0, 10) >= from30 && !['Rejected', 'Cancelled'].includes(o.status)).forEach((o) => { zrow(zoneOf(o.partnerId)).primary += orderValue(o); });
    sales30.forEach((x) => { zrow(zoneOf(x.partnerId)).secondary += x.value; });
    const byZone = [...zones.values()].filter((z) => z.primary || z.secondary).sort((a, b) => ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone)).map((z) => ({ ...z, primary: Math.round(z.primary), secondary: Math.round(z.secondary) }));

    const chStock = bal.filter((b) => b.locType === 'CNF' || b.locType === 'PARTNER');
    const locName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? pName(id);
    const excess = sgAll.flatMap((g) => g.rows.filter((r) => r.stock > 0 && (r.avgDaily > 0 ? (r.coverNow ?? 0) > Math.max(60, r.targetDays * 2) : true)).map((r) => ({ g, r, value: r.stock * unitValue(r.productId) })))
      .sort((a, b) => (b.r.coverNow ?? 999) - (a.r.coverNow ?? 999) || b.value - a.value);
    const chExpiry = chStock.filter((b) => b.expiryDate && b.expiryDate <= lim90).sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1));
    const schemes = enabled('claims') ? claimSchemes(pid).filter((x) => x.status === 'Active' && x.budget > 0).map((x) => { const spent = spentOf(x.id); return { x, spent, pct: Math.round((spent / x.budget) * 100) }; }) : [];
    const age = (h: { at: string }[]) => (h.length ? Math.floor((Date.now() - Date.parse(h[0].at)) / 86400000) : 0);
    const openClaims = enabled('claims') ? claims(pid).filter((c) => ['Under review', 'Approved', 'Partly approved'].includes(c.status)) : [];
    const pastSla = openClaims.filter((c) => c.status === 'Under review' && age(c.history) > CLAIM_SLA_DAYS).sort((a, b) => age(b.history) - age(a.history));
    const odRows = enabled('collections') ? ageing(pid).filter((r) => r.overdue > 0).sort((a, b) => b.overdue - a.overdue) : [];
    const actOrders = enabled('orders') ? orders().filter((o) => o.principalId === pid && ['Awaiting approval', 'On hold', 'Awaiting partner'].includes(o.status)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) : [];
    const schemeName = (id: string) => (enabled('claims') ? claimSchemes(pid).find((x) => x.id === id)?.name : '') ?? '';

    const cards: TCard[] = [];
    const card = (c: TCard) => { if (c.count > 0) cards.push(c); };
    card({ key: 'stockout', title: 'Stock-out risk', tint: 'red', icon: <PackageX size={16} />, count: stockouts.length, path: enabled('replenishment') ? '/replenishment' : '/secondary', lenses: ['all', 'sales', 'channel'],
      rows: stockouts.map((x) => ({ main: codeOf(x.productId), sub: x.name, pill: `${x.cover ?? 0} days`, tone: 'red' as BadgeTone })) });
    card({ key: 'overdue', title: 'Overdue dues', tint: 'red', icon: <IndianRupee size={16} />, count: odRows.length, path: '/collections', lenses: ['all', 'finance', 'sales'],
      rows: odRows.map((r) => ({ main: r.partnerName, sub: `${zoneOf(r.partnerId) === 'Other' ? '' : `${partnerOf(r.partnerId)?.address?.city ?? ''} · `}oldest ${r.oldestDays} days${r.buckets['90+'] ? ` · ${inr(r.buckets['90+'])} over 90` : ''}`, pill: inr(r.overdue), tone: 'red' as BadgeTone, plain: true })) });
    card({ key: 'orders', title: 'Orders awaiting action', tint: 'blue', icon: <ClipboardList size={16} />, count: actOrders.length, path: '/orders', lenses: ['all', 'desk', 'sales', 'finance'],
      rows: actOrders.map((o) => ({ main: o.code, sub: `${o.partnerName} · ${inr(orderValue(o))}`, pill: o.status === 'Awaiting approval' ? 'Pending approval' : o.status === 'Awaiting partner' ? 'Waiting for partner' : o.status, tone: (o.status === 'On hold' ? 'red' : 'amber') as BadgeTone })) });
    card({ key: 'claims', title: 'Claims past SLA', tint: 'purple', icon: <Receipt size={16} />, count: pastSla.length, path: '/claims', lenses: ['all', 'finance', 'channel'],
      rows: pastSla.map((c) => ({ main: `${c.no} · ${c.kind && c.kind !== 'Scheme' ? c.kind : (schemeName(c.schemeId) || 'Scheme').split(' — ')[0]}`, sub: `${c.partnerName} · ${inr(c.claimedAmount)}`, pill: `${age(c.history)}d old`, tone: 'red' as BadgeTone })) });
    card({ key: 'schemes', title: 'Schemes near / over budget', tint: 'amber', icon: <Megaphone size={16} />, count: schemes.filter((x) => x.pct >= 80).length, path: '/claims?tab=schemes', lenses: ['all', 'finance', 'channel'],
      rows: schemes.filter((x) => x.pct >= 80).sort((a, b) => b.pct - a.pct).map((x) => ({ main: x.x.name.split(' — ')[0], pct: x.pct, pill: `${x.pct}%`, tone: (x.pct >= 100 ? 'red' : 'amber') as BadgeTone })) });
    card({ key: 'excess', title: 'Excess stock', tint: 'amber', icon: <Boxes size={16} />, count: excess.length, path: '/secondary', lenses: ['all', 'channel', 'sales'],
      rows: excess.map((x) => ({ main: codeOf(x.r.productId), sub: `${x.g.partnerName} · ${inr(x.value)}`, pill: x.r.avgDaily > 0 ? `${x.r.coverNow} days` : 'No sales', tone: 'amber' as BadgeTone })) });
    card({ key: 'expiry', title: 'Expiring in channel ≤ 90 days', tint: 'amber', icon: <Clock size={16} />, count: chExpiry.length, path: '/inventory?tab=expiry', lenses: ['all', 'channel', 'sales', 'quality'],
      rows: chExpiry.map((b) => ({ main: codeOf(b.productId), sub: `${locName(b.warehouseId)} · ${b.qty} units · ${inr(b.qty * unitValue(b.productId))}`, pill: `${Math.max(0, Math.ceil((Date.parse(b.expiryDate!) - Date.now()) / 86400000))} d left`, tone: (b.expiryDate! < t ? 'red' : 'amber') as BadgeTone })) });
    const COVERED = new Set(['stockout', 'ch-exp', 'hold', 'appr', 'part', 'o90']);
    GROUPS.forEach((g) => {
      const items = ex.filter((e) => g.keys.includes(e.key) && !COVERED.has(e.key));
      const sevT: Record<Exception['sev'], BadgeTone> = { critical: 'red', high: 'amber', medium: 'slate' };
      card({ key: g.key, title: g.title, tint: g.tint, icon: g.icon, count: items.reduce((a, e) => a + e.count, 0), path: items[0]?.path ?? '/', lenses: [...new Set(items.flatMap((e) => e.lenses))],
        rows: items.map((e) => ({ main: e.text, sub: e.detail || e.owner, pill: `${e.count}${e.value ? ` · ${inr(e.value)}` : ''}`, tone: sevT[e.sev], path: e.path, lenses: e.lenses })) });
    });
    const sell30 = sales30.reduce((a, x) => a + x.value, 0);
    const kpi = {
      sell30, units30: sales30.reduce((a, x) => a + x.qty, 0), outlets30: new Set(sales30.map((x) => `${x.partnerId}|${x.customer}`)).size,
      chVal: chStock.reduce((a, b) => a + b.qty * unitValue(b.productId), 0), positions: new Set(chStock.map((b) => `${b.warehouseId}|${b.productId}`)).size,
      overdue: odRows.reduce((a, r) => a + r.overdue, 0), overdueN: odRows.length,
      claimsVal: openClaims.reduce((a, c) => a + (c.status === 'Under review' ? c.claimedAmount : c.approvedAmount ?? 0), 0), claimsN: openClaims.length, pastSla: pastSla.length,
      spend: schemes.reduce((a, x) => a + x.spent, 0), budget: schemes.reduce((a, x) => a + x.x.budget, 0),
      ownVal: bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Available').reduce((a, b) => a + b.qty * unitValue(b.productId), 0),
      ownUnits: bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Available').reduce((a, b) => a + b.qty, 0),
      poVal: enabled('procurement') ? procPos(pid).filter((x) => ['Sent', 'Acknowledged', 'Part received', 'Approved'].includes(x.status)).reduce((a, x) => a + poValue(x), 0) : 0,
      poN: enabled('procurement') ? procPos(pid).filter((x) => ['Sent', 'Acknowledged', 'Part received', 'Approved'].includes(x.status)).length : 0,
      transitN: allShipments().filter((x) => x.order.principalId === pid && !x.shipment.deliveredAt).length,
      qcVal: bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Quarantine').reduce((a, b) => a + b.qty * unitValue(b.productId), 0),
      qcUnits: bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Quarantine').reduce((a, b) => a + b.qty, 0),
      blocked: bal.filter((b) => b.locType === 'COMPANY' && b.status === 'Blocked').reduce((a, b) => a + b.qty, 0),
      review: actOrders.filter((o) => o.status !== 'Awaiting partner').length, partners: channelPartners.length,
    };
    const sevOrder = { critical: 0, high: 1, medium: 2 };
    ex.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev] || (b.value ?? 0) - (a.value ?? 0));
    return { money, nodes, ex, watch, trend: trendShown, stockouts, byBrand: dailySpread ? byBrand : byBrandMS, brands: dailySpread ? brands : brandsM, daily: dailySpread, byZone, cards, kpi, sources };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pid, partnersAll, products, warehouses]);

  const k = d.kpi;
  const KPIS: { key: string; label: string; value: string; foot: string; icon: React.ReactNode; color: string; bg: string; path: string; lenses: Lens[]; show: boolean }[] = [
    { key: 'sell', label: 'Sales in channel (30d)', value: inr(k.sell30), foot: `Secondary sell-out · ${k.units30.toLocaleString('en-IN')} units · ${k.outlets30} outlets`, icon: <TrendingUp size={22} />, color: '#2563eb', bg: '#eaf1ff', path: '/secondary', lenses: ['all', 'sales', 'channel'], show: enabled('secondary') },
    { key: 'stock', label: 'Channel stock value', value: inr(k.chVal), foot: `${k.positions} product-partner positions`, icon: <Boxes size={22} />, color: '#0f8f7e', bg: '#e3f6f3', path: '/inventory', lenses: ['all', 'channel', 'sales', 'supply'], show: enabled('secondary') || enabled('inventory') },
    { key: 'od', label: 'Overdue dues', value: inr(k.overdue), foot: `${k.overdueN} partner${k.overdueN === 1 ? '' : 's'} overdue`, icon: <IndianRupee size={22} />, color: '#dc3545', bg: '#fdecee', path: '/collections', lenses: ['all', 'finance', 'sales'], show: enabled('collections') },
    { key: 'claims', label: 'Open claims', value: inr(k.claimsVal), foot: `${k.claimsN} claim${k.claimsN === 1 ? '' : 's'} · ${k.pastSla} past SLA`, icon: <Receipt size={22} />, color: '#7c3aed', bg: '#f1ebfd', path: '/claims', lenses: ['all', 'finance', 'channel'], show: enabled('claims') },
    { key: 'spend', label: 'Scheme spend', value: inr(k.spend), foot: `of ${inr(k.budget)} live budget`, icon: <Megaphone size={22} />, color: '#c77700', bg: '#fff5e0', path: '/claims?tab=schemes', lenses: ['all', 'channel', 'finance'], show: enabled('claims') },
    { key: 'own', label: 'Stock in own warehouses', value: inr(k.ownVal), foot: `${k.ownUnits.toLocaleString('en-IN')} units available to sell`, icon: <Warehouse size={22} />, color: '#0f8f7e', bg: '#e3f6f3', path: '/inventory', lenses: ['supply', 'desk'], show: enabled('inventory') },
    { key: 'po', label: 'On order from suppliers', value: inr(k.poVal), foot: `${k.poN} open purchase order${k.poN === 1 ? '' : 's'}`, icon: <Factory size={22} />, color: '#2563eb', bg: '#eaf1ff', path: '/procurement', lenses: ['supply', 'finance'], show: enabled('procurement') },
    { key: 'qc', label: 'Waiting for QC', value: inr(k.qcVal), foot: `${k.qcUnits} units in Quarantine · ${k.blocked} blocked`, icon: <ShieldCheck size={22} />, color: '#c77700', bg: '#fff5e0', path: enabled('qc') ? '/qc' : '/inventory', lenses: ['supply', 'quality'], show: enabled('inventory') },
    { key: 'transit', label: 'Shipments in transit', value: String(k.transitN), foot: 'Not yet delivered to partners', icon: <Truck size={22} />, color: '#7c3aed', bg: '#f1ebfd', path: enabled('logistics') ? '/logistics?tab=transit' : '/orders', lenses: ['supply', 'desk'], show: enabled('orders') },
    ...d.money.filter((m) => !['overdue', 'claims', 'stockout', 'quarantine'].includes(m.key)).map((m) => ({ key: m.key, label: m.label, value: inr(m.value), foot: m.units ? `${m.units} · ${m.foot}` : m.foot, icon: <IndianRupee size={22} />, color: m.tone === 'red' ? '#dc3545' : m.tone === 'amber' ? '#c77700' : '#15803d', bg: m.tone === 'red' ? '#fdecee' : m.tone === 'amber' ? '#fff5e0' : '#e7f7ee', path: m.path, lenses: m.lenses.filter((l) => l !== 'all'), show: true })),
  ];
  const kpis = KPIS.filter((x) => x.show && (x.lenses.includes(lens))).slice(0, 5);
  const cards = d.cards.filter((c) => lens === 'all' || c.lenses.includes(lens)).map((c) => ({ ...c, rows: c.rows.filter((r) => !r.lenses || lens === 'all' || r.lenses.includes(lens)) })).filter((c) => c.rows.length);
  const fmtAxis = (v: number) => (v >= 10000000 ? `₹${(v / 10000000).toFixed(1)} Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(1)} L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`);
  const hasDaily = d.byBrand.some((r) => d.brands.some((b) => (r[b] as number) > 0));
  const brandTitle = d.daily ? 'Secondary sell-out by brand — last 30 days' : 'Secondary sell-out by brand — by month';

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Control tower"
        description={<>Live view of your channel across {k.partners} partner{k.partners === 1 ? '' : 's'}. Updated {ddmmyyyy(new Date())} from {[...new Set(['VinFlux', ...d.sources])].join(', ').replace(/, ([^,]*)$/, ' and $1')} feeds.</>}
        actions={<>
          {enabled('performance') && <Button onClick={() => navigate('/performance')}>Scorecards</Button>}
          {enabled('orders') && <Button variant="primary" onClick={() => navigate('/approvals')}>Review orders ({k.review})</Button>}
        </>} />
      <div className="g2-row ct-lens" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="g2-small g2-muted">View as</span>
        <Segmented options={LENSES.map((l) => ({ id: l.id, label: l.label }))} value={lens} onChange={(v) => setLens(v as Lens)} />
        <span className="g2-spacer" />
        <Segmented options={[{ id: 'tower', label: 'Control tower' }, { id: 'modules', label: 'By module' }]} value={view} onChange={(v) => setView(v as 'tower' | 'modules')} />
      </div>
      {view === 'modules' ? <HomeDashboard embedded /> : (
        <div className="g2-stack" style={{ gap: 16 }}>
          {/* KPI row */}
          <div className="ct-kpis">
            {kpis.map((x) => <KpiCard key={x.key} label={x.label} value={x.value} foot={x.foot} icon={x.icon} color={x.color} bg={x.bg} onClick={() => navigate(x.path)} />)}
          </div>

          {/* Charts */}
          {(enabled('secondary') || enabled('orders')) && (
            <div className="ct-charts">
              <Card title={hasDaily ? brandTitle : 'Sell-in vs sell-out by month'} subtitle={hasDaily ? undefined : 'No dated partner sales in the last 30 days yet — showing the monthly trend'}>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {hasDaily && !d.daily ? (
                      <BarChart data={d.byBrand} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#eef1f6" vertical={false} />
                        <XAxis dataKey="day" tickLine={false} fontSize={11} />
                        <YAxis tickFormatter={fmtAxis} width={64} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => inr(Number(v))} />
                        <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                        {d.brands.map((b, i) => <Bar key={b} dataKey={b} stackId="1" fill={BRAND_COLORS[i % 5]} maxBarSize={56} radius={i === d.brands.length - 1 ? [3, 3, 0, 0] : undefined} />)}
                      </BarChart>
                    ) : hasDaily ? (
                      <AreaChart data={d.byBrand} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#eef1f6" vertical={false} />
                        <XAxis dataKey="day" tickLine={false} fontSize={11} interval={d.daily ? 4 : 0} />
                        <YAxis tickFormatter={fmtAxis} width={64} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => inr(Number(v))} />
                        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                        {d.brands.map((b, i) => <Area key={b} type="monotone" dataKey={b} stackId="1" stroke={BRAND_COLORS[i % 5]} fill={BRAND_COLORS[i % 5]} fillOpacity={0.18} strokeWidth={1.8} />)}
                      </AreaChart>
                    ) : (
                      <ComposedChart data={d.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#eef1f6" vertical={false} />
                        <XAxis dataKey="month" tickLine={false} fontSize={11} />
                        <YAxis tickFormatter={fmtAxis} width={64} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => inr(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {enabled('orders') && <Bar dataKey="primary" name="Primary (sell-in)" fill="#1e3a8a" radius={[3, 3, 0, 0]} />}
                        {enabled('secondary') && <Line dataKey="secondary" name="Secondary (sell-out)" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />}
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Primary vs secondary by zone" subtitle="Last 30 days">
                <div style={{ height: 250 }}>
                  {d.byZone.length === 0 ? <div className="g2-small g2-muted">No orders or partner sales in the last 30 days.</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d.byZone} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#eef1f6" vertical={false} />
                        <XAxis dataKey="zone" tickLine={false} fontSize={11} />
                        <YAxis tickFormatter={fmtAxis} width={60} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => inr(Number(v))} />
                        <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="primary" name="Primary" fill="#0f1a33" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="secondary" name="Secondary" fill="#2563eb" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Exception cards */}
          {cards.length === 0 ? <Card><div className="g2-small g2-muted">Nothing needs action for this view.</div></Card> : (
            <div className="ct-cards">
              {cards.map((c) => (
                <div key={c.key} className="ct-card">
                  <div className="ct-card-h" style={{ backgroundImage: `linear-gradient(90deg, ${TINT[c.tint].bg}, #fff)` }}>
                    <span style={{ color: TINT[c.tint].c, display: 'flex' }}>{c.icon}</span>
                    <h3>{c.title}</h3>
                    <span className="ct-pill" style={{ background: TINT[c.tint].bg, color: TINT[c.tint].c }}>{c.count}</span>
                    <span className="g2-spacer" />
                    <button type="button" className="ct-open" onClick={() => navigate(c.path)}>Open <ArrowRight size={13} /></button>
                  </div>
                  {c.rows.slice(0, 3).map((r, i) => (
                    <div key={i} className="ct-row" onClick={() => navigate(r.path ?? c.path)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ct-main">{r.main}</div>
                        {r.pct !== undefined ? <div className="ct-bar"><div style={{ width: `${Math.min(100, r.pct)}%`, background: r.pct >= 100 ? '#dc3545' : '#f59e0b' }} /></div>
                          : r.sub && <div className="ct-sub">{r.sub}</div>}
                      </div>
                      {r.pill && (r.plain ? <span className="ct-amt" style={{ color: '#dc3545' }}>{r.pill}</span> : <span className={`ct-pill ct-${r.tone ?? 'slate'}`}>{r.pill}</span>)}
                    </div>
                  ))}
                  {c.rows.length > 3 && <div className="ct-more" onClick={() => navigate(c.path)}>+{c.rows.length - 3} more</div>}
                </div>
              ))}
            </div>
          )}

          {/* Supply chain flow */}
          <Card title={<span className="g2-row" style={{ gap: 8 }}><Radar size={16} /> Supply chain, end to end</span>} subtitle="Green — flowing · amber — watch · red — act now. Click a stage to open it.">
            <div className="ct-flow">
              {d.nodes.map((n, i) => (
                <React.Fragment key={n.key}>
                  {i > 0 && <div className="ct-arrow"><ChevronRight size={18} /></div>}
                  <div role="button" tabIndex={0} className="ct-node" onClick={() => navigate(n.path)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(n.path); }} style={{ background: HEALTH[n.health].bg, borderColor: HEALTH[n.health].b }}>
                    <div className="g2-row" style={{ gap: 6, color: HEALTH[n.health].c }}>{n.icon}<strong style={{ fontSize: 13 }}>{n.title}</strong><span className="ct-dot" style={{ background: HEALTH[n.health].c }} /></div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6, lineHeight: 1.3 }}>{n.main}</div>
                    {n.lines.map((l, j) => <div key={j} className="g2-small" style={{ color: l.tone === 'red' ? '#b91c1c' : l.tone === 'amber' ? '#b45309' : l.tone === 'blue' ? '#1d4ed8' : '#4b5563', fontWeight: l.tone ? 600 : undefined }}>{l.text}</div>)}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </Card>

          {/* Partner watchlist */}
          {d.watch.length > 0 && (
            <Card title={<span className="g2-row" style={{ gap: 8 }}><Building2 size={16} /> Partners needing action</span>} subtitle="Stock-out risk, overdue money, licences, reporting — worst first" flush>
              <div className="g2-table-wrap"><table className="g2-table">
                <thead><tr><th>Partner</th><th>Why</th><th style={{ textAlign: 'right' }}>Shortest cover</th><th style={{ textAlign: 'right' }}>Overdue</th><th style={{ textAlign: 'right' }}>Data</th></tr></thead>
                <tbody>{d.watch.slice(0, 8).map((w) => (
                  <tr key={w.partnerId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/secondary?partner=${w.partnerId}`)}>
                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                    <td><div className="g2-row" style={{ gap: 4, flexWrap: 'wrap' }}>{w.flags.map((f) => <Badge key={f.text} tone={f.tone}>{f.text}</Badge>)}</div></td>
                    <td style={{ textAlign: 'right', color: w.cover !== null && w.cover < 14 ? '#b91c1c' : undefined, fontWeight: w.cover !== null && w.cover < 14 ? 700 : undefined }}>{w.cover === null ? '—' : `${w.cover} d`}</td>
                    <td style={{ textAlign: 'right' }}>{w.overdue ? inr(w.overdue) : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="g2-small">{w.dataAge === null ? <span className="g2-muted">none</span> : <span style={{ color: w.fresh ? '#047857' : '#b45309' }}>{w.dataAge === 0 ? 'today' : `${w.dataAge} d`}</span>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Card>
          )}
        </div>
      )}
      <style>{`
        .ct-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
        .ct-kpis .g2-kpi-value{font-size:21px}
        .ct-charts{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px}
        .ct-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
        .ct-card{background:#fff;border:1px solid #e4e8f0;border-radius:10px;box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.06);overflow:hidden;display:flex;flex-direction:column}
        .ct-card-h{display:flex;align-items:center;gap:8px;padding:13px 16px;border-bottom:1px solid #eef1f6}
        .ct-card-h h3{margin:0;font-size:14px;font-weight:600;color:#0f1a33}
        .ct-open{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;color:#2563eb;padding:4px 6px;border-radius:6px}
        .ct-open:hover{background:#eaf1ff}
        .ct-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #f3f5f9;cursor:pointer}
        .ct-row:first-of-type{border-top:0}
        .ct-row:hover{background:#fafbfd}
        .ct-main{font-weight:600;font-size:13px;color:#0f1a33;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ct-sub{font-size:12px;color:#6b7590;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
        .ct-pill{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:20px;white-space:nowrap}
        .ct-red{background:#fdecee;color:#dc3545}.ct-amber{background:#fff5e0;color:#c77700}.ct-blue{background:#eaf1ff;color:#2563eb}.ct-green{background:#e7f7ee;color:#15803d}.ct-purple{background:#f1ebfd;color:#7c3aed}.ct-slate{background:#f1f3f7;color:#55607a}
        .ct-amt{font-size:13px;font-weight:700;white-space:nowrap}
        .ct-bar{height:6px;background:#f1f3f7;border-radius:4px;margin-top:6px;overflow:hidden}.ct-bar>div{height:100%;border-radius:4px}
        .ct-more{padding:8px 16px;font-size:12px;color:#2563eb;cursor:pointer;border-top:1px solid #f3f5f9;margin-top:auto}
        .ct-flow{display:flex;align-items:stretch;gap:4px;overflow-x:auto;padding-bottom:4px}
        .ct-node{position:relative;cursor:pointer;display:block;padding-right:22px !important;flex:1 1 0;min-width:128px;border:1px solid;border-radius:10px;padding:10px 12px;box-sizing:border-box;transition:transform .12s;text-align:left;vertical-align:top}
        .ct-node:hover{transform:translateY(-2px)}
        .ct-arrow{display:flex;align-items:center;color:#9ca3af;flex:0 0 auto}
        .ct-dot{position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%}
        @media (max-width: 1280px){ .ct-kpis{grid-template-columns:repeat(3,minmax(0,1fr))} }
        @media (max-width: 1100px){ .ct-charts{grid-template-columns:1fr} .ct-cards{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media (max-width: 760px){ .ct-lens .g2-seg{flex-wrap:wrap;max-width:100%} .ct-kpis,.ct-cards{grid-template-columns:1fr} .ct-flow{flex-direction:column} .ct-arrow{transform:rotate(90deg);justify-content:center} }
      `}</style>
    </div>
  );
};
export default ControlTower;
