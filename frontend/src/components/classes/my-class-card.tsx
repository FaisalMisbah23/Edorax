"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api-client";
import { ENROLLMENT_LABEL, coursePriceLabel, errorText, percentLabel } from "@/lib/classes";
import { DateRange, LocalDate } from "@/components/classes/local-date";
import { cn } from "@/lib/utils";
import type { MyClass, MyClassCourse } from "@/shared/api/classes";

function CourseRow({ course, now }: { course: MyClassCourse; now: number }) {
  const enrolled = course.state === "active" || course.state === "completed";
  return (
    <li className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 font-semibold">{course.title}</h3>
        <Badge variant={course.state === "payment-required" ? "destructive" : course.state === "completed" ? "default" : "secondary"}>{ENROLLMENT_LABEL[course.state]}</Badge>
      </div>
      {enrolled ? (
        <Progress value={course.percentComplete} className="gap-2 [&_[data-slot=progress-track]]:h-2">
          <ProgressLabel className="text-xs text-muted-foreground">{percentLabel(course.percentComplete)} complete</ProgressLabel>
        </Progress>
      ) : (
        <p className="text-sm text-muted-foreground">{course.state === "payment-required" ? "Finish payment to start this course." : `Not started. ${coursePriceLabel(course)}.`}</p>
      )}
      {course.dueDates.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {course.dueDates.map((due) => {
            const overdue = !due.done && new Date(due.dueAt).getTime() < now;
            return (
              <li key={due.moduleId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {due.done ? <Check className="size-4 text-primary" aria-label="Done" /> : <span className="size-4" aria-hidden />}
                <span className={cn("min-w-0", due.done && "text-muted-foreground line-through")}>{due.title}</span>
                <span className={cn("text-muted-foreground", overdue && "font-semibold text-destructive")}>
                  due <LocalDate iso={due.dueAt} withTime />
                </span>
                {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <Link href={enrolled ? `/courses/${course.slug}` : `/catalog/${course.slug}`} className={buttonVariants({ size: "sm", variant: enrolled ? "default" : "outline" })}>
        {enrolled ? (course.state === "completed" ? "Open course" : "Continue course") : "Get this course"}
      </Link>
    </li>
  );
}

export function MyClassCard({ item }: { item: MyClass }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<void>(`/api/v1/classes/${encodeURIComponent(item.id)}/leave`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <li className="space-y-5 border border-border bg-card p-5">
      <div>
        <h2 className="text-xl tracking-[-0.02em]">{item.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {item.teacherName ? `Taught by ${item.teacherName}` : "Class"}
          {item.startsAt || item.endsAt ? " · " : ""}
          <DateRange startsAt={item.startsAt} endsAt={item.endsAt} />
        </p>
      </div>
      <ul className="space-y-4">
        {item.courses.map((course) => (
          <CourseRow key={course.id} course={course} now={now} />
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {confirming ? (
        <div role="alertdialog" aria-label={`Leave ${item.name}`} className="flex flex-col gap-3 border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Leave {item.name}? Your teacher will no longer see you in this class. Your course progress stays.</p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="destructive" size="xs" loading={busy} disabled={busy} onClick={() => void leave()}>
              Yes, leave
            </Button>
            <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setConfirming(false)}>
              Stay
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="xs" onClick={() => setConfirming(true)}>
          Leave class
        </Button>
      )}
    </li>
  );
}
