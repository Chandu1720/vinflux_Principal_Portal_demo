/** Applies an approved coverage transfer to the mock DB (shared by approvals and auto-apply). */
import type { CoverageTransfer, CustomerAssignment, GtmDatabase } from '../types';
import { nowISO } from './mockDb';
import { uid } from '../utils/format';
import { assignmentState, dayBefore } from '../utils/coverage';

/** Keep the partner's "Sells to" list (used by the network view) in step with current assignments. */
export const syncCustomerLinks = (d: GtmDatabase, partnerId: string | null, customerId: string) => {
  if (!partnerId) return;
  const customer = d.partners.find((p) => p.id === customerId);
  const chId = d.config.partnerTypes.find((t) => t.id === customer?.partnerTypeId)?.channelId;
  if (!chId) return;
  const still = d.assignments.some((a) => a.partnerId === partnerId && a.customerId === customerId && assignmentState(a) !== 'Ended');
  d.mappings.filter((m) => m.partnerId === partnerId).forEach((m, i) => {
    const list = m.customers ?? [];
    const link = list.find((c) => c.channelId === chId);
    if (still && i === 0) {
      if (link) { if (!link.partnerIds.includes(customerId)) link.partnerIds.push(customerId); }
      else m.customers = [...list, { channelId: chId, partnerIds: [customerId] }];
    }
    if (!still && link) link.partnerIds = link.partnerIds.filter((x) => x !== customerId);
  });
};

export const applyTransfer = (d: GtmDatabase, t: CoverageTransfer, outcome: 'Approved' | 'Rejected', actor: string) => {
  const now = nowISO();
  t.status = outcome; t.updatedAt = now; t.updatedBy = actor;
  const old = d.assignments.find((a) => a.id === t.assignmentId);
  if (!old) return;
  old.pendingTransferId = null;
  if (outcome === 'Rejected') return;
  old.effectiveTo = dayBefore(t.effectiveDate);
  old.endReason = t.reason; old.endNotes = t.notes; old.endedBy = actor; old.improvement = null;
  old.updatedAt = now; old.updatedBy = actor;
  let newPartnerId: string | null = null;
  let servedBy: CustomerAssignment['servedBy'] | null = null;
  let carried: CustomerAssignment['metrics'];
  if (t.newOwner === 'DIRECT') servedBy = 'DIRECT';
  if (t.newOwner === 'PARTNER') { servedBy = 'PARTNER'; newPartnerId = t.newPartnerId; }
  if (t.newOwner === 'NONE' && old.role === 'PRIMARY') {
    // The backup for the same scope takes over as primary.
    const backup = d.assignments.find((a) => a.id !== old.id && a.customerId === old.customerId && a.portfolioId === old.portfolioId && a.role === 'BACKUP' && assignmentState(a) !== 'Ended');
    if (backup) {
      backup.effectiveTo = dayBefore(t.effectiveDate); backup.endReason = 'Promoted to primary'; backup.endedBy = actor;
      servedBy = backup.servedBy; newPartnerId = backup.partnerId; carried = backup.metrics;
    }
  }
  if (servedBy) {
    const next: CustomerAssignment = {
      id: uid('asg'), customerId: old.customerId, portfolioId: old.portfolioId, servedBy, partnerId: newPartnerId, role: old.role,
      effectiveFrom: t.effectiveDate, effectiveTo: null, improvement: null, metrics: carried,
      createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    };
    d.assignments.push(next);
    old.replacedById = next.id;
    syncCustomerLinks(d, newPartnerId, old.customerId);
  }
  syncCustomerLinks(d, old.partnerId, old.customerId);
};
