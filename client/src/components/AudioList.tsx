import { Volume2, Play, Pause, Download, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TTSAudio } from "../types";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthProvider";
import { Avatar } from "./ui/Avatar";
import { supabase } from "../lib/supabase";

interface Props {
  audios: TTSAudio[];
  onDelete: (id: string) => void;
}

export function AudioList({ audios, onDelete }: Props) {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || "Tú";
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  const fetchedUrlsRef = useRef<Record<string, boolean>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});

  const formatDurationRaw = (seconds: number) => {
    if (seconds === undefined || seconds === null || isNaN(seconds) || seconds === Infinity) return "--:--";
    const roundedSeconds = Math.round(seconds);
    const m = Math.floor(roundedSeconds / 60);
    const s = roundedSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement, Event>, id: string) => {
    const target = e.target as HTMLAudioElement;
    if (target.duration && target.duration !== Infinity && !isNaN(target.duration)) {
      setDurations(prev => ({ ...prev, [id]: target.duration }));
    }
  };

  useEffect(() => {
    audios.forEach(audio => {
      const path = audio.audioUrl;
      if (path && !fetchedUrlsRef.current[path]) {
        fetchedUrlsRef.current[path] = true; // Mark as fetched/fetching
        if (path.startsWith('http') || path.startsWith('data:')) {
          setSignedUrls(prev => ({ ...prev, [path]: path }));
        } else {
          supabase.storage.from('voice-sessions').createSignedUrl(path, 3600)
            .then(({ data }) => {
              if (data) {
                setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
              }
            })
            .catch(() => { /* signed URL fetch failed */ });
        }
      }
    });
  }, [audios]);

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
      if (audioElement.src) {
        audioElement.play().catch(() => { /* play failed */ });
        setPlayingId(audio.id);
      } else {
        alert("Audio no cargado aún. Intenta en un momento.");
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingId(null);
  };

  const handleDownload = async (audio: TTSAudio) => {
    if (!audio.audioUrl) return;
    const url = signedUrls[audio.audioUrl];
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `audio-${audio.timestamp}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    } catch (e) {
      // download failed
    }
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

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  if (audios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-full bg-primary/20 dark:bg-primary/20 ring-8 ring-primary/10 shadow-inner">
          <Volume2 className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary" />
        </div>
        <p className="text-lg font-semibold text-foreground">No hay audios generados aún</p>
        <p className="text-sm text-muted-foreground mt-2">Los audios que generes aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {[...audios].sort((a, b) => b.timestamp - a.timestamp).map((audio) => {
        // Only treat as "Voice Session" (Conversational) if it has a transcript AND the voiceId is specific to conversational mode
        const isVoiceSession = !!audio.transcript && audio.transcript.length > 0 && audio.voiceId === 'conversational-ai';
        const urlForAudio = audio.audioUrl ? signedUrls[audio.audioUrl] : undefined;

        if (isVoiceSession) {
          return (
             <Card key={audio.id} className="hover:shadow-md transition-shadow overflow-hidden border-border/50">
                <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">
                            {formatTime(audio.timestamp)} — {audio.voiceName || "AI Assistant"}
                        </span>
                    </div>
                </div>
                <CardContent className="p-0">
                    {/* Transcript Scroll Area */}
                    <div className="max-h-[60vh] min-h-[200px] overflow-y-auto p-6 space-y-6 bg-white dark:bg-card/50 custom-scrollbar">
                        {audio.transcript?.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                 <div key={idx} className="flex gap-4 items-start">
                                     <Avatar role={isUser ? 'user' : 'assistant'} size="sm" />
                                     
                                     <div className="flex flex-col gap-1 flex-1 min-w-0">
                                         <div className="flex items-center gap-2">
                                             <span className={cn(
                                                 "text-sm font-bold",
                                                 isUser ? "text-primary" : "text-muted-foreground"
                                             )}>
                                                 {isUser ? userName : "AI Assistant"}
                                             </span>
                                             {msg.date && (
                                                <span className="text-xs text-muted-foreground/60">
                                                    {formatMessageTime(msg.date)}
                                                </span>
                                             )}
                                         </div>
                                         
                                         <div className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                                             <p className="whitespace-pre-wrap">{msg.msg || (msg as any).text}</p>
                                         </div>
                                     </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Audio Controls Footer */}
                    <div className="p-3 bg-card border-t border-border flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlayPause(audio)}
                        disabled={!audio.audioUrl}
                        className={cn(
                          "flex-shrink-0 rounded-full h-10 w-10 min-h-[40px] min-w-[40px]",
                          audio.audioUrl 
                            ? "bg-primary/10 text-primary hover:bg-primary/20" 
                            : "text-muted-foreground"
                        )}
                      >
                        {playingId === audio.id ? (
                          <Pause size={20} fill="currentColor" />
                        ) : (
                          <Play size={20} fill="currentColor" />
                        )}
                      </Button>
                      
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-1 bg-slate-200 dark:bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full bg-primary transition-all duration-500", playingId === audio.id ? "w-full animate-pulse" : "w-0")} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                          {durations[audio.id] ? formatDurationRaw(durations[audio.id]) : "--:--"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {audio.audioUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(audio)}
                            className="text-primary h-8 w-8"
                            title="Descargar audio"
                          >
                            <Download size={16} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(audio.id)}
                          className="text-primary h-8 w-8"
                          title="Eliminar conversación"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                </CardContent>

                <audio
                    preload="metadata"
                    ref={el => {
                        if (el) audioRefs.current[audio.id] = el;
                    }}
                    src={urlForAudio}
                    onEnded={handleAudioEnded}
                    onLoadedMetadata={(e) => handleLoadedMetadata(e, audio.id)}
                    onDurationChange={(e) => handleLoadedMetadata(e, audio.id)}
                />
             </Card>
          );
        }

        // Standard TTS Card
        return (
          <Card key={audio.id} className="hover:shadow-md transition-shadow overflow-hidden border-border/50">
            <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                    {formatTime(audio.timestamp)} — {audio.voiceName || "Roger - Laid-Back, Casual, Resonant"}
                </span>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="p-4">
                <div className="rounded-lg px-3 py-2 bg-slate-200 dark:bg-muted text-foreground rounded-tl-md text-sm w-fit max-w-full shadow-sm">
                  <p className="whitespace-pre-wrap">{audio.text}</p>
                </div>
              </div>

              {/* Audio Controls Footer */}
              <div className="p-3 bg-card border-t border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePlayPause(audio)}
                  disabled={!audio.audioUrl}
                  className={cn(
                    "flex-shrink-0 rounded-full h-10 w-10 min-h-[40px] min-w-[40px]",
                    audio.audioUrl 
                      ? "bg-primary/10 text-primary hover:bg-primary/20" 
                      : "text-muted-foreground"
                  )}
                >
                  {playingId === audio.id ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" />
                  )}
                </Button>
                
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full bg-primary transition-all duration-500", playingId === audio.id ? "w-full animate-pulse" : "w-0")} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                    {durations[audio.id] ? formatDurationRaw(durations[audio.id]) : "--:--"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {audio.audioUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(audio)}
                      className="text-primary h-8 w-8"
                      title="Descargar audio"
                    >
                      <Download size={16} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(audio.id)}
                    className="text-primary h-8 w-8"
                    title="Eliminar audio"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>

            <audio
              preload="metadata"
              ref={el => {
                if (el) audioRefs.current[audio.id] = el;
              }}
              src={urlForAudio}
              onEnded={handleAudioEnded}
              onLoadedMetadata={(e) => handleLoadedMetadata(e, audio.id)}
              onDurationChange={(e) => handleLoadedMetadata(e, audio.id)}
            />
          </Card>
        );
      })}
    </div>
  );
}
