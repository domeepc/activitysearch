"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [messageText, setMessageText] = useState("");

  const handleSend = async () => {
    if (!messageText.trim() || disabled) return;
    const text = messageText.trim();
    try {
      await Promise.resolve(onSend(text));
      setMessageText("");
    } catch {
      // Error already surfaced by parent (e.g. toast); do not clear input
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-100 px-4 py-3 shrink-0 bg-white">
      <div className="flex items-end gap-2">
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="min-h-[44px] max-h-32 resize-none rounded-2xl border-zinc-200 bg-zinc-50 text-sm"
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={!messageText.trim() || disabled}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
