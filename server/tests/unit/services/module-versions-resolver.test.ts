import { describe, expect, it } from "vitest";
import {
  allVersionChapters,
  applyModuleVersions,
  carryModuleVersionChoices,
  readModuleVersionChoices,
  unchosenVersionChapterIds,
  type ModuleVersionChoices,
  type ReleaseChapter,
  type ReleaseModule,
} from "../../../src/services/courses/releases.js";

const chapter = (id: string): ReleaseChapter => ({
  id, key: id, slug: id, title: id, order: 1, estimatedMinutes: null, readerMode: "DEFAULT", isMilestone: false, quizPassingScore: 70,
});
const plain: ReleaseModule = { id: "mod-1", key: "m1", title: "One", order: 1, chapters: [chapter("a"), chapter("b")] };
const versioned: ReleaseModule = {
  id: "mod-2", key: "m2", title: "Two", order: 2, chapters: [chapter("c"), chapter("d")],
  versions: [{ key: "v2", label: "Rewrite", chapters: [chapter("c2")] }], defaultVersionLabel: "Original",
};

describe("module version resolver", () => {
  it("returns the same list for a course without versions", () => {
    const modules = [plain];
    expect(applyModuleVersions(modules, { m1: "v2" })).toBe(modules);
    expect(unchosenVersionChapterIds(modules, {}).size).toBe(0);
  });

  it("uses the default lessons when nothing is chosen or the choice is unknown", () => {
    const cases: ModuleVersionChoices[] = [{}, { m2: "default" }, { m2: "v9" }];
    for (const choices of cases) {
      const [, two] = applyModuleVersions([plain, versioned], choices);
      expect(two!.chapters.map(item => item.id)).toEqual(["c", "d"]);
      expect(two).not.toHaveProperty("versions");
    }
  });

  it("swaps in the chosen version's lessons", () => {
    const [one, two] = applyModuleVersions([plain, versioned], { m2: "v2" });
    expect(one!.chapters.map(item => item.id)).toEqual(["a", "b"]);
    expect(two!.chapters.map(item => item.id)).toEqual(["c2"]);
    expect([...unchosenVersionChapterIds([plain, versioned], { m2: "v2" })].sort()).toEqual(["c", "d"]);
    expect([...unchosenVersionChapterIds([plain, versioned], {})]).toEqual(["c2"]);
  });

  it("matches a module without a content key by its id", () => {
    const keyless = { ...versioned, key: null };
    expect(applyModuleVersions([keyless], { "mod-2": "v2" })[0]!.chapters.map(item => item.id)).toEqual(["c2"]);
  });

  it("lists every chapter across versions", () => {
    expect(allVersionChapters([plain, versioned]).map(item => item.id)).toEqual(["a", "b", "c", "d", "c2"]);
  });

  it("reads only string choices", () => {
    expect(readModuleVersionChoices(null)).toEqual({});
    expect(readModuleVersionChoices(["v2"])).toEqual({});
    expect(readModuleVersionChoices({ m2: "v2", m3: 4 })).toEqual({ m2: "v2" });
  });

  it("keeps a choice only while the release still has that module and version", () => {
    const content = { variants: { default: [plain, versioned] } };
    expect(carryModuleVersionChoices(content, { m2: "v2", m1: "v2", gone: "v2" })).toEqual({ m2: "v2" });
  });
});
