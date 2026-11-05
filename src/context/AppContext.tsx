import React, { createContext, useContext, useEffect, useState } from 'react';
import { checkProduct, todayISO } from '../utils/productLifecycle.ts';
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
  CurrentUser,
  IndustryPack,
  IndustryPackId
} from '../types/product.ts';
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
  PORTFOLIO_INDUSTRY,
  initialCurrentUser,
  initialIndustryPacks
} from '../data/productMasterData.ts';

import * as userStore from '../modules/users/userStore';
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
  /** Sign in as another (active) user of the same workspace — demo stand-in for SSO. */
  signInAs: (userId: string) => void;
  /** False until someone signs in on the login page. */
  signedIn: boolean;
  signOut: () => void;
  /** Industry workspace of the signed-in user's company. */
  workspace: IndustryPackId;
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
  /** Maker: send a draft (or an edited active product) for approval. Runs every blocking validation rule. */
  submitProduct: (id: string, note?: string) => ActionResult;
  /** Checker: approve a pending product (maker-checker enforced). */
  approveProduct: (id: string, comment?: string) => ActionResult;
  rejectProduct: (id: string, reason: string) => ActionResult;
  retireProduct: (id: string, reason: string) => ActionResult;
  /** Data import: add new products and apply field updates in one step (no per-row toasts). */
  importProducts: (created: Product[], updates: { id: string; patch: Partial<Product> }[]) => void;
  /** Undo a product import: remove created products, restore previous values of updated ones. */
  revertProductImport: (createdIds: string[], before: { id: string; values: Partial<Product> }[]) => void;
  /** Bulk approve — only products pending approval and submitted by someone else are approved. */
  bulkApproveProducts: (ids: string[]) => ActionResult;

  // Industry packs (configuration)
  industryPacks: IndustryPack[];
  setIndustryPackEnabled: (id: IndustryPack['id'], enabled: boolean) => void;

  switchUser: () => void;

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
}

export interface ActionResult { ok: boolean; message: string; errors?: string[] }

