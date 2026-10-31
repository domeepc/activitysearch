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

  return (
    <section aria-labelledby="reviews-h" className="mx-auto w-full max-w-[1440px] px-4 pt-28 md:px-10">
      <SectionHeading
        id="reviews-h"
        index="04"
        eyebrow="Reviews"
        title={<>Straight from the <Accent>people who went</Accent>.</>}
        description="Only people who attended a paid booking can leave a review."
      />
      <ul className="mt-7 grid gap-3 md:grid-cols-3">
        {items.map((review) => (
          <li key={review.id} className="flex flex-col justify-between gap-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-col gap-4">
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
              <blockquote className="text-[17px] leading-relaxed text-zinc-200">“{review.text}”</blockquote>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
