import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
      console.error('No token provided in Authorization header')
      return new Response(JSON.stringify({ error: 'No token provided' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
  }

  const supabase = createAuthClient(req)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    console.error('Auth error:', authError)
    return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
  if (!ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY is not set')
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing ElevenLabs API Key' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
  }

  if (req.method === 'GET') {
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
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
        console.error('GET /voice-tts error:', err)
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
    const body = await req.json()
    const { text, voiceId } = body
    
    if (!text) {
        throw new Error('Text is required')
    }
    
    const targetVoiceId = voiceId || "21m00Tcm4TlvDq8ikWAM" // Default
    console.log(`Generating TTS for voice ${targetVoiceId}, text length: ${text.length}`)
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
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
        const status = response.status
        const errorText = await response.text()
        console.error(`ElevenLabs error (${status}):`, errorText)
        return new Response(JSON.stringify({ 
            error: `ElevenLabs API Error: ${response.statusText}`,
            details: errorText,
            status: status
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
    
    const audioArrayBuffer = await response.arrayBuffer()
    
    return new Response(audioArrayBuffer, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg'
        }
    })

  } catch (err) {
    console.error('POST /voice-tts error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
