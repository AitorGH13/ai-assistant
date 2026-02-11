import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { SettingsPanel } from "./components/SettingsPanel";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { ModeSelector } from "./components/ModeSelector";
import { SemanticSearch } from "./components/SemanticSearch";
import { Button } from "./components/ui/Button";
import { ChatMessage as ChatMessageType, AppMode, MessageContent } from "./types";
import { useTheme } from "./utils/theme";
import { MessageSquare, Trash2, Search } from "lucide-react";

function App() {
  const [mode, setMode] = useState<AppMode>("chat");
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string, imageBase64?: string) => {
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

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const apiMessages = [...messages, userMessage].map(({ role, content }) => ({
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
                setMessages((prev) =>
                  prev.map((msg) =>
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
      setMessages((prev) =>
        prev.map((msg) =>
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

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const suggestions = [
    "Explain quantum computing in simple terms",
    "Write a Python function to sort a list",
    "What are the best practices for React development?",
    "What is the weather in Tokyo?",
  ];

  const getHeaderIcon = () => {
    switch (mode) {
      case "search":
        return <Search className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
      default:
        return <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 sm:px-4 md:px-6 py-3 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex-shrink-0">
            {getHeaderIcon()}
          </div>
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate">AI Assistant</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {mode !== "search" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="flex items-center gap-1 sm:gap-2 h-9 px-2 sm:px-3"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline text-sm">Clear</span>
            </Button>
          )}
        </div>
      </header>

      <ModeSelector mode={mode} onModeChange={setMode} />

      {mode !== "search" && (
        <SettingsPanel
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
        />
      )}

      {mode === "search" ? (
        <div className="flex-1 overflow-y-auto">
          <SemanticSearch />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            <div className="mx-auto max-w-4xl">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center max-w-2xl px-3 sm:px-4">
                    <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary-500/10 to-accent-500/10">
                      <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Start a conversation
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
                      Type a message below or try one of these suggestions
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
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} theme={theme} />
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <ChatInput 
            onSend={handleSendMessage} 
            disabled={isLoading} 
            showImageUpload={true}
          />
        </>
      )}
    </div>
  );
}

export default App;
