import React, { createContext, useContext, useState } from 'react';
import type {
  Product,
  Portfolio,
  ProductType,
  ProductTemplate,
  AttributeDefinition,
  TrackingRuleTemplate,
  ValidationRule,
  UomPackagingDefault,
  InventoryPolicyDefaults,
  Principal,
  CurrentUser
} from '../types/product.ts';
import type { 
  Territory, 
  SalesChannel, 
  DistributionRoute, 
  TerritoryCommercialTerms, 
  RouteAuditEntry,
  PartnerPerformanceTier,
  DistributionLevel,
  PartnerClassification,
  PartnerChannelAssignment
} from '../types/gtm.ts';
import type { 
  Partner, 
  PartnerTerritoryCommercial, 
  PartnerDistributionAssignment,
  PartnerCommercialOverride
} from '../types/partner.ts';
import type { Branch } from '../types/branch.ts';
import type { Warehouse } from '../types/warehouse.ts';

import {
  initialProducts,
  initialPortfolios,
  initialProductTypes,
  initialProductTemplates,
  initialAttributeTemplates,
  initialTrackingRuleTemplates,
  initialValidationRules,
  initialUomPackagingDefaults,
  initialInventoryPolicyDefaults,
  initialPrincipals,
  initialCurrentUser
} from '../data/productMasterData.ts';

import {
  initialTerritories,
  initialSalesChannels,
  initialDistributionRoutes,
  initialPartnerPerformanceTiers,
  initialDistributionLevels
} from '../data/gtmData.ts';

import { initialPartners } from '../data/partnerData.ts';
import { initialBranches } from '../data/branchData.ts';
import { initialWarehouses } from '../data/warehouseData.ts';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
}

interface AppContextType {
  // Current user & active principal
  currentUser: CurrentUser;
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser>>;
  principals: Principal[];
  activePrincipal: Principal;
  setActivePrincipal: (p: Principal) => void;

  // Toast
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;

  // Products
  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  duplicateProduct: (id: string) => Product;
  retireProduct: (id: string) => void;
  bulkUpdateProductStatus: (ids: string[], status: Product['lifecycleStatus']) => void;

  // Product configurations
  portfolios: Portfolio[];
  productTypes: ProductType[];
  productTemplates: ProductTemplate[];
  attributeTemplates: Record<string, AttributeDefinition[]>;
  trackingRuleTemplates: TrackingRuleTemplate[];
  validationRules: ValidationRule[];
  uomPackagingDefaults: UomPackagingDefault[];
  inventoryPolicyDefaults: InventoryPolicyDefaults;
  addPortfolio: (portfolio: Portfolio) => void;
  addProductType: (type: ProductType) => void;

  // GTM: Territories, Channels, Routes
  territories: Territory[];
  salesChannels: SalesChannel[];
  distributionRoutes: DistributionRoute[];
  addTerritory: (territory: Territory) => void;
  updateTerritory: (id: string, updates: Partial<Territory>) => void;
  toggleTerritoryStatus: (id: string) => void;
  updateTerritoryCommercialTerms: (territoryId: string, updates: Partial<TerritoryCommercialTerms>) => { affectedPartnerCount: number };
  addSalesChannel: (channel: SalesChannel) => void;
  updateSalesChannel: (id: string, updates: Partial<SalesChannel>) => void;
  addDistributionRoute: (route: DistributionRoute) => { success: boolean; message: string };
  updateDistributionRoute: (id: string, updates: Partial<DistributionRoute>) => void;
  deleteDistributionRoute: (id: string) => void;
  duplicateDistributionRoute: (id: string) => void;
  toggleDistributionRouteStatus: (id: string) => void;

  // Branch Master
  branches: Branch[];
  addBranch: (branch: Branch) => { success: boolean; message: string };
  updateBranch: (id: string, updates: Partial<Branch>) => { success: boolean; message: string };
  toggleBranchStatus: (id: string) => void;

  // Warehouse Master
  warehouses: Warehouse[];
  addWarehouse: (warehouse: Warehouse) => { success: boolean; message: string };
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => { success: boolean; message: string };
  toggleWarehouseStatus: (id: string) => void;

  // Partners
  partners: Partner[];
  addPartner: (partner: Partner) => void;
  updatePartner: (id: string, updates: Partial<Partner>) => void;
  updatePartnerTerritoryAssignments: (
    partnerId: string,
    newTerritoryIds: string[],
    channelIds?: string[],
    overrides?: Record<string, { partnerOverrideDiscount?: number | null; notes?: string }>
  ) => void;
  setPartnerTerritoryOverride: (partnerId: string, territoryId: string, discount: number, notes?: string) => void;
  resetPartnerTerritoryDiscount: (partnerId: string, territoryId: string) => void;

  // Partner Distribution & Supply Assignments
  addPartnerDistributionAssignment: (
    partnerId: string,
    assignment: Omit<PartnerDistributionAssignment, 'id' | 'partnerId'>
  ) => { success: boolean; message: string };
  updatePartnerDistributionAssignment: (
    partnerId: string,
    assignmentId: string,
    updates: Partial<PartnerDistributionAssignment>
  ) => { success: boolean; message: string };
  deletePartnerDistributionAssignment: (partnerId: string, assignmentId: string) => void;

  // Commercial Terms Overrides
  updatePartnerCommercialOverride: (
    partnerId: string,
    territoryId: string,
    overrides: {
      overrideDiscountPercent?: number | null;
      overrideCreditPeriodDays?: number | null;
      overrideCreditLimit?: number | null;
      overrideSecurityDeposit?: number | null;
    },
    reason: string
  ) => void;
  resetPartnerCommercialOverride: (partnerId: string, territoryId: string) => void;

  // Distribution Portal Invitations
  sendPartnerInvitation: (partnerId: string) => { success: boolean; message: string };
  resendPartnerInvitation: (partnerId: string) => { success: boolean; message: string };
  cancelPartnerInvitation: (partnerId: string) => { success: boolean; message: string };
  togglePartnerCreditHold: (partnerId: string) => void;
  togglePartnerStatus: (partnerId: string) => void;

  // Partner Performance Tiers & Classification
  partnerTiers: PartnerPerformanceTier[];
  distributionLevels: DistributionLevel[];
  addPartnerTier: (tier: PartnerPerformanceTier) => { success: boolean; message: string };
  updatePartnerTier: (id: string, updates: Partial<PartnerPerformanceTier>) => { success: boolean; message: string };
  togglePartnerTierStatus: (id: string) => void;
  addDistributionLevel: (level: DistributionLevel) => { success: boolean; message: string };
  updateDistributionLevel: (id: string, updates: Partial<DistributionLevel>) => { success: boolean; message: string };
  toggleDistributionLevelStatus: (id: string) => void;
  updatePartnerClassification: (partnerId: string, classification: Partial<PartnerClassification>, reason: string) => void;
  approvePartnerTierUpgrade: (partnerId: string, targetTierId: string, reason: string) => void;

