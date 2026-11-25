import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import type { ClassCourseOptionsView, TeachClassesView } from "@/shared/api/classes";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { ClassCard } from "@/components/classes/class-card";
import { NewClassForm } from "@/components/classes/new-class-form";

export const metadata: Metadata = { title: "Classes" };

// A class is a named group of learners who join with a code and follow the same courses.

export default async function ClassesPage() {
  await requireTeachSurface();
  const [{ classes }, { courses }] = await Promise.all([
    serverApiFetch<TeachClassesView>("/api/v1/teach/classes"),
    serverApiFetch<ClassCourseOptionsView>("/api/v1/teach/classes/course-options"),
  ]);
  const ordered = [...classes.filter((c) => !c.archived), ...classes.filter((c) => c.archived)];

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Put learners in a class, share one link, and see their marks and due dates in one place.
        </p>
      </div>

      <NewClassForm options={courses} startOpen={classes.length === 0} />

      {ordered.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((item) => (
            <ClassCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border bg-background">
            <GraduationCap className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-base font-semibold">No classes yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Create your first class above. You get a join link to share right away.</p>
        </div>
      )}
    </div>
  );
}
