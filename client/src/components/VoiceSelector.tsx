import { useEffect } from "react";
import { Volume2 } from "lucide-react";

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
  // Establecer voz por defecto (Roger) si no hay ninguna seleccionada
  useEffect(() => {
    if (!selectedVoiceId) {
      onVoiceChange(PREDEFINED_VOICES[0].id);
    }
  }, [selectedVoiceId, onVoiceChange]);

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Volume2 size={18} className="flex-shrink-0" />
            <span className="text-sm font-medium hidden sm:inline">Voz:</span>
          </div>
          
          <select
            value={selectedVoiceId || PREDEFINED_VOICES[0].id}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 transition-all cursor-pointer"
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
