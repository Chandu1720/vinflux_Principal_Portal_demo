import type { GtmDatabase } from '../types';
import { INDUSTRY_KYC, MD42_DESC, MD42_NAME, buildSeedDatabase, SCHEMA_VERSION } from '../mocks/seed';
import { currentWorkspace, workspaceKey } from '../../../platform/workspace';
import { applyIndustrySeed } from '../mocks/industrySeed';

/**
 * In-browser mock database for GTM V2, persisted to localStorage so the
 * prototype behaves like a real backend across reloads.
 * Replace with real API calls — see services/apiClient.ts.
 */
/** One Go-to-Market database per industry workspace. */
const storageKey = () => workspaceKey('vinflux.gtmv2.db');

/** Medical gets the full demo; other industries get their own channels, partner types, policies and a small partner network. */
const seedFor = (): GtmDatabase => {
  const s = buildSeedDatabase();
  if (currentWorkspace() === 'medical-devices') return s;
  const ws = currentWorkspace();
  const common = s.config.kycDocuments.filter((k) => ['kyc-gst', 'kyc-pan', 'kyc-bank', 'kyc-agreement'].includes(k.id));
  const own = (INDUSTRY_KYC[ws] ?? []).map((k) => ({ id: k.id, name: k.name, description: k.description, mandatoryForPartnerTypeIds: k.types, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeMb: 10, status: 'Active' as const, tracksExpiry: true }));
  return applyIndustrySeed(ws, {
    ...s, flows: [], partners: [], mappings: [], flowOverrides: [], terms: [], approvals: [], assignments: [], transfers: [], counters: { approval: 0, partner: 0, flow: 0 },
    config: { ...s.config, kycDocuments: [...common, ...own] },
  });
};

type Listener = (tags: string[]) => void;
const listeners = new Set<Listener>();

const load = (): GtmDatabase => {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const parsed = JSON.parse(raw) as GtmDatabase;
      if (parsed.schemaVersion === SCHEMA_VERSION) {
        // Medical partners need the medical device sale registration, not the old drug licence.
        const dl = parsed.config.kycDocuments.find((k) => k.id === 'kyc-dl');
        if (dl && dl.name.startsWith('Drug')) {
          Object.assign(dl, { name: MD42_NAME, description: MD42_DESC, mandatoryForPartnerTypeIds: Array.from(new Set([...dl.mandatoryForPartnerTypeIds, 'pt-retail'])) });
          if (!parsed.config.kycDocuments.some((k) => k.id === 'kyc-cea')) parsed.config.kycDocuments.push(buildSeedDatabase().config.kycDocuments.find((k) => k.id === 'kyc-cea')!);
        }
        // Industry workspaces created before their starter data existed (no partners, no policies) get it now.
        if (currentWorkspace() !== 'medical-devices' && !parsed.partners.length && !parsed.flows.length) return seedFor();
        return parsed;
      }
    }
  } catch {
    /* storage unavailable or corrupt → reseed */
  }
  return seedFor();
};

let db: GtmDatabase | null = null;

const persist = () => {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(db));
  } catch {
    /* ignore quota / private mode */
  }
};

export const readDb = (): GtmDatabase => {
  if (!db) db = load();
  return db;
};

/**
 * Transactional mutation: works on a clone, commits only if the mutator does not throw.
 * `tags` are broadcast so mounted queries refresh.
 */
export const mutateDb = <T>(tags: string[], mutator: (draft: GtmDatabase) => T): T => {
  const draft = structuredClone(readDb());
  const result = mutator(draft);
  db = draft;
  persist();
  listeners.forEach((l) => l(tags));
  return result;
};

export const nextNumber = (draft: GtmDatabase, key: string): number => {
  draft.counters[key] = (draft.counters[key] ?? 0) + 1;
  return draft.counters[key];
};

export const subscribeDb = (l: Listener): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const resetDb = () => {
  db = seedFor();
  persist();
  listeners.forEach((l) => l(['*']));
};

export const nowISO = () => new Date().toISOString();
