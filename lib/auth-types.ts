/**
 * VERITAS ADMIN - PARTNER ROLE-BASED ACCESS CONTROL (RBAC)
 * 
 * Canonical Roles:
 * - super_admin : Owner with complete, unrestricted access across all systems
 * - operations  : Production & logistics partner (inventory, products, fulfilment, media)
 * - marketing   : Brand & design partner (product content, collections, categories, discounts, media)
 * - finance     : Capital & financial partner (sales, financial reports, read-only orders & inventory)
 */

export type CanonicalAdminRole = 'super_admin' | 'operations' | 'marketing' | 'finance';

export type AdminRole = CanonicalAdminRole | 'admin' | 'manager' | 'SUPER_ADMIN' | 'OPERATIONS' | 'MARKETING' | 'FINANCE' | 'ADMIN' | 'MANAGER';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: CanonicalAdminRole;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  lastActive: string;
}

export interface RolePermissions {
  // Products
  canViewProducts: boolean;
  canCreateProducts: boolean;
  canEditProducts: boolean;         // Full edit including price/variants
  canEditProductContent: boolean;  // Marketing content (title, description, tags, media)
  canEditProductPrice: boolean;    // Price & cost mutations
  canDeleteProducts: boolean;

  // Inventory
  canViewInventory: boolean;
  canEditInventory: boolean;

  // Orders & Fulfilment
  canViewOrders: boolean;
  canUpdateOrderFulfilment: boolean;
  canCancelOrders: boolean;
  canRefundOrders: boolean;

  // Media
  canViewMedia: boolean;
  canUploadMedia: boolean;
  canDeleteMedia: boolean;

  // Collections & Categories
  canViewCollections: boolean;
  canEditCollections: boolean;
  canViewCategories: boolean;
  canEditCategories: boolean;

  // Discounts
  canViewDiscounts: boolean;
  canCreateDiscounts: boolean;
  canEditDiscounts: boolean;

  // Sales & Financials
  canViewSales: boolean;
  canExportSales: boolean;
  canViewFinancialDetails: boolean;

  // Customers & Privacy
  canViewCustomers: boolean;
  canViewSensitiveCustomers: boolean;

  // System, Settings & Partner Management
  canViewSettings: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;         // SUPER ADMIN ONLY
  canManageSecurity: boolean;      // SUPER ADMIN ONLY
  canManagePayfastConfig: boolean; // SUPER ADMIN ONLY

  // Activity Log
  canViewActivityLog: boolean;
}

export const ROLE_DISPLAY_NAMES: Record<CanonicalAdminRole, string> = {
  super_admin: 'Founder / Super Admin',
  operations: 'Operations & Production',
  marketing: 'Creative & Marketing',
  finance: 'Finance Partner',
};

export const ROLE_BADGES: Record<CanonicalAdminRole, string> = {
  super_admin: 'SA',
  operations: 'OP',
  marketing: 'MK',
  finance: 'FN',
};

export function normalizeAdminRole(role?: string | null): CanonicalAdminRole {
  if (!role) return 'operations';
  const clean = role.toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (clean === 'super_admin' || clean === 'superadmin' || clean === 'owner') return 'super_admin';
  if (clean === 'operations' || clean === 'production' || clean === 'ops') return 'operations';
  if (clean === 'marketing' || clean === 'design' || clean === 'mkt' || clean === 'creative') return 'marketing';
  if (clean === 'finance' || clean === 'financial' || clean === 'capital') return 'finance';
  if (clean === 'admin') return 'super_admin';
  if (clean === 'manager' || clean === 'staff') return 'operations';
  return 'operations';
}

