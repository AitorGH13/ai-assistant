import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseClient.ts'

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

// Function to fetch transcript from ElevenLabs
async function fetchTranscript(conversationId: string) {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY ?? '',
        }
    })
    
    if (!response.ok) {
        throw new Error(`ElevenLabs API Error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.transcript || []
}

// Function to fetch audio from ElevenLabs
async function fetchAudio(conversationId: string) {
     const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`, {
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY ?? '',
        }
    })
    
    if (!response.ok) {
        throw new Error(`ElevenLabs API Error: ${response.statusText}`)
    }
    
    return await response.blob() // Return as blob for upload
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
     const supabase = createAdminClient()
     
     const contentType = req.headers.get('content-type') || ''
     
     let conversationId = ''
     let userId = '' 
     let appConversationId = ''
     let action = 'process' // default
     
     if (contentType.includes('application/json')) {
         const body = await req.json()
         conversationId = body.conversation_id
         appConversationId = body.app_conversation_id
         action = body.action || 'process'
         
         // If called by Client (authenticated), we might have Authorization header
         const authHeader = req.headers.get('Authorization')
         if (authHeader) {
             const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1])
             userId = user?.id || ''
         }
     }

     // --- ACTION: REGISTER (Link session to user) ---
     if (action === 'register') {
         if (!conversationId || !userId) {
             return new Response(JSON.stringify({ error: 'Missing conversation_id or user_id for registration' }), {
                 status: 400,
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             })
         }
         
         // Upsert session to link it to user
         const { error } = await supabase
             .from('voice_sessions')
             .upsert({
                 conversation_id: conversationId,
                 user_id: userId,
                 transcript: [] // Placeholders
             }, { onConflict: 'conversation_id' })
             
         if (error) throw error
         
         return new Response(JSON.stringify({ success: true }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         })
     }

     // --- ACTION: PROCESS (Webhook or Trigger) ---
     
     if (!conversationId) {
          return new Response(JSON.stringify({ error: 'Missing conversation_id' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
     }

     // CRITICAL: Look up user_id from conversation_id if not provided
     if (!userId) {
         const { data: session } = await supabase
            .from('voice_sessions')
            .select('user_id')
            .eq('conversation_id', conversationId)
            .single()
            
         if (session && session.user_id) {
             userId = session.user_id
         } else {
             // If we can't find the user, we can't store it in the correct folder
             // We could optionally store it in an 'orphan' folder or throw error
             throw new Error(`User not found for conversation ${conversationId}`)
         }
     }

    // 1. Fetch Audio
    console.log(`Fetching audio for ${conversationId}`)
    const audioBlob = await fetchAudio(conversationId)
    
    // 2. Upload to Storage in USER FOLDER
    const fileName = `${userId}/${conversationId}.mp3` // STRICT PATH
    const { error: uploadError } = await supabase
        .storage
        .from('voice-sessions')
        .upload(fileName, audioBlob, {
            contentType: 'audio/mpeg',
            upsert: true
        })

    if (uploadError) throw uploadError
    
    // Store RELATIVE PATH, NOT Public URL
    const relativePath = fileName
    
    // 3. Fetch Transcript
    console.log(`Fetching transcript for ${conversationId}`)
    const transcript = await fetchTranscript(conversationId)
    
    // 4. Transform Transcript
    const processedTranscript = transcript.map((item: any) => ({
        id: item.role === 'agent' ? 1 : 0,
        role: item.role === 'agent' ? 'agent' : 'user', 
        msg: item.text || item.message || '',
        date: item.time_in_call_secs || 0
    })).filter((t: any) => t.msg)
    
    // 5. Save to DB
    const { data: sessionData, error: sessionError } = await supabase
        .from('voice_sessions')
        .upsert({
            user_id: userId,
            conversation_id: conversationId,
            transcript: processedTranscript,
            audio_url: relativePath // Saving relative path
        }, { onConflict: 'conversation_id' })
        .select()
        .single()
        
    if (sessionError) throw sessionError

    return new Response(JSON.stringify(sessionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
