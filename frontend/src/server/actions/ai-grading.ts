"use server";

import { revalidatePath } from "next/cache";
import type { AiGradingUpdateInput, AiGradingView } from "@/shared/api/teach";
import { teachCall } from "./teach-call";

/** Change the AI grading default, any number of courses, or both. Returns the fresh page data. */
export async function updateAiGrading(input: AiGradingUpdateInput): Promise<{ ok: true; view: AiGradingView } | { ok: false; error: string }> {
  const result = await teachCall<AiGradingView>("/api/v1/teach/ai-grading", { method: "PUT", json: input });
  if (!result.ok) return { ok: false, error: result.errors.join(" ") };
  // Each course's Settings page shows the same values.
  revalidatePath("/courses/[courseSlug]/settings", "page");
  return { ok: true, view: result.data };
}
