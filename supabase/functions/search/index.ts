import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
  }

  try {
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
