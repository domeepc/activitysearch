"use client";

import { Authenticated } from "convex/react";
import dynamic from "next/dynamic";
import { useState, useMemo, useEffect } from "react";
import { preconnect } from "react-dom";
import { capture } from "@/lib/posthog";
import "../home.css";
import { ActivityData } from "@/lib/types/activity";
import DialogAddActivity from "@/components/activities/DialogAddActivity";
import DesktopFilterSection from "@/components/activities/DesktopFilterSection";
import MobileFilterDialog from "@/components/activities/MobileFilterDialog";
import { useActivities } from "@/lib/hooks/useActivities";
import { useActivityFilters } from "@/lib/hooks/useActivityFilters";
import { useOrganiser } from "@/lib/hooks/useOrganiser";
import { QueueNotificationDialog } from "@/components/reservations/QueueNotificationDialog";
import { useMyQueueNotifications } from "@/lib/hooks/useReservations";
import { MAP_STYLE } from "@/lib/mapStyle";

const ActivityMap = dynamic(
  () => import("@/components/ui/map/ActivityMap"),
  { ssr: false }
);

export default function Home() {
  // Warm up the tile server while the map bundle is still downloading.
  preconnect(new URL(MAP_STYLE.light).origin, { crossOrigin: "anonymous" });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(
    null
  );
  const [pendingActivity, setPendingActivity] = useState<ActivityData | null>(
    null
  );
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { activities } = useActivities();
  const { isOrganiser } = useOrganiser();
  const { filteredActivities } = useActivityFilters(
    activities,
    selectedCategories
  );
  const { notifications: queueNotifications } = useMyQueueNotifications();
  const [showQueueNotification, setShowQueueNotification] = useState(false);
  const [shownNotificationId, setShownNotificationId] = useState<string | null>(
    null
  );

  const currentNotification = useMemo(() => {
    if (queueNotifications && queueNotifications.length > 0) {
      const latestNotification = queueNotifications[0];
      if (
        latestNotification.notifiedAt &&
        latestNotification._id !== shownNotificationId
      ) {
        return latestNotification;
      }
    }
    return null;
  }, [queueNotifications, shownNotificationId]);

  useEffect(() => {
    if (currentNotification) {
      const timeoutId = setTimeout(() => {
        setShownNotificationId(currentNotification._id);
        setShowQueueNotification(true);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [currentNotification]);

  const handleActivitySelect = (activity: ActivityData) => {
    capture("activity_search_performed", {
      activity_id: String(activity.id),
      activity_name: activity.title,
    });
    setSelectedActivity(activity);
    setSelectedCategories([]);
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
    capture("activity_filter_applied", {
      categories,
      category_count: categories.length,
    });
  };

  const handleMobileActivitySelect = (activity: ActivityData) => {
    setPendingActivity(activity);
    setSelectedCategories([]);
  };

  const handleMobileSearch = () => {
    if (pendingActivity) {
      setSelectedActivity(pendingActivity);
      setPendingActivity(null);
    }
    setIsMobileDialogOpen(false);
  };

  return (
    <Authenticated>
      <MobileFilterDialog
        activities={activities}
        resultCount={pendingActivity ? 1 : filteredActivities.length}
        selectedCategories={selectedCategories}
        onCategoryChange={handleCategoryChange}
        onActivitySelect={handleMobileActivitySelect}
        onClearSelection={() => {
          setPendingActivity(null);
          setSelectedActivity(null);
        }}
        open={isMobileDialogOpen}
        onOpenChange={setIsMobileDialogOpen}
        onSearch={handleMobileSearch}
        onAddActivity={isOrganiser ? () => setShowAddDialog(true) : undefined}
      />

      <DialogAddActivity
        showDialog={showAddDialog}
        setShowDialog={setShowAddDialog}
      />

      <div className="flex h-[calc(100dvh-var(--app-navbar-height))] overflow-hidden">
        <DesktopFilterSection
          activities={activities}
          results={filteredActivities}
          selectedActivityId={selectedActivity?.id ?? null}
          selectedCategories={selectedCategories}
          onCategoryChange={handleCategoryChange}
          onActivitySelect={handleActivitySelect}
          onResultSelect={setSelectedActivity}
          onClearSelection={() => setSelectedActivity(null)}
          onAddActivity={() => setShowAddDialog(true)}
          isOrganiser={isOrganiser}
        />
        <div className="relative min-w-0 flex-1">
          <ActivityMap
            activities={filteredActivities}
            selectedActivity={selectedActivity}
          />
        </div>
      </div>
      {currentNotification && (
        <QueueNotificationDialog
          notification={currentNotification}
          open={showQueueNotification}
          onOpenChange={(open) => {
            setShowQueueNotification(open);
          }}
          onAccept={() => {
            setShowQueueNotification(false);
          }}
          onDecline={() => {
            setShowQueueNotification(false);
          }}
        />
      )}
    </Authenticated>
  );
}
