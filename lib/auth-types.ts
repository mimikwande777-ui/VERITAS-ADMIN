/**
 * VERITAS ADMIN - SECURITY & ROLE BOUNDARY ARCHITECTURE (RBAC)
 * 
 * Supports: super_admin, admin, manager
 * Permissions matrix aligned with production administrative hierarchy.
 */

export type AdminRole = 'super_admin' | 'admin' | 'manager' | 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF';

export type CanonicalAdminRole = 'super_admin' | 'admin' | 'manager';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: CanonicalAdminRole;
  avatarUrl?: string;
  createdAt: string;
  lastActive: string;
}

export interface RolePermissions {
  canManageProducts: boolean;
  canPublishProducts: boolean;
  canManageInventory: boolean;
  canManageOrders: boolean;
  canSendToOTC: boolean;
  canViewSalesAnalytics: boolean;
  canManageCategories: boolean;
  canManageCollections: boolean;
  canManageMedia: boolean;
  canManageSettings: boolean;
  canManageDiscounts: boolean;
  canViewCustomers: boolean;
  canViewActivityLog: boolean;
  canManageAdmins: boolean;
}

export function normalizeAdminRole(role?: string | null): CanonicalAdminRole {
  if (!role) return 'manager';
  const clean = role.toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (clean === 'super_admin' || clean === 'superadmin') return 'super_admin';
  if (clean === 'admin') return 'admin';
  if (clean === 'manager' || clean === 'staff') return 'manager';
  return 'manager';
}

export const CANONICAL_ROLE_PERMISSIONS: Record<CanonicalAdminRole, RolePermissions> = {
  super_admin: {
    canManageProducts: true,
    canPublishProducts: true,
    canManageInventory: true,
    canManageOrders: true,
    canSendToOTC: true,
    canViewSalesAnalytics: true,
    canManageCategories: true,
    canManageCollections: true,
    canManageMedia: true,
    canManageSettings: true,
    canManageDiscounts: true,
    canViewCustomers: true,
    canViewActivityLog: true,
    canManageAdmins: true,
  },
  admin: {
    canManageProducts: true,
    canPublishProducts: true,
    canManageInventory: true,
    canManageOrders: true,
    canSendToOTC: true,
    canViewSalesAnalytics: true,
    canManageCategories: true,
    canManageCollections: true,
    canManageMedia: true,
    canManageSettings: false, // Settings restricted to super_admin
    canManageDiscounts: true,
    canViewCustomers: true,
    canViewActivityLog: true,
    canManageAdmins: false,
  },
  manager: {
    canManageProducts: true,
    canPublishProducts: false, // Manager can edit products but not publish
    canManageInventory: true,
    canManageOrders: true,
    canSendToOTC: true,
    canViewSalesAnalytics: true,
    canManageCategories: true,
    canManageCollections: true,
    canManageMedia: true,
    canManageSettings: false,
    canManageDiscounts: false,
    canViewCustomers: true,
    canViewActivityLog: true,
    canManageAdmins: false,
  },
};

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  ...CANONICAL_ROLE_PERMISSIONS,
  SUPER_ADMIN: CANONICAL_ROLE_PERMISSIONS.super_admin,
  ADMIN: CANONICAL_ROLE_PERMISSIONS.admin,
  MANAGER: CANONICAL_ROLE_PERMISSIONS.manager,
  STAFF: CANONICAL_ROLE_PERMISSIONS.manager,
};

/**
 * Current Development Mock Session (Used only when ADMIN_AUTH_BYPASS is active)
 */
export const CURRENT_DEV_ADMIN: AdminUser = {
  id: 'usr_super_admin_01',
  name: 'Super Admin',
  email: 'admin@veritas.internal',
  role: 'super_admin',
  createdAt: '2023-01-01T00:00:00Z',
  lastActive: 'Just now',
};

/**
 * Authorization guard helper
 */
export function hasPermission(role: string | undefined | null, permission: keyof RolePermissions): boolean {
  const normalized = normalizeAdminRole(role);
  return !!CANONICAL_ROLE_PERMISSIONS[normalized]?.[permission];
}

