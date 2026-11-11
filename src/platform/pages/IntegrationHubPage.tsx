import React, { useState } from 'react';
import { ArrowLeftRight, Cable, Plus, RefreshCw, RotateCw, Server, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, Modal, PageHeader, Select, Switch, Tabs } from '../ui';
import { CONNECTORS, connectorSettings, mappingConflicts, retryFailures, saveSettings, subscribeConnectors, syncRuns } from '../integrations/connectors';
import { nextRunAt, runLiveSync, runStockSync } from '../integrations/stockSync';
import { accessKey, callErp, setAccessKey } from '../integrations/liveClient';
import type { LiveError } from '../integrations/liveClient';
import { usePartners } from '../../modules/gtm-v2/hooks/useGtmData';
import { ErpLocationsPanel, PartnerErpImportDrawer, ProductErpImportDrawer } from '../integrations/ErpImport';
import type { ConnectorDef, ConnectorSettings } from '../integrations/connectors';
import { erpProfile } from '../integrations/erpProfiles';
import { getEventLog } from '../events';
import { useImportContext } from '../import/useImportContext';
import { useSubscribe } from '../useStore';
import { useApp } from '../../context/AppContext.tsx';
import { subscribeImports } from '../import/history';

const AVAIL: Record<ConnectorDef['availability'], { label: string; tone: 'green' | 'blue' | 'slate' }> = {
  sandbox: { label: 'Connected · sandbox', tone: 'green' },
  'built-in': { label: 'Built in · sandbox', tone: 'blue' },
  planned: { label: 'Planned', tone: 'slate' },
};

