import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, apiError } from '../../lib/cors';
import { supabase }       from '../../lib/supabase';
import { getShopInfo }    from '../../lib/shopify';

/**
 * POST /api/shopify/connect
 * Body: { storeId: string, shopifyDomain: string, shopifyToken: string }
 *
 * 1. Verifies the Shopify token against the Admin API
 * 2. Persists domain + encrypted-ish token in Supabase
 * 3. Returns { shopName, shopEmail }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (cors(req, res)) return;

  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const { storeId, shopifyDomain, shopifyToken } = req.body ?? {};

  if (!storeId || !shopifyDomain || !shopifyToken) {
    return apiError(res, 400, 'storeId, shopifyDomain and shopifyToken are required');
  }

  // Normalise domain — strip protocol if pasted with https://
  const domain = (shopifyDomain as string)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .trim();

  try {
    // 1 — Verify token with Shopify
    const { name: shopName, email: shopEmail } = await getShopInfo(domain, shopifyToken);

    // 2 — Upsert into Supabase (stores table)
    //     Adjust column names to match your actual schema
    const { error: dbError } = await supabase
      .from('stores')
      .update({
        shopify_domain:    domain,
        shopify_token:     shopifyToken,   // ⚠ consider encrypting at rest
        shopify_shop_name: shopName,
        shopify_connected: true,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', storeId);

    if (dbError) {
      console.error('[shopify/connect] Supabase error:', dbError);
      return apiError(res, 500, `Database error: ${dbError.message}`);
    }

    return res.status(200).json({ shopName, shopEmail, success: true });

  } catch (err: any) {
    console.error('[shopify/connect] Error:', err.message);
    return apiError(res, 502, err.message);
  }
}
