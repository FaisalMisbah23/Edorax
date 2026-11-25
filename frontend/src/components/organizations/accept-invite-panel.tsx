"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api-client";
import { organizationErrorText, organizationHref } from "@/lib/organizations";
import { ORGANIZATION_ERROR_CODES, type AcceptOrganizationInviteResult } from "@/shared/api/organizations";

const PLAIN_ERRORS: Record<string, string> = {
  [ORGANIZATION_ERROR_CODES.INVITE_ACCEPTED]: "This invite has already been used. Ask the admin for a new one.",
  [ORGANIZATION_ERROR_CODES.INVITE_REVOKED]: "This invite was cancelled. Ask the admin for a new one.",
  [ORGANIZATION_ERROR_CODES.INVITE_EXPIRED]: "This invite has expired. Ask the admin for a new one.",
  [ORGANIZATION_ERROR_CODES.WRONG_ACCOUNT]: "This invite was sent to a different email address. Sign in with that account to accept it.",
};

export function AcceptInvitePanel({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<AcceptOrganizationInviteResult>(`/api/v1/organizations/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
      router.push(organizationHref(result.organizationId));
    } catch (e) {
      setError(e instanceof ApiError && PLAIN_ERRORS[e.code] ? PLAIN_ERRORS[e.code]! : organizationErrorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button type="button" className="w-full" loading={busy} disabled={busy} onClick={() => void accept()}>
        Accept invite
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
