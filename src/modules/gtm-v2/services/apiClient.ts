/**
 * GTM V2 API client.
 *
 * The existing VinFlux app has NO HTTP layer (no axios / fetch wrappers) — all data
 * lives in React context. GTM V2 therefore ships an async service layer whose
 * functions resolve against a local mock database (services/mockDb.ts).
 *
 * INTEGRATION POINT: when the backend is available set VITE_GTM_API_MODE=http and
 * implement `httpCall` below (or swap each service body to `httpCall(...)`).
 * Every service call documents the REST endpoint it maps to via `ENDPOINTS`.
 */

export const API_BASE: string = import.meta.env.VITE_GTM_API_BASE ?? '/api/v1/gtm-v2';
export const API_MODE: 'mock' | 'http' = import.meta.env.VITE_GTM_API_MODE === 'http' ? 'http' : 'mock';

export const ENDPOINTS = {
  territories: 'GET|POST /territories, PUT|DELETE /territories/:id, PATCH /territories/:id/status',
  zones: 'GET|POST /zones, PUT /zones/:id, PATCH /zones/:id/status',
  channels: 'GET|POST /sales-channels, PUT /sales-channels/:id, GET /sales-channels/:id/history',
  flows: 'GET|POST /sales-flows, PUT|DELETE /sales-flows/:id, POST /sales-flows/:id/duplicate',
  partners: 'GET|POST /partners, PUT /partners/:id, POST /partners/:id/submit, PATCH /partners/:id/status',
  kycUpload: 'POST /partners/:id/kyc-documents (multipart)',
  mappings: 'GET /partner-flow-mappings, GET /partner-flow-overrides',
  terms: 'GET|POST /commercial-terms, PUT /commercial-terms/:id',
  approvals: 'GET /approvals, POST /approvals/:id/approve, POST /approvals/:id/reject',
  config: 'GET /configuration, PUT /configuration/:section',
  credit: 'GET /partners/:id/ledger-summary (from ERP), POST /partners/:id/credit-hold, POST /partners/:id/credit-hold/release-request',
  licences: 'POST /partners/:id/kyc-documents/:docTypeId/renew (multipart)',
  coverage: 'GET|POST /customer-assignments, POST /customer-assignments/:id/improvement, POST /customer-assignments/:id/transfer',
  portal: 'GET|POST /partners/:id/portal-users, POST /partners/:id/portal-users/:userId/resend, DELETE /partners/:id/portal-users/:userId',
  productMaster: 'REUSED — AppContext.portfolios / AppContext.products (existing Product Master)',
  warehouses: 'REUSED — AppContext.warehouses (existing Warehouse Master)',
} as const;

export class ServiceError extends Error {
  readonly details?: string[];
  constructor(message: string, details?: string[]) {
    super(message);
    this.name = 'ServiceError';
    this.details = details;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulate network latency around a synchronous mock handler. */
export async function mockCall<T>(handler: () => T, latency = 180): Promise<T> {
  await sleep(latency);
  return handler();
}

/** Placeholder for real backend calls. */
export async function httpCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ServiceError(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Unexpected error');
