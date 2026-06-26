import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, apiError } from '../../lib/cors';

/**
 * POST /api/claude/generate
 * Body: { prompt: string, url: string, type: 'adv' | 'pp' }
 *
 * Acts as a secure proxy: the Anthropic API key stays server-side.
 * Returns { html: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const { prompt, url, type } = req.body ?? {};

  if (!prompt || !url) return apiError(res, 400, 'prompt and url are required');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return apiError(res, 500, 'ANTHROPIC_API_KEY not configured on server');

  const userMessage = `${prompt}\n\nURL : ${url}`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 8096,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return apiError(res, 502, `Claude API error (${claudeRes.status}): ${err}`);
    }

    const data: any = await claudeRes.json();
    const html = data.content?.[0]?.text ?? '';

    return res.status(200).json({ html, type, usage: data.usage });

  } catch (err: any) {
    console.error('[claude/generate] Error:', err.message);
    return apiError(res, 500, err.message);
  }
}
