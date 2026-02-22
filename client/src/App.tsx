import { useRef, useEffect } from "react";
import { ChatMessage as ChatMessageComponent } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { Sidebar } from "./components/Sidebar";
import { SemanticSearch } from "./components/SemanticSearch";
import { ConversationalAI } from "./components/ConversationalAI";
import { AudioList } from "./components/AudioList";
import { AuthScreen } from "./components/AuthScreen";
import { ProfileView } from "./components/ProfileView";
import { Input } from "./components/ui/Input";
import { Button } from "./components/ui/Button";
import { ChatMessage as ChatMessageType, TTSAudio, Conversation } from "./types";
import { useTheme } from "./utils/theme";
import { MessageSquare, Volume2, Mic, Trash2, UserCircle2, Pencil, MessageSquareDashed, Loader2, Menu } from "lucide-react";
import { useAuth } from "./context/AuthProvider";
import { cn } from "./lib/utils";
import { useAppStore } from "./stores/appStore";
import { useConversationStore } from "./stores/conversationStore";

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const prevUserIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // App store
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const setIsSidebarOpen = useAppStore((s) => s.setIsSidebarOpen);
  const showSearchView = useAppStore((s) => s.showSearchView);
  const setShowSearchView = useAppStore((s) => s.setShowSearchView);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const editTitleId = useAppStore((s) => s.editTitleId);
  const setEditTitleId = useAppStore((s) => s.setEditTitleId);
  const editTitleValue = useAppStore((s) => s.editTitleValue);
  const setEditTitleValue = useAppStore((s) => s.setEditTitleValue);
  const systemPrompt = useAppStore((s) => s.systemPrompt);
  const setSystemPrompt = useAppStore((s) => s.setSystemPrompt);
  const handleCloseSearch = useAppStore((s) => s.handleCloseSearch);
  const handleSearchClick = useAppStore((s) => s.handleSearchClick);
  const resetForNewUser = useAppStore((s) => s.resetForNewUser);

  // Conversation store
  const conversations = useConversationStore((s) => s.conversations);
  const currentConversationId = useConversationStore((s) => s.currentConversationId);
  const currentMessages = useConversationStore((s) => s.currentMessages);
  const isLoading = useConversationStore((s) => s.isLoading);
  const isInitialized = useConversationStore((s) => s.isInitialized);
  const createConversation = useConversationStore((s) => s.createConversation);
  const loadConversation = useConversationStore((s) => s.loadConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const deleteTTSAudio = useConversationStore((s) => s.deleteTTSAudio);
  const updateConversationTitle = useConversationStore((s) => s.updateConversationTitle);
  const fetchConversations = useConversationStore((s) => s.fetchConversations);
  const handleSendMessage = useConversationStore((s) => s.handleSendMessage);
  const handleTTSGenerate = useConversationStore((s) => s.handleTTSGenerate);
  const getCurrentTTSHistory = useConversationStore((s) => s.getCurrentTTSHistory);
  const getIsConversationalHistory = useConversationStore((s) => s.getIsConversationalHistory);

  const currentTTSHistory = getCurrentTTSHistory();
  const isConversationalHistory = getIsConversationalHistory();

  // Force chat mode event listener
  useEffect(() => {
    const handler = () => setMode("chat");
    window.addEventListener("forceChatMode", handler);
    return () => window.removeEventListener("forceChatMode", handler);
  }, [setMode]);

  // Fetch conversations when user changes
  useEffect(() => {
    if (user) {
      void fetchConversations();
    }
  }, [user, fetchConversations]);

  // Reset UI on user change
  useEffect(() => {
    if (user && user.id !== prevUserIdRef.current) {
      resetForNewUser();
      prevUserIdRef.current = user.id;
    } else if (!user) {
      prevUserIdRef.current = null;
    }
  }, [user, resetForNewUser]);

  // Sync mode based on conversation content
  useEffect(() => {
    if (!currentConversationId) return;
    const conversation = conversations.find((c: Conversation) => c.id === currentConversationId);
    if (conversation) {
      const hasConversationalAudio = conversation.ttsHistory?.some(audio => audio.voiceId === 'conversational-ai');
      const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
      const hasMessages = conversation.messages && conversation.messages.length > 0;

      if (hasConversationalAudio) {
        if (mode !== "conversational") setMode("conversational");
      } else if (hasTTSAudios) {
        if (mode !== "tts") setMode("tts");
      } else if (hasMessages) {
        if (mode !== "chat") setMode("chat");
      }
    }
  }, [currentConversationId, conversations]);

  // Scroll behavior
  useEffect(() => {
    const isConv = currentTTSHistory?.some(
      (audio: TTSAudio) => audio.voiceId === "conversational-ai"
    );
    if (mode === 'tts' || isConv) {
      scrollContainerRef.current && (scrollContainerRef.current.scrollTop = 0);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages, mode, currentTTSHistory]);

  // ---- Handlers ----
  const handleEditConversationTitle = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    updateConversationTitle(id, newTitle.trim());
  };

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
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      const hasConversationalAudio = conversation.ttsHistory?.some(audio => audio.voiceId === 'conversational-ai');
      const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
      const hasMessages = conversation.messages && conversation.messages.length > 0;
      if (hasConversationalAudio) setMode("conversational");
      else if (hasTTSAudios) setMode("tts");
      else if (hasMessages) setMode("chat");
    }
    loadConversation(conversationId);
    handleCloseSearch();
    setView("chat");
  };

  const handleModeChange = (newMode: typeof mode) => {
    if (newMode === mode) return;
    const conversation = conversations.find(c => c.id === currentConversationId);
    const hasContent = conversation && (
      (conversation.messages && conversation.messages.length > 0) ||
      (conversation.ttsHistory && conversation.ttsHistory.length > 0)
    );
    if (hasContent) {
      createConversation(conversation.isTemporary);
    }
    setMode(newMode);
    setShowSearchView(false);
    setView("chat");
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation(conversationId);
    if (conversationId === currentConversationId) {
      handleNewConversation();
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

  // ---- Filtering ----
  const normalizeText = (text: string | undefined | null) => {
    if (!text) return "";
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const filteredConversations = conversations.filter((conv: Conversation) => {
    if (conv.isTemporary) return false;
    if (conv.isLocal) {
      const hasContent = (conv.messages && conv.messages.length > 0) || (conv.ttsHistory && conv.ttsHistory.length > 0);
      if (!hasContent) return false;
    }
    const titleMatch = normalizeText(conv.title).includes(normalizeText(searchQuery));
    const messageMatch = conv.messages?.some((msg: ChatMessageType) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return normalizeText(content).includes(normalizeText(searchQuery));
    }) || conv.ttsHistory?.some((audio: TTSAudio) =>
      audio.transcript?.some(t => normalizeText(t.msg).includes(normalizeText(searchQuery)))
    ) || false;
    const audioMatch = conv.ttsHistory?.some((audio: TTSAudio) =>
      normalizeText(audio.text).includes(normalizeText(searchQuery))
    ) || false;
    return titleMatch || messageMatch || audioMatch;
  });

  // ---- Constants ----
  const suggestions = [
    "¿Quién ha desarrollado esta aplicación?",
    "Explica la computación cuántica en términos simples",
    "¿Cuáles son las mejores prácticas para el desarrollo en React?",
    "¿Cuál es el clima en Tokio?",
  ];

  // ---- Render ----
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
        onSearchClick={() => handleSearchClick(createConversation)}
        showSearchView={showSearchView}
        onCloseSearch={handleCloseSearch}
        onNewTemporaryConversation={handleNewTemporaryConversation}
        onEditConversationTitle={handleEditConversationTitle}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <div className="bg-background px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3 justify-between">
          <div className="flex-1 flex justify-start items-center gap-2">
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden hover:bg-accent/50"
              >
                <Menu className="h-5 w-5 text-primary" />
              </Button>
            )}
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
              className="ml-auto h-12 w-12"
            >
              <UserCircle2 className="h-9 w-9 text-primary" />
            </Button>
          </div>
        </div>

        {view === "profile" ? (
          <ProfileView />
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
                      const hasMessages = (conversation.messages && conversation.messages.length > 0) ||
                                          (conversation.ttsHistory && conversation.ttsHistory.some(t => t.transcript && t.transcript.length > 0));
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
          ) : isLoading && currentMessages.length === 0 && currentTTSHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-background gap-3">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
              <span className="text-sm text-muted-foreground">Cargando conversación...</span>
            </div>
          ) : mode === "tts" ? (
            <div className="max-w-4xl mx-auto">
              {currentTTSHistory.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    {isConversationalHistory && mode !== "tts" ? (
                      <>
                        <Mic className="h-5 w-5 text-black dark:text-white" />
                        IA Conversacional
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-5 w-5 text-black dark:text-white" />
                        Texto a voz
                      </>
                    )}
                  </h3>
                </div>
              )}

              {currentTTSHistory.length === 0 ? (
                <div className="flex flex-col items-center mb-8 mt-4">
                  <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-primary/20 dark:bg-primary/20 ring-8 ring-primary/10 shadow-inner">
                    {isConversationalHistory ? (
                      <Mic className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
                    ) : (
                      <Volume2 className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                    {isConversationalHistory && mode !== "tts" ? "IA Conversacional" : "Texto a voz"}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 text-center">
                    {isConversationalHistory && mode !== "tts"
                      ? "Inicia una conversación de voz o revisa el historial"
                      : "Escribe un mensaje abajo o prueba una de estas sugerencias"}
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
                        disabled={isLoading || !isInitialized}
                        className="p-3 sm:p-4 h-auto text-left justify-start hover:border-primary hover:shadow-md transition-all duration-200"
                      >
                        <p className="text-xs sm:text-sm">{example}</p>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <AudioList
                  audios={currentTTSHistory}
                  onDelete={deleteTTSAudio}
                />
              )}
            </div>
          ) : mode === "conversational" ? (
            <div className="flex-1 flex flex-col min-h-0">
              {isConversationalHistory ? (
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar">
                   <div className="max-w-4xl mx-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <Mic className="h-5 w-5" />
                          IA Conversacional
                        </h3>
                      </div>
                      <AudioList
                        audios={currentTTSHistory}
                        onDelete={deleteTTSAudio}
                      />
                   </div>
                </div>
              ) : (
                <ConversationalAI
                  createConversation={createConversation}
                  loadConversation={loadConversation}
                  isTemporary={conversations.find(c => c.id === currentConversationId)?.isTemporary}
                />
              )}
            </div>
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
                            <p className="text-xs sm:text-sm">{suggestion}</p>
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
                    </div>
                    {currentMessages.map((message: ChatMessageType, index: number) => (
                      <ChatMessageComponent key={`${message.id}-${index}`} message={message} theme={theme} />
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
            mode !== "tts" ? (
              <div className="bg-background p-3 sm:p-4 border-t border-border transition-colors duration-200">
                <div className="max-w-4xl mx-auto">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2 uppercase tracking-wider">
                    <Mic className="h-4 w-4" />
                    Historial de Conversación de Voz
                  </h3>
                  <AudioList
                    audios={currentTTSHistory}
                    onDelete={deleteTTSAudio}
                  />
                </div>
              </div>
            ) : null
          ) : (
            <ChatInput
              onSend={mode === "tts" ? handleTTSGenerate : handleSendMessage}
              onSearch={handleSemanticSearch}
              disabled={isLoading || !isInitialized}
              showImageUpload={mode === "chat"}
              mode={mode}
              onModeChange={handleModeChange}
            />
          )
        )}
      </div>
    </div>
  );
}

export default App;