"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/clipboard";
import { organizationErrorText, ROLE_LABEL } from "@/lib/organizations";
import { LocalDate } from "@/components/classes/local-date";
import type { OrganizationDetail, OrganizationInviteRow, OrganizationRole } from "@/shared/api/organizations";

function CopyLinkButton({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    setState((await copyToClipboard(url)) ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 2000);
  };
  return (
    <Button type="button" variant="outline" size="xs" onClick={() => void copy()}>
      {state === "copied" ? <Check /> : <Link2 />}
      {state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : label}
    </Button>
  );
}

export function OrganizationInvites({ detail }: { detail: OrganizationDetail }) {
  const router = useRouter();
  const [role, setRole] = useState<OrganizationRole>("TEACHER");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [created, setCreated] = useState<OrganizationInviteRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/v1/organizations/${encodeURIComponent(detail.id)}/invites`;

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const row = await apiFetch<OrganizationInviteRow>(base, { method: "POST", json: { role, email: email.trim() || null } });
      setCreated(row);
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(organizationErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (invite: OrganizationInviteRow) => {
    setCancelling(invite.id);
    setError(null);
    try {
      await apiFetch<void>(`${base}/${encodeURIComponent(invite.id)}`, { method: "DELETE" });
      if (created?.id === invite.id) setCreated(null);
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setError(organizationErrorText(e));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <section aria-label="Invites" className="space-y-7">
      <form onSubmit={(event) => void create(event)} className="space-y-5 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Invite someone</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Role</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["TEACHER", "ADMIN"] as const).map((value) => (
              <label key={value} className="inline-flex min-h-11 items-center gap-2">
                <input type="radio" name="invite-role" value={value} checked={role === value} onChange={() => setRole(value)} className="size-4" />
                {ROLE_LABEL[value]}
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{role === "TEACHER" ? "Teachers run their own classes." : "Admins can also see every class and manage people."}</p>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email (optional)</Label>
          <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="teacher@example.com" />
          <p className="text-sm text-muted-foreground">Leave empty for a link anyone can use once.</p>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" loading={busy} disabled={busy}>
          Create invite link
        </Button>
        {created ? (
          <div role="status" className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Invite link ready. Send it to the person you are inviting.</p>
            <p className="break-all rounded-sm bg-background px-2 py-1.5 font-mono text-xs">{created.url}</p>
            <CopyLinkButton url={created.url} label="Copy" />
          </div>
        ) : null}
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Open invites</h2>
        {detail.invites.length ? (
          <ul className="space-y-3">
            {detail.invites.map((invite) => (
              <li key={invite.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{ROLE_LABEL[invite.role]}</p>
                    <p className="truncate text-sm text-muted-foreground">{invite.email ?? "Anyone with the link"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Expires <LocalDate iso={invite.expiresAt} />
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyLinkButton url={invite.url} />
                    {confirming === invite.id ? null : (
                      <Button type="button" variant="outline" size="xs" onClick={() => setConfirming(invite.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {confirming === invite.id ? (
                  <div role="alertdialog" aria-label="Cancel invite" className="mt-3 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm">Cancel this invite? The link will stop working.</p>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="destructive" size="xs" loading={cancelling === invite.id} disabled={cancelling !== null} onClick={() => void cancel(invite)}>
                        Yes, cancel invite
                      </Button>
                      <Button type="button" variant="ghost" size="xs" disabled={cancelling !== null} onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">No open invites.</p>
        )}
      </div>
    </section>
  );
}
