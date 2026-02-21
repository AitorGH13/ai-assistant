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
    
    // 1. Generate Embedding
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    })
    
    const embedding = embeddingResponse.data[0].embedding
    
    // 2. Call Supabase RPC 'match_documents'
    // This assumes the user has set up pgvector and the function
    const { data: documents, error } = await supabase
        .rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.5, // Adjust as needed
            match_count: 5
        })
        
    if (error) throw error
    
    return new Response(JSON.stringify(documents), {
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
