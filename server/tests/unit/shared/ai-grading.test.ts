import { describe, expect, it } from "vitest";
import {
  NO_AI_GRADING_OVERRIDES,
  aiGradingModelLabel,
  isAiGradingModel,
  platformAiGradingDefaults,
  resolveAiGrading,
  resolveAiGradingDefaults,
} from "../../../src/shared/lib/ai-grading.js";

// The fallback order for every AI grading setting: the course's own value, then the
// course owner's default, then the platform (environment) default.

const platform = platformAiGradingDefaults("claude-haiku-5-5");

describe("resolveAiGrading", () => {
  it("uses the platform default when neither the course nor its owner chose", () => {
    expect(resolveAiGrading(NO_AI_GRADING_OVERRIDES, null, platform)).toEqual({ reviewDraft: true, instantGrading: false, model: "claude-haiku-5-5" });
    expect(resolveAiGrading(null, undefined, platform)).toEqual(platform);
  });

  it("uses the owner's default over the platform default", () => {
    const owner = { reviewDraft: false, instantGrading: true, model: "claude-sonnet-5-5" };
    expect(resolveAiGrading(NO_AI_GRADING_OVERRIDES, owner, platform)).toEqual(owner);
  });

  it("uses the course's own value over the owner's default, one setting at a time", () => {
    const owner = { reviewDraft: true, instantGrading: true, model: "claude-haiku-5-5" };
    expect(resolveAiGrading({ reviewDraft: false, instantGrading: null, model: "claude-sonnet-5-5" }, owner, platform)).toEqual({
      reviewDraft: false,
      instantGrading: true,
      model: "claude-sonnet-5-5",
    });
  });

  it("keeps an explicit off on the course even when the default is on", () => {
    const owner = { reviewDraft: true, instantGrading: true, model: "claude-haiku-5-5" };
    expect(resolveAiGrading({ reviewDraft: false, instantGrading: false, model: null }, owner, platform)).toMatchObject({ reviewDraft: false, instantGrading: false });
  });

  it("ignores a stored model outside the allowed list and falls through", () => {
    const owner = { reviewDraft: true, instantGrading: false, model: "claude-sonnet-5-5" };
    expect(resolveAiGrading({ ...NO_AI_GRADING_OVERRIDES, model: "claude-opus-5-5" }, owner, platform).model).toBe("claude-sonnet-5-5");
    expect(resolveAiGrading(NO_AI_GRADING_OVERRIDES, { ...owner, model: "gpt-something" }, platform).model).toBe("claude-haiku-5-5");
  });

  it("passes the environment model through as the last fallback, whatever it is", () => {
    expect(resolveAiGrading(NO_AI_GRADING_OVERRIDES, null, platformAiGradingDefaults("claude-custom")).model).toBe("claude-custom");
  });
});

describe("resolveAiGradingDefaults", () => {
  it("fills what the owner has not set from the platform", () => {
    expect(resolveAiGradingDefaults({ instantGrading: true }, platform)).toEqual({ reviewDraft: true, instantGrading: true, model: "claude-haiku-5-5" });
  });
});

describe("allowed models", () => {
  it("accepts only Haiku and Sonnet", () => {
    expect(isAiGradingModel("claude-haiku-5-5")).toBe(true);
    expect(isAiGradingModel("claude-sonnet-5-5")).toBe(true);
    expect(isAiGradingModel("claude-opus-5-5")).toBe(false);
    expect(isAiGradingModel(null)).toBe(false);
  });

  it("labels models in plain words", () => {
    expect(aiGradingModelLabel("claude-haiku-5-5")).toBe("Haiku");
    expect(aiGradingModelLabel("something-else")).toBe("something-else");
  });
});
