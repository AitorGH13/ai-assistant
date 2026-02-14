import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { Sidebar } from "./components/Sidebar";
import { SemanticSearch } from "./components/SemanticSearch";
import { ConversationalAI } from "./components/ConversationalAI";
import { TTSAudioList } from "./components/TTSAudioList";
import { AuthScreen } from "./components/AuthScreen";
import { ProfileView } from "./components/ProfileView";
import { ChatMessage as ChatMessageType, AppMode, MessageContent, TTSAudio, Conversation } from "./types";
import { useTheme } from "./utils/theme";
import { MessageSquare, Volume2, Mic, Trash2, UserCircle2 } from "lucide-react";
import { useConversations } from "./hooks/useConversations";
import { useAuth } from "./context/AuthProvider";

function App() {
    useEffect(() => {
      const handler = () => setMode("chat");
      window.addEventListener("forceChatMode", handler);
      return () => window.removeEventListener("forceChatMode", handler);
    }, []);
  const [mode, setMode] = useState<AppMode>("chat");
  // Voz predeterminada: Roger - Laid-Back, Casual, Resonant
  const selectedVoiceId = "IKne3meq5aSn9XLyUdCD";
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const saved = localStorage.getItem("systemPrompt");
    return saved || "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSearchView, setShowSearchView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"chat" | "profile">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();

  const {
    conversations,
    currentConversationId,
    currentMessages,
    currentTTSHistory,
    isInitialized,
    createConversation,
    loadConversation,
    saveConversation,
    deleteConversation,
    updateCurrentMessages,
    addChatMessage,
    addTTSAudio,
    deleteTTSAudio,
    updateConversationTitle,
  } = useConversations();
  
  // Cambiar el título de una conversación
  const handleEditConversationTitle = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    // Actualiza solo el título, manteniendo el resto igual
    updateConversationTitle(id, newTitle.trim());
  };

  useEffect(() => {
    localStorage.setItem("systemPrompt", systemPrompt);
  }, [systemPrompt]);

  // Cargar voces disponibles desde el API
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch("/api/voices");
        if (response.ok) {
          await response.json();
        }
      } catch (error) {
        console.error("Error cargando voces:", error);
      }
    };
    fetchVoices();
  }, []);

  const handleNewConversation = () => {
    if (currentConversationId && currentMessages.length > 0) {
      saveConversation(currentConversationId, currentMessages);
    }
    createConversation();
    setMode("chat");
    setShowSearchView(false);
    setView("chat");
  };

  const handleLoadConversation = (conversationId: string) => {
    if (currentConversationId && currentMessages.length > 0) {
      saveConversation(currentConversationId, currentMessages);
    }
    loadConversation(conversationId);
    
    // Cerrar vista de búsqueda al cargar una conversación
    handleCloseSearch();
    setView("chat");
    // Determinar el modo basado en el tipo de conversación
    const conversation = conversations.find((c: Conversation) => c.id === conversationId);
    if (conversation) {
      const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
      const hasMessages = conversation.messages && conversation.messages.length > 0;
      
      // Si tiene audios de conversational-ai, es una conversación de voz (mostrar ambos)
      const hasConversationalAudio = hasTTSAudios && conversation.ttsHistory?.some(
        (audio: TTSAudio) => audio.voiceId === "conversational-ai"
      );
      
      if (hasConversationalAudio) {
        // Conversación de voz: tiene mensajes Y audio, mostrar en modo chat
        setMode("chat");
      } else if (hasTTSAudios && !hasMessages) {
        // Solo TTS: mostrar en modo TTS
        setMode("tts");
      } else {
        // Chat normal
        setMode("chat");
      }
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation(conversationId);
  };

 const handleSearchClick = () => {
    if (view === "profile") {
      // Si estoy en perfil, fuerzo abrir el buscador y cambio la vista
      setShowSearchView(true);
      setView("chat");
    } else {
      // Si ya estoy en el chat, funciona como interruptor (abrir/cerrar)
      setShowSearchView(!showSearchView);
      if (!showSearchView) { // Nota: aquí la lógica invierte el valor anterior
        setSearchQuery("");
      }
    }
  };

  const handleCloseSearch = () => {
    if (showSearchView) {
      setShowSearchView(false);
      setSearchQuery("");
    }
  };

  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const filteredConversations = conversations.filter((conv: Conversation) => {
    // Filtrar solo conversaciones con contenido
    const hasMessages = conv.messages && conv.messages.length > 0;
    const hasTTSAudios = conv.ttsHistory && conv.ttsHistory.length > 0;
    
    if (!hasMessages && !hasTTSAudios) return false;
    
    const titleMatch = normalizeText(conv.title).includes(normalizeText(searchQuery));
    
    // Buscar también en los textos de los audios TTS
    const audioMatch = conv.ttsHistory?.some((audio: TTSAudio) => 
      normalizeText(audio.text).includes(normalizeText(searchQuery))
    ) || false;
    
    return titleMatch || audioMatch;
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  const handleTTSGenerate = async (text: string) => {
    if (!text.trim()) {
      alert("Por favor, escribe un texto para convertir a voz");
      return;
    }

    // Crear conversación si no existe
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoiceId,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar el audio");
      }

      const audioBlob = await response.blob();
      
      // Convertir a base64 para que persista después de recargar
      const reader = new FileReader();
      const audioUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      // Crear objeto TTSAudio
      const ttsAudio: TTSAudio = {
        id: crypto.randomUUID(),
        text: text.trim(),
        audioUrl,
        timestamp: Date.now(),
        voiceId: selectedVoiceId,
        voiceName: "Roger - Laid-Back, Casual, Resonant",
      };

      // Añadir al historial usando el conversationId correcto
      addTTSAudio(ttsAudio, conversationId);

      // Reproducir automáticamente
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error("Error generating speech:", error);
      alert("Error al generar el audio. Por favor, intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string, imageBase64?: string, imageName?: string) => {
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    // CORRECCIÓN: Si no hay texto pero hay imagen, usar nombre de imagen como texto
    const textContent = content.trim() || (imageBase64 ? (imageName || "¿Qué hay en esta imagen?") : "");
    
    // Validar que hay contenido
    if (!textContent && !imageBase64) {
      return; // No enviar mensajes vacíos
    }

    let messageContent: string | MessageContent[];
    
    if (imageBase64) {
      messageContent = [
        // Usamos finalContent aquí, NO content
        { type: "text" as const, text: textContent },
        { type: "image_url" as const, image_url: { url: imageBase64 } }
      ];
    } else {
      messageContent = textContent;
    }

    const userTimestamp = new Date();

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: userTimestamp.toISOString(),
    };

    const updatedMessages = [...currentMessages, userMessage];
    updateCurrentMessages(updatedMessages);
    addChatMessage(userMessage, conversationId);
    setIsLoading(true);

    const assistantTimestamp = new Date(userTimestamp.getTime() + 1);
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: assistantTimestamp.toISOString(),
    };

    updateCurrentMessages([...updatedMessages, assistantMessage]);
    addChatMessage(assistantMessage, conversationId);

    try {
      // Preparamos los mensajes para la API
      // Aseguramos que el contenido que va a la API también use la versión corregida
      const apiMessages = updatedMessages.map((msg) => {
        // Si es el mensaje que acabamos de crear, nos aseguramos de usar el contenido estructurado correcto
        if (msg.id === userMessage.id) {
            return { role: msg.role, content: messageContent };
        }
        return { role: msg.role, content: msg.content };
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt: systemPrompt || undefined,
          mode: "function",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let toolWasUsed = false;
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.tool_calling) {
                toolWasUsed = true;
              }
              
              if (parsed.content) {
                assistantContent += parsed.content;
                updateCurrentMessages((prev: ChatMessageType[]) =>
                  prev.map((msg: ChatMessageType) =>
                    msg.id === assistantMessageId
                      ? { 
                          ...msg, 
                          content: assistantContent,
                          toolUsed: toolWasUsed 
                        }
                      : msg
                  )
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      const finalAssistantMessage: ChatMessageType = {
        ...assistantMessage,
        content: assistantContent,
        toolUsed: toolWasUsed,
      };

      const finalMessages = [...updatedMessages, finalAssistantMessage];
      updateCurrentMessages(finalMessages);
      saveConversation(conversationId, finalMessages);
    } catch (error) {
      console.error("Failed to send message:", error);
      const finalMessages = [...updatedMessages, {
        ...assistantMessage,
        content: "Sorry, there was an error processing your request. Please try again.",
      }];
      saveConversation(conversationId, finalMessages);
      updateCurrentMessages((prev: ChatMessageType[]) =>
        prev.map((msg: ChatMessageType) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "Sorry, there was an error processing your request. Please try again.",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleSemanticSearch = async (query: string) => {
    // Llamar a la función de búsqueda del componente SemanticSearch
    if ((window as any).__performSemanticSearch) {
      await (window as any).__performSemanticSearch(query);
    }
  };

  const suggestions = [
    "¿Quién ha desarrollado esta aplicación?",
    "Explica la computación cuántica en términos simples",
    "¿Cuáles son las mejores prácticas para el desarrollo en React?",
    "¿Cuál es el clima en Tokio?",
  ];

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Cargando...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        theme={theme}
        onToggleTheme={toggleTheme}
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        onNewConversation={handleNewConversation}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isOpen={isSidebarOpen}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onLoadConversation={handleLoadConversation}
        onDeleteConversation={handleDeleteConversation}
        onSearchClick={handleSearchClick}
        showSearchView={showSearchView}
        onCloseSearch={handleCloseSearch}
        onEditConversationTitle={handleEditConversationTitle}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3 justify-between">
          <div className="flex-1 flex justify-start">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Assistant AI
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("profile")}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Perfil"
              style={{ marginLeft: 'auto' }}
            >
              <UserCircle2 className="h-8 w-8 text-gray-700 dark:text-primary-400" />
            </button>
          </div>
        </div>

        {/* Chat content */}
        {view === "profile" ? (
          <ProfileView onBack={() => setView("chat")} />
        ) : (
        <div className={`flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto ${mode === 'tts' ? 'scrollbar-hide' : ''} ${showSearchView ? '!overflow-hidden' : ''}`}>
          {showSearchView ? (
            <div className="mx-auto max-w-4xl h-full flex flex-col">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex-shrink-0">Buscar</h2>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversaciones..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 mb-4 flex-shrink-0"
              />
              <div className="overflow-y-auto flex-1 scrollbar-hide">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {searchQuery ? "No se encontraron conversaciones" : "No hay conversaciones"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredConversations.map((conversation: Conversation) => {
                      // Determine the icon based on conversation content
                      const hasMessages = conversation.messages && conversation.messages.length > 0;
                      const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
                      const hasConversationalAudio = hasTTSAudios && conversation.ttsHistory?.some(
                        (audio: TTSAudio) => audio.voiceId === "conversational-ai"
                      );
                      
                      let IconComponent;
                      if (hasConversationalAudio) {
                        IconComponent = Mic;
                      } else if (hasTTSAudios && !hasMessages) {
                        IconComponent = Volume2;
                      } else {
                        IconComponent = MessageSquare;
                      }

                      return (
                        <div
                          key={conversation.id}
                          className="group relative flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/50"
                        >
                          <IconComponent className="h-5 w-5 flex-shrink-0" />  {/* Dynamic icon */}
                          <button
                            onClick={() => {
                              handleLoadConversation(conversation.id);
                              setShowSearchView(false);
                            }}
                            className="flex-1 text-left truncate"
                            title={conversation.title}
                          >
                            <div className="font-medium">{conversation.title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {new Date(conversation.updatedAt).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </button>
                          <button
                            onClick={() => handleDeleteConversation(conversation.id)}
                            className="text-blue-500"
                            title="Eliminar conversación"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : mode === "tts" ? (
            <div className="max-w-4xl mx-auto">
              {currentTTSHistory.length === 0 ? (
                <>
                  {/* TTS Header cuando no hay audios */}
                  <div className="flex flex-col items-center mb-8 mt-4">
                    <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary-500/10 to-accent-500/10">
                      <Volume2 className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Text-to-Speech
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-center">
                      Escribe un mensaje abajo o prueba una de estas sugerencias
                    </p>
                    {/* Ejemplos cuando no hay audios */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
                      {[
                        "Bienvenido a nuestra aplicación de inteligencia artificial",
                        "La tecnología de síntesis de voz ha avanzado enormemente en los últimos años",
                        "Hola, mi nombre es Roger y estoy aquí para ayudarte",
                        "El futuro de la comunicación está en la voz artificial"
                      ].map((example, index) => (
                        <button
                          key={index}
                          onClick={() => handleTTSGenerate(example)}
                          disabled={isLoading || !isInitialized}
                          className="p-3 sm:p-4 text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            {example}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Solo lista de audios cuando hay audios */}
                  <TTSAudioList 
                    audios={currentTTSHistory}
                    onDelete={deleteTTSAudio}
                  />
                </>
              )}
            </div>
          ) : mode === "conversational" ? (
            <ConversationalAI 
              addTTSAudio={addTTSAudio}
              createConversation={createConversation}
              loadConversation={loadConversation}
              addChatMessage={addChatMessage}
            />
          ) : mode === "search" ? (
            <SemanticSearch />
          ) : (  
            <div className="mx-auto max-w-4xl">
              {currentMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center max-w-2xl px-3 sm:px-4">
                    <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary-500/10 to-accent-500/10">
                      <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Inicia una conversación
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
                      Escribe un mensaje abajo o prueba una de estas sugerencias
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          disabled={!isInitialized}
                          className="p-3 sm:p-4 text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            {suggestion}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mostrar audios de conversational-ai si existen */}
                  {currentTTSHistory.some((audio: TTSAudio) => audio.voiceId === "conversational-ai") && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Volume2 className="h-5 w-5" />
                        Audio de la Conversación
                      </h3>
                      <TTSAudioList 
                        audios={currentTTSHistory.filter((audio: TTSAudio) => audio.voiceId === "conversational-ai")}
                        onDelete={deleteTTSAudio}
                      />
                    </div>
                  )}
                  
                  {/* Mostrar mensajes */}
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Chat
                    </h3>
                    {currentMessages.map((message: ChatMessageType) => (
                      <ChatMessage key={message.id} message={message} theme={theme} />
                    ))}
                  </div>
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        )}

        {/* Chat Input */}
        {view === "chat" && !showSearchView && mode !== "conversational" && (
          <ChatInput 
            onSend={mode === "tts" ? handleTTSGenerate : handleSendMessage}
            onSearch={handleSemanticSearch}
            disabled={isLoading || !isInitialized} 
            showImageUpload={mode === "chat"}
            mode={mode}
            onModeChange={setMode}
            onNewConversation={handleNewConversation}
          />
        )}
      </div>
    </div>
  );
}

export default App;