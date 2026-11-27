import type { CertificateTemplateId } from "../lib/certificates.js";
import type { AiGradingModel, AiGradingOverrides, AiGradingValues } from "../lib/ai-grading.js";
import type { CapstoneMentorView } from "../blocks/capstone-check/report.js";
import type {
  ChapterReaderMode,
  CourseCategory,
  CoursePricingType,
  CourseStatus,
  EnrollStatus,
  HelpThreadStatus,
  ProgressStatus,
  ResponseStatus,
  ReviewVerdict,
} from "../domain/enums.js";
import type { LearnerTrackSummary, VariantAssignment } from "../lib/course-tracks.js";
import type { InstructorAccessView } from "../lib/instructor-access.js";
import type { IntegrityAttemptSummary } from "./integrity.js";

// Wire contract for /api/v1/teach — the instructor workspace. Every date is an
// ISO string; labels that need "now" (e.g. "3d ago") are computed on the server
// so the web app renders what it receives.

// ---------------------------------------------------------------------------
// Workspace shell and course list

export type CourseUpdateAction = "added" | "changed" | "removed" | "restored" | "moved" | "unchanged";
export type CourseUpdateChapterDiff = {
  title: string;
  previousTitle?: string;
  previousModule?: string;
  destinationModule?: string;
  action: CourseUpdateAction;
  similarity: number | null;
  reason: string;
  changes: string[];
};
export type CourseUpdateModuleDiff = {
  title: string;
  previousTitle?: string;
  previousOrder?: number;
  order?: number;
  action: CourseUpdateAction;
  chapters: CourseUpdateChapterDiff[];
};
export type CourseUpdatePreview = {
  previewId: string;
  expiresAt: string;
  modules: CourseUpdateModuleDiff[];
  variants?: { slug: string; affectedLessons: string[]; activeLearners: number }[];
  warnings: string[];
};

export type MentorSidebarCourse = {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  chapterCount: number;
  learnerCount: number;
  pendingReviews: number;
  openHelpRequests: number;
  /** Open learner questions flagged as feedback, plus open lesson reports. */
  openFeedback?: number;
};

export type TeachWorkspace = {
  courses: MentorSidebarCourse[];
  instructorAccess: InstructorAccessView;
};

export type MentorCourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: CourseStatus;
  chapterCount: number;
  learnerCount: number;
  averageProgress: number;
  completedLearners: number;
  pendingReviews: number;
  openHelpRequests: number;
  inactiveLearners: number;
  updatedAt: string;
  /** The settings that can be changed for several courses at once. Missing from an older API. */
  settings?: {
    sequential: boolean;
    integritySnapshots: boolean;
    aiGrading: AiGradingValues;
    /** True when the course has an AI grading value of its own instead of the default. */
    aiGradingOwn: boolean;
  };
};

/** PUT /api/v1/teach/courses/bulk-settings. Omitted settings are left alone; a null AI value resets it to the default. */
export type BulkCourseSettingsInput = {
  courseIds: string[];
  sequential?: boolean;
  integritySnapshots?: boolean;
  reviewDraft?: boolean | null;
  instantGrading?: boolean | null;
  model?: AiGradingModel | null;
};

export type MentorCoursesView = {
  zipImportEnabled: boolean;
  courses: MentorCourseCard[];
  summary: {
    totalCourses: number;
    publishedCourses: number;
    draftCourses: number;
    totalLearners: number;
    pendingReviews: number;
    openHelpRequests: number;
  };
};

// ---------------------------------------------------------------------------
// Course builder (edit page) and chapter editor

export type CourseBuilderChapter = {
  id: string;
  title: string;
  slug: string;
  order: number;
  publishedAt: string | null;
  estimatedMinutes: number | null;
  isMilestone: boolean;
  readerMode: ChapterReaderMode;
  blocks: Array<{ type: string }>;
};

export type CourseBuilderModule = {
  id: string;
  title: string;
  order: number;
  chapters: CourseBuilderChapter[];
};

