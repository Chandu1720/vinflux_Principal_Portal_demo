import React, { useState, useMemo } from 'react';
import {
  Network,
  Search,
  Filter,
  ArrowRight,
  MapPin
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { PartnerOnboardingRecord } from '../../types/gtmV2.types';
import { StatusBadge } from '../../components/common/StatusBadge';

export const PartnerNetworkPage: React.FC = () => {
  const { partners, salesChannels, territories } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('All');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>('All');
  const [selectedPartner, setSelectedPartner] = useState<PartnerOnboardingRecord | null>(
    partners[0] || null
  );

  // Group partners into distribution tiers
  const tiers = useMemo(() => {
    const tierMap: Record<string, PartnerOnboardingRecord[]> = {
      'C&F Agents (Central Stocking)': [],
      'Primary Distributors': [],
      'Authorized Dealers & Stockists': [],
      'Hospitals & Institutional Buyers': []
    };

    partners.forEach((p) => {
      if (
        selectedChannelId !== 'All' &&
        !p.partnerMappings.some((m) => m.stageChannelName.toLowerCase().includes(selectedChannelId.toLowerCase()))
      ) {
        return;
      }

      if (
        selectedTerritoryId !== 'All' &&
        !p.assignedTerritoryIds.includes(selectedTerritoryId)
      ) {
        return;
      }

      if (
        searchTerm &&
        !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !p.code.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !p.businessName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return;
      }

      const typeLower = p.partnerType.toLowerCase();
      if (typeLower.includes('c&f') || typeLower.includes('carrying')) {
        tierMap['C&F Agents (Central Stocking)'].push(p);
      } else if (typeLower.includes('distributor') || typeLower.includes('super stockist')) {
        tierMap['Primary Distributors'].push(p);
      } else if (typeLower.includes('dealer') || typeLower.includes('sub-distributor')) {
        tierMap['Authorized Dealers & Stockists'].push(p);
      } else {
        tierMap['Hospitals & Institutional Buyers'].push(p);
      }
    });

    return tierMap;
  }, [partners, selectedChannelId, selectedTerritoryId, searchTerm]);

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
              Partner Network Topology & Relationships
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
              Multi-Tier Custody Graph
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Interactive end-to-end visualization of upstream supply custody and downstream partner billing links.
          </p>
        </div>

        {/* Global Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Active Network Tiers</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>4 Operational Echelons</div>
          </div>
          <div style={{ height: '32px', width: '1px', backgroundColor: '#E2E8F0' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Connected Entities</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#7C3AED' }}>{partners.length} Partners</div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FILTER BAR */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <Search
            size={15}
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
            placeholder="Search network nodes..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#64748B" />
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="All">All Channels</option>
              {salesChannels.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color="#64748B" />
            <select
              value={selectedTerritoryId}
              onChange={(e) => setSelectedTerritoryId(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <option value="All">All Territories</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MULTI-TIER VISUAL PIPELINE GRAPH */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          alignItems: 'start'
        }}
      >
        {Object.entries(tiers).map(([tierName, partnerList], tierIndex) => (
          <div
            key={tierName}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '400px'
            }}
          >
            {/* Column Header */}
            <div style={{ borderBottom: '2px solid #EDE9FE', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: '#7C3AED', color: '#FFFFFF', padding: '1px 6px', borderRadius: '4px' }}>
                  TIER {tierIndex + 1}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                  {partnerList.length} Nodes
                </span>
              </div>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                {tierName}
              </h3>
            </div>

            {/* Nodes Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
              {partnerList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8', fontSize: '12px' }}>
                  No partners in this tier matching active filters.
                </div>
              ) : (
                partnerList.map((p) => {
                  const isSelected = selectedPartner?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPartner(p)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1.5px solid ${isSelected ? '#7C3AED' : '#E2E8F0'}`,
                        backgroundColor: isSelected ? '#F5F3FF' : '#FAFAFA',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? '0 2px 8px rgba(124, 58, 237, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: '#E2E8F0', color: '#334155', padding: '1px 5px', borderRadius: '3px' }}>
                          {p.code}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>

                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                        <MapPin size={11} color="#7C3AED" />
                        <span>{p.assignedTerritoryNames?.[0] || 'Unassigned'}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1', fontSize: '11px' }}>
                        <span style={{ color: '#64748B' }}>Terms:</span>
                        <span style={{ fontWeight: 600, color: '#7C3AED' }}>
                          {p.commercialTerms.effectiveDiscount}% Disc • {p.commercialTerms.effectiveCreditDays}d
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SELECTED PARTNER RELATIONSHIP INSPECTION DOCK */}
      {/* -------------------------------------------------------------------- */}
      {selectedPartner && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#EDE9FE',
                  color: '#7C3AED',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}
              >
                <Network size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                    {selectedPartner.name}
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                    {selectedPartner.code}
                  </span>
                  <StatusBadge status={selectedPartner.status} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Role: {selectedPartner.partnerType} • GSTIN: {selectedPartner.gstin} • Contact: {selectedPartner.contactPerson} ({selectedPartner.phone})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Credit Line Allocated</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  ₹{selectedPartner.commercialTerms.effectiveCreditLimit.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Upstream & Downstream Flow Connection Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Upstream Suppliers */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowRight size={14} color="#7C3AED" style={{ transform: 'rotate(180deg)' }} />
                <span>Upstream Supply Ingestion</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5' }}>
                Custody sourced from <strong>VinFlux Central Distribution Center</strong> via {selectedPartner.partnerMappings[0]?.stageChannelName || 'Direct'}.
                All goods subject to automated e-Way bill and serial GTIN traceability.
              </div>
            </div>

            {/* Downstream Buyers */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowRight size={14} color="#10B981" />
                <span>Downstream Authorized Territory Coverage</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5' }}>
                Authorized to fulfill surgical purchase orders in <strong>{selectedPartner.assignedTerritoryNames?.join(', ') || 'Assigned Territory'}</strong>.
                Commercial ceiling cap: {selectedPartner.commercialTerms.effectiveDiscount}% discount from PTR.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
