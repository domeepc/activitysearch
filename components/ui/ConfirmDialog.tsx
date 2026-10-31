"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/lib/errors";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** What will happen, shown as a checklist so the user knows exactly what they lose */
  consequences?: string[];
  icon?: LucideIcon;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => unknown;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  icon: Icon = AlertCircle,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destructive = variant === "destructive";

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return; // don't let a click outside hide a running action
    if (!next) setError(null);
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 sm:max-w-md">
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-xl",
            destructive
              ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
              : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {consequences && consequences.length > 0 && (
          <ul className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {consequences.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-2 size-1.5 shrink-0 rounded-full",
                    destructive ? "bg-red-500" : "bg-blue-500"
                  )}
                />
                {item}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={isLoading}
            className="h-10 font-semibold"
          >
            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isLoading ? "Working…" : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
