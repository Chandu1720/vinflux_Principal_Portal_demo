/** Vercel function: /api/erp — cloud host for the ERP connectors (on-premise ERPs go through the integration service). */
import { handle } from './_lib/handler.js';

const run = (req: Request) => handle(req, { env: process.env, host: 'cloud' });
export const GET = run;
export const POST = run;
export const maxDuration = 60;
