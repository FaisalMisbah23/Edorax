"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { countLabel, organizationErrorText, ROLE_LABEL } from "@/lib/organizations";
import { LocalDate } from "@/components/classes/local-date";
import type { OrganizationDetail, OrganizationMemberRow, OrganizationRole } from "@/shared/api/organizations";

type Pending = { kind: "remove" | "role" | "leave"; userId: string };

function otherRole(role: OrganizationRole): OrganizationRole {
  return role === "ADMIN" ? "TEACHER" : "ADMIN";
}

export function OrganizationPeople({ detail, viewerId }: { detail: OrganizationDetail; viewerId: string }) {
  const router = useRouter();
  const isAdmin = detail.viewerRole === "ADMIN";
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/v1/organizations/${encodeURIComponent(detail.id)}/members`;

  const run = async (work: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setPending(null);
      if (after) after();
      else router.refresh();
    } catch (e) {
      setError(organizationErrorText(e));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmText = (member: OrganizationMemberRow, item: Pending): string => {
    if (item.kind === "leave") return "Leave this organisation? You will lose access to its classes. An admin can invite you again.";
    if (item.kind === "role") {
      return otherRole(member.role) === "ADMIN"
        ? `Make ${member.name} an admin? Admins can see every class, invite teachers and change settings.`
        : `Make ${member.name} a teacher? They will only see their own classes.`;
    }
    return `Remove ${member.name} from this organisation? Their classes stay in the organisation and you can still open them.`;
  };

  const confirmed = (member: OrganizationMemberRow, item: Pending) => {
    const url = `${base}/${encodeURIComponent(member.userId)}`;
    if (item.kind === "role") return run(() => apiFetch<unknown>(url, { method: "PATCH", json: { role: otherRole(member.role) } }).then(() => undefined));
    if (item.kind === "leave") return run(() => apiFetch<void>(url, { method: "DELETE" }), () => router.push("/organizations"));
    return run(() => apiFetch<void>(url, { method: "DELETE" }));
  };

  return (
    <section aria-label="People" className="space-y-3">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-3">
        {detail.members.map((member) => {
          const self = member.userId === viewerId;
          const active = pending?.userId === member.userId ? pending : null;
          return (
            <li key={member.userId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 break-words font-semibold">{self ? `${member.name} (you)` : member.name}</p>
                    <Badge variant={member.role === "ADMIN" ? "default" : "secondary"}>{ROLE_LABEL[member.role]}</Badge>
                  </div>
                  {member.email ? <p className="truncate text-sm text-muted-foreground">{member.email}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {countLabel(member.classCount, "class", "classes")} · Joined <LocalDate iso={member.joinedAt} />
                  </p>
                </div>
                {active ? null : (
                  <div className="flex flex-wrap gap-2">
                    {isAdmin && !self ? (
                      <>
                        <Button type="button" variant="outline" size="xs" onClick={() => setPending({ kind: "role", userId: member.userId })}>
                          {member.role === "ADMIN" ? "Make teacher" : "Make admin"}
                        </Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => setPending({ kind: "remove", userId: member.userId })}>
                          Remove
                        </Button>
                      </>
                    ) : null}
                    {self ? (
                      <Button type="button" variant="outline" size="xs" onClick={() => setPending({ kind: "leave", userId: member.userId })}>
                        Leave organisation
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
              {active ? (
                <div role="alertdialog" aria-label={`Confirm for ${member.name}`}className="mt-3 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">{confirmText(member, active)}</p>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant={active.kind === "role" ? "default" : "destructive"} size="xs" loading={busy} disabled={busy} onClick={() => void confirmed(member, active)}>
                      {active.kind === "role" ? "Yes, change role" : active.kind === "leave" ? "Yes, leave" : "Yes, remove"}
                    </Button>
                    <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setPending(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
