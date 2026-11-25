import type {
  AdminModuleVersionFeedbackView,
  AdminModuleVersionNote,
  AdminModuleVersionTotal,
} from "@/shared/api/module-versions";

// Helpers for the admin "Agent IP feedback" page: learners' votes on which version of a module
// was better, grouped for reading and written out as plain text for the course factory.

export type ModuleVoteGroup = {
  courseSlug: string;
  courseTitle: string;
  moduleKey: string;
  moduleTitle: string;
  totalVotes: number;
  versions: { versionKey: string; versionLabel: string; votes: number }[];
};

export type FeedbackCourse = { slug: string; title: string };

/** Group the flat totals into one entry per course and module, keeping the server's order. */
export function groupVoteTotals(totals: AdminModuleVersionTotal[]): ModuleVoteGroup[] {
  const groups = new Map<string, ModuleVoteGroup>();
  for (const row of totals) {
    const id = `${row.courseSlug}\u0000${row.moduleKey}`;
    let group = groups.get(id);
    if (!group) {
      group = {
        courseSlug: row.courseSlug,
        courseTitle: row.courseTitle,
        moduleKey: row.moduleKey,
        moduleTitle: row.moduleTitle,
        totalVotes: 0,
        versions: [],
      };
      groups.set(id, group);
    }
    group.versions.push({ versionKey: row.versionKey, versionLabel: row.versionLabel, votes: row.votes });
    group.totalVotes += row.votes;
  }
  return [...groups.values()];
}

/** Every course that has votes or notes, by title, for the course filter. */
export function feedbackCourses(view: AdminModuleVersionFeedbackView): FeedbackCourse[] {
  const courses = new Map<string, string>();
  for (const row of [...view.totals, ...view.notes]) courses.set(row.courseSlug, row.courseTitle);
  return [...courses.entries()]
    .map(([slug, title]) => ({ slug, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** The view limited to one course, or the whole view when no course is picked. */
export function filterByCourse(view: AdminModuleVersionFeedbackView, courseSlug: string | null): AdminModuleVersionFeedbackView {
  if (!courseSlug) return view;
  return {
    totals: view.totals.filter((row) => row.courseSlug === courseSlug),
    notes: view.notes.filter((row) => row.courseSlug === courseSlug),
  };
}

export function noteDate(note: Pick<AdminModuleVersionNote, "updatedAt">): string {
  return new Date(note.updatedAt).toISOString().slice(0, 10);
}

const votesWord = (count: number) => `${count} ${count === 1 ? "vote" : "votes"}`;

/** A plain-text summary to paste into the course factory notes. */
export function feedbackAsText(view: AdminModuleVersionFeedbackView): string {
  const groups = groupVoteTotals(view.totals);
  const lines: string[] = ["Agent IP feedback: which module version learners found better", ""];
  if (!groups.length && !view.notes.length) {
    lines.push("No votes yet.");
    return lines.join("\n");
  }
  if (groups.length) {
    lines.push("Votes");
    for (const group of groups) {
      lines.push(`${group.courseTitle} > ${group.moduleTitle} (${votesWord(group.totalVotes)})`);
      for (const version of group.versions) lines.push(`  ${version.versionLabel}: ${votesWord(version.votes)}`);
    }
    lines.push("");
  }
  if (view.notes.length) {
    lines.push("Notes, newest first");
    view.notes.forEach((note, index) => {
      lines.push(`${index + 1}. ${note.courseTitle} > ${note.moduleTitle}`);
      lines.push(`   Preferred: ${note.versionLabel}`);
      lines.push(`   From: ${note.learnerName} on ${noteDate(note)}`);
      lines.push(`   Note: ${note.note}`);
    });
  }
  return lines.join("\n").trimEnd();
}
