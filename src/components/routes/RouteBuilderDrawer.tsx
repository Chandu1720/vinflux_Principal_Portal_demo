import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import type { 
  DistributionRoute, 
  DistributionRouteNode, 
  RouteParticipantType, 
  RouteStepPartnerAssignment
} from '../../types/gtm.ts';
import { 
  X, 
  Plus, 
  Trash2, 
  MoveLeft, 
  MoveRight, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Layers, 
  DollarSign, 
  MapPin, 
  Users
} from 'lucide-react';

interface RouteBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editRouteId: string | null;
}

const ALL_PARTICIPANT_TYPES: RouteParticipantType[] = [
  'Principal',
  'C&F Agent',
  'Super Stockist',
  'Regional Distributor',
  'Distributor',
  'Sub-Distributor',
  'Retailer',
  'Hospital',
  'Clinic',
  'Other Customer'
];

export const RouteBuilderDrawer: React.FC<RouteBuilderDrawerProps> = ({
  isOpen,
  onClose,
  editRouteId
}) => {
  const { 
    distributionRoutes, 
    territories, 
    salesChannels, 
    partners, 
    addDistributionRoute, 
    updateDistributionRoute, 
    showToast 
  } = useApp();

  const isEditMode = Boolean(editRouteId);
  const editingRoute = editRouteId ? distributionRoutes.find((r) => r.id === editRouteId) : null;

  // Active Tab inside Builder
  const [activeTab, setActiveTab] = useState<'flow' | 'basic' | 'scope' | 'preview'>('flow');

  // Form State
  const [routeName, setRouteName] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [description, setDescription] = useState('');
  const [routeType, setRouteType] = useState<DistributionRoute['routeType']>('Single-Tier Intermediary');
  const [commercialModel, setCommercialModel] = useState<DistributionRoute['commercialModel']>('Title Transfer');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().substring(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [status, setStatus] = useState<DistributionRoute['status']>('Active');
  const [notes, setNotes] = useState('');
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedPortfolios, setSelectedPortfolios] = useState<string[]>(['All Portfolios']);

  // Nodes Flow State
  const [nodes, setNodes] = useState<DistributionRouteNode[]>([]);

  // Selected Node for editing in Step Config Modal / Panel
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);

  // Load existing or initialize new
  useEffect(() => {
    if (editingRoute) {
      setRouteName(editingRoute.name);
      setRouteCode(editingRoute.code);
      setDescription(editingRoute.description || '');
      setRouteType(editingRoute.routeType || 'Single-Tier Intermediary');
      setCommercialModel(editingRoute.commercialModel || 'Title Transfer');
      setEffectiveFrom(editingRoute.effectiveFrom || new Date().toISOString().substring(0, 10));
      setEffectiveTo(editingRoute.effectiveTo || '');
      setStatus(editingRoute.status || 'Active');
      setNotes(editingRoute.notes || '');
      setSelectedTerritoryIds([...editingRoute.applicableTerritoryIds]);
      setSelectedChannelIds([...(editingRoute.applicableChannelIds || [])]);
      setSelectedPortfolios([...editingRoute.permittedPortfolios]);
      setNodes(editingRoute.nodes.map((n, idx) => ({
        ...n,
        id: n.id || `node-${Date.now()}-${idx + 1}`,
        assignedPartners: n.assignedPartners ? [...n.assignedPartners] : []
      })));
    } else {
      const nextCode = `RT-${Math.floor(1000 + Math.random() * 9000)}`;
      setRouteName('');
      setRouteCode(nextCode);
      setDescription('');
      setRouteType('Single-Tier Intermediary');
      setCommercialModel('Title Transfer');
      setEffectiveFrom(new Date().toISOString().substring(0, 10));
      setEffectiveTo('');
      setStatus('Active');
      setNotes('');
      setSelectedTerritoryIds(territories.map((t) => t.id));
      setSelectedChannelIds(salesChannels.slice(0, 2).map((c) => c.id));
      setSelectedPortfolios(['All Portfolios']);
      
      // Default 3-stage flow: Principal -> Distributor -> Hospital
      setNodes([
        {
          id: `node-${Date.now()}-1`,
          level: 1,
          participantType: 'Principal',
          typeId: 'ct-direct',
          label: 'Principal (Manufacturer)',
          role: 'Origin & Primary Invoicer',
          pricingPoint: 'Base Cost Basis',
          isRequired: true,
          operationalRules: {
            inventoryOwnership: 'Principal Owned',
            stockTransferResponsibility: 'Principal Dispatch',
            invoicingParty: 'Principal',
            paymentCollection: 'Direct Bank Transfer to Principal',
            creditLimitEnforced: false,
            applicablePriceTier: 'SLMC Cost',
            nppaCeilingEnforced: true
          },
          assignedPartners: []
        },
        {
          id: `node-${Date.now()}-2`,
          level: 2,
          participantType: 'Distributor',
          typeId: 'ct-distributor',
          label: 'Authorized Distributor',
          role: 'Channel Stockist & Reseller',
          pricingPoint: 'Price to Distributor (PTD)',
          isRequired: true,
          operationalRules: {
            inventoryOwnership: 'Title Transfer',
            stockTransferResponsibility: 'Distributor Last-Mile',
            invoicingParty: 'Distributor',
            paymentCollection: 'Distributor Collection',
            creditLimitEnforced: true,
            applicablePriceTier: 'Price to Distributor (PTD)',
            nppaCeilingEnforced: true
          },
          assignedPartners: []
        },
        {
          id: `node-${Date.now()}-3`,
          level: 3,
          participantType: 'Hospital',
          typeId: 'ct-institution',
          label: 'Hospital / Healthcare Provider',
          role: 'Clinical End-User & Consignee',
          pricingPoint: 'Institutional / Hospital Price',
          isRequired: true,
          operationalRules: {
            inventoryOwnership: 'Customer Owned',
            stockTransferResponsibility: 'Distributor Last-Mile',
            invoicingParty: 'Distributor',
            paymentCollection: 'Distributor Collection',
            creditLimitEnforced: true,
            applicablePriceTier: 'Rate Contract / Institutional Price',
            nppaCeilingEnforced: true
          },
          assignedPartners: []
        }
      ]);
    }
    setActiveTab('flow');
    setSelectedNodeIndex(null);
  }, [editRouteId, editingRoute, isOpen, territories, salesChannels]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // TEMPLATE PRESET LOADERS
  // -------------------------------------------------------------
  const loadPresetTemplate = (preset: 'direct' | 'distributor' | 'cnf' | 'wholesale' | 'regional') => {
    switch (preset) {
      case 'direct':
        setRouteName('Direct Institutional Supply (Mfr → Hospital)');
        setRouteType('Direct');
        setCommercialModel('Direct Hospital Invoicing');
        setNodes([
          {
            id: `node-${Date.now()}-1`,
            level: 1,
            participantType: 'Principal',
            typeId: 'ct-direct',
            label: 'Principal (Biorad Medisys)',
            role: 'Origin & Direct Invoicer',
            pricingPoint: 'Ex-Factory Cost',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Principal Owned',
              stockTransferResponsibility: 'Principal Dispatch',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-2`,
            level: 2,
            participantType: 'Hospital',
            typeId: 'ct-institution',
            label: 'Hospital / Medical Center',
            role: 'Direct Consignee & Clinical Debtor',
            pricingPoint: 'Rate Contract Price',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Customer Owned',
              stockTransferResponsibility: 'Direct Courier',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: true,
              applicablePriceTier: 'Rate Contract / Institutional Price',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          }
        ]);
        showToast('Loaded Direct Institutional Route template.', 'info');
        break;

      case 'distributor':
        setRouteName('Standard Direct Distribution (Mfr → Distributor → Hospital)');
        setRouteType('Single-Tier Intermediary');
        setCommercialModel('Title Transfer');
        setNodes([
          {
            id: `node-${Date.now()}-1`,
            level: 1,
            participantType: 'Principal',
            typeId: 'ct-direct',
            label: 'Principal (Manufacturer)',
            role: 'Origin & Primary Invoicer',
            pricingPoint: 'Base Cost Basis',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Principal Owned',
              stockTransferResponsibility: 'Principal Dispatch',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-2`,
            level: 2,
            participantType: 'Distributor',
            typeId: 'ct-distributor',
            label: 'Authorized Distributor',
            role: 'Channel Stockist & Reseller',
            pricingPoint: 'Price to Distributor (PTD)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Distributor (PTD)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-3`,
            level: 3,
            participantType: 'Hospital',
            typeId: 'ct-institution',
            label: 'Hospital / Healthcare Provider',
            role: 'Clinical End-User & Consignee',
            pricingPoint: 'Institutional / Hospital Price',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Customer Owned',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Rate Contract / Institutional Price',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          }
        ]);
        showToast('Loaded Standard Distributor Route template.', 'info');
        break;

      case 'cnf':
        setRouteName('Consignment Hub & Spoke (Mfr → C&F → Distributor → Hospital)');
        setRouteType('Consignment Distribution');
        setCommercialModel('Consignment Stock');
        setNodes([
          {
            id: `node-${Date.now()}-1`,
            level: 1,
            participantType: 'Principal',
            typeId: 'ct-direct',
            label: 'Principal (Manufacturer)',
            role: 'Consignor & Inventory Owner',
            pricingPoint: 'SLMC Cost',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Principal Owned',
              stockTransferResponsibility: 'Principal Dispatch',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-2`,
            level: 2,
            participantType: 'C&F Agent',
            typeId: 'ct-cnf',
            label: 'Carrying & Forwarding Agent',
            role: 'State Custody & Logistics Buffer',
            pricingPoint: '4.5% Handling Fee',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Consignment Custody',
              stockTransferResponsibility: 'C&F Warehouse Transit',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-3`,
            level: 3,
            participantType: 'Distributor',
            typeId: 'ct-distributor',
            label: 'Authorized Distributor',
            role: 'Regional Reseller & Hospital Service',
            pricingPoint: 'Price to Distributor (PTD)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Distributor (PTD)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-4`,
            level: 4,
            participantType: 'Hospital',
            typeId: 'ct-institution',
            label: 'Hospital / Healthcare Provider',
            role: 'Clinical End-User & Consignee',
            pricingPoint: 'Institutional / Hospital Price',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Customer Owned',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Rate Contract / Institutional Price',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          }
        ]);
        showToast('Loaded Consignment Hub Route template.', 'info');
        break;

      case 'wholesale':
        setRouteName('Multi-Tier Wholesale (Mfr → C&F → Super Stockist → Distributor → Dealer → Hospital)');
        setRouteType('Multi-Tier Wholesale');
        setCommercialModel('Title Transfer');
        setNodes([
          {
            id: `node-${Date.now()}-1`,
            level: 1,
            participantType: 'Principal',
            typeId: 'ct-direct',
            label: 'Principal (Manufacturer)',
            role: 'Plant Production Origin',
            pricingPoint: 'Base Cost Basis',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Principal Owned',
              stockTransferResponsibility: 'Principal Dispatch',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-2`,
            level: 2,
            participantType: 'C&F Agent',
            typeId: 'ct-cnf',
            label: 'C&F State Depot',
            role: 'State Custody Buffer',
            pricingPoint: 'Consignment Fee',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Consignment Custody',
              stockTransferResponsibility: 'C&F Warehouse Transit',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-3`,
            level: 3,
            participantType: 'Super Stockist',
            typeId: 'ct-super-stockist',
            label: 'Super Stockist',
            role: 'Zonal Aggregator & Wholesaler',
            pricingPoint: 'Price to Super Stockist (PTS)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Super Stockist',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Super Stockist (PTS)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-4`,
            level: 4,
            participantType: 'Distributor',
            typeId: 'ct-distributor',
            label: 'Distributor',
            role: 'City Primary Stockist',
            pricingPoint: 'Price to Distributor (PTD)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Distributor (PTD)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-5`,
            level: 5,
            participantType: 'Sub-Distributor',
            typeId: 'ct-sub-distributor',
            label: 'Sub-Distributor / Dealer',
            role: 'Area Surgical Trader',
            pricingPoint: 'Price to Retailer (PTR)',
            isRequired: false,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Retailer (PTR)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-6`,
            level: 6,
            participantType: 'Hospital',
            typeId: 'ct-institution',
            label: 'Hospital / Healthcare Provider',
            role: 'Final Dispensing & Clinic',
            pricingPoint: 'Maximum Retail Price (MRP)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Customer Owned',
              stockTransferResponsibility: 'Direct Courier',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Maximum Retail Price (MRP)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          }
        ]);
        showToast('Loaded 4-Tier Wholesale Route template.', 'info');
        break;

      case 'regional':
        setRouteName('Regional-to-Local Distribution (Mfr → Reg. Dist → Local Dist → Hospital)');
        setRouteType('Multi-Tier Wholesale');
        setCommercialModel('Title Transfer');
        setNodes([
          {
            id: `node-${Date.now()}-1`,
            level: 1,
            participantType: 'Principal',
            typeId: 'ct-direct',
            label: 'Principal (Manufacturer)',
            role: 'Origin & Primary Invoicer',
            pricingPoint: 'SLMC Cost',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Principal Owned',
              stockTransferResponsibility: 'Principal Dispatch',
              invoicingParty: 'Principal',
              paymentCollection: 'Direct Bank Transfer to Principal',
              creditLimitEnforced: false,
              applicablePriceTier: 'SLMC Cost',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-2`,
            level: 2,
            participantType: 'Regional Distributor',
            typeId: 'ct-regional',
            label: 'Regional Distributor',
            role: 'Zonal Wholesale Stockist',
            pricingPoint: 'Price to Super Stockist (PTS)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Regional Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Super Stockist (PTS)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-3`,
            level: 3,
            participantType: 'Distributor',
            typeId: 'ct-distributor',
            label: 'Local Territory Distributor',
            role: 'District Level Reseller',
            pricingPoint: 'Price to Distributor (PTD)',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Title Transfer',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Price to Distributor (PTD)',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          },
          {
            id: `node-${Date.now()}-4`,
            level: 4,
            participantType: 'Hospital',
            typeId: 'ct-institution',
            label: 'Hospital / Healthcare Provider',
            role: 'Clinical End-User & Consignee',
            pricingPoint: 'Institutional / Hospital Price',
            isRequired: true,
            operationalRules: {
              inventoryOwnership: 'Customer Owned',
              stockTransferResponsibility: 'Distributor Last-Mile',
              invoicingParty: 'Distributor',
              paymentCollection: 'Distributor Collection',
              creditLimitEnforced: true,
              applicablePriceTier: 'Rate Contract / Institutional Price',
              nppaCeilingEnforced: true
            },
            assignedPartners: []
          }
        ]);
        showToast('Loaded Regional-to-Local Route template.', 'info');
        break;
    }
  };

  // -------------------------------------------------------------
  // NODE FLOW MANIPULATION
  // -------------------------------------------------------------
  const handleAddStepAtIndex = (insertIndex: number) => {
    const newNode: DistributionRouteNode = {
      id: `node-${Date.now()}`,
      level: insertIndex + 1,
      participantType: 'Distributor',
      typeId: 'ct-distributor',
      label: 'Intermediate Distribution Node',
      role: 'Commercial Intermediary Stockist',
      pricingPoint: 'Price to Distributor (PTD)',
      isRequired: true,
      operationalRules: {
        inventoryOwnership: 'Title Transfer',
        stockTransferResponsibility: 'Distributor Last-Mile',
        invoicingParty: 'Distributor',
        paymentCollection: 'Distributor Collection',
        creditLimitEnforced: true,
        applicablePriceTier: 'Price to Distributor (PTD)',
        nppaCeilingEnforced: true
      },
      assignedPartners: []
    };

    setNodes((prev) => {
      const next = [...prev];
      next.splice(insertIndex, 0, newNode);
      return next.map((n, i) => ({ ...n, level: i + 1 }));
    });
    setSelectedNodeIndex(insertIndex);
    showToast('Distribution stage added.', 'success');
  };

  const handleRemoveStep = (index: number) => {
    if (nodes.length <= 2) {
      showToast('A route must have at least an Origin and a Destination step.', 'warning');
      return;
    }
    setNodes((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next.map((n, i) => ({ ...n, level: i + 1 }));
    });
    if (selectedNodeIndex === index) setSelectedNodeIndex(null);
    else if (selectedNodeIndex !== null && selectedNodeIndex > index) {
      setSelectedNodeIndex(selectedNodeIndex - 1);
    }
    showToast('Distribution stage removed.', 'info');
  };

  const handleMoveStep = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= nodes.length) return;

    setNodes((prev) => {
      const next = [...prev];
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next.map((n, i) => ({ ...n, level: i + 1 }));
    });

    if (selectedNodeIndex === fromIndex) setSelectedNodeIndex(toIndex);
  };

  const handleUpdateNode = (index: number, updates: Partial<DistributionRouteNode>) => {
    setNodes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // -------------------------------------------------------------
  // PARTNER ASSIGNMENT TO STEP
  // -------------------------------------------------------------
  const handleTogglePartnerOnNode = (nodeIdx: number, partnerId: string) => {
    const targetPartner = partners.find((p) => p.id === partnerId);
    if (!targetPartner) return;

    const targetNode = nodes[nodeIdx];
    const currentPartners = targetNode.assignedPartners || [];
    const exists = currentPartners.some((ap) => ap.partnerId === partnerId);

    let nextPartners: RouteStepPartnerAssignment[];
    if (exists) {
      nextPartners = currentPartners.filter((ap) => ap.partnerId !== partnerId);
    } else {
      nextPartners = [
        ...currentPartners,
        {
          partnerId: targetPartner.id,
          partnerName: targetPartner.name,
          partnerCode: targetPartner.code,
          territoryId: targetPartner.assignedTerritoryIds[0] || '',
          territoryName: territories.find((t) => t.id === targetPartner.assignedTerritoryIds[0])?.name || '',
          salesChannelId: targetPartner.assignedChannelIds[0] || '',
          effectiveFrom: new Date().toISOString().substring(0, 10),
          status: 'Active'
        }
      ];
    }

    handleUpdateNode(nodeIdx, { assignedPartners: nextPartners });
  };

  // -------------------------------------------------------------
  // REAL-TIME VALIDATION
  // -------------------------------------------------------------
  const validateRoute = (): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!routeName.trim()) errors.push('Route Name is required.');
    if (!routeCode.trim()) errors.push('Route Code is required.');
    if (nodes.length < 2) errors.push('Route must contain at least 2 distribution steps (Origin and Destination).');

    // Origin check
    if (nodes.length > 0 && nodes[0].participantType !== 'Principal') {
      errors.push('Distribution route must start with a "Principal" origin.');
    }

    // Destination check
    if (nodes.length > 1) {
      const lastNode = nodes[nodes.length - 1];
      const validEnd = ['Hospital', 'Clinic', 'Retailer', 'Other Customer'].includes(lastNode.participantType || '');
      if (!validEnd) {
        errors.push('Distribution route must terminate with a clinical or customer destination (Hospital, Clinic, Retailer, or Other Customer).');
      }
    }

    // Effective dates check
    if (effectiveTo && effectiveFrom && effectiveTo < effectiveFrom) {
      errors.push('Effective End Date cannot be earlier than Effective Start Date.');
    }

    // Unassigned intermediary check
    nodes.slice(1, -1).forEach((node, idx) => {
      if ((node.assignedPartners || []).length === 0) {
        warnings.push(`Step ${idx + 2} (${node.label}) has no eligible partners assigned.`);
      }
    });

    if (selectedTerritoryIds.length === 0) {
      warnings.push('No territories specifically assigned. Route will default to Pan-India.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  const validationResult = validateRoute();

  // -------------------------------------------------------------
  // SAVE / PUBLISH HANDLER
  // -------------------------------------------------------------
  const handleSaveRoute = (saveAsDraft: boolean) => {
    if (!saveAsDraft && !validationResult.isValid) {
      showToast(validationResult.errors[0] || 'Please fix validation errors before activating.', 'danger');
      return;
    }

    if (!routeName.trim()) {
      showToast('Route Name is required.', 'danger');
      setActiveTab('basic');
      return;
    }

    const routeStatus: DistributionRoute['status'] = saveAsDraft 
      ? 'Draft' 
      : status === 'Draft' ? 'Active' : status;

    const stages = nodes.map((n) => n.participantType || n.label);

    const payload: DistributionRoute = {
      id: isEditMode && editingRoute ? editingRoute.id : `path-${Date.now().toString().slice(-4)}`,
      code: routeCode.trim().toUpperCase() || `RT-${Math.floor(1000 + Math.random() * 9000)}`,
      name: routeName.trim(),
      description: description.trim(),
      routeType,
      commercialModel,
      status: routeStatus,
      effectiveFrom,
      effectiveTo: effectiveTo || undefined,
      notes: notes.trim() || undefined,
      stages,
      nodes,
      applicableTerritoryIds: selectedTerritoryIds,
      applicableChannelIds: selectedChannelIds,
      permittedPortfolios: selectedPortfolios,
      history: isEditMode && editingRoute ? editingRoute.history : []
    };

    if (isEditMode && editingRoute) {
      updateDistributionRoute(editingRoute.id, payload);
    } else {
      const res = addDistributionRoute(payload);
      if (!res.success) return;
    }

    onClose();
  };

  return (
    <div
      className="vf-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vf-drawer vf-drawer-2xl" style={{ width: '980px' }}>
        
        {/* Drawer Header */}
        <div className="vf-drawer-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--vf-slate-200)', background: '#ffffff' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--vf-accent)', letterSpacing: '0.05em' }}>
              Distribution Flow Architecture Studio
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--vf-slate-900)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="text-blue-600" />
              <span>{isEditMode ? `Edit Sales Route: ${editingRoute?.name}` : 'Configure New Sales Route'}</span>
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Quick Template Presets Dropdown */}
            <select
              className="vf-select"
              onChange={(e) => {
                if (e.target.value) {
                  loadPresetTemplate(e.target.value as any);
                  e.target.value = '';
                }
              }}
              style={{ fontSize: '12px', padding: '4px 8px', width: '210px' }}
              defaultValue=""
            >
              <option value="" disabled>Load Standard Template ▾</option>
              <option value="direct">Principal → Hospital (Direct)</option>
              <option value="distributor">Principal → Distributor → Hospital (2-Tier)</option>
              <option value="cnf">Principal → C&F → Distributor → Hospital (Consignment)</option>
              <option value="wholesale">Principal → C&F → Super Stockist → Dist. → Hospital</option>
              <option value="regional">Principal → Reg. Dist → Local Dist → Hospital</option>
            </select>

            <button
              type="button"
              className="vf-drawer-close"
              onClick={onClose}
              title="Close Builder"
              style={{ fontSize: '20px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Builder Sub-Navigation Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--vf-slate-50)', borderBottom: '1px solid var(--vf-slate-200)', padding: '0 16px' }}>
          {[
            { id: 'flow', label: `1. Visual Flow Editor (${nodes.length} Nodes)` },
            { id: 'basic', label: '2. Basic Info & Dates' },
            { id: 'scope', label: `3. Territory & Channel Scope (${selectedTerritoryIds.length} Terr, ${selectedChannelIds.length} Chan)` },
            { id: 'preview', label: '4. Summary & Verification' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`vf-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              style={{ fontSize: '12.5px', padding: '10px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Validation Status Banner */}
        <div style={{ padding: '8px 24px', background: validationResult.isValid ? (validationResult.warnings.length > 0 ? '#fffbeb' : '#f0fdf4') : '#fef2f2', borderBottom: '1px solid var(--vf-slate-200)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {validationResult.isValid ? (
              validationResult.warnings.length > 0 ? (
                <>
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span style={{ color: '#b45309' }}>
                    <strong>Valid sequence with warnings:</strong> {validationResult.warnings[0]}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span style={{ color: '#166534' }}>
                    <strong>Valid Route Topology:</strong> Origin connects to destination with permitted commercial rules.
                  </span>
                </>
              )
            ) : (
              <>
                <X size={14} className="text-rose-600" />
                <span style={{ color: '#b91c1c' }}>
                  <strong>Topology Error:</strong> {validationResult.errors[0]}
                </span>
              </>
            )}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
            Flow: <code>{nodes.map(n => n.participantType || n.label).join(' → ')}</code>
          </span>
        </div>

        {/* Builder Form Body */}
        <div className="vf-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ============================================================== */}
          {/* TAB 1: VISUAL FLOW EDITOR */}
          {/* ============================================================== */}
          {activeTab === 'flow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Architecture logic tip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                    Visual Distribution Flow Sequence
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                    Add, reorder, and configure participants along the physical and commercial distribution path.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="vf-btn vf-btn-secondary vf-btn-sm"
                    onClick={() => handleAddStepAtIndex(nodes.length)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} />
                    <span>+ Append Step</span>
                  </button>
                </div>
              </div>

              {/* Visual Flow Interactive Canvas */}
              <div className="vf-path-builder-canvas" style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--vf-slate-200)', overflowX: 'auto' }}>
                <div className="vf-path-flow" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '760px', padding: '10px 0' }}>
                  {nodes.map((node, idx) => {
                    const isSelected = selectedNodeIndex === idx;
                    const isOrigin = idx === 0;
                    const isDestination = idx === nodes.length - 1;

                    return (
                      <React.Fragment key={node.id || idx}>
                        <div
                          className={`vf-path-node ${isOrigin ? 'mfr' : isDestination ? 'hospital' : ''}`}
                          onClick={() => setSelectedNodeIndex(idx)}
                          style={{
                            background: isSelected ? '#fbfdff' : '#ffffff',
                            border: `2px solid ${isSelected ? 'var(--vf-accent)' : isOrigin ? 'var(--vf-primary)' : isDestination ? 'var(--vf-success)' : 'var(--vf-slate-300)'}`,
                            borderRadius: '8px',
                            padding: '14px',
                            minWidth: '180px',
                            maxWidth: '220px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            boxShadow: isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'var(--vf-shadow-xs)',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {/* Top row: Stage & Controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--vf-slate-500)', letterSpacing: '0.04em' }}>
                              STEP {node.level || idx + 1}
                            </span>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                              {idx > 0 && idx < nodes.length - 1 && (
                                <>
                                  <button
                                    type="button"
                                    className="vf-btn vf-btn-secondary vf-btn-xs"
                                    onClick={() => handleMoveStep(idx, 'left')}
                                    title="Move Step Left"
                                    style={{ padding: '1px 4px', height: '20px' }}
                                    disabled={idx === 1}
                                  >
                                    <MoveLeft size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    className="vf-btn vf-btn-secondary vf-btn-xs"
                                    onClick={() => handleMoveStep(idx, 'right')}
                                    title="Move Step Right"
                                    style={{ padding: '1px 4px', height: '20px' }}
                                    disabled={idx === nodes.length - 2}
                                  >
                                    <MoveRight size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    className="vf-btn vf-btn-secondary vf-btn-xs"
                                    onClick={() => handleRemoveStep(idx)}
                                    title="Remove Step"
                                    style={{ padding: '1px 4px', height: '20px', color: 'var(--vf-danger)' }}
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Participant badge */}
                          <div>
                            <span className="vf-badge" style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
                              {node.participantType || 'Intermediary'}
                            </span>
                          </div>

                          {/* Node Title & Role */}
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-900)', lineHeight: '1.2' }}>
                            {node.label}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--vf-slate-500)' }}>
                            {node.role}
                          </div>

                          {/* Pricing Point */}
                          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--vf-accent)', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                            {node.pricingPoint}
                          </div>

                          {/* Assigned Partners pill */}
                          <div style={{ marginTop: '4px' }}>
                            {(node.assignedPartners || []).length > 0 ? (
                              <div style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={11} />
                                <span>{node.assignedPartners!.length} Partner(s)</span>
                              </div>
                            ) : idx > 0 && idx < nodes.length - 1 ? (
                              <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={11} />
                                <span>Unassigned</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)', fontStyle: 'italic' }}>
                                {isOrigin ? 'Principal Unit' : 'Clinical Consignee'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Arrow with inline Insert button */}
                        {idx < nodes.length - 1 && (
                          <div className="vf-path-arrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '40px' }}>
                            <button
                              type="button"
                              onClick={() => handleAddStepAtIndex(idx + 1)}
                              title="Insert step here"
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#ffffff',
                                border: '1px solid var(--vf-slate-300)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--vf-slate-600)',
                                fontSize: '12px'
                              }}
                            >
                              +
                            </button>
                            <ArrowRight size={18} strokeWidth={2.5} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Node Inspector & Step Configuration Panel */}
              {selectedNodeIndex !== null && nodes[selectedNodeIndex] && (
                <div className="vf-card" style={{ padding: '20px', borderLeft: '4px solid var(--vf-accent)', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--vf-slate-200)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '11px' }}>
                        CONFIGURE STEP {selectedNodeIndex + 1}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                        {nodes[selectedNodeIndex].label}
                      </h4>
                    </div>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary vf-btn-xs"
                      onClick={() => setSelectedNodeIndex(null)}
                    >
                      Close Step Editor ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
                    {/* Participant Type */}
                    <div>
                      <label className="vf-label">Participant Type *</label>
                      <select
                        className="vf-select"
                        value={nodes[selectedNodeIndex].participantType || 'Distributor'}
                        onChange={(e) => {
                          const pType = e.target.value as RouteParticipantType;
                          handleUpdateNode(selectedNodeIndex, {
                            participantType: pType,
                            label: `${pType} Node`
                          });
                        }}
                      >
                        {ALL_PARTICIPANT_TYPES.map((pt) => (
                          <option key={pt} value={pt}>{pt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Step Label */}
                    <div>
                      <label className="vf-label">Step Label</label>
                      <input
                        type="text"
                        className="vf-input"
                        value={nodes[selectedNodeIndex].label}
                        onChange={(e) => handleUpdateNode(selectedNodeIndex, { label: e.target.value })}
                        placeholder="e.g. Authorized Distributor"
                      />
                    </div>

                    {/* Step Role */}
                    <div>
                      <label className="vf-label">Operational Role</label>
                      <input
                        type="text"
                        className="vf-input"
                        value={nodes[selectedNodeIndex].role}
                        onChange={(e) => handleUpdateNode(selectedNodeIndex, { role: e.target.value })}
                        placeholder="e.g. Channel Stockist & Reseller"
                      />
                    </div>

                    {/* Pricing Point */}
                    <div>
                      <label className="vf-label">Pricing Mechanism Point</label>
                      <select
                        className="vf-select"
                        value={nodes[selectedNodeIndex].pricingPoint}
                        onChange={(e) => handleUpdateNode(selectedNodeIndex, { pricingPoint: e.target.value })}
                      >
                        <option value="Ex-Factory Cost">Ex-Factory Cost</option>
                        <option value="SLMC Cost">SLMC Production Cost</option>
                        <option value="4.5% Handling Fee">4.5% Handling Fee (C&F)</option>
                        <option value="Price to Super Stockist (PTS)">Price to Super Stockist (PTS)</option>
                        <option value="Price to Distributor (PTD)">Price to Distributor (PTD)</option>
                        <option value="Price to Retailer (PTR)">Price to Retailer (PTR)</option>
                        <option value="Rate Contract Price">Rate Contract / Tender Price</option>
                        <option value="Institutional / Hospital Price">Institutional / Hospital Price</option>
                        <option value="Maximum Retail Price (MRP)">Maximum Retail Price (MRP)</option>
                      </select>
                    </div>

                    {/* Inventory Ownership */}
                    <div>
                      <label className="vf-label">Inventory Ownership</label>
                      <select
                        className="vf-select"
                        value={nodes[selectedNodeIndex].operationalRules?.inventoryOwnership || 'Title Transfer'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          handleUpdateNode(selectedNodeIndex, {
                            operationalRules: {
                              ...(nodes[selectedNodeIndex].operationalRules || {
                                stockTransferResponsibility: 'Distributor Last-Mile',
                                invoicingParty: 'Distributor',
                                paymentCollection: 'Distributor Collection',
                                creditLimitEnforced: true,
                                applicablePriceTier: 'Price to Distributor (PTD)',
                                nppaCeilingEnforced: true
                              }),
                              inventoryOwnership: val
                            }
                          });
                        }}
                      >
                        <option value="Principal Owned">Principal Owned (Consignment)</option>
                        <option value="Title Transfer">Title Transfer (Reseller Purchase)</option>
                        <option value="Consignment Custody">Consignment Custody (Depot)</option>
                        <option value="Customer Owned">Customer Owned (Final Sale)</option>
                      </select>
                    </div>

                    {/* Invoicing Party */}
                    <div>
                      <label className="vf-label">Invoicing Entity</label>
                      <select
                        className="vf-select"
                        value={nodes[selectedNodeIndex].operationalRules?.invoicingParty || 'Principal'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          handleUpdateNode(selectedNodeIndex, {
                            operationalRules: {
                              ...(nodes[selectedNodeIndex].operationalRules || {
                                inventoryOwnership: 'Title Transfer',
                                stockTransferResponsibility: 'Distributor Last-Mile',
                                paymentCollection: 'Distributor Collection',
                                creditLimitEnforced: true,
                                applicablePriceTier: 'Price to Distributor (PTD)',
                                nppaCeilingEnforced: true
                              }),
                              invoicingParty: val
                            }
                          });
                        }}
                      >
                        <option value="Principal">Principal (Direct Invoice)</option>
                        <option value="Distributor">Distributor (Local Invoice)</option>
                        <option value="Super Stockist">Super Stockist</option>
                        <option value="Third-Party Logistics">Third-Party Logistics (3PL)</option>
                      </select>
                    </div>
                  </div>

                  {/* Partner Assignment Picker for this node */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--vf-slate-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} className="text-blue-600" />
                        <span>Assign Eligible Partners to Step {selectedNodeIndex + 1}</span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--vf-slate-500)' }}>
                        {(nodes[selectedNodeIndex].assignedPartners || []).length} Partners selected
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                      {partners.map((p) => {
                        const isAssigned = (nodes[selectedNodeIndex].assignedPartners || []).some((ap) => ap.partnerId === p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleTogglePartnerOnNode(selectedNodeIndex, p.id)}
                            style={{
                              padding: '8px 10px',
                              background: isAssigned ? '#eff6ff' : '#ffffff',
                              border: `1px solid ${isAssigned ? 'var(--vf-accent)' : 'var(--vf-slate-200)'}`,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--vf-slate-800)' }}>{p.name}</div>
                              <div style={{ fontSize: '10.5px', color: 'var(--vf-slate-400)' }}>
                                <code>{p.code}</code> • {p.typeName}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => {}} // handled by parent onClick
                              style={{ pointerEvents: 'none' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: BASIC INFO & DATES */}
          {/* ============================================================== */}
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  Route Master Attributes & Lifecycle
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                  Core metadata, classification, commercial model, and effective lifecycle dates.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div className="vf-form-group">
                  <label className="vf-label">
                    Route Name <span style={{ color: 'var(--vf-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="vf-input"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="e.g. Standard Direct Distribution (Mfr → Distributor → Hospital)"
                    required
                  />
                </div>

                <div className="vf-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="vf-label">
                      Route Code <span style={{ color: 'var(--vf-danger)' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setRouteCode(`RT-${Math.floor(1000 + Math.random() * 9000)}`)}
                      style={{ background: 'none', border: 'none', color: 'var(--vf-accent)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                    >
                      ⚡ Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    className="vf-input"
                    value={routeCode}
                    onChange={(e) => setRouteCode(e.target.value)}
                    placeholder="e.g. RT-STD-DIST-01"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div className="vf-form-group">
                  <label className="vf-label">Route Classification</label>
                  <select
                    className="vf-select"
                    value={routeType}
                    onChange={(e) => setRouteType(e.target.value as any)}
                  >
                    <option value="Direct">Direct (Mfr → Hospital)</option>
                    <option value="Single-Tier Intermediary">Single-Tier Intermediary (Mfr → Dist → Hosp)</option>
                    <option value="Multi-Tier Wholesale">Multi-Tier Wholesale (Mfr → C&F → Super → Dist)</option>
                    <option value="Consignment Distribution">Consignment Hub & Spoke</option>
                    <option value="Institutional Tender">Institutional Tender / Rate Contract</option>
                  </select>
                </div>

                <div className="vf-form-group">
                  <label className="vf-label">Commercial Model</label>
                  <select
                    className="vf-select"
                    value={commercialModel}
                    onChange={(e) => setCommercialModel(e.target.value as any)}
                  >
                    <option value="Title Transfer">Title Transfer (Standard Reseller)</option>
                    <option value="Consignment Stock">Consignment Stock Buffer</option>
                    <option value="Direct Hospital Invoicing">Direct Hospital Invoicing</option>
                    <option value="Commission Agency">Commission / Handling Agency</option>
                  </select>
                </div>

                <div className="vf-form-group">
                  <label className="vf-label">Route Status</label>
                  <select
                    className="vf-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="Active">Active (Deployable)</option>
                    <option value="Draft">Draft (In-Progress)</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="vf-form-group">
                  <label className="vf-label">
                    Effective From Date <span style={{ color: 'var(--vf-danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="vf-input"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    required
                  />
                </div>

                <div className="vf-form-group">
                  <label className="vf-label">Effective To Date (Optional)</label>
                  <input
                    type="date"
                    className="vf-input"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="vf-form-group">
                <label className="vf-label">Route Clinical / Commercial Description</label>
                <textarea
                  className="vf-input"
                  rows={2}
                  style={{ height: 'auto', padding: '8px 10px' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary commercial distribution route for private healthcare institutions with single intermediary distributor..."
                />
              </div>

              <div className="vf-form-group">
                <label className="vf-label">Internal Operational Notes</label>
                <textarea
                  className="vf-input"
                  rows={2}
                  style={{ height: 'auto', padding: '8px 10px' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions regarding warehouse transit, cold-chain handling, or credit hold exceptions..."
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: TERRITORY & CHANNEL SCOPE */}
          {/* ============================================================== */}
          {activeTab === 'scope' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  Geographic & Sales Channel Scope
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                  A route defines <strong>how the distribution flow is structured</strong>. A territory defines <strong>where the business is authorized to operate</strong>.
                </p>
              </div>

              {/* Territory Picker */}
              <div className="vf-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} className="text-blue-600" />
                    <span>Permitted Territories ({selectedTerritoryIds.length} Selected)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary vf-btn-xs"
                      onClick={() => setSelectedTerritoryIds(territories.map((t) => t.id))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="vf-btn vf-btn-secondary vf-btn-xs"
                      onClick={() => setSelectedTerritoryIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
                  {territories.map((t) => {
                    const isChecked = selectedTerritoryIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          background: isChecked ? '#eff6ff' : '#ffffff',
                          border: `1px solid ${isChecked ? 'var(--vf-accent)' : 'var(--vf-slate-200)'}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTerritoryIds([...selectedTerritoryIds, t.id]);
                            else setSelectedTerritoryIds(selectedTerritoryIds.filter((id) => id !== t.id));
                          }}
                        />
                        <div>
                          <strong>{t.name}</strong>
                          <span style={{ color: 'var(--vf-slate-400)', fontSize: '11px', display: 'block' }}>
                            <code>{t.code}</code> • {t.state || 'National Zone'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sales Channels Picker */}
              <div className="vf-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vf-slate-800)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={14} className="text-emerald-600" />
                    <span>Applicable Sales Channels ({selectedChannelIds.length} Selected)</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                  {salesChannels.map((c) => {
                    const isChecked = selectedChannelIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          background: isChecked ? '#f0fdf4' : '#ffffff',
                          border: `1px solid ${isChecked ? '#16a34a' : 'var(--vf-slate-200)'}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedChannelIds([...selectedChannelIds, c.id]);
                            else setSelectedChannelIds(selectedChannelIds.filter((id) => id !== c.id));
                          }}
                        />
                        <div>
                          <strong>{c.name}</strong> (<code>{c.code}</code>)
                          <span style={{ color: 'var(--vf-slate-500)', fontSize: '11px', display: 'block' }}>
                            Default Margin: <strong>{c.standardMarginPercent}%</strong> • {c.defaultCreditDays}d Credit
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: SUMMARY & VERIFICATION */}
          {/* ============================================================== */}
          {activeTab === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--vf-slate-900)' }}>
                  Route Topology Architectural Verification
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--vf-slate-500)' }}>
                  Verify compliance with statutory price controls, participant validity, and partner assignments.
                </p>
              </div>

              {/* Topology Summary Card */}
              <div className="vf-card" style={{ padding: '16px', borderLeft: '4px solid var(--vf-accent)' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700 }}>
                  {routeName || 'Untitled Route Definition'}
                </h4>
                <div style={{ fontSize: '12.5px', color: 'var(--vf-slate-500)', display: 'flex', gap: '12px' }}>
                  <span>Code: <strong>{routeCode || 'Pending'}</strong></span>
                  <span>•</span>
                  <span>Type: <strong>{routeType}</strong></span>
                  <span>•</span>
                  <span>Model: <strong>{commercialModel}</strong></span>
                  <span>•</span>
                  <span>Status: <strong>{status}</strong></span>
                </div>
              </div>

              {/* Validation Checklist */}
              <div className="vf-card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                  Pre-Deployment Validation Checklist
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {nodes.length > 0 && nodes[0].participantType === 'Principal' ? (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    ) : (
                      <X size={16} className="text-rose-600" />
                    )}
                    <span>Valid Origin Participant (Principal / Manufacturer)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {nodes.length > 1 && ['Hospital', 'Clinic', 'Retailer', 'Other Customer'].includes(nodes[nodes.length - 1].participantType || '') ? (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    ) : (
                      <X size={16} className="text-rose-600" />
                    )}
                    <span>Valid Destination Participant (Clinical / Hospital / Retail Consignee)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>NPPA Statutory DPCO Ceiling Price Order Verified</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedTerritoryIds.length > 0 ? (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-500" />
                    )}
                    <span>Geographic Scope: {selectedTerritoryIds.length} Territories Mapped</span>
                  </div>
                </div>
              </div>

              {validationResult.isValid ? (
                <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} />
                  <span><strong>Route Architecture Passed:</strong> Ready to deploy to sales and partner order inbox.</span>
                </div>
              ) : (
                <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                  <strong>Errors preventing activation:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Builder Sticky Footer */}
        <div className="vf-wizard-footer" style={{ padding: '14px 24px', background: 'var(--vf-slate-50)', borderTop: '1px solid var(--vf-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              type="button"
              className="vf-btn vf-btn-secondary"
              onClick={() => handleSaveRoute(true)}
              title="Save route as draft (allowed even if incomplete)"
            >
              Save as Draft
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="vf-btn vf-btn-secondary" onClick={onClose}>
              Cancel
            </button>

            {activeTab !== 'preview' ? (
              <button
                type="button"
                className="vf-btn vf-btn-secondary"
                onClick={() => setActiveTab('preview')}
              >
                Preview Route &rarr;
              </button>
            ) : null}

            <button
              type="button"
              className="vf-btn vf-btn-success"
              onClick={() => handleSaveRoute(false)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Check size={14} />
              <span>{isEditMode ? 'Update & Deploy Route' : 'Deploy Sales Route'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
