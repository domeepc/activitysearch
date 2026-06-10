import Image from "next/image";
import { getTagColorScheme } from "@/lib/tagColors";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Pencil, Star } from "lucide-react";
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
  const allTags =
    activity.tags && activity.tags.length > 0
      ? activity.tags
      : activity.category
        ? [activity.category]
        : [];

  const databaseTags = useQuery(convexApi.activity.getAllTags);

  return (
    <div className="w-64 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative h-40 w-full bg-zinc-100">
        {activity.images && activity.images.length > 0 ? (
          <Image
            src={activity.images[0]}
            alt={activity.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-zinc-400">No image</span>
          </div>
        )}
        {/* Price badge on image */}
        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
          {activity.price.amount} {activity.price.currency}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold text-zinc-900 leading-tight">
            {activity.title}
          </h3>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-zinc-400 hover:text-zinc-700"
              aria-label="Edit activity"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(activity.id);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {activity.rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-medium text-zinc-700">{activity.rating.toFixed(1)}</span>
            <span>({activity.reviewCount})</span>
          </div>
        )}

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 3).map((tag, index) => {
              const colorScheme = getTagColorScheme(tag, databaseTags);
              return (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0.5"
                  style={{
                    backgroundColor: colorScheme.bgHex,
                    color: colorScheme.textHex,
                    borderColor: colorScheme.bgHex,
                  }}
                >
                  {tag}
                </Badge>
              );
            })}
            {allTags.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                +{allTags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
