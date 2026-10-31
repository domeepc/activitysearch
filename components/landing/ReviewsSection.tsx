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
                aria-hidden={i >= items.length}
                // Spacing inside each item (not gap) so the loop seam lines up exactly
                className={`w-[85vw] shrink-0 pr-3 sm:w-[372px] ${i >= items.length ? "motion-reduce:hidden" : ""}`}
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
  return (
    <article className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex min-w-0 flex-col gap-4">
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
        {/* Break unspaced words inside the card; long reviews stop at 6 lines so cards stay even */}
        <blockquote
          title={review.text}
          className="line-clamp-6 text-[17px] leading-relaxed text-zinc-200 [overflow-wrap:anywhere]"
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
          <span className="block truncate text-sm font-semibold text-zinc-50">{review.author}</span>
          {review.activityName && (
            <span className="block truncate text-[13px] text-zinc-400">{review.activityName}</span>
          )}
        </span>
      </div>
    </article>
  );
}
