'use client';

/**
 * VERITAS ADMIN AUTHENTICATION & AUTHORIZATION CONTEXT
 * 
 * Supports:
 * - Direct dashboard shell entry without initial login wall
 * - Modal-based "Unlock Admin" flow backed by real Supabase Authentication
 * - Server-side verification via requireAdmin() querying public.admin_users
 * - Session persistence across page reloads and installed PWA
 * - Instant "Lock Admin / Sign Out" capability
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { getSupabaseClient } from './supabase/client';
import { 
  AdminUser, 
  CanonicalAdminRole, 
  RolePermissions, 
  CANONICAL_ROLE_PERMISSIONS, 
  normalizeAdminRole 
} from './auth-types';
import { recordAuditLog } from './supabase/audit';

interface AuthContextType {
  user: AdminUser | null;
  role: CanonicalAdminRole | null;
  permissions: RolePermissions;
  isLoading: boolean;
  isAuthenticated: boolean;
  isUnlockModalOpen: boolean;
  openUnlockModal: () => void;
  closeUnlockModal: () => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasAccess: (permission: keyof RolePermissions) => boolean;
}

const EMPTY_PERMISSIONS: RolePermissions = {
  canManageProducts: false,
  canPublishProducts: false,
  canManageInventory: false,
  canManageOrders: false,
  canSendToOTC: false,
  canViewSalesAnalytics: false,
  canManageCategories: false,
  canManageCollections: false,
  canManageMedia: false,
  canManageSettings: false,
  canManageDiscounts: false,
  canViewCustomers: false,
  canViewActivityLog: false,
  canManageAdmins: false,
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

  const openUnlockModal = useCallback(() => {
    setIsUnlockModalOpen(true);
  }, []);

  const closeUnlockModal = useCallback(() => {
    setIsUnlockModalOpen(false);
  }, []);

  // Initialize session by verifying HttpOnly cookie via server GET /api/admin/unlock
  useEffect(() => {
    let mounted = true;

    const checkServerSession = async () => {
      try {
        const res = await fetch('/api/admin/unlock', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            const role = normalizeAdminRole(data.user.role || 'admin');
            const adminUser: AdminUser = {
              id: data.user.id,
              name: data.user.name || data.user.email?.split('@')[0].toUpperCase(),
              email: data.user.email,
              role,
              createdAt: new Date().toISOString(),
              lastActive: 'Just now',
            };
            if (mounted) setUser(adminUser);
          } else {
            if (mounted) setUser(null);
          }
        } else {
          if (mounted) setUser(null);
        }
      } catch (err) {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void checkServerSession();

    const handleAuthChange = () => {
      void checkServerSession();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('veritas_admin_auth_changed', handleAuthChange);
    }

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('veritas_admin_auth_changed', handleAuthChange);
      }
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsLoading(false);
        return {
          success: false,
          error: data.error || 'Invalid administrator credentials.',
        };
      }

      if (data.user) {
        const role = normalizeAdminRole(data.user.role || 'admin');
        const adminUser: AdminUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role,
          createdAt: data.user.createdAt || new Date().toISOString(),
          lastActive: 'Just now',
        };

        setUser(adminUser);
        setIsUnlockModalOpen(false);

        // Record live audit log
        void recordAuditLog({
          action: 'auth.login',
          actionLabel: `Admin signed in via server unlock: ${adminUser.email} (${role.toUpperCase()})`,
          targetType: 'auth',
          targetId: adminUser.id,
          actorEmail: adminUser.email,
          actorRole: role,
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('veritas_admin_auth_changed'));
        }

        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: 'Failed to establish valid session.' };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Authentication request failed.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    const currentUserEmail = user?.email || 'admin@veritas.internal';
    const currentUserRole = user?.role || 'super_admin';

    // Record audit log
    void recordAuditLog({
      action: 'auth.logout',
      actionLabel: `Admin signed out / locked: ${currentUserEmail}`,
      targetType: 'auth',
      actorEmail: currentUserEmail,
      actorRole: currentUserRole,
    });

    try {
      await fetch('/api/admin/lock', {
        method: 'POST',
      });
    } catch (err) {
      console.error('SignOut error:', err);
    } finally {
      setUser(null);
      setIsUnlockModalOpen(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('veritas_admin_auth_changed'));
      }
      setIsLoading(false);
    }
  }, [user]);

  const currentRole: CanonicalAdminRole | null = user?.role ? normalizeAdminRole(user.role) : null;
  const permissions: RolePermissions = currentRole ? CANONICAL_ROLE_PERMISSIONS[currentRole] : EMPTY_PERMISSIONS;

  const hasAccess = useCallback((permission: keyof RolePermissions): boolean => {
    if (!user || !currentRole) return false;
    return !!CANONICAL_ROLE_PERMISSIONS[currentRole]?.[permission];
  }, [user, currentRole]);

  const isAuthenticated = Boolean(user && user.id);

  const contextValue = useMemo(() => ({
    user,
    role: currentRole,
    permissions,
    isLoading,
    isAuthenticated,
    isUnlockModalOpen,
    openUnlockModal,
    closeUnlockModal,
    signIn,
    signOut,
    hasAccess,
  }), [user, currentRole, permissions, isLoading, isAuthenticated, isUnlockModalOpen, openUnlockModal, closeUnlockModal, signIn, signOut, hasAccess]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

/**
 * Returns Authorization header with Supabase access token if user is signed in
 */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const client = getSupabaseClient();
  if (!client) return {};
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // ignore
  }
  return {};
}


