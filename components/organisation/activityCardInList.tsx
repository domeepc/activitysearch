import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Tag from "../ui/leafletMap/tag";
import { getTagColorScheme } from "@/lib/tagColors";
import { Badge } from "../ui/badge";
import { databaseTags } from "@/lib/databaseTags";
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
              <img
                src={props.activity.images[0]}
                alt={props.activity.title}
                className="w-full h-48 object-cover rounded-md mb-0"
              />
            ) : (
              <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-md mb-0">
                <span className="text-gray-500">No Image Available</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row justify-between items-center mb-8">
            <h1 className="text-xl font-bold">{props.activity.title}</h1>
            <p className=" text-green-600 text-md font-semibold ">
              {props.activity.price.amount} {props.activity.price.currency}
            </p>
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
