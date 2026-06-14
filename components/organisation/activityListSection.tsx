"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { mapActivityFromDb } from "@/lib/activities";
import ActivityCardInList from "./activityCardInList";
import { LayoutGrid } from "lucide-react";

interface ActivityListSectionProps {
  activityIDs: Id<"activities">[];
  onEdit?: (activityId: string) => void;
}

export default function ActivityListSection({ activityIDs, onEdit }: ActivityListSectionProps) {
  const router = useRouter();

  const activitiesFromDb = useQuery(
    api.activity.getActivitiesByIds,
    activityIDs.length > 0 ? { activityIds: activityIDs } : "skip"
  );

  const activities = useMemo(() => {
    if (!activitiesFromDb) return [];
    return activitiesFromDb.map((doc) => mapActivityFromDb(doc));
  }, [activitiesFromDb]);

  const handleCardClick = (activityId: string) => router.push(`/activities/${activityId}`);

  if (activityIDs.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 md:px-6">
          <LayoutGrid className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Activities</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center px-5">
          <LayoutGrid className="h-10 w-10 text-zinc-200 dark:text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No activities yet.</p>
          <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">Create your first activity to get started.</p>
        </div>
      </div>
    );
  }

  if (activitiesFromDb === undefined) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 md:px-6">
          <LayoutGrid className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Activities</h2>
        </div>
        <div className="flex flex-row flex-wrap gap-4 p-5 md:p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-64 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 md:px-6">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Activities</h2>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{activities.length} total</span>
      </div>
      <div className="flex flex-row flex-wrap gap-4 p-5 md:p-6">
        {activities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => handleCardClick(activity.id)}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <ActivityCardInList
              activity={{
                id: activity.id,
                title: activity.title,
                description: activity.description,
                category: activity.category,
                tags: activity.tags,
                location: activity.location,
                address: activity.location.address,
                price: activity.price,
                duration: activity.duration,
                difficulty: activity.difficulty,
                rating: activity.rating,
                reviewCount: activity.reviewCount,
                images: activity.images,
              }}
              onEdit={onEdit}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
