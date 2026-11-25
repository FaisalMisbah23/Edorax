import type { AllMenteesView, MenteeEvaluation } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch, serverApiFetchOrNotFound } from "@/lib/api-server";
import { EvaluationHeader } from "@/components/teach/evaluation/evaluation-header";
import { EvaluationWorkspace } from "@/components/teach/evaluation/evaluation-workspace";

export default async function MenteeEvaluationPage({ params }: { params: Promise<{ courseSlug: string; enrollmentId: string }> }) {
  const { courseSlug, enrollmentId } = await params;
  await requireTeachSurface();
  const evaluation = await serverApiFetchOrNotFound<MenteeEvaluation>(
    `/api/v1/teach/courses/${encodeURIComponent(courseSlug)}/mentees/${encodeURIComponent(enrollmentId)}`
  );

  // The learner's other courses, for the switcher. A failure only hides the switcher.
  const others = await serverApiFetch<AllMenteesView>(`/api/v1/teach/mentees?learnerId=${encodeURIComponent(evaluation.mentee.id)}`)
    .then((view) => view.mentees.filter((item) => item.id !== enrollmentId))
    .catch(() => []);

  return <div className="min-h-screen">
    <EvaluationHeader
      evaluation={evaluation}
      otherCourses={others.map((item) => ({ title: item.course?.title ?? "Course", href: item.evaluationHref, percent: item.percentComplete }))}
    />
    <main className="mx-auto max-w-7xl space-y-5 py-5 sm:py-6">
      <EvaluationWorkspace evaluation={evaluation} />
    </main>
  </div>;
}
