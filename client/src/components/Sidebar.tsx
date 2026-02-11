import { useState } from "react";
import { Menu, X, Plus, Settings, Palette, FileText } from "lucide-react";
import { Button } from "./ui/Button";
import { Theme } from "../utils/theme";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  onNewConversation: () => void;
}

export function Sidebar({
  theme,
  onToggleTheme,
  systemPrompt,
  onSystemPromptChange,
  onNewConversation,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      {/* Hamburger Menu Button - Top Right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="icon"
          className="bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        
        {/* New Conversation Button - Always visible below hamburger */}
        {!isOpen && (
          <Button
            onClick={onNewConversation}
            variant="default"
            size="icon"
            className="bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-lg hover:shadow-xl transition-shadow"
            aria-label="New conversation"
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
              <Button
                onClick={closeSidebar}
                variant="ghost"
                size="icon"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* New Conversation Button */}
            <Button
              onClick={() => {
                onNewConversation();
                closeSidebar();
              }}
              className="w-full flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Conversation</span>
            </Button>
          </div>

          {/* Conversation History Section */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              History
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No previous conversations
            </div>
          </div>

          {/* Settings Section - Bottom */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Settings</span>
            </button>

            {showSettings && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {/* Theme Toggle */}
                <button
                  onClick={onToggleTheme}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <Palette className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">Change Theme</span>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {theme}
                  </span>
                </button>

                {/* System Prompt */}
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Chat Instructions
                    </label>
                  </div>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => onSystemPromptChange(e.target.value)}
                    placeholder="e.g., You are a helpful assistant..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                  />
                  {systemPrompt && (
                    <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                      Custom instructions active
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
