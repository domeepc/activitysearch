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
import { Badge } from "@/components/ui/badge";
import { Star, Calendar, Pencil, Check } from "lucide-react";
import Link from "next/link";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import { getTagColorScheme } from "@/lib/tagColors";
import { formatPrice } from "@/lib/utils";
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

  const bookingAction = isOrganiserOfActivity ? (
    <Button
      onClick={() => setEditDialogOpen(true)}
      variant="outline"
      size="lg"
      className="w-full rounded-xl"
    >
      <Pencil className="mr-2 h-4 w-4" />
      Edit activity
    </Button>
  ) : hasTeams ? (
    <Button
      size="lg"
      onClick={() => {
        posthog?.capture("reserve_activity_clicked", {
          activity_id: String(activityId),
          activity_name: activity.activityName,
        });
        setIsReservationDialogOpen(true);
      }}
      className="w-full rounded-xl bg-blue-600 hover:bg-blue-500"
    >
      <Calendar className="mr-2 h-4 w-4" />
      Reserve
    </Button>
  ) : (
    <Button asChild size="lg" variant="outline" className="w-full rounded-xl">
      <Link href="/chat">Create a team to reserve</Link>
    </Button>
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pt-8 lg:pb-8">
      <ActivityDetailGallery
        images={images}
        title={title}
        setCarouselApi={setCarouselApi}
      />

      <div className="mt-6 flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-7">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
            ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
            {address ? <span className="truncate">· {address}</span> : null}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            {description}
          </p>

          {/* Tags */}
          {tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
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

          <div className="my-7 h-px bg-zinc-100 dark:bg-zinc-800" />

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

          <div className="my-7 h-px bg-zinc-100 dark:bg-zinc-800" />

          <ActivityQuestsPublicSection
            activityId={activityId}
            isOrganiser={isOrganiserOfActivity}
          />

          <div className="my-7 h-px bg-zinc-100 dark:bg-zinc-800" />

          <ActivityDetailReviews reviews={recentReviews} />

          {isOrganiserOfActivity ? (
            <>
              <div className="my-7 h-px bg-zinc-100 dark:bg-zinc-800" />
              <OrganiserQuestsSection activityId={activityId} />
            </>
          ) : null}

        </div>

        <aside
          aria-label="Booking"
          className="hidden min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.18)] lg:sticky lg:top-[calc(var(--app-navbar-height)+1.5rem)] lg:flex dark:border-zinc-700 dark:bg-zinc-900"
        >
          {activity.price ? (
            <p className="text-sm text-muted-foreground">
              From
              <span className="block text-[28px] font-bold leading-tight tracking-tight text-foreground">
                {formatPrice(activity.price)}
                <span className="text-sm font-normal text-muted-foreground"> / person</span>
              </span>
            </p>
          ) : null}
          {bookingAction}
          <ul className="flex flex-col gap-2.5 text-[13px] text-muted-foreground">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span><b className="text-foreground">Split the bill</b> — each teammate pays their own share</span>
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span><b className="text-foreground">Join the queue</b> if your date is already full</span>
            </li>
          </ul>
        </aside>
      </div>

      {/* Phone: keep the price and the main action in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        {activity.price ? (
          <p className="flex-1 text-sm text-muted-foreground">
            From <b className="text-lg text-foreground">{formatPrice(activity.price)}</b> / person
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <div className="shrink-0">{bookingAction}</div>
      </div>

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
    </div>
  );
}
