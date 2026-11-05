/**
 * Partner Onboarding wizard — local state model, validation and preview helpers.
 * Pure functions only; persistence goes through partnerService.
 */
import type {
  ApprovalCategory, CommercialValues, GtmConfiguration, OnboardingExtras, Partner, ProductScope, SalesChannel, SalesFlow,
} from '../../types';
import type { PartnerInput } from '../../services';
import { EMAIL_REGEX, GST_REGEX, PAN_REGEX } from '../../services';
import { formatINR } from '../../utils/format';
import { validateRoute } from '../../utils/route';
import { validateLinks } from '../../utils/supply';

export const STEPS = ['Basic Details', 'Territories', 'Products', 'Partner Type & Route', 'KYC', 'Commercial Terms', 'Review & Submit'];

/** Named step indexes — use these instead of numbers. */
export const STEP = { BASIC: 0, TERRITORIES: 1, PRODUCTS: 2, ROUTE: 3, KYC: 4, COMMERCIAL: 5, REVIEW: 6 } as const;

export const emptyScope = (): ProductScope => ({ allProducts: false, portfolioIds: [], categoryIds: [], subCategoryIds: [], productIds: [] });
export const scopeIsEmpty = (p?: ProductScope | null) => !p || (!p.allProducts && !p.portfolioIds.length && !p.categoryIds.length && !p.subCategoryIds.length && !p.productIds.length);

export interface WizardState {
  id: string | null;
  input: PartnerInput;
  extras: OnboardingExtras;
}

export const emptyInput = (): PartnerInput => ({
  code: '', name: '', partnerTypeId: '', contactPerson: '', email: '', phone: '', businessName: '',
  address: { line1: '', city: '', state: '', pincode: '' }, gst: '', pan: '', gstVerification: null, productScope: emptyScope(), kycDocuments: [], territoryIds: [],
});

export const emptyExtras = (): OnboardingExtras => ({ flowSelections: [], commercialOverride: null });

export const stateFromPartner = (p: Partner): WizardState => ({
  id: p.id,
  input: {
    code: p.code, name: p.name, partnerTypeId: p.partnerTypeId, contactPerson: p.contactPerson, email: p.email, phone: p.phone,
    businessName: p.businessName, address: { ...p.address }, gst: p.gst, pan: p.pan, gstVerification: p.gstVerification ?? null, productScope: p.productScope ? structuredClone(p.productScope) : emptyScope(), kycDocuments: structuredClone(p.kycDocuments), territoryIds: [...p.territoryIds],
  },
  extras: p.onboarding ? structuredClone(p.onboarding) : {
    // KYC-Pending partners were already submitted: rebuild selections from flowIds (mappings re-entered on resubmit)
    flowSelections: [], commercialOverride: null,
  },
});

export type FieldErrors = Partial<Record<'code' | 'name' | 'partnerTypeId' | 'contactPerson' | 'email' | 'phone' | 'businessName' | 'line1' | 'city' | 'state' | 'pincode' | 'gst' | 'pan', string>>;

