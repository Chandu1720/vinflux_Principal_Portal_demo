import type { ImportBatch, ImportContext, ImportEntity, RowResult } from './types';
import { ENTITIES } from './entities';
import { emit } from '../events';
import { loadJson, newId, saveJson } from '../store';

const KEY = 'vinflux.imports.v1';
const MAP_KEY = 'vinflux.importMappings.v1';
const listeners = new Set<() => void>();

export const importHistory = (): ImportBatch[] => loadJson<ImportBatch[]>(KEY, []);
const save = (list: ImportBatch[]) => { saveJson(KEY, list); listeners.forEach((l) => l()); };
export const subscribeImports = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const savedMapping = (entityId: string, profile: string): Record<string, string> | undefined => loadJson<Record<string, Record<string, string>>>(MAP_KEY, {})[`${entityId}|${profile}`];
export const saveMapping = (entityId: string, profile: string, map: Record<string, string>) => {
  const all = loadJson<Record<string, Record<string, string>>>(MAP_KEY, {});
  all[`${entityId}|${profile}`] = map; saveJson(MAP_KEY, all);
};

/** Imports only rows without errors. Returns the batch. */
export const runImport = (entity: ImportEntity, results: RowResult[], ctx: ImportContext, opts: Record<string, string>, fileName: string, source: string): ImportBatch => {
  const ok = results.filter((r) => !r.errors.length && !(r.action === 'update' && r.warnings.some((w) => w.startsWith('No changes'))));
  const id = newId('imp');
  const { refs, summary } = entity.apply(ok, ctx, opts, id, source);
  const batch: ImportBatch = {
    id, entityId: entity.id, entityLabel: entity.label, fileName, source, at: new Date().toISOString(), by: ctx.actor,
    counts: { total: results.length, created: ok.filter((r) => r.action === 'create').length, updated: ok.filter((r) => r.action === 'update').length, errors: results.filter((r) => r.errors.length).length },
    summary, status: 'Imported', refs,
  };
  save([batch, ...importHistory()]);
  emit('import.completed', 'Data Import', ctx.actor, `${entity.label}: ${summary} (${fileName})`, { importId: id, entity: entity.id });
  return batch;
};

export const undoImport = (id: string, ctx: ImportContext): string => {
  const list = importHistory();
  const b = list.find((x) => x.id === id);
  if (!b || b.status === 'Undone') return 'Nothing to undo.';
  const entity = ENTITIES.find((e) => e.id === b.entityId)!;
  const msg = entity.undo(b.refs, ctx, id);
  save(list.map((x) => (x.id === id ? { ...x, status: 'Undone', undoneAt: new Date().toISOString(), undoneBy: ctx.actor } : x)));
  emit('import.undone', 'Data Import', ctx.actor, `${b.entityLabel} import undone: ${msg}`, { importId: id });
  return msg;
};
