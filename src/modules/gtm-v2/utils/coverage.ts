/**
 * Hospital coverage helpers: current owner per hospital × portfolio, scorecards, status.
 */
import type { CoverageConfig, CoverageMetrics, CustomerAssignment, Partner } from '../types';

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const dayBefore = (iso: string) => new Date(new Date(`${iso}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);

export type AssignmentState = 'Current' | 'Scheduled' | 'Ended';
export const assignmentState = (a: CustomerAssignment, on = todayStr()): AssignmentState =>
  a.effectiveFrom > on ? 'Scheduled' : a.effectiveTo && a.effectiveTo < on ? 'Ended' : 'Current';

/** An assignment for "all portfolios" also covers each single portfolio. */
export const covers = (a: CustomerAssignment, portfolioId: string | null) => a.portfolioId === null || portfolioId === null || a.portfolioId === portfolioId;

export const currentFor = (list: CustomerAssignment[], customerId: string, portfolioId: string | null, on = todayStr()) =>
  list.filter((a) => a.customerId === customerId && covers(a, portfolioId) && assignmentState(a, on) === 'Current');

/** Deterministic sample figures for assignments that have none yet (demo only). */
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const metricsOf = (a: CustomerAssignment): CoverageMetrics => {
  if (a.metrics) return a.metrics;
  if (a.servedBy === 'DIRECT') return { salesL: 18, targetPct: 96, fillRatePct: 97, deliveryDays: 2, complaints: 0, paymentDays: 60 };
  const h = hash(`${a.partnerId}|${a.customerId}|${a.portfolioId}`);
  return { salesL: 4 + (h % 30), targetPct: 70 + (h % 35), fillRatePct: 85 + (h % 14), deliveryDays: 1 + (h % 4), complaints: h % 3, paymentDays: 35 + (h % 40) };
};

/** 0–100. Weights: target 30, fill rate 25, delivery 15, complaints 15, payment 15. */
export const scoreOf = (m: CoverageMetrics): number => {
  const clamp = (x: number) => Math.max(0, Math.min(100, x));
  const target = clamp(m.targetPct);
  const fill = clamp((m.fillRatePct - 70) * (100 / 30));
  const delivery = clamp(100 - (m.deliveryDays - 2) * 20);
  const complaints = clamp(100 - m.complaints * 25);
  const payment = clamp(100 - (m.paymentDays - 45) * (100 / 45));
  return Math.round(target * 0.3 + fill * 0.25 + delivery * 0.15 + complaints * 0.15 + payment * 0.15);
};

export type ScoreStatus = 'Good' | 'On watch' | 'Improve';
export const scoreStatus = (score: number, cfg: CoverageConfig): ScoreStatus => (score < cfg.improveBelow ? 'Improve' : score < cfg.watchBelow ? 'On watch' : 'Good');
export const scoreTone = (s: ScoreStatus) => (s === 'Good' ? 'green' : s === 'On watch' ? 'amber' : 'red') as 'green' | 'amber' | 'red';

export const ownerName = (a: CustomerAssignment, partners: Partner[], principalName: string) =>
  a.servedBy === 'DIRECT' ? `${principalName} (direct)` : partners.find((p) => p.id === a.partnerId)?.name ?? 'Unknown partner';

export const METRIC_ROWS: { key: keyof CoverageMetrics; label: string; fmt: (v: number) => string; better: 'high' | 'low' }[] = [
  { key: 'salesL', label: 'Sales (90 days)', fmt: (v) => `₹${v.toFixed(1)} L`, better: 'high' },
  { key: 'targetPct', label: 'Target achieved', fmt: (v) => `${v}%`, better: 'high' },
  { key: 'fillRatePct', label: 'Order fill rate', fmt: (v) => `${v}%`, better: 'high' },
  { key: 'deliveryDays', label: 'Avg. delivery time', fmt: (v) => `${v} day${v === 1 ? '' : 's'}`, better: 'low' },
  { key: 'complaints', label: 'Complaints', fmt: (v) => String(v), better: 'low' },
  { key: 'paymentDays', label: 'Hospital payment days', fmt: (v) => `${v} days`, better: 'low' },
];
