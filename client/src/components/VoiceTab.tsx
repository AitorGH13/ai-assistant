import { useState, useEffect, useRef } from "react";
import { Mic, Square, Volume2, Loader2 } from "lucide-react";
import { Voice, SpeakRequest } from "../types";
import { useConversation } from "@elevenlabs/react";

type VoiceMode = "tts" | "conversational";

export function VoiceTab() {
  const [mode, setMode] = useState<VoiceMode>("tts");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentId, setAgentId] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch voices on mount
  useEffect(() => {
    fetchVoices();
  }, []);

  const fetchVoices = async () => {
    try {
      const response = await fetch("http://localhost:3002/api/voices");
      if (!response.ok) {
        throw new Error("Failed to fetch voices");
      }
      const data = await response.json();
      setVoices(data);
      if (data.length > 0) {
        setSelectedVoiceId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching voices:", error);
    }
  };

  const handleGenerateSpeech = async () => {
    if (!text || !selectedVoiceId) {
      alert("Please enter text and select a voice");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("http://localhost:3002/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: selectedVoiceId,
        } as SpeakRequest),
      });

      if (!response.ok) {
        throw new Error("Failed to generate speech");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (error) {
      console.error("Error generating speech:", error);
      alert("Failed to generate speech");
    } finally {
      setIsGenerating(false);
    }
  };

  // Conversational AI using @elevenlabs/react
  const conversation = useConversation({
    onConnect: () => console.log("Connected to agent"),
    onDisconnect: () => console.log("Disconnected from agent"),
    onMessage: (message) => console.log("Agent message:", message),
    onError: (error) => console.error("Conversation error:", error),
  });

  const handleStartConversation = async () => {
    if (!agentId) {
      alert("Please enter an Agent ID");
      return;
    }

    try {
      // Fetch conversation signature from backend
      const response = await fetch("http://localhost:3002/api/conversation-signature");
      if (!response.ok) {
        throw new Error("Failed to get conversation signature");
      }
      
      // Start conversation with the agent
      await conversation.startSession({
        agentId: agentId,
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("Failed to start conversation");
    }
  };

  const handleStopConversation = () => {
    conversation.endSession();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
            Voice AI
          </h2>

          {/* Mode Selector */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setMode("tts")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                mode === "tts"
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Volume2 className="inline mr-2" size={18} />
              Text-to-Speech
            </button>
            <button
              onClick={() => setMode("conversational")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                mode === "conversational"
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Mic className="inline mr-2" size={18} />
              Conversational AI
            </button>
          </div>

          {/* Text-to-Speech Mode */}
          {mode === "tts" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Select Voice
                </label>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {voices.length === 0 ? (
                    <option>Loading voices...</option>
                  ) : (
                    voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} ({voice.category})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Text to Speak
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text to convert to speech..."
                  rows={6}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <button
                onClick={handleGenerateSpeech}
                disabled={isGenerating || !text || !selectedVoiceId}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 size={18} />
                    Generate Speech
                  </>
                )}
              </button>

              {/* Audio Player */}
              <audio
                ref={audioRef}
                controls
                className="w-full mt-4"
                style={{ display: audioRef.current?.src ? 'block' : 'none' }}
              />
            </div>
          )}

          {/* Conversational AI Mode */}
          {mode === "conversational" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Agent ID
                </label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Enter your ElevenLabs Agent ID"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  You can also set ELEVENLABS_AGENT_ID in your .env file
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  conversation.status === "connected" 
                    ? "bg-green-500" 
                    : conversation.status === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-gray-300 dark:bg-gray-700"
                }`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Status: {conversation.status || "disconnected"}
                </span>
              </div>

              {/* Microphone Button */}
              <div className="flex flex-col items-center gap-4 py-8">
                {conversation.status === "connected" ? (
                  <button
                    onClick={handleStopConversation}
                    className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                  >
                    <Square size={32} />
                  </button>
                ) : (
                  <button
                    onClick={handleStartConversation}
                    disabled={!agentId}
                    className="w-24 h-24 rounded-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <Mic size={32} />
                  </button>
                )}

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {conversation.status === "connected"
                    ? "Conversation active - Click to stop"
                    : "Click to start conversation"}
                </p>
              </div>

              {/* Conversation Indicators */}
              {conversation.status === "connected" && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      conversation.isSpeaking ? "bg-blue-500 animate-pulse" : "bg-gray-300 dark:bg-gray-700"
                    }`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Agent Speaking: {conversation.isSpeaking ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      !conversation.isSpeaking && conversation.status === "connected" 
                        ? "bg-green-500 animate-pulse" 
                        : "bg-gray-300 dark:bg-gray-700"
                    }`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Listening: {!conversation.isSpeaking && conversation.status === "connected" ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
