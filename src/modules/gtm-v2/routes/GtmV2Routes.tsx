import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GtmV2Provider } from '../context/GtmV2Context';
import { GtmV2Layout } from '../layouts/GtmV2Layout';

// Module Pages
import { GtmV2Dashboard } from '../pages/dashboard/GtmV2Dashboard';
import { TerritoryManagementPage } from '../pages/territories/TerritoryManagementPage';
import { ZoneManagementPage } from '../pages/zones/ZoneManagementPage';
import { SalesChannelsPage } from '../pages/sales-channels/SalesChannelsPage';
import { SalesFlowTopologyPage } from '../pages/sales-flow-topology/SalesFlowTopologyPage';
import { PartnerOnboardingPage } from '../pages/partner-onboarding/PartnerOnboardingPage';
import { PartnerNetworkPage } from '../pages/partner-network/PartnerNetworkPage';
import { CommercialTermsPage } from '../pages/commercial-terms/CommercialTermsPage';
import { ApprovalsPage } from '../pages/approvals/ApprovalsPage';
import { GtmReportsPage } from '../pages/reports/GtmReportsPage';
import { GtmConfigurationPage } from '../pages/configuration/GtmConfigurationPage';

export const GtmV2Routes: React.FC = () => {
  return (
    <GtmV2Provider>
      <GtmV2Layout>
        <Routes>
          <Route index element={<GtmV2Dashboard />} />
          <Route path="territories" element={<TerritoryManagementPage />} />
          <Route path="zones" element={<ZoneManagementPage />} />
          <Route path="channels" element={<SalesChannelsPage />} />
          <Route path="topology" element={<SalesFlowTopologyPage />} />
          <Route path="onboarding" element={<PartnerOnboardingPage />} />
          <Route path="network" element={<PartnerNetworkPage />} />
          <Route path="commercial-terms" element={<CommercialTermsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="reports" element={<GtmReportsPage />} />
          <Route path="configuration" element={<GtmConfigurationPage />} />
          <Route path="*" element={<Navigate to="/gtm-v2" replace />} />
        </Routes>
      </GtmV2Layout>
    </GtmV2Provider>
  );
};
export default GtmV2Routes;
