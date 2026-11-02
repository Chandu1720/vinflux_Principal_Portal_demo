import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { SalesChannel } from '../../types/gtm.ts';
import { RoutesOverview } from '../routes/RoutesOverview.tsx';

interface ChannelsRoutesTabProps {
  initialSubTab?: 'routes' | 'channels';
}

export const ChannelsRoutesTab: React.FC<ChannelsRoutesTabProps> = ({
  initialSubTab = 'channels'
}) => {
  const {
    salesChannels,
    distributionRoutes,
    addSalesChannel,
    showToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'routes' | 'channels'>(initialSubTab);

  // New Channel Modal
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [channelMargin, setChannelMargin] = useState(10.0);
  const [channelMarginType, setChannelMarginType] = useState('Price to Distributor (PTD)');
  const [isReseller, setIsReseller] = useState(true);
  const [requiresDeposit, setRequiresDeposit] = useState(true);
  const [creditDays, setCreditDays] = useState(45);

  const handleCreateChannel = () => {
    if (!channelName.trim()) {
      showToast('Channel Name is required.', 'warning');
      return;
    }
    const newChan: SalesChannel = {
      id: `ct-${Date.now().toString().slice(-4)}`,
      code: channelCode.trim().toUpperCase() || 'CHAN-' + Math.floor(10 + Math.random() * 90),
      name: channelName.trim(),
      description: channelDesc || 'Commercial sales channel.',
      isReseller,
      standardMarginPercent: Number(channelMargin),
      marginType: channelMarginType,
      requiresDeposit,
      defaultCreditDays: Number(creditDays),
      status: 'Active'
    };
    addSalesChannel(newChan);
    setIsChannelModalOpen(false);
    setChannelName('');
    setChannelCode('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Sub Tabs: Separate Channels & Routes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vf-slate-200)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('channels')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Sales Channels & Margins ({salesChannels.length})
          </button>
          <button
            type="button"
            className={`vf-tab-btn ${activeSubTab === 'routes' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('routes')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Sales Routes & Route Builder ({distributionRoutes.length})
          </button>
        </div>

        <div>
          {activeSubTab === 'channels' && (
            <button type="button" className="vf-btn vf-btn-primary vf-btn-sm" onClick={() => setIsChannelModalOpen(true)}>
              + New Sales Channel
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DISTRIBUTION ROUTES & PATH BUILDER                */}
      {/* ========================================================= */}
      {activeSubTab === 'routes' && <RoutesOverview />}

      {/* ========================================================= */}
      {/* TAB 2: SALES CHANNELS & MARGIN POLICIES                  */}
      {/* ========================================================= */}
      {activeSubTab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--vf-slate-600)' }}>
            Sales channels define the commercial model, reseller margins, and credit requirements for how goods are sold into the healthcare market.
          </div>

          <div className="vf-table-container">
            <div className="vf-table-responsive">
              <table className="vf-table">
                <thead>
                  <tr>
                    <th>Channel Type & Code</th>
                    <th>Description</th>
                    <th>Reseller Model</th>
                    <th>Standard Margin %</th>
                    <th>Pricing Tier Basis</th>
                    <th>Collateral Deposit</th>
                    <th>Default Credit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesChannels.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--vf-slate-900)', fontSize: '13.5px' }}>
                          {c.name}
                        </div>
                        <code style={{ fontSize: '11px', marginTop: '2px', display: 'inline-block' }}>{c.code}</code>
                      </td>
                      <td style={{ maxWidth: '280px', fontSize: '12px', color: 'var(--vf-slate-600)', lineHeight: 1.4 }}>
                        {c.description}
                      </td>
                      <td>
                        {c.isReseller ? (
                          <span className="vf-badge vf-badge-approved">Takes Title / Resells</span>
                        ) : (
                          <span className="vf-badge" style={{ background: '#f1f5f9', color: '#475569' }}>Consignment / Direct</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ fontSize: '14px', color: 'var(--vf-primary)' }}>
                          {c.standardMarginPercent > 0 ? `${c.standardMarginPercent}%` : 'Tender / Contract'}
                        </strong>
                      </td>
                      <td>
                        <span className="vf-badge vf-badge-type">{c.marginType}</span>
                      </td>
                      <td>
                        {c.requiresDeposit ? (
                          <span className="vf-badge vf-badge-approved">✓ Required</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--vf-slate-400)' }}>No Collateral</span>
                        )}
                      </td>
                      <td>
                        <strong>{c.defaultCreditDays} Days</strong>
                      </td>
                      <td>
                        <span className={`vf-badge ${c.status === 'Active' ? 'vf-badge-approved' : 'vf-badge-danger'}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW SALES CHANNEL MODAL */}
      {isChannelModalOpen && (
        <div
          className="vf-modal-backdrop"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsChannelModalOpen(false); }}
        >
          <div className="vf-modal" style={{ width: '540px', maxWidth: '92vw', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
            <div className="vf-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="vf-modal-title" style={{ fontSize: '16px', fontWeight: 700 }}>New Commercial Sales Channel</div>
              <button onClick={() => setIsChannelModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--vf-slate-400)' }}>&times;</button>
            </div>
            <div className="vf-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="vf-form-group">
                  <label className="vf-label">Channel Name *</label>
                  <input type="text" className="vf-input" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g. Government Medical Supplies" />
                </div>
                <div className="vf-form-group">
                  <label className="vf-label">Channel Code *</label>
                  <input type="text" className="vf-input" value={channelCode} onChange={(e) => setChannelCode(e.target.value)} placeholder="e.g. GOVT-MED" />
                </div>
              </div>
              <div className="vf-form-group">
                <label className="vf-label">Description</label>
                <textarea className="vf-input" rows={2} style={{ height: 'auto', padding: '8px' }} value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} placeholder="Operational purpose of this channel..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="vf-form-group">
                  <label className="vf-label">Standard Margin %</label>
                  <input type="number" step="0.5" className="vf-input" value={channelMargin} onChange={(e) => setChannelMargin(Number(e.target.value))} />
                </div>
                <div className="vf-form-group">
                  <label className="vf-label">Default Credit Days</label>
                  <input type="number" className="vf-input" value={creditDays} onChange={(e) => setCreditDays(Number(e.target.value))} />
                </div>
              </div>
              <div className="vf-form-group">
                <label className="vf-label">Pricing Tier Basis</label>
                <select className="vf-select" value={channelMarginType} onChange={(e) => setChannelMarginType(e.target.value)}>
                  <option value="Price to Distributor (PTD)">Price to Distributor (PTD)</option>
                  <option value="Price to Super Stockist (PTS)">Price to Super Stockist (PTS)</option>
                  <option value="Price to Retailer (PTR)">Price to Retailer (PTR)</option>
                  <option value="Direct Institutional Rate Contract">Direct Institutional Rate Contract</option>
                  <option value="Service Fee on Invoiced Value">Service Fee on Invoiced Value</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isReseller} onChange={(e) => setIsReseller(e.target.checked)} /> Reseller (Takes Title)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={requiresDeposit} onChange={(e) => setRequiresDeposit(e.target.checked)} /> Requires Collateral Deposit
                </label>
              </div>
            </div>
            <div className="vf-modal-footer" style={{ padding: '14px 20px', backgroundColor: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="vf-btn vf-btn-secondary" onClick={() => setIsChannelModalOpen(false)}>Cancel</button>
              <button type="button" className="vf-btn vf-btn-primary" onClick={handleCreateChannel}>Create Channel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
