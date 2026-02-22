import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'
import { ROLE_ID } from '../_shared/constants.ts'
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
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize OpenAI client inside the handler
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
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
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (convError) throw convError

      // Since there is no foreign key between conversations and voice_sessions, 
      // we fetch separately and combine in code to avoid 500 error.
      const { data: voiceSessions, error: voiceError } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('user_id', user.id)

      if (voiceError) throw voiceError

      const combined = conversations.map(c => ({
          ...c,
          voice_sessions: voiceSessions.filter(vs => vs.conversation_id === (c.id as string))
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
      
      // Also fetch voice sessions if needed, matching Python logic
      const { data: voiceSessions } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

      // Default response struct if we couldn't find a base conversation record
      const defaultData = data || {
        id,
        title: "Conversación de Voz",
        history: [],
        created_at: new Date().toISOString()
      };

      return new Response(JSON.stringify({ ...defaultData, voice_sessions: voiceSessions || [] }), {
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
                id: ROLE_ID.USER,
                role: 'user',
                msg: lastMessage.content,
                date: new Date().toISOString()
            }
            
            currentHistory.push(userMsgEntry)
            
            if (!conversation) {
                 let title = "Nueva conversación"
                 const rawContent = typeof lastMessage.content === 'string' 
                     ? lastMessage.content 
                     : lastMessage.content.find((p: any) => p.type === 'text')?.text || '';
                 
                 if (rawContent) {
                     const cleanContent = rawContent.trim();
                     if (cleanContent.length > 40) {
                         title = cleanContent.substring(0, 40) + '...';
                     } else {
                         title = cleanContent;
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

        // --- Tool Check with Embeddings ---
        let toolResponse = null;
        try {
            const queryText = typeof lastMessage.content === 'string' 
                ? lastMessage.content 
                : lastMessage.content.find((p: any) => p.type === 'text')?.text || '';

            if (queryText.trim().length > 3) {
                const embeddingResponse = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: queryText,
                });
                const embedding = embeddingResponse.data[0].embedding;

                // Check and fix NULLs (Initialization)
                const { data: nullDocs } = await supabase.from('documents').select('id, content').is('embedding', null).limit(10);
                if (nullDocs && nullDocs.length > 0) {
                    for (const doc of nullDocs) {
                        try {
                            const eRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: doc.content });
                            await supabase.from('documents').update({ embedding: eRes.data[0].embedding }).eq('id', doc.id);
                        } catch (_e) { /* embedding fix failed, continue */ }
                    }
                }

                const { data: documents } = await supabase.rpc('match_documents', {
                    query_embedding: embedding,
                    match_threshold: 0.35, // More lenient for pre-defined knowledge
                    match_count: 1
                });

                if (documents && documents.length > 0) {
                    toolResponse = documents[0].content;
                }
                
                // --- Hardcoded Fallbacks for requested Tools ---
                const lowerQuery = queryText.toLowerCase();
                
                // Fallback for Developer questions
                if (!toolResponse && (lowerQuery.includes("desarrollador") || lowerQuery.includes("desarrolló") || lowerQuery.includes("aitor"))) {
                    const { data: aitorDoc } = await supabase.from('documents').select('content').ilike('content', '%Aitor%').limit(1);
                    if (aitorDoc && aitorDoc.length > 0) toolResponse = aitorDoc[0].content;
                }

                // Fallback for Weather
                if (!toolResponse && (lowerQuery.includes("clima") || lowerQuery.includes("tiempo"))) {
                    const { data: weatherDoc } = await supabase.from('documents').select('content').ilike('content', '%clima%desarrollo%').limit(1);
                    if (weatherDoc && weatherDoc.length > 0) toolResponse = weatherDoc[0].content;
                }
            }
        } catch (_err) {
            // Tool check failed, continue without tool response
        }

        if (toolResponse) {
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    const sseChunk = `data: ${JSON.stringify({ content: toolResponse, tool_used: true })}\n\n`;
                    controller.enqueue(encoder.encode(sseChunk));
                    
                    const doneChunk = `data: [DONE]\n\n`;
                    controller.enqueue(encoder.encode(doneChunk));
                    
                    if (!is_temporary) {
                        const aiMsgEntry = {
                            id: ROLE_ID.ASSISTANT,
                            role: 'assistant',
                            msg: toolResponse,
                            date: new Date().toISOString()
                        };
                        currentHistory.push(aiMsgEntry);
                        await supabase
                            .from('conversations')
                            .update({ history: currentHistory, updated_at: new Date().toISOString() })
                            .eq('id', conversationId);
                    }
                    controller.close();
                }
            });

            return new Response(readable, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            });
        }

        // Prepare the history to send to OpenAI
        const historyToUse = is_temporary ? messages : currentHistory;

        const processedMessages = await Promise.all(historyToUse.map(async (m: any) => {
            let processedContent = m.content || m.msg || '';
            if (Array.isArray(processedContent)) {
                processedContent = await Promise.all(processedContent.map(async (part: any) => {
                    if (part.type === 'image_url' && part.image_url?.url && !part.image_url.url.startsWith('http') && !part.image_url.url.startsWith('data:')) {
                        const { data } = await supabase.storage.from('chat-assets').createSignedUrl(part.image_url.url, 60 * 5); // 5 mins valid
                        if (data?.signedUrl) {
                            return { ...part, image_url: { url: data.signedUrl } };
                        }
                    }
                    return part;
                }));
            }
            return {
                role: m.role,
                content: processedContent
            };
        }));

        // Prepare OpenAI messages for standard response
        const openAIMessages = [
            { role: 'system', content: 'Debes responder siempre en español, independientemente del idioma que utilice el usuario.' },
            ...processedMessages
        ]

        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Model updated to support vision/images
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
                        id: ROLE_ID.ASSISTANT,
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
             id: ROLE_ID.USER,
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
        
        // Find all voice sessions related to this conversation
        const { data: relatedSessions } = await supabase
            .from('voice_sessions')
            .select('id, audio_url')
            .eq('conversation_id', id)
            .eq('user_id', user.id)
            
        // Delete physical files
        if (relatedSessions && relatedSessions.length > 0) {
            const filesToRemove = relatedSessions
                .map(s => s.audio_url)
                .filter(url => url && !url.startsWith('data:'))
                
            if (filesToRemove.length > 0) {
                await supabase.storage.from('voice-sessions').remove(filesToRemove).catch(() => { /* storage cleanup failed */ })
            }
            
            // Delete the voice_sessions rows
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
        
        const transcriptEntry = {
            msg: body.text,
            role: 'assistant',
            timestamp: body.timestamp,
            voice_id: body.voiceId,
            voice_name: body.voiceName
        }

        // Check if conversation exists, if not create it
        const { data: convData, error: convCheckError } = await supabase
            .from('conversations')
            .select('id, title')
            .eq('id', id)
            .maybeSingle()

        let title = convData?.title || 'Conversación de Voz';

        if (!convData) {
            // Determine a better title if possible
            if (body.text && body.text.trim()) {
                const cleanText = body.text.trim();
                title = cleanText.length > 40 ? cleanText.substring(0, 40) + '...' : cleanText;
            }

            const { error: insertConvError } = await supabase
                .from('conversations')
                .insert({
                    id: id,
                    user_id: user.id,
                    title: title,
                    history: [] // or initial empty history
                })
            
            if (insertConvError) throw insertConvError
        } else {
            // Update updated_at
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
                audio_url: body.audioUrl
            })
            .select()
            .single()
            
         if (error) throw error
         
         // Return data with title included so frontend can update optimistic local state
         return new Response(JSON.stringify({ ...data, title }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // 8. Delete TTS (DELETE /:id/tts/:audioId)
    const matchDeleteTTS = new URLPattern({ pathname: '/:id/tts/:audioId' }).exec({ pathname })
    if (req.method === 'DELETE' && matchDeleteTTS) {
         const conversationId = matchDeleteTTS.pathname.groups.id // conversation_id
         const audioId = matchDeleteTTS.pathname.groups.audioId
         
         // Select the audio_url first so we know what to optionally delete from storage
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
         
         // Clean up potentially orphaned storage files
         if (sessionInfo?.audio_url && !sessionInfo.audio_url.startsWith('data:')) {
             await supabase.storage.from('voice-sessions').remove([sessionInfo.audio_url]).catch(() => { /* storage cleanup failed */ })
         }

         let conversation_deleted = false;

         // Check if there are any other voice_sessions or messages for this conversation
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

         // If no remaining sessions and no messages in history, delete conversation
         if (
             (!remainingSessions || remainingSessions.length === 0) &&
             (!conversation?.history || conversation.history.length === 0)
         ) {
             await supabase
                .from('conversations')
                .delete()
                .eq('id', conversationId)
                .eq('user_id', user.id)
             
             conversation_deleted = true;
         }

         return new Response(JSON.stringify({ status: 'ok', conversation_deleted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
