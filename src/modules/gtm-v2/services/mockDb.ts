import type { GtmDatabase } from '../types';
import { buildSeedDatabase, SCHEMA_VERSION } from '../mocks/seed';

/**
 * In-browser mock database for GTM V2, persisted to localStorage so the
 * prototype behaves like a real backend across reloads.
 * Replace with real API calls — see services/apiClient.ts.
 */
const STORAGE_KEY = 'vinflux.gtmv2.db';

type Listener = (tags: string[]) => void;
const listeners = new Set<Listener>();

const load = (): GtmDatabase => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GtmDatabase;
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt → reseed */
  }
  return buildSeedDatabase();
};

let db: GtmDatabase | null = null;

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
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
  db = buildSeedDatabase();
  persist();
  listeners.forEach((l) => l(['*']));
};

export const nowISO = () => new Date().toISOString();
