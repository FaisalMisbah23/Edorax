import { describe, expect, it } from "vitest";
import { readStoredDraft } from "../../../../../src/services/teach/ai/auto-draft.js";

const draft = {
  summary: "Good start.",
  strengths: ["Clear choice."],
  improvements: ["Compare one alternative."],
  feedback: "Add one alternative and say why it was weaker.",
  suggestedVerdict: "NEEDS_REVISION",
  suggestedScore: 3,
  confidence: "MEDIUM",
};

describe("readStoredDraft", () => {
  it("returns a saved draft with its model", () => {
    expect(readStoredDraft(draft, "claude-haiku-5-5")).toEqual({ draft, model: "claude-haiku-5-5", costUsd: null });
    expect(readStoredDraft(draft, "claude-haiku-5-5", 1200)?.costUsd).toBe(0.0012);
  });

  it("ignores a missing model, a missing draft or a malformed one", () => {
    expect(readStoredDraft(draft, null)).toBeNull();
    expect(readStoredDraft(null, "claude-haiku-5-5")).toBeNull();
    expect(readStoredDraft({ ...draft, suggestedVerdict: "MAYBE" }, "claude-haiku-5-5")).toBeNull();
  });
});
