import { getCorsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'
import { ROLE_ID } from '../_shared/constants.ts'
import OpenAI from 'https://esm.sh/openai@4.28.0'

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 }

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
    const rateCheck = await checkRateLimit(supabase, user.id, 'messages', RATE_LIMIT)
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) },
      })
    }

    // Initialize OpenAI
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('Server configuration error: Missing OpenAI API Key')
    const openai = new OpenAI({ apiKey })

    const url = new URL(req.url)
    let pathname = url.pathname

    if (pathname.startsWith('/functions/v1/messages')) {
      pathname = pathname.slice('/functions/v1/messages'.length)
    } else if (pathname.startsWith('/messages')) {
      pathname = pathname.slice('/messages'.length)
    }
    if (!pathname || pathname === '') pathname = '/'

    // 1. Send Message (POST /:id/message)
    const matchMessage = new URLPattern({ pathname: '/:id/message' }).exec({ pathname })
    if (req.method === 'POST' && matchMessage) {
      const conversationId = matchMessage.pathname.groups.id
      const body = await req.json()
      const { messages, is_temporary } = body

      const lastMessage = messages[messages.length - 1]
      let currentHistory: any[] = []

      if (!is_temporary) {
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
          date: new Date().toISOString(),
        }

        currentHistory.push(userMsgEntry)

        if (!conversation) {
          let title = 'Nueva conversación'
          const rawContent =
            typeof lastMessage.content === 'string'
              ? lastMessage.content
              : lastMessage.content.find((p: any) => p.type === 'text')?.text || ''

          if (rawContent) {
            const cleanContent = rawContent.trim()
            title = cleanContent.length > 40 ? cleanContent.substring(0, 40) + '...' : cleanContent
          }

          await supabase.from('conversations').insert({
            id: conversationId,
            user_id: user.id,
            title,
            history: currentHistory,
          })
        } else {
          await supabase
            .from('conversations')
            .update({ history: currentHistory, updated_at: new Date().toISOString() })
            .eq('id', conversationId)
        }
      } else {
        currentHistory = messages.map((m: any) => ({
          role: m.role,
          msg: m.content,
        }))
      }

      // --- Tool Check with Embeddings ---
      let toolResponse: string | null = null
      try {
        const queryText =
          typeof lastMessage.content === 'string'
            ? lastMessage.content
            : lastMessage.content.find((p: any) => p.type === 'text')?.text || ''

        if (queryText.trim().length > 3) {
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: queryText,
          })
          const embedding = embeddingResponse.data[0].embedding

          // Fix NULL embeddings
          const { data: nullDocs } = await supabase
            .from('documents')
            .select('id, content')
            .is('embedding', null)
            .limit(10)
          if (nullDocs && nullDocs.length > 0) {
            for (const doc of nullDocs) {
              try {
                const eRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: doc.content })
                await supabase.from('documents').update({ embedding: eRes.data[0].embedding }).eq('id', doc.id)
              } catch (_e) {
                /* continue */
              }
            }
          }

          const { data: documents } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.35,
            match_count: 1,
          })

          if (documents && documents.length > 0) {
            toolResponse = documents[0].content
          }

          // Hardcoded fallbacks
          const lowerQuery = queryText.toLowerCase()
          if (
            !toolResponse &&
            (lowerQuery.includes('desarrollador') || lowerQuery.includes('desarrolló') || lowerQuery.includes('aitor'))
          ) {
            const { data: aitorDoc } = await supabase
              .from('documents')
              .select('content')
              .ilike('content', '%Aitor%')
              .limit(1)
            if (aitorDoc && aitorDoc.length > 0) toolResponse = aitorDoc[0].content
          }

          if (!toolResponse && (lowerQuery.includes('clima') || lowerQuery.includes('tiempo'))) {
            const { data: weatherDoc } = await supabase
              .from('documents')
              .select('content')
              .ilike('content', '%clima%desarrollo%')
              .limit(1)
            if (weatherDoc && weatherDoc.length > 0) toolResponse = weatherDoc[0].content
          }
        }
      } catch (_err) {
        // Tool check failed
      }

      if (toolResponse) {
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: toolResponse, tool_used: true })}\n\n`)
            )
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))

            if (!is_temporary) {
              const aiMsgEntry = {
                id: ROLE_ID.ASSISTANT,
                role: 'assistant',
                msg: toolResponse,
                date: new Date().toISOString(),
              }
              currentHistory.push(aiMsgEntry)
              await supabase
                .from('conversations')
                .update({ history: currentHistory, updated_at: new Date().toISOString() })
                .eq('id', conversationId)
            }
            controller.close()
          },
        })

        return new Response(readable, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }

      // Prepare OpenAI messages
      const historyToUse = is_temporary ? messages : currentHistory
      const processedMessages = await Promise.all(
        historyToUse.map(async (m: any) => {
          let processedContent = m.content || m.msg || ''
          if (Array.isArray(processedContent)) {
            processedContent = await Promise.all(
              processedContent.map(async (part: any) => {
                if (
                  part.type === 'image_url' &&
                  part.image_url?.url &&
                  !part.image_url.url.startsWith('http') &&
                  !part.image_url.url.startsWith('data:')
                ) {
                  const { data } = await supabase.storage
                    .from('chat-assets')
                    .createSignedUrl(part.image_url.url, 60 * 5)
                  if (data?.signedUrl) {
                    return { ...part, image_url: { url: data.signedUrl } }
                  }
                }
                return part
              })
            )
          }
          return { role: m.role, content: processedContent }
        })
      )

      const openAIMessages = [
        { role: 'system', content: 'Debes responder siempre en español, independientemente del idioma que utilice el usuario.' },
        ...processedMessages,
      ]

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
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
              const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
              controller.enqueue(encoder.encode(sseChunk))
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))

          if (!is_temporary) {
            const aiMsgEntry = {
              id: ROLE_ID.ASSISTANT,
              role: 'assistant',
              msg: fullContent,
              date: new Date().toISOString(),
            }
            currentHistory.push(aiMsgEntry)
            await supabase
              .from('conversations')
              .update({ history: currentHistory, updated_at: new Date().toISOString() })
              .eq('id', conversationId)
          }

          controller.close()
        },
      })

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // 2. Create Conversation (POST /new)
    if (req.method === 'POST' && pathname === '/new') {
      const body = await req.json()
      const { messages } = body

      const firstMsgContent = messages[0].content
      let firstMsgText = 'New Conversation'

      if (typeof firstMsgContent === 'string') {
        firstMsgText = firstMsgContent
      } else if (Array.isArray(firstMsgContent)) {
        const textPart = firstMsgContent.find((p: any) => p.type === 'text')
        if (textPart && textPart.text) firstMsgText = textPart.text
      }

      const title = firstMsgText.substring(0, 30) + '...'

      const initialMsg = {
        id: ROLE_ID.USER,
        role: 'user',
        msg: firstMsgContent,
        date: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title,
          history: [initialMsg],
        })
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify(data), {
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
