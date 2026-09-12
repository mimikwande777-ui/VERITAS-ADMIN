import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { normalizeAdminRole } from '@/lib/auth-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // SUPER ADMIN ONLY GATE
  const authCheck = await requireRole(request, 'super_admin');
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server database configuration unavailable.' },
        { status: 500 }
      );
    }

    // 1. Fetch all records from public.admin_users
    const { data: adminRecords, error: dbError } = await serviceClient
      .from('admin_users')
      .select('id, user_id, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    // 2. Fetch Auth metadata to populate real emails, names, and invitation status
    const { data: authData, error: authListError } = await serviceClient.auth.admin.listUsers();
    const authUsersMap = new Map<string, { email?: string; lastSignIn?: string; confirmedAt?: string; invitedAt?: string; fullName?: string }>();

    if (!authListError && authData?.users) {
      for (const u of authData.users) {
        authUsersMap.set(u.id, {
          email: u.email,
          lastSignIn: u.last_sign_in_at || undefined,
          confirmedAt: u.email_confirmed_at || undefined,
          invitedAt: u.invited_at || undefined,
          fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        });
      }
    }

    // 3. Assemble clean partner admin roster
    const partners = (adminRecords || []).map((record) => {
      const authInfo = authUsersMap.get(record.user_id);
      const email = authInfo?.email || 'admin@veritas.internal';
      const name = authInfo?.fullName || email.split('@')[0].toUpperCase();
      const role = normalizeAdminRole(record.role);
      const isActive = record.is_active !== false;

      let status: 'ACTIVE' | 'INVITED' | 'LEGACY_NOT_SENT' | 'DISABLED' = 'ACTIVE';
      if (!isActive) {
        status = 'DISABLED';
      } else if (!authInfo?.confirmedAt && !authInfo?.invitedAt) {
        status = 'LEGACY_NOT_SENT';
      } else if (!authInfo?.confirmedAt && authInfo?.invitedAt) {
        status = 'INVITED';
      } else {
        status = 'ACTIVE';
      }

      return {
        id: record.id,
        userId: record.user_id,
        email,
        name,
        role,
        isActive,
        status,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        lastSignIn: authInfo?.lastSignIn || null,
        confirmedAt: authInfo?.confirmedAt || null,
        invitedAt: authInfo?.invitedAt || null,
        isSelf: record.user_id === authCheck.admin.userId,
      };
    });

    return NextResponse.json({
      success: true,
      count: partners.length,
      partners,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch admin team roster.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // 1. SUPER ADMIN ONLY GATE
  const authCheck = await requireRole(request, 'super_admin');
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const name = (body.name || '').trim();
    const rawRole = (body.role || '').trim().toLowerCase();
    const role = normalizeAdminRole(rawRole);

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid partner email address is required.' },
        { status: 400 }
      );
    }

    // 2. SERVER-SIDE ROLE RESTRICTION: Only operations or marketing allowed for partner creation
    if (rawRole === 'super_admin' || role === 'super_admin' || !['operations', 'marketing'].includes(role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden: Creation of super_admin role via partner invite is strictly prohibited. Allowed roles: operations, marketing.' 
        },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server database client unavailable.' },
        { status: 500 }
      );
    }

    // 3. DUPLICATE PROTECTION: Check if email already belongs to a Supabase Auth user or admin_users member
    const { data: authList } = await serviceClient.auth.admin.listUsers();
    const existingAuthUser = authList?.users?.find(u => u.email?.toLowerCase() === email);

    if (existingAuthUser) {
      const { data: existingAdminRecord } = await serviceClient
        .from('admin_users')
        .select('id, user_id, role, is_active')
        .eq('user_id', existingAuthUser.id)
        .maybeSingle();

      if (existingAdminRecord) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This user is already a VERITAS Admin member.' 
          },
          { status: 400 }
        );
      }
    }

    // 4. SAFE PARTNER INVITATION / AUTH CREATION
    let targetUserId = existingAuthUser?.id;

    if (!targetUserId) {
      const adminAppUrl = 
        process.env.ADMIN_APP_URL || 
        process.env.APP_URL || 
        process.env.NEXT_PUBLIC_SITE_URL || 
        'https://veritas-admin-three.vercel.app';
      const cleanBaseUrl = adminAppUrl.split('?')[0].replace(/\/$/, '');
      const redirectTo = `${cleanBaseUrl}/auth/confirm?next=/auth/setup-password`;

      // Invite user by email using Supabase Auth Admin API
      const inviteRes = await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: name || email.split('@')[0].toUpperCase(),
          partner_role: role,
        },
        redirectTo,
      });

      if (inviteRes.error || !inviteRes.data?.user) {
        // Fallback if SMTP / invite emails are unconfigured: create user with secure unexposed internal secret
        const generatedSecret = `VrtInv#${Math.random().toString(36).substring(2, 10).toUpperCase()}!2026`;
        const createRes = await serviceClient.auth.admin.createUser({
          email,
          password: generatedSecret,
          email_confirm: false,
          user_metadata: {
            full_name: name || email.split('@')[0].toUpperCase(),
            partner_role: role,
          },
        });

        if (createRes.error || !createRes.data?.user) {
          return NextResponse.json(
            { success: false, error: createRes.error?.message || inviteRes.error?.message || 'Failed to create partner auth identity.' },
            { status: 400 }
          );
        }

        targetUserId = createRes.data.user.id;
      } else {
        targetUserId = inviteRes.data.user.id;
      }
    }

    // 5. CREATE public.admin_users MEMBERSHIP ROW
    const { data: adminRecord, error: insertError } = await serviceClient
      .from('admin_users')
      .insert({
        user_id: targetUserId,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Partner invitation initiated successfully for ${email}.`,
      partner: {
        id: adminRecord.id,
        userId: targetUserId,
        email,
        name: name || email.split('@')[0].toUpperCase(),
        role,
        isActive: true,
        status: 'INVITED',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create partner account.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  console.log('[ADMIN_ROLE_CHANGE_START] PATCH /api/admin/users request received');

  // 1. SUPER ADMIN ONLY GATE
  const authCheck = await requireRole(request, 'super_admin');
  const authDuration = Date.now() - startTime;

  if (!authCheck.authorized) {
    console.log(`[ADMIN_ROLE_AUTHORIZED_FAIL] Authorization failed in ${authDuration}ms`);
    return authCheck.errorResponse;
  }

  console.log(`[ADMIN_ROLE_AUTHORIZED] Requester [${authCheck.admin.userId}] verified super_admin in ${authDuration}ms`);
  if (authDuration > 2000) {
    console.warn(`[ADMIN_ROLE_CHANGE_STAGE_SLOW] Auth verification stage took ${authDuration}ms`);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, role: rawRoleInput, isActive } = body;

    // Validate target user UUID
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json(
        { 
          success: false, 
          code: 'INVALID_TARGET_USER', 
          message: 'Target partner userId is required.' 
        },
        { status: 400 }
      );
    }

    const targetUserId = userId.trim();

    // SELF PROTECTION: Super admin cannot disable or change role of own account
    if (targetUserId === authCheck.admin.userId) {
      if (isActive === false || rawRoleInput !== undefined) {
        return NextResponse.json(
          { 
            success: false, 
            code: 'SELF_MODIFICATION_BLOCKED', 
            message: 'Self-modification prevented: Founder / Super Admin cannot modify or disable their own account.' 
          },
          { status: 400 }
        );
      }
    }

    // SERVER-SIDE ROLE RESTRICTION: Check requested role
    let targetRole: string | undefined = undefined;
    if (rawRoleInput !== undefined && rawRoleInput !== null) {
      const cleanRole = String(rawRoleInput).trim().toLowerCase();
      // Allowed roles for partner role update: strictly 'operations' or 'marketing'
      const ALLOWED_PARTNER_ROLES = ['operations', 'marketing'];

      if (!ALLOWED_PARTNER_ROLES.includes(cleanRole)) {
        return NextResponse.json(
          { 
            success: false, 
            code: 'FORBIDDEN_ROLE_ASSIGNMENT', 
            message: `Forbidden: Assigning role '${cleanRole}' is prohibited. Only 'operations' or 'marketing' roles are allowed for partners.` 
          },
          { status: 403 }
        );
      }

      targetRole = cleanRole;
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { 
          success: false, 
          code: 'DATABASE_CLIENT_ERROR', 
          message: 'Server database client unavailable.' 
        },
        { status: 500 }
      );
    }

    // Check existing public.admin_users record
    const { data: existingRecord, error: fetchError } = await serviceClient
      .from('admin_users')
      .select('id, user_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (fetchError || !existingRecord) {
      return NextResponse.json(
        { 
          success: false, 
          code: 'PARTNER_NOT_FOUND', 
          message: fetchError?.message || 'Specified partner user record was not found in admin_users.' 
        },
        { status: 404 }
      );
    }

    // NO-CHANGE PROTECTION
    const roleIsUnchanged = targetRole === undefined || targetRole === existingRecord.role.toLowerCase().trim();
    const activeIsUnchanged = isActive === undefined || Boolean(isActive) === existingRecord.is_active;

    if (roleIsUnchanged && activeIsUnchanged) {
      const durationMs = Date.now() - startTime;
      console.log(`[ADMIN_ROLE_CHANGE_NO_OP] Role/status unchanged for partner [${targetUserId}], returning early in ${durationMs}ms`);
      return NextResponse.json({
        success: true,
        unchanged: true,
        role: existingRecord.role,
        message: 'No changes detected. Record remains untouched.',
        durationMs,
      });
    }

    // DIRECT DATABASE UPDATE (NO AUTH API CALLS, NO EMAIL INVITES)
    console.log(`[ADMIN_ROLE_DB_UPDATE_START] Executing UPDATE on public.admin_users for userId: ${targetUserId}`);
    const dbUpdateStart = Date.now();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (targetRole !== undefined) {
      updatePayload.role = targetRole;
    }

    if (isActive !== undefined) {
      updatePayload.is_active = Boolean(isActive);
    }

    const { data: updatedRecord, error: updateError } = await serviceClient
      .from('admin_users')
      .update(updatePayload)
      .eq('user_id', targetUserId)
      .select('id, user_id, role, is_active, created_at, updated_at')
      .single();

    const dbUpdateDuration = Date.now() - dbUpdateStart;

    if (updateError) {
      console.error(`[ADMIN_ROLE_DB_UPDATE_FAILED] Failed after ${dbUpdateDuration}ms:`, updateError.message);
      return NextResponse.json(
        { 
          success: false, 
          code: 'ROLE_UPDATE_FAILED', 
          message: `Could not update partner role: ${updateError.message}` 
        },
        { status: 500 }
      );
    }

    console.log(`[ADMIN_ROLE_DB_UPDATE_SUCCESS] DB update completed in ${dbUpdateDuration}ms`);
    if (dbUpdateDuration > 2000) {
      console.warn(`[ADMIN_ROLE_CHANGE_STAGE_SLOW] DB update stage took ${dbUpdateDuration}ms`);
    }

    const totalDurationMs = Date.now() - startTime;
    console.log(`[ADMIN_ROLE_CHANGE_COMPLETE] Total role change request finished in ${totalDurationMs}ms`);
    if (totalDurationMs > 2000) {
      console.warn(`[ADMIN_ROLE_CHANGE_STAGE_SLOW] Total request processing took ${totalDurationMs}ms`);
    }

    return NextResponse.json({
      success: true,
      message: 'Partner role updated successfully.',
      partner: updatedRecord,
      durationMs: totalDurationMs,
    });
  } catch (err: any) {
    const totalDurationMs = Date.now() - startTime;
    console.error(`[ADMIN_ROLE_CHANGE_ERROR] Unhandled exception in ${totalDurationMs}ms:`, err?.message);
    return NextResponse.json(
      { 
        success: false, 
        code: 'ROLE_UPDATE_FAILED', 
        message: err?.message || 'Could not update partner role.' 
      },
      { status: 500 }
    );
  }
}
