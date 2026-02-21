import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
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
  
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

  if (req.method === 'GET') {
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY ?? '',
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
           const errorText = await response.text()
           throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`)
        }

        const data = await response.json()
        const voices = data.voices.map((voice: any) => ({
            id: voice.voice_id,
            name: voice.name,
            category: voice.category || "general",
            preview_url: voice.preview_url || ""
        }))

        return new Response(JSON.stringify(voices), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      } catch (err) {
        console.error(err)
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
  }
  
  if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
  }

  try {
    const { text, voiceId } = await req.json()
    // const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') // Moved up
    
    if (!text) {
        throw new Error('Text is required')
    }
    
    const targetVoiceId = voiceId || "21m00Tcm4TlvDq8ikWAM" // Default
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY ?? '',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5
            }
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`)
    }
    
    const audioBlob = await response.blob()
    
    return new Response(audioBlob, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg'
        }
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
