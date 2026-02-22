import { getCorsHeaders } from './cors.ts'

/**
 * Extracts and validates the authenticated user from the request.
 * Returns { user, corsHeaders } on success, or a Response on auth failure.
 */
export async function getAuthenticatedUser(
  req: Request,
  supabase: any
): Promise<{ user: any; corsHeaders: Record<string, string> } | Response> {
  const corsHeaders = getCorsHeaders(req)

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return { user, corsHeaders }
}
