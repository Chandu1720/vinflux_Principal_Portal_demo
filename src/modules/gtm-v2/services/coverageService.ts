/**
 * Hospital coverage: who serves each hospital, per portfolio — assign, improvement period, transfer/remove.
 * INTEGRATION POINT: GET|POST /customer-assignments, POST /customer-assignments/:id/improvement,
 * POST /customer-assignments/:id/transfer (approval-gated).
 */
import { tradeStatusOf } from '../utils/health';
import type { CoverageTransfer, CustomerAssignment, GtmDatabase, HandoverChecklist } from '../types';
import { mockCall, ServiceError } from './apiClient';
import { mutateDb, nowISO, readDb } from './mockDb';
import { createApproval } from './approvalEngine';
import { applyTransfer, syncCustomerLinks } from './coverageApply';
import { assignmentState, covers, todayStr } from '../utils/coverage';
import { shortFormTypeIds } from '../utils/eligibility';
import { formatDate, uid } from '../utils/format';

export interface AssignInput {
  customerId: string;
  portfolioId: string | null;
  servedBy: 'DIRECT' | 'PARTNER';
  partnerId: string | null;
  role: 'PRIMARY' | 'BACKUP';
  effectiveFrom: string;
}

export interface TransferInput {
  assignmentId: string;
  reason: string;
  notes: string;
  effectiveDate: string;
  newOwner: 'DIRECT' | 'PARTNER' | 'NONE';
  newPartnerId: string | null;
  handover: HandoverChecklist;
  /** Display name of the portfolio (Product Master lives outside this DB). */
  portfolioName?: string;
}

/** Problems with a new assignment (shared by the drawer for live feedback). */
export const validateAssignment = (d: GtmDatabase, i: AssignInput): string[] => {
  const e: string[] = [];
  const customer = d.partners.find((p) => p.id === i.customerId);
  if (!customer) e.push('Choose a hospital.');
  else {
    if (!shortFormTypeIds(d.config).includes(customer.partnerTypeId)) e.push(`${customer.name} is not an end customer.`);
    if (customer.status !== 'Active') e.push(`${customer.name} is not active.`);
  }
  if (i.servedBy === 'PARTNER') {
    const p = d.partners.find((x) => x.id === i.partnerId);
    if (!p) e.push('Choose the partner who will serve this hospital.');
    else if (p.status !== 'Active') e.push(`${p.name} is not active.`);
    else {
      // A partner that may not trade (expired licence, credit hold…) can't be given hospitals.
      const ts = tradeStatusOf(p, d.config, d);
      if (!ts.canTrade) e.push(`${p.name} can't trade right now: ${ts.reasons.filter((r) => r.tone === 'red').map((r) => r.text).join('; ')}.`);
    }
  }
  if (!i.effectiveFrom) e.push('Effective date is required.');
  if (i.role === 'BACKUP' && !d.config.coverage.allowBackup) e.push('Backup suppliers are switched off in Configuration → Hospital Coverage.');
  const live = d.assignments.filter((a) => a.customerId === i.customerId && assignmentState(a) !== 'Ended' && covers(a, i.portfolioId));
  if (i.role === 'PRIMARY' && d.config.coverage.onePrimaryPerPortfolio && live.some((a) => a.role === 'PRIMARY')) {
    e.push('This hospital already has a primary for this portfolio. Use “Transfer” to change it, or add this one as backup.');
  }
  if (live.some((a) => a.servedBy === i.servedBy && a.partnerId === i.partnerId)) e.push('Already assigned to this hospital for this portfolio.');
  if (i.role === 'BACKUP' && !live.some((a) => a.role === 'PRIMARY')) e.push('Add a primary first; a backup only supplies when the primary can’t.');
  return e;
};

