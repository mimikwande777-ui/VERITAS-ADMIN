import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { normalizeAdminRole } from '@/lib/auth-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  console.log('[LEGACY_REISSUE_START] POST /api/admin/users/reissue-invite request received');

  // 1. SUPER ADMIN ONLY GATE (Server Security - Section 4)
  const authCheck = await requireRole(request, 'super_admin');
  if (!authCheck.authorized) {
    console.error('[LEGACY_REISSUE_FAIL] Auth check failed: requester is not super_admin');
    return authCheck.errorResponse; // Returns 403 Forbidden for non-super_admin (Tests F & G)
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserIdInput = (body.userId || body.targetUserId || '').trim();
    const rawEmailInput = (body.email || '').trim().toLowerCase();

    if (!targetUserIdInput && !rawEmailInput) {
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'userId or email is required for reissue.'
        },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      console.error('[LEGACY_REISSUE_FAIL] Service role client unavailable');
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Server database client unavailable.'
        },
        { status: 500 }
      );
    }

    // Step 1: Locate membership in public.admin_users
    let existingMembership: { id: string; user_id: string; role: string; is_active: boolean } | null = null;

    if (targetUserIdInput) {
      const { data, error } = await serviceClient
        .from('admin_users')
        .select('id, user_id, role, is_active')
        .eq('user_id', targetUserIdInput)
        .maybeSingle();
      if (!error && data) {
        existingMembership = data;
      }
    }

    if (!existingMembership && rawEmailInput) {
      const { data: listData } = await serviceClient.auth.admin.listUsers();
      const match = listData?.users?.find(u => u.email?.toLowerCase() === rawEmailInput);
      if (match) {
        const { data, error } = await serviceClient
          .from('admin_users')
          .select('id, user_id, role, is_active')
          .eq('user_id', match.id)
          .maybeSingle();
        if (!error && data) {
          existingMembership = data;
        }
      }
    }

    if (!existingMembership) {
      console.error(`[LEGACY_REISSUE_FAIL] Target membership record not found for query userId=${targetUserIdInput}, email=${rawEmailInput}`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Target membership record not found in admin_users.'
        },
        { status: 404 }
      );
    }

    const targetUserId = existingMembership.user_id;
    const existingRole = normalizeAdminRole(existingMembership.role);

    console.log(`[TARGET_MEMBERSHIP_FOUND] Found membership ID: ${existingMembership.id}, user_id: ${targetUserId}, role: ${existingRole}`);

    // Server Security Check - Section 4: Role must be operations or marketing
    if (!['operations', 'marketing'].includes(existingRole)) {
      console.error(`[LEGACY_REISSUE_FAIL] Target role '${existingRole}' is not eligible for repair (must be operations or marketing)`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Forbidden: Only Operations and Marketing partners can be repaired.'
        },
        { status: 403 }
      );
    }

    // Prevent self-reissue or super_admin repair
    if (targetUserId === authCheck.admin.userId) {
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Self-reissue prevented: Founder / Super Admin account cannot be reissued.'
        },
        { status: 400 }
      );
    }

    // Step 2: Load Auth User
    let oldAuthUser: any = null;
    const { data: authUserData, error: authUserErr } = await serviceClient.auth.admin.getUserById(targetUserId);
    if (!authUserErr && authUserData?.user) {
      oldAuthUser = authUserData.user;
    } else {
      const { data: listData } = await serviceClient.auth.admin.listUsers();
      oldAuthUser = listData?.users?.find(u => u.id === targetUserId || (rawEmailInput && u.email?.toLowerCase() === rawEmailInput)) || null;
    }

    if (!oldAuthUser) {
      console.error(`[LEGACY_REISSUE_FAIL] Old Auth user not found for user_id: ${targetUserId}`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Old auth user identity not found in Supabase Auth.'
        },
        { status: 404 }
      );
    }

    // Server Security Check - Section 4: User must be unconfirmed (confirmed_at == null)
    const isConfirmed = Boolean(oldAuthUser.email_confirmed_at || oldAuthUser.confirmed_at);
    if (isConfirmed) {
      console.error(`[LEGACY_REISSUE_FAIL] User ${oldAuthUser.email} is already confirmed.`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Target partner account is already active and confirmed.'
        },
        { status: 400 }
      );
    }

    const targetEmail = (oldAuthUser.email || rawEmailInput).trim().toLowerCase();
    const fullName = oldAuthUser.user_metadata?.full_name || oldAuthUser.user_metadata?.name || targetEmail.split('@')[0].toUpperCase();
    const preservedRole = existingRole as 'operations' | 'marketing';

    console.log(`[AUTH_USER_LOADED] Loaded target email: ${targetEmail}, old UUID: ${targetUserId}, role: ${preservedRole}`);
    console.log(`[ELIGIBILITY_CONFIRMED] Target partner eligible for legacy invite repair.`);

    // Step 3: Delete stale unconfirmed Auth user & DB row
    console.log(`[OLD_AUTH_DELETE_START] Deleting old membership and auth user ID: ${targetUserId}`);

    await serviceClient
      .from('admin_users')
      .delete()
      .eq('user_id', targetUserId);

    if (existingMembership.id) {
      await serviceClient
        .from('admin_users')
        .delete()
        .eq('id', existingMembership.id);
    }

    const { error: deleteAuthErr } = await serviceClient.auth.admin.deleteUser(targetUserId);
    if (deleteAuthErr) {
      console.warn(`[OLD_AUTH_DELETE_WARN] deleteUser warning: ${deleteAuthErr.message}`);
    }

    // Verify old Auth user is actually gone
    const { data: checkOldData } = await serviceClient.auth.admin.getUserById(targetUserId);
    if (checkOldData?.user && checkOldData.user.id === targetUserId) {
      console.error(`[OLD_AUTH_DELETE_FAILED] Old Auth UUID ${targetUserId} still exists!`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: false,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: `Failed to remove old Auth user (${targetUserId}).`
        },
        { status: 500 }
      );
    }

    // Check residual user with targetEmail
    const { data: listAfterDelete } = await serviceClient.auth.admin.listUsers();
    const residualUser = listAfterDelete?.users?.find(u => u.email?.toLowerCase() === targetEmail);
    if (residualUser) {
      console.log(`[OLD_AUTH_DELETE_CLEANUP] Deleting residual auth user ${residualUser.id}`);
      await serviceClient.auth.admin.deleteUser(residualUser.id);
      await serviceClient.from('admin_users').delete().eq('user_id', residualUser.id);
    }

    console.log(`[OLD_AUTH_DELETE_SUCCESS] Verified old Auth user ${targetUserId} removed.`);

    // Step 4: Call inviteUserByEmail
    console.log(`[INVITE_USER_START] Calling inviteUserByEmail for email: ${targetEmail}`);

    const adminAppUrl = 
      process.env.ADMIN_APP_URL || 
      process.env.NEXT_PUBLIC_SITE_URL || 
      'https://veritas-admin-three.vercel.app';
    const cleanBaseUrl = adminAppUrl.split('?')[0].replace(/\/$/, '');
    const redirectTo = `${cleanBaseUrl}/auth/confirm?next=/auth/setup-password`;

    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      targetEmail,
      {
        data: {
          full_name: fullName,
          partner_role: preservedRole,
        },
        redirectTo,
      }
    );

    if (inviteError || !inviteData?.user || !inviteData.user.id) {
      console.error(`[INVITE_USER_FAILED] inviteUserByEmail error: ${inviteError?.message || 'No user object'}`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: true,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: inviteError?.message || 'Failed to issue invitation via Supabase Auth Admin.'
        },
        { status: 500 }
      );
    }

    const newAuthUser = inviteData.user;
    const newUserId = newAuthUser.id;

    if (newUserId === targetUserId) {
      console.error(`[INVITE_USER_FAILED] Returned Auth UUID matches old UUID ${targetUserId}`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: true,
          newUserCreated: false,
          inviteIssued: false,
          membershipCreated: false,
          error: 'Returned Auth UUID is identical to old UUID.'
        },
        { status: 500 }
      );
    }

    console.log(`[INVITE_USER_SUCCESS] Invite sent. New Auth UUID: ${newUserId}`);

    // Step 5: Recreate public.admin_users membership using NEW Auth UUID
    console.log(`[NEW_MEMBERSHIP_CREATE_START] Inserting admin_users row for new UUID ${newUserId}`);

    const { data: newMembership, error: insertErr } = await serviceClient
      .from('admin_users')
      .insert({
        user_id: newUserId,
        role: preservedRole,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, user_id, role, is_active')
      .single();

    if (insertErr || !newMembership) {
      console.error(`[NEW_MEMBERSHIP_CREATE_FAILED] Insert error: ${insertErr?.message}`);
      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: true,
          newUserCreated: true,
          inviteIssued: true,
          membershipCreated: false,
          error: insertErr?.message || 'Failed to insert public.admin_users record.'
        },
        { status: 500 }
      );
    }

    console.log(`[NEW_MEMBERSHIP_CREATE_SUCCESS] Created admin_users row ID: ${newMembership.id}`);

    // Step 6: Live Verification
    console.log(`[POST_REISSUE_VERIFY_START] Verifying live records for new UUID ${newUserId}`);

    const { data: liveAuthCheck } = await serviceClient.auth.admin.getUserById(newUserId);
    const liveUser = liveAuthCheck?.user;

    const liveUuidDifferent = Boolean(liveUser && liveUser.id === newUserId && newUserId !== targetUserId);
    const liveEmailMatches = Boolean(liveUser && liveUser.email?.toLowerCase() === targetEmail.toLowerCase());
    const liveInvitedAtNotNull = Boolean(liveUser && liveUser.invited_at !== null && liveUser.invited_at !== undefined);
    const liveConfirmedAtNull = Boolean(liveUser && !liveUser.email_confirmed_at && !liveUser.confirmed_at);

    const { data: liveMembershipCheck } = await serviceClient
      .from('admin_users')
      .select('user_id, role, is_active')
      .eq('user_id', newUserId)
      .maybeSingle();

    const liveMembershipValid = Boolean(
      liveMembershipCheck &&
      liveMembershipCheck.user_id === newUserId &&
      normalizeAdminRole(liveMembershipCheck.role) === preservedRole &&
      liveMembershipCheck.is_active === true
    );

    if (!liveUuidDifferent || !liveEmailMatches || !liveInvitedAtNotNull || !liveConfirmedAtNull || !liveMembershipValid) {
      console.error('[POST_REISSUE_VERIFY_FAILED] Live verification failed!', {
        liveUuidDifferent,
        liveEmailMatches,
        liveInvitedAtNotNull,
        liveConfirmedAtNull,
        liveMembershipValid,
      });

      return NextResponse.json(
        {
          success: false,
          oldUserRemoved: true,
          newUserCreated: true,
          inviteIssued: false,
          membershipCreated: liveMembershipValid,
          error: 'Post-reissue live verification failed.'
        },
        { status: 500 }
      );
    }

    console.log(`[POST_REISSUE_VERIFY_SUCCESS] Live verification passed for ${newUserId}`);
    console.log(`[LEGACY_REISSUE_COMPLETE] Legacy invite repair completed successfully for ${targetEmail}`);

    return NextResponse.json({
      success: true,
      oldUserRemoved: true,
      newUserCreated: true,
      inviteIssued: true,
      membershipCreated: true,
      oldUserId: targetUserId,
      newUserId: newUserId,
      email: targetEmail,
      role: preservedRole,
      message: 'Invitation email sent.'
    });

  } catch (err: any) {
    console.error('[LEGACY_REISSUE_EXCEPTION] Exception:', err?.message);
    return NextResponse.json(
      {
        success: false,
        oldUserRemoved: false,
        newUserCreated: false,
        inviteIssued: false,
        membershipCreated: false,
        error: err?.message || 'Server error during legacy invite repair.'
      },
      { status: 500 }
    );
  }
}
