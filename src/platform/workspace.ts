/**
 * Industry workspace of the signed-in user. Each company (account) belongs to one industry;
 * the workspace decides which principals, product types, partner types and modules are shown,
 * and keeps each industry's Go-to-Market data separate.
 * INTEGRATION POINT: in production this is the tenant id returned by the auth service.
 */
import type { IndustryPackId } from '../types/product.ts';
import { currentUserId, users } from '../modules/users/userStore';

export const WORKSPACE_LABEL: Record<IndustryPackId, string> = {
  'medical-devices': 'Medical Devices & Instruments',
  agri: 'Agri Inputs',
  automotive: 'Automotive Parts',
  electronics: 'Electronics & Appliances',
  general: 'General',
};

export const currentWorkspace = (): IndustryPackId =>
  users().find((u) => u.id === currentUserId())?.workspace ?? 'medical-devices';

/** Storage key for data kept per workspace (medical keeps the original key so existing data stays). */
export const workspaceKey = (base: string) => (currentWorkspace() === 'medical-devices' ? base : `${base}.${currentWorkspace()}`);
