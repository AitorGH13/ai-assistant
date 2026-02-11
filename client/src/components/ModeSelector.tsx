import { AppMode } from "../types";
import { MessageSquare, Search } from "lucide-react";

interface Props {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeSelector({ mode, onModeChange }: Props) {
  const modes = [
    { id: "chat" as AppMode, label: "Chat", icon: MessageSquare, description: "AI Chat with Function Calling" },
    { id: "search" as AppMode, label: "Search", icon: Search, description: "Semantic Search" },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">
        <div className="flex gap-4 sm:gap-6 md:gap-8 overflow-x-auto scrollbar-hide justify-start md:justify-center">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
