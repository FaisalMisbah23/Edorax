import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { CourseSettingsView } from "@/shared/api/teach";
import type { AnnouncementSummary } from "@/shared/api/course-announcements";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch, serverApiFetchOrNotFound } from "@/lib/api-server";
import { AnnouncementComposer } from "@/components/teach/announcements/announcement-composer";
import { SentAnnouncements } from "@/components/teach/announcements/sent-announcements";
import { Badge } from "@/components/ui/badge";

export default async function CourseAnnouncePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  await requireTeachSurface();
  // The settings view is the instructor's view of the course: it answers 404 or 403 like the other course pages.
  const course = await serverApiFetchOrNotFound<CourseSettingsView>(`/api/v1/teach/courses/${encodeURIComponent(courseSlug)}/settings`);
  const announcements = await serverApiFetch<AnnouncementSummary[]>(`/api/v1/teach/courses/${encodeURIComponent(course.id)}/announcements`);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-7 pb-16">
      <header className="space-y-5 border-b pb-6">
        <Link href={`/courses/${course.slug}/edit`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Back to curriculum</Link>
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{course.title}</p>
            <Badge variant={course.status === "PUBLISHED" ? "default" : "secondary"}>{course.status === "PUBLISHED" ? "Published" : course.status === "ARCHIVED" ? "Archived" : "Draft"}</Badge>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Announce</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tell everyone enrolled in this course about a change. They get it in the bell and by email. Learners who turned off Courses emails get only the bell notice.
          </p>
        </div>
      </header>

      <AnnouncementComposer course={{ id: course.id, slug: course.slug, title: course.title, status: course.status }} />

      <SentAnnouncements announcements={announcements} />
    </main>
  );
}
