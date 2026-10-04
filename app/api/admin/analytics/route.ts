import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface AnalyticsSummary {
  timeframe: string;
  startDate: string;
  endDate: string;
  // Core Metrics
  visitorsCount: number;
  pageViewsCount: number;
  productViewsCount: number;
  addToCartCount: number;
  checkoutStartsCount: number;
  paidOrdersCount: number;
  revenue: number;
  averageOrderValue: number;
  itemsSoldCount: number;
  // Conversion Funnel
  funnel: {
    visitors: number;
    productViews: number;
    addToCart: number;
    checkoutStarts: number;
    paidOrders: number;
    visitorToPurchaseRate: number;
    viewToCartRate: number;
    cartToCheckoutRate: number;
    checkoutToPaidRate: number;
  };
  // Timeseries for Charts
  revenueTimeseries: Array<{ date: string; revenue: number; orders: number; visitors: number }>;
  // Product Performance
  topViewedProducts: Array<{ name: string; views: number; id?: string }>;
  topAddedToCartProducts: Array<{ name: string; adds: number; id?: string }>;
  topPurchasedProducts: Array<{ name: string; quantity: number; revenue: number; id?: string }>;
  topRevenueProducts: Array<{ name: string; revenue: number; quantity: number }>;
  topSizes: Array<{ size: string; count: number }>;
  topColours: Array<{ colour: string; count: number }>;
  // Search Analytics
  topSearches: Array<{ query: string; count: number }>;
  zeroResultSearches: Array<{ query: string; count: number }>;
  // Traffic & Attribution
  trafficSources: Array<{ source: string; visitors: number; percentage: number }>;
  utmCampaigns: Array<{ campaign: string; source: string; visits: number }>;
  // Device Breakdown
  deviceBreakdown: Array<{ device: string; count: number; percentage: number }>;
}

