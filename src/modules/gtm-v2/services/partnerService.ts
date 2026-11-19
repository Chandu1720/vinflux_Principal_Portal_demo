/**
 * Partner onboarding & ACTUAL partner relationships.
 * Writes PartnerFlowMapping / PartnerFlowOverride / CommercialTermRecord — never SalesFlow.
 */
import type {
  ApprovalCategory, ApprovalStatus, CommercialValues, GstVerification, InstitutionDetails, ProductScope, GtmDatabase, KycDocument, OnboardingExtras, Partner, PartnerAddress, PartnerStatus,
} from '../types';
import { mockCall, ServiceError } from './apiClient';
import { mutateDb, nowISO, readDb } from './mockDb';
import { autoInvite, createApproval } from './approvalEngine';
import { evaluateStageEligibility, partnerChannelId, shortFormTypeIds } from '../utils/eligibility';
import { flattenResolved, resolveTerms } from '../utils/commercial';
import { routeCompat, validateRoute } from '../utils/route';
import { linksCompat, validateLinks } from '../utils/supply';
import { formatINR, uid } from '../utils/format';

export interface PartnerInput {
  code: string;
  name: string;
  partnerTypeId: string;
  contactPerson: string;
  email: string;
  phone: string;
  businessName: string;
  address: PartnerAddress;
  gst: string;
  pan: string;
  gstVerification?: GstVerification | null;
  productScope?: ProductScope;
  kycDocuments: KycDocument[];
  territoryIds: string[];
}

export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateBasicDetails = (input: PartnerInput, db: GtmDatabase, id: string | null): string[] => {
  const errs: string[] = [];
  if (!input.name.trim()) errs.push('Partner name is required.');
  if (!input.code.trim()) errs.push('Partner code is required.');
  if (input.code && db.partners.some((p) => p.id !== id && p.code.toLowerCase() === input.code.trim().toLowerCase())) errs.push(`Partner code "${input.code}" already exists.`);
  if (!input.partnerTypeId) errs.push('Partner type is required.');
  if (!input.contactPerson.trim()) errs.push('Contact person is required.');
  if (!EMAIL_REGEX.test(input.email)) errs.push('A valid email is required.');
  if (input.phone.replace(/\D/g, '').length < 10) errs.push('A valid phone number is required.');
  if (!input.businessName.trim()) errs.push('Business name is required.');
  if (!input.address.line1.trim() || !input.address.city.trim() || !input.address.state.trim()) errs.push('Address, city and state are required.');
  if (!/^\d{6}$/.test(input.address.pincode)) errs.push('PIN code must be 6 digits.');
  if (!GST_REGEX.test(input.gst.toUpperCase())) errs.push('GSTIN format is invalid (e.g. 36ABCDE1234F1Z5).');
  if (!PAN_REGEX.test(input.pan.toUpperCase())) errs.push('PAN format is invalid (e.g. ABCDE1234F).');
  if (input.gst && input.pan && input.gst.toUpperCase().slice(2, 12) !== input.pan.toUpperCase()) errs.push('PAN does not match characters 3–12 of the GSTIN.');
  return errs;
};

export const missingMandatoryDocs = (db: GtmDatabase, partnerTypeId: string, docs: KycDocument[]) =>
  db.config.kycDocuments.filter((k) => k.status === 'Active' && k.mandatoryForPartnerTypeIds.includes(partnerTypeId) && !docs.some((d) => d.docTypeId === k.id && d.status !== 'Rejected'));

