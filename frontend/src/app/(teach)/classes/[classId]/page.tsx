import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ClassCourseOptionsView, ClassGradebookView, TeachClassDetail } from "@/shared/api/classes";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch, serverApiFetchOrNotFound } from "@/lib/api-server";
import { Badge } from "@/components/ui/badge";
import { ClassTabs } from "@/components/classes/class-tabs";
import { CopyJoinLinkButton } from "@/components/classes/copy-join-link-button";
import { DateRange } from "@/components/classes/local-date";
import { DueDatesPanel } from "@/components/classes/due-dates-panel";
import { GradebookTable } from "@/components/classes/gradebook-table";
import { RosterPanel } from "@/components/classes/roster-panel";
import { SettingsPanel } from "@/components/classes/settings-panel";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  await requireTeachSurface();
  const id = encodeURIComponent(classId);
  const [detail, gradebook, { courses: options }] = await Promise.all([
    serverApiFetchOrNotFound<TeachClassDetail>(`/api/v1/teach/classes/${id}`),
    serverApiFetchOrNotFound<ClassGradebookView>(`/api/v1/teach/classes/${id}/gradebook`),
    serverApiFetch<ClassCourseOptionsView>("/api/v1/teach/classes/course-options"),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="space-y-3">
        <Link href="/classes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> All classes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{detail.name}</h1>
              {detail.archived ? <Badge variant="outline">Archived</Badge> : null}
            </div>
            {detail.organization ? <p className="mt-0.5 text-xs text-muted-foreground">{detail.organization.name}</p> : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.memberCount} {detail.memberCount === 1 ? "learner" : "learners"}
              {detail.startsAt || detail.endsAt ? " · " : ""}
              <DateRange startsAt={detail.startsAt} endsAt={detail.endsAt} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Join code <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono font-semibold">{detail.joinCode}</span>
            </p>
            <CopyJoinLinkButton joinUrl={detail.joinUrl} size="sm" />
          </div>
        </div>
      </header>

      <ClassTabs
        panels={[
          { key: "gradebook", label: "Gradebook", node: <GradebookTable classId={detail.id} gradebook={gradebook} /> },
          { key: "learners", label: "Learners", node: <RosterPanel detail={detail} /> },
          { key: "due-dates", label: "Due dates", node: <DueDatesPanel detail={detail} /> },
          { key: "settings", label: "Settings", node: <SettingsPanel detail={detail} options={options} /> },
        ]}
      />
    </div>
  );
}