export type CourseBuilderCourse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  projectGoal: string | null;
  difficulty: string | null;
  estimatedHours: number | null;
  category: CourseCategory;
  subcategory: string | null;
  tags: string[];
  sequential: boolean;
  coverUrl: string | null;
  status: CourseStatus;
  pricingType: CoursePricingType;
  priceCents: number;
  currency: string;
  enrollmentCount: number;
  modules: CourseBuilderModule[];
};

export type CourseBuilderView = {
  course: CourseBuilderCourse;
  /** Chapters without a module — legacy imports; the reader never shows them. */
  looseChapters: CourseBuilderChapter[];
};

export type CourseSettingsView = Pick<CourseBuilderCourse,
  "id" | "slug" | "title" | "description" | "projectGoal" | "difficulty" |
  "estimatedHours" | "category" | "subcategory" | "tags" | "sequential" | "coverUrl" | "status" | "pricingType" |
  "priceCents" | "currency"
> & {
  /** What applies to this course today (its own value or the owner's default). */
  autoGradeOpenQuestions: boolean;
  /** AI grading as set on the AI grading page. Missing from an older API. */
  aiGrading?: { own: AiGradingOverrides; effective: AiGradingValues };
  enrollmentCount: number;
  chapterCount: number;
  integritySnapshots: boolean;
  zipImportEnabled?: boolean;
  /** Course family the course belongs to, or null when it has no variants. */
  familySlug: string | null;
  hasVariants: boolean;
  variantAssignment: VariantAssignment;
  /** The certificate design this course issues (see CERTIFICATE_TEMPLATES). */
  certificateTemplate: CertificateTemplateId;
};

export type CourseDraftPreview = {
  course: Pick<CourseBuilderCourse, "id" | "slug" | "title" | "description" | "projectGoal" | "coverUrl" | "status"> & {
    difficulty?: string | null;
    estimatedHours?: number | null;
    category?: CourseCategory;
  };
  modules: Array<{
    id: string;
    title: string;
    chapters: Array<
      Pick<CourseBuilderChapter, "id" | "title" | "slug" | "readerMode" | "publishedAt"> & {
        source: string;
        hasDraft: boolean;
        estimatedMinutes?: number | null;
        isMilestone?: boolean;
        summary?: string | null;
      }
    >;
  }>;
};

export type CourseTeamView = {
  owner: { id: string; name: string | null; email: string };
  instructors: Array<{ id: string; name: string | null; email: string; role: "COURSE_CREATOR" | "SUBMISSION_EVALUATOR" }>;
  invites: Array<{ id: string; email: string; role: "COURSE_CREATOR" | "SUBMISSION_EVALUATOR"; url: string; expiresAt: string }>;
};
export type CourseInstructorInviteResult = { url: string; emailSent: boolean };
export type CourseInstructorInviteAcceptance = { courseSlug: string; role: "COURSE_CREATOR" | "SUBMISSION_EVALUATOR" };

export type ChapterEditorView = {
  chapterId: string;
  courseId: string;
  courseSlug: string;
  title: string;
  summary: string | null;
  estimatedMinutes: number | null;
  readerMode: ChapterReaderMode;
  quizPassingScore: number;
  isMilestone: boolean;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  /** Draft source with escaped block placeholders restored for the editor. */
  source: string;
  lastPublishedSource: string | null;
  blockConfigs: Record<string, unknown>;
};

export type CourseSlugResult = { courseSlug: string };
export type ChapterIdResult = { chapterId: string };
export type SavedAtResult = { savedAt: string };

export type CourseSettingsInput = {
  title: string;
  description: string;
  coverUrl: string;
  projectGoal: string;
  difficulty: string;
  estimatedHours: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  sequential: boolean;
  autoGradeOpenQuestions: boolean;
  /** Only sent for a course in a family; omitted leaves it as it is. */
  variantAssignment?: string;
  pricingType: string;
  priceDollars: string;
  currency: string;
};

export type ChapterSettingsInput = {
  title: string;
  summary: string | null;
  estimatedMinutes: number | null;
  readerMode: ChapterReaderMode;
  quizPassingScore: number;
  isMilestone: boolean;
};