const PRODUCTS_KEY = 'vinflux.products.v3';
const PACKS_KEY = 'vinflux.industryPacks.v2';
const loadProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (raw) {
      // Fill fields added after the data was saved (e.g. standard cost) from the seed.
      const stored = (JSON.parse(raw) as (Product & { fmcg?: unknown })[])
        // FMCG was removed as an industry pack; its demo products go too.
        .filter((p) => !p.productTypeId?.startsWith('type-fmcg') && p.portfolioId !== 'port-consumer');
      // Demo products added in later releases (new industries) appear without wiping the user's data.
      const added = initialProducts.filter((x) => !stored.some((p) => p.id === x.id) && /^PRD-(AGR|AUT|ELE)-/.test(x.id));
      return [...stored, ...added].map((p) => {
        const seed = initialProducts.find((x) => x.id === p.id);
        return seed && p.pricingReference && p.pricingReference.standardCost === undefined && seed.pricingReference?.standardCost !== undefined
          ? { ...p, pricingReference: { ...p.pricingReference, standardCost: seed.pricingReference.standardCost, dealerTransferCap: seed.pricingReference.dealerTransferCap, institutionalTenderCap: seed.pricingReference.institutionalTenderCap } } : p;
      });
    }
  } catch { /* storage unavailable */ }
  return initialProducts;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deriveUser = (): CurrentUser => {
    const list = userStore.users();
    const u = list.find((x) => x.id === userStore.currentUserId() && x.status === 'Active');
    return u ? userStore.toCurrentUser(u, initialCurrentUser.organization) : { ...initialCurrentUser, id: '' };
  };
  const [currentUser, setCurrentUser] = useState<CurrentUser>(deriveUser);
  useEffect(() => userStore.subscribeUsers(() => setCurrentUser(deriveUser())), []);
  const signedIn = !!currentUser.id;
  const workspace: IndustryPackId = currentUser.workspace ?? 'medical-devices';
  const wsPrincipals = initialPrincipals.filter((p) => p.industry === workspace);
  // Principal scope: a user limited to some principals only sees those (always within the workspace).
  const scopeP = currentUser.scope?.principalIds ?? [];
  const principals = scopeP.length ? wsPrincipals.filter((p) => scopeP.includes(p.id)) : wsPrincipals;
  const [activePrincipalRaw, setActivePrincipal] = useState<Principal>(initialPrincipals[0]);
  const activePrincipal = principals.some((p) => p.id === activePrincipalRaw.id) ? activePrincipalRaw : (principals[0] ?? wsPrincipals[0] ?? initialPrincipals[0]);

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
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [industryPacks, setIndustryPacks] = useState<IndustryPack[]>(() => {
    try { const raw = localStorage.getItem(PACKS_KEY); if (raw) return JSON.parse(raw) as IndustryPack[]; } catch { /* ignore */ }
    return initialIndustryPacks;
  });
  const setIndustryPackEnabled = (id: IndustryPack['id'], enabled: boolean) => {
    setIndustryPacks((prev) => {
      const next = prev.map((pk) => (pk.id === id ? { ...pk, enabled } : pk));
      try { localStorage.setItem(PACKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  // Products survive a reload (demo persistence until the API exists).
  useEffect(() => {
    try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); } catch { /* ignore */ }
  }, [products]);
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

  // Branches & Warehouses State
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);

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

  const history = (field: string, prev: string, next: string, reason: string) => ({
    field, prevValue: prev, newValue: next, changedBy: currentUser.name, changedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), reason,
  });
  const patch = (id: string, fn: (p: Product) => Partial<Product>) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...fn(p), updatedAt: todayISO(), updatedBy: currentUser.name } : p)));

  const submitProduct = (id: string, note = ''): ActionResult => {
    const p = products.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Product not found.' };
    if (!currentUser.permissions.canPublishProducts) return { ok: false, message: 'You are not allowed to submit products.' };
    if (p.approvalStatus === 'Pending Approval') return { ok: false, message: 'Already waiting for approval.' };
    const { errors } = checkProduct(p, products, validationRules, p.id, { productTypes, attributeTemplates });
    if (errors.length) return { ok: false, message: `${errors.length} issue(s) must be fixed before submitting.`, errors };
    // An active product stays sellable while its change is reviewed.
    const lifecycle: Product['lifecycleStatus'] = p.lifecycleStatus === 'Active' ? 'Active' : 'Pending Approval';
    patch(id, (x) => ({
      lifecycleStatus: lifecycle, approvalStatus: 'Pending Approval', submittedBy: currentUser.name, submittedAt: todayISO(), rejectionReason: null,
      changeHistory: [history('Approval', x.approvalStatus, 'Pending Approval', note || 'Submitted for approval'), ...(x.changeHistory || [])],
    }));
    return { ok: true, message: `"${p.name}" submitted for approval.` };
  };

  const canApproveCheck = (p: Product): string | null => {
    if (!currentUser.permissions.canApproveProducts) return 'You do not have approval rights.';
    if (p.approvalStatus !== 'Pending Approval') return 'Only products pending approval can be approved or rejected.';
    const mc = validationRules.find((r) => r.id === 'val-maker-checker')?.enforced ?? true;
    if (mc && p.submittedBy === currentUser.name) return 'Maker-checker: you submitted this product, so another approver must approve it.';
    return null;
  };

  const approveProduct = (id: string, comment = ''): ActionResult => {
    const p = products.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Product not found.' };
    const block = canApproveCheck(p);
    if (block) return { ok: false, message: block };
    const { errors } = checkProduct(p, products, validationRules, p.id, { productTypes, attributeTemplates });
    if (errors.length) return { ok: false, message: 'Validation failed — reject it back to the maker.', errors };
    patch(id, (x) => ({
      lifecycleStatus: 'Active', approvalStatus: 'Approved', approvedBy: currentUser.name, approvedAt: todayISO(),
      changeHistory: [history('Approval', 'Pending Approval', 'Approved', comment || 'Approved'), ...(x.changeHistory || [])],
    }));
    return { ok: true, message: `"${p.name}" approved and active.` };
  };

  const rejectProduct = (id: string, reason: string): ActionResult => {
    const p = products.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Product not found.' };
    if (!reason.trim()) return { ok: false, message: 'A reason is required to reject.' };
    if (!currentUser.permissions.canApproveProducts) return { ok: false, message: 'You do not have approval rights.' };
    if (p.approvalStatus !== 'Pending Approval') return { ok: false, message: 'Only products pending approval can be rejected.' };
    patch(id, (x) => ({
      lifecycleStatus: x.lifecycleStatus === 'Active' ? 'Active' : 'Draft', approvalStatus: 'Rejected', rejectionReason: reason.trim(),
      changeHistory: [history('Approval', 'Pending Approval', 'Rejected', reason.trim()), ...(x.changeHistory || [])],
    }));
    return { ok: true, message: `"${p.name}" sent back to the maker.` };
  };

  const retireProduct = (id: string, reason: string): ActionResult => {
    const p = products.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Product not found.' };
    if (!currentUser.permissions.canRetireProducts) return { ok: false, message: 'You are not allowed to retire products.' };
    if (!reason.trim()) return { ok: false, message: 'A reason is required to retire a product.' };
    patch(id, (x) => ({
      lifecycleStatus: 'Retired', retireReason: reason.trim(),
      changeHistory: [history('Lifecycle Status', x.lifecycleStatus, 'Retired', reason.trim()), ...(x.changeHistory || [])],
    }));
    return { ok: true, message: `"${p.name}" retired. History and past transactions are kept.` };
  };

  const bulkApproveProducts = (ids: string[]): ActionResult => {
    let done = 0; const skipped: string[] = [];
    ids.forEach((id) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      const block = canApproveCheck(p) ?? (checkProduct(p, products, validationRules, p.id, { productTypes, attributeTemplates }).errors[0] ?? null);
      if (block) { skipped.push(`${p.name}: ${block}`); return; }
      done += 1;
      patch(id, (x) => ({
        lifecycleStatus: 'Active', approvalStatus: 'Approved', approvedBy: currentUser.name, approvedAt: todayISO(),
        changeHistory: [history('Approval', 'Pending Approval', 'Approved', 'Bulk approval'), ...(x.changeHistory || [])],
      }));
    });
    return { ok: done > 0, message: `${done} approved${skipped.length ? `, ${skipped.length} skipped` : ''}.`, errors: skipped };
  };

  const importProducts = (created: Product[], updates: { id: string; patch: Partial<Product> }[]) => {
    setProducts((prev) => [...created, ...prev.map((p) => {
      const u = updates.find((x) => x.id === p.id);
      return u ? { ...p, ...u.patch, updatedAt: todayISO(), updatedBy: currentUser.name } : p;
    })]);
  };
  const revertProductImport = (createdIds: string[], before: { id: string; values: Partial<Product> }[]) => {
    setProducts((prev) => prev.filter((p) => !createdIds.includes(p.id)).map((p) => {
      const b = before.find((x) => x.id === p.id);
      return b ? { ...p, ...b.values } : p;
    }));
  };

  const signInAs = (userId: string) => {
    const u = userStore.users().find((x) => x.id === userId);
    if (!u || u.status !== 'Active') { showToast('That user is inactive.', 'warning'); return; }
    if (u.workspace !== workspace) { showToast('That user belongs to another company — sign out and sign in with their account.', 'warning'); return; }
    userStore.setCurrent(userId);
    showToast(`Signed in as ${u.name} (${userStore.toCurrentUser(u, '').role}).`, 'info');
  };
  const signOut = () => { userStore.logout(); window.location.assign('/'); };
  /** Cycle through active users of the workspace (quick maker / checker demo). */
  const switchUser = () => {
    const list = userStore.users().filter((u) => u.status === 'Active' && u.workspace === workspace);
    const i = list.findIndex((u) => u.id === currentUser.id);
    signInAs(list[(i + 1) % list.length].id);
  };

  const addPortfolio = (portfolio: Portfolio) => {
    setPortfolios((prev) => [...prev, portfolio]);
    showToast(`Added Portfolio "${portfolio.name}".`, 'success');
  };

  const addProductType = (type: ProductType) => {
    setProductTypes((prev) => [...prev, type]);
    showToast(`Added Product Type "${type.name}".`, 'success');
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
              `Branch "${b.name}" set to Inactive. It can no longer be selected for new assignments.`,
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
              `Warehouse "${w.name}" set to Inactive. It can no longer be selected as a supply source.`,
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

  // The workspace sees only its own catalogue: its principals' products, its industry pack (+ general) and portfolios.
  const wsPrincipalIds = new Set(wsPrincipals.map((p) => p.id));
  const wsProducts = products.filter((p) => wsPrincipalIds.has(p.principalId));
  const wsPacks = industryPacks.filter((p) => p.id === workspace || p.id === 'general');
  const wsPortfolios = portfolios.filter((p) => (PORTFOLIO_INDUSTRY[p.id] ?? 'medical-devices') === workspace);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        signInAs,
        signedIn,
        signOut,
        workspace,
        principals,
        activePrincipal,
        setActivePrincipal,
        toasts,
        showToast,
        removeToast,
        products: wsProducts,
        selectedProductId,
        setSelectedProductId,
        addProduct,
        updateProduct,
        duplicateProduct,
        retireProduct,
        submitProduct,
        approveProduct,
        rejectProduct,
        bulkApproveProducts,
        importProducts,
        revertProductImport,
        switchUser,
        industryPacks: wsPacks,
        setIndustryPackEnabled,
        portfolios: wsPortfolios,
        productTypes,
        productTemplates,
        attributeTemplates,
        trackingRuleTemplates,
        validationRules,
        uomPackagingDefaults,
        inventoryPolicyDefaults,
        addPortfolio,
        addProductType,
        branches,
        addBranch,
        updateBranch,
        toggleBranchStatus,
        warehouses,
        addWarehouse,
        updateWarehouse,
        toggleWarehouseStatus
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
