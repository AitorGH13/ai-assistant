import { useState, useEffect, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import api from "../services/api";

interface ConversationalAIProps {
  createConversation: (isTemporary?: boolean) => string;
  loadConversation: (id: string) => void;
  isTemporary?: boolean;
}

export function ConversationalAI({
  createConversation,
  loadConversation,
  isTemporary = false,
}: ConversationalAIProps) {
  const [agentId, setAgentId] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const conversationIdRef = useRef<string | null>(null);
  const elevenLabsConversationIdRef = useRef<string | null>(null);
  const conversationStartTimeRef = useRef<number | null>(null);
  const messagesCountRef = useRef<number>(0);
  const conversationMessagesRef = useRef<Array<{role: string, message: string}>>([]);
  const [_conversationMessages, setConversationMessages] = useState<Array<{role: string, message: string}>>([]);
  
  const isTemporaryRef = useRef(isTemporary);
  
  useEffect(() => {
    isTemporaryRef.current = isTemporary;
  }, [isTemporary]);

  // Hook oficial de ElevenLabs para gestionar la conversación
  const conversation = useConversation({
    onConnect: () => {
      setConnectionError(null);
      conversationStartTimeRef.current = Date.now();
      messagesCountRef.current = 0;
      conversationMessagesRef.current = [];
    },
    onDisconnect: () => {
      
      // Guardar la conversación cuando se desconecta
      if (conversationIdRef.current && conversationStartTimeRef.current) {
        const elevenLabsConvId = elevenLabsConversationIdRef.current; // The ID we need for backend

        const currentAppConvId = conversationIdRef.current;

        const saveVoiceSession = async (convId: string) => {
            try {
                // Collect transcript from Ref (fallback)
                const fallbackTranscript = conversationMessagesRef.current.map(msg => ({
                    role: msg.role === 'assistant' ? 'agent' : 'user', // Map back to ElevenLabs/Backend terms if needed, or just send as is and let backend handle.
                    // Backend expects 'agent' or 'user'. Frontend uses 'assistant'.
                    message: msg.message
                }));

                await api.post(`/voice-webhook`, {
                    conversation_id: convId,
                    transcript: fallbackTranscript,
                    app_conversation_id: currentAppConvId
                });
                
                if (currentAppConvId) {
                    loadConversation(currentAppConvId);
                }
                
            } catch (e) {
                console.error("Error saving session", e);
            }
        };
        
        // Use Ref to ensure we have the latest value inside the callback
        if (elevenLabsConvId && !isTemporaryRef.current) {
            saveVoiceSession(elevenLabsConvId);
        } else if (isTemporaryRef.current && conversationIdRef.current) {
             // Logic for temporary session (do nothing / don't save)
             // ...
        }

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
        
        if (content) {
          messagesCountRef.current += 1;
          
          const newMsg = {
            role: (role === 'agent' ? 'assistant' : 'user'), 
            message: content
          };
          
          // Update Ref for safe access in onDisconnect
          conversationMessagesRef.current.push(newMsg);

          setConversationMessages(prev => [...prev, newMsg]);
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
    onError: (error) => {
        console.error("Error:", error);
        setConnectionError("Error de conexión. Inténtalo de nuevo.");
    },
  });

  // Obtener agentId del servidor
  useEffect(() => {
    let mounted = true;
    const fetchAgentId = async () => {
      try {
        setIsInitializing(true);
        const API_URL = import.meta.env.PROD 
          ? '/functions/v1' 
          : (import.meta.env.VITE_API_URL || 'https://nbleuwsnbxrmcxpmueeh.supabase.co/functions/v1');
        const response = await fetch(`${API_URL}/voice-signature`);
        if (response.ok) {
          const data = await response.json();
          if (mounted) {
              if (data.agentId) {
                setAgentId(data.agentId);
              } else {
                setConnectionError("Configuración de agente incompleta");
              }
          }
        } else {
            if (mounted) setConnectionError("Error contactando al servidor");
        }
      } catch (error) {
        console.error("Error fetching agent ID:", error);
        if (mounted) setConnectionError("Error de red");
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };
    fetchAgentId();
    
    return () => { mounted = false; };
  }, []);

  const handleStartConversation = async () => {
    if (!agentId) {
      setConnectionError("No se pudo obtener el ID del agente");
      return;
    }

    try {
      setConnectionError(null);
      setConversationMessages([]);
      
      const newConvId = createConversation(isTemporary);
      conversationIdRef.current = newConvId;
      
      // Do not loadConversation(newConvId) here because it is local-only and will 404 on backend
      // createConversation already sets it as current.
      
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const session = await conversation.startSession({
        agentId: agentId,
      } as any);

      if (session && typeof session === 'string') {
        elevenLabsConversationIdRef.current = session;
        // Register session with backend immediately to link it to the user
        // This ensures the webhook knows which user this conversation belongs to
        try {
            api.post('/voice-webhook', {
                action: 'register',
                conversation_id: session
            });
        } catch (err) {
            console.error("Failed to register session:", err);
        }
      } else if (session) {
        const sessionId = (session as any).conversationId || (session as any).id || session;
        elevenLabsConversationIdRef.current = sessionId;
        
        try {
            api.post('/voice-webhook', {
                action: 'register',
                conversation_id: sessionId
            });
        } catch (err) {
            console.error("Failed to register session:", err);
        }
      }

    } catch (error: any) {
      console.error("Error starting conversation:", error);
      conversationIdRef.current = null;
      
      let errorMessage = "No se pudo iniciar la conversación.";
      if (error?.name === "NotAllowedError" || error?.message?.includes("permission")) {
          errorMessage = "Acceso al micrófono denegado.";
      } else if (error?.code === "WebSocketError") {
          errorMessage = "Error de conexión con el agente.";
      }
      
      setConnectionError(errorMessage);
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
            : isInitializing 
                ? "Iniciando..." 
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
              "shadow-2xl hover:scale-105 active:scale-95 hover:bg-primary",
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
            disabled={conversationStatus === "connecting" || isInitializing}
            className={cn(
              "relative z-10 w-56 h-56 sm:w-72 sm:h-72 min-h-[224px] min-w-[224px] rounded-full transition-all duration-300",
              "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] dark:shadow-[0_0_60px_rgba(77,115,255,0.4)] hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:opacity-80 hover:bg-primary"
            )}
            aria-label="Iniciar conversación"
          >
            {conversationStatus === "connecting" || isInitializing ? (
              <Loader2 className="animate-spin" size={80} />
            ) : (
              <Mic size={80} className="sm:w-24 sm:h-24" />
            )}
          </Button>
        )}
      </div>

      {/* Instruction text / Error message */}
      <div className="text-center max-w-xs h-8">
        {connectionError ? (
            <p className="text-sm font-medium text-red-500 animate-in fade-in slide-in-from-bottom-2">
                {connectionError}
            </p>
        ) : (
            <p className="text-sm font-medium text-muted-foreground">
                {conversationStatus === "connected"
                ? "Conversación activa — toca para detener"
                : conversationStatus === "connecting"
                ? "Conectando con el agente..."
                : isInitializing 
                    ? "Cargando configuración..."
                    : "Toca para iniciar conversación"}
            </p>
        )}
      </div>
    </div>
  );
}
