import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_ERROR_CODES, ANNOUNCEMENT_LIMITS } from "@/shared/api/course-announcements";
import {
  announcementProblems,
  announcementReducer,
  announcementSendErrorMessage,
  blankAnnouncement,
  characterCount,
  isAppPath,
  learnerCountLabel,
  moduleVersionAnnouncement,
  screenshotFileProblem,
  starterAnnouncement,
  toAnnouncementDraft,
  type AnnouncementForm,
} from "@/lib/course-announcements";

const filled = (): AnnouncementForm => ({ ...blankAnnouncement("dw-level-1"), title: "Hello", message: "Something changed." });

describe("announcement starters", () => {
  it("the module version starter fills the form with three steps and a button to the course", () => {
    const form = moduleVersionAnnouncement("dw-level-1");
    expect(form.title).toBe("A new version of a module is ready");
    expect(form.steps).toEqual([
      "Open the module in the course.",
      "Click Version under the module title.",
      "Pick the rewritten version. Your progress is kept, and you can switch back any time.",
    ]);
    expect(form.ctaLabel).toBe("Open the course");
    expect(form.ctaPath).toBe("/courses/dw-level-1");
    expect(form.message).toContain("Which version of this module was better?");
    expect(form.message.split("\n\n")).toHaveLength(2);
    expect(announcementProblems(form)).toEqual([]);
  });

  it("the blank starter keeps only the button", () => {
    const form = starterAnnouncement("blank", "dw-level-1");
    expect(form).toMatchObject({ title: "", message: "", steps: [], images: [], ctaPath: "/courses/dw-level-1" });
  });

  it("no starter text has an em or en dash", () => {
    const text = JSON.stringify(moduleVersionAnnouncement("x"));
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("announcementReducer", () => {
  it("adds steps up to the limit and no more", () => {
    let form = filled();
    for (let index = 0; index < ANNOUNCEMENT_LIMITS.steps + 2; index++) form = announcementReducer(form, { type: "addStep" });
    expect(form.steps).toHaveLength(ANNOUNCEMENT_LIMITS.steps);
  });

  it("edits, moves and removes a step", () => {
    let form = { ...filled(), steps: ["a", "b", "c"] };
    form = announcementReducer(form, { type: "setStep", index: 1, value: "B" });
    expect(form.steps).toEqual(["a", "B", "c"]);
    form = announcementReducer(form, { type: "moveStep", index: 1, by: -1 });
    expect(form.steps).toEqual(["B", "a", "c"]);
    form = announcementReducer(form, { type: "moveStep", index: 2, by: 1 });
    expect(form.steps).toEqual(["B", "a", "c"]);
    form = announcementReducer(form, { type: "moveStep", index: 0, by: -1 });
    expect(form.steps).toEqual(["B", "a", "c"]);
    form = announcementReducer(form, { type: "removeStep", index: 0 });
    expect(form.steps).toEqual(["a", "c"]);
  });

  it("keeps at most three screenshots and ignores a repeat", () => {
    let form = filled();
    for (const url of ["/a.png", "/a.png", "/b.png", "/c.png", "/d.png"]) form = announcementReducer(form, { type: "addImage", url });
    expect(form.images).toEqual(["/a.png", "/b.png", "/c.png"]);
    form = announcementReducer(form, { type: "removeImage", index: 1 });
    expect(form.images).toEqual(["/a.png", "/c.png"]);
  });

  it("sets a field and resets the whole form", () => {
    const form = announcementReducer(filled(), { type: "set", field: "ctaLabel", value: "Go" });
    expect(form.ctaLabel).toBe("Go");
    expect(announcementReducer(form, { type: "reset", form: blankAnnouncement("x") }).title).toBe("");
  });
});

describe("toAnnouncementDraft and announcementProblems", () => {
  it("trims text and leaves out empty steps", () => {
    const draft = toAnnouncementDraft({ ...filled(), title: "  Hi  ", steps: [" one ", "  ", ""] });
    expect(draft.title).toBe("Hi");
    expect(draft.steps).toEqual(["one"]);
  });

  it("names every missing or too long field", () => {
    const form: AnnouncementForm = {
      title: " ",
      message: "x".repeat(ANNOUNCEMENT_LIMITS.message + 1),
      steps: ["y".repeat(ANNOUNCEMENT_LIMITS.step + 1)],
      images: [],
      ctaLabel: "",
      ctaPath: "https://example.com",
    };
    expect(announcementProblems(form)).toEqual([
      "Add a title.",
      `The message can have at most ${ANNOUNCEMENT_LIMITS.message} characters.`,
      `Each step can have at most ${ANNOUNCEMENT_LIMITS.step} characters.`,
      "Name the button.",
      "Use a button path inside the app, such as /courses/your-course.",
    ]);
  });

  it("accepts only paths inside the app", () => {
    expect(isAppPath("/courses/a")).toBe(true);
    expect(isAppPath("//evil.example")).toBe(false);
    expect(isAppPath("courses/a")).toBe(false);
    expect(isAppPath("/a b")).toBe(false);
  });
});

describe("small helpers", () => {
  it("counts trimmed characters against a limit", () => {
    expect(characterCount(" abc ", 5)).toEqual({ text: "3 / 5", over: false });
    expect(characterCount("abcdef", 5)).toEqual({ text: "6 / 5", over: true });
  });

  it("checks screenshot files", () => {
    expect(screenshotFileProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(screenshotFileProblem({ type: "image/webp", size: 1000 })).toBeNull();
    expect(screenshotFileProblem({ type: "image/gif", size: 1000 })).toBe("Choose a PNG, JPG or WebP image.");
    expect(screenshotFileProblem({ type: "image/jpeg", size: 0 })).toBe("That file is empty. Choose another image.");
    expect(screenshotFileProblem({ type: "image/jpeg", size: 8 * 1024 * 1024 + 1 })).toBe("Choose an image smaller than 8 MB.");
  });

  it("explains each send error in plain words", () => {
    expect(announcementSendErrorMessage(ANNOUNCEMENT_ERROR_CODES.AUDIENCE_CHANGED)).toMatch(/Refresh the preview/);
    expect(announcementSendErrorMessage(ANNOUNCEMENT_ERROR_CODES.ALREADY_SENT)).toMatch(/already sent a moment ago/);
    expect(announcementSendErrorMessage(ANNOUNCEMENT_ERROR_CODES.COURSE_NOT_PUBLISHED)).toMatch(/not published/);
    expect(announcementSendErrorMessage(ANNOUNCEMENT_ERROR_CODES.NO_RECIPIENTS)).toMatch(/Nobody is enrolled/);
    expect(announcementSendErrorMessage("OTHER", "Server said no.")).toBe("Server said no.");
    expect(announcementSendErrorMessage(undefined)).toBe("The announcement was not sent. Please try again.");
  });

  it("says learner or learners", () => {
    expect(learnerCountLabel(1)).toBe("1 learner");
    expect(learnerCountLabel(3)).toBe("3 learners");
  });
});
