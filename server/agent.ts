/**
 * VinFlux agent — runs next to an on-premise ERP (Tally today) on the principal's PC / server.
 * It only makes OUTBOUND HTTPS calls to the VinFlux integration service: no ports opened at the principal.
 *   every few minutes: read stock from Tally → POST /api/agent/stock
 *   every 15 seconds:  GET /api/agent/jobs → run (sales order into Tally, invoice lookup) → POST /api/agent/result
 *
 * Run:  npm run agent   with VFX_SERVICE_URL, VFX_AGENT_KEY, VFX_TALLY_URL (http://localhost:9000), VFX_TALLY_COMPANY,
 *       optional VFX_AGENT_STOCK_MINUTES (default 15). Install as a Windows service with NSSM or the Task Scheduler.
 */
import { ADAPTERS, configFor } from '../api/_lib/handler.js';

const env = process.env as Record<string, string | undefined>;
const SERVICE = (env.VFX_SERVICE_URL ?? '').replace(/\/+$/, '');
const KEY = env.VFX_AGENT_KEY ?? '';
const CONNECTOR = env.VFX_AGENT_CONNECTOR ?? 'tally';
if (!SERVICE || !KEY) { console.error('Set VFX_SERVICE_URL and VFX_AGENT_KEY.'); process.exit(1); }
const adapter = ADAPTERS[CONNECTOR];
const cfg = configFor(CONNECTOR, env);
const call = (path: string, body?: unknown) => fetch(`${SERVICE}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-agent-key': KEY }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

const pushStock = async () => {
  try { const lines = await adapter.stock(cfg, {}); await call('/api/agent/stock', { connector: CONNECTOR, lines }); log(`stock sent: ${lines.length} line(s)`); }
  catch (e) { log(`stock failed: ${(e as Error).message}`); }
};
const runJobs = async () => {
  try {
    const { jobs } = await call(`/api/agent/jobs?connector=${CONNECTOR}`) as { jobs: { id: string; op: string; payload: any }[] };
    for (const j of jobs) {
      try {
        const result = j.op === 'salesOrder' ? await adapter.createSalesOrder(cfg, j.payload) : j.op === 'invoices' ? { invoices: await adapter.invoicesFor(cfg, j.payload) } : await adapter.test(cfg);
        await call('/api/agent/result', { id: j.id, result }); log(`job ${j.op} done`);
      } catch (e) { await call('/api/agent/result', { id: j.id, error: (e as Error).message }); log(`job ${j.op} failed: ${(e as Error).message}`); }
    }
  } catch (e) { log(`service unreachable: ${(e as Error).message}`); }
};
log(`VinFlux agent for ${CONNECTOR} → ${SERVICE}`);
await pushStock();
setInterval(pushStock, Number(env.VFX_AGENT_STOCK_MINUTES ?? 15) * 60000);
setInterval(runJobs, 15000);
