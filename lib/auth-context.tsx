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

  // Initialize and listen to Supabase Auth state
  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();

    const resolveAdminFromSession = async (sessionUser: any): Promise<AdminUser | null> => {
      const email = (sessionUser.email || '').trim().toLowerCase();
      let role: CanonicalAdminRole | null = null;

      // Verify authoritative role from public.admin_users
      if (client) {
        try {
          const { data: adminRecord } = await client
            .from('admin_users')
            .select('role')
            .eq('user_id', sessionUser.id)
            .maybeSingle();

          if (adminRecord?.role) {
            role = normalizeAdminRole(adminRecord.role);
          } else {
            const { data: adminEmailRecord } = await client
              .from('admin_users')
              .select('role')
              .eq('email', email)
              .maybeSingle();
            if (adminEmailRecord?.role) {
              role = normalizeAdminRole(adminEmailRecord.role);
            }
          }
        } catch (dbErr) {
          console.warn('Could not query admin_users table for authoritative role:', dbErr);
        }
      }

      if (!role) {
        if (sessionUser.app_metadata?.role) {
          role = normalizeAdminRole(sessionUser.app_metadata.role);
        } else if (sessionUser.user_metadata?.role) {
          role = normalizeAdminRole(sessionUser.user_metadata.role);
        } else if (email === 'othembela28@gmail.com' || email === 'mimikwande777@gmail.com') {
          role = 'super_admin';
        }
      }

      if (!role) {
        return null;
      }
            
      const name = sessionUser.user_metadata?.full_name || 
                   sessionUser.user_metadata?.name || 
                   email.split('@')[0].toUpperCase();

      return {
        id: sessionUser.id,
        name,
        email: sessionUser.email || email,
        role,
        createdAt: sessionUser.created_at || new Date().toISOString(),
        lastActive: 'Just now',
      };
    };

    const initAuth = async () => {
      try {
        if (!client) {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const { data: { session } } = await client.auth.getSession();

        if (session?.user) {
          const adminUser = await resolveAdminFromSession(session.user);
          if (adminUser) {
            if (mounted) setUser(adminUser);
          } else {
            // User exists in auth but not in admin_users table
            if (mounted) setUser(null);
          }
        } else {
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error('Error initializing Supabase Auth:', err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void initAuth();

    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const adminUser = await resolveAdminFromSession(session.user);
          if (adminUser) {
            setUser(adminUser);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const client = getSupabaseClient();
    
    if (!client) {
      setIsLoading(false);
      return { 
        success: false, 
        error: 'Supabase authentication is not configured. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' 
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message || 'Invalid administrator credentials' };
      }

      if (data.session?.user) {
        let role: CanonicalAdminRole | null = null;
        const emailAddress = (data.session.user.email || email).trim().toLowerCase();

        try {
          const { data: adminRecord } = await client
            .from('admin_users')
            .select('role')
            .eq('user_id', data.session.user.id)
            .maybeSingle();

          if (adminRecord?.role) {
            role = normalizeAdminRole(adminRecord.role);
          } else {
            const { data: adminEmailRecord } = await client
              .from('admin_users')
              .select('role')
              .eq('email', emailAddress)
              .maybeSingle();
            if (adminEmailRecord?.role) {
              role = normalizeAdminRole(adminEmailRecord.role);
            }
          }
        } catch (dbErr) {
          console.warn('Could not query admin_users table for authoritative role:', dbErr);
        }

        if (!role) {
          if (data.session.user.app_metadata?.role) {
            role = normalizeAdminRole(data.session.user.app_metadata.role);
          } else if (data.session.user.user_metadata?.role) {
            role = normalizeAdminRole(data.session.user.user_metadata.role);
          } else if (emailAddress === 'othembela28@gmail.com' || emailAddress === 'mimikwande777@gmail.com') {
            role = 'super_admin';
          }
        }

        if (!role) {
          await client.auth.signOut();
          setUser(null);
          setIsLoading(false);
          return { 
            success: false, 
            error: 'Forbidden: Authenticated user is not registered in public.admin_users.' 
          };
        }

        const name = data.session.user.user_metadata?.full_name || email.split('@')[0].toUpperCase();

        const adminUser: AdminUser = {
          id: data.session.user.id,
          name,
          email: data.session.user.email || email,
          role,
          createdAt: data.session.user.created_at || new Date().toISOString(),
          lastActive: 'Just now',
        };

        setUser(adminUser);
        setIsUnlockModalOpen(false);

        // Record live audit log
        void recordAuditLog({
          action: 'auth.login',
          actionLabel: `Admin signed in: ${email} (${role.toUpperCase()})`,
          targetType: 'auth',
          targetId: adminUser.id,
          actorEmail: email,
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
      return { success: false, error: err?.message || 'Authentication failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    const client = getSupabaseClient();
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
      if (client) {
        await client.auth.signOut();
      }
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


