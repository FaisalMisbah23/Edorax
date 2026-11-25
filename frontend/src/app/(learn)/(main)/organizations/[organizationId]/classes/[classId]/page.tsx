import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ClassCourseOptionsView, ClassGradebookView, TeachClassDetail } from "@/shared/api/classes";
import { requireLearnSurface } from "@/server/auth/guards";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";
import { organizationHref } from "@/lib/organizations";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ClassTabs } from "@/components/classes/class-tabs";
import { CopyJoinLinkButton } from "@/components/classes/copy-join-link-button";
import { DateRange } from "@/components/classes/local-date";
import { DueDatesPanel } from "@/components/classes/due-dates-panel";
import { GradebookTable } from "@/components/classes/gradebook-table";
import { RosterPanel } from "@/components/classes/roster-panel";
import { SettingsPanel } from "@/components/classes/settings-panel";

export const metadata: Metadata = { title: "Class" };

export default async function OrganizationClassPage({ params }: { params: Promise<{ organizationId: string; classId: string }> }) {
  const { organizationId, classId } = await params;
  await requireLearnSurface();
  const back = organizationHref(organizationId);
  const id = encodeURIComponent(classId);

  let loaded: [TeachClassDetail, ClassGradebookView, ClassCourseOptionsView];
  try {
    loaded = await Promise.all([
      serverApiFetch<TeachClassDetail>(`/api/v1/teach/classes/${id}`),
      serverApiFetch<ClassGradebookView>(`/api/v1/teach/classes/${id}/gradebook`),
      serverApiFetch<ClassCourseOptionsView>("/api/v1/teach/classes/course-options"),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <div className="mx-auto w-full max-w-xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">You cannot open this class</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Only the teacher of a class and the organisation admins can open it.</p>
          <Link href={back} className={buttonVariants({ className: "mt-6" })}>
            Back to the organisation
          </Link>
        </div>
      );
    }
    throw error;
  }
  const [detail, gradebook, { courses: options }] = loaded;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-3">
        <Link href={back} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Back to the organisation
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-foreground">{detail.name}</h1>
              {detail.archived ? <Badge variant="outline">Archived</Badge> : null}
            </div>
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
