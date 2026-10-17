import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { 
  serverFetchContacts, 
  serverAdminUpdateContact, 
  serverAdminDeleteContact, 
  serverExportContactsCSV 
} from '@/lib/supabase/contacts-server';
import { hasPermission } from '@/lib/auth-types';
import { ContactFilterOptions } from '@/lib/contacts-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // 1. Authorize admin user
  const authCheck = await requireAdmin(request, { requiredPermission: 'canViewCustomers' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  const options: ContactFilterOptions = {
    search: searchParams.get('search') || undefined,
    status: (searchParams.get('status') as any) || 'all',
    emailConsent: (searchParams.get('emailConsent') as any) || 'all',
    whatsAppConsent: (searchParams.get('whatsAppConsent') as any) || 'all',
    whatsAppAvailable: (searchParams.get('whatsAppAvailable') as any) || 'all',
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
  };

  const serviceClient = createServiceRoleSupabaseClient();

  // 2. CSV Export Workflow with strict permission check
  if (format === 'csv') {
    const canExport = hasPermission(authCheck.admin.role, 'canExportContacts');
    if (!canExport) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Access Denied: Role '${authCheck.admin.role}' does not have permission to export customer contact CSV files.` 
        },
        { status: 403 }
      );
    }

    try {
      const csvData = await serverExportContactsCSV(options, serviceClient);
      const filename = `veritas-customer-contacts-${new Date().toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: err?.message || 'Failed to export CSV.' },
        { status: 500 }
      );
    }
  }

  // 3. Standard JSON query with stats
  try {
    const result = await serverFetchContacts(options, serviceClient);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      total: result.total,
      stats: result.stats
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch customer contacts.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  // Marketing and Super Admin have contact management rights
  const role = authCheck.admin.role;
  if (role !== 'super_admin' && role !== 'marketing') {
    return NextResponse.json(
      { success: false, error: `Access Denied: Role '${role}' cannot modify customer contacts.` },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Contact ID is required.' }, { status: 400 });
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    const result = await serverAdminUpdateContact(id, updates, serviceClient);

    if (result.error || !result.contact) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update contact.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: 'Contact updated successfully.',
      contact: result.contact
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error updating contact.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const role = authCheck.admin.role;
  // Hard delete (POPIA Right to be Forgotten) reserved for super_admin
  if (role !== 'super_admin') {
    return NextResponse.json(
      { success: false, error: `Access Denied: Hard deletion of customer records requires Super Admin authorization.` },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Contact ID is required for deletion.' }, { status: 400 });
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    const result = await serverAdminDeleteContact(id, serviceClient);

    if (result.error || !result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete contact.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: 'Contact record permanently deleted in accordance with data erasure rights.'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error during contact deletion.' },
      { status: 500 }
    );
  }
}
