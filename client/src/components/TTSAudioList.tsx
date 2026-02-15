import { Volume2, Play, Pause, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { TTSAudio } from "../types";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { cn } from "../lib/utils";

interface Props {
  audios: TTSAudio[];
  onDelete: (id: string) => void;
}

export function TTSAudioList({ audios, onDelete }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const handlePlayPause = (audio: TTSAudio) => {
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
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Volume2 size={48} className="mb-4 opacity-50" />
        <p className="text-lg">No hay audios generados aún</p>
        <p className="text-sm mt-2">Los audios que generes aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {audios.map((audio) => (
        <Card key={audio.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Play/Pause Button */}
              <Button
                variant={audio.audioUrl ? "secondary" : "ghost"}
                size="icon"
                onClick={() => handlePlayPause(audio)}
                disabled={!audio.audioUrl}
                className={cn(
                  "flex-shrink-0 rounded-full h-11 w-11 min-h-[44px] min-w-[44px]",
                  audio.audioUrl && "text-primary"
                )}
              >
                {playingId === audio.id ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} />
                )}
              </Button>

              {/* Audio Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2 mb-1">
                  {audio.text}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{audio.voiceName}</span>
                  <span>•</span>
                  <span>{formatTime(audio.timestamp)}</span>
                </div>
              </div>

              {/* Delete Button */}
              {audio.voiceId !== "conversational-ai" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(audio.id)}
                  className="flex-shrink-0 h-8 w-8 min-h-[32px] min-w-[32px] text-muted-foreground hover:text-primary"
                  aria-label="Eliminar audio"
                >
                  <Trash2 size={16} />
                </Button>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}