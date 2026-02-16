import { useState, KeyboardEvent, ClipboardEvent, useRef, useEffect } from "react";
import { Image, X, Search, Mic, Volume2 } from "lucide-react";
import { AppMode } from "../types";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

interface Props {
  onSend: (message: string, imageBase64?: string, imageName?: string, imageFile?: File) => void;
  onSearch?: (query: string) => void;
  disabled?: boolean;
  showImageUpload?: boolean;
  mode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
}

export function ChatInput({ onSend, onSearch, disabled, showImageUpload = false, mode = "chat", onModeChange }: Props) {
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const prevDisabledRef = useRef(disabled);

  // Auto-focus textarea only when re-enabling (e.g. after sending a message),
  // avoiding focus on initial mount or conversation switch
  useEffect(() => {
    // Si estaba deshabilitado y ahora está habilitado -> Foco (se completó envío del mensaje)
    if (prevDisabledRef.current && !disabled) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 10);
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  const handleSubmit = () => {
    if (mode === "search" && onSearch) {
      if (input.trim()) {
        onSearch(input.trim());
        setInput("");
      }
    } else {
      if ((input.trim() || imageBase64) && !disabled) {
        onSend(input.trim(), imageBase64 || undefined, imageName || undefined, imageFile || undefined);
        setInput("");
        setImagePreview(null);
        setImageBase64(null);
        setImageName(null);
        setImageFile(null);
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

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (mode === "search" || !showImageUpload) return;
    
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
                 if (file.size > 20 * 1024 * 1024) {
                    alert("Image size must be less than 20MB");
                    return;
                }
                
                setImageName("pasted-image.png");
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = reader.result as string;
                    setImagePreview(base64String);
                    setImageBase64(base64String);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                };
                reader.readAsDataURL(file);
                return;
            }
        }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("Image size must be less than 20MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setImageName(file.name);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      setImageBase64(base64String);
      setTimeout(() => textareaRef.current?.focus(), 0);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setImageName(null);
    setImageFile(null);
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
        onModeChange("chat");
      } else {
        onModeChange("search");
        setImagePreview(null);
        setImageBase64(null);
      }
    }
  };

  const handleTTSToggle = () => {
    if (onModeChange) {
      if (mode === "tts") {
        onModeChange("chat");
      } else {
        onModeChange("tts");
      }
    }
  };

  const handleConversationalToggle = () => {
    if (onModeChange) {
      if (mode === "conversational") {
        onModeChange("chat");
      } else {
        onModeChange("conversational");
      }
    }
  };

  const placeholder = "Escribe tu mensaje...";

  return (
    <div className="bg-background p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {imagePreview && mode !== "search" && (
          <div className="mb-2 sm:mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded-lg border border-border"
            />
            <Button
              size="icon"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary transition-none"
            >
              <X size={16} />
            </Button>
            {imageName && (
              <div className="mt-1 text-xs text-muted-foreground truncate max-w-[200px]">
                {imageName}
              </div>
            )}
          </div>
        )}

        <div className={cn(
          "flex flex-col rounded-xl bg-slate-200 dark:bg-slate-900 px-3 shadow-sm hover:shadow-md transition-all duration-200",
          isTextareaFocused 
            ? "shadow-md ring-2 ring-primary/20" 
            : ""
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={() => setIsTextareaFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent py-2.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[44px]"
            style={{
              maxHeight: "200px",
              overflowY: input.split("\n").length > 3 ? "auto" : "hidden",
            }}
          />

          <div className="flex items-center justify-between pb-2">
            {/* Left side buttons - Search and Image */}
            <div className="flex items-center gap-1">
              {onModeChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleModeToggle}
                  disabled={disabled}
                  className={cn(
                    "h-9 w-9 min-h-[36px] min-w-[36px] hover:bg-accent/50",
                    mode === "search" ? "text-primary" : "text-foreground hover:text-foreground"
                  )}
                  aria-label={mode === "search" ? "Cambiar a modo chat" : "Cambiar a modo búsqueda"}
                  title={mode === "search" ? "Modo chat" : "Modo búsqueda semántica"}
                >
                  <Search size={20} />
                </Button>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleImageButtonClick}
                    disabled={disabled}
                    className="h-9 w-9 min-h-[36px] min-w-[36px] hover:bg-accent/50 text-foreground hover:text-foreground"
                    aria-label="Añadir imagen"
                    title="Añadir imagen"
                  >
                    <Image size={20} />
                  </Button>
                </>
              )}
            </div>

            {/* Right side buttons - Voice AI */}
            <div className="flex items-center gap-1">
              {onModeChange && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleConversationalToggle}
                    disabled={disabled}
                    className={cn(
                      "h-9 w-9 min-h-[36px] min-w-[36px] hover:bg-accent/50",
                      mode === "conversational" ? "bg-primary/10 text-primary" : "text-foreground hover:text-foreground"
                    )}
                    aria-label="Conversational AI mode"
                    title="Conversational AI"
                  >
                    <Mic size={20} />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleTTSToggle}
                    disabled={disabled}
                    className={cn(
                      "h-9 w-9 min-h-[36px] min-w-[36px] hover:bg-accent/50",
                      mode === "tts" ? "text-primary" : "text-foreground hover:text-foreground"
                    )}
                    aria-label="Text-to-Speech mode"
                    title="Text-to-Speech"
                  >
                    <Volume2 size={20} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
