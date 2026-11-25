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
  router: { push: (href: string) => void; refresh: () => void },
  calls: Calls = serverCalls
): ModuleVersionActions {
  return {
    async choose(moduleKey, versionKey) {
      const result = await calls.choose({ courseSlug, moduleKey, versionKey });
      if (!result.ok) throw new Error(result.error);
      const first = result.data.firstChapterSlug;
      if (first) router.push(`/courses/${encodeURIComponent(result.data.courseSlug)}/${encodeURIComponent(first)}`);
      else router.refresh();
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
