import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useImportContext } from './platform/import/useImportContext';
import { runDueSyncs } from './platform/integrations/stockSync';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { PlatformProvider, usePlatform } from './platform/PlatformContext';
import { ModuleOffPage } from './platform/pages/ModuleOffPage';
import { setImportsGate } from './modules/procurement/procurementStore';
import { setGrnPoster, setInvoiceNumberer, setOrderCheck } from './modules/orders/orderStore';
import { stockNormCheck } from './modules/replenishment/replenishmentStore';
import { consentAllows, setupOf } from './modules/secondary/secondaryStore';
import { agreementCheck } from './modules/tenders/tendersStore';
import { contractCheck } from './modules/pricing/contractUsage';
import { numberForShipment } from './modules/invoicing/invoiceStore';
import { optChoice } from './platform/moduleOptions';
import LoginPage from './platform/pages/LoginPage';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Topbar } from './components/layout/Topbar.tsx';
import { ToastContainer } from './components/common/Toast.tsx';

import { ProductMasterPage } from './pages/ProductMasterPage.tsx';
import { BranchMasterPage } from './pages/BranchMasterPage.tsx';
import { WarehouseMasterPage } from './pages/WarehouseMasterPage.tsx';

// Platform pages (plug-and-play modules, data import, integrations) and Inventory are lazy-loaded.
const ModulesPage = lazy(() => import('./platform/pages/ModulesPage'));
const SetupPage = lazy(() => import('./platform/pages/SetupPage'));
const ActionLinkPage = lazy(() => import('./platform/pages/ActionLinkPage'));
const ControlTower = lazy(() => import('./platform/pages/ControlTower'));
const CrmPage = lazy(() => import('./modules/crm/CrmPage'));
const SecondaryPage = lazy(() => import('./modules/secondary/SecondaryPage'));
const ClaimsPage = lazy(() => import('./modules/claims/ClaimsPage'));
const CollectionsPage = lazy(() => import('./modules/collections/CollectionsPage'));
const ProcurementPage = lazy(() => import('./modules/procurement/ProcurementPage'));
const ImportsPage = lazy(() => import('./modules/imports/ImportsPage'));
const QcPage = lazy(() => import('./modules/qc/QcPage'));
const PendingPage = lazy(() => import('./platform/pages/PendingPage'));
const ConsentPage = lazy(() => import('./modules/secondary/ConsentPage'));
const NetworkPage = lazy(() => import('./modules/network/NetworkPage'));
const AssemblyPage = lazy(() => import('./modules/assembly/AssemblyPage'));
const ApprovalsInbox = lazy(() => import('./platform/pages/ApprovalsInbox'));
const AuditLogPage = lazy(() => import('./platform/pages/AuditLogPage'));
const DataSourcesPage = lazy(() => import('./platform/pages/DataSourcesPage'));
const ReportsPage = lazy(() => import('./platform/pages/ReportsPage'));
const ProductionPage = lazy(() => import('./modules/production/ProductionPage'));
const ReplenishmentPage = lazy(() => import('./modules/replenishment/ReplenishmentPage'));
const PerformancePage = lazy(() => import('./modules/performance/PerformancePage'));
const TendersPage = lazy(() => import('./modules/tenders/TendersPage'));
const InvoicingPage = lazy(() => import('./modules/invoicing/InvoicingPage'));
const PartnerLitePage = lazy(() => import('./modules/partnerLite/PartnerLitePage'));
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
  const { pathAllowed, enabled } = usePlatform();
  // Overseas POs are received only through a cleared import shipment while Imports is on (IMS-01).
  setImportsGate(() => enabled('imports'));
  // Expired channel agreements warn / block orders (TND-04); VinFlux-issued invoices are numbered per GSTIN and year (OP4).
  setOrderCheck('agreement', enabled('tenders') ? agreementCheck : null);
  setOrderCheck('contract', enabled('price-lists') ? contractCheck : null);
  // DMS: orders that push a partner above its stock norm wait for approval; deliveries to distributors on the VinFlux platform post their GRN automatically.
  setOrderCheck('stock-norm', enabled('secondary') ? stockNormCheck : null);
  setGrnPoster(enabled('secondary') ? (o, sh) => (setupOf(o.partnerId).onPlatform && consentAllows(o.partnerId, 'orders') ? `GRN-${o.partnerId.slice(-4).toUpperCase()}-${sh.no.replace(/\D/g, '').slice(-6)}` : null) : null);
  setInvoiceNumberer(enabled('invoicing') ? (o, ctx) => (optChoice('orders', 'invoicing') === 'vinflux' ? numberForShipment(o, ctx.warehouses ?? [], ctx.partners) : null) : null);
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
            <Route path="/dashboard" element={guard(<ControlTower />)} />
            <Route path="/setup" element={guard(<SetupPage />)} />
            <Route path="/modules" element={guard(<ModulesPage />)} />
            <Route path="/users" element={guard(<UsersRolesPage />)} />
            <Route path="/pricing" element={guard(<PricingPage />)} />
            <Route path="/crm" element={guard(<CrmPage />)} />
            <Route path="/secondary" element={guard(<SecondaryPage />)} />
            <Route path="/claims" element={guard(<ClaimsPage />)} />
            <Route path="/collections" element={guard(<CollectionsPage />)} />
            <Route path="/procurement" element={guard(<ProcurementPage />)} />
            <Route path="/imports" element={guard(<ImportsPage />)} />
            <Route path="/qc" element={guard(<QcPage />)} />
            <Route path="/production" element={guard(<ProductionPage />)} />
            <Route path="/assembly" element={guard(<AssemblyPage />)} />
            <Route path="/consent" element={guard(<ConsentPage />)} />
            <Route path="/network" element={guard(<NetworkPage />)} />
            <Route path="/approvals" element={<ApprovalsInbox />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/data-sources" element={<DataSourcesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/pending" element={<PendingPage />} />
            <Route path="/replenishment" element={guard(<ReplenishmentPage />)} />
            <Route path="/performance" element={guard(<PerformancePage />)} />
            <Route path="/tenders" element={guard(<TendersPage />)} />
            <Route path="/invoices" element={guard(<InvoicingPage />)} />
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
  // Action links (NOT-04) work without signing in.
  // Partner Lite portal: partners sign in with their own email + OTP, not the principal's login.
  if (window.location.pathname === '/p' || window.location.pathname.startsWith('/p/')) return <BrowserRouter><Suspense fallback={null}><PartnerLitePage /></Suspense></BrowserRouter>;
  if (window.location.pathname.startsWith('/a/')) return <BrowserRouter><Suspense fallback={null}><Routes><Route path="/a/:token" element={<ActionLinkPage />} /></Routes></Suspense></BrowserRouter>;
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
