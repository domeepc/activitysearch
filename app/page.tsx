"use client";

import { Authenticated, useQuery } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import "./home.css";
import { ActivityData } from "@/components/ui/leafletMap/leafletMap";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import SearchAutocomplete from "@/components/ui/search-autocomplete";
import DialogAddActivity from "@/components/ui/dialogAddActivity";
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectValue,
  MultiSelectGroup,
  MultiSelectItem,
} from "@/components/ui/multi-select";

const OpenStreetMapComponent = dynamic(
  () => import("@/components/ui/leafletMap/leafletMap"),
  { ssr: false }
);

const FilterContent = ({
  activities,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
}: {
  activities: ActivityData[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
}) => {
  // Get unique tags from activities
  const uniqueCategories = Array.from(
    new Set(activities.flatMap((activity) => activity.tags ?? []))
  );
  return (
    <>
      <SearchAutocomplete
        activities={activities}
        onActivitySelect={onActivitySelect}
        placeholder="Search by activity or location..."
      />
      <MultiSelect
        values={selectedCategories}
        onValuesChange={onCategoryChange}
      >
        <MultiSelectTrigger className="w-full max-w-62">
          <MultiSelectValue placeholder="Select category..." />
        </MultiSelectTrigger>
        <MultiSelectContent search={false} className="filter_tab_content">
          <MultiSelectGroup>
            {uniqueCategories.map((category) => (
              <MultiSelectItem key={category} value={category}>
                {category}
              </MultiSelectItem>
            ))}
          </MultiSelectGroup>
        </MultiSelectContent>
      </MultiSelect>
    </>
  );
};

export default function Home() {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(
    null
  );

  // Get current user to check if they are an organizer
  const currentUser = useQuery(api.users.current);
  const isOrganizer = currentUser?.role === "organizer";

  // Fetch activities from Convex and map to the frontend ActivityData shape
  const activitiesFromDb = useQuery(api.activity.getActivities) as
    | any[]
    | undefined;

  useEffect(() => {
    if (!activitiesFromDb) return;

    const mapped: ActivityData[] = activitiesFromDb.map((doc: any) => ({
      id: String(doc._id ?? doc.id ?? ""),
      title: doc.activityName ?? doc.title ?? "",
      description: doc.description ?? "",
      category: (doc.tags && doc.tags.length > 0 && doc.tags[0]) || "",
      location: {
        name: doc.activityName ?? doc.title ?? "",
        address: doc.address ?? "",
        coordinates: {
          lat: doc.latitude ?? doc.location?.coordinates?.lat ?? 0,
          lng: doc.longitude ?? doc.location?.coordinates?.lng ?? 0,
        },
      },
      price: {
        amount: doc.price ?? 0,
        currency: "€",
        type: "",
      },
      duration: doc.duration ? String(doc.duration) : "",
      difficulty: doc.difficulty ?? "",
      rating: doc.rating ?? 0,
      reviewCount: doc.reviewCount ?? 0,
      images: doc.images ?? [],
      tags: doc.tags ?? [],
    }));

    setActivities(mapped);
  }, [activitiesFromDb]);

  // Filter activities based on selected categories
  const filteredActivities =
    selectedCategories.length > 0
      ? activities.filter((activity) =>
          selectedCategories.includes(activity.category)
        )
      : activities;

  const [pendingActivity, setPendingActivity] = useState<ActivityData | null>(
    null
  );
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Handle activity selection from search
  const handleActivitySelect = (activity: ActivityData) => {
    setSelectedActivity(activity);
    // Reset category filter to show the selected activity
    setSelectedCategories([]);
  };

  // Handle activity selection on mobile - don't fly until search is clicked
  const handleMobileActivitySelect = (activity: ActivityData) => {
    setPendingActivity(activity);
    setSelectedCategories([]);
  };

  // Handle mobile search button click
  const handleMobileSearch = () => {
    if (pendingActivity) {
      setSelectedActivity(pendingActivity);
      setPendingActivity(null);
    }
    setIsMobileDialogOpen(false);
  };

  return (
    <Authenticated>
      <section className="hidden md:block">
        <div className="filter_tab">
          <FilterContent
            activities={activities}
            selectedCategories={selectedCategories}
            onCategoryChange={setSelectedCategories}
            onActivitySelect={handleActivitySelect}
          />
          {isOrganizer && (
            <Button
              onClick={() => setShowAddDialog(true)}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="size-4 mr-2" />
              Add Activity
            </Button>
          )}
        </div>
      </section>

      <div className="mobile_filter_tab_button md:hidden">
        <Dialog open={isMobileDialogOpen} onOpenChange={setIsMobileDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="rounded-full aspect-square p-6"
            >
              <Search className="size-6" />
            </Button>
          </DialogTrigger>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogTitle>Activities</DialogTitle>
            <div className="filter_tab">
              <FilterContent
                activities={activities}
                selectedCategories={selectedCategories}
                onCategoryChange={setSelectedCategories}
                onActivitySelect={handleMobileActivitySelect}
              />
            </div>
            <DialogFooter className="flex gap-2">
              {isOrganizer && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMobileDialogOpen(false);
                    setShowAddDialog(true);
                  }}
                  className="flex-1"
                >
                  <Plus className="size-4 mr-2" />
                  Add Activity
                </Button>
              )}
              <Button
                className={`bg-blue-600 hover:bg-blue-900 ${
                  isOrganizer ? "flex-1" : "w-full"
                }`}
                onClick={handleMobileSearch}
              >
                Search
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Floating Action Button for mobile - only show for organizers */}
      {isOrganizer && (
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="rounded-full aspect-square p-6 bg-blue-600 hover:bg-blue-700 shadow-lg"
            size="lg"
          >
            <Plus className="size-6" />
          </Button>
        </div>
      )}

      {/* Add Activity Dialog */}
      <DialogAddActivity
        showDialog={showAddDialog}
        setShowDialog={setShowAddDialog}
      />

      <div className="map_tab">
        <OpenStreetMapComponent
          activities={filteredActivities}
          selectedActivity={selectedActivity}
        />
      </div>
    </Authenticated>
  );
}
