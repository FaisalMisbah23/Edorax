import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ModuleVersionsItem } from "@/shared/api/module-versions";
import type { SyllabusModule } from "@/shared/api/syllabus";

const {
  ModuleVersionFeedbackCard,
  ModuleVersionSwitch,
  NOTE_COUNTER_FROM,
  currentVersion,
  feedbackCardKey,
  versionSummary,
} = await import("@buildment/learning-ui/components/learn/module-versions");
const { ChapterSidebar } = await import("@buildment/learning-ui/components/learn/chapter-sidebar");

const item: ModuleVersionsItem = {
  moduleId: "mod-2",
  moduleKey: "m2",
  moduleTitle: "Make the computer hold your list",
  moduleOrder: 2,
  versions: [
    { key: "default", label: "Original", chapterCount: 2, estimatedMinutes: 15, firstChapterSlug: "basics-one" },
    { key: "v2", label: "Rewritten: shorter and plainer", chapterCount: 1, estimatedMinutes: null, firstChapterSlug: "basics-v2-one" },
  ],
  chosenVersionKey: "v2",
  feedback: null,
};

const vote = (versionKey: string, note: string | null) => ({ versionKey, note, updatedAt: "2026-11-25T16:00:00.000Z" });

const actions = {
  choose: vi.fn(async () => {}),
  saveFeedback: vi.fn(async () => vote("v2", null)),
  removeFeedback: vi.fn(async () => {}),
};

const chapter = (id: string, slug: string, title: string) => ({ id, slug, title, order: 1, status: "NOT_STARTED" as const, blockCount: 1 });

const modules: SyllabusModule[] = [
  { id: "mod-1", order: 1, title: "Start here", completedCount: 0, chapters: [chapter("c1", "chapter-a", "Chapter A")] },
  { id: "mod-2", order: 2, title: item.moduleTitle, completedCount: 0, chapters: [chapter("c3", "basics-v2-one", "Basics, rewritten")] },
];

const sidebar = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(ChapterSidebar, {
      courseSlug: "test-course",
      courseTitle: "Test course",
      modules,
      currentChapterSlug: "basics-v2-one",
      collapsed: false,
      onToggle: () => {},
      ...props,
    })
  );

describe("module version helpers", () => {
  it("says the lesson count and the minutes when known", () => {
    expect(versionSummary(item.versions[0]!)).toBe("2 lessons, 15 min");
    expect(versionSummary(item.versions[1]!)).toBe("1 lesson");
  });

  it("picks the chosen version, falling back to the first", () => {
    expect(currentVersion(item)?.key).toBe("v2");
    expect(currentVersion({ ...item, chosenVersionKey: "gone" })?.key).toBe("default");
  });

  it("changes the card key when a newer vote arrives", () => {
    expect(feedbackCardKey({ ...item, feedback: vote("v2", null) })).not.toBe(feedbackCardKey(item));
  });
});

describe("ModuleVersionSwitch", () => {
  it("names the current version on a closed, labelled button with a visible focus ring", () => {
    const html = renderToStaticMarkup(createElement(ModuleVersionSwitch, { item, onChoose: actions.choose }));
    expect(html).toContain(
      'aria-label="Version of Make the computer hold your list: Rewritten: shorter and plainer. Change version"'
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("focus-visible:outline-brand-yellow");
  });
});

describe("ModuleVersionFeedbackCard", () => {
  it("asks the question with one thumbs-up button per version and no vote picked", () => {
    const html = renderToStaticMarkup(createElement(ModuleVersionFeedbackCard, { item, actions }));
    expect(html).toContain("Which version of this module was better?");
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toContain('maxLength="2000"');
    expect(html).not.toContain("Remove my vote");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/);
  });

  it("starts from the saved vote and offers to remove it", () => {
    const html = renderToStaticMarkup(
      createElement(ModuleVersionFeedbackCard, { item: { ...item, feedback: vote("default", "Clearer examples.") }, actions })
    );
    expect(html).toContain("You voted for Original.");
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*?Original/);
    expect(html).toContain("Clearer examples.");
    expect(html).toContain("Remove my vote");
    expect(html).toContain("Save changes");
  });

  it("shows the counter only near the limit", () => {
    const short = renderToStaticMarkup(createElement(ModuleVersionFeedbackCard, { item: { ...item, feedback: vote("v2", "ok") }, actions }));
    expect(short).not.toMatch(/\d(<!-- -->)?\/(<!-- -->)?2000</);
    const long = renderToStaticMarkup(
      createElement(ModuleVersionFeedbackCard, { item: { ...item, feedback: vote("v2", "x".repeat(NOTE_COUNTER_FROM)) }, actions })
    );
    expect(long).toMatch(new RegExp(`${NOTE_COUNTER_FROM}(<!-- -->)?/(<!-- -->)?2000`));
  });
});

describe("ChapterSidebar with module versions", () => {
  it("shows the switch and the card only on the module that has versions", () => {
    const html = sidebar({ moduleVersions: [item], moduleVersionActions: actions });
    expect(html.match(/Change version/g)).toHaveLength(1);
    expect(html).toContain("Which version of this module was better?");
  });

  it("looks the same as before without version data or without actions", () => {
    expect(sidebar({})).not.toContain("Version:");
    expect(sidebar({ moduleVersions: [item] })).not.toContain("Version:");
    expect(sidebar({ moduleVersions: [], moduleVersionActions: actions })).not.toContain("Which version");
  });
});
