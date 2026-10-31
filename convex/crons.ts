import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 00:00 UTC (01:00/02:00 in Zagreb): cancel reservations still unpaid on the activity day.
crons.cron(
  "check-and-cancel-unpaid-reservations",
  "0 0 * * *",
  internal.reservations.checkAndCancelUnpaidReservations,
  {}
);

// Hourly: charge saved cards for today's paid reservations (retries failed charges).
crons.cron(
  "check-and-fulfill-reservations",
  "0 * * * *",
  internal.reservations.checkAndFulfillReservations,
  {}
);

export default crons;