export const termApprovalCategories = (base: CommercialValues, next: Partial<CommercialValues>): { cat: ApprovalCategory; label: string; from: string; to: string }[] => {
  const out: { cat: ApprovalCategory; label: string; from: string; to: string }[] = [];
  if (next.standardDiscountPct !== undefined && next.standardDiscountPct !== base.standardDiscountPct) out.push({ cat: 'DISCOUNT_OVERRIDE', label: 'Discount %', from: `${base.standardDiscountPct}`, to: `${next.standardDiscountPct}` });
  if (next.creditLimit !== undefined && next.creditLimit !== base.creditLimit) out.push({ cat: 'CREDIT_LIMIT_CHANGE', label: 'Credit Limit', from: formatINR(base.creditLimit), to: formatINR(next.creditLimit) });
  if (next.creditPeriodDays !== undefined && next.creditPeriodDays !== base.creditPeriodDays) out.push({ cat: 'CREDIT_PERIOD_EXTENSION', label: 'Credit Period (days)', from: `${base.creditPeriodDays}`, to: `${next.creditPeriodDays}` });
  const waived = (next.depositRequired === false && base.depositRequired) || (next.depositAmount !== undefined && next.depositAmount < base.depositAmount);
  if (waived) out.push({ cat: 'DEPOSIT_WAIVER', label: 'Deposit', from: base.depositRequired ? formatINR(base.depositAmount) : 'Not required', to: next.depositRequired === false ? 'Waived' : formatINR(next.depositAmount ?? 0) });
  return out;
};

/** Creates a term record + one approval per triggered category. Shared with commercialService. */
export const raiseTermOverride = (
  d: GtmDatabase,
  args: { scope: 'PARTNER' | 'RELATIONSHIP'; partnerId: string; channelId: string; mappingId: string | null; values: Partial<CommercialValues>; reason: string; effectiveFrom: string; effectiveTo: string | null; base: CommercialValues },
  actor: string,
) => {
  const now = nowISO();
  // Only values that differ from the inherited terms are stored — unchanged fields keep inheriting.
  const values = Object.fromEntries(Object.entries(args.values).filter(([k, v]) => args.base[k as keyof CommercialValues] !== v)) as Partial<CommercialValues>;
  if (values.depositRequired === false && args.base.depositAmount > 0) values.depositAmount = 0;
  const changes = termApprovalCategories(args.base, values);
  if (!changes.length) return null;
  // Resubmission (e.g. after KYC Pending): withdraw the earlier still-pending request of the same scope, never duplicate it.
  d.terms.filter((t) => t.partnerId === args.partnerId && t.scope === args.scope && t.mappingId === args.mappingId && t.approvalStatus === 'Pending').forEach((old) => {
    if (JSON.stringify(old.values) === JSON.stringify(values) && old.effectiveFrom === args.effectiveFrom) return;
    old.approvalStatus = 'Rejected'; old.overrideReason = `${old.overrideReason} (superseded by resubmission)`; old.updatedAt = now; old.updatedBy = actor;
    d.approvals.filter((a) => a.entityType === 'TERM' && a.entityId === old.id && a.status === 'Pending').forEach((a) => { a.status = 'Rejected'; a.steps.forEach((st) => { if (st.status === 'Pending' || st.status === 'Waiting') { st.status = 'Rejected'; st.comments = 'Superseded by resubmission'; st.actedBy = actor; st.actedAt = now; } }); });
  });
  const same = d.terms.find((t) => t.partnerId === args.partnerId && t.scope === args.scope && t.mappingId === args.mappingId && t.approvalStatus === 'Pending' && JSON.stringify(t.values) === JSON.stringify(values) && t.effectiveFrom === args.effectiveFrom);
  if (same) return same;
  const rec = {
    id: uid('term'), scope: args.scope, channelId: args.channelId, territoryId: null, partnerId: args.partnerId, mappingId: args.mappingId,
    values, overrideReason: args.reason, requestedBy: actor, approvalStatus: 'Pending' as ApprovalStatus,
    effectiveFrom: args.effectiveFrom, effectiveTo: args.effectiveTo, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
  };
  d.terms.push(rec);
  const partner = d.partners.find((p) => p.id === args.partnerId);
  const cats = [...new Set(changes.map((c) => c.cat))];
  let anyPending = false;
  cats.forEach((cat) => {
    const r = createApproval(d, {
      category: cat, partnerId: args.partnerId, entityType: 'TERM', entityId: rec.id,
      summary: `${d.config.approvalWorkflows.find((w) => w.category === cat)?.label ?? cat} for ${partner?.name ?? 'partner'}`,
      details: [...changes.filter((c) => c.cat === cat).map((c) => ({ label: c.label, from: c.from, to: c.to })), { label: 'Reason', to: args.reason }],
      requestedBy: actor,
    });
    if (r) anyPending = true;
  });
  if (!anyPending) rec.approvalStatus = 'Approved';
  return rec;
};

