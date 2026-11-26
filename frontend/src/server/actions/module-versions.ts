"use server";

import type {
  ChooseModuleVersionResult,
  ModuleVersionFeedbackResult,
} from "@/shared/api/module-versions";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";

// Module versions: a learner picks which version of a module to read and can vote for the
// version they found better. Each action returns a result instead of throwing an API error, so
// the sidebar can show the message next to the control.

export type ModuleVersionActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const modulePath = (courseSlug: string, moduleKey: string) =>
  `/api/v1/courses/${encodeURIComponent(courseSlug)}/modules/${encodeURIComponent(moduleKey)}`;

async function call<T>(run: () => Promise<T>): Promise<ModuleVersionActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function chooseModuleVersionAction(raw: {
  courseSlug: string;
  moduleKey: string;
  versionKey: string;
}): Promise<ModuleVersionActionResult<ChooseModuleVersionResult>> {
  const result = await call(() =>
    serverApiFetch<ChooseModuleVersionResult>(`${modulePath(raw.courseSlug, raw.moduleKey)}/version`, {
      method: "PUT",
      json: { versionKey: raw.versionKey },
    })
  );
  // No revalidatePath here: it re-renders the page the learner is on, a chapter of the old
  // version, and opening that chapter switches the module straight back to the old version.
  // The caller opens the new version's first chapter with a full page load instead.
  return result;
}

export async function saveModuleVersionFeedbackAction(raw: {
  courseSlug: string;
  moduleKey: string;
  versionKey: string;
  note?: string | null;
}): Promise<ModuleVersionActionResult<ModuleVersionFeedbackResult>> {
  return call(() =>
    serverApiFetch<ModuleVersionFeedbackResult>(`${modulePath(raw.courseSlug, raw.moduleKey)}/version-feedback`, {
      method: "PUT",
      json: { versionKey: raw.versionKey, note: raw.note ?? null },
    })
  );
}

export async function removeModuleVersionFeedbackAction(raw: {
  courseSlug: string;
  moduleKey: string;
}): Promise<ModuleVersionActionResult<ModuleVersionFeedbackResult>> {
  return call(() =>
    serverApiFetch<ModuleVersionFeedbackResult>(`${modulePath(raw.courseSlug, raw.moduleKey)}/version-feedback`, {
      method: "DELETE",
    })
  );
}
