import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, Mail, MessageSquareText } from "lucide-react";
import type { AllMenteesView, MentorHelpInboxView, ReviewQueueView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";

// One learner across every course you teach: progress per course, what they are on now,
// what waits on you, and one tap into any course's full progress.

function Bar({ percent }: { percent: number }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

export default async function LearnerAcrossCoursesPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  await requireTeachSurface();
  const id = encodeURIComponent(userId);
  const [view, queue, inbox] = await Promise.all([
    serverApiFetch<AllMenteesView>(`/api/v1/teach/mentees?learnerId=${id}`),
    serverApiFetch<ReviewQueueView>(`/api/v1/teach/review?learnerId=${id}`).catch(() => null),
    serverApiFetch<MentorHelpInboxView>(`/api/v1/teach/help/threads?learnerId=${id}&status=open`).catch(() => null),
  ]);
  // The server narrows to this learner; filter again in case the API is a deploy behind.
  const courses = view.mentees.filter((item) => item.userId === userId);
  if (courses.length === 0) notFound();

  const person = courses[0]!;
  const answers = queue?.items ?? [];
  const questions = (inbox?.threads ?? []).filter((thread) => thread.status === "OPEN");
  const average = Math.round(courses.reduce((sum, item) => sum + item.percentComplete, 0) / courses.length);
  const active = courses.filter((item) => item.activityState === "recent").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/learners" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> All learners
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{person.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{person.email ?? "No email"}</p>
          </div>
          {person.email ? (
            <a href={`mailto:${person.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/50">
              <Mail className="size-4" aria-hidden /> Email
            </a>
          ) : null}
        </div>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card sm:grid-cols-4">
        {[
          { label: "Courses", value: courses.length },
          { label: "Average progress", value: `${average}%` },
          { label: "Active in last 7 days", value: `${active} of ${courses.length}` },
          { label: "Waiting on you", value: answers.length + questions.length },
        ].map((metric) => (
          <div key={metric.label} className="border-b border-r p-4 sm:border-b-0">
            <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{metric.value}</p>
          </div>
        ))}
      </section>

      {answers.length + questions.length > 0 ? (
        <section aria-labelledby="waiting-title" className="rounded-2xl border border-amber-400/60 bg-card p-4 sm:p-5">
          <h2 id="waiting-title" className="text-base font-semibold">Waiting on you</h2>
          <ul className="mt-3 space-y-2">
            {answers.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <MessageSquareText className="size-4 shrink-0" aria-hidden /> Answer to check
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.courseTitle} › {item.chapterTitle}
                  </p>
                </div>
                <Link href={`/review/${item.id}`} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Review
                </Link>
              </li>
            ))}
            {questions.map((thread) => (
              <li key={thread.id} className="flex flex-col gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CircleHelp className="size-4 shrink-0" aria-hidden /> {thread.needsReply ? "Question needs your reply" : "Open question, waiting on the learner"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {thread.courseTitle}
                    {thread.chapterTitle ? ` › ${thread.chapterTitle}` : ""}
                  </p>
                </div>
                <Link href={`/help/${thread.id}`} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Open chat
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="courses-title">
        <h2 id="courses-title" className="text-base font-semibold">Courses</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {courses.map((item) => (
            <li key={item.id} className="flex flex-col rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-semibold text-foreground">{item.course?.title ?? "Course"}</p>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(item.percentComplete)}%</span>
              </div>
              <div className="mt-2">
                <Bar percent={item.percentComplete} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.chaptersCompleted} of {item.chapterCount} chapters · {item.maxScore ? `${item.score}/${item.maxScore} points` : "No score yet"} · {item.lastActiveLabel}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-foreground">
                <BookOpen className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                {item.currentChapter ? `Now on: ${item.currentChapter}` : "Has not opened a chapter yet"}
              </p>
              {item.attention.length ? (
                <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {item.attention.map((flag) => (
                    <span key={flag.kind}>{flag.label}</span>
                  ))}
                </p>
              ) : null}
              <div className="mt-auto pt-3">
                <Link href={item.evaluationHref} className="inline-flex h-9 items-center gap-1 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/50">
                  Open progress and work <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
