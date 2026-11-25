import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/index.js";
import {
  DEFAULT_MODULE_VERSION_KEY,
  MODULE_VERSION_ERROR_CODES,
  type ChooseModuleVersionResult,
  type CourseModuleVersionsView,
  type ModuleVersionFeedbackResult,
  type ModuleVersionFeedbackView,
  type ModuleVersionOption,
} from "../../shared/api/module-versions.js";
import type { SessionUser } from "../../types/auth.js";
import { NotFoundError } from "../../utils/errors.js";
import { requireBlockSubmissionAccess } from "../enrollment/api-learn-access.js";
import { recomputeEnrollmentRollup } from "../progress/compute.js";
import { findChapterIndex } from "../chapters/chapter-slug.js";
import {
  chosenModuleVersion,
  moduleVersionKey,
  readModuleVersionChoices,
  releaseForEnrollment,
  type ModuleVersionChoices,
  type ReleaseChapter,
  type ReleaseModule,
} from "./releases.js";

// A module may carry alternative versions in the release. Each learner reads one version per
// module (no choice means the default) and may vote for the version they found better.

export const DEFAULT_VERSION_LABEL = "Original";

function versionOption(key: string, label: string, chapters: ReleaseChapter[]): ModuleVersionOption {
  const minutes = chapters.filter(chapter => chapter.estimatedMinutes != null);
  return {
    key, label, chapterCount: chapters.length,
    estimatedMinutes: minutes.length ? minutes.reduce((sum, chapter) => sum + chapter.estimatedMinutes!, 0) : null,
    firstChapterSlug: chapters[0]?.slug ?? null,
  };
}

/** The default version first, then the alternatives as the release lists them. */
export function versionOptions(module: ReleaseModule): ModuleVersionOption[] {
  return [
    versionOption(DEFAULT_MODULE_VERSION_KEY, module.defaultVersionLabel || DEFAULT_VERSION_LABEL, module.chapters),
    ...(module.versions ?? []).map(version => versionOption(version.key, version.label, version.chapters)),
  ];
}

function feedbackView(row: { versionKey: string; note: string | null; updatedAt: Date }): ModuleVersionFeedbackView {
  return { versionKey: row.versionKey, note: row.note, updatedAt: row.updatedAt.toISOString() };
}

async function loadLearnerModules(courseSlug: string, user: SessionUser) {
  const course = await prisma.course.findUnique({ where: { slug: courseSlug }, select: { id: true, slug: true, familySlug: true } });
  if (!course) throw new NotFoundError("Course not found");
  const enrollment = await requireBlockSubmissionAccess(course.id, user);
  const selected = await releaseForEnrollment(course.id, enrollment, course.familySlug);
  return { course, enrollment, modules: selected?.allModules ?? [] };
}

/** The module named by the path, which must have at least one alternative version. */
function requireVersionedModule(modules: ReleaseModule[], moduleKey: string) {
  const module = modules.find(item => moduleVersionKey(item) === moduleKey);
  if (!module) throw new NotFoundError("Module not found in this course.", MODULE_VERSION_ERROR_CODES.MODULE_NOT_FOUND);
  if (!module.versions?.length) throw new NotFoundError("This module has only one version.", MODULE_VERSION_ERROR_CODES.MODULE_HAS_NO_VERSIONS);
  return module;
}

function requireVersionOption(module: ReleaseModule, versionKey: string) {
  const option = versionOptions(module).find(item => item.key === versionKey);
  if (!option) throw new NotFoundError("Version not found for this module.", MODULE_VERSION_ERROR_CODES.VERSION_NOT_FOUND);
  return option;
}

export async function listCourseModuleVersions(courseSlug: string, user: SessionUser): Promise<CourseModuleVersionsView> {
  const { course, enrollment, modules } = await loadLearnerModules(courseSlug, user);
  const versioned = modules.filter(module => module.versions?.length);
  if (!versioned.length) return { courseSlug: course.slug, modules: [] };
  const choices = readModuleVersionChoices(enrollment.moduleVersions);
  const feedback = await prisma.moduleVersionFeedback.findMany({
    where: { enrollmentId: enrollment.id, moduleKey: { in: versioned.map(moduleVersionKey) } },
    select: { moduleKey: true, versionKey: true, note: true, updatedAt: true },
  });
  const feedbackByModule = new Map(feedback.map(row => [row.moduleKey, row]));
  return {
    courseSlug: course.slug,
    modules: versioned.map(module => {
      const key = moduleVersionKey(module);
      const row = feedbackByModule.get(key);
      return {
        moduleId: module.id, moduleKey: key, moduleTitle: module.title, moduleOrder: module.order,
        versions: versionOptions(module),
        chosenVersionKey: chosenModuleVersion(module, choices)?.key ?? DEFAULT_MODULE_VERSION_KEY,
        feedback: row ? feedbackView(row) : null,
      };
    }),
  };
}