/** Client-side per-field validation (mirrors partnerService.validateBasicDetails). */
export const validateBasic = (input: PartnerInput, partners: Partner[], id: string | null): FieldErrors => {
  const e: FieldErrors = {};
  if (!input.name.trim()) e.name = 'Partner name is required.';
  if (!input.code.trim()) e.code = 'Partner code is required.';
  else if (partners.some((p) => p.id !== id && p.code.toLowerCase() === input.code.trim().toLowerCase())) e.code = `Code "${input.code}" already exists.`;
  if (!input.contactPerson.trim()) e.contactPerson = 'Contact person is required.';
  if (!EMAIL_REGEX.test(input.email)) e.email = 'Enter a valid email.';
  if (input.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number (10+ digits).';
  if (!input.businessName.trim()) e.businessName = 'Business name is required.';
  if (!input.address.line1.trim()) e.line1 = 'Address is required.';
  if (!input.address.city.trim()) e.city = 'City is required.';
  if (!input.address.state.trim()) e.state = 'State is required.';
  if (!/^\d{6}$/.test(input.address.pincode)) e.pincode = 'PIN code must be 6 digits.';
  const gst = input.gst.toUpperCase();
  const pan = input.pan.toUpperCase();
  if (!GST_REGEX.test(gst)) e.gst = 'Invalid GSTIN (e.g. 36AAECC5521M1ZK).';
  else if (!input.gstVerification || input.gstVerification.gstin !== gst) e.gst = 'Verify the GSTIN to fetch registered details.';
  else if (input.gstVerification.status !== 'Active') e.gst = `GST registration is ${input.gstVerification.status} — cannot onboard.`;
  if (!PAN_REGEX.test(pan)) e.pan = 'Invalid PAN (e.g. ABCDE1234F).';
  else if (GST_REGEX.test(gst) && gst.slice(2, 12) !== pan) e.pan = 'PAN must match characters 3–12 of the GSTIN.';
  return e;
};

/** Returns blocking messages for a step (empty = can proceed). */
export const validateStep = (step: number, s: WizardState, partners: Partner[], flows: SalesFlow[], ctx?: { channels: SalesChannel[]; config?: GtmConfiguration }): string[] => {
  switch (step) {
    case STEP.BASIC: return Object.values(validateBasic(s.input, partners, s.id)) as string[];
    case STEP.TERRITORIES: return s.input.territoryIds.length ? [] : ['Select at least one territory.'];
    case STEP.PRODUCTS: return scopeIsEmpty(s.input.productScope) ? ['Select at least one portfolio, category or product the partner will deal in.'] : [];
    case STEP.ROUTE: {
      const out: string[] = [];
      if (!s.input.partnerTypeId) out.push('Select a partner type.');
      s.extras.flowSelections.forEach((sel) => {
        const flow = flows.find((f) => f.id === sel.flowId);
        if (!flow) return;
        if (sel.suppliers && ctx?.config) {
          const chId = ctx.config.partnerTypes.find((t) => t.id === s.input.partnerTypeId)?.channelId ?? null;
          validateLinks(sel.suppliers, sel.customers ?? [], flow, chId, ctx.channels, [], ctx.config.flowRules.blockedConnections).filter((i) => i.severity === 'error').forEach((i) => out.push(`${flow.name}: ${i.message}`));
          return;
        }
        if (sel.route && ctx?.config) {
          const chId = ctx.config.partnerTypes.find((t) => t.id === s.input.partnerTypeId)?.channelId ?? null;
          validateRoute(sel.route, flow, ctx.channels, ctx.config.flowRules, chId).filter((i) => i.severity === 'error').forEach((i) => out.push(`${flow.name}: ${i.message}`));
          return;
        }
        if (!sel.ownStageId) out.push(`${flow.name}: the partner type is not part of this flow.`);
        if (!sel.supplierStageId) out.push(`${flow.name}: choose who the partner buys from.`);
        sel.stageAssignments.forEach((a) => {
          const st = flow.stages.find((x) => x.id === a.stageId);
          if (st && !st.allowMultiplePartners && a.partnerIds.length > 1) out.push(`${flow.name}: only one ${st.label} can be selected.`);
        });
      });
      return out;
    }
    case STEP.KYC: {
      const out: string[] = [];
      const today = new Date().toISOString().slice(0, 10);
      s.input.kycDocuments.forEach((d) => {
        const req = ctx?.config?.kycDocuments.find((k) => k.id === d.docTypeId);
        if (!req?.tracksExpiry) return;
        if (!d.validUntil) out.push(`${req.name}: enter the validity date.`);
        else if (d.validUntil < today) out.push(`${req.name}: the licence has already expired — upload a valid copy.`);
      });
      return out;
    }
    case STEP.COMMERCIAL: {
      const co = s.extras.commercialOverride;
      if (!co || !Object.keys(co.values).length) return [];
      const out: string[] = [];
      if (!co.reason.trim()) out.push('An override reason is required.');
      if (!co.effectiveFrom) out.push('Effective from date is required.');
      if (co.effectiveTo && co.effectiveTo < co.effectiveFrom) out.push('Effective to must be after effective from.');
      const v = co.values;
      if (v.standardDiscountPct !== undefined && (v.standardDiscountPct < 0 || v.standardDiscountPct > 100)) out.push('Discount must be between 0 and 100%.');
      if (v.creditLimit !== undefined && v.creditLimit < 0) out.push('Credit limit cannot be negative.');
      if (v.creditPeriodDays !== undefined && v.creditPeriodDays < 0) out.push('Credit period cannot be negative.');
      return out;
    }
    default: return [];
  }
};

/** Predicts which approval categories a commercial override will raise (mirrors service logic). */
export const predictTermCategories = (base: CommercialValues, next: Partial<CommercialValues>) => {
  const out: { cat: ApprovalCategory; label: string; from: string; to: string }[] = [];
  if (next.standardDiscountPct !== undefined && next.standardDiscountPct !== base.standardDiscountPct) out.push({ cat: 'DISCOUNT_OVERRIDE', label: 'Discount %', from: `${base.standardDiscountPct}%`, to: `${next.standardDiscountPct}%` });
  if (next.creditLimit !== undefined && next.creditLimit !== base.creditLimit) out.push({ cat: 'CREDIT_LIMIT_CHANGE', label: 'Credit limit', from: formatINR(base.creditLimit), to: formatINR(next.creditLimit) });
  if (next.creditPeriodDays !== undefined && next.creditPeriodDays !== base.creditPeriodDays) out.push({ cat: 'CREDIT_PERIOD_EXTENSION', label: 'Credit period', from: `${base.creditPeriodDays} days`, to: `${next.creditPeriodDays} days` });
  const waived = (next.depositRequired === false && base.depositRequired) || (next.depositAmount !== undefined && next.depositAmount < base.depositAmount);
  if (waived) out.push({ cat: 'DEPOSIT_WAIVER', label: 'Deposit', from: base.depositRequired ? formatINR(base.depositAmount) : 'Not required', to: next.depositRequired === false ? 'Waived' : formatINR(next.depositAmount ?? 0) });
  return out;
};

export const workflowLabel = (config: GtmConfiguration | undefined, cat: ApprovalCategory) => {
  const wf = config?.approvalWorkflows.find((w) => w.category === cat);
  return { label: wf?.label ?? cat, enabled: !!wf?.enabled, levels: wf?.levels ?? [] };
};
