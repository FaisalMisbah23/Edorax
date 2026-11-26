import { beforeEach, describe, expect, it, vi } from "vitest";

const serverApiFetch = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api-server", () => ({ serverApiFetch }));

const { ApiError } = await import("@/lib/api-client");
const {
  chooseModuleVersionAction,
  removeModuleVersionFeedbackAction,
  saveModuleVersionFeedbackAction,
} = await import("@/server/actions/module-versions");
const { moduleVersionActionsFor } = await import("@/components/learn/module-version-actions");
const { loadModuleVersions } = await import("@/lib/module-versions");

const chosen = { courseSlug: "test-course", moduleKey: "m2", chosenVersionKey: "v2", firstChapterSlug: "basics-v2-one", percentComplete: 33, chaptersCompleted: 1 };
const feedback = { versionKey: "v2", note: "Shorter.", updatedAt: "2026-11-25T16:00:00.000Z" };

beforeEach(() => {
  serverApiFetch.mockReset();
  revalidatePath.mockClear();
});

describe("module version server actions", () => {
  it("chooses a version with a PUT and does not re-render the old chapter", async () => {
    serverApiFetch.mockResolvedValue(chosen);
    const result = await chooseModuleVersionAction({ courseSlug: "test-course", moduleKey: "m2", versionKey: "v2" });
    expect(result).toEqual({ ok: true, data: chosen });
    expect(serverApiFetch).toHaveBeenCalledWith("/api/v1/courses/test-course/modules/m2/version", { method: "PUT", json: { versionKey: "v2" } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the API message instead of throwing, and refreshes nothing", async () => {
    serverApiFetch.mockRejectedValue(new ApiError("Version not found for this module.", 404, "MODULE_VERSION_NOT_FOUND"));
    const result = await chooseModuleVersionAction({ courseSlug: "test-course", moduleKey: "m2", versionKey: "v9" });
    expect(result).toEqual({ ok: false, error: "Version not found for this module." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("still throws errors that are not API errors", async () => {
    serverApiFetch.mockRejectedValue(new TypeError("fetch failed"));
    await expect(chooseModuleVersionAction({ courseSlug: "c", moduleKey: "m", versionKey: "v" })).rejects.toThrow("fetch failed");
  });

  it("saves and removes a vote on the feedback path", async () => {
    serverApiFetch.mockResolvedValueOnce({ courseSlug: "test-course", moduleKey: "m2", feedback });
    await saveModuleVersionFeedbackAction({ courseSlug: "test-course", moduleKey: "m2", versionKey: "v2", note: "Shorter." });
    expect(serverApiFetch).toHaveBeenLastCalledWith("/api/v1/courses/test-course/modules/m2/version-feedback", {
      method: "PUT",
      json: { versionKey: "v2", note: "Shorter." },
    });

    serverApiFetch.mockResolvedValueOnce({ courseSlug: "test-course", moduleKey: "m2", feedback: null });
    const removed = await removeModuleVersionFeedbackAction({ courseSlug: "test-course", moduleKey: "m2" });
    expect(removed).toEqual({ ok: true, data: { courseSlug: "test-course", moduleKey: "m2", feedback: null } });
    expect(serverApiFetch).toHaveBeenLastCalledWith("/api/v1/courses/test-course/modules/m2/version-feedback", { method: "DELETE" });
  });

  it("escapes module keys in the path", async () => {
    serverApiFetch.mockResolvedValue(chosen);
    await chooseModuleVersionAction({ courseSlug: "test-course", moduleKey: "a/b", versionKey: "v2" });
    expect(serverApiFetch.mock.calls[0]![0]).toBe("/api/v1/courses/test-course/modules/a%2Fb/version");
  });
});

describe("loadModuleVersions", () => {
  it("returns the modules, and an empty list when the call fails", async () => {
    serverApiFetch.mockResolvedValueOnce({ courseSlug: "test-course", modules: [{ moduleKey: "m2" }] });
    expect(await loadModuleVersions("test-course")).toEqual([{ moduleKey: "m2" }]);
    expect(serverApiFetch).toHaveBeenLastCalledWith("/api/v1/courses/test-course/module-versions");
    serverApiFetch.mockRejectedValueOnce(new ApiError("Not enrolled", 403, "FORBIDDEN"));
    expect(await loadModuleVersions("test-course")).toEqual([]);
  });
});

describe("moduleVersionActionsFor", () => {
  const router = () => ({ push: vi.fn(), refresh: vi.fn() });

  it("opens the first chapter of the chosen version", async () => {
    const nav = router();
    const choose = vi.fn().mockResolvedValue({ ok: true, data: chosen });
    const actions = moduleVersionActionsFor("test-course", nav, { choose, save: vi.fn(), remove: vi.fn() });
    await actions.choose("m2", "v2");
    expect(choose).toHaveBeenCalledWith({ courseSlug: "test-course", moduleKey: "m2", versionKey: "v2" });
    expect(nav.push).toHaveBeenCalledWith("/courses/test-course/basics-v2-one");
  });

  it("refreshes when the version has no chapters, and throws the message on failure", async () => {
    const nav = router();
    const choose = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { ...chosen, firstChapterSlug: null } })
      .mockResolvedValueOnce({ ok: false, error: "Module not found in this course." });
    const actions = moduleVersionActionsFor("test-course", nav, { choose, save: vi.fn(), remove: vi.fn() });
    await actions.choose("m2", "v2");
    expect(nav.refresh).toHaveBeenCalled();
    await expect(actions.choose("m2", "v2")).rejects.toThrow("Module not found in this course.");
  });

  it("returns the saved vote and passes removal failures through", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, data: { courseSlug: "test-course", moduleKey: "m2", feedback } });
    const remove = vi.fn().mockResolvedValue({ ok: false, error: "Not enrolled" });
    const actions = moduleVersionActionsFor("test-course", router(), { choose: vi.fn(), save, remove });
    expect(await actions.saveFeedback("m2", "v2", "Shorter.")).toEqual(feedback);
    expect(save).toHaveBeenCalledWith({ courseSlug: "test-course", moduleKey: "m2", versionKey: "v2", note: "Shorter." });
    await expect(actions.removeFeedback("m2")).rejects.toThrow("Not enrolled");
  });
});
