import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createHmac } from "crypto";

const PORT = 3002;

// 1. Inicialización del Cliente (según documentación oficial)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || "";

if (!ELEVENLABS_API_KEY) {
  console.warn("[!] WARNING: ELEVENLABS_API_KEY not found");
}

if (!WEBHOOK_SECRET) {
  console.warn("[!] WARNING: ELEVENLABS_WEBHOOK_SECRET not configured. Webhook signature validation disabled.");
} else {
  console.log("[OK] ELEVENLABS_WEBHOOK_SECRET configured (length:", WEBHOOK_SECRET.length, ")");
}

const client = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY
});

console.log("[OK] ElevenLabs Client initialized");

// Almacenamiento en memoria para audios de conversación (base64)
interface ConversationAudio {
  conversationId: string;
  audioBase64: string;
  timestamp: number;
  duration?: number;
  transcription?: string;
}

const conversationAudios = new Map<string, ConversationAudio>();

// Validar firma HMAC del webhook
function validateWebhookSignature(signature: string | null, body: string, timestamp: string): boolean {
  if (!WEBHOOK_SECRET) {
    return true; // Sin secret configurado, permitir
  }
  
  if (!signature) {
    return false;
  }

  // Validar timestamp (no más de 30 minutos de diferencia)
  const tolerance = Math.floor(Date.now() / 1000) - 30 * 60;
  if (parseInt(timestamp) < tolerance) {
    console.error("[Webhook] Timestamp too old");
    return false;
  }

  // Validar firma HMAC
  const payloadToSign = `${timestamp}.${body}`;
  const mac = createHmac('sha256', WEBHOOK_SECRET);
  mac.update(payloadToSign);
  const computed = 'v0=' + mac.digest('hex');

  const isValid = signature === computed;
  
  if (!isValid) {
    console.log("[Webhook] Signature mismatch:");
    console.log("  Expected:", signature);
    console.log("  Computed:", computed);
  }
  
  return isValid;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /api/voices
    if (path === "/api/voices" && req.method === "GET") {
      try {
        // ACTUALIZADO: Método moderno para obtener voces
        const response = await client.voices.getAll();
        const voices = response.voices;

        const simplifiedVoices = voices.map((voice) => ({
          id: voice.voiceId,
          name: voice.name,
          category: voice.category || "general",
          preview_url: voice.previewUrl || "",
        }));

        return new Response(JSON.stringify(simplifiedVoices), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("Error fetching voices:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // POST /api/speak
    if (path === "/api/speak" && req.method === "POST") {
      try {
        const body = await req.json() as { text?: string; voiceId?: string };
        const { text, voiceId } = body;

        if (!text || !voiceId) {
          return new Response(JSON.stringify({ error: "Missing text or voiceId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // ACTUALIZADO: Método moderno para TTS
        // El nuevo SDK retorna un stream o buffer dependiendo de la configuración
        const audioStream = await client.textToSpeech.convert(voiceId, {
          text: text,
          modelId: "eleven_turbo_v2_5",
          voiceSettings: {
            stability: 0.95,
            similarityBoost: 0.75,
          },
        });

        // Bun puede manejar el stream/buffer directamente
        return new Response(audioStream as any, {
          headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
        });
      } catch (error: any) {
        console.error("Error generating speech:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // GET /api/conversation-signature
    if (path === "/api/conversation-signature" && req.method === "GET") {
      // (Esta lógica se mantiene igual ya que depende de variables de entorno)
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      if (!agentId) {
        return new Response(JSON.stringify({ error: "ELEVENLABS_AGENT_ID not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ agentId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /api/conversation-webhook - Recibe el audio de ElevenLabs
    if (path === "/api/conversation-webhook" && req.method === "POST") {
      try {
        const bodyText = await req.text();
        
        // Validar firma HMAC si está configurada
        const signatureHeader = req.headers.get("elevenlabs-signature");
        if (signatureHeader) {
          const timestamp = signatureHeader.split(",")[0]?.substring(2) || "";
          const signature = signatureHeader.split(",")[1] || "";
          
          if (!validateWebhookSignature(signature, bodyText, timestamp)) {
            console.error("[Webhook] ❌ Signature validation failed");
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.log("[Webhook] ✅ Signature validated");
        } else {
          console.log("[Webhook] No signature header (validation skipped)");
        }

        const body = JSON.parse(bodyText) as any;
        const webhookType = body.type;
        
        console.log(`[Webhook] Received: ${webhookType}`);

        // Manejar diferentes tipos de webhooks
        if (webhookType === "post_call_audio") {
          return await handleAudioWebhook(body, corsHeaders);
        } else if (webhookType === "post_call_transcription") {
          return await handleTranscriptionWebhook(body, corsHeaders);
        } else {
          console.warn(`[Webhook] Unknown webhook type: ${webhookType}`);
          return new Response(JSON.stringify({ error: "Unknown webhook type" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (error: any) {
        console.error("[Webhook] Error:", error);
        console.error("[Webhook] Stack:", error.stack);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Función auxiliar para manejar webhook de audio
    async function handleAudioWebhook(body: any, corsHeaders: any): Promise<Response> {
      const data = body.data || {};
      const conversation_id = data.conversation_id;
      const full_audio = data.full_audio;

      if (!conversation_id || !full_audio) {
        return new Response(JSON.stringify({ error: "Missing conversation_id or full_audio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        // Guardar audio en base64 (para persistencia, como el TTS)
        conversationAudios.set(conversation_id, {
          conversationId: conversation_id,
          audioBase64: full_audio,
          timestamp: Date.now(),
          duration: data.duration,
        });

        console.log(`[Webhook] ✅ Audio saved: ${conversation_id}`);

        return new Response(JSON.stringify({ 
          status: "success",
          message: "Audio saved successfully",
          conversation_id 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("[Webhook:Audio] Error processing audio:", error);
        return new Response(JSON.stringify({ error: "Invalid audio data" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Función auxiliar para manejar webhook de transcripción
    async function handleTranscriptionWebhook(body: any, corsHeaders: any): Promise<Response> {
      const data = body.data || {};
      const conversation_id = data.conversation_id;
      const transcription = data.transcription;

      if (!conversation_id || !transcription) {
        return new Response(JSON.stringify({ error: "Missing conversation_id or transcription" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        // Actualizar transcripción si el audio ya existe
        const existing = conversationAudios.get(conversation_id);
        if (existing) {
          conversationAudios.set(conversation_id, {
            ...existing,
            transcription,
          });
        } else {
          // Crear entrada solo con transcripción
          conversationAudios.set(conversation_id, {
            conversationId: conversation_id,
            audioBase64: "",
            timestamp: Date.now(),
            transcription,
          });
        }

        console.log(`[Webhook] Saved transcription for conversation ${conversation_id}`);

        return new Response(JSON.stringify({ 
          status: "success",
          message: "Transcription saved successfully",
          conversation_id 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("[Webhook] Error processing transcription:", error);
        return new Response(JSON.stringify({ error: "Invalid transcription data" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // GET /api/conversation-audio/:conversationId - Obtener audio guardado
    if (path.startsWith("/api/conversation-audio/") && req.method === "GET") {
      try {
        const conversationId = path.split("/").pop();
        
        if (!conversationId) {
          return new Response(JSON.stringify({ error: "Missing conversation ID" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const audioData = conversationAudios.get(conversationId);
        
        if (!audioData || !audioData.audioBase64) {
          return new Response(JSON.stringify({ error: "Audio not found", ready: false }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Decodificar base64 y devolver como audio
        const audioBuffer = Buffer.from(audioData.audioBase64, 'base64');
        
        return new Response(audioBuffer, {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "audio/mpeg",
            "X-Transcription": audioData.transcription || ""
          },
        });
      } catch (error: any) {
        console.error("[Audio] Error fetching:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // DEBUG: GET /api/debug/conversations - Ver conversaciones almacenadas
    if (path === "/api/debug/conversations" && req.method === "GET") {
      const conversations = Array.from(conversationAudios.entries()).map(([id, data]) => ({
        id,
        timestamp: data.timestamp,
        hasAudio: !!data.audioBase64,
        audioSize: data.audioBase64?.length || 0,
        duration: data.duration,
        hasTranscription: !!data.transcription,
      }));
      
      return new Response(JSON.stringify({ 
        total: conversationAudios.size,
        conversations 
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Health check
    if (path === "/" || path === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "elevenlabs-voice" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`🎙️  ElevenLabs Voice Server running on http://localhost:${PORT}`);