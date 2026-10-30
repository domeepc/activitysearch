"use client";

import { MessagesSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="flex max-w-xs flex-col items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <MessagesSquare className="size-6" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold tracking-tight text-foreground">Pick a conversation</p>
        <p className="text-sm text-muted-foreground">
          Choose a friend or team on the left, or create a team to plan your next activity together.
        </p>
      </div>
    </div>
  );
}
