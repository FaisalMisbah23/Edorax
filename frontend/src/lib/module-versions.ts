import "server-only";
import type { CourseModuleVersionsView, ModuleVersionsItem } from "@/shared/api/module-versions";
import { serverApiFetch } from "@/lib/api-server";

/**
 * The modules of a course that have alternative versions, with the learner's choice and vote.
 * A failure only hides the version switch, so it never blocks the reader.
 */
export async function loadModuleVersions(courseSlug: string): Promise<ModuleVersionsItem[]> {
  try {
    const view = await serverApiFetch<CourseModuleVersionsView>(
      `/api/v1/courses/${encodeURIComponent(courseSlug)}/module-versions`
    );
    return Array.isArray(view?.modules) ? view.modules : [];
  } catch {
    return [];
  }
}
