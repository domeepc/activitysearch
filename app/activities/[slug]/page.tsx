"use client";

import { use, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { capture } from "@/lib/posthog";
import { Button } from "@/components/ui/button";
import { ReservationDialog } from "@/components/activities/ReservationDialog";
import DialogAddActivity from "@/components/activities/DialogAddActivity";
import { ActivityQuestsPublicSection } from "@/components/activities/ActivityQuestsPublicSection";
import { OrganiserQuestsSection } from "@/components/activities/OrganiserQuestsSection";
import { ActivityDetailSkeleton } from "@/components/activities/activity-detail/ActivityDetailSkeleton";
import { ActivityDetailNotFound } from "@/components/activities/activity-detail/ActivityDetailNotFound";
import { ActivityDetailGallery } from "@/components/activities/activity-detail/ActivityDetailGallery";
import { ActivityDetailFacts } from "@/components/activities/activity-detail/ActivityDetailFacts";
import { ActivityDetailReviews } from "@/components/activities/activity-detail/ActivityDetailReviews";
import { useMyTeamsAsCreator } from "@/lib/hooks/useReservations";
import { ArrowLeft, Calendar, Check, MapPin, Package, Pencil, Star } from "lucide-react";
import Link from "next/link";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import { getTagColorScheme } from "@/lib/tagColors";
import { cn, formatPrice } from "@/lib/utils";

export default function ActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const activityId = resolvedParams.slug as Id<"activities">;

  const activity = useQuery(api.activity.getActivityById, { activityId });
  const databaseTags = useQuery(api.activity.getAllTags);
  const { hasTeams } = useMyTeamsAsCreator();
  const isOrganiserOfActivity =
    useQuery(api.activity.isOrganiserOfActivity, { activityId }) ?? false;
  const recentReviews = useQuery(
    api.reviews.getRecentReviewsForActivity,
    activity ? { activityId } : "skip"
  );

  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const hasTrackedView = useRef(false);

  const images = activity?.images ?? [];

  useEffect(() => {
    if (activity && !hasTrackedView.current) {
      hasTrackedView.current = true;
      capture("activity_viewed", {
        activity_id: String(activity._id),
        activity_name: activity.activityName,
      });
    }
  }, [activity]);

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
  const difficulty = activity.difficulty || "";
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
        capture("reserve_activity_clicked", {
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

  const section = "border-t border-zinc-200 pt-8 dark:border-zinc-800";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6 lg:pb-12">
      <Link
        href={SIGNED_IN_HOME_HREF}
        className="mb-3 inline-flex h-9 items-center gap-2 rounded-xl px-2 -ml-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Explore
      </Link>

      <ActivityDetailGallery images={images} title={title} />

      <div className="mt-6 flex flex-wrap items-start gap-x-10 gap-y-6 md:mt-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
          <header className="flex flex-col gap-3">
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const colorScheme = getTagColorScheme(tag, databaseTags);
                  return (
                    <span
                      key={tag}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: colorScheme.bgHex, color: colorScheme.textHex }}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight text-balance text-zinc-900 md:text-4xl dark:text-zinc-50">
              {title}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden="true" />
                {reviewCount > 0 ? (
                  <>
                    <b className="text-zinc-900 dark:text-zinc-50">{rating.toFixed(1)}</b>
                    <a href="#reviews-h" className="underline-offset-2 hover:underline">
                      ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                    </a>
                  </>
                ) : (
                  "New"
                )}
              </span>
              {address ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{address}</span>
                </span>
              ) : null}
            </p>
          </header>

          <ActivityDetailFacts
            durationMinutes={Number(activity.duration ?? 0)}
            difficulty={difficulty}
            maxParticipants={Number(activity.maxParticipants ?? 0)}
            minAge={Number(activity.minAge ?? 0)}
          />

          {description ? (
            <section aria-labelledby="about-h" className="flex flex-col gap-3">
              <h2 id="about-h" className="text-xl font-bold tracking-tight">About this activity</h2>
              <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                {description}
              </p>
            </section>
          ) : null}

          {equipment.length > 0 ? (
            <section aria-labelledby="bring-h" className={cn(section, "flex flex-col gap-3")}>
              <h2 id="bring-h" className="text-xl font-bold tracking-tight">What to bring</h2>
              <ul className="flex flex-wrap gap-2">
                {equipment.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <Package className="size-3.5 text-zinc-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ActivityQuestsPublicSection activityId={activityId} isOrganiser={isOrganiserOfActivity} />

          <div className={section}>
            <ActivityDetailReviews reviews={recentReviews} rating={rating} reviewCount={reviewCount} />
          </div>

          {isOrganiserOfActivity ? (
            <div className={section}>
              <OrganiserQuestsSection activityId={activityId} />
            </div>
          ) : null}
        </div>

        <aside
          aria-label="Booking"
          className="hidden min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.18)] lg:sticky lg:top-[calc(var(--app-navbar-height)+1.5rem)] lg:flex dark:border-zinc-700 dark:bg-zinc-900"
        >
          {activity.price ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Price
              <span className="block text-[28px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                {formatPrice(activity.price)}
                <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400"> per booking</span>
              </span>
            </p>
          ) : null}
          {bookingAction}
          <ul className="flex flex-col gap-3 text-[13px] text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span><b className="text-zinc-900 dark:text-zinc-50">Split the bill</b> — the price is shared, each teammate pays their part</span>
            </li>
            <li className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span><b className="text-zinc-900 dark:text-zinc-50">Join the queue</b> if your date is already full</span>
            </li>
          </ul>
        </aside>
      </div>

      {/* Phone: keep the price and the main action in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-zinc-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        {activity.price ? (
          <p className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            <b className="text-lg text-zinc-900 dark:text-zinc-50">{formatPrice(activity.price)}</b> per booking
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <div className="w-auto max-w-[60%] shrink-0 [&_a]:w-auto [&_button]:w-auto">{bookingAction}</div>
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
