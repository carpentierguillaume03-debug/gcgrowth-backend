import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, apiError }       from '../../lib/cors';
import { supabase }             from '../../lib/supabase';
import { fetchOrders, groupByDay } from '../../lib/shopify';

/**
 * POST /api/shopify/sync
 * Body: { storeId: string, startDate?: string, endDate?: string }
 *
 * 1. Loads credentials from Supabase
 * 2. Fetches orders from Shopify API
 * 3. Groups by day → daily_stats
 * 4. Optionally persists into Supabase orders table
 * 5. Returns { orders: N, days: N, daily_stats: { [date]: { ca, orders, items } } }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const { storeId, startDate, endDate } = req.body ?? {};

  if (!storeId) return apiError(res, 400, 'storeId is required');

  // Default to last 30 days if no range provided
  const end   = endDate   || new Date().toISOString().slice(0, 10);
  const start = startDate || (() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  try {
    // 1 — Load credentials
    const { data: store, error: dbErr } = await supabase
      .from('stores')
      .select('shopify_domain, shopify_token, shopify_connected')
      .eq('id', storeId)
      .single();

    if (dbErr || !store) return apiError(res, 404, 'Store not found');
    if (!store.shopify_connected) return apiError(res, 400, 'Store not connected to Shopify');

    const { shopify_domain: domain, shopify_token: token } = store;

    // 2 — Fetch orders
    const orders = await fetchOrders(domain, token, start, end);

    // 3 — Group into daily stats
    const daily_stats = groupByDay(orders);

    // 4 — Optional: persist raw orders to Supabase
    //     Comment out if you don't have an orders table
    if (orders.length > 0) {
      const rows = orders.map(o => ({
        store_id:          storeId,
        shopify_order_id:  String(o.id),
        order_name:        o.name,
        created_at:        o.created_at,
        total_price:       parseFloat(o.total_price),
        financial_status:  o.financial_status,
        fulfillment_status: o.fulfillment_status ?? 'unfulfilled',
        line_items:        JSON.stringify(o.line_items),
      }));

      const { error: upsertErr } = await supabase
        .from('orders')
        .upsert(rows, { onConflict: 'shopify_order_id' });

      if (upsertErr) {
        // Non-fatal — log but continue, frontend still gets daily_stats
        console.warn('[shopify/sync] Upsert warning:', upsertErr.message);
      }
    }

    return res.status(200).json({
      success:     true,
      orders:      orders.length,
      days:        Object.keys(daily_stats).length,
      start,
      end,
      daily_stats,
    });

  } catch (err: any) {
    console.error('[shopify/sync] Error:', err.message);
    return apiError(res, 502, err.message);
  }
}
