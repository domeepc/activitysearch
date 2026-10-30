"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { Calendar, Clock, MapPin, Star, X } from "lucide-react";
import { api as convexApi } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ReservationDialog } from "@/components/activities/ReservationDialog";
import { useMyTeamsAsCreator } from "@/lib/hooks/useReservations";
import { getDifficultyColorScheme, getTagColorScheme } from "@/lib/tagColors";
import { cn, formatDuration, formatPrice } from "@/lib/utils";

interface ActivityCardProps {
  activity: {
    id: string;
    title: string;
    description: string;
    category: string;
    tags?: string[];
    location?: {
      address: string;
    };
    address?: string;
    price: {
      amount: number;
      currency: string;
      type: string;
    };
    duration: string;
    difficulty: string;
    rating: number;
    reviewCount: number;
    images?: string[];
  };
  onClose?: () => void;
  isExpanded?: boolean;
}

/** The card that pops up over a map pin. */
export default function ActivityCard({ activity, onClose, isExpanded = false }: ActivityCardProps) {
  const address = activity.address || activity.location?.address;
  const images = activity.images ?? [];
  const tags = activity.tags?.length ? activity.tags : activity.category ? [activity.category] : [];
  const databaseTags = useQuery(convexApi.activity.getAllTags);
  const { hasTeams } = useMyTeamsAsCreator();
  const isOrganiserOfActivity =
    useQuery(convexApi.activity.isOrganiserOfActivity, {
      activityId: activity.id as Id<"activities">,
    }) ?? false;
  const [reserveOpen, setReserveOpen] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const duration = formatDuration(Number(activity.duration) || 0);
  const level = getDifficultyColorScheme(activity.difficulty);
  const canReserve = hasTeams && !isOrganiserOfActivity;
  const detailsHref = `/activities/${activity.id}`;

  return (
    <article
      aria-label={activity.title}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-[20px] border border-zinc-200 bg-white text-zinc-900 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
        isExpanded ? "w-80" : "w-64"
      )}
    >
      <div className="relative h-40 bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-zinc-800 dark:to-zinc-900">
        {images.length > 0 && !photoFailed && (
          <Image
            key={images[photo]}
            src={images[photo]}
            alt=""
            fill
            sizes="320px"
            className="object-cover animate-in fade-in-0 duration-300"
            onError={() => setPhotoFailed(true)}
          />
        )}
        {activity.reviewCount > 0 && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-zinc-900 shadow-sm">
            <Star className="size-3 fill-amber-500 text-amber-500" aria-hidden="true" />
            {activity.rating.toFixed(1)}
            <span className="font-normal text-zinc-600">({activity.reviewCount})</span>
          </span>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="absolute right-2.5 top-2.5 inline-flex size-8 items-center justify-center rounded-full bg-white/95 text-zinc-700 shadow-sm transition-colors hover:bg-white hover:text-zinc-900"
        >
          <X className="size-4" />
        </button>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {images.slice(0, 6).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === photo}
                onClick={() => {
                  setPhoto(i);
                  setPhotoFailed(false);
                }}
                className={cn(
                  "h-1.5 rounded-full bg-white shadow transition-all",
                  i === photo ? "w-4" : "w-1.5 opacity-60 hover:opacity-90"
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 p-3.5">
        <div>
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight">{activity.title}</h3>
          {address && (
            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{address}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <Clock className="size-3" aria-hidden="true" />
              {duration}
            </span>
          )}
          {activity.difficulty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: level.textHex }} aria-hidden="true" />
              {activity.difficulty}
            </span>
          )}
          {tags.slice(0, 2).map((tag) => {
            const c = getTagColorScheme(tag, databaseTags);
            return (
              <span key={tag} className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: c.bgHex, color: c.textHex }}>
                {tag}
              </span>
            );
          })}
        </div>

        <div className="mt-1 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="flex-1 text-xs leading-tight text-zinc-600 dark:text-zinc-400">
            From
            <b className="block text-base text-zinc-900 dark:text-zinc-50">
              {formatPrice(activity.price.amount)}
              <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400"> / person</span>
            </b>
          </p>
          <Button asChild variant="outline" className="h-9 px-3">
            <Link href={detailsHref}>Details</Link>
          </Button>
          {canReserve && (
            <Button className="h-9 bg-blue-600 px-3 font-semibold text-white hover:bg-blue-700" onClick={() => setReserveOpen(true)}>
              <Calendar /> Reserve
            </Button>
          )}
        </div>
      </div>

      {canReserve && (
        <ReservationDialog
          activityId={activity.id as Id<"activities">}
          open={reserveOpen}
          onOpenChange={setReserveOpen}
        />
      )}
    </article>
  );
}