const emptyExtras = (): OnboardingExtras => ({ flowSelections: [], commercialOverride: null });

export interface InstitutionInput {
  name: string;
  partnerTypeId: string;
  territoryIds: string[];
  gst: string;
  gstVerification: GstVerification | null;
  pan: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: PartnerAddress;
  institution: InstitutionDetails;
}

/** Validates an institution against the configurable field rules (Configuration → Institution Onboarding). */
export const validateInstitution = (input: InstitutionInput, db: GtmDatabase): string[] => {
  const cfg = db.config.institutionOnboarding;
  const f = cfg.fields;
  const errs: string[] = [];
  const req = (k: keyof typeof f, ok: boolean, msg: string) => { if (f[k] === 'required' && !ok) errs.push(msg); };
  if (!input.name.trim()) errs.push('Institution name is required.');
  if (!input.partnerTypeId || !shortFormTypeIds(db.config).includes(input.partnerTypeId)) errs.push('Select a partner type that uses the short form.');
  if (!input.territoryIds.length) errs.push('Select the territory of the institution.');
  req('gst', !!input.gst.trim(), 'GSTIN is required.');
  if (input.gst.trim()) {
    if (!GST_REGEX.test(input.gst.toUpperCase())) errs.push('GSTIN format is invalid.');
    else if (cfg.verifyGstWhenProvided && (!input.gstVerification || input.gstVerification.gstin !== input.gst.toUpperCase())) errs.push('Verify the GSTIN before saving.');
    else if (input.gstVerification && input.gstVerification.status !== 'Active') errs.push(`GST registration is ${input.gstVerification.status}.`);
    if (db.partners.some((p) => p.gst && p.gst.toUpperCase() === input.gst.toUpperCase())) errs.push('A partner / institution with this GSTIN already exists.');
  }
  req('pan', !!input.pan.trim(), 'PAN is required.');
  if (input.pan.trim() && !PAN_REGEX.test(input.pan.toUpperCase())) errs.push('PAN format is invalid.');
  req('contactPerson', !!input.contactPerson.trim(), 'Contact person is required.');
  req('phone', input.phone.replace(/\D/g, '').length >= 10, 'A valid phone number is required.');
  if (input.phone.trim() && input.phone.replace(/\D/g, '').length < 10) errs.push('Phone number looks incomplete.');
  req('email', EMAIL_REGEX.test(input.email), 'A valid email is required.');
  if (input.email.trim() && !EMAIL_REGEX.test(input.email)) errs.push('Email format is invalid.');
  req('address', !!(input.address.line1.trim() && input.address.city.trim() && input.address.state.trim() && /^\d{6}$/.test(input.address.pincode)), 'Address, city, state and a 6-digit PIN are required.');
  req('institutionType', !!input.institution.institutionType, 'Institution type is required.');
  req('ownership', !!input.institution.ownership, 'Ownership is required.');
  req('bedCount', (input.institution.bedCount ?? 0) > 0, 'Bed count is required.');
  req('registrationNo', !!input.institution.registrationNo.trim(), 'Registration number is required.');
  req('drugLicenseNo', !!input.institution.drugLicenseNo.trim(), 'Drug licence number is required.');
  req('procurementContact', !!input.institution.procurementContact.trim(), 'Procurement contact is required.');
  req('hospitalGroup', !!(input.institution.hospitalGroup ?? '').trim(), 'Hospital group is required.');
  return errs;
};

