import Link from "next/link";
import { ArrowLeft, CircleUserRound } from "lucide-react";
import { LearnerTrackBadges } from "@/components/teach/learner-track-badges";
import { Badge } from "@/components/ui/badge";
import type { MenteeEvaluation } from "@/shared/api/teach";

export function EvaluationHeader({
  evaluation,
  otherCourses = [],
}: {
  evaluation: MenteeEvaluation;
  /** The same learner's other courses you teach, for one-tap switching. */
  otherCourses?: Array<{ title: string; href: string; percent: number }>;
}) {
  const { course, mentee, enrollment } = evaluation;
  return (
    <header className="-mx-4 border-b border-border/70 px-4 py-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/learners" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-3.5" /> All learners
            </Link>
            <Link href={`/learners/${encodeURIComponent(mentee.id)}`} className="text-xs font-medium text-primary hover:underline">
              {mentee.name} across all courses
            </Link>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/60 text-muted-foreground">
              <CircleUserRound className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{mentee.name}</h1>
                <Badge variant="outline" className="capitalize">{enrollment.status.toLowerCase().replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{mentee.email ?? "No email"} · {course.title}</p>
              <LearnerTrackBadges track={evaluation.track} className="mt-2" />
              {otherCourses.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="This learner's other courses">
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                    {course.title} · {Math.round(enrollment.percentComplete)}%
                  </span>
                  {otherCourses.map((item) => (
                    <Link key={item.href} href={item.href} className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50">
                      {item.title} · {Math.round(item.percent)}%
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border bg-card px-4 py-2.5 lg:max-w-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current work · {enrollment.lastActiveLabel}</p>
          <p className="mt-1 truncate text-sm font-medium">{enrollment.currentChapter ?? "No chapter started"}</p>
        </div>
      </div>
    </header>
  );
}
