"use client";

import { use, useEffect, useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { usePostHog } from "@posthog/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ReservationDialog } from "@/components/activities/ReservationDialog";
import DialogAddActivity from "@/components/activities/DialogAddActivity";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Package,
  Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getTagColorScheme, getDifficultyColorScheme } from "@/lib/tagColors";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

export default function ActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const activityId = resolvedParams.slug as Id<"activities">;
  const posthog = usePostHog();

  const activity = useQuery(api.activity.getActivityById, {
    activityId,
  });

  // Fetch all unique tags from database for color assignment
  const databaseTags = useQuery(api.activity.getAllTags);

  // Check if user has teams as creator
  const { hasTeams } = useMyTeamsAsCreator();
  const isOrganiserOfActivity =
    useQuery(api.activity.isOrganiserOfActivity, { activityId }) ?? false;
  const recentReviews = useQuery(
    api.reviews.getRecentReviewsForActivity,
    activity ? { activityId } : "skip"
  );
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const imageCount = (activity?.images ?? []).length;
  const hasTrackedView = useRef(false);

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
    if (activity === null) {
      // Activity not found, redirect after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    }
  }, [activity, router]);

  if (activity === undefined) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-6xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-64 w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activity === null) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h2 className="text-2xl font-semibold mb-2">Activity Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The activity you&apos;re looking for doesn&apos;t exist or has
              been removed.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to home page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Map database activity to display format
  const displayActivity = {
    id: String(activity._id),
    title: activity.activityName || "",
    description: activity.description || "",
    category:
      (activity.tags && activity.tags.length > 0 && activity.tags[0]) || "",
    address: activity.address || "",
    price: {
      amount: activity.price || 0,
      currency: "€",
      type: "",
    },
    duration: activity.duration ? String(activity.duration) : "N/A",
    difficulty: activity.difficulty || "N/A",
    rating: activity.rating || 0,
    reviewCount: activity.reviewCount || 0,
    images: activity.images || [],
    tags: activity.tags || [],
    equipment: activity.equipment || [],
    maxParticipants: activity.maxParticipants,
    minAge: activity.minAge,
    coordinates: {
      lat: activity.latitude,
      lng: activity.longitude,
    },
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <Card className="pt-0! border-2 border-border shadow-xl">
        {/* Image Gallery */}
        {displayActivity.images && displayActivity.images.length > 0 ? (
          <div className="relative w-full px-4 pt-4 pb-4">
            <div className="relative w-full mx-auto h-[300px] md:h-[350px] rounded-xl overflow-hidden">
              <Carousel
                setApi={setCarouselApi}
                noManualControl
                className="w-full h-full"
                opts={{
                  align: "start",
                  slidesToScroll: 1,
                }}
              >
                <CarouselContent className="h-full ml-0!">
                  {displayActivity.images.map((image, index) => (
                    <CarouselItem
                      key={index}
                      className="h-full pl-0 pr-2 basis-1/2 md:basis-1/3"
                    >
                      <div className="relative w-full h-full rounded-lg overflow-hidden">
                        <Image
                          src={image}
                          alt={`${displayActivity.title} - Image ${index + 1}`}
                          fill
                          className="object-cover"
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (
                              parent &&
                              !parent.querySelector(".error-message")
                            ) {
                              const errorDiv = document.createElement("div");
                              errorDiv.className =
                                "w-full h-full bg-muted flex items-center justify-center error-message";
                              errorDiv.innerHTML =
                                '<p class="text-muted-foreground">Image not available</p>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>
          </div>
        ) : (
          <div className="w-full px-4 md:px-8 pt-6 pb-4">
            <div className="w-full max-w-4xl mx-auto h-[300px] md:h-[350px] bg-muted flex items-center justify-center rounded-xl">
              <p className="text-muted-foreground">No image available</p>
            </div>
          </div>
        )}

        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl md:text-3xl mb-2">
                {displayActivity.title}
              </CardTitle>
              <CardDescription className="text-base">
                {displayActivity.description}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3">
              {/* Rating */}
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <span className="text-lg font-semibold">
                  {displayActivity.rating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({displayActivity.reviewCount}{" "}
                  {displayActivity.reviewCount === 1 ? "review" : "reviews"})
                </span>
              </div>
              {/* Reservation Button */}
              {hasTeams && !isOrganiserOfActivity && (
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
                  <Calendar className="h-4 w-4 mr-2" />
                  Reserve Activity
                </Button>
              )}
              {/* Edit Button (organiser only) */}
              {isOrganiserOfActivity && (
                <Button
                  onClick={() => setEditDialogOpen(true)}
                  variant="outline"
                  className="w-full md:w-auto border-border"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Activity
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Tags */}
          {displayActivity.tags && displayActivity.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayActivity.tags.map((tag, index) => {
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
          )}

          <Separator />

          {/* Key Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayActivity.address && (
              <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-border ">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">
                    {displayActivity.address}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-border ">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Duration</p>
                <p className="text-sm text-muted-foreground">
                  {displayActivity.duration}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-border  ">
              <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Difficulty</p>
                {(() => {
                  const difficultyColorScheme = getDifficultyColorScheme(
                    displayActivity.difficulty
                  );
                  return (
                    <Badge
                      variant="secondary"
                      className="capitalize mt-1"
                      style={{
                        backgroundColor: difficultyColorScheme.bgHex,
                        color: difficultyColorScheme.textHex,
                        borderColor: difficultyColorScheme.bgHex,
                      }}
                    >
                      {displayActivity.difficulty}
                    </Badge>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-border  ">
              <DollarSign className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Price</p>
                <p className="text-sm font-semibold text-green-600">
                  {displayActivity.price.amount}{" "}
                  {displayActivity.price.currency}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          {(displayActivity.maxParticipants ||
            displayActivity.minAge ||
            displayActivity.equipment.length > 0) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Additional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayActivity.maxParticipants && (
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Max Participants</p>
                          <p className="text-sm text-muted-foreground">
                            {displayActivity.maxParticipants} people
                          </p>
                        </div>
                      </div>
                    )}

                    {displayActivity.minAge && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Minimum Age</p>
                          <p className="text-sm text-muted-foreground">
                            {displayActivity.minAge} years
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {displayActivity.equipment.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm font-medium">Required Equipment</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {displayActivity.equipment.map((item, index) => (
                          <Badge key={index} variant="outline">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          {/* Additional Images */}
          {displayActivity.images && displayActivity.images.length >= 3 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">More Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {displayActivity.images.slice(1).map((image, index) => (
                    <div
                      key={index}
                      className="relative w-full h-48 overflow-hidden rounded-lg"
                    >
                      <Image
                        src={image}
                        alt={`${displayActivity.title} - Image ${index + 2}`}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Recent reviews */}
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Recent reviews</h3>
            {recentReviews === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ) : (recentReviews ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {(recentReviews ?? []).map((r) => (
                  <div
                    key={r._id}
                    className="flex gap-3 p-4 rounded-lg border-2 border-border"
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={r.user?.avatar} />
                      <AvatarFallback className="text-sm">
                        {r.user?.name?.[0] ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {r.user?.name && r.user?.lastname
                            ? `${r.user.name} ${r.user.lastname}`
                            : "Anonymous"}
                        </span>
                        {r.rating != null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm">{r.rating.toFixed(1)}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{r.text}</p>
                      {r._creationTime != null && (
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(r._creationTime, {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        {/* Reservation Dialog */}
        {hasTeams && !isOrganiserOfActivity && (
          <ReservationDialog
            activityId={activityId}
            open={isReservationDialogOpen}
            onOpenChange={setIsReservationDialogOpen}
          />
        )}

        {/* Edit Activity Dialog */}
        {isOrganiserOfActivity && (
          <DialogAddActivity
            showDialog={editDialogOpen}
            setShowDialog={setEditDialogOpen}
            activityId={activityId}
          />
        )}
      </Card>
    </div>
  );
}
