import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GtmV2Layout } from '../layouts/GtmV2Layout';
import { LoadingState } from '../components/ui';
import { currentWorkspace } from '../../../platform/workspace';

/* Each module is code-split so GTM V2 does not bloat the legacy bundle. */
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const TerritoriesPage = lazy(() => import('../pages/territories/TerritoriesPage'));
const ZonesPage = lazy(() => import('../pages/zones/ZonesPage'));
const SalesChannelsPage = lazy(() => import('../pages/sales-channels/SalesChannelsPage'));
const FlowListPage = lazy(() => import('../pages/sales-flow-topology/FlowListPage'));
const FlowBuilderPage = lazy(() => import('../pages/sales-flow-topology/FlowBuilderPage'));
const PartnersPage = lazy(() => import('../pages/partner-onboarding/PartnersPage'));
const OnboardingWizardPage = lazy(() => import('../pages/partner-onboarding/OnboardingWizardPage'));
const PartnerNetworkPage = lazy(() => import('../pages/partner-network/PartnerNetworkPage'));
const HospitalCoveragePage = lazy(() => import('../pages/hospital-coverage/HospitalCoveragePage'));
const CommercialTermsPage = lazy(() => import('../pages/commercial-terms/CommercialTermsPage'));
const ApprovalsPage = lazy(() => import('../pages/approvals/ApprovalsPage'));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'));
const ConfigurationPage = lazy(() => import('../pages/configuration/ConfigurationPage'));

const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => <Suspense fallback={<LoadingState />}>{children}</Suspense>;

/** Mounted by App.tsx at /gtm-v2/* — independent of the legacy /gtm routes. */
export const GtmV2Routes: React.FC = () => (
  <Routes>
    <Route element={<GtmV2Layout />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Page><DashboardPage /></Page>} />
      <Route path="territories" element={<Page><TerritoriesPage /></Page>} />
      <Route path="zones" element={<Page><ZonesPage /></Page>} />
      <Route path="sales-channels" element={<Page><SalesChannelsPage /></Page>} />
      <Route path="sales-policies" element={<Page><FlowListPage /></Page>} />
      <Route path="sales-policies/new" element={<Page><FlowBuilderPage /></Page>} />
      <Route path="sales-policies/:flowId" element={<Page><FlowBuilderPage /></Page>} />
      {/* old links (module renamed from "Sales Flow Topology") */}
      <Route path="sales-flow-topology/*" element={<Navigate to="/gtm-v2/sales-policies" replace />} />
      <Route path="partners" element={<Page><PartnersPage /></Page>} />
      <Route path="partners/onboard" element={<Page><OnboardingWizardPage /></Page>} />
      <Route path="partners/onboard/:partnerId" element={<Page><OnboardingWizardPage /></Page>} />
      <Route path="partner-network" element={<Page><PartnerNetworkPage /></Page>} />
      <Route path="hospital-coverage" element={currentWorkspace() === 'medical-devices' ? <Page><HospitalCoveragePage /></Page> : <Navigate to="/gtm-v2/partner-network" replace />} />
      <Route path="commercial-terms" element={<Page><CommercialTermsPage /></Page>} />
      <Route path="approvals" element={<Page><ApprovalsPage /></Page>} />
      <Route path="reports" element={<Page><ReportsPage /></Page>} />
      <Route path="configuration" element={<Page><ConfigurationPage /></Page>} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Route>
  </Routes>
);

export default GtmV2Routes;
