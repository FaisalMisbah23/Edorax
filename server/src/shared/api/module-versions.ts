// Module versions: a module may have alternative lesson lists. The learner picks one per module
// and can say which version was better. Admins read the totals and notes as course feedback.

/** The key of a module's own lesson list, in choices and in feedback. */
export const DEFAULT_MODULE_VERSION_KEY = "default";

export const MODULE_VERSION_NOTE_MAX = 2000;

export const MODULE_VERSION_ERROR_CODES = {
  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",
  MODULE_HAS_NO_VERSIONS: "MODULE_HAS_NO_VERSIONS",
  VERSION_NOT_FOUND: "MODULE_VERSION_NOT_FOUND",
} as const;

export type ModuleVersionOption = {
  /** `default` for the module's own lesson list. */
  key: string;
  label: string;
  chapterCount: number;
  /** Sum of the chapters' estimated minutes, or null when no chapter has an estimate. */
  estimatedMinutes: number | null;
  /** Slug of the version's first chapter, or null when the version has no chapters. */
  firstChapterSlug: string | null;
};

export type ModuleVersionFeedbackView = {
  versionKey: string;
  note: string | null;
  updatedAt: string;
};

export type ModuleVersionsItem = {
  moduleId: string;
  /** The stable module key that choices and feedback use. */
  moduleKey: string;
  moduleTitle: string;
  moduleOrder: number;
  /** The default version first, then the alternatives in release order. */
  versions: ModuleVersionOption[];
  chosenVersionKey: string;
  feedback: ModuleVersionFeedbackView | null;
};

/** GET /api/v1/courses/:courseSlug/module-versions */
export type CourseModuleVersionsView = {
  courseSlug: string;
  /** Only modules that have at least one alternative version. Empty for a course without versions. */
  modules: ModuleVersionsItem[];
};

/** PUT /api/v1/courses/:courseSlug/modules/:moduleKey/version */
export type ChooseModuleVersionBody = { versionKey: string };
export type ChooseModuleVersionResult = {
  courseSlug: string;
  moduleKey: string;
  chosenVersionKey: string;
  /** Where the client should go next: the first chapter of the chosen version. */
  firstChapterSlug: string | null;
  percentComplete: number;
  chaptersCompleted: number;
};

/** PUT /api/v1/courses/:courseSlug/modules/:moduleKey/version-feedback */
export type ModuleVersionFeedbackBody = { versionKey: string; note?: string | null };
export type ModuleVersionFeedbackResult = {
  courseSlug: string;
  moduleKey: string;
  /** Null after DELETE. */
  feedback: ModuleVersionFeedbackView | null;
};

export type AdminModuleVersionTotal = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  moduleKey: string;
  moduleTitle: string;
  versionKey: string;
  versionLabel: string;
  votes: number;
};

export type AdminModuleVersionNote = {
  id: string;
  courseSlug: string;
  courseTitle: string;
  moduleKey: string;
  moduleTitle: string;
  versionKey: string;
  versionLabel: string;
  note: string;
  learnerName: string;
  updatedAt: string;
};

/** GET /api/v1/admin/module-version-feedback */
export type AdminModuleVersionFeedbackView = {
  /**
   * For every module with at least one vote: one row per version, including versions with
   * no votes yet. Ordered by course title, then module order, then version order.
   */
  totals: AdminModuleVersionTotal[];
  /** Votes that carry a note, newest first. */
  notes: AdminModuleVersionNote[];
};
