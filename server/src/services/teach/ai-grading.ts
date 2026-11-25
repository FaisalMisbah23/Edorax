import type { AiGradingCourseRow, AiGradingUpdateInput, AiGradingView } from "../../shared/api/teach.js";
import {
  AI_GRADING_MODELS,
  AI_GRADING_MODEL_LABELS,
  platformAiGradingDefaults,
  resolveAiGrading,
  resolveAiGradingDefaults,
  type AiGradingOverrides,
  type AiGradingValues,
} from "../../shared/lib/ai-grading.js";
import { aiReviewAutoDraftAvailable, env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import type { SessionUser } from "../../types/auth.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { modelPriceUsdPerMillion } from "../capstone/grade.js";
import { mentoredCoursesWhere } from "./access.js";

// AI grading settings for an instructor's courses, set in one place instead of one
// course at a time. Each course follows its owner's default unless it has its own value.

const ownerDefaultSelect = { reviewDraft: true, instantGrading: true, model: true } as const;

/** Add this to a Course select to be able to call `effectiveAiGrading` on the row. */
export const AI_GRADING_COURSE_SELECT = {
  aiReviewDraft: true,
  aiInstantGrading: true,
  aiGradingModel: true,
  mentor: { select: { aiGradingDefault: { select: ownerDefaultSelect } } },
} as const;

export type AiGradingCourseFields = {
  aiReviewDraft: boolean | null;
  aiInstantGrading: boolean | null;
  aiGradingModel: string | null;
  mentor: { aiGradingDefault: AiGradingValues | null };
};

function platformDefaults(): AiGradingValues {
  return platformAiGradingDefaults(env.AI_REVIEW_MODEL);
}

export function courseAiGradingOverrides(course: Pick<AiGradingCourseFields, "aiReviewDraft" | "aiInstantGrading" | "aiGradingModel">): AiGradingOverrides {
  return { reviewDraft: course.aiReviewDraft, instantGrading: course.aiInstantGrading, model: course.aiGradingModel };
}

/** What applies to this course: its own value, else its owner's default, else the platform default. */
export function effectiveAiGrading(course: AiGradingCourseFields): AiGradingValues {
  return resolveAiGrading(courseAiGradingOverrides(course), course.mentor.aiGradingDefault, platformDefaults());
}

/** The settings for the course an answer belongs to; null when the answer is gone. */
export async function aiGradingForResponse(responseId: string): Promise<AiGradingValues | null> {
  const row = await prisma.response.findUnique({
    where: { id: responseId },
    select: { block: { select: { chapter: { select: { course: { select: AI_GRADING_COURSE_SELECT } } } } } },
  });
  return row ? effectiveAiGrading(row.block.chapter.course) : null;
}

export async function loadAiGrading(user: SessionUser): Promise<AiGradingView> {
  const [saved, courses] = await Promise.all([
    prisma.aiGradingDefault.findUnique({ where: { userId: user.id }, select: ownerDefaultSelect }),
    prisma.course.findMany({
      where: mentoredCoursesWhere(user),
      orderBy: { title: "asc" },
      select: { id: true, slug: true, title: true, status: true, mentorId: true, ...AI_GRADING_COURSE_SELECT },
    }),
  ]);
  const platform = platformDefaults();

  const rows: AiGradingCourseRow[] = courses.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    status: course.status,
    ownedByYou: course.mentorId === user.id,
    own: courseAiGradingOverrides(course),
    defaults: resolveAiGradingDefaults(course.mentor.aiGradingDefault, platform),
    effective: effectiveAiGrading(course),
  }));

  return {
    defaults: resolveAiGradingDefaults(saved, platform),
    defaultsSaved: Boolean(saved),
    platform: { reviewDraftAvailable: aiReviewAutoDraftAvailable, dailyLimit: env.AI_REVIEW_DAILY_LIMIT, model: env.AI_REVIEW_MODEL },
    models: AI_GRADING_MODELS.map((id) => ({ id, label: AI_GRADING_MODEL_LABELS[id], ...modelPriceUsdPerMillion(id) })),
    courses: rows,
  };
}

/**
 * Change the caller's default, any number of their courses, or both, in one go.
 * Every course must be one the caller owns or co-creates: one course outside that
 * scope refuses the whole request and nothing is written.
 */
export async function updateAiGrading(user: SessionUser, input: AiGradingUpdateInput): Promise<AiGradingView> {
  if (user.role !== "MENTOR" && user.role !== "ADMIN") throw new ForbiddenError("You do not have access to this course.", "NOT_COURSE_MENTOR");

  // The last entry for a course wins, so a repeated id cannot half-apply.
  const changes = new Map<string, Partial<AiGradingOverrides>>();
  for (const { courseId, ...change } of input.courses ?? []) changes.set(courseId, { ...changes.get(courseId), ...change });
  const ids = [...changes.keys()];

  if (ids.length > 0) {
    const [existing, allowed] = await Promise.all([
      prisma.course.count({ where: { id: { in: ids } } }),
      prisma.course.count({ where: { AND: [{ id: { in: ids } }, mentoredCoursesWhere(user)] } }),
    ]);
    if (existing < ids.length) throw new NotFoundError("Course not found");
    if (allowed < ids.length) throw new ForbiddenError("You do not mentor this course.", "NOT_COURSE_MENTOR");
  }

  const defaults = input.defaults;
  const hasDefaults = Boolean(defaults && Object.values(defaults).some((value) => value !== undefined));
  const current = hasDefaults
    ? resolveAiGradingDefaults(await prisma.aiGradingDefault.findUnique({ where: { userId: user.id }, select: ownerDefaultSelect }), platformDefaults())
    : null;

  await prisma.$transaction([
    ...(current && defaults
      ? [
          prisma.aiGradingDefault.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              reviewDraft: defaults.reviewDraft ?? current.reviewDraft,
              instantGrading: defaults.instantGrading ?? current.instantGrading,
              // The platform model can be outside the allowed list; a saved default never is.
              model: defaults.model ?? (AI_GRADING_MODELS as readonly string[]).find((id) => id === current.model) ?? AI_GRADING_MODELS[0],
            },
            update: {
              ...(defaults.reviewDraft !== undefined ? { reviewDraft: defaults.reviewDraft } : {}),
              ...(defaults.instantGrading !== undefined ? { instantGrading: defaults.instantGrading } : {}),
              ...(defaults.model !== undefined ? { model: defaults.model } : {}),
            },
          }),
        ]
      : []),
    ...ids.map((id) => {
      const change = changes.get(id)!;
      return prisma.course.update({
        where: { id },
        data: {
          ...(change.reviewDraft !== undefined ? { aiReviewDraft: change.reviewDraft } : {}),
          ...(change.instantGrading !== undefined ? { aiInstantGrading: change.instantGrading } : {}),
          ...(change.model !== undefined ? { aiGradingModel: change.model } : {}),
        },
      });
    }),
  ]);

  return loadAiGrading(user);
}
