import { useState, KeyboardEvent, useRef } from "react";
import { Send, Loader2, Image, X, Search } from "lucide-react";
import { Button } from "./ui/Button";
import { AppMode } from "../types";

interface Props {
  onSend: (message: string, imageBase64?: string) => void;
  disabled?: boolean;
  showImageUpload?: boolean;
  mode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
}

export function ChatInput({ onSend, disabled, showImageUpload = false, mode = "chat", onModeChange }: Props) {
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim(), imageBase64 || undefined);
      setInput("");
      setImagePreview(null);
      setImageBase64(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {imagePreview && (
          <div className="mb-2 sm:mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded-lg border border-gray-300 dark:border-gray-600"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        )}
        
        {/* Input container with integrated icons - Gemini style */}
        <div className="flex gap-2 items-end">
          {/* Main input area with integrated icons */}
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-primary-500 dark:focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all duration-200">
            {/* Image Upload Icon - Inside left */}
            {showImageUpload && (
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50 flex-shrink-0"
                  aria-label="Add image"
                >
                  <Image size={20} />
                </button>
              </>
            )}
            
            {/* Text input */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none disabled:opacity-50 min-h-[44px]"
              style={{ 
                maxHeight: '200px',
                overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
              }}
            />
            
            {/* Search Mode Toggle - Inside right (before send button) */}
            {onModeChange && (
              <button
                onClick={() => onModeChange(mode === "chat" ? "search" : "chat")}
                disabled={disabled}
                className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                  mode === "search"
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                }`}
                aria-label={mode === "search" ? "Switch to chat mode" : "Switch to search mode"}
                title={mode === "search" ? "Chat mode" : "Search mode"}
              >
                <Search size={20} />
              </button>
            )}
          </div>

          {/* Send Button - Outside, at the end */}
          <Button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="rounded-xl min-w-[44px] min-h-[44px] h-[44px] px-3 sm:px-4 flex items-center justify-center flex-shrink-0"
          >
            {disabled ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
