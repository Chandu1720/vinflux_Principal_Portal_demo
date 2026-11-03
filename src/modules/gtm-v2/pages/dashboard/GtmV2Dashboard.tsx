import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Globe2,
  Share2,
  Workflow,
  Users,
  ArrowRight,
  Package,
  ChevronRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { useGtmV2 } from '../../context/GtmV2Context';
import { KpiCard } from '../../components/common/KpiCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { initialPortfolios, initialProducts } from '../../../../data/productMasterData';

export const GtmV2Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { kpis, salesFlows, partners } = useGtmV2();

  // Active Topology preview selector
  const [selectedFlowId, setSelectedFlowId] = useState<string>(
    salesFlows[0]?.id || 'flow-hub-spoke'
  );

  const activeFlow = salesFlows.find((f) => f.id === selectedFlowId) || salesFlows[0];

  // 1. Partner Onboarding Status Data for Donut Chart
  const onboardingStatusCounts = partners.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const donutColors: Record<string, string> = {
    Active: '#10B981', // Emerald
    'Approval Pending': '#F59E0B', // Amber
    'KYC Under Review': '#3B82F6', // Blue
    Draft: '#94A3B8', // Slate
    Rejected: '#EF4444' // Rose
  };

  const donutData = Object.entries(onboardingStatusCounts).map(([name, value]) => ({
    name,
    value,
    color: donutColors[name] || '#8B5CF6'
  }));

  // 2. Sales Flow by Territory Bar Chart Data
  const territoryFlowData = [
    { territory: 'Andhra Pradesh', flows: 3 },
    { territory: 'Telangana', flows: 2 },
    { territory: 'Karnataka', flows: 2 },
    { territory: 'Tamil Nadu', flows: 1 },
    { territory: 'Maharashtra', flows: 2 }
  ];

  // 3. Product Coverage statistics from existing Product Master
  const totalPortfolios = initialPortfolios.length;
  const totalCategories = initialPortfolios.reduce((sum, p) => sum + p.categories.length, 0);
  const totalSubcategories = initialPortfolios.reduce(
    (sum, p) => sum + p.categories.reduce((cSum, c) => cSum + c.subCategories.length, 0),
    0
  );
  const totalProducts = initialProducts.length;

  // Recent 5 partner onboardings
  const recentPartners = partners.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* -------------------------------------------------------------------- */}
      {/* HEADER BANNER */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)'
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#E0E7FF',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backdropFilter: 'blur(4px)'
              }}
            >
              <Sparkles size={12} />
              Enterprise GTM V2
            </span>
            <span style={{ fontSize: '12px', color: '#C7D2FE' }}>
              Principal: Biorad Medisys Pvt Ltd
            </span>
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Go-To-Market Distribution & Partner Network Control
          </h2>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#E0E7FF', lineHeight: 1.5 }}>
            Orchestrate multi-echelon medical device routes, geographic coverage, statutory commercial policies, and partner entity assignments from a unified command center.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/gtm-v2/onboarding')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#FFFFFF',
              color: '#312E81',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
          >
            <span>+ Onboard Partner</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/gtm-v2/topology')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Workflow size={15} />
            <span>Configure Topology</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 5 KPI CARDS */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px'
        }}
      >
        <KpiCard
          title="Total Territories"
          value={kpis.totalTerritories}
          percentageChange="+12.5%"
          trend="up"
          subtitle="Unlimited N-levels"
          icon={<MapPin size={22} />}
          iconBg="#F3E8FF"
          iconColor="#7C3AED"
        />
        <KpiCard
          title="Total Zones"
          value={kpis.totalZones}
          percentageChange="+5.0%"
          trend="up"
          subtitle="Multi-territory mapped"
          icon={<Globe2 size={22} />}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
        />
        <KpiCard
          title="Sales Channels"
          value={kpis.totalChannels}
          percentageChange="+8.3%"
          trend="up"
          subtitle="Dynamic commercial tiers"
          icon={<Share2 size={22} />}
          iconBg="#ECFDF5"
          iconColor="#059669"
        />
        <KpiCard
          title="Sales Flows"
          value={kpis.totalFlows}
          percentageChange="+15.0%"
          trend="up"
          subtitle="Configured topologies"
          icon={<Workflow size={22} />}
          iconBg="#FFFBEB"
          iconColor="#D97706"
        />
        <KpiCard
          title="Active Partners"
          value={kpis.activePartners}
          percentageChange="+18.2%"
          trend="up"
          subtitle={`${kpis.pendingApprovalsCount} pending approvals`}
          icon={<Users size={22} />}
          iconBg="#FDF4FF"
          iconColor="#C026D3"
        />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* DISTRIBUTION TOPOLOGY PIPELINE PREVIEW */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Workflow size={18} className="text-purple-600" style={{ color: '#7C3AED' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Configurable Distribution Topology Pipeline
              </h3>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748B' }}>
              Physical and commercial title transfer flow across verified supply chain nodes.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Flow Selector */}
            <select
              value={selectedFlowId}
              onChange={(e) => setSelectedFlowId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#334155',
                backgroundColor: '#F8FAFC',
                cursor: 'pointer'
              }}
            >
              {salesFlows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name} ({flow.flowType})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => navigate('/gtm-v2/topology')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #DDD6FE',
                backgroundColor: '#F5F3FF',
                color: '#7C3AED',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>Edit Flow</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Visual Pipeline Stages */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            overflowX: 'auto',
            padding: '16px 8px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0'
          }}
        >
          {activeFlow.stages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              <div
                style={{
                  minWidth: '190px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: idx === 0 ? '1px solid #A7F3D0' : idx === activeFlow.stages.length - 1 ? '1px solid #DDD6FE' : '1px solid #E2E8F0',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.04)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: idx === 0 ? '#ECFDF5' : idx === activeFlow.stages.length - 1 ? '#F3E8FF' : '#F1F5F9',
                      color: idx === 0 ? '#047857' : idx === activeFlow.stages.length - 1 ? '#6B21A8' : '#475569',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    Stage {stage.stageNumber}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>{stage.stageRole}</span>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>
                  {stage.channelName}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                  Pricing: <strong>{stage.pricingBasis}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Title: {stage.inventoryOwnership}
                </div>
              </div>

              {idx < activeFlow.stages.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>
                  <ArrowRight size={20} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2 CHARTS: DONUT ONBOARDING + BAR FLOWS BY TERRITORY */}
      {/* -------------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Chart 1: Partner Onboarding Status Donut */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0F172A' }}>
                Partner Onboarding Status
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Distribution of onboarded partners by lifecycle state
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#7C3AED' }}>
              {partners.length} Total Partners
            </span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Donut Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '10px' }}>
            {donutData.map((item) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                <span>{item.name}:</span>
                <strong style={{ color: '#0F172A' }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Sales Flow by Territory Bar Chart */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0F172A' }}>
                Sales Flow Topology by Territory
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Active multi-echelon distribution routes authorized per region
              </p>
            </div>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={territoryFlowData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="territory" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <RechartsTooltip />
                <Bar dataKey="flows" fill="#7C3AED" radius={[6, 6, 0, 0]} name="Active Sales Flows" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2 CARDS: EXISTING PRODUCT MASTER COVERAGE + RECENT ONBOARDINGS */}
      {/* -------------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        
        {/* Product Master Hierarchy Coverage (Reusing existing Product Master!) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#7C3AED' }} />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0F172A' }}>
                  Product Master Scope
                </h3>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}
              >
                Integrated
              </span>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#64748B', lineHeight: 1.45 }}>
              Distribution routes map directly to VinFlux Product Master hierarchy:
              <br />
              <code>Portfolio → Category → Subcategory → Product</code>
            </p>

            {/* Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Portfolios</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>{totalPortfolios}</div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Implants & Disposables</div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Categories</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>{totalCategories}</div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Clinical Classifications</div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Subcategories</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>{totalSubcategories}</div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Product Families</div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Active SKUs</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#7C3AED' }}>{totalProducts}</div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Configured MedTech SKUs</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/products')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.12s'
            }}
          >
            <ExternalLink size={14} />
            <span>Open Product Master Catalog</span>
          </button>
        </div>

        {/* Recent Partner Onboardings Table */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0F172A' }}>
                  Recent Partner Onboardings
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                  Latest commercial partners processed through onboarding workflow
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/gtm-v2/onboarding')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: '#7C3AED',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>View All ({partners.length})</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11.5px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Partner Code</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Partner Name</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Channel Type</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Primary Territory</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPartners.map((partner) => (
                    <tr
                      key={partner.id}
                      style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      onClick={() => navigate('/gtm-v2/onboarding')}
                    >
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 600, color: '#64748B' }}>
                        {partner.code}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#1E293B' }}>
                        {partner.name}
                      </td>
                      <td style={{ padding: '10px', color: '#475569' }}>
                        {partner.partnerType}
                      </td>
                      <td style={{ padding: '10px', color: '#64748B' }}>
                        {partner.assignedTerritoryNames?.[0] || 'Unassigned'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <StatusBadge status={partner.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
