// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
// AI grading settings: one default per instructor, optional overrides per course.
// The fallback order for every setting is: the course's own value, then the course
// owner's default, then the platform (environment) default.

/** The only models an instructor may pick. Edorax grades on Haiku and Sonnet, nothing larger. */
export const AI_GRADING_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5"] as const;
export type AiGradingModel = (typeof AI_GRADING_MODELS)[number];

export const AI_GRADING_MODEL_LABELS: Record<AiGradingModel, string> = {
  "claude-haiku-5-5": "Haiku",
  "claude-sonnet-5-5": "Sonnet",
};

export function isAiGradingModel(value: unknown): value is AiGradingModel {
  return typeof value === "string" && (AI_GRADING_MODELS as readonly string[]).includes(value);
}

/** Short name for a model id: "Haiku", "Sonnet", or the id itself when it is not one of ours. */
export function aiGradingModelLabel(model: string): string {
  return isAiGradingModel(model) ? AI_GRADING_MODEL_LABELS[model] : model;
}

export type AiGradingValues = {
  /** First-pass AI review drafts for pending open answers (platform key). */
  reviewDraft: boolean;
  /** Text short answers graded instantly (the learner's own key). */
  instantGrading: boolean;
  /** Model for the review drafts. */
  model: string;
};

/** A course's own choices; null means "use the default". */
export type AiGradingOverrides = { [K in keyof AiGradingValues]: AiGradingValues[K] | null };

export const NO_AI_GRADING_OVERRIDES: AiGradingOverrides = { reviewDraft: null, instantGrading: null, model: null };

/** What applies when neither the course nor its owner has chosen. */
export function platformAiGradingDefaults(envModel: string): AiGradingValues {
  return { reviewDraft: true, instantGrading: false, model: envModel };
}

/** The owner's default laid over the platform default. A stored model outside the allowed list is ignored. */
export function resolveAiGradingDefaults(
  ownerDefault: Partial<AiGradingValues> | null | undefined,
  platform: AiGradingValues
): AiGradingValues {
  return {
    reviewDraft: ownerDefault?.reviewDraft ?? platform.reviewDraft,
    instantGrading: ownerDefault?.instantGrading ?? platform.instantGrading,
    model: isAiGradingModel(ownerDefault?.model) ? ownerDefault.model : platform.model,
  };
}

/** Course value, else owner default, else platform default. */
export function resolveAiGrading(
  course: Partial<AiGradingOverrides> | null | undefined,
  ownerDefault: Partial<AiGradingValues> | null | undefined,
  platform: AiGradingValues
): AiGradingValues {
  const defaults = resolveAiGradingDefaults(ownerDefault, platform);
  return {
    reviewDraft: course?.reviewDraft ?? defaults.reviewDraft,
    instantGrading: course?.instantGrading ?? defaults.instantGrading,
    model: isAiGradingModel(course?.model) ? course.model : defaults.model,
  };
}
