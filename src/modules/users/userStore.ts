/**
 * Users & Roles: roles carry a permission matrix (resource × action); users get one or more roles
 * and a data scope (principals, territories, warehouses). Existing screens read the derived booleans.
 * INTEGRATION POINT: GET|POST /users, /roles; SSO (Azure AD / Google) maps to these users.
 */
import type { CurrentUser, PermAction, PermResource } from '../../types/product.ts';
import { emit } from '../../platform/events';
import { loadJson, newId, saveJson } from '../../platform/store';

export const RESOURCES: { id: PermResource; label: string; actions: PermAction[]; hint: string }[] = [
  { id: 'products', label: 'Product Master', actions: ['view', 'edit', 'approve', 'configure'], hint: 'Edit = create & submit; Approve = approve, reject, retire' },
  { id: 'gtm', label: 'Go-to-Market', actions: ['view', 'edit', 'approve', 'configure'], hint: 'Partners, coverage, terms; Approve = approvals queue; Configure = masters, credit hold, rules' },
  { id: 'pricing', label: 'Price Lists & Contracts', actions: ['view', 'edit', 'approve', 'configure'], hint: 'Edit = draft & submit lists; Approve = activate' },
  { id: 'inventory', label: 'Inventory', actions: ['view', 'edit', 'configure'], hint: 'Stock on hand, adjustments' },
  { id: 'data', label: 'Data Import & Integrations', actions: ['view', 'edit', 'configure'], hint: 'Edit = run imports / undo; Configure = connectors' },
  { id: 'platform', label: 'Users, Roles & Modules', actions: ['view', 'edit', 'configure'], hint: 'Edit = users; Configure = roles & modules' },
];
export const ACTION_LABEL: Record<PermAction, string> = { view: 'View', edit: 'Create / edit', approve: 'Approve', configure: 'Configure' };

export interface Role {
  id: string;
  name: string;
  description: string;
  kind: 'Staff' | 'Partner';
  system?: boolean;
  matrix: Partial<Record<PermResource, PermAction[]>>;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  roleIds: string[];
  status: 'Active' | 'Inactive';
  /** Empty = all. */
  principalIds: string[];
  territoryIds: string[];
  warehouseIds: string[];
  lastActiveAt: string | null;
  createdAt: string;
  createdBy: string;
}

