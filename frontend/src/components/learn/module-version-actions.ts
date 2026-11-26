import type { ModuleVersionActions } from "@buildment/learning-ui/components/learn/module-versions";
import type { ChooseModuleVersionResult } from "@/shared/api/module-versions";
import { ApiError, apiFetch } from "@/lib/api-client";
import {
  type ModuleVersionActionResult,
  removeModuleVersionFeedbackAction,
  saveModuleVersionFeedbackAction,
} from "@/server/actions/module-versions";

/**
 * Save the choice with a direct call to the API, not a server action. Next runs server actions
 * one at a time behind the page's pending requests, and the sidebar preloads many lesson links,
 * so a server action here waited 20 seconds or more on a long course before it even started.
 */
async function chooseModuleVersionDirect(raw: {
  courseSlug: string;
  moduleKey: string;
  versionKey: string;
}): Promise<ModuleVersionActionResult<ChooseModuleVersionResult>> {
  try {
    const data = await apiFetch<ChooseModuleVersionResult>(
      `/api/v1/courses/${encodeURIComponent(raw.courseSlug)}/modules/${encodeURIComponent(raw.moduleKey)}/version`,
      { method: "PUT", json: { versionKey: raw.versionKey } }
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    return { ok: false, error: "That version could not be opened. Please try again." };
  }
}

type Calls = {
  choose: typeof chooseModuleVersionDirect;
  save: typeof saveModuleVersionFeedbackAction;
  remove: typeof removeModuleVersionFeedbackAction;
};

const serverCalls: Calls = {
  choose: chooseModuleVersionDirect,
  save: saveModuleVersionFeedbackAction,
  remove: removeModuleVersionFeedbackAction,
};

/**
 * The web side of the module version controls: server actions for the calls, and the router to
 * open the first chapter of a newly chosen version. A failed call throws its message for the UI.
 */
export function moduleVersionActionsFor(
  courseSlug: string,
  router: { push: (href: string) => void; refresh: () => void; assign?: (href: string) => void },
  calls: Calls = serverCalls
): ModuleVersionActions {
  return {
    async choose(moduleKey, versionKey) {
      const result = await calls.choose({ courseSlug, moduleKey, versionKey });
      if (!result.ok) throw new Error(result.error);
      const first = result.data.firstChapterSlug;
      if (!first) {
        router.refresh();
        return;
      }
      const href = `/courses/${encodeURIComponent(result.data.courseSlug)}/${encodeURIComponent(first)}`;
      // A full page load, not router.push: the client may hold a copy of this chapter rendered
      // before the switch (a prefetch made while the old version was chosen), and showing it
      // makes the switch look like it did nothing until the learner reloads.
      if (router.assign) router.assign(href);
      else if (typeof window !== "undefined") window.location.assign(href);
      else router.push(href);
    },
    async saveFeedback(moduleKey, versionKey, note) {
      const result = await calls.save({ courseSlug, moduleKey, versionKey, note });
      if (!result.ok) throw new Error(result.error);
      if (!result.data.feedback) throw new Error("Your vote was not saved. Please try again.");
      return result.data.feedback;
    },
    async removeFeedback(moduleKey) {
      const result = await calls.remove({ courseSlug, moduleKey });
      if (!result.ok) throw new Error(result.error);
    },
  };
}
