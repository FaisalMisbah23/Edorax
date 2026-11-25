import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyJoinLinkButton } from "@/components/classes/copy-join-link-button";
import type { ClassSummary } from "@/shared/api/classes";

export function ClassCard({ item }: { item: ClassSummary }) {
  return (
    <li className={cn("flex flex-col gap-4 rounded-lg border border-border bg-card p-5", item.archived && "opacity-80")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight">{item.name}</h2>
        {item.archived ? <Badge variant="outline">Archived</Badge> : null}
      </div>
      {item.organization ? <p className="-mt-2 text-xs text-muted-foreground">{item.organization.name}</p> : null}
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="size-4" aria-hidden />
        {item.memberCount} {item.memberCount === 1 ? "learner" : "learners"}
      </p>
      <p className="text-sm text-muted-foreground">
        {item.courses.length ? item.courses.map((course) => course.title).join(", ") : "No courses yet"}
      </p>
      <p className="text-sm">
        Join code <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono font-semibold">{item.joinCode}</span>
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Link href={`/classes/${item.id}`} className={buttonVariants({ size: "sm" })}>
          Open class
        </Link>
        <CopyJoinLinkButton joinUrl={item.joinUrl} size="sm" />
      </div>
    </li>
  );
}
