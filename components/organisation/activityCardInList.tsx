import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getTagColorScheme } from "@/lib/tagColors";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import { api as convexApi } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

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
  onEdit?: (activityId: string) => void;
  isExpanded?: boolean;
}

export default function ActivityCardInList(props: ActivityCardProps) {
  const allTags =
    props.activity.tags && props.activity.tags.length > 0
      ? props.activity.tags
      : props.activity.category
      ? [props.activity.category]
      : [];

  const databaseTags = useQuery(convexApi.activity.getAllTags);
  return (
    <>
      <Card className="w-72 p-0">
        <CardHeader className="text-2xl font-bold p-0">
          <div className="w-full">
            {props.activity.images && props.activity.images.length > 0 ? (
              <div className="relative w-full h-48 rounded-md mb-0 overflow-hidden">
                <Image
                  src={props.activity.images[0]}
                  alt={props.activity.title}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-md mb-0">
                <span className="text-gray-500">No Image Available</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row justify-between items-center mb-8 gap-2">
            <h1 className="text-xl font-bold flex-1 min-w-0 truncate">
              {props.activity.title}
            </h1>
            <div className="flex items-center gap-1 shrink-0">
              {props.onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Edit activity"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onEdit?.(props.activity.id);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <p className="text-green-600 text-md font-semibold">
                {props.activity.price.amount} {props.activity.price.currency}
              </p>
            </div>
          </div>

          <div className="flex flex-row gap-4 flex-wrap mb-4">
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
          </div>
        </CardContent>
      </Card>
    </>
  );
}
