import { useState } from "react";
import { Plus, Settings, Palette, FileText, Menu, Search, Volume2, MessageSquare, Pencil, Trash2, Mic } from "lucide-react";
import { Theme } from "../utils/theme";
import { Conversation } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { ScrollArea } from "./ui/ScrollArea";
import { cn } from "../lib/utils";

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
        className={cn(
          "h-full bg-background border-r border-border transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0",
          isOpen ? "w-80" : "w-16"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header con botones de Menú y Búsqueda */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMenuToggle}
                className="-ml-1"
              >
                <Menu className="h-5 w-5 text-primary" />
              </Button>
              
              {isOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSearchClick}
                  disabled={showSearchView}
                  title={showSearchView ? "Búsqueda activa" : "Buscar conversaciones"}
                >
                  <Search className={cn(
                    "h-5 w-5",
                    showSearchView ? "text-muted-foreground" : "text-primary"
                  )} />
                </Button>
              )}
            </div>
          </div>

          {/* Botón de Nueva Conversación */}
          <div className="p-4">
            <Button
              variant="ghost"
              onClick={handleNewConversationClick}
              className="w-full justify-center gap-2 hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-5 w-5 text-primary flex-shrink-0" />
              {isOpen && <span className="font-medium whitespace-nowrap overflow-hidden">Nueva Conversación</span>}
            </Button>
          </div>

          {/* Historial de Conversaciones */}
          <ScrollArea className="flex-1 w-full">
            {isOpen && (
              <div className="px-4 space-y-2 w-full overflow-hidden">
                <div className="w-full overflow-hidden">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2 whitespace-nowrap overflow-hidden transition-opacity duration-300">
                    Historial
                  </h3>
                  {conversations.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No hay conversaciones previas
                    </div>
                  ) : (
                    <div className="space-y-1 w-full overflow-hidden">
                      {filteredConversations.map((conversation) => {
                        const hasMessages = conversation.messages && conversation.messages.length > 0;
                        const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
                        const hasConversationalAudio = hasTTSAudios && conversation.ttsHistory?.some(
                          audio => audio.voiceId === "conversational-ai"
                        );
                        const isEditing = editTitleId === conversation.id;
                        return (
                          <div
                            key={conversation.id}
                            className="relative group w-full overflow-hidden"
                          >
                            <div
                              onClick={() => {
                                if (editTitleId === conversation.id) return;
                                onLoadConversation(conversation.id);
                                if (window.innerWidth < 768) {
                                  onToggleSidebar();
                                }
                              }}
                              className={cn(
                                "w-full text-left px-2 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer overflow-hidden",
                                currentConversationId === conversation.id
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent/50 text-foreground"
                              )}
                              style={{ position: "relative" }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  if (editTitleId === conversation.id) return;
                                  onLoadConversation(conversation.id);
                                  if (window.innerWidth < 768) {
                                    onToggleSidebar();
                                  }
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                {/* Icon that changes on hover */}
                                <div className="flex-shrink-0 relative">
                                  {hasConversationalAudio ? (
                                    <>
                                      <Mic size={16} className="text-muted-foreground group-hover:opacity-0 transition-opacity" />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditTitleId(conversation.id);
                                          setEditTitleValue(conversation.title);
                                        }}
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        aria-label="Editar nombre"
                                      >
                                        <Pencil size={16} className="text-muted-foreground hover:text-primary transition-colors" />
                                      </button>
                                    </>
                                  ) : hasTTSAudios && !hasMessages ? (
                                    <>
                                      <Volume2 size={16} className="text-muted-foreground group-hover:opacity-0 transition-opacity" />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditTitleId(conversation.id);
                                          setEditTitleValue(conversation.title);
                                        }}
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        aria-label="Editar nombre"
                                      >
                                        <Pencil size={16} className="text-muted-foreground hover:text-primary transition-colors" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare size={16} className="text-muted-foreground group-hover:opacity-0 transition-opacity" />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditTitleId(conversation.id);
                                          setEditTitleValue(conversation.title);
                                        }}
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        aria-label="Editar nombre"
                                      >
                                        <Pencil size={16} className="text-muted-foreground hover:text-primary transition-colors" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                {isEditing ? (
                                  <Input
                                    type="text"
                                    value={editTitleValue}
                                    onChange={e => setEditTitleValue(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="text-sm h-7 px-2 py-1"
                                    autoFocus
                                    onBlur={() => {
                                      setEditTitleId(null);
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (
                                          onEditConversationTitle &&
                                          editTitleValue.trim() &&
                                          editTitleValue !== conversation.title
                                        ) {
                                          onEditConversationTitle(conversation.id, editTitleValue.trim());
                                        }
                                        setEditTitleId(null);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        setEditTitleId(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm truncate block">
                                    {conversation.title}
                                  </span>
                                )}
                              </div>
                              {/* Delete button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteConversation(conversation.id);
                                }}
                                className="p-1 h-7 w-7 min-h-[28px] min-w-[28px] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                                aria-label="Eliminar"
                                style={{ zIndex: 2 }}
                              >
                                <Trash2 size={14} className="text-muted-foreground hover:text-primary transition-colors" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Configuración */}
          <div className="p-4">
            <Button
              variant={showFloatingSettings ? "secondary" : "ghost"}
              onClick={handleSettingsClick}
              className="w-full justify-center gap-3 shadow-md hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-5 w-5 text-primary flex-shrink-0" />
              {isOpen && (
              <span className="font-medium">
              Configuración
              </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Panel flotante de configuración */}
      {showFloatingSettings && (
        <div className="absolute bottom-20 left-20 w-80 bg-popover rounded-lg shadow-xl border border-border z-50 animate-slide-in-bottom">
          <div className="p-4 space-y-3">
            {/* Cambiar Tema */}
            <Button
              variant="ghost"
              onClick={onToggleTheme}
              className="w-full justify-start gap-3 hover:bg-accent hover:text-foreground"
            >
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Cambiar Tema</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize">
                {theme}
              </span>
            </Button>

            {/* Instrucciones del Chat */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">
                  Instrucciones del Chat
                </label>
              </div>
              <Textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="Por ejemplo: Eres un asistente útil..."
                rows={3}
                className="resize-none"
              />
              {systemPrompt && (
                <p className="mt-1 text-xs text-primary">
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
