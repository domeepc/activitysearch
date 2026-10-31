// Activities run in Croatia; the Convex server clock is UTC.
export const APP_TIME_ZONE = "Europe/Zagreb";

// How far `timeZone` is ahead of UTC at the instant `utcMs`.
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-02" + "10:00" in the app time zone -> UTC milliseconds. */
export function reservationStartMs(
  date: string,
  time: string,
  timeZone: string = APP_TIME_ZONE
): number {
  const [hh = "00", mm = "00", ss = "00"] = time.split(":");
  const wallAsUtc = Date.parse(`${date}T${hh.padStart(2, "0")}:${mm}:${ss}Z`);
  if (Number.isNaN(wallAsUtc)) {
    throw new Error(`Invalid reservation date/time: ${date} ${time}`);
  }
  const guess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  // Re-check once so times next to a DST switch use the right offset.
  return wallAsUtc - zoneOffsetMs(guess, timeZone);
}

/** Today's date (YYYY-MM-DD) in the app time zone. */
export function todayInAppZone(
  nowMs: number = Date.now(),
  timeZone: string = APP_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(nowMs));
}
