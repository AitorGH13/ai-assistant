
import { useState, useEffect, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { ChatMessage, TTSAudio } from "../types";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

interface ConversationalAIProps {
  addTTSAudio: (audio: TTSAudio, conversationId?: string) => void;
  createConversation: () => string;
  loadConversation: (id: string) => void;
  addChatMessage: (message: ChatMessage, conversationId?: string) => void;
  updateConversationTitle: (id: string, newTitle: string) => void;
}

export function ConversationalAI({
  addTTSAudio,
  createConversation,
  loadConversation,
  addChatMessage,
  updateConversationTitle,
}: ConversationalAIProps) {
  const [agentId, setAgentId] = useState<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const elevenLabsConversationIdRef = useRef<string | null>(null);
  const conversationStartTimeRef = useRef<number | null>(null);
  const messagesCountRef = useRef<number>(0);
  const [_conversationMessages, setConversationMessages] = useState<Array<{role: string, message: string}>>([]);
  
  // Hook oficial de ElevenLabs para gestionar la conversación
  const conversation = useConversation({
    onConnect: () => {
      conversationStartTimeRef.current = Date.now();
      messagesCountRef.current = 0;
    },
    onDisconnect: () => {
      
      // Guardar la conversación cuando se desconecta
      if (conversationIdRef.current && conversationStartTimeRef.current) {
        const duration = Math.floor((Date.now() - conversationStartTimeRef.current) / 1000);
        const convId = conversationIdRef.current;
        const elevenLabsConvId = elevenLabsConversationIdRef.current;

        // Actualizar el título de la conversación en el historial
        const durationString = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
        updateConversationTitle(convId, `Conversación - ${durationString}`);
        
        const tryFetchAudio = async (attempts = 0, maxAttempts = 5) => {
          if (!elevenLabsConvId || attempts >= maxAttempts) {
            addTTSAudio({
              id: crypto.randomUUID(),
              text: `Conversación de voz - Duración: ${durationString} (sin audio)`,
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
                text: transcription || `Conversación de voz - Duración: ${durationString}`,
                audioUrl: audioUrl,
                timestamp: Date.now(),
                voiceId: "conversational-ai",
                voiceName: "ElevenLabs Agent",
              };
              
              // Guardar la transcripción completa como mensaje en el historial
              if (transcription && convId) {
                const chatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: transcription,
                  timestamp: new Date().toISOString(),
                };
                addChatMessage(chatMessage, convId);
              }

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
          messagesCountRef.current += 1;
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
  const isAiSpeaking = conversationStatus === "connected" && conversation.isSpeaking;

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-4">
      {/* Status indicator */}
      <div className="flex items-center gap-2.5 mb-10">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-all duration-300",
            conversationStatus === "connected"
              ? "bg-primary shadow-lg shadow-primary/50"
              : conversationStatus === "connecting"
              ? "bg-primary/70 animate-pulse shadow-md shadow-primary/30"
              : "bg-muted-foreground/30"
          )}
        />
        <span className="text-sm font-medium text-muted-foreground tracking-wide">
          {conversationStatus === "connected"
            ? isAiSpeaking
              ? "Hablando..."
              : "Escuchando..."
            : conversationStatus === "connecting"
            ? "Conectando..."
            : "Listo"}
        </span>
      </div>

      {/* Central button with pulse rings */}
      <div className="relative flex items-center justify-center mb-10">
        {/* Pulse rings — visible only when AI is speaking */}
        {isAiSpeaking && (
          <>
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-voice-pulse" />
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-voice-pulse animation-delay-300" />
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-voice-pulse animation-delay-600" />
          </>
        )}

        {conversationStatus === "connected" ? (
          <Button
            onClick={handleStopConversation}
            className={cn(
              "relative z-10 w-56 h-56 sm:w-72 sm:h-72 min-h-[224px] min-w-[224px] rounded-full transition-all duration-300",
              "shadow-2xl hover:scale-105 active:scale-95",
              isAiSpeaking
                ? "shadow-[0_0_80px_rgba(77,115,255,0.4)] ring-8 ring-primary/40"
                : "ring-8 ring-primary/20 animate-pulse"
            )}
            aria-label="Detener conversación"
          >
            <Square size={80} className="sm:w-24 sm:h-24" fill="currentColor" />
          </Button>
        ) : (
          <Button
            onClick={handleStartConversation}
            disabled={conversationStatus === "connecting"}
            className={cn(
              "relative z-10 w-56 h-56 sm:w-72 sm:h-72 min-h-[224px] min-w-[224px] rounded-full transition-all duration-300",
              "shadow-2xl hover:scale-105 active:scale-95 disabled:hover:scale-100"
            )}
            aria-label="Iniciar conversación"
          >
            {conversationStatus === "connecting" ? (
              <Loader2 className="animate-spin" size={80} />
            ) : (
              <Mic size={80} className="sm:w-24 sm:h-24" />
            )}
          </Button>
        )}
      </div>

      {/* Instruction text */}
      <p className="text-sm font-medium text-muted-foreground text-center max-w-xs">
        {conversationStatus === "connected"
          ? "Conversación activa — toca para detener"
          : conversationStatus === "connecting"
          ? "Conectando con el agente..."
          : "Toca para iniciar conversación"}
      </p>
    </div>
  );
}
