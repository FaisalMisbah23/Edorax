import { beforeEach, describe, expect, it, vi } from "vitest";

const courseRow = vi.fn();
const enrollmentRow = vi.fn();
const progressRows = vi.fn();

vi.mock("../../../../src/db/prisma.js", () => ({
  prisma: {
    course: { findUnique: (...args: unknown[]) => courseRow(...args) },
    enrollment: { findUniqueOrThrow: (...args: unknown[]) => enrollmentRow(...args) },
    chapterProgress: { findMany: (...args: unknown[]) => progressRows(...args) },
  },
}));
vi.mock("../../../../src/services/courses/releases.js", () => ({ releaseForEnrollment: vi.fn(async () => null) }));

import { ChapterLockedError, assertChapterUnlocked, loadCourseGate } from "../../../../src/services/progress/gate.js";

const modules = [
  { order: 1, chapters: [{ id: "c1", order: 1, slug: "one", title: "One" }, { id: "c2", order: 2, slug: "two", title: "Two" }, { id: "c3", order: 3, slug: "three", title: "Three" }] },
];

describe("sequential locks and the course instructor", () => {
  beforeEach(() => {
    courseRow.mockResolvedValue({ sequential: true, mentorId: "owner", familySlug: null, modules });
    progressRows.mockResolvedValue([]);
  });

  it("locks every chapter after the first for a learner who has finished nothing", async () => {
    enrollmentRow.mockResolvedValue({ userId: "learner", releaseId: null, variantSlug: null, moduleVersions: null });
    const gate = await loadCourseGate("course", "enrollment");
    expect([...gate!.lockedIds]).toEqual(["c2", "c3"]);
    await expect(
      assertChapterUnlocked({ courseId: "course", enrollmentId: "enrollment", chapterId: "c2" })
    ).rejects.toBeInstanceOf(ChapterLockedError);
  });

  it("locks nothing for the instructor of the course", async () => {
    enrollmentRow.mockResolvedValue({ userId: "owner", releaseId: null, variantSlug: null, moduleVersions: null });
    const gate = await loadCourseGate("course", "enrollment");
    expect(gate!.lockedIds.size).toBe(0);
    await expect(
      assertChapterUnlocked({ courseId: "course", enrollmentId: "enrollment", chapterId: "c3" })
    ).resolves.toBeUndefined();
  });
});