export const partnerService = {
  list: () => mockCall(() => readDb().partners),
  listMappings: () => mockCall(() => readDb().mappings),
  listFlowOverrides: () => mockCall(() => readDb().flowOverrides),

  suggestCode: () => mockCall(() => {
    const db = readDb();
    let n = db.partners.length + 1;
    let code = `PTR-${String(n).padStart(4, '0')}`;
    while (db.partners.some((p) => p.code === code)) code = `PTR-${String(++n).padStart(4, '0')}`;
    return code;
  }, 50),

  saveDraft: (id: string | null, input: PartnerInput, extras: OnboardingExtras, step: number, actor: string) => mockCall(() => mutateDb(['partners'], (d) => {
    if (!input.name.trim()) throw new ServiceError('Enter at least the partner name to save a draft.');
    if (input.code && d.partners.some((p) => p.id !== id && p.code.toLowerCase() === input.code.trim().toLowerCase())) throw new ServiceError(`Partner code "${input.code}" already exists.`);
    const now = nowISO();
    const existing = id ? d.partners.find((p) => p.id === id) : undefined;
    if (existing && !['Draft', 'KYC Pending'].includes(existing.status)) throw new ServiceError(`Partner is ${existing.status}; it can no longer be edited through onboarding.`);
    const base = {
      ...input, code: input.code.trim().toUpperCase(), gst: input.gst.toUpperCase(), pan: input.pan.toUpperCase(),
      flowIds: extras.flowSelections.map((s) => s.flowId), onboarding: extras, draftStep: step, updatedAt: now, updatedBy: actor,
    };
    if (existing) {
      Object.assign(existing, base);
      return existing;
    }
    const p: Partner = {
      id: uid('ptr'), ...base, kycStatus: 'Pending', status: 'Draft', submittedAt: null, activatedAt: null, createdAt: now, createdBy: actor,
    };
    d.partners.push(p);
    return p;
  })),

  submit: (id: string, actor: string) => mockCall(() => mutateDb(['partners', 'mappings', 'terms', 'approvals'], (d) => {
    const p = d.partners.find((x) => x.id === id);
    if (!p) throw new ServiceError('Partner not found.');
    if (!['Draft', 'KYC Pending'].includes(p.status)) throw new ServiceError(`Partner is already ${p.status}.`);
    const extras = p.onboarding ?? emptyExtras();
    const errs = validateBasicDetails(p, d, p.id);
    if (!p.gstVerification || p.gstVerification.gstin !== p.gst.toUpperCase()) errs.push('Verify the GSTIN against the GST registry before submitting.');
    else if (p.gstVerification.status !== 'Active') errs.push(`GST registration is ${p.gstVerification.status}; the partner cannot be onboarded.`);
    if (!p.territoryIds.length) errs.push('Assign at least one territory.');
    const chId = partnerChannelId(p, d.config.partnerTypes);
    if (!chId) errs.push('Partner type is not linked to a sales channel.');

    // Validate actual partner mapping (server-side re-check)
    extras.flowSelections.forEach((sel) => {
      const flow = d.flows.find((f) => f.id === sel.flowId);
      if (!flow || flow.status !== 'Active') { errs.push('A selected sales policy is no longer active.'); return; }
      if (sel.suppliers) {
        // Neighbours-only: validate the partner's own suppliers and direct customers
        validateLinks(sel.suppliers, sel.customers ?? [], flow, chId, d.channels, [], d.config.flowRules.blockedConnections).filter((i) => i.severity === 'error').forEach((i) => errs.push(`${flow.name}: ${i.message}`));
        const check = (partnerIds: string[], channelId: string | null) => {
          const ch = d.channels.find((c) => c.id === channelId);
          const stage = { id: channelId ?? 'x', kind: 'CHANNEL' as const, channelId, label: ch?.name ?? '', allowMultiplePartners: true };
          evaluateStageEligibility(stage, d.partners.filter((x) => partnerIds.includes(x.id)), p.territoryIds, d.config.partnerTypes, d.territories, d.config.eligibility, p.id, !!ch?.canBeEndpoint)
            .filter((c) => !c.eligible).forEach((c) => errs.push(`${flow.name}: ${c.partner.name} is not eligible (${c.reasons.join(', ')}).`));
        };
        sel.suppliers.filter((x) => x.kind === 'PARTNER' && x.partnerId).forEach((x) => {
          if (x.partnerId === p.id) errs.push(`${flow.name}: a partner cannot supply itself.`);
          check([x.partnerId!], x.channelId);
        });
        (sel.customers ?? []).forEach((c) => check(c.partnerIds, c.channelId));
        return;
      }
      if (sel.route) {
        // Route-based (route builder): validate the partner's own route against the sales policy
        validateRoute(sel.route, flow, d.channels, d.config.flowRules, chId).filter((i) => i.severity === 'error').forEach((i) => errs.push(`${flow.name}: ${i.message}`));
        sel.route.filter((r) => r.kind === 'CHANNEL' && r.partnerIds.length).forEach((r) => {
          const ch = d.channels.find((c) => c.id === r.channelId);
          const stage = { id: r.id, kind: 'CHANNEL' as const, channelId: r.channelId ?? null, label: ch?.name ?? '', allowMultiplePartners: r.allowMultiplePartners };
          evaluateStageEligibility(stage, d.partners.filter((x) => r.partnerIds.includes(x.id)), p.territoryIds, d.config.partnerTypes, d.territories, d.config.eligibility, p.id, !!ch?.canBeEndpoint)
            .filter((c) => !c.eligible).forEach((c) => errs.push(`${flow.name}: ${c.partner.name} is not eligible (${c.reasons.join(', ')}).`));
        });
        return;
      }
      const own = flow.stages.find((s) => s.id === sel.ownStageId);
      if (!own || own.channelId !== chId) errs.push(`${flow.name}: partner type does not match its stage.`);
      if (sel.supplierStageId !== undefined && !flow.stages.some((s) => s.id === sel.supplierStageId)) errs.push(`${flow.name}: choose who the partner buys from.`);
      sel.stageAssignments.forEach((a) => {
        const stage = flow.stages.find((s) => s.id === a.stageId);
        if (!stage) return;
        if (!stage.allowMultiplePartners && a.partnerIds.length > 1) errs.push(`${flow.name}: stage "${stage.label}" allows only one partner.`);
        const endCustomer = !!d.channels.find((c) => c.id === stage.channelId)?.canBeEndpoint;
        const checks = evaluateStageEligibility(stage, d.partners.filter((x) => a.partnerIds.includes(x.id)), p.territoryIds, d.config.partnerTypes, d.territories, d.config.eligibility, p.id, endCustomer);
        checks.filter((c) => !c.eligible).forEach((c) => errs.push(`${flow.name}: ${c.partner.name} is not eligible (${c.reasons.join(', ')}).`));
      });
    });
    if (errs.length) throw new ServiceError(errs[0], errs);

    const now = nowISO();
    p.submittedAt = now;
    p.updatedAt = now;
    p.updatedBy = actor;

    // Actual relationships (separate from master topology)
    d.mappings = d.mappings.filter((m) => m.partnerId !== p.id);
    d.flowOverrides = d.flowOverrides.filter((o) => !(o.partnerId === p.id && o.approvalStatus === 'Pending'));
    extras.flowSelections.forEach((sel) => {
      const flow = d.flows.find((f) => f.id === sel.flowId)!;
      const compat = sel.suppliers ? linksCompat(sel.suppliers, sel.customers ?? [], flow, chId) : sel.route ? routeCompat(sel.route, flow, chId) : null;
      d.mappings.push({
        ...(compat ?? {}),
        route: sel.suppliers ? undefined : sel.route,
        suppliers: sel.suppliers,
        customers: sel.customers,
        id: uid('map'), partnerId: p.id, flowId: flow.id, flowVersion: flow.version, ownStageId: compat?.ownStageId ?? sel.ownStageId,
        supplierStageId: compat?.supplierStageId ?? sel.supplierStageId ?? null, supplyWarehouseId: compat?.supplyWarehouseId ?? sel.supplyWarehouseId ?? null,
        // keep downstream channels the partner sells to even if customers are mapped later
        stageAssignments: compat ? compat.stageAssignments : sel.stageAssignments.filter((a) => !sel.skippedStageIds.includes(a.stageId) && (a.partnerIds.length || a.stageId !== sel.supplierStageId)),
        status: 'Inactive', effectiveFrom: now.slice(0, 10), createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
      });
      if (sel.skippedStageIds.length) {
        const o = { id: uid('fov'), partnerId: p.id, flowId: flow.id, skippedStageIds: sel.skippedStageIds, reason: sel.overrideReason, approvalStatus: 'Pending' as ApprovalStatus, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor };
        d.flowOverrides.push(o);
        const r = createApproval(d, {
          category: 'PARTNER_FLOW_OVERRIDE', partnerId: p.id, entityType: 'FLOW_OVERRIDE', entityId: o.id,
          summary: `Flow override for ${p.name} on ${flow.name}`,
          details: [{ label: 'Bypassed stages', to: flow.stages.filter((s) => sel.skippedStageIds.includes(s.id)).map((s) => s.label).join(', ') }, { label: 'Reason', to: sel.overrideReason || '—' }],
          requestedBy: actor,
        });
        if (!r) o.approvalStatus = 'Approved';
      }
    });

    // Commercial overrides (inherit defaults; overrides need approval)
    const co = extras.commercialOverride;
    if (co && chId) {
      const channel = d.channels.find((c) => c.id === chId);
      if (channel) {
        const base = flattenResolved(resolveTerms({ channel, partnerId: p.id, territoryIds: p.territoryIds, records: d.terms, territories: d.territories }));
        raiseTermOverride(d, { scope: 'PARTNER', partnerId: p.id, channelId: chId, mappingId: null, values: co.values, reason: co.reason, effectiveFrom: co.effectiveFrom, effectiveTo: co.effectiveTo, base }, actor);
      }
    }

    // Licences that track expiry must carry a future validity date.
    const today = nowISO().slice(0, 10);
    p.kycDocuments.forEach((doc) => {
      const req = d.config.kycDocuments.find((k) => k.id === doc.docTypeId);
      if (req?.tracksExpiry && (!doc.validUntil || doc.validUntil < today)) throw new ServiceError(`${req.name}: a valid, unexpired licence with its validity date is required.`);
    });

    // KYC → approval chain
    const missing = missingMandatoryDocs(d, p.partnerTypeId, p.kycDocuments);
    if (missing.length) {
      p.status = 'KYC Pending';
      p.kycStatus = 'Pending';
    } else {
      p.status = 'KYC Under Review';
      p.kycStatus = 'Under Review';
      p.kycDocuments.forEach((doc) => { if (doc.status !== 'Verified') doc.status = 'Under Review'; });
      d.approvals = d.approvals.filter((a) => !(a.partnerId === p.id && a.status === 'Pending' && (a.category === 'KYC_VERIFICATION' || a.category === 'PARTNER_ONBOARDING')));
      createApproval(d, {
        category: 'KYC_VERIFICATION', partnerId: p.id, entityType: 'PARTNER', entityId: p.id,
        summary: `Verify KYC documents for ${p.name}`,
        details: p.kycDocuments.map((doc) => ({ label: d.config.kycDocuments.find((k) => k.id === doc.docTypeId)?.name ?? doc.docTypeId, to: doc.fileName })),
        requestedBy: actor,
      });
    }
    delete p.onboarding;
    p.draftStep = 7;
    return { partner: p, missingDocs: missing.map((m) => m.name) };
  })),

  setStatus: (id: string, status: Extract<PartnerStatus, 'Active' | 'Suspended'>, actor: string) => mockCall(() => mutateDb(['partners', 'mappings'], (d) => {
    const p = d.partners.find((x) => x.id === id);
    if (!p) throw new ServiceError('Partner not found.');
    if (status === 'Suspended' && p.status !== 'Active') throw new ServiceError('Only active partners can be suspended.');
    if (status === 'Active' && p.status !== 'Suspended') throw new ServiceError('Only suspended partners can be reactivated.');
    p.status = status;
    p.updatedAt = nowISO();
    p.updatedBy = actor;
    d.mappings.filter((m) => m.partnerId === id).forEach((m) => { m.status = status === 'Active' ? 'Active' : 'Inactive'; });
    return p;
  })),

  /**
   * Institution (hospital / end customer) onboarding — lighter than the partner wizard.
   * Active immediately, or 'Approval Pending' when the configuration requires approval.
   */
  createInstitution: (input: InstitutionInput, actor: string) => mockCall(() => mutateDb(['partners', 'approvals'], (d) => {
    const errs = validateInstitution(input, d);
    if (errs.length) throw new ServiceError(errs[0], errs);
    const cfg = d.config.institutionOnboarding;
    const now = nowISO();
    const n = d.partners.filter((p) => p.code.startsWith('INS-')).length + 1;
    let code = `INS-${String(n).padStart(4, '0')}`;
    let k = n;
    while (d.partners.some((p) => p.code === code)) code = `INS-${String(++k).padStart(4, '0')}`;
    const gv = input.gst.trim() ? input.gstVerification : null;
    const p: Partner = {
      id: uid('ptr'), code, name: input.name.trim(), partnerTypeId: input.partnerTypeId,
      contactPerson: input.contactPerson, email: input.email, phone: input.phone,
      businessName: gv?.legalName ?? input.name.trim(), address: input.address,
      gst: input.gst.toUpperCase(), pan: input.pan.toUpperCase(), gstVerification: gv,
      institution: input.institution, kycStatus: gv ? 'Verified' : 'Pending', kycDocuments: [],
      territoryIds: input.territoryIds, flowIds: [],
      status: cfg.requireApproval ? 'Approval Pending' : 'Active',
      submittedAt: now, activatedAt: cfg.requireApproval ? null : now, draftStep: 7,
      createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    };
    d.partners.push(p);
    if (cfg.requireApproval) {
      const r = createApproval(d, {
        category: 'INSTITUTION_ONBOARDING', partnerId: p.id, entityType: 'PARTNER', entityId: p.id,
        summary: `Add institution ${p.name}`,
        details: [{ label: 'Type', to: input.institution.institutionType || '—' }, { label: 'GSTIN', to: p.gst || 'Not provided' }],
        requestedBy: actor,
      });
      if (!r) { p.status = 'Active'; p.activatedAt = now; }
    }
    const saved = d.partners.find((x) => x.id === p.id)!;
    if (saved.status === 'Active') autoInvite(d, saved, actor);
    return saved;
  })),

  /** Day-2 edit of an onboarded partner: contacts, address (unless locked to the GST registry) and institution profile. */
  updateDetails: (id: string, patch: { contactPerson: string; email: string; phone: string; address: PartnerAddress; institution?: InstitutionDetails | null }, actor: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const p = d.partners.find((x) => x.id === id);
    if (!p) throw new ServiceError('Partner not found.');
    const errs: string[] = [];
    if (!patch.contactPerson.trim()) errs.push('Contact person is required.');
    if (patch.email && !EMAIL_REGEX.test(patch.email)) errs.push('Enter a valid email.');
    if (patch.phone.replace(/\D/g, '').length < 10) errs.push('Enter a valid phone number.');
    const locked = !!p.gstVerification && p.gstVerification.status === 'Active';
    if (!locked && patch.address.pincode && !/^\d{6}$/.test(patch.address.pincode)) errs.push('PIN code must be 6 digits.');
    if (errs.length) throw new ServiceError(errs[0], errs);
    p.contactPerson = patch.contactPerson.trim(); p.email = patch.email.trim(); p.phone = patch.phone.trim();
    if (!locked) p.address = patch.address;
    if (p.institution && patch.institution) p.institution = patch.institution;
    p.updatedAt = nowISO(); p.updatedBy = actor;
    return p;
  })),

  removeDraft: (id: string) => mockCall(() => mutateDb(['partners'], (d) => {
    const p = d.partners.find((x) => x.id === id);
    if (!p) throw new ServiceError('Partner not found.');
    if (p.status !== 'Draft') throw new ServiceError('Only drafts can be deleted.');
    d.partners = d.partners.filter((x) => x.id !== id);
    return true;
  })),
};
