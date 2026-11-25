import { ApiError } from "@/lib/api-client";
import { formatPriceCents } from "@/lib/format-price";
import type { ClassCourseRef, ClassEnrollmentState } from "@/shared/api/classes";

/** "Free" or the formatted price of a course. */
export function coursePriceLabel(course: Pick<ClassCourseRef, "pricingType" | "priceCents" | "currency">): string {
  if (course.pricingType === "FREE" || !course.priceCents) return "Free";
  return formatPriceCents(course.priceCents, course.currency);
}

export const ENROLLMENT_LABEL: Record<ClassEnrollmentState, string> = {
  "not-enrolled": "Not enrolled",
  "payment-required": "Payment needed",
  active: "Active",
  completed: "Completed",
};

/** ISO string with offset to the value a datetime-local input expects, in the viewer's time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The value of a datetime-local input to an ISO string with offset, or null when empty. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.errors.length ? error.errors.map((e) => e.message).join(" ") : error.message;
  return "Something went wrong. Try again.";
}

export function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}
