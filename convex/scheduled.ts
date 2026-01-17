import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily to check and cancel reservations if payment not complete on activity date
// Runs at midnight UTC to check reservations for the current day
crons.daily(
  "check-and-cancel-unpaid-reservations",
  {
    hourUTC: 0, // Midnight UTC
    minuteUTC: 0,
  },
  internal.reservations.checkAndCancelUnpaidReservations
);

// Run hourly to check and fulfill reservations and capture payments
// This ensures payments are captured soon after the activity date/time passes
crons.hourly(
  "check-and-fulfill-reservations",
  {
    minuteUTC: 0, // At the top of every hour
  },
  internal.reservations.checkAndFulfillReservations
);

export default crons;
