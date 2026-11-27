import type { TeachLinks } from "../../shared/api/teach.js";

/** Links from a help thread to its course, its lesson and the learner, so no name is a dead end. */
export function teachLinks(input: { courseSlug: string; chapterId: string | null; learnerId: string }): TeachLinks {
  const course = `/courses/${encodeURIComponent(input.courseSlug)}`;
  return {
    courseHref: course,
    chapterHref: input.chapterId ? `${course}/preview?chapter=${encodeURIComponent(input.chapterId)}` : null,
    learnerHref: `/learners/${encodeURIComponent(input.learnerId)}`,
  };
}
