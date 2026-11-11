/**
 * Fake ERP servers for adapter tests. Each answers in the vendor's published response shape for the calls
 * the adapter makes, and records requests so tests can check what VinFlux sent.
 * This proves the adapters' request building and parsing — not the vendors' behaviour (that needs a real test login).
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Seen { method: string; path: string; headers: Record<string, string>; body: string }
export const start = async (route: (s: Seen) => { status?: number; json?: unknown; text?: string; headers?: Record<string, string> }) => {
  const seen: Seen[] = [];
  const srv = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const s: Seen = { method: req.method ?? 'GET', path: req.url ?? '/', headers: req.headers as Record<string, string>, body: Buffer.concat(chunks).toString() };
    seen.push(s);
    const r = route(s);
    res.writeHead(r.status ?? 200, { 'Content-Type': r.text !== undefined ? 'text/xml' : 'application/json', ...(r.headers ?? {}) });
    res.end(r.text ?? JSON.stringify(r.json ?? {}));
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { url, seen, close: () => new Promise<void>((ok) => srv.close(() => ok())) };
};
