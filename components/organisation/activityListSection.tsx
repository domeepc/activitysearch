"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { mapActivityFromDb } from "@/lib/activities";
import ActivityCardInList from "./activityCardInList";

interface ActivityListSectionProps {
  activityIDs: Id<"activities">[];
}

export default function ActivityListSection({
  activityIDs,
}: ActivityListSectionProps) {
  const router = useRouter();

  // Fetch activities by their IDs
  const activitiesFromDb = useQuery(
    api.activity.getActivitiesByIds,
    activityIDs.length > 0 ? { activityIds: activityIDs } : "skip"
  );

  // Map activities to the frontend format
  const activities = useMemo(() => {
    if (!activitiesFromDb) return [];
    return activitiesFromDb.map((doc) => mapActivityFromDb(doc));
  }, [activitiesFromDb]);

  // Handle click on card - navigate to activity page
  const handleCardClick = (activityId: string) => {
    router.push(`/activities/${activityId}`);
  };

  // If no activity IDs, show empty state immediately
  if (activityIDs.length === 0) {
    return (
      <Card>
        <CardContent>
          <CardHeader className="text-2xl font-bold">Activities</CardHeader>
          <div className="text-center py-8 text-muted-foreground">
            <p>No activities found.</p>
            <p className="text-sm mt-2">
              Create your first activity to get started!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (activitiesFromDb === undefined) {
    return (
      <Card>
        <CardContent>
          <CardHeader className="text-2xl font-bold">Activities</CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="w-full">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <CardHeader className="text-2xl font-bold">Activities</CardHeader>
        <div className="flex flex-row flex-wrap gap-6">
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
                isExpanded={true}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
