"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Dates show in the viewer's own time zone. The server render uses UTC so the first paint
// matches, and the browser swaps in local time as soon as it is ready.
export function LocalDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" };
  const text = date.toLocaleString(undefined, isClient ? options : { ...options, timeZone: "UTC" });
  return <time dateTime={iso}>{text}</time>;
}

/** "Jan 5, 2026 to Feb 9, 2026", "From Jan 5, 2026", "Until Feb 9, 2026" or nothing. */
export function DateRange({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  if (!startsAt && !endsAt) return null;
  if (startsAt && endsAt) {
    return (
      <>
        <LocalDate iso={startsAt} /> to <LocalDate iso={endsAt} />
      </>
    );
  }
  return startsAt ? (
    <>
      From <LocalDate iso={startsAt} />
    </>
  ) : (
    <>
      Until <LocalDate iso={endsAt!} />
    </>
  );
}
