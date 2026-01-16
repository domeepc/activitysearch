import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

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
