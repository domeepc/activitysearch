"use client";

import { useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ChatLinkPromptProps {
  linkCode: string | null;
  linkFailed: boolean;
  onRetry: () => Promise<void>;
  onStartFresh: () => Promise<void>;
}

/** Shown on a browser that doesn't have the user's chat key yet */
export function ChatLinkPrompt({ linkCode, linkFailed, onRetry, onStartFresh }: ChatLinkPromptProps) {
  const [confirmFresh, setConfirmFresh] = useState(false);

  return (
    <div className="mx-auto mb-4 flex w-full max-w-sm flex-col gap-3 rounded-xl border bg-background p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
        Link this browser
      </div>
      {linkFailed ? (
        <>
          <p className="text-muted-foreground">The request was denied or expired.</p>
          <Button onClick={onRetry}>Send a new request</Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            Open ActivitySearch chat on a browser you already use and approve this one. Check that it shows
            the same code:
          </p>
          <p className="text-center font-mono text-2xl tracking-[0.3em]" aria-live="polite">
            {linkCode ? `${linkCode.slice(0, 3)} ${linkCode.slice(3)}` : "…"}
          </p>
        </>
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => setConfirmFresh(true)}
      >
        No access to your other browsers?
      </button>
      <ConfirmDialog
        open={confirmFresh}
        onOpenChange={setConfirmFresh}
        title="Start fresh on this browser?"
        description="You'll get a new encryption key. Your old messages can no longer be read, and your other browsers will need to be linked again."
        confirmText="Start fresh"
        variant="destructive"
        onConfirm={onStartFresh}
      />
    </div>
  );
}