  // Partner Channel Assignments & Commercial Approvals
  addPartnerChannelAssignment: (partnerId: string, assignment: Omit<PartnerChannelAssignment, 'id' | 'partnerId'>) => { success: boolean; message: string };
  updatePartnerChannelAssignment: (partnerId: string, assignmentId: string, updates: Partial<PartnerChannelAssignment>) => { success: boolean; message: string };
  deletePartnerChannelAssignment: (partnerId: string, assignmentId: string) => void;
  approveCommercialDeviation: (partnerId: string, assignmentId: string, approvedDiscount: number, comments: string) => void;
  rejectCommercialDeviation: (partnerId: string, assignmentId: string, reason: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(initialCurrentUser);
  const [principals] = useState<Principal[]>(initialPrincipals);
  const [activePrincipal, setActivePrincipal] = useState<Principal>(initialPrincipals[0]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Products State
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedProductId, setSelectedProductId] = useState<string>("PRD-EVOCON-001");

  // Configuration items
  const [portfolios, setPortfolios] = useState<Portfolio[]>(initialPortfolios);
  const [productTypes, setProductTypes] = useState<ProductType[]>(initialProductTypes);
  const [productTemplates] = useState<ProductTemplate[]>(initialProductTemplates);
  const [attributeTemplates] = useState<Record<string, AttributeDefinition[]>>(initialAttributeTemplates);
  const [trackingRuleTemplates] = useState<TrackingRuleTemplate[]>(initialTrackingRuleTemplates);
  const [validationRules] = useState<ValidationRule[]>(initialValidationRules);
  const [uomPackagingDefaults] = useState<UomPackagingDefault[]>(initialUomPackagingDefaults);
  const [inventoryPolicyDefaults] = useState<InventoryPolicyDefaults>(initialInventoryPolicyDefaults);

  // GTM State
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories);
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>(initialSalesChannels);
  const [distributionRoutes, setDistributionRoutes] = useState<DistributionRoute[]>(initialDistributionRoutes);
  const [partnerTiers, setPartnerTiers] = useState<PartnerPerformanceTier[]>(initialPartnerPerformanceTiers);
  const [distributionLevels, setDistributionLevels] = useState<DistributionLevel[]>(initialDistributionLevels);

