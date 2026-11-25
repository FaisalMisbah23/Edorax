import { prisma } from "../../db/prisma.js";
import {
  DEFAULT_MODULE_VERSION_KEY,
  type AdminModuleVersionFeedbackView,
  type AdminModuleVersionNote,
  type AdminModuleVersionTotal,
} from "../../shared/api/module-versions.js";
import { resolveCourseFamily } from "../../shared/lib/course-tracks.js";
import { DEFAULT_VERSION_LABEL, versionOptions } from "../courses/module-versions.js";
import { moduleVersionKey, readReleaseContent } from "../courses/releases.js";

// Which module version learners found better, with their notes, for the team improving courses.

const ADMIN_NOTES_LIMIT = 500;

type ModuleLabels = { title: string; order: number; versions: { key: string; label: string }[] };

/** Module titles and version labels from each course's active release, across every variant. */
async function labelsByCourse(courseIds: string[]) {
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, slug: true, title: true, familySlug: true, variantFamily: true, activeReleaseId: true },
  });
  const releaseIds = courses.flatMap(course => course.activeReleaseId ? [course.activeReleaseId] : []);
  const releases = releaseIds.length
    ? await prisma.courseRelease.findMany({ where: { id: { in: releaseIds } }, select: { id: true, content: true } })
    : [];
  const contentById = new Map(releases.map(release => [release.id, readReleaseContent(release.content)]));
  const result = new Map<string, { slug: string; title: string; modules: Map<string, ModuleLabels> }>();
  for (const course of courses) {
    const modules = new Map<string, ModuleLabels>();
    const content = course.activeReleaseId ? contentById.get(course.activeReleaseId) ?? null : null;
    const family = resolveCourseFamily(course.familySlug, course.variantFamily);
    const variantOrder = [family?.defaultVariantSlug ?? "default", ...Object.keys(content?.variants ?? {})];
    for (const variant of variantOrder) {
      for (const module of content?.variants[variant] ?? []) {
        const key = moduleVersionKey(module);
        if (modules.has(key) || !module.versions?.length) continue;
        modules.set(key, { title: module.title, order: module.order,
          versions: versionOptions(module).map(option => ({ key: option.key, label: option.label })) });
      }
    }
    result.set(course.id, { slug: course.slug, title: course.title, modules });
  }
  return result;
}

/** Totals per course, module and version, and the notes newest first. Admin only (route guard). */
export async function loadModuleVersionFeedbackForAdmin(): Promise<AdminModuleVersionFeedbackView> {
  const rows = await prisma.moduleVersionFeedback.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, courseId: true, moduleKey: true, versionKey: true, note: true, updatedAt: true,
      user: { select: { name: true, email: true } } },
  });
  const labels = await labelsByCourse([...new Set(rows.map(row => row.courseId))]);
  const describe = (courseId: string, moduleKey: string, versionKey: string) => {
    const course = labels.get(courseId);
    const module = course?.modules.get(moduleKey);
    return {
      courseSlug: course?.slug ?? "", courseTitle: course?.title ?? "Removed course",
      moduleTitle: module?.title ?? moduleKey,
      versionLabel: module?.versions.find(version => version.key === versionKey)?.label
        ?? (versionKey === DEFAULT_MODULE_VERSION_KEY ? DEFAULT_VERSION_LABEL : versionKey),
    };
  };

  const votes = new Map<string, number>();
  const groups = new Map<string, { courseId: string; moduleKey: string; versionKeys: string[] }>();
  for (const row of rows) {
    const voteKey = `${row.courseId}\u0000${row.moduleKey}\u0000${row.versionKey}`;
    votes.set(voteKey, (votes.get(voteKey) ?? 0) + 1);
    const groupKey = `${row.courseId}\u0000${row.moduleKey}`;
    if (!groups.has(groupKey)) {
      const known = labels.get(row.courseId)?.modules.get(row.moduleKey)?.versions.map(version => version.key) ?? [];
      groups.set(groupKey, { courseId: row.courseId, moduleKey: row.moduleKey, versionKeys: [...known] });
    }
    const group = groups.get(groupKey)!;
    if (!group.versionKeys.includes(row.versionKey)) group.versionKeys.push(row.versionKey);
  }

  const totals: AdminModuleVersionTotal[] = [...groups.values()]
    .sort((a, b) => {
      const courseA = labels.get(a.courseId), courseB = labels.get(b.courseId);
      return (courseA?.title ?? "").localeCompare(courseB?.title ?? "")
        || (courseA?.modules.get(a.moduleKey)?.order ?? Infinity) - (courseB?.modules.get(b.moduleKey)?.order ?? Infinity)
        || a.moduleKey.localeCompare(b.moduleKey);
    })
    .flatMap(group => group.versionKeys.map(versionKey => ({
      courseId: group.courseId, moduleKey: group.moduleKey, versionKey,
      votes: votes.get(`${group.courseId}\u0000${group.moduleKey}\u0000${versionKey}`) ?? 0,
      ...describe(group.courseId, group.moduleKey, versionKey),
    })));

  const notes: AdminModuleVersionNote[] = rows.filter(row => row.note).slice(0, ADMIN_NOTES_LIMIT).map(row => ({
    id: row.id, moduleKey: row.moduleKey, versionKey: row.versionKey, note: row.note!,
    learnerName: row.user.name?.trim() || row.user.email.split("@")[0] || "Learner",
    updatedAt: row.updatedAt.toISOString(),
    ...describe(row.courseId, row.moduleKey, row.versionKey),
  }));

  return { totals, notes };
}
