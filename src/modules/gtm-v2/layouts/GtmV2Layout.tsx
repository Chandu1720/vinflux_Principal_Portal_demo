import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  Globe2,
  Share2,
  Workflow,
  UserPlus,
  Network,
  CreditCard,
  ShieldCheck,
  BarChart3,
  Settings,
  Search,
  Bell,
  HelpCircle,
  Menu,
  ChevronLeft,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useGtmV2 } from '../context/GtmV2Context';

interface GtmV2LayoutProps {
  children: React.ReactNode;
}

export const GtmV2Layout: React.FC<GtmV2LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { kpis, sidebarCollapsed, setSidebarCollapsed, searchQuery, setSearchQuery } = useGtmV2();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      path: '/gtm-v2',
      exact: true,
      icon: <LayoutDashboard size={18} />
    },
    {
      id: 'territories',
      label: 'Territory Management',
      path: '/gtm-v2/territories',
      icon: <MapPin size={18} />
    },
    {
      id: 'zones',
      label: 'Zone Management',
      path: '/gtm-v2/zones',
      icon: <Globe2 size={18} />
    },
    {
      id: 'channels',
      label: 'Sales Channels',
      path: '/gtm-v2/channels',
      icon: <Share2 size={18} />
    },
    {
      id: 'topology',
      label: 'Sales Flow Topology',
      path: '/gtm-v2/topology',
      icon: <Workflow size={18} />
    },
    {
      id: 'onboarding',
      label: 'Partner Onboarding',
      path: '/gtm-v2/onboarding',
      icon: <UserPlus size={18} />,
      badge: kpis.kycUnderReviewCount > 0 ? `${kpis.kycUnderReviewCount} KYC` : undefined,
      badgeColor: '#3B82F6'
    },
    {
      id: 'network',
      label: 'Partner Network',
      path: '/gtm-v2/network',
      icon: <Network size={18} />
    },
    {
      id: 'commercial-terms',
      label: 'Commercial Terms',
      path: '/gtm-v2/commercial-terms',
      icon: <CreditCard size={18} />
    },
    {
      id: 'approvals',
      label: 'Approvals',
      path: '/gtm-v2/approvals',
      icon: <ShieldCheck size={18} />,
      badge: kpis.pendingApprovalsCount > 0 ? `${kpis.pendingApprovalsCount}` : undefined,
      badgeColor: '#EF4444'
    },
    {
      id: 'reports',
      label: 'GTM Reports',
      path: '/gtm-v2/reports',
      icon: <BarChart3 size={18} />
    },
    {
      id: 'configuration',
      label: 'Configuration',
      path: '/gtm-v2/configuration',
      icon: <Settings size={18} />
    }
  ];

  const isNavActive = (item: typeof navItems[0]) => {
    if (item.exact) {
      return location.pathname === item.path || location.pathname === `${item.path}/`;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', color: '#0F172A', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* -------------------------------------------------------------------- */}
      {/* 1. DARK NAVY SIDEBAR */}
      {/* -------------------------------------------------------------------- */}
      <aside
        style={{
          width: sidebarCollapsed ? '72px' : '260px',
          backgroundColor: '#0F172A', // Dark Navy
          color: '#E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          borderRight: '1px solid #1E293B',
          flexShrink: 0,
          overflow: 'hidden'
        }}
      >
        {/* Sidebar Brand Header */}
        <div
          style={{
            height: '64px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid #1E293B'
          }}
        >
          {!sidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/gtm-v2')}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '17px',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)'
                }}
              >
                V
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    VinFlux
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: '#7C3AED',
                      color: '#FFFFFF',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}
                  >
                    GTM V2
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Enterprise ERP</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '17px',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
              onClick={() => setSidebarCollapsed(false)}
            >
              V
            </div>
          )}

          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: sidebarCollapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const active = isNavActive(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: sidebarCollapsed ? '10px 0' : '10px 14px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: active ? '#7C3AED' : 'transparent',
                  color: active ? '#FFFFFF' : '#94A3B8',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s, color 0.15s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = '#1E293B';
                    e.currentTarget.style.color = '#F1F5F9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94A3B8';
                  }
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div style={{ color: active ? '#FFFFFF' : '#94A3B8', display: 'flex', flexShrink: 0 }}>
                  {item.icon}
                </div>
                {!sidebarCollapsed && (
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                )}
                {!sidebarCollapsed && item.badge && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      backgroundColor: item.badgeColor || '#7C3AED',
                      color: '#FFFFFF',
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      lineHeight: '16px'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: Return to Core ERP */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1E293B' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: sidebarCollapsed ? '8px 0' : '8px 12px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              borderRadius: '8px',
              border: '1px solid #334155',
              backgroundColor: '#1E293B',
              color: '#94A3B8',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1E293B';
              e.currentTarget.style.color = '#94A3B8';
            }}
            title="Return to Product Master & Core ERP Modules"
          >
            <ExternalLink size={15} />
            {!sidebarCollapsed && <span>Return to Core ERP</span>}
          </button>
        </div>
      </aside>

      {/* -------------------------------------------------------------------- */}
      {/* 2. MAIN CONTENT WRAPPER */}
      {/* -------------------------------------------------------------------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        
        {/* Top Navigation Bar */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
          }}
        >
          {/* Left: Mobile Toggle & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((p) => !p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '6px'
              }}
            >
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Go-To-Market Management
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: '#F3E8FF',
                  color: '#7C3AED',
                  border: '1px solid #DDD6FE',
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}
              >
                V2 Enterprise
              </span>
            </div>
          </div>

          {/* Center: Global Search */}
          <div style={{ position: 'relative', width: '380px', maxWidth: '40%' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Global search territories, partners, sales flows..."
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '36px',
                paddingRight: '12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                fontSize: '13px',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Right: Actions, Notifications, User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Help Icon */}
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Documentation & System Architecture"
            >
              <HelpCircle size={19} />
            </button>

            {/* Notifications */}
            <button
              type="button"
              onClick={() => navigate('/gtm-v2/approvals')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
              title={`${kpis.pendingApprovalsCount} pending approvals`}
            >
              <Bell size={19} />
              {kpis.pendingApprovalsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#EF4444'
                  }}
                />
              )}
            </button>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#E2E8F0' }} />

            {/* User Profile Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setShowUserDropdown((p) => !p)}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  AR
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Dr. Arvind Rao</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Commercial Director</span>
                </div>
                <ChevronDown size={14} style={{ color: '#94A3B8' }} />
              </div>

              {showUserDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '46px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    width: '220px',
                    padding: '6px',
                    zIndex: 200
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>Biorad Medisys Pvt Ltd</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Active Medical Principal</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      navigate('/gtm-v2/configuration');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      background: 'none',
                      border: 'none',
                      fontSize: '12.5px',
                      color: '#334155',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Settings size={14} />
                    <span>GTM Configuration</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      navigate('/');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      background: 'none',
                      border: 'none',
                      fontSize: '12.5px',
                      color: '#7C3AED',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 600
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Switch to Core ERP</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* 3. PAGE BODY CONTENT */}
        {/* ------------------------------------------------------------------ */}
        <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1600px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
