/** Tiny persisted store helper (localStorage in the demo; API later). */
export const loadJson = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* storage unavailable */ }
  return fallback;
};
export const saveJson = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore quota / private mode */ }
};
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
