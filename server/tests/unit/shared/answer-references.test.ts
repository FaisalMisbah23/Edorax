import { describe, expect, it } from "vitest";
import {
  keepKnownReferences,
  referencedKeys,
  splitAnswerReferences,
  stripAnswerReferences,
} from "../../../src/shared/lib/answer-references.js";

describe("answer references", () => {
  const prompt = "You wrote [[a1|a habit tracker]] and later [[a2|a recipe site]]. Which first?";

  it("splits a prompt into text and reference spans", () => {
    expect(splitAnswerReferences(prompt)).toEqual([
      { type: "text", text: "You wrote " },
      { type: "ref", key: "a1", text: "a habit tracker" },
      { type: "text", text: " and later " },
      { type: "ref", key: "a2", text: "a recipe site" },
      { type: "text", text: ". Which first?" },
    ]);
  });

  it("leaves plain text alone, including stray brackets", () => {
    expect(splitAnswerReferences("Use [[x]] or [y]")).toEqual([{ type: "text", text: "Use [[x]] or [y]" }]);
  });

  it("strips markers to plain words", () => {
    expect(stripAnswerReferences(prompt)).toBe("You wrote a habit tracker and later a recipe site. Which first?");
  });

  it("drops markers whose key is not known and lists the keys that are used", () => {
    const kept = keepKnownReferences(prompt, new Set(["a1"]));
    expect(kept).toBe("You wrote [[a1|a habit tracker]] and later a recipe site. Which first?");
    expect(referencedKeys(kept)).toEqual(["a1"]);
  });
});
