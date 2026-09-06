'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { getSupabaseClient } from './supabase/client';
import { 
  AdminUser, 
  CanonicalAdminRole, 
  RolePermissions, 
  CANONICAL_ROLE_PERMISSIONS, 
  CURRENT_DEV_ADMIN, 
  normalizeAdminRole 
} from './auth-types';
import { recordAuditLog } from './supabase/audit';

interface AuthContextType {
  user: AdminUser | null;
  role: CanonicalAdminRole;
  permissions: RolePermissions;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDevBypass: boolean;
  toggleDevBypass: (enabled: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasAccess: (permission: keyof RolePermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Development bypass is strictly disabled
  const isDevBypass = false;
  const toggleDevBypass = useCallback((_enabled: boolean) => {
    console.warn('Development bypass is disabled. Authenticated Supabase session required.');
  }, []);

  // Initialize and listen to Supabase Auth state
  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();

    const resolveAdminFromSession = async (sessionUser: any): Promise<AdminUser | null> => {
      const email = sessionUser.email || '';
      let role: CanonicalAdminRole | null = null;

      // Verify authoritative role from public.admin_users if table exists
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
              .eq('email', email.trim().toLowerCase())
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
        return null;
      }
            
      const name = sessionUser.user_metadata?.full_name || 
                   sessionUser.user_metadata?.name || 
                   email.split('@')[0].toUpperCase();

      return {
        id: sessionUser.id,
        name,
        email,
        role,
        createdAt: sessionUser.created_at || new Date().toISOString(),
        lastActive: 'Just now',
      };
    };

    const initAuth = async () => {
      try {
        if (!client) {
          if (mounted) setIsLoading(false);
          return;
        }

        const { data: { session } } = await client.auth.getSession();

        if (session?.user) {
          const adminUser = await resolveAdminFromSession(session.user);
          if (adminUser) {
            if (mounted) {
              setUser(adminUser);
              // Ensure cookie is synchronized for middleware
              document.cookie = 'veritas_admin_session=active; path=/; max-age=604800; SameSite=Lax';
            }
          } else {
            await client.auth.signOut();
            if (mounted) setUser(null);
            document.cookie = 'veritas_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          }
        } else if (isDevBypass) {
          // Dev bypass fallback
          if (mounted) {
            setUser(CURRENT_DEV_ADMIN);
            document.cookie = 'veritas_admin_session=bypass; path=/; max-age=86400; SameSite=Lax';
          }
        } else {
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error('Error initializing Supabase Auth:', err);
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
            document.cookie = 'veritas_admin_session=active; path=/; max-age=604800; SameSite=Lax';
          } else {
            await client.auth.signOut();
            setUser(null);
            document.cookie = 'veritas_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          }
        } else {
          if (isDevBypass) {
            setUser(CURRENT_DEV_ADMIN);
            document.cookie = 'veritas_admin_session=bypass; path=/; max-age=86400; SameSite=Lax';
          } else {
            setUser(null);
            document.cookie = 'veritas_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          }
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
  }, [isDevBypass]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const client = getSupabaseClient();
    
    if (!client) {
      setIsLoading(false);
      return { 
        success: false, 
        error: 'Supabase authentication is not configured. Please define NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment settings.' 
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message || 'Invalid credentials' };
      }

      if (data.session?.user) {
        let role: CanonicalAdminRole | null = null;
        const emailAddress = data.session.user.email || email;

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
              .eq('email', emailAddress.trim().toLowerCase())
              .maybeSingle();
            if (adminEmailRecord?.role) {
              role = normalizeAdminRole(adminEmailRecord.role);
            }
          }
        } catch (dbErr) {
          console.warn('Could not query admin_users table for authoritative role:', dbErr);
        }

        if (!role) {
          await client.auth.signOut();
          setIsLoading(false);
          return { success: false, error: 'Unauthorized: User does not exist in public.admin_users.' };
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
        document.cookie = 'veritas_admin_session=active; path=/; max-age=604800; SameSite=Lax';

        // Record live audit log
        void recordAuditLog({
          action: 'auth.login',
          actionLabel: `Admin signed in: ${email} (${role.toUpperCase()})`,
          targetType: 'auth',
          targetId: adminUser.id,
          actorEmail: email,
          actorRole: role,
        });

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
      actionLabel: `Admin signed out: ${currentUserEmail}`,
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
      // Clear session cookie
      if (typeof window !== 'undefined') {
        localStorage.removeItem('veritas_admin_dev_bypass');
        document.cookie = 'veritas_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
    }
  }, [user]);

  const currentRole: CanonicalAdminRole = user?.role ? normalizeAdminRole(user.role) : 'manager';
  const permissions: RolePermissions = CANONICAL_ROLE_PERMISSIONS[currentRole];

  const hasAccess = useCallback((permission: keyof RolePermissions): boolean => {
    return !!permissions[permission];
  }, [permissions]);

  const isAuthenticated = Boolean(user !== null);

  const contextValue = useMemo(() => ({
    user,
    role: currentRole,
    permissions,
    isLoading,
    isAuthenticated,
    isDevBypass,
    toggleDevBypass,
    signIn,
    signOut,
    hasAccess,
  }), [user, currentRole, permissions, isLoading, isAuthenticated, isDevBypass, toggleDevBypass, signIn, signOut, hasAccess]);

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

