import { useState, useEffect } from "react";
import { Plus, Settings, Palette, FileText, Menu, Search, Volume2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Theme } from "../utils/theme";
import { Conversation } from "../types";

interface Props {
    onEditConversationTitle?: (id: string, newTitle: string) => void;
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
    onEditConversationTitle,
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
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const handleSettingsClick = () => {
    setShowFloatingSettings(!showFloatingSettings);
  };

  const handleNewConversationClick = () => {
    onCloseSearch();
    onNewConversation();
  };

  const handleMenuToggle = () => {
    setShowFloatingSettings(false);
    onToggleSidebar();
  };

  const filteredConversations = conversations.filter((conversation) => {
    const hasMessages = conversation.messages && conversation.messages.length > 0;
    const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
    
    return hasMessages || hasTTSAudios;
  });

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
                      {filteredConversations.map((conversation) => {
                        const hasMessages = conversation.messages && conversation.messages.length > 0;
                        const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
                        const isEditing = editTitleId === conversation.id;
                        return (
                          <div
                            key={conversation.id}
                            className="relative group"
                          >
                            <button
                              onClick={() => {
                                onLoadConversation(conversation.id);
                                if (window.innerWidth < 768) {
                                  onToggleSidebar();
                                }
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                                currentConversationId === conversation.id
                                  ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                              }`}
                              style={{ position: "relative" }}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {/* Icon that changes on hover: chat icon becomes edit icon */}
                                <div className="flex-shrink-0 relative">
                                  {hasTTSAudios && !hasMessages ? (
                                    <>
                                      <Volume2 size={16} className="text-gray-600 dark:text-gray-400 group-hover:opacity-0 transition-opacity" />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditTitleId(conversation.id);
                                          setEditTitleValue(conversation.title);
                                        }}
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        aria-label="Editar nombre"
                                      >
                                        <Pencil size={16} className="text-primary-600 dark:text-primary-400" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare size={16} className="text-gray-600 dark:text-gray-400 group-hover:opacity-0 transition-opacity" />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditTitleId(conversation.id);
                                          setEditTitleValue(conversation.title);
                                        }}
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        aria-label="Editar nombre"
                                      >
                                        <Pencil size={16} className="text-primary-600 dark:text-primary-400" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editTitleValue}
                                    onChange={e => setEditTitleValue(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="text-sm truncate bg-transparent border border-primary-300 dark:border-primary-700 rounded px-2 py-1 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-gray-900 dark:text-gray-100"
                                    autoFocus
                                    onBlur={() => {
                                      if (
                                        onEditConversationTitle &&
                                        editTitleValue.trim() &&
                                        editTitleValue !== conversation.title
                                      ) {
                                        onEditConversationTitle(conversation.id, editTitleValue.trim());
                                      }
                                      setEditTitleId(null);
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") {
                                        if (
                                          onEditConversationTitle &&
                                          editTitleValue.trim() &&
                                          editTitleValue !== conversation.title
                                        ) {
                                          onEditConversationTitle(conversation.id, editTitleValue.trim());
                                        }
                                        setEditTitleId(null);
                                      } else if (e.key === "Escape") {
                                        setEditTitleId(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm truncate">
                                    {conversation.title}
                                  </span>
                                )}
                              </div>
                              {/* Delete button - appears on hover replacing 3 dots */}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteConversation(conversation.id);
                                }}
                                className="p-1 rounded transition-all duration-200 flex-shrink-0 focus:outline-none group-hover:opacity-100 opacity-0 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                                aria-label="Eliminar"
                                style={{ zIndex: 2 }}
                              >
                                <Trash2 size={16} className="text-primary-600 dark:text-primary-400" />
                              </button>
                            </button>
                          </div>
                        );
                      })}
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
