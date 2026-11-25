import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { NewClassForm } from "@/components/classes/new-class-form";
import { countLabel, organizationClassHref } from "@/lib/organizations";
import type { ClassCourseRef } from "@/shared/api/classes";
import type { OrganizationDetail } from "@/shared/api/organizations";

export function OrganizationOverview({ detail, options }: { detail: OrganizationDetail; options: ClassCourseRef[] }) {
  const { stats } = detail;
  const numbers = [
    { label: stats.teachers === 1 ? "Teacher" : "Teachers", value: stats.teachers },
    { label: stats.classes === 1 ? "Active class" : "Active classes", value: stats.classes },
    { label: stats.learners === 1 ? "Learner" : "Learners", value: stats.learners },
    { label: "Active in the last 7 days", value: stats.activeLearners7d },
  ];
  const ordered = [...detail.classes.filter((c) => !c.archived), ...detail.classes.filter((c) => c.archived)];

  return (
    <section aria-label="Overview" className="space-y-7">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {numbers.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <dd className="text-3xl font-semibold tabular-nums tracking-tight">{item.value}</dd>
            <dt className="mt-1 text-sm text-muted-foreground">{item.label}</dt>
          </div>
        ))}
      </dl>

      <NewClassForm options={options} startOpen={detail.classes.length === 0} organizationId={detail.id} />

      {ordered.length ? (
        <ul className="space-y-3">
          {ordered.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 break-words font-semibold">{item.name}</h3>
                  {item.archived ? <Badge variant="outline">Archived</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.teacher.name} · {countLabel(item.memberCount, "learner", "learners")}
                </p>
                <p className="text-sm text-muted-foreground">{item.courses.length ? item.courses.map((course) => course.title).join(", ") : "No courses yet"}</p>
              </div>
              <div className="shrink-0">
                {item.canOpen ? (
                  <Link href={organizationClassHref(detail.id, item.id)} className={buttonVariants({ size: "sm" })}>
                    Open class
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Run by {item.teacher.name}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border bg-background">
            <GraduationCap className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-semibold">No classes yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Create the first class for this organisation above. Teachers you invite can create their own.</p>
        </div>
      )}
    </section>
  );
}
