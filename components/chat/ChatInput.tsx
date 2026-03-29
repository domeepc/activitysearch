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
    <div className="border-t border-gray-300 p-4 shrink-0 bg-background">
      <div className="flex gap-2">
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="min-h-[60px] resize-none"
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={!messageText.trim() || disabled}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
