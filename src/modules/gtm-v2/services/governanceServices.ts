/**
 * Commercial terms, approvals and configuration services.
 */
import type { CommercialValues, GtmConfiguration } from '../types';
import { mockCall, ServiceError } from './apiClient';
import { mutateDb, nowISO, readDb } from './mockDb';
import { applyApprovalOutcome } from './approvalEngine';
import { raiseTermOverride } from './partnerService';
import { flattenResolved, resolveTerms } from '../utils/commercial';
import { uid } from '../utils/format';

/* ============================ Commercial Terms ============================ */

export interface TermOverrideInput {
  scope: 'TERRITORY' | 'PARTNER' | 'RELATIONSHIP';
  channelId: string;
  territoryId: string | null;
  partnerId: string | null;
  mappingId: string | null;
  values: Partial<CommercialValues>;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export const commercialService = {
  list: () => mockCall(() => readDb().terms),

  /**
   * TERRITORY terms are master configuration (authorised users, no approval).
   * PARTNER / RELATIONSHIP overrides raise approval requests per changed field.
   */
  create: (input: TermOverrideInput, actor: string) => mockCall(() => mutateDb(['terms', 'approvals'], (d) => {
    if (!Object.keys(input.values).length) throw new ServiceError('Change at least one commercial value.');
    if (!input.reason.trim()) throw new ServiceError('An override reason is required.');
    if (!input.effectiveFrom) throw new ServiceError('Effective from date is required.');
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) throw new ServiceError('Effective to must be after effective from.');
    const channel = d.channels.find((c) => c.id === input.channelId);
    if (!channel) throw new ServiceError('Select a sales channel.');
    const v = input.values;
    if (v.standardDiscountPct !== undefined && (v.standardDiscountPct < 0 || v.standardDiscountPct > 100)) throw new ServiceError('Discount must be between 0 and 100%.');
    if (v.depositRequired && (v.depositAmount ?? channel.terms.depositAmount) <= 0) throw new ServiceError('Deposit amount is required when deposit is mandatory.');
    const now = nowISO();

    if (input.scope === 'TERRITORY') {
      if (!input.territoryId) throw new ServiceError('Select a territory.');
      const rec = { id: uid('term'), ...input, partnerId: null, mappingId: null, overrideReason: input.reason, requestedBy: actor, approvalStatus: 'Not Required' as const, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor };
      d.terms.push(rec);
      return { record: rec, pendingApproval: false };
    }

    if (!input.partnerId) throw new ServiceError('Select a partner.');
    const partner = d.partners.find((p) => p.id === input.partnerId);
    if (!partner) throw new ServiceError('Partner not found.');
    if (input.scope === 'RELATIONSHIP' && !input.mappingId) throw new ServiceError('Select a partner supply link (sales policy).');
    const base = flattenResolved(resolveTerms({ channel, partnerId: partner.id, mappingId: input.scope === 'RELATIONSHIP' ? input.mappingId : null, territoryIds: partner.territoryIds, records: d.terms, territories: d.territories }));
    const rec = raiseTermOverride(d, { scope: input.scope, partnerId: partner.id, channelId: channel.id, mappingId: input.mappingId, values: input.values, reason: input.reason, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, base }, actor);
    if (!rec) throw new ServiceError('Values are identical to the inherited terms — nothing to override.');
    return { record: rec, pendingApproval: rec.approvalStatus === 'Pending' };
  })),

  /** End-date (retire) a record instead of deleting — keeps history intact. */
  expire: (id: string, actor: string) => mockCall(() => mutateDb(['terms'], (d) => {
    const r = d.terms.find((t) => t.id === id);
    if (!r) throw new ServiceError('Record not found.');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    r.effectiveTo = yesterday < r.effectiveFrom ? r.effectiveFrom : yesterday;
    r.updatedAt = nowISO();
    r.updatedBy = actor;
    return r;
  })),
};

/* ================================ Approvals =============================== */

export const approvalService = {
  list: () => mockCall(() => readDb().approvals),

  act: (id: string, decision: 'Approved' | 'Rejected', comments: string, actor: string) => mockCall(() => mutateDb(['approvals', 'partners', 'terms', 'mappings'], (d) => {
    const req = d.approvals.find((a) => a.id === id);
    if (!req) throw new ServiceError('Request not found.');
    if (req.status !== 'Pending') throw new ServiceError(`Request is already ${req.status}.`);
    if (decision === 'Rejected' && !comments.trim()) throw new ServiceError('A rejection reason is required.');
    const step = req.steps.find((s) => s.level === req.currentLevel);
    if (!step) throw new ServiceError('Approval step not found.');
    const now = nowISO();
    Object.assign(step, { status: decision, actedBy: actor, actedAt: now, comments });
    if (decision === 'Rejected') {
      req.status = 'Rejected';
      applyApprovalOutcome(d, req, 'Rejected', actor);
      return { final: true, status: req.status };
    }
    const next = req.steps.find((s) => s.level === req.currentLevel + 1);
    if (next) {
      next.status = 'Pending';
      req.currentLevel += 1;
      return { final: false, status: req.status, nextRole: next.role };
    }
    req.status = 'Approved';
    applyApprovalOutcome(d, req, 'Approved', actor);
    return { final: true, status: req.status };
  })),
};

/* ============================== Configuration ============================= */

export const configService = {
  get: () => mockCall(() => readDb().config),

  update: <K extends keyof GtmConfiguration>(section: K, value: GtmConfiguration[K], actor: string) => mockCall(() => mutateDb(['config'], (d) => {
    if (section === 'partnerTypes') {
      const list = value as GtmConfiguration['partnerTypes'];
      const codes = list.map((p) => p.code.toLowerCase());
      if (new Set(codes).size !== codes.length) throw new ServiceError('Partner type codes must be unique.');
      if (list.some((p) => !p.name.trim() || !p.channelId)) throw new ServiceError('Each partner type needs a name and a sales channel.');
      const removed = d.config.partnerTypes.filter((p) => !list.some((n) => n.id === p.id));
      const inUse = removed.filter((r) => d.partners.some((p) => p.partnerTypeId === r.id));
      if (inUse.length) throw new ServiceError(`Partner type "${inUse[0].name}" is used by partners. Deactivate it instead.`);
    }
    if (section === 'territoryRules') {
      const tr = value as GtmConfiguration['territoryRules'];
      if (tr.levelLabels.some((l) => !l.label.trim())) throw new ServiceError('Level labels cannot be empty.');
    }
    if (section === 'flowRules') {
      const fr = value as GtmConfiguration['flowRules'];
      if (fr.minStages < 2) throw new ServiceError('A flow needs at least 2 stages (source and destination).');
      if (fr.maxStages !== null && fr.maxStages < fr.minStages) throw new ServiceError('Max stages must be ≥ min stages.');
    }
    if (section === 'approvalWorkflows') {
      const wf = value as GtmConfiguration['approvalWorkflows'];
      if (wf.some((w) => w.enabled && (!w.levels.length || w.levels.some((l) => !l.trim())))) throw new ServiceError('Enabled workflows need at least one named approval level.');
    }
    d.config[section] = value;
    void actor;
    return d.config;
  })),
};
