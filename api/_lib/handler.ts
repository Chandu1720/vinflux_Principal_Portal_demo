/**
 * One request handler for every ERP connector. Runs as a Vercel function (api/erp.ts) and inside the
 * standalone VinFlux integration service (server/standalone.ts) — same code, two hosts.
 *
 *   GET  ?op=status                          which connectors are configured (never returns secret values)
 *   POST {connector, op: 'test'}             sign in and read a few records
 *   POST {connector, op: 'stock', locations} on-hand stock, normalised
 *   POST {connector, op: 'salesOrder', order}
 *   POST {connector, op: 'invoices', ref}
 *
 * Secrets: VFX_<CONNECTOR>_<KEY> environment variables (e.g. VFX_ODOO_API_KEY), or the service's config file.
 * Access: requests must carry x-vinflux-key = VFX_API_KEY (only `status` works without it).
 */
import { timingSafeEqual } from 'node:crypto';
import { ErpError } from './types.js';
import type { Adapter, Cfg } from './types.js';
import { odoo } from './adapters/odoo.js';
import { zoho } from './adapters/zoho.js';
import { sap } from './adapters/sap.js';
import { sapB1 } from './adapters/sapb1.js';
import { d365bc } from './adapters/d365bc.js';
import { d365fo } from './adapters/d365fo.js';
import { netsuite } from './adapters/netsuite.js';
import { oracleFusion } from './adapters/oraclefusion.js';
import { erpnext } from './adapters/erpnext.js';
import { tally } from './adapters/tally.js';

export const ADAPTERS: Record<string, Adapter> = Object.fromEntries([odoo, zoho, sap, sapB1, d365bc, d365fo, netsuite, oracleFusion, erpnext, tally].map((a) => [a.id, a]));
/** Connectors that must run on the principal's network (agent), not in the cloud. */
export const ON_PREMISE = new Set(['tally']);

export interface HostOptions {
  /** Where config comes from (env vars by default). */
  env: Record<string, string | undefined>;
  /** 'cloud' = Vercel (no on-premise connectors), 'service' = standalone service / agent. */
  host: 'cloud' | 'service';
  /** Standalone service: latest stock pushed by an agent, per connector. */
  agentStock?: (connector: string) => { at: string; lines: unknown[] } | null;
  /** Standalone service: queue a job for the agent (sales order into Tally). */
  queueAgentJob?: (connector: string, op: string, payload: unknown) => Promise<unknown>;
}

const prefix = (id: string) => `VFX_${id.toUpperCase().replace(/-/g, '_')}_`;
export const configFor = (id: string, env: HostOptions['env']): Cfg => {
  const p = prefix(id);
  return Object.fromEntries(Object.entries(env).filter(([k, v]) => k.startsWith(p) && v !== undefined).map(([k, v]) => [k.slice(p.length), String(v)]));
};
export const missingKeys = (a: Adapter, cfg: Cfg) => a.required.filter((k) => !cfg[k]);

const safeEq = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const handle = async (req: Request, opts: HostOptions): Promise<Response> => {
  const url = new URL(req.url);
  const op = url.searchParams.get('op');
  if (req.method === 'GET' && op === 'status') {
    return reply(200, { host: opts.host, connectors: Object.values(ADAPTERS).map((a) => {
      const cfg = configFor(a.id, opts.env);
      const missing = missingKeys(a, cfg);
      return { id: a.id, configured: !missing.length, missing, masterData: (['products', 'customers', 'locations'] as const).filter((k) => !!a[k]), runsHere: !(opts.host === 'cloud' && ON_PREMISE.has(a.id)), agentStock: opts.agentStock?.(a.id)?.at ?? null };
    }), accessKeyRequired: true, accessKeySet: !!opts.env.VFX_API_KEY });
  }
  if (req.method !== 'POST') return reply(405, { error: 'Use POST' });
  const key = opts.env.VFX_API_KEY?.trim();
  if (!key) return reply(503, { error: 'VFX_API_KEY is not set on the server — set it (and restart the service) before using live connectors.' });
  const sent = (req.headers.get('x-vinflux-key') ?? '').trim();
  if (!sent) return reply(401, { error: 'No VinFlux access key was sent — type it in the connector’s “VinFlux access key” field.' });
  if (!safeEq(sent, key)) return reply(401, { error: `The VinFlux access key doesn’t match VFX_API_KEY on the service (you sent ${sent.length} characters). Retype it — the browser may have auto-filled a saved password.` });

  let body: { connector?: string; op?: string; locations?: string[]; order?: unknown; ref?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'Body must be JSON.' }); }
  const a = ADAPTERS[body.connector ?? ''];
  if (!a) return reply(404, { error: `Unknown connector “${body.connector}”.` });
  const cfg = configFor(a.id, opts.env);
  const onPrem = ON_PREMISE.has(a.id);
  try {
    if (onPrem && opts.host === 'cloud') {
      return reply(409, { error: `${a.id} runs on the principal's network — use the VinFlux integration service with the agent, not the cloud function.` });
    }
    if (onPrem && !cfg.URL && opts.agentStock) {
      // Service without direct reach: answer from what the agent last pushed / queue the job for the agent.
      if (body.op === 'stock') { const s = opts.agentStock(a.id); if (!s) return reply(404, { error: 'The agent has not sent any stock yet.' }); return reply(200, { lines: s.lines, at: s.at, via: 'agent' }); }
      if (body.op === 'test') { const s = opts.agentStock(a.id); return reply(200, { ok: !!s, message: s ? `Agent last sent stock at ${s.at}.` : 'Agent not seen yet.' }); }
      if (opts.queueAgentJob) return reply(200, await opts.queueAgentJob(a.id, body.op ?? '', body.order ?? body.ref));
    }
    const missing = missingKeys(a, cfg);
    if (missing.length) return reply(412, { error: `Connector not configured — set ${missing.map((k) => `${prefix(a.id)}${k}`).join(', ')}.` });
    switch (body.op) {
      case 'test': return reply(200, await a.test(cfg));
      case 'stock': { const lines = await a.stock(cfg, { locations: body.locations }); return reply(200, { lines, at: new Date().toISOString() }); }
      case 'salesOrder': return reply(200, await a.createSalesOrder(cfg, body.order as never));
      case 'invoices': return reply(200, { invoices: await a.invoicesFor(cfg, body.ref as never) });
      case 'products': case 'customers': case 'locations': {
        const fn = a[body.op];
        if (!fn) return reply(501, { error: `Reading ${body.op} from ${a.id} isn't built yet — needs a test login to verify the API.` });
        return reply(200, { [body.op]: await (fn as (c: typeof cfg) => Promise<unknown[]>).call(a, cfg), at: new Date().toISOString() });
      }
      default: return reply(400, { error: `Unknown op “${body.op}”.` });
    }
  } catch (e) {
    const err = e as ErpError;
    return reply(err instanceof ErpError && err.status === 401 ? 401 : 502, { error: err.message, erpStatus: err.status || undefined, erpBody: err.body || undefined });
  }
};
