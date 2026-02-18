import { Volume2, Trash2 } from "lucide-react";
import { TTSAudio } from "../types";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthProvider";
import { Avatar } from "./ui/Avatar";
import { SecureAsset } from "./SecureAsset";


interface Props {
  audios: TTSAudio[];
  onDelete: (id: string) => void;
}

export function AudioList({ audios, onDelete }: Props) {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || "Tú";


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

                    {/* Audio Controls Footer - Replaced with SecureAsset */}
                    <div className="p-4 bg-gray-50 dark:bg-muted/30 border-t border-border">
                        <SecureAsset 
                            type="audio"
                            bucket="voice-sessions"
                            path={audio.audioUrl}
                            className="w-full"
                            controls
                        />
                         <div className="flex justify-end mt-2">
                             <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete(audio.id)}
                                className="text-destructive hover:bg-destructive/10 h-8 w-8"
                                title="Eliminar conversación"
                            >
                                <Trash2 size={16} />
                            </Button>
                         </div>
                    </div>
                </CardContent>
             </Card>
          );
        }

        // Standard TTS Card
        return (
          <Card key={audio.id} className="hover:shadow-md transition-shadow overflow-hidden border-border/50">
            <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                    {formatTime(audio.timestamp)} — {audio.voiceName || "Personalizada"}
                </span>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="p-4">
                <div className="rounded-lg px-3 py-2 bg-slate-200 dark:bg-muted text-foreground rounded-tl-md text-sm w-fit max-w-full shadow-sm">
                  <p className="whitespace-pre-wrap">{audio.text}</p>
                </div>
              </div>

              {/* Audio Controls Footer - Replaced with SecureAsset */}
              <div className="p-3 bg-card border-t border-border">
                <SecureAsset 
                    type="audio"
                    bucket="voice-sessions" 
                    path={audio.audioUrl}
                    className="w-full"
                    controls
                />
                 <div className="flex justify-end mt-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(audio.id)}
                        className="text-destructive hover:bg-destructive/10 h-8 w-8"
                        title="Eliminar audio"
                    >
                        <Trash2 size={16} />
                    </Button>
                 </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
