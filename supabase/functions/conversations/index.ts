import { getCorsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 30 }

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createAuthClient(req)
    const authResult = await getAuthenticatedUser(req, supabase)
    if (authResult instanceof Response) return authResult
    const { user } = authResult

    // Rate limit
    const rateCheck = await checkRateLimit(supabase, user.id, 'conversations', RATE_LIMIT)
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) },
      })
    }

    const url = new URL(req.url)
    let pathname = url.pathname

    if (pathname.startsWith('/functions/v1/conversations')) {
      pathname = pathname.slice('/functions/v1/conversations'.length)
    } else if (pathname.startsWith('/conversations')) {
      pathname = pathname.slice('/conversations'.length)
    }
    if (!pathname || pathname === '') pathname = '/'

    // 1. List Conversations (GET /)
    if (req.method === 'GET' && (pathname === '/' || pathname === '')) {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (convError) throw convError

      const { data: voiceSessions, error: voiceError } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('user_id', user.id)

      if (voiceError) throw voiceError

      const combined = conversations.map((c: any) => ({
        ...c,
        voice_sessions: voiceSessions.filter((vs: any) => vs.conversation_id === (c.id as string)),
      }))

      return new Response(JSON.stringify(combined), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get Conversation (GET /:id)
    const matchGetId = new URLPattern({ pathname: '/:id' }).exec({ pathname })
    if (req.method === 'GET' && matchGetId) {
      const id = matchGetId.pathname.groups.id
      if (!id) throw new Error('Missing ID')

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error

      const { data: voiceSessions } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

      const defaultData = data || {
        id,
        title: 'Conversación de Voz',
        history: [],
        created_at: new Date().toISOString(),
      }

      return new Response(JSON.stringify({ ...defaultData, voice_sessions: voiceSessions || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Update Title (PATCH /:id/title)
    const matchTitle = new URLPattern({ pathname: '/:id/title' }).exec({ pathname })
    if (req.method === 'PATCH' && matchTitle) {
      const id = matchTitle.pathname.groups.id
      const body = await req.json()
      const { title } = body

      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return new Response(JSON.stringify({ status: 'ok', title }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Delete Conversation (DELETE /:id)
    const matchDelete = new URLPattern({ pathname: '/:id' }).exec({ pathname })
    if (req.method === 'DELETE' && matchDelete) {
      const id = matchDelete.pathname.groups.id

      const { data: relatedSessions } = await supabase
        .from('voice_sessions')
        .select('id, audio_url')
        .eq('conversation_id', id)
        .eq('user_id', user.id)

      if (relatedSessions && relatedSessions.length > 0) {
        const filesToRemove = relatedSessions
          .map((s: any) => s.audio_url)
          .filter((url: string) => url && !url.startsWith('data:'))

        if (filesToRemove.length > 0) {
          await supabase.storage.from('voice-sessions').remove(filesToRemove).catch(() => {})
        }

        await supabase
          .from('voice_sessions')
          .delete()
          .eq('conversation_id', id)
          .eq('user_id', user.id)
      }

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
