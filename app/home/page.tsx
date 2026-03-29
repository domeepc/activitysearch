"use client";

import { Authenticated } from "convex/react";
import dynamic from "next/dynamic";
import { useState, useMemo, useEffect } from "react";
import { usePostHog } from "@posthog/react";
import "../home.css";
import { ActivityData } from "@/lib/types/activity";
import DialogAddActivity from "@/components/activities/DialogAddActivity";
import DialogAddActivityMobile from "@/components/activities/DialogAddActivityMobile";
import DesktopFilterSection from "@/components/activities/DesktopFilterSection";
import MobileFilterDialog from "@/components/activities/MobileFilterDialog";
import MobileAddActivityFAB from "@/components/activities/MobileAddActivityFAB";
import { useActivities } from "@/lib/hooks/useActivities";
import { useActivityFilters } from "@/lib/hooks/useActivityFilters";
import { useOrganiser } from "@/lib/hooks/useOrganiser";
import { QueueNotificationDialog } from "@/components/reservations/QueueNotificationDialog";
import { useMyQueueNotifications } from "@/lib/hooks/useReservations";

const OpenStreetMapComponent = dynamic(
  () => import("@/components/ui/leafletMap/leafletMap"),
  { ssr: false }
);

export default function Home() {
  const posthog = usePostHog();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(
    null
  );
  const [pendingActivity, setPendingActivity] = useState<ActivityData | null>(
    null
  );
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddDialogMobile, setShowDialogMobile] = useState(false);

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
    posthog?.capture("activity_search_performed", {
      activity_id: String(activity.id),
      activity_name: activity.title,
    });
    setSelectedActivity(activity);
    setSelectedCategories([]);
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
    posthog?.capture("activity_filter_applied", {
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
      <DesktopFilterSection
        activities={activities}
        selectedCategories={selectedCategories}
        onCategoryChange={handleCategoryChange}
        onActivitySelect={handleActivitySelect}
        onClearSelection={() => setSelectedActivity(null)}
        onAddActivity={() => setShowAddDialog(true)}
        isOrganiser={isOrganiser}
      />
      <MobileFilterDialog
        activities={activities}
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
      />

      {isOrganiser && (
        <MobileAddActivityFAB onClick={() => setShowDialogMobile(true)} />
      )}

      <DialogAddActivity
        showDialog={showAddDialog}
        setShowDialog={setShowAddDialog}
      />
      <DialogAddActivityMobile
        showDialog={showAddDialogMobile}
        setShowDialog={setShowDialogMobile}
      />

      <div className="map_tab">
        <OpenStreetMapComponent
          activities={filteredActivities}
          selectedActivity={selectedActivity}
        />
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
