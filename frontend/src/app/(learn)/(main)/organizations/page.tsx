import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import type { MyOrganizationsView } from "@/shared/api/organizations";
import { requireLearnSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { countLabel, organizationHref, ROLE_LABEL } from "@/lib/organizations";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";

export const metadata: Metadata = { title: "Organisations" };

export default async function OrganizationsPage() {
  await requireLearnSurface();
  const { organizations, canCreate } = await serverApiFetch<MyOrganizationsView>("/api/v1/organizations");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-[32px] leading-tight tracking-[-0.035em] sm:text-[40px]">Organisations</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">Run classes with your own teachers. You can invite teachers and see every class in one place.</p>
      </header>

      {organizations.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {organizations.map((org) => (
            <li key={org.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 break-words text-lg font-semibold tracking-tight">{org.name}</h2>
                <Badge variant="secondary">{ROLE_LABEL[org.role]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {countLabel(org.memberCount, "member", "members")} · {countLabel(org.classCount, "class", "classes")}
              </p>
              <div className="mt-auto">
                <Link href={organizationHref(org.id)} className={buttonVariants({ size: "sm" })}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border bg-background">
            <Building2 className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-semibold">You are not in an organisation yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Create one below, or open the invite link an organisation admin sent you.</p>
        </div>
      )}

      <div className="mt-8">
        {canCreate > 0 ? (
          <CreateOrganizationForm />
        ) : (
          <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            You have reached the number of organisations you can create. You can still join more organisations when an admin sends you an invite.
          </p>
        )}
      </div>
    </div>
  );
}