/** Store one module's version choice and recompute the roll-up for the new lesson list. */
async function saveModuleVersionChoice(enrollmentId: string, moduleKey: string, versionKey: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Enrollment" WHERE "id" = ${enrollmentId} FOR UPDATE`;
    const current = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, select: { moduleVersions: true } });
    const choices = readModuleVersionChoices(current.moduleVersions);
    if (versionKey === DEFAULT_MODULE_VERSION_KEY) delete choices[moduleKey];
    else choices[moduleKey] = versionKey;
    await tx.enrollment.update({ where: { id: enrollmentId },
      data: { moduleVersions: Object.keys(choices).length ? choices : Prisma.DbNull } });
    // A learner who has not begun keeps their status; anyone else gets a percentage for the new list.
    if (await tx.chapterProgress.count({ where: { enrollmentId } })) {
      await recomputeEnrollmentRollup(tx, enrollmentId, { preserveActivity: true });
    }
    const updated = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, select: { percentComplete: true, chaptersCompleted: true } });
    return { ...updated, choices };
  });
}

/**
 * A shared link can point at a chapter in a version the learner has not chosen. When the chapter
 * belongs to one version of a module, switch that module to it and return the new choices.
 * Returns null when no version of any module has the chapter.
 */
export async function switchModuleVersionForChapter(
  enrollmentId: string,
  allModules: ReleaseModule[],
  chapterSlug: string
): Promise<ModuleVersionChoices | null> {
  for (const module of allModules) {
    if (!module.versions?.length) continue;
    const lists = [
      { key: DEFAULT_MODULE_VERSION_KEY, chapters: module.chapters },
      ...module.versions.map(version => ({ key: version.key, chapters: version.chapters })),
    ];
    const owner = lists.find(list => findChapterIndex(list.chapters, chapterSlug) !== -1);
    if (!owner) continue;
    const saved = await saveModuleVersionChoice(enrollmentId, moduleVersionKey(module), owner.key);
    return saved.choices;
  }
  return null;
}

/**
 * Pick the version a learner reads in one module. Allowed at any time, also after the course
 * variant is locked. Progress rows stay with their chapters; the roll-up is recomputed.
 */
export async function chooseModuleVersion(courseSlug: string, user: SessionUser, moduleKey: string, versionKey: string): Promise<ChooseModuleVersionResult> {
  const { course, enrollment, modules } = await loadLearnerModules(courseSlug, user);
  const module = requireVersionedModule(modules, moduleKey);
  const option = requireVersionOption(module, versionKey);

  const updated = await saveModuleVersionChoice(enrollment.id, moduleKey, versionKey);

  return {
    courseSlug: course.slug, moduleKey, chosenVersionKey: versionKey, firstChapterSlug: option.firstChapterSlug,
    percentComplete: updated.percentComplete, chaptersCompleted: updated.chaptersCompleted,
  };
}

/** One current vote per learner and module: set or change it. */
export async function setModuleVersionFeedback(
  courseSlug: string,
  user: SessionUser,
  moduleKey: string,
  input: { versionKey: string; note?: string | null }
): Promise<ModuleVersionFeedbackResult> {
  const { course, enrollment, modules } = await loadLearnerModules(courseSlug, user);
  const module = requireVersionedModule(modules, moduleKey);
  requireVersionOption(module, input.versionKey);
  const note = input.note?.trim() || null;
  const row = await prisma.moduleVersionFeedback.upsert({
    where: { enrollmentId_moduleKey: { enrollmentId: enrollment.id, moduleKey } },
    create: { enrollmentId: enrollment.id, userId: user.id, courseId: course.id, moduleKey, versionKey: input.versionKey, note },
    update: { versionKey: input.versionKey, note },
    select: { versionKey: true, note: true, updatedAt: true },
  });
  return { courseSlug: course.slug, moduleKey, feedback: feedbackView(row) };
}

/** Remove the learner's vote for a module. Removing a vote that does not exist is fine. */
export async function deleteModuleVersionFeedback(courseSlug: string, user: SessionUser, moduleKey: string): Promise<ModuleVersionFeedbackResult> {
  const course = await prisma.course.findUnique({ where: { slug: courseSlug }, select: { id: true, slug: true } });
  if (!course) throw new NotFoundError("Course not found");
  const enrollment = await requireBlockSubmissionAccess(course.id, user);
  await prisma.moduleVersionFeedback.deleteMany({ where: { enrollmentId: enrollment.id, moduleKey } });
  return { courseSlug: course.slug, moduleKey, feedback: null };
}
