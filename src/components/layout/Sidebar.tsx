import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.tsx';
import { usePlatform } from '../../platform/PlatformContext';
import { WORKSPACE_LABEL } from '../../platform/workspace';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activePrincipal, principals, setActivePrincipal, currentUser, showToast, switchUser, workspace, signOut } = useApp();

  const isProducts = location.pathname === '/' || location.pathname.startsWith('/products');
  const isBranches = location.pathname.startsWith('/branches');
  const isWarehouses = location.pathname.startsWith('/warehouses');
  const { enabled } = usePlatform();
  const nav = (path: string, label: string, icon: React.ReactNode) => (
    <button type="button" className={`vf-nav-item ${location.pathname.startsWith(path) ? 'active' : ''}`} onClick={() => navigate(path)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
      {icon}<span>{label}</span>
    </button>
  );
  const ic = (d: string) => <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d} /></svg>;

  const handleSwitchPrincipal = () => {
    const currentIndex = principals.findIndex((p) => p.id === activePrincipal.id);
    const nextIndex = (currentIndex + 1) % principals.length;
    const nextPrincipal = principals[nextIndex];
    setActivePrincipal(nextPrincipal);
    showToast(`Switched active principal to "${nextPrincipal.name}".`, 'info');
  };

  return (
    <aside className="vf-sidebar" aria-label="Application Navigation">
      <div className="vf-sidebar-header">
        <div
          className="vf-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <div className="vf-brand-logo">V</div>
          <div className="vf-brand-text">
            VinFlux <span className="vf-brand-badge">2.0</span>
          </div>
        </div>
        <span style={{ fontSize: '10.5px', color: '#c4b5fd', fontWeight: 600, textAlign: 'right', lineHeight: 1.2 }} title="Industry workspace of your company">{WORKSPACE_LABEL[workspace]}</span>
      </div>

      {/* Active Principal Context */}
      <div className="vf-principal-card">
        <div className="vf-principal-label">
          <span>Active Principal</span>
          <span
            style={{ color: '#60a5fa', cursor: 'pointer', fontWeight: 600 }}
            onClick={handleSwitchPrincipal}
            title="Click to cycle active principal"
          >
            Switch ▾
          </span>
        </div>
        <div className="vf-principal-name" title={activePrincipal.name}>
          {activePrincipal.name}
        </div>
      </div>

      {/* Operational Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Product Group */}
        <div className="vf-nav-section">
          <div className="vf-nav-heading">Product Operations</div>
          <button
            type="button"
            className={`vf-nav-item ${isProducts ? 'active' : ''}`}
            onClick={() => navigate('/')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Product master</span>
          </button>
        </div>

        {/* Go-to-Market Group */}
        {enabled('go-to-market') && <div className="vf-nav-section">
          <div className="vf-nav-heading">Go-to-market</div>

          {/* Both open the Go-to-Market module (its own full-screen layout). */}
          <button
            type="button"
            className="vf-nav-item"
            onClick={() => navigate('/gtm-v2/dashboard')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>GTM Dashboard &amp; Setup</span>
          </button>

          <button
            type="button"
            className="vf-nav-item"
            onClick={() => navigate('/gtm-v2/partners')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Partners</span>
          </button>
        </div>}

        {/* Medical: surgery cases, sets, implants */}
        {enabled('surgical') && <div className="vf-nav-section">
          <div className="vf-nav-heading">Surgery & Implants</div>
          {nav('/surgical', 'Cases, Sets & Implants', ic('M9 2h6v4H9zM4 6h16v14H4zM12 10v6M9 13h6'))}
        </div>}

        {/* Commercial */}
        {enabled('price-lists') && <div className="vf-nav-section">
          <div className="vf-nav-heading">Commercial</div>
          {nav('/pricing', 'Price Lists & Contracts', ic('M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01'))}
        </div>}

        {/* Supply Infrastructure Group */}
        <div className="vf-nav-section">
          <div className="vf-nav-heading">Supply Infrastructure</div>
          <button
            type="button"
            className={`vf-nav-item ${isBranches ? 'active' : ''}`}
            onClick={() => navigate('/branches')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 11h6M9 15h6" />
            </svg>
            <span>Branch Master</span>
          </button>

          <button
            type="button"
            className={`vf-nav-item ${isWarehouses ? 'active' : ''}`}
            onClick={() => navigate('/warehouses')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
              <path d="M6 18h12" />
              <path d="M6 14h12" />
              <rect x="10" y="10" width="4" height="8" />
            </svg>
            <span>Warehouse Master</span>
          </button>
          {enabled('inventory') && nav('/inventory', 'Stock on Hand', ic('M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4'))}
        </div>

        {/* Platform */}
        <div className="vf-nav-section">
          <div className="vf-nav-heading">Platform</div>
          {nav('/data-import', 'Data Import', ic('M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3'))}
          {nav('/integrations', 'Integration Hub', ic('M8 7h8M8 12h8M8 17h5M4 4h16v16H4z'))}
          {enabled('users') && nav('/users', 'Users & Roles', ic('M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'))}
          {nav('/modules', 'Modules', ic('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'))}
        </div>
      </nav>

      {/* Sidebar User Footer */}
      <div className="vf-sidebar-footer" style={{ marginTop: 'auto' }}>
        <div className="vf-user-profile">
          <div className="vf-avatar">{currentUser.name.replace(/^Dr\.\s*/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</div>
          <div className="vf-user-info">
            <div className="vf-user-name" onClick={switchUser} style={{ cursor: 'pointer' }} title="Switch demo user (maker / checker)">{currentUser.name} ⇄</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{currentUser.role}</div>
            <div style={{ marginTop: '2px' }}>
              <span className="vf-badge" onClick={() => navigate('/users')} style={{ cursor: 'pointer', fontSize: '9.5px', padding: '1px 6px', display: 'inline-block' }} title="Users & Roles — sign in as another user">
                {currentUser.scope && (currentUser.scope.territoryIds.length || currentUser.scope.warehouseIds.length) ? 'Scoped · switch user ▾' : 'Switch user ▾'}
              </span>{' '}
              <span className="vf-badge" onClick={signOut} style={{ cursor: 'pointer', fontSize: '9.5px', padding: '1px 6px', display: 'inline-block' }} title="Sign out">Sign out</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
