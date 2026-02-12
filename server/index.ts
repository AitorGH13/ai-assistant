import { ElevenLabsClient } from "elevenlabs-js";

const PORT = 3002;

// Initialize ElevenLabs client
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.warn("[!] WARNING: ELEVENLABS_API_KEY not found in environment variables");
}

const client = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /api/voices - Fetch available voices
    if (path === "/api/voices" && req.method === "GET") {
      try {
        const voices = await client.voices.getAll();
        
        // Simplify the response
        const simplifiedVoices = voices.voices.map((voice: any) => ({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          preview_url: voice.preview_url,
        }));

        return new Response(JSON.stringify(simplifiedVoices), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      } catch (error: any) {
        console.error("Error fetching voices:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Failed to fetch voices" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // POST /api/speak - Streaming TTS
    if (path === "/api/speak" && req.method === "POST") {
      try {
        const body = await req.json();
        const { text, voiceId } = body;

        if (!text || !voiceId) {
          return new Response(
            JSON.stringify({ error: "Missing text or voiceId" }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        // Stream audio from ElevenLabs
        const audioStream = await client.textToSpeech.convert(voiceId, {
          text,
          model_id: "eleven_monolingual_v1",
          output_format: "mp3_44100_128",
        });

        // Return the stream directly to the client
        return new Response(audioStream as any, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Transfer-Encoding": "chunked",
          },
        });
      } catch (error: any) {
        console.error("Error generating speech:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Failed to generate speech" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // GET /api/conversation-signature - For Conversational AI
    if (path === "/api/conversation-signature" && req.method === "GET") {
      try {
        const agentId = process.env.ELEVENLABS_AGENT_ID;
        
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: "ELEVENLABS_AGENT_ID not configured" }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        // For the @11labs/react SDK, we need to provide a signed URL
        // The SDK typically uses the agent ID and API key directly
        // We'll return the agent ID and let the frontend handle connection
        // In production, you'd want to generate a temporary token here
        return new Response(
          JSON.stringify({
            agentId,
            // The frontend will use the conversation hook which handles authentication
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error: any) {
        console.error("Error getting conversation signature:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Failed to get conversation signature" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // Health check
    if (path === "/" || path === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "elevenlabs-voice" }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Not Found", { 
      status: 404,
      headers: corsHeaders,
    });
  },
});

console.log(`🎙️  ElevenLabs Voice Server running on http://localhost:${PORT}`);