// ---------------------------------------------------------------------------
// Mentees roster and invites

export type MenteeAttentionKind = "review" | "help" | "inactive" | "revision" | "stalled";

export type MenteeRosterItem = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  status: EnrollStatus;
  progressState: "not-started" | "in-progress" | "completed";
  percentComplete: number;
  chaptersCompleted: number;
  chapterCount: number;
  score: number;
  maxScore: number;
  pendingReviews: number;
  openHelpRequests: number;
  currentChapter: string | null;
  studySeconds: number;
  lastActiveAt: string | null;
  lastActiveLabel: string;
  /** When the mentor last sent this learner a nudge email for this course. */
  lastNudgedAt: string | null;
  activityState: "recent" | "inactive" | "never";
  attention: Array<{ kind: MenteeAttentionKind; label: string }>;
  evaluationHref: string;
  /** Variant and specialisation for a course in a family; null otherwise. */
  track: LearnerTrackSummary | null;
  /** Set on the all-courses roster, so each row names its course. */
  course?: { id: string; slug: string; title: string };
};

export type PendingInviteView = { id: string; email: string; createdAt: string };

export type CourseMenteesView = {
  course: { id: string; slug: string; title: string; status: CourseStatus; chapterCount: number };
  linkInvite: { id: string; token: string; url: string } | null;
  pendingEmailInvites: PendingInviteView[];
  mentees: MenteeRosterItem[];
  attentionMentees: MenteeRosterItem[];
  summary: {
    total: number;
    active: number;
    averageCompletion: number;
    completed: number;
    pendingReviews: number;
    openHelpRequests: number;
    inactive: number;
  };
};

/** GET /api/v1/teach/mentees: every learner across the courses this instructor runs. */
export type AllMenteesView = {
  courses: Array<{ id: string; slug: string; title: string }>;
  /** The course filter in effect, or null for all courses. */
  courseId: string | null;
  /** Distinct people; one person enrolled in three courses counts once. */
  learnerCount: number;
  mentees: MenteeRosterItem[];
  attentionMentees: MenteeRosterItem[];
  summary: CourseMenteesView["summary"];
};

export type AssignByEmailsResult = {
  enrolledEmails: string[];
  invitedEmails: string[];
  /** At least one invite email could not be delivered; the invites still exist. */
  emailFailed: boolean;
};

export type InviteLinkResult = { token: string; url: string; reused: boolean };

// ---------------------------------------------------------------------------
// Mentee evaluation

