/**
 * Dynamic CORS headers based on ALLOWED_ORIGINS environment variable.
 * 
 * Set ALLOWED_ORIGINS as a comma-separated list of allowed origins in your
 * Supabase project settings (e.g., "https://myapp.com,https://staging.myapp.com").
 * 
 * If ALLOWED_ORIGINS is not set, defaults to '*' for local development.
 */

const CORS_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
const CORS_ALLOWED_METHODS = 'POST, GET, OPTIONS, PUT, DELETE, PATCH';

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedRaw = Deno.env.get('ALLOWED_ORIGINS') || '*';
  const origin = req.headers.get('origin') || '';

  let allowOrigin = '';

  if (allowedRaw === '*') {
    // Local dev / no restriction configured
    allowOrigin = '*';
  } else {
    const allowedList = allowedRaw.split(',').map(s => s.trim());
    if (allowedList.includes(origin)) {
      allowOrigin = origin;
    }
    // If origin not in list, allowOrigin stays empty → no CORS header → browser blocks
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    // When reflecting a specific origin, Vary: Origin is required for correct caching
    if (allowOrigin !== '*') {
      headers['Vary'] = 'Origin';
    }
  }

  return headers;
}

// Backward-compatible static export for any code that still uses it as a fallback
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
  'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
}
