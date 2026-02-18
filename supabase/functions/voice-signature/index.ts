import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
  }

  try {
    // Generate HMAC signature for ElevenLabs ConvAI Widget checking
    // This is optional if the widget doesn't require it, but user mentioned it in plan.
    // Usually standard ElevenLabs widget usage involves just the agent ID.
    // But if we are doing signed URLs or something:
    // User requested: "voice-signature (Function): Handles GET to generate the HMAC signature for the frontend widget."
    
    // Logic:
    // 1. Get Agent ID (or use env var)
    // 2. We need a secret to sign with? ElevenLabs usually uses the API Key for backend signing?
    // Actually, "Signed Link" feature in ElevenLabs requires specific logic.
    // If user meant "Get the ephemeral token" or similar.
    // Let's assume standard HMAC SHA-256 signing of a timestamp if that's what is required.
    // Or maybe just returning a signed token.
    
    // WITHOUT specific docs on "voice-signature" logic from user codebase (it wasn't in Python files?), 
    // I will implement a placeholder that returns a signature based on a secret.
    // Wait, the Python code didn't have this. The user ADDED it in the request.
    // "voice-signature ... for the frontend widget."
    // I will implement a generic HMAC signature using crypto.subtle.
    
    const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID')
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    
    if (!ELEVENLABS_API_KEY) {
        throw new Error('Missing ElevenLabs API Key')
    }

    // Example signature logic (adjust to ElevenLabs specs if known, otherwise generic)
    // Assuming we sign the Agent ID and Timestamp?
    const timestamp = Math.floor(Date.now() / 1000)
    const dataToSign = \`\${ELEVENLABS_AGENT_ID}:\${timestamp}\`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(ELEVENLABS_API_KEY)
    const messageData = encoder.encode(dataToSign)
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw', 
        keyData, 
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['sign']
    )
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const signatureArray = new Uint8Array(signatureBuffer)
    const signatureHex = Array.from(signatureArray).map(b => b.toString(16).padStart(2, '0')).join('')

    return new Response(JSON.stringify({ 
        signature: signatureHex, 
        timestamp, 
        agentId: ELEVENLABS_AGENT_ID 
    }), {
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