export type EvaluationAttention = {
  id: string;
  kind: "review" | "revision" | "help" | "incorrect" | "stalled" | "inactive";
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type ProjectEvidenceType =
  | "Repository"
  | "Demo video"
  | "Deployed application"
  | "Architecture / ERD"
  | "Article / document"
  | "Other evidence";

export type ProjectEvidence = {
  id: string;
  type: ProjectEvidenceType;
  chapterTitle: string;
  prompt: string;
  label: string;
  url: string;
  hostname: string;
  displayPath: string;
  explanation: string | null;
  attempt: number;
  submittedAt: string;
  status: string;
  feedback: string | null;
  reviewHref: string;
};

export type EvaluationSubmission = {
  id: string;
  blockId: string;
  type: string;
  moduleTitle: string;
  chapterTitle: string;
  prompt: string | null;
  answer: string;
  status: string;
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number | null;
  attempt: number;
  submittedAt: string;
  feedback: string | null;
  reviewHref: string | null;
  historyCount: number;
};

export type EvaluationChapter = {
  id: string;
  slug: string;
  title: string;
  order: number;
  status: ProgressStatus;
  locked: boolean;
  blocksCompleted: number;
  blocksTotal: number;
  score: number;
  maxScore: number;
  timeSpentSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
  requiresReview: boolean;
  pendingReviews: number;
};

export type EvaluationModule = {
  id: string;
  order: number;
  title: string;
  completedCount: number;
  openByDefault: boolean;
  chapters: EvaluationChapter[];
};

export type FeedbackEvent = {
  id: string;
  occurredAt: string;
  chapterTitle: string;
  attempt: number;
  kind: "submission" | "review";
  title: string;
  detail: string | null;
  verdict: string | null;
  score: string | null;
  href: string;
};

export type HelpRequest = {
  id: string;
  chapterTitle: string;
  preview: string;
  updatedAt: string;
  status: string;
  href: string;
};

export type StudySessionItem = {
  id: string;
  chapterTitle: string;
  status: string;
  activeSeconds: number;
  startedAt: string;
};

export type EvaluationReflection = {
  chapterId: string;
  chapterTitle: string;
  moduleTitle: string;
  checklist: Array<{ id: string; checked: boolean }>;
  answers: Array<{ id: string; text: string }>;
};

export type MenteeEvaluation = {
  course: { id: string; slug: string; title: string };
  mentee: { id: string; name: string; email: string | null };
  /** Variant and specialisation for a course in a family; null otherwise. */
  track: LearnerTrackSummary | null;
  enrollment: {
    id: string;
    status: string;
    percentComplete: number;
    chaptersCompleted: number;
    chapterCount: number;
    totalScore: number;
    maxScore: number;
    pendingReviews: number;
    lastActiveAt: string | null;
    lastActiveLabel: string;
    currentChapter: string | null;
    currentChapterDetail: string | null;
    studyWeekSeconds: number;
    studyTotalSeconds: number;
    openHelpCount: number;
  };
  reviewNextHref: string | null;
  attention: EvaluationAttention[];
  evidence: ProjectEvidence[];
  modules: EvaluationModule[];
  submissions: EvaluationSubmission[];
  timeline: FeedbackEvent[];
  help: HelpRequest[];
  sessions: StudySessionItem[];
  reflections: EvaluationReflection[];
  /** Quiz integrity attempts, newest first. Mentor-only. */
  integrity: IntegrityAttemptSummary[];
};

// ---------------------------------------------------------------------------
// Reports and activity

export type ReportEnrollmentRow = {
  id: string;
  name: string;
  email: string | null;
  status: EnrollStatus;
  percentComplete: number;
  totalScore: number;
  maxScore: number;
  pendingReviews: number;
  lastActiveAt: string | null;
  studySeconds: number;
  atRisk: boolean;
};

export type ChapterReportView = {
  chapterId: string;
  blocks: Array<{
    id: string;
    type: string;
    attempts: number;
    /** 0–1 for graded blocks, null otherwise. */
    correctRate: number | null;
    pendingReviews: number;
    confusionFlag: boolean;
  }>;
  progress: Array<{
    id: string;
    learnerLabel: string;
    blocksCompleted: number;
    blocksTotal: number;
    score: number;
    maxScore: number;
    status: ProgressStatus;
  }>;
};

export type CourseReportView = {
  course: { id: string; slug: string; title: string };
  modules: Array<{ id: string; title: string; chapters: Array<{ id: string; title: string }> }>;
  summary: { enrolled: number; started: number; completed: number; averageCompletion: number };
  atRiskDays: number;
  enrollments: ReportEnrollmentRow[];
  chapterReport: ChapterReportView | null;
  ratings: {
    average: number | null;
    count: number;
    distribution: Array<{ stars: number; count: number }>;
    recent: Array<{ id: string; rating: number; review: string | null; reviewer: string; createdAt: string }>;
  };
};

export type CourseActivityView = {
  course: { id: string; slug: string; title: string };
  /** UTC day keys (YYYY-MM-DD), oldest first. */
  days: string[];
  rows: Array<{
    enrollmentId: string;
    label: string;
    email: string | null;
    /** Active seconds per entry of `days`. */
    seconds: number[];
    totalSeconds: number;
  }>;
  metrics: {
    learnerCount: number;
    activeLearners: number;
    totalSeconds: number;
    averageSeconds: number;
    todaySeconds: number;
  };
  hasActivity: boolean;
};

// ---------------------------------------------------------------------------
// Review queue

/** Where an answer sits and how its learner is doing, so the mentor can jump straight there. */
export type ReviewContext = {
  courseSlug: string;
  moduleTitle: string | null;
  /** Opens the chapter in the course preview. */
  chapterHref: string;
  /** The learner's evaluation page for this course. */
  learnerHref: string;
  learnerProgress: { percentComplete: number; chaptersCompleted: number; status: string } | null;
};

export type ReviewQueueItem = ReviewContext & {
  id: string;
  attempt: number;
  submittedAt: string;
  learnerLabel: string;
  courseTitle: string;
  chapterTitle: string;
  blockType: string;
  maxScore: number;
  /** The question asked and what the learner wrote, so the mentor can review without opening the answer. */
  questionPrompt: string | null;
  answerText: string;
  answerUrl: string | null;
  /** The automatic AI first pass, when it is ready. */
  aiDraft: AiReviewDraft | null;
  /** Which model wrote the draft and what it cost in US dollars, when known. */
  aiDraftModel: string | null;
  aiDraftCostUsd: number | null;
  /** Why Claude could not draft this answer, when the last try failed. */
  aiDraftError?: string | null;
  /** False when this answer's course has automatic drafts switched off. Missing from an older API. */
  autoDraft?: boolean;
};

/** One answer a mentor already reviewed, for the Reviewed tab of Answers to check. */
export type ReviewedAnswerItem = ReviewContext & {
  id: string;
  attempt: number;
  submittedAt: string;
  reviewedAt: string;
  learnerLabel: string;
  learnerId: string;
  courseTitle: string;
  chapterTitle: string;
  verdict: ReviewVerdict;
  score: number | null;
  maxScore: number;
  reviewerName: string | null;
  feedback: string;
  questionPrompt: string | null;
  answerText: string;
  /** True when the learner has sent a newer attempt since. */
  superseded: boolean;
};

export type ReviewedAnswersView = {
  courses: Array<{ id: string; title: string }>;
  learner: { id: string; label: string } | null;
  items: ReviewedAnswerItem[];
};

export type ReviewQueueView = {
  courses: Array<{ id: string; title: string }>;
  /** Set when the list is narrowed to one learner. */
  learner: { id: string; label: string } | null;
  items: ReviewQueueItem[];
  /** True when every open answer gets an automatic AI draft on the platform key. */
  autoDraft: boolean;
  /** Total cost in US dollars of the drafts in this list. */
  draftCostUsd: number;
};

/** POST /api/v1/teach/enrollments/nudge */
export type NudgeManyResult = { sent: number; skipped: number; failed: number };

/** POST /api/v1/teach/review/accept-ai-drafts */
export type AcceptAiDraftsResult = { sent: number; failed: number };

export type ReviewDetailView = ReviewContext & {
  id: string;
  status: ResponseStatus;
  attempt: number;
  submittedAt: string;
  learner: { id: string; name: string | null; email: string };
  course: { id: string; slug: string; title: string };
  chapterTitle: string;
  block: { id: string; type: string; points: number };
  /** Mentor-only view of the open question; null when the config is unreadable. */
  question: { prompt: string; minWords: number; maxWords: number | null; rubric: string | null; sampleAnswer: string | null } | null;
  answerText: string;
  answerUrl: string | null;
  review: { score: number | null; verdict: ReviewVerdict } | null;
  /** Every submitted attempt on this question by this learner, oldest first, with the review each got. */
  history: Array<{
    id: string;
    attempt: number;
    submittedAt: string;
    answerText: string;
    /** True for the attempt this page is about. */
    current: boolean;
    review: { verdict: ReviewVerdict; feedback: string; reviewerName: string | null; reviewedAt: string } | null;
  }>;
  /** Quiz integrity attempts on this chapter by this learner, newest first. */
  integrity: IntegrityAttemptSummary[];
  /** Capstone checks: the check under review and the learner's other checks on this block, newest first. */
  capstone: { title: string; current: CapstoneMentorView | null; history: CapstoneMentorView[] } | null;
  /** The automatic AI first pass for an open answer, prefilled in the review form. */
  aiDraft: AiReviewDraftResult | null;
  /** True when Draft with AI runs on the platform key, so the mentor needs no key of their own. */
  platformDraft: boolean;
};

export type AiReviewDraft = {
  summary: string;
  strengths: string[];
  improvements: string[];
  feedback: string;
  suggestedVerdict: ReviewVerdict;
  suggestedScore: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type AiReviewDraftResult = { draft: AiReviewDraft; model: string; costUsd?: number | null };

// ---------------------------------------------------------------------------
// Mentor help inbox

export type MentorHelpInboxThread = TeachLinks & {
  id: string;
  status: HelpThreadStatus;
  kind: "QUESTION" | "LESSON_REPORT";
  category: "ERROR" | "TYPO" | "CONFUSING" | "BROKEN_LINK" | "SUGGESTION" | "OTHER" | null;
  quote: string | null;
  menteeLabel: string;
  courseTitle: string;
  chapterTitle: string | null;
  preview: { body: string; createdAt: string } | null;
  /** Hours since the latest message; drives the "waiting" badge. */
  ageHours: number;
  /** Set when a mentor flagged the thread as feedback for the team. */
  feedbackScope: "COURSE" | "PLATFORM" | null;
  /** True when the learner wrote last, so the thread is waiting on the mentor. */
  needsReply: boolean;
  /** The latest messages, oldest first, so the mentor can read and answer from the list. */
  messages: Array<{ id: string; body: string; fromLearner: boolean; authorName: string; createdAt: string }>;
  messageCount: number;
};

/** Claude's suggested reply to a learner question, for the mentor to edit and send. */
export type HelpReplyDraft = {
  reply: string;
  model: string;
  costUsd: number | null;
  /** Whether the message looks like a course or platform problem worth flagging. */
  feedbackScope: "NONE" | "COURSE" | "PLATFORM";
  feedbackNote: string | null;
};

// ---------------------------------------------------------------------------
// AI grading settings (one default per instructor, optional overrides per course)

export type AiGradingCourseRow = {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  /** False when another instructor owns the course; it then follows that owner's default. */
  ownedByYou: boolean;
  /**
   * True when the caller's default is the one this course follows: they own it, or they
   * co-create it and no one ahead of them (the owner, then earlier co-creators) saved a
   * default. Missing from an older API.
   */
  followsYourDefault?: boolean;
  /** The course's own choices; null means it uses the default. */
  own: AiGradingOverrides;
  /** The default this course falls back to. */
  defaults: AiGradingValues;
  /** What applies today. */
  effective: AiGradingValues;
};

export type AiGradingModelInfo = { id: AiGradingModel; label: string; inputUsdPerMillion: number; outputUsdPerMillion: number };

/** GET and PUT /api/v1/teach/ai-grading */
export type AiGradingView = {
  /** The caller's default for every course they own. */
  defaults: AiGradingValues;
  /** False until the caller saved a default; until then the platform default applies. */
  defaultsSaved: boolean;
  platform: { reviewDraftAvailable: boolean; dailyLimit: number; model: string };
  models: AiGradingModelInfo[];
  courses: AiGradingCourseRow[];
};

/** A null course value resets that setting to the default; an omitted one is left alone. */
export type AiGradingUpdateInput = {
  defaults?: { reviewDraft?: boolean; instantGrading?: boolean; model?: AiGradingModel };
  courses?: Array<{ courseId: string; reviewDraft?: boolean | null; instantGrading?: boolean | null; model?: AiGradingModel | null }>;
};

export type ThreadFeedbackView = { scope: "COURSE" | "PLATFORM" | null; note: string | null };

/** Where a mentor can jump from a help thread: the course, the lesson and the learner. */
export type TeachLinks = {
  courseHref: string;
  /** The lesson in the course preview; null for a question that is not about one lesson. */
  chapterHref: string | null;
  learnerHref: string;
};

export type FeedbackItem = TeachLinks & {
  id: string;
  scope: "COURSE" | "PLATFORM";
  /** "report": the learner filed a lesson report. "flag": a mentor flagged a question. */
  source: "report" | "flag";
  category: MentorHelpInboxThread["category"];
  status: HelpThreadStatus;
  courseTitle: string;
  moduleTitle: string | null;
  chapterTitle: string | null;
  learnerLabel: string;
  note: string | null;
  quote: string | null;
  /** The learner's first message in the thread. */
  message: string | null;
  createdAt: string;
  href: string;
};

export type FeedbackView = {
  items: FeedbackItem[];
  counts: { course: number; platform: number; open: number };
};

export type MentorHelpInboxView = {
  courses: Array<{ id: string; title: string }>;
  /** Set when the inbox is narrowed to one learner. */
  learner: { id: string; label: string } | null;
  openCount: number;
  /** Open threads where the learner wrote last. */
  needsReplyCount: number;
  threads: MentorHelpInboxThread[];
};

export const TEACH_ERROR_CODES = {
  /** Publish rules failed; `errors` lists each reason. */
  COURSE_NOT_PUBLISHABLE: "COURSE_NOT_PUBLISHABLE",
  CHAPTER_NOT_PUBLISHABLE: "CHAPTER_NOT_PUBLISHABLE",
  COURSE_NOT_PUBLISHED: "COURSE_NOT_PUBLISHED",
  /** Unpublishing with enrolled learners needs the confirmation flag. */
  ENROLLMENTS_CONFIRMATION_REQUIRED: "ENROLLMENTS_CONFIRMATION_REQUIRED",
  /** Removing a chapter with learner progress or submissions needs the confirmation flag. */
  CHAPTER_PROGRESS_CONFIRMATION_REQUIRED: "CHAPTER_PROGRESS_CONFIRMATION_REQUIRED",
  ALREADY_AT_EDGE: "ALREADY_AT_EDGE",
  ALREADY_REVIEWED: "ALREADY_REVIEWED",
  AI_DRAFT_UNSUPPORTED: "AI_DRAFT_UNSUPPORTED",
  AI_DRAFT_UNAVAILABLE: "AI_DRAFT_UNAVAILABLE",
  NO_EMAIL_ON_FILE: "NO_EMAIL_ON_FILE",
  EMAIL_NOT_CONFIGURED: "EMAIL_NOT_CONFIGURED",
  EMAIL_FAILED: "EMAIL_FAILED",
} as const;

// ---------------------------------------------------------------------------
// Instructor wallet & withdrawals

export type InstructorWithdrawalStatus = "REQUESTED" | "PAID" | "REJECTED";

export type InstructorWithdrawalItem = {
  id: string;
  amountCents: number;
  currency: string;
  status: InstructorWithdrawalStatus;
  note: string;
  paymentCount: number;
  requestedAt: string;
  resolvedAt: string | null;
};

export type InstructorEarningItem = {
  id: string;
  courseTitle: string;
  learnerLabel: string;
  fundingSource: string | null;
  amountCents: number;
  instructorShareCents: number;
  currency: string;
  paidAt: string | null;
  status: "AVAILABLE" | "PENDING_WITHDRAWAL" | "PAID";
};

export type InstructorWalletSummary = {
  withdrawalsEnabled: boolean;
  totalEarnedCents: number;
  alreadyPaidCents: number;
  pendingWithdrawalCents: number;
  availableBalanceCents: number;
  currency: string;
  withdrawals: InstructorWithdrawalItem[];
  recentEarnings: InstructorEarningItem[];
};

// ---------------------------------------------------------------------------
// Instructor promotional discount campaigns

export type InstructorCampaignCourse = {
  id: string;
  title: string;
  slug: string;
  category: CourseCategory | null;
  subcategory: string | null;
  tags: string[];
  priceCents: number;
  currency: string;
};

export type InstructorCampaignItem = {
  id: string;
  label: string;
  code: string | null;
  scope: string;
  percentOff: number;
  maxRedemptions: number;
  autoApply: boolean;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  participatingCourseIds: string[];
  eligibleCourseIds: string[];
};

export type InstructorCampaignsView = {
  campaigns: InstructorCampaignItem[];
  courses: InstructorCampaignCourse[];
};
