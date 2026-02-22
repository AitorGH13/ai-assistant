import { getCorsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 }

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

    const rateCheck = await checkRateLimit(supabase, user.id, 'voice-sessions', RATE_LIMIT)
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) },
      })
    }

    const url = new URL(req.url)
    let pathname = url.pathname

    if (pathname.startsWith('/functions/v1/voice-sessions')) {
      pathname = pathname.slice('/functions/v1/voice-sessions'.length)
    } else if (pathname.startsWith('/voice-sessions')) {
      pathname = pathname.slice('/voice-sessions'.length)
    }
    if (!pathname || pathname === '') pathname = '/'

    // 1. Add TTS (POST /:id)
    const matchAdd = new URLPattern({ pathname: '/:id' }).exec({ pathname })
    if (req.method === 'POST' && matchAdd) {
      const id = matchAdd.pathname.groups.id // conversation_id
      const body = await req.json()

      const transcriptEntry = {
        msg: body.text,
        role: 'assistant',
        timestamp: body.timestamp,
        voice_id: body.voiceId,
        voice_name: body.voiceName,
      }

      // Check if conversation exists, if not create it
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('id', id)
        .maybeSingle()

      let title = convData?.title || 'Conversación de Voz'

      if (!convData) {
        if (body.text && body.text.trim()) {
          const cleanText = body.text.trim()
          title = cleanText.length > 40 ? cleanText.substring(0, 40) + '...' : cleanText
        }

        const { error: insertConvError } = await supabase.from('conversations').insert({
          id,
          user_id: user.id,
          title,
          history: [],
        })

        if (insertConvError) throw insertConvError
      } else {
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', id)
      }

      // Insert into voice_sessions
      const { data, error } = await supabase
        .from('voice_sessions')
        .insert({
          user_id: user.id,
          conversation_id: id,
          transcript: [transcriptEntry],
          audio_url: body.audioUrl,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ ...data, title }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Delete TTS (DELETE /:id/:audioId)
    const matchDelete = new URLPattern({ pathname: '/:id/:audioId' }).exec({ pathname })
    if (req.method === 'DELETE' && matchDelete) {
      const conversationId = matchDelete.pathname.groups.id
      const audioId = matchDelete.pathname.groups.audioId

      // Get audio_url for storage cleanup
      const { data: sessionInfo } = await supabase
        .from('voice_sessions')
        .select('audio_url')
        .eq('id', audioId)
        .eq('user_id', user.id)
        .maybeSingle()

      const { error } = await supabase
        .from('voice_sessions')
        .delete()
        .eq('id', audioId)
        .eq('user_id', user.id)

      if (error) throw error

      // Clean up storage
      if (sessionInfo?.audio_url && !sessionInfo.audio_url.startsWith('data:')) {
        await supabase.storage.from('voice-sessions').remove([sessionInfo.audio_url]).catch(() => {})
      }

      let conversation_deleted = false

      // Check if orphaned
      const { data: remainingSessions } = await supabase
        .from('voice_sessions')
        .select('id')
        .eq('conversation_id', conversationId)
        .limit(1)

      const { data: conversation } = await supabase
        .from('conversations')
        .select('history')
        .eq('id', conversationId)
        .maybeSingle()

      if (
        (!remainingSessions || remainingSessions.length === 0) &&
        (!conversation?.history || conversation.history.length === 0)
      ) {
        await supabase
          .from('conversations')
          .delete()
          .eq('id', conversationId)
          .eq('user_id', user.id)

        conversation_deleted = true
      }

      return new Response(JSON.stringify({ status: 'ok', conversation_deleted }), {
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
