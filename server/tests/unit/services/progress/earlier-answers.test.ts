import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  course: vi.fn(),
  chapters: vi.fn(),
  progress: vi.fn(),
  responses: vi.fn(),
}));
vi.mock("../../../../src/db/prisma.js", () => ({
  prisma: {
    course: { findUnique: mocks.course },
    chapter: { findMany: mocks.chapters },
    chapterProgress: { findMany: mocks.progress },
    response: { findMany: mocks.responses },
  },
}));

import { collectEarlierAnswers } from "../../../../src/services/progress/earlier-answers.js";

const base = { courseId: "c1", userId: "u1", enrollmentId: "e1", variantSlug: null, beforeOrder: 5 };

describe("collectEarlierAnswers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.course.mockResolvedValue({ familySlug: null, variantFamily: null });
  });

  it("joins learning-log answers and open-question answers per chapter, skipping chapters with none", async () => {
    mocks.chapters.mockResolvedValue([
      { id: "ch1", slug: "01-01", title: "Start", source: `<LearningLog questions={[{"id":"q-1","title":"What is your goal?"},{"id":"q-2","title":"Blank one"}]} />` },
      { id: "ch2", slug: "01-02", title: "Quiet chapter", source: "# nothing" },
    ]);
    mocks.progress.mockResolvedValue([
      { chapterId: "ch1", learningLog: { version: 1, answers: { "q-1": { text: "  Ship a small API  ", updatedAt: "2026-11-01T00:00:00.000Z" }, "q-2": { text: "   ", updatedAt: "x" } } } },
    ]);
    mocks.responses.mockResolvedValue([
      { blockId: "b1", payload: { text: "Because it is simple" }, submittedAt: new Date("2026-11-02T00:00:00.000Z"), block: { chapterId: "ch1", order: 3, config: { prompt: "Why one repo?" } } },
    ]);

    const result = await collectEarlierAnswers(base);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ chapterId: "ch1", chapterSlug: "01-01", chapterTitle: "Start" });
    expect(result[0]!.answers).toEqual([
      { id: "q-1", kind: "learning_log", question: "What is your goal?", answer: "Ship a small API", answeredAt: "2026-11-01T00:00:00.000Z" },
      { id: "b1", kind: "open_question", question: "Why one repo?", answer: "Because it is simple", answeredAt: "2026-11-02T00:00:00.000Z" },
    ]);
  });

  it("asks only for earlier chapters and honours the author's chapter list", async () => {
    mocks.chapters.mockResolvedValue([]);
    await collectEarlierAnswers({ ...base, chapterSlugs: ["01-01"] });
    expect(mocks.chapters.mock.calls[0]![0].where).toMatchObject({ courseId: "c1", order: { lt: 5 }, slug: { in: ["01-01"] } });
    expect(mocks.progress).not.toHaveBeenCalled();
  });
});
