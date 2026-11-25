import { describe, expect, it } from "vitest";
import { crossModuleAddressClashes, withoutSupersededChapters, type ReleaseModule } from "../../../src/services/courses/releases.js";

// A lesson address names its module ("2-1-set-the-scene" is lesson 1 of module 2). A leftover
// chapter in a later module with the same address must not hide the lesson that owns it.

const chapter = (id: string, slug: string, title = id) => ({ id, key: null, slug, title, order: 1, estimatedMinutes: null, readerMode: "STANDARD", quizPassingScore: 70, isMilestone: false });
const module = (id: string, order: number, title: string, chapters: ReturnType<typeof chapter>[]): ReleaseModule =>
  ({ id, key: null, title, order, chapters } as ReleaseModule);

describe("two chapters at one lesson address", () => {
  const owner = chapter("c-owner", "2-1-set-the-scene", "Set the scene: will it fit?");
  const leftover = chapter("c-leftover", "2-1-set-the-scene", "Set the scene: two clocks disagree");
  const numbers = module("m2", 2, "Numbers", [owner, chapter("c-2-2", "2-2-latency")]);
  const clocks = module("m10", 10, "Time and clocks", [leftover, chapter("c-10-1", "10-1-set-the-scene-which-came-first")]);

  it("keeps the lesson in the module the address names, not the later leftover", () => {
    const [kept2, kept10] = withoutSupersededChapters([numbers, clocks]);
    expect(kept2.chapters.map(item => item.id)).toEqual(["c-owner", "c-2-2"]);
    expect(kept10.chapters.map(item => item.id)).toEqual(["c-10-1"]);
  });

  it("gives the same answer whichever module comes first in the list", () => {
    const [kept10, kept2] = withoutSupersededChapters([clocks, numbers]);
    expect(kept2.chapters.map(item => item.id)).toEqual(["c-owner", "c-2-2"]);
    expect(kept10.chapters.map(item => item.id)).toEqual(["c-10-1"]);
  });

  it("still lets the later entry replace an earlier one in the same module", () => {
    const older = chapter("c-old", "2-3-estimate");
    const newer = chapter("c-new", "2-3-estimate");
    const [only] = withoutSupersededChapters([module("m2", 2, "Numbers", [older, newer])]);
    expect(only.chapters.map(item => item.id)).toEqual(["c-new"]);
  });

  it("falls back to the later entry when no module matches the address", () => {
    const a = chapter("c-a", "7-1-intro");
    const b = chapter("c-b", "7-1-intro");
    const [first, second] = withoutSupersededChapters([module("m3", 3, "Three", [a]), module("m4", 4, "Four", [b])]);
    expect(first.chapters).toEqual([]);
    expect(second.chapters.map(item => item.id)).toEqual(["c-b"]);
  });

  it("leaves a release with no repeated address untouched", () => {
    const modules = [numbers, module("m10", 10, "Time and clocks", [chapter("c-10-1", "10-1-set-the-scene-which-came-first")])];
    expect(withoutSupersededChapters(modules)).toBe(modules);
  });

  it("reports an address held by two modules, and not a repeat inside one module", () => {
    expect(crossModuleAddressClashes([numbers, clocks])).toEqual([{ slug: "2-1-set-the-scene", modules: ["Numbers", "Time and clocks"] }]);
    expect(crossModuleAddressClashes([module("m2", 2, "Numbers", [chapter("a", "2-3-x"), chapter("b", "2-3-x")])])).toEqual([]);
  });
});
