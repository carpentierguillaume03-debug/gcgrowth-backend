import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/cors';

/**
 * GET /api/health
 * Returns service status + which env vars are configured.
 * Safe to call from the frontend to verify the deployment.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const checks = {
    supabase:    !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    anthropic:   !!process.env.ANTHROPIC_API_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  };

  return res.status(200).json({
    status: 'ok',
    service: 'gcgrowthapi',
    timestamp: new Date().toISOString(),
    checks,
  });
}
