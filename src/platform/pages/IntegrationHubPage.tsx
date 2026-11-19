import React, { useState } from 'react';
import { ArrowLeftRight, Cable, Plus, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, FormGrid, Input, Modal, PageHeader, Select, Switch, Tabs } from '../ui';
import { CONNECTORS, connectorSettings, retryFailures, runSapStockSync, saveSettings, subscribeConnectors, syncRuns } from '../integrations/connectors';
import type { ConnectorDef, ConnectorSettings } from '../integrations/connectors';
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
  const [s, setS] = useState<ConnectorSettings>(() => connectorSettings(def.id));
  const [newPlant, setNewPlant] = useState('');
  const canEdit = !!currentUser.matrix?.data?.includes('configure');
  const dirty = JSON.stringify(s) !== JSON.stringify(connectorSettings(def.id));
  const runs = syncRuns().filter((r) => r.connectorId === def.id).slice(0, 5);
  const sync = () => {
    if (dirty) saveSettings(def.id, s);
    const r = runSapStockSync(ctx);
    showToast(`SAP sync: ${r.status} — ${r.imported} imported, ${r.failed} failed.`, r.status === 'Failed' ? 'danger' : r.failed ? 'warning' : 'success');
    setS(connectorSettings(def.id));
  };
  return (
    <Modal open size="lg" title={def.name} subtitle={`${def.kind} · ${def.direction} · ${def.entities.join(', ')}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Close</Button>{def.availability === 'sandbox' && canEdit && <Button disabled={!dirty} onClick={() => { saveSettings(def.id, s); showToast('Connector settings saved.', 'success'); }}>Save settings</Button>}{def.id === 'sap' && <Button variant="primary" icon={<RefreshCw size={14} />} onClick={sync}>Sync stock now</Button>}</>}>
      <div className="g2-stack">
        <div className="g2-small" style={{ color: 'var(--g2-text-2)' }}>{def.description}</div>
        {def.availability === 'planned' && <Alert tone="info">This connector is on the roadmap. The same pipeline (mapping → checks → import history → undo) will be used, so no screen changes are needed when it goes live.</Alert>}
        {def.availability === 'built-in' && <Alert tone="info">Used by partner onboarding to verify GSTINs (sandbox registry). E-invoice and e-way bill arrive with Orders & Logistics.</Alert>}
        {def.availability === 'sandbox' && (
          <>
            <FormGrid>
              <Field label="Connector"><Switch checked={s.enabled} disabled={!canEdit} label="Enabled" onChange={(v) => setS({ ...s, enabled: v })} /></Field>
              <Field label="Schedule"><Select value={s.schedule} disabled={!canEdit} options={['Manual', 'Every 15 minutes', 'Hourly', 'Nightly'].map((x) => ({ value: x, label: x }))} onChange={(v) => setS({ ...s, schedule: v as ConnectorSettings['schedule'] })} /></Field>
              <Field label="API endpoint"><Input value={s.endpoint} readOnly={!canEdit} onChange={(e) => setS({ ...s, endpoint: e.target.value })} /></Field>
              <Field label="Client / credentials" hint="Stored in the server's secret vault in production"><Input value={`Client ${s.client} · ••••••••`} readOnly /></Field>
            </FormGrid>
            <div>
              <div className="g2-label" style={{ marginBottom: 6 }}><ArrowLeftRight size={13} /> Value mapping — SAP plant → VinFlux warehouse</div>
              <div className="g2-table-wrap" style={{ border: '1px solid var(--g2-border)', borderRadius: 10 }}>
                <table className="g2-table">
                  <thead><tr><th style={{ width: 140 }}>SAP plant</th><th>VinFlux warehouse</th><th /></tr></thead>
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
              {canEdit && <div className="g2-row" style={{ marginTop: 8 }}><div style={{ width: 160 }}><Input value={newPlant} placeholder="Plant code, e.g. WH09" onChange={(e) => setNewPlant(e.target.value.toUpperCase())} /></div><Button size="sm" icon={<Plus size={13} />} disabled={!newPlant || newPlant in s.plantMap} onClick={() => { setS({ ...s, plantMap: { ...s.plantMap, [newPlant]: '' } }); setNewPlant(''); }}>Add plant</Button></div>}
              <div className="g2-hint" style={{ marginTop: 6 }}>Columns (Material, Batch, SLED, Unrestricted…) are matched automatically by their SAP names; materials are matched by product code, SKU, GTIN or ERP code.</div>
            </div>
            <div>
              <div className="g2-label" style={{ marginBottom: 6 }}>Recent syncs</div>
              {runs.length === 0 ? <div className="g2-muted g2-small">Not synced yet.</div> : runs.map((r) => (
                <div key={r.id} className="g2-list-item g2-small">
                  <span style={{ flex: 1 }}>{new Date(r.at).toLocaleString('en-IN')} · {r.entity}</span>
                  <span>{r.imported} imported · {r.failed} failed</span>
                  <Badge tone={r.status === 'Success' ? 'green' : r.status === 'Partial' ? 'amber' : r.status === 'No changes' ? 'slate' : 'red'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
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
                <div className="g2-label" style={{ marginBottom: 8 }}>{k}</div>
                <div className="g2-grid g2-grid-2">
                  {CONNECTORS.filter((c) => c.kind === k).map((c) => {
                    const st = connectorSettings(c.id);
                    return (
                      <button key={c.id} type="button" className="g2-type-pick" style={{ alignItems: 'flex-start' }} onClick={() => setOpen(c)}>
                        <div style={{ textAlign: 'left' }}>
                          <div className="g2-row" style={{ gap: 6 }}><Cable size={15} /><strong>{c.name}</strong><Badge tone={c.availability === 'sandbox' && !st.enabled ? 'slate' : AVAIL[c.availability].tone} dot>{c.availability === 'sandbox' && !st.enabled ? 'Switched off' : AVAIL[c.availability].label}</Badge></div>
                          <div className="g2-cell-sub" style={{ marginTop: 4 }}>{c.description}</div>
                          {c.availability === 'sandbox' && <div className="g2-cell-sub">Last sync: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString('en-IN') : 'never'} · {st.schedule}</div>}
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
                {runs.length === 0 && <tr><td colSpan={7} className="g2-muted">No syncs yet — open SAP S/4HANA and press “Sync stock now”.</td></tr>}
                {runs.map((r) => {
                  const left = r.failures.filter((f) => !f.resolved);
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="clickable" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        <td className="g2-small">{new Date(r.at).toLocaleString('en-IN')}</td>
                        <td className="g2-strong">{CONNECTORS.find((c) => c.id === r.connectorId)?.name}</td>
                        <td>{r.entity}</td>
                        <td className="g2-small">{r.total} · {r.imported} imported · <span style={{ color: left.length ? 'var(--g2-red)' : undefined }}>{left.length} failing</span></td>
                        <td><Badge tone={r.status === 'Success' ? 'green' : r.status === 'Partial' ? 'amber' : r.status === 'No changes' ? 'slate' : 'red'} dot>{r.status}</Badge></td>
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
