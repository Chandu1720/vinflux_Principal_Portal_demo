/**
 * Master configuration services: Territories, Zones, Sales Channels.
 * Each function maps 1:1 to a REST endpoint (see ENDPOINTS in apiClient.ts).
 */
import type { ChannelTerms, RecordStatus, SalesChannel, Territory, Zone } from '../types';
import { mockCall, ServiceError } from './apiClient';
import { mutateDb, nowISO, readDb } from './mockDb';
import { getDepth, wouldCreateCycle } from '../utils/territory';
import { uid } from '../utils/format';

/* ============================== Territories ============================== */

export interface TerritoryInput {
  code: string;
  name: string;
  description: string;
  parentId: string | null;
  status: RecordStatus;
}

export interface TerritoryDependencies {
  children: number;
  zones: string[];
  flows: string[];
  partners: string[];
  terms: number;
}

const validateTerritory = (input: TerritoryInput, items: Territory[], id: string | null, rules = readDb().config.territoryRules) => {
  const errs: string[] = [];
  const code = rules.codeUppercase ? input.code.trim().toUpperCase() : input.code.trim();
  if (!code) errs.push('Territory code is required.');
  if (!input.name.trim()) errs.push('Territory name is required.');
  if (code && items.some((t) => t.id !== id && t.code.toLowerCase() === code.toLowerCase())) errs.push(`Territory code "${code}" already exists.`);
  if (rules.uniqueNameWithinParent && items.some((t) => t.id !== id && t.parentId === input.parentId && t.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
    errs.push(`A territory named "${input.name.trim()}" already exists under the same parent.`);
  }
  if (input.parentId && !items.some((t) => t.id === input.parentId)) errs.push('Selected parent territory does not exist.');
  if (id && wouldCreateCycle(id, input.parentId, items)) errs.push('Circular relationship: a territory cannot be moved under itself or one of its descendants.');
  if (rules.maxDepth !== null && input.parentId) {
    const depth = getDepth(input.parentId, items) + 1;
    if (depth >= rules.maxDepth) errs.push(`Maximum hierarchy depth (${rules.maxDepth} levels) exceeded.`);
  }
  if (errs.length) throw new ServiceError(errs[0], errs);
  return code;
};

export const territoryService = {
  list: () => mockCall(() => readDb().territories),

  dependencies: (id: string) => mockCall((): TerritoryDependencies => {
    const db = readDb();
    return {
      children: db.territories.filter((t) => t.parentId === id).length,
      zones: db.zones.filter((z) => z.territoryIds.includes(id)).map((z) => z.name),
      flows: db.flows.filter((f) => f.territoryIds.includes(id)).map((f) => f.name),
      partners: db.partners.filter((p) => p.territoryIds.includes(id)).map((p) => p.name),
      terms: db.terms.filter((t) => t.territoryId === id).length,
    };
  }, 80),

  create: (input: TerritoryInput, actor: string) => mockCall(() => mutateDb(['territories'], (d) => {
    const code = validateTerritory(input, d.territories, null);
    if (input.parentId && input.status === 'Active' && d.territories.find((t) => t.id === input.parentId)?.status === 'Inactive') {
      throw new ServiceError('Cannot create an active territory under an inactive parent.');
    }
    const now = nowISO();
    const t: Territory = { id: uid('ter'), ...input, code, name: input.name.trim(), createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor };
    d.territories.push(t);
    return t;
  })),

  update: (id: string, input: TerritoryInput, actor: string) => mockCall(() => mutateDb(['territories'], (d) => {
    const code = validateTerritory(input, d.territories, id);
    const t = d.territories.find((x) => x.id === id);
    if (!t) throw new ServiceError('Territory not found.');
    Object.assign(t, input, { code, name: input.name.trim(), updatedAt: nowISO(), updatedBy: actor });
    return t;
  })),

  /** Deactivating cascades to descendants; activating requires an active parent. */
  setStatus: (id: string, status: RecordStatus, actor: string) => mockCall(() => mutateDb(['territories'], (d) => {
    const t = d.territories.find((x) => x.id === id);
    if (!t) throw new ServiceError('Territory not found.');
    const now = nowISO();
    if (status === 'Active') {
      const parent = d.territories.find((x) => x.id === t.parentId);
      if (parent && parent.status !== 'Active') throw new ServiceError(`Activate the parent "${parent.name}" first.`);
      Object.assign(t, { status, updatedAt: now, updatedBy: actor });
      return 1;
    }
    const stack = [id];
    let count = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      const node = d.territories.find((x) => x.id === cur);
      if (node && node.status !== 'Inactive') { Object.assign(node, { status: 'Inactive', updatedAt: now, updatedBy: actor }); count++; }
      d.territories.filter((x) => x.parentId === cur).forEach((c) => stack.push(c.id));
    }
    return count;
  })),

  remove: (id: string) => mockCall(() => mutateDb(['territories'], (d) => {
    const blockers: string[] = [];
    if (d.territories.some((t) => t.parentId === id)) blockers.push('has child territories');
    if (d.zones.some((z) => z.territoryIds.includes(id))) blockers.push('is assigned to zones');
    if (d.flows.some((f) => f.territoryIds.includes(id))) blockers.push('is used by sales policies');
    if (d.partners.some((p) => p.territoryIds.includes(id))) blockers.push('is assigned to partners');
    if (d.terms.some((t) => t.territoryId === id)) blockers.push('has territory commercial terms');
    if (blockers.length) throw new ServiceError(`Cannot delete: territory ${blockers.join(', ')}. Deactivate it instead.`, blockers);
    d.territories = d.territories.filter((t) => t.id !== id);
    return true;
  })),
};

