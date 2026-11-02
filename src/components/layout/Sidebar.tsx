import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.tsx';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activePrincipal, principals, setActivePrincipal, currentUser, setCurrentUser, showToast } = useApp();

  const isProducts = location.pathname === '/' || location.pathname.startsWith('/products');
  const isGtm = location.pathname.startsWith('/gtm');
  const isPartners = location.pathname.startsWith('/partners');
  const isBranches = location.pathname.startsWith('/branches');
  const isWarehouses = location.pathname.startsWith('/warehouses');

  const handleSwitchPrincipal = () => {
    const currentIndex = principals.findIndex((p) => p.id === activePrincipal.id);
    const nextIndex = (currentIndex + 1) % principals.length;
    const nextPrincipal = principals[nextIndex];
    setActivePrincipal(nextPrincipal);
    showToast(`Switched active principal to "${nextPrincipal.name}".`, 'info');
  };

  const handleToggleAdmin = () => {
    setCurrentUser((prev) => {
      const nextCanManage = !prev.permissions.canManageConfig;
      showToast(
        nextCanManage ? 'Admin configuration mode enabled.' : 'Standard operational user mode enabled.',
        'info'
      );
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          canManageConfig: nextCanManage
        }
      };
    });
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
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>ERP Core</span>
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
        <div className="vf-nav-section">
          <div className="vf-nav-heading">Go-to-market</div>
          <button
            type="button"
            className={`vf-nav-item ${isGtm ? 'active' : ''}`}
            onClick={() => navigate('/gtm')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>GTM Configuration</span>
          </button>

          <button
            type="button"
            className={`vf-nav-item ${isPartners ? 'active' : ''}`}
            onClick={() => navigate('/partners')}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="vf-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Partner Management</span>
          </button>
        </div>

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
        </div>
      </nav>

      {/* Sidebar User Footer */}
      <div className="vf-sidebar-footer" style={{ marginTop: 'auto' }}>
        <div className="vf-user-profile">
          <div className="vf-avatar">AR</div>
          <div className="vf-user-info">
            <div className="vf-user-name">{currentUser.name}</div>
            <div style={{ marginTop: '2px' }}>
              <span
                className={`vf-badge ${currentUser.permissions.canManageConfig ? 'vf-badge-approved' : ''}`}
                onClick={handleToggleAdmin}
                style={{ cursor: 'pointer', fontSize: '9.5px', padding: '1px 6px', display: 'inline-block' }}
                title="Click to toggle Admin permissions"
              >
                {currentUser.permissions.canManageConfig ? 'Admin: Config Enabled ▾' : 'Standard User ▾'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
