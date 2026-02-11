import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { Sidebar } from "./components/Sidebar";
import { SemanticSearch } from "./components/SemanticSearch";
import { ChatMessage as ChatMessageType, AppMode, MessageContent } from "./types";
import { useTheme } from "./utils/theme";
import { MessageSquare } from "lucide-react";
import { useConversations } from "./hooks/useConversations";
import { useAutoSave } from "./hooks/useAutoSave";

function App() {
  const [mode, setMode] = useState<AppMode>("chat");
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const saved = localStorage.getItem("systemPrompt");
    return saved || "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  const {
    conversations,
    currentConversationId,
    currentMessages,
    createConversation,
    loadConversation,
    saveConversation,
    deleteConversation,
    updateCurrentMessages,
  } = useConversations();

  const handleAutoSave = useAutoSave({
    delay: 1000,
    onSave: () => {
      if (currentConversationId && currentMessages.length > 0) {
        saveConversation(currentConversationId, currentMessages);
      }
    },
    enabled: currentMessages.length > 0,
  });

  useEffect(() => {
    handleAutoSave();
  }, [currentMessages, handleAutoSave]);

  useEffect(() => {
    localStorage.setItem("systemPrompt", systemPrompt);
  }, [systemPrompt]);

  const handleNewConversation = () => {
    if (currentConversationId && currentMessages.length > 0) {
      saveConversation(currentConversationId, currentMessages);
    }
    createConversation();
  };

  const handleLoadConversation = (conversationId: string) => {
    if (currentConversationId && currentMessages.length > 0) {
      saveConversation(currentConversationId, currentMessages);
    }
    loadConversation(conversationId);
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation(conversationId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  const handleSendMessage = async (content: string, imageBase64?: string) => {
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    let messageContent: string | MessageContent[];
    
    if (imageBase64) {
      messageContent = [
        { type: "text" as const, text: content },
        { type: "image_url" as const, image_url: { url: imageBase64 } }
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

    const updatedMessages = [...currentMessages, userMessage];
    updateCurrentMessages(updatedMessages);
    setIsLoading(true);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    updateCurrentMessages([...updatedMessages, assistantMessage]);

    try {
      const apiMessages = updatedMessages.map(({ role, content }) => ({
        role,
        content,
      }));

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
                updateCurrentMessages((prev: ChatMessageType[]) =>
                  prev.map((msg: ChatMessageType) =>
                    msg.id === assistantMessageId
                      ? { 
                          ...msg, 
                          content: typeof msg.content === 'string' 
                            ? msg.content + parsed.content 
                            : parsed.content,
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
    } catch (error) {
      console.error("Failed to send message:", error);
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

  const suggestions = [
    "Explica la computación cuántica en términos simples",
    "Escribe una función en Python para ordenar una lista",
    "¿Cuáles son las mejores prácticas para el desarrollo en React?",
    "¿Cuál es el clima en Tokio?",
  ];

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
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Assistant AI
          </h1>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {mode === "search" ? (
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
                          className="p-3 sm:p-4 text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md transition-all duration-200 group"
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
                <div className="space-y-3 sm:space-y-4">
                  {currentMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} theme={theme} />
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput 
          onSend={handleSendMessage} 
          disabled={isLoading} 
          showImageUpload={mode === "chat"}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    </div>
  );
}

export default App;