/* ================================= Zones ================================= */

export interface ZoneInput {
  code: string;
  name: string;
  description: string;
  status: RecordStatus;
  territoryIds: string[];
}

const validateZone = (input: ZoneInput, items: Zone[], id: string | null) => {
  if (!input.name.trim()) throw new ServiceError('Zone name is required.');
  if (!input.code.trim()) throw new ServiceError('Zone code is required.');
  if (items.some((z) => z.id !== id && z.code.toLowerCase() === input.code.trim().toLowerCase())) throw new ServiceError(`Zone code "${input.code}" already exists.`);
  if (items.some((z) => z.id !== id && z.name.toLowerCase() === input.name.trim().toLowerCase())) throw new ServiceError(`Zone "${input.name}" already exists.`);
  if (!input.territoryIds.length) throw new ServiceError('Assign at least one territory to the zone.');
};

export const zoneService = {
  list: () => mockCall(() => readDb().zones),
  create: (input: ZoneInput, actor: string) => mockCall(() => mutateDb(['zones'], (d) => {
    validateZone(input, d.zones, null);
    const now = nowISO();
    const z: Zone = { id: uid('zone'), ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor };
    d.zones.push(z);
    return z;
  })),
  update: (id: string, input: ZoneInput, actor: string) => mockCall(() => mutateDb(['zones'], (d) => {
    validateZone(input, d.zones, id);
    const z = d.zones.find((x) => x.id === id);
    if (!z) throw new ServiceError('Zone not found.');
    Object.assign(z, input, { code: input.code.trim().toUpperCase(), name: input.name.trim(), updatedAt: nowISO(), updatedBy: actor });
    return z;
  })),
  setStatus: (id: string, status: RecordStatus, actor: string) => mockCall(() => mutateDb(['zones'], (d) => {
    const z = d.zones.find((x) => x.id === id);
    if (!z) throw new ServiceError('Zone not found.');
    if (status === 'Inactive') {
      const used = d.flows.filter((f) => f.status === 'Active' && f.zoneIds.includes(id));
      if (used.length) throw new ServiceError(`Zone is used by active sales policies: ${used.map((f) => f.name).join(', ')}.`);
    }
    Object.assign(z, { status, updatedAt: nowISO(), updatedBy: actor });
    return z;
  })),
};

/* ============================ Sales Channels ============================= */

export interface ChannelInput {
  code: string;
  name: string;
  description: string;
  tierRank: number;
  canBeEndpoint: boolean;
  tradeModel?: 'RESELL' | 'AGENT';
  status: RecordStatus;
  terms: ChannelTerms;
}

