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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border px-3 py-3 shrink-0 bg-white md:px-4 dark:bg-zinc-900">
      <div className="flex items-end gap-2">
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Write a message…"
          aria-label="Message"
          className="min-h-[44px] max-h-32 resize-none rounded-xl border-zinc-200 bg-zinc-50 py-3 text-sm focus-visible:bg-background dark:border-zinc-700 dark:bg-zinc-800"
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={!messageText.trim() || disabled}
          size="icon"
          aria-label="Send message"
          className="shrink-0 h-11 w-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
