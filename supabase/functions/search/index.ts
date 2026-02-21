import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'
import OpenAI from 'https://esm.sh/openai@4.28.0'


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

  if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
  }

  try {
    // Initialize OpenAI client inside the handler
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set')
      throw new Error('Server configuration error: Missing OpenAI API Key')
    }
    
    const openai = new OpenAI({
      apiKey: apiKey,
    })
    const { query } = await req.json()
    
    if (!query) {
        throw new Error('Query is required')
    }
    
    // 0. Auto-update NULL embeddings (Initialization logic)
    // Check if there are any documents with NULL embeddings
    const { data: nullDocs, error: nullError } = await supabase
        .from('documents')
        .select('id, content')
        .is('embedding', null)
        .limit(10) // Process in small batches
        
    if (!nullError && nullDocs && nullDocs.length > 0) {
        console.log(`Generating embeddings for ${nullDocs.length} documents...`)
        for (const doc of nullDocs) {
            try {
                const embRes = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: doc.content,
                })
                const emb = embRes.data[0].embedding
                await supabase
                    .from('documents')
                    .update({ embedding: emb })
                    .eq('id', doc.id)
            } catch (e) {
                console.error(`Failed to generate embedding for doc ${doc.id}:`, e)
            }
        }
    }

    // 1. Generate Embedding for the query
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    })
    
    const embedding = embeddingResponse.data[0].embedding
    
    // 2. Call Supabase RPC 'match_documents'
    // Simplified search: if similarity is NULL (placeholder), we skip it in the filter
    const { data: documents, error } = await supabase
        .rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.1, // Lowered threshold for testing
            match_count: 3
        })
        
    if (error) throw error
    
    // Transform documents to match the SearchResponse interface expected by the frontend
    const results = documents && documents.length > 0 
      ? {
          result: documents[0].content,
          similarity: documents[0].similarity,
          all_results: documents.map((doc: any) => ({
            text: doc.content,
            similarity: doc.similarity
          }))
        }
      : {
          result: "No se encontraron resultados relevantes.",
          similarity: 0,
          all_results: []
        };
    
    return new Response(JSON.stringify(results), {
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
