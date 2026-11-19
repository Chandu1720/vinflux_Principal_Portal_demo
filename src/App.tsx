import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useImportContext } from './platform/import/useImportContext';
import { runDueSyncs } from './platform/integrations/stockSync';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { PlatformProvider, usePlatform } from './platform/PlatformContext';
import { ModuleOffPage } from './platform/pages/ModuleOffPage';
import LoginPage from './platform/pages/LoginPage';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Topbar } from './components/layout/Topbar.tsx';
import { ToastContainer } from './components/common/Toast.tsx';

import { ProductMasterPage } from './pages/ProductMasterPage.tsx';
import { BranchMasterPage } from './pages/BranchMasterPage.tsx';
import { WarehouseMasterPage } from './pages/WarehouseMasterPage.tsx';

// Platform pages (plug-and-play modules, data import, integrations) and Inventory are lazy-loaded.
const ModulesPage = lazy(() => import('./platform/pages/ModulesPage'));
const DataImportPage = lazy(() => import('./platform/pages/DataImportPage'));
const IntegrationHubPage = lazy(() => import('./platform/pages/IntegrationHubPage'));
const StockOnHandPage = lazy(() => import('./modules/inventory/StockOnHandPage'));
const OrdersPage = lazy(() => import('./modules/orders/OrdersPage'));
const LogisticsPage = lazy(() => import('./modules/logistics/LogisticsPage'));
const ReturnsPage = lazy(() => import('./modules/returns/ReturnsPage'));
const RecallPage = lazy(() => import('./modules/recall/RecallPage'));
const SurgicalPage = lazy(() => import('./modules/surgical/SurgicalPage'));
const PricingPage = lazy(() => import('./modules/pricing/PricingPage'));
const UsersRolesPage = lazy(() => import('./modules/users/UsersRolesPage'));

// Go-to-Market module (GTM V2) — the single GTM and partner register
import { GtmV2Routes } from './modules/gtm-v2/routes/GtmV2Routes';

const AppContent: React.FC = () => {
  const location = useLocation();
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const isGtmV2 = location.pathname.startsWith('/gtm-v2');
  const { pathAllowed } = usePlatform();
  const guard = (el: React.ReactNode) => (pathAllowed(location.pathname) ? <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>{el}</Suspense> : <ModuleOffPage />);

  if (isGtmV2 && !pathAllowed(location.pathname)) return <Navigate to="/modules" replace />;
  if (isGtmV2) {
    return (
      <Routes>
        <Route path="/gtm-v2/*" element={<GtmV2Routes />} />
      </Routes>
    );
  }

  return (
    <div className="vf-app-container">
      <Sidebar />
      <div className="vf-main-wrapper">
        <Topbar 
          searchValue={globalSearchTerm}
          onSearch={setGlobalSearchTerm}
        />
        <main className="vf-content-area">
          <Routes>
            {/* 1. Product Master (preserved) */}
            <Route path="/" element={<ProductMasterPage searchTerm={globalSearchTerm} />} />
            <Route path="/products" element={<ProductMasterPage searchTerm={globalSearchTerm} />} />

            {/* 2. Go-to-Market lives at /gtm-v2. Old GTM and Partner Management URLs redirect there. */}
            <Route path="/gtm" element={<Navigate to="/gtm-v2/dashboard" replace />} />
            <Route path="/partners" element={<Navigate to="/gtm-v2/partners" replace />} />

            {/* 3. Branch Master */}
            <Route path="/branches" element={<BranchMasterPage />} />

            {/* 4. Warehouse Master */}
            <Route path="/warehouses" element={<WarehouseMasterPage />} />

            {/* Inventory module */}
            <Route path="/inventory" element={guard(<StockOnHandPage />)} />

            {/* Platform */}
            <Route path="/modules" element={guard(<ModulesPage />)} />
            <Route path="/users" element={guard(<UsersRolesPage />)} />
            <Route path="/pricing" element={guard(<PricingPage />)} />
            <Route path="/surgical" element={guard(<SurgicalPage />)} />
            <Route path="/orders" element={guard(<OrdersPage />)} />
            <Route path="/logistics" element={guard(<LogisticsPage />)} />
            <Route path="/returns" element={guard(<ReturnsPage />)} />
            <Route path="/recall" element={guard(<RecallPage />)} />
            <Route path="/data-import" element={guard(<DataImportPage />)} />
            <Route path="/integrations" element={guard(<IntegrationHubPage />)} />

            {/* Catch-all redirect to Product Master */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

/** Runs ERP connectors whose schedule is due (checked every minute while the app is open; a server job in production). */
const SyncScheduler: React.FC = () => {
  const ctx = useImportContext();
  const { showToast } = useApp();
  const ref = useRef(ctx);
  ref.current = ctx;
  useEffect(() => {
    const t = window.setInterval(() => {
      const tell = (r: { status: string; message: string }) => { if (r.status !== 'No changes') showToast(`Scheduled ERP sync: ${r.message}`, r.status === 'Failed' ? 'danger' : 'info'); };
      runDueSyncs(ref.current, tell).forEach(tell);
    }, 60000);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/** Modules are switched on/off per active principal. */
const PlatformShell: React.FC = () => {
  const { activePrincipal } = useApp();
  return <PlatformProvider principalId={activePrincipal.id}><SyncScheduler /><AppContent /></PlatformProvider>;
};

/** Nothing but the sign-in page until someone signs in; the account decides the industry workspace. */
const SignInGate: React.FC = () => {
  const { signedIn } = useApp();
  if (!signedIn) return <LoginPage />;
  return (
    <BrowserRouter>
      <PlatformShell />
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <SignInGate />
    </AppProvider>
  );
};

export default App;
