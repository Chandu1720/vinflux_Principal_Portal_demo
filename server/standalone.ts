/**
 * VinFlux integration service — the same ERP handler as the Vercel function, as a long-running Node service
 * (Docker / VM / the principal's server). Adds what a cloud function can't do:
 *   • on-premise ERPs (Tally) through the VinFlux agent: the agent pushes stock and picks up jobs — no inbound ports at the principal
 *   • longer syncs (no 60-second limit)
 *
 * Run:  npm run service
 * Config: environment variables, or server/connectors.json  ({ "VFX_ODOO_URL": "…", … }) — never commit that file.
 *   PORT (default 8787), VFX_API_KEY (app → service), VFX_AGENT_KEY (agent → service), VFX_ALLOWED_ORIGIN (the app's URL, for CORS)
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { handle } from '../api/_lib/handler.js';

const fileCfg = (() => { const p = new URL('./connectors.json', import.meta.url); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as Record<string, string> : {}; })();
const env: Record<string, string | undefined> = { ...fileCfg, ...process.env };
const port = Number(env.PORT ?? 8787);
const origin = env.VFX_ALLOWED_ORIGIN ?? '';

/* --------------------------- agent state (in memory) --------------------------- */
const stock = new Map<string, { at: string; lines: unknown[] }>();
interface Job { id: string; connector: string; op: string; payload: unknown; resolve: (v: unknown) => void; reject: (e: Error) => void; at: number }
const jobs: Job[] = [];
const queueAgentJob = (connector: string, op: string, payload: unknown) => new Promise((resolve, reject) => {
  const j: Job = { id: randomUUID(), connector, op, payload, resolve, reject, at: Date.now() };
  jobs.push(j);
  setTimeout(() => { const i = jobs.indexOf(j); if (i >= 0) { jobs.splice(i, 1); reject(new Error('The agent did not pick up the job within 2 minutes — is it running?')); } }, 120000);
});
const pending = new Map<string, Job>();
const agentOk = (req: Request) => { const k = env.VFX_AGENT_KEY ?? ''; const got = req.headers.get('x-agent-key') ?? ''; return !!k && k.length === got.length && timingSafeEqual(Buffer.from(k), Buffer.from(got)); };
const j = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const route = async (req: Request): Promise<Response> => {
  const u = new URL(req.url);
  if (u.pathname === '/health') return j(200, { ok: true });
  if (u.pathname === '/api/erp') return handle(req, { env, host: 'service', agentStock: (id) => stock.get(id) ?? null, queueAgentJob: (id, op, p) => queueAgentJob(id, op, p).catch((e: Error) => ({ error: e.message })) });
  if (u.pathname.startsWith('/api/agent/')) {
    if (!agentOk(req)) return j(401, { error: 'Wrong agent key.' });
    const body = req.method === 'POST' ? await req.json() as Record<string, any> : {};
    if (u.pathname === '/api/agent/stock') { stock.set(body.connector, { at: new Date().toISOString(), lines: body.lines ?? [] }); return j(200, { ok: true, lines: (body.lines ?? []).length }); }
    if (u.pathname === '/api/agent/jobs') {
      const connector = u.searchParams.get('connector') ?? '';
      const mine = jobs.filter((x) => x.connector === connector).splice(0, 10);
      mine.forEach((x) => { jobs.splice(jobs.indexOf(x), 1); pending.set(x.id, x); });
      return j(200, { jobs: mine.map((x) => ({ id: x.id, op: x.op, payload: x.payload })) });
    }
    if (u.pathname === '/api/agent/result') {
      const x = pending.get(body.id); if (!x) return j(404, { error: 'Unknown job' });
      pending.delete(body.id);
      if (body.error) x.reject(new Error(body.error)); else x.resolve(body.result);
      return j(200, { ok: true });
    }
  }
  return j(404, { error: 'Not found' });
};

createServer(async (inReq, res) => {
  const cors: Record<string, string> = origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, x-vinflux-key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' } : {};
  if (inReq.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  const chunks: Buffer[] = [];
  for await (const c of inReq) chunks.push(c as Buffer);
  const req = new Request(`http://${inReq.headers.host ?? 'localhost'}${inReq.url}`, { method: inReq.method, headers: inReq.headers as Record<string, string>, body: ['GET', 'HEAD'].includes(inReq.method ?? 'GET') ? undefined : Buffer.concat(chunks) });
  try {
    const r = await route(req);
    res.writeHead(r.status, { ...Object.fromEntries(r.headers), ...cors }).end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json', ...cors }).end(JSON.stringify({ error: (e as Error).message })); }
}).listen(port, () => console.log(`VinFlux integration service on :${port}`));
