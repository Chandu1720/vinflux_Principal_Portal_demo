import React, { useState, useMemo } from 'react';
import {
  Workflow,
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowRight,
  MoveLeft,
  MoveRight,
  MapPin,
  Globe2,
  Package,
  Copy,
  Check
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { SalesFlowTopology, SalesFlowStage, ProductScopeConfig, ActiveStatus } from '../../types/gtmV2.types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SideDrawer } from '../../components/common/SideDrawer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { HierarchicalTreeSelect } from '../../components/common/HierarchicalTreeSelect';
import { initialPortfolios, initialProducts } from '../../../../data/productMasterData';

const COMMON_ROLES: Array<'Source' | 'Intermediary' | 'Consignee' | 'Destination'> = [
  'Source',
  'Intermediary',
  'Consignee',
  'Destination'
];

const PRICING_BASIS_OPTIONS = [
  'Transfer Price',
  'PTS (Price to Stockist)',
  'PTR (Price to Retailer)',
  'MRP Discount',
  'Net Contract Price',
  'Cost Plus Margin'
];

export const SalesFlowTopologyPage: React.FC = () => {
  const {
    salesFlows,
    salesChannels,
    territories,
    zones,
    addSalesFlow,
    updateSalesFlow,
    deleteSalesFlow
  } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(salesFlows[0]?.id || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<SalesFlowTopology | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; flowId: string; flowName: string }>({
    isOpen: false,
    flowId: '',
    flowName: ''
  });

  // Modal form state
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    description: string;
    status: ActiveStatus;
    flowType: 'Direct' | 'Multi-Stage';
    stages: SalesFlowStage[];
    applicableTerritoryIds: string[];
    applicableZoneIds: string[];
    productScope: ProductScopeConfig;
  }>({
    code: '',
    name: '',
    description: '',
    status: 'Active',
    flowType: 'Multi-Stage',
    stages: [],
    applicableTerritoryIds: [],
    applicableZoneIds: [],
    productScope: {
      scopeType: 'All',
      portfolioIds: [],
      categoryIds: [],
      subcategoryIds: [],
      productIds: []
    }
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedZoneIdForFilter, setSelectedZoneIdForFilter] = useState<string>('');

  const selectedZoneObj = zones.find((z) => z.id === selectedZoneIdForFilter);
  const availableZoneTerritories = useMemo(() => {
    if (!selectedZoneObj) return [];
    return territories.filter((t) => selectedZoneObj.territoryIds.includes(t.id));
  }, [selectedZoneObj, territories]);

  const handleSelectAllZoneTerritories = () => {
    if (!selectedZoneObj) return;
    const newTerritoryIds = Array.from(new Set([...formData.applicableTerritoryIds, ...selectedZoneObj.territoryIds]));
    const newZoneIds = Array.from(new Set([...formData.applicableZoneIds, selectedZoneObj.id]));
    setFormData((p) => ({
      ...p,
      applicableTerritoryIds: newTerritoryIds,
      applicableZoneIds: newZoneIds
    }));
  };

  const handleDeselectAllZoneTerritories = () => {
    if (!selectedZoneObj) return;
    const newTerritoryIds = formData.applicableTerritoryIds.filter((id) => !selectedZoneObj.territoryIds.includes(id));
    const newZoneIds = formData.applicableZoneIds.filter((id) => id !== selectedZoneObj.id);
    setFormData((p) => ({
      ...p,
      applicableTerritoryIds: newTerritoryIds,
      applicableZoneIds: newZoneIds
    }));
  };

  const handleToggleZoneTerritory = (tId: string) => {
    const isPresent = formData.applicableTerritoryIds.includes(tId);
    const updated = isPresent
      ? formData.applicableTerritoryIds.filter((id) => id !== tId)
      : [...formData.applicableTerritoryIds, tId];

    let updatedZones = [...formData.applicableZoneIds];
    if (selectedZoneObj && !isPresent && !updatedZones.includes(selectedZoneObj.id)) {
      updatedZones.push(selectedZoneObj.id);
    }
    setFormData((p) => ({
      ...p,
      applicableTerritoryIds: updated,
      applicableZoneIds: updatedZones
    }));
  };

  const filteredFlows = salesFlows.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFlow = salesFlows.find((f) => f.id === selectedFlowId) || salesFlows[0];

  const handleOpenCreateModal = () => {
    setEditingFlow(null);
    const defaultChannel = salesChannels[0] || { id: 'chan-1', name: 'Standard' };
    setFormData({
      code: `FLOW-${String(salesFlows.length + 1).padStart(3, '0')}`,
      name: '',
      description: '',
      status: 'Active',
      flowType: 'Multi-Stage',
      stages: [
        {
          id: `stage-${Date.now()}-1`,
          stageNumber: 1,
          channelId: defaultChannel.id,
          channelName: defaultChannel.name,
          stageRole: 'Source',
          pricingBasis: 'Transfer Price',
          inventoryOwnership: 'Company Owned',
          requiresLogisticsDispatch: true
        },
        {
          id: `stage-${Date.now()}-2`,
          stageNumber: 2,
          channelId: salesChannels[1]?.id || defaultChannel.id,
          channelName: salesChannels[1]?.name || defaultChannel.name,
          stageRole: 'Intermediary',
          pricingBasis: 'PTS (Price to Stockist)',
          inventoryOwnership: 'Consignment',
          requiresLogisticsDispatch: true
        },
        {
          id: `stage-${Date.now()}-3`,
          stageNumber: 3,
          channelId: salesChannels[2]?.id || defaultChannel.id,
          channelName: salesChannels[2]?.name || defaultChannel.name,
          stageRole: 'Destination',
          pricingBasis: 'PTR (Price to Retailer)',
          inventoryOwnership: 'Customer Owned',
          requiresLogisticsDispatch: false
        }
      ],
      applicableTerritoryIds: [],
      applicableZoneIds: [],
      productScope: {
        scopeType: 'All',
        portfolioIds: [],
        categoryIds: [],
        subcategoryIds: [],
        productIds: []
      }
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (flow: SalesFlowTopology) => {
    setEditingFlow(flow);
    setFormData({
      code: flow.code,
      name: flow.name,
      description: flow.description,
      status: flow.status,
      flowType: flow.flowType,
      stages: JSON.parse(JSON.stringify(flow.stages)),
      applicableTerritoryIds: [...flow.applicableTerritoryIds],
      applicableZoneIds: [...flow.applicableZoneIds],
      productScope: JSON.parse(JSON.stringify(flow.productScope))
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDuplicateFlow = (flow: SalesFlowTopology) => {
    setEditingFlow(null);
    setFormData({
      code: `${flow.code}-COPY`,
      name: `${flow.name} (Copy)`,
      description: flow.description,
      status: 'Active',
      flowType: flow.flowType,
      stages: JSON.parse(JSON.stringify(flow.stages)).map((s: SalesFlowStage, idx: number) => ({
        ...s,
        id: `stage-dup-${Date.now()}-${idx}`
      })),
      applicableTerritoryIds: [...flow.applicableTerritoryIds],
      applicableZoneIds: [...flow.applicableZoneIds],
      productScope: JSON.parse(JSON.stringify(flow.productScope))
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Stage builder handlers
  const handleAddStage = () => {
    const newStageNumber = formData.stages.length + 1;
    const defaultChannel = salesChannels[0] || { id: 'chan-1', name: 'Standard' };
    const newStage: SalesFlowStage = {
      id: `stage-${Date.now()}-${newStageNumber}`,
      stageNumber: newStageNumber,
      channelId: defaultChannel.id,
      channelName: defaultChannel.name,
      stageRole: 'Destination',
      pricingBasis: 'PTR (Price to Retailer)',
      inventoryOwnership: 'Customer Owned',
      requiresLogisticsDispatch: true
    };
    setFormData((prev) => ({
      ...prev,
      stages: [...prev.stages, newStage]
    }));
  };

  const handleRemoveStage = (index: number) => {
    if (formData.stages.length <= 1) {
      alert('A sales flow must have at least one fulfillment stage.');
      return;
    }
    const updated = formData.stages.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      stageNumber: idx + 1
    }));
    setFormData((prev) => ({ ...prev, stages: updated }));
  };

  const handleMoveStage = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= formData.stages.length) return;

    const copy = [...formData.stages];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    const reordered = copy.map((s, idx) => ({ ...s, stageNumber: idx + 1 }));
    setFormData((prev) => ({ ...prev, stages: reordered }));
  };

  const handleStageFieldChange = (index: number, field: keyof SalesFlowStage, value: any) => {
    const updated = [...formData.stages];
    if (field === 'channelId') {
      const foundChan = salesChannels.find((c) => c.id === value);
      updated[index] = {
        ...updated[index],
        channelId: value,
        channelName: foundChan ? foundChan.name : updated[index].channelName
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormData((prev) => ({ ...prev, stages: updated }));
  };

  // Submit modal
  const handleSaveFlow = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Flow name is required.';
    if (!formData.code.trim()) errors.code = 'Flow code is required.';
    if (formData.stages.length === 0) errors.stages = 'At least one stage is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload: Omit<SalesFlowTopology, 'id' | 'createdAt' | 'updatedAt'> = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      status: formData.status,
      flowType: formData.flowType,
      stages: formData.stages,
      applicableTerritoryIds: formData.applicableTerritoryIds,
      applicableZoneIds: formData.applicableZoneIds,
      productScope: formData.productScope,
      effectiveFrom: new Date().toISOString().split('T')[0]
    };

    if (editingFlow) {
      updateSalesFlow(editingFlow.id, payload);
      setSelectedFlowId(editingFlow.id);
    } else {
      addSalesFlow(payload);
    }

    setIsModalOpen(false);
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
              Sales Flow Topology
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
              {salesFlows.length} Configured Topologies
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Model multi-tier physical & commercial distribution routes from manufacturing plant down to hospital buyers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#7C3AED',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#6D28D9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7C3AED')}
        >
          <Plus size={16} />
          <span>New Sales Flow</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* VISUAL TOPOLOGY SHOWCASE BANNER */}
      {/* -------------------------------------------------------------------- */}
      {activeFlow && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeFlow.code}
                </span>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                  {activeFlow.name}
                </h3>
                <StatusBadge status={activeFlow.status} />
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                {activeFlow.description || 'Configurable multi-echelon routing rules.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleDuplicateFlow(activeFlow)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Copy size={13} />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditModal(activeFlow)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Edit2 size={13} />
                <span>Edit Flow</span>
              </button>
            </div>
          </div>

          {/* Flow Stepper Chart */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              overflowX: 'auto',
              padding: '20px 10px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              gap: '12px'
            }}
          >
            {activeFlow.stages.map((stage, idx) => {
              const channelObj = salesChannels.find((c) => c.id === stage.channelId);
              return (
                <React.Fragment key={stage.id || stage.stageNumber}>
                  {/* Stage Node */}
                  <div
                    style={{
                      flex: '0 0 230px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                      padding: '16px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: '#EDE9FE',
                          color: '#7C3AED',
                          padding: '2px 8px',
                          borderRadius: '9999px'
                        }}
                      >
                        STAGE {stage.stageNumber}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {stage.stageRole}
                      </span>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Custody Ownership
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                        {stage.inventoryOwnership}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#64748B' }}>Channel:</span>
                        <span style={{ fontWeight: 600, color: '#7C3AED' }}>{channelObj?.name || stage.channelName}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#64748B' }}>Pricing Basis:</span>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{stage.pricingBasis}</span>
                      </div>
                    </div>
                  </div>

                  {/* Flow Connector Arrow */}
                  {idx < activeFlow.stages.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', flexShrink: 0 }}>
                      <div style={{ width: '24px', height: '2px', backgroundColor: '#CBD5E1' }} />
                      <ArrowRight size={18} style={{ color: '#7C3AED', marginLeft: '-4px' }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Scope Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
              <Package size={14} color="#7C3AED" />
              <span>Product Scope:</span>
              <strong style={{ color: '#0F172A' }}>
                {activeFlow.productScope.scopeType === 'All'
                  ? 'Entire Product Catalog'
                  : `${activeFlow.productScope.scopeType} Specific`}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
              <MapPin size={14} color="#7C3AED" />
              <span>Assigned Territories:</span>
              <strong style={{ color: '#0F172A' }}>
                {activeFlow.applicableTerritoryIds.length === 0
                  ? 'All Territories (Global Fallback)'
                  : `${activeFlow.applicableTerritoryIds.length} Territories`}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
              <Globe2 size={14} color="#7C3AED" />
              <span>Assigned Zones:</span>
              <strong style={{ color: '#0F172A' }}>
                {activeFlow.applicableZoneIds.length === 0
                  ? 'All Zones'
                  : `${activeFlow.applicableZoneIds.length} Zones`}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* ALL CONFIGURED TOPOLOGIES LIST */}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              All Topologies & Distribution Routes
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Select a flow to view diagram above or click edit to modify stages.
            </span>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
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
              placeholder="Search flows by name or code..."
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

        {/* Topologies Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 16px' }}>Flow Name & Code</th>
                <th style={{ padding: '12px 16px' }}>Echelon Stages</th>
                <th style={{ padding: '12px 16px' }}>Product Scope</th>
                <th style={{ padding: '12px 16px' }}>Territory Scope</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlows.map((flow) => {
                const isSelected = flow.id === selectedFlowId;
                return (
                  <tr
                    key={flow.id}
                    onClick={() => setSelectedFlowId(flow.id)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#E2E8F0', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                          {flow.code}
                        </span>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{flow.name}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {flow.description}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Workflow size={14} color="#7C3AED" />
                        <span style={{ fontWeight: 600 }}>{flow.stages.length} Stages</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                        {flow.stages[0]?.channelName} → ... → {flow.stages[flow.stages.length - 1]?.channelName}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                        {flow.productScope.scopeType === 'All'
                          ? 'All Catalog'
                          : `${flow.productScope.scopeType} Specific`}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        {flow.applicableTerritoryIds.length === 0
                          ? 'Global Fallback'
                          : `${flow.applicableTerritoryIds.length} Territories`}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={flow.status} />
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(flow)}
                          style={{
                            padding: '6px',
                            background: 'none',
                            border: 'none',
                            color: '#64748B',
                            cursor: 'pointer',
                            borderRadius: '4px'
                          }}
                          title="Edit Topology"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ isOpen: true, flowId: flow.id, flowName: flow.name })}
                          style={{
                            padding: '6px',
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            borderRadius: '4px'
                          }}
                          title="Delete Topology"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* CREATE / EDIT DRAWER WITH VISUAL STAGE BUILDER */}
      {/* -------------------------------------------------------------------- */}
      <SideDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingFlow ? `Edit Topology: ${editingFlow.name}` : 'Create New Sales Flow Topology'}
        subtitle="Configure fulfillment stages, zone-filtered territories, and product catalog scope"
        size="xl"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Basic Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Flow Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${formErrors.code ? '#EF4444' : '#CBD5E1'}`,
                  fontSize: '13px'
                }}
              />
              {formErrors.code && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '3px' }}>{formErrors.code}</div>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Flow Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Consignment Surgical Hub & Spoke"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${formErrors.name ? '#EF4444' : '#CBD5E1'}`,
                  fontSize: '13px'
                }}
              />
              {formErrors.name && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '3px' }}>{formErrors.name}</div>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Lifecycle Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as ActiveStatus }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe logistics pathway, inventory custody transfer, and tier restrictions..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* INTERACTIVE STAGES BUILDER */}
          {/* ------------------------------------------------------------------ */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  Fulfillment Stages Configuration ({formData.stages.length} Echelons)
                </h4>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Add, remove, and reorder stages. Each stage maps custody from Source to Destination via a Sales Channel.
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddStage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} />
                <span>Add Stage</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {formData.stages.map((stage, idx) => (
                <div
                  key={stage.id || stage.stageNumber}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#EDE9FE',
                          color: '#7C3AED',
                          padding: '2px 8px',
                          borderRadius: '9999px'
                        }}
                      >
                        STAGE {stage.stageNumber}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        {stage.channelName} ({stage.stageRole})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, 'left')}
                        disabled={idx === 0}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: idx === 0 ? '#CBD5E1' : '#64748B',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer'
                        }}
                        title="Move Earlier"
                      >
                        <MoveLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, 'right')}
                        disabled={idx === formData.stages.length - 1}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: idx === formData.stages.length - 1 ? '#CBD5E1' : '#64748B',
                          cursor: idx === formData.stages.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                        title="Move Later"
                      >
                        <MoveRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(idx)}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer'
                        }}
                        title="Remove Stage"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {/* Channel */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#64748B', marginBottom: '2px' }}>
                        Sales Channel
                      </label>
                      <select
                        value={stage.channelId}
                        onChange={(e) => handleStageFieldChange(idx, 'channelId', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px'
                        }}
                      >
                        {salesChannels.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.name} ({ch.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Stage Role */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#64748B', marginBottom: '2px' }}>
                        Echelon Role
                      </label>
                      <select
                        value={stage.stageRole}
                        onChange={(e) => handleStageFieldChange(idx, 'stageRole', e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px'
                        }}
                      >
                        {COMMON_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Inventory Ownership */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#64748B', marginBottom: '2px' }}>
                        Inventory Ownership
                      </label>
                      <select
                        value={stage.inventoryOwnership}
                        onChange={(e) => handleStageFieldChange(idx, 'inventoryOwnership', e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px'
                        }}
                      >
                        <option value="Company Owned">Company Owned</option>
                        <option value="Consignment">Consignment</option>
                        <option value="Title Transfer">Title Transfer</option>
                        <option value="Customer Owned">Customer Owned</option>
                      </select>
                    </div>

                    {/* Pricing Basis */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#64748B', marginBottom: '2px' }}>
                        Pricing Basis
                      </label>
                      <select
                        value={stage.pricingBasis}
                        onChange={(e) => handleStageFieldChange(idx, 'pricingBasis', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px'
                        }}
                      >
                        {PRICING_BASIS_OPTIONS.map((basis) => (
                          <option key={basis} value={basis}>
                            {basis}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* PRODUCT SCOPE INTEGRATION */}
          {/* ------------------------------------------------------------------ */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#FFFFFF' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              Product Master Scope Integration
            </h4>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['All', 'Portfolio', 'Category', 'Subcategory', 'Product'] as const).map((type) => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="productScopeType"
                    checked={formData.productScope.scopeType === type}
                    onChange={() =>
                      setFormData((p) => ({
                        ...p,
                        productScope: {
                          scopeType: type,
                          portfolioIds: [],
                          categoryIds: [],
                          subcategoryIds: [],
                          productIds: []
                        }
                      }))
                    }
                  />
                  <span>{type === 'All' ? 'All Products' : `By ${type}`}</span>
                </label>
              ))}
            </div>

            {/* Scope Specific Picker */}
            {formData.productScope.scopeType === 'Portfolio' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {initialPortfolios.map((portfolio) => {
                  const isChecked = formData.productScope.portfolioIds?.includes(portfolio.id);
                  return (
                    <label
                      key={portfolio.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: isChecked ? '1px solid #7C3AED' : '1px solid #CBD5E1',
                        backgroundColor: isChecked ? '#F5F3FF' : '#FFFFFF',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentIds = formData.productScope.portfolioIds || [];
                          const updated = e.target.checked
                            ? [...currentIds, portfolio.id]
                            : currentIds.filter((id) => id !== portfolio.id);
                          setFormData((p) => ({
                            ...p,
                            productScope: { ...p.productScope, portfolioIds: updated }
                          }));
                        }}
                      />
                      <span>{portfolio.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {formData.productScope.scopeType === 'Product' && (
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px' }}>
                {initialProducts.map((prod) => {
                  const isChecked = formData.productScope.productIds?.includes(prod.id);
                  return (
                    <label key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', fontSize: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentIds = formData.productScope.productIds || [];
                          const updated = e.target.checked
                            ? [...currentIds, prod.id]
                            : currentIds.filter((id) => id !== prod.id);
                          setFormData((p) => ({
                            ...p,
                            productScope: { ...p.productScope, productIds: updated }
                          }));
                        }}
                      />
                      <span>{prod.name} ({prod.code})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* ZONE-BASED TERRITORY SELECTION */}
          {/* ------------------------------------------------------------------ */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Zone-Based Territory Discovery & Quick Assignment
              </label>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Select a commercial zone below to preview and assign all territories governed by that zone.
              </span>
            </div>

            {/* Zone Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedZoneIdForFilter('')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedZoneIdForFilter === '' ? '1.5px solid #7C3AED' : '1px solid #CBD5E1',
                  backgroundColor: selectedZoneIdForFilter === '' ? '#EDE9FE' : '#FFFFFF',
                  color: selectedZoneIdForFilter === '' ? '#7C3AED' : '#475569'
                }}
              >
                All Zones (No Filter)
              </button>
              {zones.map((zone) => {
                const isSelectedZone = selectedZoneIdForFilter === zone.id;
                const zoneTerritoryCount = zone.territoryIds.length;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setSelectedZoneIdForFilter(zone.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelectedZone ? '1.5px solid #7C3AED' : '1px solid #CBD5E1',
                      backgroundColor: isSelectedZone ? '#EDE9FE' : '#FFFFFF',
                      color: isSelectedZone ? '#7C3AED' : '#475569'
                    }}
                  >
                    <span>{zone.name}</span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        backgroundColor: isSelectedZone ? '#7C3AED' : '#F1F5F9',
                        color: isSelectedZone ? '#FFFFFF' : '#64748B',
                        padding: '1px 6px',
                        borderRadius: '9999px'
                      }}
                    >
                      {zoneTerritoryCount} territories
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Available Territories in Selected Zone */}
            {selectedZoneObj && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '12px 14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                    Available Territories in <strong>{selectedZoneObj.name}</strong> ({availableZoneTerritories.length} Territories)
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllZoneTerritories}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid #7C3AED',
                        backgroundColor: '#F5F3FF',
                        color: '#7C3AED',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Select All in {selectedZoneObj.name}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllZoneTerritories}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#64748B',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Deselect All in Zone
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {availableZoneTerritories.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>No territories mapped to this zone yet.</div>
                  ) : (
                    availableZoneTerritories.map((t) => {
                      const isAssigned = formData.applicableTerritoryIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleToggleZoneTerritory(t.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            border: isAssigned ? '1.5px solid #10B981' : '1px solid #CBD5E1',
                            backgroundColor: isAssigned ? '#ECFDF5' : '#F8FAFC',
                            color: isAssigned ? '#065F46' : '#334155',
                            fontWeight: isAssigned ? 700 : 500
                          }}
                        >
                          <span>{t.name}</span>
                          <span style={{ fontSize: '10px', color: isAssigned ? '#059669' : '#94A3B8' }}>({t.code})</span>
                          {isAssigned && <Check size={12} color="#10B981" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Territory Multi-Select */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Territory Assignment (Leave empty for All Territories)
            </label>
            <HierarchicalTreeSelect
              territories={territories}
              selectedIds={formData.applicableTerritoryIds}
              onChange={(ids) => setFormData((p) => ({ ...p, applicableTerritoryIds: ids }))}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveFlow}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#7C3AED',
                fontSize: '13px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              Save Topology
            </button>
          </div>
        </div>
      </SideDrawer>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Sales Flow Topology"
        message={`Are you sure you want to delete "${deleteConfirm.flowName}"? Active partners assigned to this flow will revert to the default topology.`}
        confirmLabel="Delete Flow"
        variant="danger"
        onConfirm={() => {
          deleteSalesFlow(deleteConfirm.flowId);
          setDeleteConfirm({ isOpen: false, flowId: '', flowName: '' });
          if (selectedFlowId === deleteConfirm.flowId) {
            setSelectedFlowId(salesFlows[0]?.id || null);
          }
        }}
        onClose={() => setDeleteConfirm({ isOpen: false, flowId: '', flowName: '' })}
      />
    </div>
  );
};
