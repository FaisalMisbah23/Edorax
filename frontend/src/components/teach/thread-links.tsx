import Link from "next/link";
import { BookOpen, GraduationCap, UserRound } from "lucide-react";
import type { TeachLinks } from "@/shared/api/teach";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-background px-3.5 text-xs font-medium text-foreground hover:bg-muted/50 sm:min-h-8 sm:px-3";

/** Three shortcuts for any question or report: the course, the lesson and the learner. */
export function ThreadLinks({ links, learnerLabel, className }: { links: TeachLinks; learnerLabel: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Link href={links.courseHref} className={chip}>
        <GraduationCap className="size-3.5" aria-hidden /> Course
      </Link>
      {links.chapterHref ? (
        <Link href={links.chapterHref} className={chip}>
          <BookOpen className="size-3.5" aria-hidden /> Lesson
        </Link>
      ) : null}
      <Link href={links.learnerHref} className={chip} aria-label={`Open ${learnerLabel}'s page`}>
        <UserRound className="size-3.5" aria-hidden /> Learner
      </Link>
    </div>
  );
}
