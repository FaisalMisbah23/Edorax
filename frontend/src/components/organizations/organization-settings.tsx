"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { organizationErrorText } from "@/lib/organizations";
import type { OrganizationDetail } from "@/shared/api/organizations";

export function OrganizationSettings({ detail }: { detail: OrganizationDetail }) {
  const router = useRouter();
  const [name, setName] = useState(detail.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!name.trim()) return setError("Give the organisation a name.");
    setBusy(true);
    try {
      await apiFetch<OrganizationDetail>(`/api/v1/organizations/${encodeURIComponent(detail.id)}`, { method: "PATCH", json: { name: name.trim() } });
      setMessage("Saved.");
      router.refresh();
    } catch (e) {
      setError(organizationErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Settings">
      <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-lg border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="organization-rename">Organisation name</Label>
          <Input id="organization-rename" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        <Button type="submit" loading={busy} disabled={busy}>
          Save name
        </Button>
      </form>
    </section>
  );
}
