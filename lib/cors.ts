import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Apply CORS headers and handle OPTIONS preflight.
 * Returns true if the request was a preflight (caller should return immediately).
 *
 * Usage:
 *   if (cors(req, res)) return;
 */
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin || '*';

  // Allow specific origins in production — edit ALLOWED_ORIGINS to lock down
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
  const allow = ALLOWED_ORIGINS.includes('*') ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);

  res.setHeader('Access-Control-Allow-Origin',  allow);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Access-Token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/** Shorthand: send a JSON error with correct status */
export function apiError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}
