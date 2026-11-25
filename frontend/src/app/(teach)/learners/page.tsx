import { Users } from "lucide-react";
import type { AllMenteesView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { AutoSubmitSelect } from "@/components/teach/auto-submit-select";
import { CohortSummary } from "@/components/teach/mentees/cohort-summary";
import { MenteesNeedingAttention } from "@/components/teach/mentees/needs-attention";
import { LearnerDirectory } from "@/components/teach/mentees/learner-directory";

// Every learner across the instructor's courses. All courses by default; the
// course filter narrows it, and each course keeps its own mentees page for invites.

export default async function AllLearnersPage({ searchParams }: { searchParams: Promise<{ courseId?: string }> }) {
  await requireTeachSurface();
  const { courseId } = await searchParams;
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
  const view = await serverApiFetch<AllMenteesView>(`/api/v1/teach/mentees${query}`);
  const selected = view.courses.find((course) => course.id === view.courseId) ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Learners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected
              ? `${view.learnerCount} learners in ${selected.title}.`
              : `${view.learnerCount} learners across all ${view.courses.length} of your courses (${view.mentees.length} enrollments). Open a learner to see each course.`}
          </p>
        </div>
        {view.courses.length > 1 ? (
          <form className="flex items-center gap-2" action="/learners" method="GET">
            <AutoSubmitSelect
              name="courseId"
              defaultValue={view.courseId ?? ""}
              aria-label="Filter by course"
              className="h-9 max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="">All courses</option>
              {view.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        ) : null}
      </div>

      <CohortSummary summary={view.summary} learnerCount={view.learnerCount} />

      {view.mentees.length ? (
        <>
          <MenteesNeedingAttention mentees={view.attentionMentees} />
          <LearnerDirectory mentees={view.mentees} />
        </>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border bg-background">
            <Users className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-base font-semibold">No learners yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Invite learners from a course&apos;s Learners page, and they will show up here.
          </p>
        </div>
      )}
    </div>
  );
}
