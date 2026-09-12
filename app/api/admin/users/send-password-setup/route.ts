import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { normalizeAdminRole } from '@/lib/auth-types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. SUPER ADMIN ONLY GATE
  const authCheck = await requireRole(request, 'super_admin');
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserIdInput = (body.userId || body.targetUserId || '').trim();
    const rawEmailInput = (body.email || '').trim().toLowerCase();

    if (!targetUserIdInput && !rawEmailInput) {
      return NextResponse.json(
        { success: false, error: 'Target partner userId or email is required.' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server database client unavailable.' },
        { status: 500 }
      );
    }

    // 2. Locate target membership in public.admin_users
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
      return NextResponse.json(
        { success: false, error: 'Target partner record not found in admin_users.' },
        { status: 404 }
      );
    }

    const targetUserId = existingMembership.user_id;
    const existingRole = normalizeAdminRole(existingMembership.role);

    // 3. Security: Role must be operations or marketing (founder account unaffected)
    if (!['operations', 'marketing'].includes(existingRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Password setup is only available for Operations and Marketing partners.' },
        { status: 403 }
      );
    }

    // Prevent self-action on super_admin
    if (targetUserId === authCheck.admin.userId) {
      return NextResponse.json(
        { success: false, error: 'Self-modification prevented: Founder / Super Admin cannot use partner password setup flow.' },
        { status: 400 }
      );
    }

    // 4. Resolve partner email
    let partnerEmail = rawEmailInput;
    if (!partnerEmail) {
      const { data: authUserData } = await serviceClient.auth.admin.getUserById(targetUserId);
      if (authUserData?.user?.email) {
        partnerEmail = authUserData.user.email.toLowerCase();
      } else {
        const { data: listData } = await serviceClient.auth.admin.listUsers();
        const found = listData?.users?.find(u => u.id === targetUserId);
        partnerEmail = found?.email?.toLowerCase() || '';
      }
    }

    if (!partnerEmail || !partnerEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Unable to resolve partner email address.' },
        { status: 400 }
      );
    }

    // 5. Build stable production redirect URL
    const adminAppUrl = 
      process.env.ADMIN_APP_URL || 
      process.env.NEXT_PUBLIC_SITE_URL || 
      'https://veritas-admin-three.vercel.app';
    
    const cleanBaseUrl = adminAppUrl.split('?')[0].replace(/\/$/, '');
    const redirectTo = `${cleanBaseUrl}/auth/confirm?next=/auth/setup-password`;

    console.log(`[SEND_PASSWORD_SETUP] Initiating password setup email for ${partnerEmail} with redirectTo: ${redirectTo}`);

    // 6. Supabase supported password setup/recovery flow for confirmed users
    const { error: resetErr } = await serviceClient.auth.resetPasswordForEmail(partnerEmail, {
      redirectTo,
    });

    if (resetErr) {
      console.error('[SEND_PASSWORD_SETUP_ERROR]', resetErr.message);
      return NextResponse.json(
        { success: false, error: resetErr.message || 'Failed to send password setup email.' },
        { status: 500 }
      );
    }

    console.log(`[SEND_PASSWORD_SETUP_SUCCESS] Password setup email dispatched to ${partnerEmail}`);

    return NextResponse.json({
      success: true,
      email: partnerEmail,
      userId: targetUserId,
      role: existingRole,
      message: `Password setup email sent to ${partnerEmail}.`,
    });
  } catch (err: any) {
    console.error('[SEND_PASSWORD_SETUP_EXCEPTION]', err?.message);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error during password setup dispatch.' },
      { status: 500 }
    );
  }
}
