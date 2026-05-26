import { getCorsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseClient.ts'
import { ROLE_ID } from '../_shared/constants.ts'

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

const formatRole = (role: string) => {
    const isAgent = role === 'agent' || role === 'assistant';
    return {
        id: isAgent ? ROLE_ID.AGENT : ROLE_ID.USER,
        name: isAgent ? 'agent' : 'user'
    };
};

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
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
     const supabase = createAdminClient()
     
     const contentType = req.headers.get('content-type') || ''
     
     let conversationId = ''
     let userId = '' 
     let appConversationId = ''
     let action = 'process'
     let body: any = {}
     
     if (contentType.includes('application/json')) {
         body = await req.json()
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
         
         // Insert session to link it to user (use insert to avoid unique constraint issues if any)
         const { error } = await supabase
             .from('voice_sessions')
             .insert({
                 conversation_id: appConversationId || conversationId, // Link to app conversation!
                 user_id: userId,
                 transcript: [{ _elevenlabs_id: conversationId }] // Store ID in transcript temporarily
             })
             
         if (error && !error.message.includes('duplicate')) {
             // Registration failed
         }
         
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
     if (!userId && conversationId) {
         // Elevenlabs direct webhook: it only provides `conversation_id` (the elevenlabs one).
         // In `register`, we tucked this id into the `transcript` JSON array to find it later!
         const { data: session } = await supabase
            .from('voice_sessions')
            .select('user_id, conversation_id')
            .contains('transcript', `[{"_elevenlabs_id": "${conversationId}"}]`)
            .limit(1)
            .maybeSingle()
            
         if (session && session.user_id) {
             userId = session.user_id;
             appConversationId = session.conversation_id; // Retrieve the real UUID
         } else if (appConversationId) {
            // Unfallback: try by app_conversation_id since register might have saved that
            const { data: appSession } = await supabase
                .from('voice_sessions')
                .select('user_id')
                .eq('conversation_id', appConversationId)
                .limit(1)
                .maybeSingle()
            if (appSession && appSession.user_id) {
                userId = appSession.user_id
            } else {
                 throw new Error(`User not found for conversation ${appConversationId}`);
            }
         } else {
              throw new Error(`User not found for conversation ${conversationId}`);
         }
     }

    // 1. Fetch Audio (Conversational AI - With Retry since it might take a second to process)
    let relativePath = null;
    try {
        let audioBlob = null;
        let attempts = 0;
        let success = false;
        
        while (attempts < 3 && !success) {
            try {
                audioBlob = await fetchAudio(conversationId);
                success = true;
            } catch (err) {
                attempts++;
                if (attempts >= 3) throw err;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        if (!audioBlob) throw new Error("Could not fetch Audio Blob");
        
        // 2. Upload to Storage in USER FOLDER
        const fileName = `${userId}/${conversationId}.mp3` // STRICT PATH
        const { error: uploadError } = await supabase
            .storage
            .from('voice-sessions')
            .upload(fileName, audioBlob, {
                contentType: 'audio/mpeg',
                upsert: true
            });

        if (uploadError) {
             // Audio upload failed
        } else {
             relativePath = fileName;
        }
    } catch (_e) {
        // Failed to fetch or upload audio, skipping
    }
    
    // 3. Transform Transcript into our format
    // We prioritize ElevenLabs real transcript because frontend might disconnect early or send empty.
    let processedTranscript: any[] = [];
    try {
        let apiTranscript: any[] = [];
        let tAttempts = 0;
        let tSuccess = false;
        
        while (tAttempts < 3 && !tSuccess) {
            try {
                apiTranscript = await fetchTranscript(conversationId);
                tSuccess = true;
            } catch (err) {
                tAttempts++;
                if (tAttempts >= 3) throw err;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        const nowMs = Date.now();
        if (apiTranscript && Array.isArray(apiTranscript) && apiTranscript.length > 0) {
            processedTranscript = apiTranscript.map((item: any) => {
                const roleData = formatRole(item.role);
                return {
                    id: roleData.id,
                    role: roleData.name,
                    msg: item.text || item.message || '',
                    date: new Date(nowMs + (item.time_in_call_secs || 0) * 1000).toISOString()
                };
            }).filter((t: any) => t.msg);
        }
    } catch (_e) {
        // Transcript fetch failed, will use fallback
    }
    
    // Fallback to exactly what the frontend passed ONLY if ElevenLabs failed or has no transcript
    if (processedTranscript.length === 0 && body.transcript && Array.isArray(body.transcript) && body.transcript.length > 0) {
         const nowMs = Date.now();
         processedTranscript = body.transcript.map((item: any) => {
            const roleData = formatRole(item.role);
            return {
                id: roleData.id,
                role: roleData.name,
                msg: item.message || item.text || '',
                date: new Date(nowMs + (item.time_in_call_secs || 0) * 1000).toISOString()
            };
         }).filter((t: any) => t.msg);
    }
    
    // 4. Ensure a conversations row exists
    const finalAppConvId = appConversationId || conversationId;
    
    if (finalAppConvId && finalAppConvId.length === 36) { 
         const { data: existingConv } = await supabase
             .from('conversations')
             .select('id')
             .eq('id', finalAppConvId)
             .maybeSingle()
             
         if (!existingConv) {
             await supabase
                 .from('conversations')
                 .insert({
                     id: finalAppConvId,
                     user_id: userId,
                     title: 'IA Conversacional',
                     history: [] // Do NOT save voice transcript into text chat history to avoid duplication
                 });
         } else {
             await supabase
                .from('conversations')
                .update({ 
                    updated_at: new Date().toISOString()
                })
                .eq('id', finalAppConvId);
         }
    }

    // 5. Save to DB (voice_sessions)
    // Since we don't have a unique constraint on conversation_id, an upsert would fail on conflict 
    // unless we match the exact PK (id). We'll just insert a new voice session or update the one
    // generated in register. The safest way to avoid 500 without unique constraints is to check if it exists:
    let sessionData, sessionError;
    
    const { data: existingSession } = await supabase
        .from('voice_sessions')
        .select('id')
        .eq('conversation_id', finalAppConvId)
        .limit(1)
        .maybeSingle();

    if (existingSession) {
        const { data, error } = await supabase
            .from('voice_sessions')
            .update({
                transcript: processedTranscript,
                audio_url: relativePath 
            })
            .eq('id', existingSession.id)
            .select()
            .single();
        sessionData = data;
        sessionError = error;
    } else {
        const { data, error } = await supabase
            .from('voice_sessions')
            .insert({
                conversation_id: finalAppConvId,
                user_id: userId,
                transcript: processedTranscript,
                audio_url: relativePath 
            })
            .select()
            .single();
        sessionData = data;
        sessionError = error;
    }
        
    if (sessionError) {
        throw sessionError;
    }

    return new Response(JSON.stringify(sessionData || { success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
