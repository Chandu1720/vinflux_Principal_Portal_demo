/**
 * Action links (NOT-04): messages that ask for a decision carry a secure link that works without signing in,
 * expires after a set time and can be used once. The action is recorded exactly as if it was made on screen,
 * with "via email link" on the record.
 * INTEGRATION POINT: tokens are issued and redeemed server-side (POST /links, GET|POST /a/{token}); the token is a
 * random 128-bit value, stored hashed, bound to one record and one audience.
 */
import { loadJson, saveJson } from './store';

export type LinkKind = 'order-approve' | 'order-partfill' | 'claim-decide' | 'po-ack' | 'repl-respond';
export interface ActionLink {
  token: string; kind: LinkKind; refId: string; principalId: string;
  /** Who it was sent to: an approval level (role) or a partner. */
  audience: string;
  issuedAt: string; expiresAt: string; usedAt: string | null; usedBy: string | null; result: string | null;
}
const KEY = 'vinflux.actionLinks.v1';
const all = () => loadJson<ActionLink[]>(KEY, []);
const save = (l: ActionLink[]) => saveJson(KEY, l.slice(-300));
const random = () => {
  const a = new Uint8Array(16);
  try { crypto.getRandomValues(a); } catch { for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};
export const linkUrl = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : 'https://portal.vinflux.in'}/a/${token}`;

/** Issue a one-time link; an older unused link for the same record and audience stops working. */
export const issueLink = (kind: LinkKind, refId: string, principalId: string, audience: string, hours = 48): string => {
  const now = new Date();
  const token = random();
  const list = all().map((l) => (l.kind === kind && l.refId === refId && l.audience === audience && !l.usedAt ? { ...l, usedAt: now.toISOString(), usedBy: 'System', result: 'Replaced by a newer link' } : l));
  save([...list, { token, kind, refId, principalId, audience, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + hours * 3600000).toISOString(), usedAt: null, usedBy: null, result: null }]);
  return linkUrl(token);
};
export type LinkState = { ok: true; link: ActionLink } | { ok: false; reason: string; link?: ActionLink };
export const checkLink = (token: string): LinkState => {
  const l = all().find((x) => x.token === token);
  if (!l) return { ok: false, reason: 'This link is not valid.' };
  if (l.usedAt) return { ok: false, reason: l.usedBy === 'System' ? `${l.result} — use the latest message.` : `This link was already used on ${l.usedAt.slice(0, 16).replace('T', ' ')} by ${l.usedBy}: ${l.result}.`, link: l };
  if (l.expiresAt < new Date().toISOString()) return { ok: false, reason: `This link expired on ${l.expiresAt.slice(0, 16).replace('T', ' ')}. Open VinFlux to act, or ask for a new link.`, link: l };
  return { ok: true, link: l };
};
/** Mark used (only after the action succeeded). */
export const useLink = (token: string, by: string, result: string) => save(all().map((l) => (l.token === token ? { ...l, usedAt: new Date().toISOString(), usedBy: by, result } : l)));
export const linksFor = (refId: string) => all().filter((l) => l.refId === refId);
/** Stop every open link for a record (e.g. the record was replaced). */
export const revokeLinks = (refId: string, why: string) => save(all().map((l) => (l.refId === refId && !l.usedAt ? { ...l, usedAt: new Date().toISOString(), usedBy: 'System', result: why } : l)));
