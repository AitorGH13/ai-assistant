
import { useState, useEffect, useRef } from "react";
import { Mic, Square, Circle, Loader2 } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { ChatMessage, TTSAudio } from "../types";

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
        
        // Intentar obtener el audio del webhook con reintentos (reducido a 5 intentos)
        const tryFetchAudio = async (attempts = 0, maxAttempts = 5) => {
          if (!elevenLabsConvId || attempts >= maxAttempts) {
            // Si no hay audio después de varios intentos, guardar sin audio
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
            const response = await fetch(`http://localhost:3002/api/conversation-audio/${elevenLabsConvId}`);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              
              // Verificar si es audio o una respuesta JSON de error
              if (contentType?.includes('audio')) {
                // Audio disponible
                const audioBlob = await response.blob();
              
              // Convertir a base64 para persistencia (como TTS)
              const reader = new FileReader();
              const audioUrl = await new Promise<string>((resolve) => {
                reader.onloadend = () => {
                  resolve(reader.result as string);
                };
                reader.readAsDataURL(audioBlob);
              });
              
              // Obtener transcripción si está disponible
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
              // Audio aún no disponible (404 u otro error), reintentar
              setTimeout(() => tryFetchAudio(attempts + 1, maxAttempts), 3000);
            }
          } catch (error) {
            // Reintentar con delay más largo
            setTimeout(() => tryFetchAudio(attempts + 1, maxAttempts), 3000);
          }
        };
        
        // Esperar 5 segundos antes del primer intento (dar más tiempo a ElevenLabs para procesar y enviar el webhook)
        setTimeout(() => tryFetchAudio(), 5000);
        
        conversationIdRef.current = null;
        conversationStartTimeRef.current = null;
        elevenLabsConversationIdRef.current = null;
      }
    },
    onMessage: (message) => {
      // Guardar mensaje en el historial de la conversación
      if (message && typeof message === 'object') {
        const msgObj = message as any;
        const role = msgObj.role || msgObj.source || 'user';
        const content = msgObj.message || msgObj.text || '';
        
        if (content && conversationIdRef.current) {
          // Añadir el mensaje a la conversación
          const chatMessage = {
            id: crypto.randomUUID(),
            role: (role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: content,
            timestamp: new Date().toISOString(),
          };
          
          addChatMessage(chatMessage, conversationIdRef.current);
          
          // Actualizar el estado local para la UI
          setConversationMessages(prev => [...prev, {
            role: role,
            message: content
          }]);
        }
        
        // Capturar el conversation_id de ElevenLabs si está disponible
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
        const response = await fetch("http://localhost:3002/api/conversation-signature");
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
      // Limpiar mensajes anteriores
      setConversationMessages([]);
      
      // Crear nueva conversación en el historial
      const newConvId = createConversation();
      conversationIdRef.current = newConvId;
      
      // Cargar la conversación para que se actualice currentConversationId
      loadConversation(newConvId);
      
      // Pedir permiso del micrófono
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Añadir 'as any' para evitar el error de tipado estricto
      const session = await conversation.startSession({
        agentId: agentId,
      } as any);

      // El session ES el conversation_id directamente (string)
      if (session && typeof session === 'string') {
        elevenLabsConversationIdRef.current = session;
      } else if (session) {
        // Por si acaso en el futuro vuelve a ser objeto
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
    // No limpiar los mensajes aquí para que queden visibles después de terminar
  };

  // Mapeamos el estado del hook a las variables de UI
  const conversationStatus = conversation.status; // 'connected', 'connecting', 'disconnected'

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div className="text-center">
          <div className="mb-3 sm:mb-4 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary-500/10 to-accent-500/10">
            <Mic className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Conversational AI
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 px-2">
            Habla con tu agente ElevenLabs en tiempo real usando tu micrófono
          </p>
        </div>

        <div className="p-4 sm:p-6 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-center gap-3 py-2">
              <div
                className={`w-3 h-3 rounded-full transition-all ${
                  conversationStatus === "connected"
                    ? "bg-primary-500 shadow-lg shadow-primary-500/50"
                    : conversationStatus === "connecting"
                    ? "bg-primary-400 animate-pulse shadow-lg shadow-primary-400/50"
                    : "bg-gray-300 dark:bg-gray-700"
                }`}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <div className="max-h-60 overflow-y-auto space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                {conversationMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user' || msg.role === 'user'
                        ? 'bg-primary-50 dark:bg-primary-900/20 ml-8'
                        : 'bg-gray-50 dark:bg-gray-700/50 mr-8'
                    }`}
                  >
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      {msg.role === 'user' || msg.role === 'user' ? 'Tú' : 'Agente'}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center gap-4 py-6 sm:py-8">
              {conversationStatus === "connected" ? (
                <button
                  onClick={handleStopConversation}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary-300/40"
                  aria-label="Detener conversación"
                >
                  <Square size={40} className="sm:w-12 sm:h-12" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleStartConversation}
                  disabled={conversationStatus === "connecting"}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-primary-500/80 to-accent-500/90 hover:from-primary-600 hover:to-accent-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary-200/40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Iniciar conversación"
                >
                  {conversationStatus === "connecting" ? (
                    <Loader2 className="animate-spin" size={40} />
                  ) : (
                    <Circle size={40} className="sm:w-12 sm:h-12" fill="currentColor" />
                  )}
                </button>
              )}
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">
                {conversationStatus === "connected"
                  ? "Conversación activa - Click para detener"
                  : conversationStatus === "connecting"
                  ? "Conectando con el agente..."
                  : "Click para iniciar conversación"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
