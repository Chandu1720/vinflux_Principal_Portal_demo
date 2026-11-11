/** Small fetch helpers shared by adapters: timeout, JSON, readable errors (no secrets in messages). */
import { ErpError } from './types.js';

export const TIMEOUT_MS = Number(process.env.VFX_HTTP_TIMEOUT_MS ?? 25000);

export const request = async (url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? `Timed out calling ${new URL(url).host}` : `Can't reach ${new URL(url).host}: ${(e as Error).message}`;
    throw new ErpError(msg);
  } finally { clearTimeout(t); }
};

export const json = async <T = any>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> => {
  const r = await request(url, { ...init, headers: { Accept: 'application/json', ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new ErpError(`${new URL(url).host} answered ${r.status}${r.status === 401 || r.status === 403 ? ' — check the credentials / permissions' : ''}`, r.status, text.slice(0, 600));
  try { return (text ? JSON.parse(text) : {}) as T; } catch { throw new ErpError(`${new URL(url).host} did not return JSON`, r.status, text.slice(0, 300)); }
};

export const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
export const trimSlash = (u: string) => u.replace(/\/+$/, '');
export const isoDate = (v: unknown): string | null => {
  if (!v) return null;
  const s = String(v);
  const odata = s.match(/\/Date\((-?\d+)/); // SAP OData v2 /Date(1700000000000)/
  if (odata) return new Date(Number(odata[1])).toISOString().slice(0, 10);
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};
export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Microsoft Entra ID client-credentials token (Business Central, Finance & Operations). */
const tokenCache = new Map<string, { token: string; exp: number }>();
export const entraToken = async (tenant: string, clientId: string, secret: string, scope: string) => {
  const k = `${tenant}|${clientId}|${scope}`;
  const hit = tokenCache.get(k);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret, scope });
  const base = process.env.VFX_ENTRA_AUTHORITY ?? 'https://login.microsoftonline.com';
  const r = await json<{ access_token: string; expires_in: number }>(`${trimSlash(base)}/${tenant}/oauth2/v2.0/token`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  tokenCache.set(k, { token: r.access_token, exp: Date.now() + r.expires_in * 1000 });
  return r.access_token;
};
export const cacheToken = (k: string, token: string, seconds: number) => tokenCache.set(k, { token, exp: Date.now() + seconds * 1000 });
export const cachedToken = (k: string) => { const h = tokenCache.get(k); return h && h.exp > Date.now() + 60000 ? h.token : null; };
