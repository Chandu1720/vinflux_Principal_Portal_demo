# VinFlux Platform — plug-and-play modules, data import, integrations

## Modules (`modules.ts`, `PlatformContext.tsx`)
Every module has a manifest: name, version, `dependsOn`, the app paths it owns, the events it publishes/subscribes.
*Platform → Modules* switches modules on/off **per principal** (stored in `vinflux.modules.v1`).
- Core modules (Product Master, Integration Hub) are always on.
- A module can't be switched on before its dependencies, or off while another module depends on it.
- When a module is off its sidebar entries disappear and its routes show "module switched off" (Go-to-Market redirects to Modules).
- Planned modules (Users & Roles, Price Lists, QC, Orders, Logistics, Returns, Recall, Performance) are listed with their phase.

To add a module: create `src/modules/<name>/`, add a manifest to `MODULES`, add its routes in `App.tsx` wrapped in `guard(...)`, and its sidebar entry behind `enabled('<id>')`.

## Events (`events.ts`)
Modules publish events instead of calling each other: `emit(type, source, actor, summary, data)`; others `on(type, handler)`.
The last 200 events are visible in *Integration Hub → Event log*. In production this becomes a message queue / webhook outbox.

## Data Import (`import/`)
One wizard for every data type: template → upload (.xlsx / .csv) → match columns (auto-matched by name and ERP aliases; mapping saved for next time) → check every row → import → history with **undo**.
- Data types live in `import/entities.ts` (currently **Opening stock** and **Products**). Each defines columns, `validate`, `apply` and `undo`.
- Rows with errors are skipped; an error report (CSV) can be downloaded.
- Opening stock is written as opening-balance entries in the stock ledger; undo adds reversing entries (nothing is deleted).
- Imported products are created as **Draft** and go through maker-checker approval; updates to existing products are recorded in their history and restored on undo.

## Integration Hub (`integrations/connectors.ts`)
Connectors reuse the import pipeline (same checks, history, undo).
- **SAP S/4HANA (sandbox)**: stock snapshot in MB52 shape (Plant, Storage Location, Material, Batch, Serial Number, Mfg Date, SLED, Unrestricted, Moving Avg Price). Value mapping *SAP plant → VinFlux warehouse*. Sync log shows every failed record; fix the mapping and **Retry failed**.
- **GST (GSP)**: built in (partner onboarding GSTIN verification, sandbox).
- Tally, Zoho, NetSuite, Dynamics, courier aggregators, WhatsApp/SMS: listed as planned.

INTEGRATION POINTS: `POST /imports` (multipart) + `GET /imports/:id`, `POST /imports/:id/undo`; connectors run server-side with credentials in a secret vault.

## Inventory foundation (`src/modules/inventory/`)
Stock is a ledger of movements; balances by warehouse × bin × product × batch × serial × status are computed. *Stock on Hand* shows balances, near-expiry and the ledger.

Demo data is kept in the browser (localStorage keys `vinflux.*`).
