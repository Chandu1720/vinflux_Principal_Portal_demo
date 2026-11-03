import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Topbar } from './components/layout/Topbar.tsx';
import { ToastContainer } from './components/common/Toast.tsx';

import { ProductMasterPage } from './pages/ProductMasterPage.tsx';
import { GTMConfigurationPage } from './pages/GTMConfigurationPage.tsx';
import { PartnerManagementPage } from './pages/PartnerManagementPage.tsx';
import { BranchMasterPage } from './pages/BranchMasterPage.tsx';
import { WarehouseMasterPage } from './pages/WarehouseMasterPage.tsx';

// GTM V2 Enterprise Module
import { GtmV2Routes } from './modules/gtm-v2/routes/GtmV2Routes';

const AppContent: React.FC = () => {
  const location = useLocation();
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const isGtmV2 = location.pathname.startsWith('/gtm-v2');

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

            {/* 2. GTM Configuration (Legacy Preserved) */}
            <Route path="/gtm" element={<GTMConfigurationPage />} />

            {/* 3. Branch Master */}
            <Route path="/branches" element={<BranchMasterPage />} />

            {/* 4. Warehouse Master */}
            <Route path="/warehouses" element={<WarehouseMasterPage />} />

            {/* 5. Partner Management */}
            <Route path="/partners" element={<PartnerManagementPage />} />

            {/* Catch-all redirect to Product Master */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
