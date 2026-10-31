import { expect, test } from "vitest";
import { reservationStartMs, todayInAppZone } from "./reservationTime";

test("reservation times are Zagreb wall-clock times", () => {
  expect(new Date(reservationStartMs("2026-07-01", "10:00")).toISOString()).toBe(
    "2026-07-01T08:00:00.000Z"
  );
  expect(new Date(reservationStartMs("2026-12-01", "10:00")).toISOString()).toBe(
    "2026-12-01T09:00:00.000Z"
  );
  expect(todayInAppZone(Date.parse("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
});
