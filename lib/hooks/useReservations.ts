import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

export function useReservations(activityId: Id<"activities"> | undefined) {
  const reservations = useQuery(
    api.reservations.getReservationsByActivity,
    activityId ? { activityId } : "skip"
  );

  return {
    reservations: reservations ?? [],
    isLoading: reservations === undefined,
  };
}

export function useMyTeamsAsCreator() {
  const teams = useQuery(api.reservations.getMyTeamsAsCreator);

  return {
    teams: teams ?? [],
    isLoading: teams === undefined,
    hasTeams: (teams?.length ?? 0) > 0,
  };
}

export function useCreateReservation() {
  const [isPending, setIsPending] = useState(false);
  const createReservation = useMutation(api.reservations.createReservation);

  const handleCreateReservation = async (params: {
    activityId: Id<"activities">;
    date: string;
    time: string;
    teamIds: Id<"teams">[];
    userCount: number;
  }) => {
    setIsPending(true);
    try {
      const result = await createReservation({
        ...params,
        userCount: BigInt(params.userCount),
      });
      // Mutation now returns { success, error } or { success, reservationId }
      return result;
    } catch (error) {
      // Catch any unexpected errors (shouldn't happen now, but keep as fallback)
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create reservation";
      return { success: false, error: errorMessage };
    } finally {
      setIsPending(false);
    }
  };

  return {
    createReservation: handleCreateReservation,
    isPending,
  };
}

export function useReservationStatus(
  activityId: Id<"activities"> | undefined,
  date: string | undefined
) {
  const status = useQuery(
    api.reservations.getReservationStatusByDate,
    activityId && date
      ? { activityId, date }
      : "skip"
  );

  return {
    status: status ?? null,
    isLoading: status === undefined,
  };
}

export function useOrganizerReservations() {
  const reservations = useQuery(api.reservations.getReservationsForOrganizer);

  return {
    reservations: reservations ?? [],
    isLoading: reservations === undefined,
  };
}

export function useUnreadReservationCount() {
  const count = useQuery(api.reservations.getUnreadReservationCount);

  return {
    count: count ?? 0,
    isLoading: count === undefined,
  };
}

export function useCancelReservation() {
  const [isPending, setIsPending] = useState(false);
  const cancelReservation = useMutation(api.reservations.cancelReservation);

  const handleCancel = async (
    reservationId: Id<"reservations">,
    cancellationReason: string
  ) => {
    setIsPending(true);
    try {
      const result = await cancelReservation({
        reservationId,
        cancellationReason,
      });
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return {
    cancelReservation: handleCancel,
    isPending,
  };
}

export function useJoinQueue() {
  const [isPending, setIsPending] = useState(false);
  const joinQueue = useMutation(api.reservations.joinQueue);

  const handleJoinQueue = async (params: {
    activityId: Id<"activities">;
    date: string;
    teamIds: Id<"teams">[];
    userCount: number;
  }) => {
    setIsPending(true);
    try {
      const result = await joinQueue({
        ...params,
        userCount: BigInt(params.userCount),
      });
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return {
    joinQueue: handleJoinQueue,
    isPending,
  };
}

export function useLeaveQueue() {
  const [isPending, setIsPending] = useState(false);
  const leaveQueue = useMutation(api.reservations.leaveQueue);

  const handleLeaveQueue = async (queueEntryId: Id<"reservationQueue">) => {
    setIsPending(true);
    try {
      const result = await leaveQueue({ queueEntryId });
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return {
    leaveQueue: handleLeaveQueue,
    isPending,
  };
}

export function useGetQueuePosition(
  activityId: Id<"activities"> | undefined,
  date: string | undefined,
  teamIds: Id<"teams">[] | undefined
) {
  const queuePosition = useQuery(
    api.reservations.getQueuePosition,
    activityId && date && teamIds && teamIds.length > 0
      ? { activityId, date, teamIds }
      : "skip"
  );

  return {
    queuePosition: queuePosition ?? null,
    isLoading: queuePosition === undefined,
  };
}

export function useAcceptQueueReservation() {
  const [isPending, setIsPending] = useState(false);
  const acceptQueueReservation = useMutation(
    api.reservations.acceptQueueReservation
  );

  const handleAccept = async (
    queueEntryId: Id<"reservationQueue">,
    time: string
  ) => {
    setIsPending(true);
    try {
      const result = await acceptQueueReservation({ queueEntryId, time });
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return {
    acceptQueueReservation: handleAccept,
    isPending,
  };
}

export function useDeclineQueueReservation() {
  const [isPending, setIsPending] = useState(false);
  const declineQueueReservation = useMutation(
    api.reservations.declineQueueReservation
  );

  const handleDecline = async (queueEntryId: Id<"reservationQueue">) => {
    setIsPending(true);
    try {
      const result = await declineQueueReservation({ queueEntryId });
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return {
    declineQueueReservation: handleDecline,
    isPending,
  };
}

export function useMyQueueNotifications() {
  const notifications = useQuery(api.reservations.getMyQueueNotifications);

  return {
    notifications: notifications ?? [],
    isLoading: notifications === undefined,
  };
}

export function useMarkReservationsAsRead() {
  const [isPending, setIsPending] = useState(false);
  const markAsRead = useMutation(api.reservations.markReservationsAsRead);

  const handleMarkAsRead = async () => {
    setIsPending(true);
    try {
      const result = await markAsRead({});
      return result;
    } finally {
      setIsPending(false);
    }
  };

  return {
    markReservationsAsRead: handleMarkAsRead,
    isPending,
  };
}
