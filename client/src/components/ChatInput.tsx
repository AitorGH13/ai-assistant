import { useState, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex gap-3 max-w-4xl mx-auto">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 transition-all duration-200 min-h-[52px] shadow-sm hover:shadow-md focus:shadow-md"
          style={{ 
            maxHeight: '200px',
            overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="rounded-xl px-5 py-6 h-auto min-w-[100px]"
        >
          {disabled ? (
            <>
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
              <span className="hidden sm:inline">Sending</span>
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
