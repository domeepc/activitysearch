import Image from "next/image";
import Link from "next/link";
import { getTagColorScheme } from "@/lib/tagColors";
import { formatDuration, formatPrice } from "@/lib/utils";
import { Clock, MapPin, Pencil, Star } from "lucide-react";
import { api as convexApi } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

interface ActivityCardProps {
  activity: {
    id: string;
    title: string;
    description: string;
    category: string;
    tags?: string[];
    location?: { address: string };
    address?: string;
    price: { amount: number; currency: string; type: string };
    duration: string;
    difficulty: string;
    rating: number;
    reviewCount: number;
    images?: string[];
  };
  onClose?: () => void;
  onEdit?: (activityId: string) => void;
}

export default function ActivityCardInList({ activity, onEdit }: ActivityCardProps) {
  const tag = activity.tags?.[0] ?? activity.category;
  const databaseTags = useQuery(convexApi.activity.getAllTags);
  const tagColors = tag ? getTagColorScheme(tag, databaseTags) : null;
  const address = activity.address ?? activity.location?.address;
  const duration = formatDuration(Number(activity.duration));

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="relative aspect-[16/10] w-full bg-zinc-100 dark:bg-zinc-800">
        {activity.images && activity.images.length > 0 ? (
          <Image src={activity.images[0]} alt="" fill sizes="(min-width: 768px) 320px, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
        {tag && tagColors && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold capitalize shadow-sm"
            style={{ backgroundColor: tagColors.bgHex, color: tagColors.textHex }}
          >
            {tag}
          </span>
        )}
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit ${activity.title}`}
            onClick={() => onEdit(activity.id)}
            className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-white/95 text-zinc-700 shadow-sm transition-colors hover:bg-white hover:text-zinc-900"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
          {/* Stretched link: the whole card opens the activity, the edit button sits above it. */}
          <Link href={`/activities/${activity.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
            {activity.title}
          </Link>
        </h3>
        {address && (
          <p className="flex items-center gap-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{address}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-3">
          {activity.rating > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              <b className="font-semibold text-zinc-900 dark:text-zinc-50">{activity.rating.toFixed(1)}</b>
              <span>({activity.reviewCount})</span>
            </span>
          ) : (
            <span>No reviews yet</span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {duration}
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatPrice(activity.price.amount)}
        </span>
      </div>
    </article>
  );
}