const ConnectorDrawer: React.FC<{ def: ConnectorDef; onClose: () => void }> = ({ def, onClose }) => {
  const ctx = useImportContext();
  const { showToast, warehouses, currentUser } = useApp();
  useSubscribe(subscribeConnectors);
  const [s, setS] = useState<ConnectorSettings>(() => connectorSettings(def.id));
  const [newPlant, setNewPlant] = useState('');
  const canEdit = !!currentUser.matrix?.data?.includes('configure');
  const dirty = JSON.stringify(s) !== JSON.stringify(connectorSettings(def.id));
  const runs = syncRuns().filter((r) => r.connectorId === def.id).slice(0, 6);
  const prof = erpProfile(def.id);
  const tally = prof?.access === 'agent';
  const locLabel = prof ? `${prof.name.split(' ')[0] === 'Microsoft' ? 'Dynamics' : prof.name.split(' ')[0]} ${prof.locationLabel.toLowerCase()}` : 'Location';
  const conflicts = mappingConflicts(def.id, s);
  const save = () => {
    if (s.enabled && conflicts.length) { showToast(conflicts.join(' '), 'danger'); return false; }
    saveSettings(def.id, s); return true;
  };
  const [key, setKey] = useState(accessKey());
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [master, setMaster] = useState<'products' | 'customers' | null>(null);
  const partners = usePartners().data ?? [];
  const live = s.mode === 'Live';
  const sync = async () => {
    if (dirty && !save()) return;
    setBusy(true);
    const r = live ? await runLiveSync(def.id, ctx) : runStockSync(def.id, ctx);
    setBusy(false);
    showToast(`${def.name}: ${r.status} — ${r.message}`, r.status === 'Failed' ? 'danger' : r.failed ? 'warning' : 'success');
    setS(connectorSettings(def.id));
  };
  const testLive = async () => {
    if (dirty && !save()) return;
    setAccessKey(key); setBusy(true);
    try {
      const r = await callErp<{ ok: boolean; message: string; details?: Record<string, unknown> }>(def.id, 'test');
      const d = r.details ?? {};
      const locs = (['locations', 'warehouses', 'godowns', 'samplePlants', 'organizations'] as const).flatMap((k) => (Array.isArray(d[k]) ? (d[k] as unknown[]).map(String) : []));
      const next = { ...connectorSettings(def.id), lastTest: { at: new Date().toISOString(), ok: r.ok, message: r.message, locations: locs } };
      saveSettings(def.id, next); setS(next); showToast(r.message, r.ok ? 'success' : 'warning');
    } catch (e) {
      const next = { ...connectorSettings(def.id), lastTest: { at: new Date().toISOString(), ok: false, message: `${(e as Error).message}${(e as LiveError).detail ? ` — ${(e as LiveError).detail!.slice(0, 200)}` : ''}` } };
      saveSettings(def.id, next); setS(next); showToast((e as Error).message, 'danger');
    } finally { setBusy(false); }
  };
  const setAgent = (status: ConnectorSettings['agentStatus']) => {
    const next = { ...s, agentStatus: status, agentHeartbeatAt: status === 'Online' ? new Date().toISOString() : s.agentHeartbeatAt, enabled: status === 'Online' ? true : s.enabled };
    if (next.enabled && mappingConflicts(def.id, next).length) { showToast(mappingConflicts(def.id, next).join(' '), 'danger'); return; }
    saveSettings(def.id, next); setS(next);
    showToast(status === 'Online' ? `Agent connected — ${def.name} can now be synced.` : 'Agent marked offline.', status === 'Online' ? 'success' : 'warning');
  };
  const next = nextRunAt(def.id);
  return (
    <Modal open size="lg" title={def.name} subtitle={`${def.kind} · ${def.direction} · ${def.entities.join(', ')}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Close</Button>{def.availability === 'sandbox' && canEdit && <Button disabled={!dirty} onClick={() => { if (save()) showToast('Connector settings saved.', 'success'); }}>Save settings</Button>}{def.availability === 'sandbox' && def.kind === 'ERP' && <Button variant="primary" icon={<RefreshCw size={14} />} disabled={busy} onClick={() => void sync()}>{busy ? 'Working…' : live ? 'Sync live stock now' : 'Sync stock now'}</Button>}</>}>
      <div className="g2-stack">
        <div className="g2-small" style={{ color: 'var(--g2-text-2)' }}>{def.description}</div>
        {def.availability === 'planned' && <Alert tone="info">This connector is on the roadmap. The same pipeline (mapping → checks → import history → undo) will be used, so no screen changes are needed when it goes live.</Alert>}
        {def.availability === 'built-in' && <Alert tone="info">Used by partner onboarding to verify GSTINs (sandbox registry). E-invoice and e-way bill details come back from the ERP with each invoice.</Alert>}
        {prof && (
          <Card title="How VinFlux connects" subtitle={`${prof.editions}. Suits: ${prof.fit}.`}>
            <dl className="g2-dl">
              <dt>Interface</dt><dd>{prof.api}</dd>
              <dt>Sign-in</dt><dd>{prof.auth}</dd>
              <dt>Stock location</dt><dd>{prof.locationLabel} ({prof.locationHint})</dd>
              <dt>Batch / serial</dt><dd>{prof.batchSerial}</dd>
            </dl>
            <div className="g2-table-wrap" style={{ marginTop: 8 }}><table className="g2-table">
              <thead><tr><th>VinFlux</th><th>{prof.name} object</th><th>Direction</th></tr></thead>
              <tbody>{prof.objects.map((o) => <tr key={o.vinflux}><td className="g2-strong">{o.vinflux}</td><td className="g2-small g2-mono">{o.erp}</td><td className="g2-small">{o.direction}</td></tr>)}</tbody>
            </table></div>
            <div className="g2-label" style={{ margin: '10px 0 4px' }}>Set-up (principal’s IT)</div>
            <ol className="g2-small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>{prof.setup.map((x) => <li key={x}>{x}</li>)}</ol>
          </Card>
        )}
        {tally && (
          <Card title={<span className="g2-row"><Server size={15} /> On-premise agent</span>} subtitle={`${def.name} runs on the principal’s own PC / server with no cloud API. A small VinFlux agent runs as a Windows service next to it, reads it locally and sends changes out over HTTPS — no inbound firewall ports needed.`}>
            <div className="g2-stack">
              <div className="g2-row" style={{ gap: 8 }}>
                <span className="g2-small">Status</span>
                <Badge tone={s.agentStatus === 'Online' ? 'green' : s.agentStatus === 'Offline' ? 'red' : 'slate'} dot>{s.agentStatus}</Badge>
                {s.agentHeartbeatAt && <span className="g2-small g2-muted">last heartbeat {new Date(s.agentHeartbeatAt).toLocaleString('en-IN')}</span>}
              </div>
              <ol className="g2-small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Download <strong>VinFlux Agent</strong> on the PC / server where {def.name} runs.</li>
                <li>Paste this key during setup: <span className="g2-mono g2-strong">{s.agentKey}</span></li>
                <li>Choose the company{s.sourceCompany ? <>: <strong>{s.sourceCompany}</strong></> : ''} — and keep {def.name} running.</li>
                <li>Map each {prof?.locationLabel.toLowerCase() ?? 'location'} to a VinFlux warehouse below.</li>
              </ol>
              {canEdit && <div className="g2-row" style={{ gap: 8 }}>
                <Button size="sm" variant="primary" disabled={s.agentStatus === 'Online'} onClick={() => setAgent('Online')}>Agent connected (demo)</Button>
                <Button size="sm" variant="ghost" disabled={s.agentStatus !== 'Online'} onClick={() => setAgent('Offline')}>Simulate agent offline</Button>
              </div>}
            </div>
          </Card>
        )}
        {def.availability === 'sandbox' && def.kind === 'ERP' && (
          <Card title="Connection" subtitle={live ? 'Live: VinFlux reads and writes the real ERP through the VinFlux integration service. ERP passwords and keys stay on that service (environment variables), never in the browser.' : 'Sandbox: sample data that behaves like this ERP — for demos and training.'}>
            <div className="g2-stack">
              <FormGrid>
                <Field label="Mode"><Select value={s.mode ?? 'Sandbox'} disabled={!canEdit} options={[{ value: 'Sandbox', label: 'Sandbox (demo data)' }, { value: 'Live', label: 'Live (real ERP)' }]} onChange={(v) => setS({ ...s, mode: v as 'Sandbox' | 'Live' })} /></Field>
                {live && <Field label="Integration service" hint={tally ? 'On-premise ERP: use the standalone service URL — the agent next to the ERP talks to it.' : 'Leave as /api/erp for the Vercel function, or the standalone service URL.'}><Input value={s.serviceUrl ?? '/api/erp'} readOnly={!canEdit} onChange={(e) => setS({ ...s, serviceUrl: e.target.value })} /></Field>}
                {live && <Field label="VinFlux access key" hint="Same value as VFX_API_KEY on the service. Kept in this browser only."><div className="g2-row" style={{ gap: 6 }}><Input type={showKey ? 'text' : 'password'} name="vinflux-access-key" autoComplete="new-password" value={key} onChange={(e) => setKey(e.target.value.trim())} /><Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? 'Hide' : 'Show'}</Button></div></Field>}
              </FormGrid>
              {live && <div className="g2-row" style={{ gap: 8 }}>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void testLive()}>{busy ? 'Testing…' : 'Test connection'}</Button>
                {s.lastTest && <span className="g2-small" style={{ color: s.lastTest.ok ? 'var(--g2-green, #047857)' : 'var(--g2-red, #b91c1c)' }}>{s.lastTest.message} <span className="g2-muted">({new Date(s.lastTest.at).toLocaleString('en-IN')})</span></span>}
              </div>}
              {live && s.lastTest?.ok && !!s.lastTest.locations?.length && <div className="g2-small">Locations in {def.name}: {s.lastTest.locations.map((l) => (
                <button key={l} type="button" className="g2-chip" style={{ marginRight: 4, cursor: canEdit ? 'pointer' : 'default' }} disabled={!canEdit || l in s.plantMap} onClick={() => setS({ ...s, plantMap: { ...s.plantMap, [l]: '' } })}>{l}{l in s.plantMap ? ' ✓' : ' +'}</button>))}</div>}
              {live && s.lastTest?.ok && <div className="g2-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="g2-small g2-muted">Master data:</span>
                <Button size="sm" disabled={!canEdit || dirty} onClick={() => setMaster('products')}>Import products</Button>
                <Button size="sm" disabled={!canEdit || dirty} onClick={() => setMaster('customers')}>Import customers → partners</Button>
                {dirty && <span className="g2-small g2-muted">Save settings first</span>}
              </div>}
              {live && <div className="g2-hint">Server set-up: environment variables named VFX_{def.id.toUpperCase().replace(/-/g, '_')}_… (see the connector guide). Without them the test answers “not configured” and lists what is missing.</div>}
            </div>
          </Card>
        )}
        {def.availability === 'sandbox' && def.kind === 'ERP' && (
          <>
            <FormGrid>
              <Field label="Connector"><Switch checked={s.enabled} disabled={!canEdit} label="Enabled" onChange={(v) => setS({ ...s, enabled: v })} /></Field>
              <Field label="Schedule" hint={next ? `Next run ${new Date(next).toLocaleString('en-IN')}` : s.lastSyncAt ? 'Runs only when you press Sync' : 'The first sync is always manual'}><Select value={s.schedule} disabled={!canEdit} options={['Manual', 'Every 15 minutes', 'Hourly', 'Nightly'].map((x) => ({ value: x, label: x }))} onChange={(v) => setS({ ...s, schedule: v as ConnectorSettings['schedule'] })} /></Field>
              <Field label="When the ERP stock changes" hint="Review = differences wait in Inventory → Reconciliation"><Select value={s.applyMode ?? 'Auto'} disabled={!canEdit} options={[{ value: 'Auto', label: 'Apply automatically' }, { value: 'Review', label: 'Hold for review' }]} onChange={(v) => setS({ ...s, applyMode: v as 'Auto' | 'Review' })} /></Field>
              <Field label={tally ? 'Address seen by the agent' : 'API endpoint'} hint={prof?.endpointHint}><Input value={s.endpoint} readOnly={!canEdit} onChange={(e) => setS({ ...s, endpoint: e.target.value })} /></Field>
              {!tally && <Field label={prof?.tenantLabel ?? 'Tenant'}><Input value={s.client} readOnly={!canEdit} onChange={(e) => setS({ ...s, client: e.target.value })} /></Field>}
            </FormGrid>
            {conflicts.length > 0 && <Alert tone="error">{conflicts.join(' ')} A warehouse can be fed by one ERP only.</Alert>}
            <div>
              <div className="g2-label" style={{ marginBottom: 6 }}><ArrowLeftRight size={13} /> Value mapping — {locLabel} → VinFlux warehouse (this ERP is the master of these warehouses)</div>
              <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}>
                <table className="g2-table">
                  <thead><tr><th style={{ width: 200 }}>{locLabel}</th><th>VinFlux warehouse</th><th /></tr></thead>
                  <tbody>
                    {Object.entries(s.plantMap).map(([plant, code]) => (
                      <tr key={plant}>
                        <td className="g2-mono g2-strong">{plant}</td>
                        <td><Select value={code} disabled={!canEdit} placeholder="Not mapped" options={warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` }))} onChange={(v) => setS({ ...s, plantMap: { ...s.plantMap, [plant]: v } })} /></td>
                        <td className="actions"><Button size="sm" variant="ghost" disabled={!canEdit} icon={<Trash2 size={13} />} onClick={() => { const m = { ...s.plantMap }; delete m[plant]; setS({ ...s, plantMap: m }); }}>Remove</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEdit && <div className="g2-row" style={{ marginTop: 8 }}><div style={{ width: 200 }}><Input value={newPlant} placeholder={prof?.locationHint ?? 'Location'} onChange={(e) => setNewPlant(def.id === 'sap' ? e.target.value.toUpperCase() : e.target.value)} /></div><Button size="sm" icon={<Plus size={13} />} disabled={!newPlant || newPlant in s.plantMap} onClick={() => { setS({ ...s, plantMap: { ...s.plantMap, [newPlant]: '' } }); setNewPlant(''); }}>Add {prof?.locationLabel.toLowerCase() ?? 'location'}</Button></div>}
              {live && <ErpLocationsPanel connectorId={def.id} plantMap={s.plantMap} canEdit={canEdit} onMap={(loc, code) => setS((x) => ({ ...x, plantMap: { ...x.plantMap, [loc]: code } }))} />}
              {live && <div style={{ marginTop: 12 }}>
                <div className="g2-label" style={{ marginBottom: 6 }}><ArrowLeftRight size={13} /> Partners → {def.name} customer (used on sales orders; blank = the partner code)</div>
                <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10, maxHeight: 260, overflow: 'auto' }}><table className="g2-table">
                  <thead><tr><th>Partner</th><th style={{ width: 240 }}>Customer in {def.name}</th></tr></thead>
                  <tbody>{partners.filter((p) => p.status === 'Active').map((p) => (
                    <tr key={p.id}><td>{p.name}<div className="g2-cell-sub">{p.code}</div></td>
                      <td><Input value={s.customerMap?.[p.id] ?? ''} readOnly={!canEdit} placeholder={p.code} onChange={(e) => setS({ ...s, customerMap: { ...(s.customerMap ?? {}), [p.id]: e.target.value } })} /></td></tr>
                  ))}</tbody>
                </table></div>
              </div>}
              <div className="g2-hint" style={{ marginTop: 6 }}>First sync = full stock snapshot (same checks as a file import). Later syncs bring only the differences. Products are matched by product code, SKU, GTIN or ERP code.</div>
            </div>
            <div>
              <div className="g2-label" style={{ marginBottom: 6 }}>Recent syncs</div>
              {runs.length === 0 ? <div className="g2-muted g2-small">Not synced yet.</div> : runs.map((r) => (
                <div key={r.id} className="g2-list-item g2-small">
                  <span style={{ flex: 1 }}>{new Date(r.at).toLocaleString('en-IN')} · {r.entity} · {r.by}</span>
                  <span style={{ maxWidth: 320 }}>{r.message}</span>
                  <Badge tone={r.status === 'Success' ? 'green' : r.status === 'Partial' || r.status === 'Waiting review' ? 'amber' : r.status === 'No changes' ? 'slate' : 'red'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {master === 'products' && <ProductErpImportDrawer onClose={() => setMaster(null)} />}
      {master === 'customers' && <PartnerErpImportDrawer onClose={() => { setMaster(null); setS(connectorSettings(def.id)); }} />}
    </Modal>
  );
};

const IntegrationHubPage: React.FC = () => {
  const ctx = useImportContext();
  const { showToast } = useApp();
  useSubscribe(subscribeConnectors, subscribeImports);
  const [tab, setTab] = useState('connectors');
  const [open, setOpen] = useState<ConnectorDef | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const runs = syncRuns();
  const events = getEventLog();
  const kinds = Array.from(new Set(CONNECTORS.map((c) => c.kind)));
  const openFailures = runs.reduce((a, r) => a + r.failures.filter((f) => !f.resolved).length, 0);

  return (
    <div className="g2 g2-embed">
      <PageHeader title="Integration Hub" description="Connect VinFlux to the principal's ERP and services. Every connector uses the same pipeline as file imports: mapping → checks → import history → undo." />
      {openFailures > 0 && <div style={{ marginBottom: 12 }}><Alert tone="warn">{openFailures} record(s) failed in the last syncs. Open the Sync log, fix the mapping and retry.</Alert></div>}
      <Card flush>
        <div className="g2-filterbar"><Tabs active={tab} onChange={setTab} tabs={[{ id: 'connectors', label: 'Connectors', count: CONNECTORS.length }, { id: 'log', label: 'Sync log', count: runs.length }, { id: 'events', label: 'Event log', count: events.length }]} /></div>
        {tab === 'connectors' && (
          <div style={{ padding: 18 }} className="g2-stack">
            {kinds.map((k) => (
              <div key={k}>
                <div className="g2-label" style={{ marginBottom: 8 }}>{k === 'ERP' ? 'ERP — one ERP is the master of each warehouse; the same adapter pattern for every ERP' : k}</div>
                <div className="g2-grid g2-grid-2">
                  {CONNECTORS.filter((c) => c.kind === k).map((c) => {
                    const st = connectorSettings(c.id);
                    return (
                      <button key={c.id} type="button" className="g2-type-pick" style={{ alignItems: 'flex-start' }} onClick={() => setOpen(c)}>
                        <div style={{ textAlign: 'left' }}>
                          <div className="g2-row" style={{ gap: 6 }}><Cable size={15} /><strong>{c.name}</strong><Badge tone={c.availability === 'sandbox' && !st.enabled ? 'slate' : AVAIL[c.availability].tone} dot>{c.availability === 'sandbox' && !st.enabled ? 'Switched off' : AVAIL[c.availability].label}</Badge></div>
                          <div className="g2-cell-sub" style={{ marginTop: 4 }}>{c.description}</div>
                          {c.availability === 'sandbox' && c.kind === 'ERP' && <div className="g2-cell-sub">Last sync: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString('en-IN') : 'never'} · {st.schedule}{erpProfile(c.id)?.access === 'agent' ? ` · agent ${st.agentStatus}` : ''}{st.enabled ? ` · ${Object.values(st.plantMap).filter(Boolean).length} warehouse(s) mapped` : ''}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'log' && (
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>When</th><th>Connector</th><th>Data</th><th>Records</th><th>Status</th><th>Result</th><th /></tr></thead>
              <tbody>
                {runs.length === 0 && <tr><td colSpan={7} className="g2-muted">No syncs yet — open SAP S/4HANA (or Tally) and press “Sync stock now”.</td></tr>}
                {runs.map((r) => {
                  const left = r.failures.filter((f) => !f.resolved);
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="clickable" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        <td className="g2-small">{new Date(r.at).toLocaleString('en-IN')}</td>
                        <td className="g2-strong">{CONNECTORS.find((c) => c.id === r.connectorId)?.name}</td>
                        <td>{r.entity}</td>
                        <td className="g2-small">{r.total} · {r.imported} imported · <span style={{ color: left.length ? 'var(--g2-red)' : undefined }}>{left.length} failing</span></td>
                        <td><Badge tone={r.status === 'Success' ? 'green' : r.status === 'Partial' || r.status === 'Waiting review' ? 'amber' : r.status === 'No changes' ? 'slate' : 'red'} dot>{r.status}</Badge></td>
                        <td className="g2-small">{r.message}</td>
                        <td>{left.length > 0 && <Button size="sm" icon={<RotateCw size={13} />} onClick={(e) => { e.stopPropagation(); const x = retryFailures(r.id, ctx); showToast(`Retry: ${x.fixed} imported, ${x.still} still failing.`, x.still ? 'warning' : 'success'); }}>Retry failed</Button>}</td>
                      </tr>
                      {expanded === r.id && r.failures.length > 0 && (
                        <tr><td colSpan={7} style={{ background: 'var(--g2-slate-bg)' }}>
                          {r.failures.map((f) => (
                            <div key={f.row} className="g2-small" style={{ padding: '4px 0', opacity: f.resolved ? 0.55 : 1 }}>
                              <span className="g2-mono">Row {f.row}</span> · {f.values.warehouse} · {f.values.product} · batch {f.values.batch || '—'} · qty {f.values.qty} → {f.resolved ? <Badge tone="green">Fixed & imported</Badge> : <span style={{ color: 'var(--g2-red)' }}>{f.errors.join(' ')}</span>}
                            </div>
                          ))}
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'events' && (
          <div className="g2-table-wrap">
            <table className="g2-table">
              <thead><tr><th>When</th><th>Module</th><th>Event</th><th>What happened</th><th>By</th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={5} className="g2-muted">No events yet.</td></tr>}
                {events.map((e) => (
                  <tr key={e.id}><td className="g2-small">{new Date(e.at).toLocaleString('en-IN')}</td><td>{e.source}</td><td><span className="g2-chip g2-mono" style={{ fontSize: 11 }}>{e.type}</span></td><td className="g2-small">{e.summary}</td><td className="g2-small">{e.by}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <ConnectorDrawer def={open} onClose={() => setOpen(null)} />}
    </div>
  );
};
export default IntegrationHubPage;
