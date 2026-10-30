"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Clock, Calendar } from "lucide-react";
import { getTagColorScheme, getDifficultyColorScheme } from "@/lib/tagColors";
import { formatPrice } from "@/lib/utils";
import { ReservationDialog } from "@/components/activities/ReservationDialog";
import { useMyTeamsAsCreator } from "@/lib/hooks/useReservations";
import { Id } from "@/convex/_generated/dataModel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

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

export default function ActivityCard({
  activity,
  onClose,
  isExpanded = false,
}: ActivityCardProps) {
  const router = useRouter();
  const address = activity.address || activity.location?.address;
  const images =
    activity.images && activity.images.length > 0 ? activity.images : [];
  const allTags =
    activity.tags && activity.tags.length > 0
      ? activity.tags
      : activity.category
        ? [activity.category]
        : [];

  // Fetch all unique tags from database for color assignment
  const databaseTags = useQuery(convexApi.activity.getAllTags);

  // Check if user has teams as creator
  const { hasTeams } = useMyTeamsAsCreator();
  const isOrganiserOfActivity =
    useQuery(convexApi.activity.isOrganiserOfActivity, {
      activityId: activity.id as Id<"activities">,
    }) ?? false;
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);

  // Carousel auto-rotation
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi || images.length <= 1) return;

    // Auto-rotate every 15 seconds
    intervalRef.current = setInterval(() => {
      if (carouselApi) {
        carouselApi.scrollNext();
      }
    }, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [carouselApi, images.length]);

  const handleVisitPage = () => {
    router.push(`/activities/${activity.id}`);
  };

  const handleClosePopup = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (onClose) {
      onClose();
    } else {
      // Fallback: find and close the Leaflet popup
      const popup = (e.target as HTMLElement)?.closest(".leaflet-popup");
      if (popup) {
        const fallback = popup.querySelector(
          ".leaflet-popup-close-button"
        ) as HTMLElement | null;
        if (fallback) {
          fallback.click();
        } else {
          popup.remove();
        }
      }
    }
  };

  const cardWidth = isExpanded ? "w-80" : "w-60";

  return (
    <Card
      className={`${cardWidth} relative border-2 border-border shadow-xl pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200`}
    >
      <button
        className="!absolute top-2 right-2 z-50 bg-background w-8 h-8 flex justify-center items-center rounded-full p-1.5 hover:bg-muted shadow-md focus:outline-none transition-colors pointer-events-auto cursor-pointer"
        onClick={handleClosePopup}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        aria-label="Close popup"
        tabIndex={0}
        type="button"
      >
        <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
          <path
            d="M6 6l8 8M14 6l-8 8"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </button>
      {images.length > 0 && (
        <div className="group/media z-0 w-full h-44 overflow-hidden rounded-t-xl -mt-6 mb-0 relative">
          <Carousel setApi={setCarouselApi} noManualControl className="w-full h-full">
            <CarouselContent className="h-full ml-0!">
              {images.map((image, index) => (
                <CarouselItem key={index} className="h-full pl-0 basis-full">
                  <div className="relative w-full h-full">
                    <Image
                      src={image}
                      alt={`${activity.title} - Image ${index + 1}`}
                      fill
                      className="object-cover z-0 transition-transform duration-500 ease-out motion-safe:group-hover/media:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          {images.length > 1 && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={`h-1.5 rounded-full bg-white shadow transition-all duration-300 ${
                    index === activeSlide ? "w-4 opacity-100" : "w-1.5 opacity-60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CardHeader className="px-4 pt-1 pb-2">
        <CardTitle className="text-base leading-tight line-clamp-2">
          {activity.title}
        </CardTitle>
        <div className="flex items-center gap-1 text-xs mt-1">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
          <span className="font-medium">{activity.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">
            ({activity.reviewCount}{" "}
            {activity.reviewCount === 1 ? "review" : "reviews"})
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        {/* Key facts on one line, scannable like marketplace listing cards */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="flex-1 line-clamp-1">{address}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{activity.duration}</span>
            <span aria-hidden>·</span>
            {(() => {
              const difficultyColorScheme = getDifficultyColorScheme(
                activity.difficulty
              );
              return (
                <Badge
                  variant="secondary"
                  className="capitalize text-xs px-1.5 py-0"
                  style={{
                    backgroundColor: difficultyColorScheme.bgHex,
                    color: difficultyColorScheme.textHex,
                    borderColor: difficultyColorScheme.bgHex,
                  }}
                >
                  {activity.difficulty}
                </Badge>
              );
            })()}
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.slice(0, 3).map((tag, index) => {
              const colorScheme = getTagColorScheme(tag, databaseTags);
              return (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs px-1.5 py-0.5"
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
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                +{allTags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <Separator className="my-2" />

        {/* Price + actions */}
        <div className="flex items-center gap-2">
          <div className="flex-1 leading-tight">
            <span className="block text-[10px] text-muted-foreground">From</span>
            <span className="text-sm font-bold text-foreground">
              {formatPrice(activity.price.amount)}
            </span>
          </div>
          {hasTeams && !isOrganiserOfActivity && (
            <Button
              onClick={() => setIsReservationDialogOpen(true)}
              className="h-8 w-8 p-0 border border-border transition-transform active:scale-95"
              variant="outline"
              size="icon"
              aria-label="Reserve activity"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={handleVisitPage}
            className="h-8 text-xs transition-transform active:scale-95"
            variant="default"
          >
            View details
          </Button>
        </div>
      </CardContent>

      {/* Reservation Dialog */}
      {hasTeams && !isOrganiserOfActivity && (
        <ReservationDialog
          activityId={activity.id as Id<"activities">}
          open={isReservationDialogOpen}
          onOpenChange={setIsReservationDialogOpen}
        />
      )}
    </Card>
  );
}
