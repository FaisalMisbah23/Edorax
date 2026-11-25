"use server";

import { teachCall } from "./teach-call";

export async function nudgeMenteeAction(input: { enrollmentId: string }) {
  const result = await teachCall<void>(`/api/v1/teach/enrollments/${encodeURIComponent(input.enrollmentId)}/nudge`, { method: "POST" });
  if (!result.ok) return { ok: false as const, error: result.errors.join(" ") };
  return { ok: true as const };
}

/** Nudge several learners at once; anyone nudged in the last day is skipped by the server. */
export async function nudgeManyAction(input: { enrollmentIds: string[] }) {
  const result = await teachCall<{ sent: number; skipped: number; failed: number }>("/api/v1/teach/enrollments/nudge", {
    method: "POST",
    json: { enrollmentIds: input.enrollmentIds },
  });
  if (!result.ok) return { ok: false as const, error: result.errors.join(" ") };
  return { ok: true as const, ...result.data };
}
