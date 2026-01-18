"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Clock, DollarSign, Users } from "lucide-react";
import { getTagColorScheme, getDifficultyColorScheme } from "@/lib/tagColors";
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

  // Carousel auto-rotation
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!carouselApi || images.length <= 1) return;

    // Auto-rotate every 30 seconds
    intervalRef.current = setInterval(() => {
      if (carouselApi) {
        carouselApi.scrollNext();
      }
    }, 30000);

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
      className={`${cardWidth} relative border-0 shadow-none transition-all duration-200  pointer-events-auto`}
    >
      <button
        className="absolute! top-2 right-2 z-50 bg-white w-8 h-8 flex justify-center items-center rounded-full p-1.5 hover:bg-gray-100 shadow-md focus:outline-none transition-colors pointer-events-auto cursor-pointer"
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
            stroke="#333"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </button>
      {images.length > 0 && (
        <>
          <div className="z-0 w-full h-48 overflow-hidden rounded-t-xl -mt-6 mb-0 relative">
            <Carousel setApi={setCarouselApi} className="w-full h-full">
              <CarouselContent className="h-full ml-0!">
                {images.map((image, index) => (
                  <CarouselItem key={index} className="h-full pl-0 basis-full">
                    <div className="relative w-full h-full">
                      <Image
                        src={image}
                        alt={`${activity.title} - Image ${index + 1}`}
                        fill
                        className="object-cover z-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </>
      )}

      <CardHeader className="px-4 pt-1 pb-3">
        <CardTitle className="text-base leading-tight line-clamp-2">
          {activity.title}
        </CardTitle>
        <CardDescription className="text-xs line-clamp-2 mt-1">
          {activity.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
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

        {/* Activity Details */}
        <div className="space-y-1.5 text-xs">
          {address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground flex-1 line-clamp-1 text-xs">
                {address}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Duration:</span>
            <span className="font-medium text-xs">{activity.duration}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Difficulty:</span>
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

          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Price:</span>
            <span className="font-semibold text-green-600 text-xs">
              {activity.price.amount} {activity.price.currency}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
            <span className="font-medium text-xs">
              {activity.rating.toFixed(1)}
            </span>
            <span className="text-muted-foreground text-[10px]">
              ({activity.reviewCount}{" "}
              {activity.reviewCount === 1 ? "review" : "reviews"})
            </span>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Visit Button */}
        <Button
          onClick={handleVisitPage}
          className="w-full h-8 text-xs"
          variant="default"
        >
          Visit Activity Page
        </Button>
      </CardContent>
    </Card>
  );
}
