import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { hasPermission } from '@/lib/auth-types';
import { sanitizeCustomerForRole } from '@/lib/customer-privacy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canViewCustomers' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server authorization database client error.' },
        { status: 500 }
      );
    }

    // Retrieve customer profiles or unique customers from orders
    const { records } = await fetchFullOrdersFromSupabase(serviceClient);
    
    // Group orders by customer email/name
    const customerMap = new Map<string, {
      name: string;
      email: string;
      phone: string;
      orderCount: number;
      totalSpend: number;
      lastOrderDate: string;
    }>();

    for (const order of records || []) {
      const email = (order.customer?.email || '').toLowerCase().trim();
      if (!email) continue;

      const existing = customerMap.get(email);
      const orderTotal = Number(order.total) || 0;
      const orderDate = order.createdAt || order.date || '';

      if (existing) {
        existing.orderCount += 1;
        existing.totalSpend += orderTotal;
        if (orderDate && (!existing.lastOrderDate || orderDate > existing.lastOrderDate)) {
          existing.lastOrderDate = orderDate;
        }
      } else {
        customerMap.set(email, {
          name: order.customer?.name || 'Guest Customer',
          email,
          phone: order.customer?.phone || '',
          orderCount: 1,
          totalSpend: orderTotal,
          lastOrderDate: orderDate,
        });
      }
    }

    const canViewSensitive = hasPermission(authCheck.admin.role, 'canViewSensitiveCustomers');
    const rawCustomers = Array.from(customerMap.values());
    const sanitizedCustomers = rawCustomers.map(c => sanitizeCustomerForRole(c, canViewSensitive));

    return NextResponse.json({
      success: true,
      customers: sanitizedCustomers,
      count: sanitizedCustomers.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch customer data.' },
      { status: 500 }
    );
  }
}