export const CANONICAL_ROLE_PERMISSIONS: Record<CanonicalAdminRole, RolePermissions> = {
  super_admin: {
    canViewProducts: true,
    canCreateProducts: true,
    canEditProducts: true,
    canEditProductContent: true,
    canEditProductPrice: true,
    canDeleteProducts: true,
    canViewInventory: true,
    canEditInventory: true,
    canViewOrders: true,
    canUpdateOrderFulfilment: true,
    canCancelOrders: true,
    canRefundOrders: true,
    canViewMedia: true,
    canUploadMedia: true,
    canDeleteMedia: true,
    canViewCollections: true,
    canEditCollections: true,
    canViewCategories: true,
    canEditCategories: true,
    canViewDiscounts: true,
    canCreateDiscounts: true,
    canEditDiscounts: true,
    canViewSales: true,
    canExportSales: true,
    canViewFinancialDetails: true,
    canViewCustomers: true,
    canViewSensitiveCustomers: true,
    canViewSettings: true,
    canManageSettings: true,
    canManageUsers: true,
    canManageSecurity: true,
    canManagePayfastConfig: true,
    canViewActivityLog: true,
  },

  operations: {
    canViewProducts: true,
    canCreateProducts: true,
    canEditProducts: true,
    canEditProductContent: true,
    canEditProductPrice: false, // Super Admin only
    canDeleteProducts: false,   // Super Admin only
    canViewInventory: true,
    canEditInventory: true,
    canViewOrders: true,
    canUpdateOrderFulfilment: true,
    canCancelOrders: false,     // Super Admin only
    canRefundOrders: false,     // Super Admin only
    canViewMedia: true,
    canUploadMedia: true,
    canDeleteMedia: false,
    canViewCollections: true,   // View allowed
    canEditCollections: false,  // Creative & Marketing only
    canViewCategories: true,    // View allowed
    canEditCategories: false,   // Creative & Marketing only
    canViewDiscounts: true,     // View allowed
    canCreateDiscounts: false,
    canEditDiscounts: false,
    canViewSales: true,         // View allowed
    canExportSales: true,
    canViewFinancialDetails: false,
    canViewCustomers: true,
    canViewSensitiveCustomers: false, // Disclose address only in order fulfilment
    canViewSettings: false,
    canManageSettings: false,
    canManageUsers: false,
    canManageSecurity: false,
    canManagePayfastConfig: false,
    canViewActivityLog: true,
  },

  marketing: {
    canViewProducts: true,
    canCreateProducts: true,
    canEditProducts: false,        // Cannot edit pricing/variants
    canEditProductContent: true,   // Can edit content, titles, descriptions, media
    canEditProductPrice: false,    // Super Admin only
    canDeleteProducts: false,      // Super Admin only
    canViewInventory: true,       // View allowed (read-only)
    canEditInventory: false,      // Operations only
    canViewOrders: true,          // View allowed (read-only)
    canUpdateOrderFulfilment: false, // Operations only
    canCancelOrders: false,
    canRefundOrders: false,
    canViewMedia: true,
    canUploadMedia: true,
    canDeleteMedia: false,
    canViewCollections: true,
    canEditCollections: true,     // Creative & Marketing edit allowed
    canViewCategories: true,
    canEditCategories: true,      // Creative & Marketing edit allowed
    canViewDiscounts: true,        // View allowed
    canCreateDiscounts: false,
    canEditDiscounts: false,
    canViewSales: true,            // View allowed
    canExportSales: true,
    canViewFinancialDetails: false,
    canViewCustomers: true,        // View allowed (PII masked)
    canViewSensitiveCustomers: false,
    canViewSettings: false,
    canManageSettings: false,
    canManageUsers: false,
    canManageSecurity: false,
    canManagePayfastConfig: false,
    canViewActivityLog: true,
  },

  finance: {
    canViewProducts: true,
    canCreateProducts: false,
    canEditProducts: false,
    canEditProductContent: false,
    canEditProductPrice: false,
    canDeleteProducts: false,
    canViewInventory: true,
    canEditInventory: false,
    canViewOrders: true,
    canUpdateOrderFulfilment: false,
    canCancelOrders: false,
    canRefundOrders: false,
    canViewMedia: false,
    canUploadMedia: false,
    canDeleteMedia: false,
    canViewCollections: false,
    canEditCollections: false,
    canViewCategories: false,
    canEditCategories: false,
    canViewDiscounts: true,
    canCreateDiscounts: false,
    canEditDiscounts: false,
    canViewSales: true,
    canExportSales: true,
    canViewFinancialDetails: true,
    canViewCustomers: false,
    canViewSensitiveCustomers: false,
    canViewSettings: false,
    canManageSettings: false,
    canManageUsers: false,
    canManageSecurity: false,
    canManagePayfastConfig: false,
    canViewActivityLog: true,
  },
};

