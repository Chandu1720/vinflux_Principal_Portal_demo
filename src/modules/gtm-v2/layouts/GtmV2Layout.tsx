import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Menu, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import '../styles/gtm-v2.css';
import { NAV_SECTIONS, PAGE_TITLES, ROUTES } from '../constants/navigation';
import { useApprovals, useChannels, useFlows, usePartners, useTerritories } from '../hooks/useGtmData';
import { useGtmAuth } from '../hooks/useGtmAuth';
import { ToastContainer } from '../../../components/common/Toast.tsx';
import { IconButton } from '../components/ui';
import { ConfirmDialog } from '../components/ui/Modal';
import { resetDb } from '../services';
import { initials } from '../utils/format';
import { useDismiss } from '../components/ui/Dropdown';

const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const partners = usePartners().data ?? [];
  const territories = useTerritories().data ?? [];
  const flows = useFlows().data ?? [];
  const channels = useChannels().data ?? [];

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const hit = (...xs: string[]) => xs.some((x) => x.toLowerCase().includes(s));
    return [
      ...partners.filter((p) => hit(p.name, p.code)).slice(0, 5).map((p) => ({ k: p.id, t: p.name, s: `Partner · ${p.code} · ${p.status}`, to: `${ROUTES.partners}?focus=${p.id}` })),
      ...territories.filter((t) => hit(t.name, t.code)).slice(0, 4).map((t) => ({ k: t.id, t: t.name, s: `Territory · ${t.code}`, to: `${ROUTES.territories}?focus=${t.id}` })),
      ...flows.filter((f) => hit(f.name, f.code)).slice(0, 4).map((f) => ({ k: f.id, t: f.name, s: `Sales policy · ${f.code}`, to: ROUTES.flowEdit(f.id) })),
      ...channels.filter((c) => hit(c.name, c.code)).slice(0, 3).map((c) => ({ k: c.id, t: c.name, s: `Sales channel · ${c.code}`, to: ROUTES.channels })),
    ];
  }, [q, partners, territories, flows, channels]);

  return (
    <div className="g2-topbar-search" ref={ref}>
      <Search size={15} />
      <input value={q} placeholder="Search partners, territories, policies…" onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} aria-label="Global search" />
      {open && q.trim().length >= 2 && (
        <div className="g2-search-results">
          {results.length === 0 && <div style={{ padding: 12 }} className="g2-muted g2-small">No results for “{q}”</div>}
          {results.map((r) => (
            <button key={r.k} type="button" onClick={() => { navigate(r.to); setOpen(false); setQ(''); }}>
              <span className="g2-strong">{r.t}</span><span className="g2-cell-sub">{r.s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const GtmV2Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, principal, can } = useGtmAuth();
  const approvals = useApprovals().data ?? [];
  const pending = approvals.filter((a) => a.status === 'Pending').length;
  const [navOpen, setNavOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => { setNavOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const title = PAGE_TITLES.find((p) => location.pathname.startsWith(p.prefix))?.title ?? 'Go-to-Market';

  return (
    <div className={`g2 ${navOpen ? 'nav-open' : ''}`}>
      <aside className="g2-sidebar" aria-label="Go-to-Market navigation">
        <div className="g2-brand" onClick={() => navigate(ROUTES.dashboard)}>
          <div className="g2-brand-logo">V</div>
          <div>
            <div className="g2-brand-name">VinFlux</div>
            <div className="g2-brand-sub">Go-to-Market</div>
          </div>
        </div>
        <nav className="g2-nav">
          {NAV_SECTIONS.map((sec) => (
            <React.Fragment key={sec.heading}>
              <div className="g2-nav-heading">{sec.heading}</div>
              {sec.items.map((item) => (
                <NavLink key={item.path} to={item.path} className={({ isActive }) => `g2-nav-item ${isActive ? 'active' : ''}`}>
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {item.badgeKey === 'approvals' && pending > 0 && <span className="g2-nav-count">{pending}</span>}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="g2-sidebar-foot">
          <Link to="/" className="g2-nav-item"><ArrowLeft size={16} /> Back to VinFlux ERP</Link>
          <div className="g2-back-link" style={{ padding: '6px 10px 0' }}>Principal: <span style={{ color: '#fff' }}>{principal.name}</span></div>
        </div>
      </aside>
      <div className="g2-scrim" onClick={() => setNavOpen(false)} />

      <div className="g2-main">
        <header className="g2-topbar">
          <IconButton label="Open menu" className="g2-menu-btn" onClick={() => setNavOpen(true)}><Menu size={20} /></IconButton>
          <div className="g2-topbar-title">
            <div className="g2-crumbs"><Link to="/">VinFlux</Link><span>/</span><Link to={ROUTES.dashboard}>Go-to-Market</Link></div>
            <div className="g2-page-title">{title}</div>
          </div>
          <div className="g2-topbar-right">
            <GlobalSearch />
            <IconButton label={`${pending} pending approvals`} bordered badge={pending} onClick={() => navigate(ROUTES.approvals)}><Bell size={17} /></IconButton>
            <IconButton label="Reset demo data" bordered onClick={() => setResetOpen(true)}><RotateCcw size={16} /></IconButton>
            <div className="g2-user">
              <div className="g2-avatar">{initials(user.name)}</div>
              <div className="g2-user-meta">
                <div className="g2-user-name">{user.name}</div>
                <div className="g2-user-role" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {can.manageConfig && <ShieldCheck size={12} color="#6d28d9" />}{user.role}
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="g2-content">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog
        open={resetOpen}
        title="Reset Go-to-Market demo data?"
        message="This restores the Go-to-Market mock database to its seed state. Product Master and other VinFlux modules are not affected."
        confirmLabel="Reset data"
        tone="danger"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { resetDb(); setResetOpen(false); }}
      />
    </div>
  );
};