export const coverageService = {
  list: () => mockCall(() => readDb().assignments),
  listTransfers: () => mockCall(() => readDb().transfers),

  assign: (i: AssignInput, actor: string) => mockCall(() => mutateDb(['assignments', 'mappings'], (d) => {
    const errs = validateAssignment(d, i);
    if (errs.length) throw new ServiceError(errs[0], errs);
    const now = nowISO();
    const a: CustomerAssignment = {
      id: uid('asg'), customerId: i.customerId, portfolioId: i.portfolioId, servedBy: i.servedBy, partnerId: i.servedBy === 'DIRECT' ? null : i.partnerId,
      role: i.role, effectiveFrom: i.effectiveFrom, effectiveTo: null, improvement: null,
      createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    };
    d.assignments.push(a);
    syncCustomerLinks(d, a.partnerId, a.customerId);
    return a;
  })),

  startImprovement: (id: string, note: string, actor: string) => mockCall(() => mutateDb(['assignments'], (d) => {
    const a = d.assignments.find((x) => x.id === id);
    if (!a) throw new ServiceError('Assignment not found.');
    if (a.servedBy !== 'PARTNER') throw new ServiceError('Improvement periods apply to partners only.');
    if (!note.trim()) throw new ServiceError('Describe what must improve.');
    const days = d.config.coverage.improvementDays;
    const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    a.improvement = { startedAt: todayStr(), until, note: note.trim(), by: actor };
    a.updatedAt = nowISO(); a.updatedBy = actor;
    return a;
  })),

  endImprovement: (id: string, actor: string) => mockCall(() => mutateDb(['assignments'], (d) => {
    const a = d.assignments.find((x) => x.id === id);
    if (!a) throw new ServiceError('Assignment not found.');
    a.improvement = null; a.updatedAt = nowISO(); a.updatedBy = actor;
    return a;
  })),

  /** Transfer or remove: one approved step that ends the old owner and starts the new one on the same date. */
  requestTransfer: (i: TransferInput, actor: string) => mockCall(() => mutateDb(['assignments', 'transfers', 'approvals', 'mappings'], (d) => {
    const a = d.assignments.find((x) => x.id === i.assignmentId);
    if (!a) throw new ServiceError('Assignment not found.');
    const errs: string[] = [];
    if (assignmentState(a) === 'Ended') errs.push('This assignment has already ended.');
    if (a.pendingTransferId) errs.push('A transfer for this assignment is already waiting for approval.');
    if (!i.reason) errs.push('Choose a reason.');
    if (!i.effectiveDate) errs.push('Choose the effective date.');
    else if (i.effectiveDate < todayStr()) errs.push('The effective date can’t be in the past.');
    else if (i.effectiveDate <= a.effectiveFrom) errs.push(`The effective date must be after ${formatDate(a.effectiveFrom)}, when this assignment started.`);
    if (i.newOwner === 'PARTNER') {
      const p = d.partners.find((x) => x.id === i.newPartnerId);
      if (!p) errs.push('Choose the new partner.');
      else if (p.id === a.partnerId) errs.push('The new partner is the same as the current one.');
      else if (p.status !== 'Active') errs.push(`${p.name} is not active.`);
    }
    if (i.newOwner === 'DIRECT' && a.servedBy === 'DIRECT') errs.push('The company already serves this hospital directly.');
    if (i.newOwner === 'NONE' && a.role === 'PRIMARY') {
      const backup = d.assignments.some((x) => x.id !== a.id && x.customerId === a.customerId && x.portfolioId === a.portfolioId && x.role === 'BACKUP' && assignmentState(x) !== 'Ended');
      if (!backup) errs.push('No backup exists — choose who takes over, so the hospital is never left without a supplier.');
    }
    if (d.config.coverage.requireHandover && Object.values(i.handover).some((v) => !v)) errs.push('Complete every handover item (orders, stock, kits, claims, receivables).');
    if (errs.length) throw new ServiceError(errs[0], errs);

    const now = nowISO();
    const { portfolioName: _pn, ...rest } = i; void _pn;
    const t: CoverageTransfer = { id: uid('trf'), ...rest, status: 'Pending', createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor };
    d.transfers.unshift(t);
    a.pendingTransferId = t.id;
    const name = (id: string | null) => d.partners.find((p) => p.id === id)?.name ?? '—';
    const customer = name(a.customerId);
    const to = i.newOwner === 'DIRECT' ? 'Company direct' : i.newOwner === 'PARTNER' ? name(i.newPartnerId) : 'Backup takes over';
    const r = createApproval(d, {
      category: 'CUSTOMER_TRANSFER', partnerId: a.partnerId, entityType: 'ASSIGNMENT', entityId: t.id,
      summary: `${customer} · ${i.portfolioName ?? (a.portfolioId ? 'portfolio' : 'all portfolios')}: move from ${a.servedBy === 'DIRECT' ? 'company direct' : name(a.partnerId)} to ${to}`,
      details: [
        { label: 'Hospital', to: customer },
        { label: 'Served by', from: a.servedBy === 'DIRECT' ? 'Company direct' : name(a.partnerId), to },
        { label: 'Effective', to: formatDate(i.effectiveDate) },
        { label: 'Reason', to: `${i.reason}${i.notes ? ` — ${i.notes}` : ''}` },
        { label: 'Handover', to: 'Orders, stock, kits, claims and receivables confirmed' },
      ],
      requestedBy: actor,
    });
    return { transfer: t, needsApproval: !!r };
  })),
};

export { applyTransfer };
