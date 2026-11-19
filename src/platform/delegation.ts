/**
 * Approval delegation (USR-07): a user hands their approvals to another holder of the same role for a dated period
 * (leave, travel). Approval rules name roles, never people (USR-06), so the delegate sees the delegator's queue.
 */
import { loadJson, newId, saveJson } from './store';
import { workspaceKey } from './workspace';

export interface Delegation { id: string; fromUser: string; toUser: string; role: string; from: string; to: string; note: string; createdAt: string; revoked: boolean }
const KEY = () => workspaceKey('vinflux.delegations.v1');
const listeners = new Set<() => void>();
export const subscribeDelegation = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const delegations = () => loadJson<Delegation[]>(KEY(), []);
const save = (d: Delegation[]) => { saveJson(KEY(), d); listeners.forEach((l) => l()); };
const today = () => new Date().toISOString().slice(0, 10);
export const activeFor = (user: string) => delegations().filter((d) => !d.revoked && d.toUser === user && d.from <= today() && d.to >= today());
export const addDelegation = (d: Omit<Delegation, 'id' | 'createdAt' | 'revoked'>, roleHolders: (role: string) => string[]): { ok: boolean; message: string } => {
  if (d.fromUser === d.toUser) return { ok: false, message: 'Choose someone else.' };
  if (!d.role) return { ok: false, message: 'Choose the role to delegate.' };
  if (!roleHolders(d.role).includes(d.toUser)) return { ok: false, message: `${d.toUser} doesn’t hold the ${d.role} role — approvals can only go to another holder of the same role.` };
  if (!d.from || !d.to || d.to < d.from) return { ok: false, message: 'Give a valid period.' };
  save([{ ...d, id: newId('dlg'), createdAt: new Date().toISOString(), revoked: false }, ...delegations()]);
  return { ok: true, message: `${d.role} approvals delegated to ${d.toUser} from ${d.from} to ${d.to}.` };
};
export const revokeDelegation = (id: string) => save(delegations().map((d) => (d.id === id ? { ...d, revoked: true } : d)));
