import { AppMode } from "../types";
import { MessageSquare, Image, Search } from "lucide-react";

interface Props {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeSelector({ mode, onModeChange }: Props) {
  const modes = [
    { id: "chat" as AppMode, label: "Chat", icon: MessageSquare, description: "AI Chat with Function Calling" },
    { id: "vision" as AppMode, label: "Vision", icon: Image, description: "Image Analysis" },
    { id: "search" as AppMode, label: "Search", icon: Search, description: "Semantic Search" },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex space-x-8 overflow-x-auto">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Icon size={18} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
