import { useState } from "react";
import { Plus, Settings, Palette, FileText, Menu, Trash2, MessageSquare, Search } from "lucide-react";
import { Theme } from "../utils/theme";
import { Conversation } from "../types";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  onNewConversation: () => void;
  onToggleSidebar: () => void;
  isOpen: boolean;
  conversations: Conversation[];
  currentConversationId: string | null;
  onLoadConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onSearchClick: () => void;
  showSearchView: boolean;
  onCloseSearch: () => void;
}

export function Sidebar({
  theme,
  onToggleTheme,
  systemPrompt,
  onSystemPromptChange,
  onNewConversation,
  onToggleSidebar,
  isOpen,
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  onSearchClick,
  showSearchView,
  onCloseSearch,
}: Props) {
  const [showFloatingSettings, setShowFloatingSettings] = useState(false);

  const handleSettingsClick = () => {
    setShowFloatingSettings(!showFloatingSettings);
  };

  const handleNewConversationClick = () => {
    onCloseSearch();
    onNewConversation();
  };

  const handleLoadConversationClick = (id: string) => {
    onCloseSearch();
    onLoadConversation(id);
  };

  const handleMenuToggle = () => {
    setShowFloatingSettings(false);
    onToggleSidebar();
  };

  return (
    <>
      <div
        className={`h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
          isOpen ? "w-80" : "w-16"
        } overflow-hidden flex-shrink-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header con botones de Menú y Búsqueda */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleMenuToggle}
                className="-ml-3 flex items-center justify-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-lg"
              >
                <Menu className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              </button>
              
              {/* Botón de búsqueda - solo visible cuando el menú está desplegado */}
              {isOpen && (
                <button
                  onClick={onSearchClick}
                  disabled={showSearchView}
                  className={`flex items-center justify-center px-4 py-3 transition-all rounded-lg ${
                    !showSearchView&&!showSearchView && "hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105"
                  }`}
                  title={showSearchView ? "Búsqueda activa" : "Buscar conversaciones"}
                >
                  <Search className={`h-5 w-5 ${
                    showSearchView
                      ? "text-gray-400 dark:text-gray-500"
                      : "text-primary-600 dark:text-primary-400"
                  }`} />
                </button>
              )}
            </div>
          </div>

          {/* Botón de Nueva Conversación */}
          <div className="p-4">
            <button
              onClick={handleNewConversationClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-lg"
            >
              <Plus className="h-5 w-5 text-primary-600 dark:text-primary-400  flex-shrink-0" />
              {isOpen && <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden">Nueva Conversación</span>}
            </button>
          </div>

          {/* Historial de Conversaciones */}
          <div className="flex-1 overflow-y-auto scrollbar-stable" style={{ scrollbarGutter: 'stable' }}>
            {isOpen && (
              <div className="px-4 space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 px-2 whitespace-nowrap overflow-hidden transition-opacity duration-300">
                    Historial
                  </h3>
                  {conversations.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                      No hay conversaciones previas
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                            conversation.id === currentConversationId
                              ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />
                          <button
                            onClick={() => handleLoadConversationClick(conversation.id)}
                            className="flex-1 text-left text-sm truncate"
                            title={conversation.title}
                          >
                            {conversation.title}
                          </button>
                            <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conversation.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all transform hover:scale-105 shadow-md hover:bg-primary-200 dark:hover:bg-primary-800/50"
                            title="Eliminar conversación"
                            >
                            <Trash2 className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                            </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Configuración */}
          <div className="p-4">
            <button
              onClick={handleSettingsClick}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-500 ease-in-out justify-center rounded-lg shadow-md ${
                showFloatingSettings
                  ? "bg-primary-200 dark:bg-primary-800/50"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <Settings className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              {isOpen && (
              <span className="font-medium text-gray-900 dark:text-gray-100">
              Configuración
              </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel flotante de configuración */}
      {showFloatingSettings && (
        <div className="absolute bottom-20 left-20 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 animate-slide-in-bottom">
          <div className="p-4 space-y-3">
            {/* Cambiar Tema */}
            <button
              onClick={onToggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <Palette className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-900 dark:text-gray-100">Cambiar Tema</span>
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 capitalize">
                {theme}
              </span>
            </button>

            {/* Instrucciones del Chat */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Instrucciones del Chat
                </label>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="Por ejemplo: Eres un asistente útil..."
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
              />
              {systemPrompt && (
                <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                  Instrucciones personalizadas activas
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