const ALL: PermAction[] = ['view', 'edit', 'approve', 'configure'];
const SEED_ROLES: Role[] = [
  { id: 'role-admin', name: 'Administrator', description: 'Everything, including users, roles and modules.', kind: 'Staff', system: true, matrix: { products: ALL, gtm: ALL, pricing: ALL, inventory: ['view', 'edit', 'configure'], data: ['view', 'edit', 'configure'], platform: ['view', 'edit', 'configure'] } },
  { id: 'role-regulatory', name: 'Regulatory Approver', description: 'Approves products and licences; reviews onboarding.', kind: 'Staff', matrix: { products: ['view', 'edit', 'approve', 'configure'], gtm: ['view', 'approve'], pricing: ['view'], inventory: ['view'], data: ['view'] } },
  { id: 'role-product-exec', name: 'Product Executive', description: 'Creates and submits products; cannot approve.', kind: 'Staff', matrix: { products: ['view', 'edit'], gtm: ['view'], pricing: ['view', 'edit'], inventory: ['view'], data: ['view', 'edit'] } },
  { id: 'role-rsm', name: 'Regional Sales Head', description: 'Onboards partners and manages hospital coverage in assigned territories; approves regional requests.', kind: 'Staff', matrix: { products: ['view'], gtm: ['view', 'edit', 'approve'], pricing: ['view', 'edit'], inventory: ['view'] } },
  { id: 'role-finance', name: 'Finance Controller', description: 'Approves prices, credit and commercial overrides.', kind: 'Staff', matrix: { products: ['view'], gtm: ['view', 'approve', 'configure'], pricing: ['view', 'approve', 'configure'], inventory: ['view'], data: ['view'] } },
  { id: 'role-warehouse', name: 'Warehouse Manager', description: 'Stock and imports for assigned warehouses.', kind: 'Staff', matrix: { products: ['view'], inventory: ['view', 'edit'], data: ['view', 'edit'] } },
  { id: 'role-auditor', name: 'Auditor (read-only)', description: 'Views everything, changes nothing.', kind: 'Staff', matrix: { products: ['view'], gtm: ['view'], pricing: ['view'], inventory: ['view'], data: ['view'], platform: ['view'] } },
  { id: 'role-partner-owner', name: 'Partner Owner (portal)', description: 'Partner portal: everything for own company.', kind: 'Partner', system: true, matrix: {} },
];
const SEED_USERS: AppUser[] = [
  { id: 'usr-001', name: 'Dr. Arvind Rao', email: 'arvind.rao@bioradmedisys.example', phone: '+91 98480 10001', title: 'Lead Regulatory Admin', roleIds: ['role-admin', 'role-regulatory'], status: 'Active', principalIds: [], territoryIds: [], warehouseIds: [], lastActiveAt: null, createdAt: '2026-01-02', createdBy: 'System' },
  { id: 'usr-002', name: 'Priya Menon', email: 'priya.menon@bioradmedisys.example', phone: '+91 98480 10002', title: 'Product Executive', roleIds: ['role-product-exec'], status: 'Active', principalIds: ['princ-biorad'], territoryIds: [], warehouseIds: [], lastActiveAt: null, createdAt: '2026-01-05', createdBy: 'Dr. Arvind Rao' },
  { id: 'usr-003', name: 'Ravi Kumar', email: 'ravi.kumar@bioradmedisys.example', phone: '+91 98480 10003', title: 'Regional Sales Head — AP & Telangana', roleIds: ['role-rsm'], status: 'Active', principalIds: ['princ-biorad'], territoryIds: ['ter-ap', 'ter-ts'], warehouseIds: [], lastActiveAt: null, createdAt: '2026-01-10', createdBy: 'Dr. Arvind Rao' },
  { id: 'usr-004', name: 'Meera Iyer', email: 'meera.iyer@bioradmedisys.example', phone: '+91 98480 10004', title: 'Finance Controller', roleIds: ['role-finance'], status: 'Active', principalIds: [], territoryIds: [], warehouseIds: [], lastActiveAt: null, createdAt: '2026-01-10', createdBy: 'Dr. Arvind Rao' },
  { id: 'usr-005', name: 'Suresh Reddy', email: 'suresh.reddy@bioradmedisys.example', phone: '+91 98480 10005', title: 'Warehouse Manager — Medchal', roleIds: ['role-warehouse'], status: 'Active', principalIds: ['princ-biorad'], territoryIds: [], warehouseIds: ['wh-medc-06'], lastActiveAt: null, createdAt: '2026-02-01', createdBy: 'Dr. Arvind Rao' },
  { id: 'usr-006', name: 'Anita Desai', email: 'anita.desai@auditfirm.example', phone: '+91 98480 10006', title: 'Internal Auditor', roleIds: ['role-auditor'], status: 'Active', principalIds: [], territoryIds: [], warehouseIds: [], lastActiveAt: null, createdAt: '2026-03-01', createdBy: 'Dr. Arvind Rao' },
];

const KEY = 'vinflux.users.v1';
interface Db { roles: Role[]; users: AppUser[]; current: string }
let cache: Db | null = null;
const listeners = new Set<() => void>();
const db = (): Db => (cache ??= loadJson<Db>(KEY, { roles: SEED_ROLES, users: SEED_USERS, current: 'usr-001' }));
const commit = (d: Db) => { cache = d; saveJson(KEY, d); listeners.forEach((l) => l()); };
export const subscribeUsers = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const roles = () => db().roles;
export const users = () => db().users;
export const currentUserId = () => db().current;

/** Union of the user's role matrices. */
export const matrixOf = (u: AppUser): Partial<Record<PermResource, PermAction[]>> => {
  const m: Partial<Record<PermResource, PermAction[]>> = {};
  roles().filter((r) => u.roleIds.includes(r.id)).forEach((r) => {
    (Object.keys(r.matrix) as PermResource[]).forEach((k) => { m[k] = Array.from(new Set([...(m[k] ?? []), ...(r.matrix[k] ?? [])])); });
  });
  return m;
};
export const hasPerm = (m: Partial<Record<PermResource, PermAction[]>> | undefined, res: PermResource, act: PermAction) => !!m?.[res]?.includes(act);