/**
 * Standard Permission Mapping Table for string codes (e.g. 'products.edit', 'inventory.edit')
 */
export type PermissionString =
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.edit_content'
  | 'products.edit_price'
  | 'products.delete'
  | 'inventory.view'
  | 'inventory.edit'
  | 'orders.view'
  | 'orders.update_fulfilment'
  | 'orders.cancel'
  | 'orders.refund'
  | 'media.view'
  | 'media.upload'
  | 'media.delete'
  | 'collections.view'
  | 'collections.edit'
  | 'categories.view'
  | 'categories.edit'
  | 'discounts.view'
  | 'discounts.create'
  | 'discounts.edit'
  | 'sales.view'
  | 'sales.export'
  | 'sales.financial_details'
  | 'customers.view'
  | 'customers.view_sensitive'
  | 'settings'
  | 'settings.view'
  | 'settings.manage'
  | 'users'
  | 'users.manage'
  | 'security'
  | 'security.manage'
  | 'payfast_config'
  | 'activity.view'
  | keyof RolePermissions;

const PERMISSION_STRING_MAP: Record<string, keyof RolePermissions> = {
  'products.view': 'canViewProducts',
  'products.create': 'canCreateProducts',
  'products.edit': 'canEditProducts',
  'products.edit_content': 'canEditProductContent',
  'products.edit_price': 'canEditProductPrice',
  'products.delete': 'canDeleteProducts',
  'inventory.view': 'canViewInventory',
  'inventory.edit': 'canEditInventory',
  'orders.view': 'canViewOrders',
  'orders.update_fulfilment': 'canUpdateOrderFulfilment',
  'orders.cancel': 'canCancelOrders',
  'orders.refund': 'canRefundOrders',
  'media.view': 'canViewMedia',
  'media.upload': 'canUploadMedia',
  'media.delete': 'canDeleteMedia',
  'collections.view': 'canViewCollections',
  'collections.edit': 'canEditCollections',
  'categories.view': 'canViewCategories',
  'categories.edit': 'canEditCategories',
  'discounts.view': 'canViewDiscounts',
  'discounts.create': 'canCreateDiscounts',
  'discounts.edit': 'canEditDiscounts',
  'sales.view': 'canViewSales',
  'sales.export': 'canExportSales',
  'sales.financial_details': 'canViewFinancialDetails',
  'customers.view': 'canViewCustomers',
  'customers.view_sensitive': 'canViewSensitiveCustomers',
  'settings': 'canManageSettings',
  'settings.view': 'canViewSettings',
  'settings.manage': 'canManageSettings',
  'users': 'canManageUsers',
  'users.manage': 'canManageUsers',
  'security': 'canManageSecurity',
  'security.manage': 'canManageSecurity',
  'payfast_config': 'canManagePayfastConfig',
  'activity.view': 'canViewActivityLog',
};

/**
 * Universal Authorization helper for checking role or user permission
 */
export function hasPermission(
  roleOrUser: string | AdminUser | null | undefined,
  permission: PermissionString
): boolean {
  if (!roleOrUser) return false;
  
  // If user object passed with isActive === false, immediately deny
  if (typeof roleOrUser === 'object') {
    if (roleOrUser.isActive === false) return false;
    const normalizedRole = normalizeAdminRole(roleOrUser.role);
    const mappedKey = PERMISSION_STRING_MAP[permission] || (permission as keyof RolePermissions);
    return Boolean(CANONICAL_ROLE_PERMISSIONS[normalizedRole]?.[mappedKey]);
  }

  const normalizedRole = normalizeAdminRole(roleOrUser);
  const mappedKey = PERMISSION_STRING_MAP[permission] || (permission as keyof RolePermissions);
  return Boolean(CANONICAL_ROLE_PERMISSIONS[normalizedRole]?.[mappedKey]);
}

/**
 * Super Admin check helper
 */
export function isSuperAdmin(roleOrUser: string | AdminUser | null | undefined): boolean {
  if (!roleOrUser) return false;
  if (typeof roleOrUser === 'object') {
    if (roleOrUser.isActive === false) return false;
    return normalizeAdminRole(roleOrUser.role) === 'super_admin';
  }
  return normalizeAdminRole(roleOrUser) === 'super_admin';
}
