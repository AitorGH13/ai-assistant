import { Volume2, Play, Pause, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { TTSAudio } from "../types";

interface Props {
  audios: TTSAudio[];
  onDelete: (id: string) => void;
}

export function TTSAudioList({ audios, onDelete }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const handlePlayPause = (audio: TTSAudio) => {
    // Si no hay audioUrl, no se puede reproducir
    if (!audio.audioUrl) {
      alert("Este audio no está disponible para reproducción");
      return;
    }
    
    const audioElement = audioRefs.current[audio.id];
    
    if (!audioElement) return;

    if (playingId === audio.id) {
      audioElement.pause();
      setPlayingId(null);
    } else {
      // Pausar cualquier audio que esté reproduciéndose
      Object.values(audioRefs.current).forEach(el => el.pause());
      
      audioElement.play();
      setPlayingId(audio.id);
    }
  };

  const handleAudioEnded = () => {
    setPlayingId(null);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' ' + 
           date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  if (audios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <Volume2 size={48} className="mb-4 opacity-50" />
        <p className="text-lg">No hay audios generados aún</p>
        <p className="text-sm mt-2">Los audios que generes aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {audios.map((audio) => (
        <div
          key={audio.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={() => handlePlayPause(audio)}
              disabled={!audio.audioUrl}
              className={`flex-shrink-0 p-3 rounded-full transition-colors ${
                audio.audioUrl
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              {playingId === audio.id ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
            </button>

            {/* Audio Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                {audio.text}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{audio.voiceName}</span>
                <span>•</span>
                <span>{formatTime(audio.timestamp)}</span>
              </div>
            </div>

            {/* Delete Button (hidden for conversational recordings) */}
            {audio.voiceId !== "conversational-ai" && (
              <button
                onClick={() => onDelete(audio.id)}
                className="flex-shrink-0 p-1 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors"
                aria-label="Eliminar audio"
              >
                <Trash2 size={16} className="text-primary-600 dark:text-primary-400" />
              </button>
            )}
          </div>

          {/* Hidden Audio Element */}
          <audio
            ref={el => {
              if (el) audioRefs.current[audio.id] = el;
            }}
            src={audio.audioUrl}
            onEnded={handleAudioEnded}
          />
        </div>
      ))}
    </div>
  );
}