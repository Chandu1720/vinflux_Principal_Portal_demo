/**
 * One-time Zoho Inventory setup + live test, run on your own computer:
 *
 *   npx tsx server/zoho-setup.ts <GRANT_CODE> [dc]        dc = in (default) | com | eu | com.au
 *   npx tsx server/zoho-setup.ts                          (again later — reuses the saved refresh token; add --raw to print Zoho's raw item data)
 *
 * 1. swaps the Self Client grant code for a refresh token
 * 2. finds your Zoho Inventory organization ID
 * 3. saves VFX_ZOHO_* into server/connectors.json (git-ignored — never commit it)
 * 4. runs the connector's test and a stock read, and prints what VinFlux would import
 * Client ID / secret come from server/connectors.json or VFX_ZOHO_CLIENT_ID / VFX_ZOHO_CLIENT_SECRET.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { zoho, zohoRaw } from '../api/_lib/adapters/zoho.js';

const file = new URL('./connectors.json', import.meta.url);
const saved: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const code = process.argv[2]?.startsWith('1000.') ? process.argv[2] : undefined;
const dc = (code ? process.argv[3] : undefined) ?? saved.VFX_ZOHO_DC ?? 'in';
const clientId = process.env.VFX_ZOHO_CLIENT_ID ?? saved.VFX_ZOHO_CLIENT_ID;
const secret = process.env.VFX_ZOHO_CLIENT_SECRET ?? saved.VFX_ZOHO_CLIENT_SECRET;
const say = (s: string) => console.log(s);
if (!clientId || !secret) { say('Missing client ID / secret (server/connectors.json or VFX_ZOHO_CLIENT_ID / VFX_ZOHO_CLIENT_SECRET).'); process.exit(1); }

let refresh = saved.VFX_ZOHO_REFRESH_TOKEN;
if (code) {
  const q = new URLSearchParams({ code, client_id: clientId, client_secret: secret, grant_type: 'authorization_code' });
  const r = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token?${q}`, { method: 'POST' });
  const j = await r.json() as { refresh_token?: string; access_token?: string; error?: string };
  if (!j.refresh_token) {
    say(`✗ Zoho did not return a refresh token: ${j.error ?? JSON.stringify(j)}`);
    if (j.error === 'invalid_code') say('  The code is wrong or expired (codes last only a few minutes) — generate a new one and run again at once.');
    if (j.error === 'invalid_client') say(`  Client not found in data centre "${dc}" — try: npx tsx server/zoho-setup.ts <CODE> com`);
    process.exit(1);
  }
  refresh = j.refresh_token;
  say('✓ Refresh token received');
  // Organization ID
  const orgs = await fetch(`https://www.zohoapis.${dc}/inventory/v1/organizations`, { headers: { Authorization: `Zoho-oauthtoken ${j.access_token}` } }).then((x) => x.json()).catch(() => ({})) as { organizations?: { organization_id: string; name: string }[]; message?: string };
  if (orgs.organizations?.length) {
    saved.VFX_ZOHO_ORG_ID = saved.VFX_ZOHO_ORG_ID || orgs.organizations[0].organization_id;
    say(`✓ Organization: ${orgs.organizations.map((o) => `${o.name} (${o.organization_id})`).join(', ')} — using ${saved.VFX_ZOHO_ORG_ID}`);
  } else say(`! Couldn't list organizations (${orgs.message ?? 'no answer'}). Put VFX_ZOHO_ORG_ID into server/connectors.json yourself (Zoho Inventory → Settings → Organization profile).`);
}
if (!refresh) { say('Usage: npx tsx server/zoho-setup.ts <GRANT_CODE> [in|com|eu|com.au]'); process.exit(1); }
Object.assign(saved, { VFX_ZOHO_DC: dc, VFX_ZOHO_CLIENT_ID: clientId, VFX_ZOHO_CLIENT_SECRET: secret, VFX_ZOHO_REFRESH_TOKEN: refresh });
writeFileSync(file, `${JSON.stringify(saved, null, 2)}\n`);
say('✓ Saved to server/connectors.json (git-ignored)');
if (!saved.VFX_ZOHO_ORG_ID) process.exit(1);

const cfg = { DC: dc, CLIENT_ID: clientId, CLIENT_SECRET: secret, REFRESH_TOKEN: refresh, ORG_ID: saved.VFX_ZOHO_ORG_ID };
try {
  const t = await zoho.test(cfg);
  say(`✓ Test: ${t.message} ${JSON.stringify(t.details)}`);
  const lines = await zoho.stock(cfg, {});
  say(`✓ Stock: ${lines.length} line(s)`);
  console.table(lines.slice(0, 25));
  // Master data VinFlux can import: items → Product Master, customers → partners, locations → warehouses.
  const [items, customers, locations] = await Promise.all([zoho.products!(cfg), zoho.customers!(cfg), zoho.locations!(cfg)]);
  say(`✓ Items: ${items.length}`); console.table(items.slice(0, 10).map((p) => ({ code: p.itemCode, name: p.name, hsn: p.hsn, gst: p.gstRate, uom: p.uom, tracking: p.tracking })));
  say(`✓ Customers: ${customers.length}`); console.table(customers.slice(0, 10).map((c) => ({ name: c.name, gstin: c.gstin, city: c.city, state: c.state })));
  say(`✓ Locations: ${locations.length}`); console.table(locations.map((l) => ({ code: l.code, name: l.name, city: l.city })));
  if (!lines.length || process.argv.includes('--raw')) {
    // Show the shape Zoho returns so the adapter can be matched to it (no secrets in this output).
    const list = await zohoRaw(cfg, '/items?per_page=3') as { items: Record<string, unknown>[] };
    say(`\nRaw: ${list.items.length} item(s). First item summary:`);
    const first = list.items[0];
    if (first) {
      say(JSON.stringify({ item_type: first.item_type, product_type: first.product_type, track_inventory: first.track_inventory, stock_on_hand: first.stock_on_hand, sku: first.sku, name: first.name }));
      const d = await zohoRaw(cfg, `/items/${first.item_id}`) as { item: Record<string, unknown> };
      const it = d.item;
      say(`Item detail keys: ${Object.keys(it).join(', ')}`);
      say(`locations: ${JSON.stringify(it.locations ?? null).slice(0, 600)}`);
      say(`warehouses: ${JSON.stringify(it.warehouses ?? null).slice(0, 600)}`);
      say(`batch/serial flags: ${JSON.stringify({ track_batch_number: it.track_batch_number, track_serial_number: it.track_serial_number, is_batch_tracked: it.is_batch_tracked })}`);
    }
  }
  say('\nNext: copy the VFX_ZOHO_* values into Vercel (or run `npm run service`), then Integration Hub → Zoho → Live → Test connection.');
  say('Send the output above to Claude if anything looks wrong (batches missing, wrong warehouse names…).');
} catch (e) {
  const err = e as Error & { status?: number; body?: string };
  say(`✗ ${err.message}${err.body ? `\n  ${err.body.slice(0, 400)}` : ''}`);
  process.exit(1);
}
