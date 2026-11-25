import { describe, expect, it } from "vitest";
import { shouldBypassProgressGating, shouldBypassProgressGatingForCourse } from "../../../../src/services/auth/seed-access.js";

describe("shouldBypassProgressGating", () => {
  it("lets admin-marked testers skip sequential locks", () => {
    expect(shouldBypassProgressGating({ email: "learner@example.com", testerEnabled: true })).toBe(true);
  });

  it("keeps ordinary learners gated", () => {
    expect(shouldBypassProgressGating({ email: "learner@example.com", testerEnabled: false })).toBe(false);
  });
});

describe("shouldBypassProgressGatingForCourse", () => {
  const owner = { id: "u-owner", email: "owner@example.com" };
  const course = { mentorId: "u-owner" };

  it("lets the instructor of the course skip sequential locks", () => {
    expect(shouldBypassProgressGatingForCourse(owner, course)).toBe(true);
  });

  it("keeps other learners and mentors gated on that course", () => {
    expect(shouldBypassProgressGatingForCourse({ id: "u-other", email: "other@example.com" }, course)).toBe(false);
  });

  it("still lets admin-marked testers skip locks on any course", () => {
    expect(shouldBypassProgressGatingForCourse({ id: "u-other", email: "other@example.com", testerEnabled: true }, course)).toBe(true);
  });
});
