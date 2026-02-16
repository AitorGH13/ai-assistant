import { useEffect } from "react";
import { Volume2 } from "lucide-react";
import { Label } from "./ui/Label";

interface Props {
  selectedVoiceId: string;
  onVoiceChange: (voiceId: string) => void;
}

// Lista de voces predefinidas
const PREDEFINED_VOICES = [
  { id: "IKne3meq5aSn9XLyUdCD", name: "Roger", description: "Laid-Back, Casual, Resonant" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, Warm, Clear" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, Confident, Assertive" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, Pleasant, Friendly" },
];

export function VoiceSelector({ selectedVoiceId, onVoiceChange }: Props) {
  useEffect(() => {
    if (!selectedVoiceId) {
      onVoiceChange(PREDEFINED_VOICES[0].id);
    }
  }, [selectedVoiceId, onVoiceChange]);

  return (
    <div className="bg-background border-t border-border p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Volume2 size={18} className="flex-shrink-0" />
            <Label className="hidden sm:inline">Voz:</Label>
          </div>
          
          <select
            value={selectedVoiceId || PREDEFINED_VOICES[0].id}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="flex-1 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all cursor-pointer"
          >
            {PREDEFINED_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} - {voice.description}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
