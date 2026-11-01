import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accent, SectionHeading } from "./SectionHeading";

export interface ReviewItem {
  id: string;
  text: string;
  rating: number | null;
  author: string;
  avatar: string;
  activityName: string;
  /** Missing when the activity was deleted, or in cached responses that predate it */
  activityId?: string;
}

/** Recent reviews from people who attended. Hidden until there are real ones (no made-up quotes). */
export function ReviewsSection({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return null;
  const marquee = items.length > 1;
  // Each half must be wider than the screen for a seamless loop: repeat short lists up to 6+ cards
  const half = Array.from({ length: Math.ceil(6 / items.length) }, () => items).flat();

  return (
    <section aria-labelledby="reviews-h" className="mx-auto w-full max-w-[1440px] px-4 pt-28 md:px-10">
      <SectionHeading
        id="reviews-h"
        index="04"
        eyebrow="Reviews"
        title={<>Straight from the <Accent>people who went</Accent>.</>}
        description="Only people who attended a paid booking can leave a review."
      />
      {marquee ? (
        // Auto-scrolls like the hero ticker: two copies slide by half their width; pauses on hover/focus.
        // Reduced motion: no animation, the duplicates hide and the row scrolls by hand.
        <div
          tabIndex={0}
          aria-label="Reviews"
          // Edges fade out instead of cutting cards off with a hard line
          className="group mt-7 overflow-hidden outline-none [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:overflow-x-auto"
        >
          <ul
            className="flex w-max motion-safe:animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
            style={{ animationDuration: `${half.length * 8}s` }}
          >
            {[...half, ...half].map((review, i) => (
              <li
                key={`${review.id}-${i}`}
                // Duplicates only fill the loop: skipped by keyboard and screen readers
                inert={i >= items.length}
                // Spacing inside each item (not gap) so the loop seam lines up exactly
                className={`w-[80vw] shrink-0 pr-3 sm:w-[340px] ${i >= items.length ? "motion-reduce:hidden" : ""}`}
              >
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-7 grid gap-3 md:grid-cols-3">
          {items.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const card = (
    <article className="flex h-60 flex-col justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        {review.rating !== null && (
          <span className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                aria-hidden="true"
                className={i < Math.round(review.rating!) ? "size-4 fill-amber-400 text-amber-400" : "size-4 text-zinc-700"}
              />
            ))}
          </span>
        )}
        {/* Fixed card height; long reviews end in an ellipsis after 4 lines */}
        <blockquote
          className="line-clamp-4 text-[0.9375rem] leading-relaxed text-zinc-200 [overflow-wrap:anywhere]"
        >
          “{review.text}”
        </blockquote>
      </div>
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarImage src={review.avatar} alt="" />
          <AvatarFallback name={review.author} />
        </Avatar>
        <span className="min-w-0">
          <span className="block text-sm [overflow-wrap:anywhere] font-semibold text-zinc-50">{review.author}</span>
          {review.activityName && (
            <span className="block text-[0.8125rem] [overflow-wrap:anywhere] text-zinc-400">{review.activityName}</span>
          )}
        </span>
      </div>
    </article>
  );
  // The text is clamped to 4 lines; the activity page shows the full review
  return review.activityId ? (
    <Link href={`/activities/${review.activityId}`} className="block rounded-3xl [&>article]:transition-colors [&>article]:hover:border-zinc-700">
      {card}
    </Link>
  ) : (
    card
  );
}
