import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createAuthClient(req)
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
        return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID')
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

    if (!ELEVENLABS_AGENT_ID || !ELEVENLABS_API_KEY) {
      console.error('Missing ElevenLabs environment variables')
      throw new Error('Server configuration error')
    }

    // Call ElevenLabs API to get a signed URL
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API Error:', errorText)
      throw new Error('Failed to generate signed URL')
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({ 
        agentId: ELEVENLABS_AGENT_ID,
        signedUrl: data.signed_url 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Voice Signature Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
