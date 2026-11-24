"use server";

import type { EarlierAnswersResponse } from "@/shared/api/chapters";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";

export type EarlierAnswersResult = { ok: true; data: EarlierAnswersResponse } | { ok: false; error: string };

export async function loadEarlierAnswers(chapterId: string): Promise<EarlierAnswersResult> {
  try {
    const data = await serverApiFetch<EarlierAnswersResponse>(
      `/api/v1/chapters/${encodeURIComponent(chapterId)}/earlier-answers`
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}
