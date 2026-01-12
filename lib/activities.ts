import { Doc } from "@/convex/_generated/dataModel";
import { ActivityData, ActivityMappingOptions } from "./types/activity";

/**
 * Maps a Convex activities document to the frontend ActivityData format
 */
export function mapActivityFromDb(
  doc: Doc<"activities">,
  options: ActivityMappingOptions = {}
): ActivityData {
  const {
    defaultCurrency = "€",
    defaultPriceType = "",
  } = options;

  const category = (doc.tags && doc.tags.length > 0 && doc.tags[0]) || "";
  const tags = doc.tags ?? [];

  return {
    id: String(doc._id),
    title: doc.activityName,
    description: doc.description,
    category: category,
    location: {
      name: doc.activityName,
      address: doc.address,
      coordinates: {
        lat: doc.latitude,
        lng: doc.longitude,
      },
    },
    price: {
      amount: doc.price ?? 0,
      currency: defaultCurrency,
      type: defaultPriceType,
    },
    duration: doc.duration ? String(doc.duration) : "",
    difficulty: doc.difficulty ?? "",
    rating: doc.rating ?? 0,
    reviewCount: Number(doc.reviewCount ?? 0),
    images: doc.images ?? [],
    tags: tags,
  };
}

/**
 * Filters activities based on selected categories/tags
 * An activity matches if its category or any of its tags are in the selected categories
 */
export function filterActivitiesByCategories(
  activities: ActivityData[],
  selectedCategories: string[]
): ActivityData[] {
  if (selectedCategories.length === 0) {
    return activities;
  }

  return activities.filter((activity) => {
    const matchesCategory = selectedCategories.includes(activity.category);
    const matchesTags = (activity.tags ?? []).some((tag: string) =>
      selectedCategories.includes(tag)
    );
    return matchesCategory || matchesTags;
  });
}

/**
 * Extracts unique categories/tags from an array of activities
 */
export function getUniqueCategories(activities: ActivityData[]): string[] {
  return Array.from(
    new Set(activities.flatMap((activity) => activity.tags ?? []))
  );
}

