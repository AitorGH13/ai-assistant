import { useState } from "react";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
}

export function SettingsPanel({ systemPrompt, onSystemPromptChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 sm:px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[52px]"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Settings</span>
          {systemPrompt && (
            <span className="rounded-full bg-primary-600 dark:bg-primary-500 px-2 py-0.5 text-xs text-white">
              Custom prompt active
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform" />
        )}
      </button>

      {isOpen && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 animate-slide-up">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="e.g., You are a helpful pirate assistant who speaks in pirate dialect."
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
          />
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            The system prompt sets the AI's behavior and personality for the conversation.
          </p>
        </div>
      )}
    </div>
  );
}
