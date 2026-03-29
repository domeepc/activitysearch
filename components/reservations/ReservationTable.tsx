"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Users, AlertCircle, Calendar, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCancelReservation } from "@/lib/hooks/useReservations";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { Card, CardContent } from "@/components/ui/card";

interface Reservation {
  _id: Id<"reservations">;
  date: string;
  time: string;
  userCount: bigint;
  activityId: Id<"activities">;
  teamIds: Id<"teams">[];
  createdBy: Id<"users">;
  cancelledAt?: number;
  cancellationReason?: string;
  readByOrganizer?: boolean;
  reservationChatSlug?: string;
  activity: {
    _id: Id<"activities">;
    activityName: string;
    address: string;
  } | null;
  user: {
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    slug: string;
    avatar: string;
  } | null;
  teams: Array<{
    _id: Id<"teams">;
    teamName: string;
    slug: string;
  }>;
}

interface ReservationTableProps {
  reservations: Reservation[];
}

export function ReservationTable({ reservations }: ReservationTableProps) {
  const { cancelReservation, isPending } = useCancelReservation();
  const isMobile = useIsMobile();
  const [processingId, setProcessingId] = useState<Id<"reservations"> | null>(
    null
  );
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const handleCancelClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setCancellationReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedReservation || !cancellationReason.trim()) {
      return;
    }

    setProcessingId(selectedReservation._id);
    try {
      const result = await cancelReservation(
        selectedReservation._id,
        cancellationReason.trim()
      );
      setCancelDialogOpen(false);
      setSelectedReservation(null);
      setCancellationReason("");
      toast.success("Reservation cancelled.");
      if (result.autoAssigned) {
        toast.info("The first team in queue has been assigned the freed slot.");
      } else if (result.queueNotified) {
        toast.info("The first team in queue has been notified.");
      }
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to cancel reservation"
      );
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (reservation: Reservation) => {
    if (reservation.cancelledAt) {
      return (
        <Badge variant="destructive">
          Cancelled
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        Active
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {isMobile ? (
        // Mobile card view
        <div className="space-y-4">
          {reservations.map((reservation) => {
            const isProcessing = processingId === reservation._id;
            const isCancelled = !!reservation.cancelledAt;

            return (
              <Card
                key={reservation._id}
                className="overflow-hidden border border-border shadow-sm"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Activity & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">
                        {reservation.activity?.activityName || "Unknown Activity"}
                      </h3>
                      {reservation.activity?.address && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">
                            {reservation.activity.address}
                          </span>
                        </div>
                      )}
                    </div>
                    {getStatusBadge(reservation)}
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDate(reservation.date)}</span>
                    <span className="text-muted-foreground">at</span>
                    <span>{reservation.time}</span>
                  </div>

                  {/* User */}
                  {reservation.user && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {reservation.user.name} {reservation.user.lastname}
                      </span>
                      <span className="text-muted-foreground">
                        @{reservation.user.username}
                      </span>
                    </div>
                  )}

                  {/* Teams */}
                  {reservation.teams.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {reservation.teams.map((team) => (
                        <Badge
                          key={team._id}
                          variant="outline"
                          className="text-xs"
                        >
                          {team.teamName}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Participants */}
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{Number(reservation.userCount)} participants</span>
                  </div>

                  {/* Cancellation Reason */}
                  {reservation.cancellationReason && (
                    <div className="p-2 bg-muted rounded-md">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Cancellation Reason:
                      </p>
                      <p className="text-xs text-foreground">
                        {reservation.cancellationReason}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {!isCancelled && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancelClick(reservation)}
                      disabled={isProcessing}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Reservation
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // Desktop table view
        <div className="rounded-md border border-border shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Activity
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Date & Time
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              User
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Teams
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Participants
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Status
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Actions
            </th>
            </tr>
          </thead>
          <tbody>
          {reservations.map((reservation) => {
            const isProcessing = processingId === reservation._id;
            const isCancelled = !!reservation.cancelledAt;

            return (
              <tr
                key={reservation._id}
                className="border-b transition-colors hover:bg-muted/50"
              >
                <td className="p-4 align-middle">
                  <div>
                    <div className="font-medium">
                      {reservation.activity?.activityName || "Unknown Activity"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {reservation.activity?.address || ""}
                    </div>
                  </div>
                </td>
                <td className="p-4 align-middle">
                  <div>
                    <div className="font-medium">{formatDate(reservation.date)}</div>
                    <div className="text-sm text-muted-foreground">
                      {reservation.time}
                    </div>
                  </div>
                </td>
                <td className="p-4 align-middle">
                  {reservation.user ? (
                    <div>
                      <div className="font-medium">
                        {reservation.user.name} {reservation.user.lastname}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{reservation.user.username}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </td>
                <td className="p-4 align-middle">
                  <div className="flex flex-wrap gap-1">
                    {reservation.teams.length > 0 ? (
                      reservation.teams.map((team) => (
                        <Badge
                          key={team._id}
                          variant="outline"
                          className="text-xs"
                        >
                          {team.teamName}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No teams</span>
                    )}
                  </div>
                </td>
                <td className="p-4 align-middle">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{Number(reservation.userCount)}</span>
                  </div>
                </td>
                <td className="p-4 align-middle">
                  {getStatusBadge(reservation)}
                  {reservation.cancellationReason && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Reason: {reservation.cancellationReason}
                    </div>
                  )}
                </td>
                <td className="p-4 align-middle">
                  {!isCancelled && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancelClick(reservation)}
                      disabled={isProcessing}
                      className="h-8"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                  {isCancelled && (
                    <span className="text-sm text-muted-foreground">
                      Cancelled
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel Reservation Dialog - shared for both mobile and desktop */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this reservation. The first
              team in the queue will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedReservation && (
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Activity: </span>
                  <span className="text-sm">
                    {selectedReservation.activity?.activityName || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium">Date: </span>
                  <span className="text-sm">
                    {formatDate(selectedReservation.date)} at{" "}
                    {selectedReservation.time}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cancellationReason">
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancellationReason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter the reason for cancelling this reservation..."
                className="min-h-[100px]"
                required
              />
              {!cancellationReason.trim() && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Cancellation reason is required
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="border-border w-full sm:w-auto"
              onClick={() => {
                setCancelDialogOpen(false);
                setCancellationReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isPending || !cancellationReason.trim()}
              className="w-full sm:w-auto"
            >
              {isPending ? "Cancelling..." : "Cancel Reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
