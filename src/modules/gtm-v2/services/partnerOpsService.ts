/**
 * Day-2 partner operations: credit hold, licence renewal and partner portal access.
 */
import type { GtmDatabase, KycDocument, Partner, PortalRole, PortalUser } from '../types';
import { mockCall, ServiceError } from './apiClient';
import { mutateDb, nowISO } from './mockDb';
import { createApproval } from './approvalEngine';
import { EMAIL_REGEX } from './partnerService';
import { addDays, today } from '../utils/health';
export { autoInvite } from './approvalEngine';
import { formatDate, formatINR, uid } from '../utils/format';

const get = (d: GtmDatabase, id: string): Partner => {
  const p = d.partners.find((x) => x.id === id);
  if (!p) throw new ServiceError('Partner not found.');
  return p;
};
const touch = (p: Partner, actor: string) => { p.updatedAt = nowISO(); p.updatedBy = actor; };

export interface InviteInput { name: string; email: string; phone: string; role: PortalRole }

export const partnerOpsService = {
  /* ------------------------------ Credit ------------------------------ */
  placeHold: (id: string, reason: string, actor: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const p = get(d, id);
    if (!reason.trim()) throw new ServiceError('Enter a reason for the hold.');
    if (p.credit?.hold) throw new ServiceError('Partner is already on credit hold.');
    p.credit = { outstanding: 0, overdue: 0, asOf: today(), ...p.credit, hold: { reason: reason.trim(), heldBy: actor, heldAt: nowISO(), releaseRequestId: null } };
    touch(p, actor);
    return p;
  })),

  /** Releasing a hold is a credit decision — it goes through the Credit Hold Release workflow. */
  requestRelease: (id: string, reason: string, actor: string) => mockCall(() => mutateDb(['partners', 'approvals'], (d) => {
    const p = get(d, id);
    const hold = p.credit?.hold;
    if (!hold) throw new ServiceError('Partner is not on credit hold.');
    if (hold.releaseRequestId) throw new ServiceError('A release request is already waiting for approval.');
    if (!reason.trim()) throw new ServiceError('Enter a reason for the release.');
    const r = createApproval(d, {
      category: 'CREDIT_HOLD_RELEASE', partnerId: p.id, entityType: 'PARTNER', entityId: p.id,
      summary: `Release credit hold on ${p.name}`,
      details: [
        { label: 'Hold reason', to: hold.reason },
        { label: 'Outstanding', to: formatINR(p.credit?.outstanding ?? 0) },
        { label: 'Overdue', to: formatINR(p.credit?.overdue ?? 0) },
        { label: 'Release reason', to: reason.trim() },
      ],
      requestedBy: actor,
    });
    const fresh = get(d, id);
    if (r && fresh.credit?.hold) fresh.credit.hold.releaseRequestId = r.id;
    touch(fresh, actor);
    return { partner: fresh, needsApproval: !!r };
  })),

  /* ----------------------------- Licences ----------------------------- */
  /** Upload a renewed licence. Active partners keep trading; Compliance verifies the new copy. */
  renewDocument: (id: string, docTypeId: string, file: { fileName: string; fileSize: number }, documentNo: string, validUntil: string, actor: string) => mockCall(() => mutateDb(['partners', 'approvals'], (d) => {
    const p = get(d, id);
    const req = d.config.kycDocuments.find((k) => k.id === docTypeId);
    if (!req) throw new ServiceError('Unknown document type.');
    if (!validUntil) throw new ServiceError('Enter the new validity date.');
    if (validUntil <= today()) throw new ServiceError('The new validity date must be in the future.');
    const prev = p.kycDocuments.find((x) => x.docTypeId === docTypeId);
    const doc: KycDocument & { replaces?: KycDocument | null } = {
      id: uid('doc'), docTypeId, fileName: file.fileName, fileSize: file.fileSize, uploadedAt: nowISO(),
      status: 'Under Review', remarks: 'Renewal', documentNo: documentNo.trim(), validUntil, replaces: prev ?? null,
    };
    p.kycDocuments = [...p.kycDocuments.filter((x) => x.docTypeId !== docTypeId), doc];
    touch(p, actor);
    createApproval(d, {
      category: 'KYC_VERIFICATION', partnerId: p.id, entityType: 'PARTNER', entityId: p.id,
      summary: `Verify renewed ${req.name} for ${p.name}`,
      details: [
        { label: req.name, from: prev?.validUntil ? `valid until ${formatDate(prev.validUntil)}` : undefined, to: `valid until ${formatDate(validUntil)}` },
        { label: 'Licence no.', from: prev?.documentNo || undefined, to: documentNo.trim() || '—' },
      ],
      requestedBy: actor,
    });
    return get(d, id);
  })),

  /* ------------------------------ Portal ------------------------------ */
  invite: (id: string, input: InviteInput, actor: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const p = get(d, id);
    const cfg = d.config.portal;
    if (!cfg.partnerTypeIds.includes(p.partnerTypeId)) throw new ServiceError('Portal access is not enabled for this partner type (Configuration → Partner Portal).');
    if (p.status !== 'Active' && p.status !== 'Approval Pending') throw new ServiceError('Invite users once the partner is active.');
    const errs: string[] = [];
    if (!input.name.trim()) errs.push('Name is required.');
    if (!EMAIL_REGEX.test(input.email)) errs.push('A valid email is required.');
    if ((p.portalUsers ?? []).some((u) => u.status !== 'Revoked' && u.email.toLowerCase() === input.email.trim().toLowerCase())) errs.push('This email already has access or a pending invite.');
    if (errs.length) throw new ServiceError(errs[0], errs);
    const now = nowISO();
    const user: PortalUser = {
      id: uid('pu'), name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim(), role: input.role, status: 'Invited',
      invitedAt: now, invitedBy: actor, lastSentAt: now, expiresAt: addDays(now, cfg.inviteValidityDays), acceptedAt: null,
    };
    p.portalUsers = [...(p.portalUsers ?? []), user];
    touch(p, actor);
    return user;
  })),

  resend: (id: string, userId: string, actor: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const p = get(d, id);
    const u = p.portalUsers?.find((x) => x.id === userId);
    if (!u || u.status !== 'Invited') throw new ServiceError('Only pending invites can be resent.');
    const now = nowISO();
    u.lastSentAt = now;
    u.expiresAt = addDays(now, d.config.portal.inviteValidityDays);
    touch(p, actor);
    return u;
  })),

  revoke: (id: string, userId: string, actor: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const p = get(d, id);
    const u = p.portalUsers?.find((x) => x.id === userId);
    if (!u || u.status === 'Revoked') throw new ServiceError('User not found.');
    u.status = 'Revoked';
    touch(p, actor);
    return u;
  })),

  /** DEMO ONLY — stands in for the partner clicking the invite link. */
  simulateAccept: (id: string, userId: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const u = get(d, id).portalUsers?.find((x) => x.id === userId);
    if (!u || u.status !== 'Invited') throw new ServiceError('Only pending invites can be accepted.');
    u.status = 'Active';
    u.acceptedAt = nowISO();
    return u;
  })),
};
