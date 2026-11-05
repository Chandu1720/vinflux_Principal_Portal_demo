import React from 'react';
import { Blocks, Lock } from 'lucide-react';
import { Badge, Card, PageHeader, Switch } from '../ui';
import { MODULES } from '../modules';
import type { ModuleManifest } from '../modules';
import { usePlatform } from '../PlatformContext';
import { useApp } from '../../context/AppContext.tsx';

/** Settings → Modules: switch modules on/off for the active principal. */
const ModulesPage: React.FC = () => {
  const { enabled, setEnabled } = usePlatform();
  const { currentUser, activePrincipal, showToast } = useApp();
  const canEdit = !!currentUser.permissions.canConfigurePlatform;
  const name = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;
  const card = (m: ModuleManifest) => {
    const on = enabled(m.id);
    return (
      <div key={m.id} className="g2-card" style={{ padding: 16, opacity: m.status === 'planned' ? 0.75 : 1 }}>
        <div className="g2-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="g2-row" style={{ gap: 6 }}>
              <strong style={{ fontSize: 14.5 }}>{m.name}</strong>
              {m.core && <Badge tone="purple"><Lock size={10} /> Core</Badge>}
              {m.status === 'planned' ? <Badge tone="slate">Planned · phase {m.phase}</Badge> : <Badge tone={on ? 'green' : 'slate'} dot>{on ? 'On' : 'Off'}</Badge>}
              <span className="g2-small g2-muted">v{m.version}</span>
            </div>
            <div className="g2-small" style={{ marginTop: 6, color: 'var(--g2-text-2)' }}>{m.description}</div>
            <div className="g2-row" style={{ gap: 4, marginTop: 8 }}>
              {m.dependsOn.length > 0 && <span className="g2-small g2-muted">Needs:</span>}
              {m.dependsOn.map((d) => <span key={d} className="g2-chip">{name(d)}</span>)}
              {m.publishes.length > 0 && <span className="g2-small g2-muted" style={{ marginLeft: 6 }}>Publishes:</span>}
              {m.publishes.map((e) => <span key={e} className="g2-chip g2-mono" style={{ fontSize: 11 }}>{e}</span>)}
            </div>
          </div>
          {!m.core && m.status === 'available' && (
            <Switch checked={on} disabled={!canEdit} label={`${m.name} on/off`} onChange={(v) => { const r = setEnabled(m.id, v, currentUser.name); showToast(r.message, r.ok ? 'success' : 'warning'); }} />
          )}
        </div>
      </div>
    );
  };
  return (
    <div className="g2 g2-embed">
      <PageHeader title="Modules" description={<>Plug-and-play modules for <strong>{activePrincipal.name}</strong>. Switching a module off hides its screens; modules that depend on it must be switched off first.</>} />
      {!canEdit && <div className="g2-small" style={{ color: '#b45309', marginBottom: 12 }}>Only users with configuration rights can switch modules.</div>}
      <Card title={<span className="g2-row"><Blocks size={16} /> Available</span>}>
        <div className="g2-grid g2-grid-2">{MODULES.filter((m) => m.status === 'available').map(card)}</div>
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Roadmap" subtitle="Each module plugs into the same core (users, products, partners, approvals, audit, events).">
        <div className="g2-grid g2-grid-2">{MODULES.filter((m) => m.status === 'planned').sort((a, b) => (a.phase ?? 0) - (b.phase ?? 0)).map(card)}</div>
      </Card>
    </div>
  );
};
export default ModulesPage;
