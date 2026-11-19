import {
  BarChart3, Building2, CheckSquare, FileSpreadsheet, GitFork, LayoutDashboard, Layers, Map, Network, Percent, Settings, Shapes, UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const GTM_BASE = '/gtm-v2';

export const ROUTES = {
  dashboard: `${GTM_BASE}/dashboard`,
  territories: `${GTM_BASE}/territories`,
  zones: `${GTM_BASE}/zones`,
  channels: `${GTM_BASE}/sales-channels`,
  flows: `${GTM_BASE}/sales-policies`,
  flowNew: `${GTM_BASE}/sales-policies/new`,
  flowEdit: (id: string) => `${GTM_BASE}/sales-policies/${id}`,
  partners: `${GTM_BASE}/partners`,
  onboard: `${GTM_BASE}/partners/onboard`,
  onboardEdit: (id: string) => `${GTM_BASE}/partners/onboard/${id}`,
  network: `${GTM_BASE}/partner-network`,
  coverage: `${GTM_BASE}/hospital-coverage`,
  terms: `${GTM_BASE}/commercial-terms`,
  approvals: `${GTM_BASE}/approvals`,
  reports: `${GTM_BASE}/reports`,
  configuration: `${GTM_BASE}/configuration`,
} as const;

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badgeKey?: 'approvals';
}

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  { heading: 'Overview', items: [{ label: 'Dashboard', path: ROUTES.dashboard, icon: LayoutDashboard }] },
  {
    heading: 'Market Structure',
    items: [
      { label: 'Territories', path: ROUTES.territories, icon: Map },
      { label: 'Zones', path: ROUTES.zones, icon: Shapes },
      { label: 'Sales Channels', path: ROUTES.channels, icon: Layers },
      { label: 'Sales Policies', path: ROUTES.flows, icon: GitFork },
    ],
  },
  {
    heading: 'Partners',
    items: [
      { label: 'Partners', path: ROUTES.partners, icon: UserPlus },
      { label: 'Hospital Coverage', path: ROUTES.coverage, icon: Building2 },
      { label: 'Partner Network', path: ROUTES.network, icon: Network },
      { label: 'Commercial Terms', path: ROUTES.terms, icon: Percent },
    ],
  },
  {
    heading: 'Governance',
    items: [
      { label: 'Approvals', path: ROUTES.approvals, icon: CheckSquare, badgeKey: 'approvals' },
      { label: 'Reports', path: ROUTES.reports, icon: FileSpreadsheet },
      { label: 'Configuration', path: ROUTES.configuration, icon: Settings },
    ],
  },
];

export const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: ROUTES.dashboard, title: 'GTM Dashboard' },
  { prefix: ROUTES.territories, title: 'Territory Management' },
  { prefix: ROUTES.zones, title: 'Zone Management' },
  { prefix: ROUTES.channels, title: 'Sales Channel Configuration' },
  { prefix: ROUTES.flows, title: 'Sales Policies' },
  { prefix: ROUTES.onboard, title: 'Partner Onboarding' },
  { prefix: ROUTES.partners, title: 'Partners' },
  { prefix: ROUTES.network, title: 'Partner Network' },
  { prefix: ROUTES.coverage, title: 'Hospital Coverage' },
  { prefix: ROUTES.terms, title: 'Commercial Terms' },
  { prefix: ROUTES.approvals, title: 'Approvals' },
  { prefix: ROUTES.reports, title: 'GTM Reports' },
  { prefix: ROUTES.configuration, title: 'Configuration' },
];

export const DashboardIcon = BarChart3;
