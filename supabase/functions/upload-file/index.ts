import { corsHeaders } from '../_shared/cors.ts'
import { createAuthClient } from '../_shared/supabaseClient.ts'

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
    const supabase = createAuthClient(req)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Determine bucket based on file type or request?
    // Python code `storage_service.py` had defaults (media-uploads) but `chat.py` didn't specify.
    // Let's assume 'chat-uploads' or 'media' bucket.
    // User task didn't specify bucket.
    // Based on `voice_svc.py`, bucket is 'voice-sessions'.
    // `chat.py` calls `storage_service.upload_file` defaults to `media-uploads`.
    const bucketName = 'media-uploads'
    
    // Create unique path
    const fileExt = file.name.split('.').pop()
    const fileName = user.id + '/' + Date.now() + '.' + fileExt

    const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(fileName, file, {
            contentType: file.type,
            upsert: false
        })

    if (error) throw error
    
    const relativePath = fileName
    // Return the relative path so the frontend can use SecureAsset to sign it
    return new Response(JSON.stringify({ url: relativePath, path: relativePath }), {
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
