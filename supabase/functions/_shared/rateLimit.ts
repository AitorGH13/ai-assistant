import { createAdminClient } from './supabaseClient.ts'

interface RateLimitConfig {
  windowMs: number   // Window duration in milliseconds (e.g., 60_000 = 1 minute)
  maxRequests: number // Max requests allowed per window
}

interface RateLimitResult {
  allowed: boolean
  retryAfter: number // Seconds until the window resets
}

/**
 * Persistent rate limiter backed by Supabase DB.
 * Uses a sliding window counter per user + endpoint.
 * Shared across all Edge Function isolates.
 */
export async function checkRateLimit(
  _supabase: any, // The auth-scoped client (unused, we use admin)
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  try {
    // Try to get the existing rate limit record
    const { data: existing, error: selectError } = await admin
      .from('rate_limits')
      .select('id, request_count, window_start')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (selectError) {
      // On DB error, allow the request (fail-open)
      console.error('Rate limit check failed:', selectError.message)
      return { allowed: true, retryAfter: 0 }
    }

    if (!existing) {
      // First request ever for this user+endpoint — create record
      await admin.from('rate_limits').insert({
        user_id: userId,
        endpoint,
        request_count: 1,
        window_start: now.toISOString(),
      })
      return { allowed: true, retryAfter: 0 }
    }

    const existingWindowStart = new Date(existing.window_start)

    if (existingWindowStart < windowStart) {
      // Window has expired — reset the counter
      await admin
        .from('rate_limits')
        .update({
          request_count: 1,
          window_start: now.toISOString(),
        })
        .eq('id', existing.id)

      return { allowed: true, retryAfter: 0 }
    }

    // Window is still active
    if (existing.request_count >= config.maxRequests) {
      // Rate limit exceeded
      const windowEnd = new Date(existingWindowStart.getTime() + config.windowMs)
      const retryAfter = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000)
      return { allowed: false, retryAfter: Math.max(retryAfter, 1) }
    }

    // Increment counter
    await admin
      .from('rate_limits')
      .update({
        request_count: existing.request_count + 1,
      })
      .eq('id', existing.id)

    return { allowed: true, retryAfter: 0 }
  } catch (err) {
    // Fail-open: if rate limit check itself errors, allow the request
    console.error('Rate limit error:', err)
    return { allowed: true, retryAfter: 0 }
  }
}
