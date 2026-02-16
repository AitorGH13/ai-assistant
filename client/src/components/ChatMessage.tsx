import { ChatMessage as ChatMessageType, MessageContent } from "../types";
import { Avatar } from "./ui/Avatar";
import { IconButton } from "./ui/IconButton";
import { Badge } from "./ui/Badge";
import { MarkdownMessage } from "./MarkdownMessage";
import { Copy, Check, Wrench } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { cn } from "../lib/utils";

interface Props {
  message: ChatMessageType;
  theme?: 'light' | 'dark';
}

export function ChatMessage({ message, theme = 'dark' }: Props) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const userName = user?.user_metadata?.full_name || "Tú";

  const handleCopy = async () => {
    const textContent = typeof message.content === 'string' 
      ? message.content 
      : message.content.find(c => c.type === 'text')?.text || '';
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const renderContent = () => {
    if (typeof message.content === 'string') {
      return isUser ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>
      ) : (
        <div className="text-sm leading-relaxed">
          <MarkdownMessage content={message.content} theme={theme} />
        </div>
      );
    }

    // Handle multimodal content
    return (
      <div className="space-y-2">
        {message.content.map((content: MessageContent, index: number) => {
          if (content.type === 'text' && content.text) {
            return (
              <div key={index} className="text-sm leading-relaxed">
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">{content.text}</p>
                ) : (
                  <MarkdownMessage content={content.text} theme={theme} />
                )}
              </div>
            );
          }
          if (content.type === 'image_url' && content.image_url?.url) {
            return (
              <img
                key={index}
                src={content.image_url.url}
                alt="Uploaded image"
                className="max-w-full max-h-64 rounded-lg"
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex gap-2 sm:gap-3 mb-4 sm:mb-6 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar role={message.role} size="md" />
      
      <div className={cn("flex flex-col gap-1 max-w-[90%] sm:max-w-[85%] md:max-w-[75%]", isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? userName : "AI Assistant"}
          </span>
          <span className="text-xs text-muted-foreground/70">
            {formatTime(message.timestamp)}
          </span>
          {message.toolUsed && (
            <Badge className="text-xs gap-1 bg-primary-600 hover:bg-primary-600 text-white border-none">
              <Wrench size={12} />
              Tool Used
            </Badge>
          )}
        </div>
        
        <div
          className={cn(
            "rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm",
            isUser
              ? "bg-primary text-white rounded-tr-md"
              : "bg-slate-200 dark:bg-muted text-foreground rounded-tl-md"
          )}
        >
          {renderContent()}
        </div>

        {!isUser && message.content && (
          <IconButton
            icon={copied ? Check : Copy}
            size="sm"
            variant="ghost"
            label="Copy message"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
    </div>
  );
}
