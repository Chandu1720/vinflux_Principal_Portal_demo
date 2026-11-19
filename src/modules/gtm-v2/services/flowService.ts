/**
 * Sales Policies (MASTER) service.
 * Master flows are never modified by partner onboarding — partner relationships live in
 * PartnerFlowMapping / PartnerFlowOverride (see partnerService).
 */
import type { FlowStage, FlowStatus, ProductScope, SalesFlow } from '../types';
import { mockCall, ServiceError } from './apiClient';
import { mutateDb, nowISO, readDb } from './mockDb';
import { stageSummary, validateFlowStages } from '../utils/flow';
import { uid } from '../utils/format';

export interface FlowInput {
  code: string;
  name: string;
  description: string;
  status: FlowStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  stages: FlowStage[];
  territoryIds: string[];
  zoneIds: string[];
  productScope: ProductScope;
}

const validate = (input: FlowInput, id: string | null) => {
  const db = readDb();
  const errs: string[] = [];
  if (!input.name.trim()) errs.push('Policy name is required.');
  if (!input.code.trim()) errs.push('Policy code is required.');
  if (db.flows.some((f) => f.id !== id && f.code.toLowerCase() === input.code.trim().toLowerCase())) errs.push(`Flow code "${input.code}" already exists.`);
  if (!input.effectiveFrom) errs.push('Effective from date is required.');
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) errs.push('Effective to must be after effective from.');
  if (input.status === 'Active') {
    if (!input.territoryIds.length && !input.zoneIds.length) errs.push('Assign at least one territory or zone before activating.');
    const ps = input.productScope;
    if (!ps.allProducts && !ps.portfolioIds.length && !ps.categoryIds.length && !ps.subCategoryIds.length && !ps.productIds.length) {
      errs.push('Select applicable products (or "All products") before activating.');
    }
  }
  const stageErrors = validateFlowStages(input.stages, db.channels, db.config.flowRules).filter((i) => i.severity === 'error');
  stageErrors.forEach((e) => errs.push(e.message));
  if (errs.length) throw new ServiceError(errs[0], errs);
};

export const flowService = {
  list: () => mockCall(() => readDb().flows),

  create: (input: FlowInput, actor: string) => mockCall(() => mutateDb(['flows'], (d) => {
    validate(input, null);
    const now = nowISO();
    const f: SalesFlow = {
      id: uid('flow'), ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), version: 1,
      history: [{ version: 1, changedAt: now, changedBy: actor, note: 'Flow created', stageSummary: stageSummary(input.stages, d.channels) }],
      createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    };
    d.flows.push(f);
    return f;
  })),

  /**
   * Structural changes (stages / coverage / products) bump the version.
   * Existing partner mappings keep the version they were created on and are flagged for review.
   */
  update: (id: string, input: FlowInput, note: string, actor: string) => mockCall(() => mutateDb(['flows'], (d) => {
    validate(input, id);
    const f = d.flows.find((x) => x.id === id);
    if (!f) throw new ServiceError('Flow not found.');
    const structural = JSON.stringify([f.stages, f.territoryIds, f.zoneIds, f.productScope]) !== JSON.stringify([input.stages, input.territoryIds, input.zoneIds, input.productScope]);
    if (structural) {
      const removed = f.stages.filter((s) => !input.stages.some((n) => n.id === s.id)).map((s) => s.id);
      const blocking = d.mappings.filter((m) => m.flowId === id && m.status === 'Active' && removed.includes(m.ownStageId));
      if (blocking.length) throw new ServiceError(`Cannot remove a stage occupied by ${blocking.length} active partner(s). Create a new flow version or reassign partners first.`);
    }
    const now = nowISO();
    if (structural) {
      f.version += 1;
      f.history.push({ version: f.version, changedAt: now, changedBy: actor, note: note || 'Flow updated', stageSummary: stageSummary(input.stages, d.channels) });
    }
    Object.assign(f, { ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), updatedAt: now, updatedBy: actor });
    return { flow: f, versioned: structural };
  })),

  setStatus: (id: string, status: FlowStatus, actor: string) => mockCall(() => mutateDb(['flows'], (d) => {
    const f = d.flows.find((x) => x.id === id);
    if (!f) throw new ServiceError('Flow not found.');
    if (status === 'Active') validate({ ...f, status }, id);
    if (status === 'Inactive') {
      const active = d.mappings.filter((m) => m.flowId === id && m.status === 'Active').length;
      if (active) throw new ServiceError(`${active} active partner relationship(s) use this flow. Reassign them before deactivating.`);
    }
    Object.assign(f, { status, updatedAt: nowISO(), updatedBy: actor });
    return f;
  })),

  duplicate: (id: string, actor: string) => mockCall(() => mutateDb(['flows'], (d) => {
    const f = d.flows.find((x) => x.id === id);
    if (!f) throw new ServiceError('Flow not found.');
    const now = nowISO();
    let code = `${f.code}-COPY`;
    let i = 2;
    while (d.flows.some((x) => x.code === code)) code = `${f.code}-COPY${i++}`;
    const copy: SalesFlow = {
      ...structuredClone(f), id: uid('flow'), code, name: `${f.name} (Copy)`, status: 'Draft', version: 1,
      history: [{ version: 1, changedAt: now, changedBy: actor, note: `Duplicated from ${f.code}`, stageSummary: stageSummary(f.stages, d.channels) }],
      createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    };
    d.flows.push(copy);
    return copy;
  })),

  remove: (id: string) => mockCall(() => mutateDb(['flows'], (d) => {
    const used = d.mappings.filter((m) => m.flowId === id).length + d.partners.filter((p) => p.flowIds.includes(id)).length;
    if (used) throw new ServiceError('Flow is referenced by partner relationships. Deactivate it instead.');
    d.flows = d.flows.filter((f) => f.id !== id);
    return true;
  })),
};
