"use client";

import { use, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { usePostHog } from "@posthog/react";
import { Button } from "@/components/ui/button";
import { ReservationDialog } from "@/components/activities/ReservationDialog";
import DialogAddActivity from "@/components/activities/DialogAddActivity";
import { ActivityQuestsPublicSection } from "@/components/activities/ActivityQuestsPublicSection";
import { OrganiserQuestsSection } from "@/components/activities/OrganiserQuestsSection";
import { ActivityDetailSkeleton } from "@/components/activities/activity-detail/ActivityDetailSkeleton";
import { ActivityDetailNotFound } from "@/components/activities/activity-detail/ActivityDetailNotFound";
import { ActivityDetailGallery } from "@/components/activities/activity-detail/ActivityDetailGallery";
import { ActivityDetailMetaGrid } from "@/components/activities/activity-detail/ActivityDetailMetaGrid";
import { ActivityDetailExtras } from "@/components/activities/activity-detail/ActivityDetailExtras";
import { ActivityDetailReviews } from "@/components/activities/activity-detail/ActivityDetailReviews";
import { useMyTeamsAsCreator } from "@/lib/hooks/useReservations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, Calendar, Pencil } from "lucide-react";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import { getTagColorScheme } from "@/lib/tagColors";
import type { CarouselApi } from "@/components/ui/carousel";

export default function ActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const activityId = resolvedParams.slug as Id<"activities">;
  const posthog = usePostHog();

  const activity = useQuery(api.activity.getActivityById, { activityId });
  const databaseTags = useQuery(api.activity.getAllTags);
  const { hasTeams } = useMyTeamsAsCreator();
  const isOrganiserOfActivity =
    useQuery(api.activity.isOrganiserOfActivity, { activityId }) ?? false;
  const recentReviews = useQuery(
    api.reviews.getRecentReviewsForActivity,
    activity ? { activityId } : "skip"
  );

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const hasTrackedView = useRef(false);

  const images = activity?.images ?? [];
  const imageCount = images.length;

  useEffect(() => {
    if (activity && !hasTrackedView.current) {
      hasTrackedView.current = true;
      posthog?.capture("activity_viewed", {
        activity_id: String(activity._id),
        activity_name: activity.activityName,
      });
    }
  }, [activity, posthog]);

  useEffect(() => {
    if (!carouselApi || imageCount < 2) return;
    intervalRef.current = setInterval(() => {
      carouselApi.scrollNext();
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [carouselApi, imageCount]);

  useEffect(() => {
    if (activity !== null) return;
    const t = setTimeout(() => {
      router.push(SIGNED_IN_HOME_HREF);
    }, 2000);
    return () => clearTimeout(t);
  }, [activity, router]);

  if (activity === undefined) {
    return <ActivityDetailSkeleton />;
  }

  if (activity === null) {
    return <ActivityDetailNotFound />;
  }

  const title = activity.activityName || "";
  const description = activity.description || "";
  const tags = activity.tags ?? [];
  const durationLabel = activity.duration ? String(activity.duration) : "N/A";
  const difficulty = activity.difficulty || "N/A";
  const rating = activity.rating ?? 0;
  const reviewCount = Number(activity.reviewCount ?? 0);
  const address = activity.address || "";
  const equipment = activity.equipment ?? [];

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6">
      <Card className="border-2 border-border pt-0! shadow-xl">
        <ActivityDetailGallery
          images={images}
          title={title}
          setCarouselApi={setCarouselApi}
        />

        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <CardTitle className="mb-2 text-2xl md:text-3xl">
                {title}
              </CardTitle>
              <CardDescription className="text-base">
                {description}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                <span className="text-lg font-semibold">
                  {rating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                </span>
              </div>
              {hasTeams && !isOrganiserOfActivity ? (
                <Button
                  onClick={() => {
                    posthog?.capture("reserve_activity_clicked", {
                      activity_id: String(activityId),
                      activity_name: activity.activityName,
                    });
                    setIsReservationDialogOpen(true);
                  }}
                  variant="secondary"
                  className="w-full md:w-auto"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Reserve Activity
                </Button>
              ) : null}
              {isOrganiserOfActivity ? (
                <Button
                  onClick={() => setEditDialogOpen(true)}
                  variant="outline"
                  className="w-full border-border md:w-auto"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Activity
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => {
                const colorScheme = getTagColorScheme(tag, databaseTags);
                return (
                  <Badge
                    key={index}
                    variant="secondary"
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
            </div>
          ) : null}

          <Separator />

          <ActivityDetailMetaGrid
            address={address}
            durationLabel={durationLabel}
            difficulty={difficulty}
            priceAmount={activity.price ?? 0}
          />

          <ActivityDetailExtras
            maxParticipants={activity.maxParticipants}
            minAge={activity.minAge}
            equipment={equipment}
          />

          <ActivityQuestsPublicSection
            activityId={activityId}
            isOrganiser={isOrganiserOfActivity}
          />

          <Separator />
          <ActivityDetailReviews reviews={recentReviews} />

          {isOrganiserOfActivity ? (
            <>
              <Separator />
              <OrganiserQuestsSection activityId={activityId} />
            </>
          ) : null}
        </CardContent>

        {hasTeams && !isOrganiserOfActivity ? (
          <ReservationDialog
            activityId={activityId}
            open={isReservationDialogOpen}
            onOpenChange={setIsReservationDialogOpen}
          />
        ) : null}

        {isOrganiserOfActivity ? (
          <DialogAddActivity
            showDialog={editDialogOpen}
            setShowDialog={setEditDialogOpen}
            activityId={activityId}
          />
        ) : null}
      </Card>
    </div>
  );
}