  // Branches & Warehouses State
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);

  // Partners State
  const [partners, setPartners] = useState<Partner[]>(initialPartners);

  // PRODUCT ACTIONS
  const addProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    showToast(`Product "${newProduct.name}" created successfully.`, 'success');
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((prod) =>
        prod.id === id ? { ...prod, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : prod
      )
    );
    showToast(`Product ${id} updated successfully.`, 'info');
  };

  const duplicateProduct = (id: string): Product => {
    const original = products.find((p) => p.id === id);
    if (!original) throw new Error("Product not found");

    const newCode = `${original.code}-COPY-${Math.floor(100 + Math.random() * 900)}`;
    const cloned: Product = {
      ...original,
      id: `prod-${Date.now()}`,
      code: newCode,
      name: `${original.name} (Copy)`,
      lifecycleStatus: 'Draft',
      changeHistory: [
        {
          field: 'lifecycleStatus',
          prevValue: original.lifecycleStatus,
          newValue: 'Draft',
          changedBy: currentUser.name,
          changedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          reason: `Cloned from ${original.code}`
        }
      ],
      updatedAt: new Date().toISOString().substring(0, 10),
      updatedBy: currentUser.name
    };

    setProducts((prev) => [cloned, ...prev]);
    showToast(`Product duplicated as "${cloned.name}".`, 'success');
    return cloned;
  };

  const retireProduct = (id: string) => {
    setProducts((prev) =>
      prev.map((prod) =>
        prod.id === id ? { ...prod, lifecycleStatus: 'Retired', updatedAt: new Date().toISOString().substring(0, 10) } : prod
      )
    );
    showToast(`Product ${id} retired.`, 'warning');
  };

  const bulkUpdateProductStatus = (ids: string[], status: Product['lifecycleStatus']) => {
    setProducts((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, lifecycleStatus: status } : p))
    );
    showToast(`Bulk updated ${ids.length} product(s) to "${status}".`, 'info');
  };

  const addPortfolio = (portfolio: Portfolio) => {
    setPortfolios((prev) => [...prev, portfolio]);
    showToast(`Added Portfolio "${portfolio.name}".`, 'success');
  };

  const addProductType = (type: ProductType) => {
    setProductTypes((prev) => [...prev, type]);
    showToast(`Added Product Type "${type.name}".`, 'success');
  };

  // GTM ACTIONS
  const addTerritory = (territory: Territory) => {
    setTerritories((prev) => [...prev, territory]);
    showToast(`Territory "${territory.name}" created.`, 'success');
  };

  const updateTerritory = (id: string, updates: Partial<Territory>) => {
    setTerritories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    showToast(`Territory ${id} updated.`, 'info');
  };

  const toggleTerritoryStatus = (id: string) => {
    setTerritories((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const next = t.status === 'Active' ? 'Inactive' : 'Active';
          showToast(`Territory "${t.name}" status changed to ${next}.`, 'info');
          return { ...t, status: next };
        }
        return t;
      })
    );
  };

  /**
   * CRITICAL BUSINESS LOGIC:
   * When updating territory default commercial terms, recalculate effective terms
   * for all partners in that territory who DO NOT have an explicit partner override.
   * Explicit partner overrides MUST NEVER be silently overwritten!
   */
  const updateTerritoryCommercialTerms = (
    territoryId: string,
    updates: Partial<TerritoryCommercialTerms>
  ): { affectedPartnerCount: number } => {
    const territory = territories.find((t) => t.id === territoryId);
    if (!territory) return { affectedPartnerCount: 0 };

    const newDefaultDiscount = updates.defaultDiscountPercent !== undefined 
      ? updates.defaultDiscountPercent 
      : territory.defaultCommercialTerms.defaultDiscountPercent;

    const updatedHistoryItem = {
      version: `v${(parseFloat(territory.defaultCommercialTerms.version.replace('v', '')) + 0.1).toFixed(1)}`,
      effectiveDate: new Date().toISOString().substring(0, 10),
      discountPercent: newDefaultDiscount,
      creditLimit: updates.creditLimit || territory.defaultCommercialTerms.creditLimit,
      modifiedBy: currentUser.name,
      changeReason: updates.status === 'Superseded' ? 'Annual commercial revision' : 'Policy update'
    };

    setTerritories((prev) =>
      prev.map((t) => {
        if (t.id !== territoryId) return t;
        return {
          ...t,
          defaultCommercialTerms: {
            ...t.defaultCommercialTerms,
            ...updates,
            version: updatedHistoryItem.version,
            history: [updatedHistoryItem, ...t.defaultCommercialTerms.history]
          }
        };
      })
    );

    let affectedCount = 0;
    setPartners((prev) =>
      prev.map((partner) => {
        if (!partner.assignedTerritoryIds.includes(territoryId)) return partner;

        const currentComm = partner.territoryCommercials[territoryId];
        // If partner has explicit override, PRESERVE IT!
        if (currentComm && currentComm.overrideOrigin === 'Partner Override' && currentComm.partnerOverrideDiscount !== null && currentComm.partnerOverrideDiscount !== undefined) {
          return {
            ...partner,
            territoryCommercials: {
              ...partner.territoryCommercials,
              [territoryId]: {
                ...currentComm,
                inheritedDefaultDiscount: newDefaultDiscount,
                effectiveDiscount: currentComm.partnerOverrideDiscount
              }
            }
          };
        }

        affectedCount++;
        return {
          ...partner,
          territoryCommercials: {
            ...partner.territoryCommercials,
            [territoryId]: {
              territoryId,
              territoryName: territory.name,
              inheritedDefaultDiscount: newDefaultDiscount,
              partnerOverrideDiscount: null,
              effectiveDiscount: newDefaultDiscount,
              overrideOrigin: 'Territory Default',
              notes: `Updated automatically from territory default terms (${newDefaultDiscount}%).`
            }
          }
        };
      })
    );

    showToast(
      `Updated default terms for ${territory.name}. Recalculated ${affectedCount} partner(s) inheriting defaults. Explicit partner overrides were preserved.`,
      'success'
    );

    return { affectedPartnerCount: affectedCount };
  };

  const addSalesChannel = (channel: SalesChannel) => {
    setSalesChannels((prev) => [...prev, channel]);
    showToast(`Sales Channel "${channel.name}" created.`, 'success');
  };

  const updateSalesChannel = (id: string, updates: Partial<SalesChannel>) => {
    setSalesChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    showToast(`Sales Channel updated.`, 'info');
  };

  const addDistributionRoute = (route: DistributionRoute): { success: boolean; message: string } => {
    // Check duplicate code
    const isDuplicate = distributionRoutes.some((r) => r.code.trim().toUpperCase() === route.code.trim().toUpperCase());
    if (isDuplicate) {
      const msg = `Route code "${route.code}" already exists. Route codes must be unique.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    const newRoute: DistributionRoute = {
      ...route,
      createdAt: route.createdAt || new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10),
      createdBy: currentUser.name,
      history: [
        ...(route.history || []),
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          action: 'Created',
          changedBy: currentUser.name,
          description: `Route "${route.name}" (${route.code}) created via Route Builder.`
        }
      ]
    };

    setDistributionRoutes((prev) => [...prev, newRoute]);
    showToast(`Distribution Route "${route.name}" configured successfully.`, 'success');
    return { success: true, message: `Route "${route.name}" created.` };
  };

  const updateDistributionRoute = (id: string, updates: Partial<DistributionRoute>) => {
    setDistributionRoutes((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const audit: RouteAuditEntry = {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            action: 'Modified',
            changedBy: currentUser.name,
            description: `Route modified: ${Object.keys(updates).join(', ')} updated.`
          };
          return {
            ...r,
            ...updates,
            updatedAt: new Date().toISOString().substring(0, 10),
            history: [...(r.history || []), audit]
          };
        }
        return r;
      })
    );
    showToast(`Distribution Route updated.`, 'info');
  };

  const duplicateDistributionRoute = (id: string) => {
    const existing = distributionRoutes.find((r) => r.id === id);
    if (!existing) return;

    const dupCode = `${existing.code}-COPY`;
    const newRoute: DistributionRoute = {
      ...existing,
      id: `path-${Date.now().toString().slice(-4)}`,
      code: dupCode,
      name: `${existing.name} (Copy)`,
      status: 'Draft',
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10),
      createdBy: currentUser.name,
      nodes: existing.nodes.map((node, idx) => ({
        ...node,
        id: `node-dup-${Date.now()}-${idx + 1}`
      })),
      history: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          action: 'Duplicated',
          changedBy: currentUser.name,
          description: `Duplicated from existing route "${existing.name}" (${existing.code}).`
        }
      ]
    };

    setDistributionRoutes((prev) => [...prev, newRoute]);
    showToast(`Route duplicated as "${newRoute.name}".`, 'success');
  };

  const deleteDistributionRoute = (id: string) => {
    // Check if any partner is assigned to this route
    const assignedPartners = partners.filter((p) => p.assignedRouteId === id);
    if (assignedPartners.length > 0) {
      showToast(
        `Cannot delete route: ${assignedPartners.length} partner(s) are actively assigned. Reassign them first or deactivate the route.`,
        'danger'
      );
      return;
    }

    setDistributionRoutes((prev) => prev.filter((r) => r.id !== id));
    showToast(`Distribution Route deleted.`, 'info');
  };

  const toggleDistributionRouteStatus = (id: string) => {
    setDistributionRoutes((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextStatus = r.status === 'Active' ? 'Inactive' : 'Active';
          const audit: RouteAuditEntry = {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            action: 'Status Changed',
            changedBy: currentUser.name,
            previousValue: r.status,
            newValue: nextStatus,
            description: `Route status changed from ${r.status} to ${nextStatus}.`
          };
          showToast(`Route "${r.name}" status changed to ${nextStatus}.`, 'info');
          return {
            ...r,
            status: nextStatus,
            updatedAt: new Date().toISOString().substring(0, 10),
            history: [...(r.history || []), audit]
          };
        }
        return r;
      })
    );
  };

  // BRANCH MASTER ACTIONS
  const addBranch = (branch: Branch): { success: boolean; message: string } => {
    // Validate unique code
    const isDuplicate = branches.some((b) => b.code.trim().toUpperCase() === branch.code.trim().toUpperCase());
    if (isDuplicate) {
      const msg = `Branch code "${branch.code}" already exists. Branch codes must be unique.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    setBranches((prev) => [...prev, branch]);
    showToast(`Branch "${branch.name}" (${branch.code}) created successfully.`, 'success');
    return { success: true, message: 'Branch created successfully.' };
  };

  const updateBranch = (id: string, updates: Partial<Branch>): { success: boolean; message: string } => {
    if (updates.code) {
      const isDuplicate = branches.some(
        (b) => b.id !== id && b.code.trim().toUpperCase() === updates.code!.trim().toUpperCase()
      );
      if (isDuplicate) {
        const msg = `Branch code "${updates.code}" already exists for another branch.`;
        showToast(msg, 'danger');
        return { success: false, message: msg };
      }
    }

    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : b))
    );

    // If branch name changed, also update denormalized branchName in warehouses
    if (updates.name) {
      setWarehouses((prev) =>
        prev.map((w) => (w.branchId === id ? { ...w, branchName: updates.name } : w))
      );
    }

    showToast(`Branch updated successfully.`, 'success');
    return { success: true, message: 'Branch updated successfully.' };
  };

  const toggleBranchStatus = (id: string) => {
    setBranches((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const next = b.status === 'Active' ? 'Inactive' : 'Active';
          if (next === 'Inactive') {
            showToast(
              `Branch "${b.name}" set to Inactive. Existing partner assignments are preserved, but this branch cannot be selected for new assignments.`,
              'warning'
            );
          } else {
            showToast(`Branch "${b.name}" activated.`, 'success');
          }
          return { ...b, status: next, updatedAt: new Date().toISOString().substring(0, 10) };
        }
        return b;
      })
    );
  };

  // WAREHOUSE MASTER ACTIONS
  const addWarehouse = (warehouse: Warehouse): { success: boolean; message: string } => {
    // 1. Validate branch exists and is Active
    const branch = branches.find((b) => b.id === warehouse.branchId);
    if (!branch) {
      const msg = `Selected branch ID "${warehouse.branchId}" does not exist.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }
    if (branch.status !== 'Active') {
      const msg = `Cannot create warehouse under inactive branch "${branch.name}". Only active branches may have new warehouses.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    // 2. Validate unique code
    const isDuplicate = warehouses.some((w) => w.code.trim().toUpperCase() === warehouse.code.trim().toUpperCase());
    if (isDuplicate) {
      const msg = `Warehouse code "${warehouse.code}" already exists. Warehouse codes must be unique.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    const warehouseWithBranch: Warehouse = {
      ...warehouse,
      branchName: branch.name
    };

    setWarehouses((prev) => [...prev, warehouseWithBranch]);

    // Update branch active warehouses count
    setBranches((prev) =>
      prev.map((b) =>
        b.id === warehouse.branchId
          ? { ...b, activeWarehousesCount: (b.activeWarehousesCount || 0) + (warehouse.status === 'Active' ? 1 : 0) }
          : b
      )
    );

    showToast(`Warehouse "${warehouse.name}" (${warehouse.code}) created under branch "${branch.name}".`, 'success');
    return { success: true, message: 'Warehouse created successfully.' };
  };

  const updateWarehouse = (id: string, updates: Partial<Warehouse>): { success: boolean; message: string } => {
    if (updates.code) {
      const isDuplicate = warehouses.some(
        (w) => w.id !== id && w.code.trim().toUpperCase() === updates.code!.trim().toUpperCase()
      );
      if (isDuplicate) {
        const msg = `Warehouse code "${updates.code}" already exists for another warehouse.`;
        showToast(msg, 'danger');
        return { success: false, message: msg };
      }
    }

    if (updates.branchId) {
      const branch = branches.find((b) => b.id === updates.branchId);
      if (!branch) {
        return { success: false, message: 'Invalid branch ID.' };
      }
      updates.branchName = branch.name;
    }

    setWarehouses((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : w))
    );

    showToast(`Warehouse updated successfully.`, 'success');
    return { success: true, message: 'Warehouse updated successfully.' };
  };

  const toggleWarehouseStatus = (id: string) => {
    setWarehouses((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const next = w.status === 'Active' ? 'Inactive' : 'Active';
          if (next === 'Inactive') {
            showToast(
              `Warehouse "${w.name}" set to Inactive. Existing partner supply assignments remain intact, but it cannot be selected for new assignments.`,
              'warning'
            );
          } else {
            showToast(`Warehouse "${w.name}" activated.`, 'success');
          }
          return { ...w, status: next, updatedAt: new Date().toISOString().substring(0, 10) };
        }
        return w;
      })
    );
  };

  // PARTNER ACTIONS
  const addPartner = (newPartner: Partner) => {
    setPartners((prev) => [newPartner, ...prev]);
    showToast(`Partner "${newPartner.name}" onboarded successfully.`, 'success');
  };

  const updatePartner = (id: string, updates: Partial<Partner>) => {
    setPartners((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : p
      )
    );
    showToast(`Partner record updated.`, 'info');
  };

  const updatePartnerTerritoryAssignments = (
    partnerId: string,
    newTerritoryIds: string[],
    channelIds?: string[],
    overrides?: Record<string, { partnerOverrideDiscount?: number | null; notes?: string }>
  ) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;

        const updatedCommercials: Record<string, PartnerTerritoryCommercial> = {};

        newTerritoryIds.forEach((tId) => {
          const territory = territories.find((t) => t.id === tId);
          const terrDefault = territory ? territory.defaultCommercialTerms.defaultDiscountPercent : 5.0;
          const existingComm = p.territoryCommercials[tId];
          const newOverrideEntry = overrides ? overrides[tId] : undefined;

          let partnerOverrideDiscount: number | null = null;
          let effectiveDiscount = terrDefault;
          let origin: PartnerTerritoryCommercial['overrideOrigin'] = 'Territory Default';

          if (newOverrideEntry && newOverrideEntry.partnerOverrideDiscount !== undefined) {
            partnerOverrideDiscount = newOverrideEntry.partnerOverrideDiscount;
          } else if (existingComm && existingComm.partnerOverrideDiscount !== undefined) {
            partnerOverrideDiscount = existingComm.partnerOverrideDiscount;
          }

          if (partnerOverrideDiscount !== null && !isNaN(partnerOverrideDiscount)) {
            effectiveDiscount = partnerOverrideDiscount;
            origin = 'Partner Override';
          } else {
            effectiveDiscount = terrDefault;
            origin = 'Territory Default';
          }

          updatedCommercials[tId] = {
            territoryId: tId,
            territoryName: territory ? territory.name : tId,
            inheritedDefaultDiscount: terrDefault,
            partnerOverrideDiscount,
            effectiveDiscount,
            overrideOrigin: origin,
            notes: (newOverrideEntry && newOverrideEntry.notes) || (existingComm && existingComm.notes) || undefined
          };
        });

        return {
          ...p,
          assignedTerritoryIds: newTerritoryIds,
          assignedChannelIds: channelIds || p.assignedChannelIds,
          territoryCommercials: updatedCommercials,
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );

    showToast(`Territory assignments and commercial terms updated for partner.`, 'success');
  };

  const setPartnerTerritoryOverride = (
    partnerId: string,
    territoryId: string,
    discount: number,
    notes?: string
  ) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const territory = territories.find((t) => t.id === territoryId);
        const terrDefault = territory ? territory.defaultCommercialTerms.defaultDiscountPercent : 5.0;
        const currentComm = p.territoryCommercials[territoryId];

        const updatedComm: PartnerTerritoryCommercial = {
          territoryId,
          territoryName: territory ? territory.name : territoryId,
          inheritedDefaultDiscount: terrDefault,
          partnerOverrideDiscount: discount,
          effectiveDiscount: discount,
          overrideOrigin: 'Partner Override',
          notes: notes || currentComm?.notes || 'Partner override applied.'
        };

        return {
          ...p,
          territoryCommercials: {
            ...p.territoryCommercials,
            [territoryId]: updatedComm
          }
        };
      })
    );
    showToast(`Set partner override to ${discount}% for ${territoryId}.`, 'success');
  };

  const resetPartnerTerritoryDiscount = (partnerId: string, territoryId: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const territory = territories.find((t) => t.id === territoryId);
        const terrDefault = territory ? territory.defaultCommercialTerms.defaultDiscountPercent : 5.0;

        const updatedComm: PartnerTerritoryCommercial = {
          territoryId,
          territoryName: territory ? territory.name : territoryId,
          inheritedDefaultDiscount: terrDefault,
          partnerOverrideDiscount: null,
          effectiveDiscount: terrDefault,
          overrideOrigin: 'Territory Default',
          notes: 'Reset to territory default.'
        };

        return {
          ...p,
          territoryCommercials: {
            ...p.territoryCommercials,
            [territoryId]: updatedComm
          }
        };
      })
    );
    showToast(`Reset discount to territory default for ${territoryId}.`, 'info');
  };

  // PARTNER DISTRIBUTION & SUPPLY ASSIGNMENTS
  const addPartnerDistributionAssignment = (
    partnerId: string,
    assignment: Omit<PartnerDistributionAssignment, 'id' | 'partnerId'>
  ): { success: boolean; message: string } => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return { success: false, message: 'Partner not found.' };

    // 1. Verify branch is Active
    const branch = branches.find((b) => b.id === assignment.branchId);
    if (!branch || branch.status !== 'Active') {
      const msg = `Cannot assign inactive branch "${branch?.name || assignment.branchId}" for new supply route.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    // 2. Verify warehouse is Active
    const warehouse = warehouses.find((w) => w.id === assignment.warehouseId);
    if (!warehouse || warehouse.status !== 'Active') {
      const msg = `Cannot assign inactive warehouse "${warehouse?.name || assignment.warehouseId}" for new supply route.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    // 3. Verify warehouse belongs to branch
    if (warehouse.branchId !== assignment.branchId) {
      const msg = `Warehouse "${warehouse.name}" does not belong to branch "${branch.name}". Supply assignment rejected.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    const territory = territories.find((t) => t.id === assignment.territoryId);

    const newAssignment: PartnerDistributionAssignment = {
      ...assignment,
      id: `asgn-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      partnerId,
      territoryName: territory?.name || assignment.territoryName,
      branchName: branch.name,
      warehouseName: warehouse.name
    };

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        let updatedAssignments = [...(p.distributionAssignments || [])];

        // If this new assignment is marked primary, unmark other primaries in the same territory
        if (newAssignment.isPrimary) {
          updatedAssignments = updatedAssignments.map((a) =>
            a.territoryId === newAssignment.territoryId ? { ...a, isPrimary: false } : a
          );
        }

        updatedAssignments.push(newAssignment);
        return {
          ...p,
          distributionAssignments: updatedAssignments,
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );

    showToast(`Added supply assignment: ${branch.name} → ${warehouse.name}.`, 'success');
    return { success: true, message: 'Distribution assignment added successfully.' };
  };

  const updatePartnerDistributionAssignment = (
    partnerId: string,
    assignmentId: string,
    updates: Partial<PartnerDistributionAssignment>
  ): { success: boolean; message: string } => {
    // If branch or warehouse updated, validate relationship
    if (updates.branchId && updates.warehouseId) {
      const wh = warehouses.find((w) => w.id === updates.warehouseId);
      if (wh && wh.branchId !== updates.branchId) {
        const msg = `Selected warehouse does not belong to selected branch.`;
        showToast(msg, 'danger');
        return { success: false, message: msg };
      }
    }

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        let list = (p.distributionAssignments || []).map((a) => {
          if (a.id === assignmentId) {
            const branch = updates.branchId ? branches.find((b) => b.id === updates.branchId) : undefined;
            const wh = updates.warehouseId ? warehouses.find((w) => w.id === updates.warehouseId) : undefined;
            const terr = updates.territoryId ? territories.find((t) => t.id === updates.territoryId) : undefined;

            return {
              ...a,
              ...updates,
              branchName: branch ? branch.name : a.branchName,
              warehouseName: wh ? wh.name : a.warehouseName,
              territoryName: terr ? terr.name : a.territoryName
            };
          }
          return a;
        });

        // Handle isPrimary exclusivity in territory
        if (updates.isPrimary) {
          const target = list.find((a) => a.id === assignmentId);
          if (target) {
            list = list.map((a) =>
              a.id !== assignmentId && a.territoryId === target.territoryId ? { ...a, isPrimary: false } : a
            );
          }
        }

        return { ...p, distributionAssignments: list, updatedAt: new Date().toISOString().substring(0, 10) };
      })
    );

    showToast(`Distribution assignment updated.`, 'info');
    return { success: true, message: 'Updated successfully.' };
  };

  const deletePartnerDistributionAssignment = (partnerId: string, assignmentId: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        return {
          ...p,
          distributionAssignments: (p.distributionAssignments || []).filter((a) => a.id !== assignmentId),
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );
    showToast(`Removed supply assignment.`, 'warning');
  };

  // COMMERCIAL TERMS OVERRIDES
  const updatePartnerCommercialOverride = (
    partnerId: string,
    territoryId: string,
    overrides: {
      overrideDiscountPercent?: number | null;
      overrideCreditPeriodDays?: number | null;
      overrideCreditLimit?: number | null;
      overrideSecurityDeposit?: number | null;
    },
    reason: string
  ) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const territory = territories.find((t) => t.id === territoryId);
        const terrName = territory?.name || territoryId;
        const terrDefaultDisc = territory?.defaultCommercialTerms.defaultDiscountPercent || 5.0;

        const currentOverrides = p.commercialOverrides || {};
        const existingOvr = currentOverrides[territoryId];

        const historyEntry = {
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          field: 'commercialOverrides',
          oldValue: existingOvr ? { ...existingOvr } : null,
          newValue: overrides,
          reason: reason || 'Manual commercial override update',
          updatedBy: currentUser.name
        };

        const updatedOverride: PartnerCommercialOverride = {
          id: existingOvr?.id || `ovr-${Date.now()}`,
          partnerId,
          territoryId,
          territoryName: terrName,
          overrideDiscountPercent:
            overrides.overrideDiscountPercent !== undefined
              ? overrides.overrideDiscountPercent
              : existingOvr?.overrideDiscountPercent ?? null,
          overrideCreditPeriodDays:
            overrides.overrideCreditPeriodDays !== undefined
              ? overrides.overrideCreditPeriodDays
              : existingOvr?.overrideCreditPeriodDays ?? null,
          overrideCreditLimit:
            overrides.overrideCreditLimit !== undefined
              ? overrides.overrideCreditLimit
              : existingOvr?.overrideCreditLimit ?? null,
          overrideSecurityDeposit:
            overrides.overrideSecurityDeposit !== undefined
              ? overrides.overrideSecurityDeposit
              : existingOvr?.overrideSecurityDeposit ?? null,
          effectiveFrom: new Date().toISOString().substring(0, 10),
          overrideReason: reason || 'Commercial negotiation approval',
          updatedBy: currentUser.name,
          history: existingOvr ? [historyEntry, ...(existingOvr.history || [])] : [historyEntry]
        };

        // Update effective discount in territoryCommercials
        const effDiscount =
          updatedOverride.overrideDiscountPercent !== null && updatedOverride.overrideDiscountPercent !== undefined
            ? updatedOverride.overrideDiscountPercent
            : terrDefaultDisc;

        const origin =
          updatedOverride.overrideDiscountPercent !== null && updatedOverride.overrideDiscountPercent !== undefined
            ? 'Partner Override'
            : 'Territory Default';

        return {
          ...p,
          commercialOverrides: {
            ...currentOverrides,
            [territoryId]: updatedOverride
          },
          territoryCommercials: {
            ...p.territoryCommercials,
            [territoryId]: {
              territoryId,
              territoryName: terrName,
              inheritedDefaultDiscount: terrDefaultDisc,
              partnerOverrideDiscount: updatedOverride.overrideDiscountPercent,
              effectiveDiscount: effDiscount,
              overrideOrigin: origin,
              notes: `Commercial override: ${reason}`
            }
          },
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );

    showToast(`Saved partner-specific commercial terms for ${territoryId}. Master defaults remain protected.`, 'success');
  };

  const resetPartnerCommercialOverride = (partnerId: string, territoryId: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== partnerId) return p;
        const currentOverrides = { ...(p.commercialOverrides || {}) };
        delete currentOverrides[territoryId];

        const territory = territories.find((t) => t.id === territoryId);
        const terrDefault = territory?.defaultCommercialTerms.defaultDiscountPercent || 5.0;

        return {
          ...p,
          commercialOverrides: currentOverrides,
          territoryCommercials: {
            ...p.territoryCommercials,
            [territoryId]: {
              territoryId,
              territoryName: territory?.name || territoryId,
              inheritedDefaultDiscount: terrDefault,
              partnerOverrideDiscount: null,
              effectiveDiscount: terrDefault,
              overrideOrigin: 'Territory Default',
              notes: 'Reset to master default terms'
            }
          },
          updatedAt: new Date().toISOString().substring(0, 10)
        };
      })
    );
    showToast(`Reset commercial terms to Master Defaults for ${territoryId}.`, 'info');
  };

  // DISTRIBUTION PORTAL INVITATIONS
  const sendPartnerInvitation = (partnerId: string): { success: boolean; message: string } => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return { success: false, message: 'Partner not found.' };

    if (partner.kycStatus === 'Draft') {
      const msg = `Cannot invite partner "${partner.name}": Statutory KYC is currently in Draft status. KYC verification is required before sending portal invitations.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    if (partner.kycStatus === 'Rejected') {
      const msg = `Cannot invite partner "${partner.name}": Statutory KYC was Rejected. Please re-verify KYC documents.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }

    const sentDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          return {
            ...p,
            invitationStatus: 'Invite Sent',
            invitationSentDate: sentDate,
            invitationExpiryDate: expiry,
            invitedEmail: p.officialEmail,
            // portalAccessStatus remains Disabled until accepted!
            portalAccessStatus: 'Disabled',
            portalUsers: p.portalUsers.length > 0
              ? p.portalUsers
              : [
                  {
                    id: `usr-${Date.now().toString().slice(-4)}`,
                    name: p.authorizedContactPerson,
                    email: p.officialEmail,
                    role: 'Distributor Administrator',
                    status: 'Invited'
                  }
                ]
          };
        }
        return p;
      })
    );

    const successMsg = `Distribution Portal invitation successfully dispatched to ${partner.officialEmail}. Valid for 30 days.`;
    showToast(successMsg, 'success');
    return { success: true, message: successMsg };
  };

  const resendPartnerInvitation = (partnerId: string): { success: boolean; message: string } => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return { success: false, message: 'Partner not found.' };

    const sentDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          return {
            ...p,
            invitationStatus: 'Invite Sent',
            invitationSentDate: sentDate,
            invitationExpiryDate: expiry
          };
        }
        return p;
      })
    );

    const successMsg = `Distribution Portal invitation re-sent to ${partner.officialEmail}.`;
    showToast(successMsg, 'info');
    return { success: true, message: successMsg };
  };

  const cancelPartnerInvitation = (partnerId: string): { success: boolean; message: string } => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          return {
            ...p,
            invitationStatus: 'Cancelled',
            portalAccessStatus: 'Disabled'
          };
        }
        return p;
      })
    );
    const msg = `Distribution Portal invitation cancelled.`;
    showToast(msg, 'warning');
    return { success: true, message: msg };
  };

  const togglePartnerCreditHold = (partnerId: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          const nextHold = !p.creditHold;
          showToast(
            nextHold
              ? `Credit hold placed on ${p.name}. Warehouse dispatches paused.`
              : `Credit hold released for ${p.name}. Active ordering enabled.`,
            nextHold ? 'warning' : 'success'
          );
          return { ...p, creditHold: nextHold };
        }
        return p;
      })
    );
  };

  const togglePartnerStatus = (partnerId: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          const nextStatus = p.status === 'Active' ? 'Suspended' : 'Active';
          showToast(
            `Partner ${p.name} status changed to ${nextStatus}.`,
            nextStatus === 'Active' ? 'success' : 'danger'
          );
          return {
            ...p,
            status: nextStatus,
            portalAccessStatus: nextStatus === 'Active' && p.invitationStatus === 'Accepted' ? 'Active' : 'Suspended'
          };
        }
        return p;
      })
    );
  };

  // PARTNER PERFORMANCE TIERS & CLASSIFICATION
  const addPartnerTier = (tier: PartnerPerformanceTier): { success: boolean; message: string } => {
    const existing = partnerTiers.find(
      (t) => t.code.toLowerCase() === tier.code.toLowerCase() || t.name.toLowerCase() === tier.name.toLowerCase()
    );
    if (existing) {
      const msg = `Partner Tier with code "${tier.code}" or name "${tier.name}" already exists.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }
    setPartnerTiers((prev) => [...prev, tier]);
    const msg = `Partner Performance Tier "${tier.name}" created successfully.`;
    showToast(msg, 'success');
    return { success: true, message: msg };
  };

  const updatePartnerTier = (id: string, updates: Partial<PartnerPerformanceTier>): { success: boolean; message: string } => {
    setPartnerTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    const msg = `Partner Performance Tier updated successfully.`;
    showToast(msg, 'info');
    return { success: true, message: msg };
  };

  const togglePartnerTierStatus = (id: string) => {
    const tier = partnerTiers.find((t) => t.id === id);
    if (!tier) return;
    const nextStatus = tier.status === 'Active' ? 'Inactive' : 'Active';
    const assignedCount = partners.filter((p) => p.classification?.performanceTierId === id).length;
    
    setPartnerTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
    );
    showToast(
      `Partner Tier "${tier.name}" set to ${nextStatus}.${assignedCount > 0 ? ` Historical records for ${assignedCount} partner(s) preserved.` : ''}`,
      nextStatus === 'Active' ? 'success' : 'warning'
    );
  };

  // DISTRIBUTION LEVEL MASTER
  const addDistributionLevel = (level: DistributionLevel): { success: boolean; message: string } => {
    const existing = distributionLevels.find(
      (l) => l.code.toLowerCase() === level.code.toLowerCase() || l.name.toLowerCase() === level.name.toLowerCase()
    );
    if (existing) {
      const msg = `Distribution Level with code "${level.code}" already exists.`;
      showToast(msg, 'danger');
      return { success: false, message: msg };
    }
    setDistributionLevels((prev) => [...prev, level]);
    const msg = `Distribution Level "${level.name}" created successfully.`;
    showToast(msg, 'success');
    return { success: true, message: msg };
  };

  const updateDistributionLevel = (id: string, updates: Partial<DistributionLevel>): { success: boolean; message: string } => {
    setDistributionLevels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
    const msg = `Distribution Level updated successfully.`;
    showToast(msg, 'info');
    return { success: true, message: msg };
  };

  const toggleDistributionLevelStatus = (id: string) => {
    setDistributionLevels((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const next = l.status === 'Active' ? 'Inactive' : 'Active';
          showToast(`Distribution Level "${l.name}" status changed to ${next}.`, next === 'Active' ? 'success' : 'warning');
          return { ...l, status: next };
        }
        return l;
      })
    );
  };

  // PARTNER CLASSIFICATION & REVIEW
  const updatePartnerClassification = (partnerId: string, classification: Partial<PartnerClassification>, reason: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return;

    const oldClassification = partner.classification;
    const historyEntry = {
      id: `pch-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      changedBy: currentUser.name,
      fromTier: oldClassification?.performanceTierName || 'Unassigned',
      toTier: classification.performanceTierName || oldClassification?.performanceTierName || 'Unassigned',
      fromLevel: oldClassification?.distributionLevelName || 'Unassigned',
      toLevel: classification.distributionLevelName || oldClassification?.distributionLevelName || 'Unassigned',
      reason: reason || 'Classification record review & adjustment'
    };

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          const updatedClassification: PartnerClassification = {
            partnerType: classification.partnerType || p.typeName || 'Distributor',
            performanceTierId: classification.performanceTierId || p.classification?.performanceTierId || 'tier-silver',
            performanceTierName: classification.performanceTierName || p.classification?.performanceTierName || 'Silver Growth Partner',
            distributionLevelId: classification.distributionLevelId || p.classification?.distributionLevelId || 'dl-tier2',
            distributionLevelName: classification.distributionLevelName || p.classification?.distributionLevelName || 'Tier 2 — Regional / Zonal Channel Stockist',
            effectiveDate: classification.effectiveDate || new Date().toISOString().substring(0, 10),
            expiryDate: classification.expiryDate,
            reason: reason || p.classification?.reason || '',
            approvalStatus: classification.approvalStatus || 'Approved',
            history: [historyEntry, ...(p.classification?.history || [])]
          };
          return { ...p, classification: updatedClassification };
        }
        return p;
      })
    );

    showToast(`Classification updated for ${partner.name}.`, 'success');
  };

  const approvePartnerTierUpgrade = (partnerId: string, targetTierId: string, reason: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    const targetTier = partnerTiers.find((t) => t.id === targetTierId);
    if (!partner || !targetTier) return;

    const oldTierName = partner.classification?.performanceTierName || 'Standard Tier';
    const historyEntry = {
      id: `pch-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      changedBy: currentUser.name,
      fromTier: oldTierName,
      toTier: targetTier.name,
      fromLevel: partner.classification?.distributionLevelName || 'Tier 2',
      toLevel: partner.classification?.distributionLevelName || 'Tier 2',
      reason: reason || `Approved recommended tier upgrade from ${oldTierName} to ${targetTier.name}.`
    };

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId && p.classification) {
          return {
            ...p,
            classification: {
              ...p.classification,
              performanceTierId: targetTier.id,
              performanceTierName: targetTier.name,
              reviewDue: false,
              proposedTierId: undefined,
              proposedTierName: undefined,
              history: [historyEntry, ...(p.classification.history || [])]
            }
          };
        }
        return p;
      })
    );

    showToast(`Partner ${partner.name} upgraded to "${targetTier.name}".`, 'success');
  };

  // MULTIPLE CHANNELS PER PARTNER & COMMERCIAL DEVIATIONS
  const addPartnerChannelAssignment = (
    partnerId: string,
    assignment: Omit<PartnerChannelAssignment, 'id' | 'partnerId'>
  ): { success: boolean; message: string } => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return { success: false, message: 'Partner not found.' };

    const newAssignment: PartnerChannelAssignment = {
      ...assignment,
      id: `pca-${Date.now()}`,
      partnerId,
      partnerName: partner.name,
      partnerCode: partner.code
    };

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          const current = p.channelAssignments || [];
          return {
            ...p,
            channelAssignments: [...current, newAssignment],
            assignedChannelIds: Array.from(new Set([...p.assignedChannelIds, assignment.salesChannelId]))
          };
        }
        return p;
      })
    );

    const msg = `Channel assignment for "${assignment.salesChannelName}" added to ${partner.name}.`;
    showToast(msg, 'success');
    return { success: true, message: msg };
  };

  const updatePartnerChannelAssignment = (
    partnerId: string,
    assignmentId: string,
    updates: Partial<PartnerChannelAssignment>
  ): { success: boolean; message: string } => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId && p.channelAssignments) {
          return {
            ...p,
            channelAssignments: p.channelAssignments.map((ca) =>
              ca.id === assignmentId ? { ...ca, ...updates } : ca
            )
          };
        }
        return p;
      })
    );
    const msg = `Partner channel assignment updated successfully.`;
    showToast(msg, 'info');
    return { success: true, message: msg };
  };

  const deletePartnerChannelAssignment = (partnerId: string, assignmentId: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId && p.channelAssignments) {
          const remaining = p.channelAssignments.filter((ca) => ca.id !== assignmentId);
          return {
            ...p,
            channelAssignments: remaining,
            assignedChannelIds: Array.from(new Set(remaining.map((ca) => ca.salesChannelId)))
          };
        }
        return p;
      })
    );
    showToast(`Channel assignment removed.`, 'warning');
  };

  const approveCommercialDeviation = (
    partnerId: string,
    assignmentId: string,
    approvedDiscount: number,
    comments: string
  ) => {
    const partner = partners.find((p) => p.id === partnerId);
    const assignment = partner?.channelAssignments?.find((ca) => ca.id === assignmentId);
    if (!partner || !assignment) return;

    const auditEntry = {
      id: `cah-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      action: 'Approved' as const,
      actor: currentUser.name,
      oldDiscountPercent: assignment.commercialOverride?.channelDefaultDiscount || 12.0,
      newDiscountPercent: approvedDiscount,
      comments: comments || 'Approved by Commercial Director under authorized delegation.'
    };

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId && p.channelAssignments) {
          return {
            ...p,
            channelAssignments: p.channelAssignments.map((ca) => {
              if (ca.id === assignmentId) {
                return {
                  ...ca,
                  commercialTermStatus: 'Deviated — Approved',
                  commercialOverride: {
                    ...ca.commercialOverride,
                    channelDefaultDiscount: ca.commercialOverride?.channelDefaultDiscount || 12.0,
                    overrideDiscountPercent: approvedDiscount,
                    approvedBy: currentUser.name,
                    approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                    approvalHistory: [auditEntry, ...(ca.commercialOverride?.approvalHistory || [])]
                  }
                };
              }
              return ca;
            })
          };
        }
        return p;
      })
    );

    showToast(`Commercial deviation approved for ${partner.name} (${assignment.salesChannelName}): ${approvedDiscount}% discount.`, 'success');
  };

  const rejectCommercialDeviation = (
    partnerId: string,
    assignmentId: string,
    reason: string
  ) => {
    const partner = partners.find((p) => p.id === partnerId);
    const assignment = partner?.channelAssignments?.find((ca) => ca.id === assignmentId);
    if (!partner || !assignment) return;

    const auditEntry = {
      id: `cah-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      action: 'Rejected' as const,
      actor: currentUser.name,
      oldDiscountPercent: assignment.commercialOverride?.channelDefaultDiscount || 12.0,
      newDiscountPercent: assignment.commercialOverride?.requestedDiscount || 12.0,
      comments: reason || 'Commercial deviation request rejected.'
    };

    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId && p.channelAssignments) {
          return {
            ...p,
            channelAssignments: p.channelAssignments.map((ca) => {
              if (ca.id === assignmentId) {
                return {
                  ...ca,
                  commercialTermStatus: 'Deviated — Rejected',
                  commercialOverride: {
                    ...ca.commercialOverride,
                    channelDefaultDiscount: ca.commercialOverride?.channelDefaultDiscount || 12.0,
                    rejectionReason: reason || 'Margin requirement not satisfied.',
                    approvalHistory: [auditEntry, ...(ca.commercialOverride?.approvalHistory || [])]
                  }
                };
              }
              return ca;
            })
          };
        }
        return p;
      })
    );

    showToast(`Commercial deviation request rejected for ${partner.name}.`, 'warning');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        principals,
        activePrincipal,
        setActivePrincipal,
        toasts,
        showToast,
        removeToast,
        products,
        selectedProductId,
        setSelectedProductId,
        addProduct,
        updateProduct,
        duplicateProduct,
        retireProduct,
        bulkUpdateProductStatus,
        portfolios,
        productTypes,
        productTemplates,
        attributeTemplates,
        trackingRuleTemplates,
        validationRules,
        uomPackagingDefaults,
        inventoryPolicyDefaults,
        addPortfolio,
        addProductType,
        territories,
        salesChannels,
        distributionRoutes,
        addTerritory,
        updateTerritory,
        toggleTerritoryStatus,
        updateTerritoryCommercialTerms,
        addSalesChannel,
        updateSalesChannel,
        addDistributionRoute,
        updateDistributionRoute,
        deleteDistributionRoute,
        duplicateDistributionRoute,
        toggleDistributionRouteStatus,
        branches,
        addBranch,
        updateBranch,
        toggleBranchStatus,
        warehouses,
        addWarehouse,
        updateWarehouse,
        toggleWarehouseStatus,
        partners,
        addPartner,
        updatePartner,
        updatePartnerTerritoryAssignments,
        setPartnerTerritoryOverride,
        resetPartnerTerritoryDiscount,
        addPartnerDistributionAssignment,
        updatePartnerDistributionAssignment,
        deletePartnerDistributionAssignment,
        updatePartnerCommercialOverride,
        resetPartnerCommercialOverride,
        sendPartnerInvitation,
        resendPartnerInvitation,
        cancelPartnerInvitation,
        togglePartnerCreditHold,
        togglePartnerStatus,
        partnerTiers,
        distributionLevels,
        addPartnerTier,
        updatePartnerTier,
        togglePartnerTierStatus,
        addDistributionLevel,
        updateDistributionLevel,
        toggleDistributionLevelStatus,
        updatePartnerClassification,
        approvePartnerTierUpgrade,
        addPartnerChannelAssignment,
        updatePartnerChannelAssignment,
        deletePartnerChannelAssignment,
        approveCommercialDeviation,
        rejectCommercialDeviation
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
