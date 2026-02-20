import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'
import OpenAI from 'https://esm.sh/openai@4.28.0'


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createAuthClient(req)
    
    // Get the User. We explicitly pass the token from the header 
    // to avoid any ambiguity with the global client config.
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
        console.error('Missing Authorization header')
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError) {
      console.error('Auth User Error:', authError)
    }

    if (!user) {
      console.error('Request Headers Keys:', [...req.headers.keys()])
      // Log part of the token for debugging (security: do not log full token)
      console.error('Token provided:', token ? token.substring(0, 10) + '...' : 'none')
      
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize OpenAI client inside the handler
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set')
      throw new Error('Server configuration error: Missing OpenAI API Key')
    }
    
    const openai = new OpenAI({
      apiKey: apiKey,
    })

    const url = new URL(req.url)
    let pathname = url.pathname;
    
    if (pathname.startsWith('/functions/v1/chat')) {
        pathname = pathname.slice('/functions/v1/chat'.length);
    } else if (pathname.startsWith('/chat')) {
        pathname = pathname.slice('/chat'.length);
    }
    if (!pathname || pathname === '') {
        pathname = '/';
    }

    // 1. List Conversations (GET /)
    if (req.method === 'GET' && (pathname === '/' || pathname === '')) {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return new Response(JSON.stringify(data), {
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
        .single()

      if (error) throw error
      
      // Also fetch voice sessions if needed, matching Python logic
      const { data: voiceSessions } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

      return new Response(JSON.stringify({ ...data, voice_sessions: voiceSessions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Send Message (POST /:id/message)
    const matchMessage = new URLPattern({ pathname: '/:id/message' }).exec({ pathname })
    if (req.method === 'POST' && matchMessage) {
        const conversationId = matchMessage.pathname.groups.id
        const body = await req.json()
        const { messages, is_temporary } = body // Expecting full history context + new message or just new message? Python code handled both.
        // Python code: validates last message, updates DB history, streams response.

        // Logic check: temporary chat vs persistent
        // If temporary, we just stream back.
        // If persistent, we save user message then AI message.

        const lastMessage = messages[messages.length - 1]
        
        let currentHistory = []
        if (!is_temporary) {
            // Check if conversation exists (if ID is UUID)
            // If ID is 'new' or valid UUID?
            // User passes ID in URL. If strictly following REST, ID must exist.
            // Python code had /new separately, but here we merged.
            // Actually, frontend might call POST /chat/new to create? 
            // The Python router had @router.post("/new") -> create_conversation
            // And @router.post("/{conversation_id}/message") -> send_message
            
            // WE NEED TO HANDLE /new separately or assume ID is passed.
            // Let's handle /new in a separate block below or here if ID is 'new' (unlikely for UUID)
            // Let's assume conversation exists for this endpoint.
            
            const { data: conversation } = await supabase
                .from('conversations')
                .select('title, history')
                .eq('id', conversationId)
                .single()
            
            currentHistory = conversation?.history || []
            
            const userMsgEntry = {
                id: currentHistory.length,
                role: 'user',
                msg: lastMessage.content,
                date: new Date().toISOString()
            }
            
            currentHistory.push(userMsgEntry)
            
            if (!conversation) {
                 let title = "Nueva conversación"
                 if (typeof lastMessage.content === 'string') {
                     title = lastMessage.content.substring(0, 30) + '...'
                 } else if (Array.isArray(lastMessage.content)) {
                     const textPart = lastMessage.content.find((p: any) => p.type === 'text')
                     if (textPart && textPart.text) {
                         title = textPart.text.substring(0, 30) + '...'
                     }
                 }
                 
                 await supabase
                     .from('conversations')
                     .insert({
                         id: conversationId,
                         user_id: user.id,
                         title: title,
                         history: currentHistory
                     })
            } else {
                await supabase
                    .from('conversations')
                    .update({ history: currentHistory, updated_at: new Date().toISOString() })
                    .eq('id', conversationId)
            }
        } else {
             // For temp chat, we use messages as is for context
             currentHistory = messages.map((m: any) => ({
                 role: m.role,
                 msg: m.content,
                 // ... other fields
             }))
        }

        // Prepare OpenAI messages
        const openAIMessages = messages.map((m: any) => ({
            role: m.role,
            content: m.content
        }))

        const stream = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview', // Or gpt-3.5-turbo
            messages: openAIMessages,
            stream: true,
        })

        const encoder = new TextEncoder()
        const readable = new ReadableStream({
            async start(controller) {
                let fullContent = ''
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || ''
                    if (content) {
                        fullContent += content
                        // Send standardized SSE format or raw?
                        // Python used: yield chunk (raw OpenAI chunk object usually)
                        // But Python code manual generator did: yield chunk
                        // Frontend expects: "data: {...}" strings?
                        // Let's replicate strict SSE format if frontend expects it
                        // Or just send raw text if frontend handles it.
                        // Python backend sent: StreamingResponse(stream_generator(), media_type="text/event-stream")
                        // Implementation detail: Python's openai_service.stream_chat yielded chunks. 
                        // The router code: if chunk.startswith("data: {") ...
                        // So we should mimic OpenAI SSE format.
                        
                        const data = JSON.stringify({ content }) // Simplify for our frontend?
                        // Wait, if frontend uses standard OpenAI handling, it expects OpenAI format.
                        // Let's stick to standard SSE format: data: JSON \n\n
                        const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
                        controller.enqueue(encoder.encode(sseChunk))
                    }
                }
                const doneChunk = `data: [DONE]\n\n`
                controller.enqueue(encoder.encode(doneChunk))
                
                // After stream, save complete message if not temporary
                if (!is_temporary) {
                    const aiMsgEntry = {
                        id: currentHistory.length,
                        role: 'assistant',
                        msg: fullContent,
                        date: new Date().toISOString()
                    }
                    currentHistory.push(aiMsgEntry)
                     await supabase
                        .from('conversations')
                        .update({ history: currentHistory, updated_at: new Date().toISOString() })
                        .eq('id', conversationId)
                }
                
                controller.close()
            }
        })

        return new Response(readable, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    }
    
    // 4. Create Conversation (POST /new) - Special case
    if (req.method === 'POST' && (pathname === '/new')) {
         const body = await req.json()
         const { messages } = body
         
         const firstMsgContent = messages[0].content
         let firstMsgText = "New Conversation"

         if (typeof firstMsgContent === 'string') {
             firstMsgText = firstMsgContent
         } else if (Array.isArray(firstMsgContent)) {
             const textPart = firstMsgContent.find((p: any) => p.type === 'text')
             if (textPart && textPart.text) {
                 firstMsgText = textPart.text
             }
         }

         const title = firstMsgText.substring(0, 30) + '...'
         
         const initialMsg = {
             id: 0,
             role: 'user',
             msg: firstMsgContent, // Store original content
             date: new Date().toISOString()
         }
         
         const { data, error } = await supabase
            .from('conversations')
            .insert({
                user_id: user.id,
                title: title,
                history: [initialMsg]
            })
            .select()
            .single()
            
         if (error) throw error
         return new Response(JSON.stringify(data), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         })
    }

    // 5. Delete Conversation (DELETE /:id)
    const matchDelete = new URLPattern({ pathname: '/:id' }).exec({ pathname })
    if (req.method === 'DELETE' && matchDelete) {
        const id = matchDelete.pathname.groups.id
        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
            
        if (error) throw error
        return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 6. Update Title (PATCH /:id/title)
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
        return new Response(JSON.stringify({ status: 'ok', title }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

     // 7. Add TTS (POST /:id/tts)
    const matchTTS = new URLPattern({ pathname: '/:id/tts' }).exec({ pathname })
    if (req.method === 'POST' && matchTTS) {
        const id = matchTTS.pathname.groups.id // conversation_id
        const body = await req.json()
        // Body matches TTSAudio interface roughly or Python's expectation
        // Python: text, audioUrl, timestamp, voiceId, voiceName
        
        const transcriptEntry = {
            msg: body.text,
            role: 'assistant',
            timestamp: body.timestamp,
            voice_id: body.voiceId,
            voice_name: body.voiceName
        }
        
        // Insert into voice_sessions
        const { data, error } = await supabase
            .from('voice_sessions')
            .insert({
                user_id: user.id,
                conversation_id: id,
                transcript: [transcriptEntry],
                audio_url: body.audioUrl
            })
            .select()
            .single()
            
         if (error) throw error
         return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // 8. Delete TTS (DELETE /:id/tts/:audioId)
    const matchDeleteTTS = new URLPattern({ pathname: '/:id/tts/:audioId' }).exec({ pathname })
    if (req.method === 'DELETE' && matchDeleteTTS) {
         // const id = matchDeleteTTS.pathname.groups.id // conversation_id (used validation?)
         const audioId = matchDeleteTTS.pathname.groups.audioId
         
         const { error } = await supabase
            .from('voice_sessions')
            .delete()
            .eq('id', audioId)
            .eq('user_id', user.id)
            
         if (error) throw error
         return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
