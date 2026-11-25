import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ClassCourseOptionsView } from "@/shared/api/classes";
import type { OrganizationDetail } from "@/shared/api/organizations";
import { requireLearnSurface } from "@/server/auth/guards";
import { serverApiFetch, serverApiFetchOrNotFound } from "@/lib/api-server";
import { ROLE_LABEL } from "@/lib/organizations";
import { Badge } from "@/components/ui/badge";
import { ClassTabs, type ClassTabPanel } from "@/components/classes/class-tabs";
import { OrganizationInvites } from "@/components/organizations/organization-invites";
import { OrganizationOverview } from "@/components/organizations/organization-overview";
import { OrganizationPeople } from "@/components/organizations/organization-people";
import { OrganizationSettings } from "@/components/organizations/organization-settings";

export const metadata: Metadata = { title: "Organisation" };

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const user = await requireLearnSurface();
  const [detail, { courses: options }] = await Promise.all([
    serverApiFetchOrNotFound<OrganizationDetail>(`/api/v1/organizations/${encodeURIComponent(organizationId)}`),
    serverApiFetch<ClassCourseOptionsView>("/api/v1/teach/classes/course-options").catch(() => ({ courses: [] })),
  ]);
  const isAdmin = detail.viewerRole === "ADMIN";

  const panels: ClassTabPanel[] = [
    { key: "overview", label: "Overview", node: <OrganizationOverview detail={detail} options={options} /> },
    { key: "people", label: "People", node: <OrganizationPeople detail={detail} viewerId={user.id} /> },
    ...(isAdmin
      ? [
          { key: "invites", label: "Invites", node: <OrganizationInvites detail={detail} /> },
          { key: "settings", label: "Settings", node: <OrganizationSettings detail={detail} /> },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-3">
        <Link href="/organizations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> All organisations
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-[32px] leading-tight tracking-[-0.035em] sm:text-[40px]">{detail.name}</h1>
          <Badge variant="secondary">You are {detail.viewerRole === "ADMIN" ? "an" : "a"} {ROLE_LABEL[detail.viewerRole].toLowerCase()}</Badge>
        </div>
      </header>
      <ClassTabs panels={panels} label="Organisation sections" />
    </div>
  );
}
