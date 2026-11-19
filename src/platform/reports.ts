/**
 * Reports (AN1, RPT-01): saved views over the main lists, exported to Excel / CSV and scheduled by email.
 * Views and schedules respect data scope and sharing (RPT-02); estimated and stale figures stay marked (RPT-03).
 * INTEGRATION POINT: scheduled sends run server-side and email the export through the notification service.
 */
import { loadJson, newId, saveJson } from './store';
import { workspaceKey } from './workspace';

export type ReportId = 'orders' | 'invoices' | 'stock' | 'secondary' | 'claims' | 'ageing' | 'pos' | 'audit';
export interface View { id: string; name: string; report: ReportId; q: string; status: string; from: string; to: string; owner: string; shared: boolean; createdAt: string }
export type Frequency = 'Daily' | 'Weekly (Monday)' | 'Monthly (1st)';
export interface Schedule { id: string; viewId: string; frequency: Frequency; time: string; recipients: string[]; active: boolean; nextRun: string; sends: { at: string; rows: number; to: string[] }[]; owner: string }
interface Db { views: View[]; schedules: Schedule[] }
const KEY = () => workspaceKey('vinflux.reports.v1');
const listeners = new Set<() => void>();
export const subscribeReports = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const db = (): Db => { const x = loadJson<Partial<Db> | null>(KEY(), null); return { views: Array.isArray(x?.views) ? x!.views : [], schedules: Array.isArray(x?.schedules) ? x!.schedules : [] }; };
const save = (d: Db) => { saveJson(KEY(), d); listeners.forEach((l) => l()); };

export const views = (user: string) => db().views.filter((v) => v.shared || v.owner === user);
export const schedules = () => db().schedules;
export const saveView = (v: Omit<View, 'id' | 'createdAt'>): { ok: boolean; message: string; id?: string } => {
  if (!v.name.trim()) return { ok: false, message: 'Name the view.' };
  const rec: View = { ...v, id: newId('vw'), createdAt: new Date().toISOString() };
  const d = db(); save({ ...d, views: [rec, ...d.views] });
  return { ok: true, message: `View “${v.name}” saved.`, id: rec.id };
};
export const deleteView = (id: string) => { const d = db(); save({ views: d.views.filter((v) => v.id !== id), schedules: d.schedules.filter((s) => s.viewId !== id) }); };

const nextOf = (f: Frequency, time: string, from = new Date()) => {
  const [h, m] = time.split(':').map(Number); const d = new Date(from); d.setHours(h, m, 0, 0);
  if (f === 'Daily') { if (d <= from) d.setDate(d.getDate() + 1); }
  if (f === 'Weekly (Monday)') { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1); }
  if (f === 'Monthly (1st)') { d.setMonth(d.getMonth() + 1, 1); }
  return d.toISOString();
};
export const addSchedule = (s: { viewId: string; frequency: Frequency; time: string; recipients: string; owner: string }): { ok: boolean; message: string } => {
  const to = s.recipients.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const bad = to.filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  if (!to.length) return { ok: false, message: 'Add at least one email address.' };
  if (bad.length) return { ok: false, message: `Not an email address: ${bad.join(', ')}` };
  const d = db(); save({ ...d, schedules: [{ id: newId('sch'), viewId: s.viewId, frequency: s.frequency, time: s.time, recipients: to, active: true, nextRun: nextOf(s.frequency, s.time), sends: [], owner: s.owner }, ...d.schedules] });
  return { ok: true, message: `Scheduled ${s.frequency.toLowerCase()} at ${s.time} to ${to.join(', ')}.` };
};
export const toggleSchedule = (id: string) => { const d = db(); save({ ...d, schedules: d.schedules.map((s) => (s.id === id ? { ...s, active: !s.active } : s)) }); };
export const deleteSchedule = (id: string) => { const d = db(); save({ ...d, schedules: d.schedules.filter((s) => s.id !== id) }); };
/** Record a send (the demo sends at once; production sends on schedule). */
export const recordSend = (id: string, rows: number) => { const d = db(); save({ ...d, schedules: d.schedules.map((s) => (s.id === id ? { ...s, sends: [{ at: new Date().toISOString(), rows, to: s.recipients }, ...s.sends].slice(0, 20), nextRun: nextOf(s.frequency, s.time) } : s)) }); };
