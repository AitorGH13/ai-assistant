import { ChatMessage as ChatMessageType } from "../types";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-gray-700 text-gray-100 rounded-bl-md"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold opacity-70">
            {isUser ? "You" : "AI"}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