const validateChannel = (input: ChannelInput, items: SalesChannel[], id: string | null) => {
  const errs: string[] = [];
  if (!input.name.trim()) errs.push('Channel name is required.');
  if (!input.code.trim()) errs.push('Channel code is required.');
  if (items.some((c) => c.id !== id && c.code.toLowerCase() === input.code.trim().toLowerCase())) errs.push(`Channel code "${input.code}" already exists.`);
  if (items.some((c) => c.id !== id && c.name.toLowerCase() === input.name.trim().toLowerCase())) errs.push(`Channel "${input.name}" already exists.`);
  const t = input.terms;
  if (t.standardDiscountPct < 0 || t.standardDiscountPct > 100) errs.push('Discount must be between 0 and 100%.');
  if (t.creditPeriodDays < 0) errs.push('Credit period cannot be negative.');
  if (t.creditLimit < 0) errs.push('Credit limit cannot be negative.');
  if (t.depositRequired && t.depositAmount <= 0) errs.push('Deposit amount is required when a deposit is mandatory.');
  if (t.maxOrderValue !== null && t.maxOrderValue < t.minOrderValue) errs.push('Maximum order value must be greater than the minimum.');
  if (!t.effectiveFrom) errs.push('Effective from date is required.');
  if (t.effectiveTo && t.effectiveTo < t.effectiveFrom) errs.push('Effective to date must be after effective from.');
  if (errs.length) throw new ServiceError(errs[0], errs);
};

export const channelService = {
  list: () => mockCall(() => readDb().channels),
  create: (input: ChannelInput, actor: string) => mockCall(() => mutateDb(['channels'], (d) => {
    validateChannel(input, d.channels, null);
    const now = nowISO();
    const terms = { ...input.terms, depositAmount: input.terms.depositRequired ? input.terms.depositAmount : 0 };
    const c: SalesChannel = {
      id: uid('chn'), ...input, terms, code: input.code.trim().toUpperCase(), name: input.name.trim(), version: 1,
      history: [{ version: 1, terms, changedAt: now, changedBy: actor, changeNote: 'Channel created' }],
      createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    };
    d.channels.push(c);
    return c;
  })),
  /** Commercial changes create a new version; earlier versions stay effective for their date ranges. */
  update: (id: string, input: ChannelInput, changeNote: string, actor: string) => mockCall(() => mutateDb(['channels'], (d) => {
    validateChannel(input, d.channels, id);
    const c = d.channels.find((x) => x.id === id);
    if (!c) throw new ServiceError('Channel not found.');
    if (input.status === 'Inactive' && c.status === 'Active') {
      const used = d.flows.filter((f) => f.status === 'Active' && f.stages.some((s) => s.channelId === id));
      if (used.length) throw new ServiceError(`Channel is used by active sales policies: ${used.map((f) => f.name).join(', ')}.`);
    }
    const now = nowISO();
    const terms = { ...input.terms, depositAmount: input.terms.depositRequired ? input.terms.depositAmount : 0 };
    const termsChanged = JSON.stringify(terms) !== JSON.stringify(c.terms);
    if (termsChanged) {
      // close the previous version the day before the new one becomes effective
      const prev = c.history.find((h) => h.version === c.version);
      if (prev && prev.terms.effectiveFrom < terms.effectiveFrom && (!prev.terms.effectiveTo || prev.terms.effectiveTo >= terms.effectiveFrom)) {
        const dayBefore = new Date(`${terms.effectiveFrom}T00:00:00Z`);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        prev.terms = { ...prev.terms, effectiveTo: dayBefore.toISOString().slice(0, 10) };
      }
      c.version += 1;
      c.history.push({ version: c.version, terms, changedAt: now, changedBy: actor, changeNote: changeNote || 'Commercial terms updated' });
    }
    Object.assign(c, { ...input, terms, code: input.code.trim().toUpperCase(), name: input.name.trim(), updatedAt: now, updatedBy: actor });
    return { channel: c, versioned: termsChanged };
  })),
};
