
import { useState, useEffect, useRef } from "react";
import { Mic, Square, Circle, Loader2 } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { ChatMessage, TTSAudio } from "../types";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { ScrollArea } from "./ui/ScrollArea";
import { cn } from "../lib/utils";

interface ConversationalAIProps {
  addTTSAudio: (audio: TTSAudio, conversationId?: string) => void;
  createConversation: () => string;
  loadConversation: (id: string) => void;
  addChatMessage: (message: ChatMessage, conversationId?: string) => void;
}

export function ConversationalAI({
  addTTSAudio,
  createConversation,
  loadConversation,
  addChatMessage,
}: ConversationalAIProps) {
  const [agentId, setAgentId] = useState<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const elevenLabsConversationIdRef = useRef<string | null>(null);
  const conversationStartTimeRef = useRef<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Array<{role: string, message: string}>>([]);
  
  // Hook oficial de ElevenLabs para gestionar la conversación
  const conversation = useConversation({
    onConnect: () => {
      conversationStartTimeRef.current = Date.now();
    },
    onDisconnect: () => {
      
      // Guardar la conversación cuando se desconecta
      if (conversationIdRef.current && conversationStartTimeRef.current) {
        const duration = Math.floor((Date.now() - conversationStartTimeRef.current) / 1000);
        const convId = conversationIdRef.current;
        const elevenLabsConvId = elevenLabsConversationIdRef.current;
        
        const tryFetchAudio = async (attempts = 0, maxAttempts = 5) => {
          if (!elevenLabsConvId || attempts >= maxAttempts) {
            addTTSAudio({
              id: crypto.randomUUID(),
              text: `Conversación de voz - Duración: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} (sin audio)`,
              audioUrl: "",
              timestamp: Date.now(),
              voiceId: "conversational-ai",
              voiceName: "ElevenLabs Agent",
            }, convId);
            return;
          }
          
          try {
            const response = await fetch(`/api/conversation-audio/${elevenLabsConvId}`);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              
              if (contentType?.includes('audio')) {
                const audioBlob = await response.blob();
              
              const reader = new FileReader();
              const audioUrl = await new Promise<string>((resolve) => {
                reader.onloadend = () => {
                  resolve(reader.result as string);
                };
                reader.readAsDataURL(audioBlob);
              });
              
              const transcription = response.headers.get('X-Transcription') || '';
              
              const audioEntry = {
                id: crypto.randomUUID(),
                text: transcription || `Conversación de voz - Duración: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`,
                audioUrl: audioUrl,
                timestamp: Date.now(),
                voiceId: "conversational-ai",
                voiceName: "ElevenLabs Agent",
              };
              
              addTTSAudio(audioEntry, convId);
              } else {
                setTimeout(() => tryFetchAudio(attempts + 1, maxAttempts), 3000);
              }
            } else {
              setTimeout(() => tryFetchAudio(attempts + 1, maxAttempts), 3000);
            }
          } catch {
            setTimeout(() => tryFetchAudio(attempts + 1, maxAttempts), 3000);
          }
        };
        
        setTimeout(() => tryFetchAudio(), 5000);
        
        conversationIdRef.current = null;
        conversationStartTimeRef.current = null;
        elevenLabsConversationIdRef.current = null;
      }
    },
    onMessage: (message) => {
      if (message && typeof message === 'object') {
        const msgObj = message as any;
        const role = msgObj.role || msgObj.source || 'user';
        const content = msgObj.message || msgObj.text || '';
        
        if (content && conversationIdRef.current) {
          const chatMessage = {
            id: crypto.randomUUID(),
            role: (role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: content,
            timestamp: new Date().toISOString(),
          };
          
          addChatMessage(chatMessage, conversationIdRef.current);
          
          setConversationMessages(prev => [...prev, {
            role: role,
            message: content
          }]);
        }
        
        const possibleId = msgObj.conversation_id || 
                          msgObj.conversationId ||
                          msgObj.id ||
                          msgObj.session_id;
        
        if (possibleId) {
          elevenLabsConversationIdRef.current = possibleId;
        }
      }
    },
    onError: (error) => console.error("Error:", error),
  });

  // Obtener agentId del servidor
  useEffect(() => {
    const fetchAgentId = async () => {
      try {
        const response = await fetch("/api/conversation-signature");
        if (response.ok) {
          const data = await response.json();
          setAgentId(data.agentId);
        }
      } catch (error) {
        console.error("Error fetching agent ID:", error);
      }
    };
    fetchAgentId();
  }, []);

  const handleStartConversation = async () => {
    if (!agentId) {
      alert("No se pudo obtener el Agent ID del servidor");
      return;
    }

    try {
      setConversationMessages([]);
      
      const newConvId = createConversation();
      conversationIdRef.current = newConvId;
      
      loadConversation(newConvId);
      
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const session = await conversation.startSession({
        agentId: agentId,
      } as any);

      if (session && typeof session === 'string') {
        elevenLabsConversationIdRef.current = session;
      } else if (session) {
        const sessionId = (session as any).conversationId || (session as any).id || session;
        elevenLabsConversationIdRef.current = sessionId;
      }

    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("No se pudo iniciar la conversación. Asegúrate de permitir el acceso al micrófono.");
      conversationIdRef.current = null;
    }
  };

  const handleStopConversation = async () => {
    await conversation.endSession();
  };

  const conversationStatus = conversation.status;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div className="text-center">
          <div className="mb-3 sm:mb-4 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
            <Mic className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Conversational AI
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-2">
            Habla con tu agente ElevenLabs en tiempo real usando tu micrófono
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-center gap-3 py-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  conversationStatus === "connected"
                    ? "bg-primary shadow-lg shadow-primary/50"
                    : conversationStatus === "connecting"
                    ? "bg-primary/70 animate-pulse shadow-lg shadow-primary/30"
                    : "bg-muted-foreground/30"
                )}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {conversationStatus === "connected"
                  ? "Conectado"
                  : conversationStatus === "connecting"
                  ? "Conectando..."
                  : "Desconectado"}
                {conversationStatus === "connected" && conversation.isSpeaking && " (Hablando)"}
              </span>
            </div>

            {/* Mensajes de la conversación */}
            {conversationMessages.length > 0 && (
              <ScrollArea className="max-h-60 border-t border-border pt-4">
                <div className="space-y-2">
                  {conversationMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg",
                        msg.role === 'user'
                          ? 'bg-primary/10 ml-8'
                          : 'bg-muted mr-8'
                      )}
                    >
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {msg.role === 'user' ? 'Tú' : 'Agente'}
                      </div>
                      <div className="text-sm text-foreground">
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex flex-col items-center gap-4 py-6 sm:py-8">
              {conversationStatus === "connected" ? (
                <Button
                  variant="destructive"
                  onClick={handleStopConversation}
                  className="w-28 h-28 sm:w-32 sm:h-32 min-h-[112px] min-w-[112px] rounded-full shadow-2xl hover:scale-105 active:scale-95"
                  aria-label="Detener conversación"
                >
                  <Square size={40} className="sm:w-12 sm:h-12" fill="currentColor" />
                </Button>
              ) : (
                <Button
                  onClick={handleStartConversation}
                  disabled={conversationStatus === "connecting"}
                  className="w-28 h-28 sm:w-32 sm:h-32 min-h-[112px] min-w-[112px] rounded-full shadow-2xl hover:scale-105 active:scale-95 disabled:hover:scale-100"
                  aria-label="Iniciar conversación"
                >
                  {conversationStatus === "connecting" ? (
                    <Loader2 className="animate-spin" size={40} />
                  ) : (
                    <Circle size={40} className="sm:w-12 sm:h-12" fill="currentColor" />
                  )}
                </Button>
              )}
              <p className="text-sm font-medium text-muted-foreground text-center">
                {conversationStatus === "connected"
                  ? "Conversación activa - Click para detener"
                  : conversationStatus === "connecting"
                  ? "Conectando con el agente..."
                  : "Click para iniciar conversación"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
