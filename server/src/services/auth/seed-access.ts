import { isSeedTestEmail } from "../../shared/lib/seed-data.js";
import { isProduction } from "../../config/env.js";
import { isCourseInstructor } from "../enrollment/own-course.js";

/** Local dev only: seed mentees/mentor can open any chapter and submit blocks without waiting on gating. */
export function bypassProgressGatingForEmail(email: string): boolean {
  return !isProduction && isSeedTestEmail(email);
}

/**
 * Sequential chapter locks are skipped for:
 * - local seed test emails (dev only), or
 * - accounts an admin marked as tester (still a normal learner otherwise).
 */
export function shouldBypassProgressGating(user: {
  email: string;
  testerEnabled?: boolean;
}): boolean {
  return Boolean(user.testerEnabled) || bypassProgressGatingForEmail(user.email);
}

/**
 * The same as shouldBypassProgressGating, and also true for the instructor of the course. An instructor
 * opens their own course in preview, so they can open any chapter and check any block without finishing
 * the ones before it. Learners and other mentors stay gated.
 */
export function shouldBypassProgressGatingForCourse(
  user: { id: string; email: string; testerEnabled?: boolean },
  course: { mentorId: string }
): boolean {
  return shouldBypassProgressGating(user) || isCourseInstructor(user.id, course);
}