export async function GET(request: NextRequest) {
  // 1. Verify authenticated admin with canViewSales permission
  const authCheck = await requireAdmin(request, { requiredPermission: 'canViewSales' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get('range') || '7d').toLowerCase();
  const customStart = searchParams.get('start');
  const customEnd = searchParams.get('end');

  const now = new Date();
  let startTimestamp = new Date();
  let endTimestamp = new Date();

  if (range === 'today') {
    startTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    endTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === '30d') {
    startTimestamp = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range === 'this_month') {
    startTimestamp = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  } else if (range === 'custom' && customStart) {
    startTimestamp = new Date(customStart);
    if (customEnd) {
      endTimestamp = new Date(customEnd);
      endTimestamp.setHours(23, 59, 59, 999);
    }
  } else {
    // Default: 7d
    startTimestamp = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const startDateIso = startTimestamp.toISOString();
  const endDateIso = endTimestamp.toISOString();

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    // --------------------------------------------------------------------------
    // A. FINANCIAL DATA SOURCE OF TRUTH: public.orders & public.order_items
    // --------------------------------------------------------------------------
    const { data: dbOrders, error: ordersErr } = await serviceClient
      .from('orders')
      .select('id, order_number, total, subtotal, currency, payment_status, created_at')
      .gte('created_at', startDateIso)
      .lte('created_at', endDateIso);

    if (ordersErr) {
      console.error('[ANALYTICS] Orders query error:', ordersErr);
    }

    const allOrders = dbOrders || [];
    const paidOrders = allOrders.filter(o => o.payment_status === 'paid');
    const paidOrderIds = paidOrders.map(o => o.id);

    const paidOrdersCount = paidOrders.length;
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const averageOrderValue = paidOrdersCount > 0 ? Number((totalRevenue / paidOrdersCount).toFixed(2)) : 0;

    // Fetch order items for paid orders to determine real items sold, top sizes, top colours, and product sales
    let itemsSoldCount = 0;
    const purchasedProductsMap = new Map<string, { name: string; quantity: number; revenue: number; id?: string }>();
    const sizesMap = new Map<string, number>();
    const coloursMap = new Map<string, number>();

    if (paidOrderIds.length > 0) {
      const { data: dbItems, error: itemsErr } = await serviceClient
        .from('order_items')
        .select('*')
        .in('order_id', paidOrderIds);

      if (itemsErr) {
        console.error('[ANALYTICS] Order items query error:', itemsErr);
      }

      if (dbItems) {
        for (const item of dbItems) {
          const qty = Number(item.quantity || 1);
          const lineTotal = Number(item.line_total || item.unit_price * qty || 0);
          itemsSoldCount += qty;

          const pName = item.product_name_snapshot || 'Bespoke Garment';
          const pKey = item.product_id || pName;

          if (!purchasedProductsMap.has(pKey)) {
            purchasedProductsMap.set(pKey, { name: pName, quantity: 0, revenue: 0, id: item.product_id });
          }
          const currP = purchasedProductsMap.get(pKey)!;
          currP.quantity += qty;
          currP.revenue += lineTotal;

          if (item.size_snapshot) {
            const s = String(item.size_snapshot).trim().toUpperCase();
            sizesMap.set(s, (sizesMap.get(s) || 0) + qty);
          }

          if (item.colour_snapshot) {
            const c = String(item.colour_snapshot).trim();
            coloursMap.set(c, (coloursMap.get(c) || 0) + qty);
          }
        }
      }
    }

    const topPurchasedProducts = Array.from(purchasedProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topRevenueProducts = Array.from(purchasedProductsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const topSizes = Array.from(sizesMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);

    const topColours = Array.from(coloursMap.entries())
      .map(([colour, count]) => ({ colour, count }))
      .sort((a, b) => b.count - a.count);

    // --------------------------------------------------------------------------
    // B. PUBLIC WEBSITE BEHAVIORAL PIPELINE: public.analytics_events
    // --------------------------------------------------------------------------
    let visitorsCount = 0;
    let pageViewsCount = 0;
    let productViewsCount = 0;
    let addToCartCount = 0;
    let checkoutStartsCount = 0;

    const topViewedProductsMap = new Map<string, { name: string; views: number; id?: string }>();
    const topAddedToCartMap = new Map<string, { name: string; adds: number; id?: string }>();
    const searchTermsMap = new Map<string, number>();
    const zeroResultSearchMap = new Map<string, number>();
    const trafficSourcesMap = new Map<string, number>();
    const utmCampaignsMap = new Map<string, { campaign: string; source: string; visits: number }>();
    const deviceMap = new Map<string, number>([
      ['Mobile', 0],
      ['Desktop', 0],
      ['Tablet', 0],
    ]);

    const sessionSet = new Set<string>();

    try {
      const { data: events, error: eventsErr } = await serviceClient
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDateIso)
        .lte('created_at', endDateIso)
        .order('created_at', { ascending: true });

      if (!eventsErr && events && Array.isArray(events)) {
        for (const ev of events) {
          if (ev.session_id) {
            sessionSet.add(ev.session_id);
          }

          const evName = (ev.event_name || '').toLowerCase();

          // Count event types
          if (evName === 'page_view' || evName === 'pageview') {
            pageViewsCount++;
          } else if (evName === 'product_view' || evName === 'view_item') {
            productViewsCount++;
            const pName = ev.product_name || ev.metadata?.product_name || ev.page_path || 'Product';
            const pId = ev.product_id || ev.metadata?.product_id;
            const key = pId || pName;
            if (!topViewedProductsMap.has(key)) {
              topViewedProductsMap.set(key, { name: pName, views: 0, id: pId });
            }
            topViewedProductsMap.get(key)!.views++;
          } else if (evName === 'add_to_cart' || evName === 'addtocart') {
            addToCartCount++;
            const pName = ev.product_name || ev.metadata?.product_name || 'Product';
            const pId = ev.product_id || ev.metadata?.product_id;
            const key = pId || pName;
            if (!topAddedToCartMap.has(key)) {
              topAddedToCartMap.set(key, { name: pName, adds: 0, id: pId });
            }
            topAddedToCartMap.get(key)!.adds++;
          } else if (evName === 'checkout_started' || evName === 'begin_checkout') {
            checkoutStartsCount++;
          } else if (evName === 'search') {
            const query = (ev.search_query || ev.metadata?.query || '').trim();
            const resultsCount = ev.search_results_count ?? ev.metadata?.results_count ?? 0;
            if (query) {
              searchTermsMap.set(query, (searchTermsMap.get(query) || 0) + 1);
              if (resultsCount === 0) {
                zeroResultSearchMap.set(query, (zeroResultSearchMap.get(query) || 0) + 1);
              }
            }
          }

          // Traffic Source Attribution
          let source = 'Direct';
          const ref = ev.referrer || ev.metadata?.referrer || '';
          const utmSource = ev.utm_source || ev.metadata?.utm_source || '';

          if (utmSource) {
            source = utmSource.toUpperCase();
          } else if (ref) {
            const refLower = ref.toLowerCase();
            if (refLower.includes('google')) source = 'Google / Search';
            else if (refLower.includes('instagram')) source = 'Instagram';
            else if (refLower.includes('tiktok')) source = 'TikTok';
            else if (refLower.includes('facebook')) source = 'Facebook';
            else if (refLower.includes('twitter') || refLower.includes('x.com')) source = 'X (Twitter)';
            else if (refLower.includes('linkedin')) source = 'LinkedIn';
            else source = 'Other Referrals';
          }
          trafficSourcesMap.set(source, (trafficSourcesMap.get(source) || 0) + 1);

          // UTM Campaign
          const campaign = ev.utm_campaign || ev.metadata?.utm_campaign;
          if (campaign) {
            const campKey = `${campaign}_${source}`;
            if (!utmCampaignsMap.has(campKey)) {
              utmCampaignsMap.set(campKey, { campaign, source, visits: 0 });
            }
            utmCampaignsMap.get(campKey)!.visits++;
          }

          // Device Attribution
          const deviceRaw = (ev.device_type || ev.metadata?.device || '').toLowerCase();
          if (deviceRaw.includes('mobile') || deviceRaw.includes('phone')) {
            deviceMap.set('Mobile', (deviceMap.get('Mobile') || 0) + 1);
          } else if (deviceRaw.includes('tablet') || deviceRaw.includes('ipad')) {
            deviceMap.set('Tablet', (deviceMap.get('Tablet') || 0) + 1);
          } else {
            deviceMap.set('Desktop', (deviceMap.get('Desktop') || 0) + 1);
          }
        }
      }
    } catch (evEx) {
      console.warn('[ANALYTICS] analytics_events query exception (table may be freshly created):', evEx);
    }

    visitorsCount = sessionSet.size;

    // --------------------------------------------------------------------------
    // C. CONVERSION FUNNEL CALCULATIONS
    // --------------------------------------------------------------------------
    const funnelVisitors = Math.max(visitorsCount, paidOrdersCount > 0 ? paidOrdersCount : 0);
    const funnelViews = productViewsCount;
    const funnelCarts = addToCartCount;
    const funnelCheckouts = checkoutStartsCount;
    const funnelPaid = paidOrdersCount;

    const visitorToPurchaseRate = funnelVisitors > 0 ? Number(((funnelPaid / funnelVisitors) * 100).toFixed(2)) : 0;
    const viewToCartRate = funnelViews > 0 ? Number(((funnelCarts / funnelViews) * 100).toFixed(2)) : 0;
    const cartToCheckoutRate = funnelCarts > 0 ? Number(((funnelCheckouts / funnelCarts) * 100).toFixed(2)) : 0;
    const checkoutToPaidRate = funnelCheckouts > 0 ? Number(((funnelPaid / funnelCheckouts) * 100).toFixed(2)) : (funnelPaid > 0 ? 100 : 0);

    // --------------------------------------------------------------------------
    // D. REVENUE & ORDERS TIMESERIES (Daily Grouping)
    // --------------------------------------------------------------------------
    const timeseriesMap = new Map<string, { date: string; revenue: number; orders: number; visitors: number }>();

    // Seed dates for timeframe
    const currentCursor = new Date(startTimestamp);
    const targetEnd = new Date(endTimestamp);
    while (currentCursor <= targetEnd) {
      const dStr = currentCursor.toISOString().split('T')[0];
      timeseriesMap.set(dStr, { date: dStr, revenue: 0, orders: 0, visitors: 0 });
      currentCursor.setDate(currentCursor.getDate() + 1);
    }

    // Populate real revenue & orders
    for (const o of paidOrders) {
      const dStr = o.created_at ? new Date(o.created_at).toISOString().split('T')[0] : '';
      if (dStr && timeseriesMap.has(dStr)) {
        const item = timeseriesMap.get(dStr)!;
        item.revenue += Number(o.total || 0);
        item.orders += 1;
      }
    }

    const revenueTimeseries = Array.from(timeseriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Format Traffic Sources with percentages
    const totalTrafficEvents = Array.from(trafficSourcesMap.values()).reduce((sum, v) => sum + v, 0) || 1;
    const trafficSources = Array.from(trafficSourcesMap.entries())
      .map(([source, count]) => ({
        source,
        visitors: count,
        percentage: Number(((count / totalTrafficEvents) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.visitors - a.visitors);

    // Format Device breakdown with percentages
    const totalDeviceEvents = Array.from(deviceMap.values()).reduce((sum, v) => sum + v, 0) || 1;
    const deviceBreakdown = Array.from(deviceMap.entries()).map(([device, count]) => ({
      device,
      count,
      percentage: Number(((count / totalDeviceEvents) * 100).toFixed(1)),
    }));

    // Format Search lists
    const topSearches = Array.from(searchTermsMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const zeroResultSearches = Array.from(zeroResultSearchMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topViewedProducts = Array.from(topViewedProductsMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const topAddedToCartProducts = Array.from(topAddedToCartMap.values())
      .sort((a, b) => b.adds - a.adds)
      .slice(0, 10);

    const utmCampaigns = Array.from(utmCampaignsMap.values())
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const payload: AnalyticsSummary = {
      timeframe: range,
      startDate: startDateIso,
      endDate: endDateIso,
      visitorsCount,
      pageViewsCount,
      productViewsCount,
      addToCartCount,
      checkoutStartsCount,
      paidOrdersCount,
      revenue: Number(totalRevenue.toFixed(2)),
      averageOrderValue,
      itemsSoldCount,
      funnel: {
        visitors: funnelVisitors,
        productViews: funnelViews,
        addToCart: funnelCarts,
        checkoutStarts: funnelCheckouts,
        paidOrders: funnelPaid,
        visitorToPurchaseRate,
        viewToCartRate,
        cartToCheckoutRate,
        checkoutToPaidRate,
      },
      revenueTimeseries,
      topViewedProducts,
      topAddedToCartProducts,
      topPurchasedProducts,
      topRevenueProducts,
      topSizes,
      topColours,
      topSearches,
      zeroResultSearches,
      trafficSources,
      utmCampaigns,
      deviceBreakdown,
    };

    return authCheck.applyCookies(NextResponse.json({ success: true, data: payload }));
  } catch (err: any) {
    console.error('[ANALYTICS] Exception generating analytics report:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Failed to aggregate analytics telemetry' }, { status: 500 })
    );
  }
}
