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
      return result;
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
