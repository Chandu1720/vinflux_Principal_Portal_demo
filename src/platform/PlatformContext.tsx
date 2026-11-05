import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { MODULES } from './modules';
import type { ModuleId } from './modules';
import { emit } from './events';
import { loadJson, saveJson } from './store';

const KEY = 'vinflux.modules.v2';
/**
 * Stored per principal as the list of modules switched OFF, so a newly released module
 * is on by default without touching existing settings.
 */
const loadOff = (): Record<string, ModuleId[]> => {
  const v2 = loadJson<Record<string, ModuleId[]> | null>(KEY, null);
  if (v2) return v2;
  // Migrate v1 (list of modules switched ON, written when only these four existed).
  const v1 = loadJson<Record<string, ModuleId[]>>('vinflux.modules.v1', {});
  const phase0: ModuleId[] = ['product-master', 'integration-hub', 'go-to-market', 'inventory'];
  return Object.fromEntries(Object.entries(v1).map(([k, on]) => [k, phase0.filter((m) => !on.includes(m))]));
};

interface PlatformCtx {
  enabled: (id: ModuleId) => boolean;
  setEnabled: (id: ModuleId, on: boolean, actor: string) => { ok: boolean; message: string };
  enabledIds: ModuleId[];
  /** Module owning a path, if any, and whether it is on. */
  pathAllowed: (path: string) => boolean;
}

const Ctx = createContext<PlatformCtx | undefined>(undefined);

export const PlatformProvider: React.FC<{ principalId: string; children: React.ReactNode }> = ({ principalId, children }) => {
  const [all, setAll] = useState<Record<string, ModuleId[]>>(loadOff);
  const enabledIds = useMemo(() => MODULES.filter((m) => m.status === 'available' && !(all[principalId] ?? []).includes(m.id)).map((m) => m.id), [all, principalId]);
  const enabled = useCallback((id: ModuleId) => MODULES.find((m) => m.id === id)?.core || enabledIds.includes(id), [enabledIds]);

  const setEnabled = useCallback((id: ModuleId, on: boolean, actor: string) => {
    const m = MODULES.find((x) => x.id === id);
    if (!m) return { ok: false, message: 'Unknown module.' };
    if (m.core) return { ok: false, message: `${m.name} is part of the core and is always on.` };
    if (m.status !== 'available') return { ok: false, message: `${m.name} is planned (phase ${m.phase}) and can't be switched on yet.` };
    if (on) {
      const missing = m.dependsOn.filter((d) => !enabled(d));
      if (missing.length) return { ok: false, message: `Switch on first: ${missing.map((d) => MODULES.find((x) => x.id === d)?.name).join(', ')}.` };
    } else {
      const dependents = MODULES.filter((x) => x.dependsOn.includes(id) && enabledIds.includes(x.id));
      if (dependents.length) return { ok: false, message: `${dependents.map((d) => d.name).join(', ')} need${dependents.length === 1 ? 's' : ''} ${m.name}. Switch ${dependents.length === 1 ? 'it' : 'them'} off first.` };
    }
    const off = all[principalId] ?? [];
    const map = { ...all, [principalId]: on ? off.filter((x) => x !== id) : Array.from(new Set([...off, id])) };
    setAll(map); saveJson(KEY, map);
    emit(on ? 'module.enabled' : 'module.disabled', 'Platform', actor, `${m.name} switched ${on ? 'on' : 'off'}`, { module: id, principalId });
    return { ok: true, message: `${m.name} switched ${on ? 'on' : 'off'}.` };
  }, [all, enabled, enabledIds, principalId]);

  const pathAllowed = useCallback((path: string) => {
    const owner = MODULES.find((m) => m.paths.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`))));
    return !owner || enabled(owner.id);
  }, [enabled]);

  const value = useMemo(() => ({ enabled, setEnabled, enabledIds, pathAllowed }), [enabled, setEnabled, enabledIds, pathAllowed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const usePlatform = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlatform must be used inside PlatformProvider');
  return c;
};
