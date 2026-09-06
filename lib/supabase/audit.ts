import { getSupabaseClient } from './client';

export type AuditActionType = 
  | 'product.create'
  | 'product.update'
  | 'product.publish'
  | 'product.unpublish'
  | 'inventory.stock_change'
  | 'collection.toggle'
  | 'collection.create'
  | 'order.status_change'
  | 'media.upload'
  | 'media.delete'
  | 'auth.login'
  | 'auth.logout'
  | 'settings.update';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId?: string;
  actorEmail: string;
  actorRole: string;
  action: AuditActionType;
  actionLabel: string;
  targetType: 'product' | 'inventory' | 'collection' | 'order' | 'media' | 'category' | 'auth' | 'settings';
  targetId?: string;
  details?: Record<string, any> | string;
}

const STORAGE_KEY = 'veritas_live_audit_logs';

/**
 * Retrieves audit logs recorded in the current session / local cache
 */
export function getStoredAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Records an authentic administrative action
 */
export async function recordAuditLog(payload: {
  action: AuditActionType;
  actionLabel: string;
  targetType: 'product' | 'inventory' | 'collection' | 'order' | 'media' | 'category' | 'auth' | 'settings';
  targetId?: string;
  details?: Record<string, any> | string;
  actorEmail?: string;
  actorRole?: string;
}): Promise<AuditLogEntry> {
  const newEntry: AuditLogEntry = {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actorEmail: payload.actorEmail || 'admin@veritas.internal',
    actorRole: payload.actorRole || 'super_admin',
    action: payload.action,
    actionLabel: payload.actionLabel,
    targetType: payload.targetType,
    targetId: payload.targetId,
    details: payload.details,
  };

  // 1. Cache in browser storage for immediate UI visibility
  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredAuditLogs();
      const updated = [newEntry, ...existing].slice(0, 200);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage unavailable, continue
    }
  }

  // 2. Attempt persistence to Supabase if audit_logs table exists
  try {
    const client = getSupabaseClient();
    if (client) {
      void (async () => {
        try {
          await client.from('audit_logs').insert({
            actor_email: newEntry.actorEmail,
            actor_role: newEntry.actorRole,
            action: newEntry.action,
            target_type: newEntry.targetType,
            target_id: newEntry.targetId,
            details: typeof newEntry.details === 'object' ? newEntry.details : { message: newEntry.details },
            created_at: newEntry.timestamp,
          });
        } catch {
          // Supabase audit_logs table may not be migrated yet
        }
      })();
    }
  } catch {
    // Non-blocking
  }

  return newEntry;
}
