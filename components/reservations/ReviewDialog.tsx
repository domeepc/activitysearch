"use client";

import { useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: Id<"activities">;
  activityName: string;
  activityImage?: string;
  onSuccess: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  activityId,
  activityName,
  activityImage,
  onSuccess,
}: ReviewDialogProps) {
  const posthog = usePostHog();
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [hoverRating, setHoverRating] = useState<number | undefined>(undefined);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createReview = useMutation(api.reviews.createReview);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!text.trim()) {
      setError("Please write a short review.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createReview({
        activityId,
        text: text.trim(),
        rating,
      });
      posthog?.capture("review_submitted", {
        activity_id: String(activityId),
        activity_name: activityName,
        rating,
      });
      setText("");
      setRating(undefined);
      setHoverRating(undefined);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setText("");
      setRating(undefined);
      setHoverRating(undefined);
      setError(null);
    }
    onOpenChange(next);
  };

  const displayRating = hoverRating ?? rating ?? 0;
  const ratingWord = ["Tap a star to rate (optional)", "Not great", "Okay", "Good", "Great", "Loved it"][displayRating];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <span className="size-13 shrink-0 overflow-hidden rounded-xl bg-blue-100 dark:bg-zinc-800">
            {activityImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activityImage} alt="" className="size-full object-cover" />
            )}
          </span>
          <div className="min-w-0">
            <DialogTitle>How was it?</DialogTitle>
            <DialogDescription className="truncate">{activityName}</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div
              role="radiogroup"
              aria-label="Rating"
              className="flex gap-2"
              onMouseLeave={() => setHoverRating(undefined)}
            >
              {[1, 2, 3, 4, 5].map((v) => {
                const on = displayRating >= v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={rating === v}
                    aria-label={`${v} star${v > 1 ? "s" : ""}`}
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    )}
                    onMouseEnter={() => setHoverRating(v)}
                    onClick={() => setRating(rating === v ? undefined : v)}
                  >
                    <Star
                      className={cn(
                        "size-[22px] transition-transform",
                        on ? "scale-105 fill-amber-500 text-amber-500" : "text-zinc-400"
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-[13px] text-zinc-600 dark:text-zinc-400" aria-live="polite">
              {ratingWord}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-text">Tell others about it</Label>
            <Textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What stood out? Would you recommend it?"
              rows={3}
              className="resize-none"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 font-semibold" disabled={!text.trim() || isSubmitting}>
            {isSubmitting ? "Posting…" : "Post review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
