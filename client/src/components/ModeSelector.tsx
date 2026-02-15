import { AppMode } from "../types";
import { MessageSquare, Search, Mic } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

interface Props {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeSelector({ mode, onModeChange }: Props) {
  const modes = [
    { id: "chat" as AppMode, label: "Chat", icon: MessageSquare, description: "AI Chat with Function Calling" },
    { id: "search" as AppMode, label: "Search", icon: Search, description: "Semantic Search" },
    { id: "voice" as AppMode, label: "Voice AI", icon: Mic, description: "Text-to-Speech & Conversational AI" },
  ];

  return (
    <div className="border-b border-border bg-background">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">
        <div className="flex gap-4 sm:gap-6 md:gap-8 overflow-x-auto scrollbar-hide justify-start md:justify-center">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            
            return (
              <Button
                key={m.id}
                variant="ghost"
                onClick={() => onModeChange(m.id)}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm rounded-none whitespace-nowrap flex-shrink-0 h-auto",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>{m.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
