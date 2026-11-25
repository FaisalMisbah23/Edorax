// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
import type { CoursePricingType } from "../domain/enums";

// Wire contract for classes: a teacher's named group of learners who join with a
// code and follow the same courses. Teacher routes live under /api/v1/teach/classes,
// learner routes under /api/v1/classes.

export type ClassCourseRef = {
  id: string;
  slug: string;
  title: string;
  pricingType: CoursePricingType;
  priceCents: number | null;
  currency: string;
};

/** One card on the teacher's class list. */
export type ClassSummary = {
  id: string;
  name: string;
  joinCode: string;
  joinUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  archived: boolean;
  memberCount: number;
  courses: Array<{ id: string; slug: string; title: string }>;
  /** The organisation that runs the class, or null for a teacher's own class. */
  organization: { id: string; name: string } | null;
  createdAt: string;
};

export type TeachClassesView = { classes: ClassSummary[] };

/** Published courses a teacher may add to a class. */
export type ClassCourseOptionsView = { courses: ClassCourseRef[] };

export type ClassModuleRef = { id: string; title: string; order: number; dueAt: string | null };

/** Where a learner stands in one course of the class. */
export type ClassEnrollmentState = "not-enrolled" | "payment-required" | "active" | "completed";

export type ClassMemberCourse = {
  courseId: string;
  state: ClassEnrollmentState;
  percentComplete: number;
  lastActiveAt: string | null;
};

export type ClassMemberRow = {
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  joinedAt: string;
  courses: ClassMemberCourse[];
};

export type TeachClassDetail = Omit<ClassSummary, "courses"> & {
  courses: Array<ClassCourseRef & { modules: ClassModuleRef[] }>;
  members: ClassMemberRow[];
};

// ─── Gradebook ───────────────────────────────────────────────────────────────

export type GradebookColumnKind = "module" | "project" | "course";

export type GradebookColumn = {
  /** Stable id of the column: `m:<moduleId>`, `p:<blockId>` or `c:<courseId>`. */
  key: string;
  kind: GradebookColumnKind;
  courseId: string;
  courseTitle: string;
  label: string;
  dueAt: string | null;
};

export type GradebookCellStatus = "none" | "in-progress" | "done";

export type GradebookCell = {
  /** Mark out of 100 from graded work, or null when nothing in the item is graded yet. */
  mark: number | null;
  /** How much of the item is finished, 0 to 100, or null when that does not apply. */
  progress: number | null;
  score: number;
  maxScore: number;
  status: GradebookCellStatus;
  /** Past its due date and unfinished, or finished after the due date. */
  late: boolean;
};

export type GradebookRow = {
  userId: string;
  name: string;
  email: string | null;
  /** Keyed by GradebookColumn.key. A missing key means the learner is not enrolled in that course. */
  cells: Record<string, GradebookCell>;
  lateCount: number;
};

export type ClassGradebookView = {
  class: { id: string; name: string };
  columns: GradebookColumn[];
  rows: GradebookRow[];
  generatedAt: string;
};

// ─── Learner side ────────────────────────────────────────────────────────────

export type ClassJoinState = "open" | "archived" | "ended";

/** What anyone with the code sees before joining. */
export type ClassJoinPreview = {
  state: ClassJoinState;
  class: { id: string; name: string; teacherName: string | null; startsAt: string | null; endsAt: string | null };
  courses: ClassCourseRef[];
};

export type JoinClassResult = {
  classId: string;
  /** One entry per class course, in the teacher's order. */
  courses: Array<{ courseId: string; slug: string; title: string; state: ClassEnrollmentState }>;
};

export type MyClassCourse = ClassCourseRef & {
  state: ClassEnrollmentState;
  percentComplete: number;
  /** Modules that have a due date, soonest first. */
  dueDates: Array<{ moduleId: string; title: string; dueAt: string; done: boolean }>;
};

export type MyClass = {
  id: string;
  name: string;
  teacherName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  joinedAt: string;
  courses: MyClassCourse[];
};

export type MyClassesView = { classes: MyClass[] };

export const CLASS_ERROR_CODES = {
  CLASS_ARCHIVED: "CLASS_ARCHIVED",
  CLASS_ENDED: "CLASS_ENDED",
  OWN_CLASS: "OWN_CLASS",
  COURSE_NOT_AVAILABLE: "COURSE_NOT_AVAILABLE",
  MODULE_NOT_IN_CLASS: "MODULE_NOT_IN_CLASS",
} as const;
