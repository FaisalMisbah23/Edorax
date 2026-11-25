import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminModuleVersionFeedbackView } from "@/shared/api/module-versions";

const serverApiFetch = vi.fn();
const requireRole = vi.fn(async () => ({ id: "admin", role: "ADMIN" }));
vi.mock("@/lib/api-server", () => ({ serverApiFetch }));
vi.mock("@/server/auth/guards", () => ({ requireRole }));

const { feedbackAsText, feedbackCourses, filterByCourse, groupVoteTotals } = await import("@/lib/agent-ip-feedback");
const { default: AgentIpFeedbackPage } = await import("@/app/(admin)/admin/agent-ip-feedback/page");

const total = (courseSlug: string, courseTitle: string, versionKey: string, versionLabel: string, votes: number) => ({
  courseId: courseSlug,
  courseSlug,
  courseTitle,
  moduleKey: "m2",
  moduleTitle: "Module 2",
  versionKey,
  versionLabel,
  votes,
});

const view: AdminModuleVersionFeedbackView = {
  totals: [
    total("python", "Python basics", "default", "Original", 1),
    total("python", "Python basics", "v2", "Rewritten: shorter and plainer", 3),
    total("agents", "Agents in practice", "default", "Original", 0),
    total("agents", "Agents in practice", "v2", "Rewritten", 1),
  ],
  notes: [
    {
      id: "n2", courseSlug: "python", courseTitle: "Python basics", moduleKey: "m2", moduleTitle: "Module 2", versionKey: "v2",
      versionLabel: "Rewritten: shorter and plainer", note: "Shorter and clearer.", learnerName: "Sara", updatedAt: "2026-11-25T16:00:00.000Z",
    },
    {
      id: "n1", courseSlug: "agents", courseTitle: "Agents in practice", moduleKey: "m2", moduleTitle: "Module 2", versionKey: "v2",
      versionLabel: "Rewritten", note: "Liked the examples.", learnerName: "Ali", updatedAt: "2026-11-24T09:00:00.000Z",
    },
  ],
};

const renderPage = async (course?: string) =>
  renderToStaticMarkup(await AgentIpFeedbackPage({ searchParams: Promise.resolve({ course }) }));

describe("agent IP feedback helpers", () => {
  it("groups totals per course and module with a vote sum", () => {
    const groups = groupVoteTotals(view.totals);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ courseSlug: "python", totalVotes: 4 });
    expect(groups[0]!.versions.map((version) => version.votes)).toEqual([1, 3]);
  });

  it("lists the courses by title and filters by one", () => {
    expect(feedbackCourses(view).map((course) => course.slug)).toEqual(["agents", "python"]);
    const python = filterByCourse(view, "python");
    expect(python.totals).toHaveLength(2);
    expect(python.notes.map((note) => note.id)).toEqual(["n2"]);
    expect(filterByCourse(view, null)).toBe(view);
  });

  it("writes a plain-text summary with votes and notes", () => {
    const text = feedbackAsText(filterByCourse(view, "python"));
    expect(text).toContain("Python basics > Module 2 (4 votes)");
    expect(text).toContain("  Rewritten: shorter and plainer: 3 votes");
    expect(text).toContain("  Original: 1 vote");
    expect(text).toContain(
      "1. Python basics > Module 2\n   Preferred: Rewritten: shorter and plainer\n   From: Sara on 2026-11-25\n   Note: Shorter and clearer."
    );
    expect(text).not.toContain("Agents");
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(feedbackAsText({ totals: [], notes: [] })).toContain("No votes yet.");
  });
});

describe("agent IP feedback page", () => {
  it("needs an admin and shows totals, notes and the course filter", async () => {
    serverApiFetch.mockResolvedValue(view);
    const html = await renderPage();
    expect(requireRole).toHaveBeenCalledWith("ADMIN");
    expect(serverApiFetch).toHaveBeenCalledWith("/api/v1/admin/module-version-feedback");
    expect(html).toContain("Agent IP feedback");
    expect(html).toContain("Votes per version");
    expect(html).toContain("Shorter and clearer.");
    expect(html).toMatch(/Sara(<!-- -->)? · (<!-- -->)?2026-11-25/);
    expect(html).toContain('href="/admin/agent-ip-feedback?course=python"');
    expect(html).toContain("Copy as text");
    expect(html.indexOf("Shorter and clearer.")).toBeLessThan(html.indexOf("Liked the examples."));
  });

  it("filters to one course", async () => {
    serverApiFetch.mockResolvedValue(view);
    const html = await renderPage("agents");
    expect(html).toContain("Liked the examples.");
    expect(html).not.toContain("Shorter and clearer.");
    expect(html).toMatch(/aria-current="page"[^>]*>Agents in practice/);
  });

  it("explains the empty state in plain words", async () => {
    serverApiFetch.mockResolvedValue({ totals: [], notes: [] });
    const html = await renderPage();
    expect(html).toContain("No votes yet");
    expect(html).not.toContain("Copy as text");
  });
});
