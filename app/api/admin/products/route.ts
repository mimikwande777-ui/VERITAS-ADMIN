import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { hasPermission } from '@/lib/auth-types';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { 
  serverCreateSupabaseProduct, 
  serverUpdateSupabaseProduct, 
  serverDeleteSupabaseProduct
} from '@/lib/supabase/products-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Field Group Definitions for Product Mutations
const CONTENT_FIELDS = new Set([
  'name', 'title', 'slug', 'description', 'short_description', 'shortDescription',
  'tags', 'design_name', 'designName', 'print_placement', 'printPlacement',
  'print_size', 'printSize', 'design_notes', 'designNotes',
  'care_instructions', 'careInstructions', 'category', 'categoryId', 'category_id',
  'collection', 'collectionId', 'collection_id', 'images', 'media', 'metadata'
]);

const PRODUCTION_FIELDS = new Set([
  'sizes', 'colours', 'colors', 'sku', 'otc_sku', 'otcSku',
  'otc_colorway', 'otcColorway', 'otc_facility', 'otcFacility',
  'weight_gsm', 'weightGsm', 'composition', 'dimensions',
  'cut', 'fit', 'neckline', 'fabric_weight', 'fabricWeight',
  'garment_specs', 'garmentSpecs'
]);

const PRICE_FIELDS = new Set([
  'price', 'selling_price', 'sellingPrice',
  'compare_at_price', 'compareAtPrice',
  'cost_price', 'costPrice'
]);

const PUBLISH_FIELDS = new Set([
  'published', 'status', 'active', 'is_active'
]);

const STOCK_FIELDS = new Set([
  'stock_quantity', 'stockQuantity',
  'low_stock_threshold', 'lowStockThreshold'
]);

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canCreateProducts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const admin = authCheck.admin;

  try {
    const body = await request.json();

    // Check for Price fields on creation
    const priceAttempted = Object.keys(body).some(k => PRICE_FIELDS.has(k) && body[k] !== undefined && Number(body[k]) > 0);
    if (priceAttempted && !hasPermission(admin, 'products.edit_price')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Setting product pricing or cost values requires products.edit_price permission.'
      }, { status: 403 });
    }

    // Check for Publish fields on creation
    const publishAttempted = body.published === true || (body.status && body.status.toLowerCase() === 'active');
    if (publishAttempted && !hasPermission(admin, 'products.publish')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Publishing products or setting status to ACTIVE requires products.publish permission. Products must be created as DRAFT.'
      }, { status: 403 });
    }

    // Check for Production fields on creation
    const productionAttempted = Object.keys(body).some(k => PRODUCTION_FIELDS.has(k) && body[k] !== undefined);
    if (productionAttempted && !hasPermission(admin, 'products.edit_production')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Defining technical production specifications requires products.edit_production permission.'
      }, { status: 403 });
    }

    // Check for Stock fields on creation
    const stockAttempted = Object.keys(body).some(k => STOCK_FIELDS.has(k) && body[k] !== undefined);
    if (stockAttempted && !hasPermission(admin, 'inventory.edit')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Modifying inventory stock quantities requires inventory.edit permission.'
      }, { status: 403 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
    }

    const { product, error } = await serverCreateSupabaseProduct(body, serviceClient);
    if (error || !product) {
      return NextResponse.json({ success: false, error: error || 'Failed to create product' }, { status: 400 });
    }

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error creating product' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const admin = authCheck.admin;

  try {
    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing product ID' }, { status: 400 });
    }

    // FIELD-LEVEL AUTHORIZATION CHECK
    // 1. Check PRICE field group
    const hasPriceFields = Object.keys(body).some(k => PRICE_FIELDS.has(k) && body[k] !== undefined) ||
      (Array.isArray(body.variants) && body.variants.some((v: any) => 
        v.price !== undefined || v.selling_price !== undefined || v.cost_price !== undefined || v.costPrice !== undefined || v.compare_at_price !== undefined || v.compareAtPrice !== undefined
      ));

    if (hasPriceFields && !hasPermission(admin, 'products.edit_price')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Modifying product pricing or cost values requires products.edit_price permission.'
      }, { status: 403 });
    }

    // 2. Check PUBLISH field group
    const hasPublishFields = Object.keys(body).some(k => PUBLISH_FIELDS.has(k) && body[k] !== undefined);
    if (hasPublishFields && !hasPermission(admin, 'products.publish')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Publishing, unpublishing, or changing product status requires products.publish permission.'
      }, { status: 403 });
    }

    // 3. Check PRODUCTION field group
    const hasProductionFields = Object.keys(body).some(k => PRODUCTION_FIELDS.has(k) && body[k] !== undefined) ||
      (Array.isArray(body.variants) && body.variants.some((v: any) => 
        v.size !== undefined || v.colour !== undefined || v.color !== undefined || v.sku !== undefined || v.weight_gsm !== undefined || v.composition !== undefined
      ));

    if (hasProductionFields && !hasPermission(admin, 'products.edit_production')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Modifying product production specifications or variant configuration requires products.edit_production permission.'
      }, { status: 403 });
    }

    // 4. Check STOCK field group
    const hasStockFields = Object.keys(body).some(k => STOCK_FIELDS.has(k) && body[k] !== undefined) ||
      (Array.isArray(body.variants) && body.variants.some((v: any) => 
        v.stock_quantity !== undefined || v.stockQuantity !== undefined || v.low_stock_threshold !== undefined || v.lowStockThreshold !== undefined
      ));

    if (hasStockFields && !hasPermission(admin, 'inventory.edit')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Modifying inventory stock quantities requires inventory.edit permission.'
      }, { status: 403 });
    }

    // 5. Check CONTENT field group
    const hasContentFields = Object.keys(body).some(k => CONTENT_FIELDS.has(k) && body[k] !== undefined);
    if (hasContentFields && !hasPermission(admin, 'products.edit_content')) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Modifying product content requires products.edit_content permission.'
      }, { status: 403 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
    }

    const { product, error } = await serverUpdateSupabaseProduct(id, body, serviceClient);
    if (error || !product) {
      return NextResponse.json({ success: false, error: error || 'Failed to update product' }, { status: 400 });
    }

    return NextResponse.json({ success: true, product }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error updating product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canDeleteProducts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const admin = authCheck.admin;
  if (!hasPermission(admin, 'products.delete')) {
    return NextResponse.json({
      success: false,
      error: 'Forbidden: Product deletion requires products.delete permission.'
    }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required for deletion' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
    }

    const result = await serverDeleteSupabaseProduct(id, serviceClient);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete product' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error deleting product' }, { status: 500 });
  }
}
