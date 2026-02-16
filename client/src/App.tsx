import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { Sidebar } from "./components/Sidebar";
import { SemanticSearch } from "./components/SemanticSearch";
import { ConversationalAI } from "./components/ConversationalAI";
import { TTSAudioList } from "./components/TTSAudioList";
import { AuthScreen } from "./components/AuthScreen";
import { ProfileView } from "./components/ProfileView";
import { Input } from "./components/ui/Input";
import { Button } from "./components/ui/Button";
import { ChatMessage as ChatMessageType, AppMode, MessageContent, TTSAudio, Conversation } from "./types";
import { useTheme } from "./utils/theme";
import { MessageSquare, Volume2, Mic, Trash2, UserCircle2, Pencil, MessageSquareDashed } from "lucide-react";
import { useConversations } from "./hooks/useConversations";
import { useAuth } from "./context/AuthProvider";
import { supabase } from "./lib/supabase";
import { cn } from "./lib/utils";

function App() {
  useEffect(() => {
    const handler = () => setMode("chat");
    window.addEventListener("forceChatMode", handler);
    return () => window.removeEventListener("forceChatMode", handler);
  }, []);

  const [mode, setMode] = useState<AppMode>("chat");
  const selectedVoiceId = "IKne3meq5aSn9XLyUdCD";
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const saved = localStorage.getItem("systemPrompt");
    return saved || "";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSearchView, setShowSearchView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"chat" | "profile">("chat");
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user && user.id !== prevUserIdRef.current) {
      setView("chat");
      setMode("chat");
      setShowSearchView(false);
      prevUserIdRef.current = user.id;
    } else if (!user) {
      prevUserIdRef.current = null;
    }
  }, [user]);

  const {
    conversations,
    currentConversationId,
    currentMessages,
    currentTTSHistory,
    isLoading: isMessagesLoading,
    isInitialized,
    createConversation,
    loadConversation,
    deleteConversation,
    updateCurrentMessages,
    addChatMessage,
    addTTSAudio,
    deleteTTSAudio,
    updateConversationTitle,
    fetchConversations,
  } = useConversations();

  const handleEditConversationTitle = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    updateConversationTitle(id, newTitle.trim());
  };

  useEffect(() => {
    localStorage.setItem("systemPrompt", systemPrompt);
  }, [systemPrompt]);

  const handleNewConversation = () => {
    createConversation();
    setMode("chat");
    setShowSearchView(false);
    setView("chat");
  };

  const handleNewTemporaryConversation = () => {
    createConversation(true);
    setMode("chat");
    setShowSearchView(false);
    setView("chat");
  };

  const handleLoadConversation = (conversationId: string) => {
    loadConversation(conversationId);
    handleCloseSearch();
    setView("chat");
    
    // Logic to determine mode based on conversation type (TTS vs Chat vs Conversational)
    const conversation = conversations.find((c: Conversation) => c.id === conversationId);
    if (conversation) {
      const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
      const hasMessages = conversation.messages && conversation.messages.length > 0;
      const hasConversationalAudio = hasTTSAudios && conversation.ttsHistory?.some(
        (audio: TTSAudio) => audio.voiceId === "conversational-ai"
      );
      
      if (hasConversationalAudio) {
        setMode("conversational"); // Fixed string from 'chat' to correctly switch logic
      } else if (hasTTSAudios && !hasMessages) {
        setMode("tts");
      } else {
        setMode("chat");
      }
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation(conversationId);
  };

  const handleSearchClick = () => {
    if (view === "profile") {
      setShowSearchView(true);
      setView("chat");
    } else {
      const nextShowSearch = !showSearchView;
      setShowSearchView(nextShowSearch);
      
      if (nextShowSearch) {
        createConversation(); 
      } else {
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
    const hasMessages = conv.messages && conv.messages.length > 0;
    const hasTTSAudios = conv.ttsHistory && conv.ttsHistory.length > 0;
    
    if (!hasMessages && !hasTTSAudios) return false;
    
    const titleMatch = normalizeText(conv.title).includes(normalizeText(searchQuery));
    
    const audioMatch = conv.ttsHistory?.some((audio: TTSAudio) => 
      normalizeText(audio.text).includes(normalizeText(searchQuery))
    ) || false;
    
    return titleMatch || audioMatch;
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    const isConversational = currentTTSHistory?.some(
      (audio: TTSAudio) => audio.voiceId === "conversational-ai"
    );

    if (mode === 'tts' || isConversational) {
      scrollToTop();
    } else {
      scrollToBottom();
    }
  }, [currentMessages, mode, currentTTSHistory]);

  const handleTTSGenerate = async (text: string) => {
      // Implement TTS logic via API if needed or keep existing logic if it calls /api/speak
      // existing handleTTSGenerate seems to fetch /api/speak directly, which is fine.
      // But we need to use `addTTSAudio` from hook to save it.
      
      // ... (Reusing logic from previous App.tsx but simplified)
      if (!text.trim()) {
        alert("Por favor, escribe un texto para convertir a voz");
        return;
      }

      let conversationId = currentConversationId;
      if (!conversationId) {
        conversationId = createConversation();
      }

      // setIsLoading(true); // TODO: Expose loading state setter from hook or manage local?
      // For now, let's keep local loading state for UI feedback but separating it from messages loading
      
      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), voiceId: selectedVoiceId }),
        });

        if (!response.ok) throw new Error("Error al generar el audio");

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob); // Use ObjectURL instead of Base64 for performance?
        // Or keep Base64 consistency
        
        const ttsAudio: TTSAudio = {
          id: crypto.randomUUID(),
          text: text.trim(),
          audioUrl: audioUrl, // NOTE: This URL might be temporary blob or base64
          timestamp: Date.now(),
          voiceId: selectedVoiceId,
          voiceName: "Roger - Laid-Back, Casual, Resonant",
        };
        
        addTTSAudio(ttsAudio, conversationId);
        new Audio(audioUrl).play();
      } catch (error) {
        console.error("Error generating speech:", error);
      }
  };

  const handleSendMessage = async (content: string, imageBase64?: string, imageName?: string, imageFile?: File) => {
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    let messageContent: string | MessageContent[];
    let finalImageUrl = imageBase64;

    // Upload Image if present
    if (imageFile) {
        try {
            const formData = new FormData();
            formData.append('file', imageFile);
            
            // Note: We might want a separate loading state or toast here?
            // "Uploading image..."
            const uploadRes = await fetch(`/api/chat/upload`, {
                 method: 'POST',
                 headers: {
                    // Content-Type header must be undefined for FormData to set boundary
                    "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                 },
                 body: formData
            });
            
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                // Assuming data.url is the string. Check verify result.
                // storage_service.py/chat.py: return {"url": ...}
                if (data.url) {
                    finalImageUrl = data.url;
                }
            } else {
                console.error("Image upload failed");
                // Fallback to base64 or show error? 
                // Let's keep base64 as fallback or just proceed so user doesn't lose text.
            }
        } catch (e) {
            console.error("Error uploading image:", e);
        }
    }
    
    if (finalImageUrl) {
      const textWithFilename = imageName 
        ? (content ? `${imageName}\n${content}` : imageName)
        : content;
      messageContent = [
        { type: "text" as const, text: textWithFilename },
        { type: "image_url" as const, image_url: { url: finalImageUrl! } }
      ];
    } else {
      messageContent = content;
    }

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    updateCurrentMessages(prev => [...prev, userMessage]);
    
    // We don't call `addChatMessage` because we will manually manage the POST request for streaming here.
    // OR... we can call `addChatMessage` to persist the user message, then call separate logic for streaming?
    // The backend `send_message` does both: saves user message AND streams response.
    // So we should make ONE call.
    
    // Let's implement the fetch/stream manually here using the logic from previous App.tsx
    // but adapted to the new backend.
    
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    
    updateCurrentMessages(prev => [...prev, assistantMessage]);

    try {
        // Construct payload
        
        // We need auth token for the fetch
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const response = await fetch(`/api/chat/${conversationId}/message`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                messages: [{ role: userMessage.role, content: userMessage.content }] 
                // Sending only new message. Backend appends it to history.
            })
        });

        if (!response.ok) throw new Error("Network response was not ok");
        
        // Refresh conversation list so the new chat (and its title) appears in sidebar
        void fetchConversations();
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        
        if (!reader) throw new Error("No reader");
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data === "[DONE]") break;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            assistantContent += parsed.content;
                            updateCurrentMessages(prev => prev.map(m => 
                                m.id === assistantMessageId ? { ...m, content: assistantContent } : m
                            ));
                        }
                        if (parsed.tool_used) {
                            updateCurrentMessages(prev => prev.map(m => 
                                m.id === assistantMessageId ? { ...m, toolUsed: true } : m
                            ));
                        }
                    } catch (e) {
                         // Ignore parse errors for partial chunks
                    }
                }
            }
        }
        
    } catch (e) {
        console.error("Error sending message", e);
        updateCurrentMessages(prev => prev.map(m => 
            m.id === assistantMessageId ? { ...m, content: "Error sending message." } : m
        ));
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleSemanticSearch = async (query: string) => {
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

  const conversationalAudioList = currentTTSHistory.filter(
    (audio: TTSAudio) => audio.voiceId === "conversational-ai"
  );
  const isConversationalHistory = conversationalAudioList.length > 0;

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-background transition-colors duration-200">
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
        onNewTemporaryConversation={handleNewTemporaryConversation}
        onEditConversationTitle={handleEditConversationTitle}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <div className="bg-background px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3 justify-between">
          <div className="flex-1 flex justify-start">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              AI Assistant
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView("profile")}
              title="Perfil"
              className="ml-auto"
            >
              <UserCircle2 className="h-8 w-8 text-primary" />
            </Button>
          </div>
        </div>

        {view === "profile" ? (
          <ProfileView onBack={() => setView("chat")} />
        ) : (
        <div ref={scrollContainerRef} className={cn(
          "flex-1 p-3 sm:p-4 md:p-6",
          mode === 'conversational' ? 'flex flex-col overflow-hidden p-0 sm:p-0 md:p-0' : 'overflow-y-auto',
          mode === 'tts' && 'scrollbar-hide',
          showSearchView && '!overflow-hidden'
        )}>
          {showSearchView ? (
            <div className="mx-auto max-w-4xl h-full flex flex-col">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex-shrink-0">Buscar</h2>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversaciones..."
                className="mb-4 flex-shrink-0 h-12"
              />
              <div className="overflow-y-auto flex-1 scrollbar-hide">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No se encontraron conversaciones" : "No hay conversaciones"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredConversations.map((conversation: Conversation) => {
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

                      const isEditing = editTitleId === conversation.id;

                      return (
                        <div
                          key={conversation.id}
                          className="group relative flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:bg-accent text-foreground bg-card overflow-hidden"
                          onClick={() => {
                            if (isEditing) return;
                            handleLoadConversation(conversation.id);
                            setShowSearchView(false);
                          }}
                        >
                          <div className="flex-shrink-0 relative">
                            <IconComponent className="h-5 w-5 text-muted-foreground group-hover:opacity-0 transition-opacity" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditTitleId(conversation.id);
                                setEditTitleValue(conversation.title);
                              }}
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              aria-label="Editar nombre"
                            >
                              <Pencil size={16} className="text-muted-foreground hover:text-primary transition-colors" />
                            </button>
                          </div>
                          
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {isEditing ? (
                              <Input
                                type="text"
                                value={editTitleValue}
                                onChange={(e) => setEditTitleValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm h-8 px-2 py-1"
                                autoFocus
                                onBlur={() => setEditTitleId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (editTitleValue.trim() && editTitleValue !== conversation.title) {
                                      handleEditConversationTitle(conversation.id, editTitleValue.trim());
                                    }
                                    setEditTitleId(null);
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditTitleId(null);
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <div className="font-medium truncate">{conversation.title}</div>
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  {new Date(conversation.updatedAt).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conversation.id);
                            }}
                            className="h-8 w-8 min-h-[32px] min-w-[32px] text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all duration-200"
                            title="Eliminar conversación"
                          >
                            <Trash2 size={16} />
                          </Button>
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
                  <div className="flex flex-col items-center mb-8 mt-4">
                    <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-primary/20 dark:bg-primary/20 ring-8 ring-primary/10 shadow-inner">
                      <Volume2 className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                      Texto a voz
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 text-center">
                      Escribe un mensaje abajo o prueba una de estas sugerencias
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
                      {[
                        "Bienvenido a nuestra aplicación de inteligencia artificial",
                        "La tecnología de síntesis de voz ha avanzado enormemente en los últimos años",
                        "Hola, mi nombre es Roger y estoy aquí para ayudarte",
                        "El futuro de la comunicación está en la voz artificial"
                      ].map((example, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          onClick={() => handleTTSGenerate(example)}
                          disabled={isMessagesLoading || !isInitialized}
                          className="p-3 sm:p-4 h-auto text-left justify-start hover:border-primary hover:shadow-md transition-all duration-200"
                        >
                          <p className="text-xs sm:text-sm">
                            {example}
                          </p>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <TTSAudioList 
                  audios={currentTTSHistory}
                  onDelete={deleteTTSAudio}
                />
              )}
            </div>
          ) : mode === "conversational" ? (
            <ConversationalAI 
              addTTSAudio={addTTSAudio}
              createConversation={createConversation}
              loadConversation={loadConversation}
              addChatMessage={addChatMessage}
              updateConversationTitle={updateConversationTitle}
              isTemporary={conversations.find(c => c.id === currentConversationId)?.isTemporary}
            />
          ) : mode === "search" ? (
            <SemanticSearch />
          ) : (  
            <div className="mx-auto max-w-4xl">
              {currentMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center max-w-2xl px-3 sm:px-4">
                    <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-primary/20 dark:bg-primary/20 ring-8 ring-primary/10 shadow-inner">
                      {conversations.find(c => c.id === currentConversationId)?.isTemporary ? (
                        <MessageSquareDashed className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
                      ) : (
                        <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                       {conversations.find(c => c.id === currentConversationId)?.isTemporary ? "Chat Temporal" : "Inicia una conversación"}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
                       {conversations.find(c => c.id === currentConversationId)?.isTemporary 
                         ? "Los mensajes no se guardan y se borrarán al salir o refrescar la página." 
                         : "Escribe un mensaje abajo o prueba una de estas sugerencias"}
                    </p>
                    
                    {!conversations.find(c => c.id === currentConversationId)?.isTemporary && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            onClick={() => handleSuggestionClick(suggestion)}
                            disabled={!isInitialized}
                            className="p-3 sm:p-4 h-auto text-left justify-start hover:border-primary hover:shadow-md transition-all duration-200"
                          >
                            <p className="text-xs sm:text-sm">
                              {suggestion}
                            </p>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        {conversations.find(c => c.id === currentConversationId)?.isTemporary ? (
                          <>
                            <MessageSquareDashed className="h-5 w-5 text-muted-foreground" />
                            Chat Temporal
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-5 w-5" />
                            Chat
                          </>
                        )}
                      </h3>
                      {conversations.find(c => c.id === currentConversationId)?.isTemporary && (
                        <span className="text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded-md">
                          No se guarda en el historial
                        </span>
                      )}
                    </div>
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

        {view === "chat" && !showSearchView && mode !== "conversational" && (
          isConversationalHistory ? (
            <div className="bg-background p-3 sm:p-4 border-t border-border transition-colors duration-200">
              <div className="max-w-4xl mx-auto">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Volume2 className="h-4 w-4" />
                  Audio de la Conversación
                </h3>
                <TTSAudioList 
                  audios={conversationalAudioList}
                  onDelete={deleteTTSAudio}
                />
              </div>
            </div>
          ) : (
            <ChatInput 
              onSend={mode === "tts" ? handleTTSGenerate : handleSendMessage}
              onSearch={handleSemanticSearch}
              disabled={isMessagesLoading || !isInitialized} 
              showImageUpload={mode === "chat"}
              mode={mode}
              onModeChange={setMode}
            />
          )
        )}
      </div>
    </div>
  );
}

export default App;