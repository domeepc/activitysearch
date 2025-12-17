"use client";

import { Authenticated } from "convex/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import "./home.css";
import { ActivityData } from "@/lib/types/activity";
import DialogAddActivity from "@/components/ui/dialogAddActivity";
import DialogAddActivityMobile from "@/components/activities/DialogAddActivityMobile";
import DesktopFilterSection from "@/components/activities/DesktopFilterSection";
import MobileFilterDialog from "@/components/activities/MobileFilterDialog";
import MobileAddActivityFAB from "@/components/activities/MobileAddActivityFAB";
import { useActivities } from "@/lib/hooks/useActivities";
import { useActivityFilters } from "@/lib/hooks/useActivityFilters";
import { useOrganizer } from "@/lib/hooks/useOrganizer";

const OpenStreetMapComponent = dynamic(
  () => import("@/components/ui/leafletMap/leafletMap"),
  { ssr: false }
);

export default function Home() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(
    null
  );
  const [pendingActivity, setPendingActivity] = useState<ActivityData | null>(
    null
  );
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Custom hooks
  const { activities } = useActivities();
  const { isOrganizer } = useOrganizer();
  const { filteredActivities } = useActivityFilters(
    activities,
    selectedCategories
  );

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
      <DesktopFilterSection
        activities={activities}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        onActivitySelect={handleActivitySelect}
        onAddActivity={() => setShowAddDialog(true)}
        isOrganizer={isOrganizer}
      />
      <MobileFilterDialog
        activities={activities}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        onActivitySelect={handleMobileActivitySelect}
        open={isMobileDialogOpen}
        onOpenChange={setIsMobileDialogOpen}
        onSearch={handleMobileSearch}
      />
      {isOrganizer && (
        <MobileAddActivityFAB onClick={() => setShowAddDialog(true)} />
      )}
      <DialogAddActivity
        showDialog={showAddDialog}
        setShowDialog={setShowAddDialog}
      />
      <DialogAddActivityMobile
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
