import { useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
// IMPORTANTE: Importamos el hook oficial
import { useConversation } from "@elevenlabs/react";

export function ConversationalAI() {
  const [agentId, setAgentId] = useState("");

  // Hook oficial de ElevenLabs para gestionar la conversación
  const conversation = useConversation({
    onConnect: () => console.log("Connected to Agent"),
    onDisconnect: () => console.log("Disconnected from Agent"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.error("Error:", error),
  });

  const handleStartConversation = async () => {
    if (!agentId) {
      alert("Por favor ingresa un Agent ID");
      return;
    }

    try {
      // Pedir permiso del micrófono
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Añadir 'as any' para evitar el error de tipado estricto
      await conversation.startSession({
        agentId: agentId,
      } as any);

    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("No se pudo iniciar la conversación. Asegúrate de permitir el acceso al micrófono.");
    }
  };

  const handleStopConversation = async () => {
    await conversation.endSession();
  };

  // Mapeamos el estado del hook a las variables de UI
  const conversationStatus = conversation.status; // 'connected', 'connecting', 'disconnected'

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Mic className="text-primary-500" size={28} />
            Conversational AI
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Agent ID
              </label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="Ingresa tu ElevenLabs Agent ID"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 transition-all"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                También puedes configurar ELEVENLABS_AGENT_ID en tu archivo .env
              </p>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-3 py-2">
              <div className={`w-3 h-3 rounded-full transition-all ${
                conversationStatus === "connected" 
                  ? "bg-green-500 shadow-lg shadow-green-500/50" 
                  : conversationStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50"
                  : "bg-gray-300 dark:bg-gray-700"
              }`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {conversationStatus === "connected" 
                  ? "Conectado" 
                  : conversationStatus === "connecting"
                  ? "Conectando..."
                  : "Desconectado"}
                {conversation.isSpeaking && " (Hablando)"}
              </span>
            </div>

            {/* Microphone Button */}
            <div className="flex flex-col items-center gap-4 py-8">
              {conversationStatus === "connected" ? (
                <button
                  onClick={handleStopConversation}
                  className="w-28 h-28 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95"
                >
                  <Square size={40} />
                </button>
              ) : (
                <button
                  onClick={handleStartConversation}
                  disabled={!agentId || conversationStatus === "connecting"}
                  className="w-28 h-28 rounded-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {conversationStatus === "connecting" ? (
                    <Loader2 className="animate-spin" size={40} />
                  ) : (
                    <Mic size={40} />
                  )}
                </button>
              )}

              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {conversationStatus === "connected"
                  ? "Conversación activa - Click para detener"
                  : conversationStatus === "connecting"
                  ? "Conectando con el agente..."
                  : "Click para iniciar conversación"}
              </p>
            </div>

            {/* Conversation Indicators */}
            {conversationStatus === "connected" && (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4 space-y-2">
                <div className="text-sm text-primary-900 dark:text-primary-100 text-center font-medium">
                  🎤 Conversational AI está activo
                </div>
                <div className="text-xs text-primary-700 dark:text-primary-300 text-center">
                  Habla claramente hacia tu micrófono. El agente te escuchará y responderá.
                </div>
              </div>
            )}

            {/* Instructions when disconnected */}
            {conversationStatus === "disconnected" && !agentId && (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  ¿Cómo empezar?
                </h3>
                <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Obtén tu Agent ID desde ElevenLabs</li>
                  <li>Ingresa el ID en el campo de arriba</li>
                  <li>Permite el acceso al micrófono cuando se te solicite</li>
                  <li>Click en el botón para iniciar la conversación</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
