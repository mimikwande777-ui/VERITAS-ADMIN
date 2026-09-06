import { NextRequest, NextResponse } from 'next/server';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';
  const isEnvBypass = isDev && process.env.ADMIN_AUTH_BYPASS === 'true';

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const sessionCookie = request.cookies.get('veritas_admin_session')?.value;

  // Development bypass guard: strictly disabled in production
  const isDevBypassActive = isEnvBypass && (sessionCookie === 'bypass' || token === 'bypass');

  let activeClient: any = null;

  if (!isDevBypassActive) {
    if (!token && sessionCookie !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication token or session required.' },
        { status: 401 }
      );
    }

    if (token) {
      const serverClient = createServerSupabaseClient(token);
      if (!serverClient) {
        return NextResponse.json(
          { success: false, error: 'Server database configuration error.' },
          { status: 500 }
        );
      }

      // 1. Verify authenticated Supabase session
      const { data: { user }, error: authError } = await serverClient.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid or expired authentication token.' },
          { status: 401 }
        );
      }

      // 2. Authoritatively verify Admin membership and role in public.admin_users
      const { data: adminRecord, error: adminErr } = await serverClient
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (adminErr || !adminRecord || !['super_admin', 'admin', 'manager'].includes(adminRecord.role)) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: User is not an authorized administrator.' },
          { status: 403 }
        );
      }

      activeClient = serverClient;
    } else {
      // Browser session cookie without bearer token: use service role if configured
      const serviceClient = createServiceRoleSupabaseClient();
      if (!serviceClient) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'SUPABASE_SERVICE_ROLE_KEY must be configured in the server environment (or provide an active Admin authorization bearer token).' 
          },
          { status: 401 }
        );
      }
      activeClient = serviceClient;
    }
  } else {
    // Development bypass active (non-production only)
    activeClient = createServiceRoleSupabaseClient() || createServerSupabaseClient();
  }

  const { orders, records, error } = await fetchFullOrdersFromSupabase(activeClient);

  if (error) {
    return NextResponse.json({
      success: false,
      error,
      count: 0,
      orders: [],
      records: []
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      }
    });
  }

  return NextResponse.json({
    success: true,
    count: orders.length,
    orders,
    records
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    }
  });
}
