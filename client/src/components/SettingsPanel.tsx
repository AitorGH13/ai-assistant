import { useState } from "react";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";
import { Label } from "./ui/Label";
import { Badge } from "./ui/Badge";

interface Props {
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
}

export function SettingsPanel({ systemPrompt, onSystemPromptChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border bg-background">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 sm:px-4 py-3 text-left min-h-[52px] rounded-none"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-foreground">Settings</span>
          {systemPrompt && (
            <Badge variant="default" className="text-xs">
              Custom prompt active
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
        )}
      </Button>

      {isOpen && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 animate-slide-up">
          <Label className="block mb-2">
            System Prompt
          </Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="e.g., You are a helpful pirate assistant who speaks in pirate dialect."
            rows={3}
            className="resize-none"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            The system prompt sets the AI's behavior and personality for the conversation.
          </p>
        </div>
      )}
    </div>
  );
}
