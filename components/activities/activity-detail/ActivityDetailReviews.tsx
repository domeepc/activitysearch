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
}

export function ActivityDetailReviews({ reviews }: ActivityDetailReviewsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-zinc-900">Recent reviews</h3>
      {reviews === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-zinc-400">No reviews yet</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r._id}
              className="flex gap-3 rounded-xl bg-zinc-50 p-4"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={r.user?.avatar} />
                <AvatarFallback className="text-sm">
                  {r.user?.name?.[0] ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900">
                    {r.user?.name && r.user?.lastname
                      ? `${r.user.name} ${r.user.lastname}`
                      : "Anonymous"}
                  </span>
                  {r.rating != null ? (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-medium text-zinc-700">
                        {r.rating.toFixed(1)}
                      </span>
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-zinc-500">{r.text}</p>
                {r._creationTime != null ? (
                  <p className="text-xs text-zinc-400">
                    {formatDistanceToNow(r._creationTime, { addSuffix: true })}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
