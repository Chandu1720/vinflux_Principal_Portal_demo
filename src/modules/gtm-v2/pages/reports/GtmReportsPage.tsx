import React, { useState } from 'react';
import {
  Download,
  Printer,
  FileSpreadsheet,
  Search,
  MapPin,
  Globe2,
  Share2,
  Workflow,
  Users,
  FileText,
  CreditCard
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import { StatusBadge } from '../../components/common/StatusBadge';

type ReportType =
  | 'territories'
  | 'zones'
  | 'channels'
  | 'flows'
  | 'partners'
  | 'kyc'
  | 'commercial';

export const GtmReportsPage: React.FC = () => {
  const {
    territories,
    zones,
    salesChannels,
    salesFlows,
    partners,
    resolvedCommercialTerms
  } = useGtmV2();

  const [activeReport, setActiveReport] = useState<ReportType>('partners');
  const [searchTerm, setSearchTerm] = useState('');

  const reportTabs = [
    { id: 'partners' as const, label: 'Partner Accreditation', icon: <Users size={15} /> },
    { id: 'territories' as const, label: 'Territory Coverage', icon: <MapPin size={15} /> },
    { id: 'zones' as const, label: 'Zone Overlap Matrix', icon: <Globe2 size={15} /> },
    { id: 'channels' as const, label: 'Sales Channels', icon: <Share2 size={15} /> },
    { id: 'flows' as const, label: 'Flow Topologies', icon: <Workflow size={15} /> },
    { id: 'kyc' as const, label: 'Statutory KYC Exceptions', icon: <FileText size={15} /> },
    { id: 'commercial' as const, label: 'Commercial Deviations', icon: <CreditCard size={15} /> }
  ];

  // Export functions
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeReport === 'partners') {
      csvContent += 'Code,Name,Type,Primary Territory,GSTIN,Status,Discount %\n';
      partners.forEach((p) => {
        csvContent += `"${p.code}","${p.name}","${p.partnerType}","${p.assignedTerritoryNames?.[0] || ''}","${p.gstin}","${p.status}","${p.commercialTerms.effectiveDiscount}"\n`;
      });
    } else if (activeReport === 'commercial') {
      csvContent += 'Partner Code,Partner Name,Channel,Territory,Approved Discount %,Credit Days,Credit Limit,Provenance\n';
      resolvedCommercialTerms.forEach((c) => {
        csvContent += `"${c.partnerCode}","${c.partnerName}","${c.channelName}","${c.territoryName}","${c.approvedDiscount}","${c.creditPeriodDays}","${c.creditLimit}","${c.provenance}"\n`;
      });
    } else if (activeReport === 'territories') {
      csvContent += 'Code,Name,Level,Lead Person,Status,Postal PIN Count\n';
      territories.forEach((t) => {
        csvContent += `"${t.code}","${t.name}","${t.levelLabel || ''}","${t.leadPerson || ''}","${t.status}","${t.pinCodes?.length || 0}"\n`;
      });
    } else {
      csvContent += 'ID,Name,Status\n';
      salesChannels.forEach((c) => {
        csvContent += `"${c.code}","${c.name}","${c.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VinFlux_GTM_${activeReport}_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    let dataToExport: any = [];
    if (activeReport === 'partners') dataToExport = partners;
    else if (activeReport === 'commercial') dataToExport = resolvedCommercialTerms;
    else if (activeReport === 'territories') dataToExport = territories;
    else if (activeReport === 'zones') dataToExport = zones;
    else if (activeReport === 'channels') dataToExport = salesChannels;
    else if (activeReport === 'flows') dataToExport = salesFlows;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `VinFlux_GTM_${activeReport}_Report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* -------------------------------------------------------------------- */}
      {/* HEADER */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
              Enterprise GTM Intelligence & Audit Reports
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#EDE9FE',
                color: '#7C3AED',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}
            >
              7 Executive Reports
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Structured operational reporting, compliance audit exports, and commercial performance analysis.
          </p>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={15} color="#16A34A" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={15} color="#7C3AED" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* REPORT TYPE SELECTOR TABS */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto'
        }}
      >
        {reportTabs.map((tab) => {
          const isSelected = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isSelected ? '#7C3AED' : 'transparent',
                color: isSelected ? '#FFFFFF' : '#64748B',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* REPORT CONTENT DATA TABLE */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              {reportTabs.find((t) => t.id === activeReport)?.label} Master Register
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Generated on {new Date().toLocaleDateString()} • Verified Enterprise Snapshot
            </span>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 34px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Dynamic Table based on report */}
        <div style={{ overflowX: 'auto' }}>
          {activeReport === 'partners' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Code</th>
                  <th style={{ padding: '10px 12px' }}>Legal Entity Name</th>
                  <th style={{ padding: '10px 12px' }}>Partner Type</th>
                  <th style={{ padding: '10px 12px' }}>GSTIN</th>
                  <th style={{ padding: '10px 12px' }}>Effective Terms</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.code}</td>
                    <td style={{ padding: '10px 12px', color: '#0F172A' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>{p.partnerType}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{p.gstin}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#7C3AED' }}>
                      {p.commercialTerms.effectiveDiscount}% Disc • {p.commercialTerms.effectiveCreditDays}d Credit
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'commercial' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Partner Code</th>
                  <th style={{ padding: '10px 12px' }}>Entity Name</th>
                  <th style={{ padding: '10px 12px' }}>Channel</th>
                  <th style={{ padding: '10px 12px' }}>Approved Discount</th>
                  <th style={{ padding: '10px 12px' }}>Credit Line</th>
                  <th style={{ padding: '10px 12px' }}>Resolution Precedence</th>
                </tr>
              </thead>
              <tbody>
                {resolvedCommercialTerms.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.partnerCode}</td>
                    <td style={{ padding: '10px 12px' }}>{c.partnerName}</td>
                    <td style={{ padding: '10px 12px' }}>{c.channelName}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#7C3AED' }}>{c.approvedDiscount}%</td>
                    <td style={{ padding: '10px 12px' }}>₹{c.creditLimit.toLocaleString()} ({c.creditPeriodDays}d)</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{c.provenance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'territories' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Territory Code</th>
                  <th style={{ padding: '10px 12px' }}>Territory Name</th>
                  <th style={{ padding: '10px 12px' }}>Level</th>
                  <th style={{ padding: '10px 12px' }}>Lead Manager</th>
                  <th style={{ padding: '10px 12px' }}>Postal PINs</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {territories.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.code}</td>
                    <td style={{ padding: '10px 12px' }}>{t.name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>{t.levelLabel || 'Territory'}</td>
                    <td style={{ padding: '10px 12px' }}>{t.leadPerson || 'Unassigned'}</td>
                    <td style={{ padding: '10px 12px' }}>{t.pinCodes?.length || 0} PIN codes</td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'channels' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Code</th>
                  <th style={{ padding: '10px 12px' }}>Channel Name</th>
                  <th style={{ padding: '10px 12px' }}>Standard Discount</th>
                  <th style={{ padding: '10px 12px' }}>Credit Days</th>
                  <th style={{ padding: '10px 12px' }}>Credit Limit</th>
                  <th style={{ padding: '10px 12px' }}>Security Deposit</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {salesChannels.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.code}</td>
                    <td style={{ padding: '10px 12px' }}>{c.name}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#7C3AED' }}>{c.standardDiscountPercent}%</td>
                    <td style={{ padding: '10px 12px' }}>{c.creditPeriodDays} Days</td>
                    <td style={{ padding: '10px 12px' }}>₹{c.creditLimit.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{c.requiresDeposit ? `₹${c.depositAmount.toLocaleString()}` : 'None'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'flows' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Flow Code</th>
                  <th style={{ padding: '10px 12px' }}>Topology Name</th>
                  <th style={{ padding: '10px 12px' }}>Stage Count</th>
                  <th style={{ padding: '10px 12px' }}>Fulfillment Pathway</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {salesFlows.map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{f.code}</td>
                    <td style={{ padding: '10px 12px' }}>{f.name}</td>
                    <td style={{ padding: '10px 12px' }}>{f.stages.length} Stages</td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>
                      {f.stages.map((s) => s.channelName).join(' → ')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={f.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'kyc' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Partner Code</th>
                  <th style={{ padding: '10px 12px' }}>Partner Entity</th>
                  <th style={{ padding: '10px 12px' }}>Total Required KYC</th>
                  <th style={{ padding: '10px 12px' }}>Verified Docs</th>
                  <th style={{ padding: '10px 12px' }}>Pending Action</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => {
                  const verifiedCount = p.kycDocuments.filter((d) => d.status === 'Verified').length;
                  const total = p.kycDocuments.length;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.code}</td>
                      <td style={{ padding: '10px 12px' }}>{p.name}</td>
                      <td style={{ padding: '10px 12px' }}>{total} Statutory Docs</td>
                      <td style={{ padding: '10px 12px', color: '#16A34A', fontWeight: 600 }}>{verifiedCount} Verified</td>
                      <td style={{ padding: '10px 12px', color: verifiedCount < total ? '#B45309' : '#16A34A' }}>
                        {verifiedCount < total ? `${total - verifiedCount} Pending Compliance` : 'All Verified'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeReport === 'zones' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Zone Code</th>
                  <th style={{ padding: '10px 12px' }}>Zone Name</th>
                  <th style={{ padding: '10px 12px' }}>Assigned Territories</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{z.code}</td>
                    <td style={{ padding: '10px 12px' }}>{z.name}</td>
                    <td style={{ padding: '10px 12px' }}>{z.territoryIds.length} Territories</td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={z.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
