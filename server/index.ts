import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // POST /api/chat - Chat completion with streaming
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body = (await req.json()) as ChatRequest;
        const { messages, systemPrompt } = body;

        if (!messages || !Array.isArray(messages)) {
          return new Response(
            JSON.stringify({ error: "messages array is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Build messages array with optional system prompt
        const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
        
        if (systemPrompt) {
          openaiMessages.push({
            role: "system",
            content: systemPrompt,
          });
        }

        openaiMessages.push(...messages);

        // Create streaming response from OpenAI
        const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          stream: true,
        });

        // Create a ReadableStream to send chunks to the client
        const readableStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            
            try {
              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                  // Send as Server-Sent Events format
                  const data = JSON.stringify({ content });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch (error) {
              console.error("Stream error:", error);
              controller.error(error);
            }
          },
        });

        return new Response(readableStream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (error) {
        console.error("Chat API error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 404 for other routes
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
