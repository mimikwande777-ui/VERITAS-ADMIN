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

      let status: 'ACTIVE' | 'INVITED' | 'DISABLED' = 'ACTIVE';
      if (!isActive) {
        status = 'DISABLED';
      } else if (authInfo?.invitedAt && !authInfo?.lastSignIn && !authInfo?.confirmedAt) {
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
      // Invite user by email using Supabase Auth Admin API
      const inviteRes = await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: name || email.split('@')[0].toUpperCase(),
          partner_role: role,
        },
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
  // SUPER ADMIN ONLY GATE
  const authCheck = await requireRole(request, 'super_admin');
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, role: newRoleInput, isActive } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Target userId is required.' },
        { status: 400 }
      );
    }

    // SELF PROTECTION: Super admin cannot disable or change role of own account
    if (userId === authCheck.admin.userId) {
      if (isActive === false || newRoleInput !== undefined) {
        return NextResponse.json(
          { success: false, error: 'Self-modification prevented: Founder / Super Admin cannot disable or modify their own account.' },
          { status: 400 }
        );
      }
    }

    // SERVER-SIDE ROLE RESTRICTION: Reject super_admin assignment
    if (newRoleInput !== undefined) {
      const normalizedRole = normalizeAdminRole(newRoleInput);
      if (normalizedRole === 'super_admin' || newRoleInput === 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Super Admin role assignment via role change is restricted.' },
          { status: 403 }
        );
      }
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server database client unavailable.' },
        { status: 500 }
      );
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (newRoleInput !== undefined) {
      updatePayload.role = normalizeAdminRole(newRoleInput);
    }

    if (isActive !== undefined) {
      updatePayload.is_active = Boolean(isActive);
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('admin_users')
      .update(updatePayload)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Partner account updated successfully.',
      partner: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update partner account.' },
      { status: 500 }
    );
  }
}
