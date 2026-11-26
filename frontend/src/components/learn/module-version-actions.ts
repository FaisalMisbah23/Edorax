import type { ModuleVersionActions } from "@buildment/learning-ui/components/learn/module-versions";
import {
  chooseModuleVersionAction,
  removeModuleVersionFeedbackAction,
  saveModuleVersionFeedbackAction,
} from "@/server/actions/module-versions";

type Calls = {
  choose: typeof chooseModuleVersionAction;
  save: typeof saveModuleVersionFeedbackAction;
  remove: typeof removeModuleVersionFeedbackAction;
};

const serverCalls: Calls = {
  choose: chooseModuleVersionAction,
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
