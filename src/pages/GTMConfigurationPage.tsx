import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { GTMOverviewDashboard } from '../components/gtm/GTMOverviewDashboard.tsx';
import { TerritoriesTab } from '../components/gtm/TerritoriesTab.tsx';
import { PartnerClassificationTab } from '../components/gtm/PartnerClassificationTab.tsx';
import { SalesChannelsTab } from '../components/gtm/SalesChannelsTab.tsx';
import { CommercialTermsTab } from '../components/gtm/CommercialTermsTab.tsx';
import { RoutesOverview } from '../components/routes/RoutesOverview.tsx';
import { 
  Compass,
  MapPin, 
  Layers, 
  DollarSign, 
  Users, 
  ShieldCheck,
  Award
} from 'lucide-react';

export const GTMConfigurationPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    distributionRoutes, 
    territories, 
    salesChannels, 
    partners,
    partnerTiers 
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'territories' | 'classification' | 'channels' | 'terms' | 'routes'
  >('overview');

  // Pending approvals count for notification badge
  const pendingApprovalsCount = partners.flatMap((p) => p.channelAssignments || [])
    .filter((ca) => ca.commercialTermStatus === 'Deviated — Pending Approval').length;

  return (
    <div className="vf-content-area" style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
              Go-to-Market (GTM) & Commercial Operations Workspace
            </h1>
            <span className="vf-badge vf-badge-approved">Principal Enterprise Suite</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--vf-slate-500)' }}>
            Integrated workspace governing geographical territories, decoupled partner classifications, multi-channel distribution routes, and statutory commercial terms.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="vf-btn vf-btn-secondary"
            onClick={() => navigate('/partners')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
          >
            <Users size={14} className="text-blue-600" />
            <span>Partner Management Directory &rarr;</span>
          </button>
          <span className="vf-badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '12px', padding: '5px 10px' }}>
            Multi-Tier Connected Architecture
          </span>
        </div>
      </div>

      {/* Main GTM Tabs Bar */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--vf-slate-200)', marginBottom: '20px', overflowX: 'auto' }}>
        {/* Tab 1: Overview Dashboard */}
        <button
          type="button"
          className={`vf-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'overview' ? 700 : 500 }}
        >
          <Compass size={14} className={activeTab === 'overview' ? 'text-blue-600' : ''} />
          <span>GTM Overview</span>
        </button>

        {/* Tab 2: Territory Management */}
        <button
          type="button"
          className={`vf-tab-btn ${activeTab === 'territories' ? 'active' : ''}`}
          onClick={() => setActiveTab('territories')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'territories' ? 700 : 500 }}
        >
          <MapPin size={14} className={activeTab === 'territories' ? 'text-blue-600' : ''} />
          <span>Territory Management</span>
          <span className="vf-badge" style={{ fontSize: '10px', padding: '1px 6px', background: activeTab === 'territories' ? '#1d4ed8' : '#e2e8f0', color: activeTab === 'territories' ? '#fff' : 'var(--vf-slate-700)' }}>
            {territories.length}
          </span>
        </button>

        {/* Tab 3: Partner Classification & Tiers */}
        <button
          type="button"
          className={`vf-tab-btn ${activeTab === 'classification' ? 'active' : ''}`}
          onClick={() => setActiveTab('classification')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'classification' ? 700 : 500 }}
        >
          <Award size={14} className={activeTab === 'classification' ? 'text-blue-600' : ''} />
          <span>Partner Classification & Tiers</span>
          <span className="vf-badge" style={{ fontSize: '10px', padding: '1px 6px', background: activeTab === 'classification' ? '#1d4ed8' : '#e2e8f0', color: activeTab === 'classification' ? '#fff' : 'var(--vf-slate-700)' }}>
            {partnerTiers.length} Tiers
          </span>
        </button>

        {/* Tab 4: Sales Channels */}
        <button
          type="button"
          className={`vf-tab-btn ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveTab('channels')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'channels' ? 700 : 500 }}
        >
          <DollarSign size={14} className={activeTab === 'channels' ? 'text-blue-600' : ''} />
          <span>Sales Channels</span>
          <span className="vf-badge" style={{ fontSize: '10px', padding: '1px 6px', background: activeTab === 'channels' ? '#1d4ed8' : '#e2e8f0', color: activeTab === 'channels' ? '#fff' : 'var(--vf-slate-700)' }}>
            {salesChannels.length}
          </span>
        </button>

        {/* Tab 5: Commercial Terms & Approvals */}
        <button
          type="button"
          className={`vf-tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => setActiveTab('terms')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'terms' ? 700 : 500 }}
        >
          <ShieldCheck size={14} className={activeTab === 'terms' ? 'text-blue-600' : ''} />
          <span>Commercial Terms & Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: '#dc2626', color: '#ffffff' }}>
              {pendingApprovalsCount} Pending
            </span>
          )}
        </button>

        {/* Tab 6: Sales Routes & Route Builder */}
        <button
          type="button"
          className={`vf-tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'routes' ? 700 : 500 }}
        >
          <Layers size={14} className={activeTab === 'routes' ? 'text-blue-600' : ''} />
          <span>Sales Routes & Builder</span>
          <span className="vf-badge" style={{ fontSize: '10px', padding: '1px 6px', background: activeTab === 'routes' ? '#1d4ed8' : '#e2e8f0', color: activeTab === 'routes' ? '#fff' : 'var(--vf-slate-700)' }}>
            {distributionRoutes.length}
          </span>
        </button>
      </div>

      {/* Tab Panes */}
      <div>
        {activeTab === 'overview' && (
          <GTMOverviewDashboard onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'territories' && (
          <TerritoriesTab />
        )}

        {activeTab === 'classification' && (
          <PartnerClassificationTab />
        )}

        {activeTab === 'channels' && (
          <SalesChannelsTab />
        )}

        {activeTab === 'terms' && (
          <CommercialTermsTab />
        )}

        {activeTab === 'routes' && (
          <RoutesOverview />
        )}
      </div>
    </div>
  );
};
