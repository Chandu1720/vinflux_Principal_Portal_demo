import type { ApprovalCategory, ApprovalRequest, GtmDatabase, KycDocument, Partner } from '../types';
import { nextNumber, nowISO } from './mockDb';
import { uid } from '../utils/format';
import { addDays } from '../utils/health';
import { applyTransfer } from './coverageApply';

/** Adds an Owner portal invite for the partner's contact person (used on activation). */
export const autoInvite = (d: GtmDatabase, p: Partner, actor: string) => {
  const cfg = d.config.portal;
  if (!cfg?.autoInviteOnActivation || !cfg.partnerTypeIds.includes(p.partnerTypeId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return;
  if ((p.portalUsers ?? []).some((u) => u.status !== 'Revoked' && u.email.toLowerCase() === p.email.toLowerCase())) return;
  const now = nowISO();
  p.portalUsers = [...(p.portalUsers ?? []), {
    id: uid('pu'), name: p.contactPerson || p.name, email: p.email, phone: p.phone, role: 'Owner', status: 'Invited',
    invitedAt: now, invitedBy: `${actor} (auto)`, lastSentAt: now, expiresAt: addDays(now, cfg.inviteValidityDays), acceptedAt: null,
  }];
};

type RenewedDoc = KycDocument & { replaces?: KycDocument | null };

export interface NewApproval {
  category: ApprovalCategory;
  partnerId: string | null;
  entityType: ApprovalRequest['entityType'];
  entityId: string;
  summary: string;
  details: ApprovalRequest['details'];
  requestedBy: string;
}

/**
 * Creates an approval request using the configured workflow levels.
 * If the workflow for the category is disabled, the outcome is applied immediately
 * and `null` is returned.
 */
export const createApproval = (draft: GtmDatabase, req: NewApproval): ApprovalRequest | null => {
  const wf = draft.config.approvalWorkflows.find((w) => w.category === req.category);
  if (!wf || !wf.enabled || wf.levels.length === 0) {
    applyApprovalOutcome(draft, { ...req, id: '', requestNo: '', requestedAt: nowISO(), status: 'Approved', currentLevel: 0, steps: [] }, 'Approved', req.requestedBy);
    return null;
  }
  const n = nextNumber(draft, 'approval');
  const approval: ApprovalRequest = {
    ...req,
    id: uid('apr'),
    requestNo: `REQ-${String(n).padStart(4, '0')}`,
    requestedAt: nowISO(),
    status: 'Pending',
    currentLevel: 1,
    steps: wf.levels.map((role, i) => ({ level: i + 1, role, status: i === 0 ? 'Pending' : 'Waiting', actedBy: null, actedAt: null, comments: '' })),
  };
  draft.approvals.unshift(approval);
  return approval;
};

/** Side-effects applied when an approval reaches a final outcome. */
export const applyApprovalOutcome = (draft: GtmDatabase, req: ApprovalRequest, outcome: 'Approved' | 'Rejected', actor: string) => {
  const now = nowISO();
  if (req.entityType === 'PARTNER') {
    const p = draft.partners.find((x) => x.id === req.entityId);
    if (!p) return;
    p.updatedAt = now;
    p.updatedBy = actor;
    if (req.category === 'KYC_VERIFICATION' && (p.status === 'Active' || p.status === 'Suspended')) {
      // Licence renewal for a trading partner: verify / roll back the renewed copy only.
      p.kycDocuments = p.kycDocuments.map((doc) => {
        const r = doc as RenewedDoc;
        if (r.status !== 'Under Review') return doc;
        if (outcome === 'Approved') { const { replaces: _drop, ...rest } = r; void _drop; return { ...rest, status: 'Verified' }; }
        return r.replaces ? { ...r.replaces } : { ...r, status: 'Rejected' };
      });
    } else if (req.category === 'KYC_VERIFICATION') {
      if (outcome === 'Approved') {
        p.kycStatus = 'Verified';
        p.kycDocuments.forEach((d) => { d.status = 'Verified'; });
        p.status = 'Approval Pending';
        createApproval(draft, {
          category: 'PARTNER_ONBOARDING', partnerId: p.id, entityType: 'PARTNER', entityId: p.id,
          summary: `Onboard ${p.name}`, details: [{ label: 'KYC', to: 'Verified' }, { label: 'Territories', to: `${p.territoryIds.length} assigned` }],
          requestedBy: actor,
        });
      } else {
        p.kycStatus = 'Rejected';
        p.kycDocuments.forEach((d) => { if (d.status !== 'Verified') d.status = 'Rejected'; });
        p.status = 'KYC Pending';
      }
    }
    if (req.category === 'PARTNER_ONBOARDING' || req.category === 'INSTITUTION_ONBOARDING') {
      if (outcome === 'Approved') {
        p.status = 'Active';
        p.activatedAt = now;
        draft.mappings.filter((m) => m.partnerId === p.id).forEach((m) => { m.status = 'Active'; });
        autoInvite(draft, p, actor);
      } else {
        p.status = 'Rejected';
      }
    }
  }

  if (req.category === 'CREDIT_HOLD_RELEASE') {
    const p = draft.partners.find((x) => x.id === req.entityId);
    if (p?.credit?.hold) {
      if (outcome === 'Approved') p.credit.hold = null;
      else p.credit.hold.releaseRequestId = null;
    }
  }

  if (req.entityType === 'TERM') {
    const term = draft.terms.find((t) => t.id === req.entityId);
    if (!term) return;
    const siblings = draft.approvals.filter((a) => a.entityType === 'TERM' && a.entityId === term.id && a.id !== req.id);
    if (outcome === 'Rejected') term.approvalStatus = 'Rejected';
    else if (siblings.every((s) => s.status === 'Approved')) term.approvalStatus = 'Approved';
    term.updatedAt = now;
    term.updatedBy = actor;
  }

  if (req.entityType === 'ASSIGNMENT') {
    const t = draft.transfers.find((x) => x.id === req.entityId);
    if (t) applyTransfer(draft, t, outcome, actor);
  }

  if (req.entityType === 'FLOW_OVERRIDE') {
    const o = draft.flowOverrides.find((x) => x.id === req.entityId);
    if (!o) return;
    o.approvalStatus = outcome;
    o.updatedAt = now;
    o.updatedBy = actor;
  }
};
