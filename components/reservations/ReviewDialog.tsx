"use client";

import { useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  onSuccess: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  activityId,
  activityName,
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

  const displayRating = hoverRating ?? rating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave a review</DialogTitle>
          <DialogDescription>
            Share your experience for {activityName}. Your review will help
            others discover great activities.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Rating (optional)</Label>
            <div
              className="flex gap-1"
              onMouseLeave={() => setHoverRating(undefined)}
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-label={`${v} star${v > 1 ? "s" : ""}`}
                  className="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onMouseEnter={() => setHoverRating(v)}
                  onClick={() => setRating(v)}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      (displayRating ?? 0) >= v
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-text">
              Your review <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What did you enjoy? Would you recommend it?"
              className="min-h-[100px] resize-none"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim() || isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
