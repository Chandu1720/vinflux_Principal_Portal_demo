import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.tsx';

interface TopbarProps {
  onSearch?: (term: string) => void;
  searchValue?: string;
  placeholder?: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  onSearch,
  searchValue = '',
  placeholder = 'Search products, SKUs, GTIN...'
}) => {
  const location = useLocation();
  const { showToast } = useApp();

  let pageTitle = 'Product Master';
  let modeTag = 'Universal Engine Mode';

  if (location.pathname.startsWith('/branches')) {
    pageTitle = 'Branch Master';
    modeTag = 'Corporate Supply Infrastructure';
  } else if (location.pathname.startsWith('/orders')) {
    pageTitle = 'Orders';
    modeTag = 'Order Management';
  } else if (location.pathname.startsWith('/recall')) {
    pageTitle = 'Complaints & Recall';
    modeTag = 'Vigilance';
  } else if (location.pathname.startsWith('/returns')) {
    pageTitle = 'Returns';
    modeTag = 'Returns & Credit Notes';
  } else if (location.pathname.startsWith('/logistics')) {
    pageTitle = 'Logistics';
    modeTag = 'Dispatch & Delivery';
  } else if (location.pathname.startsWith('/inventory')) {
    pageTitle = 'Inventory';
    modeTag = 'Inventory Ledger';
  } else if (location.pathname.startsWith('/data-import')) {
    pageTitle = 'Data Import';
    modeTag = 'Platform';
  } else if (location.pathname.startsWith('/integrations')) {
    pageTitle = 'Integration Hub';
    modeTag = 'Platform';
  } else if (location.pathname.startsWith('/surgical')) {
    pageTitle = 'Surgery Cases & Implants';
    modeTag = 'Medical';
  } else if (location.pathname.startsWith('/pricing')) {
    pageTitle = 'Price Lists & Rate Contracts';
    modeTag = 'Commercial';
  } else if (location.pathname.startsWith('/users')) {
    pageTitle = 'Users & Roles';
    modeTag = 'Platform';
  } else if (location.pathname.startsWith('/modules')) {
    pageTitle = 'Modules';
    modeTag = 'Platform';
  } else if (location.pathname.startsWith('/warehouses')) {
    pageTitle = 'Warehouse Master';
    modeTag = 'Logistics & Depot Infrastructure';
  }

  const handleShowArchGuide = () => {
    alert(
      'VinFlux Principal Portal Architecture:\n\n' +
      '1. Product Master: Universal product definition, regulatory classification, dynamic attributes, and matrix variants. Safety thresholds define inventory policy.\n' +
      '2. Go-to-Market: territories, zones, sales channels, sales policies, partner onboarding (GSTIN + KYC), supply links, commercial terms with inheritance, credit, licences, partner portal and approvals.\n' +
      '3. Branch & Warehouse Master: supply infrastructure used as stock sources in Go-to-Market.'
    );
  };

  return (
    <header className="vf-topbar">
      <div className="vf-topbar-left">
        <div className="vf-breadcrumbs">
          <Link to="/">VinFlux</Link>
          <span className="separator">/</span>
          <span className="current">{pageTitle}</span>
        </div>
        <div className="vf-system-mode-tag" title="Universal Engine Architecture Mode">
          <span className="vf-system-mode-dot"></span>
          <span>{modeTag}</span>
        </div>
      </div>

      <div className="vf-topbar-right">
        {/* Global Search Input */}
        <div className="vf-search-input-wrap">
          <svg className="vf-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="vf-search-input"
            value={searchValue}
            onChange={(e) => onSearch && onSearch(e.target.value)}
            placeholder={placeholder}
          />
        </div>

        {/* Pending Alerts Count */}
        <button
          type="button"
          className="vf-icon-btn"
          title="2 Pending Regulatory / Commercial Alerts"
          onClick={() => showToast('2 Regulatory Dossier alerts pending MDR review.', 'warning')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="vf-badge-count">2</span>
        </button>

        {/* Architecture Principles Info */}
        <button
          type="button"
          className="vf-icon-btn"
          onClick={handleShowArchGuide}
          title="Architecture Principles & Integration Guide"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      </div>
    </header>
  );
};
