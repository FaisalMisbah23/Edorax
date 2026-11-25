import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { AcceptInvitePanel } from "@/components/organizations/accept-invite-panel";
import { NOINDEX } from "@/lib/seo";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";
import { getSessionUser } from "@/server/auth/guards";
import type { OrganizationInviteState, OrganizationInvitePreview } from "@/shared/api/organizations";

// An invite is a private link, so it stays out of search results.
export const metadata: Metadata = { title: "Organisation invite", robots: NOINDEX };

const CLOSED_TEXT: Record<Exclude<OrganizationInviteState, "valid">, string> = {
  accepted: "This invite has already been used. Ask the admin for a new one.",
  revoked: "This invite was cancelled. Ask the admin for a new one.",
  expired: "This invite has expired. Ask the admin for a new one.",
};

export default async function OrganizationInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview: OrganizationInvitePreview;
  try {
    preview = await serverApiFetch<OrganizationInvitePreview>(`/api/v1/organizations/invites/${encodeURIComponent(token)}`, { token: null });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <InviteShell title="This invite link does not exist">
          <p className="text-sm leading-relaxed text-muted-foreground">Check the link you were sent, or ask the admin for a new one.</p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Go to Edorax
          </Link>
        </InviteShell>
      );
    }
    throw error;
  }

  const user = await getSessionUser();
  const here = `/org-invite/${encodeURIComponent(token)}`;
  const name = preview.organization.name;
  const title = preview.role === "TEACHER" ? `You are invited to teach at ${name}` : `You are invited to help run ${name} as an admin`;

  return (
    <InviteShell title={title}>
      <div className="mb-6 space-y-1 border border-border p-4 text-sm text-muted-foreground">
        <p>{preview.invitedByName ? `Invited by ${preview.invitedByName}` : "An organisation on Edorax"}</p>
        {preview.email ? <p>This invite is for {preview.email}.</p> : null}
      </div>

      {preview.state !== "valid" ? (
        <p role="status" className="text-sm leading-relaxed text-muted-foreground">
          {CLOSED_TEXT[preview.state]}
        </p>
      ) : !user ? (
        <Link href={`/login?redirectTo=${encodeURIComponent(here)}`} className="block">
          <Button className="w-full">Sign in or create an account to accept</Button>
        </Link>
      ) : user.role !== "ADMIN" && !user.emailVerified ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Confirm your email address first, then open this link again to accept the invite.</p>
          <Link href="/verify-email" className={buttonVariants({ className: "w-full" })}>
            Confirm my email
          </Link>
        </div>
      ) : (
        <AcceptInvitePanel token={token} />
      )}
    </InviteShell>
  );
}

function InviteShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24">
      <Logo size="lg" />
      <div className="mt-10 w-full max-w-sm">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {children}
      </div>
    </div>
  );
}
