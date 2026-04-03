import { MapPin, Star } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityItem, topRated } from "@/components/landing/data";

interface TopRatedSectionProps {
  items?: ActivityItem[];
}

export function TopRatedSection({ items }: TopRatedSectionProps) {
  const displayItems = items && items.length > 0 ? items : topRated;

  return (
    <section className="py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 md:px-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Top Rated Activities
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Popular experiences trusted by the community.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {displayItems.map((activity) => (
            <Card
              key={activity.title}
              className="overflow-hidden gap-0 border-zinc-200 pt-0 pb-0 shadow-sm"
            >
              <div
                className={`relative h-28 ${activity.imageUrl ? "bg-zinc-100" : `bg-linear-to-br ${activity.tone}`
                  }`}
              >
                {activity.imageUrl ? (
                  <Image
                    src={activity.imageUrl}
                    alt={activity.title}
                    loading="eager"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="h-full w-full object-cover object-center"
                  />
                ) : null}
              </div>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-1 font-semibold text-zinc-900">
                    {activity.title}
                  </h3>
                  <Badge variant="secondary">{activity.price}</Badge>
                </div>
                <p className="text-sm text-zinc-600">{activity.category}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Nearby
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {activity.rating}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
