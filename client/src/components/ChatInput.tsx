import { useState, KeyboardEvent, useRef } from "react";
import { Send, Loader2, Image, X } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  onSend: (message: string, imageBase64?: string) => void;
  disabled?: boolean;
  showImageUpload?: boolean;
}

export function ChatInput({ onSend, disabled, showImageUpload = false }: Props) {
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
        
        <div className="flex gap-2">
          {showImageUpload && (
            <div>
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
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="rounded-lg min-w-[44px] min-h-[44px] h-[44px] w-[44px] p-0 flex items-center justify-center"
              >
                <Image size={20} />
              </Button>
            </div>
          )}
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 sm:px-4 py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 transition-all duration-200 min-h-[44px] shadow-sm hover:shadow-md focus:shadow-md"
            style={{ 
              maxHeight: '200px',
              overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="rounded-lg min-w-[44px] min-h-[44px] h-[44px] px-3 sm:px-4 flex items-center justify-center"
          >
            {disabled ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                <span className="hidden sm:inline ml-2">Sending</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span className="hidden sm:inline ml-2">Send</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