export const toCurrentUser = (u: AppUser, organization: string): CurrentUser => {
  const m = matrixOf(u);
  const has = (r: PermResource, a: PermAction) => hasPerm(m, r, a);
  return {
    id: u.id, name: u.name, email: u.email, organization,
    role: roles().filter((r) => u.roleIds.includes(r.id)).map((r) => r.name).join(', ') || 'No role',
    matrix: m,
    scope: { principalIds: u.principalIds, territoryIds: u.territoryIds, warehouseIds: u.warehouseIds },
    permissions: {
      canManageConfig: has('gtm', 'configure'),
      canApproveProducts: has('products', 'approve'),
      canPublishProducts: has('products', 'edit'),
      canRetireProducts: has('products', 'approve'),
      canApproveGtm: has('gtm', 'approve'),
      canEditPricing: has('pricing', 'edit'),
      canApprovePricing: has('pricing', 'approve'),
      canConfigurePricing: has('pricing', 'configure'),
      canEditInventory: has('inventory', 'edit'),
      canImport: has('data', 'edit'),
      canConfigurePlatform: has('platform', 'configure'),
      canManageUsers: has('platform', 'edit'),
    },
  };
};

export const setCurrent = (id: string) => {
  const d = db();
  commit({ ...d, current: id, users: d.users.map((u) => (u.id === id ? { ...u, lastActiveAt: new Date().toISOString() } : u)) });
};

const adminCount = (list: AppUser[]) => list.filter((u) => u.status === 'Active' && u.roleIds.includes('role-admin')).length;

export const saveUser = (u: AppUser, actor: { id: string; name: string }): string | null => {
  const d = db();
  const errs: string[] = [];
  if (!u.name.trim()) errs.push('Name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) errs.push('A valid email is required.');
  if (d.users.some((x) => x.id !== u.id && x.email.toLowerCase() === u.email.toLowerCase())) errs.push('Another user has this email.');
  if (!u.roleIds.length) errs.push('Give the user at least one role.');
  const before = d.users.find((x) => x.id === u.id);
  if (before && u.id === actor.id && JSON.stringify([...before.roleIds].sort()) !== JSON.stringify([...u.roleIds].sort())) errs.push('You can’t change your own roles — ask another administrator.');
  const next = before ? d.users.map((x) => (x.id === u.id ? u : x)) : [...d.users, { ...u, id: newId('usr'), createdAt: new Date().toISOString().slice(0, 10), createdBy: actor.name }];
  if (adminCount(next) === 0) errs.push('At least one active Administrator must remain.');
  if (errs.length) return errs.join(' ');
  commit({ ...d, users: next });
  emit('user.changed', 'Users & Roles', actor.name, `${before ? 'Updated' : 'Added'} user ${u.name}`, { userId: u.id });
  return null;
};

export const saveRole = (r: Role, actorName: string): string | null => {
  const d = db();
  if (!r.name.trim()) return 'Role name is required.';
  if (d.roles.some((x) => x.id !== r.id && x.name.toLowerCase() === r.name.toLowerCase())) return 'A role with this name exists.';
  if (r.id === 'role-admin' && !hasPerm(r.matrix, 'platform', 'configure')) return 'Administrator must keep “Users, Roles & Modules → Configure”.';
  const exists = d.roles.some((x) => x.id === r.id);
  commit({ ...d, roles: exists ? d.roles.map((x) => (x.id === r.id ? r : x)) : [...d.roles, { ...r, id: newId('role') }] });
  emit('role.changed', 'Users & Roles', actorName, `${exists ? 'Updated' : 'Created'} role ${r.name}`);
  return null;
};

export const deleteRole = (id: string): string | null => {
  const d = db();
  const r = d.roles.find((x) => x.id === id);
  if (!r) return 'Role not found.';
  if (r.system) return 'System roles can’t be deleted.';
  const used = d.users.filter((u) => u.roleIds.includes(id)).length;
  if (used) return `${used} user(s) have this role — remove it from them first.`;
  commit({ ...d, roles: d.roles.filter((x) => x.id !== id) });
  return null;
};

export const blankUser = (): AppUser => ({ id: '', name: '', email: '', phone: '', title: '', roleIds: [], status: 'Active', principalIds: [], territoryIds: [], warehouseIds: [], lastActiveAt: null, createdAt: '', createdBy: '' });
