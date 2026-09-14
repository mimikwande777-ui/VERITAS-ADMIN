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
  canEditProducts: boolean;             // Full master edit
  canEditProductContent: boolean;      // Content (title, description, tags, images, specs)
  canEditProductProduction: boolean;   // Production details (OTC sku, facility, gsm, composition)
  canEditProductPrice: boolean;        // Price, cost & compare-at mutations (Super Admin only)
  canPublishProducts: boolean;         // Publish / unpublish / archive (Super Admin only)
  canDeleteProducts: boolean;          // Permanent deletion (Super Admin only)

  // Inventory
  canViewInventory: boolean;
  canEditInventory: boolean;           // Stock counts & thresholds (Operations & Super Admin)

  // Orders & Fulfilment
  canViewOrders: boolean;
  canUpdateOrderFulfilment: boolean;   // Fulfilment status only (Operations & Super Admin)
  canUpdateOrderPayment: boolean;      // Payment status & financials (Super Admin only)
  canCancelOrders: boolean;            // Cancellation (Super Admin only)
  canRefundOrders: boolean;            // Refunds (Super Admin only)

  // Media
  canViewMedia: boolean;
  canUploadMedia: boolean;
  canDeleteMedia: boolean;

  // Collections & Categories
  canViewCollections: boolean;
  canEditCollections: boolean;         // Creative & Marketing and Super Admin
  canViewCategories: boolean;
  canEditCategories: boolean;          // Creative & Marketing and Super Admin

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
    canEditProductProduction: true,
    canEditProductPrice: true,
    canPublishProducts: true,
    canDeleteProducts: true,
    canViewInventory: true,
    canEditInventory: true,
    canViewOrders: true,
    canUpdateOrderFulfilment: true,
    canUpdateOrderPayment: true,
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
    canEditProducts: false,           // No broad unconstrained edits
    canEditProductContent: true,      // Name, description, tags, care
    canEditProductProduction: true,   // OTC specs, weight, composition, variants
    canEditProductPrice: false,       // Super Admin only (NO PRICE/COST ACCESS)
    canPublishProducts: false,        // Super Admin only (CANNOT PUBLISH)
    canDeleteProducts: false,         // Super Admin only (CANNOT DELETE)
    canViewInventory: true,
    canEditInventory: true,           // Allowed to update stock
    canViewOrders: true,
    canUpdateOrderFulfilment: true,   // Allowed to update fulfilment state only
    canUpdateOrderPayment: false,      // Super Admin only
    canCancelOrders: false,           // Super Admin only
    canRefundOrders: false,           // Super Admin only
    canViewMedia: true,
    canUploadMedia: true,             // Allowed to upload media
    canDeleteMedia: true,
    canViewCollections: true,         // VIEW ONLY
    canEditCollections: false,        // Cannot edit/create/delete collections
    canViewCategories: true,          // VIEW ONLY
    canEditCategories: false,         // Cannot edit/create/delete categories
    canViewDiscounts: true,           // VIEW ONLY
    canCreateDiscounts: false,
    canEditDiscounts: false,
    canViewSales: true,               // Allowed to view sales
    canExportSales: true,
    canViewFinancialDetails: false,
    canViewCustomers: true,
    canViewSensitiveCustomers: false, // Customer PII only disclosed in fulfilment context
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
    canEditProducts: false,           // No broad unconstrained edits
    canEditProductContent: true,      // Can edit marketing content, descriptions, images
    canEditProductProduction: false,  // Operations & Super Admin only
    canEditProductPrice: false,       // Super Admin only (NO PRICE/COST ACCESS)
    canPublishProducts: false,        // Super Admin only (CANNOT PUBLISH)
    canDeleteProducts: false,         // Super Admin only (CANNOT DELETE)
    canViewInventory: true,           // VIEW ONLY (no editing stock)
    canEditInventory: false,          // Operations only
    canViewOrders: true,              // VIEW ONLY
    canUpdateOrderFulfilment: false,  // Operations only
    canUpdateOrderPayment: false,     // Super Admin only
    canCancelOrders: false,
    canRefundOrders: false,
    canViewMedia: true,
    canUploadMedia: true,             // Can upload media
    canDeleteMedia: true,
    canViewCollections: true,
    canEditCollections: true,         // Creative & Marketing can create/edit/delete collections
    canViewCategories: true,
    canEditCategories: true,          // Creative & Marketing can create/edit/delete categories
    canViewDiscounts: true,           // VIEW ONLY
    canCreateDiscounts: false,
    canEditDiscounts: false,
    canViewSales: true,               // Allowed to view sales
    canExportSales: true,
    canViewFinancialDetails: false,
    canViewCustomers: true,           // VIEW ONLY (PII masked)
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
    canEditProductProduction: false,
    canEditProductPrice: false,
    canPublishProducts: false,
    canDeleteProducts: false,
    canViewInventory: true,
    canEditInventory: false,
    canViewOrders: true,
    canUpdateOrderFulfilment: false,
    canUpdateOrderPayment: false,
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
  | 'products.edit_production'
  | 'products.edit_price'
  | 'products.publish'
  | 'products.delete'
  | 'inventory.view'
  | 'inventory.edit'
  | 'orders.view'
  | 'orders.update_fulfilment'
  | 'orders.update_payment'
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
  'products.edit_production': 'canEditProductProduction',
  'products.edit_price': 'canEditProductPrice',
  'products.publish': 'canPublishProducts',
  'products.delete': 'canDeleteProducts',
  'inventory.view': 'canViewInventory',
  'inventory.edit': 'canEditInventory',
  'orders.view': 'canViewOrders',
  'orders.update_fulfilment': 'canUpdateOrderFulfilment',
  'orders.update_payment': 'canUpdateOrderPayment',
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
  roleOrUser: string | AdminUser | { role: CanonicalAdminRole | string; isActive?: boolean } | null | undefined,
  permission: PermissionString
): boolean {
  if (!roleOrUser) return false;
  
  // If user/admin object passed with isActive === false, immediately deny
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
export function isSuperAdmin(roleOrUser: string | AdminUser | { role: CanonicalAdminRole | string; isActive?: boolean } | null | undefined): boolean {
  if (!roleOrUser) return false;
  if (typeof roleOrUser === 'object') {
    if (roleOrUser.isActive === false) return false;
    return normalizeAdminRole(roleOrUser.role) === 'super_admin';
  }
  return normalizeAdminRole(roleOrUser) === 'super_admin';
}
