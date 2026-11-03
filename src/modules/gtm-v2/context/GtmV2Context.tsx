import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type {
  TerritoryNode,
  Zone,
  SalesChannel,
  SalesFlowTopology,
  PartnerOnboardingRecord,
  ApprovalRequest,
  GtmConfiguration,
  CommercialTermEntry,
  KycDocStatus
} from '../types/gtmV2.types';
import {
  initialTerritoriesV2,
  initialZonesV2,
  initialSalesChannelsV2,
  initialSalesFlowsV2,
  initialPartnersV2,
  initialApprovalsV2,
  initialGtmConfigV2
} from '../services/gtmV2InitialData';

// LocalStorage Keys
const STORAGE_KEYS = {
  TERRITORIES: 'vinflux_gtm_v2_territories',
  ZONES: 'vinflux_gtm_v2_zones',
  CHANNELS: 'vinflux_gtm_v2_channels',
  FLOWS: 'vinflux_gtm_v2_flows',
  PARTNERS: 'vinflux_gtm_v2_partners',
  APPROVALS: 'vinflux_gtm_v2_approvals',
  CONFIG: 'vinflux_gtm_v2_config'
};

interface GtmV2ContextType {
  // Master Entities
  territories: TerritoryNode[];
  zones: Zone[];
  salesChannels: SalesChannel[];
  salesFlows: SalesFlowTopology[];
  partners: PartnerOnboardingRecord[];
  approvals: ApprovalRequest[];
  config: GtmConfiguration;

  // Global UI
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;

  // Territory Methods
  addTerritory: (data: {
    code: string;
    name: string;
    description?: string;
    parentId: string | null;
    levelLabel?: string;
    leadPerson?: string;
    pinCodes?: string[];
  }) => { success: boolean; message: string; territory?: TerritoryNode };
  updateTerritory: (id: string, updates: Partial<TerritoryNode>) => { success: boolean; message: string };
  deleteTerritory: (id: string) => { success: boolean; message: string };
  toggleTerritoryStatus: (id: string) => void;
  getTerritoryHierarchyTree: () => TerritoryNode[];
  isDescendantOf: (candidateChildId: string, candidateParentId: string) => boolean;

