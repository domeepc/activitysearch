import { formatDistanceToNow } from "date-fns";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export type ActivityReviewItem = {
  _id: string;
  text: string;
  rating?: number | null;
  _creationTime?: number;
  user: {
    name: string;
    lastname: string;
    avatar: string;
  } | null;
};

interface ActivityDetailReviewsProps {
  reviews: ActivityReviewItem[] | undefined;
  rating: number;
  reviewCount: number;
}

export function ActivityDetailReviews({ reviews, rating, reviewCount }: ActivityDetailReviewsProps) {
  return (
    <section aria-labelledby="reviews-h" className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 id="reviews-h" className="text-xl font-bold tracking-tight">Reviews</h2>
        {reviewCount > 0 && (
          <span className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden="true" />
            <b className="text-zinc-900 dark:text-zinc-50">{rating.toFixed(1)}</b> · {reviewCount}{" "}
            {reviewCount === 1 ? "review" : "reviews"}
          </span>
        )}
      </div>
      {reviews === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No reviews yet — book it with your team and be the first to share how it went.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reviews.map((r) => {
            const name = r.user ? `${r.user.name} ${r.user.lastname}`.trim() : "Former guest";
            return (
              <li key={r._id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={r.user?.avatar} alt="" />
                    <AvatarFallback className="text-xs font-bold">{name[0] ?? "?"}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{name}</b>
                    {r._creationTime != null && (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {formatDistanceToNow(r._creationTime, { addSuffix: true })}
                      </span>
                    )}
                  </span>
                  {r.rating != null && (
                    <span className="flex gap-1" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={n <= Math.round(r.rating!) ? "size-3.5 fill-amber-500 text-amber-500" : "size-3.5 text-zinc-300 dark:text-zinc-600"}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{r.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
