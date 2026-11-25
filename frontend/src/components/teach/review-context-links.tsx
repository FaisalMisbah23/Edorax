import Link from "next/link";
import { BookOpen, UserRound } from "lucide-react";
import type { ReviewContext } from "@/shared/api/teach";
import { cn } from "@/lib/utils";

// Two shortcuts every review needs: open the chapter the answer belongs to, and
// open the learner's progress for this course.

export function ReviewContextLinks({ item, className }: { item: ReviewContext; className?: string }) {
  const progress = item.learnerProgress;
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      <Link
        href={item.chapterHref}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-background px-4 font-medium text-foreground hover:bg-muted/50 sm:h-8 sm:px-3"
      >
        <BookOpen className="size-3.5" aria-hidden /> Open chapter
      </Link>
      <Link
        href={item.learnerHref}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-background px-4 font-medium text-foreground hover:bg-muted/50 sm:h-8 sm:px-3"
      >
        <UserRound className="size-3.5" aria-hidden />
        {progress ? `Learner: ${Math.round(progress.percentComplete)}% done` : "Learner progress"}
      </Link>
    </div>
  );
}