  // Zone Methods
  addZone: (data: Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  deleteZone: (id: string) => void;
  toggleZoneStatus: (id: string) => void;

  // Sales Channel Methods
  addSalesChannel: (data: Omit<SalesChannel, 'id' | 'createdAt' | 'updatedAt' | 'configHistory'>) => void;
  updateSalesChannel: (id: string, updates: Partial<SalesChannel>, reason?: string) => void;
  deleteSalesChannel: (id: string) => void;
  toggleSalesChannelStatus: (id: string) => void;

  // Sales Flow Methods
  addSalesFlow: (data: Omit<SalesFlowTopology, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSalesFlow: (id: string, updates: Partial<SalesFlowTopology>) => void;
  deleteSalesFlow: (id: string) => void;
  toggleSalesFlowStatus: (id: string) => void;

  // Partner Onboarding Methods
  createPartnerOnboarding: (record: Omit<PartnerOnboardingRecord, 'id' | 'onboardedAt' | 'updatedAt'>) => void;
  updatePartnerOnboarding: (id: string, updates: Partial<PartnerOnboardingRecord>) => void;
  updatePartnerKycStatus: (partnerId: string, docId: string, status: KycDocStatus, notes?: string) => void;

  // Approval Methods
  approveRequest: (id: string, decisionNotes?: string) => void;
  rejectRequest: (id: string, decisionNotes?: string) => void;
  createApprovalRequest: (data: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>) => void;

  // Config Methods
  updateConfig: (updates: Partial<GtmConfiguration>) => void;
  resetToInitialData: () => void;

  // Computed Values
  resolvedCommercialTerms: CommercialTermEntry[];
  kpis: {
    totalTerritories: number;
    totalZones: number;
    totalChannels: number;
    totalFlows: number;
    activePartners: number;
    pendingApprovalsCount: number;
    kycUnderReviewCount: number;
  };
}

const GtmV2Context = createContext<GtmV2ContextType | undefined>(undefined);

export const GtmV2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Territories State
  const [territories, setTerritories] = useState<TerritoryNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TERRITORIES);
      return saved ? JSON.parse(saved) : initialTerritoriesV2;
    } catch {
      return initialTerritoriesV2;
    }
  });

  // 2. Zones State
  const [zones, setZones] = useState<Zone[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ZONES);
      return saved ? JSON.parse(saved) : initialZonesV2;
    } catch {
      return initialZonesV2;
    }
  });

  // 3. Sales Channels State
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHANNELS);
      return saved ? JSON.parse(saved) : initialSalesChannelsV2;
    } catch {
      return initialSalesChannelsV2;
    }
  });

  // 4. Sales Flows State
  const [salesFlows, setSalesFlows] = useState<SalesFlowTopology[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FLOWS);
      return saved ? JSON.parse(saved) : initialSalesFlowsV2;
    } catch {
      return initialSalesFlowsV2;
    }
  });

  // 5. Partners State
  const [partners, setPartners] = useState<PartnerOnboardingRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTNERS);
      return saved ? JSON.parse(saved) : initialPartnersV2;
    } catch {
      return initialPartnersV2;
    }
  });

  // 6. Approvals State
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPROVALS);
      return saved ? JSON.parse(saved) : initialApprovalsV2;
    } catch {
      return initialApprovalsV2;
    }
  });

  // 7. Config State
  const [config, setConfig] = useState<GtmConfiguration>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      return saved ? JSON.parse(saved) : initialGtmConfigV2;
    } catch {
      return initialGtmConfigV2;
    }
  });

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TERRITORIES, JSON.stringify(territories));
  }, [territories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(zones));
  }, [zones]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(salesChannels));
  }, [salesChannels]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FLOWS, JSON.stringify(salesFlows));
  }, [salesFlows]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(partners));
  }, [partners]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
  }, [approvals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  // ==========================================================================
  // TERRITORY METHODS (N-Level Tree, Circular Prevention, Dependency Checks)
  // ==========================================================================
  const isDescendantOf = (candidateChildId: string, candidateParentId: string): boolean => {
    let current = territories.find((t) => t.id === candidateChildId);
    while (current && current.parentId) {
      if (current.parentId === candidateParentId) return true;
      current = territories.find((t) => t.id === current?.parentId);
    }
    return false;
  };

  const addTerritory = (data: {
    code: string;
    name: string;
    description?: string;
    parentId: string | null;
    levelLabel?: string;
    leadPerson?: string;
    pinCodes?: string[];
  }) => {
    // 1. Duplicate code validation
    const codeExists = territories.some(
      (t) => t.code.trim().toUpperCase() === data.code.trim().toUpperCase()
    );
    if (codeExists) {
      return { success: false, message: `Territory code "${data.code}" already exists.` };
    }

    // 2. Compute dynamic level based on parent
    let level = 1;
    let parentName: string | undefined = undefined;
    if (data.parentId) {
      const parent = territories.find((t) => t.id === data.parentId);
      if (parent) {
        level = parent.level + 1;
        parentName = parent.name;
      }
    }

    const newTerritory: TerritoryNode = {
      id: `terr-${Date.now()}`,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description?.trim(),
      parentId: data.parentId,
      parentName,
      level,
      levelLabel: data.levelLabel?.trim() || `Level ${level}`,
      status: 'Active',
      leadPerson: data.leadPerson?.trim(),
      pinCodes: data.pinCodes || [],
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10)
    };

    setTerritories((prev) => [...prev, newTerritory]);
    return { success: true, message: `Territory "${newTerritory.name}" added successfully.`, territory: newTerritory };
  };

  const updateTerritory = (id: string, updates: Partial<TerritoryNode>) => {
    // Check duplicate code if code was updated
    if (updates.code) {
      const codeTaken = territories.some(
        (t) => t.id !== id && t.code.trim().toUpperCase() === updates.code!.trim().toUpperCase()
      );
      if (codeTaken) {
        return { success: false, message: `Territory code "${updates.code}" already exists.` };
      }
    }

    // Circular dependency check if parentId is being updated
    if (updates.parentId !== undefined && updates.parentId !== null) {
      if (updates.parentId === id) {
        return { success: false, message: 'A territory cannot be its own parent.' };
      }
      if (isDescendantOf(updates.parentId, id)) {
        return { success: false, message: 'Circular relationship: Cannot select a descendant territory as parent.' };
      }
    }

    setTerritories((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newParentId = updates.parentId !== undefined ? updates.parentId : t.parentId;
        let newLevel = t.level;
        let newParentName = t.parentName;
        if (newParentId !== t.parentId) {
          const p = territories.find((item) => item.id === newParentId);
          newLevel = p ? p.level + 1 : 1;
          newParentName = p ? p.name : undefined;
        }
        return {
          ...t,
          ...updates,
          parentId: newParentId,
          level: newLevel,
          parentName: newParentName,
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );

    return { success: true, message: 'Territory updated successfully.' };
  };

  const deleteTerritory = (id: string) => {
    // 1. Dependency check: Child territories
    const hasChildren = territories.some((t) => t.parentId === id);
    if (hasChildren) {
      return { success: false, message: 'Cannot delete: Child territories exist under this node. Reassign them first.' };
    }

    // 2. Dependency check: Assigned partners
    const assignedPartner = partners.find((p) => p.assignedTerritoryIds?.includes(id));
    if (assignedPartner) {
      return { success: false, message: `Cannot delete: Partner "${assignedPartner.name}" is assigned to this territory.` };
    }

    // 3. Dependency check: Linked sales flows
    const assignedFlow = salesFlows.find((f) => f.applicableTerritoryIds?.includes(id));
    if (assignedFlow) {
      return { success: false, message: `Cannot delete: Sales Flow "${assignedFlow.name}" is linked to this territory.` };
    }

    setTerritories((prev) => prev.filter((t) => t.id !== id));
    // Remove from zones as well
    setZones((prev) =>
      prev.map((z) => ({
        ...z,
        territoryIds: z.territoryIds.filter((tId) => tId !== id)
      }))
    );

    return { success: true, message: 'Territory deleted successfully.' };
  };

  const toggleTerritoryStatus = (id: string) => {
    setTerritories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'Active' ? 'Inactive' : 'Active' } : t))
    );
  };

  // Build recursive hierarchy tree
  const getTerritoryHierarchyTree = (): TerritoryNode[] => {
    const map = new Map<string, TerritoryNode & { children: TerritoryNode[] }>();
    territories.forEach((t) => {
      map.set(t.id, { ...t, children: [] });
    });

    const roots: TerritoryNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // ==========================================================================
  // ZONE METHODS
  // ==========================================================================
  const addZone = (data: Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newZone: Zone = {
      ...data,
      id: `zone-${Date.now()}`,
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10)
    };
    setZones((prev) => [...prev, newZone]);
  };

  const updateZone = (id: string, updates: Partial<Zone>) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : z))
    );
  };

  const deleteZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const toggleZoneStatus = (id: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, status: z.status === 'Active' ? 'Inactive' : 'Active' } : z))
    );
  };

  // ==========================================================================
  // SALES CHANNELS METHODS
  // ==========================================================================
  const addSalesChannel = (data: Omit<SalesChannel, 'id' | 'createdAt' | 'updatedAt' | 'configHistory'>) => {
    const newChannel: SalesChannel = {
      ...data,
      id: `chn-${Date.now()}`,
      configHistory: [
        {
          id: `cfg-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          modifiedBy: 'Commercial Administrator',
          changeSummary: 'Channel initialized with commercial baselines',
          discountPercent: data.standardDiscountPercent,
          creditPeriodDays: data.creditPeriodDays,
          creditLimit: data.creditLimit
        }
      ],
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10)
    };
    setSalesChannels((prev) => [...prev, newChannel]);
  };

  const updateSalesChannel = (id: string, updates: Partial<SalesChannel>, reason?: string) => {
    setSalesChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== id) return ch;
        const newHistory = [...ch.configHistory];
        if (
          updates.standardDiscountPercent !== undefined ||
          updates.creditPeriodDays !== undefined ||
          updates.creditLimit !== undefined
        ) {
          newHistory.unshift({
            id: `cfg-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            modifiedBy: 'Commercial Operations',
            changeSummary: reason || 'Commercial baseline updated',
            discountPercent: updates.standardDiscountPercent ?? ch.standardDiscountPercent,
            creditPeriodDays: updates.creditPeriodDays ?? ch.creditPeriodDays,
            creditLimit: updates.creditLimit ?? ch.creditLimit
          });
        }
        return {
          ...ch,
          ...updates,
          configHistory: newHistory,
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );
  };

  const deleteSalesChannel = (id: string) => {
    setSalesChannels((prev) => prev.filter((ch) => ch.id !== id));
  };

  const toggleSalesChannelStatus = (id: string) => {
    setSalesChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, status: ch.status === 'Active' ? 'Inactive' : 'Active' } : ch))
    );
  };

  // ==========================================================================
  // SALES FLOW TOPOLOGY METHODS
  // ==========================================================================
  const addSalesFlow = (data: Omit<SalesFlowTopology, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newFlow: SalesFlowTopology = {
      ...data,
      id: `flow-${Date.now()}`,
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10)
    };
    setSalesFlows((prev) => [...prev, newFlow]);
  };

  const updateSalesFlow = (id: string, updates: Partial<SalesFlowTopology>) => {
    setSalesFlows((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : f))
    );
  };

  const deleteSalesFlow = (id: string) => {
    setSalesFlows((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleSalesFlowStatus = (id: string) => {
    setSalesFlows((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: f.status === 'Active' ? 'Inactive' : 'Active' } : f))
    );
  };

  // ==========================================================================
  // PARTNER ONBOARDING METHODS
  // ==========================================================================
  const createPartnerOnboarding = (record: Omit<PartnerOnboardingRecord, 'id' | 'onboardedAt' | 'updatedAt'>) => {
    const newPartner: PartnerOnboardingRecord = {
      ...record,
      id: `part-${Date.now()}`,
      onboardedAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10)
    };

    // If partner has commercial overrides, generate approval request automatically
    if (record.commercialTerms.isDiscountOverridden || record.commercialTerms.isCreditDaysOverridden) {
      const newApproval: ApprovalRequest = {
        id: `appr-${Date.now()}`,
        requestType: record.commercialTerms.isDiscountOverridden ? 'Discount Override' : 'Credit Period Extension',
        partnerId: newPartner.id,
        partnerName: newPartner.name,
        partnerCode: newPartner.code,
        requestedBy: 'Onboarding Lead',
        requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'Pending',
        description: `Commercial deviation requested during onboarding of ${newPartner.name}.`,
        proposedValues: {
          discountPercent: record.commercialTerms.effectiveDiscount,
          creditPeriodDays: record.commercialTerms.effectiveCreditDays,
          creditLimit: record.commercialTerms.effectiveCreditLimit
        },
        previousValues: {
          discountPercent: record.commercialTerms.standardDiscount,
          creditPeriodDays: record.commercialTerms.standardCreditDays,
          creditLimit: record.commercialTerms.standardCreditLimit
        },
        justification: record.commercialTerms.overrideReason || 'Special territorial agreement requested.'
      };
      setApprovals((prev) => [newApproval, ...prev]);
    }

    setPartners((prev) => [newPartner, ...prev]);
  };

  const updatePartnerOnboarding = (id: string, updates: Partial<PartnerOnboardingRecord>) => {
    setPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : p))
    );
  };

  const updatePartnerKycStatus = (partnerId: string, docId: string, status: KycDocStatus, notes?: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const newDocs = p.kycDocuments.map((d) =>
          d.id === docId
            ? {
                ...d,
                status,
                verificationNotes: notes || d.verificationNotes,
                verifiedBy: status === 'Verified' ? 'Compliance Lead' : undefined,
                verifiedAt: status === 'Verified' ? new Date().toISOString().substring(0, 10) : undefined
              }
            : d
        );
        return { ...p, kycDocuments: newDocs, updatedAt: new Date().toISOString().substring(0, 10) };
      })
    );
  };

  // ==========================================================================
  // APPROVALS METHODS
  // ==========================================================================
  const approveRequest = (id: string, decisionNotes?: string) => {
    setApprovals((prev) =>
      prev.map((appr) => {
        if (appr.id !== id) return appr;
        return {
          ...appr,
          status: 'Approved',
          decisionBy: 'Commercial Director',
          decisionAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          decisionNotes: decisionNotes || 'Approved per commercial authority delegation matrix.'
        };
      })
    );

    // Apply approved values to partner
    const target = approvals.find((a) => a.id === id);
    if (target) {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== target.partnerId) return p;
          const comm = { ...p.commercialTerms };
          if (target.proposedValues.discountPercent !== undefined) {
            comm.effectiveDiscount = target.proposedValues.discountPercent;
            comm.approvalStatus = 'Approved';
            comm.approvedBy = 'Commercial Director';
            comm.approvedAt = new Date().toISOString().substring(0, 10);
          }
          if (target.proposedValues.creditPeriodDays !== undefined) {
            comm.effectiveCreditDays = target.proposedValues.creditPeriodDays;
          }
          if (target.proposedValues.creditLimit !== undefined) {
            comm.effectiveCreditLimit = target.proposedValues.creditLimit;
          }
          return {
            ...p,
            status: target.requestType === 'Partner Onboarding' ? 'Active' : p.status,
            commercialTerms: comm
          };
        })
      );
    }
  };

  const rejectRequest = (id: string, decisionNotes?: string) => {
    setApprovals((prev) =>
      prev.map((appr) => {
        if (appr.id !== id) return appr;
        return {
          ...appr,
          status: 'Rejected',
          decisionBy: 'Commercial Director',
          decisionAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          decisionNotes: decisionNotes || 'Rejected per risk management guidelines.'
        };
      })
    );

    const target = approvals.find((a) => a.id === id);
    if (target) {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== target.partnerId) return p;
          return {
            ...p,
            commercialTerms: {
              ...p.commercialTerms,
              approvalStatus: 'Rejected'
            }
          };
        })
      );
    }
  };

  const createApprovalRequest = (data: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>) => {
    const newApproval: ApprovalRequest = {
      ...data,
      id: `appr-${Date.now()}`,
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'Pending'
    };
    setApprovals((prev) => [newApproval, ...prev]);
  };

  // ==========================================================================
  // CONFIGURATION & RESET
  // ==========================================================================
  const updateConfig = (updates: Partial<GtmConfiguration>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const resetToInitialData = () => {
    setTerritories(initialTerritoriesV2);
    setZones(initialZonesV2);
    setSalesChannels(initialSalesChannelsV2);
    setSalesFlows(initialSalesFlowsV2);
    setPartners(initialPartnersV2);
    setApprovals(initialApprovalsV2);
    setConfig(initialGtmConfigV2);
    localStorage.removeItem(STORAGE_KEYS.TERRITORIES);
    localStorage.removeItem(STORAGE_KEYS.ZONES);
    localStorage.removeItem(STORAGE_KEYS.CHANNELS);
    localStorage.removeItem(STORAGE_KEYS.FLOWS);
    localStorage.removeItem(STORAGE_KEYS.PARTNERS);
    localStorage.removeItem(STORAGE_KEYS.APPROVALS);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
  };

  // ==========================================================================
  // RESOLVED COMMERCIAL TERMS WITH PRECEDENCE & PROVENANCE
  // 1. Approved relationship-specific terms
  // 2. Approved partner-specific terms
  // 3. Territory-specific terms
  // 4. Default sales channel terms
  // ==========================================================================
  const resolvedCommercialTerms = useMemo(() => {
    const entries: CommercialTermEntry[] = [];

    partners.forEach((partner) => {
      // Find partner's matching channel
      const matchingChannel = salesChannels.find(
        (ch) => ch.name.toLowerCase() === partner.partnerType.toLowerCase() || ch.code === 'DISTRIBUTOR'
      ) || salesChannels[1]; // default to distributor

      partner.assignedTerritoryIds.forEach((tId) => {
        const territory = territories.find((t) => t.id === tId);
        if (!territory) return;

        let provenance: CommercialTermEntry['provenance'] = 'Default Sales Channel Terms';
        let discount = matchingChannel.standardDiscountPercent;
        let creditDays = matchingChannel.creditPeriodDays;
        let creditLimit = matchingChannel.creditLimit;
        let approvalStatus: CommercialTermEntry['approvalStatus'] = 'Standard';

        // Precedence Level 2 & 1: Partner-Specific Approved Overrides
        if (partner.commercialTerms.isDiscountOverridden) {
          if (partner.commercialTerms.approvalStatus === 'Approved') {
            provenance = 'Approved Partner Terms';
            discount = partner.commercialTerms.effectiveDiscount;
            approvalStatus = 'Approved';
          } else if (partner.commercialTerms.approvalStatus === 'Pending Approval') {
            approvalStatus = 'Pending Approval';
          }
        }

        if (partner.commercialTerms.isCreditDaysOverridden) {
          creditDays = partner.commercialTerms.effectiveCreditDays;
        }

        if (partner.commercialTerms.isCreditLimitOverridden) {
          creditLimit = partner.commercialTerms.effectiveCreditLimit;
        }

        entries.push({
          id: `ct-${partner.id}-${tId}`,
          partnerId: partner.id,
          partnerName: partner.name,
          partnerCode: partner.code,
          channelId: matchingChannel.id,
          channelName: matchingChannel.name,
          territoryId: territory.id,
          territoryName: territory.name,
          standardDiscount: matchingChannel.standardDiscountPercent,
          approvedDiscount: discount,
          creditPeriodDays: creditDays,
          creditLimit,
          requiresDeposit: matchingChannel.requiresDeposit,
          depositAmount: matchingChannel.depositAmount,
          provenance,
          approvalStatus,
          effectiveFrom: matchingChannel.effectiveFrom,
          effectiveTo: matchingChannel.effectiveTo
        });
      });
    });

    return entries;
  }, [partners, salesChannels, territories]);

  // KPIs
  const kpis = useMemo(() => {
    return {
      totalTerritories: territories.length,
      totalZones: zones.length,
      totalChannels: salesChannels.length,
      totalFlows: salesFlows.length,
      activePartners: partners.filter((p) => p.status === 'Active').length,
      pendingApprovalsCount: approvals.filter((a) => a.status === 'Pending').length,
      kycUnderReviewCount: partners.filter((p) => p.status === 'KYC Under Review').length
    };
  }, [territories, zones, salesChannels, salesFlows, partners, approvals]);

  const value: GtmV2ContextType = {
    territories,
    zones,
    salesChannels,
    salesFlows,
    partners,
    approvals,
    config,
    searchQuery,
    setSearchQuery,
    sidebarCollapsed,
    setSidebarCollapsed,
    addTerritory,
    updateTerritory,
    deleteTerritory,
    toggleTerritoryStatus,
    getTerritoryHierarchyTree,
    isDescendantOf,
    addZone,
    updateZone,
    deleteZone,
    toggleZoneStatus,
    addSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    toggleSalesChannelStatus,
    addSalesFlow,
    updateSalesFlow,
    deleteSalesFlow,
    toggleSalesFlowStatus,
    createPartnerOnboarding,
    updatePartnerOnboarding,
    updatePartnerKycStatus,
    approveRequest,
    rejectRequest,
    createApprovalRequest,
    updateConfig,
    resetToInitialData,
    resolvedCommercialTerms,
    kpis
  };

  return <GtmV2Context.Provider value={value}>{children}</GtmV2Context.Provider>;
};

export const useGtmV2 = (): GtmV2ContextType => {
  const context = useContext(GtmV2Context);
  if (!context) {
    throw new Error('useGtmV2 must be used within a GtmV2Provider');
  }
  return context;
};
