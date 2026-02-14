import { useState, KeyboardEvent, useRef } from "react";
import { Image, X, Search, Mic, Volume2 } from "lucide-react";
import { AppMode } from "../types";

interface Props {
  onSend: (message: string, imageBase64?: string) => void;
  onSearch?: (query: string) => void;
  disabled?: boolean;
  showImageUpload?: boolean;
  mode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
  onNewConversation?: () => void;
}

export function ChatInput({ onSend, onSearch, disabled, showImageUpload = false, mode = "chat", onModeChange, onNewConversation }: Props) {
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (mode === "search" && onSearch) {
      // Modo búsqueda semántica
      if (input.trim()) {
        onSearch(input.trim());
        setInput("");
      }
    } else {
      // Modo chat normal o TTS
      if ((input.trim() || imageBase64) && !disabled) {
        onSend(input.trim(), imageBase64 || undefined);
        setInput("");
        setImagePreview(null);
        setImageBase64(null);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mode === "search") {
        if (input.trim()) {
          handleSubmit();
        }
      } else {
        if (imageBase64 || input.trim()) {
          handleSubmit();
        }
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert("Image size must be less than 20MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      setImageBase64(base64String);
      // Return focus to textarea after selecting image
      setTimeout(() => textareaRef.current?.focus(), 0);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleModeToggle = () => {
    if (onModeChange) {
      if (mode === "search") {
        // Si ya estamos en search, volver a chat con nueva conversación
        onModeChange("chat");
        if (onNewConversation) {
          onNewConversation();
        }
      } else {
        // Cambiar a search desde cualquier otro modo
        onModeChange("search");
        // Limpiar imagen si cambiamos a modo búsqueda
        setImagePreview(null);
        setImageBase64(null);
      }
    }
  };

  const handleTTSToggle = () => {
    if (onModeChange) {
      if (mode === "tts") {
        // Si ya estamos en TTS, volver a chat con nueva conversación
        onModeChange("chat");
        if (onNewConversation) {
          onNewConversation();
        }
      } else {
        // Cambiar a TTS desde cualquier otro modo
        onModeChange("tts");
      }
    }
  };

  const handleConversationalToggle = () => {
    if (onModeChange) {
      if (mode === "conversational") {
        // Si ya estamos en conversational, volver a chat con nueva conversación
        onModeChange("chat");
        if (onNewConversation) {
          onNewConversation();
        }
      } else {
        // Cambiar a conversational desde cualquier otro modo
        onModeChange("conversational");
      }
    }
  };

  const placeholder = mode === "search" 
    ? "Buscar en la base de conocimientos..." 
    : mode === "tts"
    ? "Escribe el texto que quieres convertir a voz..."
    : "Escribe tu mensaje...";

  return (
    <div className="bg-white dark:bg-gray-900 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {imagePreview && mode !== "search" && (
          <div className="mb-2 sm:mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded-lg border border-gray-300 dark:border-gray-600"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className={`flex flex-col rounded-xl border bg-white dark:bg-gray-800 px-3 shadow-sm hover:shadow-md transition-all duration-200 ${
          isTextareaFocused 
            ? "border-primary-500 dark:border-primary-400 shadow-md ring-2 ring-primary-500/20" 
            : "border-gray-300 dark:border-gray-600"
        }`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={() => setIsTextareaFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none disabled:opacity-50 min-h-[44px]"
            style={{
              maxHeight: "200px",
              overflowY: input.split("\n").length > 3 ? "auto" : "hidden",
            }}
          />

          <div className="flex items-center justify-between pb-2">
            {/* Left side buttons - Search and Image */}
            <div className="flex items-center gap-1">
              {onModeChange && (
                <button
                  type="button"
                  onClick={handleModeToggle}
                  disabled={disabled}
                  className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                    mode === "search"
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                  }`}
                  aria-label={mode === "search" ? "Cambiar a modo chat" : "Cambiar a modo búsqueda"}
                  title={mode === "search" ? "Modo chat" : "Modo búsqueda semántica"}
                >
                  <Search size={20} />
                </button>
              )}

              {showImageUpload && mode !== "search" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={handleImageButtonClick}
                    disabled={disabled}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50 flex-shrink-0"
                    aria-label="Añadir imagen"
                    title="Añadir imagen"
                  >
                    <Image size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Right side buttons - Voice AI */}
            <div className="flex items-center gap-1">
              {onModeChange && (
                <>
                  <button
                    type="button"
                    onClick={handleConversationalToggle}
                    disabled={disabled}
                    className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                      mode === "conversational"
                        ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                    }`}
                    aria-label="Conversational AI mode"
                    title="Conversational AI"
                  >
                    <Mic size={20} />
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleTTSToggle}
                    disabled={disabled}
                    className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                      mode === "tts"
                        ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                    }`}
                    aria-label="Text-to-Speech mode"
                    title="Text-to-Speech"
                  >
                    <Volume2 size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
